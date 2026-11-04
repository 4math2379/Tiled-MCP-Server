import type { Theme } from "../types.js";

// Sprite paths are "./assets/<theme_lowercase>/<role>.png", relative to the repository root
// (or TILED_ASSETS_DIR). save_to_disk rewrites them relative to the saved .tmj file.
const FT = "./assets/futuriste";

export const FUTURISTE: Theme = {
  key: "FUTURISTE",
  name: "Cite Futuriste",
  description:
    "Métal chromé, néons froids, panneaux holographiques, gratte-ciel en ruine. Megalopole dystopique, laboratoires secrets, cités volantes.",
  tilesetName: "futuriste-tileset",
  tilewidth: 64,
  tileheight: 32,
  tiles: [
    { role: "walkable_floor", tileType: "WALKABLE", spriteId: "futuriste.plasteel_plate", imageFile: `${FT}/walkable_floor.png` },
    { role: "walkable_floor_alt", tileType: "WALKABLE", spriteId: "futuriste.circuit_floor", imageFile: `${FT}/walkable_floor_alt.png` },
    { role: "wall", tileType: "WALL", spriteId: "futuriste.chrome_panel", imageFile: `${FT}/wall.png`, imageWidth: 64, imageHeight: 64 },
    { role: "wall_corner", tileType: "WALL", spriteId: "futuriste.alloy_corner", imageFile: `${FT}/wall_corner.png`, imageWidth: 64, imageHeight: 64 },
    { role: "difficult_terrain", tileType: "DIFFICULT_TERRAIN", spriteId: "futuriste.broken_conduit", imageFile: `${FT}/difficult_terrain.png` },
    { role: "hazard_primary", tileType: "HAZARD", spriteId: "futuriste.plasma_leak", imageFile: `${FT}/hazard_primary.png`, imageWidth: 64, imageHeight: 64 },
    { role: "obstacle_decor", tileType: "OBSTACLE", spriteId: "futuriste.server_rack", imageFile: `${FT}/obstacle_decor.png`, imageWidth: 64, imageHeight: 64 },
    { role: "decoration_minor", tileType: "WALKABLE", spriteId: "futuriste.holographic_tag", imageFile: `${FT}/decoration_minor.png` },
    { role: "door_closed", tileType: "DOOR", spriteId: "futuriste.sliding_airlock", imageFile: `${FT}/door_closed.png`, imageWidth: 64, imageHeight: 64 },
    { role: "stairs", tileType: "STAIRS", spriteId: "futuriste.metal_grating_stairs", imageFile: `${FT}/stairs.png`, imageWidth: 64, imageHeight: 64 },
  ],
  ambient: { lightColor: "#0a0a1a", fogIntensity: 0.3 },
};
