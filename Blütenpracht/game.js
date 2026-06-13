const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const TARGET_FPS = 60;
let lastTime = 0;

// Game states
const STATE_START = 0;
const STATE_PLAYING = 1;
const STATE_GAMEOVER = 2;
let gameState = STATE_START;

// Colors
const COLOR_NONE = 0;
const COLOR_P1 = 1; // Rosa/Pink
const COLOR_P2 = 2; // Blau/Cyan

const COLORS = {
    [COLOR_NONE]: '#555',
    [COLOR_P1]: '#ff69b4',
    [COLOR_P2]: '#00bfff'
};

const COLORS_LIGHT = {
    [COLOR_NONE]: '#777',
    [COLOR_P1]: '#ffb6d9',
    [COLOR_P2]: '#7fdfff'
};

const COLORS_DARK = {
    [COLOR_NONE]: '#333',
    [COLOR_P1]: '#cc3388',
    [COLOR_P2]: '#0088bb'
};

// Hexagonal grid settings
const HEX_RADIUS = 32;
const HEX_GAP = 4;
const GRID_COLS = 11;
const GRID_ROWS = 8;

// Flower states
const FLOWER_CLOSED = 0;
const FLOWER_OPENING = 1; // Blume öffnet sich langsam – Spieler können jetzt markieren!
const FLOWER_OPEN = 2;    // Blume ist fertig geöffnet

// Grid offset to center
let gridOffsetX = 0;
let gridOffsetY = 0;

// Flowers array
let flowers = [];

// Players
let players = [
    { col: 2, row: 2, color: COLOR_P1, name: 'Spieler 1' },
    { col: GRID_COLS - 3, row: GRID_ROWS - 3, color: COLOR_P2, name: 'Spieler 2' }
];

// Input cooldowns
let p1MoveCooldown = 0;
let p2MoveCooldown = 0;
const MOVE_COOLDOWN = 8; // frames at 60fps

// Keys held
const keys = {};

// Gamepad state
let gp1MoveCooldown = 0;
let gp2MoveCooldown = 0;
let gp1ActionPressed = false;
let gp2ActionPressed = false;

// Timing for flower opening
const OPEN_SPEED = 0.004; // Wie schnell sich eine Blume öffnet (langsamer = mehr Zeit zum Markieren)

// Spawn-Accumulator: Alle paar Sekunden beginnt eine neue Blume sich zu öffnen
let spawnAccumulator = 0;
let spawnInterval = 150; // Start: alle 2.5 Sekunden eine neue Blume
const MIN_SPAWN_INTERVAL = 40; // Minimum: alle ~0.7 Sekunden

// --- Hex math ---

function hexToPixel(col, row) {
    const w = (HEX_RADIUS + HEX_GAP) * 2;
    const h = (HEX_RADIUS + HEX_GAP) * Math.sqrt(3);
    const x = gridOffsetX + col * w * 0.75;
    const y = gridOffsetY + row * h + (col % 2 === 1 ? h / 2 : 0);
    return { x, y };
}

function hexToPixelRaw(col, row) {
    const w = (HEX_RADIUS + HEX_GAP) * 2;
    const h = (HEX_RADIUS + HEX_GAP) * Math.sqrt(3);
    const x = col * w * 0.75;
    const y = row * h + (col % 2 === 1 ? h / 2 : 0);
    return { x, y };
}

function getNeighbors(col, row) {
    const neighbors = [];
    const even = col % 2 === 0;
    const dirs = even
        ? [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]]
        : [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]];
    
    for (const [dc, dr] of dirs) {
        const nc = col + dc;
        const nr = row + dr;
        if (nc >= 0 && nc < GRID_COLS && nr >= 0 && nr < GRID_ROWS) {
            neighbors.push({ col: nc, row: nr });
        }
    }
    return neighbors;
}

function getFlower(col, row) {
    return flowers[row * GRID_COLS + col];
}

// --- Init ---

function initGrid() {
    flowers = [];
    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            flowers.push({
                col: c,
                row: r,
                state: FLOWER_CLOSED,
                color: COLOR_NONE,
                markedBy: COLOR_NONE,
                markTimer: 0,
                openProgress: 0
            });
        }
    }
    
    // Calculate grid offset to center
    const lastCol = GRID_COLS - 1;
    const lastRow = GRID_ROWS - 1;
    const topLeft = hexToPixelRaw(0, 0);
    const bottomRight = hexToPixelRaw(lastCol, lastRow);
    const gridWidth = bottomRight.x - topLeft.x;
    const gridHeight = bottomRight.y - topLeft.y + (HEX_RADIUS + HEX_GAP) * Math.sqrt(3) / 2;
    
    gridOffsetX = (canvas.width - gridWidth) / 2;
    gridOffsetY = (canvas.height - gridHeight) / 2 + 10;
}

// --- Game logic ---

function startGame() {
    gameState = STATE_PLAYING;
    lastTime = 0;
    spawnAccumulator = 0;
    spawnInterval = 150;
    p1MoveCooldown = 0;
    p2MoveCooldown = 0;
    gp1MoveCooldown = 0;
    gp2MoveCooldown = 0;
    gp1ActionPressed = false;
    gp2ActionPressed = false;
    
    players[0].col = 2;
    players[0].row = 2;
    players[1].col = GRID_COLS - 3;
    players[1].row = GRID_ROWS - 3;
    
    initGrid();
    
    // Starte direkt ein paar Blumen zum Öffnen damit Spieler sofort was sehen
    startRandomFlowerOpening();
    startRandomFlowerOpening();
    startRandomFlowerOpening();
}

function startRandomFlowerOpening() {
    // Wähle eine zufällige geschlossene Blume
    const closed = flowers.filter(f => f.state === FLOWER_CLOSED);
    if (closed.length === 0) return;
    
    const flower = closed[Math.floor(Math.random() * closed.length)];
    flower.state = FLOWER_OPENING;
    flower.openProgress = 0;
    flower.markedBy = COLOR_NONE;
    flower.markTimer = 0;
}

function markFlower(playerIndex) {
    const p = players[playerIndex];
    const flower = getFlower(p.col, p.row);
    
    // Nur Blumen im OPENING-Zustand können markiert werden!
    // Und nur wenn noch niemand markiert hat (wer zuerst kommt, mahlt zuerst)
    if (flower && flower.state === FLOWER_OPENING && flower.markedBy === COLOR_NONE) {
        flower.markedBy = p.color;
    }
}

function movePlayer(playerIndex, direction) {
    const p = players[playerIndex];
    const even = p.col % 2 === 0;
    
    let newCol = p.col;
    let newRow = p.row;
    
    if (direction === 'up') {
        newRow = p.row - 1;
    } else if (direction === 'down') {
        newRow = p.row + 1;
    } else if (direction === 'upleft') {
        newCol = p.col - 1;
        newRow = even ? p.row - 1 : p.row;
    } else if (direction === 'downleft') {
        newCol = p.col - 1;
        newRow = even ? p.row : p.row + 1;
    } else if (direction === 'upright') {
        newCol = p.col + 1;
        newRow = even ? p.row - 1 : p.row;
    } else if (direction === 'downright') {
        newCol = p.col + 1;
        newRow = even ? p.row : p.row + 1;
    } else if (direction === 'left') {
        newCol = p.col - 1;
        newRow = even ? p.row - 1 : p.row;
    } else if (direction === 'right') {
        newCol = p.col + 1;
        newRow = even ? p.row - 1 : p.row;
    }
    
    if (newCol >= 0 && newCol < GRID_COLS && newRow >= 0 && newRow < GRID_ROWS) {
        p.col = newCol;
        p.row = newRow;
    }
}

function handleInput(dt) {
    // Player 1: WASD + Space
    if (p1MoveCooldown > 0) p1MoveCooldown -= dt;
    if (p1MoveCooldown <= 0) {
        let moved = false;
        if (keys['KeyW']) { movePlayer(0, 'up'); moved = true; }
        else if (keys['KeyS']) { movePlayer(0, 'down'); moved = true; }
        else if (keys['KeyA']) { movePlayer(0, 'left'); moved = true; }
        else if (keys['KeyD']) { movePlayer(0, 'right'); moved = true; }
        if (moved) p1MoveCooldown = MOVE_COOLDOWN;
    }
    
    // Player 2: Arrow keys + Enter
    if (p2MoveCooldown > 0) p2MoveCooldown -= dt;
    if (p2MoveCooldown <= 0) {
        let moved = false;
        if (keys['ArrowUp']) { movePlayer(1, 'up'); moved = true; }
        else if (keys['ArrowDown']) { movePlayer(1, 'down'); moved = true; }
        else if (keys['ArrowLeft']) { movePlayer(1, 'left'); moved = true; }
        else if (keys['ArrowRight']) { movePlayer(1, 'right'); moved = true; }
        if (moved) p2MoveCooldown = MOVE_COOLDOWN;
    }
    
    // Gamepad support
    handleGamepad(dt);
}

function handleGamepad(dt) {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    
    for (let i = 0; i < gamepads.length; i++) {
        const gp = gamepads[i];
        if (!gp) continue;
        
        const playerIdx = i % 2;
        const deadzone = 0.15;
        
        let cooldown = playerIdx === 0 ? gp1MoveCooldown : gp2MoveCooldown;
        if (cooldown > 0) {
            if (playerIdx === 0) gp1MoveCooldown -= dt;
            else gp2MoveCooldown -= dt;
            cooldown -= dt;
        }
        
        if (cooldown <= 0) {
            const lx = gp.axes[0] || 0;
            const ly = gp.axes[1] || 0;
            
            let moved = false;
            if (ly < -deadzone && Math.abs(ly) > Math.abs(lx)) { movePlayer(playerIdx, 'up'); moved = true; }
            else if (ly > deadzone && Math.abs(ly) > Math.abs(lx)) { movePlayer(playerIdx, 'down'); moved = true; }
            else if (lx < -deadzone) { movePlayer(playerIdx, 'left'); moved = true; }
            else if (lx > deadzone) { movePlayer(playerIdx, 'right'); moved = true; }
            
            if (moved) {
                if (playerIdx === 0) gp1MoveCooldown = MOVE_COOLDOWN;
                else gp2MoveCooldown = MOVE_COOLDOWN;
            }
        }
        
        // Action button (A button = index 0)
        const actionBtn = gp.buttons[0];
        if (playerIdx === 0) {
            if (actionBtn && actionBtn.pressed && !gp1ActionPressed) {
                markFlower(0);
                gp1ActionPressed = true;
            }
            if (actionBtn && !actionBtn.pressed) gp1ActionPressed = false;
        } else {
            if (actionBtn && actionBtn.pressed && !gp2ActionPressed) {
                markFlower(1);
                gp2ActionPressed = true;
            }
            if (actionBtn && !actionBtn.pressed) gp2ActionPressed = false;
        }
    }
}

function checkGameOver() {
    const allOpen = flowers.every(f => f.state === FLOWER_OPEN);
    if (allOpen) {
        gameState = STATE_GAMEOVER;
    }
}

function getScores() {
    let p1 = 0, p2 = 0, neutral = 0;
    for (const f of flowers) {
        if (f.state === FLOWER_OPEN) {
            if (f.color === COLOR_P1) p1++;
            else if (f.color === COLOR_P2) p2++;
            else neutral++;
        }
    }
    return { p1, p2, neutral, total: flowers.length };
}

// --- Update ---

function update(dt) {
    // Gamepad: Spiel starten / neustarten mit A-Button
    if (gameState === STATE_START || gameState === STATE_GAMEOVER) {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (let i = 0; i < gamepads.length; i++) {
            const gp = gamepads[i];
            if (!gp) continue;
            if (gp.buttons[0] && gp.buttons[0].pressed) {
                startGame();
                return;
            }
        }
        return;
    }
    
    handleInput(dt);
    
    // Blumen die sich öffnen: openProgress vorantreiben
    for (const flower of flowers) {
        if (flower.state === FLOWER_OPENING) {
            flower.openProgress += OPEN_SPEED * dt;
            
            // Blume ist fertig geöffnet
            if (flower.openProgress >= 1) {
                flower.openProgress = 1;
                flower.state = FLOWER_OPEN;
                
                // Farbe bestimmen: Wer hat markiert?
                if (flower.markedBy !== COLOR_NONE) {
                    flower.color = flower.markedBy;
                } else {
                    // Keine Markierung → Farbe der am häufigsten angrenzenden offenen Blume
                    const neighbors = getNeighbors(flower.col, flower.row);
                    let p1Count = 0;
                    let p2Count = 0;
                    
                    for (const n of neighbors) {
                        const nf = getFlower(n.col, n.row);
                        if (nf && nf.state === FLOWER_OPEN) {
                            if (nf.color === COLOR_P1) p1Count++;
                            else if (nf.color === COLOR_P2) p2Count++;
                        }
                    }
                    
                    if (p1Count > p2Count) {
                        flower.color = COLOR_P1;
                    } else if (p2Count > p1Count) {
                        flower.color = COLOR_P2;
                    } else if (p1Count > 0 && p2Count > 0) {
                        flower.color = Math.random() < 0.5 ? COLOR_P1 : COLOR_P2;
                    } else {
                        flower.color = COLOR_NONE;
                    }
                }
            }
        }
    }
    
    // Neue Blumen zum Öffnen starten (Accumulator-Pattern)
    spawnAccumulator += dt;
    if (spawnAccumulator >= spawnInterval) {
        spawnAccumulator -= spawnInterval;
        startRandomFlowerOpening();
        
        // Schwierigkeit steigt: Blumen öffnen sich öfter
        if (spawnInterval > MIN_SPAWN_INTERVAL) {
            spawnInterval -= 2;
        }
    }
    
    checkGameOver();
}

// --- Drawing ---

function drawHex(x, y, radius, fillColor, strokeColor, lineWidth) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = Math.PI / 3 * i - Math.PI / 6;
        const px = x + radius * Math.cos(angle);
        const py = y + radius * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    if (fillColor) {
        ctx.fillStyle = fillColor;
        ctx.fill();
    }
    if (strokeColor) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth || 2;
        ctx.stroke();
    }
}

function drawFlowerClosed(x, y, flower) {
    // Geschlossene Knospe – grün, neutral
    drawHex(x, y, HEX_RADIUS * 0.5, '#2d5a27', '#4a6741', 2);
    
    // Kleiner Punkt in der Mitte
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#5a8a52';
    ctx.fill();
}

function drawFlowerOpening(x, y, flower) {
    const p = flower.openProgress;
    const petalCount = 6;
    const petalRadius = HEX_RADIUS * 0.35 * p;
    const distance = HEX_RADIUS * 0.4 * p;
    
    // Hintergrund-Glow wenn markiert
    if (flower.markedBy !== COLOR_NONE) {
        const alpha = 0.3 + 0.2 * Math.sin(Date.now() / 200);
        ctx.beginPath();
        ctx.arc(x, y, HEX_RADIUS * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = COLORS[flower.markedBy] + Math.floor(alpha * 255).toString(16).padStart(2, '0');
        ctx.fill();
    }
    
    // Blütenblätter die sich langsam öffnen
    const baseColor = flower.markedBy !== COLOR_NONE ? COLORS[flower.markedBy] : '#5a8a52';
    for (let i = 0; i < petalCount; i++) {
        const angle = (Math.PI * 2 / petalCount) * i + p * 0.5;
        const px = x + Math.cos(angle) * distance;
        const py = y + Math.sin(angle) * distance;
        
        ctx.beginPath();
        ctx.ellipse(px, py, petalRadius, petalRadius * 0.7, angle, 0, Math.PI * 2);
        ctx.fillStyle = baseColor;
        ctx.fill();
    }
    
    // Mitte
    ctx.beginPath();
    ctx.arc(x, y, 3 + 3 * p, 0, Math.PI * 2);
    ctx.fillStyle = '#ffdd44';
    ctx.fill();
    
    // Fortschrittsring um die Blume
    ctx.beginPath();
    ctx.arc(x, y, HEX_RADIUS * 0.75, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
    ctx.strokeStyle = flower.markedBy !== COLOR_NONE ? COLORS_LIGHT[flower.markedBy] : '#88aa88';
    ctx.lineWidth = 2;
    ctx.stroke();
}

function drawFlowerOpen(x, y, flower) {
    const petalCount = 6;
    const petalRadius = HEX_RADIUS * 0.35;
    const distance = HEX_RADIUS * 0.4;
    const color = COLORS[flower.color] || '#888';
    const lightColor = COLORS_LIGHT[flower.color] || '#aaa';
    
    // Blütenblätter
    for (let i = 0; i < petalCount; i++) {
        const angle = (Math.PI * 2 / petalCount) * i;
        const px = x + Math.cos(angle) * distance;
        const py = y + Math.sin(angle) * distance;
        
        ctx.beginPath();
        ctx.ellipse(px, py, petalRadius, petalRadius * 0.7, angle, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = lightColor;
        ctx.lineWidth = 1;
        ctx.stroke();
    }
    
    // Mitte
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#ffdd44';
    ctx.fill();
    ctx.strokeStyle = '#cc9900';
    ctx.lineWidth = 1;
    ctx.stroke();
}

function drawCursor(playerIndex) {
    const p = players[playerIndex];
    const pos = hexToPixel(p.col, p.row);
    const time = Date.now() / 500;
    const pulse = 1 + Math.sin(time + playerIndex * Math.PI) * 0.1;
    
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.scale(pulse, pulse);
    
    // Hex-Rahmen als Cursor
    drawHex(0, 0, HEX_RADIUS + 3, null, COLORS[p.color], 3);
    
    // Spieler-Dreieck oben
    const triY = -(HEX_RADIUS + 10);
    ctx.beginPath();
    ctx.moveTo(0, triY + 8);
    ctx.lineTo(-6, triY);
    ctx.lineTo(6, triY);
    ctx.closePath();
    ctx.fillStyle = COLORS[p.color];
    ctx.fill();
    
    ctx.restore();
}

function drawScoreBar() {
    const scores = getScores();
    const barY = 10;
    const barH = 20;
    const barX = 100;
    const barW = canvas.width - 200;
    
    // Hintergrund
    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barW, barH);
    
    // P1 von links
    const p1Width = (scores.p1 / scores.total) * barW;
    ctx.fillStyle = COLORS[COLOR_P1];
    ctx.fillRect(barX, barY, p1Width, barH);
    
    // P2 von rechts
    const p2Width = (scores.p2 / scores.total) * barW;
    ctx.fillStyle = COLORS[COLOR_P2];
    ctx.fillRect(barX + barW - p2Width, barY, p2Width, barH);
    
    // Labels
    ctx.fillStyle = COLORS[COLOR_P1];
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`S1: ${scores.p1}`, 10, barY + 15);
    
    ctx.fillStyle = COLORS[COLOR_P2];
    ctx.textAlign = 'right';
    ctx.fillText(`S2: ${scores.p2}`, canvas.width - 10, barY + 15);
    
    // Rahmen
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);
}

function draw() {
    // Hintergrund
    ctx.fillStyle = '#1a2a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (gameState === STATE_START) {
        drawStartScreen();
        return;
    }
    
    if (gameState === STATE_GAMEOVER) {
        drawGameOver();
        return;
    }
    
    // Hex-Gitter Hintergrund
    for (const flower of flowers) {
        const pos = hexToPixel(flower.col, flower.row);
        drawHex(pos.x, pos.y, HEX_RADIUS, '#1e3a1e', '#2a5a2a', 1);
    }
    
    // Blumen zeichnen
    for (const flower of flowers) {
        const pos = hexToPixel(flower.col, flower.row);
        if (flower.state === FLOWER_CLOSED) {
            drawFlowerClosed(pos.x, pos.y, flower);
        } else if (flower.state === FLOWER_OPENING) {
            drawFlowerOpening(pos.x, pos.y, flower);
        } else {
            drawFlowerOpen(pos.x, pos.y, flower);
        }
    }
    
    // Cursors
    drawCursor(0);
    drawCursor(1);
    
    // Score-Leiste
    drawScoreBar();
    
    // Steuerungshinweis
    ctx.fillStyle = '#aaa';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('S1: WASD + Leertaste', 10, canvas.height - 10);
    ctx.textAlign = 'right';
    ctx.fillText('S2: Pfeiltasten + Enter', canvas.width - 10, canvas.height - 10);
}

function drawStartScreen() {
    // Titel
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🌸 Blütenpracht 🌸', canvas.width / 2, 140);
    
    // Beschreibung
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#ccc';
    ctx.fillText('Zwei Spieler kämpfen um die Blumenwiese!', canvas.width / 2, 200);
    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Blumen öffnen sich langsam auf dem Feld.', canvas.width / 2, 240);
    ctx.fillText('Bewege dich zur sich öffnenden Blume und drücke Aktion!', canvas.width / 2, 265);
    ctx.fillText('Wer zuerst markiert, bestimmt die Farbe der Blüte.', canvas.width / 2, 290);
    ctx.fillText('Markierungen verblassen – sei schnell!', canvas.width / 2, 315);
    ctx.fillText('Wer am Ende mehr Blumen hat, gewinnt!', canvas.width / 2, 340);
    
    // Steuerung
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = COLORS[COLOR_P1];
    ctx.fillText('Spieler 1: WASD + Leertaste', canvas.width / 2 - 160, 400);
    ctx.fillStyle = COLORS[COLOR_P2];
    ctx.fillText('Spieler 2: Pfeiltasten + Enter', canvas.width / 2 + 160, 400);
    
    // Gamepad
    ctx.fillStyle = '#888';
    ctx.font = '14px sans-serif';
    ctx.fillText('🎮 Gamepad: Stick + A-Taste', canvas.width / 2, 440);
    
    // Start
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px sans-serif';
    const blink = Math.sin(Date.now() / 400) > 0;
    if (blink) {
        ctx.fillText('Leertaste oder Enter zum Starten', canvas.width / 2, 520);
    }
    
    // Dekorative Blumen
    drawFlowerOpen(120, 540, { color: COLOR_P1 });
    drawFlowerOpen(200, 580, { color: COLOR_P1 });
    drawFlowerOpen(canvas.width - 120, 540, { color: COLOR_P2 });
    drawFlowerOpen(canvas.width - 200, 580, { color: COLOR_P2 });
}

function drawGameOver() {
    const scores = getScores();
    
    // Feld im Hintergrund (abgedunkelt)
    ctx.globalAlpha = 0.3;
    for (const flower of flowers) {
        const pos = hexToPixel(flower.col, flower.row);
        drawHex(pos.x, pos.y, HEX_RADIUS, '#1e3a1e', '#2a5a2a', 1);
        if (flower.state === FLOWER_OPEN) {
            drawFlowerOpen(pos.x, pos.y, flower);
        }
    }
    ctx.globalAlpha = 1;
    
    // Overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Gewinner
    ctx.textAlign = 'center';
    ctx.font = 'bold 36px sans-serif';
    
    let winner = '';
    let winColor = '#fff';
    if (scores.p1 > scores.p2) {
        winner = 'Spieler 1 gewinnt!';
        winColor = COLORS[COLOR_P1];
    } else if (scores.p2 > scores.p1) {
        winner = 'Spieler 2 gewinnt!';
        winColor = COLORS[COLOR_P2];
    } else {
        winner = 'Unentschieden!';
        winColor = '#ffdd44';
    }
    
    ctx.fillStyle = winColor;
    ctx.fillText('🌺 ' + winner + ' 🌺', canvas.width / 2, 220);
    
    // Scores
    ctx.font = '24px sans-serif';
    ctx.fillStyle = COLORS[COLOR_P1];
    ctx.fillText(`Spieler 1: ${scores.p1} Blumen`, canvas.width / 2, 300);
    ctx.fillStyle = COLORS[COLOR_P2];
    ctx.fillText(`Spieler 2: ${scores.p2} Blumen`, canvas.width / 2, 340);
    
    if (scores.neutral > 0) {
        ctx.fillStyle = '#888';
        ctx.fillText(`Neutral: ${scores.neutral} Blumen`, canvas.width / 2, 380);
    }
    
    // Neustart
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px sans-serif';
    const blink = Math.sin(Date.now() / 400) > 0;
    if (blink) {
        ctx.fillText('Leertaste oder Enter für Neustart', canvas.width / 2, 460);
    }
}

// --- Game loop ---

function gameLoop(timestamp) {
    if (lastTime === 0) lastTime = timestamp;
    const elapsed = timestamp - lastTime;
    lastTime = timestamp;
    const dt = Math.min(elapsed / (1000 / TARGET_FPS), 3);

    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
}

// --- Input ---

document.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
    }
    
    keys[e.code] = true;
    
    if (e.code === 'Space') {
        if (gameState === STATE_START || gameState === STATE_GAMEOVER) {
            startGame();
        } else if (gameState === STATE_PLAYING) {
            markFlower(0);
        }
    }
    
    if (e.code === 'Enter') {
        if (gameState === STATE_START || gameState === STATE_GAMEOVER) {
            startGame();
        } else if (gameState === STATE_PLAYING) {
            markFlower(1);
        }
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// --- Start ---
initGrid();
requestAnimationFrame(gameLoop);
