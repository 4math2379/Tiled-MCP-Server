import type { Theme } from "../types.js";

// Sprite paths are "./assets/<theme_lowercase>/<role>.png", relative to the repository root
// (or TILED_ASSETS_DIR). save_to_disk rewrites them relative to the saved .tmj file.
const A = "./assets/tavern_blood_prince";

export const TAVERN_BLOOD_PRINCE: Theme = {
  key: "TAVERN_BLOOD_PRINCE",
  name: "Auberge du Prince Sanglant",
  description:
    "Parquet sombre, enduit fissuré, lourde charpente apparente. Tables rondes en chêne, âtre crépitant, bar marbré de taches anciennes. Pas de pièges actifs — la peur suffit.",
  tilesetName: "tavern-tileset",
  tilewidth: 64,
  tileheight: 32,
  tiles: [
    { role: "walkable_floor", tileType: "WALKABLE", spriteId: "tavern.plank_floor", imageFile: `${A}/walkable_floor.png` },
    { role: "walkable_floor_alt", tileType: "WALKABLE", spriteId: "tavern.plank_floor_worn", imageFile: `${A}/walkable_floor_alt.png` },
    { role: "wall", tileType: "WALL", spriteId: "tavern.plaster_wall", imageFile: `${A}/wall.png`, imageWidth: 64, imageHeight: 64 },
    { role: "difficult_terrain", tileType: "DIFFICULT_TERRAIN", spriteId: "tavern.spilled_ale", imageFile: `${A}/difficult_terrain.png` },
    { role: "obstacle_decor", tileType: "OBSTACLE", spriteId: "tavern.table", imageFile: `${A}/obstacle_decor.png`, imageWidth: 64, imageHeight: 64 },
    { role: "decoration_minor", tileType: "WALKABLE", spriteId: "tavern.chair", imageFile: `${A}/decoration_minor.png` },
    { role: "door_closed", tileType: "DOOR", spriteId: "tavern.wood_door", imageFile: `${A}/door_closed.png`, imageWidth: 64, imageHeight: 64 },
    { role: "stairs", tileType: "STAIRS", spriteId: "tavern.wood_stairs", imageFile: `${A}/stairs.png`, imageWidth: 64, imageHeight: 64 },
  ],
  ambient: { lightColor: "#3a2a18", fogIntensity: 0.05 },
};
