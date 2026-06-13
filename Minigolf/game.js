const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const TARGET_FPS = 60;
let lastTime = 0;

// Game states
const STATE_TITLE = 0;
const STATE_PLAYING = 1;
const STATE_AIMING = 2;
const STATE_BALL_MOVING = 3;
const STATE_HOLE_COMPLETE = 4;
const STATE_GAME_OVER = 5;
const STATE_PLACING = 6;

let gameState = STATE_TITLE;
let currentHole = 0;
let strokes = 0;
let maxStrokes = 6;
let totalScore = 0;
let holeScores = [];

// Ball physics
let ball = { x: 0, y: 0, vx: 0, vy: 0, radius: 8 };
let ballInHole = false;

// Aiming
let aimAngle = 0;
let aimPower = 0;
let powerDirection = 1;
let maxPower = 15;

// Gamepad
let gamepadAimSpeed = 2;
let gamepadConnected = false;

// Hole definition
let hole = { x: 0, y: 0, radius: 14 };

// Input state
let keys = {};
let aimingWithKeys = false;

// Placing state
let placeMinX = 0;
let placeMaxX = 0;
let placeY = 0;

// Transition timer
let transitionTimer = 0;

// Level definitions - each has walls, start pos, hole pos, and optional obstacles
const levels = [
    // Hole 1 - Straight shot
    {
        start: { x: 400, y: 480 },
        hole: { x: 400, y: 120 },
        walls: [
            { x: 300, y: 50, w: 200, h: 500 }
        ],
        obstacles: []
    },
    // Hole 2 - Slight curve
    {
        start: { x: 200, y: 480 },
        hole: { x: 600, y: 120 },
        walls: [
            { x: 100, y: 50, w: 600, h: 500 }
        ],
        obstacles: []
    },
    // Hole 3 - Wall in the middle
    {
        start: { x: 400, y: 500 },
        hole: { x: 400, y: 100 },
        walls: [
            { x: 250, y: 50, w: 300, h: 520 }
        ],
        obstacles: [
            { x: 350, y: 300, w: 100, h: 20 }
        ]
    },
    // Hole 4 - L-shape
    {
        start: { x: 150, y: 500 },
        hole: { x: 650, y: 100 },
        walls: [
            { x: 80, y: 50, w: 200, h: 520 },
            { x: 280, y: 50, w: 440, h: 200 }
        ],
        obstacles: []
    },
    // Hole 5 - Narrow corridor
    {
        start: { x: 400, y: 520 },
        hole: { x: 400, y: 80 },
        walls: [
            { x: 350, y: 50, w: 100, h: 520 }
        ],
        obstacles: [
            { x: 350, y: 200, w: 40, h: 20 },
            { x: 410, y: 350, w: 40, h: 20 }
        ]
    },
    // Hole 6 - Zigzag
    {
        start: { x: 150, y: 520 },
        hole: { x: 650, y: 80 },
        walls: [
            { x: 80, y: 400, w: 250, h: 170 },
            { x: 470, y: 50, w: 250, h: 170 },
            { x: 250, y: 200, w: 300, h: 220 }
        ],
        obstacles: []
    },
    // Hole 7 - Island obstacle
    {
        start: { x: 400, y: 520 },
        hole: { x: 400, y: 80 },
        walls: [
            { x: 200, y: 50, w: 400, h: 520 }
        ],
        obstacles: [
            { x: 350, y: 250, w: 100, h: 100 }
        ]
    },
    // Hole 8 - Two corridors
    {
        start: { x: 200, y: 520 },
        hole: { x: 600, y: 80 },
        walls: [
            { x: 100, y: 50, w: 250, h: 520 },
            { x: 450, y: 50, w: 250, h: 520 }
        ],
        obstacles: [
            { x: 350, y: 200, w: 100, h: 20 }
        ]
    },
    // Hole 9 - Big room with obstacles
    {
        start: { x: 150, y: 450 },
        hole: { x: 650, y: 150 },
        walls: [
            { x: 80, y: 50, w: 640, h: 500 }
        ],
        obstacles: [
            { x: 250, y: 200, w: 30, h: 150 },
            { x: 450, y: 250, w: 30, h: 150 },
            { x: 350, y: 100, w: 30, h: 100 }
        ]
    },
    // Hole 10 - Funnel
    {
        start: { x: 400, y: 520 },
        hole: { x: 400, y: 80 },
        walls: [
            { x: 150, y: 50, w: 500, h: 200 },
            { x: 300, y: 250, w: 200, h: 320 }
        ],
        obstacles: []
    },
    // Hole 11 - S-curve
    {
        start: { x: 150, y: 520 },
        hole: { x: 150, y: 80 },
        walls: [
            { x: 80, y: 380, w: 300, h: 170 },
            { x: 80, y: 50, w: 300, h: 170 },
            { x: 420, y: 220, w: 300, h: 170 }
        ],
        obstacles: []
    },
    // Hole 12 - Diamond obstacle
    {
        start: { x: 400, y: 520 },
        hole: { x: 400, y: 80 },
        walls: [
            { x: 200, y: 50, w: 400, h: 520 }
        ],
        obstacles: [
            { x: 370, y: 270, w: 60, h: 60 },
            { x: 300, y: 180, w: 40, h: 40 },
            { x: 460, y: 180, w: 40, h: 40 },
            { x: 300, y: 360, w: 40, h: 40 },
            { x: 460, y: 360, w: 40, h: 40 }
        ]
    },
    // Hole 13 - Maze-like
    {
        start: { x: 130, y: 520 },
        hole: { x: 670, y: 80 },
        walls: [
            { x: 80, y: 400, w: 200, h: 160 },
            { x: 80, y: 50, w: 200, h: 200 },
            { x: 520, y: 350, w: 200, h: 210 },
            { x: 520, y: 50, w: 200, h: 200 },
            { x: 280, y: 200, w: 240, h: 200 }
        ],
        obstacles: []
    },
    // Hole 14 - Narrow gap
    {
        start: { x: 400, y: 520 },
        hole: { x: 400, y: 80 },
        walls: [
            { x: 200, y: 50, w: 400, h: 520 }
        ],
        obstacles: [
            { x: 200, y: 280, w: 170, h: 25 },
            { x: 430, y: 280, w: 170, h: 25 }
        ]
    },
    // Hole 15 - Around the corner
    {
        start: { x: 150, y: 150 },
        hole: { x: 650, y: 450 },
        walls: [
            { x: 80, y: 80, w: 200, h: 200 },
            { x: 520, y: 320, w: 200, h: 230 },
            { x: 280, y: 80, w: 440, h: 200 },
            { x: 80, y: 320, w: 440, h: 230 }
        ],
        obstacles: []
    },
    // Hole 16 - Obstacle course
    {
        start: { x: 400, y: 540 },
        hole: { x: 400, y: 70 },
        walls: [
            { x: 250, y: 50, w: 300, h: 530 }
        ],
        obstacles: [
            { x: 250, y: 440, w: 80, h: 20 },
            { x: 470, y: 440, w: 80, h: 20 },
            { x: 360, y: 350, w: 80, h: 20 },
            { x: 250, y: 260, w: 80, h: 20 },
            { x: 470, y: 260, w: 80, h: 20 },
            { x: 360, y: 170, w: 80, h: 20 }
        ]
    },
    // Hole 17 - Big spiral feel
    {
        start: { x: 400, y: 300 },
        hole: { x: 650, y: 80 },
        walls: [
            { x: 80, y: 50, w: 640, h: 500 }
        ],
        obstacles: [
            { x: 200, y: 150, w: 20, h: 300 },
            { x: 200, y: 150, w: 400, h: 20 },
            { x: 580, y: 150, w: 20, h: 200 },
            { x: 350, y: 350, w: 250, h: 20 }
        ]
    },
    // Hole 18 - Final challenge
    {
        start: { x: 130, y: 520 },
        hole: { x: 670, y: 80 },
        walls: [
            { x: 80, y: 400, w: 200, h: 160 },
            { x: 600, y: 50, w: 150, h: 160 },
            { x: 80, y: 50, w: 150, h: 160 }
        ],
        obstacles: [
            { x: 250, y: 150, w: 20, h: 200 },
            { x: 400, y: 250, w: 20, h: 200 },
            { x: 550, y: 150, w: 20, h: 200 },
            { x: 300, y: 400, w: 200, h: 20 },
            { x: 500, y: 100, w: 80, h: 20 }
        ]
    }
];

// Colors
const COLORS = {
    grass: '#2d6b30',
    grassDark: '#245524',
    wall: '#4a3728',
    wallBorder: '#2e2218',
    obstacle: '#8b4513',
    obstacleBorder: '#5c2e0a',
    ball: '#ffffff',
    ballShadow: '#cccccc',
    hole: '#111111',
    holeRing: '#333333',
    aimLine: '#ffdd44',
    powerBar: '#ff4444',
    powerBarBg: '#333333',
    text: '#ffffff',
    textShadow: '#000000',
    ui: '#2a2a4a'
};

function loadHole(index) {
    const level = levels[index];
    ball.x = level.start.x;
    ball.y = level.start.y;
    ball.vx = 0;
    ball.vy = 0;
    hole.x = level.hole.x;
    hole.y = level.hole.y;
    strokes = 0;
    ballInHole = false;
    aimAngle = -Math.PI / 2; // Default aim up
    aimPower = 0;
    powerDirection = 1;
    
    // Start in placing mode - find horizontal bounds on the start row
    placeY = level.start.y;
    placeMinX = Infinity;
    placeMaxX = -Infinity;
    for (const wall of level.walls) {
        if (placeY >= wall.y && placeY <= wall.y + wall.h) {
            placeMinX = Math.min(placeMinX, wall.x + ball.radius + 5);
            placeMaxX = Math.max(placeMaxX, wall.x + wall.w - ball.radius - 5);
        }
    }
    // Fallback if no wall found
    if (placeMinX === Infinity) {
        placeMinX = level.start.x - 50;
        placeMaxX = level.start.x + 50;
    }
    
    gameState = STATE_PLACING;
}

function resetGame() {
    currentHole = 0;
    totalScore = 0;
    holeScores = [];
    loadHole(0);
}

function update(dt) {
    // Poll gamepad
    pollGamepad(dt);

    if (gameState === STATE_PLACING) {
        // Move ball left/right to choose starting position
        const placeSpeed = 3;
        if (keys['ArrowLeft'] || keys['KeyA']) {
            ball.x -= placeSpeed * dt;
        }
        if (keys['ArrowRight'] || keys['KeyD']) {
            ball.x += placeSpeed * dt;
        }
        // Clamp to bounds
        ball.x = Math.max(placeMinX, Math.min(ball.x, placeMaxX));
    }

    if (gameState === STATE_AIMING) {
        // Power oscillates when holding space or gamepad A (slower pendulum)
        if (keys['Space'] || gamepadButtonHeld('A')) {
            aimPower += powerDirection * 0.06 * dt;
            if (aimPower >= 1) {
                aimPower = 1;
                powerDirection = -1;
            } else if (aimPower <= 0) {
                aimPower = 0;
                powerDirection = 1;
            }
        }

        // Keyboard aiming
        if (keys['ArrowLeft'] || keys['KeyA']) {
            aimAngle -= 0.03 * dt;
        }
        if (keys['ArrowRight'] || keys['KeyD']) {
            aimAngle += 0.03 * dt;
        }
    }

    if (gameState === STATE_BALL_MOVING) {
        // Sub-step physics for accurate collision
        const subSteps = 4;
        const subDt = dt / subSteps;
        
        for (let step = 0; step < subSteps; step++) {
            // Apply friction per substep
            const friction = 0.988;
            ball.vx *= Math.pow(friction, subDt);
            ball.vy *= Math.pow(friction, subDt);

            // Move ball
            ball.x += ball.vx * subDt;
            ball.y += ball.vy * subDt;

            // Collision with course boundaries (walls = playable area)
            const level = levels[currentHole];
            collideBoundaries(level);
            
            // Obstacle collisions
            collideObstacles(level);
        }

        // Check if ball reaches hole
        const dx = ball.x - hole.x;
        const dy = ball.y - hole.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);

        if (dist < hole.radius && speed < 10) {
            // Ball in hole!
            ballInHole = true;
            ball.x = hole.x;
            ball.y = hole.y;
            ball.vx = 0;
            ball.vy = 0;
            holeScores.push(strokes);
            totalScore += strokes;
            gameState = STATE_HOLE_COMPLETE;
            transitionTimer = 120;
        }

        // Ball stopped?
        if (speed < 0.08) {
            ball.vx = 0;
            ball.vy = 0;
            
            if (strokes >= maxStrokes) {
                // Max strokes reached
                holeScores.push(maxStrokes + 1); // penalty
                totalScore += maxStrokes + 1;
                gameState = STATE_HOLE_COMPLETE;
                transitionTimer = 120;
            } else {
                gameState = STATE_AIMING;
                aimPower = 0;
                powerDirection = 1;
            }
        }
    }

    if (gameState === STATE_HOLE_COMPLETE) {
        transitionTimer -= dt;
        if (transitionTimer <= 0) {
            currentHole++;
            if (currentHole >= 18) {
                gameState = STATE_GAME_OVER;
            } else {
                loadHole(currentHole);
            }
        }
    }
}

function draw() {
    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (gameState === STATE_TITLE) {
        drawTitleScreen();
        return;
    }

    if (gameState === STATE_GAME_OVER) {
        drawGameOverScreen();
        return;
    }

    // Draw course
    drawCourse();

    // Draw hole
    ctx.beginPath();
    ctx.arc(hole.x, hole.y, hole.radius, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.hole;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(hole.x, hole.y, hole.radius + 2, 0, Math.PI * 2);
    ctx.strokeStyle = COLORS.holeRing;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw flag
    ctx.beginPath();
    ctx.moveTo(hole.x + 2, hole.y);
    ctx.lineTo(hole.x + 2, hole.y - 30);
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hole.x + 2, hole.y - 30);
    ctx.lineTo(hole.x + 18, hole.y - 22);
    ctx.lineTo(hole.x + 2, hole.y - 14);
    ctx.fillStyle = '#ff3333';
    ctx.fill();

    // Draw ball
    if (!ballInHole) {
        // Shadow
        ctx.beginPath();
        ctx.ellipse(ball.x + 2, ball.y + 2, ball.radius, ball.radius * 0.7, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fill();
        
        // Ball
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.ball;
        ctx.fill();
        ctx.strokeStyle = '#dddddd';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Shine
        ctx.beginPath();
        ctx.arc(ball.x - 2, ball.y - 2, 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fill();
    }

    // Draw placing indicator
    if (gameState === STATE_PLACING) {
        // Horizontal line showing placement range
        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.moveTo(placeMinX, placeY);
        ctx.lineTo(placeMaxX, placeY);
        ctx.strokeStyle = 'rgba(255, 221, 68, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Arrows at ends
        ctx.fillStyle = 'rgba(255, 221, 68, 0.7)';
        ctx.beginPath();
        ctx.moveTo(placeMinX, placeY - 6);
        ctx.lineTo(placeMinX + 8, placeY);
        ctx.lineTo(placeMinX, placeY + 6);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(placeMaxX, placeY - 6);
        ctx.lineTo(placeMaxX - 8, placeY);
        ctx.lineTo(placeMaxX, placeY + 6);
        ctx.fill();
        
        // Instruction text
        ctx.fillStyle = '#ffdd44';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('← → Abschlagposition wählen, Leertaste/A bestätigen', canvas.width / 2, canvas.height - 15);
    }

    // Draw aim line
    if (gameState === STATE_AIMING) {
        const lineLen = 50 + aimPower * 80;
        const endX = ball.x + Math.cos(aimAngle) * lineLen;
        const endY = ball.y + Math.sin(aimAngle) * lineLen;

        ctx.beginPath();
        ctx.setLineDash([5, 5]);
        ctx.moveTo(ball.x, ball.y);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = COLORS.aimLine;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);

        // Arrow head
        const arrowSize = 8;
        const arrowAngle = 0.5;
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - arrowSize * Math.cos(aimAngle - arrowAngle), endY - arrowSize * Math.sin(aimAngle - arrowAngle));
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - arrowSize * Math.cos(aimAngle + arrowAngle), endY - arrowSize * Math.sin(aimAngle + arrowAngle));
        ctx.strokeStyle = COLORS.aimLine;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Power bar
        drawPowerBar();
    }

    // UI
    drawUI();

    // Hole complete overlay
    if (gameState === STATE_HOLE_COMPLETE) {
        drawHoleComplete();
    }
}

function drawCourse() {
    const level = levels[currentHole];
    
    // Draw course walls (green areas)
    for (const wall of level.walls) {
        // Grass
        ctx.fillStyle = COLORS.grass;
        ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
        
        // Grass texture (subtle lines)
        ctx.strokeStyle = COLORS.grassDark;
        ctx.lineWidth = 0.5;
        for (let i = wall.y; i < wall.y + wall.h; i += 12) {
            ctx.beginPath();
            ctx.moveTo(wall.x, i);
            ctx.lineTo(wall.x + wall.w, i);
            ctx.stroke();
        }
        
        // Border
        ctx.strokeStyle = COLORS.wallBorder;
        ctx.lineWidth = 3;
        ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);
    }

    // Draw obstacles
    for (const obs of level.obstacles) {
        ctx.fillStyle = COLORS.obstacle;
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.strokeStyle = COLORS.obstacleBorder;
        ctx.lineWidth = 2;
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
        
        // Wood grain effect
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 1;
        for (let i = obs.x + 5; i < obs.x + obs.w; i += 8) {
            ctx.beginPath();
            ctx.moveTo(i, obs.y);
            ctx.lineTo(i, obs.y + obs.h);
            ctx.stroke();
        }
    }
}

function drawPowerBar() {
    const barX = 30;
    const barY = canvas.height - 40;
    const barW = 150;
    const barH = 20;

    ctx.fillStyle = COLORS.powerBarBg;
    ctx.fillRect(barX, barY, barW, barH);
    
    // Power gradient
    const gradient = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    gradient.addColorStop(0, '#44ff44');
    gradient.addColorStop(0.5, '#ffff44');
    gradient.addColorStop(1, '#ff4444');
    ctx.fillStyle = gradient;
    ctx.fillRect(barX, barY, barW * aimPower, barH);
    
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barW, barH);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Kraft', barX, barY - 5);
}

function drawUI() {
    // Hole number
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Bahn ${currentHole + 1} / 18`, 30, 30);

    // Strokes
    ctx.fillText(`Schlag ${strokes} / ${maxStrokes}`, 30, 55);

    // Total score
    ctx.textAlign = 'right';
    ctx.fillText(`Gesamt: ${totalScore}`, canvas.width - 30, 30);

    // Par info
    ctx.font = '14px sans-serif';
    ctx.fillText(`Par: 3`, canvas.width - 30, 55);
}

function drawTitleScreen() {
    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#1a4a1a');
    gradient.addColorStop(1, '#1a1a2e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⛳ Minigolf', canvas.width / 2, 180);

    // Subtitle
    ctx.font = '22px sans-serif';
    ctx.fillStyle = '#aaffaa';
    ctx.fillText('18 Bahnen Herausforderung', canvas.width / 2, 230);

    // Instructions
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#cccccc';
    ctx.fillText('Steuerung:', canvas.width / 2, 310);
    ctx.fillText('← → oder A/D = Richtung ändern', canvas.width / 2, 340);
    ctx.fillText('Leertaste gedrückt halten = Kraft aufladen', canvas.width / 2, 365);
    ctx.fillText('Leertaste loslassen = Abschlagen', canvas.width / 2, 390);
    ctx.fillText('Gamepad: Stick = Zielen, A = Kraft & Schlagen', canvas.width / 2, 420);

    // Start prompt
    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = '#ffdd44';
    const blink = Math.sin(Date.now() / 500) > 0;
    if (blink) {
        ctx.fillText('Leertaste oder A zum Starten', canvas.width / 2, 500);
    }

    // Credits
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#666666';
    ctx.fillText('EmC² Saar e.V. – KI-Gaming Station', canvas.width / 2, canvas.height - 20);
}

function drawGameOverScreen() {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#1a4a1a');
    gradient.addColorStop(1, '#1a1a2e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Runde beendet!', canvas.width / 2, 80);

    // Score
    ctx.font = 'bold 28px sans-serif';
    ctx.fillStyle = '#ffdd44';
    ctx.fillText(`Gesamtschläge: ${totalScore}`, canvas.width / 2, 130);

    const par = 54; // 18 holes * par 3
    const diff = totalScore - par;
    ctx.font = '20px sans-serif';
    if (diff <= 0) {
        ctx.fillStyle = '#44ff44';
        ctx.fillText(`${diff} (Unter Par!)`, canvas.width / 2, 165);
    } else {
        ctx.fillStyle = '#ff8844';
        ctx.fillText(`+${diff} (Über Par)`, canvas.width / 2, 165);
    }

    // Scorecard
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#cccccc';
    ctx.fillText('Scorecard:', canvas.width / 2, 200);

    // Draw scorecard in grid
    const startX = 100;
    const startY = 220;
    ctx.textAlign = 'center';
    ctx.font = '12px sans-serif';
    
    for (let i = 0; i < 18; i++) {
        const col = i % 9;
        const row = Math.floor(i / 9);
        const x = startX + col * 70;
        const y = startY + row * 60;

        ctx.fillStyle = '#444466';
        ctx.fillRect(x, y, 60, 45);
        ctx.strokeStyle = '#666688';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, 60, 45);

        ctx.fillStyle = '#aaaacc';
        ctx.fillText(`Bahn ${i + 1}`, x + 30, y + 15);

        if (holeScores[i] !== undefined) {
            const s = holeScores[i];
            if (s <= 2) ctx.fillStyle = '#44ff44';
            else if (s === 3) ctx.fillStyle = '#ffffff';
            else if (s <= 5) ctx.fillStyle = '#ffaa44';
            else ctx.fillStyle = '#ff4444';
            ctx.font = 'bold 16px sans-serif';
            ctx.fillText(s > maxStrokes ? 'X' : s.toString(), x + 30, y + 36);
            ctx.font = '12px sans-serif';
        }
    }

    // Restart
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#ffdd44';
    const blink = Math.sin(Date.now() / 500) > 0;
    if (blink) {
        ctx.fillText('Leertaste für neue Runde', canvas.width / 2, canvas.height - 40);
    }
}

function drawHoleComplete() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px sans-serif';

    if (ballInHole) {
        if (strokes === 1) {
            ctx.fillStyle = '#ffdd44';
            ctx.fillText('Hole in One! ⭐', canvas.width / 2, canvas.height / 2 - 20);
        } else if (strokes === 2) {
            ctx.fillStyle = '#44ff44';
            ctx.fillText('Eagle! 🦅', canvas.width / 2, canvas.height / 2 - 20);
        } else if (strokes === 3) {
            ctx.fillStyle = '#88ff88';
            ctx.fillText('Par!', canvas.width / 2, canvas.height / 2 - 20);
        } else {
            ctx.fillText(`Eingelocht! (${strokes} Schläge)`, canvas.width / 2, canvas.height / 2 - 20);
        }
    } else {
        ctx.fillStyle = '#ff6644';
        ctx.fillText('Nicht geschafft...', canvas.width / 2, canvas.height / 2 - 20);
    }

    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#cccccc';
    if (currentHole < 17) {
        ctx.fillText('Nächste Bahn...', canvas.width / 2, canvas.height / 2 + 20);
    } else {
        ctx.fillText('Ergebnis wird angezeigt...', canvas.width / 2, canvas.height / 2 + 20);
    }
}

function shoot() {
    if (gameState !== STATE_AIMING || aimPower <= 0) return;

    const power = aimPower * maxPower;
    ball.vx = Math.cos(aimAngle) * power;
    ball.vy = Math.sin(aimAngle) * power;
    strokes++;
    gameState = STATE_BALL_MOVING;
    aimPower = 0;
    powerDirection = 1;
}

// Improved collision: ball stays inside course boundaries
function collideBoundaries(level) {
    // Find which wall(s) the ball is in or closest to
    let insideAny = false;
    
    for (const wall of level.walls) {
        const left = wall.x + ball.radius;
        const right = wall.x + wall.w - ball.radius;
        const top = wall.y + ball.radius;
        const bottom = wall.y + wall.h - ball.radius;
        
        // Check if ball center is within this wall's playable area
        if (ball.x >= wall.x && ball.x <= wall.x + wall.w &&
            ball.y >= wall.y && ball.y <= wall.y + wall.h) {
            insideAny = true;
            
            // Bounce off left edge
            if (ball.x < left) {
                ball.x = left;
                ball.vx = Math.abs(ball.vx) * 0.75;
            }
            // Bounce off right edge
            if (ball.x > right) {
                ball.x = right;
                ball.vx = -Math.abs(ball.vx) * 0.75;
            }
            // Bounce off top edge
            if (ball.y < top) {
                ball.y = top;
                ball.vy = Math.abs(ball.vy) * 0.75;
            }
            // Bounce off bottom edge
            if (ball.y > bottom) {
                ball.y = bottom;
                ball.vy = -Math.abs(ball.vy) * 0.75;
            }
        }
    }
    
    // If ball somehow escaped all walls, push it back to nearest wall
    if (!insideAny && level.walls.length > 0) {
        let nearestWall = level.walls[0];
        let nearestDist = Infinity;
        
        for (const wall of level.walls) {
            // Find closest point on wall rectangle to ball
            const cx = Math.max(wall.x, Math.min(ball.x, wall.x + wall.w));
            const cy = Math.max(wall.y, Math.min(ball.y, wall.y + wall.h));
            const dist = Math.sqrt((ball.x - cx) ** 2 + (ball.y - cy) ** 2);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestWall = wall;
            }
        }
        
        // Push ball inside the nearest wall
        const left = nearestWall.x + ball.radius;
        const right = nearestWall.x + nearestWall.w - ball.radius;
        const top = nearestWall.y + ball.radius;
        const bottom = nearestWall.y + nearestWall.h - ball.radius;
        
        // Determine which edge is closest and reflect
        const distLeft = Math.abs(ball.x - nearestWall.x);
        const distRight = Math.abs(ball.x - (nearestWall.x + nearestWall.w));
        const distTop = Math.abs(ball.y - nearestWall.y);
        const distBottom = Math.abs(ball.y - (nearestWall.y + nearestWall.h));
        const minDist = Math.min(distLeft, distRight, distTop, distBottom);
        
        if (minDist === distLeft) {
            ball.x = left;
            ball.vx = Math.abs(ball.vx) * 0.75;
        } else if (minDist === distRight) {
            ball.x = right;
            ball.vx = -Math.abs(ball.vx) * 0.75;
        } else if (minDist === distTop) {
            ball.y = top;
            ball.vy = Math.abs(ball.vy) * 0.75;
        } else {
            ball.y = bottom;
            ball.vy = -Math.abs(ball.vy) * 0.75;
        }
    }
}

// Improved obstacle collision with proper separation
function collideObstacles(level) {
    for (const obs of level.obstacles) {
        // Find closest point on obstacle to ball center
        const closestX = Math.max(obs.x, Math.min(ball.x, obs.x + obs.w));
        const closestY = Math.max(obs.y, Math.min(ball.y, obs.y + obs.h));
        
        const dx = ball.x - closestX;
        const dy = ball.y - closestY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < ball.radius) {
            // Ball is overlapping obstacle
            if (dist === 0) {
                // Ball center is inside obstacle - push out based on minimum overlap
                const overlapLeft = ball.x - obs.x;
                const overlapRight = (obs.x + obs.w) - ball.x;
                const overlapTop = ball.y - obs.y;
                const overlapBottom = (obs.y + obs.h) - ball.y;
                const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
                
                if (minOverlap === overlapLeft) {
                    ball.x = obs.x - ball.radius;
                    ball.vx = -Math.abs(ball.vx) * 0.75;
                } else if (minOverlap === overlapRight) {
                    ball.x = obs.x + obs.w + ball.radius;
                    ball.vx = Math.abs(ball.vx) * 0.75;
                } else if (minOverlap === overlapTop) {
                    ball.y = obs.y - ball.radius;
                    ball.vy = -Math.abs(ball.vy) * 0.75;
                } else {
                    ball.y = obs.y + obs.h + ball.radius;
                    ball.vy = Math.abs(ball.vy) * 0.75;
                }
            } else {
                // Push ball out along the collision normal
                const nx = dx / dist;
                const ny = dy / dist;
                const penetration = ball.radius - dist;
                
                ball.x += nx * penetration;
                ball.y += ny * penetration;
                
                // Reflect velocity along collision normal
                const dotProduct = ball.vx * nx + ball.vy * ny;
                if (dotProduct < 0) {
                    ball.vx -= 2 * dotProduct * nx;
                    ball.vy -= 2 * dotProduct * ny;
                    // Energy loss on bounce
                    ball.vx *= 0.75;
                    ball.vy *= 0.75;
                }
            }
        }
    }
}

// Gamepad support
let gamepadButtons = {};

function pollGamepad(dt) {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (const pad of gamepads) {
        if (pad) { gp = pad; break; }
    }
    if (!gp) {
        gamepadConnected = false;
        return;
    }
    gamepadConnected = true;

    const deadzone = 0.15;

    if (gameState === STATE_AIMING) {
        // Left stick for aiming
        const lx = Math.abs(gp.axes[0]) > deadzone ? gp.axes[0] : 0;
        const ly = Math.abs(gp.axes[1]) > deadzone ? gp.axes[1] : 0;

        if (lx !== 0 || ly !== 0) {
            aimAngle = Math.atan2(ly, lx);
        }
    }

    // A button (index 0) - power / shoot
    const aPressed = gp.buttons[0] && gp.buttons[0].pressed;
    const aPrev = gamepadButtons['A'] || false;

    if (gameState === STATE_TITLE || gameState === STATE_GAME_OVER) {
        if (aPressed && !aPrev) {
            if (gameState === STATE_TITLE) {
                resetGame();
            } else {
                resetGame();
            }
        }
    }

    if (gameState === STATE_PLACING) {
        // Left stick to position ball
        const lx = Math.abs(gp.axes[0]) > deadzone ? gp.axes[0] : 0;
        if (lx !== 0) {
            ball.x += lx * 3 * dt;
            ball.x = Math.max(placeMinX, Math.min(ball.x, placeMaxX));
        }
        // A button confirms position
        if (aPressed && !aPrev) {
            gameState = STATE_AIMING;
            aimPower = 0;
            powerDirection = 1;
            keys = {};
        }
    }

    if (gameState === STATE_AIMING) {
        if (aPressed) {
            // Charging (slower pendulum)
            aimPower += powerDirection * 0.06 * dt;
            if (aimPower >= 1) { aimPower = 1; powerDirection = -1; }
            if (aimPower <= 0) { aimPower = 0; powerDirection = 1; }
        } else if (aPrev && !aPressed) {
            // Released - shoot!
            shoot();
        }
    }

    gamepadButtons['A'] = aPressed;
}

function gamepadButtonHeld(name) {
    return gamepadButtons[name] || false;
}

// Keyboard input
document.addEventListener('keydown', (e) => {
    keys[e.code] = true;

    if (e.code === 'Space') {
        e.preventDefault();
        if (gameState === STATE_TITLE) {
            resetGame();
        } else if (gameState === STATE_GAME_OVER) {
            resetGame();
        } else if (gameState === STATE_PLACING) {
            gameState = STATE_AIMING;
            aimPower = 0;
            powerDirection = 1;
            // Reset keys so aiming starts fresh
            keys = {};
        }
        // Aiming power charge is handled in update via keys['Space']
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;

    if (e.code === 'Space' && gameState === STATE_AIMING) {
        e.preventDefault();
        shoot();
    }
});

// Mouse/touch aiming
canvas.addEventListener('mousemove', (e) => {
    if (gameState === STATE_AIMING) {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        aimAngle = Math.atan2(my - ball.y, mx - ball.x);
    }
});

canvas.addEventListener('mousedown', (e) => {
    if (gameState === STATE_TITLE) {
        resetGame();
        return;
    }
    if (gameState === STATE_GAME_OVER) {
        resetGame();
        return;
    }
    if (gameState === STATE_AIMING) {
        // Start power charge
        aimPower = 0;
        powerDirection = 1;
        keys['Space'] = true;
    }
});

canvas.addEventListener('mouseup', (e) => {
    if (gameState === STATE_AIMING && keys['Space']) {
        keys['Space'] = false;
        shoot();
    }
});

// Touch support
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameState === STATE_TITLE) {
        resetGame();
        return;
    }
    if (gameState === STATE_GAME_OVER) {
        resetGame();
        return;
    }
    if (gameState === STATE_AIMING) {
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        const mx = touch.clientX - rect.left;
        const my = touch.clientY - rect.top;
        aimAngle = Math.atan2(my - ball.y, mx - ball.x);
        aimPower = 0;
        powerDirection = 1;
        keys['Space'] = true;
    }
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (gameState === STATE_AIMING) {
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        const mx = touch.clientX - rect.left;
        const my = touch.clientY - rect.top;
        aimAngle = Math.atan2(my - ball.y, mx - ball.x);
    }
});

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (gameState === STATE_AIMING && keys['Space']) {
        keys['Space'] = false;
        shoot();
    }
});

// Game loop
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
