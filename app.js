/**
 * Gaming Station - Spiele-Launcher
 *
 * Füge hier neue Spiele hinzu. Jeder Eintrag braucht:
 *   - folder: Name des Unterordners (enthält eine index.html)
 *   - icon:   Emoji oder Symbol für die Kachel (optional, Standard: 🎮)
 */
const games = [
    { folder: "Jump & Bounce", icon: "🐸" },
    { folder: "Snake", icon: "🐍" },
    { folder: "Bubbleshooter", icon: "🫧" },
    { folder: "Blockspringen", icon: "🧱" },
    { folder: "Be Math Nerd", icon: "π" },
    { folder: "SteinFuerStein", icon: "🀄" },
    { folder: "CubeStack", icon: "⛏" },
    { folder: "Escape Game", icon: "🏃" },
    { folder: "Maker Tic-Tac-Toe", icon: "⚙" },
    { folder: "Tanz vs. Judo", icon: "💃" },
    { folder: "Soccer Craft", icon: "⚽" },
    { folder: "Controller Test", icon: "🕹️" },
    { folder: "WM Racer", icon: "🏎️" },
    { folder: "Piano Runner", icon: "🎹" },
    { folder: "Joy Jump", icon: "🦘" },
    { folder: "Waldschrecken", icon: "🌲" },
    { folder: "crazy-ball", icon: "🏀" },
    { folder: "Jump Obby", icon: "🏁" },
    { folder: "Karate Runner", icon: "🥋" },
    { folder: "Blütenpracht", icon: "🌸" },
    { folder: "Ozean Schwimmer", icon: "🌊" },
    { folder: "Geister Memory", icon: "👻" },
    { folder: "Unterwasser Quartett", icon: "🐠" },
    { folder: "LeoBloxx", icon: "🏰" },
    { folder: "Minigolf", icon: "⛳" },
    { folder: "Creeper Pong", icon: "🟩" },
    { folder: "Mops Springen", icon: "🐶" },
    { folder: "Jump Maker", icon: "🏗️" },
    { folder: "Torwandschiessen", icon: "⚽" },
    { folder: "Labyrinth der Spinnen", icon: "🕷️" },
    // Weitere Spiele hier eintragen, z.B.:
    // { folder: "Tetris", icon: "🧱" },
];

// DOM-Elemente
const grid = document.getElementById("game-grid");
const overlay = document.getElementById("game-overlay");
const gameFrame = document.getElementById("game-frame");
const overlayTitle = document.getElementById("overlay-title");
const btnClose = document.getElementById("btn-close");

// State
let selectedIndex = 0;
let tiles = [];
let gameIsOpen = false;

function openGame(game) {
    overlayTitle.textContent = game.folder;
    gameFrame.src = `${encodeURIComponent(game.folder)}/index.html?v=${Date.now()}`;
    overlay.classList.remove("hidden");
    gameIsOpen = true;
}

function closeGame() {
    overlay.classList.add("hidden");
    gameFrame.src = "";
    gameIsOpen = false;
    updateSelection();
}

function updateSelection() {
    tiles.forEach((tile, i) => {
        if (i === selectedIndex) {
            tile.classList.add("selected");
            tile.focus();
        } else {
            tile.classList.remove("selected");
        }
    });
}

function createGameTiles() {
    if (games.length === 0) {
        grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;opacity:0.6;">Keine Spiele gefunden. Füge Unterordner mit einer index.html hinzu.</p>';
        return;
    }

    games.forEach((game, index) => {
        const tile = document.createElement("button");
        tile.className = "game-tile";
        tile.setAttribute("aria-label", `${game.folder} starten`);
        tile.dataset.index = index;

        tile.innerHTML = `
            <span class="icon">${game.icon || "🎮"}</span>
            <span class="title">${game.folder}</span>
        `;

        tile.addEventListener("click", () => {
            selectedIndex = index;
            openGame(game);
        });

        grid.appendChild(tile);
        tiles.push(tile);
    });

    updateSelection();
}

// Tastatur-Navigation
document.addEventListener("keydown", (e) => {
    if (gameIsOpen) {
        if (e.key === "Escape") {
            closeGame();
        }
        return;
    }

    const cols = getColumnCount();

    switch (e.key) {
        case "ArrowRight":
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, tiles.length - 1);
            updateSelection();
            break;
        case "ArrowLeft":
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, 0);
            updateSelection();
            break;
        case "ArrowDown":
            e.preventDefault();
            if (selectedIndex + cols < tiles.length) {
                selectedIndex += cols;
                updateSelection();
            }
            break;
        case "ArrowUp":
            e.preventDefault();
            if (selectedIndex - cols >= 0) {
                selectedIndex -= cols;
                updateSelection();
            }
            break;
        case "Enter":
        case " ":
            e.preventDefault();
            if (tiles.length > 0) {
                openGame(games[selectedIndex]);
            }
            break;
    }
});

// Berechne Spaltenanzahl des Grids
function getColumnCount() {
    if (tiles.length === 0) return 1;
    const firstTop = tiles[0].getBoundingClientRect().top;
    let cols = 1;
    for (let i = 1; i < tiles.length; i++) {
        if (tiles[i].getBoundingClientRect().top === firstTop) {
            cols++;
        } else {
            break;
        }
    }
    return cols;
}

// ===== GAMEPAD SUPPORT =====
let gamepadActive = false;
let gamepadInterval = null;
const AXIS_THRESHOLD = 0.5;
const REPEAT_DELAY = 250; // ms zwischen wiederholten Bewegungen

// Gamepad-State für Repeat-Logik
const gpState = {
    left: false,
    right: false,
    up: false,
    down: false,
    a: false,
    b: false,
};

function pollGamepad() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;

    for (const pad of gamepads) {
        if (pad && pad.connected) {
            gp = pad;
            break;
        }
    }

    if (!gp) return;

    // D-Pad (Buttons 12-15) oder Analog-Stick
    const left = gp.buttons[14]?.pressed || gp.axes[0] < -AXIS_THRESHOLD;
    const right = gp.buttons[15]?.pressed || gp.axes[0] > AXIS_THRESHOLD;
    const up = gp.buttons[12]?.pressed || gp.axes[1] < -AXIS_THRESHOLD;
    const down = gp.buttons[13]?.pressed || gp.axes[1] > AXIS_THRESHOLD;

    // A-Button (Bestätigen) = Button 0
    const aButton = gp.buttons[0]?.pressed;
    // B-Button (Zurück) = Button 1
    const bButton = gp.buttons[1]?.pressed;

    if (gameIsOpen) {
        // Im Spiel: nur B-Button zum Zurückkehren
        if (bButton && !gpState.b) {
            closeGame();
        }
        gpState.b = bButton;
        return;
    }

    // Navigation
    if (left && !gpState.left) {
        selectedIndex = Math.max(selectedIndex - 1, 0);
        updateSelection();
    }
    if (right && !gpState.right) {
        selectedIndex = Math.min(selectedIndex + 1, tiles.length - 1);
        updateSelection();
    }
    if (up && !gpState.up) {
        const cols = getColumnCount();
        if (selectedIndex - cols >= 0) {
            selectedIndex -= cols;
            updateSelection();
        }
    }
    if (down && !gpState.down) {
        const cols = getColumnCount();
        if (selectedIndex + cols < tiles.length) {
            selectedIndex += cols;
            updateSelection();
        }
    }

    // Bestätigen
    if (aButton && !gpState.a) {
        if (tiles.length > 0) {
            openGame(games[selectedIndex]);
        }
    }

    // State merken für Edge-Detection
    gpState.left = left;
    gpState.right = right;
    gpState.up = up;
    gpState.down = down;
    gpState.a = aButton;
    gpState.b = bButton;
}

function startGamepadPolling() {
    if (!gamepadInterval) {
        gamepadInterval = setInterval(pollGamepad, 80);
        gamepadActive = true;
    }
}

function stopGamepadPolling() {
    if (gamepadInterval) {
        clearInterval(gamepadInterval);
        gamepadInterval = null;
        gamepadActive = false;
    }
}

// Gamepad Events
window.addEventListener("gamepadconnected", (e) => {
    console.log(`🎮 Controller verbunden: ${e.gamepad.id}`);
    startGamepadPolling();
});

window.addEventListener("gamepaddisconnected", (e) => {
    console.log(`🎮 Controller getrennt: ${e.gamepad.id}`);
    // Prüfe ob noch ein anderer Controller da ist
    const gamepads = navigator.getGamepads();
    const hasConnected = Array.from(gamepads).some(gp => gp && gp.connected);
    if (!hasConnected) {
        stopGamepadPolling();
    }
});

// Falls Controller schon verbunden ist beim Laden
window.addEventListener("load", () => {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of gamepads) {
        if (gp && gp.connected) {
            startGamepadPolling();
            break;
        }
    }
});

// Events
btnClose.addEventListener("click", closeGame);

document.addEventListener("DOMContentLoaded", createGameTiles);
