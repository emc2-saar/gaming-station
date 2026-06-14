const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const TARGET_FPS = 60;
let lastTime = 0;

// Game states: 'start', 'aiming', 'flying', 'scored', 'missed', 'gameover'
let gameState = 'start';
let score = 0;
let lives = 5;
let streak = 0;
let bestStreak = 0;

// Ball
const ball = {
    x: 240,
    y: 540,
    vx: 0,
    vy: 0,
    radius: 15,
    rotation: 0
};

const GRAVITY = 0.15;
const BALL_START_X = 240;
const BALL_START_Y = 540;

// Hoop (Korb)
const hoop = {
    x: 240,
    y: 200,
    width: 90,
    rimWidth: 6,
    direction: 1,
    speed: 1.5,
    baseSpeed: 1.5
};

// Aiming
let aimAngle = -Math.PI / 2; // straight up
let aimPower = 0;
let aimDir = 1;
let charging = false;
const AIM_SPEED = 0.025;
const POWER_MIN = 5;
const POWER_MAX = 13;
const POWER_CHARGE_SPEED = 0.12;

// Particles
let particles = [];

// Net animation
let netWave = 0;
let netWaveActive = false;

// Gamepad
let gamepadCharging = false;

// Input state
const keys = {};

document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    
    if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (gameState === 'start' || gameState === 'gameover') {
            handleAction();
        } else if (gameState === 'aiming' && !charging) {
            // Start charging
            charging = true;
            aimPower = POWER_MIN;
        }
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
    
    if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (gameState === 'aiming' && charging) {
            // Release to shoot
            charging = false;
            shootBall();
        }
    }
});

// Touch support
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameState === 'start' || gameState === 'gameover') {
        handleAction();
    } else if (gameState === 'aiming' && !charging) {
        charging = true;
        aimPower = POWER_MIN;
    }
});

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (gameState === 'aiming' && charging) {
        charging = false;
        shootBall();
    }
});

function handleAction() {
    if (gameState === 'start' || gameState === 'gameover') {
        startGame();
    } else if (gameState === 'aiming') {
        shootBall();
    } else if (gameState === 'scored' || gameState === 'missed') {
        resetBall();
    }
}

function startGame() {
    score = 0;
    lives = 5;
    streak = 0;
    bestStreak = 0;
    hoop.speed = hoop.baseSpeed;
    hoop.x = 240;
    hoop.direction = 1;
    resetBall();
    gameState = 'aiming';
    lastTime = 0;
}

function resetBall() {
    ball.x = BALL_START_X;
    ball.y = BALL_START_Y;
    ball.vx = 0;
    ball.vy = 0;
    ball.rotation = 0;
    aimAngle = -Math.PI / 2;
    aimPower = 0;
    aimDir = 1;
    charging = false;
    gamepadCharging = false;
    gameState = 'aiming';
}

function shootBall() {
    ball.vx = Math.cos(aimAngle) * aimPower;
    ball.vy = Math.sin(aimAngle) * aimPower;
    gameState = 'flying';
}

function createScoreParticles(x, y) {
    for (let i = 0; i < 20; i++) {
        const angle = (Math.PI * 2 * i) / 20;
        const speed = 2 + Math.random() * 3;
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1.0,
            color: `hsl(${30 + Math.random() * 30}, 100%, 50%)`
        });
    }
}

function checkHoopCollision() {
    const hoopLeft = hoop.x - hoop.width / 2;
    const hoopRight = hoop.x + hoop.width / 2;
    const hoopY = hoop.y;
    
    // Only check collisions when ball is moving DOWN (vy > 0)
    // Ball coming from below = pass through (no collision)
    if (ball.vy <= 0) return;
    
    // Ball going down through hoop?
    if (ball.y > hoopY - 5 && ball.y < hoopY + 15 &&
        ball.x > hoopLeft + 8 && ball.x < hoopRight - 8) {
        // Score!
        score++;
        streak++;
        if (streak > bestStreak) bestStreak = streak;
        
        // Increase difficulty
        hoop.speed = hoop.baseSpeed + Math.min(score * 0.2, 3);
        
        createScoreParticles(ball.x, ball.y);
        netWaveActive = true;
        netWave = 1.0;
        gameState = 'scored';
        return;
    }
    
    // Hit rim? Only when ball is above hoop and falling down
    if (ball.y < hoopY + ball.radius && ball.y > hoopY - ball.radius * 2) {
        const rimLeftX = hoopLeft;
        const rimRightX = hoopRight;
        
        // Check left rim
        const dxL = ball.x - rimLeftX;
        const dyL = ball.y - hoopY;
        const distL = Math.sqrt(dxL * dxL + dyL * dyL);
        
        if (distL < ball.radius + hoop.rimWidth / 2) {
            const nx = dxL / distL;
            const ny = dyL / distL;
            const dot = ball.vx * nx + ball.vy * ny;
            ball.vx -= 1.5 * dot * nx;
            ball.vy -= 1.5 * dot * ny;
            ball.vx *= 0.6;
            ball.vy *= 0.6;
            ball.x = rimLeftX + nx * (ball.radius + hoop.rimWidth / 2 + 1);
            ball.y = hoopY + ny * (ball.radius + hoop.rimWidth / 2 + 1);
        }
        
        // Check right rim
        const dxR = ball.x - rimRightX;
        const dyR = ball.y - hoopY;
        const distR = Math.sqrt(dxR * dxR + dyR * dyR);
        
        if (distR < ball.radius + hoop.rimWidth / 2) {
            const nx = dxR / distR;
            const ny = dyR / distR;
            const dot = ball.vx * nx + ball.vy * ny;
            ball.vx -= 1.5 * dot * nx;
            ball.vy -= 1.5 * dot * ny;
            ball.vx *= 0.6;
            ball.vy *= 0.6;
            ball.x = rimRightX + nx * (ball.radius + hoop.rimWidth / 2 + 1);
            ball.y = hoopY + ny * (ball.radius + hoop.rimWidth / 2 + 1);
        }
    }
}

function update(dt) {
    // Hoop movement (always moves)
    if (gameState !== 'start' && gameState !== 'gameover') {
        hoop.x += hoop.speed * hoop.direction * dt;
        if (hoop.x > canvas.width - 50) {
            hoop.x = canvas.width - 50;
            hoop.direction = -1;
        }
        if (hoop.x < 50) {
            hoop.x = 50;
            hoop.direction = 1;
        }
    }
    
    // Aiming auto-oscillation for angle
    if (gameState === 'aiming') {
        // Angle oscillates automatically
        aimAngle += AIM_SPEED * aimDir * dt;
        if (aimAngle > -Math.PI / 6) {
            aimAngle = -Math.PI / 6;
            aimDir = -1;
        }
        if (aimAngle < -5 * Math.PI / 6) {
            aimAngle = -5 * Math.PI / 6;
            aimDir = 1;
        }
        
        // Power charges while holding
        if (charging) {
            aimPower += POWER_CHARGE_SPEED * dt;
            if (aimPower > POWER_MAX) {
                aimPower = POWER_MAX;
            }
        }

        // Gamepad input
        pollGamepad(dt);
    }
    
    // Ball physics
    if (gameState === 'flying') {
        ball.vy += GRAVITY * dt;
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        ball.rotation += ball.vx * 0.05 * dt;
        
        // Wall bounces
        if (ball.x < ball.radius) {
            ball.x = ball.radius;
            ball.vx *= -0.5;
        }
        if (ball.x > canvas.width - ball.radius) {
            ball.x = canvas.width - ball.radius;
            ball.vx *= -0.5;
        }
        if (ball.y < ball.radius) {
            ball.y = ball.radius;
            ball.vy *= -0.5;
        }
        
        checkHoopCollision();
        
        // Ball fell off screen
        if (ball.y > canvas.height + 50) {
            lives--;
            streak = 0;
            if (lives <= 0) {
                gameState = 'gameover';
            } else {
                gameState = 'missed';
            }
        }
    }
    
    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 0.1 * dt;
        p.life -= 0.02 * dt;
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
    
    // Net wave
    if (netWaveActive) {
        netWave -= 0.03 * dt;
        if (netWave <= 0) {
            netWaveActive = false;
            netWave = 0;
        }
    }
    
    // Auto-continue after score/miss
    if (gameState === 'scored' || gameState === 'missed') {
        // Wait a moment then auto-reset (using a simple timer approach)
        if (!ball.waitTimer) ball.waitTimer = 0;
        ball.waitTimer += dt;
        if (ball.waitTimer > 40) { // ~40 frames ≈ 0.67 seconds
            ball.waitTimer = 0;
            resetBall();
        }
    }
}

function pollGamepad(dt) {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of gamepads) {
        if (!gp) continue;
        
        const deadzone = 0.15;
        const lx = Math.abs(gp.axes[0]) > deadzone ? gp.axes[0] : 0;
        
        // Left stick controls angle
        if (lx !== 0) {
            aimAngle += lx * 0.03 * dt;
            aimAngle = Math.max(-5 * Math.PI / 6, Math.min(-Math.PI / 6, aimAngle));
        }
        
        // A button: hold to charge, release to shoot
        if (gp.buttons[0] && gp.buttons[0].pressed) {
            if (!gamepadCharging) {
                gamepadCharging = true;
                charging = true;
                aimPower = POWER_MIN;
            }
        } else if (gamepadCharging) {
            // Button released - shoot!
            gamepadCharging = false;
            charging = false;
            shootBall();
        }
        
        // Start button to start/restart game
        if (gp.buttons[9] && gp.buttons[9].pressed) {
            if (gameState === 'start' || gameState === 'gameover') {
                startGame();
            }
        }
    }
}

function drawBall(x, y, radius) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ball.rotation);
    
    // Ball body
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#ff6b00';
    ctx.fill();
    ctx.strokeStyle = '#cc5500';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Ball lines
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#cc5500';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(-radius, 0);
    ctx.lineTo(radius, 0);
    ctx.strokeStyle = '#cc5500';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Vertical curved line
    ctx.beginPath();
    ctx.moveTo(0, -radius);
    ctx.quadraticCurveTo(radius * 0.3, 0, 0, radius);
    ctx.strokeStyle = '#cc5500';
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(0, -radius);
    ctx.quadraticCurveTo(-radius * 0.3, 0, 0, radius);
    ctx.strokeStyle = '#cc5500';
    ctx.stroke();
    
    ctx.restore();
}

function drawHoop() {
    const hoopLeft = hoop.x - hoop.width / 2;
    const hoopRight = hoop.x + hoop.width / 2;
    const hoopY = hoop.y;
    
    // Backboard
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(hoop.x - 5, hoopY - 50, 10, 50);
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 2;
    ctx.strokeRect(hoop.x - 5, hoopY - 50, 10, 50);
    
    // Backboard top
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(hoop.x - 25, hoopY - 55, 50, 10);
    ctx.strokeStyle = '#cccccc';
    ctx.strokeRect(hoop.x - 25, hoopY - 55, 50, 10);
    
    // Rim
    ctx.beginPath();
    ctx.arc(hoopLeft, hoopY, hoop.rimWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#ff3333';
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(hoopRight, hoopY, hoop.rimWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#ff3333';
    ctx.fill();
    
    // Rim connector
    ctx.beginPath();
    ctx.moveTo(hoopLeft, hoopY);
    ctx.lineTo(hoopRight, hoopY);
    ctx.strokeStyle = '#ff3333';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Net
    const netSegments = 5;
    const netDepth = 35;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    
    for (let i = 0; i <= netSegments; i++) {
        const t = i / netSegments;
        const topX = hoopLeft + t * (hoopRight - hoopLeft);
        const bottomX = hoop.x + (t - 0.5) * hoop.width * 0.4;
        const waveOffset = netWaveActive ? Math.sin(t * Math.PI * 3 + netWave * 10) * netWave * 5 : 0;
        
        ctx.beginPath();
        ctx.moveTo(topX, hoopY);
        ctx.quadraticCurveTo(
            (topX + bottomX) / 2 + waveOffset, 
            hoopY + netDepth * 0.6,
            bottomX, 
            hoopY + netDepth
        );
        ctx.globalAlpha = 0.7;
        ctx.stroke();
        ctx.globalAlpha = 1;
    }
    
    // Cross lines of net
    for (let j = 1; j < 3; j++) {
        const ny = hoopY + (netDepth * j) / 3;
        const widthAtY = hoop.width * (1 - j * 0.2);
        ctx.beginPath();
        ctx.moveTo(hoop.x - widthAtY / 2, ny);
        ctx.lineTo(hoop.x + widthAtY / 2, ny);
        ctx.globalAlpha = 0.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
    }
}

function drawAimGuide() {
    if (gameState !== 'aiming') return;
    
    const guideLength = aimPower * 6;
    const endX = ball.x + Math.cos(aimAngle) * guideLength;
    const endY = ball.y + Math.sin(aimAngle) * guideLength;
    
    // Dotted line
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(ball.x, ball.y);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Arrow head
    const arrowSize = 8;
    const arrowAngle = Math.atan2(endY - ball.y, endX - ball.x);
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(
        endX - arrowSize * Math.cos(arrowAngle - 0.4),
        endY - arrowSize * Math.sin(arrowAngle - 0.4)
    );
    ctx.moveTo(endX, endY);
    ctx.lineTo(
        endX - arrowSize * Math.cos(arrowAngle + 0.4),
        endY - arrowSize * Math.sin(arrowAngle + 0.4)
    );
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Power bar
    const barWidth = 80;
    const barHeight = 8;
    const barX = ball.x - barWidth / 2;
    const barY = ball.y + 30;
    const fillRatio = (aimPower - POWER_MIN) / (POWER_MAX - POWER_MIN);
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    
    if (charging) {
        // Color gradient based on power
        const r = Math.floor(255 * fillRatio);
        const g = Math.floor(255 * (1 - fillRatio));
        ctx.fillStyle = `rgb(${r}, ${g}, 50)`;
        ctx.fillRect(barX, barY, barWidth * fillRatio, barHeight);
    }
    
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
    
    ctx.fillStyle = '#fff';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(charging ? 'AUFLADEN...' : 'HALTEN = KRAFT', ball.x, barY + 20);
}

function drawParticles() {
    for (const p of particles) {
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function drawHUD() {
    // Score
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Punkte: ${score}`, 15, 30);
    
    // Lives
    ctx.textAlign = 'right';
    ctx.fillText('❤️'.repeat(lives), canvas.width - 15, 30);
    
    // Streak
    if (streak > 1) {
        ctx.textAlign = 'center';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillStyle = '#ffcc00';
        ctx.fillText(`${streak}x Serie!`, canvas.width / 2, 30);
    }
}

function draw() {
    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Court floor
    ctx.fillStyle = '#2d1f0e';
    ctx.fillRect(0, canvas.height - 60, canvas.width, 60);
    ctx.fillStyle = '#3d2b15';
    ctx.fillRect(0, canvas.height - 60, canvas.width, 3);
    
    // Court markings
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height - 60, 50, Math.PI, 0);
    ctx.stroke();
    
    if (gameState === 'start') {
        drawStartScreen();
        return;
    }
    
    if (gameState === 'gameover') {
        drawGameOverScreen();
        return;
    }
    
    // Game elements
    drawHoop();
    drawAimGuide();
    drawBall(ball.x, ball.y, ball.radius);
    drawParticles();
    drawHUD();
    
    // Score feedback
    if (gameState === 'scored') {
        ctx.fillStyle = '#00ff88';
        ctx.font = 'bold 36px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('TREFFER!', canvas.width / 2, canvas.height / 2);
        if (streak > 1) {
            ctx.font = '20px sans-serif';
            ctx.fillStyle = '#ffcc00';
            ctx.fillText(`${streak}x Combo!`, canvas.width / 2, canvas.height / 2 + 35);
        }
    }
    
    if (gameState === 'missed') {
        ctx.fillStyle = '#ff4444';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Daneben!', canvas.width / 2, canvas.height / 2);
        ctx.font = '18px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText(`Noch ${lives} Leben`, canvas.width / 2, canvas.height / 2 + 30);
    }
}

function drawStartScreen() {
    // Title
    ctx.fillStyle = '#ff6b00';
    ctx.font = 'bold 38px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏀 Basketball Wurf', canvas.width / 2, 200);
    
    // Basketball icon
    drawBall(canvas.width / 2, 290, 30);
    
    // Instructions
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText('Triff den beweglichen Korb!', canvas.width / 2, 360);
    
    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Der Winkel pendelt automatisch.', canvas.width / 2, 400);
    ctx.fillText('Halte die Taste für Kraft, loslassen = Wurf!', canvas.width / 2, 425);
    
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#888';
    ctx.fillText('🎮 Gamepad: Stick = Zielen, A halten = Kraft', canvas.width / 2, 470);
    ctx.fillText('⌨️ Tastatur: Leertaste halten = Kraft', canvas.width / 2, 495);
    
    // Blinking start text
    const blink = Math.sin(Date.now() / 400) > 0;
    if (blink) {
        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText('Leertaste / 🅰 zum Starten', canvas.width / 2, 560);
    }
}

function drawGameOverScreen() {
    // Darken
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Spiel vorbei!', canvas.width / 2, 220);
    
    ctx.fillStyle = '#fff';
    ctx.font = '24px sans-serif';
    ctx.fillText(`Punkte: ${score}`, canvas.width / 2, 290);
    
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#ffcc00';
    ctx.fillText(`Beste Serie: ${bestStreak}x`, canvas.width / 2, 330);
    
    // Rating
    let rating = '';
    if (score >= 15) rating = '🏆 Profi!';
    else if (score >= 10) rating = '⭐ Stark!';
    else if (score >= 5) rating = '👍 Gut gemacht!';
    else rating = '💪 Weiter üben!';
    
    ctx.font = '22px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(rating, canvas.width / 2, 390);
    
    // Restart
    const blink = Math.sin(Date.now() / 400) > 0;
    if (blink) {
        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText('Leertaste für Neustart', canvas.width / 2, 480);
    }
}

let gpStartLast = false;

function pollGamepadMenu() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of gamepads) {
        if (!gp) continue;
        const startPressed = (gp.buttons[0] && gp.buttons[0].pressed) || (gp.buttons[9] && gp.buttons[9].pressed);
        if (startPressed && !gpStartLast) {
            if (gameState === 'start' || gameState === 'gameover') {
                startGame();
            }
        }
        gpStartLast = startPressed;
        break;
    }
}

function gameLoop(timestamp) {
    if (lastTime === 0) lastTime = timestamp;
    const elapsed = timestamp - lastTime;
    lastTime = timestamp;
    const dt = Math.min(elapsed / (1000 / TARGET_FPS), 3);

    // Gamepad-Check auch im Menü/GameOver
    if (gameState === 'start' || gameState === 'gameover') {
        pollGamepadMenu();
    }

    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
}

// Start
requestAnimationFrame(gameLoop);
