const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// === CONSTANTS ===
const TARGET_FPS = 60;
const GRAVITY = 0.6;
const JUMP_FORCE = -13;
const MOVE_SPEED = 5;
const SCROLL_SPEED = 3;

// === AUDIO ===
let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

// Piano note frequencies (C4 to C6)
const NOTES = [
    261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88,  // C4-B4
    523.25, 587.33, 659.25, 698.46, 783.99, 880.00, 987.77,  // C5-B5
    1046.50 // C6
];

const NOTE_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'A', 'B', 'C'];

function playNote(noteIndex) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.type = 'sine';
    osc.frequency.value = NOTES[noteIndex % NOTES.length];
    
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
    
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.5);
}

// === GAME STATE ===
let lastTime = 0;
let gameState = 'start'; // 'start', 'playing', 'gameover'
let score = 0;
let highScore = 0;
let distance = 0;
let difficulty = 1;

// Player
let player = {
    x: 150,
    y: 300,
    width: 30,
    height: 40,
    velX: 0,
    velY: 0,
    onGround: false,
    jumpCount: 0,
    maxJumps: 2
};

// Keys pressed
const keys = {};

// Platforms (piano keys)
let platforms = [];
let cameraX = 0;
let nextPlatformX = 0;
let noteCounter = 0;

// Particles
let particles = [];

// Coins (music notes)
let coins = [];

// === PLATFORM GENERATION ===
function createPlatform(x, y, isBlack) {
    const width = isBlack ? 50 : 70;
    const height = isBlack ? 18 : 22;
    const noteIdx = noteCounter % NOTES.length;
    noteCounter++;
    
    return {
        x: x,
        y: y,
        width: width,
        height: height,
        isBlack: isBlack,
        noteIndex: noteIdx,
        glowTimer: 0,
        played: false
    };
}

function generatePlatforms() {
    while (nextPlatformX < cameraX + canvas.width + 400) {
        const gap = 80 + Math.random() * (60 + difficulty * 10);
        const yVariation = Math.random() * 120 - 60;
        let y = 320 + yVariation;
        y = Math.max(150, Math.min(420, y));
        
        const isBlack = Math.random() < 0.3;
        const platform = createPlatform(nextPlatformX, y, isBlack);
        platforms.push(platform);
        
        // Maybe add a coin above the platform
        if (Math.random() < 0.4) {
            coins.push({
                x: nextPlatformX + platform.width / 2,
                y: y - 50,
                collected: false,
                bobOffset: Math.random() * Math.PI * 2
            });
        }
        
        nextPlatformX += gap + platform.width;
    }
}

function generateInitialPlatforms() {
    platforms = [];
    coins = [];
    noteCounter = 0;
    nextPlatformX = 50;
    
    // Starting platform (wide)
    platforms.push({
        x: 50,
        y: 380,
        width: 120,
        height: 22,
        isBlack: false,
        noteIndex: 0,
        glowTimer: 0,
        played: false
    });
    nextPlatformX = 220;
    noteCounter = 1;
    
    generatePlatforms();
}

// === PARTICLES ===
function spawnNoteParticles(x, y, isBlack) {
    const color = isBlack ? '#ff6b9d' : '#4ecdc4';
    for (let i = 0; i < 8; i++) {
        particles.push({
            x: x,
            y: y,
            velX: (Math.random() - 0.5) * 4,
            velY: -Math.random() * 5 - 2,
            life: 1.0,
            color: color,
            size: Math.random() * 4 + 2
        });
    }
}

// === UPDATE ===
function update(dt) {
    if (gameState !== 'playing') return;
    
    // Difficulty increases over time
    difficulty = 1 + distance / 2000;
    
    // Player horizontal movement
    let moveDir = 0;
    if (keys['ArrowLeft'] || keys['KeyA']) moveDir -= 1;
    if (keys['ArrowRight'] || keys['KeyD']) moveDir += 1;
    
    player.velX = moveDir * MOVE_SPEED;
    
    // Apply gravity
    player.velY += GRAVITY * dt;
    
    // Move player
    player.x += player.velX * dt;
    player.y += player.velY * dt;
    
    // Camera follows player
    const targetCameraX = player.x - 200;
    cameraX += (targetCameraX - cameraX) * 0.1 * dt;
    
    // Don't let camera go backwards
    if (cameraX < 0) cameraX = 0;
    
    // Distance/score
    distance = Math.max(distance, player.x - 150);
    score = Math.floor(distance / 10);
    
    // Collision with platforms
    player.onGround = false;
    for (const plat of platforms) {
        if (player.velY >= 0 &&
            player.x + player.width > plat.x &&
            player.x < plat.x + plat.width &&
            player.y + player.height >= plat.y &&
            player.y + player.height <= plat.y + plat.height + player.velY * dt + 5) {
            
            player.y = plat.y - player.height;
            player.velY = 0;
            player.onGround = true;
            player.jumpCount = 0;
            
            // Play note on landing
            if (!plat.played) {
                plat.played = true;
                plat.glowTimer = 1.0;
                playNote(plat.noteIndex);
                spawnNoteParticles(plat.x + plat.width / 2, plat.y, plat.isBlack);
            }
        }
    }
    
    // Reset played state when player leaves platform
    for (const plat of platforms) {
        if (plat.played && 
            (player.x + player.width <= plat.x || 
             player.x >= plat.x + plat.width ||
             player.y + player.height < plat.y - 5)) {
            plat.played = false;
        }
    }
    
    // Coin collection
    for (const coin of coins) {
        if (coin.collected) continue;
        const dx = (player.x + player.width / 2) - coin.x;
        const dy = (player.y + player.height / 2) - coin.y;
        if (Math.sqrt(dx * dx + dy * dy) < 25) {
            coin.collected = true;
            score += 50;
            // Play a high note for coin
            playNote(12 + Math.floor(Math.random() * 3));
            spawnNoteParticles(coin.x, coin.y, false);
        }
    }
    
    // Update platform glow timers
    for (const plat of platforms) {
        if (plat.glowTimer > 0) {
            plat.glowTimer -= 0.03 * dt;
            if (plat.glowTimer < 0) plat.glowTimer = 0;
        }
    }
    
    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.velX * dt;
        p.y += p.velY * dt;
        p.velY += 0.15 * dt;
        p.life -= 0.025 * dt;
        if (p.life <= 0) particles.splice(i, 1);
    }
    
    // Generate more platforms as needed
    generatePlatforms();
    
    // Remove off-screen platforms and coins
    platforms = platforms.filter(p => p.x + p.width > cameraX - 100);
    coins = coins.filter(c => c.x > cameraX - 100 && !c.collected);
    
    // Fall death
    if (player.y > canvas.height + 50) {
        gameOver();
    }
    
    // Left edge death (scrolled off screen)
    if (player.x < cameraX - 50) {
        gameOver();
    }
}

// === DRAW ===
function draw() {
    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGrad.addColorStop(0, '#0f0c29');
    bgGrad.addColorStop(0.5, '#302b63');
    bgGrad.addColorStop(1, '#24243e');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (gameState === 'start') {
        drawStartScreen();
        return;
    }
    
    if (gameState === 'gameover') {
        drawGameOverScreen();
        return;
    }
    
    // Draw game
    ctx.save();
    ctx.translate(-cameraX, 0);
    
    // Draw platforms (piano keys)
    for (const plat of platforms) {
        if (plat.x + plat.width < cameraX - 10 || plat.x > cameraX + canvas.width + 10) continue;
        
        drawPianoKey(plat);
    }
    
    // Draw coins (music note symbols)
    for (const coin of coins) {
        if (coin.collected) continue;
        const bob = Math.sin(Date.now() / 300 + coin.bobOffset) * 5;
        drawMusicNote(coin.x, coin.y + bob);
    }
    
    // Draw particles
    for (const p of particles) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
    
    // Draw player
    drawPlayer();
    
    ctx.restore();
    
    // Draw HUD
    drawHUD();
}

function drawPianoKey(plat) {
    const glow = plat.glowTimer;
    
    if (glow > 0) {
        ctx.shadowColor = plat.isBlack ? '#ff6b9d' : '#4ecdc4';
        ctx.shadowBlur = 20 * glow;
    }
    
    if (plat.isBlack) {
        // Black key
        ctx.fillStyle = glow > 0 ? `rgba(60, 20, 40, ${1})` : '#1a1a1a';
        ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
        
        // Top highlight
        const highlightColor = glow > 0 
            ? `rgba(255, 107, 157, ${0.3 + glow * 0.5})`
            : 'rgba(80, 80, 80, 0.5)';
        ctx.fillStyle = highlightColor;
        ctx.fillRect(plat.x + 2, plat.y, plat.width - 4, 3);
        
        // Border
        ctx.strokeStyle = glow > 0 ? `rgba(255, 107, 157, ${glow})` : '#333';
        ctx.lineWidth = 2;
        ctx.strokeRect(plat.x, plat.y, plat.width, plat.height);
    } else {
        // White key
        ctx.fillStyle = glow > 0 ? `rgba(240, 255, 250, 1)` : '#f0f0f0';
        ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
        
        // Top highlight
        const highlightColor = glow > 0 
            ? `rgba(78, 205, 196, ${0.4 + glow * 0.5})`
            : 'rgba(255, 255, 255, 0.8)';
        ctx.fillStyle = highlightColor;
        ctx.fillRect(plat.x + 2, plat.y, plat.width - 4, 3);
        
        // Bottom shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.fillRect(plat.x, plat.y + plat.height - 4, plat.width, 4);
        
        // Border
        ctx.strokeStyle = glow > 0 ? `rgba(78, 205, 196, ${glow})` : '#ccc';
        ctx.lineWidth = 1;
        ctx.strokeRect(plat.x, plat.y, plat.width, plat.height);
        
        // Note name
        ctx.fillStyle = glow > 0 ? '#4ecdc4' : '#999';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(NOTE_NAMES[plat.noteIndex % NOTE_NAMES.length], plat.x + plat.width / 2, plat.y + plat.height - 5);
    }
    
    ctx.shadowBlur = 0;
}

function drawMusicNote(x, y) {
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('♪', x, y + 7);
}

function drawPlayer() {
    const px = player.x;
    const py = player.y;
    const pw = player.width;
    const ph = player.height;
    
    // Body
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.roundRect(px + 3, py + 10, pw - 6, ph - 10, 5);
    ctx.fill();
    
    // Head
    ctx.fillStyle = '#feca57';
    ctx.beginPath();
    ctx.arc(px + pw / 2, py + 10, 11, 0, Math.PI * 2);
    ctx.fill();
    
    // Eyes
    ctx.fillStyle = '#2d3436';
    ctx.beginPath();
    ctx.arc(px + pw / 2 - 4, py + 9, 2, 0, Math.PI * 2);
    ctx.arc(px + pw / 2 + 4, py + 9, 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Headphones
    ctx.strokeStyle = '#636e72';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(px + pw / 2, py + 5, 12, Math.PI, 0);
    ctx.stroke();
    
    ctx.fillStyle = '#2d3436';
    ctx.beginPath();
    ctx.arc(px + pw / 2 - 12, py + 9, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px + pw / 2 + 12, py + 9, 4, 0, Math.PI * 2);
    ctx.fill();
    
    // Jump indicator (if can double jump)
    if (player.jumpCount < player.maxJumps && !player.onGround) {
        ctx.fillStyle = 'rgba(78, 205, 196, 0.5)';
        ctx.beginPath();
        ctx.arc(px + pw / 2, py + ph + 5, 4, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawHUD() {
    // Score
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${score}`, 15, 30);
    
    // Distance
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText(`${Math.floor(distance)}m`, 15, 50);
}

function drawStartScreen() {
    // Title
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🎹 Piano Runner 🎵', canvas.width / 2, 150);
    
    // Subtitle
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#b8b8d4';
    ctx.fillText('Springe über Klaviertasten und mach Musik!', canvas.width / 2, 200);
    
    // Draw some decorative piano keys
    for (let i = 0; i < 8; i++) {
        const kx = 150 + i * 65;
        const ky = 260;
        const isBlack = [1, 2, 4, 5, 6].includes(i) && Math.random() > 0.5 ? false : i % 3 === 1;
        ctx.fillStyle = i % 3 === 1 ? '#1a1a1a' : '#f0f0f0';
        ctx.fillRect(kx, ky, i % 3 === 1 ? 45 : 55, i % 3 === 1 ? 16 : 20);
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
        ctx.strokeRect(kx, ky, i % 3 === 1 ? 45 : 55, i % 3 === 1 ? 16 : 20);
    }
    
    // Controls
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#4ecdc4';
    ctx.fillText('← → / A D  =  Bewegen', canvas.width / 2, 340);
    ctx.fillText('Leertaste / ↑ / W  =  Springen (2x möglich!)', canvas.width / 2, 370);
    
    // Start prompt
    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#ffd700';
    const pulse = Math.sin(Date.now() / 500) * 0.3 + 0.7;
    ctx.globalAlpha = pulse;
    ctx.fillText('Leertaste zum Starten', canvas.width / 2, 440);
    ctx.globalAlpha = 1;
}

function drawGameOverScreen() {
    // Darken
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Game Over text
    ctx.fillStyle = '#ff6b6b';
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over!', canvas.width / 2, 170);
    
    // Score
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(`Score: ${score}`, canvas.width / 2, 240);
    
    // High score
    ctx.font = '20px sans-serif';
    ctx.fillStyle = '#ffd700';
    ctx.fillText(`Highscore: ${highScore}`, canvas.width / 2, 280);
    
    // Distance
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText(`Distanz: ${Math.floor(distance)}m`, canvas.width / 2, 320);
    
    // Restart
    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = '#4ecdc4';
    const pulse = Math.sin(Date.now() / 500) * 0.3 + 0.7;
    ctx.globalAlpha = pulse;
    ctx.fillText('Leertaste zum Neustart', canvas.width / 2, 400);
    ctx.globalAlpha = 1;
}

// === GAME CONTROL ===
function startGame() {
    initAudio();
    score = 0;
    distance = 0;
    difficulty = 1;
    cameraX = 0;
    particles = [];
    
    player = {
        x: 100,
        y: 300,
        width: 30,
        height: 40,
        velX: 0,
        velY: 0,
        onGround: false,
        jumpCount: 0,
        maxJumps: 2
    };
    
    generateInitialPlatforms();
    gameState = 'playing';
    lastTime = 0;
}

function gameOver() {
    gameState = 'gameover';
    if (score > highScore) highScore = score;
}

// === INPUT ===
document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        
        if (gameState === 'start' || gameState === 'gameover') {
            startGame();
            return;
        }
        
        if (gameState === 'playing') {
            if (player.jumpCount < player.maxJumps) {
                player.velY = JUMP_FORCE;
                player.jumpCount++;
                player.onGround = false;
            }
        }
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// Touch support
let touchStartX = 0;
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    touchStartX = e.touches[0].clientX;
    
    if (gameState === 'start' || gameState === 'gameover') {
        startGame();
        return;
    }
    
    if (gameState === 'playing') {
        if (player.jumpCount < player.maxJumps) {
            player.velY = JUMP_FORCE;
            player.jumpCount++;
            player.onGround = false;
        }
    }
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touchX = e.touches[0].clientX;
    const diff = touchX - touchStartX;
    
    if (diff > 20) {
        keys['ArrowRight'] = true;
        keys['ArrowLeft'] = false;
    } else if (diff < -20) {
        keys['ArrowLeft'] = true;
        keys['ArrowRight'] = false;
    } else {
        keys['ArrowLeft'] = false;
        keys['ArrowRight'] = false;
    }
});

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    keys['ArrowLeft'] = false;
    keys['ArrowRight'] = false;
});

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

// Start
requestAnimationFrame(gameLoop);
