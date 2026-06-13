const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const TARGET_FPS = 60;
let lastTime = 0;

// Game States
const STATE_MENU = 0;
const STATE_PLAYING = 1;
const STATE_ROUND_RESULT = 2;
const STATE_GAME_OVER = 3;

let gameState = STATE_MENU;
let score = { dancer: 0, judoka: 0 };
let currentRound = 0;
let totalRounds = 5;
let currentTurn = 'dancer'; // 'dancer' or 'judoka'
let turnPhase = 'ready'; // 'ready', 'sequence', 'input', 'result'

// Timing
let phaseTimer = 0;
let sequenceIndex = 0;
let inputIndex = 0;
let inputTimeout = 0;
const INPUT_TIME_LIMIT = 90; // frames at 60fps = 1.5 seconds per input

// Sequences
let currentSequence = [];
let playerInputs = [];
let sequenceShowTimer = 0;

// Keys mapping
const KEYS = {
    'ArrowUp': '↑',
    'ArrowDown': '↓',
    'ArrowLeft': '←',
    'ArrowRight': '→',
    'KeyW': '↑',
    'KeyS': '↓',
    'KeyA': '←',
    'KeyD': '→'
};

const KEY_NAMES = ['↑', '↓', '←', '→'];

// Dancer moves
const DANCER_MOVES = [
    'Pirouette', 'Arabesque', 'Grand Jeté', 'Plié', 'Fouetté',
    'Chassé', 'Relevé', 'Drehsprung', 'Spagat', 'Pas de Deux'
];

// Judoka moves
const JUDOKA_MOVES = [
    'Ippon Seoi Nage', 'O Soto Gari', 'Uchi Mata', 'Harai Goshi',
    'Tai Otoshi', 'Tomoe Nage', 'Osoto Otoshi', 'Ko Uchi Gari',
    'Sasae Tsurikomi', 'Morote Seoi Nage'
];

// Animation
let animFrame = 0;
let animTimer = 0;
let particles = [];
let flashAlpha = 0;
let currentMoveName = '';
let moveNameTimer = 0;

// Pose animation based on arrow keys
let currentPose = 'idle'; // 'idle', 'up', 'down', 'left', 'right'
let poseTimer = 0;
const POSE_DURATION = 25; // how long a pose holds after key press

// Stars for rating
let roundStars = 0;

// Input tracking
let keysPressed = {};

document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') return;
    e.preventDefault();
    
    if (gameState === STATE_MENU && e.code === 'Space') {
        startGame();
        return;
    }
    
    if (gameState === STATE_GAME_OVER && e.code === 'Space') {
        resetGame();
        return;
    }
    
    if (gameState === STATE_ROUND_RESULT && e.code === 'Space') {
        nextTurn();
        return;
    }
    
    if (gameState === STATE_PLAYING && turnPhase === 'input') {
        if (KEYS[e.code] && !keysPressed[e.code]) {
            keysPressed[e.code] = true;
            const dir = KEYS[e.code];
            // Trigger pose animation
            if (dir === '↑') currentPose = 'up';
            else if (dir === '↓') currentPose = 'down';
            else if (dir === '←') currentPose = 'left';
            else if (dir === '→') currentPose = 'right';
            poseTimer = POSE_DURATION;
            handleInput(dir);
        }
    }
});

document.addEventListener('keyup', (e) => {
    keysPressed[e.code] = false;
});

// ============================================================
// GAMEPAD SUPPORT
// ============================================================
let gamepadConnected = false;
let gamepadPrevButtons = {};
let gamepadPrevAxes = { up: false, down: false, left: false, right: false };

window.addEventListener('gamepadconnected', (e) => {
    gamepadConnected = true;
    console.log(`Gamepad verbunden: ${e.gamepad.id}`);
});

window.addEventListener('gamepaddisconnected', (e) => {
    gamepadConnected = false;
    console.log('Gamepad getrennt');
});

function pollGamepad() {
    const gamepads = navigator.getGamepads();
    if (!gamepads) return;
    
    for (let i = 0; i < gamepads.length; i++) {
        const gp = gamepads[i];
        if (!gp) continue;
        
        // --- Button A (index 0) = Leertaste ---
        const aPressed = gp.buttons[0] && gp.buttons[0].pressed;
        if (aPressed && !gamepadPrevButtons[0]) {
            if (gameState === STATE_MENU) startGame();
            else if (gameState === STATE_GAME_OVER) resetGame();
            else if (gameState === STATE_ROUND_RESULT) nextTurn();
        }
        gamepadPrevButtons[0] = aPressed;
        
        // --- D-Pad (buttons 12-15) and Left Stick (axes 0,1) ---
        const DEADZONE = 0.4;
        const axisX = gp.axes[0] || 0;
        const axisY = gp.axes[1] || 0;
        
        // D-Pad buttons: 12=Up, 13=Down, 14=Left, 15=Right
        const dpadUp = (gp.buttons[12] && gp.buttons[12].pressed) || axisY < -DEADZONE;
        const dpadDown = (gp.buttons[13] && gp.buttons[13].pressed) || axisY > DEADZONE;
        const dpadLeft = (gp.buttons[14] && gp.buttons[14].pressed) || axisX < -DEADZONE;
        const dpadRight = (gp.buttons[15] && gp.buttons[15].pressed) || axisX > DEADZONE;
        
        // Only trigger on fresh press (edge detection)
        if (gameState === STATE_PLAYING && turnPhase === 'input') {
            if (dpadUp && !gamepadPrevAxes.up) {
                currentPose = 'up';
                poseTimer = POSE_DURATION;
                handleInput('↑');
            }
            if (dpadDown && !gamepadPrevAxes.down) {
                currentPose = 'down';
                poseTimer = POSE_DURATION;
                handleInput('↓');
            }
            if (dpadLeft && !gamepadPrevAxes.left) {
                currentPose = 'left';
                poseTimer = POSE_DURATION;
                handleInput('←');
            }
            if (dpadRight && !gamepadPrevAxes.right) {
                currentPose = 'right';
                poseTimer = POSE_DURATION;
                handleInput('→');
            }
        }
        
        gamepadPrevAxes.up = dpadUp;
        gamepadPrevAxes.down = dpadDown;
        gamepadPrevAxes.left = dpadLeft;
        gamepadPrevAxes.right = dpadRight;
        
        // Only handle first connected gamepad
        break;
    }
}

function startGame() {
    score = { dancer: 0, judoka: 0 };
    currentRound = 0;
    currentTurn = 'dancer';
    gameState = STATE_PLAYING;
    startTurn();
}

function resetGame() {
    gameState = STATE_MENU;
}

function startTurn() {
    turnPhase = 'ready';
    phaseTimer = 0;
    sequenceIndex = 0;
    inputIndex = 0;
    playerInputs = [];
    currentSequence = generateSequence();
    currentMoveName = '';
    moveNameTimer = 0;
    particles = [];
    animFrame = 0;
    currentPose = 'idle';
    poseTimer = 0;
}

function generateSequence() {
    const length = Math.min(3 + Math.floor(currentRound / 2), 7);
    const seq = [];
    for (let i = 0; i < length; i++) {
        seq.push(KEY_NAMES[Math.floor(Math.random() * 4)]);
    }
    return seq;
}

function handleInput(key) {
    if (inputIndex >= currentSequence.length) return;
    
    playerInputs.push(key);
    
    if (key === currentSequence[inputIndex]) {
        spawnParticles(canvas.width / 2, canvas.height / 2, currentTurn === 'dancer' ? '#ff69b4' : '#4fc3f7');
        flashAlpha = 0.3;
    } else {
        flashAlpha = 0.2;
    }
    
    inputIndex++;
    inputTimeout = 0;
    
    if (inputIndex >= currentSequence.length) {
        evaluatePerformance();
    }
}

function evaluatePerformance() {
    let correct = 0;
    for (let i = 0; i < currentSequence.length; i++) {
        if (playerInputs[i] === currentSequence[i]) correct++;
    }
    
    const ratio = correct / currentSequence.length;
    roundStars = ratio >= 0.9 ? 3 : ratio >= 0.6 ? 2 : ratio >= 0.3 ? 1 : 0;
    
    const points = roundStars * 10;
    if (currentTurn === 'dancer') {
        score.dancer += points;
        currentMoveName = DANCER_MOVES[Math.floor(Math.random() * DANCER_MOVES.length)];
    } else {
        score.judoka += points;
        currentMoveName = JUDOKA_MOVES[Math.floor(Math.random() * JUDOKA_MOVES.length)];
    }
    
    moveNameTimer = 120;
    turnPhase = 'result';
    phaseTimer = 0;
    
    if (roundStars >= 2) {
        for (let i = 0; i < 20; i++) {
            spawnParticles(
                Math.random() * canvas.width,
                Math.random() * canvas.height,
                currentTurn === 'dancer' ? '#ff69b4' : '#4fc3f7'
            );
        }
    }
}

function nextTurn() {
    if (currentTurn === 'dancer') {
        currentTurn = 'judoka';
    } else {
        currentTurn = 'dancer';
        currentRound++;
        if (currentRound >= totalRounds) {
            gameState = STATE_GAME_OVER;
            return;
        }
    }
    // IMPORTANT: Switch back to playing state before starting new turn
    gameState = STATE_PLAYING;
    startTurn();
}

function spawnParticles(x, y, color) {
    for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 / 8) * i + Math.random() * 0.5;
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * (2 + Math.random() * 3),
            vy: Math.sin(angle) * (2 + Math.random() * 3),
            life: 1,
            color: color,
            size: 3 + Math.random() * 4
        });
    }
}

function update(dt) {
    animTimer += dt;
    if (animTimer > 8) {
        animTimer = 0;
        animFrame++;
    }
    
    // Update pose timer
    if (poseTimer > 0) {
        poseTimer -= dt;
        if (poseTimer <= 0) {
            currentPose = 'idle';
        }
    }
    
    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 0.1 * dt;
        p.life -= 0.02 * dt;
        if (p.life <= 0) particles.splice(i, 1);
    }
    
    // Flash fade
    if (flashAlpha > 0) flashAlpha -= 0.02 * dt;
    
    // Move name timer
    if (moveNameTimer > 0) moveNameTimer -= dt;
    
    if (gameState !== STATE_PLAYING) return;
    
    phaseTimer += dt;
    
    if (turnPhase === 'ready') {
        if (phaseTimer > 90) {
            turnPhase = 'sequence';
            phaseTimer = 0;
            sequenceIndex = 0;
            sequenceShowTimer = 0;
        }
    } else if (turnPhase === 'sequence') {
        sequenceShowTimer += dt;
        if (sequenceShowTimer > 40) {
            sequenceShowTimer = 0;
            sequenceIndex++;
            if (sequenceIndex >= currentSequence.length) {
                turnPhase = 'input';
                phaseTimer = 0;
                inputTimeout = 0;
                inputIndex = 0;
            }
        }
    } else if (turnPhase === 'input') {
        inputTimeout += dt;
        if (inputTimeout > INPUT_TIME_LIMIT) {
            playerInputs.push('X');
            inputIndex++;
            inputTimeout = 0;
            if (inputIndex >= currentSequence.length) {
                evaluatePerformance();
            }
        }
    } else if (turnPhase === 'result') {
        if (phaseTimer > 120) {
            gameState = STATE_ROUND_RESULT;
            phaseTimer = 0;
        }
    }
}

function draw() {
    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    drawStage();
    
    if (gameState === STATE_MENU) {
        drawMenu();
    } else if (gameState === STATE_PLAYING) {
        drawPlaying();
    } else if (gameState === STATE_ROUND_RESULT) {
        drawRoundResult();
    } else if (gameState === STATE_GAME_OVER) {
        drawGameOver();
    }
    
    drawParticles();
    
    if (flashAlpha > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

function drawStage() {
    const gradient = ctx.createLinearGradient(0, canvas.height - 100, 0, canvas.height);
    gradient.addColorStop(0, '#2d2d5e');
    gradient.addColorStop(1, '#1a1a3e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, canvas.height - 100, canvas.width, 100);
    
    ctx.strokeStyle = '#4a4a8a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(50, canvas.height - 100);
    ctx.lineTo(canvas.width - 50, canvas.height - 100);
    ctx.stroke();
    
    const spotGrad = ctx.createRadialGradient(canvas.width/2, 100, 0, canvas.width/2, 100, 400);
    spotGrad.addColorStop(0, 'rgba(255, 255, 200, 0.03)');
    spotGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = spotGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawMenu() {
    ctx.textAlign = 'center';
    
    ctx.fillStyle = '#ff69b4';
    ctx.font = 'bold 42px sans-serif';
    ctx.fillText('💃 Tanz vs. Judo 🥋', canvas.width/2, 150);
    
    ctx.fillStyle = '#aaa';
    ctx.font = '20px sans-serif';
    ctx.fillText('Das Rhythmus-Duell!', canvas.width/2, 195);
    
    drawDancer(200, 350, 1.5, 'idle');
    drawJudoka(600, 350, 1.5, 'idle');
    
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('VS', canvas.width/2, 360);
    
    ctx.fillStyle = '#ccc';
    ctx.font = '18px sans-serif';
    ctx.fillText('Merke dir die Pfeiltasten-Sequenz', canvas.width/2, 440);
    ctx.fillText('und wiederhole sie im richtigen Moment!', canvas.width/2, 468);
    
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#888';
    ctx.fillText('Steuerung: ← ↑ ↓ → (Pfeiltasten, WASD oder Gamepad)', canvas.width/2, 510);
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px sans-serif';
    const pulse = Math.sin(Date.now() / 500) * 0.3 + 0.7;
    ctx.globalAlpha = pulse;
    ctx.fillText('[ LEERTASTE / A-Button ] zum Starten', canvas.width/2, 560);
    ctx.globalAlpha = 1;
}

// ============================================================
// DANCER DRAWING with pose-based animation
// ============================================================
function drawDancer(x, y, scale, pose) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    
    const bob = Math.sin(animTimer * 0.5) * 3;
    
    // Pose-dependent variables
    let leftArmX, leftArmY, rightArmX, rightArmY;
    let leftLegX, leftLegY, rightLegX, rightLegY;
    let bodyTilt = 0;
    let headOffsetX = 0;
    
    switch (pose) {
        case 'up': // Arabesque - arms up high
            leftArmX = -15; leftArmY = -40;
            rightArmX = 15; rightArmY = -42;
            leftLegX = -5; leftLegY = 45;
            rightLegX = 15; rightLegY = 25; // Leg lifted back
            headOffsetX = 0;
            break;
        case 'down': // Plié - deep knee bend
            leftArmX = -25; leftArmY = 5;
            rightArmX = 25; rightArmY = 5;
            leftLegX = -12; leftLegY = 40;
            rightLegX = 12; rightLegY = 40;
            headOffsetX = 0;
            break;
        case 'left': // Chassé left - lean left with grace
            leftArmX = -30; leftArmY = -20;
            rightArmX = 10; rightArmY = -30;
            leftLegX = -18; leftLegY = 42;
            rightLegX = 5; rightLegY = 45;
            bodyTilt = -0.15;
            headOffsetX = -3;
            break;
        case 'right': // Chassé right - lean right with grace
            leftArmX = -10; leftArmY = -30;
            rightArmX = 30; rightArmY = -20;
            leftLegX = -5; leftLegY = 45;
            rightLegX = 18; rightLegY = 42;
            bodyTilt = 0.15;
            headOffsetX = 3;
            break;
        default: // idle
            const armSwing = Math.sin(animTimer * 0.7) * 0.3;
            leftArmX = -20 + Math.sin(armSwing) * 10;
            leftArmY = -15;
            rightArmX = 20 + Math.cos(armSwing) * 10;
            rightArmY = -20;
            leftLegX = -8; leftLegY = 45;
            rightLegX = 10; rightLegY = 42;
            headOffsetX = 0;
            break;
    }
    
    // Apply body tilt
    if (bodyTilt !== 0) {
        ctx.rotate(bodyTilt);
    }
    
    // Body (dress)
    ctx.fillStyle = '#ff69b4';
    ctx.beginPath();
    ctx.moveTo(0, -10 + bob);
    ctx.lineTo(-15, 30 + bob);
    ctx.lineTo(15, 30 + bob);
    ctx.closePath();
    ctx.fill();
    
    // Dress details
    ctx.strokeStyle = '#ff1493';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-3, 5 + bob);
    ctx.quadraticCurveTo(-12, 20 + bob, -14, 30 + bob);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(3, 5 + bob);
    ctx.quadraticCurveTo(12, 20 + bob, 14, 30 + bob);
    ctx.stroke();
    
    // Head
    ctx.fillStyle = '#ffd5b4';
    ctx.beginPath();
    ctx.arc(headOffsetX, -20 + bob, 10, 0, Math.PI * 2);
    ctx.fill();
    
    // Hair
    ctx.fillStyle = '#8b4513';
    ctx.beginPath();
    ctx.arc(headOffsetX, -24 + bob, 8, Math.PI, Math.PI * 2);
    ctx.fill();
    
    // Hair bun
    ctx.beginPath();
    ctx.arc(headOffsetX, -30 + bob, 5, 0, Math.PI * 2);
    ctx.fill();
    
    // Arms
    ctx.strokeStyle = '#ffd5b4';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    
    // Left arm
    ctx.beginPath();
    ctx.moveTo(-8, -5 + bob);
    ctx.lineTo(leftArmX, leftArmY + bob);
    ctx.stroke();
    
    // Hand (left)
    ctx.fillStyle = '#ffd5b4';
    ctx.beginPath();
    ctx.arc(leftArmX, leftArmY + bob, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Right arm
    ctx.strokeStyle = '#ffd5b4';
    ctx.beginPath();
    ctx.moveTo(8, -5 + bob);
    ctx.lineTo(rightArmX, rightArmY + bob);
    ctx.stroke();
    
    // Hand (right)
    ctx.fillStyle = '#ffd5b4';
    ctx.beginPath();
    ctx.arc(rightArmX, rightArmY + bob, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Legs
    ctx.strokeStyle = '#ffd5b4';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-5, 30 + bob);
    ctx.lineTo(leftLegX, leftLegY + bob);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(5, 30 + bob);
    ctx.lineTo(rightLegX, rightLegY + bob);
    ctx.stroke();
    
    // Ballet shoes
    ctx.fillStyle = '#ff1493';
    ctx.beginPath();
    ctx.ellipse(leftLegX, leftLegY + 2 + bob, 4, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(rightLegX, rightLegY + 2 + bob, 4, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
}

// ============================================================
// JUDOKA DRAWING with pose-based animation
// ============================================================
function drawJudoka(x, y, scale, pose) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    
    const bob = Math.sin(animTimer * 0.4 + 1) * 2;
    
    // Pose-dependent variables
    let leftArmX, leftArmY, rightArmX, rightArmY;
    let leftLegX, leftLegY, rightLegX, rightLegY;
    let bodyTilt = 0;
    
    switch (pose) {
        case 'up': // Seoi Nage - pull up/throw over shoulder
            leftArmX = -10; leftArmY = -35;
            rightArmX = 15; rightArmY = -30;
            leftLegX = -8; leftLegY = 45;
            rightLegX = 5; rightLegY = 42;
            bodyTilt = -0.1;
            break;
        case 'down': // Low sweep - O Soto Gari
            leftArmX = -20; leftArmY = 10;
            rightArmX = 20; rightArmY = 5;
            leftLegX = -6; leftLegY = 45;
            rightLegX = 20; rightLegY = 35; // Sweeping leg
            bodyTilt = 0.1;
            break;
        case 'left': // Tai Otoshi - body drop left
            leftArmX = -28; leftArmY = -10;
            rightArmX = -10; rightArmY = -15;
            leftLegX = -15; leftLegY = 42;
            rightLegX = 2; rightLegY = 45;
            bodyTilt = -0.2;
            break;
        case 'right': // Uchi Mata - inner thigh throw right
            leftArmX = 10; leftArmY = -15;
            rightArmX = 28; rightArmY = -10;
            leftLegX = -2; leftLegY = 45;
            rightLegX = 18; rightLegY = 30; // Leg lifted for throw
            bodyTilt = 0.2;
            break;
        default: // idle - combat stance
            const stance = Math.sin(animTimer * 0.3) * 0.2;
            leftArmX = -20 + stance * 5;
            leftArmY = 5;
            rightArmX = 22 - stance * 5;
            rightArmY = 0;
            leftLegX = -6; leftLegY = 47;
            rightLegX = 6; rightLegY = 47;
            bodyTilt = 0;
            break;
    }
    
    // Apply body tilt
    if (bodyTilt !== 0) {
        ctx.rotate(bodyTilt);
    }
    
    // Body (gi/judogi)
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(-12, -10 + bob, 24, 35);
    
    // Belt
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-12, 8 + bob, 24, 4);
    
    // Gi overlap (V-neck)
    ctx.fillStyle = '#e0e0e0';
    ctx.beginPath();
    ctx.moveTo(-8, -10 + bob);
    ctx.lineTo(0, 2 + bob);
    ctx.lineTo(8, -10 + bob);
    ctx.closePath();
    ctx.fill();
    
    // Head
    ctx.fillStyle = '#ffd5b4';
    ctx.beginPath();
    ctx.arc(0, -20 + bob, 10, 0, Math.PI * 2);
    ctx.fill();
    
    // Short hair
    ctx.fillStyle = '#2c2c2c';
    ctx.beginPath();
    ctx.arc(0, -23 + bob, 9, Math.PI, Math.PI * 2);
    ctx.fill();
    
    // Arms (gi sleeves)
    ctx.strokeStyle = '#e8e8e8';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    
    // Left arm
    ctx.beginPath();
    ctx.moveTo(-12, -5 + bob);
    ctx.lineTo(leftArmX, leftArmY + bob);
    ctx.stroke();
    
    // Right arm
    ctx.beginPath();
    ctx.moveTo(12, -5 + bob);
    ctx.lineTo(rightArmX, rightArmY + bob);
    ctx.stroke();
    
    // Hands
    ctx.fillStyle = '#ffd5b4';
    ctx.beginPath();
    ctx.arc(leftArmX, leftArmY + bob, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rightArmX, rightArmY + bob, 3.5, 0, Math.PI * 2);
    ctx.fill();
    
    // Pants
    ctx.fillStyle = '#f0f0f0';
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 8;
    
    // Left leg
    ctx.beginPath();
    ctx.moveTo(-5, 25 + bob);
    ctx.lineTo(leftLegX, leftLegY + bob);
    ctx.stroke();
    
    // Right leg
    ctx.beginPath();
    ctx.moveTo(5, 25 + bob);
    ctx.lineTo(rightLegX, rightLegY + bob);
    ctx.stroke();
    
    // Feet
    ctx.fillStyle = '#ddd';
    ctx.beginPath();
    ctx.ellipse(leftLegX, leftLegY + 3 + bob, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(rightLegX, rightLegY + 3 + bob, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
}

function drawPlaying() {
    // Score display
    ctx.textAlign = 'center';
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#ff69b4';
    ctx.fillText(`💃 Tänzerin: ${score.dancer}`, 150, 30);
    ctx.fillStyle = '#4fc3f7';
    ctx.fillText(`🥋 Judoka: ${score.judoka}`, canvas.width - 150, 30);
    
    // Round info
    ctx.fillStyle = '#888';
    ctx.font = '14px sans-serif';
    ctx.fillText(`Runde ${currentRound + 1} / ${totalRounds}`, canvas.width/2, 30);
    
    // Current performer
    const isD = currentTurn === 'dancer';
    const color = isD ? '#ff69b4' : '#4fc3f7';
    const emoji = isD ? '💃' : '🥋';
    const name = isD ? 'Tänzerin' : 'Judoka';
    
    // Determine which pose to show
    let displayPose = 'idle';
    if (turnPhase === 'sequence' && sequenceIndex < currentSequence.length) {
        // During sequence display, animate the figure to show the moves
        const arrow = currentSequence[sequenceIndex];
        if (arrow === '↑') displayPose = 'up';
        else if (arrow === '↓') displayPose = 'down';
        else if (arrow === '←') displayPose = 'left';
        else if (arrow === '→') displayPose = 'right';
    } else if (turnPhase === 'input') {
        // During input, show the player's pressed direction
        displayPose = currentPose;
    }
    
    // Draw current performer with pose
    if (isD) {
        drawDancer(canvas.width/2, 280, 2.2, displayPose);
    } else {
        drawJudoka(canvas.width/2, 280, 2.2, displayPose);
    }
    
    ctx.fillStyle = color;
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${emoji} ${name} ist dran!`, canvas.width/2, 70);
    
    if (turnPhase === 'ready') {
        ctx.fillStyle = '#fff';
        ctx.font = '24px sans-serif';
        ctx.fillText('Mach dich bereit...', canvas.width/2, 460);
    } else if (turnPhase === 'sequence') {
        ctx.fillStyle = '#ffd700';
        ctx.font = '18px sans-serif';
        ctx.fillText('Merke dir die Sequenz:', canvas.width/2, 430);
        
        drawSequenceDisplay(canvas.width/2, 480, true);
    } else if (turnPhase === 'input') {
        ctx.fillStyle = '#00ff88';
        ctx.font = '18px sans-serif';
        ctx.fillText('Jetzt DU! Wiederhole die Sequenz:', canvas.width/2, 430);
        
        drawSequenceDisplay(canvas.width/2, 480, false);
        
        // Time bar
        const timeRatio = 1 - (inputTimeout / INPUT_TIME_LIMIT);
        ctx.fillStyle = '#333';
        ctx.fillRect(canvas.width/2 - 100, 530, 200, 10);
        ctx.fillStyle = timeRatio > 0.3 ? '#00ff88' : '#ff4444';
        ctx.fillRect(canvas.width/2 - 100, 530, 200 * timeRatio, 10);
    } else if (turnPhase === 'result') {
        drawStarsDisplay(canvas.width/2, 440, roundStars);
        
        if (moveNameTimer > 0) {
            ctx.fillStyle = color;
            ctx.font = 'bold 22px sans-serif';
            ctx.textAlign = 'center';
            ctx.globalAlpha = Math.min(moveNameTimer / 30, 1);
            ctx.fillText(currentMoveName, canvas.width/2, 500);
            ctx.globalAlpha = 1;
        }
    }
}

function drawSequenceDisplay(x, y, showAll) {
    const totalWidth = currentSequence.length * 50;
    const startX = x - totalWidth / 2 + 25;
    
    for (let i = 0; i < currentSequence.length; i++) {
        const ax = startX + i * 50;
        
        if (showAll) {
            const isActive = i === sequenceIndex;
            ctx.fillStyle = isActive ? '#ffd700' : '#555';
            ctx.fillRect(ax - 18, y - 18, 36, 36);
            ctx.fillStyle = isActive ? '#000' : '#aaa';
            ctx.font = 'bold 22px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(currentSequence[i], ax, y + 8);
        } else {
            if (i < inputIndex) {
                const correct = playerInputs[i] === currentSequence[i];
                ctx.fillStyle = correct ? '#00cc66' : '#cc3333';
                ctx.fillRect(ax - 18, y - 18, 36, 36);
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 22px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(playerInputs[i], ax, y + 8);
            } else if (i === inputIndex) {
                const pulse = Math.sin(Date.now() / 200) * 0.3 + 0.7;
                ctx.strokeStyle = `rgba(0, 255, 136, ${pulse})`;
                ctx.lineWidth = 3;
                ctx.strokeRect(ax - 18, y - 18, 36, 36);
                ctx.fillStyle = '#333';
                ctx.fillRect(ax - 17, y - 17, 34, 34);
                ctx.fillStyle = '#666';
                ctx.font = 'bold 22px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('?', ax, y + 8);
            } else {
                ctx.fillStyle = '#222';
                ctx.fillRect(ax - 18, y - 18, 36, 36);
                ctx.strokeStyle = '#444';
                ctx.lineWidth = 1;
                ctx.strokeRect(ax - 18, y - 18, 36, 36);
            }
        }
    }
}

function drawStarsDisplay(x, y, count) {
    ctx.font = '36px sans-serif';
    ctx.textAlign = 'center';
    let stars = '';
    for (let i = 0; i < 3; i++) {
        stars += i < count ? '⭐' : '☆';
    }
    ctx.fillText(stars, x, y);
    
    const labels = ['Ups...', 'Okay!', 'Gut!', 'Perfekt!'];
    ctx.fillStyle = count === 3 ? '#ffd700' : count === 2 ? '#88cc44' : count === 1 ? '#cc8844' : '#cc4444';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(labels[count], x, y + 40);
}

function drawRoundResult() {
    const isD = currentTurn === 'dancer';
    const color = isD ? '#ff69b4' : '#4fc3f7';
    const emoji = isD ? '💃' : '🥋';
    const name = isD ? 'Tänzerin' : 'Judoka';
    
    // Draw performer in a victory/result pose
    if (isD) {
        drawDancer(canvas.width/2, 250, 2, roundStars >= 2 ? 'up' : 'idle');
    } else {
        drawJudoka(canvas.width/2, 250, 2, roundStars >= 2 ? 'up' : 'idle');
    }
    
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(`${emoji} ${name}`, canvas.width/2, 80);
    
    if (currentMoveName) {
        ctx.fillStyle = '#fff';
        ctx.font = '20px sans-serif';
        ctx.fillText(`"${currentMoveName}"`, canvas.width/2, 115);
    }
    
    drawStarsDisplay(canvas.width/2, 420, roundStars);
    
    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    ctx.fillText(`+${roundStars * 10} Punkte`, canvas.width/2, 490);
    
    // Scores
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#ff69b4';
    ctx.fillText(`💃 ${score.dancer}`, canvas.width/2 - 80, 540);
    ctx.fillStyle = '#4fc3f7';
    ctx.fillText(`🥋 ${score.judoka}`, canvas.width/2 + 80, 540);
    
    // Next
    ctx.fillStyle = '#888';
    ctx.font = '16px sans-serif';
    const pulse = Math.sin(Date.now() / 500) * 0.3 + 0.7;
    ctx.globalAlpha = pulse;
    ctx.fillText('[ LEERTASTE ] für weiter', canvas.width/2, 575);
    ctx.globalAlpha = 1;
}

function drawGameOver() {
    ctx.textAlign = 'center';
    
    const dancerWins = score.dancer > score.judoka;
    const tie = score.dancer === score.judoka;
    
    if (tie) {
        drawDancer(250, 280, 1.8, 'up');
        drawJudoka(550, 280, 1.8, 'up');
    } else if (dancerWins) {
        drawDancer(canvas.width/2, 280, 2.2, 'up');
    } else {
        drawJudoka(canvas.width/2, 280, 2.2, 'up');
    }
    
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 36px sans-serif';
    if (tie) {
        ctx.fillText('🤝 Unentschieden! 🤝', canvas.width/2, 80);
    } else if (dancerWins) {
        ctx.fillText('💃 Tänzerin gewinnt! 💃', canvas.width/2, 80);
    } else {
        ctx.fillText('🥋 Judoka gewinnt! 🥋', canvas.width/2, 80);
    }
    
    ctx.font = '22px sans-serif';
    ctx.fillStyle = '#ff69b4';
    ctx.fillText(`💃 Tänzerin: ${score.dancer} Punkte`, canvas.width/2, 430);
    ctx.fillStyle = '#4fc3f7';
    ctx.fillText(`🥋 Judoka: ${score.judoka} Punkte`, canvas.width/2, 465);
    
    ctx.fillStyle = '#aaa';
    ctx.font = '16px sans-serif';
    if (tie) {
        ctx.fillText('Beide haben gleich gut performt!', canvas.width/2, 510);
    } else if (dancerWins) {
        ctx.fillText('Die eleganten Tanzschritte haben überzeugt!', canvas.width/2, 510);
    } else {
        ctx.fillText('Die kraftvollen Würfe waren unschlagbar!', canvas.width/2, 510);
    }
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px sans-serif';
    const pulse = Math.sin(Date.now() / 500) * 0.3 + 0.7;
    ctx.globalAlpha = pulse;
    ctx.fillText('[ LEERTASTE ] für Neustart', canvas.width/2, 560);
    ctx.globalAlpha = 1;
}

function drawParticles() {
    for (const p of particles) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

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

// Start
requestAnimationFrame(gameLoop);
