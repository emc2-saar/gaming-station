// Stein für Stein - Mahjong Solitaire
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ===== KONFIGURATION =====
const TILE_WIDTH = 52;
const TILE_HEIGHT = 62;
const LAYER_OFFSET_X = 4;
const LAYER_OFFSET_Y = 4;
const SYMBOLS = [
    '🌸', '🍀', '🔥', '💎', '⭐', '🌙', '❄️', '🎯',
    '🦋', '🍁', '🌊', '⚡', '🎲', '🏮', '🪷', '🐉',
    '🌺', '🍂', '🔮', '🎭', '🦊', '🐢', '🌈', '💫',
    '🎪', '🗿', '🧩', '🎨', '🦚', '🍄', '🌻', '🎵',
    '🦉', '🐙', '🌵', '🎃'
];

// ===== LAYOUT =====
// Klassisches Mahjong-Layout: 5 Schichten
// Jede Schicht ist ein 2D-Array mit Positionen (col, row)
const LAYOUT = generateLayout();

function generateLayout() {
    const layers = [];

    // Schicht 0 (unterste): 12x8 mit Lücken
    const layer0 = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 12; c++) {
            // Ränder etwas einrücken für Form
            if (r === 0 || r === 7) {
                if (c >= 2 && c <= 9) layer0.push({ c, r });
            } else if (r === 1 || r === 6) {
                if (c >= 1 && c <= 10) layer0.push({ c, r });
            } else {
                layer0.push({ c, r });
            }
        }
    }
    layers.push(layer0);

    // Schicht 1: 10x6
    const layer1 = [];
    for (let r = 1; r < 7; r++) {
        for (let c = 1; c <= 10; c++) {
            if (r === 1 || r === 6) {
                if (c >= 3 && c <= 8) layer1.push({ c, r });
            } else {
                if (c >= 2 && c <= 9) layer1.push({ c, r });
            }
        }
    }
    layers.push(layer1);

    // Schicht 2: 6x4
    const layer2 = [];
    for (let r = 2; r < 6; r++) {
        for (let c = 3; c <= 8; c++) {
            if (r === 2 || r === 5) {
                if (c >= 4 && c <= 7) layer2.push({ c, r });
            } else {
                layer2.push({ c, r });
            }
        }
    }
    layers.push(layer2);

    // Schicht 3: 4x2
    const layer3 = [];
    for (let r = 3; r < 5; r++) {
        for (let c = 4; c <= 7; c++) {
            layer3.push({ c, r });
        }
    }
    layers.push(layer3);

    // Schicht 4 (oberste): 2x1
    const layer4 = [
        { c: 5, r: 3 },
        { c: 6, r: 4 }
    ];
    layers.push(layer4);

    return layers;
}

// ===== SPIELZUSTAND =====
let tiles = [];
let selectedTile = null;
let hintTiles = [];
let hintTimer = 0;
let timerSeconds = 0;
let timerInterval = null;
let gameActive = false;
let animatingTiles = [];
let totalPairs = 0;

// ===== TILE-KLASSE =====
class Tile {
    constructor(col, row, layer, symbol) {
        this.col = col;
        this.row = row;
        this.layer = layer;
        this.symbol = symbol;
        this.removed = false;
        this.selected = false;
        this.hinted = false;
        this.animProgress = 0; // für Entfern-Animation
        this.removing = false;
    }

    get x() {
        return this.col * TILE_WIDTH + this.layer * LAYER_OFFSET_X;
    }

    get y() {
        return this.row * TILE_HEIGHT - this.layer * LAYER_OFFSET_Y;
    }

    isFree() {
        if (this.removed) return false;

        // Prüfe ob ein Stein darauf liegt (höhere Schicht, überlappende Position)
        for (const other of tiles) {
            if (other.removed || other.layer <= this.layer) continue;
            if (Math.abs(other.col - this.col) < 1 && Math.abs(other.row - this.row) < 1) {
                return false;
            }
        }

        // Prüfe ob links ODER rechts frei ist
        const blockedLeft = tiles.some(t =>
            !t.removed && t.layer === this.layer &&
            t.row === this.row && t.col === this.col - 1
        );
        const blockedRight = tiles.some(t =>
            !t.removed && t.layer === this.layer &&
            t.row === this.row && t.col === this.col + 1
        );

        return !blockedLeft || !blockedRight;
    }
}

// ===== SPIEL INITIALISIEREN =====
function initGame() {
    tiles = [];
    selectedTile = null;
    hintTiles = [];
    hintTimer = 0;
    animatingTiles = [];
    timerSeconds = 0;
    gameActive = true;

    // Steine aus Layout erstellen
    let positions = [];
    LAYOUT.forEach((layer, layerIdx) => {
        layer.forEach(pos => {
            positions.push({ col: pos.c, row: pos.r, layer: layerIdx });
        });
    });

    // Gesamtanzahl muss gerade sein
    if (positions.length % 2 !== 0) {
        positions.pop();
    }

    totalPairs = positions.length / 2;

    // Symbole zuweisen (immer Paare)
    const symbolPool = [];
    const numPairs = positions.length / 2;
    for (let i = 0; i < numPairs; i++) {
        const sym = SYMBOLS[i % SYMBOLS.length];
        symbolPool.push(sym, sym);
    }

    // Mischen
    shuffle(symbolPool);

    // Steine erstellen
    positions.forEach((pos, i) => {
        tiles.push(new Tile(pos.col, pos.row, pos.layer, symbolPool[i]));
    });

    // Sicherstellen, dass das Spiel lösbar ist (vereinfacht: prüfe ob Paare existieren)
    if (!hasAvailablePairs()) {
        // Nochmal mischen
        initGame();
        return;
    }

    updateHUD();
    startTimer();
    resizeCanvas();
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

// ===== CANVAS GRÖSSE =====
function resizeCanvas() {
    const container = document.getElementById('board-container');
    const maxW = container.clientWidth - 20;
    const maxH = container.clientHeight - 20;

    // Berechne benötigte Größe
    const boardW = 13 * TILE_WIDTH + 5 * LAYER_OFFSET_X + 20;
    const boardH = 9 * TILE_HEIGHT + 5 * LAYER_OFFSET_Y + 20;

    const scale = Math.min(maxW / boardW, maxH / boardH, 1.2);

    canvas.width = boardW * scale;
    canvas.height = boardH * scale;
    canvas.style.width = canvas.width + 'px';
    canvas.style.height = canvas.height + 'px';

    ctx.setTransform(scale, 0, 0, scale, 10 * scale, 10 * scale);
}

// ===== ZEICHNEN =====
function draw() {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Steine von unten nach oben, hinten nach vorne zeichnen
    const sortedTiles = [...tiles].filter(t => !t.removed).sort((a, b) => {
        if (a.layer !== b.layer) return a.layer - b.layer;
        if (a.row !== b.row) return a.row - b.row;
        return a.col - b.col;
    });

    for (const tile of sortedTiles) {
        drawTile(tile);
    }

    // Animierende Steine
    for (const anim of animatingTiles) {
        drawRemovingTile(anim);
    }
}

function drawTile(tile) {
    const x = tile.x;
    const y = tile.y;
    const w = TILE_WIDTH - 4;
    const h = TILE_HEIGHT - 4;
    const free = tile.isFree();

    // Schatten / 3D-Effekt
    ctx.fillStyle = '#2a2a3e';
    ctx.fillRect(x + 3, y + 3, w, h);

    // Stein-Hintergrund
    let bgColor = '#f5f0e8';
    if (tile.selected) {
        bgColor = '#ffd700';
    } else if (tile.hinted) {
        bgColor = '#90ee90';
    } else if (!free) {
        bgColor = '#d4cfc7';
    }

    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 4);
    ctx.fill();

    // Rand
    ctx.strokeStyle = tile.selected ? '#ff8c00' : (free ? '#8b7355' : '#a09080');
    ctx.lineWidth = tile.selected ? 2 : 1;
    ctx.stroke();

    // Symbol
    ctx.font = '24px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#333';
    ctx.fillText(tile.symbol, x + w / 2, y + h / 2 + 2);

    // Wenn nicht frei, leicht abdunkeln
    if (!free) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 4);
        ctx.fill();
    }

    // Gamepad-Cursor Highlight
    if (tile.cursorHighlight && free) {
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(x - 2, y - 2, w + 4, h + 4, 6);
        ctx.stroke();
    }
}

function drawRemovingTile(anim) {
    const tile = anim.tile;
    const progress = anim.progress;
    const x = tile.x;
    const y = tile.y;
    const w = TILE_WIDTH - 4;
    const h = TILE_HEIGHT - 4;

    ctx.globalAlpha = 1 - progress;
    const scale = 1 + progress * 0.3;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.scale(scale, scale);
    ctx.translate(-(x + w / 2), -(y + h / 2));

    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 4);
    ctx.fill();

    ctx.font = '24px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#333';
    ctx.fillText(tile.symbol, x + w / 2, y + h / 2 + 2);

    ctx.restore();
    ctx.globalAlpha = 1;
}

// ===== GAME LOOP =====
const TARGET_FPS = 60;
let lastTime = 0;

function gameLoop(timestamp) {
    if (lastTime === 0) lastTime = timestamp;
    const elapsed = timestamp - lastTime;
    lastTime = timestamp;
    const dt = Math.min(elapsed / (1000 / TARGET_FPS), 3);

    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
}

function update(dt) {
    // Animationen updaten
    for (let i = animatingTiles.length - 1; i >= 0; i--) {
        animatingTiles[i].progress += 0.05 * dt;
        if (animatingTiles[i].progress >= 1) {
            animatingTiles.splice(i, 1);
        }
    }

    // Hint-Timer
    if (hintTimer > 0) {
        hintTimer -= dt;
        if (hintTimer <= 0) {
            hintTiles.forEach(t => t.hinted = false);
            hintTiles = [];
        }
    }
}

// ===== SPIELLOGIK =====
function handleClick(mx, my) {
    if (!gameActive) return;

    // Finde geklickten Stein (von oben nach unten suchen)
    let clicked = null;
    const sortedTiles = [...tiles].filter(t => !t.removed).sort((a, b) => {
        if (b.layer !== a.layer) return b.layer - a.layer;
        if (b.row !== a.row) return b.row - a.row;
        return b.col - a.col;
    });

    for (const tile of sortedTiles) {
        const x = tile.x;
        const y = tile.y;
        const w = TILE_WIDTH - 4;
        const h = TILE_HEIGHT - 4;

        if (mx >= x && mx <= x + w && my >= y && my <= y + h) {
            clicked = tile;
            break;
        }
    }

    if (!clicked || !clicked.isFree()) return;

    // Hint zurücksetzen
    hintTiles.forEach(t => t.hinted = false);
    hintTiles = [];
    hintTimer = 0;

    if (selectedTile === null) {
        // Ersten Stein auswählen
        clicked.selected = true;
        selectedTile = clicked;
    } else if (selectedTile === clicked) {
        // Abwählen
        clicked.selected = false;
        selectedTile = null;
    } else if (selectedTile.symbol === clicked.symbol) {
        // Paar gefunden!
        selectedTile.selected = false;
        selectedTile.removed = true;
        clicked.removed = true;

        // Animation starten
        animatingTiles.push({ tile: selectedTile, progress: 0 });
        animatingTiles.push({ tile: clicked, progress: 0 });

        selectedTile = null;
        updateHUD();

        // Prüfe Spielende
        const remaining = tiles.filter(t => !t.removed);
        if (remaining.length === 0) {
            gameActive = false;
            stopTimer();
            setTimeout(showWinScreen, 500);
        } else if (!hasAvailablePairs()) {
            gameActive = false;
            stopTimer();
            setTimeout(showLoseScreen, 500);
        }
    } else {
        // Kein Paar - wechsle Auswahl
        selectedTile.selected = false;
        clicked.selected = true;
        selectedTile = clicked;
    }
}

function hasAvailablePairs() {
    const freeTiles = tiles.filter(t => !t.removed && t.isFree());
    for (let i = 0; i < freeTiles.length; i++) {
        for (let j = i + 1; j < freeTiles.length; j++) {
            if (freeTiles[i].symbol === freeTiles[j].symbol) {
                return true;
            }
        }
    }
    return false;
}

function findHintPair() {
    const freeTiles = tiles.filter(t => !t.removed && t.isFree());
    for (let i = 0; i < freeTiles.length; i++) {
        for (let j = i + 1; j < freeTiles.length; j++) {
            if (freeTiles[i].symbol === freeTiles[j].symbol) {
                return [freeTiles[i], freeTiles[j]];
            }
        }
    }
    return null;
}

function showHint() {
    if (!gameActive) return;
    const pair = findHintPair();
    if (pair) {
        hintTiles.forEach(t => t.hinted = false);
        hintTiles = pair;
        pair[0].hinted = true;
        pair[1].hinted = true;
        hintTimer = 90; // ~1.5 Sekunden bei 60fps
    }
}

function shuffleTiles() {
    if (!gameActive) return;

    // Nur die Symbole der verbleibenden Steine mischen
    const remaining = tiles.filter(t => !t.removed);
    const symbols = remaining.map(t => t.symbol);
    shuffle(symbols);
    remaining.forEach((t, i) => t.symbol = symbols[i]);

    // Auswahl zurücksetzen
    if (selectedTile) {
        selectedTile.selected = false;
        selectedTile = null;
    }
    hintTiles.forEach(t => t.hinted = false);
    hintTiles = [];

    // Prüfe ob nach Mischen Paare existieren
    if (!hasAvailablePairs()) {
        shuffleTiles(); // Nochmal mischen
    }
}

// ===== HUD =====
function updateHUD() {
    const remaining = tiles.filter(t => !t.removed).length;
    document.getElementById('pairs-left').textContent = `Paare: ${remaining / 2}`;
}

function startTimer() {
    stopTimer();
    timerSeconds = 0;
    timerInterval = setInterval(() => {
        timerSeconds++;
        const min = Math.floor(timerSeconds / 60);
        const sec = timerSeconds % 60;
        document.getElementById('timer').textContent = `Zeit: ${min}:${sec.toString().padStart(2, '0')}`;
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

// ===== SCREENS =====
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}

function showWinScreen() {
    const min = Math.floor(timerSeconds / 60);
    const sec = timerSeconds % 60;
    document.getElementById('win-message').textContent =
        `Du hast alle ${totalPairs} Paare in ${min}:${sec.toString().padStart(2, '0')} gefunden!`;
    showScreen('win-screen');
}

function showLoseScreen() {
    showScreen('lose-screen');
}

function startNewGame() {
    showScreen('game-screen');
    initGame();
}

// ===== EVENT LISTENER =====
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    // Berücksichtige den Canvas-Transform (10px padding * scale)
    const container = document.getElementById('board-container');
    const maxW = container.clientWidth - 20;
    const maxH = container.clientHeight - 20;
    const boardW = 13 * TILE_WIDTH + 5 * LAYER_OFFSET_X + 20;
    const boardH = 9 * TILE_HEIGHT + 5 * LAYER_OFFSET_Y + 20;
    const scale = Math.min(maxW / boardW, maxH / boardH, 1.2);

    const mx = (e.clientX - rect.left) * scaleX / scale - 10;
    const my = (e.clientY - rect.top) * scaleY / scale - 10;

    handleClick(mx, my);
});

// Touch-Support
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const container = document.getElementById('board-container');
    const maxW = container.clientWidth - 20;
    const maxH = container.clientHeight - 20;
    const boardW = 13 * TILE_WIDTH + 5 * LAYER_OFFSET_X + 20;
    const boardH = 9 * TILE_HEIGHT + 5 * LAYER_OFFSET_Y + 20;
    const scale = Math.min(maxW / boardW, maxH / boardH, 1.2);

    const mx = (touch.clientX - rect.left) * scaleX / scale - 10;
    const my = (touch.clientY - rect.top) * scaleY / scale - 10;

    handleClick(mx, my);
}, { passive: false });

document.getElementById('btn-start').addEventListener('click', startNewGame);
document.getElementById('btn-restart-win').addEventListener('click', startNewGame);
document.getElementById('btn-restart-lose').addEventListener('click', startNewGame);
document.getElementById('btn-hint').addEventListener('click', showHint);
document.getElementById('btn-shuffle').addEventListener('click', shuffleTiles);

window.addEventListener('resize', () => {
    if (gameActive) resizeCanvas();
});

// === GAMEPAD SUPPORT (Nintendo Switch Pro Controller kompatibel) ===
const AXIS_THRESHOLD = 0.5;
const gpState = { up: false, down: false, left: false, right: false, a: false, x: false, y: false };
let cursorTileIndex = 0; // Index in freie-Steine-Liste
let cursorActive = false; // Wird aktiv wenn Controller benutzt wird

function getFreeTiles() {
    return tiles.filter(t => !t.removed && t.isFree()).sort((a, b) => {
        if (a.row !== b.row) return a.row - b.row;
        return a.col - b.col;
    });
}

function highlightCursorTile() {
    // Alle alten Cursor-Highlights entfernen
    tiles.forEach(t => t.cursorHighlight = false);
    if (!cursorActive || !gameActive) return;

    const freeTiles = getFreeTiles();
    if (freeTiles.length === 0) return;
    if (cursorTileIndex >= freeTiles.length) cursorTileIndex = 0;
    if (cursorTileIndex < 0) cursorTileIndex = freeTiles.length - 1;
    freeTiles[cursorTileIndex].cursorHighlight = true;
}

function pollGamepad() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (const pad of gamepads) { if (pad && pad.connected) { gp = pad; break; } }
    if (!gp) return;

    const up = gp.buttons[12]?.pressed || gp.axes[1] < -AXIS_THRESHOLD;
    const down = gp.buttons[13]?.pressed || gp.axes[1] > AXIS_THRESHOLD;
    const left = gp.buttons[14]?.pressed || gp.axes[0] < -AXIS_THRESHOLD;
    const right = gp.buttons[15]?.pressed || gp.axes[0] > AXIS_THRESHOLD;
    const aButton = gp.buttons[0]?.pressed || gp.buttons[1]?.pressed;
    const xButton = gp.buttons[2]?.pressed; // X = Hint
    const yButton = gp.buttons[3]?.pressed; // Y = Shuffle

    if (!gameActive) {
        // Start / Restart
        if (aButton && !gpState.a) startNewGame();
        gpState.a = aButton;
        return;
    }

    cursorActive = true;
    const freeTiles = getFreeTiles();
    if (freeTiles.length === 0) return;

    // Navigation
    if (right && !gpState.right) { cursorTileIndex++; highlightCursorTile(); }
    if (left && !gpState.left) { cursorTileIndex--; if (cursorTileIndex < 0) cursorTileIndex = freeTiles.length - 1; highlightCursorTile(); }
    if (down && !gpState.down) {
        // Nächsten Stein in einer tieferen Reihe finden
        const current = freeTiles[cursorTileIndex % freeTiles.length];
        const below = freeTiles.findIndex((t, i) => i > cursorTileIndex && t.row > current.row);
        if (below !== -1) cursorTileIndex = below;
        highlightCursorTile();
    }
    if (up && !gpState.up) {
        const current = freeTiles[cursorTileIndex % freeTiles.length];
        let above = -1;
        for (let i = cursorTileIndex - 1; i >= 0; i--) {
            if (freeTiles[i].row < current.row) { above = i; break; }
        }
        if (above !== -1) cursorTileIndex = above;
        highlightCursorTile();
    }

    // Auswählen mit A
    if (aButton && !gpState.a) {
        const idx = cursorTileIndex % freeTiles.length;
        const tile = freeTiles[idx];
        if (tile) handleClick(tile.x + 5, tile.y + 5);
    }

    // Hint mit X
    if (xButton && !gpState.x) showHint();
    // Shuffle mit Y
    if (yButton && !gpState.y) shuffleTiles();

    gpState.up = up; gpState.down = down; gpState.left = left; gpState.right = right;
    gpState.a = aButton; gpState.x = xButton; gpState.y = yButton;
}

let gamepadInterval = null;
function startGamepadPolling() { if (!gamepadInterval) gamepadInterval = setInterval(pollGamepad, 100); }
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

// ===== START =====
lastTime = 0;
requestAnimationFrame(gameLoop);
