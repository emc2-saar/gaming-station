const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const TARGET_FPS = 60;
let lastTime = 0;
let gameState = 'start'; // 'start', 'playing', 'gameover'
let winner = 0;

// Colors for balls
const BALL_COLORS = ['#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff', '#44ffff', '#ff8844', '#88ff44'];

// Player settings
const PLAYER_SPEED = 4;
const BULLET_SPEED = 8;
const SHOOT_COOLDOWN = 15; // frames at 60fps
const CANNON_LENGTH = 20;

// Castle settings
const CASTLE_ROWS = 10;
const CASTLE_COLS = 5;
const BRICK_WIDTH = 22;
const BRICK_HEIGHT = 16;
const BRICK_GAP = 2;

// Players
const players = [
    {
        x: 200,
        y: canvas.height / 2,
        angle: 0, // aiming angle in radians
        cooldown: 0,
        color: '#44aaff',
        name: 'Spieler 1',
        keys: { up: false, down: false, left: false, right: false, shoot: false },
        gamepadIndex: -1
    },
    {
        x: canvas.width - 200,
        y: canvas.height / 2,
        angle: Math.PI, // facing left
        cooldown: 0,
        color: '#ff6644',
        name: 'Spieler 2',
        keys: { up: false, down: false, left: false, right: false, shoot: false },
        gamepadIndex: -1
    }
];

// Bullets
let bullets = [];

// Castles - each is an array of bricks
let castles = [[], []];

// Particles for destruction effects
let particles = [];

function createCastle(centerX, centerY) {
    const bricks = [];
    const totalWidth = CASTLE_COLS * (BRICK_WIDTH + BRICK_GAP);
    const totalHeight = CASTLE_ROWS * (BRICK_HEIGHT + BRICK_GAP);
    const startX = centerX - totalWidth / 2;
    const startY = centerY - totalHeight / 2;

    for (let row = 0; row < CASTLE_ROWS; row++) {
        for (let col = 0; col < CASTLE_COLS; col++) {
            bricks.push({
                x: startX + col * (BRICK_WIDTH + BRICK_GAP),
                y: startY + row * (BRICK_HEIGHT + BRICK_GAP),
                width: BRICK_WIDTH,
                height: BRICK_HEIGHT,
                hp: 1,
                maxHp: 1
            });
        }
    }
    return bricks;
}

function initGame() {
    // Reset players
    players[0].x = 200;
    players[0].y = canvas.height / 2;
    players[0].angle = 0;
    players[0].cooldown = 0;
    players[0].keys = { up: false, down: false, left: false, right: false, shoot: false };

    players[1].x = canvas.width - 200;
    players[1].y = canvas.height / 2;
    players[1].angle = Math.PI;
    players[1].cooldown = 0;
    players[1].keys = { up: false, down: false, left: false, right: false, shoot: false };

    // Reset bullets and particles
    bullets = [];
    particles = [];

    // Create castles - left castle belongs to player 1, right to player 2
    // Player 1's castle is on the LEFT (player 2 shoots at it)
    // Player 2's castle is on the RIGHT (player 1 shoots at it)
    castles[0] = createCastle(70, canvas.height / 2); // Player 1's castle (left)
    castles[1] = createCastle(canvas.width - 70, canvas.height / 2); // Player 2's castle (right)
}

function spawnParticles(x, y, color) {
    for (let i = 0; i < 6; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 3;
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 30 + Math.random() * 20,
            color: color,
            size: 2 + Math.random() * 4
        });
    }
}

function getRandomBallColor() {
    return BALL_COLORS[Math.floor(Math.random() * BALL_COLORS.length)];
}

function update(dt) {
    if (gameState !== 'playing') return;

    // Update players
    for (let i = 0; i < 2; i++) {
        const p = players[i];

        // Movement
        if (p.keys.up) p.y -= PLAYER_SPEED * dt;
        if (p.keys.down) p.y += PLAYER_SPEED * dt;
        if (p.keys.left) p.angle -= 0.05 * dt;
        if (p.keys.right) p.angle += 0.05 * dt;

        // Clamp position
        p.y = Math.max(30, Math.min(canvas.height - 30, p.y));

        // Clamp x based on side
        if (i === 0) {
            p.x = Math.max(130, Math.min(canvas.width / 2 - 30, p.x));
        } else {
            p.x = Math.max(canvas.width / 2 + 30, Math.min(canvas.width - 130, p.x));
        }

        // Shooting
        if (p.cooldown > 0) p.cooldown -= dt;
        if (p.keys.shoot && p.cooldown <= 0) {
            const bulletColor = getRandomBallColor();
            bullets.push({
                x: p.x + Math.cos(p.angle) * CANNON_LENGTH,
                y: p.y + Math.sin(p.angle) * CANNON_LENGTH,
                vx: Math.cos(p.angle) * BULLET_SPEED,
                vy: Math.sin(p.angle) * BULLET_SPEED,
                owner: i,
                color: bulletColor,
                radius: 6
            });
            p.cooldown = SHOOT_COOLDOWN;
        }
    }

    // Update bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx * dt;
        b.y += b.vy * dt;

        // Remove if out of bounds
        if (b.x < -20 || b.x > canvas.width + 20 || b.y < -20 || b.y > canvas.height + 20) {
            bullets.splice(i, 1);
            continue;
        }

        // Check collision with enemy castle
        // Player 0 shoots at castle 1 (right), Player 1 shoots at castle 0 (left)
        const targetCastle = b.owner === 0 ? 1 : 0;
        let hit = false;

        for (let j = castles[targetCastle].length - 1; j >= 0; j--) {
            const brick = castles[targetCastle][j];
            if (b.x + b.radius > brick.x && b.x - b.radius < brick.x + brick.width &&
                b.y + b.radius > brick.y && b.y - b.radius < brick.y + brick.height) {
                
                brick.hp--;
                spawnParticles(b.x, b.y, b.color);
                
                if (brick.hp <= 0) {
                    spawnParticles(brick.x + brick.width / 2, brick.y + brick.height / 2, '#ffaa00');
                    castles[targetCastle].splice(j, 1);
                }
                
                hit = true;
                break;
            }
        }

        if (hit) {
            bullets.splice(i, 1);
        }
    }

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        p.vy += 0.1 * dt; // gravity
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }

    // Check win condition
    if (castles[0].length === 0) {
        gameState = 'gameover';
        winner = 2; // Player 2 destroyed Player 1's castle
    } else if (castles[1].length === 0) {
        gameState = 'gameover';
        winner = 1; // Player 1 destroyed Player 2's castle
    }
}

function drawPlayer(player, index) {
    const p = player;
    
    // Draw body (circle)
    ctx.beginPath();
    ctx.arc(p.x, p.y, 15, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw cannon (line showing aim direction)
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.angle) * CANNON_LENGTH, p.y + Math.sin(p.angle) * CANNON_LENGTH);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = p.color;
    ctx.stroke();

    // Draw player label
    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('S' + (index + 1), p.x, p.y - 22);
}

function drawCastle(bricks, ownerIndex) {
    for (const brick of bricks) {
        const hpRatio = brick.hp / brick.maxHp;
        let color;
        if (ownerIndex === 0) {
            // Blue castle
            const r = Math.floor(50 + (1 - hpRatio) * 150);
            const g = Math.floor(100 * hpRatio);
            const b = Math.floor(200 * hpRatio + 50);
            color = `rgb(${r},${g},${b})`;
        } else {
            // Red/orange castle
            const r = Math.floor(200 * hpRatio + 55);
            const g = Math.floor(100 * hpRatio);
            const b = Math.floor(50 + (1 - hpRatio) * 100);
            color = `rgb(${r},${g},${b})`;
        }
        
        ctx.fillStyle = color;
        ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 1;
        ctx.strokeRect(brick.x, brick.y, brick.width, brick.height);

        // Damage cracks
        if (brick.hp < brick.maxHp) {
            ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            ctx.lineWidth = 1;
            if (brick.hp <= 2) {
                ctx.beginPath();
                ctx.moveTo(brick.x + brick.width * 0.3, brick.y);
                ctx.lineTo(brick.x + brick.width * 0.5, brick.y + brick.height * 0.6);
                ctx.stroke();
            }
            if (brick.hp <= 1) {
                ctx.beginPath();
                ctx.moveTo(brick.x + brick.width * 0.7, brick.y + brick.height);
                ctx.lineTo(brick.x + brick.width * 0.4, brick.y + brick.height * 0.3);
                ctx.stroke();
            }
        }
    }
}

function drawBullets() {
    for (const b of bullets) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fillStyle = b.color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

function drawParticles() {
    for (const p of particles) {
        const alpha = Math.max(0, p.life / 50);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
}

function drawHUD() {
    // Castle health bars
    const castle0Hp = castles[0].reduce((sum, b) => sum + b.hp, 0);
    const castle0Max = CASTLE_ROWS * CASTLE_COLS * 1;
    const castle1Hp = castles[1].reduce((sum, b) => sum + b.hp, 0);
    const castle1Max = CASTLE_ROWS * CASTLE_COLS * 1;

    // Player 1 castle health (left)
    ctx.fillStyle = '#333';
    ctx.fillRect(20, 15, 200, 16);
    ctx.fillStyle = '#44aaff';
    ctx.fillRect(20, 15, 200 * (castle0Hp / castle0Max), 16);
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.strokeRect(20, 15, 200, 16);
    ctx.fillStyle = '#fff';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Burg S1', 25, 27);

    // Player 2 castle health (right)
    ctx.fillStyle = '#333';
    ctx.fillRect(canvas.width - 220, 15, 200, 16);
    ctx.fillStyle = '#ff6644';
    ctx.fillRect(canvas.width - 220, 15, 200 * (castle1Hp / castle1Max), 16);
    ctx.strokeStyle = '#666';
    ctx.strokeRect(canvas.width - 220, 15, 200, 16);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'right';
    ctx.fillText('Burg S2', canvas.width - 25, 27);

    // Divider line
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 40);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);
}

function draw() {
    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Ground decoration
    ctx.fillStyle = '#16213e';
    ctx.fillRect(0, canvas.height - 20, canvas.width, 20);

    if (gameState === 'start') {
        drawStartScreen();
        return;
    }

    if (gameState === 'gameover') {
        drawGameOverScreen();
        return;
    }

    // Draw game elements
    drawCastle(castles[0], 0);
    drawCastle(castles[1], 1);
    drawBullets();
    drawParticles();
    drawPlayer(players[0], 0);
    drawPlayer(players[1], 1);
    drawHUD();
}

function drawStartScreen() {
    // Title
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LeoBloxx', canvas.width / 2, 150);

    // Subtitle
    ctx.font = '20px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText('2-Spieler Burg-Duell', canvas.width / 2, 190);

    // Castle preview
    ctx.fillStyle = '#44aaff';
    ctx.fillRect(canvas.width / 2 - 150, 230, 40, 60);
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.fillText('🏰', canvas.width / 2 - 130, 265);

    ctx.fillStyle = '#ff6644';
    ctx.fillRect(canvas.width / 2 + 110, 230, 40, 60);
    ctx.fillText('🏰', canvas.width / 2 + 130, 265);

    ctx.fillStyle = '#ffff44';
    ctx.font = '20px sans-serif';
    ctx.fillText('💥', canvas.width / 2, 265);

    // Controls
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#44aaff';
    ctx.fillText('── Spieler 1 ──', canvas.width / 2 - 180, 340);
    ctx.fillStyle = '#ccc';
    ctx.font = '14px sans-serif';
    ctx.fillText('W/S: Hoch/Runter', canvas.width / 2 - 180, 370);
    ctx.fillText('A/D: Zielen', canvas.width / 2 - 180, 395);
    ctx.fillText('Leertaste: Schießen', canvas.width / 2 - 180, 420);

    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#ff6644';
    ctx.fillText('── Spieler 2 ──', canvas.width / 2 + 180, 340);
    ctx.fillStyle = '#ccc';
    ctx.font = '14px sans-serif';
    ctx.fillText('↑/↓: Hoch/Runter', canvas.width / 2 + 180, 370);
    ctx.fillText('←/→: Zielen', canvas.width / 2 + 180, 395);
    ctx.fillText('Enter: Schießen', canvas.width / 2 + 180, 420);

    // Gamepad info
    ctx.fillStyle = '#666';
    ctx.font = '13px sans-serif';
    ctx.fillText('🎮 Gamepads werden unterstützt!', canvas.width / 2, 470);

    // Start prompt
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px sans-serif';
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 500);
    ctx.globalAlpha = 0.5 + pulse * 0.5;
    ctx.fillText('Leertaste oder Enter zum Starten', canvas.width / 2, 540);
    ctx.globalAlpha = 1;
}

function drawGameOverScreen() {
    // Still draw game in background
    drawCastle(castles[0], 0);
    drawCastle(castles[1], 1);
    drawBullets();
    drawParticles();
    drawPlayer(players[0], 0);
    drawPlayer(players[1], 1);
    drawHUD();

    // Overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Winner text
    const winnerColor = winner === 1 ? '#44aaff' : '#ff6644';
    ctx.fillStyle = winnerColor;
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Spieler ' + winner + ' gewinnt!', canvas.width / 2, canvas.height / 2 - 40);

    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.fillText('Die Burg des Gegners wurde zerstört!', canvas.width / 2, canvas.height / 2 + 10);

    // Restart prompt
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#aaa';
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 500);
    ctx.globalAlpha = 0.5 + pulse * 0.5;
    ctx.fillText('Leertaste oder Enter für Neustart', canvas.width / 2, canvas.height / 2 + 70);
    ctx.globalAlpha = 1;
}

function gameLoop(timestamp) {
    if (lastTime === 0) lastTime = timestamp;
    const elapsed = timestamp - lastTime;
    lastTime = timestamp;
    const dt = Math.min(elapsed / (1000 / TARGET_FPS), 3);

    pollGamepads(dt);
    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
}

// Gamepad support
function pollGamepads(dt) {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    
    for (let i = 0; i < gamepads.length; i++) {
        const gp = gamepads[i];
        if (!gp) continue;

        // Assign gamepad to player (first gamepad = player 1, second = player 2)
        const playerIndex = i < 1 ? 0 : 1;
        if (i >= 2) continue;

        const p = players[playerIndex];
        const deadzone = 0.15;

        // Left stick Y for movement
        const axisY = gp.axes[1];
        p.keys.up = axisY < -deadzone;
        p.keys.down = axisY > deadzone;

        // Left stick X or right stick X for aiming
        const axisX = gp.axes.length > 2 ? gp.axes[2] : gp.axes[0];
        p.keys.left = axisX < -deadzone;
        p.keys.right = axisX > deadzone;

        // A button or trigger for shooting
        p.keys.shoot = gp.buttons[0].pressed || gp.buttons[7].pressed || gp.buttons[5].pressed;

        // Start button or A-button to start/restart
        if ((gp.buttons[9] && gp.buttons[9].pressed) || (gp.buttons[0] && gp.buttons[0].pressed)) {
            if (gameState === 'start' || gameState === 'gameover') {
                startGame();
            }
        }
    }
}

function startGame() {
    initGame();
    gameState = 'playing';
    lastTime = 0;
}

// Keyboard input
const keyMap = {};

document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keyMap[e.code] = true;
    updateKeys();

    if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (gameState === 'start' || gameState === 'gameover') {
            startGame();
        }
    }
});

document.addEventListener('keyup', (e) => {
    keyMap[e.code] = false;
    updateKeys();
});

function updateKeys() {
    // Player 1: WASD + Space
    players[0].keys.up = !!keyMap['KeyW'];
    players[0].keys.down = !!keyMap['KeyS'];
    players[0].keys.left = !!keyMap['KeyA'];
    players[0].keys.right = !!keyMap['KeyD'];
    players[0].keys.shoot = !!keyMap['Space'];

    // Player 2: Arrow keys + Enter
    players[1].keys.up = !!keyMap['ArrowUp'];
    players[1].keys.down = !!keyMap['ArrowDown'];
    players[1].keys.left = !!keyMap['ArrowLeft'];
    players[1].keys.right = !!keyMap['ArrowRight'];
    players[1].keys.shoot = !!keyMap['Enter'];
}

// Prevent scrolling with arrow keys
window.addEventListener('keydown', (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
    }
});

// Start game loop
requestAnimationFrame(gameLoop);
