// ============================================
// WALDSCHRECKEN - Horror-Rätselspiel im Wald
// ============================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const TARGET_FPS = 60;
let lastTime = 0;

// Game States
const STATE = {
    MENU: 'menu',
    PLAYING: 'playing',
    JUMPSCARE: 'jumpscare',
    PUZZLE: 'puzzle',
    GAMEOVER: 'gameover',
    WIN: 'win',
    TRANSITION: 'transition'
};

let gameState = STATE.MENU;
let score = 0;
let level = 1;
let maxLevel = 7;
let puzzlesSolved = 0;

// Timing
let transitionTimer = 0;
let jumpscareTimer = 0;
let jumpscareChance = 0.008; // Chance pro Frame für Jump Scare
let jumpscareType = 0;
let shakeTimer = 0;
let shakeIntensity = 0;

// Forest background
let trees = [];
let particles = [];
let fog = [];
let eyePairs = [];

// Puzzle system
let currentPuzzle = null;
let puzzleInput = '';
let puzzleCursorBlink = 0;
let puzzleHint = '';
let puzzleError = '';
let puzzleErrorTimer = 0;

// Gamepad
let gamepadIndex = null;
let gpPrevButtons = [];

// Keys
let keys = {};

// Ambient flicker
let ambientFlicker = 0;
let flickerTarget = 0;

// ============================================
// INITIALIZATION
// ============================================

function initForest() {
    trees = [];
    for (let i = 0; i < 30; i++) {
        trees.push({
            x: Math.random() * canvas.width,
            y: 150 + Math.random() * (canvas.height - 200),
            height: 100 + Math.random() * 200,
            width: 20 + Math.random() * 40,
            sway: Math.random() * Math.PI * 2,
            swaySpeed: 0.3 + Math.random() * 0.5
        });
    }
    trees.sort((a, b) => a.y - b.y);

    particles = [];
    for (let i = 0; i < 25; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: 1 + Math.random() * 3,
            speedX: (Math.random() - 0.5) * 0.3,
            speedY: (Math.random() - 0.5) * 0.2,
            alpha: Math.random() * 0.6,
            pulse: Math.random() * Math.PI * 2
        });
    }

    fog = [];
    for (let i = 0; i < 8; i++) {
        fog.push({
            x: Math.random() * canvas.width * 2 - canvas.width * 0.5,
            y: canvas.height * 0.5 + Math.random() * canvas.height * 0.5,
            width: 200 + Math.random() * 300,
            height: 40 + Math.random() * 60,
            speed: 0.2 + Math.random() * 0.4,
            alpha: 0.03 + Math.random() * 0.06
        });
    }

    eyePairs = [];
}

function spawnEyes() {
    if (eyePairs.length < 3 && Math.random() < 0.01) {
        eyePairs.push({
            x: Math.random() * canvas.width,
            y: 100 + Math.random() * 300,
            timer: 60 + Math.random() * 120,
            alpha: 0,
            size: 2 + Math.random() * 3
        });
    }
}

// ============================================
// PUZZLE GENERATION
// ============================================

function generatePuzzle(lvl) {
    const types = ['sequence', 'math', 'word', 'memory', 'symbol'];
    const type = types[Math.floor(Math.random() * Math.min(types.length, 2 + lvl))];

    switch (type) {
        case 'sequence':
            return generateSequencePuzzle(lvl);
        case 'math':
            return generateMathPuzzle(lvl);
        case 'word':
            return generateWordPuzzle(lvl);
        case 'memory':
            return generateMemoryPuzzle(lvl);
        case 'symbol':
            return generateSymbolPuzzle(lvl);
        default:
            return generateSequencePuzzle(lvl);
    }
}

function generateSequencePuzzle(lvl) {
    const start = Math.floor(Math.random() * 10);
    const step = Math.floor(Math.random() * (2 + lvl)) + 1;
    const length = 4 + Math.min(lvl, 3);
    const sequence = [];
    for (let i = 0; i < length; i++) {
        sequence.push(start + step * i);
    }
    const answer = sequence[sequence.length - 1];
    sequence[sequence.length - 1] = '?';

    return {
        type: 'sequence',
        question: 'Welche Zahl fehlt in der Reihe?',
        display: sequence.join(', '),
        answer: answer.toString(),
        hint: 'Finde das Muster zwischen den Zahlen...'
    };
}

function generateMathPuzzle(lvl) {
    const ops = ['+', '-', '*'];
    const op = ops[Math.floor(Math.random() * Math.min(ops.length, 1 + lvl))];
    let a, b, answer;

    switch (op) {
        case '+':
            a = Math.floor(Math.random() * (10 * lvl)) + 1;
            b = Math.floor(Math.random() * (10 * lvl)) + 1;
            answer = a + b;
            break;
        case '-':
            a = Math.floor(Math.random() * (10 * lvl)) + 5;
            b = Math.floor(Math.random() * a);
            answer = a - b;
            break;
        case '*':
            a = Math.floor(Math.random() * (5 + lvl)) + 2;
            b = Math.floor(Math.random() * (5 + lvl)) + 2;
            answer = a * b;
            break;
    }

    const symbols = { '+': '+', '-': '-', '*': '×' };
    return {
        type: 'math',
        question: 'Löse die Gleichung:',
        display: `${a} ${symbols[op]} ${b} = ?`,
        answer: answer.toString(),
        hint: 'Rechne sorgfältig...'
    };
}

function generateWordPuzzle(lvl) {
    const words = [
        { scrambled: 'LDWA', answer: 'WALD', hint: 'Dort stehst du gerade...' },
        { scrambled: 'THCNA', answer: 'NACHT', hint: 'Wenn es dunkel ist...' },
        { scrambled: 'TGSNA', answer: 'ANGST', hint: 'Ein Gefühl im Dunkeln...' },
        { scrambled: 'TTAHCNSE', answer: 'SCHATTEN', hint: 'Folgt dir überall...' },
        { scrambled: 'SGREITU', answer: 'GEISTER', hint: 'Untote Wesen...' },
        { scrambled: 'BLEEN', answer: 'NEBEL', hint: 'Man sieht nichts darin...' },
        { scrambled: 'GÄERB', answer: 'BÄERG', hint: 'Nein... versuch nochmal' },
        { scrambled: 'NMDO', answer: 'MOND', hint: 'Leuchtet in der Nacht...' },
        { scrambled: 'RGNEAU', answer: 'GRAUEN', hint: 'Synonym für Horror...' },
        { scrambled: 'ETSILL', answer: 'STILLE', hint: 'Kein Geräusch...' }
    ];

    const available = words.slice(0, Math.min(words.length, 4 + lvl));
    const word = available[Math.floor(Math.random() * available.length)];

    return {
        type: 'word',
        question: 'Ordne die Buchstaben:',
        display: word.scrambled,
        answer: word.answer,
        hint: word.hint
    };
}

function generateMemoryPuzzle(lvl) {
    const length = 3 + Math.min(lvl, 4);
    const digits = [];
    for (let i = 0; i < length; i++) {
        digits.push(Math.floor(Math.random() * 10));
    }

    return {
        type: 'memory',
        question: 'Merke dir diese Zahlen! (verschwinden gleich)',
        display: digits.join(' '),
        answer: digits.join(''),
        hint: 'Gib die Zahlen ohne Leerzeichen ein',
        showTimer: 3 * TARGET_FPS,
        hideAfter: true
    };
}

function generateSymbolPuzzle(lvl) {
    const symbolSets = [
        { symbols: ['◆', '◆', '○', '◆', '○', '○', '?'], answer: '◆', hint: 'Muster: 2,1,1,2,1,1,?' },
        { symbols: ['▲', '▼', '▲', '▼', '▲', '?'], answer: '▼', hint: 'Abwechselnd...' },
        { symbols: ['●', '●', '○', '●', '●', '○', '●', '●', '?'], answer: '○', hint: 'Jedes dritte...' }
    ];

    const puzzle = symbolSets[Math.floor(Math.random() * symbolSets.length)];
    return {
        type: 'symbol',
        question: 'Welches Symbol kommt als nächstes?',
        display: puzzle.symbols.join(' '),
        answer: puzzle.answer,
        hint: puzzle.hint,
        isSymbol: true,
        options: ['◆', '○', '▲', '▼', '●'],
        selectedOption: 0
    };
}

// ============================================
// JUMP SCARE SYSTEM
// ============================================

const scareImages = [
    // Type 0: Gruselige Augen
    function(progress) {
        ctx.save();
        const alpha = progress < 0.1 ? progress * 10 : progress > 0.8 ? (1 - progress) * 5 : 1;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#00ff00';
        const size = 60 + progress * 40;
        const eyeY = canvas.height / 2 - 20;
        // Left eye
        ctx.beginPath();
        ctx.ellipse(canvas.width / 2 - 80, eyeY, size, size * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        // Right eye
        ctx.beginPath();
        ctx.ellipse(canvas.width / 2 + 80, eyeY, size, size * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        // Pupils
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(canvas.width / 2 - 80, eyeY, size * 0.4, 0, Math.PI * 2);
        ctx.arc(canvas.width / 2 + 80, eyeY, size * 0.4, 0, Math.PI * 2);
        ctx.fill();
        // Creepy mouth
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2 + 80, 100, 0, Math.PI);
        ctx.stroke();
        // Teeth
        for (let i = -80; i <= 80; i += 20) {
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(canvas.width / 2 + i - 5, canvas.height / 2 + 80, 10, 25);
        }
        ctx.restore();
    },
    // Type 1: Schattengestalt
    function(progress) {
        ctx.save();
        const alpha = progress < 0.1 ? progress * 10 : progress > 0.7 ? (1 - progress) * 3.3 : 1;
        ctx.globalAlpha = alpha;
        // Dark figure
        ctx.fillStyle = '#001a00';
        const figX = canvas.width / 2;
        const figY = canvas.height / 2;
        ctx.beginPath();
        ctx.ellipse(figX, figY - 100, 40, 50, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(figX - 30, figY - 60, 60, 200);
        // Glowing eyes
        ctx.fillStyle = '#00ff44';
        ctx.shadowColor = '#00ff44';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(figX - 15, figY - 110, 8, 0, Math.PI * 2);
        ctx.arc(figX + 15, figY - 110, 8, 0, Math.PI * 2);
        ctx.fill();
        // Reaching hands
        ctx.fillStyle = '#001a00';
        ctx.shadowBlur = 0;
        const handOffset = Math.sin(progress * 20) * 10;
        ctx.fillRect(figX - 90 + handOffset, figY - 20, 60, 15);
        ctx.fillRect(figX + 30 - handOffset, figY - 20, 60, 15);
        // Claws
        for (let i = 0; i < 4; i++) {
            ctx.fillRect(figX - 95 + handOffset + i * 15, figY - 35, 4, 20);
            ctx.fillRect(figX + 35 - handOffset + i * 15, figY - 35, 4, 20);
        }
        ctx.restore();
    },
    // Type 2: Flackerndes Gesicht
    function(progress) {
        ctx.save();
        const flicker = Math.random() > 0.3 ? 1 : 0;
        if (!flicker) { ctx.restore(); return; }
        const alpha = progress < 0.15 ? progress * 6.6 : progress > 0.75 ? (1 - progress) * 4 : 1;
        ctx.globalAlpha = alpha;
        const cx = canvas.width / 2 + (Math.random() - 0.5) * 30;
        const cy = canvas.height / 2 + (Math.random() - 0.5) * 30;
        // Face outline
        ctx.strokeStyle = '#00dd00';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 120, 150, 0, 0, Math.PI * 2);
        ctx.stroke();
        // Hollow eyes
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(cx - 40, cy - 30, 25, 35, 0, 0, Math.PI * 2);
        ctx.ellipse(cx + 40, cy - 30, 25, 35, 0, 0, Math.PI * 2);
        ctx.fill();
        // Creepy smile
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy + 30, 60, 0.1, Math.PI - 0.1);
        ctx.stroke();
        // Static noise overlay
        ctx.fillStyle = '#00ff00';
        for (let i = 0; i < 50; i++) {
            const nx = cx - 120 + Math.random() * 240;
            const ny = cy - 150 + Math.random() * 300;
            ctx.globalAlpha = Math.random() * 0.3;
            ctx.fillRect(nx, ny, 2, 2);
        }
        ctx.restore();
    }
];

// ============================================
// UPDATE
// ============================================

function update(dt) {
    // Ambient
    ambientFlicker += dt * 0.05;
    if (Math.random() < 0.02) flickerTarget = Math.random() * 0.3;

    // Particles
    particles.forEach(p => {
        p.x += p.speedX * dt;
        p.y += p.speedY * dt;
        p.pulse += 0.03 * dt;
        p.alpha = 0.2 + Math.sin(p.pulse) * 0.3;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
    });

    // Fog
    fog.forEach(f => {
        f.x += f.speed * dt;
        if (f.x > canvas.width + f.width) f.x = -f.width;
    });

    // Tree sway
    trees.forEach(t => {
        t.sway += t.swaySpeed * 0.02 * dt;
    });

    // Shake
    if (shakeTimer > 0) {
        shakeTimer -= dt;
        shakeIntensity *= Math.pow(0.95, dt);
    }

    // Eyes in background
    spawnEyes();
    eyePairs.forEach(e => {
        e.timer -= dt;
        if (e.timer > 40) e.alpha = Math.min(e.alpha + 0.02 * dt, 0.8);
        else e.alpha = Math.max(e.alpha - 0.03 * dt, 0);
    });
    eyePairs = eyePairs.filter(e => e.timer > 0);

    // State-specific updates
    switch (gameState) {
        case STATE.PLAYING:
            updatePlaying(dt);
            break;
        case STATE.JUMPSCARE:
            updateJumpscare(dt);
            break;
        case STATE.PUZZLE:
            updatePuzzle(dt);
            break;
        case STATE.TRANSITION:
            updateTransition(dt);
            break;
    }
}

function updatePlaying(dt) {
    transitionTimer += dt;

    // Random jump scare chance (increases with level)
    const scareRate = jumpscareChance * (1 + level * 0.3);
    if (transitionTimer > 60 && Math.random() < scareRate * dt) {
        triggerJumpscare();
        return;
    }

    // After a delay, show next puzzle
    if (transitionTimer > 90 + Math.random() * 60) {
        startPuzzle();
    }
}

function updateJumpscare(dt) {
    jumpscareTimer -= dt;
    shakeTimer = 5;
    shakeIntensity = 8;
    if (jumpscareTimer <= 0) {
        gameState = STATE.PLAYING;
        transitionTimer = 0;
    }
}

function updatePuzzle(dt) {
    puzzleCursorBlink += dt * 0.08;

    if (puzzleErrorTimer > 0) {
        puzzleErrorTimer -= dt;
    }

    // Memory puzzle timer
    if (currentPuzzle && currentPuzzle.showTimer > 0) {
        currentPuzzle.showTimer -= dt;
        if (currentPuzzle.showTimer <= 0 && currentPuzzle.hideAfter) {
            currentPuzzle.displayHidden = true;
        }
    }
}

function updateTransition(dt) {
    transitionTimer -= dt;
    if (transitionTimer <= 0) {
        gameState = STATE.PLAYING;
        transitionTimer = 0;
    }
}

// ============================================
// DRAW
// ============================================

function draw() {
    ctx.save();

    // Screen shake
    if (shakeTimer > 0) {
        const sx = (Math.random() - 0.5) * shakeIntensity;
        const sy = (Math.random() - 0.5) * shakeIntensity;
        ctx.translate(sx, sy);
    }

    // Background
    drawForest();

    // State-specific drawing
    switch (gameState) {
        case STATE.MENU:
            drawMenu();
            break;
        case STATE.PLAYING:
            drawPlaying();
            break;
        case STATE.JUMPSCARE:
            drawJumpscare();
            break;
        case STATE.PUZZLE:
            drawPuzzle();
            break;
        case STATE.TRANSITION:
            drawTransition();
            break;
        case STATE.GAMEOVER:
            drawGameOver();
            break;
        case STATE.WIN:
            drawWin();
            break;
    }

    ctx.restore();
}

function drawForest() {
    // Dark green gradient background
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#0a1a0a');
    grad.addColorStop(0.5, '#0d1f0d');
    grad.addColorStop(1, '#061206');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Ambient flicker
    const flickerAlpha = 0.02 + Math.sin(ambientFlicker) * 0.01;
    ctx.fillStyle = `rgba(0, 255, 0, ${flickerAlpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Trees
    trees.forEach(t => {
        const sway = Math.sin(t.sway) * 3;
        ctx.fillStyle = '#0a150a';
        // Trunk
        ctx.fillRect(t.x + sway - t.width * 0.15, t.y - t.height * 0.3, t.width * 0.3, t.height * 0.6);
        // Canopy
        ctx.fillStyle = '#0d200d';
        ctx.beginPath();
        ctx.moveTo(t.x + sway, t.y - t.height);
        ctx.lineTo(t.x + sway - t.width, t.y - t.height * 0.2);
        ctx.lineTo(t.x + sway + t.width, t.y - t.height * 0.2);
        ctx.closePath();
        ctx.fill();
    });

    // Eye pairs in dark
    eyePairs.forEach(e => {
        ctx.fillStyle = `rgba(0, 255, 50, ${e.alpha})`;
        ctx.shadowColor = '#00ff32';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(e.x - 8, e.y, e.size, 0, Math.PI * 2);
        ctx.arc(e.x + 8, e.y, e.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    });

    // Fog
    fog.forEach(f => {
        ctx.fillStyle = `rgba(0, 80, 0, ${f.alpha})`;
        ctx.beginPath();
        ctx.ellipse(f.x, f.y, f.width, f.height, 0, 0, Math.PI * 2);
        ctx.fill();
    });

    // Glowing particles (fireflies)
    particles.forEach(p => {
        ctx.fillStyle = `rgba(100, 255, 100, ${p.alpha})`;
        ctx.shadowColor = '#66ff66';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    });

    // Vignette
    const vignette = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, canvas.width * 0.2,
        canvas.width / 2, canvas.height / 2, canvas.width * 0.7
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawMenu() {
    // Dark overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Title
    ctx.textAlign = 'center';
    ctx.shadowColor = '#00ff00';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#00ff00';
    ctx.font = 'bold 48px "Courier New", monospace';
    ctx.fillText('WALDSCHRECKEN', canvas.width / 2, canvas.height / 2 - 100);
    ctx.shadowBlur = 0;

    // Subtitle
    ctx.fillStyle = '#00aa00';
    ctx.font = '18px "Courier New", monospace';
    ctx.fillText('Ein Horror-Rätselspiel', canvas.width / 2, canvas.height / 2 - 60);

    // Instructions
    ctx.fillStyle = '#008800';
    ctx.font = '16px "Courier New", monospace';
    ctx.fillText('Löse die Rätsel um dem Wald zu entkommen...', canvas.width / 2, canvas.height / 2 + 10);
    ctx.fillText('Aber pass auf - du bist nicht allein.', canvas.width / 2, canvas.height / 2 + 40);

    // Controls
    ctx.fillStyle = '#006600';
    ctx.font = '14px "Courier New", monospace';
    ctx.fillText('Steuerung:', canvas.width / 2, canvas.height / 2 + 90);
    ctx.fillText('Tastatur: Antwort eintippen + ENTER', canvas.width / 2, canvas.height / 2 + 115);
    ctx.fillText('Gamepad: Steuerkreuz/Stick + A-Taste', canvas.width / 2, canvas.height / 2 + 138);

    // Start prompt
    const blink = Math.sin(Date.now() * 0.005) > 0;
    if (blink) {
        ctx.fillStyle = '#00ff00';
        ctx.font = 'bold 20px "Courier New", monospace';
        ctx.fillText('[ LEERTASTE / A-Taste zum Starten ]', canvas.width / 2, canvas.height / 2 + 190);
    }
}

function drawPlaying() {
    // Atmospheric text
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0, 180, 0, 0.4)';
    ctx.font = '14px "Courier New", monospace';
    const messages = [
        'Der Wald beobachtet dich...',
        'Du hörst Schritte hinter dir...',
        'Etwas bewegt sich im Schatten...',
        'Die Bäume flüstern...',
        'Du spürst kalten Atem...',
        'Die Dunkelheit kommt näher...'
    ];
    const msg = messages[Math.floor(Date.now() / 3000) % messages.length];
    ctx.fillText(msg, canvas.width / 2, canvas.height - 40);

    // HUD
    drawHUD();
}

function drawJumpscare() {
    // Flash
    const progress = 1 - (jumpscareTimer / (45));
    ctx.fillStyle = `rgba(0, 20, 0, 0.8)`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw scare
    scareImages[jumpscareType](progress);

    // Scanlines effect
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    for (let y = 0; y < canvas.height; y += 3) {
        ctx.fillRect(0, y, canvas.width, 1);
    }
}

function drawPuzzle() {
    // Darken background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Puzzle box
    const boxX = canvas.width / 2 - 250;
    const boxY = canvas.height / 2 - 150;
    const boxW = 500;
    const boxH = 300;

    ctx.strokeStyle = '#00aa00';
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    ctx.fillStyle = 'rgba(0, 15, 0, 0.9)';
    ctx.fillRect(boxX, boxY, boxW, boxH);

    // Level indicator
    ctx.textAlign = 'center';
    ctx.fillStyle = '#005500';
    ctx.font = '12px "Courier New", monospace';
    ctx.fillText(`Rätsel ${level} von ${maxLevel}`, canvas.width / 2, boxY + 25);

    // Question
    ctx.fillStyle = '#00cc00';
    ctx.font = '18px "Courier New", monospace';
    ctx.fillText(currentPuzzle.question, canvas.width / 2, boxY + 60);

    // Display (sequence, equation, etc.)
    ctx.fillStyle = '#00ff00';
    ctx.font = 'bold 28px "Courier New", monospace';
    if (currentPuzzle.displayHidden) {
        ctx.fillText('? ? ? ? ?', canvas.width / 2, boxY + 120);
    } else {
        ctx.fillText(currentPuzzle.display, canvas.width / 2, boxY + 120);
    }

    // Memory timer bar
    if (currentPuzzle.showTimer > 0 && !currentPuzzle.displayHidden) {
        const barWidth = 200;
        const barProgress = currentPuzzle.showTimer / (3 * TARGET_FPS);
        ctx.fillStyle = '#003300';
        ctx.fillRect(canvas.width / 2 - barWidth / 2, boxY + 140, barWidth, 8);
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(canvas.width / 2 - barWidth / 2, boxY + 140, barWidth * barProgress, 8);
    }

    // Symbol puzzle options
    if (currentPuzzle.isSymbol) {
        ctx.font = '24px "Courier New", monospace';
        const options = currentPuzzle.options;
        const startX = canvas.width / 2 - (options.length * 40) / 2;
        options.forEach((opt, i) => {
            if (i === currentPuzzle.selectedOption) {
                ctx.fillStyle = '#00ff00';
                ctx.fillRect(startX + i * 40 - 5, boxY + 165, 35, 35);
                ctx.fillStyle = '#000';
            } else {
                ctx.fillStyle = '#00aa00';
            }
            ctx.fillText(opt, startX + i * 40 + 12, boxY + 190);
        });
        ctx.fillStyle = '#006600';
        ctx.font = '12px "Courier New", monospace';
        ctx.fillText('← → zum Wählen, ENTER zum Bestätigen', canvas.width / 2, boxY + 220);
    } else {
        // Input field
        const inputY = boxY + 180;
        ctx.strokeStyle = '#008800';
        ctx.strokeRect(canvas.width / 2 - 100, inputY, 200, 35);
        ctx.fillStyle = '#001a00';
        ctx.fillRect(canvas.width / 2 - 99, inputY + 1, 198, 33);

        // Input text
        ctx.fillStyle = '#00ff00';
        ctx.font = '20px "Courier New", monospace';
        const cursor = Math.sin(puzzleCursorBlink) > 0 ? '|' : '';
        ctx.fillText(puzzleInput + cursor, canvas.width / 2, inputY + 23);
    }

    // Hint
    if (puzzleHint) {
        ctx.fillStyle = '#006600';
        ctx.font = '13px "Courier New", monospace';
        ctx.fillText(puzzleHint, canvas.width / 2, boxY + 250);
    }

    // Error message
    if (puzzleErrorTimer > 0) {
        ctx.fillStyle = `rgba(255, 50, 50, ${puzzleErrorTimer / 60})`;
        ctx.font = 'bold 16px "Courier New", monospace';
        ctx.fillText(puzzleError, canvas.width / 2, boxY + 280);
    }

    // HUD
    drawHUD();
}

function drawTransition() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#00ff00';
    ctx.shadowColor = '#00ff00';
    ctx.shadowBlur = 15;
    ctx.font = 'bold 28px "Courier New", monospace';
    ctx.fillText('Richtig!', canvas.width / 2, canvas.height / 2 - 20);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#00aa00';
    ctx.font = '16px "Courier New", monospace';
    ctx.fillText(`Rätsel ${level - 1} gelöst...`, canvas.width / 2, canvas.height / 2 + 20);
    ctx.fillText('Geh tiefer in den Wald...', canvas.width / 2, canvas.height / 2 + 50);
}

function drawGameOver() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff0000';
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 15;
    ctx.font = 'bold 42px "Courier New", monospace';
    ctx.fillText('DER WALD HAT DICH', canvas.width / 2, canvas.height / 2 - 60);
    ctx.fillText('VERSCHLUNGEN', canvas.width / 2, canvas.height / 2 - 10);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#00aa00';
    ctx.font = '18px "Courier New", monospace';
    ctx.fillText(`Rätsel gelöst: ${puzzlesSolved}`, canvas.width / 2, canvas.height / 2 + 50);

    const blink = Math.sin(Date.now() * 0.004) > 0;
    if (blink) {
        ctx.fillStyle = '#008800';
        ctx.font = '16px "Courier New", monospace';
        ctx.fillText('[ LEERTASTE / A-Taste für Neustart ]', canvas.width / 2, canvas.height / 2 + 110);
    }
}

function drawWin() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#00ff00';
    ctx.shadowColor = '#00ff00';
    ctx.shadowBlur = 25;
    ctx.font = 'bold 36px "Courier New", monospace';
    ctx.fillText('DU BIST ENTKOMMEN!', canvas.width / 2, canvas.height / 2 - 60);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#00cc00';
    ctx.font = '18px "Courier New", monospace';
    ctx.fillText('Der Wald lässt dich gehen... dieses Mal.', canvas.width / 2, canvas.height / 2);
    ctx.fillText(`Alle ${maxLevel} Rätsel gelöst!`, canvas.width / 2, canvas.height / 2 + 35);

    const blink = Math.sin(Date.now() * 0.004) > 0;
    if (blink) {
        ctx.fillStyle = '#008800';
        ctx.font = '16px "Courier New", monospace';
        ctx.fillText('[ LEERTASTE / A-Taste für Neustart ]', canvas.width / 2, canvas.height / 2 + 100);
    }
}

function drawHUD() {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#005500';
    ctx.font = '14px "Courier New", monospace';
    ctx.fillText(`Level: ${level}/${maxLevel}`, 15, 25);
    ctx.fillText(`Gelöst: ${puzzlesSolved}`, 15, 45);
}

// ============================================
// GAME LOGIC
// ============================================

function startGame() {
    gameState = STATE.PLAYING;
    score = 0;
    level = 1;
    puzzlesSolved = 0;
    transitionTimer = 0;
    jumpscareTimer = 0;
    puzzleInput = '';
    currentPuzzle = null;
    lastTime = 0;
    initForest();
}

function startPuzzle() {
    currentPuzzle = generatePuzzle(level);
    puzzleInput = '';
    puzzleHint = '';
    puzzleError = '';
    puzzleErrorTimer = 0;
    puzzleCursorBlink = 0;
    gameState = STATE.PUZZLE;
}

function triggerJumpscare() {
    jumpscareType = Math.floor(Math.random() * scareImages.length);
    jumpscareTimer = 45; // ~0.75 seconds
    shakeTimer = 50;
    shakeIntensity = 15;
    gameState = STATE.JUMPSCARE;
}

function submitAnswer() {
    if (!currentPuzzle) return;

    let answer;
    if (currentPuzzle.isSymbol) {
        answer = currentPuzzle.options[currentPuzzle.selectedOption];
    } else {
        answer = puzzleInput.trim().toUpperCase();
    }

    if (answer === currentPuzzle.answer.toUpperCase()) {
        // Correct!
        puzzlesSolved++;
        level++;
        if (level > maxLevel) {
            gameState = STATE.WIN;
        } else {
            gameState = STATE.TRANSITION;
            transitionTimer = 90;
        }
    } else {
        // Wrong
        puzzleError = 'Falsch! Versuch es nochmal...';
        puzzleErrorTimer = 90;
        shakeTimer = 10;
        shakeIntensity = 5;

        // Show hint after wrong answer
        if (currentPuzzle.hint) {
            puzzleHint = currentPuzzle.hint;
        }

        // Random chance of jump scare on wrong answer
        if (Math.random() < 0.3 + level * 0.05) {
            setTimeout(() => {
                if (gameState === STATE.PUZZLE) {
                    triggerJumpscare();
                }
            }, 500);
        }
    }
}

// ============================================
// INPUT HANDLING
// ============================================

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') return; // Reserved for launcher

    keys[e.code] = true;

    switch (gameState) {
        case STATE.MENU:
            if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault();
                startGame();
            }
            break;

        case STATE.GAMEOVER:
        case STATE.WIN:
            if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault();
                startGame();
            }
            break;

        case STATE.PUZZLE:
            e.preventDefault();
            if (currentPuzzle && currentPuzzle.isSymbol) {
                if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
                    currentPuzzle.selectedOption = Math.max(0, currentPuzzle.selectedOption - 1);
                } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
                    currentPuzzle.selectedOption = Math.min(currentPuzzle.options.length - 1, currentPuzzle.selectedOption + 1);
                } else if (e.code === 'Enter' || e.code === 'Space') {
                    submitAnswer();
                }
            } else {
                if (e.code === 'Enter') {
                    submitAnswer();
                } else if (e.code === 'Backspace') {
                    puzzleInput = puzzleInput.slice(0, -1);
                } else if (e.key.length === 1 && puzzleInput.length < 20) {
                    puzzleInput += e.key;
                }
            }
            break;
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// ============================================
// GAMEPAD SUPPORT
// ============================================

function pollGamepad() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;

    for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i]) {
            gp = gamepads[i];
            break;
        }
    }

    if (!gp) return;

    const DEADZONE = 0.15;
    const buttons = gp.buttons.map(b => b.pressed);
    const axes = gp.axes;

    // A button (index 0) - confirm/start
    if (buttons[0] && !gpPrevButtons[0]) {
        switch (gameState) {
            case STATE.MENU:
            case STATE.GAMEOVER:
            case STATE.WIN:
                startGame();
                break;
            case STATE.PUZZLE:
                submitAnswer();
                break;
        }
    }

    // D-pad or stick for symbol puzzles
    if (gameState === STATE.PUZZLE && currentPuzzle && currentPuzzle.isSymbol) {
        const leftPressed = buttons[14] || axes[0] < -DEADZONE;
        const rightPressed = buttons[15] || axes[0] > DEADZONE;
        const prevLeft = gpPrevButtons[14] || false;
        const prevRight = gpPrevButtons[15] || false;

        if (leftPressed && !prevLeft) {
            currentPuzzle.selectedOption = Math.max(0, currentPuzzle.selectedOption - 1);
        }
        if (rightPressed && !prevRight) {
            currentPuzzle.selectedOption = Math.min(currentPuzzle.options.length - 1, currentPuzzle.selectedOption + 1);
        }
    }

    gpPrevButtons = buttons;
}

// ============================================
// GAME LOOP
// ============================================

function gameLoop(timestamp) {
    if (lastTime === 0) lastTime = timestamp;
    const elapsed = timestamp - lastTime;
    lastTime = timestamp;
    const dt = Math.min(elapsed / (1000 / TARGET_FPS), 3);

    pollGamepad();
    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
}

// Init and start
initForest();
requestAnimationFrame(gameLoop);
