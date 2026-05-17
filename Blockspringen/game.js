const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let groundY = canvas.height - 100;

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    groundY = canvas.height - 100;
});

// Game state
let gameRunning = false;
let gameSpeed = 5;
let diamonds = 0;
let distance = 0;
let frameCount = 0;

// Player
const player = {
    x: 120,
    y: 0,
    width: 40,
    height: 56,
    vy: 0,
    grounded: false
};

// Game objects
let platforms = [];
let enemies = [];
let diamondItems = [];
let particles = [];

const GRAVITY = 0.6;
const JUMP_FORCE = -14;

// Pixel-style colors
const COLORS = {
    grass: '#4CAF50',
    grassTop: '#66BB6A',
    dirt: '#8B4513',
    stone: '#808080',
    stoneDark: '#606060',
    gem: '#00BCD4',
    gemLight: '#4DD0E1',
    skeleton: '#BDBDBD',
    skeletonDark: '#757575',
    slime: '#7CB342',
    slimeDark: '#558B2F',
    playerSkin: '#D2A06B',
    playerShirt: '#F44336',
    playerPants: '#3F51B5',
    playerHair: '#4E342E'
};

// --- Drawing functions ---

function drawBlock(x, y, w, h, type) {
    if (type === 'grass') {
        ctx.fillStyle = COLORS.dirt;
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = COLORS.grass;
        ctx.fillRect(x, y, w, 8);
        ctx.fillStyle = COLORS.grassTop;
        ctx.fillRect(x + 2, y, w - 4, 4);
    } else if (type === 'stone') {
        ctx.fillStyle = COLORS.stone;
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = COLORS.stoneDark;
        ctx.fillRect(x + 4, y + 4, 8, 8);
        ctx.fillRect(x + w - 16, y + h - 16, 10, 10);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
}

function drawPlayer() {
    const px = player.x;
    const py = player.y;

    // Body (shirt)
    ctx.fillStyle = COLORS.playerShirt;
    ctx.fillRect(px + 8, py + 20, 24, 20);

    // Pants
    ctx.fillStyle = COLORS.playerPants;
    ctx.fillRect(px + 8, py + 40, 11, 16);
    ctx.fillRect(px + 21, py + 40, 11, 16);

    // Head
    ctx.fillStyle = COLORS.playerSkin;
    ctx.fillRect(px + 8, py, 24, 20);

    // Hair
    ctx.fillStyle = COLORS.playerHair;
    ctx.fillRect(px + 8, py, 24, 6);

    // Eyes
    ctx.fillStyle = '#fff';
    ctx.fillRect(px + 14, py + 8, 6, 5);
    ctx.fillRect(px + 22, py + 8, 6, 5);
    ctx.fillStyle = '#4A148C';
    ctx.fillRect(px + 17, py + 9, 3, 4);
    ctx.fillRect(px + 25, py + 9, 3, 4);

    // Arms
    ctx.fillStyle = COLORS.playerSkin;
    ctx.fillRect(px, py + 20, 8, 18);
    ctx.fillRect(px + 32, py + 20, 8, 18);
}

function drawEnemy(enemy) {
    const ex = enemy.x;
    const ey = enemy.y;

    if (enemy.type === 'skeleton') {
        // Skeleton enemy
        ctx.fillStyle = COLORS.skeleton;
        ctx.fillRect(ex + 6, ey + 16, 20, 20);
        ctx.fillStyle = COLORS.skeletonDark;
        ctx.fillRect(ex + 4, ey, 24, 16);
        ctx.fillStyle = '#000';
        ctx.fillRect(ex + 8, ey + 4, 6, 6);
        ctx.fillRect(ex + 18, ey + 4, 6, 6);
        ctx.fillStyle = '#E53935';
        ctx.fillRect(ex + 10, ey + 5, 3, 3);
        ctx.fillRect(ex + 20, ey + 5, 3, 3);
        ctx.fillStyle = COLORS.skeleton;
        ctx.fillRect(ex, ey + 16, 6, 16);
        ctx.fillRect(ex + 26, ey + 16, 6, 16);
        ctx.fillStyle = COLORS.skeletonDark;
        ctx.fillRect(ex + 6, ey + 36, 9, 12);
        ctx.fillRect(ex + 17, ey + 36, 9, 12);
    } else {
        // Slime enemy
        ctx.fillStyle = COLORS.slime;
        ctx.fillRect(ex + 4, ey + 8, 24, 24);
        ctx.fillRect(ex + 2, ey + 12, 28, 16);
        ctx.fillStyle = COLORS.slimeDark;
        ctx.fillRect(ex + 6, ey + 32, 8, 8);
        ctx.fillRect(ex + 18, ey + 32, 8, 8);
        // Eyes
        ctx.fillStyle = '#fff';
        ctx.fillRect(ex + 8, ey + 14, 7, 7);
        ctx.fillRect(ex + 18, ey + 14, 7, 7);
        ctx.fillStyle = '#000';
        ctx.fillRect(ex + 11, ey + 16, 4, 4);
        ctx.fillRect(ex + 21, ey + 16, 4, 4);
        // Mouth
        ctx.fillStyle = COLORS.slimeDark;
        ctx.fillRect(ex + 10, ey + 25, 12, 3);
    }
}

function drawDiamond(d) {
    const dx = d.x;
    const dy = d.y + Math.sin(frameCount * 0.05 + d.x) * 4;

    ctx.fillStyle = COLORS.gem;
    ctx.beginPath();
    ctx.moveTo(dx + 12, dy);
    ctx.lineTo(dx + 24, dy + 8);
    ctx.lineTo(dx + 20, dy + 12);
    ctx.lineTo(dx + 12, dy + 20);
    ctx.lineTo(dx + 4, dy + 12);
    ctx.lineTo(dx, dy + 8);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = COLORS.gemLight;
    ctx.beginPath();
    ctx.moveTo(dx + 12, dy);
    ctx.lineTo(dx + 18, dy + 6);
    ctx.lineTo(dx + 12, dy + 10);
    ctx.lineTo(dx + 6, dy + 6);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.fillRect(dx + 6, dy + 2, 2, 2);
}

function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#4FC3F7');
    gradient.addColorStop(0.7, '#87CEEB');
    gradient.addColorStop(1, '#B3E5FC');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    for (let i = 0; i < 5; i++) {
        const cx = ((i * 300 - frameCount * 0.3) % (canvas.width + 200)) - 100;
        const cy = 50 + i * 40;
        ctx.fillRect(cx, cy, 80, 20);
        ctx.fillRect(cx + 20, cy - 10, 50, 10);
        ctx.fillRect(cx + 10, cy + 20, 60, 10);
    }

    // Ground
    for (let x = 0; x < canvas.width; x += 40) {
        drawBlock(x, groundY, 40, canvas.height - groundY, 'grass');
    }
}

// --- Particles ---

function addParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 1) * 5,
            life: 30 + Math.random() * 20,
            color: color,
            size: 3 + Math.random() * 4
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.3;
        p.life--;
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

function drawParticles() {
    particles.forEach(p => {
        ctx.globalAlpha = p.life / 50;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    ctx.globalAlpha = 1;
}

// --- Spawning ---

function spawnPlatform() {
    const lastPlatform = platforms[platforms.length - 1];
    const x = lastPlatform
        ? lastPlatform.x + lastPlatform.width + 100 + Math.random() * 150
        : canvas.width + 100;
    const y = groundY - 60 - Math.random() * 120;
    const width = 80 + Math.random() * 80;

    platforms.push({
        x: x,
        y: y,
        width: width,
        height: 32,
        type: Math.random() > 0.5 ? 'grass' : 'stone'
    });
}

function spawnEnemy() {
    enemies.push({
        x: canvas.width + 50,
        y: groundY - 48,
        width: 32,
        height: 48,
        type: Math.random() > 0.5 ? 'skeleton' : 'slime'
    });
}

function spawnDiamond() {
    const x = canvas.width + 50;
    const y = groundY - 80 - Math.random() * 120;
    diamondItems.push({
        x: x,
        y: y,
        width: 24,
        height: 20,
        collected: false
    });
}

// --- Collision ---

function collides(a, b) {
    return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
    );
}

// --- Game logic ---

function initGame() {
    player.y = groundY - player.height;
    player.vy = 0;
    player.grounded = true;
    platforms = [];
    enemies = [];
    diamondItems = [];
    particles = [];
    diamonds = 0;
    distance = 0;
    gameSpeed = 5;
    frameCount = 0;

    for (let i = 0; i < 5; i++) {
        spawnPlatform();
    }
}

function update() {
    if (!gameRunning) return;

    frameCount++;
    distance += gameSpeed * 0.1;
    gameSpeed = 5 + distance * 0.005;

    // Player physics
    player.vy += GRAVITY;
    player.y += player.vy;
    player.grounded = false;

    // Ground collision
    if (player.y + player.height >= groundY) {
        player.y = groundY - player.height;
        player.vy = 0;
        player.grounded = true;
    }

    // Platform collision (only from above)
    platforms.forEach(p => {
        if (
            player.vy > 0 &&
            player.x + player.width > p.x &&
            player.x < p.x + p.width &&
            player.y + player.height >= p.y &&
            player.y + player.height <= p.y + p.height + player.vy + 2
        ) {
            player.y = p.y - player.height;
            player.vy = 0;
            player.grounded = true;
        }
    });

    // Move platforms
    platforms.forEach(p => (p.x -= gameSpeed));
    platforms = platforms.filter(p => p.x + p.width > -50);
    if (
        platforms.length < 5 ||
        (platforms[platforms.length - 1] && platforms[platforms.length - 1].x < canvas.width)
    ) {
        spawnPlatform();
    }

    // Move & spawn enemies
    enemies.forEach(e => (e.x -= gameSpeed));
    enemies = enemies.filter(e => e.x + e.width > -50);
    if (frameCount % Math.max(60, 150 - Math.floor(distance * 0.3)) === 0) {
        spawnEnemy();
    }

    // Move & spawn diamonds
    diamondItems.forEach(d => (d.x -= gameSpeed));
    diamondItems = diamondItems.filter(d => d.x + d.width > -50 && !d.collected);
    if (frameCount % 90 === 0) {
        spawnDiamond();
    }

    // Diamond collection
    diamondItems.forEach(d => {
        if (!d.collected && collides(player, d)) {
            d.collected = true;
            diamonds++;
            addParticles(d.x + 12, d.y + 10, COLORS.gem, 8);
            addParticles(d.x + 12, d.y + 10, '#fff', 4);
        }
    });

    // Enemy collision
    for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (collides(player, e)) {
            if (player.vy > 0 && player.y + player.height - e.y < 15) {
                // Stomp enemy
                enemies.splice(i, 1);
                player.vy = JUMP_FORCE * 0.7;
                addParticles(e.x + 16, e.y + 24, '#4CAF50', 10);
                i--;
            } else {
                gameOver();
                return;
            }
        }
    }

    updateParticles();

    // Update UI
    document.getElementById('diamonds').textContent = diamonds;
    document.getElementById('distance').textContent = Math.floor(distance);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    platforms.forEach(p => drawBlock(p.x, p.y, p.width, p.height, p.type));
    diamondItems.forEach(d => {
        if (!d.collected) drawDiamond(d);
    });
    enemies.forEach(e => drawEnemy(e));
    drawPlayer();
    drawParticles();
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

function jump() {
    if (player.grounded) {
        player.vy = JUMP_FORCE;
        player.grounded = false;
        addParticles(player.x + 20, player.y + player.height, '#8B4513', 4);
    }
}

function gameOver() {
    gameRunning = false;
    document.getElementById('game-over-screen').style.display = 'flex';
    document.getElementById('final-score').innerHTML =
        '&#x1F48E; ' + diamonds + ' Edelsteine | &#x1F4CF; ' + Math.floor(distance) + 'm';
}

function startGame() {
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('game-over-screen').style.display = 'none';
    initGame();
    gameRunning = true;
}

// --- Controls ---

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        if (gameRunning) jump();
    }
});

canvas.addEventListener('click', () => {
    if (gameRunning) jump();
});

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameRunning) jump();
});

document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);

// Start render loop
gameLoop();
