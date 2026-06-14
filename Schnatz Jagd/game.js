const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const TARGET_FPS = 60;
let lastTime = 0;

// Game states: 'start', 'playing', 'gameover'
let gameState = 'start';
let score = 0;
let highScore = 0;
let difficulty = 1;
let gameTime = 0;

// Player (Besen-Flieger)
const player = {
    x: 100,
    y: 300,
    width: 80,
    height: 40,
    speed: 5,
    vx: 0,
    vy: 0
};

// Golden Snitch (Goldener Ball)
const snitch = {
    x: 400,
    y: 300,
    radius: 7,
    speed: 3,
    vx: 2,
    vy: 1.5,
    wingAngle: 0,
    changeTimer: 0,
    changeInterval: 60 // frames at 60fps equivalent
};

// Bludgers (Klatscher - rote Bälle)
let bludgers = [];
let bludgerSpawnTimer = 0;
let bludgerSpawnInterval = 50; // dt-units (faster spawning)

// Rings (Hindernisse - Ringe die sich bewegen)
let rings = [];
let ringSpawnTimer = 0;
let ringSpawnInterval = 120;

// Particles for effects
let particles = [];

// Stars background
const stars = [];
for (let i = 0; i < 80; i++) {
    stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2 + 0.5,
        twinkle: Math.random() * Math.PI * 2
    });
}

// Input handling
const keys = {};
let gamepadConnected = false;

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

// --- GAMEPAD SUPPORT ---
function pollGamepad() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < gamepads.length; i++) {
        const gp = gamepads[i];
        if (!gp) continue;
        gamepadConnected = true;

        const DEADZONE = 0.15;

        // Left stick
        const lx = Math.abs(gp.axes[0]) > DEADZONE ? gp.axes[0] : 0;
        const ly = Math.abs(gp.axes[1]) > DEADZONE ? gp.axes[1] : 0;

        if (gameState === 'playing') {
            player.vx = lx * player.speed;
            player.vy = ly * player.speed;
        }

        // D-pad
        if (gp.buttons[12] && gp.buttons[12].pressed) player.vy = -player.speed; // Up
        if (gp.buttons[13] && gp.buttons[13].pressed) player.vy = player.speed;  // Down
        if (gp.buttons[14] && gp.buttons[14].pressed) player.vx = -player.speed; // Left
        if (gp.buttons[15] && gp.buttons[15].pressed) player.vx = player.speed;  // Right

        // A or Start to begin/restart
        if ((gp.buttons[0] && gp.buttons[0].pressed) || (gp.buttons[9] && gp.buttons[9].pressed)) {
            if (gameState === 'start' || gameState === 'gameover') {
                startGame();
            }
        }

        break; // Use first connected gamepad
    }
}

// --- GAME FUNCTIONS ---

function startGame() {
    score = 0;
    difficulty = 1;
    gameTime = 0;
    player.x = 100;
    player.y = canvas.height / 2;
    player.vx = 0;
    player.vy = 0;
    snitch.x = canvas.width * 0.7;
    snitch.y = canvas.height / 2;
    snitch.vx = 2;
    snitch.vy = 1.5;
    snitch.changeTimer = 0;
    bludgers = [];
    bludgerSpawnTimer = 0;
    bludgerSpawnInterval = 50;
    rings = [];
    ringSpawnTimer = 0;
    ringSpawnInterval = 120;
    particles = [];
    gameState = 'playing';
    lastTime = 0;
}

function spawnBludger() {
    const side = Math.random() < 0.5 ? 'left' : 'right';
    const bludger = {
        x: side === 'left' ? -20 : canvas.width + 20,
        y: Math.random() * (canvas.height - 60) + 30,
        radius: 14 + Math.random() * 4,
        speed: (2 + Math.random() * 1.5 + difficulty * 0.3),
        vx: 0,
        vy: 0,
        angle: 0
    };

    // Aim roughly at player
    const dx = player.x - bludger.x;
    const dy = player.y - bludger.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    bludger.vx = (dx / dist) * bludger.speed;
    bludger.vy = (dy / dist) * bludger.speed;
    // Add some randomness
    bludger.vx += (Math.random() - 0.5) * 1.5;
    bludger.vy += (Math.random() - 0.5) * 1.5;

    bludgers.push(bludger);
}

function spawnRing() {
    const side = Math.floor(Math.random() * 4); // 0=top, 1=right, 2=bottom, 3=left
    const ring = {
        x: 0, y: 0,
        width: 16, height: 40,
        vx: 0, vy: 0,
        angle: 0,
        rotSpeed: (Math.random() - 0.5) * 0.08,
        color: Math.random() < 0.5 ? '#ff6600' : '#cc00cc'
    };

    const speed = 1.5 + Math.random() + difficulty * 0.2;

    if (side === 0) { // from top
        ring.x = Math.random() * canvas.width;
        ring.y = -40;
        ring.vx = (Math.random() - 0.5) * 1.5;
        ring.vy = speed;
    } else if (side === 1) { // from right
        ring.x = canvas.width + 40;
        ring.y = Math.random() * canvas.height;
        ring.vx = -speed;
        ring.vy = (Math.random() - 0.5) * 1.5;
    } else if (side === 2) { // from bottom
        ring.x = Math.random() * canvas.width;
        ring.y = canvas.height + 40;
        ring.vx = (Math.random() - 0.5) * 1.5;
        ring.vy = -speed;
    } else { // from left
        ring.x = -40;
        ring.y = Math.random() * canvas.height;
        ring.vx = speed;
        ring.vy = (Math.random() - 0.5) * 1.5;
    }

    rings.push(ring);
}

function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            life: 30 + Math.random() * 20,
            maxLife: 50,
            color: color,
            size: 2 + Math.random() * 3
        });
    }
}

function circleRect(cx, cy, cr, rx, ry, rw, rh) {
    const nearestX = Math.max(rx, Math.min(cx, rx + rw));
    const nearestY = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - nearestX;
    const dy = cy - nearestY;
    return (dx * dx + dy * dy) < (cr * cr);
}

function update(dt) {
    if (gameState !== 'playing') return;

    gameTime += dt;

    // Increase difficulty over time
    difficulty = 1 + Math.floor(gameTime / 300); // every ~5 seconds at 60fps

    // --- Player movement (keyboard) ---
    if (!gamepadConnected || (!keys['ArrowLeft'] && !keys['ArrowRight'] && !keys['ArrowUp'] && !keys['ArrowDown'] &&
        !keys['KeyW'] && !keys['KeyA'] && !keys['KeyS'] && !keys['KeyD'])) {
        // Only reset if no gamepad input was applied this frame
        if (!gamepadConnected) {
            player.vx = 0;
            player.vy = 0;
        }
    }

    if (keys['ArrowLeft'] || keys['KeyA']) player.vx = -player.speed;
    if (keys['ArrowRight'] || keys['KeyD']) player.vx = player.speed;
    if (keys['ArrowUp'] || keys['KeyW']) player.vy = -player.speed;
    if (keys['ArrowDown'] || keys['KeyS']) player.vy = player.speed;

    player.x += player.vx * dt;
    player.y += player.vy * dt;

    // Keep player in bounds
    player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));
    player.y = Math.max(0, Math.min(canvas.height - player.height, player.y));

    // --- Snitch movement ---
    snitch.changeTimer += dt;
    if (snitch.changeTimer >= snitch.changeInterval) {
        snitch.changeTimer = 0;
        snitch.changeInterval = 30 + Math.random() * 60;
        // Random direction change
        const angle = Math.random() * Math.PI * 2;
        const speed = snitch.speed + difficulty * 0.3;
        snitch.vx = Math.cos(angle) * speed;
        snitch.vy = Math.sin(angle) * speed;
    }

    // Snitch tries to flee from player when close
    const dxS = snitch.x - (player.x + player.width / 2);
    const dyS = snitch.y - (player.y + player.height / 2);
    const distS = Math.sqrt(dxS * dxS + dyS * dyS);
    if (distS < 120) {
        snitch.vx += (dxS / distS) * 0.3 * dt;
        snitch.vy += (dyS / distS) * 0.3 * dt;
    }

    snitch.x += snitch.vx * dt;
    snitch.y += snitch.vy * dt;

    // Bounce snitch off walls
    if (snitch.x < snitch.radius || snitch.x > canvas.width - snitch.radius) {
        snitch.vx *= -1;
        snitch.x = Math.max(snitch.radius, Math.min(canvas.width - snitch.radius, snitch.x));
    }
    if (snitch.y < snitch.radius || snitch.y > canvas.height - snitch.radius) {
        snitch.vy *= -1;
        snitch.y = Math.max(snitch.radius, Math.min(canvas.height - snitch.radius, snitch.y));
    }

    // Wing animation
    snitch.wingAngle += 0.3 * dt;

    // --- Check player catches snitch ---
    if (circleRect(snitch.x, snitch.y, snitch.radius, player.x, player.y, player.width, player.height)) {
        score += 10;
        spawnParticles(snitch.x, snitch.y, '#ffd700', 15);
        // Respawn snitch far from player
        do {
            snitch.x = 50 + Math.random() * (canvas.width - 100);
            snitch.y = 50 + Math.random() * (canvas.height - 100);
        } while (Math.abs(snitch.x - player.x) < 150 && Math.abs(snitch.y - player.y) < 150);
        snitch.speed = 3 + difficulty * 0.4;
        // Make bludgers spawn faster
        bludgerSpawnInterval = Math.max(20, 50 - difficulty * 4);
    }

    // --- Bludger spawning ---
    bludgerSpawnTimer += dt;
    if (bludgerSpawnTimer >= bludgerSpawnInterval) {
        bludgerSpawnTimer = 0;
        spawnBludger();
        // Spawn extra bludger at higher difficulty
        if (difficulty >= 3) spawnBludger();
    }

    // --- Ring obstacle spawning ---
    ringSpawnTimer += dt;
    if (ringSpawnTimer >= ringSpawnInterval) {
        ringSpawnTimer = 0;
        spawnRing();
        ringSpawnInterval = Math.max(60, 120 - difficulty * 8);
    }

    // --- Ring movement ---
    for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.x += r.vx * dt;
        r.y += r.vy * dt;
        r.angle += r.rotSpeed * dt;

        // Remove if out of bounds
        if (r.x < -80 || r.x > canvas.width + 80 || r.y < -80 || r.y > canvas.height + 80) {
            rings.splice(i, 1);
            continue;
        }

        // Collision with player (simplified rectangle)
        const rx = r.x - r.width / 2;
        const ry = r.y - r.height / 2;
        if (player.x + player.width > rx && player.x < rx + r.width &&
            player.y + player.height > ry && player.y < ry + r.height) {
            spawnParticles(player.x + player.width / 2, player.y + player.height / 2, '#ff4444', 20);
            gameOver();
            return;
        }
    }

    // --- Bludger movement ---
    for (let i = bludgers.length - 1; i >= 0; i--) {
        const b = bludgers[i];
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.angle += 0.05 * dt;

        // Remove if out of bounds
        if (b.x < -50 || b.x > canvas.width + 50 || b.y < -50 || b.y > canvas.height + 50) {
            bludgers.splice(i, 1);
            continue;
        }

        // Check collision with player
        if (circleRect(b.x, b.y, b.radius, player.x, player.y, player.width, player.height)) {
            spawnParticles(player.x + player.width / 2, player.y + player.height / 2, '#ff4444', 20);
            gameOver();
            return;
        }
    }

    // --- Particles ---
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        p.vx *= Math.pow(0.95, dt);
        p.vy *= Math.pow(0.95, dt);
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

function gameOver() {
    gameState = 'gameover';
    if (score > highScore) highScore = score;
}

// --- DRAWING ---

function drawStars() {
    for (const star of stars) {
        star.twinkle += 0.02;
        const alpha = 0.4 + Math.sin(star.twinkle) * 0.3;
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawPlayer() {
    const px = player.x;
    const py = player.y;
    const pw = player.width;
    const ph = player.height;
    const centerX = px + pw / 2;
    const centerY = py + ph / 2;

    // Trail effect
    ctx.fillStyle = 'rgba(74, 0, 128, 0.2)';
    ctx.beginPath();
    ctx.ellipse(px - 5, centerY + 5, 18, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Broom stick
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(px + 10, centerY + 8);
    ctx.lineTo(px + pw + 5, centerY + 8);
    ctx.stroke();

    // Broom bristles (at the back)
    ctx.strokeStyle = '#DAA520';
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 7; i++) {
        ctx.beginPath();
        ctx.moveTo(px + pw, centerY + 8);
        ctx.lineTo(px + pw + 15, centerY + 8 - 10 + i * 3.3);
        ctx.stroke();
    }

    // Legs (straddling broom)
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    // Left leg
    ctx.beginPath();
    ctx.moveTo(centerX - 5, centerY + 2);
    ctx.lineTo(centerX - 10, centerY + 14);
    ctx.stroke();
    // Right leg
    ctx.beginPath();
    ctx.moveTo(centerX + 5, centerY + 2);
    ctx.lineTo(centerX + 10, centerY + 14);
    ctx.stroke();
    // Shoes
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(centerX - 10, centerY + 15, 3, 0, Math.PI * 2);
    ctx.arc(centerX + 10, centerY + 15, 3, 0, Math.PI * 2);
    ctx.fill();

    // Body / Robe
    ctx.fillStyle = '#4a0080';
    ctx.beginPath();
    ctx.moveTo(centerX - 10, centerY - 5);
    ctx.lineTo(centerX + 10, centerY - 5);
    ctx.lineTo(centerX + 12, centerY + 8);
    ctx.lineTo(centerX - 12, centerY + 8);
    ctx.closePath();
    ctx.fill();

    // Robe cape flowing back
    ctx.fillStyle = '#3a0066';
    ctx.beginPath();
    ctx.moveTo(centerX - 6, centerY - 5);
    ctx.quadraticCurveTo(centerX - 20, centerY, centerX - 15, centerY + 12);
    ctx.lineTo(centerX - 8, centerY + 5);
    ctx.closePath();
    ctx.fill();

    // Arms (holding broom)
    ctx.strokeStyle = '#ffcc99';
    ctx.lineWidth = 3;
    // Left arm
    ctx.beginPath();
    ctx.moveTo(centerX - 6, centerY - 2);
    ctx.lineTo(centerX - 12, centerY + 6);
    ctx.stroke();
    // Right arm
    ctx.beginPath();
    ctx.moveTo(centerX + 6, centerY - 2);
    ctx.lineTo(centerX + 12, centerY + 6);
    ctx.stroke();

    // Head
    ctx.fillStyle = '#ffcc99';
    ctx.beginPath();
    ctx.arc(centerX, centerY - 14, 9, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = '#5c3317';
    ctx.beginPath();
    ctx.arc(centerX, centerY - 17, 9, Math.PI, 2 * Math.PI);
    ctx.fill();
    // Hair flowing back
    ctx.beginPath();
    ctx.moveTo(centerX - 7, centerY - 14);
    ctx.quadraticCurveTo(centerX - 18, centerY - 10, centerX - 15, centerY - 3);
    ctx.lineTo(centerX - 9, centerY - 8);
    ctx.closePath();
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(centerX - 3, centerY - 14, 1.5, 0, Math.PI * 2);
    ctx.arc(centerX + 3, centerY - 14, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Scarf (Wizard-look)
    ctx.fillStyle = '#cc0000';
    ctx.fillRect(centerX - 5, centerY - 7, 10, 3);
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(centerX - 5, centerY - 6, 10, 1);
}

function drawSnitch() {
    // Glow
    const gradient = ctx.createRadialGradient(snitch.x, snitch.y, 0, snitch.x, snitch.y, snitch.radius * 3);
    gradient.addColorStop(0, 'rgba(255, 215, 0, 0.5)');
    gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(snitch.x, snitch.y, snitch.radius * 3, 0, Math.PI * 2);
    ctx.fill();

    // Ball
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(snitch.x, snitch.y, snitch.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Wings
    const wingSpread = Math.sin(snitch.wingAngle) * 5;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';

    // Left wing
    ctx.beginPath();
    ctx.ellipse(snitch.x - snitch.radius - 4, snitch.y + wingSpread, 7, 3, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Right wing
    ctx.beginPath();
    ctx.ellipse(snitch.x + snitch.radius + 4, snitch.y - wingSpread, 7, 3, 0.3, 0, Math.PI * 2);
    ctx.fill();
}

function drawBludgers() {
    for (const b of bludgers) {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.angle);

        // Dark ball
        ctx.fillStyle = '#2a2a2a';
        ctx.beginPath();
        ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
        ctx.fill();

        // Red glow
        ctx.strokeStyle = '#cc0000';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Cross mark
        ctx.strokeStyle = '#ff3333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-b.radius * 0.4, -b.radius * 0.4);
        ctx.lineTo(b.radius * 0.4, b.radius * 0.4);
        ctx.moveTo(b.radius * 0.4, -b.radius * 0.4);
        ctx.lineTo(-b.radius * 0.4, b.radius * 0.4);
        ctx.stroke();

        ctx.restore();
    }
}

function drawRings() {
    for (const r of rings) {
        ctx.save();
        ctx.translate(r.x, r.y);
        ctx.rotate(r.angle);

        // Ring post
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, r.height / 2);
        ctx.lineTo(0, -r.height / 2 + 10);
        ctx.stroke();

        // Ring hoop
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(0, -r.height / 2 + 5, 14, 10, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Glow
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.ellipse(0, -r.height / 2 + 5, 18, 14, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;

        ctx.restore();
    }
}

function drawParticles() {
    for (const p of particles) {
        const alpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function drawHUD() {
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('⚡ ' + score, 15, 30);

    ctx.fillStyle = '#aaa';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Level: ' + difficulty, canvas.width - 15, 25);
}

function drawStartScreen() {
    // Dark overlay
    ctx.fillStyle = 'rgba(10, 10, 42, 0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Title
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🧹 Schnatz Jagd', canvas.width / 2, canvas.height / 2 - 80);

    // Subtitle
    ctx.fillStyle = '#bb99ff';
    ctx.font = '20px sans-serif';
    ctx.fillText('Fange den goldenen Ball!', canvas.width / 2, canvas.height / 2 - 35);

    // Controls
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px sans-serif';
    ctx.fillText('🎮 Pfeiltasten / WASD: Besen steuern', canvas.width / 2, canvas.height / 2 + 20);
    ctx.fillText('⚡ Fange den goldenen Ball für Punkte', canvas.width / 2, canvas.height / 2 + 50);
    ctx.fillText('💀 Weiche den roten Klatschern aus!', canvas.width / 2, canvas.height / 2 + 80);

    // Start prompt
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 18px sans-serif';
    const blink = Math.sin(Date.now() / 500) > 0;
    if (blink) {
        ctx.fillText('[ Leertaste / Enter / 🎮 A zum Starten ]', canvas.width / 2, canvas.height / 2 + 140);
    }

    if (gamepadConnected) {
        ctx.fillStyle = '#66ff66';
        ctx.font = '14px sans-serif';
        ctx.fillText('🎮 Gamepad verbunden!', canvas.width / 2, canvas.height / 2 + 175);
    }
}

function drawGameOverScreen() {
    // Dark overlay
    ctx.fillStyle = 'rgba(10, 10, 42, 0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('💥 Getroffen!', canvas.width / 2, canvas.height / 2 - 60);

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('Punkte: ' + score, canvas.width / 2, canvas.height / 2);

    if (score >= highScore && highScore > 0) {
        ctx.fillStyle = '#66ff66';
        ctx.font = '18px sans-serif';
        ctx.fillText('🏆 Neuer Highscore!', canvas.width / 2, canvas.height / 2 + 35);
    }

    ctx.fillStyle = '#aaa';
    ctx.font = '16px sans-serif';
    ctx.fillText('Bester Score: ' + highScore, canvas.width / 2, canvas.height / 2 + 65);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px sans-serif';
    const blink = Math.sin(Date.now() / 500) > 0;
    if (blink) {
        ctx.fillText('[ Leertaste / Enter / 🎮 A für Neustart ]', canvas.width / 2, canvas.height / 2 + 115);
    }
}

function draw() {
    // Background gradient (night sky)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGrad.addColorStop(0, '#0a0a2a');
    bgGrad.addColorStop(1, '#1a1a4a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawStars();

    if (gameState === 'start') {
        drawSnitch();
        drawStartScreen();
        return;
    }

    // Draw game objects
    drawRings();
    drawBludgers();
    drawSnitch();
    drawPlayer();
    drawParticles();
    drawHUD();

    if (gameState === 'gameover') {
        drawGameOverScreen();
    }
}

// --- GAME LOOP ---

function gameLoop(timestamp) {
    if (lastTime === 0) lastTime = timestamp;
    const elapsed = timestamp - lastTime;
    lastTime = timestamp;
    const dt = Math.min(elapsed / (1000 / TARGET_FPS), 3);

    pollGamepad();
    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
}

// Start the loop
requestAnimationFrame(gameLoop);
