const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// === CONSTANTS ===
const TARGET_FPS = 60;
const LANE_COUNT = 5;
const LANE_WIDTH = canvas.width / LANE_COUNT;
const SWARM_Y = canvas.height - 160;

// === GAME STATE ===
let lastTime = 0;
let gameState = 'start'; // start, playing, gameover
let score = 0;
let distance = 0;
let beeCount = 5;
let maxBees = 50;
let swarmSpeed = 4;
let baseSpeed = 4;
let speedDecayTimer = 0;
let swarmLane = 2; // middle lane (0-4)
let swarmTargetX = 0;
let swarmX = canvas.width / 2;
let laneChangeSmooth = 0;

// Spawning
let spawnTimer = 0;
let spawnInterval = 40;
let difficultyTimer = 0;
let obstacleSpeed = 3;

// Objects
let obstacles = [];
let collectibleBees = [];
let flowers = [];
let particles = [];
let roadStripes = [];
let beeSwarmPositions = [];
let backgroundFlowers = [];

// Input
let keys = {};
let gamepadState = { left: false, right: false, action: false };
let lastLaneChange = 0;
let inputCooldown = 0;

// === BEE SWARM POSITIONS ===
function updateSwarmPositions() {
    beeSwarmPositions = [];
    const count = Math.min(beeCount, maxBees);
    const centerX = swarmX;
    const centerY = SWARM_Y;
    
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + performance.now() * 0.001 * (i % 2 === 0 ? 1 : -1);
        const radius = 10 + Math.sqrt(i) * 8;
        const wobbleX = Math.sin(performance.now() * 0.003 + i * 0.7) * 3;
        const wobbleY = Math.cos(performance.now() * 0.004 + i * 0.5) * 3;
        beeSwarmPositions.push({
            x: centerX + Math.cos(angle) * radius + wobbleX,
            y: centerY + Math.sin(angle) * radius * 0.6 + wobbleY,
            wingPhase: (performance.now() * 0.02 + i) % (Math.PI * 2)
        });
    }
}

// === ROAD STRIPES ===
function initRoadStripes() {
    roadStripes = [];
    for (let y = 0; y < canvas.height + 100; y += 60) {
        roadStripes.push({ y: y });
    }
}

// === BACKGROUND FLOWERS ===
function initBackgroundFlowers() {
    backgroundFlowers = [];
    for (let i = 0; i < 12; i++) {
        backgroundFlowers.push({
            x: Math.random() < 0.5 ? Math.random() * 40 : canvas.width - Math.random() * 40,
            y: Math.random() * canvas.height,
            size: 4 + Math.random() * 6,
            color: ['#FF69B4', '#FF6B6B', '#9B59B6', '#E91E63'][Math.floor(Math.random() * 4)]
        });
    }
}

// === SPAWNING ===
function spawnObstacle() {
    const lane = Math.floor(Math.random() * LANE_COUNT);
    const types = ['rock', 'web', 'raindrop'];
    const type = types[Math.floor(Math.random() * types.length)];
    obstacles.push({
        x: lane * LANE_WIDTH + LANE_WIDTH / 2,
        y: -60,
        lane: lane,
        type: type,
        width: 36,
        height: 36,
        rotation: 0
    });
}

function spawnBee() {
    const lane = Math.floor(Math.random() * LANE_COUNT);
    collectibleBees.push({
        x: lane * LANE_WIDTH + LANE_WIDTH / 2,
        y: -40,
        lane: lane,
        bobOffset: Math.random() * Math.PI * 2
    });
}

function spawnFlower() {
    const lane = Math.floor(Math.random() * LANE_COUNT);
    const colors = ['#FF69B4', '#FF6B6B', '#FFD700', '#9B59B6', '#FF8C00'];
    flowers.push({
        x: lane * LANE_WIDTH + LANE_WIDTH / 2,
        y: -40,
        lane: lane,
        color: colors[Math.floor(Math.random() * colors.length)],
        petalCount: 5 + Math.floor(Math.random() * 3)
    });
}

// === PARTICLES ===
function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 0.5) * 5,
            life: 1,
            color: color,
            size: 2 + Math.random() * 4
        });
    }
}

// === INPUT ===
document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') return;
    keys[e.code] = true;
    
    if ((e.code === 'Space' || e.code === 'Enter') && gameState !== 'playing') {
        e.preventDefault();
        startGame();
    }
    
    if (gameState === 'playing') {
        if ((e.code === 'ArrowLeft' || e.code === 'KeyA') && inputCooldown <= 0) {
            moveLane(-1);
            inputCooldown = 8;
        }
        if ((e.code === 'ArrowRight' || e.code === 'KeyD') && inputCooldown <= 0) {
            moveLane(1);
            inputCooldown = 8;
        }
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

function moveLane(dir) {
    const newLane = swarmLane + dir;
    if (newLane >= 0 && newLane < LANE_COUNT) {
        swarmLane = newLane;
    }
}

// === GAMEPAD ===
let prevGamepadLeft = false;
let prevGamepadRight = false;

function pollGamepad() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    gamepadState = { left: false, right: false, action: false };
    
    for (const gp of gamepads) {
        if (!gp) continue;
        const deadzone = 0.15;
        
        if (gp.axes[0] < -deadzone || (gp.buttons[14] && gp.buttons[14].pressed)) {
            gamepadState.left = true;
        }
        if (gp.axes[0] > deadzone || (gp.buttons[15] && gp.buttons[15].pressed)) {
            gamepadState.right = true;
        }
        if ((gp.buttons[0] && gp.buttons[0].pressed) || (gp.buttons[9] && gp.buttons[9].pressed)) {
            gamepadState.action = true;
        }
    }
    
    // Lane change on gamepad (edge detection)
    if (gamepadState.left && !prevGamepadLeft && inputCooldown <= 0) {
        moveLane(-1);
        inputCooldown = 8;
    }
    if (gamepadState.right && !prevGamepadRight && inputCooldown <= 0) {
        moveLane(1);
        inputCooldown = 8;
    }
    
    if (gamepadState.action && gameState !== 'playing') {
        startGame();
    }
    
    prevGamepadLeft = gamepadState.left;
    prevGamepadRight = gamepadState.right;
}

// === UPDATE ===
function update(dt) {
    if (gameState !== 'playing') return;
    
    pollGamepad();
    inputCooldown -= dt;
    
    // Score & distance
    distance += swarmSpeed * dt;
    score = Math.floor(distance);
    
    // Speed decay over time
    speedDecayTimer += dt;
    if (speedDecayTimer > 60) { // Every second at 60fps
        speedDecayTimer = 0;
        swarmSpeed -= 0.02;
        if (swarmSpeed < 1.5) swarmSpeed = 1.5;
    }
    
    // Obstacle speed scales with swarm speed
    obstacleSpeed = 2 + swarmSpeed * 0.8;
    
    // Smooth lane movement
    swarmTargetX = swarmLane * LANE_WIDTH + LANE_WIDTH / 2;
    swarmX += (swarmTargetX - swarmX) * 0.15 * dt;
    
    // Update road stripes
    for (let stripe of roadStripes) {
        stripe.y += obstacleSpeed * dt;
        if (stripe.y > canvas.height + 50) {
            stripe.y -= canvas.height + 150;
        }
    }
    
    // Update background flowers
    for (let f of backgroundFlowers) {
        f.y += obstacleSpeed * 0.5 * dt;
        if (f.y > canvas.height + 20) {
            f.y = -20;
            f.x = Math.random() < 0.5 ? Math.random() * 40 : canvas.width - Math.random() * 40;
        }
    }
    
    // Spawning
    spawnTimer += dt;
    const currentSpawnInterval = Math.max(15, spawnInterval - distance * 0.005);
    if (spawnTimer > currentSpawnInterval) {
        spawnTimer = 0;
        const rand = Math.random();
        if (rand < 0.4) {
            spawnObstacle();
        } else if (rand < 0.7) {
            spawnBee();
        } else {
            spawnFlower();
        }
    }
    
    // Extra obstacles as difficulty increases
    difficultyTimer += dt;
    if (difficultyTimer > 300) {
        difficultyTimer = 0;
        spawnInterval = Math.max(12, spawnInterval - 2);
    }
    
    // Update obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        obs.y += obstacleSpeed * dt;
        obs.rotation += 0.02 * dt;
        
        if (obs.y > canvas.height + 60) {
            obstacles.splice(i, 1);
            continue;
        }
        
        // Collision with swarm
        const dist = Math.hypot(obs.x - swarmX, obs.y - SWARM_Y);
        const hitRadius = 15 + Math.sqrt(beeCount) * 4;
        if (dist < hitRadius) {
            const beesLost = Math.min(beeCount, 2 + Math.floor(Math.random() * 2));
            beeCount -= beesLost;
            spawnParticles(obs.x, obs.y, '#FF4444', 10);
            spawnParticles(swarmX, SWARM_Y, '#FFD700', beesLost * 2);
            obstacles.splice(i, 1);
            
            if (beeCount <= 0) {
                beeCount = 0;
                gameState = 'gameover';
                return;
            }
        }
    }
    
    // Update collectible bees
    for (let i = collectibleBees.length - 1; i >= 0; i--) {
        const bee = collectibleBees[i];
        bee.y += obstacleSpeed * dt;
        
        if (bee.y > canvas.height + 60) {
            collectibleBees.splice(i, 1);
            continue;
        }
        
        // Collection
        const dist = Math.hypot(bee.x - swarmX, bee.y - SWARM_Y);
        const collectRadius = 20 + Math.sqrt(beeCount) * 4;
        if (dist < collectRadius) {
            beeCount = Math.min(beeCount + 1, maxBees);
            score += 5;
            spawnParticles(bee.x, bee.y, '#FFD700', 6);
            collectibleBees.splice(i, 1);
        }
    }
    
    // Update flowers
    for (let i = flowers.length - 1; i >= 0; i--) {
        const flower = flowers[i];
        flower.y += obstacleSpeed * dt;
        
        if (flower.y > canvas.height + 60) {
            flowers.splice(i, 1);
            continue;
        }
        
        // Collection → speed boost
        const dist = Math.hypot(flower.x - swarmX, flower.y - SWARM_Y);
        const collectRadius = 20 + Math.sqrt(beeCount) * 4;
        if (dist < collectRadius) {
            swarmSpeed = Math.min(swarmSpeed + 0.8, baseSpeed + 4);
            score += 10;
            spawnParticles(flower.x, flower.y, flower.color, 10);
            flowers.splice(i, 1);
        }
    }
    
    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= 0.025 * dt;
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
    
    updateSwarmPositions();
}

// === DRAW ===
function draw() {
    // Background - meadow green
    ctx.fillStyle = '#2d5a27';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (gameState === 'start') {
        drawStartScreen();
        return;
    }
    
    if (gameState === 'gameover') {
        drawGameWorld();
        drawGameOverScreen();
        return;
    }
    
    drawGameWorld();
    drawHUD();
}

function drawGameWorld() {
    // Road background
    const roadLeft = 20;
    const roadRight = canvas.width - 20;
    ctx.fillStyle = '#4a7a42';
    ctx.fillRect(roadLeft, 0, roadRight - roadLeft, canvas.height);
    
    // Road border
    ctx.fillStyle = '#3d6636';
    ctx.fillRect(roadLeft - 4, 0, 4, canvas.height);
    ctx.fillRect(roadRight, 0, 4, canvas.height);
    
    // Grass edges
    ctx.fillStyle = '#1e4a18';
    ctx.fillRect(0, 0, roadLeft - 4, canvas.height);
    ctx.fillRect(roadRight + 4, 0, canvas.width - roadRight - 4, canvas.height);
    
    // Background flowers on grass
    for (const f of backgroundFlowers) {
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.size * 0.4, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Road stripes (lane dividers)
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    for (const stripe of roadStripes) {
        for (let l = 1; l < LANE_COUNT; l++) {
            ctx.fillRect(l * LANE_WIDTH - 1, stripe.y, 2, 30);
        }
    }
    
    // Draw obstacles
    for (const obs of obstacles) {
        drawObstacle(obs);
    }
    
    // Draw collectible bees
    for (const bee of collectibleBees) {
        drawCollectibleBee(bee);
    }
    
    // Draw flowers
    for (const flower of flowers) {
        drawFlower(flower);
    }
    
    // Draw bee swarm
    drawSwarm();
    
    // Draw particles
    for (const p of particles) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function drawObstacle(obs) {
    ctx.save();
    ctx.translate(obs.x, obs.y);
    
    if (obs.type === 'rock') {
        // Gray rock
        ctx.fillStyle = '#666';
        ctx.beginPath();
        ctx.moveTo(-16, 10);
        ctx.lineTo(-12, -12);
        ctx.lineTo(5, -16);
        ctx.lineTo(16, -8);
        ctx.lineTo(14, 12);
        ctx.lineTo(-8, 16);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 2;
        ctx.stroke();
        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.arc(-4, -6, 5, 0, Math.PI * 2);
        ctx.fill();
    } else if (obs.type === 'web') {
        // Spider web
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 + obs.rotation;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(angle) * 18, Math.sin(angle) * 18);
            ctx.stroke();
        }
        for (let r = 6; r <= 18; r += 6) {
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.stroke();
        }
    } else if (obs.type === 'raindrop') {
        // Raindrop
        ctx.fillStyle = '#5BA3D9';
        ctx.beginPath();
        ctx.moveTo(0, -16);
        ctx.bezierCurveTo(10, -4, 12, 8, 0, 16);
        ctx.bezierCurveTo(-12, 8, -10, -4, 0, -16);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath();
        ctx.ellipse(-3, -4, 3, 5, -0.3, 0, Math.PI * 2);
        ctx.fill();
    }
    
    ctx.restore();
}

function drawCollectibleBee(bee) {
    const time = performance.now() / 1000;
    const bobY = Math.sin(time * 4 + bee.bobOffset) * 4;
    const x = bee.x;
    const y = bee.y + bobY;
    
    // Glow
    ctx.fillStyle = 'rgba(255, 215, 0, 0.2)';
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, Math.PI * 2);
    ctx.fill();
    
    // Body
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.ellipse(x, y, 10, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Stripes
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(x - 3, y - 6, 3, 12);
    ctx.fillRect(x + 3, y - 5, 3, 10);
    
    // Wings
    ctx.fillStyle = 'rgba(200, 230, 255, 0.6)';
    const wingFlap = Math.sin(time * 20 + bee.bobOffset) * 0.3;
    ctx.beginPath();
    ctx.ellipse(x - 4, y - 9 + wingFlap * 3, 6, 4, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 4, y - 9 - wingFlap * 3, 6, 4, 0.3, 0, Math.PI * 2);
    ctx.fill();
}

function drawFlower(flower) {
    const x = flower.x;
    const y = flower.y;
    
    // Glow
    ctx.fillStyle = 'rgba(255, 100, 200, 0.15)';
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.fill();
    
    // Petals
    ctx.fillStyle = flower.color;
    for (let i = 0; i < flower.petalCount; i++) {
        const angle = (i / flower.petalCount) * Math.PI * 2;
        const px = x + Math.cos(angle) * 10;
        const py = y + Math.sin(angle) * 10;
        ctx.beginPath();
        ctx.ellipse(px, py, 7, 5, angle, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Center
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    
    // Speed indicator
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚡', x, y + 4);
}

function drawSwarm() {
    for (const bee of beeSwarmPositions) {
        // Body
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.ellipse(bee.x, bee.y, 6, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Stripes
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(bee.x - 1.5, bee.y - 3.5, 2, 7);
        ctx.fillRect(bee.x + 1.5, bee.y - 3, 2, 6);
        
        // Wings
        ctx.fillStyle = 'rgba(200, 230, 255, 0.5)';
        const wingFlap = Math.sin(bee.wingPhase) * 2;
        ctx.beginPath();
        ctx.ellipse(bee.x - 2, bee.y - 5 + wingFlap, 4, 2.5, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(bee.x + 2, bee.y - 5 - wingFlap, 4, 2.5, 0.3, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Swarm center highlight
    if (beeCount > 0) {
        ctx.fillStyle = 'rgba(255, 215, 0, 0.1)';
        ctx.beginPath();
        ctx.arc(swarmX, SWARM_Y, 10 + Math.sqrt(beeCount) * 4, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawHUD() {
    // Bee count
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(10, 10, 140, 40);
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, 140, 40);
    ctx.lineWidth = 1;
    
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🐝 × ' + beeCount, 22, 36);
    
    // Score
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(canvas.width - 130, 10, 120, 40);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(canvas.width - 130, 10, 120, 40);
    ctx.lineWidth = 1;
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Score: ' + score, canvas.width - 20, 36);
    
    // Speed bar
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(10, 56, 140, 24);
    ctx.strokeStyle = '#4CAF50';
    ctx.strokeRect(10, 56, 140, 24);
    
    const speedPercent = (swarmSpeed - 1.5) / (baseSpeed + 4 - 1.5);
    const barWidth = 134 * Math.max(0, Math.min(1, speedPercent));
    const speedColor = speedPercent > 0.5 ? '#4CAF50' : speedPercent > 0.25 ? '#FF9800' : '#F44336';
    ctx.fillStyle = speedColor;
    ctx.fillRect(13, 59, barWidth, 18);
    
    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('⚡ Tempo', 18, 73);
}

function drawStartScreen() {
    // Background
    ctx.fillStyle = '#2d5a27';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Decorative bees
    const time = performance.now() / 1000;
    for (let i = 0; i < 8; i++) {
        const bx = canvas.width / 2 + Math.cos(time + i * 0.8) * (80 + i * 15);
        const by = canvas.height / 2 - 80 + Math.sin(time * 1.3 + i) * 30;
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.ellipse(bx, by, 8, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(200,230,255,0.5)';
        ctx.beginPath();
        ctx.ellipse(bx, by - 6, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Title box
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(canvas.width / 2 - 200, canvas.height / 2 - 160, 400, 340);
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 3;
    ctx.strokeRect(canvas.width / 2 - 200, canvas.height / 2 - 160, 400, 340);
    ctx.lineWidth = 1;
    
    // Title
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🐝 Bienenvolk 🐝', canvas.width / 2, canvas.height / 2 - 100);
    
    // Description
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.fillText('Führe deinen Schwarm über die Wiese!', canvas.width / 2, canvas.height / 2 - 60);
    
    // Instructions
    ctx.fillStyle = '#ddd';
    ctx.font = '15px sans-serif';
    ctx.fillText('← → oder A/D: Spur wechseln', canvas.width / 2, canvas.height / 2 - 20);
    ctx.fillText('🐝 Bienen sammeln = Schwarm wächst', canvas.width / 2, canvas.height / 2 + 10);
    ctx.fillText('🌸 Blüten sammeln = Tempo-Boost', canvas.width / 2, canvas.height / 2 + 40);
    ctx.fillText('🪨 Hindernisse = Bienen verlieren', canvas.width / 2, canvas.height / 2 + 70);
    ctx.fillText('🎮 Gamepad: Stick + Start', canvas.width / 2, canvas.height / 2 + 100);
    
    ctx.fillStyle = '#4CAF50';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('Leertaste / Enter zum Starten', canvas.width / 2, canvas.height / 2 + 150);
}

function drawGameOverScreen() {
    // Overlay
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Box
    ctx.fillStyle = 'rgba(30,30,30,0.95)';
    ctx.fillRect(canvas.width / 2 - 180, canvas.height / 2 - 120, 360, 240);
    ctx.strokeStyle = '#E53935';
    ctx.lineWidth = 3;
    ctx.strokeRect(canvas.width / 2 - 180, canvas.height / 2 - 120, 360, 240);
    ctx.lineWidth = 1;
    
    ctx.fillStyle = '#E53935';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Schwarm aufgelöst!', canvas.width / 2, canvas.height / 2 - 65);
    
    ctx.fillStyle = '#FFD700';
    ctx.font = '22px sans-serif';
    ctx.fillText('Score: ' + score, canvas.width / 2, canvas.height / 2 - 20);
    
    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    ctx.fillText('Distanz: ' + Math.floor(distance) + 'm', canvas.width / 2, canvas.height / 2 + 20);
    
    ctx.fillStyle = '#4CAF50';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('Leertaste / Enter: Nochmal', canvas.width / 2, canvas.height / 2 + 80);
}

// === GAME CONTROL ===
function startGame() {
    score = 0;
    distance = 0;
    beeCount = 5;
    swarmSpeed = baseSpeed;
    speedDecayTimer = 0;
    swarmLane = 2;
    swarmX = canvas.width / 2;
    obstacles = [];
    collectibleBees = [];
    flowers = [];
    particles = [];
    spawnTimer = 0;
    spawnInterval = 40;
    difficultyTimer = 0;
    inputCooldown = 0;
    gameState = 'playing';
    lastTime = 0;
    initRoadStripes();
    initBackgroundFlowers();
    updateSwarmPositions();
}

// === GAME LOOP ===
function pollGamepadMenu() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of gamepads) {
        if (!gp) continue;
        if ((gp.buttons[0] && gp.buttons[0].pressed) || (gp.buttons[9] && gp.buttons[9].pressed)) {
            if (gameState === 'start' || gameState === 'gameover') {
                startGame();
            }
            break;
        }
    }
}

function gameLoop(timestamp) {
    if (lastTime === 0) lastTime = timestamp;
    const elapsed = timestamp - lastTime;
    lastTime = timestamp;
    const dt = Math.min(elapsed / (1000 / TARGET_FPS), 3);
    
    // Gamepad-Check auch im Menü/GameOver
    if (gameState === 'start' || gameState === 'gameover') {
        pollGamepadMenu();
    }
    
    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
}

// Init
initRoadStripes();
initBackgroundFlowers();
requestAnimationFrame(gameLoop);
