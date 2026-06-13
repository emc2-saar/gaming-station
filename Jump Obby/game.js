const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const TARGET_FPS = 60;
let lastTime = 0;

// Game states: 'menu', 'playing', 'gameover', 'win'
let gameState = 'menu';
let difficulty = 'easy'; // 'easy' or 'hard'
let menuSelection = 0; // 0 = easy, 1 = hard
let score = 0;
let levelIndex = 0;
let deathCount = 0;

// Camera
let camera = { x: 0, y: 0, z: 0 };

// Player
const PLAYER_SIZE = 30;
let player = {
    x: 0, y: 0, z: 0,
    vx: 0, vy: 0, vz: 0,
    grounded: false,
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    depth: PLAYER_SIZE
};

// Physics constants
const GRAVITY = 0.6;
const JUMP_FORCE = -12;
const MOVE_SPEED = 4;
const FRICTION = 0.85;
const HARD_MOVE_SPEED = 4.5;

// Platforms
let platforms = [];
let obstacles = [];
let checkpointIndex = 0;
let checkpointPos = { x: 0, y: 0, z: 0 };

// 3D projection settings
const ISO_ANGLE = Math.PI / 6; // 30 degrees
const SCALE = 1.0;

// Gamepad
let gamepadConnected = false;
const DEADZONE = 0.15;

// Input
let keys = {};

// Colors
const COLORS = {
    player: '#00ff88',
    playerShadow: '#00cc66',
    platform: '#4488ff',
    platformTop: '#66aaff',
    platformSide: '#2266dd',
    obstacle: '#ff4444',
    obstacleShadow: '#cc2222',
    checkpoint: '#ffdd00',
    finish: '#ff00ff',
    bg: '#0a0a1a',
    bgGradient: '#1a1a3e'
};

// ==================== LEVEL GENERATION ====================

function generateLevels() {
    platforms = [];
    obstacles = [];
    
    const isHard = difficulty === 'hard';
    const numPlatforms = isHard ? 25 : 18;
    const gapMin = isHard ? 80 : 60;
    const gapMax = isHard ? 160 : 110;
    const heightVariation = isHard ? 80 : 40;
    const platformWidthMin = isHard ? 50 : 70;
    const platformWidthMax = isHard ? 90 : 130;
    
    // Start platform (big)
    platforms.push({
        x: 0, y: 200, z: 0,
        width: 150, height: 20, depth: 80,
        type: 'start',
        color: '#44cc44'
    });
    
    checkpointPos = { x: 50, y: 200 - PLAYER_SIZE, z: 20 };
    
    let lastX = 100;
    let lastY = 200;
    let lastZ = 0;
    
    for (let i = 0; i < numPlatforms; i++) {
        const progress = i / numPlatforms;
        
        // Gap increases with progress
        const gap = gapMin + Math.random() * (gapMax - gapMin) * (0.7 + progress * 0.5);
        const heightChange = (Math.random() - 0.5) * heightVariation * (0.5 + progress * 0.8);
        const zChange = (Math.random() - 0.4) * 60;
        
        const px = lastX + gap;
        const py = Math.max(50, Math.min(400, lastY + heightChange));
        const pz = lastZ + zChange;
        
        const pw = platformWidthMin + Math.random() * (platformWidthMax - platformWidthMin) * (1 - progress * 0.3);
        const pd = 40 + Math.random() * 40;
        
        let type = 'normal';
        
        // Moving platforms (more in hard mode)
        if (i > 3 && Math.random() < (isHard ? 0.35 : 0.15)) {
            type = 'moving';
        }
        
        // Checkpoint every few platforms
        if (i === Math.floor(numPlatforms / 3) || i === Math.floor(numPlatforms * 2 / 3)) {
            type = 'checkpoint';
        }
        
        // Last platform is finish
        if (i === numPlatforms - 1) {
            type = 'finish';
        }
        
        const plat = {
            x: px, y: py, z: pz,
            width: pw, height: 20, depth: pd,
            type: type,
            color: getColorForType(type),
            // Moving platform data
            moveDir: Math.random() > 0.5 ? 'horizontal' : 'vertical',
            moveSpeed: (isHard ? 1.5 : 1) * (0.5 + Math.random() * 0.8),
            moveRange: 40 + Math.random() * 40,
            moveOffset: 0,
            originalX: px,
            originalY: py
        };
        
        platforms.push(plat);
        
        // Add obstacles on some platforms (more in hard)
        if (i > 1 && type === 'normal' && Math.random() < (isHard ? 0.5 : 0.25)) {
            obstacles.push({
                x: px + pw * 0.3,
                y: py - 40,
                z: pz + pd * 0.3,
                width: isHard ? 25 : 20,
                height: 30,
                depth: isHard ? 25 : 20,
                moveDir: Math.random() > 0.5 ? 'x' : 'z',
                moveSpeed: (isHard ? 2 : 1.2) * (0.5 + Math.random()),
                moveRange: pw * 0.3,
                moveOffset: 0,
                originalX: px + pw * 0.3,
                originalZ: pz + pd * 0.3
            });
        }
        
        lastX = px;
        lastY = py;
        lastZ = pz;
    }
}

function getColorForType(type) {
    switch(type) {
        case 'start': return '#44cc44';
        case 'checkpoint': return '#ffdd00';
        case 'finish': return '#ff00ff';
        case 'moving': return '#ff8800';
        default: return '#4488ff';
    }
}

// ==================== 3D PROJECTION ====================

function project3D(x, y, z) {
    // Isometric-like projection (y points up in world, down on screen)
    const screenX = (x - z) * Math.cos(ISO_ANGLE) * SCALE;
    const screenY = (x + z) * Math.sin(ISO_ANGLE) * SCALE + y * SCALE;
    return { 
        x: screenX - (camera.x - camera.z) * Math.cos(ISO_ANGLE) * SCALE + canvas.width / 2,
        y: screenY - (camera.x + camera.z) * Math.sin(ISO_ANGLE) * SCALE - camera.y * SCALE + canvas.height / 2 - 100
    };
}

function drawBox(x, y, z, w, h, d, topColor, sideColor, frontColor) {
    // Get projected corners
    const p1 = project3D(x, y, z);           // front-left-top
    const p2 = project3D(x + w, y, z);       // front-right-top
    const p3 = project3D(x + w, y, z + d);   // back-right-top
    const p4 = project3D(x, y, z + d);       // back-left-top
    const p5 = project3D(x, y + h, z);       // front-left-bottom
    const p6 = project3D(x + w, y + h, z);   // front-right-bottom
    const p7 = project3D(x + w, y + h, z + d); // back-right-bottom
    
    // Draw right side
    ctx.fillStyle = sideColor;
    ctx.beginPath();
    ctx.moveTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.lineTo(p7.x, p7.y);
    ctx.lineTo(p6.x, p6.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Draw front side
    ctx.fillStyle = frontColor;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p6.x, p6.y);
    ctx.lineTo(p5.x, p5.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.stroke();
    
    // Draw top
    ctx.fillStyle = topColor;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.lineTo(p4.x, p4.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.stroke();
}

// ==================== UPDATE ====================

function update(dt) {
    if (gameState !== 'playing') return;
    
    handleInput(dt);
    
    // Apply gravity
    player.vy += GRAVITY * dt;
    
    // Apply velocity
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    player.z += player.vz * dt;
    
    // Friction
    player.vx *= Math.pow(FRICTION, dt);
    player.vz *= Math.pow(FRICTION, dt);
    
    // Update moving platforms
    for (let plat of platforms) {
        if (plat.type === 'moving') {
            plat.moveOffset += plat.moveSpeed * dt;
            if (plat.moveDir === 'horizontal') {
                plat.x = plat.originalX + Math.sin(plat.moveOffset * 0.05) * plat.moveRange;
            } else {
                plat.y = plat.originalY + Math.sin(plat.moveOffset * 0.05) * plat.moveRange;
            }
        }
    }
    
    // Update obstacles
    for (let obs of obstacles) {
        obs.moveOffset += obs.moveSpeed * dt;
        if (obs.moveDir === 'x') {
            obs.x = obs.originalX + Math.sin(obs.moveOffset * 0.05) * obs.moveRange;
        } else {
            obs.z = obs.originalZ + Math.sin(obs.moveOffset * 0.05) * obs.moveRange;
        }
    }
    
    // Platform collision
    player.grounded = false;
    for (let plat of platforms) {
        if (checkPlatformCollision(player, plat)) {
            player.y = plat.y - player.height;
            player.vy = 0;
            player.grounded = true;
            
            // Moving platform carries player
            if (plat.type === 'moving' && plat.moveDir === 'horizontal') {
                const prevX = plat.originalX + Math.sin((plat.moveOffset - plat.moveSpeed * dt) * 0.05) * plat.moveRange;
                player.x += plat.x - prevX;
            }
            
            // Checkpoint
            if (plat.type === 'checkpoint') {
                checkpointPos = { x: plat.x + plat.width / 2, y: plat.y - player.height, z: plat.z + plat.depth / 2 };
            }
            
            // Finish
            if (plat.type === 'finish') {
                gameState = 'win';
            }
        }
    }
    
    // Obstacle collision
    for (let obs of obstacles) {
        if (checkBoxCollision(player, obs)) {
            die();
            return;
        }
    }
    
    // Fall off
    if (player.y > 800) {
        die();
        return;
    }
    
    // Update camera (smooth follow)
    camera.x += (player.x - camera.x) * 0.08 * dt;
    camera.y += ((player.y - 100) - camera.y) * 0.05 * dt;
    camera.z += (player.z - camera.z) * 0.08 * dt;
    
    // Score based on progress
    score = Math.max(score, Math.floor(player.x / 10));
}

function handleInput(dt) {
    const speed = difficulty === 'hard' ? HARD_MOVE_SPEED : MOVE_SPEED;
    
    // Keyboard
    if (keys['ArrowRight'] || keys['KeyD']) {
        player.vx = speed;
    }
    if (keys['ArrowLeft'] || keys['KeyA']) {
        player.vx = -speed;
    }
    if (keys['ArrowUp'] || keys['KeyW']) {
        player.vz = -speed;
    }
    if (keys['ArrowDown'] || keys['KeyS']) {
        player.vz = speed;
    }
    if ((keys['Space'] || keys['Enter']) && player.grounded) {
        player.vy = JUMP_FORCE;
        player.grounded = false;
    }
    
    // Gamepad
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let gp of gamepads) {
        if (!gp) continue;
        
        // Left stick
        const lx = Math.abs(gp.axes[0]) > DEADZONE ? gp.axes[0] : 0;
        const ly = Math.abs(gp.axes[1]) > DEADZONE ? gp.axes[1] : 0;
        
        if (lx !== 0) player.vx = lx * speed;
        if (ly !== 0) player.vz = ly * speed;
        
        // A button (jump)
        if (gp.buttons[0] && gp.buttons[0].pressed && player.grounded) {
            player.vy = JUMP_FORCE;
            player.grounded = false;
        }
    }
}

function checkPlatformCollision(player, plat) {
    // Check if player is above and landing on platform
    const onTop = player.y + player.height >= plat.y && 
                  player.y + player.height <= plat.y + plat.height + 8 &&
                  player.vy >= 0;
    
    const overlapX = player.x + player.width > plat.x && player.x < plat.x + plat.width;
    const overlapZ = player.z + player.depth > plat.z && player.z < plat.z + plat.depth;
    
    return onTop && overlapX && overlapZ;
}

function checkBoxCollision(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x &&
           a.y < b.y + b.height && a.y + a.height > b.y &&
           a.z < b.z + b.depth && a.z + a.depth > b.z;
}

function die() {
    deathCount++;
    player.x = checkpointPos.x;
    player.y = checkpointPos.y;
    player.z = checkpointPos.z;
    player.vx = 0;
    player.vy = 0;
    player.vz = 0;
}

// ==================== DRAW ====================

function draw() {
    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#0a0a2e');
    gradient.addColorStop(1, '#1a0a3e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Stars
    drawStars();
    
    if (gameState === 'menu') {
        drawMenu();
        return;
    }
    
    if (gameState === 'gameover') {
        drawGameOver();
        return;
    }
    
    if (gameState === 'win') {
        drawWin();
        return;
    }
    
    // Sort objects by depth for proper rendering
    const allObjects = [];
    
    for (let plat of platforms) {
        allObjects.push({ type: 'platform', obj: plat, sortKey: plat.x + plat.z });
    }
    for (let obs of obstacles) {
        allObjects.push({ type: 'obstacle', obj: obs, sortKey: obs.x + obs.z });
    }
    allObjects.push({ type: 'player', obj: player, sortKey: player.x + player.z });
    
    // Sort back to front
    allObjects.sort((a, b) => a.sortKey - b.sortKey);
    
    // Draw all objects
    for (let item of allObjects) {
        if (item.type === 'platform') {
            drawPlatform(item.obj);
        } else if (item.type === 'obstacle') {
            drawObstacle(item.obj);
        } else if (item.type === 'player') {
            drawPlayer();
        }
    }
    
    // HUD
    drawHUD();
}

function drawStars() {
    // Simple starfield based on seed
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 50; i++) {
        const sx = (i * 137.5 + 50) % canvas.width;
        const sy = (i * 97.3 + 30) % canvas.height;
        const size = (i % 3) + 1;
        ctx.fillRect(sx, sy, size, size);
    }
}

function drawPlatform(plat) {
    let topColor, sideColor, frontColor;
    
    switch(plat.type) {
        case 'start':
            topColor = '#55ee55';
            sideColor = '#33aa33';
            frontColor = '#44cc44';
            break;
        case 'checkpoint':
            topColor = '#ffee44';
            sideColor = '#ccaa00';
            frontColor = '#ddcc22';
            break;
        case 'finish':
            topColor = '#ff66ff';
            sideColor = '#cc22cc';
            frontColor = '#dd44dd';
            break;
        case 'moving':
            topColor = '#ffaa44';
            sideColor = '#cc7700';
            frontColor = '#dd8822';
            break;
        default:
            topColor = '#66aaff';
            sideColor = '#2266dd';
            frontColor = '#4488ff';
    }
    
    drawBox(plat.x, plat.y, plat.z, plat.width, plat.height, plat.depth, topColor, sideColor, frontColor);
    
    // Checkpoint marker
    if (plat.type === 'checkpoint') {
        const flagPos = project3D(plat.x + plat.width / 2, plat.y - 40, plat.z + plat.depth / 2);
        ctx.fillStyle = '#ffdd00';
        ctx.fillRect(flagPos.x - 2, flagPos.y, 4, 30);
        ctx.fillStyle = '#ff4444';
        ctx.beginPath();
        ctx.moveTo(flagPos.x + 2, flagPos.y);
        ctx.lineTo(flagPos.x + 18, flagPos.y + 8);
        ctx.lineTo(flagPos.x + 2, flagPos.y + 16);
        ctx.fill();
    }
    
    // Finish marker
    if (plat.type === 'finish') {
        const finPos = project3D(plat.x + plat.width / 2, plat.y - 50, plat.z + plat.depth / 2);
        ctx.fillStyle = '#ff00ff';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⭐ ZIEL', finPos.x, finPos.y);
    }
}

function drawObstacle(obs) {
    drawBox(obs.x, obs.y, obs.z, obs.width, obs.height, obs.depth, '#ff6666', '#cc2222', '#dd4444');
    
    // Spikes on top
    const center = project3D(obs.x + obs.width/2, obs.y - 5, obs.z + obs.depth/2);
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.moveTo(center.x - 6, center.y + 5);
    ctx.lineTo(center.x, center.y - 8);
    ctx.lineTo(center.x + 6, center.y + 5);
    ctx.fill();
}

function drawPlayer() {
    // Player shadow
    const shadowPos = project3D(player.x + 5, player.y + player.height + 5, player.z + 5);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(shadowPos.x, shadowPos.y, 15, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Player box
    drawBox(player.x, player.y, player.z, player.width, player.height, player.depth, 
            '#44ffaa', '#00cc66', '#22dd88');
    
    // Eyes on front face
    const faceCenter = project3D(player.x + player.width * 0.5, player.y + player.height * 0.3, player.z);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(faceCenter.x - 4, faceCenter.y, 4, 0, Math.PI * 2);
    ctx.arc(faceCenter.x + 4, faceCenter.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(faceCenter.x - 3, faceCenter.y + 1, 2, 0, Math.PI * 2);
    ctx.arc(faceCenter.x + 5, faceCenter.y + 1, 2, 0, Math.PI * 2);
    ctx.fill();
}

function drawHUD() {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(10, 10, 200, 70);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(10, 10, 200, 70);
    
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Fortschritt: ${score}m`, 20, 32);
    ctx.fillText(`Tode: ${deathCount}`, 20, 52);
    ctx.fillText(`Modus: ${difficulty === 'easy' ? 'Einfach' : 'Schwer'}`, 20, 72);
}

function drawMenu() {
    // Title
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('OBBY PARCOURS', canvas.width/2, 150);
    
    ctx.font = '20px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Spring von Plattform zu Plattform!', canvas.width/2, 195);
    
    // Difficulty selection
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('Schwierigkeit wählen:', canvas.width/2, 280);
    
    // Easy button
    const easySelected = menuSelection === 0;
    ctx.fillStyle = easySelected ? '#44ff88' : '#226644';
    ctx.fillRect(canvas.width/2 - 150, 310, 130, 50);
    ctx.fillStyle = easySelected ? '#000' : '#aaa';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('EINFACH', canvas.width/2 - 85, 342);
    
    // Hard button
    const hardSelected = menuSelection === 1;
    ctx.fillStyle = hardSelected ? '#ff4466' : '#662233';
    ctx.fillRect(canvas.width/2 + 20, 310, 130, 50);
    ctx.fillStyle = hardSelected ? '#fff' : '#aaa';
    ctx.fillText('SCHWER', canvas.width/2 + 85, 342);
    
    // Selection indicator
    const arrowX = menuSelection === 0 ? canvas.width/2 - 85 : canvas.width/2 + 85;
    ctx.fillStyle = '#fff';
    ctx.font = '24px sans-serif';
    ctx.fillText('▼', arrowX, 305);
    
    // Controls
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#888';
    ctx.fillText('← → zum Wählen | LEERTASTE zum Starten', canvas.width/2, 420);
    ctx.fillText('', canvas.width/2, 445);
    ctx.fillText('Steuerung:', canvas.width/2, 480);
    ctx.fillStyle = '#aaa';
    ctx.fillText('WASD / Pfeiltasten = Bewegen', canvas.width/2, 510);
    ctx.fillText('LEERTASTE = Springen', canvas.width/2, 535);
    ctx.fillText('🎮 Gamepad: Stick + A-Taste', canvas.width/2, 560);
}

function drawGameOver() {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', canvas.width/2, canvas.height/2 - 40);
    
    ctx.fillStyle = '#fff';
    ctx.font = '24px sans-serif';
    ctx.fillText(`Fortschritt: ${score}m`, canvas.width/2, canvas.height/2 + 20);
    ctx.fillText(`Tode: ${deathCount}`, canvas.width/2, canvas.height/2 + 55);
    
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText('LEERTASTE zum Neustart', canvas.width/2, canvas.height/2 + 110);
}

function drawWin() {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#44ff88';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🎉 GESCHAFFT! 🎉', canvas.width/2, canvas.height/2 - 60);
    
    ctx.fillStyle = '#fff';
    ctx.font = '24px sans-serif';
    ctx.fillText(`Fortschritt: ${score}m`, canvas.width/2, canvas.height/2);
    ctx.fillText(`Tode: ${deathCount}`, canvas.width/2, canvas.height/2 + 35);
    ctx.fillText(`Modus: ${difficulty === 'easy' ? 'Einfach' : 'Schwer'}`, canvas.width/2, canvas.height/2 + 70);
    
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText('LEERTASTE für Neustart | Menü', canvas.width/2, canvas.height/2 + 130);
}

// ==================== GAME CONTROL ====================

function startGame() {
    difficulty = menuSelection === 0 ? 'easy' : 'hard';
    score = 0;
    deathCount = 0;
    levelIndex = 0;
    
    generateLevels();
    
    player.x = 50;
    player.y = 150;
    player.z = 20;
    player.vx = 0;
    player.vy = 0;
    player.vz = 0;
    player.depth = PLAYER_SIZE;
    player.grounded = false;
    
    camera.x = player.x;
    camera.y = player.y;
    camera.z = player.z;
    
    checkpointPos = { x: 50, y: 150, z: 20 };
    
    gameState = 'playing';
    lastTime = 0;
}

function returnToMenu() {
    gameState = 'menu';
    menuSelection = 0;
}

// ==================== GAME LOOP ====================

function gameLoop(timestamp) {
    if (lastTime === 0) lastTime = timestamp;
    const elapsed = timestamp - lastTime;
    lastTime = timestamp;
    const dt = Math.min(elapsed / (1000 / TARGET_FPS), 3);
    
    // Menu gamepad handling
    if (gameState === 'menu') {
        handleMenuGamepad();
    }
    
    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
}

function handleMenuGamepad() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let gp of gamepads) {
        if (!gp) continue;
        
        const lx = gp.axes[0];
        if (lx > 0.5) menuSelection = 1;
        if (lx < -0.5) menuSelection = 0;
        
        // A button to start
        if (gp.buttons[0] && gp.buttons[0].pressed) {
            startGame();
        }
    }
}

// ==================== INPUT ====================

document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    
    if (e.code === 'Space') {
        e.preventDefault();
        if (gameState === 'menu') {
            startGame();
        } else if (gameState === 'gameover' || gameState === 'win') {
            returnToMenu();
        }
    }
    
    if (e.code === 'Enter') {
        e.preventDefault();
        if (gameState === 'menu') {
            startGame();
        } else if (gameState === 'gameover' || gameState === 'win') {
            returnToMenu();
        }
    }
    
    // Menu navigation
    if (gameState === 'menu') {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
            menuSelection = 0;
        }
        if (e.code === 'ArrowRight' || e.code === 'KeyD') {
            menuSelection = 1;
        }
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// Prevent scrolling
window.addEventListener('keydown', (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
    }
});

// Gamepad connected
window.addEventListener('gamepadconnected', (e) => {
    gamepadConnected = true;
    console.log('Gamepad verbunden:', e.gamepad.id);
});

// ==================== START ====================

requestAnimationFrame(gameLoop);
