const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const TARGET_FPS = 60;
let lastTime = 0;

// Game states: 'start', 'playing', 'gameover'
let gameState = 'start';
let score = 0;
let highScore = 0;
let difficulty = 1;

// Road
const ROAD_LEFT = 90;
const ROAD_RIGHT = 390;
const LANE_COUNT = 3;
const LANE_WIDTH = (ROAD_RIGHT - ROAD_LEFT) / LANE_COUNT;

// Player car
const player = {
    lane: 1,
    x: 0,
    y: 0,
    width: 40,
    height: 70,
    targetX: 0,
    moveSpeed: 12
};

// Objects on road
let flags = [];
let obstacles = [];
let roadLines = [];
let roadSpeed = 5;
let spawnAccumulator = 0;
let obstacleAccumulator = 0;

// Input
const keys = {};

// WM 2026 Flaggen (Teilnehmerländer als Farbstreifen)
const FLAG_DATA = [
    { name: 'Deutschland', colors: ['#000000', '#DD0000', '#FFCE00'], type: 'h' },
    { name: 'Frankreich', colors: ['#002395', '#FFFFFF', '#ED2939'], type: 'v' },
    { name: 'Brasilien', colors: ['#009739', '#FEDD00', '#009739'], type: 'h' },
    { name: 'Argentinien', colors: ['#74ACDF', '#FFFFFF', '#74ACDF'], type: 'h' },
    { name: 'Spanien', colors: ['#AA151B', '#F1BF00', '#AA151B'], type: 'h' },
    { name: 'Portugal', colors: ['#006600', '#006600', '#FF0000'], type: 'v' },
    { name: 'Niederlande', colors: ['#AE1C28', '#FFFFFF', '#21468B'], type: 'h' },
    { name: 'Italien', colors: ['#009246', '#FFFFFF', '#CE2B37'], type: 'v' },
    { name: 'England', colors: ['#FFFFFF', '#CF081F', '#FFFFFF'], type: 'h' },
    { name: 'Japan', colors: ['#FFFFFF', '#BC002D', '#FFFFFF'], type: 'circle' },
    { name: 'Mexiko', colors: ['#006847', '#FFFFFF', '#CE1126'], type: 'v' },
    { name: 'USA', colors: ['#B31942', '#FFFFFF', '#0A3161'], type: 'h' },
    { name: 'Belgien', colors: ['#000000', '#FDDA24', '#EF3340'], type: 'v' },
    { name: 'Kroatien', colors: ['#FF0000', '#FFFFFF', '#171796'], type: 'h' },
    { name: 'Marokko', colors: ['#C1272D', '#006233', '#C1272D'], type: 'h' },
    { name: 'Senegal', colors: ['#00853F', '#FDEF42', '#E31B23'], type: 'v' },
];

function getLaneX(lane) {
    return ROAD_LEFT + lane * LANE_WIDTH + LANE_WIDTH / 2;
}

function initPlayer() {
    player.lane = 1;
    player.x = getLaneX(1);
    player.targetX = player.x;
    player.y = canvas.height - 120;
}

function spawnFlag() {
    const lane = Math.floor(Math.random() * LANE_COUNT);
    const flagData = FLAG_DATA[Math.floor(Math.random() * FLAG_DATA.length)];
    flags.push({
        x: getLaneX(lane),
        y: -50,
        width: 36,
        height: 28,
        lane: lane,
        flag: flagData,
        collected: false,
        alpha: 1
    });
}

function spawnObstacle() {
    const lane = Math.floor(Math.random() * LANE_COUNT);
    obstacles.push({
        x: getLaneX(lane),
        y: -60,
        width: 38,
        height: 65,
        lane: lane
    });
}

function initRoadLines() {
    roadLines = [];
    for (let i = 0; i < 10; i++) {
        roadLines.push({ y: i * 80 });
    }
}

function startGame() {
    score = 0;
    difficulty = 1;
    roadSpeed = 5;
    flags = [];
    obstacles = [];
    spawnAccumulator = 0;
    obstacleAccumulator = 0;
    gameState = 'playing';
    lastTime = 0;
    initPlayer();
    initRoadLines();
}

function gameOver() {
    gameState = 'gameover';
    if (score > highScore) highScore = score;
}

function update(dt) {
    if (gameState !== 'playing') return;

    // Difficulty increases over time
    difficulty += 0.001 * dt;
    roadSpeed = 5 + (difficulty - 1) * 2;

    // Player movement
    if (keys['ArrowLeft'] || keys['KeyA']) {
        if (player.lane > 0 && Math.abs(player.x - player.targetX) < 5) {
            player.lane--;
            player.targetX = getLaneX(player.lane);
        }
    }
    if (keys['ArrowRight'] || keys['KeyD']) {
        if (player.lane < LANE_COUNT - 1 && Math.abs(player.x - player.targetX) < 5) {
            player.lane++;
            player.targetX = getLaneX(player.lane);
        }
    }

    // Smooth movement to target lane
    const dx = player.targetX - player.x;
    if (Math.abs(dx) > 1) {
        player.x += Math.sign(dx) * player.moveSpeed * dt;
    } else {
        player.x = player.targetX;
    }

    // Road lines
    for (let line of roadLines) {
        line.y += roadSpeed * dt;
        if (line.y > canvas.height) {
            line.y -= 800;
        }
    }

    // Spawn flags
    spawnAccumulator += dt;
    const flagInterval = Math.max(30, 60 - difficulty * 5);
    if (spawnAccumulator >= flagInterval) {
        spawnAccumulator = 0;
        spawnFlag();
    }

    // Spawn obstacles
    obstacleAccumulator += dt;
    const obstacleInterval = Math.max(50, 90 - difficulty * 5);
    if (obstacleAccumulator >= obstacleInterval) {
        obstacleAccumulator = 0;
        spawnObstacle();
    }

    // Move flags
    for (let i = flags.length - 1; i >= 0; i--) {
        flags[i].y += roadSpeed * dt;
        if (flags[i].y > canvas.height + 50) {
            flags.splice(i, 1);
            continue;
        }
        // Collision with player
        if (!flags[i].collected && checkCollision(player, flags[i])) {
            flags[i].collected = true;
            score += 10;
        }
        // Remove collected flags after fade
        if (flags[i] && flags[i].collected) {
            flags[i].alpha -= 0.05 * dt;
            if (flags[i].alpha <= 0) {
                flags.splice(i, 1);
            }
        }
    }

    // Move obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        obstacles[i].y += roadSpeed * dt;
        if (obstacles[i].y > canvas.height + 80) {
            obstacles.splice(i, 1);
            continue;
        }
        // Collision with player
        if (checkCollision(player, obstacles[i])) {
            gameOver();
            return;
        }
    }

    // Score for surviving
    score += 0.05 * dt;
}

function checkCollision(a, b) {
    const ax = a.x - a.width / 2;
    const ay = a.y - a.height / 2;
    const bx = b.x - b.width / 2;
    const by = b.y - b.height / 2;
    return ax < bx + b.width &&
           ax + a.width > bx &&
           ay < by + b.height &&
           ay + a.height > by;
}

function draw() {
    // Background
    ctx.fillStyle = '#2d5a27';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Road
    ctx.fillStyle = '#333333';
    ctx.fillRect(ROAD_LEFT, 0, ROAD_RIGHT - ROAD_LEFT, canvas.height);

    // Road edges
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ROAD_LEFT - 3, 0, 3, canvas.height);
    ctx.fillRect(ROAD_RIGHT, 0, 3, canvas.height);

    // Road curbs (red-white)
    for (let i = 0; i < canvas.height; i += 20) {
        ctx.fillStyle = i % 40 < 20 ? '#ff0000' : '#ffffff';
        ctx.fillRect(ROAD_LEFT - 10, i, 7, 20);
        ctx.fillRect(ROAD_RIGHT + 3, i, 7, 20);
    }

    if (gameState === 'start') {
        drawStartScreen();
        return;
    }

    // Road lines (dashed center lines)
    ctx.fillStyle = '#ffffff';
    for (let line of roadLines) {
        for (let l = 1; l < LANE_COUNT; l++) {
            const lx = ROAD_LEFT + l * LANE_WIDTH - 2;
            ctx.fillRect(lx, line.y, 4, 40);
        }
    }

    // Draw flags
    for (let flag of flags) {
        if (flag.collected) {
            ctx.globalAlpha = flag.alpha;
            drawCollectedFlag(flag);
            ctx.globalAlpha = 1;
        } else {
            drawFlag(flag);
        }
    }

    // Draw obstacles (other cars)
    for (let obs of obstacles) {
        drawObstacleCar(obs);
    }

    // Draw player car
    drawPlayerCar();

    // HUD
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, canvas.width, 40);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🏁 Score: ' + Math.floor(score), 10, 28);
    ctx.textAlign = 'right';
    ctx.fillText('⚡ ' + (roadSpeed * 20).toFixed(0) + ' km/h', canvas.width - 10, 28);

    if (gameState === 'gameover') {
        drawGameOverScreen();
    }
}

function drawFlag(flag) {
    const x = flag.x - flag.width / 2;
    const y = flag.y - flag.height / 2;
    const w = flag.width;
    const h = flag.height;
    const f = flag.flag;

    // Flag pole
    ctx.fillStyle = '#888888';
    ctx.fillRect(x - 3, y - 5, 3, h + 10);

    // Flag background
    if (f.type === 'h') {
        // Horizontal stripes
        const stripeH = h / 3;
        for (let i = 0; i < 3; i++) {
            ctx.fillStyle = f.colors[i];
            ctx.fillRect(x, y + i * stripeH, w, stripeH);
        }
    } else if (f.type === 'v') {
        // Vertical stripes
        const stripeW = w / 3;
        for (let i = 0; i < 3; i++) {
            ctx.fillStyle = f.colors[i];
            ctx.fillRect(x + i * stripeW, y, stripeW, h);
        }
    } else if (f.type === 'circle') {
        // Japan-style (white bg, red circle)
        ctx.fillStyle = f.colors[0];
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = f.colors[1];
        ctx.beginPath();
        ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 4, 0, Math.PI * 2);
        ctx.fill();
    }

    // Border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
}

function drawCollectedFlag(flag) {
    const x = flag.x;
    const y = flag.y - 10;
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('+10', x, y);
}

function drawPlayerCar(/* uses player obj */) {
    const x = player.x;
    const y = player.y;
    const w = player.width;
    const h = player.height;

    // Car body
    ctx.fillStyle = '#1E90FF';
    ctx.beginPath();
    ctx.roundRect(x - w/2, y - h/2, w, h, 8);
    ctx.fill();

    // Windshield
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(x - w/3, y - h/4, w*2/3, h/5);

    // Rear window
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(x - w/3, y + h/6, w*2/3, h/7);

    // Wheels
    ctx.fillStyle = '#222222';
    ctx.fillRect(x - w/2 - 4, y - h/3, 6, 16);
    ctx.fillRect(x + w/2 - 2, y - h/3, 6, 16);
    ctx.fillRect(x - w/2 - 4, y + h/6, 6, 16);
    ctx.fillRect(x + w/2 - 2, y + h/6, 6, 16);

    // Racing stripe
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 3, y - h/2, 6, h);
}

function drawObstacleCar(obs) {
    const x = obs.x;
    const y = obs.y;
    const w = obs.width;
    const h = obs.height;

    // Car body (red/orange tones)
    const colors = ['#DC143C', '#FF4500', '#8B0000', '#FF6347', '#B22222'];
    const colorIdx = Math.abs(Math.floor(obs.y * 0.1)) % colors.length;
    ctx.fillStyle = colors[colorIdx];
    ctx.beginPath();
    ctx.roundRect(x - w/2, y - h/2, w, h, 8);
    ctx.fill();

    // Windshield
    ctx.fillStyle = '#333333';
    ctx.fillRect(x - w/3, y + h/8, w*2/3, h/5);

    // Rear lights
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(x - w/3, y + h/3, 8, 6);
    ctx.fillRect(x + w/3 - 8, y + h/3, 8, 6);

    // Wheels
    ctx.fillStyle = '#222222';
    ctx.fillRect(x - w/2 - 4, y - h/3, 6, 16);
    ctx.fillRect(x + w/2 - 2, y - h/3, 6, 16);
    ctx.fillRect(x - w/2 - 4, y + h/6, 6, 16);
    ctx.fillRect(x + w/2 - 2, y + h/6, 6, 16);
}

function drawStartScreen() {
    // Overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Title
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏎️ WM Racer 🏁', canvas.width / 2, 180);

    // Subtitle
    ctx.fillStyle = '#ffffff';
    ctx.font = '18px sans-serif';
    ctx.fillText('Sammle die WM-Flaggen!', canvas.width / 2, 230);

    // Draw sample flags
    const sampleFlags = [FLAG_DATA[0], FLAG_DATA[2], FLAG_DATA[3], FLAG_DATA[5]];
    for (let i = 0; i < sampleFlags.length; i++) {
        const fx = 140 + i * 75;
        const fy = 270;
        drawFlagAt(sampleFlags[i], fx, fy, 44, 30);
    }

    // Controls
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '16px sans-serif';
    ctx.fillText('← → / 🎮 Stick/D-Pad zum Lenken', canvas.width / 2, 350);
    ctx.fillText('Weiche den roten Autos aus!', canvas.width / 2, 380);

    // Start prompt
    ctx.fillStyle = '#00FF88';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('[ LEERTASTE / 🎮 ] zum Starten', canvas.width / 2, 450);

    if (highScore > 0) {
        ctx.fillStyle = '#FFD700';
        ctx.font = '16px sans-serif';
        ctx.fillText('Highscore: ' + Math.floor(highScore), canvas.width / 2, 500);
    }
}

function drawGameOverScreen() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#FF4444';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('💥 CRASH!', canvas.width / 2, 220);

    ctx.fillStyle = '#ffffff';
    ctx.font = '22px sans-serif';
    ctx.fillText('Score: ' + Math.floor(score), canvas.width / 2, 280);

    if (score >= highScore) {
        ctx.fillStyle = '#FFD700';
        ctx.font = '18px sans-serif';
        ctx.fillText('⭐ Neuer Highscore! ⭐', canvas.width / 2, 320);
    }

    ctx.fillStyle = '#00FF88';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('[ LEERTASTE / 🎮 ] Nochmal', canvas.width / 2, 400);
}

function drawFlagAt(flagData, x, y, w, h) {
    if (flagData.type === 'h') {
        const stripeH = h / 3;
        for (let i = 0; i < 3; i++) {
            ctx.fillStyle = flagData.colors[i];
            ctx.fillRect(x - w/2, y - h/2 + i * stripeH, w, stripeH);
        }
    } else if (flagData.type === 'v') {
        const stripeW = w / 3;
        for (let i = 0; i < 3; i++) {
            ctx.fillStyle = flagData.colors[i];
            ctx.fillRect(x - w/2 + i * stripeW, y - h/2, stripeW, h);
        }
    } else if (flagData.type === 'circle') {
        ctx.fillStyle = flagData.colors[0];
        ctx.fillRect(x - w/2, y - h/2, w, h);
        ctx.fillStyle = flagData.colors[1];
        ctx.beginPath();
        ctx.arc(x, y, Math.min(w, h) / 4, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - w/2, y - h/2, w, h);
}

// Input handling
document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Space') {
        e.preventDefault();
        if (gameState === 'start' || gameState === 'gameover') {
            startGame();
        }
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// Touch controls
let touchStartX = 0;
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    touchStartX = e.touches[0].clientX;
    if (gameState === 'start' || gameState === 'gameover') {
        startGame();
    }
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touchX = e.touches[0].clientX;
    const diff = touchX - touchStartX;
    if (Math.abs(diff) > 30) {
        if (diff > 0) {
            keys['ArrowRight'] = true;
            keys['ArrowLeft'] = false;
        } else {
            keys['ArrowLeft'] = true;
            keys['ArrowRight'] = false;
        }
        touchStartX = touchX;
    }
});

canvas.addEventListener('touchend', () => {
    keys['ArrowLeft'] = false;
    keys['ArrowRight'] = false;
});

// === GAMEPAD SUPPORT (Nintendo Switch Pro Controller kompatibel) ===
const AXIS_THRESHOLD = 0.5;
const gpState = { left: false, right: false, a: false };

function pollGamepad() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (const pad of gamepads) { if (pad && pad.connected) { gp = pad; break; } }
    if (!gp) return;

    const aButton = gp.buttons[0]?.pressed || gp.buttons[1]?.pressed;
    const left = gp.buttons[14]?.pressed || gp.axes[0] < -AXIS_THRESHOLD;
    const right = gp.buttons[15]?.pressed || gp.axes[0] > AXIS_THRESHOLD;

    if (gameState !== 'playing') {
        if (aButton && !gpState.a) startGame();
        gpState.a = aButton;
        gpState.left = left;
        gpState.right = right;
        return;
    }

    // Spurwechsel über Controller (nur bei neuer Betätigung)
    if (left && !gpState.left) {
        keys['ArrowLeft'] = true;
        setTimeout(() => { keys['ArrowLeft'] = false; }, 100);
    }
    if (right && !gpState.right) {
        keys['ArrowRight'] = true;
        setTimeout(() => { keys['ArrowRight'] = false; }, 100);
    }

    gpState.left = left;
    gpState.right = right;
    gpState.a = aButton;
}

let gamepadInterval = null;
function startGamepadPolling() { if (!gamepadInterval) gamepadInterval = setInterval(pollGamepad, 50); }
function stopGamepadPolling() { if (gamepadInterval) { clearInterval(gamepadInterval); gamepadInterval = null; } }

window.addEventListener('gamepadconnected', () => startGamepadPolling());
window.addEventListener('gamepaddisconnected', () => {
    const pads = navigator.getGamepads();
    if (!Array.from(pads).some(p => p && p.connected)) stopGamepadPolling();
});
window.addEventListener('load', () => {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) { if (p && p.connected) { startGamepadPolling(); break; } }
});

// Game loop
function gameLoop(timestamp) {
    if (lastTime === 0) lastTime = timestamp;
    const elapsed = timestamp - lastTime;
    lastTime = timestamp;
    const dt = Math.min(elapsed / (1000 / TARGET_FPS), 3);

    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
}

initPlayer();
initRoadLines();
requestAnimationFrame(gameLoop);
