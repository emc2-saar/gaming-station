const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const TARGET_FPS = 60;
const W = canvas.width;
const H = canvas.height;

// Game states
const STATE_MENU = 0;
const STATE_PLAYING = 1;
const STATE_GOAL = 2;
const STATE_GAMEOVER = 3;

let gameState = STATE_MENU;
let lastTime = 0;
let score1 = 0;
let score2 = 0;
let goalTimer = 0;
let lastScorer = 0;
const WIN_SCORE = 5;

// Field dimensions
const FIELD_X = 40;
const FIELD_Y = 40;
const FIELD_W = W - 80;
const FIELD_H = H - 80;
const GOAL_WIDTH = 20;
const GOAL_HEIGHT = 100;
const GOAL_Y = FIELD_Y + (FIELD_H - GOAL_HEIGHT) / 2;

// Player settings
const PLAYER_SIZE = 24;
const PLAYER_SPEED = 3.5;
const KICK_POWER = 7;
const KICK_RANGE = 30;

// Ball settings
const BALL_SIZE = 12;
const BALL_FRICTION = 0.97;

// Players
let player1, player2, ball;

// Input
const keys = {};
const DEADZONE = 0.15;
let gamepadKickPressed1 = false;
let gamepadKickPressed2 = false;

// Minecraft-style colors
const COLORS = {
    grass1: '#4a8c2a',
    grass2: '#3d7a22',
    fieldLine: '#ffffff',
    player1Skin: '#c69c6d',
    player1Shirt: '#3333ff',
    player1Pants: '#1a1a8c',
    player2Skin: '#c69c6d',
    player2Shirt: '#ff3333',
    player2Pants: '#8c1a1a',
    ball: '#ffffff',
    ballPattern: '#333333',
    goalPost: '#dddd44',
    goalNet: '#aaaaaa',
    dirt: '#8b6914',
    wood: '#6b4c1e'
};

function resetPositions() {
    player1 = {
        x: FIELD_X + FIELD_W * 0.25,
        y: FIELD_Y + FIELD_H / 2,
        vx: 0, vy: 0,
        kicking: false,
        kickCooldown: 0
    };
    player2 = {
        x: FIELD_X + FIELD_W * 0.75,
        y: FIELD_Y + FIELD_H / 2,
        vx: 0, vy: 0,
        kicking: false,
        kickCooldown: 0
    };
    ball = {
        x: FIELD_X + FIELD_W / 2,
        y: FIELD_Y + FIELD_H / 2,
        vx: 0, vy: 0
    };
}

function startGame() {
    score1 = 0;
    score2 = 0;
    resetPositions();
    gameState = STATE_PLAYING;
    lastTime = 0;
}

function drawPixelRect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(x), Math.floor(y), w, h);
}

function drawField() {
    // Grass background with checkerboard pattern (Minecraft-style)
    const blockSize = 16;
    for (let bx = 0; bx < W; bx += blockSize) {
        for (let by = 0; by < H; by += blockSize) {
            const isLight = ((bx / blockSize) + (by / blockSize)) % 2 === 0;
            ctx.fillStyle = isLight ? COLORS.grass1 : COLORS.grass2;
            ctx.fillRect(bx, by, blockSize, blockSize);
        }
    }

    // Field border (dirt path)
    ctx.strokeStyle = COLORS.dirt;
    ctx.lineWidth = 6;
    ctx.strokeRect(FIELD_X, FIELD_Y, FIELD_W, FIELD_H);

    // Field lines
    ctx.strokeStyle = COLORS.fieldLine;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.7;
    ctx.strokeRect(FIELD_X + 4, FIELD_Y + 4, FIELD_W - 8, FIELD_H - 8);

    // Center line
    ctx.beginPath();
    ctx.moveTo(W / 2, FIELD_Y + 4);
    ctx.lineTo(W / 2, FIELD_Y + FIELD_H - 4);
    ctx.stroke();

    // Center circle
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 40, 0, Math.PI * 2);
    ctx.stroke();

    // Center dot
    ctx.fillStyle = COLORS.fieldLine;
    ctx.fillRect(W / 2 - 3, H / 2 - 3, 6, 6);

    ctx.globalAlpha = 1.0;

    // Goals
    // Left goal
    drawPixelRect(FIELD_X - GOAL_WIDTH, GOAL_Y, GOAL_WIDTH, 4, COLORS.goalPost);
    drawPixelRect(FIELD_X - GOAL_WIDTH, GOAL_Y + GOAL_HEIGHT - 4, GOAL_WIDTH, 4, COLORS.goalPost);
    drawPixelRect(FIELD_X - GOAL_WIDTH, GOAL_Y, 4, GOAL_HEIGHT, COLORS.goalPost);
    // Net
    ctx.fillStyle = COLORS.goalNet;
    ctx.globalAlpha = 0.3;
    ctx.fillRect(FIELD_X - GOAL_WIDTH + 4, GOAL_Y + 4, GOAL_WIDTH - 4, GOAL_HEIGHT - 8);
    ctx.globalAlpha = 1.0;

    // Right goal
    drawPixelRect(FIELD_X + FIELD_W, GOAL_Y, GOAL_WIDTH, 4, COLORS.goalPost);
    drawPixelRect(FIELD_X + FIELD_W, GOAL_Y + GOAL_HEIGHT - 4, GOAL_WIDTH, 4, COLORS.goalPost);
    drawPixelRect(FIELD_X + FIELD_W + GOAL_WIDTH - 4, GOAL_Y, 4, GOAL_HEIGHT, COLORS.goalPost);
    // Net
    ctx.fillStyle = COLORS.goalNet;
    ctx.globalAlpha = 0.3;
    ctx.fillRect(FIELD_X + FIELD_W, GOAL_Y + 4, GOAL_WIDTH - 4, GOAL_HEIGHT - 8);
    ctx.globalAlpha = 1.0;
}

function drawPlayer(p, isPlayer1) {
    const x = Math.floor(p.x - PLAYER_SIZE / 2);
    const y = Math.floor(p.y - PLAYER_SIZE / 2);
    const colors = isPlayer1 ? 
        { skin: COLORS.player1Skin, shirt: COLORS.player1Shirt, pants: COLORS.player1Pants } :
        { skin: COLORS.player2Skin, shirt: COLORS.player2Shirt, pants: COLORS.player2Pants };

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x + 2, y + PLAYER_SIZE - 2, PLAYER_SIZE - 2, 4);

    // Pants (legs)
    drawPixelRect(x + 4, y + 16, 6, 8, colors.pants);
    drawPixelRect(x + 14, y + 16, 6, 8, colors.pants);

    // Shirt (body)
    drawPixelRect(x + 2, y + 8, 20, 10, colors.shirt);

    // Arms
    drawPixelRect(x, y + 8, 4, 8, colors.shirt);
    drawPixelRect(x + 20, y + 8, 4, 8, colors.shirt);

    // Head (Minecraft square head!)
    drawPixelRect(x + 4, y, 16, 10, colors.skin);

    // Eyes (pixel style)
    drawPixelRect(x + 7, y + 3, 3, 3, '#fff');
    drawPixelRect(x + 14, y + 3, 3, 3, '#fff');
    drawPixelRect(x + 8, y + 4, 2, 2, '#222');
    drawPixelRect(x + 15, y + 4, 2, 2, '#222');

    // Hair (blocky)
    drawPixelRect(x + 4, y - 2, 16, 4, isPlayer1 ? '#4a3000' : '#1a1a1a');

    // Kick indicator
    if (p.kicking) {
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 2, y - 2, PLAYER_SIZE + 4, PLAYER_SIZE + 8);
    }
}

function drawBall() {
    const x = Math.floor(ball.x - BALL_SIZE / 2);
    const y = Math.floor(ball.y - BALL_SIZE / 2);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x + 2, y + BALL_SIZE, BALL_SIZE - 2, 3);

    // Ball body (white with black pattern - pixel style)
    drawPixelRect(x, y, BALL_SIZE, BALL_SIZE, COLORS.ball);

    // Pattern (pentagon-like blocks)
    drawPixelRect(x + 2, y + 2, 4, 4, COLORS.ballPattern);
    drawPixelRect(x + 7, y + 7, 4, 4, COLORS.ballPattern);
    drawPixelRect(x + 1, y + 8, 3, 3, COLORS.ballPattern);
    drawPixelRect(x + 8, y + 1, 3, 3, COLORS.ballPattern);

    // Border
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, BALL_SIZE, BALL_SIZE);
}

function drawScore() {
    // Scoreboard background
    drawPixelRect(W / 2 - 80, 5, 160, 30, 'rgba(0,0,0,0.7)');

    ctx.fillStyle = COLORS.player1Shirt;
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(score1.toString(), W / 2 - 30, 27);

    ctx.fillStyle = '#fff';
    ctx.fillText('-', W / 2, 27);

    ctx.fillStyle = COLORS.player2Shirt;
    ctx.fillText(score2.toString(), W / 2 + 30, 27);
}

function drawControls() {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(W / 2 - 200, H - 25, 400, 22);
    ctx.fillStyle = '#aaa';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('P1: WASD+Leertaste | P2: Pfeile+Enter | 🎮 Stick+A', W / 2, H - 10);
}

function movePlayer(p, dx, dy, dt) {
    p.x += dx * PLAYER_SPEED * dt;
    p.y += dy * PLAYER_SPEED * dt;

    // Keep in field bounds
    const half = PLAYER_SIZE / 2;
    p.x = Math.max(FIELD_X + half, Math.min(FIELD_X + FIELD_W - half, p.x));
    p.y = Math.max(FIELD_Y + half, Math.min(FIELD_Y + FIELD_H - half, p.y));
}

function tryKick(p) {
    if (p.kickCooldown > 0) return;

    const dx = ball.x - p.x;
    const dy = ball.y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < KICK_RANGE) {
        const angle = Math.atan2(dy, dx);
        ball.vx = Math.cos(angle) * KICK_POWER;
        ball.vy = Math.sin(angle) * KICK_POWER;
        p.kicking = true;
        p.kickCooldown = 15;
        setTimeout(() => { p.kicking = false; }, 150);
    }
}

function updateBall(dt) {
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Friction
    ball.vx *= Math.pow(BALL_FRICTION, dt);
    ball.vy *= Math.pow(BALL_FRICTION, dt);

    // Stop very slow ball
    if (Math.abs(ball.vx) < 0.01) ball.vx = 0;
    if (Math.abs(ball.vy) < 0.01) ball.vy = 0;

    // Bounce off top/bottom
    const halfBall = BALL_SIZE / 2;
    if (ball.y - halfBall < FIELD_Y) {
        ball.y = FIELD_Y + halfBall;
        ball.vy = Math.abs(ball.vy) * 0.8;
    }
    if (ball.y + halfBall > FIELD_Y + FIELD_H) {
        ball.y = FIELD_Y + FIELD_H - halfBall;
        ball.vy = -Math.abs(ball.vy) * 0.8;
    }

    // Check goals
    // Left goal (Player 2 scores)
    if (ball.x - halfBall < FIELD_X - GOAL_WIDTH + 4) {
        if (ball.y > GOAL_Y && ball.y < GOAL_Y + GOAL_HEIGHT) {
            score2++;
            lastScorer = 2;
            goalScored();
            return;
        }
    }
    // Right goal (Player 1 scores)
    if (ball.x + halfBall > FIELD_X + FIELD_W + GOAL_WIDTH - 4) {
        if (ball.y > GOAL_Y && ball.y < GOAL_Y + GOAL_HEIGHT) {
            score1++;
            lastScorer = 1;
            goalScored();
            return;
        }
    }

    // Bounce off left/right walls (outside goal area)
    if (ball.x - halfBall < FIELD_X) {
        if (ball.y < GOAL_Y || ball.y > GOAL_Y + GOAL_HEIGHT) {
            ball.x = FIELD_X + halfBall;
            ball.vx = Math.abs(ball.vx) * 0.8;
        }
    }
    if (ball.x + halfBall > FIELD_X + FIELD_W) {
        if (ball.y < GOAL_Y || ball.y > GOAL_Y + GOAL_HEIGHT) {
            ball.x = FIELD_X + FIELD_W - halfBall;
            ball.vx = -Math.abs(ball.vx) * 0.8;
        }
    }

    // Ball-player collision (push ball away)
    pushBallFromPlayer(player1);
    pushBallFromPlayer(player2);
}

function pushBallFromPlayer(p) {
    const dx = ball.x - p.x;
    const dy = ball.y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const minDist = PLAYER_SIZE / 2 + BALL_SIZE / 2;

    if (dist < minDist && dist > 0) {
        const overlap = minDist - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        ball.x += nx * overlap;
        ball.y += ny * overlap;
        ball.vx += nx * 1.5;
        ball.vy += ny * 1.5;
    }
}

function goalScored() {
    if (score1 >= WIN_SCORE || score2 >= WIN_SCORE) {
        gameState = STATE_GAMEOVER;
    } else {
        gameState = STATE_GOAL;
        goalTimer = 90; // frames worth at 60fps
    }
}

function update(dt) {
    // Poll gamepads for menu/gameover state
    if (gameState === STATE_MENU || gameState === STATE_GAMEOVER) {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (let i = 0; i < gamepads.length; i++) {
            const gp = gamepads[i];
            if (gp && gp.buttons[0] && gp.buttons[0].pressed) {
                startGame();
                return;
            }
            if (gp && gp.buttons[9] && gp.buttons[9].pressed) {
                startGame();
                return;
            }
        }
    }

    if (gameState === STATE_GOAL) {
        goalTimer -= dt;
        if (goalTimer <= 0) {
            resetPositions();
            gameState = STATE_PLAYING;
        }
        return;
    }

    if (gameState !== STATE_PLAYING) return;

    // Read gamepads
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp1 = gamepads[0] || null;
    const gp2 = gamepads[1] || null;

    // Player 1 input (WASD + Gamepad 1)
    let dx1 = 0, dy1 = 0;
    if (keys['KeyW']) dy1 = -1;
    if (keys['KeyS']) dy1 = 1;
    if (keys['KeyA']) dx1 = -1;
    if (keys['KeyD']) dx1 = 1;

    // Gamepad 1 left stick
    if (gp1) {
        const gx = gp1.axes[0];
        const gy = gp1.axes[1];
        if (Math.abs(gx) > DEADZONE) dx1 += gx;
        if (Math.abs(gy) > DEADZONE) dy1 += gy;

        // Gamepad 1 kick (A button = index 0, B = 1, X = 2, Y = 3)
        const kickBtn1 = gp1.buttons[0] || gp1.buttons[2];
        if (kickBtn1 && kickBtn1.pressed && !gamepadKickPressed1) {
            tryKick(player1);
            gamepadKickPressed1 = true;
        }
        if (kickBtn1 && !kickBtn1.pressed) {
            gamepadKickPressed1 = false;
        }

        // Start game with Start button or A button
        if (gameState !== STATE_PLAYING) {
            if ((gp1.buttons[9] && gp1.buttons[9].pressed) || (gp1.buttons[0] && gp1.buttons[0].pressed)) {
                startGame();
                return;
            }
        }
    }

    // Clamp and normalize
    const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    if (len1 > 1) { dx1 /= len1; dy1 /= len1; }
    movePlayer(player1, dx1, dy1, dt);

    // Player 2 input (Arrows + Gamepad 2)
    let dx2 = 0, dy2 = 0;
    if (keys['ArrowUp']) dy2 = -1;
    if (keys['ArrowDown']) dy2 = 1;
    if (keys['ArrowLeft']) dx2 = -1;
    if (keys['ArrowRight']) dx2 = 1;

    // Gamepad 2 left stick
    if (gp2) {
        const gx = gp2.axes[0];
        const gy = gp2.axes[1];
        if (Math.abs(gx) > DEADZONE) dx2 += gx;
        if (Math.abs(gy) > DEADZONE) dy2 += gy;

        // Gamepad 2 kick
        const kickBtn2 = gp2.buttons[0] || gp2.buttons[2];
        if (kickBtn2 && kickBtn2.pressed && !gamepadKickPressed2) {
            tryKick(player2);
            gamepadKickPressed2 = true;
        }
        if (kickBtn2 && !kickBtn2.pressed) {
            gamepadKickPressed2 = false;
        }

        // Start game with Start button or A button
        if (gameState !== STATE_PLAYING) {
            if ((gp2.buttons[9] && gp2.buttons[9].pressed) || (gp2.buttons[0] && gp2.buttons[0].pressed)) {
                startGame();
                return;
            }
        }
    }

    // Clamp and normalize
    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
    if (len2 > 1) { dx2 /= len2; dy2 /= len2; }
    movePlayer(player2, dx2, dy2, dt);

    // Kick cooldowns
    player1.kickCooldown -= dt;
    player2.kickCooldown -= dt;

    // Update ball
    updateBall(dt);
}

function draw() {
    drawField();

    if (gameState === STATE_MENU) {
        // Darken
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, W, H);

        // Title
        ctx.fillStyle = '#4caf50';
        ctx.font = 'bold 36px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('⚽ SOCCER CRAFT ⚽', W / 2, H / 2 - 80);

        // Minecraft-style subtitle
        ctx.fillStyle = '#aaa';
        ctx.font = '14px monospace';
        ctx.fillText('Ein Fußballspiel im Minecraft-Stil', W / 2, H / 2 - 50);

        // Players preview
        drawPlayer({ x: W / 2 - 60, y: H / 2 + 10, kicking: false, kickCooldown: 0 }, true);
        ctx.fillStyle = COLORS.player1Shirt;
        ctx.font = '12px monospace';
        ctx.fillText('Spieler 1', W / 2 - 60, H / 2 + 45);

        drawPlayer({ x: W / 2 + 60, y: H / 2 + 10, kicking: false, kickCooldown: 0 }, false);
        ctx.fillStyle = COLORS.player2Shirt;
        ctx.fillText('Spieler 2', W / 2 + 60, H / 2 + 45);

        // Controls
        ctx.fillStyle = '#fff';
        ctx.font = '13px monospace';
        ctx.fillText('Spieler 1: WASD + Leertaste', W / 2, H / 2 + 80);
        ctx.fillText('Spieler 2: Pfeiltasten + Enter', W / 2, H / 2 + 100);
        ctx.fillStyle = '#4caf50';
        ctx.fillText('🎮 Gamepads: Stick + A-Button', W / 2, H / 2 + 120);

        ctx.fillStyle = '#ffeb3b';
        ctx.font = 'bold 16px monospace';
        ctx.fillText('Leertaste zum Starten!', W / 2, H / 2 + 150);

        ctx.fillStyle = '#888';
        ctx.font = '11px monospace';
        ctx.fillText('Erster mit 5 Toren gewinnt!', W / 2, H / 2 + 175);
        return;
    }

    // Draw game objects
    drawBall();
    drawPlayer(player1, true);
    drawPlayer(player2, false);
    drawScore();
    drawControls();

    if (gameState === STATE_GOAL) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(W / 2 - 120, H / 2 - 30, 240, 60);
        ctx.fillStyle = '#ffeb3b';
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('⚽ TOR! ⚽', W / 2, H / 2 + 8);
        ctx.fillStyle = lastScorer === 1 ? COLORS.player1Shirt : COLORS.player2Shirt;
        ctx.font = '14px monospace';
        ctx.fillText('Spieler ' + lastScorer + ' trifft!', W / 2, H / 2 + 28);
    }

    if (gameState === STATE_GAMEOVER) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, W, H);

        const winner = score1 >= WIN_SCORE ? 1 : 2;
        ctx.fillStyle = winner === 1 ? COLORS.player1Shirt : COLORS.player2Shirt;
        ctx.font = 'bold 32px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Spieler ' + winner + ' gewinnt!', W / 2, H / 2 - 40);

        ctx.fillStyle = '#fff';
        ctx.font = '22px monospace';
        ctx.fillText(score1 + ' : ' + score2, W / 2, H / 2);

        ctx.fillStyle = '#ffeb3b';
        ctx.font = '16px monospace';
        ctx.fillText('Leertaste für Neustart', W / 2, H / 2 + 50);
    }
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

// Input handling
document.addEventListener('keydown', (e) => {
    keys[e.code] = true;

    if (e.code === 'Space') {
        e.preventDefault();
        if (gameState === STATE_MENU || gameState === STATE_GAMEOVER) {
            startGame();
        } else if (gameState === STATE_PLAYING) {
            tryKick(player1);
        }
    }

    if (e.code === 'Enter') {
        e.preventDefault();
        if (gameState === STATE_MENU || gameState === STATE_GAMEOVER) {
            startGame();
        } else if (gameState === STATE_PLAYING) {
            tryKick(player2);
        }
    }

    // Prevent arrow key scrolling
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// Initialize
resetPositions();
requestAnimationFrame(gameLoop);
