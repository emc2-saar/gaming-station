const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const TARGET_FPS = 60;
let lastTime = 0;
let gameRunning = false;
let score = 0;

// --- Dragon Stats ---
let hunger = 100;      // 0 = verhungert, 100 = satt
let happiness = 100;   // 0 = traurig, 100 = glücklich
let energy = 100;      // 0 = erschöpft, 100 = ausgeruht
let growth = 0;        // 0-100, bei Schwellen wächst der Drache
let stage = 0;         // 0=Ei, 1=Baby, 2=Jung, 3=Erwachsen
let alive = true;

// --- UI State ---
let selectedAction = 0; // 0=Füttern, 1=Spielen, 2=Schlafen
const actions = ['Füttern', 'Spielen', 'Schlafen'];
const actionIcons = ['🍖', '⚽', '💤'];

// --- Animation ---
let animTimer = 0;
let animFrame = 0;
let actionAnim = '';
let actionAnimTimer = 0;
let bounceOffset = 0;
let eyeBlink = 0;
let blinkTimer = 0;

// --- Decay Timers (accumulator pattern) ---
let decayAccum = 0;
const DECAY_INTERVAL = 20; // every 20 frames at target FPS (~0.33 seconds)

// --- Hatching ---
let hatchTimer = 0;
const HATCH_TIME = 90; // 1.5 seconds at 60fps

// --- Stage thresholds ---
const STAGE_NAMES = ['Ei', 'Baby', 'Junger Drache', 'Erwachsener Drache'];
const GROWTH_THRESHOLDS = [0, 30, 65, 100];

// --- Gamepad ---
let lastGamepadButtons = [];
let gamepadCooldown = 0;

function update(dt) {
    if (!gameRunning) return;
    if (!alive) return;

    animTimer += dt;
    blinkTimer += dt;

    // Eye blink
    if (blinkTimer > 120 + Math.random() * 60) {
        eyeBlink = 1;
        blinkTimer = 0;
    }
    if (eyeBlink > 0) {
        eyeBlink -= dt * 0.1;
        if (eyeBlink < 0) eyeBlink = 0;
    }

    // Bounce animation
    bounceOffset = Math.sin(animTimer * 0.05) * 3;

    // Action animation
    if (actionAnimTimer > 0) {
        actionAnimTimer -= dt;
    }

    // Egg hatching
    if (stage === 0) {
        hatchTimer += dt;
        if (hatchTimer >= HATCH_TIME) {
            stage = 1;
            growth = 0;
        }
        return;
    }

    // Stat decay (accumulator pattern)
    decayAccum += dt;
    while (decayAccum >= DECAY_INTERVAL) {
        decayAccum -= DECAY_INTERVAL;
        
        hunger = Math.max(0, hunger - 2.0);
        happiness = Math.max(0, happiness - 1.5);
        energy = Math.max(0, energy - 1.0);

        // Growth based on average stats
        let avgStats = (hunger + happiness + energy) / 3;
        if (avgStats > 60) {
            growth = Math.min(100, growth + 0.8);
        }

        // Check stage evolution
        if (stage < 3 && growth >= GROWTH_THRESHOLDS[stage + 1]) {
            stage++;
            actionAnim = 'evolve';
            actionAnimTimer = 90;
        }

        // Check death
        if (hunger <= 0 && happiness <= 0 && energy <= 0) {
            alive = false;
        }
    }

    // Score = time alive + growth
    score = Math.floor(growth * 10 + stage * 100);

    // Gamepad
    handleGamepad(dt);
}

function handleGamepad(dt) {
    gamepadCooldown = Math.max(0, gamepadCooldown - dt);
    
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let gp of gamepads) {
        if (!gp) continue;
        
        const DEADZONE = 0.15;
        const axisX = Math.abs(gp.axes[0]) > DEADZONE ? gp.axes[0] : 0;

        if (gamepadCooldown <= 0) {
            // D-pad or stick left/right
            if (axisX < -0.5 || (gp.buttons[14] && gp.buttons[14].pressed)) {
                selectedAction = (selectedAction - 1 + actions.length) % actions.length;
                gamepadCooldown = 15;
            } else if (axisX > 0.5 || (gp.buttons[15] && gp.buttons[15].pressed)) {
                selectedAction = (selectedAction + 1) % actions.length;
                gamepadCooldown = 15;
            }

            // A button (confirm)
            if (gp.buttons[0] && gp.buttons[0].pressed) {
                doAction(selectedAction);
                gamepadCooldown = 15;
            }
        }
    }
}

function doAction(action) {
    if (!alive || stage === 0) return;

    switch(action) {
        case 0: // Füttern
            hunger = Math.min(100, hunger + 25);
            energy = Math.max(0, energy - 5);
            actionAnim = 'feed';
            actionAnimTimer = 60;
            break;
        case 1: // Spielen
            happiness = Math.min(100, happiness + 25);
            hunger = Math.max(0, hunger - 10);
            energy = Math.max(0, energy - 15);
            actionAnim = 'play';
            actionAnimTimer = 60;
            break;
        case 2: // Schlafen
            energy = Math.min(100, energy + 30);
            hunger = Math.max(0, hunger - 5);
            actionAnim = 'sleep';
            actionAnimTimer = 60;
            break;
    }
}

function draw() {
    // Background gradient
    let grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#0f0c29');
    grad.addColorStop(0.5, '#302b63');
    grad.addColorStop(1, '#24243e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Stars
    drawStars();

    if (!gameRunning) {
        drawStartScreen();
        return;
    }

    if (!alive) {
        drawGameOver();
        return;
    }

    // Draw stage name
    ctx.fillStyle = '#aaa';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(STAGE_NAMES[stage], canvas.width / 2, 30);

    // Draw stats bars
    drawStatBar(30, 50, 'Hunger', hunger, '#ff6b6b');
    drawStatBar(30, 85, 'Freude', happiness, '#ffd93d');
    drawStatBar(30, 120, 'Energie', energy, '#6bcb77');

    // Growth bar
    drawStatBar(30, 155, 'Wachstum', growth, '#a855f7');

    // Draw dragon
    drawDragon(canvas.width / 2, canvas.height / 2 + 20);

    // Draw action animation
    if (actionAnimTimer > 0) {
        drawActionAnimation();
    }

    // Draw action buttons
    drawActions();

    // Draw controls hint
    ctx.fillStyle = '#666';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('← → Auswählen | Leertaste/Enter = Bestätigen', canvas.width / 2, canvas.height - 20);
}

function drawStars() {
    // Simple deterministic stars
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    for (let i = 0; i < 30; i++) {
        let x = (i * 137.5 + 50) % canvas.width;
        let y = (i * 97.3 + 20) % (canvas.height * 0.4);
        let size = (i % 3) + 1;
        ctx.fillRect(x, y, size, size);
    }
}

function drawStatBar(x, y, label, value, color) {
    const barWidth = canvas.width - 60;
    const barHeight = 20;

    ctx.fillStyle = '#333';
    ctx.fillRect(x, y, barWidth, barHeight);

    ctx.fillStyle = color;
    ctx.fillRect(x, y, barWidth * (value / 100), barHeight);

    ctx.strokeStyle = '#555';
    ctx.strokeRect(x, y, barWidth, barHeight);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label + ': ' + Math.floor(value) + '%', x + 5, y + 14);
}

function drawDragon(x, y) {
    let by = y + bounceOffset;
    let size = 1;
    
    if (stage === 0) {
        drawEgg(x, by);
        return;
    } else if (stage === 1) {
        size = 0.7;
    } else if (stage === 2) {
        size = 1.0;
    } else {
        size = 1.4;
    }

    ctx.save();
    ctx.translate(x, by);
    ctx.scale(size, size);

    // Evolution glow
    if (actionAnim === 'evolve' && actionAnimTimer > 0) {
        ctx.shadowColor = '#a855f7';
        ctx.shadowBlur = 30;
    }

    // Body
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.ellipse(0, 0, 40, 50, 0, 0, Math.PI * 2);
    ctx.fill();

    // Belly
    ctx.fillStyle = '#86efac';
    ctx.beginPath();
    ctx.ellipse(0, 10, 25, 35, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.ellipse(0, -55, 30, 25, 0, 0, Math.PI * 2);
    ctx.fill();

    // Horns
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(-15, -75);
    ctx.lineTo(-10, -60);
    ctx.lineTo(-20, -60);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(15, -75);
    ctx.lineTo(10, -60);
    ctx.lineTo(20, -60);
    ctx.closePath();
    ctx.fill();

    // Eyes
    if (eyeBlink > 0.5) {
        // Blinking
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-12, -55);
        ctx.lineTo(-6, -55);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(6, -55);
        ctx.lineTo(12, -55);
        ctx.stroke();
    } else {
        // Open eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(-10, -57, 7, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(10, -57, 7, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pupils - mood based
        let pupilY = -57;
        if (happiness < 30) pupilY = -55; // sad, looking down
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(-10, pupilY, 4, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(10, pupilY, 4, 5, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Mouth - mood based
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    if (happiness > 60) {
        // Happy smile
        ctx.beginPath();
        ctx.arc(0, -45, 10, 0.1 * Math.PI, 0.9 * Math.PI);
        ctx.stroke();
    } else if (happiness > 30) {
        // Neutral
        ctx.beginPath();
        ctx.moveTo(-7, -42);
        ctx.lineTo(7, -42);
        ctx.stroke();
    } else {
        // Sad
        ctx.beginPath();
        ctx.arc(0, -38, 8, 1.1 * Math.PI, 1.9 * Math.PI);
        ctx.stroke();
    }

    // Wings
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.moveTo(-40, -10);
    ctx.quadraticCurveTo(-75, -40, -55, 10);
    ctx.quadraticCurveTo(-40, 5, -40, -10);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(40, -10);
    ctx.quadraticCurveTo(75, -40, 55, 10);
    ctx.quadraticCurveTo(40, 5, 40, -10);
    ctx.fill();

    // Tail
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 45);
    ctx.quadraticCurveTo(30, 60, 40, 50);
    ctx.quadraticCurveTo(50, 40, 45, 35);
    ctx.stroke();

    // Tail tip
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(45, 35);
    ctx.lineTo(55, 30);
    ctx.lineTo(50, 42);
    ctx.closePath();
    ctx.fill();

    // Feet
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.ellipse(-15, 50, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(15, 50, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sleeping ZZZ
    if (actionAnim === 'sleep' && actionAnimTimer > 0) {
        ctx.fillStyle = '#93c5fd';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        let offset = (60 - actionAnimTimer) * 0.5;
        ctx.fillText('Z', 30, -70 - offset);
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText('z', 40, -80 - offset);
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('z', 48, -88 - offset);
    }

    ctx.restore();
    ctx.shadowBlur = 0;
}

function drawEgg(x, y) {
    let shake = Math.sin(hatchTimer * 0.3) * (hatchTimer / HATCH_TIME) * 5;
    
    ctx.save();
    ctx.translate(x + shake, y);

    // Egg
    ctx.fillStyle = '#86efac';
    ctx.beginPath();
    ctx.ellipse(0, 0, 30, 40, 0, 0, Math.PI * 2);
    ctx.fill();

    // Egg pattern
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.ellipse(-10, -10, 6, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(10, 5, 5, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-5, 15, 4, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Crack appearing
    if (hatchTimer > HATCH_TIME * 0.5) {
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-5, -15);
        ctx.lineTo(0, -5);
        ctx.lineTo(5, -12);
        ctx.lineTo(8, 0);
        ctx.stroke();
    }

    ctx.restore();

    // Hatching text
    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Ei schlüpft...', x, y + 70);
}

function drawActionAnimation() {
    let centerX = canvas.width / 2;
    let centerY = canvas.height / 2 - 50;
    let progress = 1 - (actionAnimTimer / 60);

    ctx.font = '30px sans-serif';
    ctx.textAlign = 'center';
    ctx.globalAlpha = 1 - progress;

    if (actionAnim === 'feed') {
        ctx.fillText('🍖', centerX + 50, centerY - 30 * progress);
    } else if (actionAnim === 'play') {
        ctx.fillText('⭐', centerX, centerY - 80 - 20 * progress);
    } else if (actionAnim === 'evolve') {
        ctx.font = '24px sans-serif';
        ctx.fillStyle = '#a855f7';
        ctx.fillText('✨ Evolution! ✨', centerX, centerY - 100);
    }

    ctx.globalAlpha = 1;
}

function drawActions() {
    const y = canvas.height - 80;
    const btnWidth = 120;
    const gap = 20;
    const totalWidth = actions.length * btnWidth + (actions.length - 1) * gap;
    const startX = (canvas.width - totalWidth) / 2;

    for (let i = 0; i < actions.length; i++) {
        let x = startX + i * (btnWidth + gap);
        
        // Button background
        if (i === selectedAction) {
            ctx.fillStyle = '#4ade80';
            ctx.shadowColor = '#4ade80';
            ctx.shadowBlur = 10;
        } else {
            ctx.fillStyle = '#333';
        }
        
        roundRect(ctx, x, y, btnWidth, 45, 8);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Button text
        ctx.fillStyle = i === selectedAction ? '#000' : '#aaa';
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(actionIcons[i], x + btnWidth / 2, y + 20);
        ctx.font = '12px sans-serif';
        ctx.fillText(actions[i], x + btnWidth / 2, y + 38);
    }
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
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🐉 Drachen-Tamagotchi', canvas.width / 2, canvas.height / 2 - 80);

    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Kümmere dich um deinen Drachen!', canvas.width / 2, canvas.height / 2 - 40);
    ctx.fillText('Füttere ihn, spiel mit ihm und lass ihn schlafen.', canvas.width / 2, canvas.height / 2 - 15);
    ctx.fillText('Wenn du dich gut kümmerst, wächst er!', canvas.width / 2, canvas.height / 2 + 10);

    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('Leertaste zum Starten', canvas.width / 2, canvas.height / 2 + 70);

    ctx.fillStyle = '#888';
    ctx.font = '14px sans-serif';
    ctx.fillText('← → Auswählen | Leertaste/Enter = Bestätigen', canvas.width / 2, canvas.height / 2 + 110);
    ctx.fillText('Gamepad: Steuerkreuz + A-Taste', canvas.width / 2, canvas.height / 2 + 135);
}

function drawGameOver() {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ff6b6b';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Dein Drache ist eingeschlafen...', canvas.width / 2, canvas.height / 2 - 60);

    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.fillText('Endgültiger Wachstum: ' + STAGE_NAMES[stage], canvas.width / 2, canvas.height / 2);
    ctx.fillText('Score: ' + score, canvas.width / 2, canvas.height / 2 + 35);

    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('Leertaste für neues Ei', canvas.width / 2, canvas.height / 2 + 90);
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

function startGame() {
    hunger = 100;
    happiness = 100;
    energy = 100;
    growth = 0;
    stage = 0;
    alive = true;
    score = 0;
    hatchTimer = 0;
    decayAccum = 0;
    selectedAction = 0;
    actionAnim = '';
    actionAnimTimer = 0;
    gameRunning = true;
    lastTime = 0;
}

// --- Input ---
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (!gameRunning || !alive) {
            startGame();
        } else if (stage > 0) {
            doAction(selectedAction);
        }
    }
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        e.preventDefault();
        selectedAction = (selectedAction - 1 + actions.length) % actions.length;
    }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        e.preventDefault();
        selectedAction = (selectedAction + 1) % actions.length;
    }
});

// Touch support
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (!gameRunning || !alive) {
        startGame();
        return;
    }

    // Check if clicking action buttons
    const btnY = canvas.height - 80;
    const btnWidth = 120;
    const gap = 20;
    const totalWidth = actions.length * btnWidth + (actions.length - 1) * gap;
    const startX = (canvas.width - totalWidth) / 2;

    for (let i = 0; i < actions.length; i++) {
        let bx = startX + i * (btnWidth + gap);
        if (x >= bx && x <= bx + btnWidth && y >= btnY && y <= btnY + 45) {
            selectedAction = i;
            doAction(i);
            return;
        }
    }
});

// Start game loop
requestAnimationFrame(gameLoop);
