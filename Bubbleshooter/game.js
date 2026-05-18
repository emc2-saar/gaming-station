// === Bubble Shooter Game ===

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');

// --- Constants ---
const BUBBLE_RADIUS = 20;
const BUBBLE_DIAMETER = BUBBLE_RADIUS * 2;
const COLS = 12;
const ROWS = 12;
const ROW_HEIGHT = BUBBLE_DIAMETER * 0.866; // sqrt(3)/2 for hex packing
const SHOOT_SPEED = 12;
const COLORS = ['#e94560', '#0f3460', '#00b4d8', '#06d6a0', '#ffd166', '#9b5de5'];

// Delta-Time Basis
const TARGET_FPS = 60;
let lastTime = 0;

// --- Game State ---
let grid = [];
let shooterBubble = null;
let nextBubble = null;
let shootingBubble = null;
let aimAngle = -Math.PI / 2;
let score = 0;
let gameOver = false;
let animating = false;

// --- Progressive difficulty ---
let shotsFired = 0;
let shotsUntilNewRow = 10;
let difficultyStage = 0;
const DIFFICULTY_THRESHOLDS = [10, 5, 3, 2];

// --- Falling bubbles animation ---
let fallingBubbles = [];

// --- Initialize Grid ---
function initGrid() {
    grid = [];
    for (let row = 0; row < ROWS; row++) {
        grid[row] = [];
        for (let col = 0; col < COLS; col++) {
            grid[row][col] = null;
        }
    }
    const fillRows = 5;
    for (let row = 0; row < fillRows; row++) {
        const maxCols = row % 2 === 0 ? COLS : COLS - 1;
        for (let col = 0; col < maxCols; col++) {
            grid[row][col] = {
                color: COLORS[Math.floor(Math.random() * COLORS.length)]
            };
        }
    }
}

// --- Get bubble position from grid coordinates ---
function getBubblePos(row, col) {
    const offset = row % 2 === 1 ? BUBBLE_RADIUS : 0;
    const x = col * BUBBLE_DIAMETER + BUBBLE_RADIUS + offset;
    const y = row * ROW_HEIGHT + BUBBLE_RADIUS;
    return { x, y };
}

// --- Get grid coordinates from position ---
function getGridCoords(x, y) {
    let row = Math.round((y - BUBBLE_RADIUS) / ROW_HEIGHT);
    row = Math.max(0, Math.min(ROWS - 1, row));
    const offset = row % 2 === 1 ? BUBBLE_RADIUS : 0;
    let col = Math.round((x - BUBBLE_RADIUS - offset) / BUBBLE_DIAMETER);
    const maxCols = row % 2 === 0 ? COLS : COLS - 1;
    col = Math.max(0, Math.min(maxCols - 1, col));
    return { row, col };
}

// --- Create a random bubble ---
function createBubble() {
    return { color: COLORS[Math.floor(Math.random() * COLORS.length)] };
}

// --- Initialize shooter ---
function initShooter() {
    shooterBubble = createBubble();
    nextBubble = createBubble();
}

// --- Draw a single bubble ---
function drawBubble(x, y, color, radius) {
    radius = radius || BUBBLE_RADIUS;
    ctx.beginPath();
    ctx.arc(x, y, radius - 1, 0, Math.PI * 2);

    const gradient = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, radius * 0.1, x, y, radius);
    gradient.addColorStop(0, lightenColor(color, 60));
    gradient.addColorStop(1, color);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
}

// --- Lighten a color ---
function lightenColor(color, amount) {
    const num = parseInt(color.slice(1), 16);
    const r = Math.min(255, (num >> 16) + amount);
    const g = Math.min(255, ((num >> 8) & 0x00FF) + amount);
    const b = Math.min(255, (num & 0x0000FF) + amount);
    return `rgb(${r},${g},${b})`;
}

// --- Draw the grid ---
function drawGrid() {
    for (let row = 0; row < ROWS; row++) {
        const maxCols = row % 2 === 0 ? COLS : COLS - 1;
        for (let col = 0; col < maxCols; col++) {
            if (grid[row][col]) {
                const pos = getBubblePos(row, col);
                drawBubble(pos.x, pos.y, grid[row][col].color);
            }
        }
    }
}

// --- Draw the shooter ---
function drawShooter() {
    const shooterX = canvas.width / 2;
    const shooterY = canvas.height - 50;

    // Draw aim line
    ctx.beginPath();
    ctx.setLineDash([5, 5]);
    ctx.moveTo(shooterX, shooterY);
    const lineLen = 80;
    ctx.lineTo(
        shooterX + Math.cos(aimAngle) * lineLen,
        shooterY + Math.sin(aimAngle) * lineLen
    );
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw current bubble
    if (shooterBubble) {
        drawBubble(shooterX, shooterY, shooterBubble.color);
    }

    // Draw next bubble
    if (nextBubble) {
        drawBubble(shooterX - 60, shooterY + 10, nextBubble.color, BUBBLE_RADIUS * 0.7);
        ctx.fillStyle = '#888';
        ctx.font = '11px sans-serif';
        ctx.fillText('Nächste', shooterX - 80, shooterY + 35);
    }

    // Draw shots remaining
    const shotsRemaining = shotsUntilNewRow - shotsFired;
    ctx.fillStyle = '#e94560';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Neue Reihe in: ${shotsRemaining}`, shooterX + 80, shooterY + 35);
    ctx.textAlign = 'start';
}

// --- Draw shooting bubble ---
function drawShootingBubble() {
    if (shootingBubble) {
        drawBubble(shootingBubble.x, shootingBubble.y, shootingBubble.color);
    }
}

// --- Draw falling bubbles ---
function drawFallingBubbles() {
    for (const b of fallingBubbles) {
        drawBubble(b.x, b.y, b.color, b.radius);
    }
}

// --- Add a new row at the top ---
function addRowFromTop() {
    for (let row = ROWS - 1; row > 0; row--) {
        grid[row] = grid[row - 1];
    }
    grid[0] = [];
    const maxCols = COLS;
    for (let col = 0; col < maxCols; col++) {
        grid[0][col] = { color: COLORS[Math.floor(Math.random() * COLORS.length)] };
    }
    checkGameOver();
}

// --- Shoot ---
function shoot() {
    if (shootingBubble || animating || gameOver) return;

    const shooterX = canvas.width / 2;
    const shooterY = canvas.height - 50;

    shootingBubble = {
        x: shooterX,
        y: shooterY,
        vx: Math.cos(aimAngle) * SHOOT_SPEED,
        vy: Math.sin(aimAngle) * SHOOT_SPEED,
        color: shooterBubble.color
    };

    shooterBubble = nextBubble;
    nextBubble = createBubble();

    shotsFired++;
    if (shotsFired >= shotsUntilNewRow) {
        shotsFired = 0;
        difficultyStage++;
        if (difficultyStage < DIFFICULTY_THRESHOLDS.length) {
            shotsUntilNewRow = DIFFICULTY_THRESHOLDS[difficultyStage];
        } else {
            shotsUntilNewRow = DIFFICULTY_THRESHOLDS[DIFFICULTY_THRESHOLDS.length - 1];
        }
        setTimeout(() => {
            if (!gameOver) {
                addRowFromTop();
            }
        }, 600);
    }
}

// --- Update shooting bubble (delta-time aware) ---
function updateShootingBubble(dt) {
    if (!shootingBubble) return;

    shootingBubble.x += shootingBubble.vx * dt;
    shootingBubble.y += shootingBubble.vy * dt;

    // Wall bounce
    if (shootingBubble.x - BUBBLE_RADIUS <= 0 || shootingBubble.x + BUBBLE_RADIUS >= canvas.width) {
        shootingBubble.vx *= -1;
        shootingBubble.x = Math.max(BUBBLE_RADIUS, Math.min(canvas.width - BUBBLE_RADIUS, shootingBubble.x));
    }

    // Ceiling collision
    if (shootingBubble.y - BUBBLE_RADIUS <= 0) {
        snapBubble();
        return;
    }

    // Grid collision
    for (let row = 0; row < ROWS; row++) {
        const maxCols = row % 2 === 0 ? COLS : COLS - 1;
        for (let col = 0; col < maxCols; col++) {
            if (grid[row][col]) {
                const pos = getBubblePos(row, col);
                const dx = shootingBubble.x - pos.x;
                const dy = shootingBubble.y - pos.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < BUBBLE_DIAMETER - 2) {
                    snapBubble();
                    return;
                }
            }
        }
    }

    // Off screen
    if (shootingBubble.y > canvas.height + BUBBLE_RADIUS) {
        shootingBubble = null;
    }
}

// --- Snap bubble to grid ---
function snapBubble() {
    const coords = getGridCoords(shootingBubble.x, shootingBubble.y);
    let { row, col } = coords;

    if (grid[row] && grid[row][col]) {
        const neighbors = getNeighbors(row, col);
        let bestDist = Infinity;
        let bestR = row, bestC = col;
        for (const [nr, nc] of neighbors) {
            if (nr >= 0 && nr < ROWS && !grid[nr][nc]) {
                const pos = getBubblePos(nr, nc);
                const dx = shootingBubble.x - pos.x;
                const dy = shootingBubble.y - pos.y;
                const dist = dx * dx + dy * dy;
                if (dist < bestDist) {
                    bestDist = dist;
                    bestR = nr;
                    bestC = nc;
                }
            }
        }
        row = bestR;
        col = bestC;
    }

    if (row >= ROWS) {
        gameOver = true;
        shootingBubble = null;
        return;
    }

    grid[row][col] = { color: shootingBubble.color };
    shootingBubble = null;

    const matches = findMatches(row, col);
    if (matches.length >= 3) {
        for (const [mr, mc] of matches) {
            grid[mr][mc] = null;
        }
        score += matches.length * 10;
        scoreEl.textContent = score;
        removeFloating();
    }

    checkGameOver();
}

// --- Get neighbors of a cell ---
function getNeighbors(row, col) {
    const even = row % 2 === 0;
    if (even) {
        return [
            [row - 1, col - 1], [row - 1, col],
            [row, col - 1], [row, col + 1],
            [row + 1, col - 1], [row + 1, col]
        ];
    } else {
        return [
            [row - 1, col], [row - 1, col + 1],
            [row, col - 1], [row, col + 1],
            [row + 1, col], [row + 1, col + 1]
        ];
    }
}

// --- Find matching bubbles (BFS) ---
function findMatches(row, col) {
    const color = grid[row][col].color;
    const visited = new Set();
    const queue = [[row, col]];
    const matches = [];
    visited.add(`${row},${col}`);

    while (queue.length > 0) {
        const [r, c] = queue.shift();
        matches.push([r, c]);

        const neighbors = getNeighbors(r, c);
        for (const [nr, nc] of neighbors) {
            const key = `${nr},${nc}`;
            if (visited.has(key)) continue;
            if (nr < 0 || nr >= ROWS) continue;
            const maxCols = nr % 2 === 0 ? COLS : COLS - 1;
            if (nc < 0 || nc >= maxCols) continue;
            if (grid[nr][nc] && grid[nr][nc].color === color) {
                visited.add(key);
                queue.push([nr, nc]);
            }
        }
    }

    return matches;
}

// --- Remove floating bubbles ---
function removeFloating() {
    const connected = new Set();
    const queue = [];

    for (let col = 0; col < COLS; col++) {
        if (grid[0][col]) {
            connected.add(`0,${col}`);
            queue.push([0, col]);
        }
    }

    while (queue.length > 0) {
        const [r, c] = queue.shift();
        const neighbors = getNeighbors(r, c);
        for (const [nr, nc] of neighbors) {
            const key = `${nr},${nc}`;
            if (connected.has(key)) continue;
            if (nr < 0 || nr >= ROWS) continue;
            const maxCols = nr % 2 === 0 ? COLS : COLS - 1;
            if (nc < 0 || nc >= maxCols) continue;
            if (grid[nr][nc]) {
                connected.add(key);
                queue.push([nr, nc]);
            }
        }
    }

    let removed = 0;
    for (let row = 0; row < ROWS; row++) {
        const maxCols = row % 2 === 0 ? COLS : COLS - 1;
        for (let col = 0; col < maxCols; col++) {
            if (grid[row][col] && !connected.has(`${row},${col}`)) {
                const pos = getBubblePos(row, col);
                fallingBubbles.push({
                    x: pos.x,
                    y: pos.y,
                    vy: 0,
                    color: grid[row][col].color,
                    radius: BUBBLE_RADIUS
                });
                grid[row][col] = null;
                removed++;
            }
        }
    }

    if (removed > 0) {
        score += removed * 20;
        scoreEl.textContent = score;
    }
}

// --- Update falling bubbles (delta-time aware) ---
function updateFallingBubbles(dt) {
    for (let i = fallingBubbles.length - 1; i >= 0; i--) {
        fallingBubbles[i].vy += 0.5 * dt;
        fallingBubbles[i].y += fallingBubbles[i].vy * dt;
        fallingBubbles[i].radius *= Math.pow(0.98, dt);
        if (fallingBubbles[i].y > canvas.height + 50) {
            fallingBubbles.splice(i, 1);
        }
    }
}

// --- Check game over ---
function checkGameOver() {
    for (let col = 0; col < COLS; col++) {
        if (grid[ROWS - 1][col]) {
            gameOver = true;
            return;
        }
    }
    for (let col = 0; col < COLS; col++) {
        if (grid[ROWS - 2] && grid[ROWS - 2][col]) {
            gameOver = true;
            return;
        }
    }
}

// --- Draw game over ---
function drawGameOver() {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#e94560';
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over!', canvas.width / 2, canvas.height / 2 - 20);
    ctx.fillStyle = '#eee';
    ctx.font = '20px sans-serif';
    ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2 + 20);
    ctx.fillText('Klicke zum Neustarten', canvas.width / 2, canvas.height / 2 + 60);
    ctx.textAlign = 'start';
}

// --- Check win ---
function checkWin() {
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            if (grid[row][col]) return false;
        }
    }
    return true;
}

// --- Draw win ---
function drawWin() {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#06d6a0';
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Gewonnen! 🎉', canvas.width / 2, canvas.height / 2 - 20);
    ctx.fillStyle = '#eee';
    ctx.font = '20px sans-serif';
    ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2 + 20);
    ctx.fillText('Klicke zum Neustarten', canvas.width / 2, canvas.height / 2 + 60);
    ctx.textAlign = 'start';
}

// --- Main game loop (delta-time) ---
function gameLoopFn(timestamp) {
    // Delta-Time berechnen
    if (lastTime === 0) lastTime = timestamp;
    const elapsed = timestamp - lastTime;
    lastTime = timestamp;

    // dt normalisiert auf 60 FPS
    const dt = Math.min(elapsed / (1000 / TARGET_FPS), 3);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Poll input
    updateKeyboardInput(dt);
    updateGamepadInput(dt);

    drawGrid();
    updateShootingBubble(dt);
    drawShootingBubble();
    updateFallingBubbles(dt);
    drawFallingBubbles();
    drawShooter();

    if (gameOver) {
        drawGameOver();
    } else if (checkWin()) {
        drawWin();
    }

    requestAnimationFrame(gameLoopFn);
}

// --- Keyboard State ---
const keys = {};
const AIM_SPEED = 0.03; // radians per frame at 60fps

document.addEventListener('keydown', (e) => {
    keys[e.code] = true;

    if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (gameOver || checkWin()) {
            restartGame();
        } else {
            shoot();
        }
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

function updateKeyboardInput(dt) {
    if (gameOver) return;

    if (keys['ArrowLeft'] || keys['KeyA']) {
        aimAngle -= AIM_SPEED * dt;
    }
    if (keys['ArrowRight'] || keys['KeyD']) {
        aimAngle += AIM_SPEED * dt;
    }

    const minAngle = -Math.PI + 0.1;
    const maxAngle = -0.1;
    aimAngle = Math.max(minAngle, Math.min(maxAngle, aimAngle));
}

// --- Gamepad Support ---
let gamepadShootCooldown = 0;
let gamepadRestartCooldown = 0;

function updateGamepadInput(dt) {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    if (!gamepads) return;

    for (const gp of gamepads) {
        if (!gp) continue;

        const leftStickX = gp.axes[0] || 0;
        const deadzone = 0.15;

        if (Math.abs(leftStickX) > deadzone) {
            aimAngle += leftStickX * AIM_SPEED * 1.5 * dt;
            const minAngle = -Math.PI + 0.1;
            const maxAngle = -0.1;
            aimAngle = Math.max(minAngle, Math.min(maxAngle, aimAngle));
        }

        if (gp.buttons[14] && gp.buttons[14].pressed) {
            aimAngle -= AIM_SPEED * dt;
            const minAngle = -Math.PI + 0.1;
            aimAngle = Math.max(minAngle, aimAngle);
        }
        if (gp.buttons[15] && gp.buttons[15].pressed) {
            aimAngle += AIM_SPEED * dt;
            const maxAngle = -0.1;
            aimAngle = Math.min(maxAngle, aimAngle);
        }

        // Cooldowns (dt-basiert)
        if (gamepadShootCooldown > 0) gamepadShootCooldown -= dt;
        if (gamepadRestartCooldown > 0) gamepadRestartCooldown -= dt;

        const shootPressed = (gp.buttons[0] && gp.buttons[0].pressed) ||
                             (gp.buttons[7] && gp.buttons[7].value > 0.5);

        if (shootPressed && gamepadShootCooldown <= 0) {
            gamepadShootCooldown = 15;
            if (gameOver || checkWin()) {
                if (gamepadRestartCooldown <= 0) {
                    gamepadRestartCooldown = 30;
                    restartGame();
                }
            } else {
                shoot();
            }
        }

        break;
    }
}

// --- Restart helper ---
function restartGame() {
    score = 0;
    scoreEl.textContent = '0';
    gameOver = false;
    fallingBubbles = [];
    shotsFired = 0;
    shotsUntilNewRow = DIFFICULTY_THRESHOLDS[0];
    difficultyStage = 0;
    lastTime = 0;
    initGrid();
    initShooter();
}

// --- Event Listeners ---
canvas.addEventListener('mousemove', (e) => {
    if (gameOver) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const shooterX = canvas.width / 2;
    const shooterY = canvas.height - 50;
    const angle = Math.atan2(mouseY - shooterY, mouseX - shooterX);
    if (angle < -0.1 && angle > -Math.PI + 0.1) {
        aimAngle = angle;
    }
});

canvas.addEventListener('click', (e) => {
    if (gameOver || checkWin()) {
        restartGame();
        return;
    }
    shoot();
});

// Touch support
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const touchX = touch.clientX - rect.left;
    const touchY = touch.clientY - rect.top;
    const shooterX = canvas.width / 2;
    const shooterY = canvas.height - 50;
    const angle = Math.atan2(touchY - shooterY, touchX - shooterX);
    if (angle < -0.1 && angle > -Math.PI + 0.1) {
        aimAngle = angle;
    }

    if (gameOver || checkWin()) {
        restartGame();
        return;
    }
    shoot();
});

// --- Start Game ---
initGrid();
initShooter();
requestAnimationFrame(gameLoopFn);
