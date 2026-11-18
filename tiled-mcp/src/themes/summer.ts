import type { Theme } from "../types.js";

// Sprite paths are "./assets/<theme_lowercase>/<role>.png", relative to the repository root
// (or TILED_ASSETS_DIR). save_to_disk rewrites them relative to the saved .tmj file.
const E = "./assets/summer";

export const SUMMER: Theme = {
  key: "SUMMER",
  name: "Summer Plain",
  description:
    "Golden grass, ripe wheat, cloudless sky, crushing heat. Harvest fields, abandoned granaries, ossuaries under the sun.",
  tilesetName: "summer-tileset",
  tilewidth: 64,
  tileheight: 32,
  tiles: [
    { role: "walkable_floor", tileType: "WALKABLE", spriteId: "summer.golden_wheat", imageFile: `${E}/walkable_floor.png` },
    { role: "walkable_floor_alt", tileType: "WALKABLE", spriteId: "summer.dry_grass", imageFile: `${E}/walkable_floor_alt.png` },
    { role: "wall", tileType: "WALL", spriteId: "summer.sunbaked_clay", imageFile: `${E}/wall.png`, imageWidth: 64, imageHeight: 64 },
    { role: "wall_corner", tileType: "WALL", spriteId: "summer.terracotta_corner", imageFile: `${E}/wall_corner.png`, imageWidth: 64, imageHeight: 64 },
    { role: "difficult_terrain", tileType: "DIFFICULT_TERRAIN", spriteId: "summer.cracked_earth", imageFile: `${E}/difficult_terrain.png` },
    { role: "hazard_primary", tileType: "HAZARD", spriteId: "summer.heat_haze_pool", imageFile: `${E}/hazard_primary.png`, imageWidth: 64, imageHeight: 64 },
    { role: "obstacle_decor", tileType: "OBSTACLE", spriteId: "summer.scarecrow", imageFile: `${E}/obstacle_decor.png`, imageWidth: 64, imageHeight: 64 },
    { role: "decoration_minor", tileType: "WALKABLE", spriteId: "summer.dried_herb", imageFile: `${E}/decoration_minor.png` },
    { role: "door_closed", tileType: "DOOR", spriteId: "summer.weathered_plank_door", imageFile: `${E}/door_closed.png`, imageWidth: 64, imageHeight: 64 },
    { role: "stairs", tileType: "STAIRS", spriteId: "summer.dusty_steps", imageFile: `${E}/stairs.png`, imageWidth: 64, imageHeight: 64 },
  ],
  ambient: { lightColor: "#2a1a0a", fogIntensity: 0.1 },
};
