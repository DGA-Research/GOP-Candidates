// Global variables to be updated via config
let canvasWidth = 800,
    canvasHeight = 600,
    playerSpeed = 300,
    enemySpeed = 100,
    playerRadius = 40,
    enemyRadius = 40,
    winScore = 30,
    winMessage = "You Win! Congratulations!";

let configData = null;
let player = null;
let enemies = [];
let score = 0;
let gameRunning = false;
let lastTime = 0;
let candidateElements = [];

// Get DOM elements
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score');
const gameOverDiv = document.getElementById('gameOver');
const gameOverMessage = document.getElementById('gameOverMessage');
const startScreen = document.getElementById('startScreen');

// Track movement input
const keysPressed = {};
window.addEventListener('keydown', (e) => {
  keysPressed[e.key] = true;
});
window.addEventListener('keyup', (e) => {
  keysPressed[e.key] = false;
});

// Mobile control listeners supporting both mouse and touch events
function setupMobileControls() {
  const upBtn = document.getElementById("upBtn");
  const downBtn = document.getElementById("downBtn");
  const leftBtn = document.getElementById("leftBtn");
  const rightBtn = document.getElementById("rightBtn");

  // Helper function to add both mouse and touch events
  function addControlEvents(button, keyName) {
    // Mouse events for PC
    button.addEventListener("mousedown", (e) => {
      e.preventDefault();
      keysPressed[keyName] = true;
    });
    button.addEventListener("mouseup", (e) => {
      e.preventDefault();
      keysPressed[keyName] = false;
    });
    button.addEventListener("mouseleave", (e) => {
      e.preventDefault();
      keysPressed[keyName] = false;
    });
    // Touch events for mobile
    button.addEventListener("touchstart", (e) => {
      e.preventDefault();
      keysPressed[keyName] = true;
    });
    button.addEventListener("touchend", (e) => {
      e.preventDefault();
      keysPressed[keyName] = false;
    });
  }

  addControlEvents(upBtn, "ArrowUp");
  addControlEvents(downBtn, "ArrowDown");
  addControlEvents(leftBtn, "ArrowLeft");
  addControlEvents(rightBtn, "ArrowRight");
}

// Candidate class for both player and enemies
class Candidate {
  constructor(x, y, imageSrc, name, isPlayer = false) {
    this.x = x;
    this.y = y;
    this.image = new Image();
    this.image.src = imageSrc;
    this.name = name;
    this.isPlayer = isPlayer;
    if (!isPlayer) {
      // Initialize with random velocity
      this.vx = (Math.random() * 2 - 1) * enemySpeed;
      this.vy = (Math.random() * 2 - 1) * enemySpeed;
    }
  }
  
  update(dt) {
    if (!this.isPlayer) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      
      // Bounce off canvas edges with position correction and slight random perturbation
      if (this.x < enemyRadius) {
        this.x = enemyRadius;
        this.vx = Math.abs(this.vx) + (Math.random() - 0.5) * 20;
      } else if (this.x > canvasWidth - enemyRadius) {
        this.x = canvasWidth - enemyRadius;
        this.vx = -Math.abs(this.vx) + (Math.random() - 0.5) * 20;
      }
      if (this.y < enemyRadius) {
        this.y = enemyRadius;
        this.vy = Math.abs(this.vy) + (Math.random() - 0.5) * 20;
      } else if (this.y > canvasHeight - enemyRadius) {
        this.y = canvasHeight - enemyRadius;
        this.vy = -Math.abs(this.vy) + (Math.random() - 0.5) * 20;
      }
    }
  }
  
  draw(ctx) {
    ctx.save();
    ctx.beginPath();
    const radius = this.isPlayer ? playerRadius : enemyRadius;
    ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(this.image, this.x - radius, this.y - radius, radius * 2, radius * 2);
    ctx.restore();
  }
}

// Load config.json and initialize the game once
document.addEventListener("DOMContentLoaded", () => {
  fetch('config.json')
    .then(response => response.json())
    .then(config => {
      configData = config;
      initializeFromConfig();
      setupMobileControls(); // Set up both mouse and touch event listeners
    })
    .catch(err => {
      console.error("Error loading config:", err);
    });
});

// Set up the game based on config.json
function initializeFromConfig() {
  // Update canvas dimensions and game parameters from config
  canvasWidth = configData.canvas.width;
  canvasHeight = configData.canvas.height;
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  playerSpeed = configData.playerSpeed;
  enemySpeed = configData.enemySpeed;
  playerRadius = configData.playerRadius;
  enemyRadius = configData.enemyRadius;
  winScore = configData.winScore;
  winMessage = configData.winMessage;
  
  // Dynamically create candidate selection images
  configData.candidates.forEach(candidateConfig => {
    const img = document.createElement('img');
    img.className = 'candidate';
    img.src = candidateConfig.src;
    img.alt = candidateConfig.name;
    img.setAttribute('data-name', candidateConfig.name);
    // Optionally, adjust the size of candidate images
    img.width = 80;
    img.height = 80;
    startScreen.appendChild(img);
  });
  
  // Query candidate elements after creation and attach event listeners
  candidateElements = document.querySelectorAll('.candidate');
  candidateElements.forEach(candidate => {
    candidate.addEventListener('click', () => {
      startScreen.style.display = 'none';
      const candidateImageSrc = candidate.src;
      const candidateName = candidate.getAttribute('data-name');
      // Create player in the center
      player = new Candidate(canvasWidth / 2, canvasHeight / 2, candidateImageSrc, candidateName, true);
      // Create enemy candidates from the remaining selections
      const minDistanceFromPlayer = 150; // minimum distance from center
      candidateElements.forEach(cand => {
        if (cand.src !== candidateImageSrc) {
          let ex, ey, distance;
          // Recalculate position until it's a safe distance from the center
          do {
            ex = Math.random() * (canvasWidth - enemyRadius * 2) + enemyRadius;
            ey = Math.random() * (canvasHeight - enemyRadius * 2) + enemyRadius;
            distance = Math.sqrt(Math.pow(ex - canvasWidth / 2, 2) + Math.pow(ey - canvasHeight / 2, 2));
          } while (distance < minDistanceFromPlayer);
          enemies.push(new Candidate(ex, ey, cand.src, cand.getAttribute('data-name')));
        }
      });
      // Start the game loop
      gameRunning = true;
      lastTime = performance.now();
      requestAnimationFrame(gameLoop);
    });
  });

  function updateCanvasSize() {
    const container = document.getElementById('gameContainer');
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    // Optionally update your global variables (canvasWidth, canvasHeight)
    canvasWidth = rect.width;
    canvasHeight = rect.height;
  }
  
  window.addEventListener("resize", updateCanvasSize);
  updateCanvasSize();
  

  // Responsive design: update canvas dimensions and scale candidate positions on window resize
  window.addEventListener("resize", () => {
    const container = document.getElementById('gameContainer');
    const rect = container.getBoundingClientRect();
    // Record old dimensions to compute scale factors
    const oldWidth = canvasWidth;
    const oldHeight = canvasHeight;
    
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    // Compute scale factors
    const scaleX = rect.width / oldWidth;
    const scaleY = rect.height / oldHeight;
    
    // Update global dimensions
    canvasWidth = rect.width;
    canvasHeight = rect.height;
    
    // Scale positions of player and enemies
    if (player) {
      player.x *= scaleX;
      player.y *= scaleY;
    }
    enemies.forEach(enemy => {
      enemy.x *= scaleX;
      enemy.y *= scaleY;
    });
  });
}

// Main game loop
function gameLoop(timestamp) {
  if (!gameRunning) return;
  const dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;
  
  score += dt;
  scoreDisplay.textContent = "Score: " + Math.floor(score);
  
  // Check for win condition
  if (score >= winScore) {
    winGame();
    return; // Stop the loop after win
  }
  
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  
  // Handle player movement with arrow keys or WASD
  let dx = 0, dy = 0;
  if (keysPressed['ArrowUp'] || keysPressed['w']) dy -= 1;
  if (keysPressed['ArrowDown'] || keysPressed['s']) dy += 1;
  if (keysPressed['ArrowLeft'] || keysPressed['a']) dx -= 1;
  if (keysPressed['ArrowRight'] || keysPressed['d']) dx += 1;
  
  if (dx !== 0 || dy !== 0) {
    const len = Math.sqrt(dx * dx + dy * dy);
    dx /= len;
    dy /= len;
    player.x += dx * playerSpeed * dt;
    player.y += dy * playerSpeed * dt;
    // Keep the player within bounds
    player.x = Math.max(playerRadius, Math.min(canvasWidth - playerRadius, player.x));
    player.y = Math.max(playerRadius, Math.min(canvasHeight - playerRadius, player.y));
  }
  
  // Update and draw enemies; check for collisions
  enemies.forEach(enemy => {
    enemy.update(dt);
    enemy.draw(ctx);
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < playerRadius + enemyRadius) {
      gameOver();
    }
  });
  
  // Draw the player
  player.draw(ctx);
  
  requestAnimationFrame(gameLoop);
}

// End the game and show game over overlay
function gameOver() {
  gameRunning = false;
  gameOverDiv.style.display = 'flex';
  gameOverMessage.textContent = player.name + ": Better luck next time!";
}

// Function to win the game
function winGame() {
  gameRunning = false;
  gameOverDiv.style.display = 'flex';
  gameOverMessage.textContent = player.name + ": " + winMessage;
  document.getElementById("gameOverText").textContent = "You Win!";
}
