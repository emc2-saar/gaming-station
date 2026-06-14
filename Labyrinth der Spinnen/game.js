const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const TARGET_FPS = 60;
let lastTime = 0;

// Game states
const STATE_MENU = 0;
const STATE_PLAYING = 1;
const STATE_JUMPSCARE = 2;
const STATE_GAMEOVER = 3;
const STATE_WIN = 4;
let gameState = STATE_MENU;

// Map settings
const MAP_SIZE = 21; // Must be odd for maze generation
let map = [];
let exitX = 0;
let exitY = 0;

// Player
let playerX = 1.5;
let playerY = 1.5;
let playerAngle = 0;
const MOVE_SPEED = 2.5;
const ROT_SPEED = 1.6;
const FOV = Math.PI / 3; // 60 degrees

// Raycasting
const NUM_RAYS = 320;
const MAX_DEPTH = 16;

// Input
const keys = {};
let gamepadIndex = -1;

// Jump scare system
let jumpScareTimer = 0;
let jumpScareActive = false;
let jumpScareDuration = 0;
let jumpScareType = 0;
const JUMPSCARE_DISPLAY_TIME = 45; // frames worth at 60fps
let nextScareDistance = 0;
let distanceTraveled = 0;
let lastPlayerX = 0;
let lastPlayerY = 0;

// Atmosphere
let fogDistance = 12;
let flickerTimer = 0;
let flickerIntensity = 1;

// Score / Timer
let timeElapsed = 0;
let scareCount = 0;

// Minimap (small hint)
const MINIMAP_SIZE = 80;
const MINIMAP_SCALE = MINIMAP_SIZE / MAP_SIZE;

// ============ MAZE GENERATION ============

function generateMaze() {
    // Initialize map with walls
    map = [];
    for (let y = 0; y < MAP_SIZE; y++) {
        map[y] = [];
        for (let x = 0; x < MAP_SIZE; x++) {
            map[y][x] = 1; // wall
        }
    }

    // Recursive backtracker maze generation
    const stack = [];
    const startCellX = 1;
    const startCellY = 1;
    map[startCellY][startCellX] = 0;
    stack.push({ x: startCellX, y: startCellY });

    while (stack.length > 0) {
        const current = stack[stack.length - 1];
        const neighbors = getUnvisitedNeighbors(current.x, current.y);

        if (neighbors.length === 0) {
            stack.pop();
        } else {
            const next = neighbors[Math.floor(Math.random() * neighbors.length)];
            // Remove wall between current and next
            const wallX = current.x + (next.x - current.x) / 2;
            const wallY = current.y + (next.y - current.y) / 2;
            map[wallY][wallX] = 0;
            map[next.y][next.x] = 0;
            stack.push(next);
        }
    }

    // Set exit at far corner
    exitX = MAP_SIZE - 2;
    exitY = MAP_SIZE - 2;
    map[exitY][exitX] = 2; // 2 = exit
    // Make sure path to exit is clear
    map[exitY - 1][exitX] = 0;
    map[exitY][exitX - 1] = 0;
}

function getUnvisitedNeighbors(x, y) {
    const neighbors = [];
    const directions = [
        { dx: 0, dy: -2 },
        { dx: 2, dy: 0 },
        { dx: 0, dy: 2 },
        { dx: -2, dy: 0 }
    ];

    for (const dir of directions) {
        const nx = x + dir.dx;
        const ny = y + dir.dy;
        if (nx > 0 && nx < MAP_SIZE - 1 && ny > 0 && ny < MAP_SIZE - 1 && map[ny][nx] === 1) {
            neighbors.push({ x: nx, y: ny });
        }
    }
    return neighbors;
}

// ============ RAYCASTING ============

function castRay(angle) {
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    
    let dist = 0;
    const step = 0.02;
    
    while (dist < MAX_DEPTH) {
        const testX = playerX + cos * dist;
        const testY = playerY + sin * dist;
        
        const mapX = Math.floor(testX);
        const mapY = Math.floor(testY);
        
        if (mapX < 0 || mapX >= MAP_SIZE || mapY < 0 || mapY >= MAP_SIZE) {
            return { dist: MAX_DEPTH, type: 1 };
        }
        
        if (map[mapY][mapX] === 1) {
            // Determine which side was hit for texture variation
            const side = (Math.abs(testX - mapX) < 0.05 || Math.abs(testX - mapX - 1) < 0.05) ? 0 : 1;
            return { dist: dist, type: 1, side: side, hitX: testX, hitY: testY };
        }
        
        if (map[mapY][mapX] === 2) {
            return { dist: dist, type: 2, side: 0 };
        }
        
        dist += step;
    }
    
    return { dist: MAX_DEPTH, type: 0 };
}

// ============ JUMP SCARE SYSTEM ============

function triggerJumpScare() {
    jumpScareActive = true;
    jumpScareDuration = JUMPSCARE_DISPLAY_TIME;
    jumpScareType = Math.floor(Math.random() * 4);
    scareCount++;
    scheduleNextScare();
}

function scheduleNextScare() {
    // Next scare happens after traveling 6-14 units
    nextScareDistance = distanceTraveled + 6 + Math.random() * 8;
}

function checkForScare() {
    if (jumpScareActive) return;
    
    if (distanceTraveled >= nextScareDistance) {
        // Only trigger if player is in a narrow corridor (more scary)
        const wallsNearby = countNearbyWalls();
        if (wallsNearby >= 2 || Math.random() < 0.3) {
            triggerJumpScare();
        } else {
            nextScareDistance += 1; // try again soon
        }
    }
}

function countNearbyWalls() {
    let count = 0;
    const dirs = [
        { dx: 0.6, dy: 0 }, { dx: -0.6, dy: 0 },
        { dx: 0, dy: 0.6 }, { dx: 0, dy: -0.6 }
    ];
    for (const dir of dirs) {
        const mx = Math.floor(playerX + dir.dx);
        const my = Math.floor(playerY + dir.dy);
        if (mx >= 0 && mx < MAP_SIZE && my >= 0 && my < MAP_SIZE && map[my][mx] === 1) {
            count++;
        }
    }
    return count;
}

function drawJumpScare() {
    const progress = 1 - (jumpScareDuration / JUMPSCARE_DISPLAY_TIME);
    const shake = (1 - progress) * 12;
    
    ctx.save();
    ctx.translate(
        (Math.random() - 0.5) * shake,
        (Math.random() - 0.5) * shake
    );
    
    // Dark flash
    ctx.fillStyle = `rgba(0, 0, 0, ${0.6 + Math.random() * 0.2})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const size = 120 + Math.sin(progress * Math.PI) * 40;
    
    if (jumpScareType === 0) {
        // Giant spider dropping from above
        const dropY = cy - 100 + progress * 100;
        drawScarySpider(cx, dropY, size, progress);
    } else if (jumpScareType === 1) {
        // Spider crawling towards camera (getting bigger)
        const scale = 0.3 + progress * 0.7;
        drawScarySpider(cx, cy, size * scale, progress);
        // Many red eyes in background
        for (let i = 0; i < 12; i++) {
            const ex = Math.sin(i * 1.7 + progress * 3) * 250 + cx;
            const ey = Math.cos(i * 2.3 + progress * 2) * 150 + cy;
            const blink = Math.sin(Date.now() * 0.01 + i * 5) > -0.3;
            if (blink) {
                ctx.fillStyle = `rgba(255, 0, 0, ${0.4 + Math.random() * 0.3})`;
                ctx.beginPath();
                ctx.arc(ex, ey, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    } else if (jumpScareType === 2) {
        // Swarm of small spiders
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < 20; i++) {
            const sx = cx + Math.sin(i * 2.1 + progress * 5) * (150 * progress);
            const sy = cy + Math.cos(i * 1.7 + progress * 4) * (120 * progress);
            const ss = 15 + Math.sin(i + progress * 10) * 5;
            drawMiniSpider(sx, sy, ss, progress);
        }
    } else {
        // Giant spider face close-up with fangs
        drawSpiderFaceCloseup(cx, cy, size * 1.5, progress);
    }
    
    // Red vignette flash
    const flashAlpha = (1 - progress) * 0.5;
    const gradient = ctx.createRadialGradient(cx, cy, 50, cx, cy, 400);
    gradient.addColorStop(0, 'rgba(80, 0, 0, 0)');
    gradient.addColorStop(1, `rgba(150, 0, 0, ${flashAlpha})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.restore();
}

function drawScarySpider(x, y, size, progress) {
    // Thread
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, y - size * 0.8);
    ctx.stroke();
    
    // Abdomen (big round body)
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.ellipse(x, y + size * 0.2, size * 0.5, size * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Markings on abdomen
    ctx.fillStyle = '#300';
    ctx.beginPath();
    ctx.ellipse(x, y + size * 0.1, size * 0.15, size * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Cephalothorax (front body)
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.ellipse(x, y - size * 0.3, size * 0.35, size * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Legs - hairy and animated
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 3;
    const legAnim = Date.now() * 0.008;
    for (let side = -1; side <= 1; side += 2) {
        for (let leg = 0; leg < 4; leg++) {
            const baseAngle = (-0.8 + leg * 0.4) * side;
            const legLen = size * 1.2;
            const joint1X = x + Math.cos(baseAngle) * legLen * 0.4;
            const joint1Y = y - size * 0.2 + Math.sin(baseAngle) * legLen * 0.2 + Math.sin(legAnim + leg + side) * 3;
            const endX = x + Math.cos(baseAngle) * legLen;
            const endY = y + size * 0.5 + leg * size * 0.15 + Math.sin(legAnim + leg * 2) * 4;
            
            ctx.beginPath();
            ctx.moveTo(x, y - size * 0.2);
            ctx.quadraticCurveTo(joint1X, joint1Y, endX, endY);
            ctx.stroke();
            
            // Hair on legs
            if (size > 60) {
                ctx.lineWidth = 1;
                for (let h = 0; h < 3; h++) {
                    const t = 0.3 + h * 0.2;
                    const hx = x + (endX - x) * t;
                    const hy = (y - size * 0.2) + (endY - (y - size * 0.2)) * t;
                    ctx.beginPath();
                    ctx.moveTo(hx, hy);
                    ctx.lineTo(hx + side * 4, hy - 4);
                    ctx.stroke();
                }
                ctx.lineWidth = 3;
            }
        }
    }
    
    // Eyes (cluster of 8)
    const eyePositions = [
        { dx: -0.15, dy: -0.4, s: 0.06 },
        { dx: 0.15, dy: -0.4, s: 0.06 },
        { dx: -0.08, dy: -0.5, s: 0.04 },
        { dx: 0.08, dy: -0.5, s: 0.04 },
        { dx: -0.2, dy: -0.35, s: 0.03 },
        { dx: 0.2, dy: -0.35, s: 0.03 },
        { dx: -0.05, dy: -0.32, s: 0.03 },
        { dx: 0.05, dy: -0.32, s: 0.03 }
    ];
    for (const eye of eyePositions) {
        // Eye glow
        ctx.fillStyle = `rgba(255, 0, 0, ${0.7 + Math.sin(progress * 20 + eye.dx * 10) * 0.3})`;
        ctx.beginPath();
        ctx.arc(x + eye.dx * size, y + eye.dy * size, eye.s * size, 0, Math.PI * 2);
        ctx.fill();
        // Bright center
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(x + eye.dx * size, y + eye.dy * size, eye.s * size * 0.3, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Fangs
    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.moveTo(x - size * 0.08, y - size * 0.2);
    ctx.lineTo(x - size * 0.12, y - size * 0.05);
    ctx.lineTo(x - size * 0.03, y - size * 0.15);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + size * 0.08, y - size * 0.2);
    ctx.lineTo(x + size * 0.12, y - size * 0.05);
    ctx.lineTo(x + size * 0.03, y - size * 0.15);
    ctx.fill();
}

function drawMiniSpider(x, y, size, progress) {
    // Small fast spider
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(x, y, size * 0.3, 0, Math.PI * 2);
    ctx.fill();
    
    // Legs
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    const t = Date.now() * 0.015;
    for (let side = -1; side <= 1; side += 2) {
        for (let leg = 0; leg < 4; leg++) {
            const angle = (leg * 0.5 + 0.3) * side;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(
                x + Math.cos(angle + Math.sin(t + leg) * 0.3) * size,
                y + Math.sin(angle + Math.cos(t + leg) * 0.3) * size
            );
            ctx.stroke();
        }
    }
    
    // Eyes
    ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
    ctx.beginPath();
    ctx.arc(x - 2, y - 2, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 2, y - 2, 1.5, 0, Math.PI * 2);
    ctx.fill();
}

function drawSpiderFaceCloseup(x, y, size, progress) {
    // Extreme close-up of spider face
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Giant head filling screen
    ctx.fillStyle = '#151515';
    ctx.beginPath();
    ctx.ellipse(x, y + size * 0.2, size * 0.9, size * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Texture / hair
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    for (let i = 0; i < 40; i++) {
        const hx = x + (Math.random() - 0.5) * size * 1.4;
        const hy = y + (Math.random() - 0.5) * size * 1.2;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(hx + (Math.random() - 0.5) * 10, hy - Math.random() * 8);
        ctx.stroke();
    }
    
    // Large eyes
    const bigEyes = [
        { dx: -0.25, dy: -0.15, s: 0.15 },
        { dx: 0.25, dy: -0.15, s: 0.15 },
        { dx: -0.12, dy: -0.3, s: 0.1 },
        { dx: 0.12, dy: -0.3, s: 0.1 },
        { dx: -0.35, dy: 0.0, s: 0.07 },
        { dx: 0.35, dy: 0.0, s: 0.07 },
        { dx: -0.08, dy: 0.0, s: 0.06 },
        { dx: 0.08, dy: 0.0, s: 0.06 }
    ];
    for (const eye of bigEyes) {
        // Dark socket
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(x + eye.dx * size, y + eye.dy * size, eye.s * size * 1.2, 0, Math.PI * 2);
        ctx.fill();
        // Glowing red eye
        const glow = 0.6 + Math.sin(progress * 15 + eye.dx * 20) * 0.4;
        ctx.fillStyle = `rgba(200, 0, 0, ${glow})`;
        ctx.beginPath();
        ctx.arc(x + eye.dx * size, y + eye.dy * size, eye.s * size, 0, Math.PI * 2);
        ctx.fill();
        // Reflection
        ctx.fillStyle = `rgba(255, 255, 255, ${glow * 0.5})`;
        ctx.beginPath();
        ctx.arc(x + eye.dx * size - eye.s * size * 0.3, y + eye.dy * size - eye.s * size * 0.3, eye.s * size * 0.25, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Giant fangs
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.moveTo(x - size * 0.15, y + size * 0.2);
    ctx.quadraticCurveTo(x - size * 0.2, y + size * 0.5, x - size * 0.1, y + size * 0.6);
    ctx.quadraticCurveTo(x - size * 0.05, y + size * 0.4, x - size * 0.08, y + size * 0.2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + size * 0.15, y + size * 0.2);
    ctx.quadraticCurveTo(x + size * 0.2, y + size * 0.5, x + size * 0.1, y + size * 0.6);
    ctx.quadraticCurveTo(x + size * 0.05, y + size * 0.4, x + size * 0.08, y + size * 0.2);
    ctx.fill();
    
    // Dripping venom
    const dripProgress = (Date.now() * 0.003) % 1;
    ctx.fillStyle = 'rgba(100, 200, 0, 0.6)';
    ctx.beginPath();
    ctx.arc(x - size * 0.1, y + size * 0.6 + dripProgress * 30, 3, 0, Math.PI * 2);
    ctx.fill();
}

// ============ UPDATE ============

function update(dt) {
    if (gameState !== STATE_PLAYING && gameState !== STATE_JUMPSCARE) return;

    // Handle jump scare timer
    if (jumpScareActive) {
        jumpScareDuration -= dt;
        if (jumpScareDuration <= 0) {
            jumpScareActive = false;
        }
        return; // Don't move during scare
    }

    // Input
    let moveX = 0;
    let moveY = 0;
    let rotInput = 0;

    // Keyboard
    if (keys['ArrowLeft'] || keys['KeyA']) rotInput -= 1;
    if (keys['ArrowRight'] || keys['KeyD']) rotInput += 1;
    if (keys['ArrowUp'] || keys['KeyW']) { moveX += 1; }
    if (keys['ArrowDown'] || keys['KeyS']) { moveX -= 1; }

    // Gamepad
    const gp = getGamepad();
    if (gp) {
        const deadzone = 0.15;
        if (Math.abs(gp.axes[0]) > deadzone) rotInput += gp.axes[0];
        if (Math.abs(gp.axes[1]) > deadzone) moveX -= gp.axes[1];
        // Right stick for rotation
        if (gp.axes.length > 2 && Math.abs(gp.axes[2]) > deadzone) {
            rotInput += gp.axes[2];
        }
    }

    // Rotation (dt=1 at 60fps)
    playerAngle += rotInput * ROT_SPEED * 0.05 * dt;

    // Movement (dt=1 at 60fps)
    const moveSpeed = MOVE_SPEED * 0.03 * dt;
    const newX = playerX + Math.cos(playerAngle) * moveX * moveSpeed;
    const newY = playerY + Math.sin(playerAngle) * moveX * moveSpeed;

    // Collision detection with sliding
    const radius = 0.2;
    if (canMove(newX, playerY, radius)) {
        playerX = newX;
    }
    if (canMove(playerX, newY, radius)) {
        playerY = newY;
    }

    // Track distance
    const dx = playerX - lastPlayerX;
    const dy = playerY - lastPlayerY;
    distanceTraveled += Math.sqrt(dx * dx + dy * dy);
    lastPlayerX = playerX;
    lastPlayerY = playerY;

    // Check for exit
    const mapX = Math.floor(playerX);
    const mapY = Math.floor(playerY);
    if (map[mapY] && map[mapY][mapX] === 2) {
        gameState = STATE_WIN;
    }

    // Time
    timeElapsed += dt / 60;

    // Atmosphere flicker
    flickerTimer += dt * 0.1;
    flickerIntensity = 0.95 + Math.sin(flickerTimer) * 0.03 + Math.random() * 0.02;

    // Check for jump scares
    checkForScare();
}

function canMove(x, y, radius) {
    // Check corners of bounding box
    const checks = [
        { x: x - radius, y: y - radius },
        { x: x + radius, y: y - radius },
        { x: x - radius, y: y + radius },
        { x: x + radius, y: y + radius }
    ];
    
    for (const check of checks) {
        const mx = Math.floor(check.x);
        const my = Math.floor(check.y);
        if (mx < 0 || mx >= MAP_SIZE || my < 0 || my >= MAP_SIZE) return false;
        if (map[my][mx] === 1) return false;
    }
    return true;
}

// ============ DRAW ============

function draw() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (gameState === STATE_MENU) {
        drawMenu();
        return;
    }

    if (gameState === STATE_WIN) {
        drawWin();
        return;
    }

    if (gameState === STATE_GAMEOVER) {
        drawGameOver();
        return;
    }

    // Draw 3D view
    drawWorld();

    // Draw jump scare overlay
    if (jumpScareActive) {
        drawJumpScare();
    }

    // Draw minimap
    drawMinimap();

    // Draw HUD
    drawHUD();
}

function drawWorld() {
    const halfHeight = canvas.height / 2;
    
    // Ceiling
    const ceilGrad = ctx.createLinearGradient(0, 0, 0, halfHeight);
    ceilGrad.addColorStop(0, '#1a1a2e');
    ceilGrad.addColorStop(1, '#2a2a40');
    ctx.fillStyle = ceilGrad;
    ctx.fillRect(0, 0, canvas.width, halfHeight);
    
    // Floor
    const floorGrad = ctx.createLinearGradient(0, halfHeight, 0, canvas.height);
    floorGrad.addColorStop(0, '#2a2a2a');
    floorGrad.addColorStop(1, '#1a1a1a');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, halfHeight, canvas.width, halfHeight);

    // Cast rays
    const rayWidth = canvas.width / NUM_RAYS;
    
    // Pre-calculate junction positions (cells with 3+ open neighbors)
    const junctions = [];
    for (let y = 1; y < MAP_SIZE - 1; y++) {
        for (let x = 1; x < MAP_SIZE - 1; x++) {
            if (map[y][x] !== 0) continue;
            let openCount = 0;
            if (map[y-1][x] === 0 || map[y-1][x] === 2) openCount++;
            if (map[y+1][x] === 0 || map[y+1][x] === 2) openCount++;
            if (map[y][x-1] === 0 || map[y][x-1] === 2) openCount++;
            if (map[y][x+1] === 0 || map[y][x+1] === 2) openCount++;
            if (openCount >= 3) junctions.push({ x: x + 0.5, y: y + 0.5 });
        }
    }
    
    for (let i = 0; i < NUM_RAYS; i++) {
        const rayAngle = playerAngle - FOV / 2 + (i / NUM_RAYS) * FOV;
        const hit = castRay(rayAngle);
        
        // Fix fisheye
        const correctedDist = hit.dist * Math.cos(rayAngle - playerAngle);
        
        if (correctedDist < MAX_DEPTH && hit.type > 0) {
            const wallHeight = (canvas.height / correctedDist) * 0.8;
            const wallTop = halfHeight - wallHeight / 2;
            
            // Wall color based on distance and type
            const darkness = Math.max(0, 1 - correctedDist / fogDistance) * flickerIntensity;
            
            let r, g, b;
            if (hit.type === 2) {
                // Exit - greenish glow
                r = Math.floor(30 * darkness);
                g = Math.floor(240 * darkness);
                b = Math.floor(70 * darkness);
            } else if (hit.side === 0) {
                // Darker side
                r = Math.floor(80 * darkness);
                g = Math.floor(60 * darkness);
                b = Math.floor(100 * darkness);
            } else {
                // Lighter side
                r = Math.floor(110 * darkness);
                g = Math.floor(85 * darkness);
                b = Math.floor(130 * darkness);
            }
            
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(i * rayWidth, wallTop, rayWidth + 1, wallHeight);
            
            // Add some texture lines
            if (correctedDist < 4 && Math.random() < 0.1) {
                ctx.fillStyle = `rgba(0,0,0,0.3)`;
                ctx.fillRect(i * rayWidth, wallTop + Math.random() * wallHeight, rayWidth, 2);
            }
            
            // Red shimmer near junctions
            for (const junc of junctions) {
                const distToJunc = Math.sqrt(
                    (playerX + Math.cos(rayAngle) * correctedDist - junc.x) ** 2 +
                    (playerY + Math.sin(rayAngle) * correctedDist - junc.y) ** 2
                );
                if (distToJunc < 2.0 && correctedDist < 8) {
                    const redIntensity = (1 - distToJunc / 2.0) * 0.7;
                    const pulse = 0.5 + Math.sin(Date.now() * 0.005 + junc.x * 3 + junc.y * 7) * 0.5;
                    ctx.fillStyle = `rgba(220, 0, 0, ${redIntensity * pulse})`;
                    ctx.fillRect(i * rayWidth, wallTop, rayWidth + 1, wallHeight);
                    break;
                }
            }
        }
    }
    
    // Fog overlay (subtle)
    const fogGrad = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 150,
        canvas.width / 2, canvas.height / 2, canvas.width / 1.2
    );
    fogGrad.addColorStop(0, 'rgba(0,0,0,0)');
    fogGrad.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = fogGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw cobwebs in corners of the screen
    drawCobwebs();
    
    // Draw spiders on walls
    drawSpiders();
}

function drawCobwebs() {
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.25)';
    ctx.lineWidth = 1;
    
    // Top-left cobweb with spider
    drawSingleCobweb(0, 0, 1, 1);
    drawCobwebSpider(55, 55);
    // Top-right cobweb with spider
    drawSingleCobweb(canvas.width, 0, -1, 1);
    drawCobwebSpider(canvas.width - 60, 50);
    
    // Occasional hanging threads from ceiling
    const seed = Math.floor(playerX * 3 + playerY * 7);
    for (let i = 0; i < 4; i++) {
        const pseudoRand = Math.sin(seed + i * 47) * 0.5 + 0.5;
        const threadX = pseudoRand * canvas.width;
        const threadLen = 30 + pseudoRand * 50;
        const sway = Math.sin(Date.now() * 0.001 + i * 2) * 3;
        
        ctx.strokeStyle = 'rgba(180, 180, 180, 0.15)';
        ctx.beginPath();
        ctx.moveTo(threadX, 0);
        ctx.quadraticCurveTo(threadX + sway, threadLen * 0.6, threadX + sway * 0.5, threadLen);
        ctx.stroke();
    }
}

function drawCobwebSpider(x, y) {
    const size = 8;
    const bob = Math.sin(Date.now() * 0.0015) * 2;
    const sy = y + bob;
    
    // Body
    ctx.fillStyle = 'rgba(20, 20, 20, 0.9)';
    ctx.beginPath();
    ctx.ellipse(x, sy, size * 0.5, size * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Head
    ctx.beginPath();
    ctx.arc(x, sy - size * 0.8, size * 0.35, 0, Math.PI * 2);
    ctx.fill();
    
    // Legs
    ctx.strokeStyle = 'rgba(30, 30, 30, 0.9)';
    ctx.lineWidth = 1;
    const legTime = Date.now() * 0.002;
    for (let side = -1; side <= 1; side += 2) {
        for (let leg = 0; leg < 4; leg++) {
            const angle = (-0.6 + leg * 0.35) * side;
            const legLen = size * 1.4;
            const endX = x + Math.cos(angle) * legLen;
            const endY = sy + size * 0.3 + leg * size * 0.2 + Math.sin(legTime + leg * side) * 1;
            
            ctx.beginPath();
            ctx.moveTo(x, sy);
            ctx.quadraticCurveTo(x + Math.cos(angle) * legLen * 0.4, sy - 2, endX, endY);
            ctx.stroke();
        }
    }
    
    // Red eyes
    ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
    ctx.beginPath();
    ctx.arc(x - 2, sy - size * 0.9, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 2, sy - size * 0.9, 1.5, 0, Math.PI * 2);
    ctx.fill();
}

function drawSingleCobweb(originX, originY, dirX, dirY) {
    const size = 90;
    const strands = 6;
    
    ctx.save();
    ctx.strokeStyle = 'rgba(180, 180, 180, 0.2)';
    ctx.lineWidth = 0.8;
    
    // Main strands radiating from corner
    const points = [];
    for (let i = 0; i < strands; i++) {
        const angle = (i / strands) * (Math.PI / 2);
        const px = originX + Math.cos(angle) * size * dirX;
        const py = originY + Math.sin(angle) * size * dirY;
        points.push({ x: px, y: py });
        
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.lineTo(px, py);
        ctx.stroke();
    }
    
    // Connecting arcs between strands
    for (let ring = 1; ring <= 3; ring++) {
        const ringDist = ring / 3;
        ctx.beginPath();
        for (let i = 0; i < strands; i++) {
            const px = originX + (points[i].x - originX) * ringDist;
            const py = originY + (points[i].y - originY) * ringDist;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.stroke();
    }
    
    ctx.restore();
}

function drawSpiders() {
    // Use player position as seed for consistent spider placement
    const seed = Math.floor(playerX * 2) * 100 + Math.floor(playerY * 2);
    const numSpiders = 2;
    
    for (let i = 0; i < numSpiders; i++) {
        const pseudoRand1 = Math.abs(Math.sin(seed + i * 131)) ;
        const pseudoRand2 = Math.abs(Math.cos(seed + i * 97));
        
        // Only show spider some of the time based on position
        if (pseudoRand1 < 0.4) continue;
        
        const spiderX = pseudoRand1 * canvas.width;
        const spiderY = 40 + pseudoRand2 * (canvas.height * 0.4);
        const spiderSize = 6 + pseudoRand1 * 4;
        
        // Slight movement
        const bobY = Math.sin(Date.now() * 0.002 + i * 3) * 2;
        
        drawSpider(spiderX, spiderY + bobY, spiderSize);
    }
}

function drawSpider(x, y, size) {
    ctx.save();
    
    // Thread from ceiling
    ctx.strokeStyle = 'rgba(180, 180, 180, 0.2)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, y);
    ctx.stroke();
    
    // Body
    ctx.fillStyle = 'rgba(30, 30, 30, 0.8)';
    ctx.beginPath();
    ctx.ellipse(x, y, size * 0.6, size * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Head
    ctx.beginPath();
    ctx.arc(x, y - size * 0.9, size * 0.4, 0, Math.PI * 2);
    ctx.fill();
    
    // Legs
    ctx.strokeStyle = 'rgba(40, 40, 40, 0.8)';
    ctx.lineWidth = 1;
    const legTime = Date.now() * 0.003;
    for (let side = -1; side <= 1; side += 2) {
        for (let leg = 0; leg < 4; leg++) {
            const angle = (leg * 0.3 + 0.3) * side;
            const legLen = size * 1.5;
            const midX = x + Math.cos(angle) * legLen * 0.5;
            const midY = y + Math.sin(leg * 0.5) * size * 0.3 + Math.sin(legTime + leg) * 0.5;
            const endX = x + Math.cos(angle) * legLen;
            const endY = y + size * 0.5 + leg * size * 0.2;
            
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.quadraticCurveTo(midX, midY, endX, endY);
            ctx.stroke();
        }
    }
    
    // Eyes (small red dots)
    ctx.fillStyle = 'rgba(200, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.arc(x - size * 0.15, y - size * 1.0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + size * 0.15, y - size * 1.0, 1, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
}

function drawMinimap() {
    const offsetX = 10;
    const offsetY = canvas.height - MINIMAP_SIZE - 10;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(offsetX - 2, offsetY - 2, MINIMAP_SIZE + 4, MINIMAP_SIZE + 4);
    
    for (let y = 0; y < MAP_SIZE; y++) {
        for (let x = 0; x < MAP_SIZE; x++) {
            if (map[y][x] === 1) {
                ctx.fillStyle = '#333';
            } else if (map[y][x] === 2) {
                ctx.fillStyle = '#0f0';
            } else {
                continue; // don't draw floor
            }
            ctx.fillRect(
                offsetX + x * MINIMAP_SCALE,
                offsetY + y * MINIMAP_SCALE,
                MINIMAP_SCALE + 0.5,
                MINIMAP_SCALE + 0.5
            );
        }
    }
    
    // Player dot
    ctx.fillStyle = '#ff0';
    ctx.beginPath();
    ctx.arc(
        offsetX + playerX * MINIMAP_SCALE,
        offsetY + playerY * MINIMAP_SCALE,
        2, 0, Math.PI * 2
    );
    ctx.fill();
    
    // Player direction
    ctx.strokeStyle = '#ff0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(
        offsetX + playerX * MINIMAP_SCALE,
        offsetY + playerY * MINIMAP_SCALE
    );
    ctx.lineTo(
        offsetX + (playerX + Math.cos(playerAngle) * 1.5) * MINIMAP_SCALE,
        offsetY + (playerY + Math.sin(playerAngle) * 1.5) * MINIMAP_SCALE
    );
    ctx.stroke();
}

function drawHUD() {
    // Time
    ctx.fillStyle = '#aaa';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`Zeit: ${Math.floor(timeElapsed)}s`, canvas.width - 10, 20);
    
    // Hint
    ctx.fillStyle = '#0f0';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Finde den grünen Ausgang!', canvas.width / 2, canvas.height - 10);
}

function drawMenu() {
    // Dark background with subtle animation
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Creepy border lines
    ctx.strokeStyle = '#300';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
        const offset = Math.sin(Date.now() * 0.001 + i) * 3;
        ctx.beginPath();
        ctx.moveTo(20 + offset, 20 + i * 2);
        ctx.lineTo(canvas.width - 20 + offset, 20 + i * 2);
        ctx.lineTo(canvas.width - 20 + offset, canvas.height - 20 + i * 2);
        ctx.lineTo(20 + offset, canvas.height - 20 + i * 2);
        ctx.closePath();
        ctx.stroke();
    }
    
    // Title
    ctx.fillStyle = '#c00';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LABYRINTH', canvas.width / 2, canvas.height / 2 - 80);
    ctx.fillStyle = '#800';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('DER SPINNEN', canvas.width / 2, canvas.height / 2 - 45);
    
    // Instructions
    ctx.fillStyle = '#888';
    ctx.font = '16px sans-serif';
    ctx.fillText('Finde den Ausgang... wenn du dich traust.', canvas.width / 2, canvas.height / 2 + 10);
    
    ctx.fillStyle = '#aaa';
    ctx.font = '14px sans-serif';
    ctx.fillText('WASD / Pfeiltasten – Bewegen & Drehen', canvas.width / 2, canvas.height / 2 + 50);
    ctx.fillText('🎮 Gamepad: A-Button zum Starten, Stick zum Bewegen', canvas.width / 2, canvas.height / 2 + 72);
    
    // Start prompt
    const blink = Math.sin(Date.now() * 0.004) > 0;
    if (blink) {
        ctx.fillStyle = '#f44';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText('[ LEERTASTE / ENTER / 🅰 zum Starten ]', canvas.width / 2, canvas.height / 2 + 120);
    }
}

function drawWin() {
    ctx.fillStyle = '#0a1a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#0f0';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ENTKOMMEN!', canvas.width / 2, canvas.height / 2 - 60);
    
    ctx.fillStyle = '#8f8';
    ctx.font = '18px sans-serif';
    ctx.fillText(`Zeit: ${Math.floor(timeElapsed)} Sekunden`, canvas.width / 2, canvas.height / 2 - 10);
    ctx.fillText(`Jump Scares überlebt: ${scareCount}`, canvas.width / 2, canvas.height / 2 + 20);
    
    ctx.fillStyle = '#aaa';
    ctx.font = '16px sans-serif';
    ctx.fillText('Leertaste / Enter für neues Spiel', canvas.width / 2, canvas.height / 2 + 70);
}

function drawGameOver() {
    ctx.fillStyle = '#1a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#f00';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 30);
    
    ctx.fillStyle = '#aaa';
    ctx.font = '16px sans-serif';
    ctx.fillText('Leertaste / Enter zum Neustart', canvas.width / 2, canvas.height / 2 + 30);
}

// ============ INPUT ============

document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    
    if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (gameState === STATE_MENU || gameState === STATE_WIN || gameState === STATE_GAMEOVER) {
            startGame();
        }
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// Gamepad
function getGamepad() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of gamepads) {
        if (gp && gp.connected) {
            // Check for start button to begin game
            if (gp.buttons[0] && gp.buttons[0].pressed) {
                if (gameState === STATE_MENU || gameState === STATE_WIN || gameState === STATE_GAMEOVER) {
                    startGame();
                }
            }
            return gp;
        }
    }
    return null;
}

window.addEventListener('gamepadconnected', (e) => {
    gamepadIndex = e.gamepad.index;
});

// ============ GAME CONTROL ============

function startGame() {
    generateMaze();
    playerX = 1.5;
    playerY = 1.5;
    playerAngle = 0;
    lastPlayerX = playerX;
    lastPlayerY = playerY;
    distanceTraveled = 0;
    timeElapsed = 0;
    scareCount = 0;
    jumpScareActive = false;
    jumpScareDuration = 0;
    gameState = STATE_PLAYING;
    scheduleNextScare();
}

// ============ GAME LOOP ============

function pollGamepadMenu() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of gamepads) {
        if (gp && gp.connected) {
            if (gp.buttons[0] && gp.buttons[0].pressed) {
                if (gameState === STATE_MENU || gameState === STATE_WIN || gameState === STATE_GAMEOVER) {
                    startGame();
                }
            }
            break;
        }
    }
}

function gameLoop(timestamp) {
    if (lastTime === 0) lastTime = timestamp;
    const elapsed = timestamp - lastTime;
    lastTime = timestamp;
    const dt = Math.min(elapsed / (1000 / TARGET_FPS), 3);

    // Gamepad-Check auch im Menü/Win/GameOver
    if (gameState === STATE_MENU || gameState === STATE_WIN || gameState === STATE_GAMEOVER) {
        pollGamepadMenu();
    }

    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
}

// Start
requestAnimationFrame(gameLoop);
