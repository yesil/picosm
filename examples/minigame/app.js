import { observe } from '../../dist/picosm.js';
import { Game, Player, Score, Obstacle } from './model.js';

// Initialize game
const game = new Game();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// DOM Elements
const startButton = document.getElementById('startButton');
const pauseButton = document.getElementById('pauseButton');
const resetButton = document.getElementById('resetButton');
const currentScoreDisplay = document.getElementById('currentScore');
const highScoreDisplay = document.getElementById('highScore');
const lastScoreDisplay = document.getElementById('lastScore');
const timeLeftDisplay = document.getElementById('timeLeft');

// Game constants
const GRAVITY = 0.5;
const GROUND_Y = 350;
const PLAYER_WIDTH = 30;
const PLAYER_HEIGHT = 50;
const MOVE_SPEED = 5;

// Game state
let gameLoop;
let lastTimestamp = 0;
let canJump = true;

// Input handling
const keys = {
    left: false,
    right: false,
    space: false
};

window.addEventListener('keydown', (e) => {
    switch(e.key) {
        case 'ArrowLeft':
            keys.left = true;
            break;
        case 'ArrowRight':
            keys.right = true;
            break;
        case ' ':
            if (canJump && !game.player.jumping && game.player.y >= GROUND_Y - PLAYER_HEIGHT) {
                game.player.jump();
                canJump = false;
            }
            break;
    }
});

window.addEventListener('keyup', (e) => {
    switch(e.key) {
        case 'ArrowLeft':
            keys.left = false;
            break;
        case 'ArrowRight':
            keys.right = false;
            break;
        case ' ':
            keys.space = false;
            canJump = true;
            break;
    }
});

// Only one obstacle
let bouncingObstacle = null;

// Track the last side the player was on relative to the obstacle
let lastPlayerSide = null;

// Button event handlers
startButton.addEventListener('click', () => {
    game.start();
    // Center the player horizontally and place on the ground
    game.player.x = (canvas.width - PLAYER_WIDTH) / 2;
    game.player.y = GROUND_Y - PLAYER_HEIGHT;
    // Create a single bouncing obstacle
    const width = 50;
    const height = 40;
    const y = GROUND_Y - height - 30;
    const speed = 4;
    const direction = Math.random() < 0.5 ? 1 : -1;
    const x = direction === 1 ? 0 : canvas.width - width;
    bouncingObstacle = new Obstacle(x, y, width, height, speed, direction);
    game.obstacles = [bouncingObstacle];
    startButton.disabled = true;
    pauseButton.disabled = false;
    startGameLoop();
});

pauseButton.addEventListener('click', () => {
    if (game.isRunning) {
        game.pause();
        pauseButton.textContent = 'Resume';
        cancelAnimationFrame(gameLoop);
    } else {
        game.resume();
        pauseButton.textContent = 'Pause';
        startGameLoop();
    }
});

resetButton.addEventListener('click', () => {
    game.reset();
    // Center the player horizontally and place on the ground
    game.player.x = (canvas.width - PLAYER_WIDTH) / 2;
    game.player.y = GROUND_Y - PLAYER_HEIGHT;
    // Reset the bouncing obstacle
    const width = 50;
    const height = 40;
    const y = GROUND_Y - height - 30;
    const speed = 4;
    const direction = Math.random() < 0.5 ? 1 : -1;
    const x = direction === 1 ? 0 : canvas.width - width;
    bouncingObstacle = new Obstacle(x, y, width, height, speed, direction);
    game.obstacles = [bouncingObstacle];
    startButton.disabled = false;
    pauseButton.disabled = true;
    pauseButton.textContent = 'Pause';
    cancelAnimationFrame(gameLoop);
    render();
});

// Game loop
function startGameLoop() {
    lastTimestamp = performance.now();
    gameLoop = requestAnimationFrame(update);
}

function update(timestamp) {
    const deltaTime = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    if (game.isRunning) {
        // Update player position
        if (keys.left) game.player.move(-MOVE_SPEED);
        if (keys.right) game.player.move(MOVE_SPEED);
        // Prevent player from leaving the canvas
        if (game.player.x < 0) game.player.x = 0;
        if (game.player.x + PLAYER_WIDTH > canvas.width) game.player.x = canvas.width - PLAYER_WIDTH;

        // (Jump logic handled in keydown)

        // Apply gravity
        if (game.player.jumping) {
            game.player.y -= game.player.velocity;
            game.player.velocity -= GRAVITY;
            console.log('Player y:', game.player.y, 'velocity:', game.player.velocity);

            // Check for ground collision
            if (game.player.y >= GROUND_Y - PLAYER_HEIGHT) {
                game.player.y = GROUND_Y - PLAYER_HEIGHT;
                game.player.jumping = false;
                game.player.velocity = 0;
            }
        }

        // Update the single bouncing obstacle
        if (bouncingObstacle) {
            bouncingObstacle.x += bouncingObstacle.speed * bouncingObstacle.direction;
            // Bounce off left/right edges
            if (bouncingObstacle.x <= 0) {
                bouncingObstacle.x = 0;
                bouncingObstacle.direction = 1;
            } else if (bouncingObstacle.x + bouncingObstacle.width >= canvas.width) {
                bouncingObstacle.x = canvas.width - bouncingObstacle.width;
                bouncingObstacle.direction = -1;
            }
        }

        // Award points for hopping over the obstacle
        if (bouncingObstacle) {
            // Determine which side the player is on
            let playerSide = null;
            if (game.player.x + PLAYER_WIDTH < bouncingObstacle.x) {
                playerSide = 'left';
            } else if (game.player.x > bouncingObstacle.x + bouncingObstacle.width) {
                playerSide = 'right';
            }
            // If the player is above the obstacle and crosses from one side to the other, award points
            const playerAbove = game.player.y + PLAYER_HEIGHT <= bouncingObstacle.y;
            if (playerSide && lastPlayerSide && playerSide !== lastPlayerSide && playerAbove) {
                game.scoreManager.addPoints(10);
            }
            if (playerSide) {
                lastPlayerSide = playerSide;
            }
        }

        // Collision detection
        if (bouncingObstacle && bouncingObstacle.collidesWith(game.player)) {
            game.stop();
            // Save current score as last score before resetting
            game.scoreManager._lastScore = game.scoreManager.totalScore;
            game.scoreManager.reset();
            startButton.disabled = false;
            pauseButton.disabled = true;
        }

        // Update time
        game.timeLeft = Math.max(0, game.timeLeft - deltaTime / 1000);
        if (game.timeLeft <= 0) {
            game.stop();
            // Save current score as last score before resetting
            game.scoreManager._lastScore = game.scoreManager.totalScore;
            game.scoreManager.reset();
            startButton.disabled = false;
            pauseButton.disabled = true;
            return;
        }

        // Increment score by 1 every second survived
        if (!game._scoreTimer) game._scoreTimer = 0;
        game._scoreTimer += deltaTime;
        if (game._scoreTimer >= 1000) {
            game.scoreManager.addPoints(1);
            game._scoreTimer -= 1000;
        }

        render();
        gameLoop = requestAnimationFrame(update);
    }
}

// Rendering
function render() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw ground
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(0, GROUND_Y, canvas.width, canvas.height - GROUND_Y);

    // Draw player
    ctx.fillStyle = '#2196F3';
    ctx.fillRect(
        game.player.x,
        game.player.y,
        PLAYER_WIDTH,
        PLAYER_HEIGHT
    );
    
    // Draw the single bouncing obstacle
    if (bouncingObstacle) {
        ctx.fillStyle = '#111';
        ctx.fillRect(bouncingObstacle.x, bouncingObstacle.y, bouncingObstacle.width, bouncingObstacle.height);
    }

    // Draw 'Game Over' message if game is not running and timeLeft > 0
    if (!game.isRunning && game.timeLeft > 0 && game.scoreManager.totalScore > 0) {
        ctx.save();
        ctx.font = 'bold 48px Arial';
        ctx.fillStyle = '#ff4444';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2);
        ctx.restore();
    }
}

// Observe game state changes
observe(game, () => {
    timeLeftDisplay.textContent = Math.ceil(game.timeLeft);
});

observe(game.scoreManager, () => {
    currentScoreDisplay.textContent = game.scoreManager.totalScore;
    highScoreDisplay.textContent = game.scoreManager.highScore;
    lastScoreDisplay.textContent = game.scoreManager.lastScore;
});

// Initial render
render();
