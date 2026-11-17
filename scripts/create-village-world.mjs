// Example world script: builds maps/crossroads-village/ (VILLAGE theme, 40x40 outdoor map with six
// buildings you can enter, their interiors and a cellar under the keep) by calling the builder
// API directly, without an MCP client. It is deterministic: re-running it reproduces the
// committed sample world. Run from the repository root after building the server
// (npm run build):
//   node scripts/create-village-world.mjs
// Then open maps/crossroads-village/crossroads-village.tmj in Tiled, or see
// docs/worlds-and-buildings.md for loading it in Godot.
import { createMap, paintRect, paintTile, placeSpawn } from '../tiled-mcp/dist/builder.js';
import { placeBuilding, linkMaps, validateWorld, worldOf } from '../tiled-mcp/dist/world.js';
import { applyRoom } from '../tiled-mcp/dist/tools/procedural.js';
import { getTheme } from '../tiled-mcp/dist/themes/index.js';
import { saveMapFile } from '../tiled-mcp/dist/tmj.js';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const outDir = fileURLToPath(new URL('../maps/crossroads-village/', import.meta.url));
const SIZE = 40;

// ---------- Outdoor map: cobbled ground, two crossing roads, props ----------
const { mapId } = createMap({ name: 'Crossroads village', width: SIZE, height: SIZE, theme: getTheme('VILLAGE') });
paintRect(mapId, 'ground', 0, 0, SIZE - 1, SIZE - 1, 'walkable_floor');
paintRect(mapId, 'ground', 0, 19, SIZE - 1, 20, 'walkable_floor_alt');
paintRect(mapId, 'ground', 19, 0, 20, SIZE - 1, 'walkable_floor_alt');
for (const [x, y] of [[3, 3], [9, 31], [33, 33], [26, 31], [10, 13], [36, 14], [4, 25], [30, 25], [16, 5], [24, 36], [35, 2], [2, 36]]) {
    paintTile(mapId, 'decorations', x, y, 'obstacle_decor');
}
for (const [x, y] of [[17, 17], [22, 17], [17, 22], [22, 22], [12, 28], [28, 11], [6, 18]]) {
    paintTile(mapId, 'decorations', x, y, 'decoration_minor');
}

// ---------- Buildings: each one creates its interior map, linked both ways ----------
placeBuilding(mapId, { type: 'house', x: 13, y: 13, name: 'Miller house' });
placeBuilding(mapId, { type: 'tavern', x: 22, y: 12, name: 'Crossroads tavern' });
placeBuilding(mapId, { type: 'shop', x: 13, y: 22, door: 'east', name: 'Chandler shop' });
placeBuilding(mapId, { type: 'temple', x: 23, y: 23, name: 'Old chapel' });
placeBuilding(mapId, { type: 'tower', x: 6, y: 6, name: 'Watchtower' });
const keep = placeBuilding(mapId, { type: 'castle', x: 28, y: 2, name: 'Greystone keep' });
placeSpawn(mapId, { x: 19, y: 32, role: 'player', name: 'start' });

// ---------- A cellar under the keep, reached by stairs from its great hall ----------
const cellar = createMap({ name: 'Keep cellar', width: 12, height: 10, theme: getTheme('CRYPT') }).mapId;
applyRoom(cellar, 0, 0, 12, 10, [], { obstacleCorners: true });
linkMaps({ mapId: keep.interior.mapId, x: 12, y: 8 }, { mapId: cellar, x: 5, y: 4 }, 'stairs', 'cellar-stairs');

// ---------- Check and save every linked map side by side ----------
const check = validateWorld(mapId);
if (!check.ok || check.warnings.length) {
    console.error('World check failed:', JSON.stringify({ errors: check.errors, warnings: check.warnings }, null, 2));
    process.exit(1);
}
for (const s of worldOf(mapId)) {
    const saved = await saveMapFile(s.id, join(outDir, s.fileName));
    console.log(`Saved ${s.fileName.padEnd(32)} ${String(s.width).padStart(2)}x${s.height}  ${(saved.bytes / 1024).toFixed(1)} KB`);
}
console.log(`Start map: ${check.startMaps.join(', ')}; ${check.links.length} transitions, all linked both ways.`);
