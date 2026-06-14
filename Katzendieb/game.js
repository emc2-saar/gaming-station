const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// === CONSTANTS ===
const TARGET_FPS = 60;
const W = canvas.width;
const H = canvas.height;

// === GAME STATE ===
let lastTime = 0;
let gameState = 'start'; // 'start', 'playing', 'gameover', 'win'
let score = 0;
let level = 1;
let lives = 3;

// Cat state
let cat = {
    x: W / 2,
    y: H / 2,
    size: 60,
    angle: 0, // direction cat is facing (radians)
    targetAngle: 0,
    distracted: false,
    distractedTimer: 0,
    alertness: 1.0, // increases with level
    turnSpeed: 3,
    lookBackDelay: 2.0 // seconds (in dt units) before looking back
};

// Yarn ball
let yarn = {
    x: W / 2,
    y: H / 2 + 20,
    size: 18,
    grabbed: false,
    grabProgress: 0 // 0 to 1
};

// Player (hand/cursor)
let player = {
    x: W / 2,
    y: H - 100,
    speed: 4,
    grabbing: false,
    grabCooldown: 0
};

// Distractions
let distractions = [];
let distractionCooldown = 0;
const DISTRACTION_TYPES = ['laser', 'mouse', 'feather'];

// Input
let keys = {};
let gamepadConnected = false;

// Particles
let particles = [];

// === INPUT HANDLING ===
document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Space') e.preventDefault();
    if (e.code === 'Enter') e.preventDefault();
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// === GAMEPAD SUPPORT ===
function getGamepadInput() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let gp of gamepads) {
        if (!gp) continue;
        gamepadConnected = true;
        const deadzone = 0.15;
        let dx = 0, dy = 0;
        
        // Left stick
        if (Math.abs(gp.axes[0]) > deadzone) dx = gp.axes[0];
        if (Math.abs(gp.axes[1]) > deadzone) dy = gp.axes[1];
        
        // D-pad
        if (gp.buttons[12] && gp.buttons[12].pressed) dy = -1;
        if (gp.buttons[13] && gp.buttons[13].pressed) dy = 1;
        if (gp.buttons[14] && gp.buttons[14].pressed) dx = -1;
        if (gp.buttons[15] && gp.buttons[15].pressed) dx = 1;
        
        return {
            dx, dy,
            grab: gp.buttons[0] && gp.buttons[0].pressed, // A button
            throwDistraction: gp.buttons[2] && gp.buttons[2].pressed, // X button
            start: gp.buttons[9] && gp.buttons[9].pressed // Start
        };
    }
    return null;
}

// === DISTRACTION LOGIC ===
function throwDistraction(dirX, dirY) {
    if (distractionCooldown > 0) return;
    
    const type = DISTRACTION_TYPES[Math.floor(Math.random() * DISTRACTION_TYPES.length)];
    const speed = 5;
    
    // Throw from player position towards direction
    let targetX = player.x + dirX * 200;
    let targetY = player.y + dirY * 200;
    
    // Clamp target to canvas
    targetX = Math.max(50, Math.min(W - 50, targetX));
    targetY = Math.max(50, Math.min(H - 50, targetY));
    
    distractions.push({
        x: player.x,
        y: player.y,
        targetX: targetX,
        targetY: targetY,
        type: type,
        life: 3.0 * TARGET_FPS, // life in frames (dt-based)
        active: false,
        moving: true,
        speed: speed
    });
    
    distractionCooldown = 0.5 * TARGET_FPS;
}

// === UPDATE ===
function update(dt) {
    if (gameState !== 'playing') return;
    
    // Get input
    let dx = 0, dy = 0;
    let grabInput = false;
    let throwInput = false;
    let throwDirX = 0, throwDirY = -1;
    
    // Keyboard
    if (keys['ArrowLeft'] || keys['KeyA']) dx -= 1;
    if (keys['ArrowRight'] || keys['KeyD']) dx += 1;
    if (keys['ArrowUp'] || keys['KeyW']) dy -= 1;
    if (keys['ArrowDown'] || keys['KeyS']) dy += 1;
    if (keys['Space']) grabInput = true;
    if (keys['Enter'] || keys['KeyE']) throwInput = true;
    
    // Gamepad
    const gp = getGamepadInput();
    if (gp) {
        if (Math.abs(gp.dx) > 0 || Math.abs(gp.dy) > 0) {
            dx = gp.dx;
            dy = gp.dy;
        }
        if (gp.grab) grabInput = true;
        if (gp.throwDistraction) throwInput = true;
    }
    
    // Normalize diagonal movement
    const mag = Math.sqrt(dx * dx + dy * dy);
    if (mag > 0) {
        dx /= mag;
        dy /= mag;
    }
    
    // Move player
    player.x += dx * player.speed * dt;
    player.y += dy * player.speed * dt;
    player.x = Math.max(20, Math.min(W - 20, player.x));
    player.y = Math.max(20, Math.min(H - 20, player.y));
    
    // Throw distraction
    if (throwInput && distractionCooldown <= 0) {
        // Throw towards cat from player position
        let tdx = cat.x - player.x;
        let tdy = cat.y - player.y;
        const tmag = Math.sqrt(tdx * tdx + tdy * tdy);
        if (tmag > 0) { tdx /= tmag; tdy /= tmag; }
        
        // Add some randomness to make it land around the cat
        tdx += (Math.random() - 0.5) * 0.8;
        tdy += (Math.random() - 0.5) * 0.8;
        throwDistraction(tdx, tdy);
    }
    
    // Update cooldowns
    if (distractionCooldown > 0) distractionCooldown -= dt;
    if (player.grabCooldown > 0) player.grabCooldown -= dt;
    
    // Update distractions
    for (let i = distractions.length - 1; i >= 0; i--) {
        let d = distractions[i];
        
        if (d.moving) {
            // Move towards target
            let ddx = d.targetX - d.x;
            let ddy = d.targetY - d.y;
            let dist = Math.sqrt(ddx * ddx + ddy * ddy);
            if (dist < 5) {
                d.moving = false;
                d.active = true;
                d.x = d.targetX;
                d.y = d.targetY;
            } else {
                d.x += (ddx / dist) * d.speed * dt;
                d.y += (ddy / dist) * d.speed * dt;
            }
        }
        
        if (d.active) {
            d.life -= dt;
            if (d.life <= 0) {
                distractions.splice(i, 1);
            }
        }
    }
    
    // Cat AI
    updateCat(dt);
    
    // Grab attempt
    if (grabInput && !player.grabbing && player.grabCooldown <= 0) {
        let distToYarn = Math.sqrt(
            (player.x - yarn.x) * (player.x - yarn.x) + 
            (player.y - yarn.y) * (player.y - yarn.y)
        );
        
        if (distToYarn < 80) {
            player.grabbing = true;
            yarn.grabProgress = 0;
        }
    }
    
    // Grabbing progress
    if (player.grabbing) {
        if (cat.distracted) {
            yarn.grabProgress += 0.015 * dt;
            
            if (yarn.grabProgress >= 1.0) {
                // Success!
                yarn.grabbed = true;
                player.grabbing = false;
                score += level * 100;
                level++;
                
                // Create celebration particles
                for (let i = 0; i < 20; i++) {
                    particles.push({
                        x: yarn.x, y: yarn.y,
                        vx: (Math.random() - 0.5) * 6,
                        vy: (Math.random() - 0.5) * 6,
                        life: 1.5 * TARGET_FPS,
                        color: ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3'][Math.floor(Math.random() * 4)]
                    });
                }
                
                // Next level after delay
                setTimeout(() => {
                    if (gameState === 'playing') nextLevel();
                }, 1500);
            }
        } else {
            // Cat caught us!
            player.grabbing = false;
            yarn.grabProgress = 0;
            lives--;
            player.grabCooldown = 1.5 * TARGET_FPS;
            
            // Angry particles
            for (let i = 0; i < 10; i++) {
                particles.push({
                    x: cat.x, y: cat.y - 30,
                    vx: (Math.random() - 0.5) * 4,
                    vy: -Math.random() * 3,
                    life: 1.0 * TARGET_FPS,
                    color: '#ff4444'
                });
            }
            
            if (lives <= 0) {
                gameState = 'gameover';
            }
        }
    }
    
    // Not grabbing anymore if too far
    if (player.grabbing) {
        let distToYarn = Math.sqrt(
            (player.x - yarn.x) * (player.x - yarn.x) + 
            (player.y - yarn.y) * (player.y - yarn.y)
        );
        if (distToYarn > 100) {
            player.grabbing = false;
            yarn.grabProgress = 0;
        }
    }
    
    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 0.1 * dt; // gravity
        p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function updateCat(dt) {
    if (yarn.grabbed) return;
    
    // Check for active distractions
    let closestDistraction = null;
    let closestDist = Infinity;
    
    for (let d of distractions) {
        if (!d.active) continue;
        let dist = Math.sqrt((d.x - cat.x) * (d.x - cat.x) + (d.y - cat.y) * (d.y - cat.y));
        if (dist < closestDist) {
            closestDist = dist;
            closestDistraction = d;
        }
    }
    
    if (closestDistraction && closestDist < 250) {
        // Look at distraction
        cat.targetAngle = Math.atan2(
            closestDistraction.y - cat.y,
            closestDistraction.x - cat.x
        );
        cat.distracted = true;
        cat.distractedTimer = cat.lookBackDelay;
    } else {
        // Look back towards player/yarn
        if (cat.distractedTimer > 0) {
            cat.distractedTimer -= dt / TARGET_FPS;
        } else {
            cat.distracted = false;
            // Look towards player
            cat.targetAngle = Math.atan2(
                player.y - cat.y,
                player.x - cat.x
            );
        }
    }
    
    // Smoothly rotate towards target
    let angleDiff = cat.targetAngle - cat.angle;
    // Normalize angle difference
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    
    let rotSpeed = cat.turnSpeed * cat.alertness * dt / TARGET_FPS;
    if (Math.abs(angleDiff) < rotSpeed) {
        cat.angle = cat.targetAngle;
    } else {
        cat.angle += Math.sign(angleDiff) * rotSpeed;
    }
}

function nextLevel() {
    yarn.grabbed = false;
    yarn.grabProgress = 0;
    player.grabbing = false;
    player.x = W / 2;
    player.y = H - 100;
    distractions = [];
    
    // Increase difficulty
    cat.alertness = 1.0 + (level - 1) * 0.3;
    cat.lookBackDelay = Math.max(0.8, 2.0 - (level - 1) * 0.2);
    cat.angle = Math.PI / 2; // face down (towards player)
}

// === DRAW ===
function draw() {
    // Background
    ctx.fillStyle = '#2d1b4e';
    ctx.fillRect(0, 0, W, H);
    
    // Draw floor pattern
    ctx.fillStyle = '#3d2b5e';
    for (let i = 0; i < W; i += 40) {
        for (let j = 0; j < H; j += 40) {
            if ((i + j) % 80 === 0) {
                ctx.fillRect(i, j, 40, 40);
            }
        }
    }
    
    if (gameState === 'start') {
        drawStartScreen();
        return;
    }
    
    if (gameState === 'gameover') {
        drawGameOverScreen();
        return;
    }
    
    // Draw distractions
    for (let d of distractions) {
        drawDistraction(d);
    }
    
    // Draw cat
    drawCat();
    
    // Draw yarn (if not grabbed)
    if (!yarn.grabbed) {
        drawYarn();
    }
    
    // Draw grab progress
    if (player.grabbing) {
        drawGrabProgress();
    }
    
    // Draw player hand
    drawPlayer();
    
    // Draw particles
    for (let p of particles) {
        let alpha = p.life / (1.5 * TARGET_FPS);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
    
    // Draw HUD
    drawHUD();
}

function drawStartScreen() {
    // Title
    ctx.fillStyle = '#feca57';
    ctx.font = 'bold 38px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🐱 Katzendieb 🧶', W / 2, H / 2 - 120);
    
    // Description
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText('Lenke die Katze ab und schnapp dir den Wollknäuel!', W / 2, H / 2 - 60);
    
    // Controls
    ctx.fillStyle = '#aaa';
    ctx.font = '16px sans-serif';
    ctx.fillText('🎮 Steuerung:', W / 2, H / 2 + 0);
    ctx.fillText('Pfeiltasten / WASD – Bewegen', W / 2, H / 2 + 30);
    ctx.fillText('Enter / E – Ablenkung werfen', W / 2, H / 2 + 55);
    ctx.fillText('Leertaste – Wollknäuel greifen', W / 2, H / 2 + 80);
    
    ctx.fillStyle = '#48dbfb';
    ctx.font = '16px sans-serif';
    ctx.fillText('Gamepad: Stick bewegen, A = greifen, X = ablenken', W / 2, H / 2 + 115);
    
    // Start prompt
    ctx.fillStyle = '#feca57';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('Leertaste / Enter / 🅰 zum Starten', W / 2, H / 2 + 170);
    
    // Draw cute cat
    drawCatIcon(W / 2, H / 2 - 180, 40);
}

function drawGameOverScreen() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, W, H);
    
    ctx.fillStyle = '#ff6b6b';
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Erwischt! 🐱💢', W / 2, H / 2 - 80);
    
    ctx.fillStyle = '#fff';
    ctx.font = '24px sans-serif';
    ctx.fillText('Die Katze hat dich ertappt!', W / 2, H / 2 - 30);
    
    ctx.fillStyle = '#feca57';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('Score: ' + score, W / 2, H / 2 + 20);
    ctx.fillText('Level erreicht: ' + level, W / 2, H / 2 + 55);
    
    ctx.fillStyle = '#48dbfb';
    ctx.font = '20px sans-serif';
    ctx.fillText('Leertaste / Enter für Neustart', W / 2, H / 2 + 110);
}

function drawCat() {
    ctx.save();
    ctx.translate(cat.x, cat.y);
    
    // Body (oval)
    ctx.fillStyle = '#ff9f43';
    ctx.beginPath();
    ctx.ellipse(0, 10, 35, 40, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Head (rotates based on angle)
    ctx.save();
    ctx.rotate(cat.angle - Math.PI / 2);
    
    // Head circle
    ctx.fillStyle = '#ff9f43';
    ctx.beginPath();
    ctx.arc(0, -35, 28, 0, Math.PI * 2);
    ctx.fill();
    
    // Ears
    ctx.fillStyle = '#e17055';
    ctx.beginPath();
    ctx.moveTo(-18, -55);
    ctx.lineTo(-8, -40);
    ctx.lineTo(-26, -40);
    ctx.closePath();
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(18, -55);
    ctx.lineTo(8, -40);
    ctx.lineTo(26, -40);
    ctx.closePath();
    ctx.fill();
    
    // Eyes
    if (cat.distracted) {
        // Looking away - half closed eyes
        ctx.fillStyle = '#2d3436';
        ctx.beginPath();
        ctx.ellipse(-9, -38, 4, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(9, -38, 4, 3, 0, 0, Math.PI * 2);
        ctx.fill();
    } else {
        // Alert eyes
        ctx.fillStyle = '#2d3436';
        ctx.beginPath();
        ctx.arc(-9, -38, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(9, -38, 5, 0, Math.PI * 2);
        ctx.fill();
        
        // Pupils
        ctx.fillStyle = '#fdcb6e';
        ctx.beginPath();
        ctx.ellipse(-9, -38, 2, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(9, -38, 2, 4, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Nose
    ctx.fillStyle = '#fab1a0';
    ctx.beginPath();
    ctx.moveTo(0, -32);
    ctx.lineTo(-3, -29);
    ctx.lineTo(3, -29);
    ctx.closePath();
    ctx.fill();
    
    // Whiskers
    ctx.strokeStyle = '#dfe6e9';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-12, -30);
    ctx.lineTo(-28, -33);
    ctx.moveTo(-12, -28);
    ctx.lineTo(-28, -27);
    ctx.moveTo(12, -30);
    ctx.lineTo(28, -33);
    ctx.moveTo(12, -28);
    ctx.lineTo(28, -27);
    ctx.stroke();
    
    ctx.restore(); // head rotation
    
    // Paws holding yarn area
    ctx.fillStyle = '#e17055';
    ctx.beginPath();
    ctx.arc(-15, 40, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(15, 40, 10, 0, Math.PI * 2);
    ctx.fill();
    
    // Tail
    ctx.strokeStyle = '#ff9f43';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(25, 20);
    ctx.quadraticCurveTo(55, 0, 45, -25);
    ctx.stroke();
    
    // Alert indicator
    if (!cat.distracted && player.grabbing) {
        ctx.fillStyle = '#ff4444';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('❗', 0, -70);
    }
    
    if (cat.distracted) {
        ctx.fillStyle = '#feca57';
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('?', 0, -70);
    }
    
    ctx.restore();
}

function drawYarn() {
    ctx.save();
    ctx.translate(yarn.x, yarn.y + 25);
    
    // Yarn ball
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(0, 0, yarn.size, 0, Math.PI * 2);
    ctx.fill();
    
    // Yarn texture lines
    ctx.strokeStyle = '#c0392b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, yarn.size - 4, 0.2, 1.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, yarn.size - 8, 1.0, 2.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-3, -3, yarn.size - 3, 2.5, 4.2);
    ctx.stroke();
    
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(-5, -5, 5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
}

function drawPlayer() {
    ctx.save();
    ctx.translate(player.x, player.y);
    
    // Hand/cursor
    let handColor = '#ffeaa7';
    if (player.grabbing) handColor = '#fdcb6e';
    if (player.grabCooldown > 0) handColor = '#ff7675';
    
    // Hand shape
    ctx.fillStyle = handColor;
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fill();
    
    // Fingers
    ctx.strokeStyle = handColor;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    
    if (player.grabbing) {
        // Grabbing pose
        ctx.beginPath();
        ctx.moveTo(-5, -12);
        ctx.lineTo(-3, -20);
        ctx.moveTo(0, -12);
        ctx.lineTo(0, -22);
        ctx.moveTo(5, -12);
        ctx.lineTo(3, -20);
        ctx.stroke();
    } else {
        // Open hand
        ctx.beginPath();
        ctx.moveTo(-7, -12);
        ctx.lineTo(-10, -24);
        ctx.moveTo(-2, -13);
        ctx.lineTo(-2, -26);
        ctx.moveTo(3, -13);
        ctx.lineTo(3, -26);
        ctx.moveTo(8, -12);
        ctx.lineTo(10, -22);
        ctx.stroke();
    }
    
    ctx.restore();
}

function drawDistraction(d) {
    ctx.save();
    ctx.translate(d.x, d.y);
    
    let alpha = d.active ? Math.min(1, d.life / (0.5 * TARGET_FPS)) : 0.7;
    ctx.globalAlpha = alpha;
    
    if (d.type === 'laser') {
        // Red laser dot
        ctx.fillStyle = '#ff0000';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // Glow
        ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
    } else if (d.type === 'mouse') {
        // Toy mouse
        ctx.fillStyle = '#b2bec3';
        ctx.beginPath();
        ctx.ellipse(0, 0, 12, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        // Ears
        ctx.beginPath();
        ctx.arc(-7, -7, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(7, -7, 4, 0, Math.PI * 2);
        ctx.fill();
        // Tail
        ctx.strokeStyle = '#636e72';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(12, 0);
        ctx.quadraticCurveTo(20, -5, 22, 5);
        ctx.stroke();
    } else if (d.type === 'feather') {
        // Feather
        ctx.fillStyle = '#a29bfe';
        ctx.beginPath();
        ctx.ellipse(0, 0, 5, 15, Math.PI / 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#6c5ce7';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, 15);
        ctx.lineTo(0, -15);
        ctx.stroke();
    }
    
    ctx.globalAlpha = 1;
    ctx.restore();
}

function drawGrabProgress() {
    // Progress bar above yarn
    let barWidth = 60;
    let barHeight = 8;
    let x = yarn.x - barWidth / 2;
    let y = yarn.y - 20;
    
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x, y, barWidth, barHeight);
    
    let progressColor = cat.distracted ? '#2ecc71' : '#e74c3c';
    ctx.fillStyle = progressColor;
    ctx.fillRect(x, y, barWidth * yarn.grabProgress, barHeight);
    
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, barWidth, barHeight);
}

function drawHUD() {
    // Score
    ctx.fillStyle = '#feca57';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score, 15, 30);
    
    // Level
    ctx.fillText('Level: ' + level, 15, 55);
    
    // Lives
    ctx.textAlign = 'right';
    let livesText = '';
    for (let i = 0; i < lives; i++) livesText += '❤️ ';
    ctx.font = '20px sans-serif';
    ctx.fillText(livesText, W - 15, 30);
    
    // Distraction cooldown indicator
    if (distractionCooldown > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Ablenkung lädt...', W / 2, H - 20);
    } else {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Enter/E = Ablenkung werfen | Leertaste = Greifen', W / 2, H - 20);
    }
    
    // Cat distracted indicator
    if (cat.distracted) {
        ctx.fillStyle = '#2ecc71';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🐱 Katze abgelenkt! Jetzt zugreifen!', W / 2, H - 45);
    }
}

function drawCatIcon(x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    
    // Simple cat face
    ctx.fillStyle = '#ff9f43';
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();
    
    // Ears
    ctx.beginPath();
    ctx.moveTo(-size * 0.6, -size * 0.9);
    ctx.lineTo(-size * 0.2, -size * 0.5);
    ctx.lineTo(-size * 0.8, -size * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(size * 0.6, -size * 0.9);
    ctx.lineTo(size * 0.2, -size * 0.5);
    ctx.lineTo(size * 0.8, -size * 0.4);
    ctx.closePath();
    ctx.fill();
    
    // Eyes
    ctx.fillStyle = '#2d3436';
    ctx.beginPath();
    ctx.arc(-size * 0.25, -size * 0.1, size * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(size * 0.25, -size * 0.1, size * 0.12, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
}

// === GAME CONTROL ===
function startGame() {
    score = 0;
    level = 1;
    lives = 3;
    gameState = 'playing';
    lastTime = 0;
    
    cat.alertness = 1.0;
    cat.lookBackDelay = 2.0;
    cat.angle = Math.PI / 2;
    cat.distracted = false;
    cat.distractedTimer = 0;
    
    yarn.grabbed = false;
    yarn.grabProgress = 0;
    
    player.x = W / 2;
    player.y = H - 100;
    player.grabbing = false;
    player.grabCooldown = 0;
    
    distractions = [];
    particles = [];
    distractionCooldown = 0;
}

// === INPUT FOR MENUS ===
document.addEventListener('keydown', (e) => {
    if (gameState === 'start') {
        if (e.code === 'Space' || e.code === 'Enter') {
            e.preventDefault();
            startGame();
        }
    } else if (gameState === 'gameover') {
        if (e.code === 'Space' || e.code === 'Enter') {
            e.preventDefault();
            startGame();
        }
    }
});

// Gamepad menu support
let gpMenuConfirmLast = false;

function checkGamepadMenu() {
    const gp = getGamepadInput();
    if (!gp) return;
    const confirmPressed = gp.start || gp.grab; // Start oder A-Button
    if (confirmPressed && !gpMenuConfirmLast) {
        if (gameState === 'start' || gameState === 'gameover') {
            startGame();
        }
    }
    gpMenuConfirmLast = confirmPressed;
}

// === MAIN LOOP ===
function gameLoop(timestamp) {
    if (lastTime === 0) lastTime = timestamp;
    const elapsed = timestamp - lastTime;
    lastTime = timestamp;
    const dt = Math.min(elapsed / (1000 / TARGET_FPS), 3);
    
    checkGamepadMenu();
    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
}

// Start the loop
requestAnimationFrame(gameLoop);
