const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const TARGET_FPS = 60;
let lastTime = 0;

// Game States
const STATE = { MENU: 0, PLAYING: 1, RESULT: 2, GAME_OVER: 3 };
let gameState = STATE.MENU;

// Game variables
let score = 0;
let strikes = 0;
let ballsThrown = 0;
let difficulty = 1;
let highScore = 0;

// Combo / Streak system
let combo = 0;
let maxCombo = 0;
let comboMultiplier = 1;
let comboFlashTimer = 0;

// Powerups
const POWERUP = { NONE: 0, BIG_BAT: 1, SLOW_MO: 2, DOUBLE_POINTS: 3, SHIELD: 4 };
let activePowerup = POWERUP.NONE;
let powerupTimer = 0;
let powerupMaxTime = 0;
let powerupNotification = '';
let powerupNotifyTimer = 0;

// Powerup thresholds
const POWERUP_COMBOS = [3, 5, 8, 12, 16, 20];
let nextPowerupIndex = 0;

// Particles
let particles = [];

// Ball (3D perspective - comes toward the player)
let ball = { active: false, type: 0 };
let ballTargetX = 0; // -1 to 1 (left to right)
let ballTargetY = 0; // -1 to 1 (top to bottom)

// Crosshair / bat position (player aims with this)
let crosshair = { x: 0, y: 0 }; // -1 to 1 range

// Pitch animation
let pitchProgress = 0; // 0 (far) to 1 (arrived)
let pitchDuration = 70;

// Swing
let swinging = false;
let swingTimer = 0;

// Timing windows
const BASE_PERFECT_WINDOW = 0.08;
const BASE_GOOD_WINDOW = 0.15;
const BASE_OK_WINDOW = 0.25;
let PERFECT_WINDOW = BASE_PERFECT_WINDOW;
let GOOD_WINDOW = BASE_GOOD_WINDOW;
let OK_WINDOW = BASE_OK_WINDOW;

// Hit animation
let hitEffect = null;

// Gamepad
let gamepadConnected = false;
let prevGamepadButtons = {};

// Stats
let hits = 0;
let homeRuns = 0;

// Crosshair movement speed
const CROSSHAIR_SPEED = 0.04;

// Strike zone dimensions on screen (perspective)
const ZONE_CENTER_X = canvas.width / 2;
const ZONE_CENTER_Y = canvas.height / 2 + 20;
const ZONE_WIDTH = 220;
const ZONE_HEIGHT = 180;

// Result display
let resultText = '';
let resultTimer = 0;
let resultColor = '#fff';
let resultSubText = '';

function resetGame() {
    score = 0;
    strikes = 0;
    ballsThrown = 0;
    difficulty = 1;
    hits = 0;
    homeRuns = 0;
    combo = 0;
    maxCombo = 0;
    comboMultiplier = 1;
    comboFlashTimer = 0;
    activePowerup = POWERUP.NONE;
    powerupTimer = 0;
    powerupNotification = '';
    powerupNotifyTimer = 0;
    nextPowerupIndex = 0;
    particles = [];
    crosshair.x = 0;
    crosshair.y = 0;
    swinging = false;
    swingTimer = 0;
    ball.active = false;
    hitEffect = null;
    resultText = '';
    resultSubText = '';
    resultTimer = 0;
    PERFECT_WINDOW = BASE_PERFECT_WINDOW;
    GOOD_WINDOW = BASE_GOOD_WINDOW;
    OK_WINDOW = BASE_OK_WINDOW;
    gameState = STATE.PLAYING;
    throwBall();
}

function throwBall() {
    ball.active = true;
    pitchProgress = 0;
    
    difficulty = 1 + Math.floor(ballsThrown / 5) * 0.3;
    pitchDuration = Math.max(35, 75 - difficulty * 5);
    
    if (activePowerup === POWERUP.SLOW_MO) {
        pitchDuration *= 1.5;
    }
    
    // Random target position in strike zone (-0.8 to 0.8)
    ballTargetX = (Math.random() - 0.5) * 1.6;
    ballTargetY = (Math.random() - 0.5) * 1.4;
    
    // Ball type
    const rand = Math.random();
    if (difficulty > 2 && rand < 0.3) {
        ball.type = 1; // curve
    } else if (difficulty > 3 && rand < 0.5) {
        ball.type = 2; // fast
        pitchDuration *= 0.7;
    } else {
        ball.type = 0; // straight
    }
    
    // Big bat powerup
    if (activePowerup === POWERUP.BIG_BAT) {
        PERFECT_WINDOW = BASE_PERFECT_WINDOW * 1.8;
        GOOD_WINDOW = BASE_GOOD_WINDOW * 1.5;
        OK_WINDOW = BASE_OK_WINDOW * 1.3;
    } else {
        PERFECT_WINDOW = BASE_PERFECT_WINDOW;
        GOOD_WINDOW = BASE_GOOD_WINDOW;
        OK_WINDOW = BASE_OK_WINDOW;
    }
    
    ballsThrown++;
}

function swing() {
    if (swinging || !ball.active) return;
    swinging = true;
    swingTimer = 0;
    
    const timing = pitchProgress;
    
    // Distance between crosshair and ball target
    const dx = crosshair.x - ballTargetX;
    const dy = crosshair.y - ballTargetY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Aim accuracy thresholds
    const perfectAim = activePowerup === POWERUP.BIG_BAT ? 0.45 : 0.3;
    const goodAim = activePowerup === POWERUP.BIG_BAT ? 0.7 : 0.55;
    const okAim = activePowerup === POWERUP.BIG_BAT ? 1.0 : 0.8;
    
    let hitQuality = 0;
    
    if (timing >= (1 - PERFECT_WINDOW) && timing <= 1) {
        if (dist <= perfectAim) hitQuality = 5;
        else if (dist <= goodAim) hitQuality = 4;
        else if (dist <= okAim) hitQuality = 2;
        else hitQuality = 1;
    } else if (timing >= (1 - GOOD_WINDOW) && timing < (1 - PERFECT_WINDOW)) {
        if (dist <= perfectAim) hitQuality = 4;
        else if (dist <= goodAim) hitQuality = 3;
        else if (dist <= okAim) hitQuality = 2;
        else hitQuality = 1;
    } else if (timing >= (1 - OK_WINDOW) && timing < (1 - GOOD_WINDOW)) {
        if (dist <= goodAim) hitQuality = 2;
        else if (dist <= okAim) hitQuality = 1;
        else hitQuality = 0;
    } else {
        hitQuality = 0;
    }
    
    applyHitResult(hitQuality);
}

function applyHitResult(quality) {
    ball.active = false;
    resultSubText = '';
    
    let points = 0;
    
    switch(quality) {
        case 0:
            if (activePowerup === POWERUP.SHIELD) {
                resultText = '🛡️ SHIELD!';
                resultColor = '#44ffff';
                activePowerup = POWERUP.NONE;
                powerupTimer = 0;
                resultSubText = 'Schild aufgebraucht!';
                break;
            }
            resultText = 'STRIKE!';
            resultColor = '#ff4444';
            strikes++;
            combo = 0;
            comboMultiplier = 1;
            nextPowerupIndex = 0;
            if (strikes >= 3) {
                resultText = 'STRIKEOUT!';
                resultTimer = 120;
                gameState = STATE.RESULT;
                return;
            }
            break;
        case 1:
            resultText = 'FOUL BALL';
            resultColor = '#ffaa00';
            if (strikes < 2) strikes++;
            combo = 0;
            comboMultiplier = 1;
            nextPowerupIndex = 0;
            break;
        case 2:
            points = 10;
            combo++;
            break;
        case 3:
            points = 25;
            combo++;
            break;
        case 4:
            points = 50;
            combo++;
            break;
        case 5:
            points = 100;
            combo++;
            break;
    }
    
    if (quality >= 2) {
        if (combo >= 10) comboMultiplier = 4;
        else if (combo >= 7) comboMultiplier = 3;
        else if (combo >= 4) comboMultiplier = 2;
        else if (combo >= 2) comboMultiplier = 1.5;
        else comboMultiplier = 1;
        
        if (activePowerup === POWERUP.DOUBLE_POINTS) points *= 2;
        
        const finalPoints = Math.round(points * comboMultiplier);
        score += finalPoints;
        hits++;
        if (quality === 5) homeRuns++;
        
        if (combo > maxCombo) maxCombo = combo;
        
        const hitNames = ['', '', 'SINGLE', 'DOUBLE', 'TRIPLE', 'HOME RUN'];
        resultText = hitNames[quality] + '! +' + finalPoints;
        resultColor = quality === 5 ? '#ffff00' : quality === 4 ? '#ff44ff' : quality === 3 ? '#44ffff' : '#44ff44';
        
        if (comboMultiplier > 1) {
            resultSubText = '🔥 ' + combo + 'x COMBO! (x' + comboMultiplier + ')';
            comboFlashTimer = 30;
        } else if (combo >= 2) {
            resultSubText = combo + 'x Combo';
        }
        
        checkPowerupUnlock();
        spawnHitParticles(quality);
        hitEffect = { timer: 20, quality: quality };
    }
    
    resultTimer = 80;
    gameState = STATE.RESULT;
}

function checkPowerupUnlock() {
    if (nextPowerupIndex < POWERUP_COMBOS.length && combo >= POWERUP_COMBOS[nextPowerupIndex]) {
        const available = [POWERUP.BIG_BAT, POWERUP.SLOW_MO, POWERUP.DOUBLE_POINTS, POWERUP.SHIELD];
        activatePowerup(available[Math.floor(Math.random() * available.length)]);
        nextPowerupIndex++;
    }
}

function activatePowerup(type) {
    activePowerup = type;
    
    switch(type) {
        case POWERUP.BIG_BAT:
            powerupMaxTime = 180;
            powerupNotification = '⚡ GROSSER SCHLÄGER!';
            break;
        case POWERUP.SLOW_MO:
            powerupMaxTime = 180;
            powerupNotification = '🐢 SLOW-MO!';
            break;
        case POWERUP.DOUBLE_POINTS:
            powerupMaxTime = 240;
            powerupNotification = '💎 DOPPELTE PUNKTE!';
            break;
        case POWERUP.SHIELD:
            powerupMaxTime = 9999;
            powerupNotification = '🛡️ SCHILD!';
            break;
    }
    
    powerupTimer = powerupMaxTime;
    powerupNotifyTimer = 100;
    
    for (let i = 0; i < 25; i++) {
        particles.push({
            x: canvas.width / 2 + (Math.random() - 0.5) * 300,
            y: canvas.height / 2 + (Math.random() - 0.5) * 200,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 0.5) * 5,
            life: 50 + Math.random() * 40,
            maxLife: 90,
            color: ['#ff0', '#f0f', '#0ff', '#0f0', '#f90'][Math.floor(Math.random() * 5)],
            size: 3 + Math.random() * 4
        });
    }
}

function spawnHitParticles(quality) {
    const count = quality * 6;
    const colors = ['#ffff00', '#ff8800', '#ff4444', '#ff00ff', '#00ffff', '#ffffff'];
    const bx = ZONE_CENTER_X + ballTargetX * ZONE_WIDTH / 2;
    const by = ZONE_CENTER_Y + ballTargetY * ZONE_HEIGHT / 2;
    for (let i = 0; i < count; i++) {
        particles.push({
            x: bx,
            y: by,
            vx: (Math.random() - 0.5) * 12,
            vy: (Math.random() - 0.5) * 10,
            life: 25 + Math.random() * 35,
            maxLife: 60,
            color: colors[Math.floor(Math.random() * colors.length)],
            size: 2 + Math.random() * 4
        });
    }
}

function ballMissed() {
    ball.active = false;
    
    if (activePowerup === POWERUP.SHIELD) {
        resultText = '🛡️ SHIELD!';
        resultColor = '#44ffff';
        activePowerup = POWERUP.NONE;
        powerupTimer = 0;
        resultSubText = 'Schild aufgebraucht!';
        resultTimer = 80;
        gameState = STATE.RESULT;
        return;
    }
    
    resultText = 'STRIKE!';
    resultColor = '#ff4444';
    resultSubText = '';
    strikes++;
    combo = 0;
    comboMultiplier = 1;
    nextPowerupIndex = 0;
    resultTimer = 80;
    
    if (strikes >= 3) {
        resultText = 'STRIKEOUT!';
        resultTimer = 120;
        gameState = STATE.GAME_OVER;
    } else {
        gameState = STATE.RESULT;
    }
}

// Input
const keys = {};
const keysDown = {};

document.addEventListener('keydown', (e) => {
    if (!keys[e.code]) keysDown[e.code] = true;
    keys[e.code] = true;
    
    if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (gameState === STATE.MENU || gameState === STATE.GAME_OVER) {
            resetGame();
        } else if (gameState === STATE.PLAYING) {
            swing();
        }
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// Gamepad
function pollGamepad() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < gamepads.length; i++) {
        const gp = gamepads[i];
        if (!gp) continue;
        gamepadConnected = true;
        
        const axisX = gp.axes[0] || 0;
        const axisY = gp.axes[1] || 0;
        const DEADZONE = 0.15;
        
        if (Math.abs(axisX) > DEADZONE) crosshair.x += axisX * CROSSHAIR_SPEED * 1.2;
        if (Math.abs(axisY) > DEADZONE) crosshair.y += axisY * CROSSHAIR_SPEED * 1.2;
        
        if (gp.buttons[14] && gp.buttons[14].pressed) crosshair.x -= CROSSHAIR_SPEED;
        if (gp.buttons[15] && gp.buttons[15].pressed) crosshair.x += CROSSHAIR_SPEED;
        if (gp.buttons[12] && gp.buttons[12].pressed) crosshair.y -= CROSSHAIR_SPEED;
        if (gp.buttons[13] && gp.buttons[13].pressed) crosshair.y += CROSSHAIR_SPEED;
        
        crosshair.x = Math.max(-1, Math.min(1, crosshair.x));
        crosshair.y = Math.max(-1, Math.min(1, crosshair.y));
        
        const actionPressed = (gp.buttons[0] && gp.buttons[0].pressed) || (gp.buttons[2] && gp.buttons[2].pressed);
        if (actionPressed && !prevGamepadButtons['action']) {
            if (gameState === STATE.MENU || gameState === STATE.GAME_OVER) {
                resetGame();
            } else if (gameState === STATE.PLAYING) {
                swing();
            }
        }
        prevGamepadButtons['action'] = actionPressed;
        
        break;
    }
}

// Update
function update(dt) {
    pollGamepad();
    
    // Keyboard crosshair movement
    if (gameState === STATE.PLAYING) {
        if (keys['ArrowLeft'] || keys['KeyA']) crosshair.x -= CROSSHAIR_SPEED * dt;
        if (keys['ArrowRight'] || keys['KeyD']) crosshair.x += CROSSHAIR_SPEED * dt;
        if (keys['ArrowUp'] || keys['KeyW']) crosshair.y -= CROSSHAIR_SPEED * dt;
        if (keys['ArrowDown'] || keys['KeyS']) crosshair.y += CROSSHAIR_SPEED * dt;
        crosshair.x = Math.max(-1, Math.min(1, crosshair.x));
        crosshair.y = Math.max(-1, Math.min(1, crosshair.y));
    }
    
    // Powerup timer
    if (activePowerup !== POWERUP.NONE && activePowerup !== POWERUP.SHIELD) {
        powerupTimer -= dt;
        if (powerupTimer <= 0) {
            activePowerup = POWERUP.NONE;
            powerupTimer = 0;
            PERFECT_WINDOW = BASE_PERFECT_WINDOW;
            GOOD_WINDOW = BASE_GOOD_WINDOW;
            OK_WINDOW = BASE_OK_WINDOW;
        }
    }
    
    if (powerupNotifyTimer > 0) powerupNotifyTimer -= dt;
    if (comboFlashTimer > 0) comboFlashTimer -= dt;
    
    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 0.15 * dt;
        p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
    }
    
    // Hit effect
    if (hitEffect) {
        hitEffect.timer -= dt;
        if (hitEffect.timer <= 0) hitEffect = null;
    }
    
    if (gameState === STATE.PLAYING) {
        if (ball.active) {
            pitchProgress += (dt / pitchDuration);
            if (pitchProgress >= 1.12) ballMissed();
        }
        
        if (swinging) {
            swingTimer += dt;
            if (swingTimer > 12) {
                swinging = false;
                swingTimer = 0;
            }
        }
    }
    
    if (gameState === STATE.RESULT) {
        resultTimer -= dt;
        if (resultTimer <= 0) {
            if (strikes >= 3) {
                gameState = STATE.GAME_OVER;
            } else {
                gameState = STATE.PLAYING;
                throwBall();
                swinging = false;
            }
        }
    }
    
    for (const k in keysDown) keysDown[k] = false;
}

// ============= DRAW (First-person perspective) =============

function drawBackground() {
    // Stadium background from batter's perspective
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#0a0a1a');
    grad.addColorStop(0.3, '#1a1a3a');
    grad.addColorStop(0.6, '#2d5a27');
    grad.addColorStop(1, '#1a3a1a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Perspective field lines
    ctx.strokeStyle = '#ffffff0a';
    ctx.lineWidth = 1;
    const vanishX = canvas.width / 2;
    const vanishY = canvas.height * 0.32;
    
    ctx.beginPath();
    ctx.moveTo(0, canvas.height);
    ctx.lineTo(vanishX, vanishY);
    ctx.moveTo(canvas.width, canvas.height);
    ctx.lineTo(vanishX, vanishY);
    ctx.stroke();
    
    // Pitcher's mound
    ctx.fillStyle = '#A0782C88';
    ctx.beginPath();
    ctx.ellipse(vanishX, vanishY + 30, 15, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Pitcher silhouette
    ctx.fillStyle = '#00000066';
    ctx.fillRect(vanishX - 5, vanishY + 5, 10, 25);
    ctx.beginPath();
    ctx.arc(vanishX, vanishY + 2, 6, 0, Math.PI * 2);
    ctx.fill();
    
    // Stadium lights
    ctx.fillStyle = '#ffff8833';
    for (let i = 0; i < 6; i++) {
        const lx = 100 + i * 130;
        const ly = 25 + Math.sin(i) * 8;
        ctx.beginPath();
        ctx.arc(lx, ly, 4, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Crowd
    ctx.fillStyle = '#1a1a2a';
    for (let i = 0; i < canvas.width; i += 8) {
        const h = 12 + Math.sin(i * 0.1) * 4 + Math.cos(i * 0.23) * 3;
        ctx.fillRect(i, canvas.height * 0.18 - h, 8, h);
    }
}

function drawStrikeZone3D() {
    const x = ZONE_CENTER_X - ZONE_WIDTH / 2;
    const y = ZONE_CENTER_Y - ZONE_HEIGHT / 2;
    
    // Outer frame
    ctx.strokeStyle = '#ffffff33';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, ZONE_WIDTH, ZONE_HEIGHT);
    
    // Grid lines (3x3)
    ctx.strokeStyle = '#ffffff1a';
    ctx.lineWidth = 1;
    for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(x + (ZONE_WIDTH / 3) * i, y);
        ctx.lineTo(x + (ZONE_WIDTH / 3) * i, y + ZONE_HEIGHT);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y + (ZONE_HEIGHT / 3) * i);
        ctx.lineTo(x + ZONE_WIDTH, y + (ZONE_HEIGHT / 3) * i);
        ctx.stroke();
    }
    
    // Corner markers
    const cs = 15;
    ctx.strokeStyle = '#ffffff55';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y + cs); ctx.lineTo(x, y); ctx.lineTo(x + cs, y); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + ZONE_WIDTH - cs, y); ctx.lineTo(x + ZONE_WIDTH, y); ctx.lineTo(x + ZONE_WIDTH, y + cs); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y + ZONE_HEIGHT - cs); ctx.lineTo(x, y + ZONE_HEIGHT); ctx.lineTo(x + cs, y + ZONE_HEIGHT); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + ZONE_WIDTH - cs, y + ZONE_HEIGHT); ctx.lineTo(x + ZONE_WIDTH, y + ZONE_HEIGHT); ctx.lineTo(x + ZONE_WIDTH, y + ZONE_HEIGHT - cs); ctx.stroke();
}

function drawBall3D() {
    if (!ball.active) return;
    
    const progress = Math.min(pitchProgress, 1.1);
    const vanishX = canvas.width / 2;
    const vanishY = canvas.height * 0.35;
    
    const targetScreenX = ZONE_CENTER_X + ballTargetX * ZONE_WIDTH / 2;
    const targetScreenY = ZONE_CENTER_Y + ballTargetY * ZONE_HEIGHT / 2;
    
    // Ease-in for approaching speed
    const easedProgress = progress * progress;
    
    let bx = vanishX + (targetScreenX - vanishX) * easedProgress;
    let by = vanishY + (targetScreenY - vanishY) * easedProgress;
    
    // Curve ball
    if (ball.type === 1) {
        bx += Math.sin(progress * Math.PI) * 40 * progress;
    }
    
    // Ball size grows as it approaches
    const size = 3 + easedProgress * 22;
    
    // Slow-mo trail
    if (activePowerup === POWERUP.SLOW_MO) {
        for (let t = 1; t <= 4; t++) {
            const trailP = Math.max(0, progress - t * 0.04);
            const trailEased = trailP * trailP;
            const tx = vanishX + (targetScreenX - vanishX) * trailEased;
            const ty = vanishY + (targetScreenY - vanishY) * trailEased;
            const ts = 3 + trailEased * 22;
            ctx.fillStyle = 'rgba(255,255,255,' + (0.15 - t * 0.03) + ')';
            ctx.beginPath();
            ctx.arc(tx, ty, ts * 0.6, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // Ball glow when close
    if (progress > 0.7) {
        const glowAlpha = (progress - 0.7) * 0.4;
        ctx.fillStyle = 'rgba(255,255,200,' + glowAlpha + ')';
        ctx.beginPath();
        ctx.arc(bx, by, size * 1.6, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Ball
    const ballGrad = ctx.createRadialGradient(bx - size * 0.3, by - size * 0.3, size * 0.1, bx, by, size);
    ballGrad.addColorStop(0, '#ffffff');
    ballGrad.addColorStop(0.7, '#eeeedd');
    ballGrad.addColorStop(1, '#aaaaaa');
    ctx.fillStyle = ballGrad;
    ctx.beginPath();
    ctx.arc(bx, by, size, 0, Math.PI * 2);
    ctx.fill();
    
    // Stitching
    if (size > 8) {
        ctx.strokeStyle = '#cc0000';
        ctx.lineWidth = Math.max(1, size * 0.08);
        ctx.beginPath();
        ctx.arc(bx, by, size * 0.55, -0.6, 0.6);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(bx, by, size * 0.55, Math.PI - 0.6, Math.PI + 0.6);
        ctx.stroke();
    }
    
    // Fast ball speed lines
    if (ball.type === 2 && progress < 0.8) {
        ctx.strokeStyle = '#ffff0044';
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
            const lx = bx - (size + 5 + i * 8);
            const ly = by - 5 + i * 5;
            ctx.beginPath();
            ctx.moveTo(lx, ly);
            ctx.lineTo(lx - 10 - i * 3, ly);
            ctx.stroke();
        }
    }
}

function drawCrosshair() {
    const cx = ZONE_CENTER_X + crosshair.x * ZONE_WIDTH / 2;
    const cy = ZONE_CENTER_Y + crosshair.y * ZONE_HEIGHT / 2;
    
    const size = activePowerup === POWERUP.BIG_BAT ? 28 : 20;
    const color = activePowerup === POWERUP.BIG_BAT ? '#ffcc00' : '#ffffff';
    
    const swingOffset = swinging ? Math.sin(swingTimer * 0.8) * 8 : 0;
    
    ctx.save();
    ctx.translate(cx + swingOffset, cy);
    
    // Outer circle
    ctx.strokeStyle = color + '88';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.stroke();
    
    // Crosshair lines
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    const gap = 6;
    ctx.beginPath(); ctx.moveTo(0, -size); ctx.lineTo(0, -gap); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, gap); ctx.lineTo(0, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-size, 0); ctx.lineTo(-gap, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(gap, 0); ctx.lineTo(size, 0); ctx.stroke();
    
    // Center dot
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Big bat ring
    if (activePowerup === POWERUP.BIG_BAT) {
        ctx.strokeStyle = '#ffcc0044';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, size + 8, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    // Shield ring
    if (activePowerup === POWERUP.SHIELD) {
        ctx.strokeStyle = '#44ffff44';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, size + 14, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    ctx.restore();
}

function drawHitEffect() {
    if (!hitEffect) return;
    
    const alpha = hitEffect.timer / 20;
    const colors = ['', '', '#44ff4422', '#44ffff22', '#ff44ff22', '#ffff0033'];
    if (hitEffect.quality >= 2) {
        ctx.fillStyle = colors[hitEffect.quality];
        ctx.globalAlpha = alpha * 0.5;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
    }
}

function drawTimingBar() {
    if (!ball.active || gameState !== STATE.PLAYING) return;
    
    const barW = 180;
    const barH = 8;
    const barX = canvas.width / 2 - barW / 2;
    const barY = canvas.height - 35;
    
    ctx.fillStyle = '#22222288';
    ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);
    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barW, barH);
    
    const sweetStart = barW * (1 - OK_WINDOW);
    ctx.fillStyle = '#44662244';
    ctx.fillRect(barX + sweetStart, barY, barW - sweetStart, barH);
    
    const goodStart = barW * (1 - GOOD_WINDOW);
    ctx.fillStyle = '#44ff4444';
    ctx.fillRect(barX + goodStart, barY, barW - goodStart, barH);
    
    const perfectStart = barW * (1 - PERFECT_WINDOW);
    ctx.fillStyle = '#ffff0066';
    ctx.fillRect(barX + perfectStart, barY, barW - perfectStart, barH);
    
    const posX = barX + Math.min(pitchProgress, 1) * barW;
    ctx.fillStyle = '#fff';
    ctx.fillRect(posX - 1.5, barY - 3, 3, barH + 6);
    
    ctx.fillStyle = '#888';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TIMING', barX + barW / 2, barY - 6);
}

function drawCombo() {
    if (combo < 2) return;
    
    const cx = canvas.width - 65;
    const cy = 65;
    
    const flashScale = comboFlashTimer > 0 ? 1 + (comboFlashTimer / 30) * 0.3 : 1;
    const radius = 24 * flashScale;
    
    let comboColor;
    if (combo >= 10) comboColor = '#ff00ff';
    else if (combo >= 7) comboColor = '#ffff00';
    else if (combo >= 4) comboColor = '#ff8800';
    else comboColor = '#44ff44';
    
    ctx.fillStyle = comboColor + '22';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = comboColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.fillStyle = comboColor;
    ctx.font = 'bold ' + Math.round(18 * flashScale) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(combo + 'x', cx, cy + 6);
    
    ctx.fillStyle = '#fff';
    ctx.font = '9px sans-serif';
    ctx.fillText('COMBO', cx, cy + 20);
    
    if (comboMultiplier > 1) {
        ctx.fillStyle = '#ffff00';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText('x' + comboMultiplier, cx, cy - 16);
    }
    
    if (nextPowerupIndex < POWERUP_COMBOS.length) {
        const target = POWERUP_COMBOS[nextPowerupIndex];
        const prog = combo / target;
        ctx.fillStyle = '#ffffff44';
        ctx.font = '8px sans-serif';
        ctx.fillText(combo + '/' + target, cx, cy + 32);
        ctx.fillStyle = '#333';
        ctx.fillRect(cx - 16, cy + 35, 32, 3);
        ctx.fillStyle = '#ff8800';
        ctx.fillRect(cx - 16, cy + 35, 32 * Math.min(prog, 1), 3);
    }
}

function drawPowerupUI() {
    if (activePowerup === POWERUP.NONE) return;
    
    let icon, name, color;
    switch(activePowerup) {
        case POWERUP.BIG_BAT: icon = '⚡'; name = 'GROSSER SCHLÄGER'; color = '#ffcc00'; break;
        case POWERUP.SLOW_MO: icon = '🐢'; name = 'SLOW-MO'; color = '#88ffff'; break;
        case POWERUP.DOUBLE_POINTS: icon = '💎'; name = 'DOPPELTE PUNKTE'; color = '#ff88ff'; break;
        case POWERUP.SHIELD: icon = '🛡️'; name = 'SCHILD'; color = '#44ffff'; break;
    }
    
    const px = canvas.width / 2;
    const py = 15;
    
    ctx.fillStyle = color;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(icon + ' ' + name, px, py);
    
    if (activePowerup !== POWERUP.SHIELD) {
        const barW = 100;
        const barX = px - barW / 2;
        const barY = py + 5;
        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, barW, 4);
        ctx.fillStyle = color;
        ctx.fillRect(barX, barY, barW * (powerupTimer / powerupMaxTime), 4);
    }
    
    if (powerupNotifyTimer > 0) {
        const alpha = Math.min(powerupNotifyTimer / 20, 1);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText(powerupNotification, canvas.width / 2, canvas.height / 2 - 80);
        ctx.globalAlpha = 1;
    }
}

function drawUI() {
    // Score
    ctx.fillStyle = activePowerup === POWERUP.DOUBLE_POINTS ? '#ff88ff' : '#fff';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score, 15, 25);
    
    // Strikes
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#ff6666';
    ctx.fillText('Strikes:', 15, 48);
    for (let i = 0; i < 3; i++) {
        ctx.fillStyle = i < strikes ? '#ff4444' : '#333';
        ctx.beginPath();
        ctx.arc(82 + i * 18, 44, 6, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Level
    ctx.fillStyle = '#888';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Lv.' + Math.floor(difficulty), 15, 66);
    
    // Ball type
    if (ball.active && pitchProgress > 0.2) {
        const typeNames = ['', 'KURVE', 'SCHNELL'];
        const typeColors = ['', '#ff88ff', '#ffff44'];
        if (ball.type > 0) {
            ctx.fillStyle = typeColors[ball.type];
            ctx.font = 'bold 12px sans-serif';
            ctx.fillText(typeNames[ball.type], 15, 84);
        }
    }
    
    drawTimingBar();
    drawCombo();
    drawPowerupUI();
}

function drawResult() {
    if (resultTimer <= 0 && gameState !== STATE.RESULT) return;
    
    ctx.fillStyle = resultColor;
    ctx.font = 'bold 38px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(resultText, canvas.width / 2, canvas.height / 2 - 30);
    
    if (resultSubText) {
        ctx.fillStyle = '#ffaa00';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText(resultSubText, canvas.width / 2, canvas.height / 2 + 10);
    }
}

function drawParticles() {
    for (const p of particles) {
        const alpha = p.life / p.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function drawMenu() {
    drawBackground();
    
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.textAlign = 'center';
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 52px sans-serif';
    ctx.fillText('🏏 CRAZY BALL', canvas.width/2, 90);
    
    ctx.fillStyle = '#ccc';
    ctx.font = '16px sans-serif';
    ctx.fillText('Erste-Person-Perspektive – du bist der Schlagmann!', canvas.width/2, 125);
    
    ctx.fillStyle = '#ffaa00';
    ctx.font = '13px sans-serif';
    ctx.fillText('🔥 Combo-Treffer = Bonus-Multiplikator & Powerups!', canvas.width/2, 165);
    
    ctx.fillStyle = '#888';
    ctx.font = '12px sans-serif';
    ctx.fillText('⚡ Großer Schläger | 🐢 Slow-Mo | 💎 Doppelte Punkte | 🛡️ Schild', canvas.width/2, 190);
    
    ctx.fillStyle = '#88ccff';
    ctx.font = '15px sans-serif';
    ctx.fillText('⬆⬇⬅➡ / WASD = Fadenkreuz bewegen', canvas.width/2, 260);
    ctx.fillText('LEERTASTE / ENTER = Schlagen', canvas.width/2, 285);
    
    ctx.fillStyle = '#88ff88';
    ctx.font = '14px sans-serif';
    ctx.fillText('🎮 Gamepad: Stick/D-Pad zielen + A-Taste schlagen', canvas.width/2, 320);
    
    ctx.fillStyle = '#aaa';
    ctx.font = '13px sans-serif';
    ctx.fillText('Bewege das Fadenkreuz auf den Ball und schlage im richtigen Moment!', canvas.width/2, 365);
    
    ctx.fillStyle = '#ffff44';
    ctx.font = 'bold 20px sans-serif';
    const blink = Math.sin(Date.now() / 400) > 0;
    if (blink) ctx.fillText('LEERTASTE zum Starten', canvas.width/2, 420);
    
    if (highScore > 0) {
        ctx.fillStyle = '#ffaa00';
        ctx.font = '13px sans-serif';
        ctx.fillText('Highscore: ' + highScore, canvas.width/2, 460);
    }
}

function drawGameOver() {
    drawBackground();
    drawStrikeZone3D();
    
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.textAlign = 'center';
    
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 42px sans-serif';
    ctx.fillText('GAME OVER', canvas.width/2, 100);
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('Score: ' + score, canvas.width/2, 160);
    
    ctx.fillStyle = '#aaa';
    ctx.font = '15px sans-serif';
    ctx.fillText('Bälle: ' + ballsThrown + '   Treffer: ' + hits + '   Home Runs: ' + homeRuns, canvas.width/2, 200);
    
    if (maxCombo >= 2) {
        ctx.fillStyle = '#ffaa00';
        ctx.font = 'bold 15px sans-serif';
        ctx.fillText('🔥 Beste Combo: ' + maxCombo + 'x', canvas.width/2, 235);
    }
    
    if (score > highScore) {
        highScore = score;
        ctx.fillStyle = '#ffff00';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText('⭐ NEUER HIGHSCORE! ⭐', canvas.width/2, 280);
    } else {
        ctx.fillStyle = '#888';
        ctx.font = '13px sans-serif';
        ctx.fillText('Highscore: ' + highScore, canvas.width/2, 280);
    }
    
    ctx.fillStyle = '#88ff88';
    ctx.font = 'bold 20px sans-serif';
    const blink = Math.sin(Date.now() / 400) > 0;
    if (blink) ctx.fillText('LEERTASTE für Neustart', canvas.width/2, 360);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (gameState === STATE.MENU) { drawMenu(); return; }
    if (gameState === STATE.GAME_OVER) { drawGameOver(); return; }
    
    drawBackground();
    drawStrikeZone3D();
    drawBall3D();
    drawCrosshair();
    drawHitEffect();
    drawParticles();
    drawUI();
    drawResult();
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

requestAnimationFrame(gameLoop);
