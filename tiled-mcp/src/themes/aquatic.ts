import type { Theme } from "../types.js";

// Sprite paths are "./assets/<theme_lowercase>/<role>.png", relative to the repository root
// (or TILED_ASSETS_DIR). save_to_disk rewrites them relative to the saved .tmj file.
const A = "./assets/aquatic";

export const AQUATIC: Theme = {
  key: "AQUATIC",
  name: "Eaux Croupies",
  description:
    "Eaux noires stagnantes, nénuphars, ruines submergées, brume sur l'eau. Marais hanté, pontons pourris, cryptes inondées.",
  tilesetName: "aquatic-tileset",
  tilewidth: 64,
  tileheight: 32,
  tiles: [
    { role: "walkable_floor", tileType: "WALKABLE", spriteId: "aquatic.black_water", imageFile: `${A}/walkable_floor.png` },
    { role: "walkable_floor_alt", tileType: "WALKABLE", spriteId: "aquatic.murky_water", imageFile: `${A}/walkable_floor_alt.png` },
    { role: "wall", tileType: "WALL", spriteId: "aquatic.weeping_stone", imageFile: `${A}/wall.png`, imageWidth: 64, imageHeight: 64 },
    { role: "wall_corner", tileType: "WALL", spriteId: "aquatic.damp_corner", imageFile: `${A}/wall_corner.png`, imageWidth: 64, imageHeight: 64 },
    { role: "difficult_terrain", tileType: "DIFFICULT_TERRAIN", spriteId: "aquatic.algae_flagstone", imageFile: `${A}/difficult_terrain.png` },
    { role: "hazard_primary", tileType: "HAZARD", spriteId: "aquatic.deep_water", imageFile: `${A}/hazard_primary.png`, imageWidth: 64, imageHeight: 64 },
    { role: "obstacle_decor", tileType: "OBSTACLE", spriteId: "aquatic.submerged_sarcophagus", imageFile: `${A}/obstacle_decor.png`, imageWidth: 64, imageHeight: 64 },
    { role: "decoration_minor", tileType: "WALKABLE", spriteId: "aquatic.water_lily", imageFile: `${A}/decoration_minor.png` },
    { role: "door_closed", tileType: "DOOR", spriteId: "aquatic.barnacled_door", imageFile: `${A}/door_closed.png`, imageWidth: 64, imageHeight: 64 },
    { role: "stairs", tileType: "STAIRS", spriteId: "aquatic.slimy_stairs", imageFile: `${A}/stairs.png`, imageWidth: 64, imageHeight: 64 },
  ],
  ambient: { lightColor: "#0a1a1a", fogIntensity: 0.3 },
};
