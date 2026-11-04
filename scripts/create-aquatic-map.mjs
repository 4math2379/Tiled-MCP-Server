// Example map script: builds maps/caverne-aquatique.tmj (AQUATIC theme, 64x64: flooded cavern with a central lake)
// by calling the builder API directly, without an MCP client. It is deterministic:
// re-running it reproduces the committed sample map. Run from the repository root
// after building the server (npm run build):
//   node scripts/create-aquatic-map.mjs
import { createMap, paintRect, paintWallBorder, eraseTile, placeObject, placeSpawn, serializeMap } from '../tiled-mcp/dist/builder.js';
import { getTheme } from '../tiled-mcp/dist/themes/index.js';
import { saveMapFile } from '../tiled-mcp/dist/tmj.js';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const theme = getTheme("AQUATIC");

const { mapId } = createMap({
    name: "Caverne Aquatique Souterraine",
    width: 64,
    height: 64,
    theme: theme,
});

console.log("Map created:", mapId);

// ---------- Helpers ----------
function openWall(x, y) {
    eraseTile(mapId, "walls", x, y);
}

function paintCircleRoom(cx, cy, radius, floorRole = "walkable_floor") {
    for (let y = cy - radius; y <= cy + radius; y++) {
        for (let x = cx - radius; x <= cx + radius; x++) {
            const dx = x - cx;
            const dy = y - cy;
            if (dx * dx + dy * dy <= radius * radius) {
                paintRect(mapId, "ground", x, y, x, y, floorRole);
            }
        }
    }
    paintWallBorder(mapId, cx - radius, cy - radius, cx + radius, cy + radius);
}

function paintLRoom(x1a, y1a, x2a, y2a, x1b, y1b, x2b, y2b, floorRole = "walkable_floor") {
    paintRect(mapId, "ground", x1a, y1a, x2a, y2a, floorRole);
    paintRect(mapId, "ground", x1b, y1b, x2b, y2b, floorRole);
    const xa = Math.min(x1a, x1b), xb = Math.max(x2a, x2b);
    const ya = Math.min(y1a, y1b), yb = Math.max(y2a, y2b);
    paintWallBorder(mapId, xa, ya, xb, yb);
}

// ---------- Central hall (circular, radius 9) ----------
// Main floor: black water (walkable_floor)
paintCircleRoom(32, 32, 9, "walkable_floor");
// Variant: murky water (walkable_floor_alt) as an inner ring for visual relief
for (let y = 27; y <= 37; y++) {
    for (let x = 27; x <= 37; x++) {
        const dx = x - 32;
        const dy = y - 32;
        const d2 = dx * dx + dy * dy;
        if (d2 > 25 && d2 <= 49) { // ring between radius 5 and 7
            paintRect(mapId, "ground", x, y, x, y, "walkable_floor_alt");
        }
    }
}

// Deep water in the centre (hazard_primary, radius 4)
for (let y = 28; y <= 36; y++) {
    for (let x = 28; x <= 36; x++) {
        const dx = x - 32;
        const dy = y - 32;
        if (dx * dx + dy * dy <= 16) {
            paintRect(mapId, "ground", x, y, x, y, "hazard_primary");
        }
    }
}

// Openings toward the 4 main corridors
openWall(32, 23);  // north
openWall(32, 41);  // south
openWall(23, 32);  // west
openWall(41, 32);  // east

// Sunken sarcophagus in the centre (painted on the decorations layer, not an offset object)
paintRect(mapId, "decorations", 32, 32, 32, 32, "obstacle_decor");

// Sarcophagi around the lake (on the decorations layer)
paintRect(mapId, "decorations", 26, 26, 26, 26, "obstacle_decor");
paintRect(mapId, "decorations", 38, 26, 38, 26, "obstacle_decor");
paintRect(mapId, "decorations", 26, 38, 26, 38, "obstacle_decor");
paintRect(mapId, "decorations", 38, 38, 38, 38, "obstacle_decor");

// ---------- Outer rooms (various shapes) ----------

// NORTH: rectangular room, final boss
paintRect(mapId, "ground", 20, 2, 42, 15, "walkable_floor");
paintWallBorder(mapId, 20, 2, 42, 15);
openWall(31, 15);
placeSpawn(mapId, { x: 31, y: 8, role: "enemy", npcName: "Seigneur des Abysses", name: "boss-final" });

// SOUTH: rectangular room, player entrance
paintRect(mapId, "ground", 20, 48, 42, 61, "walkable_floor");
paintWallBorder(mapId, 20, 48, 42, 61);
openWall(31, 48);
placeSpawn(mapId, { x: 31, y: 55, role: "player", name: "player-start" });

// EAST: L-shaped room
paintLRoom(46, 20, 62, 41, 46, 42, 58, 50, "walkable_floor");
paintWallBorder(mapId, 46, 20, 62, 50);
openWall(46, 31);
placeSpawn(mapId, { x: 54, y: 31, role: "enemy", npcName: "Rampant des Eaux", name: "water-creature-east" });

// WEST: L-shaped room
paintLRoom(2, 20, 18, 41, 6, 42, 18, 50, "walkable_floor");
paintWallBorder(mapId, 2, 20, 18, 50);
openWall(18, 31);
placeSpawn(mapId, { x: 10, y: 31, role: "enemy", npcName: "Rampant des Eaux", name: "water-creature-west" });

// NORTH-EAST: circular room (radius 7)
paintCircleRoom(53, 11, 7, "walkable_floor");
paintWallBorder(mapId, 46, 4, 60, 18);
openWall(49, 18);
placeSpawn(mapId, { x: 53, y: 11, role: "enemy", npcName: "Esprit de l'Onde", name: "water-creature-ne" });

// NORTH-WEST: circular room (radius 7)
paintCircleRoom(11, 11, 7, "walkable_floor");
paintWallBorder(mapId, 4, 4, 18, 18);
openWall(14, 18);
placeSpawn(mapId, { x: 11, y: 11, role: "enemy", npcName: "Esprit de l'Onde", name: "water-creature-nw" });

// SOUTH-EAST: T-shaped room
paintRect(mapId, "ground", 46, 44, 62, 52, "walkable_floor");
paintRect(mapId, "ground", 52, 52, 56, 60, "walkable_floor");
paintWallBorder(mapId, 46, 44, 62, 60);
openWall(49, 44);
placeSpawn(mapId, { x: 54, y: 55, role: "enemy", npcName: "Rampant des Eaux", name: "water-creature-se" });

// SOUTH-WEST: T-shaped room
paintRect(mapId, "ground", 2, 44, 18, 52, "walkable_floor");
paintRect(mapId, "ground", 8, 52, 12, 60, "walkable_floor");
paintWallBorder(mapId, 2, 44, 18, 60);
openWall(15, 44);
placeSpawn(mapId, { x: 10, y: 55, role: "enemy", npcName: "Rampant des Eaux", name: "water-creature-sw" });

// ---------- Wide corridors ----------
paintRect(mapId, "ground", 30, 16, 34, 47, "walkable_floor");  // N-S
paintRect(mapId, "ground", 16, 30, 47, 34, "walkable_floor");  // E-W
paintRect(mapId, "ground", 42, 16, 46, 30, "walkable_floor");  // toward NE
paintRect(mapId, "ground", 18, 16, 22, 30, "walkable_floor");  // toward NW
paintRect(mapId, "ground", 42, 34, 46, 48, "walkable_floor");  // toward SE
paintRect(mapId, "ground", 18, 34, 22, 48, "walkable_floor");  // toward SW
paintRect(mapId, "ground", 2, 3, 62, 5, "walkable_floor");     // top
paintRect(mapId, "ground", 2, 58, 62, 60, "walkable_floor");   // bottom
paintRect(mapId, "ground", 2, 3, 4, 60, "walkable_floor");     // left
paintRect(mapId, "ground", 60, 3, 62, 60, "walkable_floor");   // right

// ---------- Hazards ----------
// Ring of deep water around the central lake (radius 4 to 6)
for (let y = 26; y <= 38; y++) {
    for (let x = 26; x <= 38; x++) {
        const dx = x - 32;
        const dy = y - 32;
        const d2 = dx * dx + dy * dy;
        if (d2 > 16 && d2 <= 36) {
            paintRect(mapId, "ground", x, y, x, y, "hazard_primary");
        }
    }
}

// Algae in the corridors (difficult_terrain)
paintRect(mapId, "ground", 30, 16, 34, 24, "difficult_terrain");
paintRect(mapId, "ground", 30, 40, 34, 47, "difficult_terrain");
paintRect(mapId, "ground", 16, 30, 24, 34, "difficult_terrain");
paintRect(mapId, "ground", 40, 30, 47, 34, "difficult_terrain");

// ---------- Doors (painted on the ground for grid alignment) ----------
paintRect(mapId, "ground", 31, 16, 31, 16, "door_closed");
paintRect(mapId, "ground", 31, 47, 31, 47, "door_closed");
paintRect(mapId, "ground", 16, 31, 16, 31, "door_closed");
paintRect(mapId, "ground", 47, 31, 47, 31, "door_closed");

// ---------- Decorations: water lilies (painted on the decorations layer) ----------
// Water lilies in the shallow water around the central lake
const lilyPads = [
    [29, 24], [30, 24], [31, 24], [32, 24], [33, 24], [34, 24], [35, 24],
    [29, 40], [30, 40], [31, 40], [32, 40], [33, 40], [34, 40], [35, 40],
    [24, 29], [24, 30], [24, 31], [24, 32], [24, 33], [24, 34], [24, 35],
    [40, 29], [40, 30], [40, 31], [40, 32], [40, 33], [40, 34], [40, 35],
];
for (const [lx, ly] of lilyPads) {
    paintRect(mapId, "decorations", lx, ly, lx, ly, "decoration_minor");
}

// ---------- Objects: only the chest (interactable) ----------
placeObject(mapId, { x: 32, y: 32, kind: "chest", name: "sarcophage-submerge" });

// ---------- Save the map ----------
const mapData = serializeMap(mapId);
const outPath = fileURLToPath(new URL('../maps/caverne-aquatique.tmj', import.meta.url));
await saveMapFile(mapId, outPath);

console.log("Saved:", outPath);
console.log("Size:", (fs.statSync(outPath).size / 1024).toFixed(2), "KB");
console.log("Spawns:", mapData.layers.find(l => l.name === "spawns").objects.length);
console.log("Objects:", mapData.layers.find(l => l.name === "objects").objects.length);
console.log("Decoration tiles:", mapData.layers.find(l => l.name === "decorations").data.filter(g => g !== 0).length);