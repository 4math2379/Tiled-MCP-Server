// Example map script: builds maps/reseau-electronique-repaire-hacker.tmj (ELECTRONIQUE theme, 64x64: hacker lair in a digital network)
// by calling the builder API directly, without an MCP client. It is deterministic:
// re-running it reproduces the committed sample map. Run from the repository root
// after building the server (npm run build):
//   node scripts/create-electronic-hacker-map.mjs
import { createMap, paintRect, paintWallBorder, eraseTile, placeObject, placeSpawn, serializeMap } from '../tiled-mcp/dist/builder.js';
import { getTheme } from '../tiled-mcp/dist/themes/index.js';
import { saveMapFile } from '../tiled-mcp/dist/tmj.js';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const theme = getTheme("ELECTRONIQUE");

const { mapId } = createMap({
    name: "Reseau Electronique - Repaire Hacker",
    width: 64,
    height: 64,
    theme: theme,
    orientation: "isometric",
});

console.log("Map created:", mapId);

// ---------- Helpers ----------
function openWall(x, y) {
    eraseTile(mapId, "walls", x, y);
}

// ---------- Ground: the whole map in walkable_floor (outdoor electronic plaza) ----------
for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
        paintRect(mapId, "ground", x, y, x, y, "walkable_floor");
    }
}

// Outer wall
paintWallBorder(mapId, 0, 0, 63, 63);

// ---------- Electronic rune symbol (centre 32,32) ----------
const CX = 32, CY = 32;

// Outer circle of circuit traces (radius 14-16)
for (let y = CY - 16; y <= CY + 16; y++) {
    for (let x = CX - 16; x <= CX + 16; x++) {
        const dx = x - CX;
        const dy = y - CY;
        const d2 = dx * dx + dy * dy;
        if (d2 >= 196 && d2 <= 256) {
            paintRect(mapId, "ground", x, y, x, y, "walkable_floor_alt");
        }
    }
}

// Inner circle of traces (radius 8-10)
for (let y = CY - 10; y <= CY + 10; y++) {
    for (let x = CX - 10; x <= CX + 10; x++) {
        const dx = x - CX;
        const dy = y - CY;
        const d2 = dx * dx + dy * dy;
        if (d2 >= 64 && d2 <= 100) {
            paintRect(mapId, "ground", x, y, x, y, "walkable_floor_alt");
        }
    }
}

// Radial traces linking both circles (8 directions)
for (let i = 0; i < 8; i++) {
    const ang = i * 45;
    const rad = ang * Math.PI / 180;
    for (let r = 11; r <= 13; r++) {
        const x = Math.round(CX + r * Math.cos(rad));
        const y = Math.round(CY + r * Math.sin(rad));
        if (x >= 0 && x < 64 && y >= 0 && y < 64) {
            paintRect(mapId, "ground", x, y, x, y, "walkable_floor_alt");
        }
    }
}

// Circuit nodes on the outer circle (8 points) -> hazard
const nodeAngles = [0, 45, 90, 135, 180, 225, 270, 315];
for (const ang of nodeAngles) {
    const rad = ang * Math.PI / 180;
    const x = Math.round(CX + 15 * Math.cos(rad));
    const y = Math.round(CY + 15 * Math.sin(rad));
    if (x >= 0 && x < 64 && y >= 0 && y < 64) {
        paintRect(mapId, "ground", x, y, x, y, "hazard_primary");
    }
}

// Central core (chip / system core) -> obstacle_decor
paintRect(mapId, "ground", CX, CY, CX, CY, "obstacle_decor");
for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const x = CX + dx;
        const y = CY + dy;
        if (x >= 0 && x < 64 && y >= 0 && y < 64) {
            paintRect(mapId, "ground", x, y, x, y, "difficult_terrain");
        }
    }
}

// Electric shock zones around the nodes (difficult_terrain)
for (const ang of nodeAngles) {
    const rad = ang * Math.PI / 180;
    for (let r = 13; r <= 14; r++) {
        const x = Math.round(CX + r * Math.cos(rad));
        const y = Math.round(CY + r * Math.sin(rad));
        if (x >= 0 && x < 64 && y >= 0 && y < 64) {
            paintRect(mapId, "ground", x, y, x, y, "difficult_terrain");
        }
    }
}

// ---------- Hacker lair building (bottom centre) ----------
const BX1 = 22, BY1 = 44, BX2 = 41, BY2 = 60;

// Building walls
paintWallBorder(mapId, BX1, BY1, BX2, BY2);

// Interior floor
for (let y = BY1 + 1; y <= BY2 - 1; y++) {
    for (let x = BX1 + 1; x <= BX2 - 1; x++) {
        paintRect(mapId, "ground", x, y, x, y, "walkable_floor");
    }
}

// Entrance door (middle of the building's north wall)
openWall(31, BY1);
paintRect(mapId, "ground", 31, BY1, 31, BY1, "door_closed");

// ---------- Hacker equipment inside ----------
// Terminals / screens (obstacle_decor)
paintRect(mapId, "decorations", 26, 48, 26, 48, "obstacle_decor");
paintRect(mapId, "decorations", 27, 48, 27, 48, "obstacle_decor");
paintRect(mapId, "decorations", 36, 48, 36, 48, "obstacle_decor");
paintRect(mapId, "decorations", 37, 48, 37, 48, "obstacle_decor");
paintRect(mapId, "decorations", 26, 54, 26, 54, "obstacle_decor");
paintRect(mapId, "decorations", 37, 54, 37, 54, "obstacle_decor");

// Servers / racks (obstacle_decor, 2x2)
paintRect(mapId, "decorations", 23, 50, 24, 51, "obstacle_decor");
paintRect(mapId, "decorations", 39, 50, 40, 51, "obstacle_decor");

// Cables / floor details (decoration_minor)
for (let i = 0; i < 20; i++) {
    const x = BX1 + 2 + (i * 3) % (BX2 - BX1 - 5);
    const y = BY1 + 2 + Math.floor((i * 3) / (BX2 - BX1 - 5)) * 3;
    if (x < BX2 - 1 && y < BY2 - 1) {
        paintRect(mapId, "decorations", x, y, x, y, "decoration_minor");
    }
}

// ---------- Spawns ----------
// Player in front of the building door
placeSpawn(mapId, { x: 31, y: 42, role: "player", name: "player-start" });

// Hacker enemies inside the building
placeSpawn(mapId, { x: 26, y: 50, role: "enemy", npcName: "Hacker-reseau", name: "hacker-terminal-1" });
placeSpawn(mapId, { x: 37, y: 50, role: "enemy", npcName: "Hacker-reseau", name: "hacker-terminal-2" });
placeSpawn(mapId, { x: 31, y: 56, role: "enemy", npcName: "Hacker-reseau", name: "hacker-central" });
placeSpawn(mapId, { x: 24, y: 55, role: "enemy", npcName: "Securite-numerique", name: "securite-1" });

// Guard enemy near the rune's core
placeSpawn(mapId, { x: 32, y: 20, role: "enemy", npcName: "IA-rogue", name: "ai-core-guardian" });

// ---------- Objects ----------
// Data chest in the building
placeObject(mapId, { x: 30, y: 58, kind: "chest", name: "coffre-donnees-hacker" });

// Stairs (access to the lower level)
paintRect(mapId, "ground", 31, 59, 31, 59, "stairs");

// ---------- Minor decorations around the rune ----------
const runeDecorSpots = [
    [16, 32], [48, 32], [32, 16], [32, 48],
    [22, 22], [42, 22], [22, 42], [42, 42],
];
for (const [ix, iy] of runeDecorSpots) {
    paintRect(mapId, "decorations", ix, iy, ix, iy, "decoration_minor");
}

// ---------- Save the map ----------
const mapData = serializeMap(mapId);
const outPath = fileURLToPath(new URL('../maps/reseau-electronique-repaire-hacker.tmj', import.meta.url));
await saveMapFile(mapId, outPath);

console.log("Saved:", outPath);
console.log("Size:", (fs.statSync(outPath).size / 1024).toFixed(2), "KB");
console.log("Grid:", mapData.width, "x", mapData.height);
console.log("Orientation:", mapData.orientation);
console.log("Theme:", mapData.properties.find(p => p.name === "theme")?.value);
console.log("Spawns:", mapData.layers.find(l => l.name === "spawns").objects.length);
console.log("Objects:", mapData.layers.find(l => l.name === "objects").objects.length);
console.log("Decoration tiles:", mapData.layers.find(l => l.name === "decorations").data.filter(g => g !== 0).length);
