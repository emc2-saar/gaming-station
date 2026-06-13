const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const TARGET_FPS = 60;
let lastTime = 0;

// Game states: 'start', 'playing', 'gameover'
let gameState = 'start';
let playerScore = 0;
let creeperScore = 0;
const WIN_SCORE = 5;

// Paddle (Player)
const player = {
    width: 80,
    height: 14,
    x: 0,
    y: 0,
    speed: 7,
    dx: 0
};

// Creeper (AI)
const creeper = {
    width: 80,
    height: 14,
    x: 0,
    y: 0,
    speed: 4.5,
    baseSpeed: 4.5,
    reactionDelay: 0,
    targetX: 0
};

// Ball
const ball = {
    x: 0,
    y: 0,
    radius: 8,
    speedX: 0,
    speedY: 0,
    baseSpeed: 5,
    maxSpeed: 10
};

// Input
const keys = {};
let gamepadIndex = null;

// Particles for effects
let particles = [];

// Initialize positions
function initPositions() {
    player.x = canvas.width / 2 - player.width / 2;
    player.y = canvas.height - 50;
    creeper.x = canvas.width / 2 - creeper.width / 2;
    creeper.y = 36;
    resetBall();
}

function resetBall() {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    const angle = (Math.random() * 0.5 + 0.25) * Math.PI; // 45-135 degrees
    const direction = Math.random() < 0.5 ? 1 : -1;
    ball.speedX = Math.cos(angle) * ball.baseSpeed * (Math.random() < 0.5 ? 1 : -1);
    ball.speedY = ball.baseSpeed * direction;
}

function startGame() {
    playerScore = 0;
    creeperScore = 0;
    creeper.speed = creeper.baseSpeed;
    particles = [];
    initPositions();
    gameState = 'playing';
    lastTime = 0;
}

// Creeper AI
function updateCreeper(dt) {
    // Creeper tracks the ball but with some reaction delay
    const creeperCenter = creeper.x + creeper.width / 2;
    const diff = ball.x - creeperCenter;
    
    // Add some imperfection based on score
    const difficulty = Math.min(playerScore * 0.1, 0.8);
    const effectiveSpeed = creeper.speed + difficulty * 2;
    
    if (Math.abs(diff) > 10) {
        if (diff > 0) {
            creeper.x += effectiveSpeed * dt;
        } else {
            creeper.x -= effectiveSpeed * dt;
        }
    }
    
    // Keep in bounds
    creeper.x = Math.max(0, Math.min(canvas.width - creeper.width, creeper.x));
}

// Particles
function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            life: 1.0,
            decay: 0.02 + Math.random() * 0.02,
            color: color,
            size: 2 + Math.random() * 3
        });
    }
}

function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= p.decay * dt;
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

function drawParticles() {
    for (const p of particles) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
}

// Draw Creeper face on paddle
function drawCreeperFace(x, y, width, height) {
    // Green paddle background
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(x, y, width, height);
    
    // Darker green border
    ctx.strokeStyle = '#2E7D32';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    
    // Creeper face (simplified for small paddle)
    const faceSize = Math.min(width, height) - 4;
    const faceX = x + width / 2;
    const faceY = y + height / 2;
    const px = 2; // pixel size
    
    // Eyes (dark squares)
    ctx.fillStyle = '#1B5E20';
    ctx.fillRect(faceX - 12, faceY - 4, px * 2, px * 2);
    ctx.fillRect(faceX + 8, faceY - 4, px * 2, px * 2);
    
    // Mouth
    ctx.fillRect(faceX - 4, faceY - 1, px * 4, px * 2);
    ctx.fillRect(faceX - 6, faceY + 3, px * 2, px * 2);
    ctx.fillRect(faceX + 4, faceY + 3, px * 2, px * 2);
}

// Draw big creeper head for start/gameover screens
function drawCreeperHead(x, y, size) {
    const px = size / 8; // pixel size
    
    // Head background
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(x, y, size, size);
    
    // Darker spots (texture)
    ctx.fillStyle = '#388E3C';
    ctx.fillRect(x + px, y + px, px, px);
    ctx.fillRect(x + 6 * px, y, px, px);
    ctx.fillRect(x, y + 6 * px, px, px);
    ctx.fillRect(x + 7 * px, y + 5 * px, px, px);
    
    // Eyes
    ctx.fillStyle = '#1B5E20';
    // Left eye
    ctx.fillRect(x + px, y + 2 * px, px * 2, px * 2);
    // Right eye
    ctx.fillRect(x + 5 * px, y + 2 * px, px * 2, px * 2);
    
    // Mouth/nose
    ctx.fillRect(x + 3 * px, y + 4 * px, px * 2, px);
    ctx.fillRect(x + 2 * px, y + 5 * px, px, px * 2);
    ctx.fillRect(x + 3 * px, y + 5 * px, px * 2, px * 2);
    ctx.fillRect(x + 5 * px, y + 5 * px, px, px * 2);
}

function update(dt) {
    // Always poll gamepad (also on start/gameover screens)
    handleGamepad();
    
    if (gameState !== 'playing') return;
    
    // Player movement (keyboard OR gamepad)
    player.dx = 0;
    if (keys['ArrowLeft'] || keys['KeyA'] || keys['_gpLeft']) player.dx = -1;
    if (keys['ArrowRight'] || keys['KeyD'] || keys['_gpRight']) player.dx = 1;
    
    player.x += player.dx * player.speed * dt;
    player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));
    
    // Creeper AI
    updateCreeper(dt);
    
    // Ball movement
    ball.x += ball.speedX * dt;
    ball.y += ball.speedY * dt;
    
    // Wall collision (left/right)
    if (ball.x - ball.radius <= 0) {
        ball.x = ball.radius;
        ball.speedX = Math.abs(ball.speedX);
        spawnParticles(ball.x, ball.y, '#fff', 5);
    }
    if (ball.x + ball.radius >= canvas.width) {
        ball.x = canvas.width - ball.radius;
        ball.speedX = -Math.abs(ball.speedX);
        spawnParticles(ball.x, ball.y, '#fff', 5);
    }
    
    // Player paddle collision
    if (ball.speedY > 0 &&
        ball.y + ball.radius >= player.y &&
        ball.y + ball.radius <= player.y + player.height + 5 &&
        ball.x >= player.x - ball.radius &&
        ball.x <= player.x + player.width + ball.radius) {
        
        ball.y = player.y - ball.radius;
        ball.speedY = -Math.abs(ball.speedY);
        
        // Angle based on where ball hits paddle
        const hitPos = (ball.x - player.x) / player.width; // 0 to 1
        ball.speedX = (hitPos - 0.5) * ball.baseSpeed * 2.5;
        
        // Slight speed increase
        const currentSpeed = Math.sqrt(ball.speedX * ball.speedX + ball.speedY * ball.speedY);
        if (currentSpeed < ball.maxSpeed) {
            ball.speedX *= 1.05;
            ball.speedY *= 1.05;
        }
        
        spawnParticles(ball.x, ball.y, '#4FC3F7', 8);
    }
    
    // Creeper paddle collision
    if (ball.speedY < 0 &&
        ball.y - ball.radius <= creeper.y + creeper.height &&
        ball.y - ball.radius >= creeper.y - 5 &&
        ball.x >= creeper.x - ball.radius &&
        ball.x <= creeper.x + creeper.width + ball.radius) {
        
        ball.y = creeper.y + creeper.height + ball.radius;
        ball.speedY = Math.abs(ball.speedY);
        
        // Angle based on where ball hits paddle
        const hitPos = (ball.x - creeper.x) / creeper.width;
        ball.speedX = (hitPos - 0.5) * ball.baseSpeed * 2.5;
        
        spawnParticles(ball.x, ball.y, '#4CAF50', 8);
    }
    
    // Score - ball goes past player
    if (ball.y > canvas.height + 20) {
        creeperScore++;
        spawnParticles(canvas.width / 2, canvas.height - 20, '#f44336', 15);
        if (creeperScore >= WIN_SCORE) {
            gameState = 'gameover';
        } else {
            resetBall();
        }
    }
    
    // Score - ball goes past creeper
    if (ball.y < -20) {
        playerScore++;
        spawnParticles(canvas.width / 2, 20, '#4FC3F7', 15);
        if (playerScore >= WIN_SCORE) {
            gameState = 'gameover';
        } else {
            resetBall();
            // Creeper gets slightly faster
            creeper.speed = creeper.baseSpeed + playerScore * 0.3;
        }
    }
    
    // Update particles
    updateParticles(dt);
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
    drawField();
    
    // Draw particles
    drawParticles();
    
    // Draw player paddle
    ctx.fillStyle = '#4FC3F7';
    ctx.shadowColor = '#4FC3F7';
    ctx.shadowBlur = 10;
    ctx.fillRect(player.x, player.y, player.width, player.height);
    ctx.shadowBlur = 0;
    
    // Draw creeper paddle
    drawCreeperFace(creeper.x, creeper.y, creeper.width, creeper.height);
    
    // Draw ball
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
    
    // Draw score
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(playerScore + ' - ' + creeperScore, canvas.width / 2, canvas.height / 2 + 8);
    
    // Score labels
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#4FC3F7';
    ctx.fillText('DU', canvas.width / 2 - 40, canvas.height / 2 + 8);
    ctx.fillStyle = '#4CAF50';
    ctx.fillText('CREEPER', canvas.width / 2 + 50, canvas.height / 2 + 8);
}

function drawField() {
    // Center line (dashed)
    ctx.setLineDash([10, 10]);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
}

function drawStartScreen() {
    // Creeper head
    drawCreeperHead(canvas.width / 2 - 48, 120, 96);
    
    // Title
    ctx.fillStyle = '#4CAF50';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Creeper Pong', canvas.width / 2, 280);
    
    // Subtitle
    ctx.fillStyle = '#aaa';
    ctx.font = '16px sans-serif';
    ctx.fillText('Tischtennis gegen den Creeper!', canvas.width / 2, 310);
    
    // Instructions
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText('← → oder A/D zum Steuern', canvas.width / 2, 380);
    ctx.fillText('Erster mit ' + WIN_SCORE + ' Punkten gewinnt!', canvas.width / 2, 410);
    
    // Gamepad hint
    ctx.fillStyle = '#888';
    ctx.font = '14px sans-serif';
    ctx.fillText('🎮 Gamepad wird unterstützt!', canvas.width / 2, 450);
    
    // Start prompt
    ctx.fillStyle = '#4FC3F7';
    ctx.font = 'bold 20px sans-serif';
    const pulse = Math.sin(Date.now() / 500) * 0.3 + 0.7;
    ctx.globalAlpha = pulse;
    ctx.fillText('LEERTASTE / START zum Spielen', canvas.width / 2, 520);
    ctx.globalAlpha = 1;
}

function drawGameOverScreen() {
    const playerWon = playerScore >= WIN_SCORE;
    
    // Creeper head (happy or sad)
    drawCreeperHead(canvas.width / 2 - 48, 100, 96);
    
    // Result
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    if (playerWon) {
        ctx.fillStyle = '#4FC3F7';
        ctx.fillText('DU HAST GEWONNEN!', canvas.width / 2, 260);
        ctx.fillStyle = '#aaa';
        ctx.font = '16px sans-serif';
        ctx.fillText('Der Creeper ist besiegt! 💥', canvas.width / 2, 295);
    } else {
        ctx.fillStyle = '#4CAF50';
        ctx.fillText('CREEPER GEWINNT!', canvas.width / 2, 260);
        ctx.fillStyle = '#aaa';
        ctx.font = '16px sans-serif';
        ctx.fillText('Ssssssss... 💚', canvas.width / 2, 295);
    }
    
    // Score
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(playerScore + ' : ' + creeperScore, canvas.width / 2, 360);
    
    // Labels
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#4FC3F7';
    ctx.fillText('DU', canvas.width / 2 - 50, 390);
    ctx.fillStyle = '#4CAF50';
    ctx.fillText('CREEPER', canvas.width / 2 + 50, 390);
    
    // Restart prompt
    ctx.fillStyle = '#4FC3F7';
    ctx.font = 'bold 20px sans-serif';
    const pulse = Math.sin(Date.now() / 500) * 0.3 + 0.7;
    ctx.globalAlpha = pulse;
    ctx.fillText('LEERTASTE für Revanche!', canvas.width / 2, 480);
    ctx.globalAlpha = 1;
}

// Gamepad support
let gpStartPressed = false; // Prevent repeated start triggers

function handleGamepad() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gpLeft = false;
    let gpRight = false;
    let gpAction = false;
    
    for (const gp of gamepads) {
        if (!gp) continue;
        
        // Left stick
        const axisX = gp.axes[0] || 0;
        const deadzone = 0.15;
        
        if (axisX < -deadzone) gpLeft = true;
        if (axisX > deadzone) gpRight = true;
        
        // D-pad buttons (button 14 = left, 15 = right)
        if (gp.buttons[14] && gp.buttons[14].pressed) gpLeft = true;
        if (gp.buttons[15] && gp.buttons[15].pressed) gpRight = true;
        
        // A button (0), B button (1), or Start (9) to begin/restart
        if ((gp.buttons[0] && gp.buttons[0].pressed) || 
            (gp.buttons[1] && gp.buttons[1].pressed) ||
            (gp.buttons[9] && gp.buttons[9].pressed)) {
            gpAction = true;
        }
        
        break; // Use first connected gamepad
    }
    
    // Apply gamepad to movement keys (gamepad overrides only while active)
    keys['_gpLeft'] = gpLeft;
    keys['_gpRight'] = gpRight;
    
    // Handle start/restart with edge detection (only trigger once per press)
    if (gpAction && !gpStartPressed) {
        gpStartPressed = true;
        if (gameState !== 'playing') {
            startGame();
        }
    }
    if (!gpAction) {
        gpStartPressed = false;
    }
}

// Input handlers
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (gameState !== 'playing') {
            startGame();
        }
    }
    keys[e.code] = true;
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// Touch support
let touchX = null;
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameState !== 'playing') {
        startGame();
        return;
    }
    touchX = e.touches[0].clientX;
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!touchX) return;
    const rect = canvas.getBoundingClientRect();
    const relX = e.touches[0].clientX - rect.left;
    player.x = relX - player.width / 2;
    player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));
});

canvas.addEventListener('touchend', () => {
    touchX = null;
});

// Game loop
function gameLoop(timestamp) {
    if (lastTime === 0) lastTime = timestamp;
    const elapsed = timestamp - lastTime;
    lastTime = timestamp;
    const dt = Math.min(elapsed / (1000 / TARGET_FPS), 3);

    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
}

// Initialize
initPositions();
requestAnimationFrame(gameLoop);
