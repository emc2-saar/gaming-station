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

// === AI CONSTANTS ===
const AI_DIFFICULTY = {
    reactionDelay: 4,      // frames delay before AI reacts to puck direction change
    maxSpeed: 7,           // same as player max for fair challenge
    predictionError: 20,   // random offset in pixels for target prediction
    aggressiveness: 0.85,  // 0-1, how often AI pushes forward
    defendLine: 100,       // y-position AI tries to defend around
    attackLine: H / 2 - 30 // how far forward AI will push (close to center)
};

// === GAME STATE ===
let lastTime = 0;
let gameState = 'menu'; // 'menu', 'start', 'playing', 'goal', 'gameover'
let gameMode = '2p';    // '2p' or 'ai'
let goalTimer = 0;
const GOAL_PAUSE = 90;

let score = { p1: 0, p2: 0 };
let menuSelection = 0; // 0 = 2P, 1 = vs AI

// Paddles
let p1 = { x: W / 2, y: H - 80, vx: 0, vy: 0 };
let p2 = { x: W / 2, y: 80, vx: 0, vy: 0 };

// Puck
let puck = { x: W / 2, y: H / 2, vx: 0, vy: 0 };

// AI State
let ai = {
    targetX: W / 2,
    targetY: AI_DIFFICULTY.defendLine,
    reactionTimer: 0,
    lastPuckVx: 0,
    lastPuckVy: 0,
    errorX: 0,
    errorY: 0,
    thinkTimer: 0
};

// Input
const keys = {};

// === INPUT HANDLING ===
document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (gameState === 'menu') {
            gameMode = menuSelection === 0 ? '2p' : 'ai';
            gameState = 'start';
        } else if (gameState === 'start' || gameState === 'gameover') {
            startGame();
        }
    }
    if (gameState === 'menu') {
        if (e.code === 'ArrowUp' || e.code === 'KeyW') {
            menuSelection = 0;
        }
        if (e.code === 'ArrowDown' || e.code === 'KeyS') {
            menuSelection = 1;
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
    if (!gp) return { x: 0, y: 0, start: false, up: false, down: false };
    
    let x = gp.axes[0] || 0;
    let y = gp.axes[1] || 0;
    
    if (Math.abs(x) < GAMEPAD_DEADZONE) x = 0;
    if (Math.abs(y) < GAMEPAD_DEADZONE) y = 0;
    
    const start = gp.buttons[9] && gp.buttons[9].pressed;
    const a = gp.buttons[0] && gp.buttons[0].pressed;
    const up = y < -GAMEPAD_DEADZONE || (gp.buttons[12] && gp.buttons[12].pressed);
    const down = y > GAMEPAD_DEADZONE || (gp.buttons[13] && gp.buttons[13].pressed);
    
    return { x, y, start: start || a, up, down };
}

// === GAME FUNCTIONS ===
function startGame() {
    score = { p1: 0, p2: 0 };
    resetPositions();
    resetAI();
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

function resetAI() {
    ai.targetX = W / 2;
    ai.targetY = AI_DIFFICULTY.defendLine;
    ai.reactionTimer = 0;
    ai.lastPuckVx = 0;
    ai.lastPuckVy = 0;
    ai.errorX = (Math.random() - 0.5) * AI_DIFFICULTY.predictionError * 2;
    ai.errorY = (Math.random() - 0.5) * AI_DIFFICULTY.predictionError;
    ai.thinkTimer = 0;
}

// === AI LOGIC ===
function updateAI(dt) {
    ai.thinkTimer -= dt;
    
    // Recalculate target periodically or when puck changes direction significantly
    const puckDirChanged = (
        Math.sign(puck.vx) !== Math.sign(ai.lastPuckVx) ||
        Math.sign(puck.vy) !== Math.sign(ai.lastPuckVy)
    );
    
    if (ai.thinkTimer <= 0 || puckDirChanged) {
        ai.thinkTimer = AI_DIFFICULTY.reactionDelay;
        ai.lastPuckVx = puck.vx;
        ai.lastPuckVy = puck.vy;
        
        // Add new random error
        ai.errorX = (Math.random() - 0.5) * AI_DIFFICULTY.predictionError * 2;
        ai.errorY = (Math.random() - 0.5) * AI_DIFFICULTY.predictionError;
        
        const puckSpeed = Math.sqrt(puck.vx * puck.vx + puck.vy * puck.vy);
        
        // Decide target based on puck position and velocity
        if (puck.vy < -3 && puck.y < H / 2) {
            // Puck coming toward AI's goal fast - defend!
            const timeToGoal = (puck.y - AI_DIFFICULTY.defendLine) / (-puck.vy);
            let predictX = puck.x + puck.vx * timeToGoal;
            
            // Bounce prediction off walls
            let bounces = 0;
            while ((predictX < PUCK_RADIUS || predictX > W - PUCK_RADIUS) && bounces < 3) {
                if (predictX < PUCK_RADIUS) predictX = PUCK_RADIUS + (PUCK_RADIUS - predictX);
                if (predictX > W - PUCK_RADIUS) predictX = (W - PUCK_RADIUS) - (predictX - (W - PUCK_RADIUS));
                bounces++;
            }
            
            ai.targetX = predictX + ai.errorX * 0.5;
            ai.targetY = Math.max(PADDLE_RADIUS + 10, AI_DIFFICULTY.defendLine);
            
        } else if (puck.y < H / 2 && Math.random() < AI_DIFFICULTY.aggressiveness) {
            // Puck in AI's half - ATTACK! Move behind puck and push it toward player goal
            // Position above the puck so that hitting it sends it downward
            const offsetY = -(PADDLE_RADIUS + PUCK_RADIUS - 5);
            ai.targetX = puck.x + ai.errorX * 0.3;
            ai.targetY = puck.y + offsetY;
            
            // If puck is slow or stationary, move directly into it to push
            if (puckSpeed < 2) {
                ai.targetX = puck.x;
                ai.targetY = puck.y + offsetY + 15; // get closer to push
            }
            
        } else if (puck.y >= H / 2 && puck.y < H * 0.7) {
            // Puck near center in player's half - hover near center aggressively
            ai.targetX = puck.x + ai.errorX * 0.5;
            ai.targetY = AI_DIFFICULTY.attackLine;
            
        } else if (puck.y >= H * 0.7) {
            // Puck deep in player's half - hold defensive center position
            ai.targetX = W / 2 + ai.errorX * 0.3;
            ai.targetY = AI_DIFFICULTY.defendLine;
            
        } else {
            // Default: follow puck X, stay at defend line
            ai.targetX = puck.x + ai.errorX;
            ai.targetY = AI_DIFFICULTY.defendLine;
        }
    }
    
    // Clamp target within bounds
    ai.targetX = Math.max(PADDLE_RADIUS, Math.min(W - PADDLE_RADIUS, ai.targetX));
    ai.targetY = Math.max(PADDLE_RADIUS, Math.min(H / 2 - PADDLE_RADIUS, ai.targetY));
    
    // Move toward target - full speed, no slow-down near target for aggressive play
    const dx = ai.targetX - p2.x;
    const dy = ai.targetY - p2.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist > 1) {
        const moveSpeed = AI_DIFFICULTY.maxSpeed;
        const nx = dx / dist;
        const ny = dy / dist;
        
        // Full speed when attacking (puck in AI half), gentle when defending far away
        const speedFactor = (puck.y < H / 2) ? 1.0 : Math.min(dist / 30, 1);
        p2.vx = nx * moveSpeed * speedFactor;
        p2.vy = ny * moveSpeed * speedFactor;
    } else {
        p2.vx = 0;
        p2.vy = 0;
    }
    
    p2.x += p2.vx * dt;
    p2.y += p2.vy * dt;
    
    // Constrain to top half
    p2.x = Math.max(PADDLE_RADIUS, Math.min(W - PADDLE_RADIUS, p2.x));
    p2.y = Math.max(PADDLE_RADIUS, Math.min(H / 2 - PADDLE_RADIUS, p2.y));
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
    
    // --- Player 1 Input (WASD + Arrow Keys + Touch + Gamepad 0) ---
    let p1dx = 0, p1dy = 0;
    if (keys['KeyA'] || keys['ArrowLeft']) p1dx -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) p1dx += 1;
    if (keys['KeyW'] || keys['ArrowUp']) p1dy -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) p1dy += 1;
    
    const gp1 = getGamepadInput(0);
    p1dx += gp1.x;
    p1dy += gp1.y;
    
    // Touch input for P1
    const touchP1 = getTouchTarget(1);
    if (touchP1) {
        const tdx = touchP1.x - p1.x;
        const tdy = touchP1.y - p1.y;
        const tdist = Math.sqrt(tdx * tdx + tdy * tdy);
        if (tdist > 5) {
            p1dx += (tdx / tdist) * Math.min(tdist / 30, 1);
            p1dy += (tdy / tdist) * Math.min(tdist / 30, 1);
        }
    }
    
    // Normalize
    const p1len = Math.sqrt(p1dx * p1dx + p1dy * p1dy);
    if (p1len > 1) { p1dx /= p1len; p1dy /= p1len; }
    
    p1.vx = p1dx * PADDLE_SPEED;
    p1.vy = p1dy * PADDLE_SPEED;
    p1.x += p1.vx * dt;
    p1.y += p1.vy * dt;
    
    // --- Player 2 / AI ---
    if (gameMode === 'ai') {
        updateAI(dt);
    } else {
        // Player 2 Input (Arrow Keys + Touch + Gamepad 1)
        let p2dx = 0, p2dy = 0;
        if (keys['ArrowLeft']) p2dx -= 1;
        if (keys['ArrowRight']) p2dx += 1;
        if (keys['ArrowUp']) p2dy -= 1;
        if (keys['ArrowDown']) p2dy += 1;
        
        const gp2 = getGamepadInput(1);
        p2dx += gp2.x;
        p2dy += gp2.y;
        
        // Touch input for P2
        const touchP2 = getTouchTarget(2);
        if (touchP2) {
            const tdx = touchP2.x - p2.x;
            const tdy = touchP2.y - p2.y;
            const tdist = Math.sqrt(tdx * tdx + tdy * tdy);
            if (tdist > 5) {
                p2dx += (tdx / tdist) * Math.min(tdist / 30, 1);
                p2dy += (tdy / tdist) * Math.min(tdist / 30, 1);
            }
        }
        
        const p2len = Math.sqrt(p2dx * p2dx + p2dy * p2dy);
        if (p2len > 1) { p2dx /= p2len; p2dy /= p2len; }
        
        p2.vx = p2dx * PADDLE_SPEED;
        p2.vy = p2dy * PADDLE_SPEED;
        p2.x += p2.vx * dt;
        p2.y += p2.vy * dt;
        
        // Constrain P2 to top half
        p2.x = Math.max(PADDLE_RADIUS, Math.min(W - PADDLE_RADIUS, p2.x));
        p2.y = Math.max(PADDLE_RADIUS, Math.min(H / 2 - PADDLE_RADIUS, p2.y));
    }
    
    // --- Constrain P1 to bottom half ---
    p1.x = Math.max(PADDLE_RADIUS, Math.min(W - PADDLE_RADIUS, p1.x));
    p1.y = Math.max(H / 2 + PADDLE_RADIUS, Math.min(H - PADDLE_RADIUS, p1.y));
    
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
            // GOAL for Player 2 / AI!
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
function drawMakerBackground() {
    // Türkis background for maker aesthetic
    ctx.fillStyle = '#0a4f4f';
    ctx.fillRect(0, 0, W, H);
    
    // Grid lines (PCB traces look)
    ctx.strokeStyle = 'rgba(0, 255, 220, 0.07)';
    ctx.lineWidth = 1;
    const gridSize = 30;
    for (let x = 0; x < W; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
    }
    for (let y = 0; y < H; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
    }
    
    // Circuit node dots at intersections
    ctx.fillStyle = 'rgba(0, 255, 220, 0.1)';
    for (let x = 0; x < W; x += gridSize) {
        for (let y = 0; y < H; y += gridSize) {
            if (Math.random() > 0.7) {
                ctx.beginPath();
                ctx.arc(x, y, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
    
    // Random "traces" for maker feel
    ctx.strokeStyle = 'rgba(0, 255, 220, 0.04)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
        const sx = ((i * 73 + 17) % W);
        const sy = ((i * 137 + 43) % H);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + ((i % 2 === 0) ? 60 : 0), sy + ((i % 2 === 1) ? 60 : 0));
        ctx.stroke();
    }
}

function draw() {
    // Background depends on mode
    if (gameMode === 'ai' && gameState !== 'menu') {
        drawMakerBackground();
    } else {
        ctx.fillStyle = '#1a3a5c';
        ctx.fillRect(0, 0, W, H);
    }
    
    if (gameState === 'menu') {
        drawMenuScreen();
        return;
    }
    
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
    drawPaddle(p1, gameMode === 'ai' ? '#ff00ff' : '#ff4444');  // Neon Magenta im AI-Modus
    drawPaddle(p2, gameMode === 'ai' ? '#00ff88' : '#4488ff');  // Neon Grün im AI-Modus
    drawScore();
    
    if (gameState === 'goal') {
        drawGoalMessage();
    }
}

function drawField() {
    if (gameMode === 'ai') {
        // Green playing field for AI mode
        ctx.fillStyle = '#0d5e2f';
        ctx.fillRect(20, 20, W - 40, H - 40);
        
        // Subtle grass texture lines
        ctx.strokeStyle = 'rgba(0, 100, 40, 0.4)';
        ctx.lineWidth = 1;
        for (let y = 25; y < H - 20; y += 12) {
            ctx.beginPath();
            ctx.moveTo(20, y);
            ctx.lineTo(W - 20, y);
            ctx.stroke();
        }
        
        // Field border (bright green glow)
        ctx.strokeStyle = '#00ff66';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#00ff66';
        ctx.shadowBlur = 8;
        ctx.strokeRect(20, 20, W - 40, H - 40);
        ctx.shadowBlur = 0;
        
        // Center line
        ctx.setLineDash([8, 8]);
        ctx.strokeStyle = 'rgba(0, 255, 100, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(20, H / 2);
        ctx.lineTo(W - 20, H / 2);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Center circle
        ctx.beginPath();
        ctx.arc(W / 2, H / 2, 60, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 255, 100, 0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Center dot
        ctx.beginPath();
        ctx.arc(W / 2, H / 2, 5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 255, 100, 0.6)';
        ctx.fill();
        
    } else {
        // Original blue style for 2P mode
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
    }
    
    // Goals
    const goalLeft = (W - GOAL_WIDTH) / 2;
    const goalRight = (W + GOAL_WIDTH) / 2;
    
    // Top goal
    const topGoalColor = gameMode === 'ai' ? 'rgba(0, 255, 136, 0.4)' : 'rgba(68, 136, 255, 0.3)';
    const topGoalStroke = gameMode === 'ai' ? '#00ff88' : '#4488ff';
    ctx.fillStyle = topGoalColor;
    ctx.fillRect(goalLeft, 0, GOAL_WIDTH, 10);
    ctx.strokeStyle = topGoalStroke;
    ctx.lineWidth = 3;
    if (gameMode === 'ai') {
        ctx.shadowColor = topGoalStroke;
        ctx.shadowBlur = 6;
    }
    ctx.beginPath();
    ctx.moveTo(goalLeft, 0);
    ctx.lineTo(goalLeft, 15);
    ctx.moveTo(goalRight, 0);
    ctx.lineTo(goalRight, 15);
    ctx.stroke();
    ctx.shadowBlur = 0;
    
    // Bottom goal
    ctx.fillStyle = gameMode === 'ai' ? 'rgba(255, 0, 255, 0.4)' : 'rgba(255, 68, 68, 0.3)';
    ctx.fillRect(goalLeft, H - 10, GOAL_WIDTH, 10);
    ctx.strokeStyle = gameMode === 'ai' ? '#ff00ff' : '#ff4444';
    ctx.lineWidth = 3;
    if (gameMode === 'ai') {
        ctx.shadowColor = '#ff4444';
        ctx.shadowBlur = 6;
    }
    ctx.beginPath();
    ctx.moveTo(goalLeft, H);
    ctx.lineTo(goalLeft, H - 15);
    ctx.moveTo(goalRight, H);
    ctx.lineTo(goalRight, H - 15);
    ctx.stroke();
    ctx.shadowBlur = 0;
    
    // Border (only in 2P mode, AI mode has its own)
    if (gameMode !== 'ai') {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, W - 4, H - 4);
    }
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
    // Outer glow (stronger in AI mode)
    if (gameMode === 'ai') {
        ctx.shadowColor = color;
        ctx.shadowBlur = 15;
    }
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
    ctx.shadowBlur = 0;
    
    // Inner circle
    ctx.beginPath();
    ctx.arc(paddle.x, paddle.y, PADDLE_RADIUS * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fill();
    
    // AI indicator
    if (gameMode === 'ai' && paddle === p2) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('KI', paddle.x, paddle.y);
        ctx.textBaseline = 'alphabetic';
    }
}

function drawScore() {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    
    // P2/AI score (top)
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

function drawMenuScreen() {
    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Hockey Clash', W / 2, 160);
    
    // Decorative puck
    ctx.beginPath();
    ctx.arc(W / 2, 220, 25, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    
    // Mode selection
    ctx.font = '20px sans-serif';
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText('Modus wählen:', W / 2, 310);
    
    // Option 1: 2 Spieler
    const opt1Y = 370;
    const opt2Y = 440;
    
    // Highlight box for selected option
    if (menuSelection === 0) {
        ctx.fillStyle = 'rgba(255, 68, 68, 0.15)';
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 2;
        roundRect(ctx, W / 2 - 150, opt1Y - 30, 300, 50, 10);
        ctx.fill();
        ctx.stroke();
    }
    if (menuSelection === 1) {
        ctx.fillStyle = 'rgba(68, 221, 170, 0.15)';
        ctx.strokeStyle = '#44ddaa';
        ctx.lineWidth = 2;
        roundRect(ctx, W / 2 - 150, opt2Y - 30, 300, 50, 10);
        ctx.fill();
        ctx.stroke();
    }
    
    // Option texts
    ctx.font = 'bold 26px sans-serif';
    ctx.fillStyle = menuSelection === 0 ? '#ff4444' : '#888888';
    ctx.fillText('👥  2 Spieler', W / 2, opt1Y);
    
    ctx.fillStyle = menuSelection === 1 ? '#44ddaa' : '#888888';
    ctx.fillText('🤖  Gegen KI', W / 2, opt2Y);
    
    // Controls hint
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#666666';
    ctx.fillText('↑↓ / W S zum Wählen', W / 2, 530);
    ctx.fillText('Leertaste / Enter zum Bestätigen', W / 2, 560);
    ctx.fillText('Gamepad & Touch werden unterstützt!', W / 2, 590);
    
    // Animated indicator
    const pulse = Math.sin(Date.now() / 300) * 0.3 + 0.7;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ffffff';
    ctx.font = '18px sans-serif';
    ctx.fillText('▶', W / 2 - 170, menuSelection === 0 ? opt1Y : opt2Y);
    ctx.globalAlpha = 1;
}

function drawStartScreen() {
    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Hockey Clash', W / 2, H / 2 - 120);
    
    // Mode indicator
    if (gameMode === 'ai') {
        ctx.fillStyle = '#44ddaa';
        ctx.font = '22px sans-serif';
        ctx.fillText('🤖 Gegen KI', W / 2, H / 2 - 75);
        
        // Controls
        ctx.fillStyle = '#ff4444';
        ctx.font = '18px sans-serif';
        ctx.fillText('Du (unten): W A S D / Pfeiltasten', W / 2, H / 2 - 10);
    } else {
        ctx.fillStyle = '#aaaaaa';
        ctx.font = '22px sans-serif';
        ctx.fillText('👥 2 Spieler', W / 2, H / 2 - 75);
        
        // Controls
        ctx.fillStyle = '#ff4444';
        ctx.font = '18px sans-serif';
        ctx.fillText('Spieler 1 (unten): W A S D', W / 2, H / 2 - 10);
        
        ctx.fillStyle = '#4488ff';
        ctx.fillText('Spieler 2 (oben): Pfeiltasten', W / 2, H / 2 + 25);
    }
    
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '16px sans-serif';
    ctx.fillText('Gamepad & Touch werden unterstützt!', W / 2, H / 2 + 65);
    
    // Start prompt
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('Leertaste / Enter zum Starten', W / 2, H / 2 + 130);
    
    // Decorative puck
    ctx.beginPath();
    ctx.arc(W / 2, H / 2 - 180, 25, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
}

function drawGameOverScreen() {
    drawField();
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, W, H);
    
    const p1Wins = score.p1 >= WINNING_SCORE;
    
    if (gameMode === 'ai') {
        if (p1Wins) {
            ctx.fillStyle = '#ff4444';
            ctx.font = 'bold 44px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Du gewinnst! 🎉', W / 2, H / 2 - 60);
        } else {
            ctx.fillStyle = '#44ddaa';
            ctx.font = 'bold 44px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('KI gewinnt! 🤖', W / 2, H / 2 - 60);
        }
    } else {
        const winner = p1Wins ? 1 : 2;
        const winColor = winner === 1 ? '#ff4444' : '#4488ff';
        ctx.fillStyle = winColor;
        ctx.font = 'bold 44px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Spieler ' + winner + ' gewinnt!', W / 2, H / 2 - 60);
    }
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(score.p1 + ' : ' + score.p2, W / 2, H / 2 + 10);
    
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '20px sans-serif';
    ctx.fillText('Leertaste / Enter für Neustart', W / 2, H / 2 + 70);
    
    ctx.fillStyle = '#666666';
    ctx.font = '16px sans-serif';
    ctx.fillText('(Zurück zum Menü: nochmal drücken)', W / 2, H / 2 + 100);
}

// Helper: rounded rectangle
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

// === GAME LOOP ===
let gameOverConfirm = false;

function gameLoop(timestamp) {
    if (lastTime === 0) lastTime = timestamp;
    const elapsed = timestamp - lastTime;
    lastTime = timestamp;
    const dt = Math.min(elapsed / (1000 / TARGET_FPS), 3);
    
    // Check gamepad input for menu/start
    const gp1 = getGamepadInput(0);
    const gp2 = getGamepadInput(1);
    
    if (gameState === 'menu') {
        if (gp1.up || gp2.up) menuSelection = 0;
        if (gp1.down || gp2.down) menuSelection = 1;
        if (gp1.start || gp2.start) {
            gameMode = menuSelection === 0 ? '2p' : 'ai';
            gameState = 'start';
        }
    } else if (gameState === 'start') {
        if (gp1.start || gp2.start) {
            startGame();
        }
    } else if (gameState === 'gameover') {
        if (gp1.start || gp2.start) {
            if (gameOverConfirm) {
                gameState = 'menu';
                gameOverConfirm = false;
            } else {
                startGame();
                gameOverConfirm = true;
            }
        }
    }
    
    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
}

// Handle back-to-menu from gameover via keyboard
document.addEventListener('keydown', (e) => {
    if (gameState === 'gameover' && (e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault();
        if (gameOverConfirm) {
            gameState = 'menu';
            gameOverConfirm = false;
        } else {
            startGame();
            gameOverConfirm = true;
        }
    }
});

// Prevent arrow keys from scrolling
document.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
    }
});

// === TOUCH SUPPORT ===
let touches = {}; // track active touches: { id: { playerId, x, y } }

function getTouchPos(touch) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY
    };
}

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    
    if (gameState === 'menu') {
        // Tap top half = option 0, bottom half = option 1, then confirm
        const pos = getTouchPos(e.changedTouches[0]);
        if (pos.y < H / 2) {
            menuSelection = 0;
        } else {
            menuSelection = 1;
        }
        gameMode = menuSelection === 0 ? '2p' : 'ai';
        gameState = 'start';
        return;
    }
    
    if (gameState === 'start' || gameState === 'gameover') {
        if (gameState === 'gameover') {
            if (gameOverConfirm) {
                gameState = 'menu';
                gameOverConfirm = false;
            } else {
                startGame();
                gameOverConfirm = true;
            }
        } else {
            startGame();
        }
        return;
    }
    
    // During gameplay: assign touches to players
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const pos = getTouchPos(touch);
        
        if (gameMode === 'ai') {
            // AI mode: all touches control player 1
            touches[touch.identifier] = { playerId: 1, x: pos.x, y: pos.y };
        } else {
            // 2P mode: bottom half = P1, top half = P2
            if (pos.y >= H / 2) {
                touches[touch.identifier] = { playerId: 1, x: pos.x, y: pos.y };
            } else {
                touches[touch.identifier] = { playerId: 2, x: pos.x, y: pos.y };
            }
        }
    }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const pos = getTouchPos(touch);
        
        if (touches[touch.identifier]) {
            touches[touch.identifier].x = pos.x;
            touches[touch.identifier].y = pos.y;
        }
    }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
        delete touches[e.changedTouches[i].identifier];
    }
});

canvas.addEventListener('touchcancel', (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
        delete touches[e.changedTouches[i].identifier];
    }
});

// Touch input is read in the update function
function getTouchTarget(playerId) {
    for (const id in touches) {
        if (touches[id].playerId === playerId) {
            return { x: touches[id].x, y: touches[id].y };
        }
    }
    return null;
}

// Start the loop
requestAnimationFrame(gameLoop);
