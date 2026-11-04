// Example map script: builds maps/forteresse-glace-etage.tmj (GLACIAIRE theme, 64x64: ice fortress with a circular central hall)
// by calling the builder API directly, without an MCP client. It is deterministic:
// re-running it reproduces the committed sample map. Run from the repository root
// after building the server (npm run build):
//   node scripts/create-glacier-map.mjs
import { createMap, paintRect, paintWallBorder, eraseTile, placeObject, placeSpawn, serializeMap } from '../tiled-mcp/dist/builder.js';
import { getTheme } from '../tiled-mcp/dist/themes/index.js';
import { saveMapFile } from '../tiled-mcp/dist/tmj.js';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const theme = getTheme("GLACIAIRE");

const { mapId } = createMap({
    name: "Forteresse de Glace - Donjon Principal v4",
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

function paintTRoom(x1, y1, x2, y2, tx1, ty1, tx2, ty2, floorRole = "walkable_floor") {
    paintRect(mapId, "ground", x1, y1, x2, y2, floorRole);
    paintRect(mapId, "ground", tx1, ty1, tx2, ty2, floorRole);
    const xa = Math.min(x1, tx1), xb = Math.max(x2, tx2);
    const ya = Math.min(y1, ty1), yb = Math.max(y2, ty2);
    paintWallBorder(mapId, xa, ya, xb, yb);
}

// ---------- Central hall (circular, radius 10) ----------
paintCircleRoom(32, 32, 10, "walkable_floor");

// Detailed ice ring around the centre (radius 6 to 8)
for (let y = 24; y <= 40; y++) {
    for (let x = 24; x <= 40; x++) {
        const dx = x - 32;
        const dy = y - 32;
        const d2 = dx * dx + dy * dy;
        if (d2 > 36 && d2 <= 64) {
            paintRect(mapId, "ground", x, y, x, y, "walkable_floor_alt");
        }
    }
}

// Frozen lake in the centre (hazard_primary, radius 5)
for (let y = 27; y <= 37; y++) {
    for (let x = 27; x <= 37; x++) {
        const dx = x - 32;
        const dy = y - 32;
        if (dx * dx + dy * dy <= 25) {
            paintRect(mapId, "ground", x, y, x, y, "hazard_primary");
        }
    }
}

// Ice bridges across the central lake (4 cardinal bridges)
// Vertical north-south bridge
for (let y = 27; y <= 37; y++) {
    paintRect(mapId, "ground", 32, y, 32, y, "walkable_floor_alt");
}
// Horizontal east-west bridge
for (let x = 27; x <= 37; x++) {
    paintRect(mapId, "ground", x, 32, x, 32, "walkable_floor_alt");
}

// Openings toward the 4 main corridors
openWall(32, 22);  // north
openWall(32, 42);  // south
openWall(22, 32);  // west
openWall(42, 32);  // east

// Chest on the central lake
placeObject(mapId, { x: 32, y: 32, kind: "chest", name: "coffre-sur-le-lac" });

// Frozen fountain north of the centre
paintRect(mapId, "decorations", 32, 23, 32, 23, "obstacle_decor");
paintRect(mapId, "decorations", 31, 23, 31, 23, "decoration_minor");
paintRect(mapId, "decorations", 33, 23, 33, 23, "decoration_minor");

// Frozen fountain south of the centre
paintRect(mapId, "decorations", 32, 41, 32, 41, "obstacle_decor");
paintRect(mapId, "decorations", 31, 41, 31, 41, "decoration_minor");
paintRect(mapId, "decorations", 33, 41, 33, 41, "decoration_minor");

// ---------- Outer rooms (various shapes) ----------

// NORTH: rectangular room, final boss
paintRect(mapId, "ground", 15, 2, 48, 16, "walkable_floor");
paintWallBorder(mapId, 15, 2, 48, 16);
openWall(31, 16);
placeSpawn(mapId, { x: 31, y: 6, role: "enemy", npcName: "Seigneur des Glaces", name: "boss-final" });
// Boss throne
paintRect(mapId, "decorations", 31, 4, 31, 4, "obstacle_decor");

// SOUTH: rectangular room, player entrance
paintRect(mapId, "ground", 15, 47, 48, 61, "walkable_floor");
paintWallBorder(mapId, 15, 47, 48, 61);
openWall(31, 47);
placeSpawn(mapId, { x: 31, y: 54, role: "player", name: "player-start" });

// EAST: L-shaped room
paintLRoom(47, 18, 62, 40, 47, 41, 58, 46, "walkable_floor");
paintWallBorder(mapId, 47, 18, 62, 46);
openWall(47, 31);
placeSpawn(mapId, { x: 54, y: 31, role: "enemy", npcName: "Givre-Rôdeur", name: "ice-creature-east" });
paintRect(mapId, "decorations", 58, 31, 58, 31, "obstacle_decor");

// WEST: L-shaped room
paintLRoom(2, 18, 17, 40, 6, 41, 17, 46, "walkable_floor");
paintWallBorder(mapId, 2, 18, 17, 46);
openWall(17, 31);
placeSpawn(mapId, { x: 10, y: 31, role: "enemy", npcName: "Givre-Rôdeur", name: "ice-creature-west" });
paintRect(mapId, "decorations", 6, 31, 6, 31, "obstacle_decor");

// NORTH-EAST: circular room (radius 8)
paintCircleRoom(54, 10, 8, "walkable_floor");
paintWallBorder(mapId, 46, 2, 62, 18);
openWall(49, 18);
placeSpawn(mapId, { x: 54, y: 10, role: "enemy", npcName: "Esprit de Glace", name: "ice-creature-ne" });
placeObject(mapId, { x: 54, y: 6, kind: "chest", name: "coffre-ne" });

// NORTH-WEST: circular room (radius 8)
paintCircleRoom(10, 10, 8, "walkable_floor");
paintWallBorder(mapId, 2, 2, 18, 18);
openWall(14, 18);
placeSpawn(mapId, { x: 10, y: 10, role: "enemy", npcName: "Esprit de Glace", name: "ice-creature-nw" });

// SOUTH-EAST: T-shaped room
paintTRoom(47, 44, 62, 53, 52, 53, 56, 61, "walkable_floor");
paintWallBorder(mapId, 47, 44, 62, 61);
openWall(49, 44);
placeSpawn(mapId, { x: 54, y: 56, role: "enemy", npcName: "Givre-Rôdeur", name: "ice-creature-se" });

// SOUTH-WEST: T-shaped room
paintTRoom(2, 44, 17, 53, 8, 53, 12, 61, "walkable_floor");
paintWallBorder(mapId, 2, 44, 17, 61);
openWall(15, 44);
placeSpawn(mapId, { x: 10, y: 56, role: "enemy", npcName: "Givre-Rôdeur", name: "ice-creature-sw" });

// ---------- Outer ring (belt corridor linking the rooms) ----------
paintRect(mapId, "ground", 2, 17, 62, 20, "walkable_floor");   // top
paintRect(mapId, "ground", 2, 43, 62, 46, "walkable_floor");   // bottom
paintRect(mapId, "ground", 2, 17, 5, 46, "walkable_floor");    // left
paintRect(mapId, "ground", 58, 17, 62, 46, "walkable_floor");  // right

// Openings from the ring toward the outer rooms
openWall(31, 17);   // toward north
openWall(31, 46);   // toward south
openWall(5, 31);    // toward west
openWall(58, 31);   // toward east

// ---------- Wide corridors toward the centre ----------
paintRect(mapId, "ground", 29, 17, 35, 22, "walkable_floor");  // N-S toward centre
paintRect(mapId, "ground", 29, 42, 35, 46, "walkable_floor");  // S-N toward centre
paintRect(mapId, "ground", 17, 29, 22, 35, "walkable_floor");  // E-W toward centre
paintRect(mapId, "ground", 42, 29, 46, 35, "walkable_floor");  // W-E toward centre

// ---------- Hazards ----------
// Ring of thin ice around the central lake (radius 5 to 7)
for (let y = 25; y <= 39; y++) {
    for (let x = 25; x <= 39; x++) {
        const dx = x - 32;
        const dy = y - 32;
        const d2 = dx * dx + dy * dy;
        if (d2 > 25 && d2 <= 49) {
            paintRect(mapId, "ground", x, y, x, y, "hazard_primary");
        }
    }
}

// Black-ice patches in the corridors (difficult_terrain)
paintRect(mapId, "ground", 29, 17, 35, 21, "difficult_terrain");
paintRect(mapId, "ground", 29, 43, 35, 46, "difficult_terrain");
paintRect(mapId, "ground", 17, 29, 21, 35, "difficult_terrain");
paintRect(mapId, "ground", 43, 29, 46, 35, "difficult_terrain");

// ---------- Doors ----------
paintRect(mapId, "ground", 31, 17, 31, 17, "door_closed");
paintRect(mapId, "ground", 31, 46, 31, 46, "door_closed");
paintRect(mapId, "ground", 17, 31, 17, 31, "door_closed");
paintRect(mapId, "ground", 46, 31, 46, 31, "door_closed");

// ---------- Minor decorations: icicles ----------
const icicleSpots = [
    [20, 10], [21, 10], [22, 10],
    [42, 10], [43, 10], [44, 10],
    [20, 53], [21, 53], [22, 53],
    [42, 53], [43, 53], [44, 53],
    [10, 20], [10, 21], [10, 22],
    [53, 20], [53, 21], [53, 22],
    [30, 8], [31, 8], [32, 8], [33, 8], [34, 8],
    [30, 55], [31, 55], [32, 55], [33, 55], [34, 55],
    [8, 30], [8, 31], [8, 32],
    [55, 30], [55, 31], [55, 32],
    [14, 6], [15, 6], [16, 6],
    [47, 6], [48, 6], [49, 6],
    [14, 57], [15, 57], [16, 57],
    [47, 57], [48, 57], [49, 57],
];
for (const [ix, iy] of icicleSpots) {
    paintRect(mapId, "decorations", ix, iy, ix, iy, "decoration_minor");
}

// Ice sculptures in the outer rooms
paintRect(mapId, "decorations", 31, 8, 31, 8, "obstacle_decor");   // north
paintRect(mapId, "decorations", 31, 55, 31, 55, "obstacle_decor"); // south
paintRect(mapId, "decorations", 8, 31, 8, 31, "obstacle_decor");   // west
paintRect(mapId, "decorations", 55, 31, 55, 31, "obstacle_decor"); // east

// ---------- Stairs between floors ----------
paintRect(mapId, "ground", 32, 6, 32, 6, "stairs");
paintRect(mapId, "ground", 32, 57, 32, 57, "stairs");

// ---------- Lever (mechanism) ----------
placeObject(mapId, { x: 40, y: 32, kind: "lever", name: "levier-pont-levis" });

// ---------- Save the map ----------
const mapData = serializeMap(mapId);
const outPath = fileURLToPath(new URL('../maps/forteresse-glace-etage.tmj', import.meta.url));
await saveMapFile(mapId, outPath);

console.log("Saved:", outPath);
console.log("Size:", (fs.statSync(outPath).size / 1024).toFixed(2), "KB");
console.log("Grid:", mapData.width, "x", mapData.height);
console.log("Spawns:", mapData.layers.find(l => l.name === "spawns").objects.length);
console.log("Objects:", mapData.layers.find(l => l.name === "objects").objects.length);
console.log("Decoration tiles:", mapData.layers.find(l => l.name === "decorations").data.filter(g => g !== 0).length);
