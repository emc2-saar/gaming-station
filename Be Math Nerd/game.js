const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const TARGET_FPS = 60;
let lastTime = 0;

// Spielzustände
const STATE_INPUT = 'input';
const STATE_SCROLLING = 'scrolling';
const STATE_FOUND = 'found';
const STATE_NOT_FOUND = 'notfound';

let state = STATE_INPUT;
let inputDate = '';
let cursorBlink = 0;
let foundPosition = -1;

// Scroll-Animation
let scrollOffset = 0;
let scrollStartTime = 0;
const SCROLL_DURATION = 20; // Immer 20 Sekunden (in dt-Einheiten = 20 * 60 = 1200 frames bei 60fps)
const SCROLL_DURATION_DT = 20 * TARGET_FPS; // 1200 dt-Einheiten
let scrollElapsed = 0;
let targetScrollPos = 0;

// Anzeige-Parameter
const DIGIT_WIDTH = 18;
const DIGIT_HEIGHT = 32;
const VISIBLE_DIGITS = Math.floor(800 / DIGIT_WIDTH);
const PI_LINE_Y = 300;

// Partikel für den Feier-Effekt
let particles = [];

function findDateInPi(dateStr) {
    return PI_DIGITS.indexOf(dateStr);
}

function startSearch() {
    // Verschiedene Formate probieren
    const formats = [];
    
    if (inputDate.length === 8) {
        // TTMMJJJJ -> verschiedene Formate
        const day = inputDate.substring(0, 2);
        const month = inputDate.substring(2, 4);
        const year = inputDate.substring(4, 8);
        const shortYear = inputDate.substring(6, 8);
        
        formats.push(inputDate);              // TTMMJJJJ
        formats.push(day + month + shortYear); // TTMMJJ
        formats.push(day + month);             // TTMM
        formats.push(month + day + year);      // MMTTJJJJ (US-Format)
        formats.push(month + day + shortYear); // MMTTJJ
        formats.push(month + day);             // MMTT
    } else if (inputDate.length === 6) {
        formats.push(inputDate);
        const day = inputDate.substring(0, 2);
        const month = inputDate.substring(2, 4);
        formats.push(day + month);
    } else if (inputDate.length === 4) {
        formats.push(inputDate);
    } else {
        formats.push(inputDate);
    }
    
    // Erstes gefundenes Format verwenden
    for (const fmt of formats) {
        const pos = findDateInPi(fmt);
        if (pos !== -1) {
            foundPosition = pos;
            state = STATE_SCROLLING;
            scrollOffset = 0;
            scrollElapsed = 0;
            // Zielposition: Datum soll in der Mitte des Bildschirms sein
            targetScrollPos = (foundPosition - Math.floor(VISIBLE_DIGITS / 2) + fmt.length / 2) * DIGIT_WIDTH;
            return;
        }
    }
    
    // Nicht gefunden
    state = STATE_NOT_FOUND;
}

function update(dt) {
    cursorBlink += dt;
    
    if (state === STATE_SCROLLING) {
        scrollElapsed += dt;
        
        // Fortschritt von 0 bis 1 über SCROLL_DURATION_DT
        const t = Math.min(scrollElapsed / SCROLL_DURATION_DT, 1);
        
        // Easing: langsam starten, schnell in der Mitte, langsam am Ende
        // Verwendung einer Ease-In-Out-Kurve (Sinusoidal)
        const eased = t < 0.5
            ? (1 - Math.cos(t * Math.PI)) / 2   // erste Hälfte: beschleunigen
            : (1 - Math.cos(t * Math.PI)) / 2;  // zweite Hälfte: abbremsen
        
        // Alternativ: stärkere Kurve mit smootherstep für dramatischeren Effekt
        // smootherstep: 6t^5 - 15t^4 + 10t^3
        const smooth = t * t * t * (t * (t * 6 - 15) + 10);
        
        scrollOffset = smooth * targetScrollPos;
        
        if (t >= 1) {
            scrollOffset = targetScrollPos;
            state = STATE_FOUND;
            createParticles();
        }
    }
    
    // Partikel updaten
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 0.3 * dt;
        p.life -= dt;
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

function createParticles() {
    for (let i = 0; i < 80; i++) {
        particles.push({
            x: canvas.width / 2 + (Math.random() - 0.5) * 200,
            y: PI_LINE_Y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 1) * 6,
            life: 60 + Math.random() * 60,
            color: `hsl(${Math.random() * 360}, 80%, 60%)`,
            size: 2 + Math.random() * 4
        });
    }
}

function draw() {
    // Hintergrund
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Sterne im Hintergrund
    drawStars();
    
    if (state === STATE_INPUT) {
        drawInputScreen();
    } else if (state === STATE_SCROLLING || state === STATE_FOUND) {
        drawPiScroll();
    } else if (state === STATE_NOT_FOUND) {
        drawNotFound();
    }
    
    // Partikel zeichnen
    for (const p of particles) {
        ctx.globalAlpha = Math.min(p.life / 30, 1);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

let stars = [];
function drawStars() {
    if (stars.length === 0) {
        for (let i = 0; i < 100; i++) {
            stars.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                size: Math.random() * 2,
                brightness: Math.random()
            });
        }
    }
    for (const s of stars) {
        const alpha = 0.3 + Math.sin(cursorBlink * 0.02 + s.brightness * 10) * 0.2;
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawInputScreen() {
    // Titel
    ctx.fillStyle = '#e0e0ff';
    ctx.font = 'bold 36px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('Be Math Nerd', canvas.width / 2, 100);
    
    // Pi-Symbol groß
    ctx.font = 'bold 80px serif';
    ctx.fillStyle = '#6366f1';
    ctx.fillText('π', canvas.width / 2, 200);
    
    // Beschreibung
    ctx.font = '16px Courier New';
    ctx.fillStyle = '#a0a0c0';
    ctx.fillText('Finde dein Geburtsdatum in den', canvas.width / 2, 270);
    ctx.fillText('Nachkommastellen von Pi!', canvas.width / 2, 295);
    
    // Eingabefeld
    const boxWidth = 300;
    const boxHeight = 50;
    const boxX = (canvas.width - boxWidth) / 2;
    const boxY = 340;
    
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
    ctx.fillStyle = '#1a1a3e';
    ctx.fillRect(boxX + 1, boxY + 1, boxWidth - 2, boxHeight - 2);
    
    // Eingabetext
    ctx.font = 'bold 28px Courier New';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    
    let displayText = inputDate;
    // Cursor blinken
    if (Math.floor(cursorBlink / 30) % 2 === 0) {
        displayText += '|';
    }
    if (inputDate.length === 0) {
        ctx.fillStyle = '#606080';
        ctx.fillText('TTMMJJJJ', canvas.width / 2, boxY + 35);
    } else {
        ctx.fillText(displayText, canvas.width / 2, boxY + 35);
    }
    
    // Format-Hinweis
    ctx.font = '14px Courier New';
    ctx.fillStyle = '#808090';
    ctx.fillText('Format: TTMMJJJJ (z.B. 25121990)', canvas.width / 2, boxY + 75);
    
    // Enter-Hinweis
    if (inputDate.length >= 4) {
        ctx.font = 'bold 18px Courier New';
        ctx.fillStyle = '#6366f1';
        ctx.fillText('⏎ Enter zum Suchen', canvas.width / 2, boxY + 120);
    }
    
    // Info unten
    ctx.font = '12px Courier New';
    ctx.fillStyle = '#505070';
    ctx.fillText('Durchsucht 1.000.000 Nachkommastellen von π', canvas.width / 2, 560);
}

function drawPiScroll() {
    // Überschrift
    ctx.fillStyle = '#e0e0ff';
    ctx.font = 'bold 20px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('3,', canvas.width / 2, 50);
    
    // Pi-Ziffern scrollen
    const startDigitIndex = Math.floor(scrollOffset / DIGIT_WIDTH);
    const pixelOffset = scrollOffset % DIGIT_WIDTH;
    
    // Bestimme welche Ziffern zum Datum gehören
    const searchStr = getSearchString();
    const matchStart = foundPosition;
    const matchEnd = foundPosition + searchStr.length;
    
    for (let i = 0; i < VISIBLE_DIGITS + 2; i++) {
        const digitIndex = startDigitIndex + i;
        if (digitIndex < 0 || digitIndex >= PI_DIGITS.length) continue;
        
        const x = i * DIGIT_WIDTH - pixelOffset;
        const y = PI_LINE_Y;
        
        // Highlight wenn Teil des Datums
        const isMatch = digitIndex >= matchStart && digitIndex < matchEnd;
        
        if (isMatch && state === STATE_FOUND) {
            // Highlight-Hintergrund
            ctx.fillStyle = '#6366f1';
            ctx.fillRect(x - 2, y - DIGIT_HEIGHT + 5, DIGIT_WIDTH, DIGIT_HEIGHT + 4);
            ctx.fillStyle = '#ffffff';
        } else if (isMatch && state === STATE_SCROLLING) {
            ctx.fillStyle = '#fbbf24';
        } else {
            // Farbe basierend auf Entfernung zur Mitte
            const distFromCenter = Math.abs(x - canvas.width / 2);
            const alpha = Math.max(0.3, 1 - distFromCenter / (canvas.width / 2));
            ctx.fillStyle = `rgba(200, 200, 255, ${alpha})`;
        }
        
        ctx.font = 'bold 24px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText(PI_DIGITS[digitIndex], x + DIGIT_WIDTH / 2, y);
    }
    
    // Positions-Anzeige
    ctx.font = '14px Courier New';
    ctx.fillStyle = '#808090';
    ctx.textAlign = 'center';
    ctx.fillText(`Stelle: ${startDigitIndex + Math.floor(VISIBLE_DIGITS / 2)}`, canvas.width / 2, PI_LINE_Y + 50);
    
    // Scan-Linie in der Mitte
    ctx.strokeStyle = state === STATE_FOUND ? '#6366f1' : '#fbbf2480';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, PI_LINE_Y - 40);
    ctx.lineTo(canvas.width / 2, PI_LINE_Y + 10);
    ctx.stroke();
    ctx.setLineDash([]);
    
    if (state === STATE_FOUND) {
        drawFoundMessage();
    } else {
        // Suche-Animation
        ctx.font = '16px Courier New';
        ctx.fillStyle = '#fbbf24';
        ctx.textAlign = 'center';
        const dots = '.'.repeat(Math.floor(cursorBlink / 20) % 4);
        ctx.fillText(`Suche ${inputDate}${dots}`, canvas.width / 2, 150);
    }
}

function drawFoundMessage() {
    const searchStr = getSearchString();
    
    // Erfolgs-Nachricht
    ctx.font = 'bold 28px Courier New';
    ctx.fillStyle = '#4ade80';
    ctx.textAlign = 'center';
    ctx.fillText('🎉 Gefunden! 🎉', canvas.width / 2, 130);
    
    ctx.font = '18px Courier New';
    ctx.fillStyle = '#e0e0ff';
    ctx.fillText(`"${searchStr}" beginnt an Stelle`, canvas.width / 2, 180);
    
    ctx.font = 'bold 36px Courier New';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(`${foundPosition + 1}`, canvas.width / 2, 230);
    
    ctx.font = '14px Courier New';
    ctx.fillStyle = '#808090';
    ctx.fillText('von 1.000.000 Nachkommastellen', canvas.width / 2, 260);
    
    // Neustart-Hinweis
    ctx.font = '16px Courier New';
    ctx.fillStyle = '#6366f1';
    ctx.fillText('Leertaste für neues Datum', canvas.width / 2, 520);
}

function drawNotFound() {
    ctx.font = 'bold 28px Courier New';
    ctx.fillStyle = '#ef4444';
    ctx.textAlign = 'center';
    ctx.fillText('Nicht gefunden 😢', canvas.width / 2, 200);
    
    ctx.font = '16px Courier New';
    ctx.fillStyle = '#a0a0c0';
    ctx.fillText(`"${inputDate}" kommt in den ersten`, canvas.width / 2, 260);
    ctx.fillText('1.000.000 Stellen von π nicht vor.', canvas.width / 2, 290);
    
    ctx.font = '14px Courier New';
    ctx.fillStyle = '#808090';
    ctx.fillText('Tipp: Versuche ein kürzeres Format (TTMM)', canvas.width / 2, 340);
    
    ctx.font = '16px Courier New';
    ctx.fillStyle = '#6366f1';
    ctx.fillText('Leertaste für neues Datum', canvas.width / 2, 420);
}

function getSearchString() {
    // Gleiche Logik wie in startSearch – finde das Format das matched
    const formats = [];
    
    if (inputDate.length === 8) {
        const day = inputDate.substring(0, 2);
        const month = inputDate.substring(2, 4);
        const year = inputDate.substring(4, 8);
        const shortYear = inputDate.substring(6, 8);
        
        formats.push(inputDate);
        formats.push(day + month + shortYear);
        formats.push(day + month);
        formats.push(month + day + year);
        formats.push(month + day + shortYear);
        formats.push(month + day);
    } else if (inputDate.length === 6) {
        formats.push(inputDate);
        const day = inputDate.substring(0, 2);
        const month = inputDate.substring(2, 4);
        formats.push(day + month);
    } else {
        formats.push(inputDate);
    }
    
    for (const fmt of formats) {
        if (PI_DIGITS.indexOf(fmt) === foundPosition) {
            return fmt;
        }
    }
    return inputDate;
}

function resetGame() {
    state = STATE_INPUT;
    inputDate = '';
    foundPosition = -1;
    scrollOffset = 0;
    scrollElapsed = 0;
    targetScrollPos = 0;
    particles = [];
    cursorBlink = 0;
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

// Tastatur-Eingabe
document.addEventListener('keydown', (e) => {
    if (state === STATE_INPUT) {
        if (e.key >= '0' && e.key <= '9' && inputDate.length < 8) {
            inputDate += e.key;
            cursorBlink = 0;
        } else if (e.key === 'Backspace') {
            inputDate = inputDate.slice(0, -1);
            cursorBlink = 0;
        } else if (e.key === 'Enter' && inputDate.length >= 4) {
            e.preventDefault();
            startSearch();
        }
    } else if (state === STATE_FOUND || state === STATE_NOT_FOUND) {
        if (e.code === 'Space') {
            e.preventDefault();
            resetGame();
        }
    }
});

// Touch-Support für Mobilgeräte
canvas.addEventListener('click', () => {
    if (state === STATE_FOUND || state === STATE_NOT_FOUND) {
        resetGame();
    }
});

// Start
requestAnimationFrame(gameLoop);
