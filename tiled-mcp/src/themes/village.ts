import type { Theme } from "../types.js";

// Sprite paths are "./assets/<theme_lowercase>/<role>.png", relative to the repository root
// (or TILED_ASSETS_DIR). save_to_disk rewrites them relative to the saved .tmj file.
const A = "./assets/village";

export const VILLAGE: Theme = {
  key: "VILLAGE",
  name: "Village mournevaldien",
  description:
    "Pavés humides luisant sous la pluie perpétuelle, maisons à colombages aux fenêtres closes, étals de marché abandonnés, puits central et potence rouillée sur la place.",
  tilesetName: "village-tileset",
  tilewidth: 64,
  tileheight: 32,
  tiles: [
    { role: "walkable_floor", tileType: "WALKABLE", spriteId: "village.cobblestone", imageFile: `${A}/walkable_floor.png` },
    { role: "walkable_floor_alt", tileType: "WALKABLE", spriteId: "village.mud", imageFile: `${A}/walkable_floor_alt.png` },
    { role: "wall", tileType: "WALL", spriteId: "village.timber_wall", imageFile: `${A}/wall.png`, imageWidth: 64, imageHeight: 64 },
    { role: "difficult_terrain", tileType: "DIFFICULT_TERRAIN", spriteId: "village.mud_puddle", imageFile: `${A}/difficult_terrain.png` },
    { role: "obstacle_decor", tileType: "OBSTACLE", spriteId: "village.well", imageFile: `${A}/obstacle_decor.png`, imageWidth: 64, imageHeight: 64 },
    { role: "decoration_minor", tileType: "WALKABLE", spriteId: "village.market_stall", imageFile: `${A}/decoration_minor.png` },
    { role: "door_closed", tileType: "DOOR", spriteId: "village.house_door", imageFile: `${A}/door_closed.png`, imageWidth: 64, imageHeight: 64 },
  ],
  ambient: { lightColor: "#283040", fogIntensity: 0.3 },
};
