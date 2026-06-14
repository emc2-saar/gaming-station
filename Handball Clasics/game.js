const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// === CONSTANTS ===
const TARGET_FPS = 60;
const W = canvas.width;
const H = canvas.height;

// Field dimensions
const FIELD = { x: 40, y: 40, w: W - 80, h: H - 80 };

// Goal dimensions
const GOAL_WIDTH = 10;
const GOAL_HEIGHT = 100;
const GOAL_AREA_DEPTH = 70;

// Player constants
const PLAYER_RADIUS = 14;
const PLAYER_SPEED = 4.0;
const TEAMMATE_SPEED = 2.8;
const PASS_SPEED = 7;
const SHOOT_SPEED = 10;
const BALL_FRICTION = 0.98;
const BALL_RADIUS = 6;
const SHOOT_COOLDOWN = 30;
const GAME_DURATION = 120; // 2 minutes
const SWITCH_COOLDOWN = 15;

// Colors
const COLORS = {
    field: '#2d8a4e',
    fieldLines: '#ffffff',
    teamA: '#1e90ff',
    teamB: '#ff4444',
    ball: '#ffdd00',
    ballOutline: '#cc9900',
    goalPost: '#ffffff',
    selectedA: '#00ff88',
    selectedB: '#ffaa00'
};

// === GAME STATE ===
let lastTime = 0;
let gameState = 'menu'; // menu, playing, goalScored, gameOver
let score = { left: 0, right: 0 };
let gameTime = GAME_DURATION;
let goalMessageTimer = 0;
let lastScorer = '';

// Input
let keys = {};
let gamepads = [null, null];

// Ball
let ball = { x: W / 2, y: H / 2, vx: 0, vy: 0 };
let ballFreeTimer = 0;
let lastPasserTeam = -1; // 0 = left team, 1 = right team
let lastPasserIdx = -1;

// Teams
let teamLeft = [];  // Blue, attacks right
let teamRight = []; // Red, attacks left

// Player control
let p1 = { controlled: 5, shootCooldown: 0, switchCooldown: 0 };
let p2 = { controlled: 5, shootCooldown: 0, switchCooldown: 0 };

// Formations
const FORMATION_ATTACK = [
    { x: 0.12, y: 0.5 },  // Goalkeeper
    { x: 0.5, y: 0.15 },  // Left back
    { x: 0.5, y: 0.85 },  // Right back
    { x: 0.7, y: 0.25 },  // Left wing
    { x: 0.7, y: 0.75 },  // Right wing
    { x: 0.8, y: 0.4 },   // Center
    { x: 0.85, y: 0.6 }   // Pivot
];

const FORMATION_DEFENSE = [
    { x: 0.12, y: 0.5 },  // Goalkeeper
    { x: 0.3, y: 0.2 },   // Left back
    { x: 0.3, y: 0.8 },   // Right back
    { x: 0.38, y: 0.35 }, // Left wing
    { x: 0.38, y: 0.65 }, // Right wing
    { x: 0.42, y: 0.45 }, // Center
    { x: 0.42, y: 0.55 }  // Pivot
];

// === INITIALIZATION ===
function createPlayer(x, y, team) {
    return { x, y, vx: 0, vy: 0, team, hasBall: false };
}

function initTeams() {
    teamLeft = [];
    teamRight = [];

    for (let i = 0; i < 7; i++) {
        const f = FORMATION_ATTACK[i];
        teamLeft.push(createPlayer(FIELD.x + f.x * FIELD.w, FIELD.y + f.y * FIELD.h, 'left'));
        teamRight.push(createPlayer(FIELD.x + FIELD.w - f.x * FIELD.w, FIELD.y + f.y * FIELD.h, 'right'));
    }

    p1.controlled = 5;
    p2.controlled = 5;
    teamLeft[5].hasBall = true;
    ball.x = teamLeft[5].x;
    ball.y = teamLeft[5].y;
    ball.vx = 0;
    ball.vy = 0;
    ballFreeTimer = 0;
    lastPasserTeam = -1;
    lastPasserIdx = -1;
}

function resetAfterGoal(scorer) {
    for (let i = 0; i < 7; i++) {
        const f = FORMATION_ATTACK[i];
        teamLeft[i].x = FIELD.x + f.x * FIELD.w * 0.5;
        teamLeft[i].y = FIELD.y + f.y * FIELD.h;
        teamLeft[i].vx = 0; teamLeft[i].vy = 0; teamLeft[i].hasBall = false;

        teamRight[i].x = FIELD.x + FIELD.w - f.x * FIELD.w * 0.5;
        teamRight[i].y = FIELD.y + f.y * FIELD.h;
        teamRight[i].vx = 0; teamRight[i].vy = 0; teamRight[i].hasBall = false;
    }

    p1.controlled = 5;
    p2.controlled = 5;

    // Ball to conceding team (center)
    if (scorer === 'left') {
        teamRight[5].hasBall = true;
        ball.x = teamRight[5].x;
        ball.y = teamRight[5].y;
    } else {
        teamLeft[5].hasBall = true;
        ball.x = teamLeft[5].x;
        ball.y = teamLeft[5].y;
    }
    ball.vx = 0; ball.vy = 0;
    ballFreeTimer = 0;
    lastPasserTeam = -1;
    lastPasserIdx = -1;
}

// === INPUT ===
document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') return;
    keys[e.code] = true;
    e.preventDefault();

    if (gameState === 'menu' && (e.code === 'Space' || e.code === 'Enter')) {
        startGame();
    }
    if (gameState === 'gameOver' && (e.code === 'Space' || e.code === 'Enter')) {
        startGame();
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

function getInputP1() {
    let dx = 0, dy = 0;
    if (keys['KeyA']) dx -= 1;
    if (keys['KeyD']) dx += 1;
    if (keys['KeyW']) dy -= 1;
    if (keys['KeyS']) dy += 1;

    // Gamepad 0
    const gp = getGamepad(0);
    if (gp) {
        dx += gp.axes[0];
        dy += gp.axes[1];
    }

    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 1) { dx /= len; dy /= len; }
    return { dx, dy };
}

function getInputP2() {
    let dx = 0, dy = 0;
    if (keys['ArrowLeft']) dx -= 1;
    if (keys['ArrowRight']) dx += 1;
    if (keys['ArrowUp']) dy -= 1;
    if (keys['ArrowDown']) dy += 1;

    // Gamepad 1
    const gp = getGamepad(1);
    if (gp) {
        dx += gp.axes[0];
        dy += gp.axes[1];
    }

    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 1) { dx /= len; dy /= len; }
    return { dx, dy };
}

function getGamepad(index) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads[index];
    if (!gp) return null;
    const deadzone = 0.15;
    return {
        axes: gp.axes.map(a => Math.abs(a) < deadzone ? 0 : a),
        buttons: gp.buttons.map(b => b.pressed)
    };
}

// === ACTIONS ===
function shootForTeam(team, playerState, direction) {
    if (playerState.shootCooldown > 0) return;
    const p = team[playerState.controlled];
    if (!p.hasBall) return;

    // If controlling goalkeeper, "shoot" becomes a long pass forward
    if (playerState.controlled === 0) {
        passForTeam(team, playerState, { dx: direction === 'right' ? 1 : -1, dy: 0 });
        return;
    }

    const goalX = direction === 'right' ? FIELD.x + FIELD.w : FIELD.x;
    const goalY = FIELD.y + FIELD.h / 2 + (Math.random() - 0.5) * GOAL_HEIGHT * 0.6;
    const dx = goalX - p.x;
    const dy = goalY - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    ball.vx = (dx / dist) * SHOOT_SPEED;
    ball.vy = (dy / dist) * SHOOT_SPEED;
    p.hasBall = false;
    playerState.shootCooldown = SHOOT_COOLDOWN;
    ballFreeTimer = 15;
    lastPasserTeam = direction === 'right' ? 0 : 1;
    lastPasserIdx = playerState.controlled;
}

function passForTeam(team, playerState, input) {
    let passerIdx = -1;
    if (team[playerState.controlled].hasBall) {
        passerIdx = playerState.controlled;
    } else {
        for (let i = 0; i < team.length; i++) {
            if (team[i].hasBall) { passerIdx = i; break; }
        }
    }
    if (passerIdx < 0) return;
    const p = team[passerIdx];

    let bestIdx = -1;
    let bestScore = -Infinity;

    for (let i = 0; i < team.length; i++) {
        if (i === passerIdx || i === 0) continue;
        const t = team[i];
        const dx = t.x - p.x;
        const dy = t.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 30 || dist > 400) continue;

        let score = 0;
        if (Math.abs(input.dx) > 0.1 || Math.abs(input.dy) > 0.1) {
            const dirLen = Math.sqrt(input.dx * input.dx + input.dy * input.dy);
            const dot = (dx / dist) * (input.dx / dirLen) + (dy / dist) * (input.dy / dirLen);
            score += dot * 100;
        } else {
            // Forward preference depends on team side
            const forward = team === teamLeft ? dx : -dx;
            score += (forward / dist) * 50;
        }
        score -= dist * 0.1;

        if (score > bestScore) { bestScore = score; bestIdx = i; }
    }

    if (bestIdx >= 0) {
        const t = team[bestIdx];
        const ldx = t.x - p.x;
        const ldy = t.y - p.y;
        const ldist = Math.sqrt(ldx * ldx + ldy * ldy);

        ball.vx = (ldx / ldist) * PASS_SPEED;
        ball.vy = (ldy / ldist) * PASS_SPEED;
        ball.x = p.x + (ldx / ldist) * (PLAYER_RADIUS + BALL_RADIUS + 2);
        ball.y = p.y + (ldy / ldist) * (PLAYER_RADIUS + BALL_RADIUS + 2);
        p.hasBall = false;
        playerState.shootCooldown = 10;
        lastPasserTeam = team === teamLeft ? 0 : 1;
        lastPasserIdx = passerIdx;
        ballFreeTimer = 20;
        playerState.controlled = bestIdx;
    }
}

function switchForTeam(team, playerState) {
    if (playerState.switchCooldown > 0) return;
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < team.length; i++) {
        if (i === playerState.controlled) continue;
        const p = team[i];
        const dx = p.x - ball.x;
        const dy = p.y - ball.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < bestDist) { bestDist = dist; bestIdx = i; }
    }
    if (bestIdx >= 0) {
        playerState.controlled = bestIdx;
        playerState.switchCooldown = SWITCH_COOLDOWN;
    }
}

// Auto-switch to goalkeeper when opponent attacks is DISABLED
// Players must manually switch to goalkeeper with Q or /
function checkGoalkeeperSwitch() {
    // No automatic switching - players handle it themselves
}

// === GAME LOGIC ===
function startGame() {
    score = { left: 0, right: 0 };
    gameTime = GAME_DURATION;
    gameState = 'playing';
    p1.shootCooldown = 0; p1.switchCooldown = 0;
    p2.shootCooldown = 0; p2.switchCooldown = 0;
    lastTime = 0;
    initTeams();
}

function update(dt) {
    if (gameState !== 'playing' && gameState !== 'goalScored') return;

    if (gameState === 'goalScored') {
        goalMessageTimer -= dt;
        if (goalMessageTimer <= 0) {
            gameState = 'playing';
            resetAfterGoal(lastScorer);
        }
        return;
    }

    // Timer
    gameTime -= dt / TARGET_FPS;
    if (gameTime <= 0) { gameTime = 0; gameState = 'gameOver'; return; }

    // Cooldowns
    if (p1.shootCooldown > 0) p1.shootCooldown -= dt;
    if (p1.switchCooldown > 0) p1.switchCooldown -= dt;
    if (p2.shootCooldown > 0) p2.shootCooldown -= dt;
    if (p2.switchCooldown > 0) p2.switchCooldown -= dt;
    if (ballFreeTimer > 0) ballFreeTimer -= dt;

    // Auto-switch to goalkeeper when opponent attacks
    checkGoalkeeperSwitch();

    // === Player 1 Input (WASD, Space/E/Q, Gamepad 0) ===
    const input1 = getInputP1();
    const gp1 = getGamepad(0);

    // P1 actions
    if (keys['Space'] || (gp1 && gp1.buttons[0])) shootForTeam(teamLeft, p1, 'right');
    if (keys['KeyE'] || (gp1 && gp1.buttons[1])) passForTeam(teamLeft, p1, input1);
    if (keys['KeyQ'] || (gp1 && gp1.buttons[2])) switchForTeam(teamLeft, p1);

    // P1 movement
    const cp1 = teamLeft[p1.controlled];
    cp1.vx = input1.dx * PLAYER_SPEED;
    cp1.vy = input1.dy * PLAYER_SPEED;
    cp1.x += cp1.vx * dt;
    cp1.y += cp1.vy * dt;
    cp1.x = Math.max(FIELD.x + PLAYER_RADIUS, Math.min(FIELD.x + FIELD.w - PLAYER_RADIUS, cp1.x));
    cp1.y = Math.max(FIELD.y + PLAYER_RADIUS, Math.min(FIELD.y + FIELD.h - PLAYER_RADIUS, cp1.y));

    if (cp1.hasBall) {
        ball.x = cp1.x + Math.sign(cp1.vx || 0.1) * (PLAYER_RADIUS + BALL_RADIUS);
        ball.y = cp1.y;
    }

    // === Player 2 Input (Arrows, Numpad/Period/Comma, Gamepad 1) ===
    const input2 = getInputP2();
    const gp2 = getGamepad(1);

    // P2 actions
    if (keys['Numpad0'] || keys['Period'] || (gp2 && gp2.buttons[0])) shootForTeam(teamRight, p2, 'left');
    if (keys['Numpad1'] || keys['Comma'] || (gp2 && gp2.buttons[1])) passForTeam(teamRight, p2, input2);
    if (keys['Numpad2'] || keys['Slash'] || (gp2 && gp2.buttons[2])) switchForTeam(teamRight, p2);

    // P2 movement
    const cp2 = teamRight[p2.controlled];
    cp2.vx = input2.dx * PLAYER_SPEED;
    cp2.vy = input2.dy * PLAYER_SPEED;
    cp2.x += cp2.vx * dt;
    cp2.y += cp2.vy * dt;
    cp2.x = Math.max(FIELD.x + PLAYER_RADIUS, Math.min(FIELD.x + FIELD.w - PLAYER_RADIUS, cp2.x));
    cp2.y = Math.max(FIELD.y + PLAYER_RADIUS, Math.min(FIELD.y + FIELD.h - PLAYER_RADIUS, cp2.y));

    if (cp2.hasBall) {
        ball.x = cp2.x + Math.sign(cp2.vx || -0.1) * (PLAYER_RADIUS + BALL_RADIUS);
        ball.y = cp2.y;
    }

    // Update non-controlled teammates for both teams
    updateTeammates(teamLeft, p1, 'right');
    updateTeammates(teamRight, p2, 'left');

    // Ball physics
    updateBall(dt);

    // Circle rule
    enforceCircleRule();

    // Pickup
    checkBallPickup();

    // Tackles
    checkTackle();

    // Goals
    checkGoals();
}

function updateTeammates(team, playerState, attackDir) {
    const teamHasBall = team.some(p => p.hasBall);
    const attacking = teamHasBall || (attackDir === 'right' ? ball.x > W * 0.4 : ball.x < W * 0.6);

    for (let i = 0; i < team.length; i++) {
        if (i === playerState.controlled) continue;
        const p = team[i];

        // Goalkeeper
        if (i === 0) {
            // If goalkeeper is controlled by player, skip auto-movement
            if (i === playerState.controlled) continue;
            
            // Uncontrolled goalkeeper: barely moves - player MUST switch to control
            const goalX = attackDir === 'right' ? FIELD.x + GOAL_AREA_DEPTH * 0.4 : FIELD.x + FIELD.w - GOAL_AREA_DEPTH * 0.4;
            const goalCenterY = FIELD.y + FIELD.h / 2;
            const dx = goalX - p.x;
            const dy = goalCenterY - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 3) {
                p.x += (dx / dist) * TEAMMATE_SPEED * 0.2;
                p.y += (dy / dist) * TEAMMATE_SPEED * 0.15;
            }
            // If GK has ball and is NOT controlled, hold it (player must switch to GK to pass)
            if (p.hasBall) {
                ball.x = p.x; ball.y = p.y;
                ball.vx = 0; ball.vy = 0;
            }
            continue;
        }

        // Formation position
        const formation = attacking ? FORMATION_ATTACK : FORMATION_DEFENSE;
        let baseX, baseY;
        if (attackDir === 'right') {
            baseX = FIELD.x + formation[i].x * FIELD.w;
            baseY = FIELD.y + formation[i].y * FIELD.h;
        } else {
            baseX = FIELD.x + FIELD.w - formation[i].x * FIELD.w;
            baseY = FIELD.y + formation[i].y * FIELD.h;
        }

        // Offset toward ball
        const offsetScale = attacking ? 0.3 : 0.2;
        let targetX = baseX + (ball.x - baseX) * offsetScale;
        let targetY = baseY + (ball.y - baseY) * 0.15;

        // When attacking push forward with controlled player
        if (attacking) {
            const cp = team[playerState.controlled];
            const forwardX = attackDir === 'right' ? cp.x - 60 : cp.x + 60;
            if (attackDir === 'right' && cp.x > W * 0.5) {
                targetX = Math.max(targetX, forwardX + (i % 2 === 0 ? -25 : 25));
            } else if (attackDir === 'left' && cp.x < W * 0.5) {
                targetX = Math.min(targetX, forwardX + (i % 2 === 0 ? -25 : 25));
            }
        }

        const dx = targetX - p.x;
        const dy = targetY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 5) {
            const speed = attacking ? TEAMMATE_SPEED * 1.1 : TEAMMATE_SPEED * 0.8;
            p.vx = (dx / dist) * speed;
            p.vy = (dy / dist) * speed;
            p.x += p.vx;
            p.y += p.vy;
        } else {
            p.vx = 0; p.vy = 0;
        }

        p.x = Math.max(FIELD.x + PLAYER_RADIUS, Math.min(FIELD.x + FIELD.w - PLAYER_RADIUS, p.x));
        p.y = Math.max(FIELD.y + PLAYER_RADIUS, Math.min(FIELD.y + FIELD.h - PLAYER_RADIUS, p.y));

        // Hold ball if has it
        if (p.hasBall) {
            ball.x = p.x; ball.y = p.y;
            ball.vx = 0; ball.vy = 0;
        }
    }
}

// === BALL ===
function updateBall(dt) {
    let held = false;
    for (const p of teamLeft) if (p.hasBall) held = true;
    for (const p of teamRight) if (p.hasBall) held = true;
    if (held) return;

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.vx *= Math.pow(BALL_FRICTION, dt);
    ball.vy *= Math.pow(BALL_FRICTION, dt);

    // Bounce top/bottom
    if (ball.y < FIELD.y + BALL_RADIUS) { ball.y = FIELD.y + BALL_RADIUS; ball.vy *= -0.7; }
    if (ball.y > FIELD.y + FIELD.h - BALL_RADIUS) { ball.y = FIELD.y + FIELD.h - BALL_RADIUS; ball.vy *= -0.7; }

    // Bounce left/right except goals
    const goalTop = FIELD.y + FIELD.h / 2 - GOAL_HEIGHT / 2;
    const goalBot = FIELD.y + FIELD.h / 2 + GOAL_HEIGHT / 2;
    if (ball.x < FIELD.x + BALL_RADIUS && (ball.y < goalTop || ball.y > goalBot)) {
        ball.x = FIELD.x + BALL_RADIUS; ball.vx *= -0.7;
    }
    if (ball.x > FIELD.x + FIELD.w - BALL_RADIUS && (ball.y < goalTop || ball.y > goalBot)) {
        ball.x = FIELD.x + FIELD.w - BALL_RADIUS; ball.vx *= -0.7;
    }

    if (Math.abs(ball.vx) < 0.05 && Math.abs(ball.vy) < 0.05) { ball.vx = 0; ball.vy = 0; }
}

// === PICKUP ===
function checkBallPickup() {
    let held = false;
    for (const p of teamLeft) if (p.hasBall) held = true;
    for (const p of teamRight) if (p.hasBall) held = true;
    if (held) return;

    const pickupDist = PLAYER_RADIUS + BALL_RADIUS + 5;
    const gkPickupDist = BALL_RADIUS + 3; // Uncontrolled GK barely catches anything

    for (let i = 0; i < teamLeft.length; i++) {
        if (ballFreeTimer > 0 && lastPasserTeam === 0 && i === lastPasserIdx) continue;
        const p = teamLeft[i];
        const dist = Math.sqrt((p.x - ball.x) ** 2 + (p.y - ball.y) ** 2);
        const threshold = (i === 0 && p1.controlled !== 0) ? gkPickupDist : pickupDist;
        if (dist < threshold) {
            p.hasBall = true; ball.vx = 0; ball.vy = 0;
            if (i !== 0) p1.controlled = i;
            ballFreeTimer = 0; lastPasserTeam = -1; return;
        }
    }
    for (let i = 0; i < teamRight.length; i++) {
        if (ballFreeTimer > 0 && lastPasserTeam === 1 && i === lastPasserIdx) continue;
        const p = teamRight[i];
        const dist = Math.sqrt((p.x - ball.x) ** 2 + (p.y - ball.y) ** 2);
        const threshold = (i === 0 && p2.controlled !== 0) ? gkPickupDist : pickupDist;
        if (dist < threshold) {
            p.hasBall = true; ball.vx = 0; ball.vy = 0;
            if (i !== 0) p2.controlled = i;
            ballFreeTimer = 0; lastPasserTeam = -1; return;
        }
    }
}

// === GOALS ===
function checkGoals() {
    const goalTop = FIELD.y + FIELD.h / 2 - GOAL_HEIGHT / 2;
    const goalBot = FIELD.y + FIELD.h / 2 + GOAL_HEIGHT / 2;

    if (ball.x < FIELD.x - BALL_RADIUS && ball.y > goalTop && ball.y < goalBot) {
        score.right++;
        lastScorer = 'right';
        gameState = 'goalScored';
        goalMessageTimer = 90;
        ball.vx = 0; ball.vy = 0;
    }
    if (ball.x > FIELD.x + FIELD.w + BALL_RADIUS && ball.y > goalTop && ball.y < goalBot) {
        score.left++;
        lastScorer = 'left';
        gameState = 'goalScored';
        goalMessageTimer = 90;
        ball.vx = 0; ball.vy = 0;
    }
}

// === TACKLE ===
function checkTackle() {
    // Left tackles Right
    for (const p of teamLeft) {
        for (const a of teamRight) {
            if (!a.hasBall) continue;
            const dist = Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2);
            if (dist < PLAYER_RADIUS * 2.2 && Math.random() < 0.25) {
                a.hasBall = false;
                ball.vx = (p.x - a.x) / dist * 3;
                ball.vy = (p.y - a.y) / dist * 3;
            }
        }
    }
    // Right tackles Left
    for (const p of teamRight) {
        for (const a of teamLeft) {
            if (!a.hasBall) continue;
            const dist = Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2);
            if (dist < PLAYER_RADIUS * 2.2 && Math.random() < 0.25) {
                a.hasBall = false;
                ball.vx = (p.x - a.x) / dist * 3;
                ball.vy = (p.y - a.y) / dist * 3;
            }
        }
    }
}

// === CIRCLE RULE ===
function enforceCircleRule() {
    const leftGoalX = FIELD.x;
    const rightGoalX = FIELD.x + FIELD.w;
    const goalCenterY = FIELD.y + FIELD.h / 2;
    const radius = GOAL_AREA_DEPTH;

    // Left team: field players can't enter either circle. GK (index 0) can enter own (left) circle.
    for (let i = 1; i < teamLeft.length; i++) {
        pushOutOfCircle(teamLeft[i], rightGoalX, goalCenterY, radius);
        pushOutOfCircle(teamLeft[i], leftGoalX, goalCenterY, radius);
    }
    // Left GK can't enter opponent's circle
    pushOutOfCircle(teamLeft[0], rightGoalX, goalCenterY, radius);

    // Right team: same logic mirrored
    for (let i = 1; i < teamRight.length; i++) {
        pushOutOfCircle(teamRight[i], leftGoalX, goalCenterY, radius);
        pushOutOfCircle(teamRight[i], rightGoalX, goalCenterY, radius);
    }
    // Right GK can't enter opponent's circle
    pushOutOfCircle(teamRight[0], leftGoalX, goalCenterY, radius);
}

function pushOutOfCircle(p, cx, cy, radius) {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < radius + PLAYER_RADIUS) {
        const push = radius + PLAYER_RADIUS;
        p.x = cx + (dx / dist) * push;
        p.y = cy + (dy / dist) * push;
    }
}

// === DRAWING ===
function draw() {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, W, H);

    if (gameState === 'menu') { drawMenu(); return; }
    if (gameState === 'gameOver') { drawField(); drawGameOver(); return; }

    drawField();
    drawPlayers();
    drawBall();
    drawHUD();
    if (gameState === 'goalScored') drawGoalMessage();
}

function drawMenu() {
    drawField();
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText('🤾 Handball 2P', W / 2, H / 2 - 100);

    ctx.font = '16px sans-serif';
    ctx.fillStyle = COLORS.teamA;
    ctx.fillText('── Spieler 1 (Blau) ──', W / 2 - 180, H / 2 - 55);
    ctx.fillStyle = '#fff';
    ctx.font = '15px sans-serif';
    ctx.fillText('WASD = Bewegen', W / 2 - 180, H / 2 - 30);
    ctx.fillText('Leertaste = Schuss', W / 2 - 180, H / 2 - 10);
    ctx.fillText('E = Passen', W / 2 - 180, H / 2 + 10);
    ctx.fillText('Q = Spieler wechseln', W / 2 - 180, H / 2 + 30);

    ctx.fillStyle = COLORS.teamB;
    ctx.font = '16px sans-serif';
    ctx.fillText('── Spieler 2 (Rot) ──', W / 2 + 180, H / 2 - 55);
    ctx.fillStyle = '#fff';
    ctx.font = '15px sans-serif';
    ctx.fillText('Pfeiltasten = Bewegen', W / 2 + 180, H / 2 - 30);
    ctx.fillText('. (Punkt) = Schuss', W / 2 + 180, H / 2 - 10);
    ctx.fillText(', (Komma) = Passen', W / 2 + 180, H / 2 + 10);
    ctx.fillText('/ = Spieler wechseln', W / 2 + 180, H / 2 + 30);

    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#888';
    ctx.fillText('Oder: jeweils ein Gamepad (A=Schuss, B=Pass, X=Wechsel)', W / 2, H / 2 + 70);

    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = COLORS.selectedA;
    ctx.fillText('Leertaste / Enter / 🅰 zum Starten', W / 2, H / 2 + 120);
}

function drawField() {
    ctx.fillStyle = COLORS.field;
    ctx.fillRect(FIELD.x, FIELD.y, FIELD.w, FIELD.h);

    ctx.strokeStyle = COLORS.fieldLines;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6;
    ctx.strokeRect(FIELD.x, FIELD.y, FIELD.w, FIELD.h);

    // Center
    ctx.beginPath();
    ctx.moveTo(W / 2, FIELD.y);
    ctx.lineTo(W / 2, FIELD.y + FIELD.h);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(W / 2, FIELD.y + FIELD.h / 2, 50, 0, Math.PI * 2);
    ctx.stroke();

    // Goal areas
    const gcy = FIELD.y + FIELD.h / 2;
    ctx.beginPath(); ctx.arc(FIELD.x, gcy, GOAL_AREA_DEPTH, -Math.PI / 3, Math.PI / 3); ctx.stroke();
    ctx.beginPath(); ctx.arc(FIELD.x + FIELD.w, gcy, GOAL_AREA_DEPTH, Math.PI * 2 / 3, Math.PI * 4 / 3); ctx.stroke();

    // 9m dashed
    ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.arc(FIELD.x, gcy, GOAL_AREA_DEPTH + 30, -Math.PI / 3, Math.PI / 3); ctx.stroke();
    ctx.beginPath(); ctx.arc(FIELD.x + FIELD.w, gcy, GOAL_AREA_DEPTH + 30, Math.PI * 2 / 3, Math.PI * 4 / 3); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // Goals
    const goalTop = gcy - GOAL_HEIGHT / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.strokeStyle = COLORS.goalPost; ctx.lineWidth = 4;
    ctx.fillRect(FIELD.x - GOAL_WIDTH - 5, goalTop, GOAL_WIDTH + 5, GOAL_HEIGHT);
    ctx.strokeRect(FIELD.x - GOAL_WIDTH - 5, goalTop, GOAL_WIDTH + 5, GOAL_HEIGHT);
    ctx.fillRect(FIELD.x + FIELD.w, goalTop, GOAL_WIDTH + 5, GOAL_HEIGHT);
    ctx.strokeRect(FIELD.x + FIELD.w, goalTop, GOAL_WIDTH + 5, GOAL_HEIGHT);
    ctx.lineWidth = 2;
}

function drawPlayers() {
    // Team Left (Blue)
    for (let i = 0; i < teamLeft.length; i++) {
        const p = teamLeft[i];
        if (i === p1.controlled) {
            ctx.beginPath(); ctx.arc(p.x, p.y, PLAYER_RADIUS + 6, 0, Math.PI * 2);
            ctx.strokeStyle = COLORS.selectedA; ctx.lineWidth = 2; ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(p.x, p.y, PLAYER_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = i === 0 ? '#4488cc' : COLORS.teamA; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(i + 1, p.x, p.y);
    }
    // Team Right (Red)
    for (let i = 0; i < teamRight.length; i++) {
        const p = teamRight[i];
        if (i === p2.controlled) {
            ctx.beginPath(); ctx.arc(p.x, p.y, PLAYER_RADIUS + 6, 0, Math.PI * 2);
            ctx.strokeStyle = COLORS.selectedB; ctx.lineWidth = 2; ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(p.x, p.y, PLAYER_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = i === 0 ? '#cc4444' : COLORS.teamB; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(i + 1, p.x, p.y);
    }
}

function drawBall() {
    ctx.beginPath(); ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.ball; ctx.fill();
    ctx.strokeStyle = COLORS.ballOutline; ctx.lineWidth = 2; ctx.stroke();
}

function drawHUD() {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(W / 2 - 150, 5, 300, 30);

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = COLORS.teamA;
    ctx.fillText('Blau', W / 2 - 100, 20);
    ctx.fillStyle = '#fff';
    ctx.fillText(score.left + ' : ' + score.right, W / 2, 20);
    ctx.fillStyle = COLORS.teamB;
    ctx.fillText('Rot', W / 2 + 100, 20);

    const min = Math.floor(gameTime / 60);
    const sec = Math.floor(gameTime % 60);
    ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif';
    ctx.fillText(min + ':' + (sec < 10 ? '0' : '') + sec, W / 2, 48);

    // Controls reminder
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('P1: WASD + Leertaste/E/Q', FIELD.x, H - 8);
    ctx.textAlign = 'right';
    ctx.fillText('P2: Pfeile + ./,/ /', FIELD.x + FIELD.w, H - 8);
}

function drawGoalMessage() {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(W / 2 - 120, H / 2 - 40, 240, 80);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillStyle = lastScorer === 'left' ? COLORS.teamA : COLORS.teamB;
    ctx.fillText('⚽ TOR!', W / 2, H / 2);
}

function drawGameOver() {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.font = 'bold 42px sans-serif'; ctx.fillStyle = '#fff';
    ctx.fillText('Spielende!', W / 2, H / 2 - 80);

    ctx.font = 'bold 32px sans-serif';
    ctx.fillStyle = score.left > score.right ? COLORS.teamA : score.right > score.left ? COLORS.teamB : '#fff';
    ctx.fillText(score.left + ' : ' + score.right, W / 2, H / 2 - 30);

    let result = 'Unentschieden!';
    if (score.left > score.right) result = 'Blau gewinnt! 🎉';
    if (score.right > score.left) result = 'Rot gewinnt! 🎉';
    ctx.font = '24px sans-serif'; ctx.fillStyle = '#fff';
    ctx.fillText(result, W / 2, H / 2 + 20);

    ctx.font = '18px sans-serif'; ctx.fillStyle = COLORS.selectedA;
    ctx.fillText('Leertaste / Enter für Neustart', W / 2, H / 2 + 80);
}

// === GAME LOOP ===
function pollGamepadMenu() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
        if (gp && gp.connected && gp.buttons[0] && gp.buttons[0].pressed) {
            if (gameState === 'menu' || gameState === 'gameOver') {
                startGame();
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

    // Gamepad-Check auch im Menü/GameOver
    if (gameState === 'menu' || gameState === 'gameOver') {
        pollGamepadMenu();
    }

    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
