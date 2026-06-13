const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// === CONSTANTS ===
const TARGET_FPS = 60;
const GRAVITY = 0.8;
const JUMP_FORCE = -14;
const MOVE_SPEED = 5;
const GROUND_Y = canvas.height - 60;
const PLATFORM_SPEED_BASE = 3;
const COIN_SIZE = 16;
const SPIKE_WIDTH = 30;
const SPIKE_HEIGHT = 25;
const GAMEPAD_DEADZONE = 0.15;

// === GAME STATE ===
let lastTime = 0;
let gameState = 'start'; // 'start', 'playing', 'gameover'
let score = 0;
let highScore = 0;
let distance = 0;
let difficulty = 1;
let screenShake = 0;

// === PLAYER ===
let player = {
    x: 150,
    y: GROUND_Y - 40,
    width: 30,
    height: 40,
    vy: 0,
    grounded: false,
    jumping: false,
    runFrame: 0,
    runTimer: 0
};

// === INPUT ===
let keys = {};
let gamepadConnected = false;

// === WORLD ===
let platforms = [];
let coins = [];
let spikes = [];
let particles = [];
let stars = [];
let platformSpawnTimer = 0;
let coinSpawnTimer = 0;
let spikeSpawnTimer = 0;

// === INITIALIZATION ===
function initStars() {
    stars = [];
    for (let i = 0; i < 80; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * (canvas.height - 80),
            size: Math.random() * 2 + 0.5,
            twinkle: Math.random() * Math.PI * 2
        });
    }
}

function resetGame() {
    player.x = 150;
    player.y = GROUND_Y - player.height;
    player.vy = 0;
    player.grounded = true;
    player.jumping = false;
    player.runFrame = 0;
    player.runTimer = 0;

    platforms = [];
    coins = [];
    spikes = [];
    particles = [];
    score = 0;
    distance = 0;
    difficulty = 1;
    platformSpawnTimer = 0;
    coinSpawnTimer = 0;
    spikeSpawnTimer = 0;
    screenShake = 0;
    lastTime = 0;

    // Initial platforms
    platforms.push({ x: 350, y: GROUND_Y - 100, width: 120, height: 16 });
    platforms.push({ x: 550, y: GROUND_Y - 170, width: 100, height: 16 });
    platforms.push({ x: 750, y: GROUND_Y - 120, width: 110, height: 16 });
}

function startGame() {
    resetGame();
    gameState = 'playing';
}

// === PARTICLES ===
function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 1) * 4,
            life: 1.0,
            color: color,
            size: Math.random() * 4 + 2
        });
    }
}

// === GAMEPAD ===
function getGamepadInput() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < gamepads.length; i++) {
        const gp = gamepads[i];
        if (!gp) continue;
        gamepadConnected = true;

        const leftX = Math.abs(gp.axes[0]) > GAMEPAD_DEADZONE ? gp.axes[0] : 0;
        const btnA = gp.buttons[0] && gp.buttons[0].pressed;
        const btnStart = gp.buttons[9] && gp.buttons[9].pressed;
        const dpadLeft = gp.buttons[14] && gp.buttons[14].pressed;
        const dpadRight = gp.buttons[15] && gp.buttons[15].pressed;

        return { leftX, btnA, btnStart, dpadLeft, dpadRight };
    }
    return null;
}

// === UPDATE ===
function update(dt) {
    if (gameState !== 'playing') return;

    distance += dt;
    difficulty = 1 + Math.floor(distance / 300) * 0.3;

    // Gamepad input
    const gp = getGamepadInput();
    let moveLeft = keys['ArrowLeft'] || keys['KeyA'];
    let moveRight = keys['ArrowRight'] || keys['KeyD'];
    let jumpPressed = keys['Space'] || keys['ArrowUp'] || keys['KeyW'];

    if (gp) {
        if (gp.leftX < -GAMEPAD_DEADZONE || gp.dpadLeft) moveLeft = true;
        if (gp.leftX > GAMEPAD_DEADZONE || gp.dpadRight) moveRight = true;
        if (gp.btnA) jumpPressed = true;
    }

    // Player movement
    if (moveLeft) {
        player.x -= MOVE_SPEED * dt;
    }
    if (moveRight) {
        player.x += MOVE_SPEED * dt;
    }

    // Jump
    if (jumpPressed && player.grounded && !player.jumping) {
        player.vy = JUMP_FORCE;
        player.grounded = false;
        player.jumping = true;
        spawnParticles(player.x + player.width / 2, player.y + player.height, '#aaa', 5);
    }
    if (!jumpPressed) {
        player.jumping = false;
    }

    // Gravity
    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;

    // Ground collision
    player.grounded = false;
    if (player.y + player.height >= GROUND_Y) {
        player.y = GROUND_Y - player.height;
        player.vy = 0;
        player.grounded = true;
    }

    // Platform collision
    for (let p of platforms) {
        if (player.vy > 0 &&
            player.x + player.width > p.x &&
            player.x < p.x + p.width &&
            player.y + player.height >= p.y &&
            player.y + player.height <= p.y + p.height + player.vy * dt + 5) {
            player.y = p.y - player.height;
            player.vy = 0;
            player.grounded = true;
        }
    }

    // Keep player on screen
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;

    // Animation
    if (player.grounded && (moveLeft || moveRight)) {
        player.runTimer += dt;
        if (player.runTimer > 5) {
            player.runTimer = 0;
            player.runFrame = (player.runFrame + 1) % 4;
        }
    } else if (player.grounded) {
        player.runFrame = 0;
    }

    // Move world
    const scrollSpeed = PLATFORM_SPEED_BASE * difficulty;

    // Platforms
    platformSpawnTimer += dt;
    if (platformSpawnTimer > 40 / difficulty) {
        platformSpawnTimer = 0;
        const py = GROUND_Y - 80 - Math.random() * 150;
        const pw = 80 + Math.random() * 80;
        platforms.push({ x: canvas.width + 20, y: py, width: pw, height: 16 });
    }

    for (let i = platforms.length - 1; i >= 0; i--) {
        platforms[i].x -= scrollSpeed * dt;
        if (platforms[i].x + platforms[i].width < -20) {
            platforms.splice(i, 1);
        }
    }

    // Coins
    coinSpawnTimer += dt;
    if (coinSpawnTimer > 30 / difficulty) {
        coinSpawnTimer = 0;
        const cy = GROUND_Y - 60 - Math.random() * 200;
        coins.push({ x: canvas.width + 20, y: cy, angle: 0 });
    }

    for (let i = coins.length - 1; i >= 0; i--) {
        coins[i].x -= scrollSpeed * dt;
        coins[i].angle += 0.1 * dt;

        // Collect
        const dx = (player.x + player.width / 2) - coins[i].x;
        const dy = (player.y + player.height / 2) - coins[i].y;
        if (Math.sqrt(dx * dx + dy * dy) < 28) {
            score += 10;
            spawnParticles(coins[i].x, coins[i].y, '#ffd700', 8);
            coins.splice(i, 1);
            continue;
        }

        if (coins[i].x < -20) {
            coins.splice(i, 1);
        }
    }

    // Spikes
    spikeSpawnTimer += dt;
    if (spikeSpawnTimer > 60 / difficulty) {
        spikeSpawnTimer = 0;
        spikes.push({ x: canvas.width + 20, y: GROUND_Y - SPIKE_HEIGHT });
    }

    for (let i = spikes.length - 1; i >= 0; i--) {
        spikes[i].x -= scrollSpeed * dt;

        // Collision
        if (player.x + player.width - 5 > spikes[i].x + 5 &&
            player.x + 5 < spikes[i].x + SPIKE_WIDTH - 5 &&
            player.y + player.height > spikes[i].y + 8) {
            triggerGameOver();
            return;
        }

        if (spikes[i].x < -40) {
            spikes.splice(i, 1);
        }
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].x += particles[i].vx * dt;
        particles[i].y += particles[i].vy * dt;
        particles[i].vy += 0.2 * dt;
        particles[i].life -= 0.03 * dt;
        if (particles[i].life <= 0) {
            particles.splice(i, 1);
        }
    }

    // Screen shake
    if (screenShake > 0) {
        screenShake -= dt;
    }

    // Score from distance
    score += 0.05 * dt * difficulty;
}

function triggerGameOver() {
    gameState = 'gameover';
    if (Math.floor(score) > highScore) {
        highScore = Math.floor(score);
    }
    screenShake = 10;
    spawnParticles(player.x + player.width / 2, player.y + player.height / 2, '#ff4444', 15);
}

// === DRAW ===
function draw() {
    ctx.save();

    // Screen shake
    if (screenShake > 0) {
        const shakeX = (Math.random() - 0.5) * screenShake * 0.5;
        const shakeY = (Math.random() - 0.5) * screenShake * 0.5;
        ctx.translate(shakeX, shakeY);
    }

    // Background
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#0f0f23');
    grad.addColorStop(1, '#1a1a3e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Stars
    for (let star of stars) {
        star.twinkle += 0.02;
        const alpha = 0.4 + Math.sin(star.twinkle) * 0.3;
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fillRect(star.x, star.y, star.size, star.size);
    }

    if (gameState === 'start') {
        drawStartScreen();
        ctx.restore();
        return;
    }

    // Ground
    ctx.fillStyle = '#2d5a27';
    ctx.fillRect(0, GROUND_Y, canvas.width, canvas.height - GROUND_Y);
    ctx.fillStyle = '#4a8c3f';
    ctx.fillRect(0, GROUND_Y, canvas.width, 4);

    // Ground detail
    ctx.fillStyle = '#1e4019';
    for (let i = 0; i < canvas.width; i += 30) {
        ctx.fillRect(i, GROUND_Y + 10, 2, 20);
    }

    // Platforms
    for (let p of platforms) {
        ctx.fillStyle = '#5b3a8c';
        ctx.fillRect(p.x, p.y, p.width, p.height);
        ctx.fillStyle = '#7b5aac';
        ctx.fillRect(p.x, p.y, p.width, 4);
        // Platform underside
        ctx.fillStyle = '#3a2060';
        ctx.fillRect(p.x + 4, p.y + p.height, p.width - 8, 4);
    }

    // Coins
    for (let c of coins) {
        ctx.save();
        ctx.translate(c.x, c.y);
        const scaleX = Math.cos(c.angle);
        ctx.scale(scaleX, 1);
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(0, 0, COIN_SIZE / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffaa00';
        ctx.beginPath();
        ctx.arc(0, 0, COIN_SIZE / 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Spikes
    for (let s of spikes) {
        ctx.fillStyle = '#ff3333';
        ctx.beginPath();
        ctx.moveTo(s.x, s.y + SPIKE_HEIGHT);
        ctx.lineTo(s.x + SPIKE_WIDTH / 4, s.y);
        ctx.lineTo(s.x + SPIKE_WIDTH / 2, s.y + SPIKE_HEIGHT);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(s.x + SPIKE_WIDTH / 4, s.y + SPIKE_HEIGHT);
        ctx.lineTo(s.x + SPIKE_WIDTH / 2, s.y - 2);
        ctx.lineTo(s.x + SPIKE_WIDTH * 3 / 4, s.y + SPIKE_HEIGHT);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(s.x + SPIKE_WIDTH / 2, s.y + SPIKE_HEIGHT);
        ctx.lineTo(s.x + SPIKE_WIDTH * 3 / 4, s.y);
        ctx.lineTo(s.x + SPIKE_WIDTH, s.y + SPIKE_HEIGHT);
        ctx.fill();
        // Highlight
        ctx.fillStyle = '#ff6666';
        ctx.beginPath();
        ctx.moveTo(s.x + SPIKE_WIDTH / 4, s.y + 4);
        ctx.lineTo(s.x + SPIKE_WIDTH / 4 + 3, s.y + 12);
        ctx.lineTo(s.x + SPIKE_WIDTH / 4 - 2, s.y + 10);
        ctx.fill();
    }

    // Player
    drawPlayer();

    // Particles
    for (let p of particles) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // HUD
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Score: ' + Math.floor(score), 15, 30);
    ctx.fillStyle = '#ffd700';
    ctx.font = '14px sans-serif';
    ctx.fillText('Highscore: ' + highScore, 15, 52);

    // Game Over overlay
    if (gameState === 'gameover') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#ff4444';
        ctx.font = 'bold 42px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Game Over!', canvas.width / 2, canvas.height / 2 - 40);

        ctx.fillStyle = '#fff';
        ctx.font = '22px sans-serif';
        ctx.fillText('Score: ' + Math.floor(score), canvas.width / 2, canvas.height / 2 + 10);

        ctx.fillStyle = '#aaa';
        ctx.font = '16px sans-serif';
        ctx.fillText('Leertaste / A-Taste zum Neustarten', canvas.width / 2, canvas.height / 2 + 50);
    }

    ctx.restore();
}

function drawPlayer() {
    const px = player.x;
    const py = player.y;
    const pw = player.width;
    const ph = player.height;

    // Body
    ctx.fillStyle = '#44aaff';
    ctx.fillRect(px + 4, py + 10, pw - 8, ph - 20);

    // Head
    ctx.fillStyle = '#ffcc88';
    ctx.fillRect(px + 6, py, pw - 12, 14);

    // Eyes
    ctx.fillStyle = '#222';
    ctx.fillRect(px + 18, py + 4, 4, 4);

    // Legs animation
    ctx.fillStyle = '#2266aa';
    if (!player.grounded) {
        // Jumping pose
        ctx.fillRect(px + 6, py + ph - 12, 7, 12);
        ctx.fillRect(px + pw - 13, py + ph - 12, 7, 12);
    } else {
        const legOffset = Math.sin(player.runFrame * Math.PI / 2) * 4;
        ctx.fillRect(px + 6, py + ph - 10 + legOffset, 7, 10 - legOffset);
        ctx.fillRect(px + pw - 13, py + ph - 10 - legOffset, 7, 10 + legOffset);
    }

    // Arm
    ctx.fillStyle = '#3399dd';
    if (!player.grounded) {
        ctx.fillRect(px, py + 14, 5, 12);
    } else {
        const armOffset = Math.sin(player.runFrame * Math.PI / 2) * 3;
        ctx.fillRect(px, py + 14 + armOffset, 5, 10);
    }
}

function drawStartScreen() {
    ctx.fillStyle = '#44aaff';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Joy Jump', canvas.width / 2, canvas.height / 2 - 80);

    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.fillText('Spring über Hindernisse und sammle Münzen!', canvas.width / 2, canvas.height / 2 - 30);

    ctx.fillStyle = '#aaa';
    ctx.font = '16px sans-serif';
    ctx.fillText('← → / A D  =  Bewegen', canvas.width / 2, canvas.height / 2 + 20);
    ctx.fillText('Leertaste / ↑ / W  =  Springen', canvas.width / 2, canvas.height / 2 + 48);
    ctx.fillText('Gamepad: Stick/D-Pad + A-Taste', canvas.width / 2, canvas.height / 2 + 76);

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('Leertaste zum Starten', canvas.width / 2, canvas.height / 2 + 130);
}

// === GAME LOOP ===
function gameLoop(timestamp) {
    if (lastTime === 0) lastTime = timestamp;
    const elapsed = timestamp - lastTime;
    lastTime = timestamp;
    const dt = Math.min(elapsed / (1000 / TARGET_FPS), 3);

    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
}

// === INPUT HANDLING ===
document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') return; // Reserved for launcher
    keys[e.code] = true;

    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        if (gameState === 'start') startGame();
        if (gameState === 'gameover') startGame();
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// Gamepad start/restart
function pollGamepadForMenu() {
    const gp = getGamepadInput();
    if (gp && gp.btnA) {
        if (gameState === 'start' || gameState === 'gameover') {
            startGame();
        }
    }
    if (gameState !== 'playing') {
        requestAnimationFrame(pollGamepadForMenu);
    }
}

window.addEventListener('gamepadconnected', () => {
    gamepadConnected = true;
    pollGamepadForMenu();
});

// === START ===
initStars();
requestAnimationFrame(gameLoop);
