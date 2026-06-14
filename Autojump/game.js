const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const TARGET_FPS = 60;
let lastTime = 0;

// Game states
let gameState = 'start';
let score = 0;
let highScore = 0;
let difficulty = 1;

// World - scrolls to the left, player runs right automatically
const SCROLL_SPEED_BASE = 2.5;
let scrollSpeed = SCROLL_SPEED_BASE;
let worldOffset = 0;

// Ground
const GROUND_Y = canvas.height - 50;

// Player
const player = {
    x: 150, // fixed screen position
    y: 0,
    width: 30,
    height: 40,
    vy: 0,
    onPlatform: false,
    jumpsLeft: 2,
    maxJumps: 2,
    animFrame: 0,
    animTimer: 0
};

const GRAVITY = 0.4;
const JUMP_POWER = -11;

// Platforms (vehicles)
let platforms = [];

// Particles
let particles = [];

// Input
let gamepadConnected = false;
let gamepadJumpHeld = false;

// Colors
const COLORS = {
    sky: '#1a1a2e',
    skyBottom: '#2c3e50',
    road: '#34495e',
    roadLine: '#f1c40f',
    player: '#e74c3c',
    playerDark: '#c0392b',
    skin: '#f39c12',
    text: '#ecf0f1'
};

function createPlatform(worldX) {
    const types = ['car_red', 'car_blue', 'car_green', 'truck', 'bus'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    let width, height, color;
    
    switch(type) {
        case 'car_red':
            width = 90; height = 35; color = '#e74c3c'; break;
        case 'car_blue':
            width = 90; height = 35; color = '#3498db'; break;
        case 'car_green':
            width = 90; height = 35; color = '#2ecc71'; break;
        case 'truck':
            width = 120; height = 45; color = '#8e44ad'; break;
        case 'bus':
            width = 140; height = 40; color = '#e67e22'; break;
    }
    
    // Platforms at ground level or slightly elevated
    const yVariation = Math.random() * 40;
    const y = GROUND_Y - height - yVariation;
    
    return {
        worldX,
        y,
        width,
        height,
        type,
        color,
        scored: false
    };
}

function initPlatforms() {
    platforms = [];
    
    // Starting platform - long and safe
    platforms.push({
        worldX: 80,
        y: GROUND_Y - 35,
        width: 150,
        height: 35,
        type: 'bus',
        color: '#e67e22',
        scored: false
    });
    
    // Generate platforms ahead
    let lastX = 230;
    for (let i = 0; i < 12; i++) {
        // Gap between platforms - easy at start
        const gap = 50 + Math.random() * 40;
        lastX += gap;
        const plat = createPlatform(lastX);
        platforms.push(plat);
        lastX += plat.width;
    }
}

function spawnMorePlatforms() {
    const furthestNeeded = worldOffset + canvas.width + 300;
    
    // Find rightmost platform
    let maxX = 0;
    for (const p of platforms) {
        const end = p.worldX + p.width;
        if (end > maxX) maxX = end;
    }
    
    while (maxX < furthestNeeded) {
        // Gap scales with difficulty but stays manageable
        const minGap = 40;
        const maxGap = 60 + difficulty * 5;
        const gap = minGap + Math.random() * (maxGap - minGap);
        maxX += gap;
        const plat = createPlatform(maxX);
        platforms.push(plat);
        maxX += plat.width;
    }
}

function addParticles(x, y, count, color) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x + Math.random() * 12 - 6,
            y: y + Math.random() * 6 - 3,
            vx: (Math.random() - 0.5) * 3,
            vy: -Math.random() * 3 - 1,
            life: 1,
            decay: 0.03 + Math.random() * 0.02,
            color,
            size: 2 + Math.random() * 3
        });
    }
}

function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 0.15 * dt;
        p.life -= p.decay * dt;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function drawParticles() {
    for (const p of particles) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        const screenX = p.x - worldOffset;
        ctx.fillRect(screenX - p.size/2, p.y - p.size/2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
}

function handleGamepadInput() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of gamepads) {
        if (!gp) continue;
        gamepadConnected = true;
        
        // Jump: A button or Up on stick
        const jumpPressed = (gp.buttons[0] && gp.buttons[0].pressed) || gp.axes[1] < -0.5;
        
        if (jumpPressed && !gamepadJumpHeld) {
            gamepadJumpHeld = true;
            if (gameState === 'start' || gameState === 'gameover') {
                startGame();
            } else {
                doJump();
            }
        }
        if (!jumpPressed) {
            gamepadJumpHeld = false;
        }
        
        // Start button
        if (gp.buttons[9] && gp.buttons[9].pressed) {
            if (gameState !== 'playing') startGame();
        }
    }
}

function doJump() {
    if (player.jumpsLeft > 0) {
        player.vy = JUMP_POWER;
        player.onPlatform = false;
        player.jumpsLeft--;
        
        if (player.jumpsLeft === 0) {
            addParticles(player.x + worldOffset, player.y + player.height, 6, '#f39c12');
        } else {
            addParticles(player.x + worldOffset, player.y + player.height, 4, '#bdc3c7');
        }
    }
}

function update(dt) {
    if (gameState !== 'playing') return;
    
    handleGamepadInput();
    
    // World scrolls - player runs automatically
    worldOffset += scrollSpeed * dt;
    
    // Difficulty increases slowly
    difficulty = 1 + Math.floor(worldOffset / 1500);
    scrollSpeed = SCROLL_SPEED_BASE + difficulty * 0.12;
    
    // Gravity
    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;
    
    // Platform collision
    player.onPlatform = false;
    const playerWorldX = player.x + worldOffset;
    const playerBottom = player.y + player.height;
    const playerLeft = playerWorldX - player.width / 2;
    const playerRight = playerWorldX + player.width / 2;
    
    for (const plat of platforms) {
        const platTop = plat.y;
        const platLeft = plat.worldX;
        const platRight = plat.worldX + plat.width;
        
        // Land on top
        if (player.vy >= 0 &&
            playerRight > platLeft + 5 &&
            playerLeft < platRight - 5 &&
            playerBottom >= platTop &&
            playerBottom <= platTop + 12 + Math.abs(player.vy) * dt) {
            
            player.y = platTop - player.height;
            player.vy = 0;
            player.onPlatform = true;
            player.jumpsLeft = player.maxJumps;
            
            if (!plat.scored) {
                plat.scored = true;
                score += 10;
                addParticles(playerWorldX, player.y + player.height, 3, '#2ecc71');
            }
            break;
        }
    }
    
    // Animation
    if (player.onPlatform) {
        player.animTimer += dt * scrollSpeed;
        if (player.animTimer > 4) {
            player.animTimer = 0;
            player.animFrame = (player.animFrame + 1) % 4;
        }
    }
    
    // Fall off screen = game over
    if (player.y > canvas.height + 50) {
        gameOver();
        return;
    }
    
    // Score from distance
    const distScore = Math.floor(worldOffset / 20);
    score = Math.max(score, distScore);
    
    // Remove old platforms
    platforms = platforms.filter(p => p.worldX + p.width > worldOffset - 100);
    
    // Spawn new platforms
    spawnMorePlatforms();
    
    // Particles
    updateParticles(dt);
}

function drawBackground() {
    // Sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, COLORS.sky);
    grad.addColorStop(1, COLORS.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Distant city silhouette (parallax)
    ctx.fillStyle = '#16213e';
    const parallax = worldOffset * 0.15;
    for (let i = 0; i < 20; i++) {
        const bx = ((i * 80) - parallax % 80 + canvas.width + 80) % (canvas.width + 80) - 40;
        const bh = 30 + Math.sin(i * 1.7) * 25 + 25;
        ctx.fillRect(bx, GROUND_Y - bh - 60, 40, bh + 60);
    }
    
    // Road / ground area (danger zone)
    ctx.fillStyle = COLORS.road;
    ctx.fillRect(0, GROUND_Y, canvas.width, canvas.height - GROUND_Y);
    
    // Danger stripes at bottom
    ctx.fillStyle = 'rgba(231, 76, 60, 0.3)';
    ctx.fillRect(0, GROUND_Y, canvas.width, canvas.height - GROUND_Y);
    
    // Road markings
    ctx.fillStyle = COLORS.roadLine;
    const lineOffset = (worldOffset * 3) % 40;
    for (let x = -lineOffset; x < canvas.width; x += 40) {
        ctx.fillRect(x, GROUND_Y + 20, 20, 3);
    }
}

function drawPlatform(plat) {
    const screenX = plat.worldX - worldOffset;
    const y = plat.y;
    const w = plat.width;
    const h = plat.height;
    
    if (screenX + w < -20 || screenX > canvas.width + 20) return;
    
    // Vehicle top surface (the platform you land on)
    ctx.fillStyle = plat.color;
    ctx.beginPath();
    ctx.roundRect(screenX, y, w, h, 6);
    ctx.fill();
    
    // Top highlight
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(screenX + 4, y + 2, w - 8, 4);
    
    switch(plat.type) {
        case 'car_red':
        case 'car_blue':
        case 'car_green':
            // Windshield
            ctx.fillStyle = '#85c1e9';
            ctx.fillRect(screenX + 10, y + 8, 20, h - 14);
            ctx.fillRect(screenX + w - 30, y + 8, 20, h - 14);
            // Wheels
            ctx.fillStyle = '#1a1a2e';
            ctx.beginPath();
            ctx.arc(screenX + 18, y + h + 3, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(screenX + w - 18, y + h + 3, 6, 0, Math.PI * 2);
            ctx.fill();
            break;
        case 'truck':
            // Cargo area
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.fillRect(screenX + 5, y + 6, w * 0.6, h - 10);
            // Cabin
            ctx.fillStyle = '#85c1e9';
            ctx.fillRect(screenX + w - 30, y + 8, 20, h - 14);
            // Wheels
            ctx.fillStyle = '#1a1a2e';
            ctx.beginPath();
            ctx.arc(screenX + 20, y + h + 4, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(screenX + 50, y + h + 4, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(screenX + w - 20, y + h + 4, 7, 0, Math.PI * 2);
            ctx.fill();
            break;
        case 'bus':
            // Windows
            ctx.fillStyle = '#85c1e9';
            for (let wx = screenX + 12; wx < screenX + w - 15; wx += 22) {
                ctx.fillRect(wx, y + 8, 15, h - 14);
            }
            // Wheels
            ctx.fillStyle = '#1a1a2e';
            ctx.beginPath();
            ctx.arc(screenX + 25, y + h + 4, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(screenX + w - 25, y + h + 4, 7, 0, Math.PI * 2);
            ctx.fill();
            break;
    }
}

function drawPlayer() {
    const x = player.x;
    const y = player.y;
    const w = player.width;
    const h = player.height;
    
    // Shadow
    if (!player.onPlatform) {
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        const shadowY = GROUND_Y - 3;
        ctx.beginPath();
        ctx.ellipse(x, shadowY, w/2, 5, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Body
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.roundRect(x - w/4, y + 8, w/2, h * 0.5, 4);
    ctx.fill();
    
    // Head
    ctx.fillStyle = COLORS.skin;
    ctx.beginPath();
    ctx.arc(x, y + 6, 9, 0, Math.PI * 2);
    ctx.fill();
    
    // Hair
    ctx.fillStyle = '#2c3e50';
    ctx.beginPath();
    ctx.arc(x, y + 3, 7, Math.PI, Math.PI * 2);
    ctx.fill();
    
    // Legs (animated when running)
    ctx.fillStyle = '#2c3e50';
    if (player.onPlatform) {
        const legAnim = Math.sin(player.animFrame * Math.PI / 2) * 4;
        ctx.fillRect(x - 7, y + h * 0.6, 5, 12 + legAnim);
        ctx.fillRect(x + 2, y + h * 0.6, 5, 12 - legAnim);
    } else {
        // In air - tucked
        ctx.fillRect(x - 7, y + h * 0.6, 5, 8);
        ctx.fillRect(x + 2, y + h * 0.6, 5, 8);
    }
    
    // Arms
    ctx.fillStyle = COLORS.playerDark;
    if (player.onPlatform) {
        const armAnim = Math.cos(player.animFrame * Math.PI / 2) * 3;
        ctx.fillRect(x - w/4 - 4, y + 12 + armAnim, 4, 11);
        ctx.fillRect(x + w/4, y + 12 - armAnim, 4, 11);
    } else {
        // Arms up
        ctx.fillRect(x - w/4 - 4, y + 5, 4, 10);
        ctx.fillRect(x + w/4, y + 5, 4, 10);
    }
    
    // Jump dots
    for (let i = 0; i < player.jumpsLeft; i++) {
        ctx.fillStyle = '#f39c12';
        ctx.beginPath();
        ctx.arc(x - 8 + i * 16, y - 8, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath();
        ctx.arc(x - 9 + i * 16, y - 9, 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawHUD() {
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score, 15, 30);
    
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#95a5a6';
    ctx.fillText(Math.floor(worldOffset / 10) + 'm', 15, 48);
    
    if (highScore > 0) {
        ctx.textAlign = 'right';
        ctx.fillStyle = COLORS.text;
        ctx.font = '16px sans-serif';
        ctx.fillText('Best: ' + highScore, canvas.width - 15, 30);
    }
    
    if (gamepadConnected) {
        ctx.textAlign = 'right';
        ctx.font = '14px sans-serif';
        ctx.fillText('🎮', canvas.width - 15, 50);
    }
}

function drawStartScreen() {
    drawBackground();
    
    // Draw some sample platforms
    const samplePlats = [
        { worldX: 100, y: GROUND_Y - 35, width: 120, height: 35, type: 'bus', color: '#e67e22' },
        { worldX: 280, y: GROUND_Y - 40, width: 90, height: 35, type: 'car_blue', color: '#3498db' },
        { worldX: 430, y: GROUND_Y - 30, width: 100, height: 35, type: 'car_green', color: '#2ecc71' }
    ];
    for (const p of samplePlats) drawPlatform(p);
    
    // Overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Straßen-Springer', canvas.width / 2, canvas.height / 2 - 100);
    
    ctx.strokeStyle = COLORS.roadLine;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2 - 120, canvas.height / 2 - 78);
    ctx.lineTo(canvas.width / 2 + 120, canvas.height / 2 - 78);
    ctx.stroke();
    
    ctx.font = '17px sans-serif';
    ctx.fillStyle = '#bdc3c7';
    ctx.fillText('Springe von Auto zu Auto!', canvas.width / 2, canvas.height / 2 - 50);
    ctx.fillText('Nicht auf die Straße fallen!', canvas.width / 2, canvas.height / 2 - 25);
    
    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#95a5a6';
    ctx.fillText('⬆ / Leertaste = Springen', canvas.width / 2, canvas.height / 2 + 10);
    ctx.fillText('Doppelsprung möglich! (2x drücken)', canvas.width / 2, canvas.height / 2 + 35);
    ctx.fillText('🎮 Gamepad: A = Springen', canvas.width / 2, canvas.height / 2 + 60);
    
    // Jump dots
    ctx.fillStyle = '#f39c12';
    ctx.beginPath();
    ctx.arc(canvas.width / 2 - 10, canvas.height / 2 + 82, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(canvas.width / 2 + 6, canvas.height / 2 + 82, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#95a5a6';
    ctx.font = '13px sans-serif';
    ctx.fillText('= Verbleibende Sprünge', canvas.width / 2 + 60, canvas.height / 2 + 86);
    
    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = '#f39c12';
    const blink = Math.sin(Date.now() / 500) > 0;
    if (blink) {
        ctx.fillText('Leertaste zum Starten', canvas.width / 2, canvas.height / 2 + 125);
    }
}

function drawGameOverScreen() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#e74c3c';
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over!', canvas.width / 2, canvas.height / 2 - 50);
    
    ctx.fillStyle = COLORS.text;
    ctx.font = '22px sans-serif';
    ctx.fillText('Score: ' + score, canvas.width / 2, canvas.height / 2);
    ctx.fillText(Math.floor(worldOffset / 10) + ' Meter', canvas.width / 2, canvas.height / 2 + 30);
    
    if (score >= highScore && highScore > 0) {
        ctx.fillStyle = '#f39c12';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText('🏆 Neuer Highscore! 🏆', canvas.width / 2, canvas.height / 2 + 65);
    }
    
    ctx.fillStyle = '#bdc3c7';
    ctx.font = '18px sans-serif';
    const blink = Math.sin(Date.now() / 500) > 0;
    if (blink) {
        ctx.fillText('Leertaste zum Neustarten', canvas.width / 2, canvas.height / 2 + 105);
    }
}

function draw() {
    if (gameState === 'start') {
        drawStartScreen();
        return;
    }
    
    drawBackground();
    
    for (const plat of platforms) {
        drawPlatform(plat);
    }
    
    drawParticles();
    drawPlayer();
    drawHUD();
    
    if (gameState === 'gameover') {
        drawGameOverScreen();
    }
}

function startGame() {
    score = 0;
    difficulty = 1;
    scrollSpeed = SCROLL_SPEED_BASE;
    worldOffset = 0;
    
    initPlatforms();
    
    // Player starts on the first platform
    const startPlat = platforms[0];
    player.x = 150;
    player.y = startPlat.y - player.height;
    player.vy = 0;
    player.onPlatform = true;
    player.jumpsLeft = player.maxJumps;
    player.animFrame = 0;
    player.animTimer = 0;
    
    particles = [];
    
    gameState = 'playing';
    lastTime = 0;
}

function gameOver() {
    gameState = 'gameover';
    if (score > highScore) highScore = score;
    addParticles(player.x + worldOffset, player.y, 15, '#e74c3c');
}

function gameLoop(timestamp) {
    if (lastTime === 0) lastTime = timestamp;
    const elapsed = timestamp - lastTime;
    lastTime = timestamp;
    const dt = Math.min(elapsed / (1000 / TARGET_FPS), 3);
    
    if (gameState !== 'playing') {
        handleGamepadInput();
    }
    
    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
}

// Keyboard - only jump!
document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') return;
    
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        if (gameState === 'start' || gameState === 'gameover') {
            startGame();
        } else if (gameState === 'playing') {
            doJump();
        }
    }
});

// Prevent scrolling
document.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) {
        e.preventDefault();
    }
});

// Touch - tap to jump
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameState === 'start' || gameState === 'gameover') {
        startGame();
    } else if (gameState === 'playing') {
        doJump();
    }
});

// Gamepad
window.addEventListener('gamepadconnected', () => { gamepadConnected = true; });
window.addEventListener('gamepaddisconnected', () => { gamepadConnected = false; });

// Start
requestAnimationFrame(gameLoop);
