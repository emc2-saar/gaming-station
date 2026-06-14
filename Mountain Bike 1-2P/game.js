const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// === CONSTANTS ===
const TARGET_FPS = 60;
const LANE_COUNT = 5;
const ROAD_COLOR = '#333842';
const LANE_LINE_COLOR = '#ffffff44';
const GRASS_COLOR_LEFT = '#2d5a27';
const GRASS_COLOR_RIGHT = '#2d5a27';
const PLAYER_COLORS = ['#00ccff', '#ff4488'];
const OPPONENT_COLORS = ['#ff8800', '#aa44ff', '#44ff44', '#ffcc00', '#ff4444'];
const OBSTACLE_TYPES = ['pothole', 'oil', 'barrier'];
const BOOST_COLOR = '#00ff88';
const DEADZONE = 0.15;

// === GAME STATE ===
let lastTime = 0;
let gameState = 'menu'; // menu, modeSelect, playing, gameOver
let playerMode = 1;
let players = [];
let opponents = [];
let obstacles = [];
let boosts = [];
let roadMarkings = [];
let score = 0;
let distance = 0;
let baseSpeed = 4;
let spawnAccumulator = 0;
let obstacleAccumulator = 0;
let boostAccumulator = 0;
let difficulty = 1;
let winner = 0; // for 2-player

// === INPUT ===
const keys = {};
document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (gameState !== 'playing') {
            handleConfirm();
        }
    }
    if (e.code === 'Digit1' || e.code === 'Numpad1') {
        if (gameState === 'modeSelect') {
            playerMode = 1;
            startGame();
        }
    }
    if (e.code === 'Digit2' || e.code === 'Numpad2') {
        if (gameState === 'modeSelect') {
            playerMode = 2;
            startGame();
        }
    }
});
document.addEventListener('keyup', (e) => { keys[e.code] = false; });

function handleConfirm() {
    if (gameState === 'menu') {
        gameState = 'modeSelect';
    } else if (gameState === 'gameOver') {
        gameState = 'modeSelect';
    }
}

// === GAMEPAD ===
function getGamepads() {
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    return Array.from(gps).filter(g => g !== null);
}

function getGamepadInput(index) {
    const gps = getGamepads();
    if (index >= gps.length) return { left: false, right: false, up: false, down: false, confirm: false, jump: false };
    const gp = gps[index];
    const lx = Math.abs(gp.axes[0]) > DEADZONE ? gp.axes[0] : 0;
    const ly = Math.abs(gp.axes[1]) > DEADZONE ? gp.axes[1] : 0;
    return {
        left: lx < -DEADZONE || gp.buttons[14]?.pressed,
        right: lx > DEADZONE || gp.buttons[15]?.pressed,
        up: ly < -DEADZONE || gp.buttons[12]?.pressed,
        down: ly > DEADZONE || gp.buttons[13]?.pressed,
        confirm: gp.buttons[0]?.pressed || gp.buttons[9]?.pressed,
        jump: gp.buttons[0]?.pressed || gp.buttons[1]?.pressed
    };
}

// === PLAYER CLASS ===
class Player {
    constructor(id, x, y, color) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.color = color;
        this.width = 20;
        this.height = 40;
        this.speed = 0;
        this.lateralSpeed = 0;
        this.maxSpeed = 6;
        this.alive = true;
        this.boostTimer = 0;
        this.score = 0;
        this.distance = 0;
        this.overtaken = 0;
        // Jump
        this.jumpHeight = 0;
        this.jumpVelocity = 0;
        this.isJumping = false;
        this.jumpCooldown = 0;
        // Invincibility at start
        this.invincibleTimer = 120; // 2 seconds at 60fps
    }

    getInput(dt) {
        let left = false, right = false, up = false, down = false, jump = false;
        
        if (this.id === 0) {
            // Player 1: WASD (im 2-Spieler-Modus NUR WASD, im 1-Spieler-Modus auch Pfeiltasten)
            left = keys['KeyA'];
            right = keys['KeyD'];
            up = keys['KeyW'];
            down = keys['KeyS'];
            jump = keys['Space'];
            if (playerMode === 1) {
                left = left || keys['ArrowLeft'];
                right = right || keys['ArrowRight'];
                up = up || keys['ArrowUp'];
                down = down || keys['ArrowDown'];
            }
            const gp = getGamepadInput(0);
            left = left || gp.left;
            right = right || gp.right;
            up = up || gp.up;
            down = down || gp.down;
            jump = jump || gp.jump;
        } else {
            // Player 2: Pfeiltasten + Gamepad 1
            left = keys['ArrowLeft'];
            right = keys['ArrowRight'];
            up = keys['ArrowUp'];
            down = keys['ArrowDown'];
            jump = keys['Enter'];
            const gp = getGamepadInput(1);
            left = left || gp.left;
            right = right || gp.right;
            up = up || gp.up;
            down = down || gp.down;
            jump = jump || gp.jump;
        }

        return { left, right, up, down, jump };
    }

    update(dt, roadLeft, roadRight) {
        if (!this.alive) return;

        // Invincibility countdown
        if (this.invincibleTimer > 0) this.invincibleTimer -= dt;

        const input = this.getInput(dt);
        const accel = 0.15;
        const decel = 0.05;
        const lateralAccel = 4.5;

        // Jump logic
        if (this.jumpCooldown > 0) this.jumpCooldown -= dt;
        if (input.jump && !this.isJumping && this.jumpCooldown <= 0) {
            this.isJumping = true;
            this.jumpVelocity = -0.9;
            this.jumpCooldown = 15; // cooldown before next jump
        }
        if (this.isJumping) {
            this.jumpHeight += this.jumpVelocity * dt;
            this.jumpVelocity += 0.06 * dt; // gravity
            if (this.jumpHeight >= 0) {
                this.jumpHeight = 0;
                this.jumpVelocity = 0;
                this.isJumping = false;
            }
        }

        // Lateral movement
        if (input.left) {
            this.lateralSpeed = -lateralAccel;
        } else if (input.right) {
            this.lateralSpeed = lateralAccel;
        } else {
            this.lateralSpeed *= Math.pow(0.85, dt);
            if (Math.abs(this.lateralSpeed) < 0.1) this.lateralSpeed = 0;
        }

        // Forward speed
        if (input.up) {
            this.speed = Math.min(this.speed + accel * dt, this.maxSpeed);
        } else if (input.down) {
            this.speed = Math.max(this.speed - accel * 2 * dt, 1);
        } else {
            this.speed += (baseSpeed - this.speed) * 0.02 * dt;
        }

        // Boost
        if (this.boostTimer > 0) {
            this.boostTimer -= dt;
            this.speed = this.maxSpeed + 2;
        }

        // Move
        this.x += this.lateralSpeed * dt;

        // Clamp to road
        if (this.x < roadLeft + 5) { this.x = roadLeft + 5; this.lateralSpeed = 0; }
        if (this.x + this.width > roadRight - 5) { this.x = roadRight - 5 - this.width; this.lateralSpeed = 0; }

        // Score
        this.distance += this.speed * dt;
        this.score = Math.floor(this.distance / 10) + this.overtaken * 5;
    }

    draw(ctx) {
        if (!this.alive) return;
        
        const bx = this.x;
        const jumpOffset = this.jumpHeight * 15; // visual lift (smaller jump)
        const by = this.y + jumpOffset;

        // Shadow on ground (stays at ground level, gets smaller when jumping)
        const shadowScale = 1 + this.jumpHeight * 0.5; // jumpHeight is negative when in air
        const shadowAlpha = 0.3 + this.jumpHeight * 0.2;
        ctx.fillStyle = `rgba(0,0,0,${Math.max(0.1, shadowAlpha)})`;
        ctx.beginPath();
        ctx.ellipse(bx + this.width / 2, this.y + this.height - 5, 
            this.width * 0.6 * Math.max(0.4, shadowScale), 
            5 * Math.max(0.4, shadowScale), 0, 0, Math.PI * 2);
        ctx.fill();

        // Body (lifted when jumping)
        // Blink when invincible
        if (this.invincibleTimer > 0 && Math.floor(this.invincibleTimer / 5) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }
        ctx.fillStyle = this.boostTimer > 0 ? '#ffff00' : this.color;
        ctx.fillRect(bx, by, this.width, this.height);

        // Rider head
        ctx.fillStyle = '#ffddaa';
        ctx.beginPath();
        ctx.arc(bx + this.width / 2, by + 8, 6, 0, Math.PI * 2);
        ctx.fill();

        // Helmet
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(bx + this.width / 2, by + 6, 6, Math.PI, 0);
        ctx.fill();

        // Wheels
        ctx.fillStyle = '#111';
        ctx.fillRect(bx + 2, by + this.height - 8, 6, 8);
        ctx.fillRect(bx + this.width - 8, by + this.height - 8, 6, 8);
        ctx.fillRect(bx + 2, by, 6, 8);
        ctx.fillRect(bx + this.width - 8, by, 6, 8);

        // Jump indicator
        if (this.isJumping) {
            ctx.fillStyle = '#ffffff88';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('↑', bx + this.width / 2, by - 5);
        }
        ctx.globalAlpha = 1.0;
    }

    getHitbox() {
        return { x: this.x + 2, y: this.y + 2, w: this.width - 4, h: this.height - 4 };
    }
}

// === OPPONENT ===
class Opponent {
    constructor(x, y, speed) {
        this.x = x;
        this.y = y;
        this.width = 20;
        this.height = 40;
        this.speed = speed;
        this.color = OPPONENT_COLORS[Math.floor(Math.random() * OPPONENT_COLORS.length)];
        this.passed = false;
        this.swerveTimer = 0;
        this.swerveDir = 0;
    }

    update(dt, scrollSpeed) {
        this.y += (scrollSpeed - this.speed) * dt;
        
        // Slight random swerving
        this.swerveTimer -= dt;
        if (this.swerveTimer <= 0) {
            this.swerveDir = (Math.random() - 0.5) * 1.5;
            this.swerveTimer = 30 + Math.random() * 60;
        }
        this.x += this.swerveDir * dt;
    }

    draw(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(this.x + 2, this.y + 2, this.width, this.height);
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        // Head
        ctx.fillStyle = '#ffddaa';
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y + 8, 5, 0, Math.PI * 2);
        ctx.fill();
        // Wheels
        ctx.fillStyle = '#111';
        ctx.fillRect(this.x + 2, this.y + this.height - 8, 6, 8);
        ctx.fillRect(this.x + this.width - 8, this.y + this.height - 8, 6, 8);
        ctx.fillRect(this.x + 2, this.y, 6, 8);
        ctx.fillRect(this.x + this.width - 8, this.y, 6, 8);
    }

    getHitbox() {
        return { x: this.x + 2, y: this.y + 2, w: this.width - 4, h: this.height - 4 };
    }
}

// === OBSTACLE ===
class Obstacle {
    constructor(type, x, y) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.width = type === 'barrier' ? 60 : 30;
        this.height = type === 'barrier' ? 15 : 30;
    }

    update(dt, scrollSpeed) {
        this.y += scrollSpeed * dt;
    }

    draw(ctx) {
        if (this.type === 'pothole') {
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath();
            ctx.ellipse(this.x + 15, this.y + 15, 14, 10, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#555';
            ctx.lineWidth = 2;
            ctx.stroke();
        } else if (this.type === 'oil') {
            ctx.fillStyle = '#2a1a3a88';
            ctx.beginPath();
            ctx.ellipse(this.x + 15, this.y + 15, 14, 12, 0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#4a2a6a44';
            ctx.beginPath();
            ctx.ellipse(this.x + 10, this.y + 12, 8, 6, -0.2, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'barrier') {
            ctx.fillStyle = '#ff4444';
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(this.x + 10, this.y + 3, 10, this.height - 6);
            ctx.fillRect(this.x + 30, this.y + 3, 10, this.height - 6);
        }
    }

    getHitbox() {
        return { x: this.x + 3, y: this.y + 3, w: this.width - 6, h: this.height - 6 };
    }
}

// === BOOST ===
class Boost {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 20;
        this.height = 24;
        this.collected = false;
    }

    update(dt, scrollSpeed) {
        this.y += scrollSpeed * dt;
    }

    draw(ctx) {
        if (this.collected) return;
        // Water bottle
        ctx.fillStyle = BOOST_COLOR;
        ctx.fillRect(this.x + 5, this.y, 10, 20);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(this.x + 7, this.y - 4, 6, 6);
        // Glow
        ctx.shadowColor = BOOST_COLOR;
        ctx.shadowBlur = 10;
        ctx.fillStyle = BOOST_COLOR + '44';
        ctx.beginPath();
        ctx.arc(this.x + 10, this.y + 10, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    getHitbox() {
        return { x: this.x, y: this.y, w: this.width, h: this.height };
    }
}

// === COLLISION ===
function rectsCollide(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// === ROAD DIMENSIONS ===
function getRoadBounds() {
    if (playerMode === 1) {
        const roadWidth = 260;
        const roadLeft = (canvas.width - roadWidth) / 2;
        return { left: roadLeft, right: roadLeft + roadWidth, width: roadWidth };
    } else {
        // Two roads side by side
        const roadWidth = 200;
        const gap = 40;
        const totalWidth = roadWidth * 2 + gap;
        const startX = (canvas.width - totalWidth) / 2;
        return {
            left1: startX,
            right1: startX + roadWidth,
            left2: startX + roadWidth + gap,
            right2: startX + totalWidth,
            width: roadWidth
        };
    }
}

// === ROAD MARKINGS ===
function initRoadMarkings() {
    roadMarkings = [];
    for (let y = -50; y < canvas.height + 50; y += 80) {
        roadMarkings.push(y);
    }
}

// === START GAME ===
function startGame() {
    gameState = 'playing';
    score = 0;
    distance = 0;
    baseSpeed = 4;
    difficulty = 1;
    spawnAccumulator = 0;
    obstacleAccumulator = 0;
    boostAccumulator = 0;
    opponents = [];
    obstacles = [];
    boosts = [];
    players = [];
    winner = 0;
    lastTime = 0;

    const road = getRoadBounds();

    if (playerMode === 1) {
        players.push(new Player(0, road.left + road.width / 2 - 10, canvas.height - 100, PLAYER_COLORS[0]));
    } else {
        players.push(new Player(0, road.left1 + road.width / 2 - 10, canvas.height - 100, PLAYER_COLORS[0]));
        players.push(new Player(1, road.left2 + road.width / 2 - 10, canvas.height - 100, PLAYER_COLORS[1]));
    }

    initRoadMarkings();
}

// === UPDATE ===
function update(dt) {
    if (gameState !== 'playing') {
        // Check gamepad confirm in menus
        const gps = getGamepads();
        for (let gp of gps) {
            if (gp.buttons[0]?.pressed || gp.buttons[9]?.pressed) {
                handleConfirm();
                break;
            }
        }
        return;
    }

    // Increase difficulty (slower ramp)
    difficulty = 1 + distance / 8000;
    baseSpeed = 4 + difficulty * 0.4;

    const scrollSpeed = baseSpeed;

    // Update road markings
    for (let i = 0; i < roadMarkings.length; i++) {
        roadMarkings[i] += scrollSpeed * dt;
        if (roadMarkings[i] > canvas.height + 50) {
            roadMarkings[i] -= (roadMarkings.length) * 80;
        }
    }

    const road = getRoadBounds();

    // Update players
    for (let p of players) {
        if (!p.alive) continue;
        if (playerMode === 1) {
            p.update(dt, road.left, road.right);
        } else {
            if (p.id === 0) p.update(dt, road.left1, road.right1);
            else p.update(dt, road.left2, road.right2);
        }
    }

    // Spawn opponents
    spawnAccumulator += dt;
    const spawnInterval = Math.max(50, 120 - difficulty * 8);
    if (spawnAccumulator >= spawnInterval) {
        spawnAccumulator = 0;
        spawnOpponent(road);
    }

    // Spawn obstacles
    obstacleAccumulator += dt;
    const obstacleInterval = Math.max(80, 180 - difficulty * 10);
    if (obstacleAccumulator >= obstacleInterval) {
        obstacleAccumulator = 0;
        spawnObstacle(road);
    }

    // Spawn boosts
    boostAccumulator += dt;
    if (boostAccumulator >= 240) {
        boostAccumulator = 0;
        spawnBoost(road);
    }

    // Update opponents
    for (let opp of opponents) {
        opp.update(dt, scrollSpeed);
    }

    // Update obstacles
    for (let obs of obstacles) {
        obs.update(dt, scrollSpeed);
    }

    // Update boosts
    for (let b of boosts) {
        b.update(dt, scrollSpeed);
    }

    // Collision detection
    for (let p of players) {
        if (!p.alive) continue;
        const ph = p.getHitbox();
        const isInAir = p.isJumping && p.jumpHeight < -0.3; // must be high enough
        const isInvincible = p.invincibleTimer > 0;

        // Opponents
        for (let opp of opponents) {
            if (!isInAir && !isInvincible && rectsCollide(ph, opp.getHitbox())) {
                p.alive = false;
            }
            // Check if passed
            if (!opp.passed && opp.y > p.y + p.height) {
                opp.passed = true;
                p.overtaken++;
            }
        }

        // Obstacles
        for (let obs of obstacles) {
            if (!isInAir && !isInvincible && rectsCollide(ph, obs.getHitbox())) {
                p.alive = false;
            }
        }

        // Boosts (can collect in air too)
        for (let b of boosts) {
            if (!b.collected && rectsCollide(ph, b.getHitbox())) {
                b.collected = true;
                p.boostTimer = 90; // 1.5 seconds at 60fps
            }
        }
    }

    // Track distance from alive players
    const alivePlayers = players.filter(p => p.alive);
    if (alivePlayers.length > 0) {
        distance += scrollSpeed * dt;
    }

    // Cleanup off-screen
    opponents = opponents.filter(o => o.y < canvas.height + 100 && o.y > -100);
    obstacles = obstacles.filter(o => o.y < canvas.height + 100);
    boosts = boosts.filter(b => b.y < canvas.height + 100 && !b.collected);

    // Check game over
    if (playerMode === 1) {
        if (!players[0].alive) {
            score = players[0].score;
            gameState = 'gameOver';
        }
    } else {
        const alive = players.filter(p => p.alive);
        if (alive.length === 0) {
            // Both dead at same time
            winner = players[0].score >= players[1].score ? 1 : 2;
            gameState = 'gameOver';
        } else if (alive.length === 1 && players.length === 2) {
            winner = alive[0].id + 1;
            gameState = 'gameOver';
        }
    }
}

function spawnOpponent(road) {
    if (playerMode === 1) {
        const laneWidth = road.width / LANE_COUNT;
        const lane = Math.floor(Math.random() * LANE_COUNT);
        const x = road.left + lane * laneWidth + (laneWidth - 20) / 2;
        const speed = baseSpeed * (0.6 + Math.random() * 0.3);
        opponents.push(new Opponent(x, -60, speed));
    } else {
        // Spawn in both roads
        const laneWidth = road.width / 4;
        for (let r = 0; r < 2; r++) {
            if (Math.random() < 0.6) {
                const rLeft = r === 0 ? road.left1 : road.left2;
                const lane = Math.floor(Math.random() * 4);
                const x = rLeft + lane * laneWidth + (laneWidth - 20) / 2;
                const speed = baseSpeed * (0.6 + Math.random() * 0.3);
                opponents.push(new Opponent(x, -60, speed));
            }
        }
    }
}

function spawnObstacle(road) {
    const type = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
    if (playerMode === 1) {
        const x = road.left + 20 + Math.random() * (road.width - 80);
        obstacles.push(new Obstacle(type, x, -50));
    } else {
        const which = Math.floor(Math.random() * 2);
        const rLeft = which === 0 ? road.left1 : road.left2;
        const x = rLeft + 20 + Math.random() * (road.width - 80);
        obstacles.push(new Obstacle(type, x, -50));
    }
}

function spawnBoost(road) {
    if (playerMode === 1) {
        const x = road.left + 20 + Math.random() * (road.width - 60);
        boosts.push(new Boost(x, -30));
    } else {
        for (let r = 0; r < 2; r++) {
            if (Math.random() < 0.5) {
                const rLeft = r === 0 ? road.left1 : road.left2;
                const x = rLeft + 20 + Math.random() * (road.width - 60);
                boosts.push(new Boost(x, -30));
            }
        }
    }
}

// === DRAW ===
function draw() {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (gameState === 'menu') {
        drawMenu();
        return;
    }
    if (gameState === 'modeSelect') {
        drawModeSelect();
        return;
    }

    drawRoad();
    
    // Draw boosts
    for (let b of boosts) b.draw(ctx);
    // Draw obstacles
    for (let obs of obstacles) obs.draw(ctx);
    // Draw opponents
    for (let opp of opponents) opp.draw(ctx);
    // Draw players
    for (let p of players) p.draw(ctx);

    // HUD
    drawHUD();

    if (gameState === 'gameOver') {
        drawGameOver();
    }
}

function drawMenu() {
    // Background road effect
    ctx.fillStyle = ROAD_COLOR;
    ctx.fillRect(canvas.width / 2 - 100, 0, 200, canvas.height);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🚴 Radrennen 🚴', canvas.width / 2, canvas.height / 2 - 80);

    ctx.font = '20px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Ein Fahrrad-Rennspiel', canvas.width / 2, canvas.height / 2 - 40);

    ctx.font = '22px sans-serif';
    ctx.fillStyle = '#00ccff';
    ctx.fillText('Leertaste / Enter zum Starten', canvas.width / 2, canvas.height / 2 + 30);
    ctx.fillStyle = '#888';
    ctx.font = '16px sans-serif';
    ctx.fillText('oder Gamepad A-Taste', canvas.width / 2, canvas.height / 2 + 60);

    // Controls info
    ctx.fillStyle = '#666';
    ctx.font = '14px sans-serif';
    ctx.fillText('Steuerung: WASD / Pfeiltasten / Gamepad | Springen: Leertaste / Enter', canvas.width / 2, canvas.height - 60);
    ctx.fillText('EmC² Saar e.V. – KI-Gaming Station', canvas.width / 2, canvas.height - 30);
}

function drawModeSelect() {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Spielmodus wählen', canvas.width / 2, canvas.height / 2 - 80);

    // 1 Player box
    ctx.strokeStyle = '#00ccff';
    ctx.lineWidth = 3;
    ctx.strokeRect(canvas.width / 2 - 180, canvas.height / 2 - 40, 150, 80);
    ctx.fillStyle = '#00ccff';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('1', canvas.width / 2 - 105, canvas.height / 2 + 5);
    ctx.font = '16px sans-serif';
    ctx.fillText('1 Spieler', canvas.width / 2 - 105, canvas.height / 2 + 30);

    // 2 Player box
    ctx.strokeStyle = '#ff4488';
    ctx.lineWidth = 3;
    ctx.strokeRect(canvas.width / 2 + 30, canvas.height / 2 - 40, 150, 80);
    ctx.fillStyle = '#ff4488';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('2', canvas.width / 2 + 105, canvas.height / 2 + 5);
    ctx.font = '16px sans-serif';
    ctx.fillText('2 Spieler', canvas.width / 2 + 105, canvas.height / 2 + 30);

    ctx.fillStyle = '#aaa';
    ctx.font = '18px sans-serif';
    ctx.fillText('Drücke 1 oder 2', canvas.width / 2, canvas.height / 2 + 80);

    ctx.fillStyle = '#666';
    ctx.font = '14px sans-serif';
    ctx.fillText('1 Spieler: WASD oder Pfeiltasten | Springen: Leertaste', canvas.width / 2, canvas.height / 2 + 120);
    ctx.fillText('2 Spieler: P1 = WASD + Leertaste, P2 = Pfeiltasten + Enter', canvas.width / 2, canvas.height / 2 + 145);
}

function drawRoad() {
    const road = getRoadBounds();

    if (playerMode === 1) {
        // Grass
        ctx.fillStyle = GRASS_COLOR_LEFT;
        ctx.fillRect(0, 0, road.left, canvas.height);
        ctx.fillRect(road.right, 0, canvas.width - road.right, canvas.height);

        // Road
        ctx.fillStyle = ROAD_COLOR;
        ctx.fillRect(road.left, 0, road.width, canvas.height);

        // Road edges
        ctx.fillStyle = '#fff';
        ctx.fillRect(road.left, 0, 3, canvas.height);
        ctx.fillRect(road.right - 3, 0, 3, canvas.height);

        // Lane markings
        const laneWidth = road.width / LANE_COUNT;
        for (let i = 1; i < LANE_COUNT; i++) {
            const lx = road.left + i * laneWidth;
            for (let my of roadMarkings) {
                ctx.fillStyle = LANE_LINE_COLOR;
                ctx.fillRect(lx - 1, my, 2, 40);
            }
        }
    } else {
        // Two roads
        // Grass everywhere first
        ctx.fillStyle = GRASS_COLOR_LEFT;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Road 1
        ctx.fillStyle = ROAD_COLOR;
        ctx.fillRect(road.left1, 0, road.width, canvas.height);
        ctx.fillStyle = '#fff';
        ctx.fillRect(road.left1, 0, 3, canvas.height);
        ctx.fillRect(road.right1 - 3, 0, 3, canvas.height);

        // Road 2
        ctx.fillStyle = ROAD_COLOR;
        ctx.fillRect(road.left2, 0, road.width, canvas.height);
        ctx.fillStyle = '#fff';
        ctx.fillRect(road.left2, 0, 3, canvas.height);
        ctx.fillRect(road.right2 - 3, 0, 3, canvas.height);

        // Lane markings for both roads
        const laneWidth = road.width / 4;
        for (let r = 0; r < 2; r++) {
            const rLeft = r === 0 ? road.left1 : road.left2;
            for (let i = 1; i < 4; i++) {
                const lx = rLeft + i * laneWidth;
                for (let my of roadMarkings) {
                    ctx.fillStyle = LANE_LINE_COLOR;
                    ctx.fillRect(lx - 1, my, 2, 40);
                }
            }
        }

        // Player labels
        ctx.fillStyle = PLAYER_COLORS[0];
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('P1', road.left1 + road.width / 2, 20);
        ctx.fillStyle = PLAYER_COLORS[1];
        ctx.fillText('P2', road.left2 + road.width / 2, 20);
    }
}

function drawHUD() {
    ctx.textAlign = 'left';
    ctx.font = 'bold 18px sans-serif';
    
    if (playerMode === 1) {
        ctx.fillStyle = '#fff';
        ctx.fillText('Score: ' + players[0].score, 10, 30);
        ctx.fillText('Distanz: ' + Math.floor(players[0].distance / 10) + 'm', 10, 55);
        
        // Speed indicator
        const speedPercent = players[0].speed / (players[0].maxSpeed + 2);
        ctx.fillStyle = '#333';
        ctx.fillRect(canvas.width - 30, canvas.height - 120, 15, 100);
        ctx.fillStyle = speedPercent > 0.8 ? '#ff4444' : '#00ccff';
        const barH = speedPercent * 100;
        ctx.fillRect(canvas.width - 30, canvas.height - 120 + (100 - barH), 15, barH);
    } else {
        // P1 score
        ctx.fillStyle = PLAYER_COLORS[0];
        ctx.fillText('P1: ' + (players[0]?.score || 0), 10, 30);
        if (!players[0]?.alive) {
            ctx.fillStyle = '#ff4444';
            ctx.fillText('✗', 150, 30);
        }
        // P2 score
        ctx.fillStyle = PLAYER_COLORS[1];
        ctx.textAlign = 'right';
        ctx.fillText('P2: ' + (players[1]?.score || 0), canvas.width - 10, 30);
        if (!players[1]?.alive) {
            ctx.fillStyle = '#ff4444';
            ctx.fillText('✗', canvas.width - 150, 30);
        }
    }
}

function drawGameOver() {
    // Overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText('Rennen vorbei!', canvas.width / 2, canvas.height / 2 - 80);

    if (playerMode === 1) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 28px sans-serif';
        ctx.fillText('Score: ' + players[0].score, canvas.width / 2, canvas.height / 2 - 20);
        ctx.font = '20px sans-serif';
        ctx.fillText('Distanz: ' + Math.floor(players[0].distance / 10) + 'm', canvas.width / 2, canvas.height / 2 + 20);
        ctx.fillText('Überholt: ' + players[0].overtaken, canvas.width / 2, canvas.height / 2 + 50);
    } else {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 28px sans-serif';
        ctx.fillText('Spieler ' + winner + ' gewinnt!', canvas.width / 2, canvas.height / 2 - 20);
        ctx.font = '20px sans-serif';
        ctx.fillStyle = PLAYER_COLORS[0];
        ctx.fillText('P1: ' + players[0].score + ' Punkte', canvas.width / 2, canvas.height / 2 + 20);
        ctx.fillStyle = PLAYER_COLORS[1];
        ctx.fillText('P2: ' + players[1].score + ' Punkte', canvas.width / 2, canvas.height / 2 + 50);
    }

    ctx.fillStyle = '#00ccff';
    ctx.font = '20px sans-serif';
    ctx.fillText('Leertaste / Enter für neues Spiel', canvas.width / 2, canvas.height / 2 + 110);
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

// === START ===
requestAnimationFrame(gameLoop);
