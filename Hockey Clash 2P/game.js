const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// === CONSTANTS ===
const TARGET_FPS = 60;
const W = canvas.width;
const H = canvas.height;
const PADDLE_RADIUS = 35;
const PUCK_RADIUS = 20;
const PADDLE_SPEED = 7;
const PUCK_MAX_SPEED = 14;
const FRICTION = 0.985;
const GOAL_WIDTH = 180;
const WINNING_SCORE = 7;
const GAMEPAD_DEADZONE = 0.15;

// === GAME STATE ===
let lastTime = 0;
let gameState = 'start'; // 'start', 'playing', 'goal', 'gameover'
let goalTimer = 0;
const GOAL_PAUSE = 90; // frames at 60fps equivalent

let score = { p1: 0, p2: 0 };

// Paddles
let p1 = { x: W / 2, y: H - 80, vx: 0, vy: 0 };
let p2 = { x: W / 2, y: 80, vx: 0, vy: 0 };

// Puck
let puck = { x: W / 2, y: H / 2, vx: 0, vy: 0 };

// Input
const keys = {};

// === INPUT HANDLING ===
document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (gameState === 'start' || gameState === 'gameover') {
            startGame();
        }
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// === GAMEPAD SUPPORT ===
function getGamepadInput(index) {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = gamepads[index];
    if (!gp) return { x: 0, y: 0, start: false };
    
    let x = gp.axes[0] || 0;
    let y = gp.axes[1] || 0;
    
    if (Math.abs(x) < GAMEPAD_DEADZONE) x = 0;
    if (Math.abs(y) < GAMEPAD_DEADZONE) y = 0;
    
    const start = gp.buttons[9] && gp.buttons[9].pressed;
    const a = gp.buttons[0] && gp.buttons[0].pressed;
    
    return { x, y, start: start || a };
}

// === GAME FUNCTIONS ===
function startGame() {
    score = { p1: 0, p2: 0 };
    resetPositions();
    gameState = 'playing';
    lastTime = 0;
}

function resetPositions() {
    p1.x = W / 2;
    p1.y = H - 80;
    p1.vx = 0;
    p1.vy = 0;
    
    p2.x = W / 2;
    p2.y = 80;
    p2.vx = 0;
    p2.vy = 0;
    
    puck.x = W / 2;
    puck.y = H / 2;
    puck.vx = 0;
    puck.vy = 0;
}

function update(dt) {
    if (gameState === 'goal') {
        goalTimer -= dt;
        if (goalTimer <= 0) {
            if (score.p1 >= WINNING_SCORE || score.p2 >= WINNING_SCORE) {
                gameState = 'gameover';
            } else {
                resetPositions();
                gameState = 'playing';
            }
        }
        return;
    }
    
    if (gameState !== 'playing') return;
    
    // --- Player 1 Input (WASD + Gamepad 0) ---
    let p1dx = 0, p1dy = 0;
    if (keys['KeyA']) p1dx -= 1;
    if (keys['KeyD']) p1dx += 1;
    if (keys['KeyW']) p1dy -= 1;
    if (keys['KeyS']) p1dy += 1;
    
    const gp1 = getGamepadInput(0);
    p1dx += gp1.x;
    p1dy += gp1.y;
    
    // Normalize
    const p1len = Math.sqrt(p1dx * p1dx + p1dy * p1dy);
    if (p1len > 1) { p1dx /= p1len; p1dy /= p1len; }
    
    p1.vx = p1dx * PADDLE_SPEED;
    p1.vy = p1dy * PADDLE_SPEED;
    p1.x += p1.vx * dt;
    p1.y += p1.vy * dt;
    
    // --- Player 2 Input (Arrow Keys + Gamepad 1) ---
    let p2dx = 0, p2dy = 0;
    if (keys['ArrowLeft']) p2dx -= 1;
    if (keys['ArrowRight']) p2dx += 1;
    if (keys['ArrowUp']) p2dy -= 1;
    if (keys['ArrowDown']) p2dy += 1;
    
    const gp2 = getGamepadInput(1);
    p2dx += gp2.x;
    p2dy += gp2.y;
    
    const p2len = Math.sqrt(p2dx * p2dx + p2dy * p2dy);
    if (p2len > 1) { p2dx /= p2len; p2dy /= p2len; }
    
    p2.vx = p2dx * PADDLE_SPEED;
    p2.vy = p2dy * PADDLE_SPEED;
    p2.x += p2.vx * dt;
    p2.y += p2.vy * dt;
    
    // --- Constrain Paddles ---
    // P1 stays in bottom half
    p1.x = Math.max(PADDLE_RADIUS, Math.min(W - PADDLE_RADIUS, p1.x));
    p1.y = Math.max(H / 2 + PADDLE_RADIUS, Math.min(H - PADDLE_RADIUS, p1.y));
    
    // P2 stays in top half
    p2.x = Math.max(PADDLE_RADIUS, Math.min(W - PADDLE_RADIUS, p2.x));
    p2.y = Math.max(PADDLE_RADIUS, Math.min(H / 2 - PADDLE_RADIUS, p2.y));
    
    // --- Puck Physics ---
    puck.vx *= Math.pow(FRICTION, dt);
    puck.vy *= Math.pow(FRICTION, dt);
    
    puck.x += puck.vx * dt;
    puck.y += puck.vy * dt;
    
    // Wall collisions (left/right)
    if (puck.x - PUCK_RADIUS < 0) {
        puck.x = PUCK_RADIUS;
        puck.vx = Math.abs(puck.vx) * 0.9;
    }
    if (puck.x + PUCK_RADIUS > W) {
        puck.x = W - PUCK_RADIUS;
        puck.vx = -Math.abs(puck.vx) * 0.9;
    }
    
    // Top/Bottom walls (with goal openings)
    const goalLeft = (W - GOAL_WIDTH) / 2;
    const goalRight = (W + GOAL_WIDTH) / 2;
    
    // Top wall
    if (puck.y - PUCK_RADIUS < 0) {
        if (puck.x > goalLeft && puck.x < goalRight) {
            // GOAL for Player 1!
            score.p1++;
            gameState = 'goal';
            goalTimer = GOAL_PAUSE;
            return;
        } else {
            puck.y = PUCK_RADIUS;
            puck.vy = Math.abs(puck.vy) * 0.9;
        }
    }
    
    // Bottom wall
    if (puck.y + PUCK_RADIUS > H) {
        if (puck.x > goalLeft && puck.x < goalRight) {
            // GOAL for Player 2!
            score.p2++;
            gameState = 'goal';
            goalTimer = GOAL_PAUSE;
            return;
        } else {
            puck.y = H - PUCK_RADIUS;
            puck.vy = -Math.abs(puck.vy) * 0.9;
        }
    }
    
    // --- Paddle-Puck Collisions ---
    handlePaddleCollision(p1);
    handlePaddleCollision(p2);
    
    // Clamp puck speed
    const puckSpeed = Math.sqrt(puck.vx * puck.vx + puck.vy * puck.vy);
    if (puckSpeed > PUCK_MAX_SPEED) {
        puck.vx = (puck.vx / puckSpeed) * PUCK_MAX_SPEED;
        puck.vy = (puck.vy / puckSpeed) * PUCK_MAX_SPEED;
    }
}

function handlePaddleCollision(paddle) {
    const dx = puck.x - paddle.x;
    const dy = puck.y - paddle.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const minDist = PADDLE_RADIUS + PUCK_RADIUS;
    
    if (dist < minDist && dist > 0) {
        // Separate
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = minDist - dist;
        puck.x += nx * overlap;
        puck.y += ny * overlap;
        
        // Reflect puck velocity + add paddle velocity
        const relVx = puck.vx - paddle.vx;
        const relVy = puck.vy - paddle.vy;
        const dot = relVx * nx + relVy * ny;
        
        if (dot < 0) {
            puck.vx -= 2 * dot * nx;
            puck.vy -= 2 * dot * ny;
            
            // Add some paddle velocity for extra push
            puck.vx += paddle.vx * 0.5;
            puck.vy += paddle.vy * 0.5;
        }
    }
}

// === DRAWING ===
function draw() {
    // Background
    ctx.fillStyle = '#1a3a5c';
    ctx.fillRect(0, 0, W, H);
    
    if (gameState === 'start') {
        drawStartScreen();
        return;
    }
    
    if (gameState === 'gameover') {
        drawGameOverScreen();
        return;
    }
    
    drawField();
    drawPuck();
    drawPaddle(p1, '#ff4444');
    drawPaddle(p2, '#4488ff');
    drawScore();
    
    if (gameState === 'goal') {
        drawGoalMessage();
    }
}

function drawField() {
    // Center line
    ctx.setLineDash([10, 10]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, H / 2);
    ctx.lineTo(W, H / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Center circle
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 60, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Goals
    const goalLeft = (W - GOAL_WIDTH) / 2;
    const goalRight = (W + GOAL_WIDTH) / 2;
    
    // Top goal
    ctx.fillStyle = 'rgba(68, 136, 255, 0.3)';
    ctx.fillRect(goalLeft, 0, GOAL_WIDTH, 10);
    ctx.strokeStyle = '#4488ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(goalLeft, 0);
    ctx.lineTo(goalLeft, 15);
    ctx.moveTo(goalRight, 0);
    ctx.lineTo(goalRight, 15);
    ctx.stroke();
    
    // Bottom goal
    ctx.fillStyle = 'rgba(255, 68, 68, 0.3)';
    ctx.fillRect(goalLeft, H - 10, GOAL_WIDTH, 10);
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(goalLeft, H);
    ctx.lineTo(goalLeft, H - 15);
    ctx.moveTo(goalRight, H);
    ctx.lineTo(goalRight, H - 15);
    ctx.stroke();
    
    // Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, W - 4, H - 4);
}

function drawPuck() {
    ctx.beginPath();
    ctx.arc(puck.x, puck.y, PUCK_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Inner detail
    ctx.beginPath();
    ctx.arc(puck.x, puck.y, PUCK_RADIUS * 0.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
}

function drawPaddle(paddle, color) {
    // Outer glow
    ctx.beginPath();
    ctx.arc(paddle.x, paddle.y, PADDLE_RADIUS + 3, 0, Math.PI * 2);
    ctx.fillStyle = color + '44';
    ctx.fill();
    
    // Main circle
    ctx.beginPath();
    ctx.arc(paddle.x, paddle.y, PADDLE_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Inner circle
    ctx.beginPath();
    ctx.arc(paddle.x, paddle.y, PADDLE_RADIUS * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fill();
}

function drawScore() {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    
    // P2 score (top)
    ctx.fillText(score.p2, W - 50, H / 2 - 20);
    
    // P1 score (bottom)
    ctx.fillText(score.p1, W - 50, H / 2 + 55);
}

function drawGoalMessage() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, H / 2 - 50, W, 100);
    
    ctx.fillStyle = '#ffdd00';
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚡ TOR! ⚡', W / 2, H / 2 + 12);
}

function drawStartScreen() {
    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Air Hockey', W / 2, H / 2 - 100);
    
    // Subtitle
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '20px sans-serif';
    ctx.fillText('2 Spieler', W / 2, H / 2 - 60);
    
    // Controls
    ctx.fillStyle = '#ff4444';
    ctx.font = '18px sans-serif';
    ctx.fillText('Spieler 1 (unten): W A S D', W / 2, H / 2 + 10);
    
    ctx.fillStyle = '#4488ff';
    ctx.fillText('Spieler 2 (oben): Pfeiltasten', W / 2, H / 2 + 45);
    
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '16px sans-serif';
    ctx.fillText('Gamepad wird auch unterstützt!', W / 2, H / 2 + 80);
    
    // Start prompt
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('Leertaste / Enter zum Starten', W / 2, H / 2 + 140);
    
    // Decorative puck
    ctx.beginPath();
    ctx.arc(W / 2, H / 2 - 160, 25, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
}

function drawGameOverScreen() {
    drawField();
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, W, H);
    
    const winner = score.p1 >= WINNING_SCORE ? 1 : 2;
    const winColor = winner === 1 ? '#ff4444' : '#4488ff';
    
    ctx.fillStyle = winColor;
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Spieler ' + winner + ' gewinnt!', W / 2, H / 2 - 60);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '32px sans-serif';
    ctx.fillText(score.p1 + ' : ' + score.p2, W / 2, H / 2 + 10);
    
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '20px sans-serif';
    ctx.fillText('Leertaste / Enter für Neustart', W / 2, H / 2 + 70);
}

// === GAME LOOP ===
function gameLoop(timestamp) {
    if (lastTime === 0) lastTime = timestamp;
    const elapsed = timestamp - lastTime;
    lastTime = timestamp;
    const dt = Math.min(elapsed / (1000 / TARGET_FPS), 3);
    
    // Check gamepad start button
    const gp1 = getGamepadInput(0);
    const gp2 = getGamepadInput(1);
    if ((gp1.start || gp2.start) && (gameState === 'start' || gameState === 'gameover')) {
        startGame();
    }
    
    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
}

// Prevent arrow keys from scrolling
document.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
    }
});

// Start the loop
requestAnimationFrame(gameLoop);
