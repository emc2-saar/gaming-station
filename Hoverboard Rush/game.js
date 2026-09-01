const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

// ---------------------------------------------------------------------------
// Spielkonstanten
// ---------------------------------------------------------------------------
const TARGET_FPS = 60;

const LANE_COUNT = 4;
const LANE_WIDTH = W / LANE_COUNT;

const PLAYER_W = 46;
const PLAYER_H = 70;
const PLAYER_Y = H - 120;          // vertikale Position des Spielers (fix)
const LANE_SWITCH_SPEED = 0.35;    // wie schnell zwischen Spuren geglitten wird (pro dt)

const BASE_SPEED = 4.5;            // Start-Weltgeschwindigkeit (px pro dt)
const MAX_SPEED = 14;              // Höchstgeschwindigkeit
const SPEED_RAMP = 0.0009;         // wie schnell die Grundgeschwindigkeit steigt (pro dt)

const OBSTACLE_W = 46;
const OBSTACLE_H = 70;
const BOOST_R = 16;

const BOOST_POWER = 6;             // zusätzliche Geschwindigkeit bei Boost
const BOOST_DECAY = 0.04;          // wie schnell der Boost abklingt (pro dt)

// ---------------------------------------------------------------------------
// Spielzustand
// ---------------------------------------------------------------------------
let lastTime = 0;
let gameRunning = false;
let gameEnded = false;
let score = 0;
let best = 0;

let player;
let obstacles;
let boosts;
let stripes;         // Fahrbahn-Markierungen (Deko, scrollen mit)
let spawnTimer;
let boostSpawnTimer;
let worldSpeed;
let boostBoost;      // temporäre Extra-Geschwindigkeit
let flashTimer;      // kurzes rotes Aufblitzen ist nicht nötig -> genutzt für Boost-Glühen

// Eingabe-Kanten (damit ein Tastendruck nur einmal zählt)
let prevLeft = false;
let prevRight = false;

// ---------------------------------------------------------------------------
// Initialisierung / Reset
// ---------------------------------------------------------------------------
function resetState() {
    player = {
        lane: Math.floor(LANE_COUNT / 2),   // aktuelle Zielspur
        x: laneCenter(Math.floor(LANE_COUNT / 2)),
        tilt: 0                             // visuelles Neigen beim Spurwechsel
    };
    obstacles = [];
    boosts = [];
    stripes = [];
    for (let i = 0; i < 12; i++) {
        stripes.push({ y: (i / 12) * H, laneEdge: 0 });
    }
    spawnTimer = 60;
    boostSpawnTimer = 200;
    worldSpeed = BASE_SPEED;
    boostBoost = 0;
    flashTimer = 0;
    score = 0;
}

function laneCenter(lane) {
    return lane * LANE_WIDTH + LANE_WIDTH / 2;
}

// ---------------------------------------------------------------------------
// Eingabe
// ---------------------------------------------------------------------------
const keys = {};
document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'].includes(e.code)) {
        e.preventDefault();
    }
    if ((e.code === 'Space' || e.code === 'Enter') && !gameRunning) {
        startGame();
    }
});
document.addEventListener('keyup', (e) => { keys[e.code] = false; });

// Touch: linke/rechte Bildschirmhälfte antippen
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (!gameRunning) { startGame(); return; }
    const rect = canvas.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    if (x < rect.width / 2) moveLeft();
    else moveRight();
}, { passive: false });

function readGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads && pads[0];
    if (!gp) return { left: false, right: false, start: false };

    const DEAD = 0.15;
    const ax = gp.axes[0] || 0;
    const left = ax < -DEAD || (gp.buttons[14] && gp.buttons[14].pressed);   // D-Pad links
    const right = ax > DEAD || (gp.buttons[15] && gp.buttons[15].pressed);   // D-Pad rechts
    const start = (gp.buttons[0] && gp.buttons[0].pressed) ||                // A
                  (gp.buttons[9] && gp.buttons[9].pressed);                  // Start
    return { left, right, start };
}

function moveLeft() {
    if (player.lane > 0) { player.lane--; player.tilt = -1; }
}
function moveRight() {
    if (player.lane < LANE_COUNT - 1) { player.lane++; player.tilt = 1; }
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------
function update(dt) {
    const gp = readGamepad();

    if (!gameRunning) {
        if (gp.start) startGame();
        return;
    }

    // --- Eingabe: Spurwechsel (nur auf Flanke, also beim Drücken) ---
    const leftPressed = keys['ArrowLeft'] || keys['KeyA'] || gp.left;
    const rightPressed = keys['ArrowRight'] || keys['KeyD'] || gp.right;

    if (leftPressed && !prevLeft) moveLeft();
    if (rightPressed && !prevRight) moveRight();
    prevLeft = leftPressed;
    prevRight = rightPressed;

    // --- Spieler sanft zur Zielspur gleiten lassen ---
    const targetX = laneCenter(player.lane);
    player.x += (targetX - player.x) * Math.min(LANE_SWITCH_SPEED * dt, 1);
    // Neigung wieder ausgleichen
    player.tilt *= Math.pow(0.8, dt);

    // --- Geschwindigkeit steigt progressiv ---
    worldSpeed = Math.min(worldSpeed + SPEED_RAMP * dt, MAX_SPEED);
    boostBoost *= Math.pow(1 - BOOST_DECAY, dt);
    if (boostBoost < 0.05) boostBoost = 0;
    const speed = worldSpeed + boostBoost;

    // --- Deko-Streifen scrollen ---
    for (const s of stripes) {
        s.y += speed * dt;
        if (s.y > H) s.y -= H;
    }

    // --- Hindernisse spawnen (Accumulator-Pattern) ---
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
        spawnObstacle();
        // Spawn-Intervall wird mit steigender Geschwindigkeit kürzer
        const base = 70 - (worldSpeed - BASE_SPEED) * 3;
        spawnTimer = Math.max(22, base) + Math.random() * 25;
    }

    boostSpawnTimer -= dt;
    if (boostSpawnTimer <= 0) {
        spawnBoost();
        boostSpawnTimer = 260 + Math.random() * 200;
    }

    // --- Hindernisse bewegen + Kollision ---
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const o = obstacles[i];
        o.y += speed * dt;
        if (o.y > H + OBSTACLE_H) {
            obstacles.splice(i, 1);
            continue;
        }
        if (collideRect(player.x - PLAYER_W / 2, PLAYER_Y - PLAYER_H / 2, PLAYER_W, PLAYER_H,
                        o.x - OBSTACLE_W / 2, o.y - OBSTACLE_H / 2, OBSTACLE_W, OBSTACLE_H)) {
            gameOver();
            return;
        }
    }

    // --- Boosts bewegen + einsammeln ---
    for (let i = boosts.length - 1; i >= 0; i--) {
        const b = boosts[i];
        b.y += speed * dt;
        b.spin += 0.15 * dt;
        if (b.y > H + BOOST_R) { boosts.splice(i, 1); continue; }
        const dx = b.x - player.x;
        const dy = b.y - PLAYER_Y;
        if (Math.hypot(dx, dy) < BOOST_R + PLAYER_W / 2) {
            boosts.splice(i, 1);
            boostBoost = Math.min(boostBoost + BOOST_POWER, BOOST_POWER * 2);
            score += 50;
        }
    }

    // --- Score: Distanz ---
    score += speed * dt * 0.15;
}

function spawnObstacle() {
    // Nicht alle Spuren gleichzeitig blockieren: max LANE_COUNT-1
    const lane = Math.floor(Math.random() * LANE_COUNT);
    obstacles.push({ x: laneCenter(lane), y: -OBSTACLE_H, hue: 190 + Math.random() * 40 });
}

function spawnBoost() {
    const lane = Math.floor(Math.random() * LANE_COUNT);
    boosts.push({ x: laneCenter(lane), y: -BOOST_R, spin: 0 });
}

function collideRect(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// ---------------------------------------------------------------------------
// Zeichnen
// ---------------------------------------------------------------------------
function draw() {
    // Hintergrund (Bahn mit Perspektiv-Verlauf)
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0a1030');
    grad.addColorStop(1, '#1a2350');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    if (!gameRunning && !gameEnded) {
        drawStartScreen();
        return;
    }

    drawTrack();

    // Boosts
    for (const b of boosts) drawBoost(b);
    // Hindernisse
    for (const o of obstacles) drawObstacle(o);
    // Spieler
    drawPlayer();

    // HUD
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Score: ' + Math.floor(score), 14, 32);

    // Boost-Anzeige
    if (boostBoost > 0.1) {
        ctx.fillStyle = '#00e5ff';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('BOOST!', W - 14, 32);
    }

    if (gameEnded) drawGameOver();
}

function drawTrack() {
    // Spur-Trennlinien
    ctx.strokeStyle = 'rgba(120,160,255,0.25)';
    ctx.lineWidth = 2;
    for (let i = 1; i < LANE_COUNT; i++) {
        const x = i * LANE_WIDTH;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
    }
    // scrollende Mittelstreifen pro Spur
    ctx.fillStyle = 'rgba(0,229,255,0.18)';
    for (const s of stripes) {
        for (let i = 0; i < LANE_COUNT; i++) {
            const cx = laneCenter(i);
            ctx.fillRect(cx - 3, s.y, 6, 26);
        }
    }
}

function drawPlayer() {
    ctx.save();
    ctx.translate(player.x, PLAYER_Y);
    ctx.rotate(player.tilt * 0.18);

    // Board (Hoverboard-Glühen)
    ctx.fillStyle = 'rgba(0,229,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, PLAYER_H / 2 - 4, PLAYER_W / 2 + 6, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0ff';
    roundRect(-PLAYER_W / 2, PLAYER_H / 2 - 12, PLAYER_W, 12, 6);
    ctx.fill();

    // Fahrer
    ctx.fillStyle = '#ff5ea8';
    roundRect(-PLAYER_W / 2 + 8, -PLAYER_H / 2, PLAYER_W - 16, PLAYER_H - 14, 10);
    ctx.fill();

    // Kopf
    ctx.fillStyle = '#ffd9a0';
    ctx.beginPath();
    ctx.arc(0, -PLAYER_H / 2 + 2, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function drawObstacle(o) {
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.fillStyle = 'rgba(255,80,80,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, OBSTACLE_H / 2 - 4, OBSTACLE_W / 2 + 5, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    // rivalisierendes Board
    ctx.fillStyle = 'hsl(' + o.hue + ', 70%, 55%)';
    roundRect(-OBSTACLE_W / 2, OBSTACLE_H / 2 - 12, OBSTACLE_W, 12, 6);
    ctx.fill();

    ctx.fillStyle = '#7a3cff';
    roundRect(-OBSTACLE_W / 2 + 8, -OBSTACLE_H / 2, OBSTACLE_W - 16, OBSTACLE_H - 14, 10);
    ctx.fill();

    ctx.fillStyle = '#e0e0e0';
    ctx.beginPath();
    ctx.arc(0, -OBSTACLE_H / 2 + 2, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawBoost(b) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.spin);
    ctx.fillStyle = '#ffe14d';
    ctx.shadowColor = '#ffe14d';
    ctx.shadowBlur = 15;
    // Blitz-Stern
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        const a2 = a + Math.PI / 5;
        ctx.lineTo(Math.cos(a) * BOOST_R, Math.sin(a) * BOOST_R);
        ctx.lineTo(Math.cos(a2) * BOOST_R * 0.5, Math.sin(a2) * BOOST_R * 0.5);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function drawStartScreen() {
    // Deko-Bahn im Hintergrund
    drawTrack();

    ctx.fillStyle = '#00e5ff';
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Hoverboard Rush', W / 2, H / 2 - 80);

    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText('Weiche den anderen Boards aus,', W / 2, H / 2 - 20);
    ctx.fillText('sammle Blitze fuer Boost!', W / 2, H / 2 + 6);

    ctx.fillStyle = '#ffe14d';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('Leertaste zum Starten', W / 2, H / 2 + 70);

    ctx.fillStyle = '#b7c4ff';
    ctx.font = '16px sans-serif';
    ctx.fillText('Pfeiltasten / A-D / Gamepad zum Steuern', W / 2, H / 2 + 100);

    if (best > 0) {
        ctx.fillStyle = '#8fa0d0';
        ctx.fillText('Bester Score: ' + Math.floor(best), W / 2, H / 2 + 140);
    }
}

function drawGameOver() {
    ctx.fillStyle = 'rgba(5, 8, 25, 0.78)';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#ff5ea8';
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Crash!', W / 2, H / 2 - 70);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('Score: ' + Math.floor(score), W / 2, H / 2 - 10);

    ctx.fillStyle = '#ffe14d';
    ctx.fillText('Bester: ' + Math.floor(best), W / 2, H / 2 + 30);

    // Neustart-Button
    const bw = 220, bh = 54;
    const bx = W / 2 - bw / 2, by = H / 2 + 70;
    ctx.fillStyle = '#00e5ff';
    roundRect(bx, by, bw, bh, 12);
    ctx.fill();
    ctx.fillStyle = '#08122e';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('Nochmal (Leertaste)', W / 2, by + 35);
}

// Klick/Tap auf Neustart-Button
canvas.addEventListener('click', (e) => {
    if (!gameEnded) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (W / rect.width);
    const y = (e.clientY - rect.top) * (H / rect.height);
    const bw = 220, bh = 54;
    const bx = W / 2 - bw / 2, by = H / 2 + 70;
    if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) startGame();
});

// ---------------------------------------------------------------------------
// Spielsteuerung
// ---------------------------------------------------------------------------
function startGame() {
    resetState();
    gameRunning = true;
    gameEnded = false;
    lastTime = 0;
    prevLeft = prevRight = false;
}

function gameOver() {
    gameRunning = false;
    gameEnded = true;
    if (score > best) best = score;
}

// ---------------------------------------------------------------------------
// Game-Loop (frame-rate-unabhaengig)
// ---------------------------------------------------------------------------
function gameLoop(timestamp) {
    if (lastTime === 0) lastTime = timestamp;
    const elapsed = timestamp - lastTime;
    lastTime = timestamp;
    const dt = Math.min(elapsed / (1000 / TARGET_FPS), 3);

    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
}

// Zustand einmal initialisieren, damit der Start-Screen (der drawTrack nutzt)
// gueltige Arrays hat, bevor das Spiel gestartet wurde.
resetState();
gameEnded = false;
requestAnimationFrame(gameLoop);
