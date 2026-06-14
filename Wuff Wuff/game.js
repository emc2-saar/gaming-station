const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const TARGET_FPS = 60;
let lastTime = 0;
let gameRunning = false;
let score = 0;

// Hund-Status
let dog = {
    x: 240,
    y: 350,
    hunger: 80,
    happiness: 80,
    energy: 80,
    tailWag: 0,
    tailDir: 1,
    bounceY: 0,
    bounceDir: 1,
    expression: 'happy', // happy, sad, sleeping, eating, playing
    expressionTimer: 0,
    actionAnim: 0,
    hearts: [],
    zzz: []
};

// Spielzeit und Schwierigkeit
let gameTime = 0;
let decayRate = 0.02; // Wie schnell Werte sinken
let level = 1;
let totalCare = 0; // Gesamte Pflege-Punkte

// Buttons
const buttons = [
    { id: 'feed', label: '🍖 Füttern', x: 40, y: 530, w: 120, h: 50, key: '1' },
    { id: 'play', label: '⚾ Spielen', x: 180, y: 530, w: 120, h: 50, key: '2' },
    { id: 'sleep', label: '💤 Schlafen', x: 320, y: 530, w: 120, h: 50, key: '3' }
];

let selectedButton = 0;
let buttonPressAnim = -1;

// Partikel für Effekte
let particles = [];

// Gamepad
let gamepadConnected = false;
let prevGamepadButtons = [];

function update(dt) {
    if (!gameRunning) return;

    gameTime += dt;

    // Schwierigkeit steigt alle 30 Sekunden (bei 60fps ~ 1800 frames)
    level = 1 + Math.floor(gameTime / 1800);
    decayRate = 0.02 + (level - 1) * 0.005;

    // Werte sinken über Zeit
    dog.hunger -= decayRate * dt;
    dog.happiness -= (decayRate * 0.8) * dt;
    dog.energy -= (decayRate * 0.6) * dt;

    // Werte begrenzen
    dog.hunger = Math.max(0, Math.min(100, dog.hunger));
    dog.happiness = Math.max(0, Math.min(100, dog.happiness));
    dog.energy = Math.max(0, Math.min(100, dog.energy));

    // Expression basierend auf Status
    if (dog.expressionTimer > 0) {
        dog.expressionTimer -= dt;
    } else {
        if (dog.energy < 20) {
            dog.expression = 'sad';
        } else if (dog.hunger < 20 || dog.happiness < 20) {
            dog.expression = 'sad';
        } else if (dog.hunger > 60 && dog.happiness > 60 && dog.energy > 60) {
            dog.expression = 'happy';
        } else {
            dog.expression = 'neutral';
        }
    }

    // Schwanzwedeln
    dog.tailWag += 0.15 * dt * dog.tailDir;
    if (dog.tailWag > 1 || dog.tailWag < -1) {
        dog.tailDir *= -1;
    }

    // Hüpf-Animation wenn glücklich
    if (dog.expression === 'happy' || dog.expression === 'playing') {
        dog.bounceY += 0.1 * dt * dog.bounceDir;
        if (dog.bounceY > 5 || dog.bounceY < -5) {
            dog.bounceDir *= -1;
        }
    } else {
        dog.bounceY *= Math.pow(0.9, dt);
    }

    // Action Animation
    if (dog.actionAnim > 0) {
        dog.actionAnim -= dt;
    }

    // Herzen animieren
    for (let i = dog.hearts.length - 1; i >= 0; i--) {
        dog.hearts[i].y -= 1 * dt;
        dog.hearts[i].life -= dt;
        dog.hearts[i].x += Math.sin(dog.hearts[i].y * 0.05) * 0.5 * dt;
        if (dog.hearts[i].life <= 0) {
            dog.hearts.splice(i, 1);
        }
    }

    // Zzz animieren
    for (let i = dog.zzz.length - 1; i >= 0; i--) {
        dog.zzz[i].y -= 0.5 * dt;
        dog.zzz[i].life -= dt;
        dog.zzz[i].x += 0.3 * dt;
        if (dog.zzz[i].life <= 0) {
            dog.zzz.splice(i, 1);
        }
    }

    // Partikel animieren
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].x += particles[i].vx * dt;
        particles[i].y += particles[i].vy * dt;
        particles[i].vy += 0.1 * dt;
        particles[i].life -= dt;
        if (particles[i].life <= 0) {
            particles.splice(i, 1);
        }
    }

    // Score berechnen (Durchschnitt der Werte)
    score = Math.floor((dog.hunger + dog.happiness + dog.energy) / 3);

    // Game Over wenn alles bei 0
    if (dog.hunger <= 0 && dog.happiness <= 0 && dog.energy <= 0) {
        gameOver();
    }
}

function doAction(actionId) {
    if (!gameRunning) return;

    switch (actionId) {
        case 'feed':
            if (dog.hunger < 100) {
                dog.hunger = Math.min(100, dog.hunger + 25);
                dog.energy = Math.min(100, dog.energy + 5);
                dog.expression = 'eating';
                dog.expressionTimer = 60;
                dog.actionAnim = 30;
                totalCare++;
                spawnParticles(dog.x, dog.y - 30, '#f39c12', 5);
                addHeart();
            }
            break;
        case 'play':
            if (dog.energy > 10) {
                dog.happiness = Math.min(100, dog.happiness + 25);
                dog.energy = Math.max(0, dog.energy - 15);
                dog.hunger = Math.max(0, dog.hunger - 5);
                dog.expression = 'playing';
                dog.expressionTimer = 60;
                dog.actionAnim = 30;
                totalCare++;
                spawnParticles(dog.x, dog.y - 30, '#e74c3c', 5);
                addHeart();
            }
            break;
        case 'sleep':
            if (dog.energy < 100) {
                dog.energy = Math.min(100, dog.energy + 30);
                dog.happiness = Math.min(100, dog.happiness + 5);
                dog.expression = 'sleeping';
                dog.expressionTimer = 90;
                dog.actionAnim = 30;
                totalCare++;
                addZzz();
            }
            break;
    }
}

function addHeart() {
    dog.hearts.push({
        x: dog.x + (Math.random() - 0.5) * 40,
        y: dog.y - 60,
        life: 60
    });
}

function addZzz() {
    for (let i = 0; i < 3; i++) {
        dog.zzz.push({
            x: dog.x + 30 + i * 10,
            y: dog.y - 50 - i * 15,
            life: 80 + i * 20
        });
    }
}

function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 2) * 3,
            color: color,
            life: 30 + Math.random() * 20
        });
    }
}

function draw() {
    // Hintergrund
    ctx.fillStyle = '#2d1b69';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!gameRunning && gameTime === 0) {
        drawStartScreen();
        return;
    }

    if (!gameRunning && gameTime > 0) {
        drawGameOverScreen();
        return;
    }

    // Boden / Wiese
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(0, 450, canvas.width, 200);

    // Grashalme
    ctx.strokeStyle = '#27ae60';
    ctx.lineWidth = 2;
    for (let i = 0; i < canvas.width; i += 15) {
        ctx.beginPath();
        ctx.moveTo(i, 450);
        ctx.lineTo(i + 3, 440);
        ctx.stroke();
    }

    // Himmel-Deko (Wolken)
    drawCloud(80, 60, 0.8);
    drawCloud(350, 90, 0.6);
    drawCloud(200, 40, 0.5);

    // Sonne
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(400, 70, 30, 0, Math.PI * 2);
    ctx.fill();

    // Status-Balken oben
    drawStatusBar(20, 20, 'Hunger', dog.hunger, '#e67e22');
    drawStatusBar(20, 55, 'Glück', dog.happiness, '#e74c3c');
    drawStatusBar(20, 90, 'Energie', dog.energy, '#3498db');

    // Level und Score
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Level: ' + level, canvas.width - 20, 30);
    ctx.fillText('Pflege: ' + totalCare, canvas.width - 20, 50);
    ctx.fillText('Wohlbefinden: ' + score + '%', canvas.width - 20, 70);

    // Hund zeichnen
    drawDog();

    // Herzen
    for (let h of dog.hearts) {
        let alpha = h.life / 60;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#e74c3c';
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('❤️', h.x, h.y);
        ctx.globalAlpha = 1;
    }

    // Zzz
    for (let z of dog.zzz) {
        let alpha = z.life / 80;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#a8d8ea';
        ctx.font = '18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('💤', z.x, z.y);
        ctx.globalAlpha = 1;
    }

    // Partikel
    for (let p of particles) {
        let alpha = p.life / 50;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    // Buttons
    drawButtons();
}

function drawDog() {
    let x = dog.x;
    let y = dog.y + dog.bounceY;

    ctx.save();
    ctx.translate(x, y);

    // Schatten
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(0, 60, 40, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Schwanz
    ctx.strokeStyle = '#c0792a';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(35, -10);
    ctx.quadraticCurveTo(50 + dog.tailWag * 10, -40, 45 + dog.tailWag * 15, -50);
    ctx.stroke();

    // Körper
    ctx.fillStyle = '#e8a838';
    ctx.beginPath();
    ctx.ellipse(0, 10, 40, 35, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bauch
    ctx.fillStyle = '#f5d89a';
    ctx.beginPath();
    ctx.ellipse(0, 20, 25, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    // Beine
    ctx.fillStyle = '#c0792a';
    // Vorderbeine
    ctx.fillRect(-25, 35, 12, 25);
    ctx.fillRect(13, 35, 12, 25);
    // Hinterbeine
    ctx.fillRect(-30, 30, 10, 20);
    ctx.fillRect(20, 30, 10, 20);

    // Pfoten
    ctx.fillStyle = '#8B4513';
    ctx.beginPath();
    ctx.ellipse(-19, 60, 8, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(19, 60, 8, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Kopf
    ctx.fillStyle = '#e8a838';
    ctx.beginPath();
    ctx.arc(0, -35, 30, 0, Math.PI * 2);
    ctx.fill();

    // Ohren
    ctx.fillStyle = '#c0792a';
    // Linkes Ohr (Schlapp-Ohr)
    ctx.beginPath();
    ctx.ellipse(-22, -50, 10, 18, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // Rechtes Ohr
    ctx.beginPath();
    ctx.ellipse(22, -50, 10, 18, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Gesicht basierend auf Expression
    drawFace();

    ctx.restore();

    // Action-Animation (Essen/Spielen Icon)
    if (dog.actionAnim > 0) {
        let animAlpha = dog.actionAnim / 30;
        ctx.globalAlpha = animAlpha;
        ctx.font = '30px sans-serif';
        ctx.textAlign = 'center';
        if (dog.expression === 'eating') {
            ctx.fillText('🍖', x, y - 90 - (30 - dog.actionAnim));
        } else if (dog.expression === 'playing') {
            ctx.fillText('⚾', x, y - 90 - (30 - dog.actionAnim));
        }
        ctx.globalAlpha = 1;
    }
}

function drawFace() {
    switch (dog.expression) {
        case 'happy':
            // Augen (fröhlich)
            ctx.fillStyle = '#333';
            ctx.beginPath();
            ctx.arc(-10, -38, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(10, -38, 5, 0, Math.PI * 2);
            ctx.fill();

            // Glanzpunkte
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(-8, -40, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(12, -40, 2, 0, Math.PI * 2);
            ctx.fill();

            // Mund (lächeln)
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, -28, 10, 0.1, Math.PI - 0.1);
            ctx.stroke();

            // Zunge
            ctx.fillStyle = '#e75480';
            ctx.beginPath();
            ctx.ellipse(3, -20, 5, 7, 0, 0, Math.PI * 2);
            ctx.fill();
            break;

        case 'sad':
            // Traurige Augen
            ctx.fillStyle = '#333';
            ctx.beginPath();
            ctx.arc(-10, -35, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(10, -35, 5, 0, Math.PI * 2);
            ctx.fill();

            // Trauriger Mund
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, -22, 8, Math.PI + 0.3, -0.3);
            ctx.stroke();

            // Traurige Augenbrauen
            ctx.beginPath();
            ctx.moveTo(-15, -45);
            ctx.lineTo(-5, -43);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(15, -45);
            ctx.lineTo(5, -43);
            ctx.stroke();
            break;

        case 'sleeping':
            // Geschlossene Augen
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(-10, -37, 5, 0, Math.PI);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(10, -37, 5, 0, Math.PI);
            ctx.stroke();

            // Friedlicher Mund
            ctx.beginPath();
            ctx.arc(0, -25, 5, 0.2, Math.PI - 0.2);
            ctx.stroke();
            break;

        case 'eating':
            // Fröhliche Augen (zusammengekniffen)
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(-10, -37, 5, Math.PI + 0.3, -0.3);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(10, -37, 5, Math.PI + 0.3, -0.3);
            ctx.stroke();

            // Offener Mund
            ctx.fillStyle = '#8B0000';
            ctx.beginPath();
            ctx.ellipse(0, -24, 8, 10, 0, 0, Math.PI * 2);
            ctx.fill();
            break;

        case 'playing':
            // Große begeisterte Augen
            ctx.fillStyle = '#333';
            ctx.beginPath();
            ctx.arc(-10, -38, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(10, -38, 6, 0, Math.PI * 2);
            ctx.fill();

            // Große Glanzpunkte
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(-8, -40, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(12, -40, 3, 0, Math.PI * 2);
            ctx.fill();

            // Großes Grinsen
            ctx.fillStyle = '#8B0000';
            ctx.beginPath();
            ctx.arc(0, -26, 12, 0, Math.PI);
            ctx.fill();

            // Zunge raus
            ctx.fillStyle = '#e75480';
            ctx.beginPath();
            ctx.ellipse(0, -16, 6, 8, 0, 0, Math.PI);
            ctx.fill();
            break;

        default: // neutral
            ctx.fillStyle = '#333';
            ctx.beginPath();
            ctx.arc(-10, -37, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(10, -37, 4, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-7, -25);
            ctx.lineTo(7, -25);
            ctx.stroke();
            break;
    }

    // Nase (immer)
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.ellipse(0, -30, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
}

function drawCloud(x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(20, -5, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-15, 5, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(10, 8, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawStatusBar(x, y, label, value, color) {
    // Label
    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, x, y + 12);

    // Hintergrund
    ctx.fillStyle = '#444';
    ctx.fillRect(x + 55, y, 120, 18);
    ctx.strokeStyle = '#666';
    ctx.strokeRect(x + 55, y, 120, 18);

    // Wert
    let barWidth = (value / 100) * 116;
    ctx.fillStyle = color;
    if (value < 25) ctx.fillStyle = '#e74c3c';
    ctx.fillRect(x + 57, y + 2, barWidth, 14);

    // Prozent
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(Math.floor(value) + '%', x + 115, y + 13);
}

function drawButtons() {
    for (let i = 0; i < buttons.length; i++) {
        let btn = buttons[i];
        let isSelected = (i === selectedButton);
        let isPressed = (i === buttonPressAnim);

        // Button-Hintergrund
        if (isPressed) {
            ctx.fillStyle = '#1abc9c';
        } else if (isSelected) {
            ctx.fillStyle = '#16a085';
        } else {
            ctx.fillStyle = '#2c3e50';
        }

        let yOffset = isPressed ? 2 : 0;
        ctx.fillRect(btn.x, btn.y + yOffset, btn.w, btn.h);

        // Rahmen
        ctx.strokeStyle = isSelected ? '#1abc9c' : '#7f8c8d';
        ctx.lineWidth = isSelected ? 3 : 1;
        ctx.strokeRect(btn.x, btn.y + yOffset, btn.w, btn.h);

        // Text
        ctx.fillStyle = '#fff';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 6 + yOffset);

        // Tastenkürzel
        ctx.fillStyle = '#aaa';
        ctx.font = '10px sans-serif';
        ctx.fillText('[' + btn.key + ']', btn.x + btn.w / 2, btn.y + btn.h - 5 + yOffset);
    }

    // Steuerungshinweis unten
    ctx.fillStyle = '#888';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('← → Auswählen | Leertaste/Enter Ausführen | 1/2/3 Direkt', canvas.width / 2, 610);
}

function drawStartScreen() {
    // Hintergrund-Gradient Effekt
    ctx.fillStyle = '#2d1b69';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Deko-Pfoten
    ctx.font = '30px sans-serif';
    ctx.textAlign = 'center';
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 8; i++) {
        ctx.fillText('🐾', 50 + (i % 4) * 120, 100 + Math.floor(i / 4) * 400);
    }
    ctx.globalAlpha = 1;

    // Hund-Emoji groß
    ctx.font = '80px sans-serif';
    ctx.fillText('🐕', canvas.width / 2, 220);

    // Titel
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('Wuff Wuff', canvas.width / 2, 310);

    // Untertitel
    ctx.fillStyle = '#ecf0f1';
    ctx.font = '18px sans-serif';
    ctx.fillText('Kümmere dich um deinen Hund!', canvas.width / 2, 360);

    // Steuerung
    ctx.fillStyle = '#bdc3c7';
    ctx.font = '14px sans-serif';
    ctx.fillText('← → oder 1/2/3 zum Auswählen', canvas.width / 2, 430);
    ctx.fillText('Leertaste oder Enter zum Bestätigen', canvas.width / 2, 455);
    ctx.fillText('🎮 Gamepad wird unterstützt', canvas.width / 2, 480);

    // Start-Hinweis (blinkend)
    let blink = Math.sin(Date.now() * 0.005) > 0;
    if (blink) {
        ctx.fillStyle = '#1abc9c';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText('Leertaste / 🅰 zum Starten', canvas.width / 2, 550);
    }
}

function drawGameOverScreen() {
    ctx.fillStyle = '#2d1b69';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Trauriger Hund
    ctx.font = '60px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('😢🐕', canvas.width / 2, 200);

    ctx.fillStyle = '#e74c3c';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('Dein Hund ist traurig!', canvas.width / 2, 280);

    ctx.fillStyle = '#ecf0f1';
    ctx.font = '18px sans-serif';
    ctx.fillText('Du hast dich nicht genug gekümmert...', canvas.width / 2, 330);

    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('Pflege-Punkte: ' + totalCare, canvas.width / 2, 390);
    ctx.fillText('Level erreicht: ' + level, canvas.width / 2, 425);

    // Neustart
    let blink = Math.sin(Date.now() * 0.005) > 0;
    if (blink) {
        ctx.fillStyle = '#1abc9c';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText('Leertaste für Neustart', canvas.width / 2, 520);
    }
}

function gameLoop(timestamp) {
    if (lastTime === 0) lastTime = timestamp;
    const elapsed = timestamp - lastTime;
    lastTime = timestamp;
    const dt = Math.min(elapsed / (1000 / TARGET_FPS), 3);

    // Gamepad auch im Menü prüfen
    pollGamepad(dt);
    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
}

function startGame() {
    score = 0;
    gameTime = 0;
    level = 1;
    totalCare = 0;
    decayRate = 0.02;
    dog.hunger = 80;
    dog.happiness = 80;
    dog.energy = 80;
    dog.expression = 'happy';
    dog.expressionTimer = 0;
    dog.actionAnim = 0;
    dog.hearts = [];
    dog.zzz = [];
    dog.bounceY = 0;
    particles = [];
    selectedButton = 0;
    gameRunning = true;
    lastTime = 0;
}

function gameOver() {
    gameRunning = false;
}

// Keyboard Input
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (!gameRunning) {
            startGame();
        } else {
            pressButton(selectedButton);
        }
    }

    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        e.preventDefault();
        selectedButton = (selectedButton - 1 + buttons.length) % buttons.length;
    }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        e.preventDefault();
        selectedButton = (selectedButton + 1) % buttons.length;
    }

    // Direkte Tasten
    if (e.code === 'Digit1' || e.code === 'Numpad1') {
        e.preventDefault();
        if (gameRunning) pressButton(0);
    }
    if (e.code === 'Digit2' || e.code === 'Numpad2') {
        e.preventDefault();
        if (gameRunning) pressButton(1);
    }
    if (e.code === 'Digit3' || e.code === 'Numpad3') {
        e.preventDefault();
        if (gameRunning) pressButton(2);
    }
});

function pressButton(index) {
    buttonPressAnim = index;
    doAction(buttons[index].id);
    setTimeout(() => { buttonPressAnim = -1; }, 150);
}

// Touch/Click Input
canvas.addEventListener('click', (e) => {
    let rect = canvas.getBoundingClientRect();
    let scaleX = canvas.width / rect.width;
    let scaleY = canvas.height / rect.height;
    let mx = (e.clientX - rect.left) * scaleX;
    let my = (e.clientY - rect.top) * scaleY;

    if (!gameRunning) {
        startGame();
        return;
    }

    for (let i = 0; i < buttons.length; i++) {
        let btn = buttons[i];
        if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
            pressButton(i);
            break;
        }
    }
});

// Gamepad Support
function pollGamepad(dt) {
    let gamepads = navigator.getGamepads();
    if (!gamepads) return;

    let gp = null;
    for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i]) {
            gp = gamepads[i];
            break;
        }
    }
    if (!gp) return;

    gamepadConnected = true;
    const DEADZONE = 0.15;

    // D-Pad oder linker Stick für Navigation
    let axisX = gp.axes[0] || 0;
    if (Math.abs(axisX) < DEADZONE) axisX = 0;

    // Button-States tracken für Edge-Detection
    let currentButtons = gp.buttons.map(b => b.pressed);

    // D-Pad Links/Rechts (Buttons 14/15) oder Analog-Stick
    let leftPressed = currentButtons[14] || axisX < -DEADZONE;
    let rightPressed = currentButtons[15] || axisX > DEADZONE;
    let prevLeft = prevGamepadButtons[14] || false;
    let prevRight = prevGamepadButtons[15] || false;

    if (leftPressed && !prevLeft) {
        selectedButton = (selectedButton - 1 + buttons.length) % buttons.length;
    }
    if (rightPressed && !prevRight) {
        selectedButton = (selectedButton + 1) % buttons.length;
    }

    // A-Button (0) oder X-Button (2) zum Bestätigen
    let actionPressed = currentButtons[0] || currentButtons[2];
    let prevAction = prevGamepadButtons[0] || prevGamepadButtons[2] || false;

    if (actionPressed && !prevAction) {
        if (!gameRunning) {
            startGame();
        } else {
            pressButton(selectedButton);
        }
    }

    // Y-Button (3) = Füttern, B-Button (1) = Spielen, X-Button (2) = Schlafen
    if (currentButtons[3] && !prevGamepadButtons[3] && gameRunning) {
        pressButton(0); // Füttern
    }
    if (currentButtons[1] && !(prevGamepadButtons[1]) && gameRunning) {
        pressButton(1); // Spielen
    }

    prevGamepadButtons = currentButtons;
}

window.addEventListener('gamepadconnected', () => {
    gamepadConnected = true;
});

// Start
requestAnimationFrame(gameLoop);
