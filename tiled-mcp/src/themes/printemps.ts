import type { Theme } from "../types.js";

// Sprite paths are "./assets/<theme_lowercase>/<role>.png", relative to the repository root
// (or TILED_ASSETS_DIR). save_to_disk rewrites them relative to the saved .tmj file.
const P = "./assets/printemps";

export const PRINTEMPS: Theme = {
  key: "PRINTEMPS",
  name: "Prairie Printaniere",
  description:
    "Champs en fleurs, herbe tendre, ruisseaux clairs, arbres en bourgeon. Prairies ouvertes, cercles de druides, fontaines sacrées.",
  tilesetName: "printemps-tileset",
  tilewidth: 64,
  tileheight: 32,
  tiles: [
    { role: "walkable_floor", tileType: "WALKABLE", spriteId: "printemps.green_meadow", imageFile: `${P}/walkable_floor.png` },
    { role: "walkable_floor_alt", tileType: "WALKABLE", spriteId: "printemps.clover_field", imageFile: `${P}/walkable_floor_alt.png` },
    { role: "wall", tileType: "WALL", spriteId: "printemps.living_hedge", imageFile: `${P}/wall.png`, imageWidth: 64, imageHeight: 64 },
    { role: "wall_corner", tileType: "WALL", spriteId: "printemps.flowered_arch", imageFile: `${P}/wall_corner.png`, imageWidth: 64, imageHeight: 64 },
    { role: "difficult_terrain", tileType: "DIFFICULT_TERRAIN", spriteId: "printemps.muddy_puddle", imageFile: `${P}/difficult_terrain.png` },
    { role: "hazard_primary", tileType: "HAZARD", spriteId: "printemps.swollen_stream", imageFile: `${P}/hazard_primary.png`, imageWidth: 64, imageHeight: 64 },
    { role: "obstacle_decor", tileType: "OBSTACLE", spriteId: "printemps.maypole", imageFile: `${P}/obstacle_decor.png`, imageWidth: 64, imageHeight: 64 },
    { role: "decoration_minor", tileType: "WALKABLE", spriteId: "printemps.wildflower", imageFile: `${P}/decoration_minor.png` },
    { role: "door_closed", tileType: "DOOR", spriteId: "printemps.woven_wicker_door", imageFile: `${P}/door_closed.png`, imageWidth: 64, imageHeight: 64 },
    { role: "stairs", tileType: "STAIRS", spriteId: "printemps.moss_steps", imageFile: `${P}/stairs.png`, imageWidth: 64, imageHeight: 64 },
  ],
  ambient: { lightColor: "#1a2a1a", fogIntensity: 0.15 },
};
