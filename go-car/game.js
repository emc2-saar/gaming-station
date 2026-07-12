// === AUTORENNEN MIT GADGETS ===
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const TARGET_FPS = 60;
const ROAD_LEFT = 80;
const ROAD_RIGHT = 400;
const LANE_COUNT = 4;
const LANE_WIDTH = (ROAD_RIGHT - ROAD_LEFT) / LANE_COUNT;

// Game State
let lastTime = 0;
let gameState = 'start'; // start, playing, gameover
let score = 0;
let highScore = 0;
let distance = 0;
let difficulty = 1;

// Player
let player = {};
// Enemies, Gadgets, Particles
let enemies = [];
let gadgets = [];
let particles = [];
let roadLines = [];

// Spawn accumulators (frame-rate independent)
let enemySpawnAccum = 0;
let gadgetSpawnAccum = 0;

// Power-ups
let activePowers = {
    turbo: 0,
    shield: 0,
    magnet: 0,
    rocket: 0
};

// Input
let keys = {};
let gamepadConnected = false;

// Road line setup
function initRoadLines() {
    roadLines = [];
    for (let i = 0; i < 12; i++) {
        roadLines.push({ y: i * 60 });
    }
}

// Initialize/Reset game
function initGame() {
    player = {
        x: canvas.width / 2,
        y: canvas.height - 120,
        width: 36,
        height: 60,
        speed: 4,
        color: '#00d4ff',
        invincible: 0
    };
    enemies = [];
    gadgets = [];
    particles = [];
    score = 0;
    distance = 0;
    difficulty = 1;
    enemySpawnAccum = 0;
    gadgetSpawnAccum = 0;
    activePowers = { turbo: 0, shield: 0, magnet: 0, rocket: 0 };
    initRoadLines();
    gameState = 'playing';
    lastTime = 0;
}

// Gadget types
const GADGET_TYPES = [
    { type: 'turbo', symbol: '⚡', color: '#ffdd00', desc: 'Turbo-Boost' },
    { type: 'shield', symbol: '🛡️', color: '#00ff88', desc: 'Schutzschild' },
    { type: 'magnet', symbol: '🧲', color: '#ff44ff', desc: 'Magnet' },
    { type: 'rocket', symbol: '🔥', color: '#ff4400', desc: 'Rakete' }
];

// Spawn enemy car
function spawnEnemy() {
    const lane = Math.floor(Math.random() * LANE_COUNT);
    const x = ROAD_LEFT + lane * LANE_WIDTH + LANE_WIDTH / 2;
    const colors = ['#ff3333', '#ff8800', '#aa00ff', '#ffff00', '#00ff44'];
    enemies.push({
        x: x,
        y: -80,
        width: 34,
        height: 56,
        speed: 2.5 + Math.random() * 1.5 + difficulty * 0.7,
        color: colors[Math.floor(Math.random() * colors.length)]
    });
}

// Spawn gadget
function spawnGadget() {
    const lane = Math.floor(Math.random() * LANE_COUNT);
    const x = ROAD_LEFT + lane * LANE_WIDTH + LANE_WIDTH / 2;
    const type = GADGET_TYPES[Math.floor(Math.random() * GADGET_TYPES.length)];
    gadgets.push({
        x: x,
        y: -40,
        width: 30,
        height: 30,
        speed: 3 + difficulty * 0.2,
        ...type,
        pulse: 0
    });
}

// Create explosion particles
function createExplosion(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
        const speed = 2 + Math.random() * 4;
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1,
            decay: 0.02 + Math.random() * 0.02,
            color: color,
            size: 3 + Math.random() * 5
        });
    }
}

// Collision detection
function collides(a, b) {
    return a.x - a.width/2 < b.x + b.width/2 &&
           a.x + a.width/2 > b.x - b.width/2 &&
           a.y - a.height/2 < b.y + b.height/2 &&
           a.y + a.height/2 > b.y - b.height/2;
}

// Gamepad input
function getGamepadInput() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let gp of gamepads) {
        if (!gp) continue;
        gamepadConnected = true;
        const deadzone = 0.15;
        let dx = 0, dy = 0;
        
        // Left stick
        if (Math.abs(gp.axes[0]) > deadzone) dx = gp.axes[0];
        if (Math.abs(gp.axes[1]) > deadzone) dy = gp.axes[1];
        
        // D-pad (buttons 12-15)
        if (gp.buttons[12] && gp.buttons[12].pressed) dy = -1;
        if (gp.buttons[13] && gp.buttons[13].pressed) dy = 1;
        if (gp.buttons[14] && gp.buttons[14].pressed) dx = -1;
        if (gp.buttons[15] && gp.buttons[15].pressed) dx = 1;
        
        // A/B/X/Y or face buttons to start
        const anyButton = gp.buttons.some(b => b.pressed);
        
        return { dx, dy, start: anyButton };
    }
    return null;
}

// === UPDATE ===
function update(dt) {
    if (gameState !== 'playing') return;

    const baseSpeed = activePowers.turbo > 0 ? 6 : 3.5;
    const scrollSpeed = (baseSpeed + difficulty * 0.4) * dt;

    // Input
    let dx = 0, dy = 0;
    if (keys['ArrowLeft'] || keys['KeyA']) dx = -1;
    if (keys['ArrowRight'] || keys['KeyD']) dx = 1;
    if (keys['ArrowUp'] || keys['KeyW']) dy = -1;
    if (keys['ArrowDown'] || keys['KeyS']) dy = 1;

    // Gamepad
    const gp = getGamepadInput();
    if (gp) {
        if (Math.abs(gp.dx) > 0.1) dx = gp.dx;
        if (Math.abs(gp.dy) > 0.1) dy = gp.dy;
    }

    // Move player
    const moveSpeed = player.speed * dt;
    player.x += dx * moveSpeed;
    player.y += dy * moveSpeed * 0.7;

    // Clamp player position
    player.x = Math.max(ROAD_LEFT + player.width/2 + 4, Math.min(ROAD_RIGHT - player.width/2 - 4, player.x));
    player.y = Math.max(player.height/2 + 10, Math.min(canvas.height - player.height/2 - 10, player.y));

    // Score & distance
    distance += scrollSpeed;
    score = Math.floor(distance / 10);
    difficulty = 1 + score / 50;
    if (difficulty > 8) difficulty = 8;

    // Road lines scroll
    for (let line of roadLines) {
        line.y += scrollSpeed * 3;
        if (line.y > canvas.height + 30) {
            line.y -= 12 * 60 + 60;
        }
    }

    // Spawn enemies (accumulator pattern)
    const enemySpawnRate = Math.max(0.5, 1.5 - difficulty * 0.15);
    enemySpawnAccum += dt / TARGET_FPS;
    if (enemySpawnAccum >= enemySpawnRate) {
        enemySpawnAccum -= enemySpawnRate;
        spawnEnemy();
    }

    // Spawn gadgets
    const gadgetSpawnRate = 2.5;
    gadgetSpawnAccum += dt / TARGET_FPS;
    if (gadgetSpawnAccum >= gadgetSpawnRate) {
        gadgetSpawnAccum -= gadgetSpawnRate;
        spawnGadget();
    }

    // Update enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        e.y += e.speed * dt;
        
        if (e.y > canvas.height + 100) {
            enemies.splice(i, 1);
            continue;
        }

        // Rocket destroys enemies
        if (activePowers.rocket > 0 && e.y > player.y - 200 && e.y < player.y) {
            createExplosion(e.x, e.y, e.color, 12);
            enemies.splice(i, 1);
            score += 25;
            continue;
        }

        // Collision with player
        if (collides(player, e)) {
            if (activePowers.turbo > 0) {
                // Turbo makes you invincible
                createExplosion(e.x, e.y, e.color, 10);
                enemies.splice(i, 1);
                score += 15;
            } else if (activePowers.shield > 0) {
                // Shield absorbs hit
                activePowers.shield = 0;
                createExplosion(e.x, e.y, '#00ff88', 8);
                enemies.splice(i, 1);
            } else if (player.invincible <= 0) {
                // Game Over
                createExplosion(player.x, player.y, '#00d4ff', 20);
                if (score > highScore) highScore = score;
                gameState = 'gameover';
                return;
            }
        }
    }

    // Update gadgets
    for (let i = gadgets.length - 1; i >= 0; i--) {
        const g = gadgets[i];
        g.y += g.speed * dt;
        g.pulse += 0.1 * dt;

        // Magnet attraction
        if (activePowers.magnet > 0) {
            const gdx = player.x - g.x;
            const gdy = player.y - g.y;
            const dist = Math.sqrt(gdx * gdx + gdy * gdy);
            if (dist < 200 && dist > 0) {
                g.x += (gdx / dist) * 5 * dt;
                g.y += (gdy / dist) * 5 * dt;
            }
        }

        if (g.y > canvas.height + 50) {
            gadgets.splice(i, 1);
            continue;
        }

        // Collect gadget
        if (collides(player, g)) {
            activatePower(g.type);
            createExplosion(g.x, g.y, g.color, 8);
            gadgets.splice(i, 1);
        }
    }

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= p.decay * dt;
        if (p.life <= 0) particles.splice(i, 1);
    }

    // Update power timers
    for (let key in activePowers) {
        if (activePowers[key] > 0) {
            activePowers[key] -= dt / TARGET_FPS;
            if (activePowers[key] < 0) activePowers[key] = 0;
        }
    }

    // Invincibility timer
    if (player.invincible > 0) {
        player.invincible -= dt / TARGET_FPS;
    }
}

function activatePower(type) {
    switch(type) {
        case 'turbo':
            activePowers.turbo = 4; // 4 seconds
            break;
        case 'shield':
            activePowers.shield = 10; // 10 seconds
            break;
        case 'magnet':
            activePowers.magnet = 6; // 6 seconds
            break;
        case 'rocket':
            activePowers.rocket = 3; // 3 seconds
            break;
    }
}

// === DRAW ===
function draw() {
    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (gameState === 'start') {
        drawStartScreen();
        return;
    }

    drawRoad();
    drawGadgets();
    drawEnemies();
    drawPlayer();
    drawParticles();
    drawHUD();

    if (gameState === 'gameover') {
        drawGameOver();
    }
}

function drawRoad() {
    // Road surface
    ctx.fillStyle = '#333344';
    ctx.fillRect(ROAD_LEFT, 0, ROAD_RIGHT - ROAD_LEFT, canvas.height);

    // Road edges
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(ROAD_LEFT - 4, 0, 4, canvas.height);
    ctx.fillRect(ROAD_RIGHT, 0, 4, canvas.height);

    // Lane lines
    ctx.setLineDash([30, 30]);
    ctx.strokeStyle = '#666688';
    ctx.lineWidth = 2;
    for (let i = 1; i < LANE_COUNT; i++) {
        const x = ROAD_LEFT + i * LANE_WIDTH;
        ctx.beginPath();
        for (let line of roadLines) {
            ctx.moveTo(x, line.y);
            ctx.lineTo(x, line.y + 30);
        }
        ctx.stroke();
    }
    ctx.setLineDash([]);

    // Grass/sides
    ctx.fillStyle = '#0d3b0d';
    ctx.fillRect(0, 0, ROAD_LEFT - 4, canvas.height);
    ctx.fillRect(ROAD_RIGHT + 4, 0, canvas.width - ROAD_RIGHT - 4, canvas.height);
}

function drawPlayer() {
    const px = player.x;
    const py = player.y;
    const w = player.width;
    const h = player.height;

    ctx.save();

    // Turbo glow
    if (activePowers.turbo > 0) {
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ffdd00';
    }

    // Shield glow
    if (activePowers.shield > 0) {
        ctx.beginPath();
        ctx.arc(px, py, 35, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 255, 136, ' + (0.4 + Math.sin(Date.now() * 0.005) * 0.3) + ')';
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    // Car body
    ctx.fillStyle = activePowers.turbo > 0 ? '#ffdd00' : player.color;
    
    // Main body
    ctx.beginPath();
    ctx.roundRect(px - w/2, py - h/2, w, h, 6);
    ctx.fill();

    // Windshield
    ctx.fillStyle = '#224466';
    ctx.fillRect(px - w/3, py - h/4, w*2/3, h/5);

    // Wheels
    ctx.fillStyle = '#222';
    ctx.fillRect(px - w/2 - 4, py - h/3, 5, 14);
    ctx.fillRect(px + w/2 - 1, py - h/3, 5, 14);
    ctx.fillRect(px - w/2 - 4, py + h/6, 5, 14);
    ctx.fillRect(px + w/2 - 1, py + h/6, 5, 14);

    // Rocket flame
    if (activePowers.rocket > 0) {
        ctx.fillStyle = '#ff4400';
        ctx.beginPath();
        ctx.moveTo(px - 8, py - h/2 - 5);
        ctx.lineTo(px + 8, py - h/2 - 5);
        ctx.lineTo(px, py - h/2 - 25 - Math.random() * 10);
        ctx.fill();
    }

    // Turbo exhaust
    if (activePowers.turbo > 0) {
        ctx.fillStyle = '#ff8800';
        const flicker = Math.random() * 8;
        ctx.beginPath();
        ctx.moveTo(px - 6, py + h/2);
        ctx.lineTo(px + 6, py + h/2);
        ctx.lineTo(px, py + h/2 + 20 + flicker);
        ctx.fill();
    }

    ctx.restore();
}

function drawEnemies() {
    for (let e of enemies) {
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.roundRect(e.x - e.width/2, e.y - e.height/2, e.width, e.height, 5);
        ctx.fill();

        // Windshield
        ctx.fillStyle = '#224466';
        ctx.fillRect(e.x - e.width/3, e.y + e.height/8, e.width*2/3, e.height/5);

        // Wheels
        ctx.fillStyle = '#222';
        ctx.fillRect(e.x - e.width/2 - 4, e.y - e.height/3, 5, 12);
        ctx.fillRect(e.x + e.width/2 - 1, e.y - e.height/3, 5, 12);
        ctx.fillRect(e.x - e.width/2 - 4, e.y + e.height/6, 5, 12);
        ctx.fillRect(e.x + e.width/2 - 1, e.y + e.height/6, 5, 12);
    }
}

function drawGadgets() {
    for (let g of gadgets) {
        const pulse = 1 + Math.sin(g.pulse) * 0.15;
        const size = g.width * pulse;
        
        // Glow
        ctx.shadowBlur = 12;
        ctx.shadowColor = g.color;
        
        // Background circle
        ctx.fillStyle = g.color + '44';
        ctx.beginPath();
        ctx.arc(g.x, g.y, size/2 + 4, 0, Math.PI * 2);
        ctx.fill();

        // Symbol
        ctx.font = `${Math.floor(size * 0.7)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(g.symbol, g.x, g.y);
        
        ctx.shadowBlur = 0;
    }
}

function drawParticles() {
    for (let p of particles) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function drawHUD() {
    // Score
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score, 10, 30);

    // High Score
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Best: ' + highScore, 10, 50);

    // Active powers
    let powerY = 80;
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'left';
    
    if (activePowers.turbo > 0) {
        ctx.fillStyle = '#ffdd00';
        ctx.fillText('⚡ Turbo ' + activePowers.turbo.toFixed(1) + 's', 10, powerY);
        powerY += 22;
    }
    if (activePowers.shield > 0) {
        ctx.fillStyle = '#00ff88';
        ctx.fillText('🛡️ Schild ' + activePowers.shield.toFixed(1) + 's', 10, powerY);
        powerY += 22;
    }
    if (activePowers.magnet > 0) {
        ctx.fillStyle = '#ff44ff';
        ctx.fillText('🧲 Magnet ' + activePowers.magnet.toFixed(1) + 's', 10, powerY);
        powerY += 22;
    }
    if (activePowers.rocket > 0) {
        ctx.fillStyle = '#ff4400';
        ctx.fillText('🔥 Rakete ' + activePowers.rocket.toFixed(1) + 's', 10, powerY);
        powerY += 22;
    }
}

function drawStartScreen() {
    // Road preview
    drawRoad();

    // Overlay
    ctx.fillStyle = 'rgba(10, 10, 30, 0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Title
    ctx.fillStyle = '#00d4ff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏎️ Autorennen', canvas.width/2, 160);

    // Subtitle
    ctx.fillStyle = '#ffdd00';
    ctx.font = '20px sans-serif';
    ctx.fillText('Sammle Gadgets für Superkräfte!', canvas.width/2, 210);

    // Gadget info
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'left';
    const startX = 100;
    let y = 270;
    
    ctx.fillStyle = '#ffdd00';
    ctx.fillText('⚡ Turbo-Boost – Unverwundbar & schnell', startX, y); y += 30;
    ctx.fillStyle = '#00ff88';
    ctx.fillText('🛡️ Schutzschild – Absorbiert einen Treffer', startX, y); y += 30;
    ctx.fillStyle = '#ff44ff';
    ctx.fillText('🧲 Magnet – Zieht Gadgets an', startX, y); y += 30;
    ctx.fillStyle = '#ff4400';
    ctx.fillText('🔥 Rakete – Zerstört Autos vor dir', startX, y); y += 50;

    // Controls
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = '18px sans-serif';
    ctx.fillText('Steuerung:', canvas.width/2, y); y += 28;
    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#ccc';
    ctx.fillText('Pfeiltasten / WASD – Lenken', canvas.width/2, y); y += 24;
    ctx.fillText('Gamepad – Stick oder D-Pad', canvas.width/2, y); y += 50;

    // Start prompt
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px sans-serif';
    const blink = Math.sin(Date.now() * 0.004) > 0;
    if (blink) {
        ctx.fillText('Leertaste / Enter zum Starten', canvas.width/2, y);
    }
}

function drawGameOver() {
    // Overlay
    ctx.fillStyle = 'rgba(10, 10, 30, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = 'center';

    // Game Over text
    ctx.fillStyle = '#ff3333';
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText('GAME OVER', canvas.width/2, canvas.height/2 - 60);

    // Score
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('Score: ' + score, canvas.width/2, canvas.height/2);

    // High score
    ctx.fillStyle = '#ffdd00';
    ctx.font = '20px sans-serif';
    ctx.fillText('Highscore: ' + highScore, canvas.width/2, canvas.height/2 + 40);

    // Restart
    ctx.fillStyle = '#ccc';
    ctx.font = '18px sans-serif';
    const blink = Math.sin(Date.now() * 0.004) > 0;
    if (blink) {
        ctx.fillText('Leertaste / Enter für Neustart', canvas.width/2, canvas.height/2 + 100);
    }
}

// === GAME LOOP ===
function gameLoop(timestamp) {
    if (lastTime === 0) lastTime = timestamp;
    const elapsed = timestamp - lastTime;
    lastTime = timestamp;
    const dt = Math.min(elapsed / (1000 / TARGET_FPS), 3);

    // Check gamepad for start/restart
    if (gameState !== 'playing') {
        const gp = getGamepadInput();
        if (gp && gp.start) {
            if (gameState === 'start' || gameState === 'gameover') {
                initGame();
            }
        }
    }

    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
}

// === INPUT HANDLERS ===
document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    
    if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (gameState === 'start' || gameState === 'gameover') {
            initGame();
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

// Touch controls (bonus)
let touchStartX = 0;
let touchStartY = 0;
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameState !== 'playing') {
        initGame();
        return;
    }
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (gameState !== 'playing') return;
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    player.x = ((touch.clientX - rect.left) / rect.width) * canvas.width;
    player.x = Math.max(ROAD_LEFT + player.width/2 + 4, Math.min(ROAD_RIGHT - player.width/2 - 4, player.x));
});

// Start the game loop
requestAnimationFrame(gameLoop);
