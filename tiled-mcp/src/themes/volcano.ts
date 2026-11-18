import type { Theme } from "../types.js";

// Sprite paths are "./assets/<theme_lowercase>/<role>.png", relative to the repository root
// (or TILED_ASSETS_DIR). save_to_disk rewrites them relative to the saved .tmj file.
const V = "./assets/volcano";

export const VOLCANO: Theme = {
  key: "VOLCANO",
  name: "Volcanic Slope",
  description:
    "Lava flows, cooled black rock, drifting ash, stifling heat. Active caldera, basalt bridges, crypts of ash.",
  tilesetName: "volcano-tileset",
  tilewidth: 64,
  tileheight: 32,
  tiles: [
    { role: "walkable_floor", tileType: "WALKABLE", spriteId: "volcano.cooled_lava", imageFile: `${V}/walkable_floor.png` },
    { role: "walkable_floor_alt", tileType: "WALKABLE", spriteId: "volcano.ash_ground", imageFile: `${V}/walkable_floor_alt.png` },
    { role: "wall", tileType: "WALL", spriteId: "volcano.dark_basalt", imageFile: `${V}/wall.png`, imageWidth: 64, imageHeight: 64 },
    { role: "wall_corner", tileType: "WALL", spriteId: "volcano.magma_corner", imageFile: `${V}/wall_corner.png`, imageWidth: 64, imageHeight: 64 },
    { role: "difficult_terrain", tileType: "DIFFICULT_TERRAIN", spriteId: "volcano.cracked_obsidian", imageFile: `${V}/difficult_terrain.png` },
    { role: "hazard_primary", tileType: "HAZARD", spriteId: "volcano.lava_flow", imageFile: `${V}/hazard_primary.png`, imageWidth: 64, imageHeight: 64 },
    { role: "obstacle_decor", tileType: "OBSTACLE", spriteId: "volcano.obsidian_menhir", imageFile: `${V}/obstacle_decor.png`, imageWidth: 64, imageHeight: 64 },
    { role: "decoration_minor", tileType: "WALKABLE", spriteId: "volcano.ember_ash", imageFile: `${V}/decoration_minor.png` },
    { role: "door_closed", tileType: "DOOR", spriteId: "volcano.iron_door", imageFile: `${V}/door_closed.png`, imageWidth: 64, imageHeight: 64 },
    { role: "stairs", tileType: "STAIRS", spriteId: "volcano.ash_stairs", imageFile: `${V}/stairs.png`, imageWidth: 64, imageHeight: 64 },
  ],
  ambient: { lightColor: "#1a0a00", fogIntensity: 0.4 },
};
