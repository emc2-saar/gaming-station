const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// === CONSTANTS ===
const TARGET_FPS = 60;
const GRAVITY = 0.6;
const JUMP_FORCE = -13;
const MOVE_SPEED = 5;
const TILE_SIZE = 32;
const PLAYER_WIDTH = 28;
const PLAYER_HEIGHT = 36;
const SCROLL_THRESHOLD = 300;

// === COLORS (Maker-Style) ===
const COLORS = {
    sky: '#4a90d9',
    skyGradient: '#2c3e6b',
    ground: '#8B4513',
    groundTop: '#4CAF50',
    platform: '#FF9800',
    platformTop: '#FFB74D',
    coin: '#FFD700',
    coinShine: '#FFF8E1',
    spike: '#E53935',
    spikeOutline: '#B71C1C',
    player: '#2196F3',
    playerOutline: '#0D47A1',
    playerEyes: '#FFFFFF',
    playerPupil: '#1a1a2e',
    flag: '#4CAF50',
    flagPole: '#795548',
    gridLine: 'rgba(255,255,255,0.05)',
    cloud: 'rgba(255,255,255,0.8)',
    particle: '#FFD700'
};

// === GAME STATE ===
let lastTime = 0;
let gameState = 'start'; // start, playing, gameover, win
let score = 0;
let cameraX = 0;
let level = 1;
let levelData = [];
let coins = [];
let spikes = [];
let platforms = [];
let particles = [];
let player = {};
let flagPos = {};
let keys = {};
let gamepadState = { left: false, right: false, jump: false };
let totalCoins = 0;

// === LEVEL GENERATION ===
function generateLevel(lvl) {
    levelData = [];
    coins = [];
    spikes = [];
    platforms = [];
    particles = [];
    
    const levelWidth = 60 + lvl * 15; // Level gets longer
    const groundY = 13; // Ground row (in tiles)
    
    // Create ground
    for (let x = 0; x < levelWidth; x++) {
        levelData.push({ x: x * TILE_SIZE, y: groundY * TILE_SIZE, type: 'ground' });
    }
    
    // Create gaps in ground (more with higher level)
    const gapCount = 2 + Math.floor(lvl * 1.5);
    let gapPositions = [];
    for (let i = 0; i < gapCount; i++) {
        const gapStart = 8 + Math.floor(Math.random() * (levelWidth - 20));
        const gapWidth = 2 + Math.floor(Math.random() * 2);
        let overlap = false;
        for (let gp of gapPositions) {
            if (Math.abs(gapStart - gp.start) < gp.width + 4) overlap = true;
        }
        if (!overlap) {
            gapPositions.push({ start: gapStart, width: gapWidth });
            levelData = levelData.filter(t => {
                const tx = t.x / TILE_SIZE;
                return !(tx >= gapStart && tx < gapStart + gapWidth && t.type === 'ground');
            });
            // Add spikes at bottom of gaps
            for (let gx = gapStart; gx < gapStart + gapWidth; gx++) {
                spikes.push({ x: gx * TILE_SIZE, y: (groundY + 1) * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE });
            }
        }
    }
    
    // Create platforms
    const platformCount = 8 + lvl * 3;
    for (let i = 0; i < platformCount; i++) {
        const px = (5 + Math.floor(Math.random() * (levelWidth - 10))) * TILE_SIZE;
        const py = (5 + Math.floor(Math.random() * 7)) * TILE_SIZE;
        const pWidth = (2 + Math.floor(Math.random() * 4)) * TILE_SIZE;
        platforms.push({ x: px, y: py, width: pWidth, height: TILE_SIZE });
        
        // Add coins on platforms
        if (Math.random() > 0.3) {
            const coinCount = Math.floor(pWidth / TILE_SIZE);
            for (let c = 0; c < coinCount; c++) {
                coins.push({ 
                    x: px + c * TILE_SIZE + TILE_SIZE / 2, 
                    y: py - TILE_SIZE + 8, 
                    collected: false,
                    bobOffset: Math.random() * Math.PI * 2
                });
            }
        }
    }
    
    // Add some ground-level coins
    for (let i = 0; i < 10 + lvl * 2; i++) {
        const cx = (4 + Math.floor(Math.random() * (levelWidth - 8))) * TILE_SIZE + TILE_SIZE / 2;
        // Check if ground exists below
        const groundBelow = levelData.some(t => Math.abs(t.x - (cx - TILE_SIZE/2)) < TILE_SIZE && t.type === 'ground');
        if (groundBelow) {
            coins.push({ 
                x: cx, 
                y: (groundY - 1) * TILE_SIZE + 8, 
                collected: false,
                bobOffset: Math.random() * Math.PI * 2
            });
        }
    }
    
    // Add spikes on ground (more with level)
    const spikeCount = 3 + lvl * 2;
    for (let i = 0; i < spikeCount; i++) {
        const sx = (6 + Math.floor(Math.random() * (levelWidth - 12))) * TILE_SIZE;
        const groundExists = levelData.some(t => t.x === sx && t.type === 'ground');
        if (groundExists) {
            spikes.push({ x: sx, y: (groundY - 1) * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE });
        }
    }
    
    totalCoins = coins.filter(c => !c.collected).length;
    
    // Flag at the end
    flagPos = { x: (levelWidth - 3) * TILE_SIZE, y: (groundY - 3) * TILE_SIZE };
    
    return levelWidth * TILE_SIZE;
}

// === PLAYER ===
function resetPlayer() {
    player = {
        x: 2 * TILE_SIZE,
        y: 10 * TILE_SIZE,
        vx: 0,
        vy: 0,
        width: PLAYER_WIDTH,
        height: PLAYER_HEIGHT,
        onGround: false,
        facingRight: true,
        animFrame: 0,
        animTimer: 0,
        jumpBuffer: 0,
        coyoteTime: 0,
        squish: 0,
        jumpsLeft: 2,
        maxJumps: 2,
        jumpReleased: true
    };
}

// === INPUT ===
document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') return; // Don't capture Escape
    keys[e.code] = true;
    
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        if (gameState === 'start' || gameState === 'gameover' || gameState === 'win') {
            startGame();
        }
    }
    if (e.code === 'Enter') {
        e.preventDefault();
        if (gameState === 'start' || gameState === 'gameover' || gameState === 'win') {
            startGame();
        }
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// === GAMEPAD ===
function pollGamepad() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    gamepadState = { left: false, right: false, jump: false };
    
    for (const gp of gamepads) {
        if (!gp) continue;
        const deadzone = 0.15;
        
        // Left stick or D-pad
        if (gp.axes[0] < -deadzone || (gp.buttons[14] && gp.buttons[14].pressed)) {
            gamepadState.left = true;
        }
        if (gp.axes[0] > deadzone || (gp.buttons[15] && gp.buttons[15].pressed)) {
            gamepadState.right = true;
        }
        
        // Jump: A button (0) or B button (1) or D-pad up
        if ((gp.buttons[0] && gp.buttons[0].pressed) || 
            (gp.buttons[1] && gp.buttons[1].pressed) ||
            (gp.buttons[12] && gp.buttons[12].pressed)) {
            gamepadState.jump = true;
        }
        
        // Start button to start/restart
        if (gp.buttons[9] && gp.buttons[9].pressed) {
            if (gameState !== 'playing') {
                startGame();
            }
        }
    }
}

// === COLLISION ===
function rectCollide(a, b) {
    return a.x < b.x + b.width &&
           a.x + a.width > b.x &&
           a.y < b.y + b.height &&
           a.y + a.height > b.y;
}

// === PARTICLES ===
function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 1) * 5,
            life: 1,
            color: color,
            size: 2 + Math.random() * 4
        });
    }
}

// === UPDATE ===
function update(dt) {
    if (gameState !== 'playing') return;
    
    pollGamepad();
    
    // Input
    const moveLeft = keys['ArrowLeft'] || keys['KeyA'] || gamepadState.left;
    const moveRight = keys['ArrowRight'] || keys['KeyD'] || gamepadState.right;
    const jumpPressed = keys['Space'] || keys['ArrowUp'] || keys['KeyW'] || gamepadState.jump;
    
    // Horizontal movement
    if (moveLeft) {
        player.vx = -MOVE_SPEED;
        player.facingRight = false;
    } else if (moveRight) {
        player.vx = MOVE_SPEED;
        player.facingRight = true;
    } else {
        player.vx *= Math.pow(0.7, dt);
        if (Math.abs(player.vx) < 0.1) player.vx = 0;
    }
    
    // Jump buffer
    if (jumpPressed) {
        player.jumpBuffer = 6;
    } else {
        player.jumpBuffer -= dt;
    }
    
    // Coyote time & reset jumps on ground
    if (player.onGround) {
        player.coyoteTime = 6;
        player.jumpsLeft = player.maxJumps;
    } else {
        player.coyoteTime -= dt;
    }
    
    // Track jump release for double jump
    if (!jumpPressed) {
        player.jumpReleased = true;
    }
    
    // Jumping (with double jump)
    if (player.jumpBuffer > 0 && player.jumpReleased) {
        if (player.coyoteTime > 0) {
            // Normal jump (from ground or coyote time)
            player.vy = JUMP_FORCE;
            player.jumpBuffer = 0;
            player.coyoteTime = 0;
            player.jumpsLeft = player.maxJumps - 1;
            player.squish = -0.3;
            player.jumpReleased = false;
            spawnParticles(player.x + player.width / 2, player.y + player.height, '#fff', 5);
        } else if (player.jumpsLeft > 0) {
            // Double jump (in the air)
            player.vy = JUMP_FORCE * 0.85;
            player.jumpBuffer = 0;
            player.jumpsLeft--;
            player.squish = -0.2;
            player.jumpReleased = false;
            spawnParticles(player.x + player.width / 2, player.y + player.height, '#88f', 8);
        }
    }
    
    // Variable jump height
    if (!jumpPressed && player.vy < -3) {
        player.vy *= Math.pow(0.85, dt);
    }
    
    // Gravity
    player.vy += GRAVITY * dt;
    if (player.vy > 15) player.vy = 15;
    
    // Apply movement
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    
    // Squish recovery
    player.squish *= Math.pow(0.8, dt);
    
    // Animation
    if (Math.abs(player.vx) > 0.5 && player.onGround) {
        player.animTimer += dt;
        if (player.animTimer > 6) {
            player.animTimer = 0;
            player.animFrame = (player.animFrame + 1) % 4;
        }
    } else {
        player.animFrame = 0;
    }
    
    // Collision with ground tiles
    player.onGround = false;
    for (const tile of levelData) {
        const tileRect = { x: tile.x, y: tile.y, width: TILE_SIZE, height: TILE_SIZE };
        if (rectCollide(player, tileRect)) {
            // Resolve collision
            const overlapX = Math.min(player.x + player.width - tile.x, tile.x + TILE_SIZE - player.x);
            const overlapY = Math.min(player.y + player.height - tile.y, tile.y + TILE_SIZE - player.y);
            
            if (overlapX < overlapY) {
                if (player.x + player.width / 2 < tile.x + TILE_SIZE / 2) {
                    player.x = tile.x - player.width;
                } else {
                    player.x = tile.x + TILE_SIZE;
                }
                player.vx = 0;
            } else {
                if (player.y + player.height / 2 < tile.y + TILE_SIZE / 2) {
                    player.y = tile.y - player.height;
                    player.vy = 0;
                    player.onGround = true;
                    if (player.squish === 0) player.squish = 0.2;
                } else {
                    player.y = tile.y + TILE_SIZE;
                    player.vy = 0;
                }
            }
        }
    }
    
    // Collision with platforms
    for (const plat of platforms) {
        if (rectCollide(player, plat)) {
            const overlapX = Math.min(player.x + player.width - plat.x, plat.x + plat.width - player.x);
            const overlapY = Math.min(player.y + player.height - plat.y, plat.y + plat.height - player.y);
            
            if (overlapX < overlapY) {
                if (player.x + player.width / 2 < plat.x + plat.width / 2) {
                    player.x = plat.x - player.width;
                } else {
                    player.x = plat.x + plat.width;
                }
                player.vx = 0;
            } else {
                if (player.y + player.height / 2 < plat.y + plat.height / 2) {
                    player.y = plat.y - player.height;
                    player.vy = 0;
                    player.onGround = true;
                } else {
                    player.y = plat.y + plat.height;
                    player.vy = 0;
                }
            }
        }
    }
    
    // Collect coins
    for (const coin of coins) {
        if (coin.collected) continue;
        const dist = Math.hypot(
            (player.x + player.width / 2) - coin.x,
            (player.y + player.height / 2) - coin.y
        );
        if (dist < 24) {
            coin.collected = true;
            score += 10;
            spawnParticles(coin.x, coin.y, COLORS.coin, 8);
        }
    }
    
    // Hit spikes
    const playerRect = { x: player.x + 4, y: player.y + 4, width: player.width - 8, height: player.height - 8 };
    for (const spike of spikes) {
        if (rectCollide(playerRect, spike)) {
            gameState = 'gameover';
            spawnParticles(player.x + player.width / 2, player.y + player.height / 2, '#E53935', 20);
            return;
        }
    }
    
    // Fall off screen
    if (player.y > canvas.height + 100) {
        gameState = 'gameover';
        return;
    }
    
    // Reach flag
    if (player.x + player.width > flagPos.x && player.x < flagPos.x + TILE_SIZE &&
        player.y + player.height > flagPos.y && player.y < flagPos.y + TILE_SIZE * 3) {
        score += 50;
        level++;
        generateLevel(level);
        resetPlayer();
        spawnParticles(flagPos.x, flagPos.y, COLORS.flag, 15);
    }
    
    // Camera
    const targetCameraX = player.x - SCROLL_THRESHOLD;
    cameraX += (targetCameraX - cameraX) * 0.08 * dt;
    if (cameraX < 0) cameraX = 0;
    
    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 0.2 * dt;
        p.life -= 0.03 * dt;
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

// === DRAW ===
function draw() {
    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, COLORS.sky);
    gradient.addColorStop(1, COLORS.skyGradient);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (gameState === 'start') {
        drawStartScreen();
        return;
    }
    
    if (gameState === 'gameover') {
        drawGameOverScreen();
        return;
    }
    
    // Grid (maker style)
    drawGrid();
    
    // Clouds (parallax)
    drawClouds();
    
    ctx.save();
    ctx.translate(-cameraX, 0);
    
    // Ground tiles
    for (const tile of levelData) {
        if (tile.x < cameraX - TILE_SIZE || tile.x > cameraX + canvas.width + TILE_SIZE) continue;
        drawGroundTile(tile.x, tile.y);
    }
    
    // Platforms
    for (const plat of platforms) {
        if (plat.x + plat.width < cameraX || plat.x > cameraX + canvas.width) continue;
        drawPlatform(plat);
    }
    
    // Spikes
    for (const spike of spikes) {
        if (spike.x < cameraX - TILE_SIZE || spike.x > cameraX + canvas.width + TILE_SIZE) continue;
        drawSpike(spike);
    }
    
    // Coins
    const time = performance.now() / 1000;
    for (const coin of coins) {
        if (coin.collected) continue;
        if (coin.x < cameraX - TILE_SIZE || coin.x > cameraX + canvas.width + TILE_SIZE) continue;
        drawCoin(coin, time);
    }
    
    // Flag
    drawFlag();
    
    // Player
    drawPlayer();
    
    // Particles
    for (const p of particles) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    
    ctx.restore();
    
    // HUD
    drawHUD();
}

function drawGrid() {
    ctx.strokeStyle = COLORS.gridLine;
    ctx.lineWidth = 1;
    const offsetX = -cameraX % TILE_SIZE;
    for (let x = offsetX; x < canvas.width; x += TILE_SIZE) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += TILE_SIZE) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
}

function drawClouds() {
    ctx.fillStyle = COLORS.cloud;
    const cloudOffset = cameraX * 0.2;
    for (let i = 0; i < 6; i++) {
        const cx = (i * 200 + 50) - (cloudOffset % 1200);
        const cy = 40 + (i % 3) * 30;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 40, 20, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + 25, cy - 5, 30, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx - 20, cy + 3, 25, 15, 0, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawGroundTile(x, y) {
    // Dirt
    ctx.fillStyle = COLORS.ground;
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    // Grass top
    ctx.fillStyle = COLORS.groundTop;
    ctx.fillRect(x, y, TILE_SIZE, 6);
    // Pixel details
    ctx.fillStyle = '#6D3A0A';
    ctx.fillRect(x + 4, y + 12, 4, 4);
    ctx.fillRect(x + 20, y + 20, 4, 4);
    ctx.fillRect(x + 12, y + 26, 4, 4);
    // Border
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
}

function drawPlatform(plat) {
    // Main body
    ctx.fillStyle = COLORS.platform;
    ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
    // Top highlight
    ctx.fillStyle = COLORS.platformTop;
    ctx.fillRect(plat.x, plat.y, plat.width, 6);
    // Segments
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    for (let sx = plat.x; sx < plat.x + plat.width; sx += TILE_SIZE) {
        ctx.strokeRect(sx, plat.y, TILE_SIZE, TILE_SIZE);
    }
    // Rivets
    ctx.fillStyle = '#E65100';
    for (let sx = plat.x + 4; sx < plat.x + plat.width; sx += TILE_SIZE) {
        ctx.fillRect(sx, plat.y + 10, 4, 4);
        ctx.fillRect(sx + TILE_SIZE - 8, plat.y + 10, 4, 4);
    }
}

function drawSpike(spike) {
    ctx.fillStyle = COLORS.spike;
    ctx.beginPath();
    ctx.moveTo(spike.x + TILE_SIZE / 2, spike.y + 4);
    ctx.lineTo(spike.x + 4, spike.y + TILE_SIZE - 2);
    ctx.lineTo(spike.x + TILE_SIZE - 4, spike.y + TILE_SIZE - 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = COLORS.spikeOutline;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.lineWidth = 1;
    // Shine
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.moveTo(spike.x + TILE_SIZE / 2, spike.y + 8);
    ctx.lineTo(spike.x + TILE_SIZE / 2 - 4, spike.y + 18);
    ctx.lineTo(spike.x + TILE_SIZE / 2 + 2, spike.y + 16);
    ctx.closePath();
    ctx.fill();
}

function drawCoin(coin, time) {
    const bobY = Math.sin(time * 3 + coin.bobOffset) * 3;
    const x = coin.x;
    const y = coin.y + bobY;
    const radius = 10;
    
    // Glow
    ctx.fillStyle = 'rgba(255, 215, 0, 0.2)';
    ctx.beginPath();
    ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
    ctx.fill();
    
    // Coin body
    ctx.fillStyle = COLORS.coin;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Inner circle
    ctx.strokeStyle = '#FFA000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, radius - 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1;
    
    // Star/shine
    ctx.fillStyle = COLORS.coinShine;
    ctx.fillRect(x - 2, y - 2, 4, 4);
}

function drawFlag() {
    // Pole
    ctx.fillStyle = COLORS.flagPole;
    ctx.fillRect(flagPos.x + 12, flagPos.y - 20, 6, TILE_SIZE * 3 + 20);
    // Ball on top
    ctx.fillStyle = COLORS.coin;
    ctx.beginPath();
    ctx.arc(flagPos.x + 15, flagPos.y - 24, 6, 0, Math.PI * 2);
    ctx.fill();
    // Flag
    ctx.fillStyle = COLORS.flag;
    ctx.beginPath();
    ctx.moveTo(flagPos.x + 18, flagPos.y - 18);
    ctx.lineTo(flagPos.x + 46, flagPos.y - 10);
    ctx.lineTo(flagPos.x + 18, flagPos.y + 2);
    ctx.closePath();
    ctx.fill();
    // Star on flag
    ctx.fillStyle = '#FFF';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★', flagPos.x + 30, flagPos.y - 5);
}

function drawPlayer() {
    const squishX = 1 + player.squish * 0.3;
    const squishY = 1 - player.squish * 0.3;
    
    ctx.save();
    ctx.translate(player.x + player.width / 2, player.y + player.height);
    ctx.scale(squishX * (player.facingRight ? 1 : -1), squishY);
    ctx.translate(-player.width / 2, -player.height);
    
    // Body
    ctx.fillStyle = COLORS.player;
    ctx.fillRect(2, 8, player.width - 4, player.height - 8);
    
    // Head
    ctx.fillStyle = COLORS.player;
    ctx.fillRect(4, 0, player.width - 8, 14);
    
    // Eyes
    ctx.fillStyle = COLORS.playerEyes;
    ctx.fillRect(14, 3, 8, 8);
    ctx.fillRect(6, 3, 8, 8);
    
    // Pupils
    ctx.fillStyle = COLORS.playerPupil;
    ctx.fillRect(17, 5, 4, 4);
    ctx.fillRect(9, 5, 4, 4);
    
    // Outline
    ctx.strokeStyle = COLORS.playerOutline;
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 0, player.width - 4, player.height);
    ctx.lineWidth = 1;
    
    // Legs animation
    const legOffset = player.onGround ? Math.sin(player.animFrame * Math.PI / 2) * 3 : 0;
    ctx.fillStyle = COLORS.playerOutline;
    ctx.fillRect(5, player.height - 6, 8, 6 + legOffset);
    ctx.fillRect(player.width - 13, player.height - 6, 8, 6 - legOffset);
    
    ctx.restore();
}

function drawHUD() {
    // Score
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(10, 10, 160, 36);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.strokeRect(10, 10, 160, 36);
    
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('★ ' + score, 20, 34);
    
    // Level
    ctx.fillStyle = '#fff';
    ctx.fillText('Level ' + level, 90, 34);
    
    // Coins collected
    const collected = coins.filter(c => c.collected).length;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(canvas.width - 120, 10, 110, 36);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.strokeRect(canvas.width - 120, 10, 110, 36);
    ctx.fillStyle = '#FFD700';
    ctx.textAlign = 'right';
    ctx.fillText('🪙 ' + collected + '/' + totalCoins, canvas.width - 20, 34);
}

function drawStartScreen() {
    // Background
    drawGrid();
    drawClouds();
    
    // Title box
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(canvas.width / 2 - 200, canvas.height / 2 - 130, 400, 260);
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 3;
    ctx.strokeRect(canvas.width / 2 - 200, canvas.height / 2 - 130, 400, 260);
    ctx.lineWidth = 1;
    
    // Title
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏗️ Jump & Run Maker', canvas.width / 2, canvas.height / 2 - 70);
    
    // Instructions
    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    ctx.fillText('← → oder A/D: Laufen', canvas.width / 2, canvas.height / 2 - 20);
    ctx.fillText('Leertaste / ↑ / W: Springen (2x!)', canvas.width / 2, canvas.height / 2 + 10);
    ctx.fillText('🎮 Gamepad: Stick + A-Taste', canvas.width / 2, canvas.height / 2 + 40);
    
    ctx.fillStyle = '#4CAF50';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('Leertaste / Enter zum Starten', canvas.width / 2, canvas.height / 2 + 90);
    
    // Decorative player
    ctx.fillStyle = COLORS.player;
    ctx.fillRect(canvas.width / 2 - 14, canvas.height / 2 - 125, 28, 30);
    ctx.fillStyle = '#fff';
    ctx.fillRect(canvas.width / 2 - 6, canvas.height / 2 - 120, 6, 6);
    ctx.fillRect(canvas.width / 2 + 2, canvas.height / 2 - 120, 6, 6);
}

function drawGameOverScreen() {
    // Still draw the game behind
    drawGrid();
    
    ctx.save();
    ctx.translate(-cameraX, 0);
    for (const tile of levelData) {
        if (tile.x < cameraX - TILE_SIZE || tile.x > cameraX + canvas.width + TILE_SIZE) continue;
        drawGroundTile(tile.x, tile.y);
    }
    for (const plat of platforms) {
        if (plat.x + plat.width < cameraX || plat.x > cameraX + canvas.width) continue;
        drawPlatform(plat);
    }
    for (const p of particles) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    
    // Overlay
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Game over box
    ctx.fillStyle = 'rgba(30,30,30,0.9)';
    ctx.fillRect(canvas.width / 2 - 180, canvas.height / 2 - 100, 360, 200);
    ctx.strokeStyle = '#E53935';
    ctx.lineWidth = 3;
    ctx.strokeRect(canvas.width / 2 - 180, canvas.height / 2 - 100, 360, 200);
    ctx.lineWidth = 1;
    
    ctx.fillStyle = '#E53935';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over!', canvas.width / 2, canvas.height / 2 - 50);
    
    ctx.fillStyle = '#FFD700';
    ctx.font = '22px sans-serif';
    ctx.fillText('Score: ' + score, canvas.width / 2, canvas.height / 2);
    
    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    ctx.fillText('Level erreicht: ' + level, canvas.width / 2, canvas.height / 2 + 35);
    
    ctx.fillStyle = '#4CAF50';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('Leertaste / Enter: Nochmal', canvas.width / 2, canvas.height / 2 + 75);
}

// === GAME CONTROL ===
function startGame() {
    score = 0;
    level = 1;
    cameraX = 0;
    gameState = 'playing';
    lastTime = 0;
    generateLevel(level);
    resetPlayer();
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

// Start
requestAnimationFrame(gameLoop);
