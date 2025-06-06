# Minigame StateManager Demo - Documentation

A jump-and-dodge minigame built with the StateManager pattern, featuring a player who must avoid obstacles while collecting points.

## 🎮 Game Overview

**Objective**: Control a blue player box, jump over moving obstacles, and survive as long as possible while earning points.

**Game Mechanics**:
- **Movement**: Arrow keys (←/→) move the player horizontally
- **Jumping**: Spacebar makes the player jump with realistic physics
- **Scoring**: +1 point per second survived, +10 bonus points for jumping over obstacles
- **Time Limit**: 60 seconds per game
- **Obstacles**: Single black obstacle that bounces off screen edges
- **Collision**: Game ends if player touches the obstacle

## 🏗️ Architecture Overview

The minigame follows a clean separation of concerns using the StateManager pattern:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│    model.js     │    │     app.js      │    │   index.html    │
│   (Data Model)  │    │  (Game Logic)   │    │   (UI/View)     │
│                 │    │                 │    │                 │
│ • Game State    │◄──►│ • Game Loop     │◄──►│ • Canvas        │
│ • Player        │    │ • Input Handler │    │ • Controls      │
│ • Score         │    │ • Renderer      │    │ • Score Display │
│ • Obstacle      │    │ • Physics       │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📁 File Structure

### `model.js` - Data Models & State Management

Contains all game data classes with StateManager integration:

#### **Game Class** 🎯
Main game state controller with StateManager observability.

```javascript
class Game {
    static observableActions = ['start', 'stop', 'pause', 'resume', 'reset', 'addObstacle', 'removeObstacle'];
    static computedProperties = ['score', 'timeLeft', 'isRunning'];
}
```

**Properties**:
- `score`: Current game score (0-based)
- `timeLeft`: Remaining game time (60 seconds max)
- `isRunning`: Boolean game state
- `player`: Player instance
- `scoreManager`: Score tracking instance
- `obstacles`: Array of obstacle objects

**Methods**:
- `start()`: Initialize new game session
- `stop()`: End current game
- `pause()/resume()`: Game state control
- `reset()`: Reset all game values
- `addObstacle()/removeObstacle()`: Obstacle management

#### **Player Class** 🏃
Handles player position, movement, and jumping physics.

```javascript
class Player {
    static observableActions = ['move', 'jump', 'setPosition'];
    static computedProperties = ['isJumping', 'position'];
}
```

**Properties**:
- `x, y`: Player position coordinates
- `jumping`: Boolean jump state
- `velocity`: Current vertical velocity for physics

**Physics System**:
- **Jump velocity**: `√(2 × gravity × jumpHeight)` = ~8.37
- **Gravity constant**: 0.5 pixels/frame²
- **Jump height**: ~100 pixels maximum

**Methods**:
- `move(dx)`: Horizontal movement
- `jump()`: Initiate jump with physics
- `setPosition(x, y)`: Direct position setting

#### **Score Class** 📊
Manages scoring system with persistent high scores.

```javascript
class Score {
    static observableActions = ['addPoints', 'subtractPoints', 'reset'];
    static computedProperties = ['totalScore', 'highScore', 'lastScore'];
}
```

**Features**:
- **Current score**: Active game points
- **High score**: Persistent via `localStorage`
- **Last score**: Previous game result
- **Auto-save**: High scores saved automatically

#### **Obstacle Class** 🚧
Non-observable class for obstacle behavior.

**Properties**:
- `x, y`: Position coordinates
- `width, height`: Collision dimensions (50×40px)
- `speed`: Movement speed (4 pixels/frame)
- `direction`: Movement direction (-1 or 1)

**Methods**:
- `update()`: Position update logic
- `collidesWith(player)`: AABB collision detection

### `app.js` - Game Logic & Rendering

Main application controller handling game loop, input, physics, and rendering.

#### **Game Constants**
```javascript
const GRAVITY = 0.5;           // Physics gravity
const GROUND_Y = 350;          // Ground level
const PLAYER_WIDTH = 30;       // Player dimensions
const PLAYER_HEIGHT = 50;
const MOVE_SPEED = 5;          // Horizontal movement speed
```

#### **Input System** ⌨️
Real-time keyboard input handling:

```javascript
const keys = { left: false, right: false, space: false };

// Event listeners for keydown/keyup
// Prevents key repeat issues
// Jump cooldown system prevents multi-jumping
```

**Controls**:
- `ArrowLeft/Right`: Continuous movement
- `Space`: Jump (with cooldown prevention)

#### **Game Loop Architecture** 🔄

```javascript
function startGameLoop() {
    lastTimestamp = performance.now();
    gameLoop = requestAnimationFrame(update);
}

function update(timestamp) {
    // 1. Calculate deltaTime
    // 2. Update player physics
    // 3. Update obstacles
    // 4. Check collisions
    // 5. Update scoring
    // 6. Update animations
    // 7. Render frame
    // 8. Continue loop
}
```

#### **Physics System** ⚡

**Player Movement**:
- Horizontal: Direct position updates with boundary checking
- Vertical: Gravity-based physics with ground collision

**Jump Physics**:
```javascript
// Jump initiation
this.velocity = Math.sqrt(2 * 0.5 * 100); // ~8.37

// Each frame during jump
game.player.y -= game.player.velocity;    // Move up
game.player.velocity -= GRAVITY;          // Apply gravity

// Ground collision
if (game.player.y >= GROUND_Y - PLAYER_HEIGHT) {
    game.player.y = GROUND_Y - PLAYER_HEIGHT;
    game.player.jumping = false;
    game.player.velocity = 0;
}
```

**Obstacle Physics**:
- Linear movement with direction changes
- Boundary collision at screen edges
- Bouncing behavior (direction reversal)

#### **Scoring System** 🏆

**Survival Points**: +1 per second
```javascript
if (game._scoreTimer >= 1000) {
    game.scoreManager.addPoints(1);
    game._scoreTimer -= 1000;
}
```

**Bonus Points**: +10 for jumping over obstacles
```javascript
// Detect side-to-side crossing while above obstacle
if (playerSide && lastPlayerSide && playerSide !== lastPlayerSide && playerAbove) {
    game.scoreManager.addPoints(10);
    // Trigger bonus animation
}
```

#### **Bonus Animation System** ✨

Animated "+10" text that appears when earning bonus points:

```javascript
// Animation object structure
{
    text: '+10',
    x: 120,                    // Position near score
    y: 30,
    opacity: 1.0,              // Fades to 0
    scale: 1.0,                // Grows to 1.5
    startTime: timestamp       // For timing calculations
}

// Animation updates (1.5 second duration)
animation.opacity = 1 - progress;           // Fade out
animation.y = 30 - (progress * 30);        // Move up
animation.scale = 1 + (progress * 0.5);    // Grow
```

#### **Rendering Pipeline** 🎨

```javascript
function render() {
    // 1. Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 2. Draw ground (green rectangle)
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(0, GROUND_Y, canvas.width, canvas.height - GROUND_Y);
    
    // 3. Draw player (blue rectangle)
    ctx.fillStyle = '#2196F3';
    ctx.fillRect(game.player.x, game.player.y, PLAYER_WIDTH, PLAYER_HEIGHT);
    
    // 4. Draw obstacles (black rectangles)
    ctx.fillStyle = '#111';
    ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    
    // 5. Draw bonus animations (green text)
    ctx.fillStyle = `rgba(76, 175, 80, ${animation.opacity})`;
    ctx.fillText(animation.text, animation.x, animation.y);
    
    // 6. Draw game over message (if applicable)
}
```

#### **StateManager Integration** 🔗

**Observers** for reactive UI updates:
```javascript
// Game state observer
observe(game, () => {
    timeLeftDisplay.textContent = Math.ceil(game.timeLeft);
});

// Score observer
observe(game.scoreManager, () => {
    currentScoreDisplay.textContent = game.scoreManager.totalScore;
    highScoreDisplay.textContent = game.scoreManager.highScore;
    lastScoreDisplay.textContent = game.scoreManager.lastScore;
});
```

### `index.html` - User Interface

Clean, responsive HTML interface with inline CSS styling.

#### **Layout Structure**:
```html
├── Header ("Mini Game StateManager Demo")
├── Game Info Panel
│   ├── Score displays (current, high, last)
│   └── Time remaining
├── Game Canvas (800×400px)
├── Control Buttons (Start, Pause, Reset)
└── Instructions
```

#### **Styling Features**:
- **Responsive design**: Flexbox layout
- **Visual hierarchy**: Clear typography and spacing
- **Interactive elements**: Hover effects on buttons
- **Game feedback**: Color-coded score displays
- **Shadow effects**: Professional appearance

## 🎮 Game Flow

### 1. **Initialization**
```javascript
// Create game instances
const game = new Game();

// Set up canvas and DOM references
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Initialize obstacle
bouncingObstacle = new Obstacle(x, y, width, height, speed, direction);
```

### 2. **Game Start**
```javascript
startButton.addEventListener('click', () => {
    game.start();                           // Set running state
    game.player.setPosition(centerX, groundY); // Position player
    // Create obstacle and start game loop
});
```

### 3. **Game Loop Execution**
```
┌─────────────────┐
│   Input Check   │ ← Arrow keys, spacebar
├─────────────────┤
│ Physics Update  │ ← Gravity, movement, collision
├─────────────────┤
│ Obstacle Update │ ← Position, bouncing
├─────────────────┤
│ Collision Check │ ← Player vs obstacle
├─────────────────┤
│ Score Update    │ ← Time bonus, jump bonus
├─────────────────┤
│ Animation Update│ ← Bonus text effects
├─────────────────┤
│    Rendering    │ ← Draw all elements
└─────────────────┘
```

### 4. **Game End**
```javascript
// Time limit reached or collision detected
game.stop();
game.scoreManager._lastScore = game.scoreManager.totalScore;
game.scoreManager.reset();
// Display "Game Over" message
```

## 🔧 Key Features

### **StateManager Pattern Benefits**:
1. **Reactive UI**: Automatic updates when game state changes
2. **Clean separation**: Model logic separate from view logic
3. **Computed properties**: Derived values update automatically
4. **Observable actions**: Method calls trigger UI updates

### **Physics Realism**:
- **Gravity simulation**: Realistic jump arcs
- **Collision detection**: Accurate AABB (Axis-Aligned Bounding Box)
- **Boundary constraints**: Player can't leave screen

### **Visual Polish**:
- **Smooth animations**: 60fps rendering with requestAnimationFrame
- **Visual feedback**: Bonus point animations
- **Responsive controls**: Immediate input response
- **Professional UI**: Clean, modern interface design

### **Performance Optimizations**:
- **Efficient rendering**: Only updates when necessary
- **Memory management**: Animation cleanup
- **Delta time**: Frame-rate independent physics
- **LocalStorage**: Persistent high scores

## 🚀 Running the Game

1. **Local Development**:
   ```bash
   cd picosm/examples/minigame
   python3 -m http.server 8080
   # Open http://localhost:8080
   ```

2. **GitHub Pages Deployment**:
   - Enable GitHub Pages in repository settings
   - Access at: `https://username.github.io/repository/examples/minigame/`

## 🎯 Educational Value

This minigame demonstrates:

- **StateManager pattern implementation**
- **Game development fundamentals**
- **Canvas-based rendering**
- **Physics simulation**
- **Event-driven programming**
- **Modular code organization**
- **Reactive programming concepts**

Perfect for learning modern JavaScript patterns, game development basics, and state management architecture! 