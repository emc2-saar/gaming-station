const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const TARGET_FPS = 60;
let lastTime = 0;

// Game states: 'start', 'aiming', 'shooting', 'result', 'gameover'
let gameState = 'start';
let score = 0;
let shotsLeft = 10;
let totalShots = 10;
let round = 1;
let lastShotResult = '';
let resultTimer = 0;

// Shot timer
let shotTimer = 0;
let shotTimeLimit = 180; // ~3 seconds at 60fps (in dt-frames)
const INITIAL_TIME_LIMIT = 180;
const MIN_TIME_LIMIT = 90; // minimum ~1.5 seconds

// Crosshair
let crosshair = { x: canvas.width / 2, y: canvas.height / 2 };
const CROSSHAIR_SPEED = 5;

// Ball animation
let ball = { x: 0, y: 0, targetX: 0, targetY: 0, progress: 0, size: 20 };
const BALL_SPEED = 0.04;

// Torwand (goal wall) configuration
const wall = {
    x: 80,
    y: 60,
    width: 480,
    height: 320,
    holes: []
};

// Difficulty scaling
let holeSize = 70;
let wallMovement = 0;
let wallOffset = 0;
let wallDirection = 1;

// Gamepad
const DEADZONE = 0.15;

// Input state
const keys = {};

function generateHoles() {
    wall.holes = [];
    // Standard 4-hole layout with some variation based on round
    const baseSize = Math.max(40, holeSize - (round - 1) * 5);
    
    // Top left
    wall.holes.push({
        x: wall.x + 60 + Math.random() * 30,
        y: wall.y + 40 + Math.random() * 20,
        width: baseSize + Math.random() * 20,
        height: baseSize + Math.random() * 10,
        points: 30
    });
    
    // Top right
    wall.holes.push({
        x: wall.x + wall.width - 60 - baseSize - Math.random() * 30,
        y: wall.y + 40 + Math.random() * 20,
        width: baseSize + Math.random() * 20,
        height: baseSize + Math.random() * 10,
        points: 30
    });
    
    // Bottom left
    wall.holes.push({
        x: wall.x + 60 + Math.random() * 30,
        y: wall.y + wall.height - 40 - baseSize - Math.random() * 20,
        width: baseSize + Math.random() * 20,
        height: baseSize + Math.random() * 10,
        points: 20
    });
    
    // Bottom right
    wall.holes.push({
        x: wall.x + wall.width - 60 - baseSize - Math.random() * 30,
        y: wall.y + wall.height - 40 - baseSize - Math.random() * 20,
        width: baseSize + Math.random() * 20,
        height: baseSize + Math.random() * 10,
        points: 20
    });

    // From round 2+: add a smaller bonus hole in the center
    if (round >= 2) {
        const smallSize = baseSize * 0.6;
        wall.holes.push({
            x: wall.x + wall.width / 2 - smallSize / 2,
            y: wall.y + wall.height / 2 - smallSize / 2,
            width: smallSize,
            height: smallSize,
            points: 50
        });
    }
}

function startGame() {
    score = 0;
    shotsLeft = totalShots;
    round = 1;
    holeSize = 70;
    wallMovement = 0;
    wallOffset = 0;
    shotTimeLimit = INITIAL_TIME_LIMIT;
    shotTimer = shotTimeLimit;
    crosshair.x = canvas.width / 2;
    crosshair.y = canvas.height / 2;
    gameState = 'aiming';
    lastShotResult = '';
    generateHoles();
}

function shoot() {
    if (gameState !== 'aiming' || shotsLeft <= 0) return;
    
    shotsLeft--;
    gameState = 'shooting';
    
    // Ball starts from bottom center
    ball.x = canvas.width / 2;
    ball.y = canvas.height + 20;
    ball.targetX = crosshair.x + wallOffset;
    ball.targetY = crosshair.y;
    ball.progress = 0;
    ball.size = 20;
}

function checkHit() {
    const hitX = ball.targetX;
    const hitY = ball.targetY;
    
    for (let hole of wall.holes) {
        const holeX = hole.x + wallOffset;
        const holeCenterX = holeX + hole.width / 2;
        const holeCenterY = hole.y + hole.height / 2;
        
        // Check if ball center is within the hole
        if (hitX >= holeX && hitX <= holeX + hole.width &&
            hitY >= hole.y && hitY <= hole.y + hole.height) {
            score += hole.points;
            lastShotResult = 'TOR! +' + hole.points + ' Punkte!';
            return;
        }
    }
    
    // Check if it hit the wall at all
    if (hitX >= wall.x + wallOffset && hitX <= wall.x + wall.width + wallOffset &&
        hitY >= wall.y && hitY <= wall.y + wall.height) {
        lastShotResult = 'Wand getroffen!';
    } else {
        lastShotResult = 'Daneben!';
    }
}

function nextRound() {
    if (shotsLeft <= 0) {
        gameState = 'gameover';
        return;
    }
    
    // Increase difficulty every 3 shots
    const shotsTaken = totalShots - shotsLeft;
    if (shotsTaken > 0 && shotsTaken % 3 === 0) {
        round++;
        wallMovement = Math.min(1.5, wallMovement + 0.3);
        // Reduce time limit each round
        shotTimeLimit = Math.max(MIN_TIME_LIMIT, shotTimeLimit - 20);
        generateHoles();
    }
    
    // Reset timer for next shot
    shotTimer = shotTimeLimit;
    
    gameState = 'aiming';
    crosshair.x = canvas.width / 2;
    crosshair.y = canvas.height / 2;
}

function handleGamepadInput(dt) {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let gp of gamepads) {
        if (!gp) continue;
        
        // Left stick for aiming
        const lx = Math.abs(gp.axes[0]) > DEADZONE ? gp.axes[0] : 0;
        const ly = Math.abs(gp.axes[1]) > DEADZONE ? gp.axes[1] : 0;
        
        if (gameState === 'aiming') {
            crosshair.x += lx * CROSSHAIR_SPEED * dt;
            crosshair.y += ly * CROSSHAIR_SPEED * dt;
        }
        
        // A button (index 0) or X button (index 2) to shoot/start
        if (gp.buttons[0] && gp.buttons[0].pressed) {
            if (gameState === 'start' || gameState === 'gameover') {
                startGame();
            } else if (gameState === 'aiming') {
                shoot();
            } else if (gameState === 'result') {
                nextRound();
            }
        }
    }
}

function update(dt) {
    // Handle gamepad
    handleGamepadInput(dt);
    
    // Crosshair movement
    if (gameState === 'aiming') {
        if (keys['ArrowLeft'] || keys['KeyA']) crosshair.x -= CROSSHAIR_SPEED * dt;
        if (keys['ArrowRight'] || keys['KeyD']) crosshair.x += CROSSHAIR_SPEED * dt;
        if (keys['ArrowUp'] || keys['KeyW']) crosshair.y -= CROSSHAIR_SPEED * dt;
        if (keys['ArrowDown'] || keys['KeyS']) crosshair.y += CROSSHAIR_SPEED * dt;
        
        // Clamp crosshair to canvas
        crosshair.x = Math.max(20, Math.min(canvas.width - 20, crosshair.x));
        crosshair.y = Math.max(20, Math.min(canvas.height - 60, crosshair.y));
        
        // Shot timer countdown
        shotTimer -= dt;
        if (shotTimer <= 0) {
            // Time's up - auto shoot!
            shoot();
        }
        
        // Wall movement (from round 2+)
        if (wallMovement > 0) {
            wallOffset += wallDirection * wallMovement * dt;
            if (Math.abs(wallOffset) > 40) {
                wallDirection *= -1;
            }
        }
    }
    
    // Ball animation
    if (gameState === 'shooting') {
        ball.progress += BALL_SPEED * dt;
        ball.size = 20 - ball.progress * 8; // Ball gets smaller (perspective)
        
        if (ball.progress >= 1) {
            ball.progress = 1;
            checkHit();
            gameState = 'result';
            resultTimer = 90; // Show result for ~1.5 seconds
        }
    }
    
    // Result display timer
    if (gameState === 'result') {
        resultTimer -= dt;
        if (resultTimer <= 0) {
            nextRound();
        }
    }
}

function drawGrass() {
    // Green field
    ctx.fillStyle = '#2d8a4e';
    ctx.fillRect(0, canvas.height - 80, canvas.width, 80);
    
    // Grass lines
    ctx.strokeStyle = '#3a9e5c';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 30) {
        ctx.beginPath();
        ctx.moveTo(i, canvas.height - 80);
        ctx.lineTo(i - 10, canvas.height);
        ctx.stroke();
    }
}

function drawWall() {
    const ox = wallOffset;
    
    // Wall shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(wall.x + ox + 5, wall.y + 5, wall.width, wall.height);
    
    // Wall body
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(wall.x + ox, wall.y, wall.width, wall.height);
    
    // Wall border
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 4;
    ctx.strokeRect(wall.x + ox, wall.y, wall.width, wall.height);
    
    // Goal posts (top bar)
    ctx.fillStyle = '#ddd';
    ctx.fillRect(wall.x + ox - 8, wall.y - 12, wall.width + 16, 14);
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 2;
    ctx.strokeRect(wall.x + ox - 8, wall.y - 12, wall.width + 16, 14);
    
    // Side posts
    ctx.fillStyle = '#ddd';
    ctx.fillRect(wall.x + ox - 8, wall.y, 10, wall.height);
    ctx.fillRect(wall.x + ox + wall.width - 2, wall.y, 10, wall.height);
    
    // Draw holes
    for (let hole of wall.holes) {
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(hole.x + ox, hole.y, hole.width, hole.height);
        
        // Hole border glow
        ctx.strokeStyle = hole.points >= 50 ? '#ffd700' : (hole.points >= 30 ? '#ff6b6b' : '#4ecdc4');
        ctx.lineWidth = 3;
        ctx.strokeRect(hole.x + ox, hole.y, hole.width, hole.height);
        
        // Points label
        ctx.fillStyle = hole.points >= 50 ? '#ffd700' : '#fff';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(hole.points + 'P', hole.x + ox + hole.width / 2, hole.y + hole.height / 2 + 5);
    }
}

function drawCrosshair() {
    const x = crosshair.x;
    const y = crosshair.y;
    const size = 18;
    
    ctx.strokeStyle = '#ff3333';
    ctx.lineWidth = 2.5;
    
    // Outer circle
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.stroke();
    
    // Cross lines
    ctx.beginPath();
    ctx.moveTo(x - size - 5, y);
    ctx.lineTo(x - 6, y);
    ctx.moveTo(x + 6, y);
    ctx.lineTo(x + size + 5, y);
    ctx.moveTo(x, y - size - 5);
    ctx.lineTo(x, y - 6);
    ctx.moveTo(x, y + 6);
    ctx.lineTo(x, y + size + 5);
    ctx.stroke();
    
    // Center dot
    ctx.fillStyle = '#ff3333';
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
}

function drawBall() {
    if (gameState !== 'shooting') return;
    
    const startX = canvas.width / 2;
    const startY = canvas.height + 20;
    const p = ball.progress;
    
    // Quadratic bezier for arc trajectory
    const controlY = Math.min(ball.targetY, startY) - 100;
    const bx = (1-p)*(1-p)*startX + 2*(1-p)*p*((startX + ball.targetX)/2) + p*p*ball.targetX;
    const by = (1-p)*(1-p)*startY + 2*(1-p)*p*controlY + p*p*ball.targetY;
    
    const size = Math.max(8, ball.size);
    
    // Ball shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(bx + 3, by + 3, size, size * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Ball
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(bx, by, size, 0, Math.PI * 2);
    ctx.fill();
    
    // Ball pattern (pentagon patches)
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(bx - size * 0.2, by - size * 0.1, size * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bx + size * 0.3, by + size * 0.2, size * 0.2, 0, Math.PI * 2);
    ctx.fill();
}

function drawHUD() {
    // Score
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Punkte: ' + score, 15, 30);
    
    // Shots left
    ctx.textAlign = 'right';
    ctx.fillText('Schüsse: ' + shotsLeft + '/' + totalShots, canvas.width - 15, 30);
    
    // Round
    ctx.textAlign = 'center';
    ctx.font = '16px sans-serif';
    ctx.fillText('Runde ' + round, canvas.width / 2, 30);
    
    // Timer bar
    if (gameState === 'aiming') {
        const barWidth = 200;
        const barHeight = 12;
        const barX = canvas.width / 2 - barWidth / 2;
        const barY = canvas.height - 25;
        const timeRatio = Math.max(0, shotTimer / shotTimeLimit);
        
        // Background
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4);
        
        // Timer bar - color changes from green to yellow to red
        let barColor;
        if (timeRatio > 0.5) barColor = '#4ecdc4';
        else if (timeRatio > 0.25) barColor = '#ffd700';
        else barColor = '#ff3333';
        
        ctx.fillStyle = barColor;
        ctx.fillRect(barX, barY, barWidth * timeRatio, barHeight);
        
        // Border
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
        
        // Time text
        const secondsLeft = Math.ceil(shotTimer / TARGET_FPS);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⏱ ' + secondsLeft + 's', canvas.width / 2, barY - 5);
    }
}

function drawResult() {
    if (gameState !== 'result') return;
    
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(canvas.width / 2 - 150, canvas.height / 2 - 30, 300, 60);
    
    const isHit = lastShotResult.includes('TOR');
    ctx.fillStyle = isHit ? '#4ecdc4' : '#ff6b6b';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(lastShotResult, canvas.width / 2, canvas.height / 2 + 8);
}

function drawStartScreen() {
    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Title
    ctx.fillStyle = '#4ecdc4';
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚽ Torwandschießen', canvas.width / 2, canvas.height / 2 - 80);
    
    // Subtitle
    ctx.fillStyle = '#ccc';
    ctx.font = '20px sans-serif';
    ctx.fillText('Triff die Löcher bevor die Zeit abläuft!', canvas.width / 2, canvas.height / 2 - 35);
    
    // Controls
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText('🎮 Steuerung:', canvas.width / 2, canvas.height / 2 + 20);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Pfeiltasten / WASD = Zielen', canvas.width / 2, canvas.height / 2 + 50);
    ctx.fillText('Leertaste / Enter = Schießen', canvas.width / 2, canvas.height / 2 + 75);
    ctx.fillText('Gamepad: Linker Stick + A-Taste', canvas.width / 2, canvas.height / 2 + 100);
    
    // Start prompt
    ctx.fillStyle = '#4ecdc4';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('Leertaste drücken zum Starten', canvas.width / 2, canvas.height / 2 + 150);
}

function drawGameOver() {
    ctx.fillStyle = 'rgba(26, 26, 46, 0.92)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#ff6b6b';
    ctx.font = 'bold 38px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Spiel vorbei!', canvas.width / 2, canvas.height / 2 - 70);
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('Punkte: ' + score, canvas.width / 2, canvas.height / 2 - 20);
    
    // Rating
    let rating = '';
    if (score >= 200) rating = '⭐⭐⭐ Weltklasse!';
    else if (score >= 150) rating = '⭐⭐ Sehr gut!';
    else if (score >= 100) rating = '⭐ Gut gemacht!';
    else if (score >= 50) rating = 'Nicht schlecht!';
    else rating = 'Übung macht den Meister!';
    
    ctx.fillStyle = '#ffd700';
    ctx.font = '22px sans-serif';
    ctx.fillText(rating, canvas.width / 2, canvas.height / 2 + 25);
    
    ctx.fillStyle = '#4ecdc4';
    ctx.font = '18px sans-serif';
    ctx.fillText('Leertaste für neues Spiel', canvas.width / 2, canvas.height / 2 + 80);
}

function draw() {
    // Clear
    ctx.fillStyle = '#87CEEB'; // Sky blue
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (gameState === 'start') {
        drawStartScreen();
        return;
    }
    
    if (gameState === 'gameover') {
        drawGameOver();
        return;
    }
    
    // Game scene
    drawGrass();
    drawWall();
    drawBall();
    
    if (gameState === 'aiming') {
        drawCrosshair();
    }
    
    drawHUD();
    drawResult();
}

function gameLoop(timestamp) {
    if (lastTime === 0) lastTime = timestamp;
    const elapsed = timestamp - lastTime;
    lastTime = timestamp;
    const dt = Math.min(elapsed / (1000 / TARGET_FPS), 3);

    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
}

// Input handlers
document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    
    if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (gameState === 'start' || gameState === 'gameover') {
            startGame();
        } else if (gameState === 'aiming') {
            shoot();
        } else if (gameState === 'result') {
            nextRound();
        }
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// Prevent scrolling
document.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
    }
});

// Start game loop
requestAnimationFrame(gameLoop);
