const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const TARGET_FPS = 60;
let lastTime = 0;
let gameRunning = false;
let gameOverState = false;
let score = 0;
let highScore = 0;
let difficulty = 1;
let lives = 3;
let invincibleTimer = 0; // Kurze Unverwundbarkeit nach Treffer

// Physics
const GRAVITY = 1.0;
const JUMP_FORCE = -22;
const GROUND_Y = 320;

// Player (Pferd + Mops)
let player = {
    x: 120,
    y: GROUND_Y,
    vy: 0,
    width: 64,
    height: 64,
    isJumping: false,
    jumpPressed: false,
    animFrame: 0,
    animTimer: 0
};

// Obstacles
let obstacles = [];
let obstacleTimer = 0;
let obstacleInterval = 90; // frames at 60fps equivalent

// Apples (bonus)
let apples = [];
let appleTimer = 0;
let appleInterval = 120;
let bonusScore = 0;

// Hearts (extra life)
let hearts = [];
let heartTimer = 0;
let heartInterval = 400; // Sehr selten!

// Scrolling ground
let groundScroll = 0;
let bgScroll = 0;

// Game speed
let gameSpeed = 5;

// Particles for jump effect
let particles = [];

// Gamepad
let gamepadConnected = false;

// ============ PIXEL ART DRAWING ============

function drawPixelBlock(x, y, size, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(x), Math.floor(y), size, size);
}

function drawHorse(px, py, frame) {
    const s = 4; // pixel size
    const colors = {
        body: '#8B4513',
        dark: '#5C2E0A',
        mane: '#2C1810',
        eye: '#000000'
    };
    
    // Legs animation
    let legOffset1 = 0;
    let legOffset2 = 0;
    if (gameRunning && !player.isJumping) {
        legOffset1 = Math.sin(frame * 0.3) * 3;
        legOffset2 = Math.sin(frame * 0.3 + Math.PI) * 3;
    }
    
    // Body
    for (let i = 0; i < 10; i++) {
        drawPixelBlock(px + i * s, py + 6 * s, s, colors.body);
        drawPixelBlock(px + i * s, py + 7 * s, s, colors.body);
        drawPixelBlock(px + i * s, py + 8 * s, s, colors.body);
    }
    // Belly highlight
    for (let i = 2; i < 8; i++) {
        drawPixelBlock(px + i * s, py + 7 * s, s, '#A0522D');
    }
    
    // Neck
    drawPixelBlock(px + 9 * s, py + 4 * s, s, colors.body);
    drawPixelBlock(px + 9 * s, py + 5 * s, s, colors.body);
    drawPixelBlock(px + 10 * s, py + 3 * s, s, colors.body);
    drawPixelBlock(px + 10 * s, py + 4 * s, s, colors.body);
    drawPixelBlock(px + 10 * s, py + 5 * s, s, colors.body);
    
    // Head
    drawPixelBlock(px + 11 * s, py + 2 * s, s, colors.body);
    drawPixelBlock(px + 11 * s, py + 3 * s, s, colors.body);
    drawPixelBlock(px + 12 * s, py + 2 * s, s, colors.body);
    drawPixelBlock(px + 12 * s, py + 3 * s, s, colors.body);
    drawPixelBlock(px + 13 * s, py + 3 * s, s, colors.body);
    
    // Eye
    drawPixelBlock(px + 12 * s, py + 2 * s, s, colors.eye);
    
    // Ear
    drawPixelBlock(px + 11 * s, py + 1 * s, s, colors.dark);
    
    // Mane
    drawPixelBlock(px + 9 * s, py + 3 * s, s, colors.mane);
    drawPixelBlock(px + 10 * s, py + 2 * s, s, colors.mane);
    drawPixelBlock(px + 8 * s, py + 5 * s, s, colors.mane);
    
    // Tail
    drawPixelBlock(px + 0 * s, py + 5 * s, s, colors.mane);
    drawPixelBlock(px - 1 * s, py + 4 * s, s, colors.mane);
    drawPixelBlock(px - 1 * s, py + 5 * s, s, colors.mane);
    
    // Front legs
    drawPixelBlock(px + 8 * s, py + 9 * s + legOffset1, s, colors.dark);
    drawPixelBlock(px + 8 * s, py + 10 * s + legOffset1, s, colors.dark);
    drawPixelBlock(px + 8 * s, py + 11 * s + legOffset1, s, colors.dark);
    drawPixelBlock(px + 9 * s, py + 9 * s + legOffset2, s, colors.dark);
    drawPixelBlock(px + 9 * s, py + 10 * s + legOffset2, s, colors.dark);
    drawPixelBlock(px + 9 * s, py + 11 * s + legOffset2, s, colors.dark);
    
    // Back legs
    drawPixelBlock(px + 2 * s, py + 9 * s + legOffset2, s, colors.dark);
    drawPixelBlock(px + 2 * s, py + 10 * s + legOffset2, s, colors.dark);
    drawPixelBlock(px + 2 * s, py + 11 * s + legOffset2, s, colors.dark);
    drawPixelBlock(px + 3 * s, py + 9 * s + legOffset1, s, colors.dark);
    drawPixelBlock(px + 3 * s, py + 10 * s + legOffset1, s, colors.dark);
    drawPixelBlock(px + 3 * s, py + 11 * s + legOffset1, s, colors.dark);
}

function drawMops(px, py, frame) {
    const s = 4; // pixel size
    // Mops sitzt auf dem Pferd
    const mx = px + 5 * s;
    const my = py - 2 * s;
    
    // Bobbing when running
    let bob = 0;
    if (gameRunning && !player.isJumping) {
        bob = Math.sin(frame * 0.3) * 1.5;
    }
    
    const by = my + bob;
    
    // Body (blocky/minecraft style)
    const mopsColors = {
        body: '#D2B48C',
        dark: '#8B7355',
        face: '#000000',
        tongue: '#FF6B6B'
    };
    
    // Body block
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 3; j++) {
            drawPixelBlock(mx + i * s, by + j * s, s, mopsColors.body);
        }
    }
    
    // Head (bigger, blocky)
    for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 4; j++) {
            drawPixelBlock(mx + i * s - s, by - 4 * s + j * s, s, mopsColors.body);
        }
    }
    
    // Face details
    drawPixelBlock(mx, by - 3 * s, s, mopsColors.face); // left eye
    drawPixelBlock(mx + 2 * s, by - 3 * s, s, mopsColors.face); // right eye
    drawPixelBlock(mx + s, by - 2 * s, s, mopsColors.dark); // nose
    drawPixelBlock(mx + s, by - 1 * s, s, mopsColors.tongue); // tongue
    
    // Ears
    drawPixelBlock(mx - s, by - 5 * s, s, mopsColors.dark);
    drawPixelBlock(mx + 3 * s, by - 5 * s, s, mopsColors.dark);
    
    // Curly tail
    drawPixelBlock(mx - s, by + s, s, mopsColors.dark);
    drawPixelBlock(mx - 2 * s, by, s, mopsColors.dark);
}

function drawObstacle(obs) {
    const s = 4;
    
    if (obs.type === 'fence') {
        // Wooden fence
        const fenceColor = '#8B6914';
        const postColor = '#654321';
        
        // Posts
        for (let i = 0; i < obs.height / s; i++) {
            drawPixelBlock(obs.x, obs.y + i * s, s, postColor);
            drawPixelBlock(obs.x + obs.width - s, obs.y + i * s, s, postColor);
        }
        // Rails
        for (let i = 0; i < obs.width / s; i++) {
            drawPixelBlock(obs.x + i * s, obs.y + 2 * s, s, fenceColor);
            drawPixelBlock(obs.x + i * s, obs.y + (obs.height / s - 3) * s, s, fenceColor);
        }
        // Red/white stripes on top rail
        for (let i = 0; i < obs.width / s; i++) {
            const color = i % 2 === 0 ? '#FF4444' : '#FFFFFF';
            drawPixelBlock(obs.x + i * s, obs.y, s, color);
            drawPixelBlock(obs.x + i * s, obs.y + s, s, color);
        }
    } else if (obs.type === 'hedge') {
        // Green hedge
        for (let i = 0; i < obs.width / s; i++) {
            for (let j = 0; j < obs.height / s; j++) {
                const shade = (i + j) % 3 === 0 ? '#1B5E20' : ((i + j) % 3 === 1 ? '#2E7D32' : '#388E3C');
                drawPixelBlock(obs.x + i * s, obs.y + j * s, s, shade);
            }
        }
        // Flowers
        drawPixelBlock(obs.x + 2 * s, obs.y + s, s, '#FF69B4');
        drawPixelBlock(obs.x + 6 * s, obs.y + 2 * s, s, '#FFFF00');
    } else if (obs.type === 'water') {
        // Water jump
        for (let i = 0; i < obs.width / s; i++) {
            for (let j = 0; j < obs.height / s; j++) {
                const shade = (i + Math.floor(player.animFrame * 0.1)) % 2 === 0 ? '#1565C0' : '#1976D2';
                drawPixelBlock(obs.x + i * s, obs.y + j * s, s, shade);
            }
        }
        // Small fence before water
        for (let j = 0; j < 3; j++) {
            drawPixelBlock(obs.x, obs.y - j * s - s, s, '#8B6914');
            drawPixelBlock(obs.x + obs.width - s, obs.y - j * s - s, s, '#8B6914');
        }
        for (let i = 0; i < obs.width / s; i++) {
            const color = i % 2 === 0 ? '#FF4444' : '#FFFFFF';
            drawPixelBlock(obs.x + i * s, obs.y - 3 * s, s, color);
        }
    }
}

// ============ GAME LOGIC ============

function spawnObstacle() {
    const types = ['fence', 'hedge', 'water'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    let obs = {
        x: canvas.width + 50,
        type: type,
        passed: false
    };
    
    if (type === 'fence') {
        obs.width = 32;
        obs.height = 28 + Math.floor(Math.random() * 12 * Math.min(difficulty, 2));
        obs.y = GROUND_Y + 48 - obs.height;
    } else if (type === 'hedge') {
        obs.width = 36;
        obs.height = 24 + Math.floor(Math.random() * 10 * Math.min(difficulty, 2));
        obs.y = GROUND_Y + 48 - obs.height;
    } else if (type === 'water') {
        obs.width = 44 + Math.floor(Math.random() * 16 * Math.min(difficulty, 2));
        obs.height = 12;
        obs.y = GROUND_Y + 36;
    }
    
    obstacles.push(obs);
}

function spawnApple() {
    apples.push({
        x: canvas.width + 30,
        y: GROUND_Y - 40 - Math.random() * 80,
        size: 16,
        bobOffset: Math.random() * Math.PI * 2,
        collected: false
    });
}

function spawnHeart() {
    hearts.push({
        x: canvas.width + 30,
        y: GROUND_Y - 60 - Math.random() * 60,
        size: 16,
        bobOffset: Math.random() * Math.PI * 2
    });
}

function drawApple(apple) {
    const ax = apple.x;
    const ay = apple.y + Math.sin(Date.now() * 0.004 + apple.bobOffset) * 6;
    const s = 4;
    
    // Apple body (red)
    ctx.fillStyle = '#FF2222';
    ctx.fillRect(ax, ay, s * 3, s * 3);
    ctx.fillRect(ax - s, ay + s, s, s * 2);
    ctx.fillRect(ax + s * 3, ay + s, s, s * 2);
    
    // Highlight
    ctx.fillStyle = '#FF6666';
    ctx.fillRect(ax, ay, s, s);
    
    // Stem
    ctx.fillStyle = '#4E2A04';
    ctx.fillRect(ax + s, ay - s, s, s);
    
    // Leaf
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(ax + s * 2, ay - s, s, s);
}

function drawHeart(heart) {
    const hx = heart.x;
    const hy = heart.y + Math.sin(Date.now() * 0.003 + heart.bobOffset) * 8;
    const s = 4;
    
    // Pixel heart shape - glowing pink
    ctx.fillStyle = '#FF1493';
    // Top bumps
    ctx.fillRect(hx + s, hy, s, s);
    ctx.fillRect(hx + 2 * s, hy, s, s);
    ctx.fillRect(hx + 4 * s, hy, s, s);
    ctx.fillRect(hx + 5 * s, hy, s, s);
    // Second row
    ctx.fillRect(hx, hy + s, s * 3, s);
    ctx.fillRect(hx + 3 * s, hy + s, s * 3, s);
    // Middle full
    ctx.fillRect(hx, hy + 2 * s, s * 6, s);
    // Narrowing
    ctx.fillRect(hx + s, hy + 3 * s, s * 4, s);
    ctx.fillRect(hx + 2 * s, hy + 4 * s, s * 2, s);
    
    // Highlight
    ctx.fillStyle = '#FF69B4';
    ctx.fillRect(hx + s, hy + s, s, s);
    
    // Sparkle around it
    ctx.fillStyle = 'rgba(255, 20, 147, ' + (0.3 + Math.sin(Date.now() * 0.008) * 0.3) + ')';
    ctx.fillRect(hx - s, hy - s, s, s);
    ctx.fillRect(hx + 6 * s, hy + s, s, s);
    ctx.fillRect(hx + 2 * s, hy + 5 * s, s, s);
}

function addJumpParticles() {
    for (let i = 0; i < 5; i++) {
        particles.push({
            x: player.x + 32,
            y: GROUND_Y + 48,
            vx: (Math.random() - 0.5) * 4,
            vy: -Math.random() * 3,
            life: 20,
            color: '#8B6914'
        });
    }
}

function resetGame() {
    player.y = GROUND_Y;
    player.vy = 0;
    player.isJumping = false;
    player.jumpPressed = false;
    player.animFrame = 0;
    player.animTimer = 0;
    obstacles = [];
    apples = [];
    hearts = [];
    particles = [];
    obstacleTimer = 0;
    obstacleInterval = 90;
    appleTimer = 0;
    bonusScore = 0;
    heartTimer = 0;
    gameSpeed = 5;
    difficulty = 1;
    score = 0;
    lives = 3;
    invincibleTimer = 0;
    groundScroll = 0;
    bgScroll = 0;
    gameOverState = false;
    gameRunning = true;
    lastTime = 0;
}

function update(dt) {
    if (!gameRunning) return;
    
    // Gamepad input
    pollGamepad(dt);
    
    // Animation
    player.animTimer += dt;
    if (player.animTimer >= 1) {
        player.animFrame++;
        player.animTimer = 0;
    }
    
    // Jump physics
    if (player.isJumping) {
        player.vy += GRAVITY * dt;
        player.y += player.vy * dt;
        
        if (player.y >= GROUND_Y) {
            player.y = GROUND_Y;
            player.vy = 0;
            player.isJumping = false;
        }
    }
    
    // Scrolling
    groundScroll += gameSpeed * dt;
    bgScroll += gameSpeed * 0.3 * dt;
    if (groundScroll >= 40) groundScroll -= 40;
    
    // Invincibility timer
    if (invincibleTimer > 0) {
        invincibleTimer -= dt;
    }
    
    // Spawn obstacles
    obstacleTimer += dt;
    if (obstacleTimer >= obstacleInterval) {
        spawnObstacle();
        obstacleTimer = 0;
        // Randomize next interval
        obstacleInterval = 60 + Math.random() * 40 - difficulty * 5;
        if (obstacleInterval < 30) obstacleInterval = 30;
    }
    
    // Spawn apples
    appleTimer += dt;
    if (appleTimer >= appleInterval) {
        spawnApple();
        appleTimer = 0;
        appleInterval = 80 + Math.random() * 60;
    }
    
    // Spawn hearts (selten!)
    heartTimer += dt;
    if (heartTimer >= heartInterval) {
        if (lives < 3) { // Nur wenn man Leben verloren hat
            spawnHeart();
        }
        heartTimer = 0;
        heartInterval = 350 + Math.random() * 200; // Sehr selten
    }
    
    // Move obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        obstacles[i].x -= gameSpeed * dt;
        
        // Score
        if (!obstacles[i].passed && obstacles[i].x + obstacles[i].width < player.x) {
            obstacles[i].passed = true;
            score++;
            // Increase difficulty
            if (score % 5 === 0) {
                difficulty += 0.3;
                gameSpeed += 0.5;
            }
        }
        
        // Remove off-screen
        if (obstacles[i].x + obstacles[i].width < -50) {
            obstacles.splice(i, 1);
        }
    }
    
    // Move apples
    for (let i = apples.length - 1; i >= 0; i--) {
        apples[i].x -= gameSpeed * dt;
        if (apples[i].x < -30) {
            apples.splice(i, 1);
        }
    }
    
    // Move hearts
    for (let i = hearts.length - 1; i >= 0; i--) {
        hearts[i].x -= gameSpeed * 0.8 * dt; // Etwas langsamer, damit man sie sieht
        if (hearts[i].x < -30) {
            hearts.splice(i, 1);
        }
    }
    
    // Collision detection
    const playerBox = {
        x: player.x + 16,
        y: player.y + 4,
        width: 40,
        height: 44
    };
    
    // Apple collection
    for (let i = apples.length - 1; i >= 0; i--) {
        const apple = apples[i];
        const ay = apple.y + Math.sin(Date.now() * 0.004 + apple.bobOffset) * 6;
        if (playerBox.x + playerBox.width > apple.x - 4 &&
            playerBox.x < apple.x + apple.size &&
            playerBox.y < ay + apple.size &&
            playerBox.y + playerBox.height > ay) {
            // Collected!
            bonusScore += 3;
            // Sparkle particles
            for (let p = 0; p < 8; p++) {
                particles.push({
                    x: apple.x + 8,
                    y: ay + 8,
                    vx: (Math.random() - 0.5) * 6,
                    vy: (Math.random() - 0.5) * 6,
                    life: 15,
                    color: '#FFD700'
                });
            }
            apples.splice(i, 1);
        }
    }
    
    // Heart collection
    for (let i = hearts.length - 1; i >= 0; i--) {
        const heart = hearts[i];
        const hy = heart.y + Math.sin(Date.now() * 0.003 + heart.bobOffset) * 8;
        if (playerBox.x + playerBox.width > heart.x - 4 &&
            playerBox.x < heart.x + 24 &&
            playerBox.y < hy + 20 &&
            playerBox.y + playerBox.height > hy) {
            // Extra life!
            if (lives < 3) {
                lives++;
            }
            // Big pink sparkle
            for (let p = 0; p < 12; p++) {
                particles.push({
                    x: heart.x + 12,
                    y: hy + 10,
                    vx: (Math.random() - 0.5) * 8,
                    vy: (Math.random() - 0.5) * 8,
                    life: 25,
                    color: '#FF1493'
                });
            }
            hearts.splice(i, 1);
        }
    }
    
    // Obstacle collision
    if (invincibleTimer <= 0) {
        for (let obs of obstacles) {
            let hit = false;
            if (obs.type === 'water') {
                const obsBox = { x: obs.x + 4, y: obs.y, width: obs.width - 8, height: obs.height };
                if (player.y >= GROUND_Y - 5 && 
                    playerBox.x + playerBox.width > obsBox.x && 
                    playerBox.x < obsBox.x + obsBox.width) {
                    hit = true;
                }
            } else {
                const obsBox = { x: obs.x + 4, y: obs.y + 4, width: obs.width - 8, height: obs.height - 4 };
                if (playerBox.x + playerBox.width > obsBox.x &&
                    playerBox.x < obsBox.x + obsBox.width &&
                    playerBox.y + playerBox.height > obsBox.y &&
                    playerBox.y < obsBox.y + obsBox.height) {
                    hit = true;
                }
            }
            
            if (hit) {
                lives--;
                if (lives <= 0) {
                    triggerGameOver();
                    return;
                }
                // Hit but still alive - short invincibility
                invincibleTimer = 90; // ~1.5 seconds
                // Knockback particles
                for (let p = 0; p < 6; p++) {
                    particles.push({
                        x: player.x + 32,
                        y: player.y + 24,
                        vx: (Math.random() - 0.5) * 5,
                        vy: -Math.random() * 4,
                        life: 20,
                        color: '#FF4444'
                    });
                }
                break;
            }
        }
    }
    
    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].x += particles[i].vx * dt;
        particles[i].y += particles[i].vy * dt;
        particles[i].vy += 0.3 * dt;
        particles[i].life -= dt;
        if (particles[i].life <= 0) {
            particles.splice(i, 1);
        }
    }
}

function triggerGameOver() {
    gameRunning = false;
    gameOverState = true;
    const totalScore = score + bonusScore;
    if (totalScore > highScore) highScore = totalScore;
}

function draw() {
    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    skyGrad.addColorStop(0, '#87CEEB');
    skyGrad.addColorStop(0.6, '#B0E0E6');
    skyGrad.addColorStop(1, '#90EE90');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Background hills (parallax)
    ctx.fillStyle = '#6B8E23';
    for (let i = 0; i < 5; i++) {
        const hx = ((i * 200 - bgScroll * 2) % (canvas.width + 200)) - 100;
        ctx.beginPath();
        ctx.arc(hx, GROUND_Y + 60, 100, Math.PI, 0);
        ctx.fill();
    }
    
    // Clouds
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 4; i++) {
        const cx = ((i * 250 - bgScroll) % (canvas.width + 200)) - 50;
        ctx.beginPath();
        ctx.arc(cx, 50 + i * 20, 25, 0, Math.PI * 2);
        ctx.arc(cx + 25, 45 + i * 20, 20, 0, Math.PI * 2);
        ctx.arc(cx + 50, 50 + i * 20, 22, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Ground
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(0, GROUND_Y + 48, canvas.width, canvas.height - GROUND_Y - 48);
    
    // Ground detail (dirt pattern)
    ctx.fillStyle = '#7A5C12';
    for (let i = -1; i < canvas.width / 40 + 1; i++) {
        const gx = i * 40 - (groundScroll % 40);
        ctx.fillRect(gx, GROUND_Y + 48, 2, 20);
        ctx.fillRect(gx + 20, GROUND_Y + 55, 2, 15);
    }
    
    // Grass on top
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(0, GROUND_Y + 44, canvas.width, 6);
    ctx.fillStyle = '#388E3C';
    for (let i = -1; i < canvas.width / 20 + 1; i++) {
        const gx = i * 20 - (groundScroll % 20);
        ctx.fillRect(gx, GROUND_Y + 40, 3, 8);
        ctx.fillRect(gx + 10, GROUND_Y + 42, 2, 6);
    }
    
    if (!gameRunning && !gameOverState) {
        // Start Screen
        drawStartScreen();
        return;
    }
    
    // Draw obstacles
    for (let obs of obstacles) {
        drawObstacle(obs);
    }
    
    // Draw apples
    for (let apple of apples) {
        drawApple(apple);
    }
    
    // Draw hearts
    for (let heart of hearts) {
        drawHeart(heart);
    }
    
    // Draw player (horse + mops) - blink when invincible
    if (invincibleTimer <= 0 || Math.floor(invincibleTimer * 3) % 2 === 0) {
        drawHorse(player.x, player.y, player.animFrame);
        drawMops(player.x, player.y, player.animFrame);
    }
    
    // Draw particles
    for (let p of particles) {
        ctx.globalAlpha = p.life / 20;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 4, 4);
    }
    ctx.globalAlpha = 1;
    
    // Score display
    ctx.fillStyle = '#000';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Hindernisse: ' + score, 20, 30);
    
    // Bonus score
    if (bonusScore > 0) {
        ctx.fillStyle = '#FF2222';
        ctx.fillText('🍎 +' + bonusScore, 20, 55);
    }
    
    // Lives display
    ctx.textAlign = 'right';
    ctx.font = '22px sans-serif';
    let heartsStr = '';
    for (let i = 0; i < 3; i++) {
        heartsStr += i < lives ? '❤️' : '🖤';
    }
    ctx.fillText(heartsStr, canvas.width - 20, 30);
    
    // Difficulty indicator
    ctx.textAlign = 'left';
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#555';
    ctx.fillText('Level: ' + Math.floor(difficulty * 10) / 10, 20, 75);
    
    if (gameOverState) {
        drawGameOverScreen();
    }
}

function drawStartScreen() {
    // Overlay
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Title
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🐴 Mops-Springturnier 🐶', canvas.width / 2, 100);
    
    // Draw a preview horse+mops
    drawHorse(canvas.width / 2 - 40, 150, 0);
    drawMops(canvas.width / 2 - 40, 150, 0);
    
    // Instructions
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.fillText('Springe über Hindernisse & sammle 🍎!', canvas.width / 2, 260);
    
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#ccc';
    ctx.fillText('Steuerung:', canvas.width / 2, 295);
    ctx.fillText('⬆️ Pfeiltaste / W / Leertaste = Springen', canvas.width / 2, 320);
    ctx.fillText('🎮 Gamepad: A-Taste = Springen', canvas.width / 2, 345);
    
    // Start prompt
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 22px sans-serif';
    const blink = Math.sin(Date.now() * 0.005) > 0;
    if (blink) {
        ctx.fillText('Drücke LEERTASTE zum Starten!', canvas.width / 2, 385);
    }
}

function drawGameOverScreen() {
    // Overlay
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Game Over text
    ctx.fillStyle = '#FF4444';
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Abgeworfen!', canvas.width / 2, 120);
    
    // Score
    const totalScore = score + bonusScore;
    ctx.fillStyle = '#fff';
    ctx.font = '28px sans-serif';
    ctx.fillText('Hindernisse: ' + score + '  🍎 Bonus: +' + bonusScore, canvas.width / 2, 170);
    ctx.font = 'bold 30px sans-serif';
    ctx.fillStyle = '#FFD700';
    ctx.fillText('Gesamt: ' + totalScore + ' Punkte', canvas.width / 2, 210);
    
    // High score
    ctx.font = '20px sans-serif';
    ctx.fillStyle = '#ccc';
    ctx.fillText('Bester Versuch: ' + highScore, canvas.width / 2, 245);
    
    // Medal
    if (totalScore >= 30) {
        ctx.fillText('🏆 Goldmedaille!', canvas.width / 2, 280);
    } else if (totalScore >= 15) {
        ctx.fillText('🥈 Silbermedaille!', canvas.width / 2, 280);
    } else if (totalScore >= 7) {
        ctx.fillText('🥉 Bronzemedaille!', canvas.width / 2, 280);
    }
    
    // Restart
    ctx.fillStyle = '#4CAF50';
    ctx.font = 'bold 22px sans-serif';
    const blink = Math.sin(Date.now() * 0.005) > 0;
    if (blink) {
        ctx.fillText('Drücke LEERTASTE für Neustart!', canvas.width / 2, 340);
    }
}

// ============ INPUT ============

const keys = {};

document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        
        if (!gameRunning && !gameOverState) {
            resetGame();
        } else if (gameOverState) {
            resetGame();
        } else if (!player.isJumping) {
            player.vy = JUMP_FORCE;
            player.isJumping = true;
            addJumpParticles();
        }
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// Touch support
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (!gameRunning && !gameOverState) {
        resetGame();
    } else if (gameOverState) {
        resetGame();
    } else if (!player.isJumping) {
        player.vy = JUMP_FORCE;
        player.isJumping = true;
        addJumpParticles();
    }
});

// Gamepad support
function pollGamepad(dt) {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let gp of gamepads) {
        if (!gp) continue;
        gamepadConnected = true;
        
        const DEADZONE = 0.15;
        
        // A button (index 0) or D-pad up (index 12) to jump
        const jumpButton = gp.buttons[0]?.pressed || gp.buttons[12]?.pressed;
        // Left stick up
        const stickUp = gp.axes[1] < -DEADZONE;
        
        if ((jumpButton || stickUp) && !player.jumpPressed) {
            if (!gameRunning && !gameOverState) {
                resetGame();
            } else if (gameOverState) {
                resetGame();
            } else if (!player.isJumping) {
                player.vy = JUMP_FORCE;
                player.isJumping = true;
                addJumpParticles();
            }
            player.jumpPressed = true;
        }
        
        if (!jumpButton && !stickUp) {
            player.jumpPressed = false;
        }
    }
}

// ============ GAME LOOP ============

function gameLoop(timestamp) {
    if (lastTime === 0) lastTime = timestamp;
    const elapsed = timestamp - lastTime;
    lastTime = timestamp;
    const dt = Math.min(elapsed / (1000 / TARGET_FPS), 3);
    
    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
}

// Start the loop
requestAnimationFrame(gameLoop);
