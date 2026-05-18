const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over');
const finalScoreDisplay = document.getElementById('final-score');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');

// Canvas-Größe
canvas.width = 400;
canvas.height = 600;

// Spielkonstanten (ausgelegt für 60 FPS als Basis)
const TARGET_FPS = 60;
const GRAVITY = 0.5;
const JUMP_FORCE = -12;
const MOVE_SPEED = 6;
const PLATFORM_COUNT = 7;

// Spielzustand
let player, platforms, score, maxHeight, gameRunning, keys;
let lastTime = 0;

// Plattform-Typen
const PLATFORM_NORMAL = 'normal';
const PLATFORM_MOVING = 'moving';
const PLATFORM_BREAKING = 'breaking';

function init() {
    player = {
        x: canvas.width / 2 - 20,
        y: canvas.height - 100,
        width: 40,
        height: 40,
        vx: 0,
        vy: 0,
        jumping: false
    };

    platforms = [];
    score = 0;
    maxHeight = 0;
    keys = {};
    lastTime = 0;

    // Startplattform direkt unter dem Spieler
    platforms.push(createPlatform(canvas.width / 2 - 35, canvas.height - 50, PLATFORM_NORMAL));

    // Weitere Plattformen generieren
    for (let i = 1; i < PLATFORM_COUNT; i++) {
        const y = canvas.height - 50 - (i * (canvas.height / PLATFORM_COUNT));
        platforms.push(createPlatform(
            Math.random() * (canvas.width - 70),
            y,
            getRandomPlatformType(i)
        ));
    }
}

function createPlatform(x, y, type) {
    const platform = {
        x: x,
        y: y,
        width: 70,
        height: 15,
        type: type,
        broken: false
    };

    if (type === PLATFORM_MOVING) {
        platform.speed = (Math.random() > 0.5 ? 1 : -1) * (1.5 + Math.random());
    }

    return platform;
}

function getRandomPlatformType(difficulty) {
    const rand = Math.random();
    if (difficulty < 3) return PLATFORM_NORMAL;
    if (rand < 0.6) return PLATFORM_NORMAL;
    if (rand < 0.8) return PLATFORM_MOVING;
    return PLATFORM_BREAKING;
}

function update(dt) {
    if (!gameRunning) return;

    // Spieler-Bewegung (horizontal)
    if (keys['ArrowLeft'] || keys['KeyA']) {
        player.vx = -MOVE_SPEED;
    } else if (keys['ArrowRight'] || keys['KeyD']) {
        player.vx = MOVE_SPEED;
    } else {
        player.vx *= Math.pow(0.8, dt);
    }

    player.x += player.vx * dt;

    // Wrap-around (Bildschirmränder)
    if (player.x + player.width < 0) {
        player.x = canvas.width;
    } else if (player.x > canvas.width) {
        player.x = -player.width;
    }

    // Gravitation
    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;

    // Plattform-Kollision (nur beim Fallen)
    if (player.vy > 0) {
        for (const platform of platforms) {
            if (platform.broken) continue;

            if (
                player.x + player.width > platform.x &&
                player.x < platform.x + platform.width &&
                player.y + player.height > platform.y &&
                player.y + player.height < platform.y + platform.height + 10 &&
                player.vy > 0
            ) {
                player.vy = JUMP_FORCE;
                if (platform.type === PLATFORM_BREAKING) {
                    platform.broken = true;
                }
            }
        }
    }

    // Plattformen bewegen
    for (const platform of platforms) {
        if (platform.type === PLATFORM_MOVING && !platform.broken) {
            platform.x += platform.speed * dt;
            if (platform.x <= 0 || platform.x + platform.width >= canvas.width) {
                platform.speed *= -1;
            }
        }
    }

    // Kamera nach oben scrollen
    if (player.y < canvas.height / 2) {
        const offset = canvas.height / 2 - player.y;
        player.y = canvas.height / 2;

        for (const platform of platforms) {
            platform.y += offset;
        }

        maxHeight += offset;
        score = Math.floor(maxHeight / 10);
        scoreDisplay.textContent = score;
    }

    // Plattformen recyceln (unter dem Bildschirm → oben neu)
    for (let i = 0; i < platforms.length; i++) {
        if (platforms[i].y > canvas.height + 50) {
            const highestY = Math.min(...platforms.map(p => p.y));
            const newY = highestY - (80 + Math.random() * 60);
            platforms[i] = createPlatform(
                Math.random() * (canvas.width - 70),
                newY,
                getRandomPlatformType(score / 50)
            );
        }
    }

    // Game Over (Spieler fällt unter den Bildschirm)
    if (player.y > canvas.height) {
        gameOver();
    }
}

function draw() {
    // Hintergrund (Himmel-Gradient)
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(1, '#E0F7FA');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Plattformen zeichnen
    for (const platform of platforms) {
        if (platform.broken) continue;

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(platform.x, platform.y, platform.width, platform.height, 4);

        switch (platform.type) {
            case PLATFORM_NORMAL:
                ctx.fillStyle = '#4CAF50';
                break;
            case PLATFORM_MOVING:
                ctx.fillStyle = '#2196F3';
                break;
            case PLATFORM_BREAKING:
                ctx.fillStyle = '#FF9800';
                break;
        }

        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
    }

    // Spieler zeichnen
    drawPlayer();
}

function drawPlayer() {
    const x = player.x;
    const y = player.y;
    const w = player.width;
    const h = player.height;

    // Körper
    ctx.fillStyle = '#8BC34A';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#558B2F';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Augen
    const eyeOffsetX = player.vx > 0.5 ? 4 : player.vx < -0.5 ? -4 : 0;
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(x + w / 2 - 7 + eyeOffsetX, y + h / 2 - 5, 6, 0, Math.PI * 2);
    ctx.arc(x + w / 2 + 7 + eyeOffsetX, y + h / 2 - 5, 6, 0, Math.PI * 2);
    ctx.fill();

    // Pupillen
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(x + w / 2 - 5 + eyeOffsetX, y + h / 2 - 5, 3, 0, Math.PI * 2);
    ctx.arc(x + w / 2 + 9 + eyeOffsetX, y + h / 2 - 5, 3, 0, Math.PI * 2);
    ctx.fill();

    // Mund
    ctx.beginPath();
    if (player.vy < 0) {
        ctx.arc(x + w / 2, y + h / 2 + 8, 6, 0, Math.PI);
    } else {
        ctx.arc(x + w / 2, y + h / 2 + 8, 4, 0, Math.PI * 2);
    }
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Füße
    ctx.fillStyle = '#8BC34A';
    ctx.beginPath();
    ctx.ellipse(x + w / 2 - 8, y + h - 2, 6, 4, 0, 0, Math.PI * 2);
    ctx.ellipse(x + w / 2 + 8, y + h - 2, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#558B2F';
    ctx.lineWidth = 1;
    ctx.stroke();
}

function gameLoop(timestamp) {
    if (!gameRunning) return;

    // Delta-Time berechnen (normalisiert auf 60 FPS)
    if (lastTime === 0) lastTime = timestamp;
    const elapsed = timestamp - lastTime;
    lastTime = timestamp;

    // dt = 1.0 bei 60 FPS, 2.0 bei 30 FPS, 0.5 bei 120 FPS
    const dt = Math.min(elapsed / (1000 / TARGET_FPS), 3); // Cap bei 3 um Sprünge zu vermeiden

    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
}

function startGame() {
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    init();
    gameRunning = true;
    lastTime = 0;
    requestAnimationFrame(gameLoop);
}

function gameOver() {
    gameRunning = false;
    finalScoreDisplay.textContent = score;
    gameOverScreen.classList.remove('hidden');
}

// Event Listener
document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// Touch-Steuerung
let touchStartX = 0;
canvas.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    e.preventDefault();
});

canvas.addEventListener('touchmove', (e) => {
    const touchX = e.touches[0].clientX;
    const diff = touchX - touchStartX;

    if (diff > 10) {
        keys['ArrowRight'] = true;
        keys['ArrowLeft'] = false;
    } else if (diff < -10) {
        keys['ArrowLeft'] = true;
        keys['ArrowRight'] = false;
    } else {
        keys['ArrowLeft'] = false;
        keys['ArrowRight'] = false;
    }
    e.preventDefault();
});

canvas.addEventListener('touchend', () => {
    keys['ArrowLeft'] = false;
    keys['ArrowRight'] = false;
});

// Geräte-Neigung (Gyroscope)
if (window.DeviceOrientationEvent) {
    window.addEventListener('deviceorientation', (e) => {
        if (!gameRunning) return;
        const tilt = e.gamma;
        if (tilt > 5) {
            keys['ArrowRight'] = true;
            keys['ArrowLeft'] = false;
        } else if (tilt < -5) {
            keys['ArrowLeft'] = true;
            keys['ArrowRight'] = false;
        } else {
            keys['ArrowLeft'] = false;
            keys['ArrowRight'] = false;
        }
    });
}

// Buttons
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// Auch mit Leertaste starten
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        if (!gameRunning) {
            startGame();
        }
    }
});
