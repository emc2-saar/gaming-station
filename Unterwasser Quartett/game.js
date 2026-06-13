const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const TARGET_FPS = 60;
let lastTime = 0;

// === GAME STATE ===
let gameState = 'start'; // start, playing, pickCategory, comparing, roundResult, gameOver
let playerDeck = [];
let cpuDeck = [];
let currentCategory = -1;
let roundWinner = ''; // 'player', 'cpu', 'draw'
let resultTimer = 0;
let isPlayerTurn = true;
let selectedCategory = 0; // für Gamepad/Tastatur Navigation
let message = '';
let bubbles = [];
let animationProgress = 0;

// === CARDS DATA ===
const categories = ['Geschwindigkeit', 'Stärke', 'Panzerung', 'Intelligenz', 'Größe'];
const categoryIcons = ['🏊', '💪', '🛡️', '🧠', '📏'];

const allCards = [
    { name: 'Hai', emoji: '🦈', stats: [85, 95, 40, 60, 80] },
    { name: 'Oktopus', emoji: '🐙', stats: [50, 45, 20, 95, 40] },
    { name: 'Schildkröte', emoji: '🐢', stats: [20, 30, 95, 40, 60] },
    { name: 'Delfin', emoji: '🐬', stats: [90, 50, 25, 90, 65] },
    { name: 'Riesenkalmar', emoji: '🦑', stats: [60, 80, 30, 55, 95] },
    { name: 'Kugelfisch', emoji: '🐡', stats: [30, 35, 90, 25, 20] },
    { name: 'Fangschreckenkrebs', emoji: '🦐', stats: [45, 90, 75, 50, 15] },
    { name: 'Qualle', emoji: '🪼', stats: [15, 70, 10, 5, 35] },
    { name: 'Blauwal', emoji: '🐋', stats: [40, 60, 50, 70, 99] },
    { name: 'Seehund', emoji: '🦭', stats: [70, 35, 20, 75, 50] },
    { name: 'Clownfisch', emoji: '🐠', stats: [55, 10, 15, 30, 10] },
    { name: 'Hummer', emoji: '🦞', stats: [25, 55, 85, 20, 30] },
    { name: 'Salzwasserkrokodil', emoji: '🐊', stats: [35, 98, 80, 45, 85] },
    { name: 'Schwertfisch', emoji: '🦈', stats: [99, 40, 15, 35, 55] },
    { name: 'Seeschlange', emoji: '🐍', stats: [75, 85, 10, 30, 45] },
    { name: 'Krabbe', emoji: '🦀', stats: [20, 40, 70, 15, 25] },
];

// === BUBBLES ===
function initBubbles() {
    bubbles = [];
    for (let i = 0; i < 20; i++) {
        bubbles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            radius: Math.random() * 4 + 2,
            speed: Math.random() * 0.5 + 0.2,
            opacity: Math.random() * 0.3 + 0.1,
        });
    }
}

function updateBubbles(dt) {
    for (const b of bubbles) {
        b.y -= b.speed * dt;
        b.x += Math.sin(b.y * 0.02) * 0.3 * dt;
        if (b.y < -10) {
            b.y = canvas.height + 10;
            b.x = Math.random() * canvas.width;
        }
    }
}

function drawBubbles() {
    for (const b of bubbles) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(100, 200, 255, ${b.opacity})`;
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

// === GAME LOGIC ===
function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function startGame() {
    const shuffled = shuffle(allCards);
    playerDeck = shuffled.slice(0, 8);
    cpuDeck = shuffled.slice(8, 16);
    isPlayerTurn = true;
    gameState = 'pickCategory';
    selectedCategory = 0;
    message = '';
    animationProgress = 0;
}

function pickCategory(index) {
    if (gameState !== 'pickCategory' || !isPlayerTurn) return;
    currentCategory = index;
    compareCards();
}

function cpuPickCategory() {
    // KI wählt die Kategorie, in der sie den höchsten Wert hat
    const cpuCard = cpuDeck[0];
    let bestIndex = 0;
    let bestValue = 0;
    for (let i = 0; i < 5; i++) {
        if (cpuCard.stats[i] > bestValue) {
            bestValue = cpuCard.stats[i];
            bestIndex = i;
        }
    }
    currentCategory = bestIndex;
    compareCards();
}

function compareCards() {
    gameState = 'comparing';
    animationProgress = 0;
    const playerVal = playerDeck[0].stats[currentCategory];
    const cpuVal = cpuDeck[0].stats[currentCategory];

    if (playerVal > cpuVal) {
        roundWinner = 'player';
        message = 'Du gewinnst die Runde!';
    } else if (cpuVal > playerVal) {
        roundWinner = 'cpu';
        message = 'Computer gewinnt die Runde!';
    } else {
        roundWinner = 'draw';
        message = 'Unentschieden!';
    }

    resultTimer = 180; // ~3 Sekunden bei 60fps
}

function resolveRound() {
    const playerCard = playerDeck.shift();
    const cpuCard = cpuDeck.shift();

    if (roundWinner === 'player') {
        playerDeck.push(playerCard, cpuCard);
        isPlayerTurn = true;
    } else if (roundWinner === 'cpu') {
        cpuDeck.push(cpuCard, playerCard);
        isPlayerTurn = false;
    } else {
        // Unentschieden: jeder behält seine Karte (hinten einsortieren)
        playerDeck.push(playerCard);
        cpuDeck.push(cpuCard);
        // Gleicher Spieler bleibt dran
    }

    // Check game over
    if (playerDeck.length === 0) {
        gameState = 'gameOver';
        message = 'Verloren! Der Computer hat alle Karten.';
    } else if (cpuDeck.length === 0) {
        gameState = 'gameOver';
        message = 'Gewonnen! Du hast alle Karten!';
    } else {
        gameState = 'pickCategory';
        selectedCategory = 0;
        animationProgress = 0;
        if (!isPlayerTurn) {
            // CPU ist dran – kurz warten dann wählen
            resultTimer = 60;
            gameState = 'cpuThinking';
        }
    }
}

// === DRAWING ===
function drawBackground() {
    // Unterwasser Gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#0a2a4a');
    gradient.addColorStop(1, '#0a1628');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawBubbles();
}

function drawCard(card, x, y, w, h, highlight, showStats, highlightCategory) {
    // Card background
    ctx.fillStyle = highlight ? '#1a4a6a' : '#0f2a3a';
    ctx.strokeStyle = highlight ? '#4af' : '#1a5a7a';
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, w, h, 10);
    ctx.fill();
    ctx.stroke();

    // Emoji
    ctx.font = '40px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(card.emoji, x + w / 2, y + 55);

    // Name
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(card.name, x + w / 2, y + 80);

    // Stats
    if (showStats) {
        for (let i = 0; i < 5; i++) {
            const sy = y + 100 + i * 32;
            const isHighlight = highlightCategory === i;

            ctx.font = '12px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillStyle = isHighlight ? '#ffcc00' : '#aaddff';
            ctx.fillText(`${categoryIcons[i]} ${categories[i]}`, x + 10, sy);

            // Stat bar background
            ctx.fillStyle = '#0a1a2a';
            ctx.fillRect(x + 10, sy + 4, w - 20, 12);

            // Stat bar fill
            const barWidth = ((w - 20) * card.stats[i]) / 100;
            ctx.fillStyle = isHighlight ? '#ffcc00' : '#4af';
            ctx.fillRect(x + 10, sy + 4, barWidth, 12);

            // Value
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillStyle = '#fff';
            ctx.fillText(card.stats[i].toString(), x + w - 12, sy + 14);
        }
    }
}

function drawCardBack(x, y, w, h) {
    ctx.fillStyle = '#0a2040';
    ctx.strokeStyle = '#1a5a7a';
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, w, h, 10);
    ctx.fill();
    ctx.stroke();

    ctx.font = '30px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#4af';
    ctx.fillText('🌊', x + w / 2, y + h / 2 + 10);
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function drawStartScreen() {
    drawBackground();

    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#4af';
    ctx.fillText('🌊 Unterwasser Quartett 🌊', canvas.width / 2, 150);

    ctx.font = '20px sans-serif';
    ctx.fillStyle = '#aaddff';
    ctx.fillText('Ein Trumpf-Kartenspiel mit Meerestieren', canvas.width / 2, 200);

    // Deko-Tiere
    ctx.font = '50px sans-serif';
    const animals = ['🦈', '🐙', '🐬', '🐢', '🦑', '🐡', '🐋', '🦀'];
    for (let i = 0; i < animals.length; i++) {
        const x = 80 + i * 90;
        const y = 280 + Math.sin(Date.now() / 500 + i) * 10;
        ctx.fillText(animals[i], x, y);
    }

    ctx.font = '22px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText('Leertaste / Enter / A-Button zum Starten', canvas.width / 2, 380);

    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#88bbdd';
    ctx.fillText('Steuerung: ↑↓ oder W/S = Kategorie wählen', canvas.width / 2, 430);
    ctx.fillText('Enter / Leertaste / A-Button = Bestätigen', canvas.width / 2, 455);

    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#6699aa';
    ctx.fillText('Wähle eine Kategorie und schlage den Computer!', canvas.width / 2, 500);
    ctx.fillText('Wer alle 16 Karten sammelt, gewinnt!', canvas.width / 2, 525);
}

function drawPlayScreen() {
    drawBackground();

    // Header
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#4af';
    ctx.fillText(`Deine Karten: ${playerDeck.length}`, 20, 30);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#f66';
    ctx.fillText(`Computer: ${cpuDeck.length}`, canvas.width - 20, 30);

    // Wer ist dran?
    ctx.textAlign = 'center';
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#ffcc00';
    if (gameState === 'pickCategory' && isPlayerTurn) {
        ctx.fillText('Du bist dran! Wähle eine Kategorie:', canvas.width / 2, 30);
    } else if (gameState === 'cpuThinking') {
        ctx.fillText('Computer denkt nach...', canvas.width / 2, 30);
    }

    // Player card
    const cardW = 200;
    const cardH = 280;
    const playerX = 50;
    const playerY = 60;

    if (playerDeck.length > 0) {
        const highlightCat = (gameState === 'pickCategory' && isPlayerTurn) ? selectedCategory :
                             (gameState === 'comparing' || gameState === 'roundResult') ? currentCategory : -1;
        drawCard(playerDeck[0], playerX, playerY, cardW, cardH, true, true, highlightCat);

        // Kategorie-Auswahl Indikator
        if (gameState === 'pickCategory' && isPlayerTurn) {
            const arrowX = playerX - 15;
            const arrowY = playerY + 100 + selectedCategory * 32 + 8;
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ffcc00';
            ctx.fillText('▶', arrowX, arrowY + 4);
        }
    }

    // CPU card
    const cpuX = canvas.width - 50 - cardW;
    const cpuY = 60;

    if (cpuDeck.length > 0) {
        if (gameState === 'comparing' || gameState === 'roundResult') {
            // Zeige CPU-Karte
            drawCard(cpuDeck[0], cpuX, cpuY, cardW, cardH, false, true, currentCategory);
        } else {
            // Verdeckte Karte
            drawCardBack(cpuX, cpuY, cardW, cardH);
        }
    }

    // VS Symbol
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText('VS', canvas.width / 2, 200);

    // Deck-Stapel Anzeige
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#88bbdd';
    ctx.textAlign = 'center';
    ctx.fillText(`${playerDeck.length} Karten`, playerX + cardW / 2, playerY + cardH + 25);
    ctx.fillText(`${cpuDeck.length} Karten`, cpuX + cardW / 2, cpuY + cardH + 25);

    // Message / Ergebnis
    if (gameState === 'comparing' || gameState === 'roundResult') {
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        if (roundWinner === 'player') {
            ctx.fillStyle = '#4f4';
        } else if (roundWinner === 'cpu') {
            ctx.fillStyle = '#f44';
        } else {
            ctx.fillStyle = '#ffcc00';
        }
        ctx.fillText(message, canvas.width / 2, canvas.height - 60);

        // Gewählte Kategorie anzeigen
        ctx.font = '16px sans-serif';
        ctx.fillStyle = '#aaddff';
        const pVal = playerDeck[0].stats[currentCategory];
        const cVal = cpuDeck[0].stats[currentCategory];
        ctx.fillText(
            `${categoryIcons[currentCategory]} ${categories[currentCategory]}: ${pVal} vs ${cVal}`,
            canvas.width / 2, canvas.height - 35
        );
    }

    // Weiter-Hinweis
    if (gameState === 'comparing' && resultTimer <= 0) {
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#ffcc00';
        ctx.textAlign = 'center';
        ctx.fillText('Leertaste / Enter für nächste Runde', canvas.width / 2, canvas.height - 10);
    }
}

function drawGameOverScreen() {
    drawBackground();

    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';

    if (playerDeck.length > cpuDeck.length) {
        ctx.fillStyle = '#4f4';
        ctx.fillText('🎉 Gewonnen! 🎉', canvas.width / 2, 200);
    } else {
        ctx.fillStyle = '#f66';
        ctx.fillText('💀 Verloren! 💀', canvas.width / 2, 200);
    }

    ctx.font = '20px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(message, canvas.width / 2, 260);

    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#ffcc00';
    ctx.fillText('Leertaste / Enter / A-Button zum Neustart', canvas.width / 2, 350);
}

// === UPDATE ===
function update(dt) {
    updateBubbles(dt);

    if (gameState === 'comparing') {
        resultTimer -= dt;
        if (resultTimer <= 0) {
            // Warten auf Spieler-Input zum Weiter
            gameState = 'roundResult';
        }
    }

    if (gameState === 'cpuThinking') {
        resultTimer -= dt;
        if (resultTimer <= 0) {
            cpuPickCategory();
        }
    }

    // Gamepad polling
    pollGamepad();
}

// === DRAW ===
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (gameState === 'start') {
        drawStartScreen();
    } else if (gameState === 'gameOver') {
        drawGameOverScreen();
    } else {
        drawPlayScreen();
    }
}

// === GAME LOOP ===
function gameLoop(timestamp) {
    if (lastTime === 0) lastTime = timestamp;
    const elapsed = timestamp - lastTime;
    lastTime = timestamp;
    const dt = Math.min(elapsed / (1000 / TARGET_FPS), 3);

    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
}

// === INPUT ===
document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') return; // Nicht verwenden

    if (gameState === 'start') {
        if (e.code === 'Space' || e.code === 'Enter') {
            e.preventDefault();
            startGame();
        }
    } else if (gameState === 'pickCategory' && isPlayerTurn) {
        if (e.code === 'ArrowUp' || e.code === 'KeyW') {
            e.preventDefault();
            selectedCategory = (selectedCategory - 1 + 5) % 5;
        } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
            e.preventDefault();
            selectedCategory = (selectedCategory + 1) % 5;
        } else if (e.code === 'Space' || e.code === 'Enter') {
            e.preventDefault();
            pickCategory(selectedCategory);
        }
    } else if (gameState === 'roundResult') {
        if (e.code === 'Space' || e.code === 'Enter') {
            e.preventDefault();
            resolveRound();
        }
    } else if (gameState === 'gameOver') {
        if (e.code === 'Space' || e.code === 'Enter') {
            e.preventDefault();
            gameState = 'start';
        }
    }
});

// === GAMEPAD SUPPORT ===
let gamepadButtonsPressed = {};

function pollGamepad() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of gamepads) {
        if (!gp) continue;

        const DEADZONE = 0.15;

        // D-Pad oder linker Stick: Hoch/Runter
        const upPressed = gp.buttons[12]?.pressed || gp.axes[1] < -DEADZONE;
        const downPressed = gp.buttons[13]?.pressed || gp.axes[1] > DEADZONE;
        const aPressed = gp.buttons[0]?.pressed; // A-Button
        const startPressed = gp.buttons[9]?.pressed; // Start-Button

        // Nur bei neuem Drücken reagieren (kein Repeat)
        const id = gp.index;
        if (!gamepadButtonsPressed[id]) gamepadButtonsPressed[id] = {};
        const prev = gamepadButtonsPressed[id];

        if (upPressed && !prev.up) {
            handleGamepadDirection('up');
        }
        if (downPressed && !prev.down) {
            handleGamepadDirection('down');
        }
        if ((aPressed && !prev.a) || (startPressed && !prev.start)) {
            handleGamepadConfirm();
        }

        prev.up = upPressed;
        prev.down = downPressed;
        prev.a = aPressed;
        prev.start = startPressed;
    }
}

function handleGamepadDirection(dir) {
    if (gameState === 'pickCategory' && isPlayerTurn) {
        if (dir === 'up') {
            selectedCategory = (selectedCategory - 1 + 5) % 5;
        } else if (dir === 'down') {
            selectedCategory = (selectedCategory + 1) % 5;
        }
    }
}

function handleGamepadConfirm() {
    if (gameState === 'start') {
        startGame();
    } else if (gameState === 'pickCategory' && isPlayerTurn) {
        pickCategory(selectedCategory);
    } else if (gameState === 'roundResult') {
        resolveRound();
    } else if (gameState === 'gameOver') {
        gameState = 'start';
    }
}

// === INIT ===
initBubbles();
requestAnimationFrame(gameLoop);
