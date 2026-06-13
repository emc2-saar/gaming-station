const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const TARGET_FPS = 60;
const BLOCK = 8; // Minecraft-style block size
let lastTime = 0;
let gameRunning = false;
let gameOverState = false;
let score = 0;
let highScore = 0;
let difficulty = 1;

// Player
const player = {
    x: 240,
    y: 500,
    width: 32,
    height: 48,
    speed: 4,
    vx: 0,
    vy: 0
};

// Input
const keys = {};
let gamepadConnected = false;

// Obstacles
let obstacles = [];
let spawnAccumulator = 0;
let spawnInterval = 60; // frames worth at target fps

// Bubbles (decoration)
let bubbles = [];
let bubbleAccumulator = 0;

// Seaweed decoration at bottom
let seaweeds = [];

// Coins
let coins = [];
let coinSpawnAccumulator = 0;
let coinSpawnInterval = 90; // frames worth at target fps
let coinsCollected = 0;
let coinBonusPoints = 50; // points per coin
let coinEffects = []; // visual feedback when collecting

// Water particles
let waterParticles = [];
let particleAccumulator = 0;

// Colors - Minecraft ocean palette
const COLORS = {
    deepWater: '#0c2d48',
    midWater: '#145374',
    lightWater: '#1a6fa3',
    sand: '#c2b280',
    coral: '#ff6b6b',
    coralDark: '#cc5555',
    rock: '#555555',
    rockDark: '#333333',
    rockLight: '#777777',
    jellyfish: '#ff99ff',
    jellyfishGlow: '#ffccff',
    seaweed: '#2d8a4e',
    seaweedDark: '#1f6b3a',
    playerSkin: '#c8a05a',
    playerShirt: '#3498db',
    playerHair: '#4a3320',
    bubble: 'rgba(200, 230, 255, 0.4)',
    bubbleEdge: 'rgba(255, 255, 255, 0.6)',
    coinGold: '#f4c542',
    coinDark: '#d4a520',
    coinLight: '#ffe066',
    coinShine: '#fff8cc'
};

// === DRAWING HELPERS (Minecraft Block Style) ===

function drawBlock(x, y, size, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(x), Math.floor(y), size, size);
}

function drawBlockRect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(x), Math.floor(y), w, h);
}

// === PLAYER DRAWING (Minecraft Steve-like) ===

function drawPlayer() {
    const px = Math.floor(player.x - player.width / 2);
    const py = Math.floor(player.y - player.height / 2);
    const b = BLOCK / 2; // half-block for detail

    // Swimming animation - arms move
    const swimCycle = Math.sin(Date.now() / 200) * 2;

    // Body (shirt)
    drawBlockRect(px + 8, py + 16, 16, 20, COLORS.playerShirt);
    
    // Head
    drawBlockRect(px + 8, py, 16, 16, COLORS.playerSkin);
    
    // Hair
    drawBlockRect(px + 8, py, 16, 6, COLORS.playerHair);
    
    // Eyes
    drawBlockRect(px + 12, py + 8, 3, 3, '#fff');
    drawBlockRect(px + 19, py + 8, 3, 3, '#fff');
    drawBlockRect(px + 13, py + 9, 2, 2, '#222');
    drawBlockRect(px + 20, py + 9, 2, 2, '#222');
    
    // Arms (swimming motion)
    const armOffset = Math.floor(swimCycle);
    drawBlockRect(px + 1, py + 18 + armOffset, 7, 6, COLORS.playerSkin);
    drawBlockRect(px + 24, py + 18 - armOffset, 7, 6, COLORS.playerSkin);
    
    // Legs (kicking)
    const legOffset = Math.floor(swimCycle);
    drawBlockRect(px + 9, py + 36, 6, 10 + legOffset, COLORS.playerShirt);
    drawBlockRect(px + 17, py + 36, 6, 10 - legOffset, COLORS.playerShirt);
    
    // Feet
    drawBlockRect(px + 9, py + 44 + legOffset, 6, 4, COLORS.playerSkin);
    drawBlockRect(px + 17, py + 44 - legOffset, 6, 4, COLORS.playerSkin);
}

// === OBSTACLE TYPES ===

function createObstacle() {
    const types = ['rock', 'coral', 'jellyfish', 'pufferfish'];
    const weights = [0.35, 0.25, 0.25, 0.15];
    
    let rand = Math.random();
    let type = types[0];
    let cumWeight = 0;
    for (let i = 0; i < weights.length; i++) {
        cumWeight += weights[i];
        if (rand < cumWeight) {
            type = types[i];
            break;
        }
    }

    const baseSpeed = 2 + difficulty * 0.3;
    const speedVariation = Math.random() * 1.5;

    let obs = {
        x: Math.random() * (canvas.width - 48) + 24,
        y: -60,
        type: type,
        speed: baseSpeed + speedVariation,
        width: 0,
        height: 0,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.02 + Math.random() * 0.02
    };

    switch(type) {
        case 'rock':
            obs.width = 32 + Math.floor(Math.random() * 3) * 8;
            obs.height = 24 + Math.floor(Math.random() * 2) * 8;
            break;
        case 'coral':
            obs.width = 24 + Math.floor(Math.random() * 2) * 8;
            obs.height = 32 + Math.floor(Math.random() * 3) * 8;
            break;
        case 'jellyfish':
            obs.width = 28;
            obs.height = 36;
            obs.tentaclePhase = Math.random() * Math.PI * 2;
            break;
        case 'pufferfish':
            obs.width = 24;
            obs.height = 24;
            obs.puffed = Math.random() > 0.5;
            if (obs.puffed) {
                obs.width = 36;
                obs.height = 36;
            }
            break;
    }

    return obs;
}

function drawObstacle(obs) {
    const ox = Math.floor(obs.x - obs.width / 2);
    const oy = Math.floor(obs.y - obs.height / 2);

    switch(obs.type) {
        case 'rock':
            // Main rock body
            drawBlockRect(ox + 4, oy + 4, obs.width - 8, obs.height - 4, COLORS.rockDark);
            drawBlockRect(ox, oy, obs.width - 4, obs.height - 4, COLORS.rock);
            // Highlight
            drawBlockRect(ox + 4, oy + 4, 8, 8, COLORS.rockLight);
            // Moss
            drawBlockRect(ox + 8, oy, 8, 4, COLORS.seaweedDark);
            break;

        case 'coral':
            // Coral branches (blocky)
            drawBlockRect(ox + 8, oy, 8, obs.height, COLORS.coralDark);
            drawBlockRect(ox, oy + 8, obs.width, 8, COLORS.coral);
            drawBlockRect(ox + 4, oy + 4, 4, obs.height - 8, COLORS.coral);
            drawBlockRect(ox + obs.width - 8, oy + 4, 4, obs.height - 8, COLORS.coral);
            // Tips
            drawBlock(ox, oy + 4, BLOCK, '#ff8888');
            drawBlock(ox + obs.width - 8, oy, BLOCK, '#ff8888');
            break;

        case 'jellyfish':
            // Bell/head
            const jPhase = Math.sin(obs.tentaclePhase);
            drawBlockRect(ox + 4, oy, 20, 16, COLORS.jellyfishGlow);
            drawBlockRect(ox + 2, oy + 4, 24, 12, COLORS.jellyfish);
            // Eyes
            drawBlockRect(ox + 8, oy + 8, 4, 4, '#440044');
            drawBlockRect(ox + 16, oy + 8, 4, 4, '#440044');
            // Tentacles (wavy with blocks)
            for (let t = 0; t < 4; t++) {
                const tx = ox + 4 + t * 6;
                const tentLen = 16 + Math.floor(jPhase * 3);
                for (let s = 0; s < tentLen; s += 4) {
                    const wobble = Math.sin(obs.tentaclePhase + s * 0.3 + t) * 3;
                    drawBlock(tx + Math.floor(wobble), oy + 16 + s, 3, 
                        s % 8 === 0 ? COLORS.jellyfishGlow : COLORS.jellyfish);
                }
            }
            break;

        case 'pufferfish':
            const size = obs.puffed ? 36 : 24;
            const cx = Math.floor(obs.x - size / 2);
            const cy = Math.floor(obs.y - size / 2);
            // Body
            drawBlockRect(cx + 4, cy + 4, size - 8, size - 8, '#f4c542');
            drawBlockRect(cx + 2, cy + 6, size - 4, size - 12, '#e6b730');
            // Eyes
            drawBlockRect(cx + size/2 - 8, cy + size/3, 4, 4, '#fff');
            drawBlockRect(cx + size/2 + 4, cy + size/3, 4, 4, '#fff');
            drawBlockRect(cx + size/2 - 7, cy + size/3 + 1, 2, 2, '#000');
            drawBlockRect(cx + size/2 + 5, cy + size/3 + 1, 2, 2, '#000');
            // Spikes if puffed
            if (obs.puffed) {
                const spikes = [
                    [cx, cy + size/2], [cx + size - 4, cy + size/2],
                    [cx + size/2, cy], [cx + size/2, cy + size - 4],
                    [cx + 4, cy + 4], [cx + size - 8, cy + 4],
                    [cx + 4, cy + size - 8], [cx + size - 8, cy + size - 8]
                ];
                spikes.forEach(s => drawBlock(s[0], s[1], 4, '#d4a520'));
            }
            // Mouth
            drawBlockRect(cx + size/2 - 2, cy + size/2 + 2, 4, 3, '#a0522d');
            break;
    }
}

// === DECORATIONS ===

function createCoin() {
    return {
        x: Math.random() * (canvas.width - 40) + 20,
        y: -30,
        width: 20,
        height: 20,
        speed: 1.5 + Math.random() * 1,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: 0.04 + Math.random() * 0.02,
        bobPhase: Math.random() * Math.PI * 2
    };
}

function drawCoin(coin) {
    const cx = Math.floor(coin.x - coin.width / 2);
    const cy = Math.floor(coin.y - coin.height / 2);
    
    // Simulate rotation by squishing width
    const rotFactor = Math.abs(Math.cos(coin.rotation));
    const visibleWidth = Math.max(4, Math.floor(coin.width * rotFactor));
    const offsetX = Math.floor((coin.width - visibleWidth) / 2);
    
    // Shadow/depth
    drawBlockRect(cx + offsetX + 2, cy + 2, visibleWidth, coin.height, COLORS.coinDark);
    
    // Main coin body
    drawBlockRect(cx + offsetX, cy, visibleWidth, coin.height, COLORS.coinGold);
    
    // Inner detail (darker border)
    if (visibleWidth > 8) {
        drawBlockRect(cx + offsetX + 2, cy + 2, visibleWidth - 4, coin.height - 4, COLORS.coinLight);
        
        // $ symbol in center (blocky)
        if (visibleWidth > 12) {
            const symX = cx + offsetX + Math.floor(visibleWidth / 2) - 2;
            const symY = cy + 4;
            drawBlockRect(symX, symY, 4, 2, COLORS.coinDark);
            drawBlockRect(symX - 2, symY + 2, 4, 2, COLORS.coinDark);
            drawBlockRect(symX, symY + 4, 4, 2, COLORS.coinDark);
            drawBlockRect(symX + 2, symY + 6, 4, 2, COLORS.coinDark);
            drawBlockRect(symX, symY + 8, 4, 2, COLORS.coinDark);
        }
    }
    
    // Shine highlight
    if (rotFactor > 0.5) {
        drawBlockRect(cx + offsetX + 2, cy + 2, 4, 4, COLORS.coinShine);
    }
}

function createCoinEffect(x, y) {
    return {
        x: x,
        y: y,
        text: '+' + coinBonusPoints,
        life: 60, // frames at target fps
        maxLife: 60
    };
}

function drawCoinEffects() {
    for (let effect of coinEffects) {
        const alpha = effect.life / effect.maxLife;
        const offsetY = (1 - alpha) * -30;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = COLORS.coinLight;
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(effect.text, effect.x, effect.y + offsetY);
        ctx.globalAlpha = 1;
    }
}

function createBubble() {
    return {
        x: Math.random() * canvas.width,
        y: canvas.height + 10,
        size: 3 + Math.random() * 6,
        speed: 0.5 + Math.random() * 1.5,
        wobble: Math.random() * Math.PI * 2
    };
}

function initSeaweeds() {
    seaweeds = [];
    for (let i = 0; i < 8; i++) {
        seaweeds.push({
            x: Math.random() * canvas.width,
            height: 30 + Math.random() * 50,
            phase: Math.random() * Math.PI * 2
        });
    }
}

// === GAME LOGIC ===

function startGame() {
    score = 0;
    difficulty = 1;
    coinsCollected = 0;
    gameRunning = true;
    gameOverState = false;
    player.x = canvas.width / 2;
    player.y = 500;
    player.vx = 0;
    player.vy = 0;
    obstacles = [];
    coins = [];
    coinEffects = [];
    bubbles = [];
    waterParticles = [];
    spawnAccumulator = 0;
    coinSpawnAccumulator = 0;
    bubbleAccumulator = 0;
    particleAccumulator = 0;
    lastTime = 0;
    initSeaweeds();
}

function endGame() {
    gameRunning = false;
    gameOverState = true;
    if (score > highScore) highScore = score;
}

function pollGamepad() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < gamepads.length; i++) {
        const gp = gamepads[i];
        if (!gp) continue;
        gamepadConnected = true;

        const deadzone = 0.15;
        
        // Left stick
        if (Math.abs(gp.axes[0]) > deadzone) {
            player.vx = gp.axes[0] * player.speed;
        }
        if (Math.abs(gp.axes[1]) > deadzone) {
            player.vy = gp.axes[1] * player.speed;
        }

        // D-pad
        if (gp.buttons[14] && gp.buttons[14].pressed) player.vx = -player.speed;
        if (gp.buttons[15] && gp.buttons[15].pressed) player.vx = player.speed;
        if (gp.buttons[12] && gp.buttons[12].pressed) player.vy = -player.speed;
        if (gp.buttons[13] && gp.buttons[13].pressed) player.vy = player.speed;

        // A button to start
        if (gp.buttons[0] && gp.buttons[0].pressed && !gameRunning) {
            startGame();
        }

        return;
    }
}

function update(dt) {
    if (!gameRunning) return;

    // Score
    score += dt;
    difficulty = 1 + Math.floor(score / 300) * 0.5;

    // Input
    player.vx = 0;
    player.vy = 0;

    if (keys['ArrowLeft'] || keys['KeyA']) player.vx = -player.speed;
    if (keys['ArrowRight'] || keys['KeyD']) player.vx = player.speed;
    if (keys['ArrowUp'] || keys['KeyW']) player.vy = -player.speed;
    if (keys['ArrowDown'] || keys['KeyS']) player.vy = player.speed;

    pollGamepad();

    // Move player
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    // Bounds
    player.x = Math.max(player.width / 2, Math.min(canvas.width - player.width / 2, player.x));
    player.y = Math.max(player.height / 2, Math.min(canvas.height - player.height / 2, player.y));

    // Spawn obstacles
    spawnAccumulator += dt;
    const currentSpawnInterval = Math.max(20, spawnInterval - difficulty * 5);
    if (spawnAccumulator >= currentSpawnInterval) {
        spawnAccumulator -= currentSpawnInterval;
        obstacles.push(createObstacle());
    }

    // Spawn coins
    coinSpawnAccumulator += dt;
    const currentCoinInterval = Math.max(50, coinSpawnInterval - difficulty * 3);
    if (coinSpawnAccumulator >= currentCoinInterval) {
        coinSpawnAccumulator -= currentCoinInterval;
        coins.push(createCoin());
    }

    // Update coins
    for (let i = coins.length - 1; i >= 0; i--) {
        const coin = coins[i];
        coin.y += coin.speed * dt;
        coin.rotation += coin.rotSpeed * dt;
        coin.bobPhase += 0.05 * dt;
        coin.x += Math.sin(coin.bobPhase) * 0.3 * dt;

        // Remove off-screen
        if (coin.y > canvas.height + 40) {
            coins.splice(i, 1);
            continue;
        }

        // Collision with player (collect!)
        const margin = 2;
        if (player.x - player.width/2 + margin < coin.x + coin.width/2 &&
            player.x + player.width/2 - margin > coin.x - coin.width/2 &&
            player.y - player.height/2 + margin < coin.y + coin.height/2 &&
            player.y + player.height/2 - margin > coin.y - coin.height/2) {
            // Collect coin!
            score += coinBonusPoints;
            coinsCollected++;
            coinEffects.push(createCoinEffect(coin.x, coin.y));
            coins.splice(i, 1);
        }
    }

    // Update coin effects
    for (let i = coinEffects.length - 1; i >= 0; i--) {
        coinEffects[i].life -= dt;
        if (coinEffects[i].life <= 0) {
            coinEffects.splice(i, 1);
        }
    }

    // Update obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        obs.y += obs.speed * dt;
        obs.wobble += obs.wobbleSpeed * dt;
        
        // Horizontal wobble for jellyfish
        if (obs.type === 'jellyfish') {
            obs.x += Math.sin(obs.wobble) * 0.5 * dt;
            obs.tentaclePhase += 0.05 * dt;
        }

        // Remove off-screen
        if (obs.y > canvas.height + 80) {
            obstacles.splice(i, 1);
            continue;
        }

        // Collision detection (rectangle-based, slightly forgiving)
        const margin = 6;
        if (player.x - player.width/2 + margin < obs.x + obs.width/2 &&
            player.x + player.width/2 - margin > obs.x - obs.width/2 &&
            player.y - player.height/2 + margin < obs.y + obs.height/2 &&
            player.y + player.height/2 - margin > obs.y - obs.height/2) {
            endGame();
            return;
        }
    }

    // Bubbles
    bubbleAccumulator += dt;
    if (bubbleAccumulator > 8) {
        bubbleAccumulator -= 8;
        bubbles.push(createBubble());
    }

    for (let i = bubbles.length - 1; i >= 0; i--) {
        bubbles[i].y -= bubbles[i].speed * dt;
        bubbles[i].wobble += 0.03 * dt;
        bubbles[i].x += Math.sin(bubbles[i].wobble) * 0.3 * dt;
        if (bubbles[i].y < -20) {
            bubbles.splice(i, 1);
        }
    }

    // Water particles (small floating specs)
    particleAccumulator += dt;
    if (particleAccumulator > 4) {
        particleAccumulator -= 4;
        waterParticles.push({
            x: Math.random() * canvas.width,
            y: -5,
            speed: 1 + Math.random() * 2,
            size: 2 + Math.random() * 3,
            alpha: 0.2 + Math.random() * 0.3
        });
    }

    for (let i = waterParticles.length - 1; i >= 0; i--) {
        waterParticles[i].y += waterParticles[i].speed * dt;
        if (waterParticles[i].y > canvas.height + 10) {
            waterParticles.splice(i, 1);
        }
    }

    // Animate seaweed
    for (let sw of seaweeds) {
        sw.phase += 0.02 * dt;
    }
}

// === DRAWING ===

function drawBackground() {
    // Gradient water
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, COLORS.deepWater);
    grad.addColorStop(0.5, COLORS.midWater);
    grad.addColorStop(1, COLORS.lightWater);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Light rays (subtle)
    ctx.globalAlpha = 0.03;
    for (let i = 0; i < 5; i++) {
        const rx = 60 + i * 100;
        ctx.fillStyle = '#88ccff';
        ctx.beginPath();
        ctx.moveTo(rx, 0);
        ctx.lineTo(rx + 40, 0);
        ctx.lineTo(rx + 60 + i * 20, canvas.height);
        ctx.lineTo(rx - 20 + i * 20, canvas.height);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function drawDecorations() {
    // Bubbles
    for (let b of bubbles) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.bubble;
        ctx.fill();
        ctx.strokeStyle = COLORS.bubbleEdge;
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // Water particles
    for (let p of waterParticles) {
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = '#aaddff';
        ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // Seaweed at bottom
    for (let sw of seaweeds) {
        const baseY = canvas.height;
        for (let seg = 0; seg < sw.height; seg += 6) {
            const wobble = Math.sin(sw.phase + seg * 0.1) * 4;
            const color = seg % 12 === 0 ? COLORS.seaweed : COLORS.seaweedDark;
            drawBlockRect(sw.x + wobble, baseY - seg - 6, 6, 6, color);
        }
    }
}

function drawHUD() {
    // Score
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('Punkte: ' + Math.floor(score), 10, 30);
    
    // Coins collected
    ctx.fillStyle = COLORS.coinGold;
    ctx.font = 'bold 16px monospace';
    ctx.fillText('🪙 ' + coinsCollected, 10, 55);

    // Difficulty indicator
    ctx.font = '12px monospace';
    ctx.fillStyle = '#88ccff';
    ctx.fillText('Tiefe: ' + Math.floor(difficulty) + 'm', 10, 75);

    // Highscore
    if (highScore > 0) {
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ffcc00';
        ctx.font = '14px monospace';
        ctx.fillText('Best: ' + Math.floor(highScore), canvas.width - 10, 30);
    }
}

function drawStartScreen() {
    drawBackground();
    
    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Ozean Schwimmer', canvas.width / 2, 180);

    // Subtitle
    ctx.font = '16px monospace';
    ctx.fillStyle = '#88ccff';
    ctx.fillText('Minecraft Ozean Edition', canvas.width / 2, 220);

    // Draw a preview player
    const origX = player.x;
    const origY = player.y;
    player.x = canvas.width / 2;
    player.y = 320;
    drawPlayer();
    player.x = origX;
    player.y = origY;

    // Controls
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px monospace';
    ctx.fillText('Steuerung:', canvas.width / 2, 420);
    ctx.font = '14px monospace';
    ctx.fillStyle = '#aaddff';
    ctx.fillText('Pfeiltasten / WASD = Schwimmen', canvas.width / 2, 450);
    ctx.fillText('Weiche den Hindernissen aus!', canvas.width / 2, 475);
    ctx.fillStyle = COLORS.coinGold;
    ctx.fillText('Sammle Münzen für Bonuspunkte!', canvas.width / 2, 500);
    
    // Start prompt
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 18px monospace';
    const blink = Math.sin(Date.now() / 500) > 0;
    if (blink) {
        ctx.fillText('LEERTASTE / A-Taste zum Starten', canvas.width / 2, 560);
    }

    // Gamepad hint
    if (gamepadConnected) {
        ctx.font = '12px monospace';
        ctx.fillStyle = '#88ff88';
        ctx.fillText('🎮 Gamepad erkannt!', canvas.width / 2, 600);
    }

    // Some decorative bubbles
    drawDecorations();
}

function drawGameOverScreen() {
    drawBackground();
    drawDecorations();
    
    // Draw obstacles still visible
    for (let obs of obstacles) {
        drawObstacle(obs);
    }

    // Overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Game Over text
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 40px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', canvas.width / 2, 220);

    // Score
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px monospace';
    ctx.fillText('Punkte: ' + Math.floor(score), canvas.width / 2, 300);

    // Coins collected
    ctx.fillStyle = COLORS.coinGold;
    ctx.font = '18px monospace';
    ctx.fillText('🪙 Münzen gesammelt: ' + coinsCollected, canvas.width / 2, 335);

    // Highscore
    if (score >= highScore) {
        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 20px monospace';
        ctx.fillText('★ Neuer Highscore! ★', canvas.width / 2, 375);
    } else {
        ctx.fillStyle = '#aaaaaa';
        ctx.font = '16px monospace';
        ctx.fillText('Bester: ' + Math.floor(highScore), canvas.width / 2, 375);
    }

    // Depth reached
    ctx.fillStyle = '#88ccff';
    ctx.font = '16px monospace';
    ctx.fillText('Erreichte Tiefe: ' + Math.floor(difficulty) + 'm', canvas.width / 2, 410);

    // Restart
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 18px monospace';
    const blink = Math.sin(Date.now() / 500) > 0;
    if (blink) {
        ctx.fillText('LEERTASTE / A-Taste für Neustart', canvas.width / 2, 480);
    }
}

function draw() {
    if (!gameRunning && !gameOverState) {
        drawStartScreen();
        return;
    }

    if (gameOverState) {
        drawGameOverScreen();
        return;
    }

    // Game running
    drawBackground();
    drawDecorations();

    // Draw coins
    for (let coin of coins) {
        drawCoin(coin);
    }

    // Draw obstacles
    for (let obs of obstacles) {
        drawObstacle(obs);
    }

    // Draw player
    drawPlayer();

    // Coin collect effects
    drawCoinEffects();

    // HUD
    drawHUD();
}

// === GAME LOOP ===

function gameLoop(timestamp) {
    if (lastTime === 0) lastTime = timestamp;
    const elapsed = timestamp - lastTime;
    lastTime = timestamp;
    const dt = Math.min(elapsed / (1000 / TARGET_FPS), 3);

    // Poll gamepad even in menus
    if (!gameRunning) pollGamepad();

    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
}

// === INPUT ===

document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    
    if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (!gameRunning) {
            startGame();
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

// Touch controls
let touchStartX = 0;
let touchStartY = 0;
let touching = false;

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (!gameRunning && !touching) {
        startGame();
        touching = true;
        return;
    }
    touching = true;
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    touchStartX = touch.clientX - rect.left;
    touchStartY = touch.clientY - rect.top;
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!gameRunning) return;
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const tx = touch.clientX - rect.left;
    const ty = touch.clientY - rect.top;
    
    // Move player towards touch position (scaled to canvas)
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    player.x = tx * scaleX;
    player.y = ty * scaleY;
});

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    touching = false;
});

// === START ===
initSeaweeds();
requestAnimationFrame(gameLoop);
