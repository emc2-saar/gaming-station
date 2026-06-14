const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const TARGET_FPS = 60;
let lastTime = 0;

// Game states: 'menu', 'playing', 'gameover'
let gameState = 'menu';
let score = 0;
let combo = 0;
let maxCombo = 0;
let crowd = 0; // 0-100 Stimmung im Stadion
let hits = 0;
let misses = 0;
let totalNotes = 0;

// Lanes
const LANE_COUNT = 4;
const LANE_WIDTH = 100;
const LANE_GAP = 10;
const TOTAL_WIDTH = LANE_COUNT * LANE_WIDTH + (LANE_COUNT - 1) * LANE_GAP;
const LANE_START_X = (canvas.width - TOTAL_WIDTH) / 2;
const HIT_ZONE_Y = canvas.height - 100;
const HIT_ZONE_HEIGHT = 20;
const HIT_TOLERANCE = 50;

// Lane keys
const LANE_KEYS = ['ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight'];
const LANE_LABELS = ['←', '↓', '↑', '→'];
const LANE_COLORS = ['#ff4444', '#44ff44', '#4444ff', '#ffff44'];
const LANE_GLOW = ['#ff6666', '#66ff66', '#6666ff', '#ffff66'];

// Notes
let notes = [];
let noteSpeed = 4;
let spawnAccumulator = 0;
let spawnInterval = 45;
let difficultyTimer = 0;

// Visual effects
let laneFlash = [0, 0, 0, 0];
let hitEffects = [];
let crowdWave = 0;
let shakeTimer = 0;
let shakeIntensity = 0;

// Patterns
const PATTERNS = [
    [0], [1], [2], [3],
    [0, 2], [1, 3], [0, 3], [1, 2],
    [0, 1], [2, 3],
    [0, 1, 2], [1, 2, 3],
    [0, 1, 2, 3]
];

// Gamepad
let gamepadLanePressed = [false, false, false, false];

// Chant messages
const CHANTS = [
    "OLÉ OLÉ OLÉ!",
    "HIER REGIERT DER FAN!",
    "STIMMUNG!",
    "MEGA!",
    "TOR TOR TOR!",
    "WELTKLASSE!",
    "DIE KURVE BEBT!",
    "GÄNSEHAUT!"
];
let currentChant = '';
let chantTimer = 0;

// Ratings
const RATINGS = {
    perfect: { text: 'PERFEKT!', color: '#ffdd00' },
    great: { text: 'SUPER!', color: '#44ff44' },
    good: { text: 'GUT!', color: '#88ccff' },
    miss: { text: 'DANEBEN!', color: '#ff4444' }
};
let ratingDisplay = { text: '', color: '', timer: 0 };

function getLaneX(lane) {
    return LANE_START_X + lane * (LANE_WIDTH + LANE_GAP);
}

function spawnNote(lanes) {
    for (let lane of lanes) {
        notes.push({ lane: lane, y: -30, hit: false, missed: false });
        totalNotes++;
    }
}

function spawnPattern() {
    let maxPatternIdx = Math.min(Math.floor(difficultyTimer / 500) + 4, PATTERNS.length);
    let idx = Math.floor(Math.random() * maxPatternIdx);
    spawnNote(PATTERNS[idx]);
}

function showRating(type) {
    ratingDisplay = { ...RATINGS[type], timer: 30 };
}

function addHitEffect(lane, quality) {
    let x = getLaneX(lane) + LANE_WIDTH / 2;
    let color = quality === 'perfect' ? '#ffdd00' : quality === 'great' ? '#44ff44' : '#88ccff';
    for (let i = 0; i < 8; i++) {
        let angle = (Math.PI * 2 / 8) * i + Math.random() * 0.5;
        hitEffects.push({
            x: x,
            y: HIT_ZONE_Y,
            vx: Math.cos(angle) * (2 + Math.random() * 3),
            vy: Math.sin(angle) * (2 + Math.random() * 3),
            life: 30,
            color: color
        });
    }
}

function hitNote(lane) {
    let closest = null;
    let closestDist = Infinity;

    for (let note of notes) {
        if (note.lane === lane && !note.hit && !note.missed) {
            let dist = Math.abs(note.y - HIT_ZONE_Y);
            if (dist < closestDist && dist < HIT_TOLERANCE) {
                closest = note;
                closestDist = dist;
            }
        }
    }

    if (closest) {
        closest.hit = true;
        hits++;
        combo++;
        if (combo > maxCombo) maxCombo = combo;

        let quality;
        if (closestDist < 15) {
            quality = 'perfect';
            score += 100 * (1 + Math.floor(combo / 10));
            crowd = Math.min(100, crowd + 5);
        } else if (closestDist < 30) {
            quality = 'great';
            score += 75 * (1 + Math.floor(combo / 10));
            crowd = Math.min(100, crowd + 3);
        } else {
            quality = 'good';
            score += 50 * (1 + Math.floor(combo / 10));
            crowd = Math.min(100, crowd + 1);
        }

        showRating(quality);
        addHitEffect(lane, quality);
        laneFlash[lane] = 15;

        if (combo > 0 && combo % 10 === 0) {
            currentChant = CHANTS[Math.floor(Math.random() * CHANTS.length)];
            chantTimer = 90;
        }
    } else {
        laneFlash[lane] = 5;
    }
}

function missNote() {
    combo = 0;
    misses++;
    crowd = Math.max(0, crowd - 8);
    showRating('miss');
    shakeTimer = 10;
    shakeIntensity = 3;
}

function update(dt) {
    if (gameState !== 'playing') return;

    difficultyTimer += dt;
    if (difficultyTimer % 300 < dt) {
        noteSpeed = Math.min(8, 4 + difficultyTimer / 1000);
        spawnInterval = Math.max(20, 45 - difficultyTimer / 200);
    }

    spawnAccumulator += dt;
    if (spawnAccumulator >= spawnInterval) {
        spawnAccumulator -= spawnInterval;
        spawnPattern();
    }

    for (let note of notes) {
        if (!note.hit && !note.missed) {
            note.y += noteSpeed * dt;
            if (note.y > HIT_ZONE_Y + HIT_TOLERANCE) {
                note.missed = true;
                missNote();
            }
        }
    }

    notes = notes.filter(n => n.y < canvas.height + 50 || (!n.hit && !n.missed));

    for (let i = 0; i < 4; i++) {
        if (laneFlash[i] > 0) laneFlash[i] -= dt;
    }

    hitEffects = hitEffects.filter(e => {
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.life -= dt;
        return e.life > 0;
    });

    if (ratingDisplay.timer > 0) ratingDisplay.timer -= dt;
    if (chantTimer > 0) chantTimer -= dt;
    if (shakeTimer > 0) shakeTimer -= dt;

    crowdWave += 0.05 * dt;
    crowd = Math.max(0, crowd - 0.03 * dt);

    if (crowd <= 0 && misses > 5) {
        gameState = 'gameover';
    }

    pollGamepad();
}

function pollGamepad() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let gp of gamepads) {
        if (!gp) continue;

        for (let i = 0; i < 4; i++) {
            let pressed = false;

            // D-Pad: left=14, down=13, up=12, right=15 (matching lane order ← ↓ ↑ →)
            const dpadMapping = [14, 13, 12, 15];
            if (gp.buttons[dpadMapping[i]] && gp.buttons[dpadMapping[i]].pressed) pressed = true;

            // Face buttons as alternative
            if (gp.buttons[i] && gp.buttons[i].pressed) pressed = true;

            // Left stick (with deadzone 0.15)
            if (i === 0 && gp.axes[0] < -0.15) pressed = true;
            if (i === 3 && gp.axes[0] > 0.15) pressed = true;
            if (i === 1 && gp.axes[1] > 0.15) pressed = true;
            if (i === 2 && gp.axes[1] < -0.15) pressed = true;

            if (pressed && !gamepadLanePressed[i]) {
                if (gameState === 'playing') {
                    hitNote(i);
                } else {
                    startGame();
                }
            }
            gamepadLanePressed[i] = pressed;
        }
    }
}

// --- DRAWING ---

function drawStadium() {
    let gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#0a1628');
    gradient.addColorStop(0.3, '#1a2a4a');
    gradient.addColorStop(1, '#0d1b30');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let crowdIntensity = crowd / 100;
    for (let i = 0; i < 30; i++) {
        let x = i * 20 + 5;
        let wave = Math.sin(crowdWave + i * 0.5) * (3 + crowdIntensity * 8);
        let baseY = 40 + Math.sin(i * 0.7) * 5;
        let y = baseY - wave;

        ctx.fillStyle = `hsl(${(i * 30 + crowd) % 360}, ${50 + crowdIntensity * 30}%, ${20 + crowdIntensity * 20}%)`;
        ctx.beginPath();
        ctx.ellipse(x, y + 15, 8, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();

        if (crowdIntensity > 0.5) {
            let armWave = Math.sin(crowdWave * 2 + i) * 0.3;
            ctx.strokeStyle = ctx.fillStyle;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x - 5, y + 10);
            ctx.lineTo(x - 10, y - 5 + armWave * 10);
            ctx.moveTo(x + 5, y + 10);
            ctx.lineTo(x + 10, y - 5 - armWave * 10);
            ctx.stroke();
        }
    }

    if (crowdIntensity > 0.7) {
        for (let i = 0; i < 5; i++) {
            let x = 60 + i * 120;
            let flicker = 0.5 + Math.random() * 0.5;
            ctx.fillStyle = `rgba(255, 255, 100, ${0.1 * flicker * crowdIntensity})`;
            ctx.beginPath();
            ctx.arc(x, 20, 30, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function drawLanes() {
    for (let i = 0; i < LANE_COUNT; i++) {
        let x = getLaneX(i);

        let alpha = 0.15 + (laneFlash[i] > 0 ? 0.2 : 0);
        ctx.fillStyle = `rgba(${hexToRgb(LANE_COLORS[i])}, ${alpha})`;
        ctx.fillRect(x, 80, LANE_WIDTH, canvas.height - 80);

        ctx.strokeStyle = `rgba(${hexToRgb(LANE_COLORS[i])}, 0.3)`;
        ctx.lineWidth = 1;
        ctx.strokeRect(x, 80, LANE_WIDTH, canvas.height - 80);

        let glowAlpha = laneFlash[i] > 0 ? 0.8 : 0.4;
        ctx.fillStyle = `rgba(${hexToRgb(LANE_COLORS[i])}, ${glowAlpha})`;
        ctx.fillRect(x, HIT_ZONE_Y - HIT_ZONE_HEIGHT / 2, LANE_WIDTH, HIT_ZONE_HEIGHT);

        ctx.strokeStyle = LANE_COLORS[i];
        ctx.lineWidth = 2;
        ctx.strokeRect(x, HIT_ZONE_Y - HIT_ZONE_HEIGHT / 2, LANE_WIDTH, HIT_ZONE_HEIGHT);

        ctx.fillStyle = '#ffffff88';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(LANE_LABELS[i], x + LANE_WIDTH / 2, canvas.height - 30);
    }
}

function drawNotes() {
    for (let note of notes) {
        if (note.hit || note.y < -30) continue;

        let x = getLaneX(note.lane);
        let centerX = x + LANE_WIDTH / 2;
        let radius = 18;
        let alpha = note.missed ? 0.3 : 1;

        if (!note.missed) {
            ctx.shadowColor = LANE_GLOW[note.lane];
            ctx.shadowBlur = 15;
        }

        ctx.fillStyle = note.missed ? '#666' : LANE_COLORS[note.lane];
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(centerX, note.y, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = note.missed ? '#444' : darkenColor(LANE_COLORS[note.lane], 0.5);
        ctx.beginPath();
        for (let j = 0; j < 5; j++) {
            let angle = (Math.PI * 2 / 5) * j - Math.PI / 2;
            let px = centerX + Math.cos(angle) * 8;
            let py = note.y + Math.sin(angle) * 8;
            if (j === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
    }
}

function drawHitEffects() {
    for (let e of hitEffects) {
        let alpha = e.life / 30;
        ctx.fillStyle = e.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 3, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function drawUI() {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${score}`, 15, canvas.height - 15);

    if (combo > 1) {
        ctx.fillStyle = '#ffdd00';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`${combo}x Combo`, canvas.width - 15, canvas.height - 15);
    }

    // Stimmungs-Balken
    let barWidth = canvas.width - 30;
    let barHeight = 12;
    let barX = 15;
    let barY = 70;

    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    let barColor = crowd > 70 ? '#44ff44' : crowd > 40 ? '#ffdd00' : '#ff4444';
    ctx.fillStyle = barColor;
    ctx.fillRect(barX, barY, barWidth * (crowd / 100), barHeight);

    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    ctx.fillStyle = '#fff';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('STIMMUNG', canvas.width / 2, barY - 3);

    if (ratingDisplay.timer > 0) {
        let alpha = ratingDisplay.timer / 30;
        let scale = 1 + (1 - alpha) * 0.3;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = ratingDisplay.color;
        ctx.font = `bold ${Math.floor(22 * scale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(ratingDisplay.text, canvas.width / 2, canvas.height / 2);
        ctx.globalAlpha = 1;
    }

    if (chantTimer > 0) {
        let alpha = Math.min(1, chantTimer / 30);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ffdd00';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(currentChant, canvas.width / 2, 130);
        ctx.globalAlpha = 1;
    }
}

function drawMenu() {
    drawStadium();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚽ Fan-Rhythmus ⚽', canvas.width / 2, canvas.height / 2 - 80);

    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#ccc';
    ctx.fillText('Drücke die Tasten im Rhythmus', canvas.width / 2, canvas.height / 2 - 30);
    ctx.fillText('und heize den Fans ein!', canvas.width / 2, canvas.height / 2 - 5);

    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#88ccff';
    ctx.fillText('Steuerung:  ←  ↓  ↑  →', canvas.width / 2, canvas.height / 2 + 50);
    ctx.fillText('Gamepad: D-Pad / Buttons', canvas.width / 2, canvas.height / 2 + 75);

    let pulse = 0.6 + Math.sin(Date.now() / 500) * 0.4;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ffdd00';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('LEERTASTE zum Starten', canvas.width / 2, canvas.height / 2 + 130);
    ctx.globalAlpha = 1;

    drawDecoBall(100, canvas.height / 2 - 60, 20);
    drawDecoBall(500, canvas.height / 2 - 60, 20);
}

function drawDecoBall(x, y, r) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#333';
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
        let angle = (Math.PI * 2 / 5) * i - Math.PI / 2;
        let px = x + Math.cos(angle) * r * 0.45;
        let py = y + Math.sin(angle) * r * 0.45;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
}

function drawGameOver() {
    drawStadium();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ABPFIFF!', canvas.width / 2, canvas.height / 2 - 100);

    ctx.fillStyle = '#fff';
    ctx.font = '22px sans-serif';
    ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2 - 40);
    ctx.fillText(`Max Combo: ${maxCombo}x`, canvas.width / 2, canvas.height / 2);
    ctx.fillText(`Treffer: ${hits} / ${totalNotes}`, canvas.width / 2, canvas.height / 2 + 40);

    let accuracy = totalNotes > 0 ? Math.round((hits / totalNotes) * 100) : 0;
    ctx.fillText(`Genauigkeit: ${accuracy}%`, canvas.width / 2, canvas.height / 2 + 80);

    let grade;
    if (accuracy >= 90) grade = '⭐ WELTKLASSE! ⭐';
    else if (accuracy >= 70) grade = '🏆 Fantastisch!';
    else if (accuracy >= 50) grade = '👍 Guter Fan!';
    else grade = '📣 Weiter üben!';

    ctx.fillStyle = '#ffdd00';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(grade, canvas.width / 2, canvas.height / 2 + 130);

    let pulse = 0.6 + Math.sin(Date.now() / 500) * 0.4;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#88ccff';
    ctx.font = '18px sans-serif';
    ctx.fillText('LEERTASTE für Neustart', canvas.width / 2, canvas.height / 2 + 180);
    ctx.globalAlpha = 1;
}

function draw() {
    let shakeX = 0, shakeY = 0;
    if (shakeTimer > 0) {
        shakeX = (Math.random() - 0.5) * shakeIntensity * 2;
        shakeY = (Math.random() - 0.5) * shakeIntensity * 2;
    }

    ctx.save();
    ctx.translate(shakeX, shakeY);

    if (gameState === 'menu') {
        drawMenu();
    } else if (gameState === 'playing') {
        drawStadium();
        drawLanes();
        drawNotes();
        drawHitEffects();
        drawUI();
    } else if (gameState === 'gameover') {
        drawGameOver();
    }

    ctx.restore();
}

function startGame() {
    score = 0;
    combo = 0;
    maxCombo = 0;
    crowd = 50;
    hits = 0;
    misses = 0;
    totalNotes = 0;
    notes = [];
    hitEffects = [];
    noteSpeed = 4;
    spawnInterval = 45;
    spawnAccumulator = 0;
    difficultyTimer = 0;
    lastTime = 0;
    laneFlash = [0, 0, 0, 0];
    chantTimer = 0;
    ratingDisplay = { text: '', color: '', timer: 0 };
    gameState = 'playing';
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

// --- UTILITIES ---

function hexToRgb(hex) {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    return `${r}, ${g}, ${b}`;
}

function darkenColor(hex, factor) {
    let r = Math.floor(parseInt(hex.slice(1, 3), 16) * factor);
    let g = Math.floor(parseInt(hex.slice(3, 5), 16) * factor);
    let b = Math.floor(parseInt(hex.slice(5, 7), 16) * factor);
    return `rgb(${r}, ${g}, ${b})`;
}

// --- INPUT ---

(function() {
    let keysDown = {};

    document.addEventListener('keydown', (e) => {
        if (keysDown[e.code]) return;
        keysDown[e.code] = true;

        if (e.code === 'Space') {
            e.preventDefault();
            if (gameState === 'menu' || gameState === 'gameover') {
                startGame();
            }
            return;
        }

        if (e.code === 'Enter') {
            e.preventDefault();
            if (gameState === 'menu' || gameState === 'gameover') {
                startGame();
            }
            return;
        }

        if (gameState === 'playing') {
            let laneIndex = LANE_KEYS.indexOf(e.code);
            if (laneIndex !== -1) {
                e.preventDefault();
                hitNote(laneIndex);
            }
        }
    });

    document.addEventListener('keyup', (e) => {
        keysDown[e.code] = false;
    });
})();

// Touch support
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameState === 'menu' || gameState === 'gameover') {
        startGame();
        return;
    }
    for (let touch of e.changedTouches) {
        let rect = canvas.getBoundingClientRect();
        let x = (touch.clientX - rect.left) * (canvas.width / rect.width);
        for (let i = 0; i < LANE_COUNT; i++) {
            let laneX = getLaneX(i);
            if (x >= laneX && x <= laneX + LANE_WIDTH) {
                hitNote(i);
                break;
            }
        }
    }
});

// Start
requestAnimationFrame(gameLoop);
