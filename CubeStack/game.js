const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// === KONSTANTEN ===
const TARGET_FPS = 60;
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 28;
const BOARD_X = 30;
const BOARD_Y = 50;
const NEXT_X = 340;
const NEXT_Y = 120;

// === MINECRAFT BLOCK-TYPEN ===
const BLOCK_TYPES = {
    1: { name: 'Gras', highlight: '#7BC842' },
    2: { name: 'Stein', highlight: '#AAAAAA' },
    3: { name: 'Diamant', highlight: '#7FFFFF' },
    4: { name: 'Gold', highlight: '#FFEC8B' },
    5: { name: 'Redstone', highlight: '#FF4444' },
    6: { name: 'Lapis', highlight: '#4A7AE0' },
    7: { name: 'Smaragd', highlight: '#5EFC82' }
};

// === PRE-RENDERED BLOCK TEXTUREN (einmalig auf OffscreenCanvas) ===
const blockTextures = {};

function generateBlockTextures() {
    const s = BLOCK_SIZE;
    const pix = Math.floor(s / 8); // Pixelgröße für 8x8 Textur-Grid

    // Jeder Block bekommt ein eigenes 8x8 Farbmuster
    const textureData = {
        1: { // GRAS - Erde unten, Gras oben
            pixels: [
                'GGGGGGGG',
                'gGgGgGgG',
                'DDddDDdd',
                'dDDdddDd',
                'DDddDDdd',
                'dDdDDdDd',
                'DDddDDdd',
                'ddDDddDD'
            ],
            colors: { 'G': '#5DAE2B', 'g': '#4A8C22', 'D': '#8B5E3C', 'd': '#6B4422' }
        },
        2: { // STEIN - graue Pixel mit Rissen
            pixels: [
                'SSSSSSSS',
                'SsSsSsSs',
                'sSccSSSS',
                'SSScSsSs',
                'sSSSScsS',
                'SSsSScSS',
                'SsSSSsSs',
                'SSSSSSSS'
            ],
            colors: { 'S': '#8C8C8C', 's': '#737373', 'c': '#555555' }
        },
        3: { // DIAMANT-ERZ - Stein mit hellblauen Diamanten
            pixels: [
                'SSsSSSsS',
                'SsDDSsSS',
                'sSDDsSsS',
                'SSsSSSDS',
                'sSSSsDDS',
                'SsDSSSsS',
                'SDDSSSS',
                'sDSsSsSS'
            ],
            colors: { 'S': '#8C8C8C', 's': '#737373', 'D': '#4AEDD9', 'd': '#2CC5BB' }
        },
        4: { // GOLD-ERZ - Stein mit goldenen Klumpen
            pixels: [
                'SSsSSSSs',
                'sGGSSsSS',
                'SGGsSsSs',
                'SSsSSSGG',
                'sSGGSGGs',
                'SSGGSsSS',
                'SsSSSGSs',
                'SSSSSGGS'
            ],
            colors: { 'S': '#8C8C8C', 's': '#737373', 'G': '#FFD700', 'g': '#DAA520' }
        },
        5: { // REDSTONE-ERZ - Stein mit roten Punkten
            pixels: [
                'SSsSSSsS',
                'sRRSSsSS',
                'SRRsSsSs',
                'SSsSSSRS',
                'sSRRSRRS',
                'SSRRSsSS',
                'SsSSSRSs',
                'SSSSSRRS'
            ],
            colors: { 'S': '#8C8C8C', 's': '#737373', 'R': '#FF1111', 'r': '#CC0000' }
        },
        6: { // LAPIS-ERZ - Stein mit blauen Flecken
            pixels: [
                'SSsSSSsS',
                'sLLSSsSS',
                'SLLsSsSs',
                'SSsSSSLS',
                'sSLLSLLS',
                'SSLLSsSS',
                'SsSSSLSs',
                'SSSSSLL'
            ],
            colors: { 'S': '#8C8C8C', 's': '#737373', 'L': '#2255CC', 'l': '#1A3FA0' }
        },
        7: { // SMARAGD-ERZ - Stein mit grünen Kristallen
            pixels: [
                'SSsSSSsS',
                'sEESSsSS',
                'SEEsSsSs',
                'SSsSSSES',
                'sSEESEES',
                'SSEESsSS',
                'SsSSSESs',
                'SSSSSEEE'
            ],
            colors: { 'S': '#8C8C8C', 's': '#737373', 'E': '#00C853', 'e': '#009940' }
        }
    };

    for (let type = 1; type <= 7; type++) {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = s;
        offCanvas.height = s;
        const offCtx = offCanvas.getContext('2d');

        const data = textureData[type];
        const pixW = s / 8;
        const pixH = s / 8;

        // Textur-Pixel zeichnen
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const char = data.pixels[row] ? data.pixels[row][col] : 'S';
                const color = data.colors[char] || data.colors['S'] || '#888888';
                offCtx.fillStyle = color;
                offCtx.fillRect(col * pixW, row * pixH, Math.ceil(pixW), Math.ceil(pixH));
            }
        }

        // 3D-Effekt: helle Kante oben/links
        offCtx.fillStyle = 'rgba(255,255,255,0.25)';
        offCtx.fillRect(0, 0, s, 2);
        offCtx.fillRect(0, 0, 2, s);

        // 3D-Effekt: dunkle Kante unten/rechts
        offCtx.fillStyle = 'rgba(0,0,0,0.35)';
        offCtx.fillRect(0, s - 2, s, 2);
        offCtx.fillRect(s - 2, 0, 2, s);

        // Schwarzer Rand (Minecraft Grid-Look)
        offCtx.strokeStyle = 'rgba(0,0,0,0.6)';
        offCtx.lineWidth = 1;
        offCtx.strokeRect(0.5, 0.5, s - 1, s - 1);

        blockTextures[type] = offCanvas;
    }
}

// === TETROMINO-FORMEN ===
const SHAPES = [
    [[1,1,1,1]],                    // I
    [[1,1],[1,1]],                  // O
    [[0,1,0],[1,1,1]],              // T
    [[1,0,0],[1,1,1]],              // L
    [[0,0,1],[1,1,1]],              // J
    [[0,1,1],[1,1,0]],              // S
    [[1,1,0],[0,1,1]]               // Z
];

// === SPIELZUSTAND ===
let lastTime = 0;
let gameRunning = false;
let gameOverState = false;
let score = 0;
let level = 1;
let lines = 0;
let board = [];
let currentPiece = null;
let nextPiece = null;
let dropAccumulator = 0;
let dropInterval = 60; // Frames bei 60fps
let softDrop = false;
let inputCooldown = 0;
let flashRows = [];
let flashTimer = 0;
let particles = [];

// === HILFSFUNKTIONEN ===

function createBoard() {
    board = [];
    for (let r = 0; r < ROWS; r++) {
        board.push(new Array(COLS).fill(0));
    }
}

function randomBlockType() {
    return Math.floor(Math.random() * 7) + 1;
}

function createPiece() {
    const shapeIndex = Math.floor(Math.random() * SHAPES.length);
    const shape = SHAPES[shapeIndex];
    const blockType = randomBlockType();
    return {
        shape: shape.map(row => row.map(cell => cell ? blockType : 0)),
        x: Math.floor((COLS - shape[0].length) / 2),
        y: 0
    };
}

function rotatePiece(piece) {
    const rows = piece.shape.length;
    const cols = piece.shape[0].length;
    const rotated = [];
    for (let c = 0; c < cols; c++) {
        rotated.push([]);
        for (let r = rows - 1; r >= 0; r--) {
            rotated[c].push(piece.shape[r][c]);
        }
    }
    return rotated;
}

function collides(shape, offsetX, offsetY) {
    for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
            if (shape[r][c] !== 0) {
                const newX = offsetX + c;
                const newY = offsetY + r;
                if (newX < 0 || newX >= COLS || newY >= ROWS) return true;
                if (newY >= 0 && board[newY][newX] !== 0) return true;
            }
        }
    }
    return false;
}

function lockPiece() {
    for (let r = 0; r < currentPiece.shape.length; r++) {
        for (let c = 0; c < currentPiece.shape[r].length; c++) {
            if (currentPiece.shape[r][c] !== 0) {
                const boardY = currentPiece.y + r;
                const boardX = currentPiece.x + c;
                if (boardY >= 0) {
                    board[boardY][boardX] = currentPiece.shape[r][c];
                }
            }
        }
    }
}

function clearLines() {
    const fullRows = [];
    for (let r = 0; r < ROWS; r++) {
        if (board[r].every(cell => cell !== 0)) {
            fullRows.push(r);
        }
    }
    
    if (fullRows.length > 0) {
        flashRows = fullRows;
        flashTimer = 20;
        
        // Partikel erzeugen
        fullRows.forEach(row => {
            for (let c = 0; c < COLS; c++) {
                for (let i = 0; i < 3; i++) {
                    particles.push({
                        x: BOARD_X + c * BLOCK_SIZE + BLOCK_SIZE / 2,
                        y: BOARD_Y + row * BLOCK_SIZE + BLOCK_SIZE / 2,
                        vx: (Math.random() - 0.5) * 4,
                        vy: (Math.random() - 1) * 3,
                        life: 30 + Math.random() * 20,
                        color: BLOCK_TYPES[board[row][c]].highlight
                    });
                }
            }
        });

        // Punkte berechnen
        const pointTable = [0, 100, 300, 500, 800];
        score += pointTable[fullRows.length] * level;
        lines += fullRows.length;
        level = Math.floor(lines / 10) + 1;
        dropInterval = Math.max(5, 60 - (level - 1) * 5);

        // Reihen entfernen
        fullRows.forEach(row => {
            board.splice(row, 1);
            board.unshift(new Array(COLS).fill(0));
        });
    }
}

function spawnPiece() {
    currentPiece = nextPiece || createPiece();
    nextPiece = createPiece();
    
    if (collides(currentPiece.shape, currentPiece.x, currentPiece.y)) {
        gameOverState = true;
        gameRunning = false;
    }
}

// === ZEICHENFUNKTIONEN ===

function drawMinecraftBlock(x, y, size, blockType) {
    if (!blockTextures[blockType]) return;
    // Zeichne die vorgerenderte Textur
    ctx.drawImage(blockTextures[blockType], x, y, size, size);
}

function drawBoard() {
    // Board-Hintergrund
    ctx.fillStyle = '#2C2C2C';
    ctx.fillRect(BOARD_X - 2, BOARD_Y - 2, COLS * BLOCK_SIZE + 4, ROWS * BLOCK_SIZE + 4);
    
    // Gitter
    ctx.strokeStyle = '#3A3A3A';
    ctx.lineWidth = 0.5;
    for (let r = 0; r <= ROWS; r++) {
        ctx.beginPath();
        ctx.moveTo(BOARD_X, BOARD_Y + r * BLOCK_SIZE);
        ctx.lineTo(BOARD_X + COLS * BLOCK_SIZE, BOARD_Y + r * BLOCK_SIZE);
        ctx.stroke();
    }
    for (let c = 0; c <= COLS; c++) {
        ctx.beginPath();
        ctx.moveTo(BOARD_X + c * BLOCK_SIZE, BOARD_Y);
        ctx.lineTo(BOARD_X + c * BLOCK_SIZE, BOARD_Y + ROWS * BLOCK_SIZE);
        ctx.stroke();
    }
    
    // Blöcke auf dem Board
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (board[r][c] !== 0) {
                // Flash-Effekt bei vollen Reihen
                if (flashRows.includes(r) && flashTimer > 0) {
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(BOARD_X + c * BLOCK_SIZE, BOARD_Y + r * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                } else {
                    drawMinecraftBlock(
                        BOARD_X + c * BLOCK_SIZE,
                        BOARD_Y + r * BLOCK_SIZE,
                        BLOCK_SIZE,
                        board[r][c]
                    );
                }
            }
        }
    }
    
    // Board-Rahmen
    ctx.strokeStyle = '#5C5C5C';
    ctx.lineWidth = 2;
    ctx.strokeRect(BOARD_X - 2, BOARD_Y - 2, COLS * BLOCK_SIZE + 4, ROWS * BLOCK_SIZE + 4);
}

function drawCurrentPiece() {
    if (!currentPiece) return;
    
    // Ghost-Piece (Vorschau wo es landet)
    let ghostY = currentPiece.y;
    while (!collides(currentPiece.shape, currentPiece.x, ghostY + 1)) {
        ghostY++;
    }
    
    // Ghost zeichnen
    ctx.globalAlpha = 0.3;
    for (let r = 0; r < currentPiece.shape.length; r++) {
        for (let c = 0; c < currentPiece.shape[r].length; c++) {
            if (currentPiece.shape[r][c] !== 0) {
                drawMinecraftBlock(
                    BOARD_X + (currentPiece.x + c) * BLOCK_SIZE,
                    BOARD_Y + (ghostY + r) * BLOCK_SIZE,
                    BLOCK_SIZE,
                    currentPiece.shape[r][c]
                );
            }
        }
    }
    ctx.globalAlpha = 1.0;
    
    // Aktuelles Stück
    for (let r = 0; r < currentPiece.shape.length; r++) {
        for (let c = 0; c < currentPiece.shape[r].length; c++) {
            if (currentPiece.shape[r][c] !== 0) {
                drawMinecraftBlock(
                    BOARD_X + (currentPiece.x + c) * BLOCK_SIZE,
                    BOARD_Y + (currentPiece.y + r) * BLOCK_SIZE,
                    BLOCK_SIZE,
                    currentPiece.shape[r][c]
                );
            }
        }
    }
}

function drawNextPiece() {
    if (!nextPiece) return;
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px Courier New';
    ctx.textAlign = 'left';
    ctx.fillText('NÄCHSTES:', NEXT_X, NEXT_Y - 10);
    
    // Box
    ctx.fillStyle = '#2C2C2C';
    ctx.fillRect(NEXT_X, NEXT_Y, 4 * BLOCK_SIZE + 8, 4 * BLOCK_SIZE + 8);
    ctx.strokeStyle = '#5C5C5C';
    ctx.lineWidth = 1;
    ctx.strokeRect(NEXT_X, NEXT_Y, 4 * BLOCK_SIZE + 8, 4 * BLOCK_SIZE + 8);
    
    const offsetX = NEXT_X + 4 + (4 - nextPiece.shape[0].length) * BLOCK_SIZE / 2;
    const offsetY = NEXT_Y + 4 + (4 - nextPiece.shape.length) * BLOCK_SIZE / 2;
    
    for (let r = 0; r < nextPiece.shape.length; r++) {
        for (let c = 0; c < nextPiece.shape[r].length; c++) {
            if (nextPiece.shape[r][c] !== 0) {
                drawMinecraftBlock(
                    offsetX + c * BLOCK_SIZE,
                    offsetY + r * BLOCK_SIZE,
                    BLOCK_SIZE,
                    nextPiece.shape[r][c]
                );
            }
        }
    }
}

function drawUI() {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px Courier New';
    ctx.textAlign = 'left';
    
    const infoX = NEXT_X;
    let infoY = NEXT_Y + 140;
    
    ctx.fillText('PUNKTE:', infoX, infoY);
    ctx.fillStyle = '#FFD700';
    ctx.fillText(score.toString(), infoX, infoY + 20);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('LEVEL:', infoX, infoY + 55);
    ctx.fillStyle = '#4AEDD9';
    ctx.fillText(level.toString(), infoX, infoY + 75);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('REIHEN:', infoX, infoY + 110);
    ctx.fillStyle = '#00C853';
    ctx.fillText(lines.toString(), infoX, infoY + 130);
}

function drawParticles() {
    particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / 50;
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    });
    ctx.globalAlpha = 1.0;
}

function drawStartScreen() {
    // Hintergrund
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Dekorative Blöcke (größer, wie in Minecraft)
    const decoBlocks = [
        { x: 30, y: 80, type: 1 },
        { x: 30, y: 120, type: 1 },
        { x: 70, y: 80, type: 2 },
        { x: 380, y: 130, type: 3 },
        { x: 380, y: 170, type: 3 },
        { x: 80, y: 480, type: 4 },
        { x: 120, y: 480, type: 4 },
        { x: 350, y: 460, type: 5 },
        { x: 40, y: 320, type: 6 },
        { x: 400, y: 320, type: 7 },
        { x: 400, y: 360, type: 7 },
        { x: 190, y: 60, type: 2 },
        { x: 230, y: 60, type: 2 },
        { x: 270, y: 60, type: 4 },
    ];
    decoBlocks.forEach(b => {
        drawMinecraftBlock(b.x, b.y, 36, b.type);
    });
    
    // Titel
    ctx.fillStyle = '#4AEDD9';
    ctx.font = 'bold 36px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('CUBESTACK', canvas.width / 2, canvas.height / 2 - 80);
    
    // Untertitel
    ctx.fillStyle = '#8B8B8B';
    ctx.font = '16px Courier New';
    ctx.fillText('⛏ Pixel Block Edition ⛏', canvas.width / 2, canvas.height / 2 - 45);
    
    // Steuerung
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '14px Courier New';
    ctx.fillText('← → Bewegen', canvas.width / 2, canvas.height / 2 + 10);
    ctx.fillText('↑ Drehen', canvas.width / 2, canvas.height / 2 + 35);
    ctx.fillText('↓ Schneller fallen', canvas.width / 2, canvas.height / 2 + 60);
    ctx.fillText('LEERTASTE = Sofort fallen', canvas.width / 2, canvas.height / 2 + 85);
    
    // Start
    ctx.fillStyle = '#00C853';
    ctx.font = 'bold 18px Courier New';
    ctx.fillText('[ ENTER zum Starten ]', canvas.width / 2, canvas.height / 2 + 140);
}

function drawGameOverScreen() {
    // Abdunkeln
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Game Over Text
    ctx.fillStyle = '#FF0000';
    ctx.font = 'bold 32px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 60);
    
    // Score
    ctx.fillStyle = '#FFD700';
    ctx.font = '20px Courier New';
    ctx.fillText('Punkte: ' + score, canvas.width / 2, canvas.height / 2 - 10);
    ctx.fillStyle = '#4AEDD9';
    ctx.fillText('Level: ' + level, canvas.width / 2, canvas.height / 2 + 20);
    ctx.fillStyle = '#00C853';
    ctx.fillText('Reihen: ' + lines, canvas.width / 2, canvas.height / 2 + 50);
    
    // Neustart
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '16px Courier New';
    ctx.fillText('[ ENTER für Neustart ]', canvas.width / 2, canvas.height / 2 + 110);
}

// === UPDATE ===

function update(dt) {
    // Flash-Timer
    if (flashTimer > 0) {
        flashTimer -= dt;
        if (flashTimer <= 0) {
            flashRows = [];
        }
    }
    
    // Partikel updaten
    particles.forEach(p => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 0.15 * dt;
        p.life -= dt;
    });
    particles = particles.filter(p => p.life > 0);
    
    if (!gameRunning) return;
    
    // Input Cooldown
    if (inputCooldown > 0) inputCooldown -= dt;
    
    // Drop
    const speed = softDrop ? 3 : dropInterval;
    dropAccumulator += dt;
    
    if (dropAccumulator >= (softDrop ? 3 : dropInterval / (TARGET_FPS / 10))) {
        dropAccumulator = 0;
        
        if (!collides(currentPiece.shape, currentPiece.x, currentPiece.y + 1)) {
            currentPiece.y++;
            if (softDrop) score += 1;
        } else {
            lockPiece();
            clearLines();
            spawnPiece();
        }
    }
}

// === GAME LOOP ===

function draw() {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (!gameRunning && !gameOverState) {
        drawStartScreen();
        return;
    }
    
    drawBoard();
    if (gameRunning) {
        drawCurrentPiece();
    }
    drawNextPiece();
    drawUI();
    drawParticles();
    
    if (gameOverState) {
        drawGameOverScreen();
    }
}

function gameLoop(timestamp) {
    if (lastTime === 0) lastTime = timestamp;
    const elapsed = timestamp - lastTime;
    lastTime = timestamp;
    const dt = Math.min(elapsed / (1000 / TARGET_FPS), 3);

    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
}

// === STEUERUNG ===

function startGame() {
    score = 0;
    level = 1;
    lines = 0;
    dropInterval = 60;
    dropAccumulator = 0;
    gameOverState = false;
    gameRunning = true;
    lastTime = 0;
    particles = [];
    flashRows = [];
    flashTimer = 0;
    createBoard();
    nextPiece = createPiece();
    spawnPiece();
}

document.addEventListener('keydown', (e) => {
    // Start / Neustart
    if (e.code === 'Enter') {
        e.preventDefault();
        if (!gameRunning) {
            startGame();
        }
        return;
    }
    
    if (!gameRunning) return;
    
    // Bewegung
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        e.preventDefault();
        if (!collides(currentPiece.shape, currentPiece.x - 1, currentPiece.y)) {
            currentPiece.x--;
        }
    }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        e.preventDefault();
        if (!collides(currentPiece.shape, currentPiece.x + 1, currentPiece.y)) {
            currentPiece.x++;
        }
    }
    if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        softDrop = true;
    }
    
    // Drehen
    if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        const rotated = rotatePiece(currentPiece);
        // Wall-Kick: versuche verschiedene Positionen
        const kicks = [0, -1, 1, -2, 2];
        for (const kick of kicks) {
            if (!collides(rotated, currentPiece.x + kick, currentPiece.y)) {
                currentPiece.shape = rotated;
                currentPiece.x += kick;
                break;
            }
        }
    }
    
    // Hard Drop
    if (e.code === 'Space') {
        e.preventDefault();
        let dropDistance = 0;
        while (!collides(currentPiece.shape, currentPiece.x, currentPiece.y + 1)) {
            currentPiece.y++;
            dropDistance++;
        }
        score += dropDistance * 2;
        lockPiece();
        clearLines();
        spawnPiece();
    }
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        softDrop = false;
    }
});

// === TOUCH STEUERUNG ===

let touchStartX = 0;
let touchStartY = 0;
let touchMoved = false;

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchMoved = false;
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!gameRunning) return;
    
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    
    if (Math.abs(dx) > 30 && !touchMoved) {
        touchMoved = true;
        if (dx > 0 && !collides(currentPiece.shape, currentPiece.x + 1, currentPiece.y)) {
            currentPiece.x++;
        } else if (dx < 0 && !collides(currentPiece.shape, currentPiece.x - 1, currentPiece.y)) {
            currentPiece.x--;
        }
        touchStartX = touch.clientX;
    }
    
    if (dy > 50 && !touchMoved) {
        touchMoved = true;
        softDrop = true;
    }
});

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    softDrop = false;
    
    if (!touchMoved) {
        if (!gameRunning) {
            startGame();
        } else {
            // Tap = drehen
            const rotated = rotatePiece(currentPiece);
            const kicks = [0, -1, 1, -2, 2];
            for (const kick of kicks) {
                if (!collides(rotated, currentPiece.x + kick, currentPiece.y)) {
                    currentPiece.shape = rotated;
                    currentPiece.x += kick;
                    break;
                }
            }
        }
    }
});

// === GAMEPAD SUPPORT (Nintendo Switch Pro Controller kompatibel) ===
const AXIS_THRESHOLD = 0.5;
const gpState = { left: false, right: false, down: false, up: false, a: false, b: false, hardDrop: false };

function pollGamepad() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (const pad of gamepads) {
        if (pad && pad.connected) { gp = pad; break; }
    }
    if (!gp) return;

    const left = gp.buttons[14]?.pressed || gp.axes[0] < -AXIS_THRESHOLD;
    const right = gp.buttons[15]?.pressed || gp.axes[0] > AXIS_THRESHOLD;
    const down = gp.buttons[13]?.pressed || gp.axes[1] > AXIS_THRESHOLD;
    const up = gp.buttons[12]?.pressed || gp.axes[1] < -AXIS_THRESHOLD;
    const aButton = gp.buttons[0]?.pressed || gp.buttons[1]?.pressed; // A oder B = Bestätigen/Drehen
    const hardDropBtn = gp.buttons[3]?.pressed || gp.buttons[2]?.pressed; // X oder Y = Hard Drop

    if (!gameRunning && !gameOverState) {
        if (aButton && !gpState.a) startGame();
        gpState.a = aButton;
        return;
    }
    if (gameOverState) {
        if (aButton && !gpState.a) startGame();
        gpState.a = aButton;
        return;
    }

    // Bewegen
    if (left && !gpState.left) {
        if (!collides(currentPiece.shape, currentPiece.x - 1, currentPiece.y)) currentPiece.x--;
    }
    if (right && !gpState.right) {
        if (!collides(currentPiece.shape, currentPiece.x + 1, currentPiece.y)) currentPiece.x++;
    }

    // Drehen
    if (up && !gpState.up) {
        const rotated = rotatePiece(currentPiece);
        const kicks = [0, -1, 1, -2, 2];
        for (const kick of kicks) {
            if (!collides(rotated, currentPiece.x + kick, currentPiece.y)) {
                currentPiece.shape = rotated;
                currentPiece.x += kick;
                break;
            }
        }
    }

    // Soft Drop
    softDrop = down;

    // Hard Drop
    if (hardDropBtn && !gpState.hardDrop) {
        let dropDistance = 0;
        while (!collides(currentPiece.shape, currentPiece.x, currentPiece.y + 1)) {
            currentPiece.y++;
            dropDistance++;
        }
        score += dropDistance * 2;
        lockPiece();
        clearLines();
        spawnPiece();
    }

    gpState.left = left;
    gpState.right = right;
    gpState.down = down;
    gpState.up = up;
    gpState.a = aButton;
    gpState.hardDrop = hardDropBtn;
}

let gamepadInterval = null;
function startGamepadPolling() { if (!gamepadInterval) gamepadInterval = setInterval(pollGamepad, 80); }
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

// === START ===
generateBlockTextures();
requestAnimationFrame(gameLoop);
