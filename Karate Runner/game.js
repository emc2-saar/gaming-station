const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const TARGET_FPS = 60;
let lastTime = 0;

// Game states: 'start', 'playing', 'gameover'
let gameState = 'start';
let score = 0;
let highScore = 0;
let distance = 0;
let difficulty = 1;

// Player
const player = {
    x: 120,
    y: 0,
    width: 40,
    height: 70,
    vy: 0,
    grounded: true,
    ducking: false,
    kicking: false,
    kickTimer: 0,
    jumpCount: 0,
    maxJumps: 2,
    animFrame: 0,
    animTimer: 0,
    runFrame: 0
};

// Physics
const GRAVITY = 0.8;
const JUMP_FORCE = -14;
const GROUND_Y = 350;

// Game objects
let obstacles = [];
let particles = [];
let bgElements = [];
let spawnAccumulator = 0;
let baseSpawnInterval = 90; // frames at 60fps equivalent

// Scrolling
let scrollSpeed = 5;
let bgOffset = 0;

// Input
const keys = {};
let gamepadConnected = false;

// Colors - Toca Boca inspired (bright, playful) with Karate theme
const COLORS = {
    bg: '#2d1b4e',
    ground: '#4a2c17',
    groundTop: '#6b3e22',
    player: '#ff6b6b',
    playerBelt: '#222',
    playerHeadband: '#ff2222',
    obstacle: '#8b4513',
    breakable: '#d4a574',
    highObstacle: '#654321',
    dojo: '#3d2066',
    lantern: '#ffcc00',
    cherry: '#ff69b4',
    text: '#fff',
    accent: '#ff6b6b',
    kick: '#ffdd44'
};

// ========== INPUT HANDLING ==========

document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') return; // Don't use Escape
    keys[e.code] = true;
    e.preventDefault();

    if (gameState === 'start' && (e.code === 'Space' || e.code === 'Enter')) {
        startGame();
    } else if (gameState === 'gameover' && (e.code === 'Space' || e.code === 'Enter')) {
        startGame();
    } else if (gameState === 'playing') {
        if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
            jump();
        }
        if (e.code === 'ArrowDown' || e.code === 'KeyS') {
            player.ducking = true;
        }
        if (e.code === 'KeyX' || e.code === 'KeyJ' || e.code === 'Enter') {
            kick();
        }
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        player.ducking = false;
    }
});

// Touch controls
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    if (gameState === 'start' || gameState === 'gameover') {
        startGame();
        return;
    }

    if (gameState === 'playing') {
        if (y < canvas.height * 0.5) {
            jump();
        } else if (x > canvas.width * 0.6) {
            kick();
        } else {
            player.ducking = true;
        }
    }
});

canvas.addEventListener('touchend', (e) => {
    player.ducking = false;
});

// Gamepad polling
function pollGamepad() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < gamepads.length; i++) {
        const gp = gamepads[i];
        if (!gp) continue;
        gamepadConnected = true;

        const deadzone = 0.15;
        const leftStickY = Math.abs(gp.axes[1]) > deadzone ? gp.axes[1] : 0;

        if (gameState === 'start' || gameState === 'gameover') {
            if (gp.buttons[0].pressed || gp.buttons[3].pressed) {
                startGame();
            }
            return;
        }

        if (gameState === 'playing') {
            // A button or Up on DPad = Jump
            if (gp.buttons[0].pressed || gp.buttons[12].pressed || leftStickY < -0.5) {
                if (!gp._jumpHeld) {
                    jump();
                    gp._jumpHeld = true;
                }
            } else {
                gp._jumpHeld = false;
            }

            // Down on DPad or stick = Duck
            player.ducking = gp.buttons[13].pressed || leftStickY > 0.5;

            // X or B button = Kick
            if (gp.buttons[2].pressed || gp.buttons[1].pressed) {
                if (!gp._kickHeld) {
                    kick();
                    gp._kickHeld = true;
                }
            } else {
                gp._kickHeld = false;
            }
        }
    }
}

// ========== GAME ACTIONS ==========

function jump() {
    if (player.jumpCount < player.maxJumps) {
        player.vy = JUMP_FORCE;
        player.grounded = false;
        player.jumpCount++;
        // Jumping particles
        for (let i = 0; i < 5; i++) {
            particles.push({
                x: player.x + player.width / 2,
                y: GROUND_Y,
                vx: (Math.random() - 0.5) * 3,
                vy: -Math.random() * 3,
                life: 20,
                color: '#ffcc88'
            });
        }
    }
}

function kick() {
    if (!player.kicking) {
        player.kicking = true;
        player.kickTimer = 15;
        // Kick effect particles
        for (let i = 0; i < 3; i++) {
            particles.push({
                x: player.x + player.width + 10,
                y: player.y + player.height / 2,
                vx: 4 + Math.random() * 2,
                vy: (Math.random() - 0.5) * 2,
                life: 10,
                color: COLORS.kick
            });
        }
    }
}

function startGame() {
    gameState = 'playing';
    score = 0;
    distance = 0;
    difficulty = 1;
    scrollSpeed = 5;
    obstacles = [];
    particles = [];
    spawnAccumulator = 0;
    player.y = GROUND_Y - player.height;
    player.vy = 0;
    player.grounded = true;
    player.ducking = false;
    player.kicking = false;
    player.kickTimer = 0;
    player.jumpCount = 0;
    player.animFrame = 0;
    lastTime = 0;
    initBgElements();
}

function gameOver() {
    gameState = 'gameover';
    if (score > highScore) highScore = score;
    // Explosion particles
    for (let i = 0; i < 20; i++) {
        particles.push({
            x: player.x + player.width / 2,
            y: player.y + player.height / 2,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            life: 40,
            color: Math.random() > 0.5 ? COLORS.accent : COLORS.kick
        });
    }
}

// ========== BACKGROUND ==========

function initBgElements() {
    bgElements = [];
    for (let i = 0; i < 6; i++) {
        bgElements.push({
            type: Math.random() > 0.5 ? 'lantern' : 'torii',
            x: i * 200 + Math.random() * 100,
            y: 50 + Math.random() * 100
        });
    }
}

// ========== OBSTACLE SPAWNING ==========

function spawnObstacle() {
    const types = ['low', 'high', 'breakable'];
    // Weight types based on difficulty
    let type;
    const rand = Math.random();
    if (rand < 0.4) {
        type = 'low';
    } else if (rand < 0.7) {
        type = 'high';
    } else {
        type = 'breakable';
    }

    let obs = {
        x: canvas.width + 50,
        type: type,
        destroyed: false
    };

    if (type === 'low') {
        obs.y = GROUND_Y - 40;
        obs.width = 30 + Math.random() * 20;
        obs.height = 40;
    } else if (type === 'high') {
        obs.y = GROUND_Y - 100 - Math.random() * 30;
        obs.width = 60;
        obs.height = 20;
    } else if (type === 'breakable') {
        obs.y = GROUND_Y - 55;
        obs.width = 35;
        obs.height = 55;
        obs.health = 1;
    }

    obstacles.push(obs);
}

// ========== UPDATE ==========

function update(dt) {
    if (gameState !== 'playing') return;

    // Increase difficulty over time
    distance += scrollSpeed * dt;
    difficulty = 1 + Math.floor(distance / 500) * 0.2;
    scrollSpeed = 5 + difficulty * 0.8;

    // Score
    score = Math.floor(distance / 10);

    // Player physics
    if (!player.grounded) {
        player.vy += GRAVITY * dt;
        player.y += player.vy * dt;

        if (player.y >= GROUND_Y - player.height) {
            player.y = GROUND_Y - player.height;
            player.vy = 0;
            player.grounded = true;
            player.jumpCount = 0;
        }
    }

    // Ducking adjusts hitbox
    if (player.ducking && player.grounded) {
        player.height = 40;
        player.y = GROUND_Y - 40;
    } else if (!player.ducking) {
        if (player.height === 40 && player.grounded) {
            player.height = 70;
            player.y = GROUND_Y - 70;
        }
    }

    // Kick timer
    if (player.kicking) {
        player.kickTimer -= dt;
        if (player.kickTimer <= 0) {
            player.kicking = false;
        }
    }

    // Animation
    player.animTimer += dt;
    if (player.animTimer > 6) {
        player.animTimer = 0;
        player.runFrame = (player.runFrame + 1) % 4;
    }

    // Spawn obstacles
    spawnAccumulator += dt;
    const spawnInterval = baseSpawnInterval / difficulty;
    if (spawnAccumulator >= spawnInterval) {
        spawnAccumulator -= spawnInterval;
        spawnObstacle();
    }

    // Update obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        obs.x -= scrollSpeed * dt;

        // Remove offscreen
        if (obs.x + obs.width < -50) {
            obstacles.splice(i, 1);
            continue;
        }

        if (obs.destroyed) continue;

        // Kick collision
        if (player.kicking && obs.type === 'breakable') {
            const kickBox = {
                x: player.x + player.width,
                y: player.y + 10,
                width: 30,
                height: player.height - 20
            };
            if (rectsOverlap(kickBox, obs)) {
                obs.destroyed = true;
                score += 50;
                // Break particles
                for (let j = 0; j < 8; j++) {
                    particles.push({
                        x: obs.x + obs.width / 2,
                        y: obs.y + obs.height / 2,
                        vx: (Math.random() - 0.5) * 6,
                        vy: -Math.random() * 5 - 2,
                        life: 30,
                        color: COLORS.breakable
                    });
                }
                continue;
            }
        }

        // Player collision
        const playerBox = {
            x: player.x + 8,
            y: player.y + 5,
            width: player.width - 16,
            height: player.height - 10
        };
        if (rectsOverlap(playerBox, obs)) {
            gameOver();
            return;
        }
    }

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 0.2 * dt;
        p.life -= dt;
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }

    // Background scroll
    bgOffset -= scrollSpeed * 0.3 * dt;
    for (let i = 0; i < bgElements.length; i++) {
        bgElements[i].x -= scrollSpeed * 0.3 * dt;
        if (bgElements[i].x < -100) {
            bgElements[i].x = canvas.width + 50 + Math.random() * 100;
            bgElements[i].y = 50 + Math.random() * 100;
        }
    }
}

function rectsOverlap(a, b) {
    return a.x < b.x + b.width &&
           a.x + a.width > b.x &&
           a.y < b.y + b.height &&
           a.y + a.height > b.y;
}

// ========== DRAW ==========

function draw() {
    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#1a0a30');
    grad.addColorStop(0.6, COLORS.bg);
    grad.addColorStop(1, '#1a0a30');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (gameState === 'start') {
        drawStartScreen();
        return;
    }

    // Background elements
    drawBackground();

    // Ground
    ctx.fillStyle = COLORS.groundTop;
    ctx.fillRect(0, GROUND_Y, canvas.width, 4);
    ctx.fillStyle = COLORS.ground;
    ctx.fillRect(0, GROUND_Y + 4, canvas.width, canvas.height - GROUND_Y - 4);

    // Draw ground pattern (tatami-like)
    ctx.strokeStyle = '#5a3e27';
    ctx.lineWidth = 1;
    for (let x = (bgOffset * 2) % 60; x < canvas.width; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, GROUND_Y + 4);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }

    // Obstacles
    drawObstacles();

    // Player
    drawPlayer();

    // Particles
    drawParticles();

    // UI
    drawUI();

    if (gameState === 'gameover') {
        drawGameOver();
    }
}

function drawStartScreen() {
    // Title
    ctx.fillStyle = COLORS.accent;
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Karate Runner', canvas.width / 2, 140);

    // Karate character preview
    drawKaratePreview(canvas.width / 2 - 30, 180, 60, 100);

    // Instructions
    ctx.fillStyle = COLORS.text;
    ctx.font = '20px sans-serif';
    ctx.fillText('Renne durch das Dojo!', canvas.width / 2, 310);

    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#ccc';
    ctx.fillText('⬆ / W / Leertaste = Springen (2x möglich!)', canvas.width / 2, 345);
    ctx.fillText('⬇ / S = Ducken', canvas.width / 2, 370);
    ctx.fillText('X / J / Enter = Kick (zerstört Bretter!)', canvas.width / 2, 395);

    ctx.fillStyle = COLORS.kick;
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('Drücke LEERTASTE zum Starten', canvas.width / 2, 435);

    if (gamepadConnected) {
        ctx.fillStyle = '#aaa';
        ctx.font = '14px sans-serif';
        ctx.fillText('🎮 Gamepad: A=Springen, B/X=Kick, Steuerkreuz=Ducken', canvas.width / 2, 445);
    }
}

function drawKaratePreview(x, y, w, h) {
    // Simple karate figure
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + 10, y + 20, w - 20, h - 30);
    // Belt
    ctx.fillStyle = '#222';
    ctx.fillRect(x + 10, y + 50, w - 20, 6);
    // Head
    ctx.fillStyle = '#ffcc99';
    ctx.beginPath();
    ctx.arc(x + w / 2, y + 12, 12, 0, Math.PI * 2);
    ctx.fill();
    // Headband
    ctx.fillStyle = COLORS.playerHeadband;
    ctx.fillRect(x + w / 2 - 14, y + 8, 28, 5);
}

function drawBackground() {
    for (const el of bgElements) {
        if (el.type === 'lantern') {
            // Paper lantern
            ctx.fillStyle = COLORS.lantern;
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.ellipse(el.x, el.y, 12, 18, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.strokeStyle = COLORS.lantern;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(el.x, el.y - 18);
            ctx.lineTo(el.x, el.y - 30);
            ctx.stroke();
        } else if (el.type === 'torii') {
            // Torii gate silhouette
            ctx.fillStyle = '#4a1530';
            ctx.globalAlpha = 0.4;
            ctx.fillRect(el.x - 25, el.y, 5, 120);
            ctx.fillRect(el.x + 20, el.y, 5, 120);
            ctx.fillRect(el.x - 30, el.y, 60, 6);
            ctx.fillRect(el.x - 28, el.y + 12, 56, 4);
            ctx.globalAlpha = 1;
        }
    }
}

function drawPlayer() {
    const px = player.x;
    const py = player.y;
    const pw = player.width;
    const ph = player.height;

    ctx.save();

    if (player.kicking) {
        // Kick pose
        // Body (gi)
        ctx.fillStyle = '#fff';
        ctx.fillRect(px + 5, py + 15, pw - 10, ph - 30);
        // Kick leg
        ctx.fillStyle = '#ffcc99';
        ctx.fillRect(px + pw - 5, py + ph - 35, 25, 10);
        // Kick effect
        ctx.fillStyle = COLORS.kick;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(px + pw + 20, py + ph - 30, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    } else if (player.ducking) {
        // Duck pose - wider and shorter
        ctx.fillStyle = '#fff';
        ctx.fillRect(px, py + 5, pw + 10, ph - 10);
        // Belt
        ctx.fillStyle = '#222';
        ctx.fillRect(px, py + ph / 2 - 2, pw + 10, 5);
    } else {
        // Running pose
        ctx.fillStyle = '#fff';
        ctx.fillRect(px + 5, py + 15, pw - 10, ph - 25);

        // Legs animation
        const legOffset = Math.sin(player.runFrame * Math.PI / 2) * 8;
        ctx.fillStyle = '#ffcc99';
        ctx.fillRect(px + 8, py + ph - 15, 8, 15);
        ctx.fillRect(px + pw - 16, py + ph - 15 + legOffset * 0.3, 8, 15);
    }

    // Belt
    if (!player.ducking) {
        ctx.fillStyle = COLORS.playerBelt;
        const beltY = player.kicking ? py + 35 : py + ph * 0.55;
        ctx.fillRect(px + 3, beltY, pw - 6, 5);
        // Belt knot
        ctx.fillRect(px + pw / 2 - 2, beltY, 4, 10);
    }

    // Head
    ctx.fillStyle = '#ffcc99';
    const headY = player.ducking ? py : py + 5;
    ctx.beginPath();
    ctx.arc(px + pw / 2, headY + 5, 10, 0, Math.PI * 2);
    ctx.fill();

    // Headband
    ctx.fillStyle = COLORS.playerHeadband;
    ctx.fillRect(px + pw / 2 - 12, headY + 2, 24, 4);
    // Headband tail
    ctx.fillRect(px + pw / 2 + 10, headY + 2, 2, 10);
    ctx.fillRect(px + pw / 2 + 12, headY + 4, 2, 8);

    ctx.restore();
}

function drawObstacles() {
    for (const obs of obstacles) {
        if (obs.destroyed) continue;

        if (obs.type === 'low') {
            // Training post / rock
            ctx.fillStyle = '#8b5e3c';
            ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
            ctx.fillStyle = '#6b3e1c';
            ctx.fillRect(obs.x + 3, obs.y + 3, obs.width - 6, 8);
            // Top detail
            ctx.fillStyle = '#a0704a';
            ctx.fillRect(obs.x - 3, obs.y, obs.width + 6, 5);
        } else if (obs.type === 'high') {
            // Hanging banner/beam - must duck under
            ctx.fillStyle = '#654321';
            ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
            // Decorative elements
            ctx.fillStyle = COLORS.accent;
            ctx.fillRect(obs.x + 5, obs.y + 4, 8, obs.height - 8);
            ctx.fillRect(obs.x + obs.width - 13, obs.y + 4, 8, obs.height - 8);
            // Rope
            ctx.strokeStyle = '#444';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(obs.x + obs.width / 2, 0);
            ctx.lineTo(obs.x + obs.width / 2, obs.y);
            ctx.stroke();
        } else if (obs.type === 'breakable') {
            // Wooden board - can be kicked!
            ctx.fillStyle = COLORS.breakable;
            ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
            // Wood grain
            ctx.strokeStyle = '#b8956a';
            ctx.lineWidth = 1;
            for (let ly = obs.y + 8; ly < obs.y + obs.height; ly += 12) {
                ctx.beginPath();
                ctx.moveTo(obs.x + 3, ly);
                ctx.lineTo(obs.x + obs.width - 3, ly);
                ctx.stroke();
            }
            // "Kick me" indicator - pulsing glow
            ctx.fillStyle = COLORS.kick;
            ctx.globalAlpha = 0.3 + Math.sin(Date.now() / 200) * 0.2;
            ctx.fillRect(obs.x - 2, obs.y - 2, obs.width + 4, obs.height + 4);
            ctx.globalAlpha = 1;
            // ⚡ symbol
            ctx.fillStyle = COLORS.kick;
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('💥', obs.x + obs.width / 2, obs.y - 5);
        }
    }
}

function drawParticles() {
    for (const p of particles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / 40;
        ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
    }
    ctx.globalAlpha = 1;
}

function drawUI() {
    // Score
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score, 15, 30);

    // High score
    if (highScore > 0) {
        ctx.fillStyle = '#aaa';
        ctx.font = '14px sans-serif';
        ctx.fillText('Best: ' + highScore, 15, 50);
    }

    // Difficulty indicator
    ctx.fillStyle = COLORS.kick;
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Speed: ' + scrollSpeed.toFixed(1), canvas.width - 15, 30);
}

function drawGameOver() {
    // Overlay
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = 'center';

    // Game over text
    ctx.fillStyle = COLORS.accent;
    ctx.font = 'bold 42px sans-serif';
    ctx.fillText('K.O.!', canvas.width / 2, 160);

    // Score
    ctx.fillStyle = COLORS.text;
    ctx.font = '28px sans-serif';
    ctx.fillText('Score: ' + score, canvas.width / 2, 220);

    if (score >= highScore && highScore > 0) {
        ctx.fillStyle = COLORS.kick;
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText('⭐ Neuer Highscore! ⭐', canvas.width / 2, 260);
    }

    ctx.fillStyle = '#ccc';
    ctx.font = '16px sans-serif';
    ctx.fillText('Highscore: ' + highScore, canvas.width / 2, 295);

    ctx.fillStyle = COLORS.kick;
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('LEERTASTE = Nochmal', canvas.width / 2, 350);
}

// ========== GAME LOOP ==========

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

// Init
initBgElements();
player.y = GROUND_Y - player.height;
requestAnimationFrame(gameLoop);
