import { makeObservable } from '../../dist/picosm.js';

class Game {
    static observableActions = ['start', 'stop', 'pause', 'resume', 'reset', 'addObstacle', 'removeObstacle'];
    static computedProperties = ['score', 'timeLeft', 'isRunning'];

    constructor() {
        this.score = 0;
        this.timeLeft = 60; // 60 seconds game time
        this.isRunning = false;
        this.player = new Player();
        this.scoreManager = new Score();
        this.obstacles = [];
    }

    start() {
        this.isRunning = true;
        this.timeLeft = 60;
        this.score = 0;
    }

    stop() {
        this.isRunning = false;
    }

    pause() {
        this.isRunning = false;
    }

    resume() {
        this.isRunning = true;
    }

    reset() {
        this.score = 0;
        this.timeLeft = 60;
        this.isRunning = false;
        this.player.setPosition(0, 0);
    }

    addObstacle(obstacle) {
        this.obstacles.push(obstacle);
    }

    removeObstacle(obstacle) {
        this.obstacles = this.obstacles.filter(o => o !== obstacle);
    }
}
makeObservable(Game);

class Player {
    static observableActions = ['move', 'jump', 'setPosition'];
    static computedProperties = ['isJumping', 'position'];

    constructor() {
        this.x = 0;
        this.y = 0;
        this.jumping = false;
        this.velocity = 0;
    }

    move(dx) {
        this.x += dx;
    }

    jump() {
        if (!this.jumping) {
            this.jumping = true;
            // For a 70px jump: v = sqrt(2 * g * h), g = 0.5, h = 70
            this.velocity = Math.sqrt(2 * 0.5 * 100); // ~8.37
            console.log('Jump triggered');
        }
    }

    setPosition(x, y) {
        this.x = x;
        this.y = y;
    }

    get isJumping() {
        return this.jumping;
    }

    get position() {
        return { x: this.x, y: this.y };
    }
}
makeObservable(Player);

class Score {
    static observableActions = ['addPoints', 'subtractPoints', 'reset'];
    static computedProperties = ['totalScore', 'highScore', 'lastScore'];

    constructor() {
        this.points = 0;
        this._highScore = Number(localStorage.getItem('highScore')) || 0;
        this._lastScore = 0;
    }

    addPoints(amount) {
        this.points += amount;
        if (this.points > this._highScore) {
            this._highScore = this.points;
            localStorage.setItem('highScore', this._highScore);
        }
    }

    subtractPoints(amount) {
        this.points = Math.max(0, this.points - amount);
    }

    reset() {
        this.points = 0;
    }

    get totalScore() {
        return this.points;
    }

    get highScore() {
        return this._highScore;
    }

    get lastScore() {
        return this._lastScore;
    }
}
makeObservable(Score);

class Obstacle {
    constructor(x, y, width, height, speed, direction) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.speed = speed;
        this.direction = direction;
    }
    
    update() {
        this.x += this.speed * this.direction;
    }

    collidesWith(player) {
        return (
            this.x < player.x + 30 &&
            this.x + this.width > player.x &&
            this.y < player.y + 50 &&
            this.y + this.height > player.y
        );
    }
}

export { Game, Player, Score, Obstacle };

