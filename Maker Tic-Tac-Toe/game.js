const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const TARGET_FPS = 60;
let lastTime = 0;

// Game State
let gameState = 'start'; // 'start', 'playing', 'gameover'
let board = Array(9).fill(null); // null, 'gear', 'bolt'
let currentPlayer = 'gear'; // 'gear' = Spieler 1, 'bolt' = Spieler 2
let winner = null;
let winLine = null;
let scores = { gear: 0, bolt: 0 };
let animationTime = 0;
let placedPieces = []; // Animation für gesetzte Teile

// Layout
const BOARD_OFFSET_X = 60;
const BOARD_OFFSET_Y = 180;
const CELL_SIZE = 120;
const GRID_SIZE = 3;

// Farben - Maker/Industrial Theme
const COLORS = {
    bg: '#1a1a2e',
    gridLine: '#4a9eff',
    gridGlow: 'rgba(74, 158, 255, 0.3)',
    gear: '#ff6b35',
    gearGlow: 'rgba(255, 107, 53, 0.4)',
    bolt: '#00d4aa',
    boltGlow: 'rgba(0, 212, 170, 0.4)',
    text: '#e0e0e0',
    accent: '#4a9eff',
    dimText: '#888',
    winHighlight: '#ffd700'
};

// Win-Kombinationen
const WIN_COMBOS = [
    [0,1,2], [3,4,5], [6,7,8], // Reihen
    [0,3,6], [1,4,7], [2,5,8], // Spalten
    [0,4,8], [2,4,6]           // Diagonalen
];

function update(dt) {
    animationTime += dt * 0.05;
    
    // Platzierte Teile animieren
    for (let piece of placedPieces) {
        if (piece.scale < 1) {
            piece.scale = Math.min(1, piece.scale + 0.08 * dt);
        }
        piece.rotation += dt * 0.02;
    }
}

function draw() {
    // Background
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Background Pattern - kleine Punkte wie Lochrasterplatte
    drawPegboard();
    
    if (gameState === 'start') {
        drawStartScreen();
    } else if (gameState === 'playing' || gameState === 'gameover') {
        drawGame();
    }
}

function drawPegboard() {
    ctx.fillStyle = 'rgba(74, 158, 255, 0.05)';
    for (let x = 0; x < canvas.width; x += 20) {
        for (let y = 0; y < canvas.height; y += 20) {
            ctx.beginPath();
            ctx.arc(x, y, 1, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function drawStartScreen() {
    // Titel
    ctx.save();
    ctx.textAlign = 'center';
    
    // Großes Zahnrad als Deko
    drawGear(canvas.width / 2, 150, 50, animationTime * 0.5);
    
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('MAKER', canvas.width / 2, 250);
    ctx.fillText('TIC-TAC-TOE', canvas.width / 2, 290);
    
    // Untertitel
    ctx.fillStyle = COLORS.accent;
    ctx.font = '16px sans-serif';
    ctx.fillText('⚡ EmC² Saar e.V. ⚡', canvas.width / 2, 330);
    
    // Spieler-Info
    ctx.fillStyle = COLORS.gear;
    ctx.font = '18px sans-serif';
    ctx.fillText('Spieler 1: Zahnrad ⚙', canvas.width / 2, 400);
    ctx.fillStyle = COLORS.bolt;
    ctx.fillText('Spieler 2: Schraube 🔩', canvas.width / 2, 435);
    
    // Steuerung
    ctx.fillStyle = COLORS.dimText;
    ctx.font = '15px sans-serif';
    ctx.fillText('Klick oder Ziffern 1-9 zum Setzen', canvas.width / 2, 500);
    ctx.fillText('Leertaste zum Starten', canvas.width / 2, 530);
    
    // Blinkender Hinweis
    const alpha = 0.5 + Math.sin(animationTime * 3) * 0.5;
    ctx.fillStyle = `rgba(74, 158, 255, ${alpha})`;
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('[ LEERTASTE ]', canvas.width / 2, 590);
    
    ctx.restore();
}

function drawGame() {
    // Score Anzeige
    drawScoreboard();
    
    // Grid zeichnen
    drawGrid();
    
    // Gesetzte Teile
    for (let piece of placedPieces) {
        const col = piece.index % 3;
        const row = Math.floor(piece.index / 3);
        const cx = BOARD_OFFSET_X + col * CELL_SIZE + CELL_SIZE / 2;
        const cy = BOARD_OFFSET_Y + row * CELL_SIZE + CELL_SIZE / 2;
        
        if (piece.type === 'gear') {
            drawGear(cx, cy, 40 * piece.scale, piece.rotation);
        } else {
            drawBolt(cx, cy, 40 * piece.scale, piece.rotation);
        }
    }
    
    // Win-Linie
    if (winLine) {
        drawWinLine();
    }
    
    // Status-Text
    drawStatus();
    
    // Game Over Overlay
    if (gameState === 'gameover') {
        drawGameOver();
    }
}

function drawScoreboard() {
    ctx.save();
    ctx.textAlign = 'center';
    
    // Hintergrund
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, canvas.width, 60);
    
    // Spieler 1 Score
    ctx.fillStyle = COLORS.gear;
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`⚙ ${scores.gear}`, 20, 38);
    
    // VS
    ctx.fillStyle = COLORS.dimText;
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VS', canvas.width / 2, 38);
    
    // Spieler 2 Score
    ctx.fillStyle = COLORS.bolt;
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${scores.bolt} 🔩`, canvas.width - 20, 38);
    
    ctx.restore();
}

function drawGrid() {
    ctx.strokeStyle = COLORS.gridLine;
    ctx.lineWidth = 3;
    ctx.shadowColor = COLORS.gridGlow;
    ctx.shadowBlur = 10;
    
    // Vertikale Linien
    for (let i = 1; i < GRID_SIZE; i++) {
        const x = BOARD_OFFSET_X + i * CELL_SIZE;
        ctx.beginPath();
        ctx.moveTo(x, BOARD_OFFSET_Y + 10);
        ctx.lineTo(x, BOARD_OFFSET_Y + GRID_SIZE * CELL_SIZE - 10);
        ctx.stroke();
    }
    
    // Horizontale Linien
    for (let i = 1; i < GRID_SIZE; i++) {
        const y = BOARD_OFFSET_Y + i * CELL_SIZE;
        ctx.beginPath();
        ctx.moveTo(BOARD_OFFSET_X + 10, y);
        ctx.lineTo(BOARD_OFFSET_X + GRID_SIZE * CELL_SIZE - 10, y);
        ctx.stroke();
    }
    
    ctx.shadowBlur = 0;
    
    // Ecken / Nieten
    ctx.fillStyle = COLORS.gridLine;
    const corners = [
        [BOARD_OFFSET_X, BOARD_OFFSET_Y],
        [BOARD_OFFSET_X + 3 * CELL_SIZE, BOARD_OFFSET_Y],
        [BOARD_OFFSET_X, BOARD_OFFSET_Y + 3 * CELL_SIZE],
        [BOARD_OFFSET_X + 3 * CELL_SIZE, BOARD_OFFSET_Y + 3 * CELL_SIZE]
    ];
    for (let [cx, cy] of corners) {
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = COLORS.bg;
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = COLORS.gridLine;
    }
}

function drawGear(cx, cy, radius, rotation) {
    const teeth = 8;
    const innerRadius = radius * 0.7;
    const outerRadius = radius;
    
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);
    
    // Glow
    ctx.shadowColor = COLORS.gearGlow;
    ctx.shadowBlur = 15;
    
    // Zahnrad-Körper
    ctx.beginPath();
    for (let i = 0; i < teeth * 2; i++) {
        const angle = (i / (teeth * 2)) * Math.PI * 2;
        const r = i % 2 === 0 ? outerRadius : innerRadius;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = COLORS.gear;
    ctx.fill();
    ctx.strokeStyle = '#ff8c5a';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.shadowBlur = 0;
    
    // Innerer Kreis
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.bg;
    ctx.fill();
    ctx.strokeStyle = '#ff8c5a';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Mittelpunkt
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.gear;
    ctx.fill();
    
    ctx.restore();
}

function drawBolt(cx, cy, radius, rotation) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-rotation * 0.5);
    
    // Glow
    ctx.shadowColor = COLORS.boltGlow;
    ctx.shadowBlur = 15;
    
    // Sechskant-Kopf
    const headRadius = radius * 0.85;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 - Math.PI / 6;
        const x = Math.cos(angle) * headRadius;
        const y = Math.sin(angle) * headRadius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = COLORS.bolt;
    ctx.fill();
    ctx.strokeStyle = '#33e8c0';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.shadowBlur = 0;
    
    // Kreuz-Schlitz
    ctx.strokeStyle = COLORS.bg;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    
    const slotLen = radius * 0.5;
    ctx.beginPath();
    ctx.moveTo(-slotLen, 0);
    ctx.lineTo(slotLen, 0);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(0, -slotLen);
    ctx.lineTo(0, slotLen);
    ctx.stroke();
    
    ctx.restore();
}

function drawWinLine() {
    const [a, , c] = winLine;
    const colA = a % 3, rowA = Math.floor(a / 3);
    const colC = c % 3, rowC = Math.floor(c / 3);
    
    const x1 = BOARD_OFFSET_X + colA * CELL_SIZE + CELL_SIZE / 2;
    const y1 = BOARD_OFFSET_Y + rowA * CELL_SIZE + CELL_SIZE / 2;
    const x2 = BOARD_OFFSET_X + colC * CELL_SIZE + CELL_SIZE / 2;
    const y2 = BOARD_OFFSET_Y + rowC * CELL_SIZE + CELL_SIZE / 2;
    
    ctx.save();
    ctx.strokeStyle = COLORS.winHighlight;
    ctx.lineWidth = 5;
    ctx.shadowColor = COLORS.winHighlight;
    ctx.shadowBlur = 20;
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
}

function drawStatus() {
    ctx.save();
    ctx.textAlign = 'center';
    
    if (gameState === 'playing') {
        const label = currentPlayer === 'gear' ? '⚙ Zahnrad' : '🔩 Schraube';
        const color = currentPlayer === 'gear' ? COLORS.gear : COLORS.bolt;
        
        ctx.fillStyle = color;
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText(`${label} ist dran`, canvas.width / 2, BOARD_OFFSET_Y + 3 * CELL_SIZE + 50);
    }
    
    ctx.restore();
}

function drawGameOver() {
    ctx.save();
    ctx.textAlign = 'center';
    
    // Overlay
    ctx.fillStyle = 'rgba(26, 26, 46, 0.85)';
    ctx.fillRect(0, canvas.height - 120, canvas.width, 120);
    
    if (winner) {
        const label = winner === 'gear' ? '⚙ Zahnrad' : '🔩 Schraube';
        const color = winner === 'gear' ? COLORS.gear : COLORS.bolt;
        ctx.fillStyle = color;
        ctx.font = 'bold 26px sans-serif';
        ctx.fillText(`${label} gewinnt!`, canvas.width / 2, canvas.height - 75);
    } else {
        ctx.fillStyle = COLORS.accent;
        ctx.font = 'bold 26px sans-serif';
        ctx.fillText('Unentschieden!', canvas.width / 2, canvas.height - 75);
    }
    
    // Neustart-Hinweis
    const alpha = 0.5 + Math.sin(animationTime * 3) * 0.5;
    ctx.fillStyle = `rgba(224, 224, 224, ${alpha})`;
    ctx.font = '16px sans-serif';
    ctx.fillText('Leertaste für neue Runde', canvas.width / 2, canvas.height - 35);
    
    ctx.restore();
}

// Spiellogik
function placePiece(index) {
    if (gameState !== 'playing') return;
    if (board[index] !== null) return;
    
    board[index] = currentPlayer;
    placedPieces.push({
        index: index,
        type: currentPlayer,
        scale: 0.3,
        rotation: 0
    });
    
    // Gewinn prüfen
    if (checkWin(currentPlayer)) {
        winner = currentPlayer;
        scores[currentPlayer]++;
        gameState = 'gameover';
        return;
    }
    
    // Unentschieden prüfen
    if (board.every(cell => cell !== null)) {
        winner = null;
        gameState = 'gameover';
        return;
    }
    
    // Spieler wechseln
    currentPlayer = currentPlayer === 'gear' ? 'bolt' : 'gear';
}

function checkWin(player) {
    for (let combo of WIN_COMBOS) {
        if (combo.every(i => board[i] === player)) {
            winLine = combo;
            return true;
        }
    }
    return false;
}

function startGame() {
    board = Array(9).fill(null);
    placedPieces = [];
    currentPlayer = 'gear';
    winner = null;
    winLine = null;
    gameState = 'playing';
    lastTime = 0;
}

function resetRound() {
    board = Array(9).fill(null);
    placedPieces = [];
    // Verlierer fängt an, bei Unentschieden wechseln
    currentPlayer = winner ? (winner === 'gear' ? 'bolt' : 'gear') : (currentPlayer === 'gear' ? 'bolt' : 'gear');
    winner = null;
    winLine = null;
    gameState = 'playing';
}

// Input - Maus/Touch
function getCellFromPosition(x, y) {
    const col = Math.floor((x - BOARD_OFFSET_X) / CELL_SIZE);
    const row = Math.floor((y - BOARD_OFFSET_Y) / CELL_SIZE);
    
    if (col >= 0 && col < 3 && row >= 0 && row < 3) {
        return row * 3 + col;
    }
    return -1;
}

canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    if (gameState === 'start') {
        startGame();
        return;
    }
    
    if (gameState === 'gameover') {
        resetRound();
        return;
    }
    
    const cell = getCellFromPosition(x, y);
    if (cell >= 0) {
        placePiece(cell);
    }
});

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (touch.clientX - rect.left) * scaleX;
    const y = (touch.clientY - rect.top) * scaleY;
    
    if (gameState === 'start') {
        startGame();
        return;
    }
    
    if (gameState === 'gameover') {
        resetRound();
        return;
    }
    
    const cell = getCellFromPosition(x, y);
    if (cell >= 0) {
        placePiece(cell);
    }
});

// Input - Tastatur
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        if (gameState === 'start') startGame();
        else if (gameState === 'gameover') resetRound();
        return;
    }
    
    // Zifferntasten 1-9 für Felder (Numpad-Layout)
    // 7|8|9
    // 4|5|6
    // 1|2|3
    const keyMap = {
        'Digit7': 0, 'Digit8': 1, 'Digit9': 2,
        'Digit4': 3, 'Digit5': 4, 'Digit6': 5,
        'Digit1': 6, 'Digit2': 7, 'Digit3': 8,
        'Numpad7': 0, 'Numpad8': 1, 'Numpad9': 2,
        'Numpad4': 3, 'Numpad5': 4, 'Numpad6': 5,
        'Numpad1': 6, 'Numpad2': 7, 'Numpad3': 8
    };
    
    if (keyMap[e.code] !== undefined && gameState === 'playing') {
        placePiece(keyMap[e.code]);
    }
});

// Game Loop
function gameLoop(timestamp) {
    if (lastTime === 0) lastTime = timestamp;
    const elapsed = timestamp - lastTime;
    lastTime = timestamp;
    const dt = Math.min(elapsed / (1000 / TARGET_FPS), 3);

    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
}

// Start
requestAnimationFrame(gameLoop);
