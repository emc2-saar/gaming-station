const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

// Kleiner Ball der mit dem Controller gesteuert wird
let ball = { x: W / 2, y: H / 2, size: 20, color: '#4ade80', speed: 4 };
let trail = []; // Spur des Balls

// Controller-Status für Anzeige
let controllerName = 'Kein Controller erkannt';
let controllerConnected = false;
let buttonStates = [];
let axesStates = [];
let lastAction = 'Warte auf Eingabe...';

function draw() {
    // Hintergrund
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, W, H);

    // Titel
    ctx.fillStyle = '#4a9eff';
    ctx.font = 'bold 22px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('🎮 Controller Test', W / 2, 30);

    // Controller-Name
    ctx.font = '12px Courier New';
    ctx.fillStyle = controllerConnected ? '#4ade80' : '#ff4444';
    ctx.fillText(controllerName, W / 2, 55);

    // Letzte Aktion
    ctx.font = '14px Courier New';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(lastAction, W / 2, 80);

    // Ball-Spur zeichnen
    trail.forEach((pos, i) => {
        const alpha = i / trail.length * 0.5;
        ctx.fillStyle = `rgba(74, 222, 128, ${alpha})`;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, ball.size * (i / trail.length) * 0.5, 0, Math.PI * 2);
        ctx.fill();
    });

    // Ball zeichnen
    ctx.fillStyle = ball.color;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Spielbereich Rahmen
    const areaY = 95;
    const areaH = 250;
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.strokeRect(10, areaY, W - 20, areaH);

    // Anweisungen im Spielbereich
    ctx.fillStyle = '#555';
    ctx.font = '12px Courier New';
    ctx.fillText('Bewege den Ball mit dem Controller', W / 2, areaY + areaH - 10);

    // Button-Status anzeigen
    drawButtonPanel();
    drawAxesPanel();
}

function drawButtonPanel() {
    const startY = 360;
    ctx.fillStyle = '#ccc';
    ctx.font = 'bold 12px Courier New';
    ctx.textAlign = 'left';
    ctx.fillText('BUTTONS:', 20, startY);

    const cols = 8;
    for (let i = 0; i < buttonStates.length && i < 20; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = 20 + col * 75;
        const y = startY + 15 + row * 28;

        const pressed = buttonStates[i];
        ctx.fillStyle = pressed ? '#4ade80' : '#333';
        ctx.fillRect(x, y, 60, 20);
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, 60, 20);

        ctx.fillStyle = pressed ? '#000' : '#888';
        ctx.font = '10px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText(`B${i}`, x + 30, y + 14);
    }
}

function drawAxesPanel() {
    const startY = 360;
    const startX = 420;
    ctx.fillStyle = '#ccc';
    ctx.font = 'bold 12px Courier New';
    ctx.textAlign = 'left';
    ctx.fillText('ACHSEN:', startX, startY);

    for (let i = 0; i < axesStates.length && i < 6; i++) {
        const y = startY + 15 + i * 22;
        const val = axesStates[i];

        // Label
        ctx.fillStyle = '#888';
        ctx.font = '10px Courier New';
        ctx.textAlign = 'left';
        ctx.fillText(`A${i}:`, startX, y + 12);

        // Bar
        const barX = startX + 30;
        const barW = 150;
        const barH = 14;
        ctx.fillStyle = '#222';
        ctx.fillRect(barX, y + 2, barW, barH);

        // Wert-Anzeige
        const fillW = (val + 1) / 2 * barW; // -1..1 -> 0..barW
        ctx.fillStyle = Math.abs(val) > 0.2 ? '#4a9eff' : '#444';
        ctx.fillRect(barX, y + 2, fillW, barH);

        // Mittellinie
        ctx.strokeStyle = '#666';
        ctx.beginPath();
        ctx.moveTo(barX + barW / 2, y + 2);
        ctx.lineTo(barX + barW / 2, y + 2 + barH);
        ctx.stroke();

        // Wert als Text
        ctx.fillStyle = '#fff';
        ctx.font = '9px Courier New';
        ctx.textAlign = 'right';
        ctx.fillText(val.toFixed(2), startX + 210, y + 13);
    }
}

function update() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;

    for (const pad of gamepads) {
        if (pad && pad.connected) { gp = pad; break; }
    }

    if (!gp) {
        controllerConnected = false;
        controllerName = 'Kein Controller erkannt – bitte verbinden und Taste drücken';
        return;
    }

    controllerConnected = true;
    controllerName = gp.id;

    // Button-States speichern
    buttonStates = gp.buttons.map(b => b.pressed);
    axesStates = [...gp.axes];

    // Ball mit linkem Stick / D-Pad bewegen
    let dx = 0, dy = 0;

    // Analogstick
    if (Math.abs(gp.axes[0]) > 0.15) dx += gp.axes[0] * ball.speed;
    if (Math.abs(gp.axes[1]) > 0.15) dy += gp.axes[1] * ball.speed;

    // D-Pad
    if (gp.buttons[14]?.pressed) dx -= ball.speed;
    if (gp.buttons[15]?.pressed) dx += ball.speed;
    if (gp.buttons[12]?.pressed) dy -= ball.speed;
    if (gp.buttons[13]?.pressed) dy += ball.speed;

    // Ball bewegen
    ball.x += dx;
    ball.y += dy;

    // Grenzen (Spielbereich)
    const areaY = 95;
    const areaH = 250;
    ball.x = Math.max(30, Math.min(W - 30, ball.x));
    ball.y = Math.max(areaY + ball.size, Math.min(areaY + areaH - ball.size, ball.y));

    // Spur
    if (dx !== 0 || dy !== 0) {
        trail.push({ x: ball.x, y: ball.y });
        if (trail.length > 30) trail.shift();
    }

    // Farbe ändern bei Button-Druck
    if (gp.buttons[0]?.pressed) { ball.color = '#4ade80'; lastAction = 'Button 0 (A/B unten)'; }
    if (gp.buttons[1]?.pressed) { ball.color = '#ef4444'; lastAction = 'Button 1 (A/B rechts)'; }
    if (gp.buttons[2]?.pressed) { ball.color = '#4a9eff'; lastAction = 'Button 2 (X/Y links)'; }
    if (gp.buttons[3]?.pressed) { ball.color = '#fbbf24'; lastAction = 'Button 3 (X/Y oben)'; }
    if (gp.buttons[4]?.pressed) lastAction = 'Button 4 (L Schulter)';
    if (gp.buttons[5]?.pressed) lastAction = 'Button 5 (R Schulter)';
    if (gp.buttons[6]?.pressed) lastAction = 'Button 6 (ZL Trigger)';
    if (gp.buttons[7]?.pressed) lastAction = 'Button 7 (ZR Trigger)';
    if (gp.buttons[8]?.pressed) lastAction = 'Button 8 (- / Select)';
    if (gp.buttons[9]?.pressed) lastAction = 'Button 9 (+ / Start)';
    if (gp.buttons[10]?.pressed) lastAction = 'Button 10 (L Stick klick)';
    if (gp.buttons[11]?.pressed) lastAction = 'Button 11 (R Stick klick)';
    if (gp.buttons[12]?.pressed) lastAction = 'Button 12 (D-Pad oben)';
    if (gp.buttons[13]?.pressed) lastAction = 'Button 13 (D-Pad unten)';
    if (gp.buttons[14]?.pressed) lastAction = 'Button 14 (D-Pad links)';
    if (gp.buttons[15]?.pressed) lastAction = 'Button 15 (D-Pad rechts)';
    if (gp.buttons[16]?.pressed) lastAction = 'Button 16 (Home)';

    // Rechter Stick
    if (Math.abs(gp.axes[2]) > 0.3) lastAction = `Rechter Stick X: ${gp.axes[2].toFixed(2)}`;
    if (Math.abs(gp.axes[3]) > 0.3) lastAction = `Rechter Stick Y: ${gp.axes[3].toFixed(2)}`;

    // Ball-Reset mit Select/Minus
    if (gp.buttons[8]?.pressed) {
        ball.x = W / 2;
        ball.y = 95 + 125;
        trail = [];
    }
}

// Keyboard fallback für Test ohne Controller
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') ball.x -= ball.speed * 3;
    if (e.key === 'ArrowRight') ball.x += ball.speed * 3;
    if (e.key === 'ArrowUp') ball.y -= ball.speed * 3;
    if (e.key === 'ArrowDown') ball.y += ball.speed * 3;
    lastAction = `Tastatur: ${e.key}`;
});

// Gamepad-Events loggen
window.addEventListener('gamepadconnected', (e) => {
    controllerConnected = true;
    controllerName = e.gamepad.id;
    lastAction = `VERBUNDEN: ${e.gamepad.id}`;
    console.log('Gamepad connected:', e.gamepad);
});

window.addEventListener('gamepaddisconnected', (e) => {
    controllerConnected = false;
    controllerName = 'Controller getrennt';
    lastAction = 'GETRENNT';
    console.log('Gamepad disconnected:', e.gamepad);
});

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
