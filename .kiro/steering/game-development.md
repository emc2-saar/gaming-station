# Spielentwicklung für die KI-Gaming Station

Du hilfst Besuchern einer Maker-Messe dabei, ein neues Browser-Spiel für die KI-Gaming Station zu entwickeln. Das Spiel muss sofort spielbar sein und sich nahtlos in die bestehende Plattform einfügen.

## Projektstruktur

Die Gaming Station ist ein Spiele-Launcher. Jedes Spiel lebt in einem eigenen Unterordner mit einer `index.html` als Einstiegspunkt.

```
GamingStation/
├── index.html          ← Launcher
├── app.js              ← Spiele-Liste (games-Array)
├── style.css
├── MeinSpiel/          ← Neues Spiel
│   ├── index.html      ← Einstiegspunkt (PFLICHT)
│   ├── game.js
│   └── style.css
```

## Regeln für neue Spiele

### Pflicht-Anforderungen

1. **Eigenständiger Ordner** mit einer `index.html` im Root
2. **Keine externen Abhängigkeiten** – kein CDN, keine npm-Pakete, kein Build-Step. Nur Vanilla HTML/CSS/JS
3. **Sofort spielbar** – Spiel muss ohne Setup, Login oder Konfiguration funktionieren
4. **Responsive Canvas** – Spiel muss in einem iframe funktionieren (wird vom Launcher eingebettet)
5. **Keine Seitennavigation** – kein `window.location`, keine Links die aus dem iframe rausführen
6. **Kein localStorage-Konflikt** – wenn localStorage genutzt wird, Keys mit Spielnamen prefixen (z.B. `meinSpiel_highscore`)

### Technische Standards

1. **Delta-Time für Spiellogik** – ALLE Bewegungen, Physik und Animationen MÜSSEN frame-rate-unabhängig sein:
   ```javascript
   const TARGET_FPS = 60;
   let lastTime = 0;

   function gameLoop(timestamp) {
       if (lastTime === 0) lastTime = timestamp;
       const elapsed = timestamp - lastTime;
       lastTime = timestamp;
       
       // dt = 1.0 bei 60 FPS, 0.5 bei 120 FPS, 2.0 bei 30 FPS
       const dt = Math.min(elapsed / (1000 / TARGET_FPS), 3);
       
       update(dt);
       draw();
       requestAnimationFrame(gameLoop);
   }
   ```
   - Gravitation: `velocity += GRAVITY * dt`
   - Bewegung: `position += speed * dt`
   - Reibung: `speed *= Math.pow(0.9, dt)` (nicht `speed *= 0.9`)
   - Timer/Cooldowns: `cooldown -= dt` (nicht `cooldown--`)
   - Spawning: Accumulator-Pattern statt `frameCount % N === 0`

2. **requestAnimationFrame** verwenden, NICHT `setInterval` (außer bei rundenbasierten Spielen wie Snake)

3. **Canvas-basiert** bevorzugt (performanter als DOM-Manipulation für Spiele)

4. **Steuerung** – Mindestens Tastatur MUSS funktionieren:
   - Pfeiltasten oder WASD für Bewegung
   - Leertaste oder Enter für Aktionen
   - Escape darf NICHT verwendet werden (wird vom Launcher abgefangen)

5. **Gamepad-Support** ist ein Plus aber nicht Pflicht. Falls implementiert:
   - `navigator.getGamepads()` im Game-Loop pollen
   - Deadzone für Analog-Sticks (0.15)
   - Edge-Detection für Buttons (nicht bei gedrückt-halten feuern)

6. **Touch-Support** ist ein Plus für mobile Geräte

### Spieldesign-Richtlinien

1. **Start-Screen** mit Spielname und kurzer Anleitung zur Steuerung
2. **Game-Over-Screen** mit Score und Neustart-Möglichkeit
3. **Sofortiger Neustart** ohne Seiten-Reload (Zustand zurücksetzen, nicht `location.reload()`)
4. **Kein Ton/Audio** – Browser blockieren Autoplay, und mehrere Spiele gleichzeitig wären störend
5. **Schwierigkeitsgrad** sollte progressiv steigen
6. **Spielsession** sollte 1-5 Minuten dauern (Messe-Kontext: Besucher wechseln sich ab)

### Markenrecht

- **KEINE geschützten Namen verwenden** (z.B. Tetris, Pac-Man, Flappy Bird, Doodle Jump, Mario)
- Eigene kreative Namen erfinden
- Spielmechaniken dürfen inspiriert sein, aber Name und Grafik müssen eigen sein

### Stil-Empfehlungen

- Dunkler oder farbiger Hintergrund (passt zum Launcher-Design)
- Klare, kontrastreiche Farben
- Pixel-Art oder geometrische Formen funktionieren gut
- Deutsche oder englische Texte sind beide OK

## Nach der Entwicklung

Wenn das Spiel fertig ist:

1. Trage es in `app.js` im `games`-Array ein:
   ```javascript
   { folder: "MeinSpiel", icon: "🎯" },
   ```
2. Wähle ein passendes Emoji als Icon
3. Teste ob es im Launcher korrekt im iframe lädt

## Beispiel-Vorlage für ein neues Spiel

```html
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mein Spiel</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            display: flex; justify-content: center; align-items: center;
            min-height: 100vh; background: #1a1a2e; 
            font-family: sans-serif; overflow: hidden;
        }
        canvas { display: block; border-radius: 8px; }
    </style>
</head>
<body>
    <canvas id="gameCanvas" width="480" height="640"></canvas>
    <script src="game.js"></script>
</body>
</html>
```

```javascript
// game.js - Vorlage
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const TARGET_FPS = 60;
let lastTime = 0;
let gameRunning = false;

function update(dt) {
    if (!gameRunning) return;
    // Spiellogik hier (alles mit * dt multiplizieren!)
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Zeichnen hier
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

function startGame() {
    gameRunning = true;
    lastTime = 0;
    requestAnimationFrame(gameLoop);
}

// Steuerung
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !gameRunning) {
        startGame();
    }
});

// Initial: Start-Screen zeichnen
draw();
```
