const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const TARGET_FPS = 60;
let lastTime = 0;

// Game constants
const BALL_RADIUS = 18;
const MAGNET_RANGE = 80; // Distance at which balls attract
const ATTRACT_SPEED = 3; // Speed of attraction per frame (base)
const CLUSTER_DISTANCE = BALL_RADIUS * 2 + 4; // Distance to count as clustered
const GRID_PADDING = 60;
const MAX_ROUNDS = 15; // Each player places 15 balls = 30 total

// Game state
let gameState = 'start'; // 'start', 'playing', 'animating', 'removing', 'gameover'
let currentPlayer = 1; // 1 or 2
let scores = { 1: 0, 2: 0 };
let balls = []; // { x, y, player, vx, vy }
let roundsPlayed = 0;
let cursorX = canvas.width / 2;
let cursorY = canvas.height / 2;
let clusterBalls = []; // balls that are being removed
let removeTimer = 0;
let clusterPlayer = 0; // who caused the cluster
let message = '';
let messageTimer = 0;

// Gamepad state
let gamepadCursorSpeed = 5;
let gamepadButtonPressed = false;

// Keyboard state
let keys = {};

function resetGame() {
    gameState = 'playing';
    currentPlayer = 1;
    scores = { 1: 0, 2: 0 };
    balls = [];
    roundsPlayed = 0;
    cursorX = canvas.width / 2;
    cursorY = canvas.height / 2;
    clusterBalls = [];
    removeTimer = 0;
    message = '';
    messageTimer = 0;
    lastTime = 0;
}

function placeBall(x, y) {
    if (gameState !== 'playing') return;
    
    // Check if position is valid (not overlapping existing balls)
    for (let ball of balls) {
        const dx = ball.x - x;
        const dy = ball.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < BALL_RADIUS * 2 + 2) return; // Too close to existing ball
    }
    
    // Check bounds
    if (x < GRID_PADDING || x > canvas.width - GRID_PADDING ||
        y < GRID_PADDING + 40 || y > canvas.height - GRID_PADDING) return;
    
    balls.push({ x, y, player: currentPlayer, vx: 0, vy: 0 });
    roundsPlayed++;
    
    // Start animation phase
    gameState = 'animating';
}

function update(dt) {
    // Update message timer
    if (messageTimer > 0) {
        messageTimer -= dt;
        if (messageTimer <= 0) {
            message = '';
        }
    }
    
    if (gameState === 'animating') {
        // Simulate magnetic attraction
        let anyMoving = false;
        
        for (let i = 0; i < balls.length; i++) {
            balls[i].vx = 0;
            balls[i].vy = 0;
            
            for (let j = 0; j < balls.length; j++) {
                if (i === j) continue;
                
                const dx = balls[j].x - balls[i].x;
                const dy = balls[j].y - balls[i].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < MAGNET_RANGE && dist > CLUSTER_DISTANCE) {
                    // Attract towards each other
                    const force = ATTRACT_SPEED * (1 - dist / MAGNET_RANGE);
                    balls[i].vx += (dx / dist) * force;
                    balls[i].vy += (dy / dist) * force;
                    anyMoving = true;
                }
            }
        }
        
        // Apply velocities
        for (let ball of balls) {
            ball.x += ball.vx * dt;
            ball.y += ball.vy * dt;
            
            // Keep in bounds
            ball.x = Math.max(GRID_PADDING, Math.min(canvas.width - GRID_PADDING, ball.x));
            ball.y = Math.max(GRID_PADDING + 40, Math.min(canvas.height - GRID_PADDING, ball.y));
        }
        
        // Check for clusters (balls that are touching)
        if (!anyMoving || checkSettled()) {
            let clusters = findClusters();
            if (clusters.length > 0) {
                // Found clusters! Remove them and give penalty
                clusterBalls = clusters;
                clusterPlayer = currentPlayer;
                let penalty = clusterBalls.length;
                scores[currentPlayer] -= penalty;
                gameState = 'removing';
                removeTimer = 90; // frames to show removal
                message = `Spieler ${currentPlayer}: -${penalty} Punkte!`;
                messageTimer = 120;
            } else {
                // No cluster, next player's turn
                nextTurn();
            }
        }
    }
    
    if (gameState === 'removing') {
        removeTimer -= dt;
        if (removeTimer <= 0) {
            // Remove clustered balls
            balls = balls.filter(b => !clusterBalls.includes(b));
            clusterBalls = [];
            nextTurn();
        }
    }
    
    // Gamepad input
    handleGamepad(dt);
}

function checkSettled() {
    // Check if all balls have essentially stopped moving
    for (let ball of balls) {
        if (Math.abs(ball.vx) > 0.01 || Math.abs(ball.vy) > 0.01) return false;
    }
    return true;
}

function findClusters() {
    // Find groups of 2+ balls that are touching
    let clustered = new Set();
    
    for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
            const dx = balls[j].x - balls[i].x;
            const dy = balls[j].y - balls[i].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist <= CLUSTER_DISTANCE) {
                clustered.add(balls[i]);
                clustered.add(balls[j]);
            }
        }
    }
    
    // Expand clusters: if a ball touches any clustered ball, it's also clustered
    let changed = true;
    while (changed) {
        changed = false;
        for (let i = 0; i < balls.length; i++) {
            if (clustered.has(balls[i])) continue;
            for (let clusteredBall of clustered) {
                const dx = clusteredBall.x - balls[i].x;
                const dy = clusteredBall.y - balls[i].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist <= CLUSTER_DISTANCE) {
                    clustered.add(balls[i]);
                    changed = true;
                    break;
                }
            }
        }
    }
    
    return Array.from(clustered);
}

function nextTurn() {
    if (roundsPlayed >= MAX_ROUNDS * 2) {
        gameState = 'gameover';
        return;
    }
    currentPlayer = currentPlayer === 1 ? 2 : 1;
    gameState = 'playing';
}

function handleGamepad(dt) {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    
    for (let gp of gamepads) {
        if (!gp) continue;
        
        // Left stick for cursor movement
        const deadzone = 0.15;
        let axisX = gp.axes[0] || 0;
        let axisY = gp.axes[1] || 0;
        
        if (Math.abs(axisX) > deadzone) {
            cursorX += axisX * gamepadCursorSpeed * dt;
        }
        if (Math.abs(axisY) > deadzone) {
            cursorY += axisY * gamepadCursorSpeed * dt;
        }
        
        // Clamp cursor
        cursorX = Math.max(GRID_PADDING, Math.min(canvas.width - GRID_PADDING, cursorX));
        cursorY = Math.max(GRID_PADDING + 40, Math.min(canvas.height - GRID_PADDING, cursorY));
        
        // A button (index 0) to place ball
        if (gp.buttons[0] && gp.buttons[0].pressed) {
            if (!gamepadButtonPressed) {
                gamepadButtonPressed = true;
                if (gameState === 'start') {
                    resetGame();
                } else if (gameState === 'gameover') {
                    resetGame();
                } else if (gameState === 'playing') {
                    placeBall(cursorX, cursorY);
                }
            }
        } else {
            gamepadButtonPressed = false;
        }
        
        // Start button to restart
        if (gp.buttons[9] && gp.buttons[9].pressed) {
            if (gameState === 'gameover') {
                resetGame();
            }
        }
        
        break; // Use first connected gamepad
    }
}

function draw() {
    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (gameState === 'start') {
        drawStartScreen();
        return;
    }
    
    if (gameState === 'gameover') {
        drawGameOverScreen();
        return;
    }
    
    // Draw playing field
    ctx.strokeStyle = '#333355';
    ctx.lineWidth = 2;
    ctx.strokeRect(GRID_PADDING, GRID_PADDING + 40, 
                   canvas.width - GRID_PADDING * 2, 
                   canvas.height - GRID_PADDING * 2 - 40);
    
    // Draw HUD
    drawHUD();
    
    // Draw magnet range indicators for existing balls (subtle)
    ctx.globalAlpha = 0.08;
    for (let ball of balls) {
        if (clusterBalls.includes(ball)) continue;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, MAGNET_RANGE, 0, Math.PI * 2);
        ctx.fillStyle = ball.player === 1 ? '#ff6b6b' : '#4ecdc4';
        ctx.fill();
    }
    ctx.globalAlpha = 1;
    
    // Draw balls
    for (let ball of balls) {
        const isCluster = clusterBalls.includes(ball);
        
        if (isCluster) {
            // Flashing effect for balls being removed
            const flash = Math.sin(removeTimer * 0.3) > 0;
            if (!flash) continue;
        }
        
        drawBall(ball.x, ball.y, ball.player, isCluster);
    }
    
    // Draw cursor (only during playing state)
    if (gameState === 'playing') {
        drawCursor();
    }
    
    // Draw message
    if (message && messageTimer > 0) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(canvas.width / 2 - 150, canvas.height / 2 - 30, 300, 60);
        ctx.fillStyle = '#ff4444';
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(message, canvas.width / 2, canvas.height / 2 + 8);
    }
}

function drawBall(x, y, player, isCluster) {
    // Tischtennisball look
    const baseColor = player === 1 ? '#ff6b6b' : '#4ecdc4';
    const lightColor = player === 1 ? '#ffaaaa' : '#a0efe8';
    const darkColor = player === 1 ? '#cc3333' : '#2a9d8f';
    
    // Shadow
    ctx.beginPath();
    ctx.arc(x + 2, y + 3, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();
    
    // Main ball
    const gradient = ctx.createRadialGradient(x - 5, y - 5, 2, x, y, BALL_RADIUS);
    gradient.addColorStop(0, lightColor);
    gradient.addColorStop(0.7, baseColor);
    gradient.addColorStop(1, darkColor);
    
    ctx.beginPath();
    ctx.arc(x, y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Highlight
    ctx.beginPath();
    ctx.arc(x - 6, y - 6, 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fill();
    
    // Seam line (tischtennisball characteristic)
    ctx.beginPath();
    ctx.arc(x, y, BALL_RADIUS * 0.7, -0.3, Math.PI + 0.3);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    if (isCluster) {
        // Red glow for cluster
        ctx.beginPath();
        ctx.arc(x, y, BALL_RADIUS + 4, 0, Math.PI * 2);
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 3;
        ctx.stroke();
    }
}

function drawCursor() {
    const color = currentPlayer === 1 ? '#ff6b6b' : '#4ecdc4';
    
    // Ghost ball
    ctx.globalAlpha = 0.4;
    drawBall(cursorX, cursorY, currentPlayer, false);
    ctx.globalAlpha = 1;
    
    // Crosshair
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cursorX - 12, cursorY);
    ctx.lineTo(cursorX - 5, cursorY);
    ctx.moveTo(cursorX + 5, cursorY);
    ctx.lineTo(cursorX + 12, cursorY);
    ctx.moveTo(cursorX, cursorY - 12);
    ctx.lineTo(cursorX, cursorY - 5);
    ctx.moveTo(cursorX, cursorY + 5);
    ctx.lineTo(cursorX, cursorY + 12);
    ctx.stroke();
}

function drawHUD() {
    // Player 1 score (left)
    ctx.fillStyle = currentPlayer === 1 ? '#ff6b6b' : '#666';
    ctx.font = currentPlayer === 1 ? 'bold 18px sans-serif' : '16px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Spieler 1: ${scores[1]}`, 20, 28);
    
    // Player indicator
    if (gameState === 'playing') {
        ctx.fillStyle = currentPlayer === 1 ? '#ff6b6b' : '#4ecdc4';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`← Spieler ${currentPlayer} ist dran →`, canvas.width / 2, 28);
    } else if (gameState === 'animating') {
        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Magnete ziehen sich an...', canvas.width / 2, 28);
    } else if (gameState === 'removing') {
        ctx.fillStyle = '#ff4444';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('CLUSTER! Bälle werden entfernt!', canvas.width / 2, 28);
    }
    
    // Player 2 score (right)
    ctx.fillStyle = currentPlayer === 2 ? '#4ecdc4' : '#666';
    ctx.font = currentPlayer === 2 ? 'bold 18px sans-serif' : '16px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`Spieler 2: ${scores[2]}`, canvas.width - 20, 28);
    
    // Round counter
    ctx.fillStyle = '#888';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Runde ${Math.floor(roundsPlayed / 2) + 1} / ${MAX_ROUNDS}`, canvas.width / 2, canvas.height - 15);
}

function drawStartScreen() {
    // Title
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Cluster', canvas.width / 2, 180);
    
    // Subtitle
    ctx.fillStyle = '#aaa';
    ctx.font = '18px sans-serif';
    ctx.fillText('Das Magnet-Strategiespiel', canvas.width / 2, 220);
    
    // Draw example balls
    drawBall(canvas.width / 2 - 60, 300, 1, false);
    drawBall(canvas.width / 2, 300, 2, false);
    drawBall(canvas.width / 2 + 60, 300, 1, false);
    
    // Rules
    ctx.fillStyle = '#ccc';
    ctx.font = '15px sans-serif';
    const rules = [
        '2 Spieler platzieren abwechselnd Tischtennisbälle',
        'Bälle wirken wie Magnete – zu nahe = Anziehung!',
        'Wer einen Cluster auslöst, bekommt Minuspunkte',
        'Weniger Minuspunkte = Gewinner!',
    ];
    rules.forEach((rule, i) => {
        ctx.fillText(rule, canvas.width / 2, 380 + i * 28);
    });
    
    // Controls
    ctx.fillStyle = '#888';
    ctx.font = '14px sans-serif';
    ctx.fillText('Steuerung: Pfeiltasten/WASD + Leertaste/Enter', canvas.width / 2, 520);
    ctx.fillText('Gamepad: Stick + A-Taste', canvas.width / 2, 545);
    
    // Start prompt
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('Leertaste / Enter zum Starten', canvas.width / 2, 620);
}

function drawGameOverScreen() {
    // Draw remaining balls in background
    for (let ball of balls) {
        drawBall(ball.x, ball.y, ball.player, false);
    }
    
    // Overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Title
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Spiel beendet!', canvas.width / 2, 200);
    
    // Scores
    ctx.fillStyle = '#ff6b6b';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(`Spieler 1: ${scores[1]} Punkte`, canvas.width / 2, 280);
    
    ctx.fillStyle = '#4ecdc4';
    ctx.fillText(`Spieler 2: ${scores[2]} Punkte`, canvas.width / 2, 320);
    
    // Winner
    ctx.font = 'bold 28px sans-serif';
    if (scores[1] > scores[2]) {
        ctx.fillStyle = '#ff6b6b';
        ctx.fillText('🏆 Spieler 1 gewinnt!', canvas.width / 2, 400);
    } else if (scores[2] > scores[1]) {
        ctx.fillStyle = '#4ecdc4';
        ctx.fillText('🏆 Spieler 2 gewinnt!', canvas.width / 2, 400);
    } else {
        ctx.fillStyle = '#ffcc00';
        ctx.fillText('Unentschieden!', canvas.width / 2, 400);
    }
    
    // Note about scoring
    ctx.fillStyle = '#aaa';
    ctx.font = '16px sans-serif';
    ctx.fillText('(Weniger Minuspunkte = besser!)', canvas.width / 2, 440);
    
    // Restart
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('Leertaste / Enter für Neustart', canvas.width / 2, 540);
}

// Input handling
document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    
    if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (gameState === 'start' || gameState === 'gameover') {
            resetGame();
        } else if (gameState === 'playing') {
            placeBall(cursorX, cursorY);
        }
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// Mouse/touch input
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    if (gameState === 'start' || gameState === 'gameover') {
        resetGame();
    } else if (gameState === 'playing') {
        cursorX = x;
        cursorY = y;
        placeBall(x, y);
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (gameState !== 'playing') return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    cursorX = (e.clientX - rect.left) * scaleX;
    cursorY = (e.clientY - rect.top) * scaleY;
});

// Touch support
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (touch.clientX - rect.left) * scaleX;
    const y = (touch.clientY - rect.top) * scaleY;
    
    if (gameState === 'start' || gameState === 'gameover') {
        resetGame();
    } else if (gameState === 'playing') {
        cursorX = x;
        cursorY = y;
        placeBall(x, y);
    }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
}, { passive: false });

// Game loop
function gameLoop(timestamp) {
    if (lastTime === 0) lastTime = timestamp;
    const elapsed = timestamp - lastTime;
    lastTime = timestamp;
    const dt = Math.min(elapsed / (1000 / TARGET_FPS), 3);
    
    // Handle keyboard cursor movement
    if (gameState === 'playing') {
        const moveSpeed = 4;
        if (keys['ArrowLeft'] || keys['KeyA']) cursorX -= moveSpeed * dt;
        if (keys['ArrowRight'] || keys['KeyD']) cursorX += moveSpeed * dt;
        if (keys['ArrowUp'] || keys['KeyW']) cursorY -= moveSpeed * dt;
        if (keys['ArrowDown'] || keys['KeyS']) cursorY += moveSpeed * dt;
        
        // Clamp cursor
        cursorX = Math.max(GRID_PADDING, Math.min(canvas.width - GRID_PADDING, cursorX));
        cursorY = Math.max(GRID_PADDING + 40, Math.min(canvas.height - GRID_PADDING, cursorY));
    }
    
    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
}

// Start
requestAnimationFrame(gameLoop);
