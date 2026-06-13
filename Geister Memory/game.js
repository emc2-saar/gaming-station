const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const TARGET_FPS = 60;
let lastTime = 0;

// Game states: 'start', 'playing', 'gameover', 'levelcomplete', 'checking'
let gameState = 'start';
let score = 0;
let moves = 0;
let level = 1;
let timer = 0; // in seconds (accumulated via dt)
let timerAccumulator = 0;

// Card grid
let cards = [];
let gridCols = 4;
let gridRows = 3;
let cardWidth = 0;
let cardHeight = 0;
let gridOffsetX = 0;
let gridOffsetY = 0;
const cardGap = 8;

// Selection
let firstCard = null;
let secondCard = null;
let checkTimer = 0;
const CHECK_DELAY = 45; // frames at 60fps (via dt)

// Cursor for keyboard/gamepad navigation
let cursorRow = 0;
let cursorCol = 0;

// Animation
let flipAnimations = [];
let matchAnimations = [];

// Ghost symbols - drawn procedurally
const SYMBOLS = [
    'ghost',      // 👻
    'bat',        // 🦇
    'pumpkin',    // 🎃
    'spider',     // 🕷
    'skull',      // 💀
    'cat',        // 🐱
    'moon',       // 🌙
    'potion',     // 🧪
    'eye',        // 👁
    'candle',     // 🕯
    'web',        // 🕸
    'hat'         // 🎩
];

const SYMBOL_COLORS = {
    ghost: '#a8e6cf',
    bat: '#9b59b6',
    pumpkin: '#f39c12',
    spider: '#e74c3c',
    skull: '#ecf0f1',
    cat: '#2ecc71',
    moon: '#f1c40f',
    potion: '#1abc9c',
    eye: '#e91e63',
    candle: '#ff9800',
    web: '#bdc3c7',
    hat: '#8e44ad'
};

// Gamepad state
let gamepadPrevButtons = {};

// Level configurations
function getLevelConfig(lvl) {
    if (lvl === 1) return { cols: 4, rows: 3 }; // 12 cards = 6 pairs
    if (lvl === 2) return { cols: 4, rows: 4 }; // 16 cards = 8 pairs
    if (lvl === 3) return { cols: 5, rows: 4 }; // 20 cards = 10 pairs
    return { cols: 6, rows: 4 }; // 24 cards = 12 pairs
}

function initLevel() {
    const config = getLevelConfig(level);
    gridCols = config.cols;
    gridRows = config.rows;
    
    const totalCards = gridCols * gridRows;
    const numPairs = totalCards / 2;
    
    // Pick symbols for this level
    const levelSymbols = SYMBOLS.slice(0, numPairs);
    
    // Create pairs
    let cardValues = [];
    for (let i = 0; i < numPairs; i++) {
        cardValues.push(levelSymbols[i]);
        cardValues.push(levelSymbols[i]);
    }
    
    // Shuffle (Fisher-Yates)
    for (let i = cardValues.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cardValues[i], cardValues[j]] = [cardValues[j], cardValues[i]];
    }
    
    // Calculate card dimensions
    const availableWidth = canvas.width - 40;
    const availableHeight = canvas.height - 120;
    cardWidth = Math.floor((availableWidth - (gridCols - 1) * cardGap) / gridCols);
    cardHeight = Math.floor((availableHeight - (gridRows - 1) * cardGap) / gridRows);
    
    // Keep cards square-ish
    const maxSize = Math.min(cardWidth, cardHeight);
    cardWidth = maxSize;
    cardHeight = maxSize;
    
    // Center grid
    const totalGridWidth = gridCols * cardWidth + (gridCols - 1) * cardGap;
    const totalGridHeight = gridRows * cardHeight + (gridRows - 1) * cardGap;
    gridOffsetX = (canvas.width - totalGridWidth) / 2;
    gridOffsetY = (canvas.height - totalGridHeight) / 2 + 30;
    
    // Create card objects
    cards = [];
    for (let row = 0; row < gridRows; row++) {
        for (let col = 0; col < gridCols; col++) {
            const idx = row * gridCols + col;
            cards.push({
                symbol: cardValues[idx],
                row: row,
                col: col,
                x: gridOffsetX + col * (cardWidth + cardGap),
                y: gridOffsetY + row * (cardHeight + cardGap),
                flipped: false,
                matched: false,
                flipProgress: 0, // 0 = face down, 1 = face up
                matchGlow: 0
            });
        }
    }
    
    firstCard = null;
    secondCard = null;
    checkTimer = 0;
    cursorRow = 0;
    cursorCol = 0;
    flipAnimations = [];
    matchAnimations = [];
}

function startGame() {
    score = 0;
    moves = 0;
    level = 1;
    timer = 0;
    timerAccumulator = 0;
    gameState = 'playing';
    lastTime = 0;
    initLevel();
}

function nextLevel() {
    level++;
    initLevel();
    gameState = 'playing';
}

function calculateScore() {
    // Score based on level, fewer moves = better, faster = better
    const config = getLevelConfig(level);
    const numPairs = (config.cols * config.rows) / 2;
    const perfectMoves = numPairs; // minimum possible moves
    const moveBonus = Math.max(0, (perfectMoves * 3 - moves) * 10);
    const timeBonus = Math.max(0, Math.floor((120 - timer) * 5));
    return moveBonus + timeBonus + level * 100;
}

function selectCard(row, col) {
    if (gameState !== 'playing') return;
    
    const idx = row * gridCols + col;
    if (idx >= cards.length) return;
    
    const card = cards[idx];
    if (card.flipped || card.matched) return;
    if (secondCard !== null) return; // still checking
    
    card.flipped = true;
    flipAnimations.push({ card: card, target: 1 });
    
    if (firstCard === null) {
        firstCard = card;
    } else {
        secondCard = card;
        moves++;
        
        if (firstCard.symbol === secondCard.symbol) {
            // Match!
            firstCard.matched = true;
            secondCard.matched = true;
            matchAnimations.push({ card: firstCard, timer: 30 });
            matchAnimations.push({ card: secondCard, timer: 30 });
            firstCard = null;
            secondCard = null;
            
            // Check if level complete
            if (cards.every(c => c.matched)) {
                score += calculateScore();
                if (level >= 4) {
                    gameState = 'gameover';
                } else {
                    gameState = 'levelcomplete';
                }
            }
        } else {
            // No match - start check timer
            gameState = 'checking';
            checkTimer = CHECK_DELAY;
        }
    }
}

function update(dt) {
    // Update flip animations
    for (let i = flipAnimations.length - 1; i >= 0; i--) {
        const anim = flipAnimations[i];
        const speed = 0.1 * dt;
        if (anim.target === 1) {
            anim.card.flipProgress = Math.min(1, anim.card.flipProgress + speed);
            if (anim.card.flipProgress >= 1) flipAnimations.splice(i, 1);
        } else {
            anim.card.flipProgress = Math.max(0, anim.card.flipProgress - speed);
            if (anim.card.flipProgress <= 0) flipAnimations.splice(i, 1);
        }
    }
    
    // Update match glow animations
    for (let i = matchAnimations.length - 1; i >= 0; i--) {
        matchAnimations[i].timer -= dt;
        matchAnimations[i].card.matchGlow = Math.max(0, matchAnimations[i].timer / 30);
        if (matchAnimations[i].timer <= 0) matchAnimations.splice(i, 1);
    }
    
    if (gameState === 'playing') {
        // Timer
        timerAccumulator += dt;
        if (timerAccumulator >= TARGET_FPS) {
            timer += timerAccumulator / TARGET_FPS;
            timerAccumulator = 0;
        }
    }
    
    if (gameState === 'checking') {
        checkTimer -= dt;
        if (checkTimer <= 0) {
            // Flip cards back
            firstCard.flipped = false;
            secondCard.flipped = false;
            flipAnimations.push({ card: firstCard, target: 0 });
            flipAnimations.push({ card: secondCard, target: 0 });
            firstCard = null;
            secondCard = null;
            gameState = 'playing';
        }
    }
    
    // Poll gamepad
    pollGamepad(dt);
}

// Drawing functions for symbols
function drawSymbol(symbol, x, y, size) {
    const color = SYMBOL_COLORS[symbol];
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    const cx = x + size / 2;
    const cy = y + size / 2;
    const r = size * 0.35;
    
    switch(symbol) {
        case 'ghost':
            drawGhost(cx, cy, r);
            break;
        case 'bat':
            drawBat(cx, cy, r);
            break;
        case 'pumpkin':
            drawPumpkin(cx, cy, r);
            break;
        case 'spider':
            drawSpider(cx, cy, r);
            break;
        case 'skull':
            drawSkull(cx, cy, r);
            break;
        case 'cat':
            drawCat(cx, cy, r);
            break;
        case 'moon':
            drawMoon(cx, cy, r);
            break;
        case 'potion':
            drawPotion(cx, cy, r);
            break;
        case 'eye':
            drawEye(cx, cy, r);
            break;
        case 'candle':
            drawCandle(cx, cy, r);
            break;
        case 'web':
            drawWeb(cx, cy, r);
            break;
        case 'hat':
            drawHat(cx, cy, r);
            break;
    }
}

function drawGhost(cx, cy, r) {
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.2, r * 0.7, Math.PI, 0);
    ctx.lineTo(cx + r * 0.7, cy + r * 0.6);
    // Wavy bottom
    for (let i = 0; i < 4; i++) {
        const wave = (i % 2 === 0) ? 0.15 : -0.15;
        ctx.lineTo(cx + r * 0.7 - (i + 1) * (r * 1.4 / 4), cy + r * (0.6 + wave));
    }
    ctx.closePath();
    ctx.fill();
    // Eyes
    ctx.fillStyle = '#0d0d1a';
    ctx.beginPath();
    ctx.arc(cx - r * 0.2, cy - r * 0.2, r * 0.12, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.2, cy - r * 0.2, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
}

function drawBat(cx, cy, r) {
    // Wings
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo(cx - r * 0.5, cy - r * 0.8, cx - r, cy - r * 0.3);
    ctx.quadraticCurveTo(cx - r * 0.7, cy - r * 0.1, cx - r * 0.5, cy + r * 0.2);
    ctx.quadraticCurveTo(cx - r * 0.3, cy, cx, cy);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo(cx + r * 0.5, cy - r * 0.8, cx + r, cy - r * 0.3);
    ctx.quadraticCurveTo(cx + r * 0.7, cy - r * 0.1, cx + r * 0.5, cy + r * 0.2);
    ctx.quadraticCurveTo(cx + r * 0.3, cy, cx, cy);
    ctx.fill();
    // Body
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.25, 0, Math.PI * 2);
    ctx.fill();
}

function drawPumpkin(cx, cy, r) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 0.7, r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Stem
    ctx.fillStyle = '#27ae60';
    ctx.fillRect(cx - r * 0.08, cy - r * 0.75, r * 0.16, r * 0.2);
    // Face
    ctx.fillStyle = '#0d0d1a';
    // Eyes (triangles)
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.35, cy - r * 0.15);
    ctx.lineTo(cx - r * 0.15, cy - r * 0.15);
    ctx.lineTo(cx - r * 0.25, cy - r * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + r * 0.15, cy - r * 0.15);
    ctx.lineTo(cx + r * 0.35, cy - r * 0.15);
    ctx.lineTo(cx + r * 0.25, cy - r * 0.35);
    ctx.closePath();
    ctx.fill();
    // Mouth
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.3, cy + r * 0.15);
    ctx.lineTo(cx - r * 0.15, cy + r * 0.3);
    ctx.lineTo(cx, cy + r * 0.15);
    ctx.lineTo(cx + r * 0.15, cy + r * 0.3);
    ctx.lineTo(cx + r * 0.3, cy + r * 0.15);
    ctx.stroke();
}

function drawSpider(cx, cy, r) {
    // Body
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
    // Legs
    for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 0.6 + Math.PI * 0.2;
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.25, cy + (i - 1.5) * r * 0.15);
        ctx.quadraticCurveTo(cx - r * 0.7, cy + (i - 1.5) * r * 0.3, cx - r * 0.9, cy + (i - 1.5) * r * 0.5);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + r * 0.25, cy + (i - 1.5) * r * 0.15);
        ctx.quadraticCurveTo(cx + r * 0.7, cy + (i - 1.5) * r * 0.3, cx + r * 0.9, cy + (i - 1.5) * r * 0.5);
        ctx.stroke();
    }
}

function drawSkull(cx, cy, r) {
    // Head
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.1, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    // Jaw
    ctx.fillRect(cx - r * 0.3, cy + r * 0.3, r * 0.6, r * 0.25);
    // Eyes
    ctx.fillStyle = '#0d0d1a';
    ctx.beginPath();
    ctx.arc(cx - r * 0.2, cy - r * 0.15, r * 0.15, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.2, cy - r * 0.15, r * 0.15, 0, Math.PI * 2);
    ctx.fill();
    // Nose
    ctx.beginPath();
    ctx.moveTo(cx, cy + r * 0.05);
    ctx.lineTo(cx - r * 0.08, cy + r * 0.2);
    ctx.lineTo(cx + r * 0.08, cy + r * 0.2);
    ctx.closePath();
    ctx.fill();
}

function drawCat(cx, cy, r) {
    // Head
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    // Ears
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.4, cy - r * 0.3);
    ctx.lineTo(cx - r * 0.25, cy - r * 0.7);
    ctx.lineTo(cx - r * 0.05, cy - r * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + r * 0.4, cy - r * 0.3);
    ctx.lineTo(cx + r * 0.25, cy - r * 0.7);
    ctx.lineTo(cx + r * 0.05, cy - r * 0.35);
    ctx.closePath();
    ctx.fill();
    // Eyes
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.15, cy - r * 0.05, r * 0.1, r * 0.12, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + r * 0.15, cy - r * 0.05, r * 0.1, r * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    // Pupils
    ctx.fillStyle = '#0d0d1a';
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.15, cy - r * 0.05, r * 0.04, r * 0.1, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + r * 0.15, cy - r * 0.05, r * 0.04, r * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
}

function drawMoon(cx, cy, r) {
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0d0d1a';
    ctx.beginPath();
    ctx.arc(cx + r * 0.25, cy - r * 0.1, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
}

function drawPotion(cx, cy, r) {
    // Bottle
    ctx.fillRect(cx - r * 0.12, cy - r * 0.6, r * 0.24, r * 0.3);
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.12, cy - r * 0.3);
    ctx.lineTo(cx - r * 0.4, cy + r * 0.1);
    ctx.arc(cx, cy + r * 0.3, r * 0.4, Math.PI * 0.85, Math.PI * 0.15, true);
    ctx.lineTo(cx + r * 0.12, cy - r * 0.3);
    ctx.closePath();
    ctx.fill();
    // Liquid shine
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.15, cy + r * 0.2, r * 0.08, r * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
}

function drawEye(cx, cy, r) {
    // Outer eye
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 0.7, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Iris
    ctx.fillStyle = '#0d0d1a';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.25, 0, Math.PI * 2);
    ctx.fill();
    // Pupil
    ctx.fillStyle = SYMBOL_COLORS['eye'];
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
}

function drawCandle(cx, cy, r) {
    // Candle body
    ctx.fillRect(cx - r * 0.15, cy - r * 0.2, r * 0.3, r * 0.7);
    // Flame
    ctx.fillStyle = '#f39c12';
    ctx.beginPath();
    ctx.ellipse(cx, cy - r * 0.4, r * 0.12, r * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.ellipse(cx, cy - r * 0.35, r * 0.06, r * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
}

function drawWeb(cx, cy, r) {
    // Radial lines
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle) * r * 0.8, cy + Math.sin(angle) * r * 0.8);
        ctx.stroke();
    }
    // Concentric rings
    for (let ring = 1; ring <= 3; ring++) {
        const ringR = (ring / 3) * r * 0.8;
        ctx.beginPath();
        for (let i = 0; i <= 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const x = cx + Math.cos(angle) * ringR;
            const y = cy + Math.sin(angle) * ringR;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
}

function drawHat(cx, cy, r) {
    // Brim
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.3, r * 0.7, r * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
    // Cone
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.4, cy + r * 0.3);
    ctx.lineTo(cx, cy - r * 0.7);
    ctx.lineTo(cx + r * 0.4, cy + r * 0.3);
    ctx.closePath();
    ctx.fill();
    // Buckle
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(cx - r * 0.12, cy + r * 0.1, r * 0.24, r * 0.15);
}

function drawCard(card) {
    const x = card.x;
    const y = card.y;
    const w = cardWidth;
    const h = cardHeight;
    
    // Flip animation - scale X based on progress
    const flipScale = Math.abs(Math.cos(card.flipProgress * Math.PI));
    const showFace = card.flipProgress > 0.5;
    
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.scale(flipScale || 0.01, 1);
    ctx.translate(-(x + w / 2), -(y + h / 2));
    
    // Card background
    if (card.matched) {
        ctx.fillStyle = '#1a3a2a';
        ctx.strokeStyle = '#2ecc71';
    } else if (showFace) {
        ctx.fillStyle = '#1a1a3e';
        ctx.strokeStyle = '#6c5ce7';
    } else {
        ctx.fillStyle = '#2d2d5e';
        ctx.strokeStyle = '#4a4a8a';
    }
    
    // Rounded rectangle
    const radius = 8;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.stroke();
    
    if (showFace && (card.flipped || card.matched)) {
        // Draw symbol
        const symbolSize = Math.min(w, h) * 0.7;
        const symbolX = x + (w - symbolSize) / 2;
        const symbolY = y + (h - symbolSize) / 2;
        drawSymbol(card.symbol, symbolX, symbolY, symbolSize);
    } else if (!showFace) {
        // Draw card back pattern (ghost silhouette)
        ctx.fillStyle = '#3d3d7e';
        ctx.globalAlpha = 0.5;
        ctx.font = `${Math.floor(w * 0.4)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', x + w / 2, y + h / 2);
        ctx.globalAlpha = 1;
    }
    
    // Match glow
    if (card.matchGlow > 0) {
        ctx.strokeStyle = `rgba(46, 204, 113, ${card.matchGlow})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.stroke();
    }
    
    ctx.restore();
}

function drawCursor() {
    if (gameState !== 'playing') return;
    
    const idx = cursorRow * gridCols + cursorCol;
    if (idx >= cards.length) return;
    
    const card = cards[idx];
    const x = card.x - 3;
    const y = card.y - 3;
    const w = cardWidth + 6;
    const h = cardHeight + 6;
    const radius = 10;
    
    // Pulsing highlight
    const pulse = 0.5 + Math.sin(Date.now() / 300) * 0.3;
    ctx.strokeStyle = `rgba(255, 255, 100, ${pulse})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.stroke();
}

function draw() {
    // Background
    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (gameState === 'start') {
        drawStartScreen();
        return;
    }
    
    if (gameState === 'gameover') {
        drawGameOverScreen();
        return;
    }
    
    if (gameState === 'levelcomplete') {
        drawLevelCompleteScreen();
        return;
    }
    
    // HUD
    ctx.fillStyle = '#a8e6cf';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Level: ${level}`, 15, 25);
    ctx.textAlign = 'center';
    ctx.fillText(`Züge: ${moves}`, canvas.width / 2, 25);
    ctx.textAlign = 'right';
    ctx.fillText(`Zeit: ${Math.floor(timer)}s`, canvas.width - 15, 25);
    
    // Score
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f1c40f';
    ctx.font = '14px sans-serif';
    ctx.fillText(`Score: ${score}`, canvas.width / 2, 48);
    
    // Draw cards
    for (const card of cards) {
        drawCard(card);
    }
    
    // Draw cursor
    drawCursor();
}

function drawStartScreen() {
    // Animated background ghosts
    const time = Date.now() / 1000;
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = '#a8e6cf';
    for (let i = 0; i < 5; i++) {
        const gx = canvas.width * 0.2 + i * canvas.width * 0.15 + Math.sin(time + i) * 20;
        const gy = canvas.height * 0.3 + Math.cos(time * 0.7 + i) * 30;
        drawGhost(gx, gy, 30);
    }
    ctx.globalAlpha = 1;
    
    // Title
    ctx.fillStyle = '#a8e6cf';
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('👻 Geister Memory 👻', canvas.width / 2, canvas.height / 2 - 80);
    
    // Instructions
    ctx.fillStyle = '#ecf0f1';
    ctx.font = '20px sans-serif';
    ctx.fillText('Finde alle Geister-Paare!', canvas.width / 2, canvas.height / 2 - 20);
    
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#bdc3c7';
    ctx.fillText('Pfeiltasten / WASD = Navigieren', canvas.width / 2, canvas.height / 2 + 30);
    ctx.fillText('Leertaste / Enter = Karte aufdecken', canvas.width / 2, canvas.height / 2 + 55);
    ctx.fillText('Gamepad: D-Pad + A-Taste', canvas.width / 2, canvas.height / 2 + 80);
    
    // Start prompt
    const blink = Math.sin(Date.now() / 500) > 0;
    if (blink) {
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText('Leertaste zum Starten', canvas.width / 2, canvas.height / 2 + 140);
    }
}

function drawGameOverScreen() {
    ctx.fillStyle = '#a8e6cf';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🎉 Geschafft! 🎉', canvas.width / 2, canvas.height / 2 - 80);
    
    ctx.fillStyle = '#ecf0f1';
    ctx.font = '22px sans-serif';
    ctx.fillText(`Endpunktzahl: ${score}`, canvas.width / 2, canvas.height / 2 - 20);
    ctx.font = '18px sans-serif';
    ctx.fillText(`Züge: ${moves}  |  Zeit: ${Math.floor(timer)}s`, canvas.width / 2, canvas.height / 2 + 20);
    
    ctx.fillStyle = '#bdc3c7';
    ctx.font = '16px sans-serif';
    ctx.fillText(`Level ${level} erreicht`, canvas.width / 2, canvas.height / 2 + 60);
    
    const blink = Math.sin(Date.now() / 500) > 0;
    if (blink) {
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText('Leertaste für neues Spiel', canvas.width / 2, canvas.height / 2 + 120);
    }
}

function drawLevelCompleteScreen() {
    ctx.fillStyle = '#a8e6cf';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Level ${level} geschafft!`, canvas.width / 2, canvas.height / 2 - 40);
    
    ctx.fillStyle = '#ecf0f1';
    ctx.font = '20px sans-serif';
    ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2 + 10);
    
    const blink = Math.sin(Date.now() / 500) > 0;
    if (blink) {
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText('Leertaste für nächstes Level', canvas.width / 2, canvas.height / 2 + 70);
    }
}

// Input handling
document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') return; // Don't handle escape
    
    if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (gameState === 'start') {
            startGame();
        } else if (gameState === 'gameover') {
            startGame();
        } else if (gameState === 'levelcomplete') {
            nextLevel();
        } else if (gameState === 'playing') {
            selectCard(cursorRow, cursorCol);
        }
        return;
    }
    
    if (gameState !== 'playing') return;
    
    let moved = false;
    if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        cursorRow = Math.max(0, cursorRow - 1);
        moved = true;
    } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        cursorRow = Math.min(gridRows - 1, cursorRow + 1);
        moved = true;
    } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        cursorCol = Math.max(0, cursorCol - 1);
        moved = true;
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        cursorCol = Math.min(gridCols - 1, cursorCol + 1);
        moved = true;
    }
    
    if (moved) e.preventDefault();
});

// Mouse/Touch support
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    
    if (gameState === 'start') {
        startGame();
        return;
    }
    if (gameState === 'gameover') {
        startGame();
        return;
    }
    if (gameState === 'levelcomplete') {
        nextLevel();
        return;
    }
    
    if (gameState === 'playing') {
        // Find clicked card
        for (const card of cards) {
            if (mx >= card.x && mx <= card.x + cardWidth &&
                my >= card.y && my <= card.y + cardHeight) {
                cursorRow = card.row;
                cursorCol = card.col;
                selectCard(card.row, card.col);
                break;
            }
        }
    }
});

// Gamepad support
const DEADZONE = 0.15;
let gamepadCooldown = 0;

function pollGamepad(dt) {
    gamepadCooldown -= dt;
    
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (const pad of gamepads) {
        if (pad && pad.connected) {
            gp = pad;
            break;
        }
    }
    if (!gp) return;
    
    // A button (index 0) - select
    const aPressed = gp.buttons[0] && gp.buttons[0].pressed;
    const aPrev = gamepadPrevButtons[0] || false;
    
    if (aPressed && !aPrev) {
        if (gameState === 'start') startGame();
        else if (gameState === 'gameover') startGame();
        else if (gameState === 'levelcomplete') nextLevel();
        else if (gameState === 'playing') selectCard(cursorRow, cursorCol);
    }
    gamepadPrevButtons[0] = aPressed;
    
    // D-pad or left stick for navigation
    if (gamepadCooldown <= 0 && gameState === 'playing') {
        let dx = 0, dy = 0;
        
        // D-pad
        if (gp.buttons[12] && gp.buttons[12].pressed) dy = -1; // Up
        if (gp.buttons[13] && gp.buttons[13].pressed) dy = 1;  // Down
        if (gp.buttons[14] && gp.buttons[14].pressed) dx = -1; // Left
        if (gp.buttons[15] && gp.buttons[15].pressed) dx = 1;  // Right
        
        // Left stick
        if (dx === 0 && dy === 0) {
            const lx = gp.axes[0] || 0;
            const ly = gp.axes[1] || 0;
            if (Math.abs(lx) > DEADZONE) dx = lx > 0 ? 1 : -1;
            if (Math.abs(ly) > DEADZONE) dy = ly > 0 ? 1 : -1;
        }
        
        if (dx !== 0 || dy !== 0) {
            cursorCol = Math.max(0, Math.min(gridCols - 1, cursorCol + dx));
            cursorRow = Math.max(0, Math.min(gridRows - 1, cursorRow + dy));
            gamepadCooldown = 12; // frames cooldown between moves
        }
    }
}

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

// Start
requestAnimationFrame(gameLoop);
