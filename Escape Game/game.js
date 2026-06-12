const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

const TARGET_FPS = 60;
let lastTime = 0;

// Game state
let gameState = 'menu'; // menu, playing, won, gameover
let score = 0;
let level = 1;
let timeLeft = 0;
let maxTime = 0;

// Player (position in maze units, angle in radians)
let player = { x: 1.5, y: 1.5, angle: 0, moveSpeed: 3, turnSpeed: 3 };

// Maze (grid: 1 = wall, 0 = path, 2 = exit)
let mazeSize = 0;
let maze = [];

// Input
const keys = {};

// --- Maze Generation ---
function generateMaze(size) {
    // size = number of cells per side
    // Grid is (size*2+1) x (size*2+1) where walls take up cells
    const gridSize = size * 2 + 1;
    const grid = [];

    // Fill with walls
    for (let y = 0; y < gridSize; y++) {
        grid[y] = [];
        for (let x = 0; x < gridSize; x++) {
            grid[y][x] = 1;
        }
    }

    // Carve passages using recursive backtracker
    // Cell positions are at odd indices
    const startCellX = 1;
    const startCellY = 1;
    grid[startCellY][startCellX] = 0;

    const stack = [{ x: startCellX, y: startCellY }];
    const directions = [
        { dx: 0, dy: -2 },
        { dx: 2, dy: 0 },
        { dx: 0, dy: 2 },
        { dx: -2, dy: 0 }
    ];

    while (stack.length > 0) {
        const current = stack[stack.length - 1];
        const unvisited = [];

        for (const dir of directions) {
            const nx = current.x + dir.dx;
            const ny = current.y + dir.dy;
            if (nx > 0 && nx < gridSize - 1 && ny > 0 && ny < gridSize - 1 && grid[ny][nx] === 1) {
                unvisited.push({ x: nx, y: ny, wx: current.x + dir.dx / 2, wy: current.y + dir.dy / 2 });
            }
        }

        if (unvisited.length > 0) {
            const next = unvisited[Math.floor(Math.random() * unvisited.length)];
            grid[next.wy][next.wx] = 0; // Remove wall between
            grid[next.y][next.x] = 0;   // Mark cell as passage
            stack.push({ x: next.x, y: next.y });
        } else {
            stack.pop();
        }
    }

    // Place exit at bottom-right cell
    const exitX = gridSize - 2;
    const exitY = gridSize - 2;
    grid[exitY][exitX] = 2;

    return grid;
}

// --- Setup Level ---
function setupLevel() {
    const size = 4 + level; // cells per side, grows with level
    mazeSize = size * 2 + 1;
    maze = generateMaze(size);

    // Player starts at top-left cell
    player.x = 1.5;
    player.y = 1.5;
    player.angle = 0;

    // Time: more time for bigger mazes
    maxTime = (size * size) * 1.2 * TARGET_FPS;
    timeLeft = maxTime;
}

// --- Raycasting ---
function castRay(originX, originY, angle) {
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    const stepSize = 0.02;
    let dist = 0;
    const maxDist = 20;

    while (dist < maxDist) {
        dist += stepSize;
        const testX = originX + cos * dist;
        const testY = originY + sin * dist;

        const mapX = Math.floor(testX);
        const mapY = Math.floor(testY);

        if (mapX < 0 || mapX >= mazeSize || mapY < 0 || mapY >= mazeSize) {
            return { dist: dist, type: 1 };
        }

        const cell = maze[mapY][mapX];
        if (cell === 1) {
            return { dist: dist, type: 1 };
        }
        if (cell === 2) {
            return { dist: dist, type: 2 };
        }
    }
    return { dist: maxDist, type: 0 };
}

// DDA Raycasting (much more efficient and accurate)
function castRayDDA(originX, originY, angle) {
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);

    let mapX = Math.floor(originX);
    let mapY = Math.floor(originY);

    const deltaDistX = Math.abs(1 / dirX);
    const deltaDistY = Math.abs(1 / dirY);

    let stepX, stepY;
    let sideDistX, sideDistY;

    if (dirX < 0) {
        stepX = -1;
        sideDistX = (originX - mapX) * deltaDistX;
    } else {
        stepX = 1;
        sideDistX = (mapX + 1.0 - originX) * deltaDistX;
    }
    if (dirY < 0) {
        stepY = -1;
        sideDistY = (originY - mapY) * deltaDistY;
    } else {
        stepY = 1;
        sideDistY = (mapY + 1.0 - originY) * deltaDistY;
    }

    let side = 0; // 0 = x-side hit, 1 = y-side hit
    let dist = 0;

    for (let i = 0; i < 100; i++) {
        if (sideDistX < sideDistY) {
            sideDistX += deltaDistX;
            mapX += stepX;
            side = 0;
        } else {
            sideDistY += deltaDistY;
            mapY += stepY;
            side = 1;
        }

        if (mapX < 0 || mapX >= mazeSize || mapY < 0 || mapY >= mazeSize) {
            dist = (side === 0) ? sideDistX - deltaDistX : sideDistY - deltaDistY;
            return { dist: dist, type: 1, side: side };
        }

        const cell = maze[mapY][mapX];
        if (cell >= 1) {
            dist = (side === 0) ? sideDistX - deltaDistX : sideDistY - deltaDistY;
            return { dist: dist, type: cell, side: side };
        }
    }

    return { dist: 20, type: 0, side: 0 };
}

// --- Update ---
function update(dt) {
    if (gameState !== 'playing') return;

    // Timer
    timeLeft -= dt;
    if (timeLeft <= 0) {
        timeLeft = 0;
        gameState = 'gameover';
        return;
    }

    // Rotation
    if (keys['ArrowLeft'] || keys['KeyA']) {
        player.angle -= player.turnSpeed * dt / TARGET_FPS;
    }
    if (keys['ArrowRight'] || keys['KeyD']) {
        player.angle += player.turnSpeed * dt / TARGET_FPS;
    }

    // Movement
    let moveX = 0, moveY = 0;
    const speed = player.moveSpeed * dt / TARGET_FPS;

    if (keys['ArrowUp'] || keys['KeyW']) {
        moveX += Math.cos(player.angle) * speed;
        moveY += Math.sin(player.angle) * speed;
    }
    if (keys['ArrowDown'] || keys['KeyS']) {
        moveX -= Math.cos(player.angle) * speed;
        moveY -= Math.sin(player.angle) * speed;
    }

    // Collision detection with sliding
    const radius = 0.2;

    // Try X movement
    const newX = player.x + moveX;
    if (!isWall(newX + radius, player.y) && !isWall(newX - radius, player.y) &&
        !isWall(newX + radius, player.y + radius) && !isWall(newX - radius, player.y - radius) &&
        !isWall(newX + radius, player.y - radius) && !isWall(newX - radius, player.y + radius)) {
        player.x = newX;
    }

    // Try Y movement
    const newY = player.y + moveY;
    if (!isWall(player.x, newY + radius) && !isWall(player.x, newY - radius) &&
        !isWall(player.x + radius, newY + radius) && !isWall(player.x - radius, newY - radius) &&
        !isWall(player.x + radius, newY - radius) && !isWall(player.x - radius, newY + radius)) {
        player.y = newY;
    }

    // Check if player reached exit
    const cellX = Math.floor(player.x);
    const cellY = Math.floor(player.y);
    if (cellX >= 0 && cellX < mazeSize && cellY >= 0 && cellY < mazeSize) {
        if (maze[cellY][cellX] === 2) {
            // Level complete!
            const timeBonus = Math.floor(timeLeft / TARGET_FPS) * 10;
            score += 100 + timeBonus;
            level++;
            setupLevel();
        }
    }
}

function isWall(x, y) {
    const mapX = Math.floor(x);
    const mapY = Math.floor(y);
    if (mapX < 0 || mapX >= mazeSize || mapY < 0 || mapY >= mazeSize) return true;
    return maze[mapY][mapX] === 1;
}

// --- Drawing ---
function draw() {
    // Clear
    ctx.fillStyle = '#0a0a15';
    ctx.fillRect(0, 0, W, H);

    if (gameState === 'menu') {
        drawMenu();
        return;
    }

    if (gameState === 'gameover') {
        drawGameOver();
        return;
    }

    // Draw 3D view
    draw3DView();

    // Draw minimap
    drawMinimap();

    // Draw HUD
    drawHUD();
}

function draw3DView() {
    const fov = Math.PI / 3; // 60 degrees field of view
    const numRays = W;
    const halfH = H / 2;

    // Draw ceiling
    const ceilGrad = ctx.createLinearGradient(0, 0, 0, halfH);
    ceilGrad.addColorStop(0, '#0a0a20');
    ceilGrad.addColorStop(1, '#1a1a3e');
    ctx.fillStyle = ceilGrad;
    ctx.fillRect(0, 0, W, halfH);

    // Draw floor
    const floorGrad = ctx.createLinearGradient(0, halfH, 0, H);
    floorGrad.addColorStop(0, '#1a1a1a');
    floorGrad.addColorStop(1, '#2a2a2a');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, halfH, W, halfH);

    // Cast rays
    for (let i = 0; i < numRays; i++) {
        const rayAngle = player.angle - fov / 2 + (i / numRays) * fov;
        const hit = castRayDDA(player.x, player.y, rayAngle);

        // Fix fisheye
        const correctedDist = hit.dist * Math.cos(rayAngle - player.angle);

        // Wall height
        const wallHeight = Math.min(H * 2, H / correctedDist);
        const wallTop = halfH - wallHeight / 2;

        // Color based on distance and type
        let brightness;
        if (hit.side === 1) {
            brightness = Math.max(0.15, 1 - correctedDist * 0.08);
        } else {
            brightness = Math.max(0.1, 0.8 - correctedDist * 0.08);
        }

        let r, g, b;
        if (hit.type === 2) {
            // Exit - green glow
            r = Math.floor(30 * brightness);
            g = Math.floor(255 * brightness);
            b = Math.floor(100 * brightness);
        } else {
            // Normal wall - blue/purple
            r = Math.floor(60 * brightness);
            g = Math.floor(80 * brightness);
            b = Math.floor(180 * brightness);
        }

        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(i, wallTop, 1, wallHeight);
    }
}

function drawMinimap() {
    const mapSize = 120;
    const mapX = W - mapSize - 10;
    const mapY = 10;
    const cellPx = mapSize / mazeSize;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(mapX - 2, mapY - 2, mapSize + 4, mapSize + 4);

    // Draw cells
    for (let y = 0; y < mazeSize; y++) {
        for (let x = 0; x < mazeSize; x++) {
            if (maze[y][x] === 1) {
                ctx.fillStyle = '#334';
                ctx.fillRect(mapX + x * cellPx, mapY + y * cellPx, cellPx, cellPx);
            } else if (maze[y][x] === 2) {
                ctx.fillStyle = '#00ff88';
                ctx.fillRect(mapX + x * cellPx, mapY + y * cellPx, cellPx, cellPx);
            }
        }
    }

    // Player dot
    const playerMapX = mapX + player.x * cellPx;
    const playerMapY = mapY + player.y * cellPx;
    ctx.fillStyle = '#ff4444';
    ctx.beginPath();
    ctx.arc(playerMapX, playerMapY, 3, 0, Math.PI * 2);
    ctx.fill();

    // Direction indicator
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(playerMapX, playerMapY);
    ctx.lineTo(playerMapX + Math.cos(player.angle) * 8, playerMapY + Math.sin(player.angle) * 8);
    ctx.stroke();
}

function drawHUD() {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Level: ${level}`, 10, 25);
    ctx.fillText(`Punkte: ${score}`, 10, 48);

    const seconds = Math.ceil(timeLeft / TARGET_FPS);
    ctx.fillStyle = seconds <= 10 ? '#ff4444' : '#ffffff';
    ctx.fillText(`Zeit: ${seconds}s`, 10, 71);

    // Compass
    ctx.fillStyle = '#aaa';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    const compassDir = getCompassDirection(player.angle);
    ctx.fillText(compassDir, W / 2, 25);
}

function getCompassDirection(angle) {
    // Normalize angle
    let a = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const dirs = ['O', 'SO', 'S', 'SW', 'W', 'NW', 'N', 'NO'];
    const index = Math.round(a / (Math.PI / 4)) % 8;
    return dirs[index];
}

function drawMenu() {
    // Title
    ctx.fillStyle = '#4a9eff';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#4a9eff';
    ctx.shadowBlur = 15;
    ctx.fillText('Escape Game', W / 2, H / 2 - 100);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#cccccc';
    ctx.font = '22px sans-serif';
    ctx.fillText('Ego-Perspektive', W / 2, H / 2 - 55);

    ctx.fillStyle = '#ffffff';
    ctx.font = '18px sans-serif';
    ctx.fillText('Finde den grünen Ausgang!', W / 2, H / 2 - 10);

    ctx.fillStyle = '#aaaaaa';
    ctx.font = '16px sans-serif';
    ctx.fillText('W / ↑  =  Vorwärts', W / 2, H / 2 + 40);
    ctx.fillText('S / ↓  =  Rückwärts', W / 2, H / 2 + 65);
    ctx.fillText('A / ←  =  Links drehen', W / 2, H / 2 + 90);
    ctx.fillText('D / →  =  Rechts drehen', W / 2, H / 2 + 115);

    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('Leertaste zum Starten', W / 2, H / 2 + 165);
}

function drawGameOver() {
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 38px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#ff4444';
    ctx.shadowBlur = 10;
    ctx.fillText('Zeit abgelaufen!', W / 2, H / 2 - 60);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#ffffff';
    ctx.font = '24px sans-serif';
    ctx.fillText(`Level ${level} erreicht`, W / 2, H / 2);
    ctx.fillText(`Punkte: ${score}`, W / 2, H / 2 + 40);

    ctx.fillStyle = '#cccccc';
    ctx.font = '18px sans-serif';
    ctx.fillText('Leertaste für Neustart', W / 2, H / 2 + 100);
}

// --- Start Game ---
function startGame() {
    score = 0;
    level = 1;
    gameState = 'playing';
    lastTime = 0;
    setupLevel();
}

// --- Input ---
document.addEventListener('keydown', (e) => {
    keys[e.code] = true;

    if (e.code === 'Space') {
        e.preventDefault();
        if (gameState === 'menu' || gameState === 'gameover') {
            startGame();
        }
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// Touch controls
let touchStartX = 0;
let touchStartY = 0;
let touchActive = false;

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameState === 'menu' || gameState === 'gameover') {
        startGame();
        return;
    }
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchActive = true;
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!touchActive || gameState !== 'playing') return;

    const touch = e.touches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;

    // Reset keys
    keys['ArrowLeft'] = false;
    keys['ArrowRight'] = false;
    keys['ArrowUp'] = false;
    keys['ArrowDown'] = false;

    // Horizontal = turn
    if (dx > 15) keys['ArrowRight'] = true;
    else if (dx < -15) keys['ArrowLeft'] = true;

    // Vertical = move
    if (dy < -15) keys['ArrowUp'] = true;
    else if (dy > 15) keys['ArrowDown'] = true;
});

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    touchActive = false;
    keys['ArrowLeft'] = false;
    keys['ArrowRight'] = false;
    keys['ArrowUp'] = false;
    keys['ArrowDown'] = false;
});

// --- Game Loop ---
function gameLoop(timestamp) {
    if (lastTime === 0) lastTime = timestamp;
    const elapsed = timestamp - lastTime;
    lastTime = timestamp;
    const dt = Math.min(elapsed / (1000 / TARGET_FPS), 3);

    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
