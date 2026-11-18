import type { Theme } from "../types.js";

// Sprite paths are "./assets/<theme_lowercase>/<role>.png", relative to the repository root
// (or TILED_ASSETS_DIR). save_to_disk rewrites them relative to the saved .tmj file.
const H = "./assets/winter";

export const WINTER: Theme = {
  key: "WINTER",
  name: "Snowy Plain",
  description:
    "Powder snow, frozen lakes, frosted branches, freezing fog. Winter tundra, trappers' shelters, tombs under the snow.",
  tilesetName: "winter-tileset",
  tilewidth: 64,
  tileheight: 32,
  tiles: [
    { role: "walkable_floor", tileType: "WALKABLE", spriteId: "winter.fresh_snow", imageFile: `${H}/walkable_floor.png` },
    { role: "walkable_floor_alt", tileType: "WALKABLE", spriteId: "winter.packed_ice", imageFile: `${H}/walkable_floor_alt.png` },
    { role: "wall", tileType: "WALL", spriteId: "winter.snow_drift", imageFile: `${H}/wall.png`, imageWidth: 64, imageHeight: 64 },
    { role: "wall_corner", tileType: "WALL", spriteId: "winter.frozen_corner", imageFile: `${H}/wall_corner.png`, imageWidth: 64, imageHeight: 64 },
    { role: "difficult_terrain", tileType: "DIFFICULT_TERRAIN", spriteId: "winter.slush", imageFile: `${H}/difficult_terrain.png` },
    { role: "hazard_primary", tileType: "HAZARD", spriteId: "winter.thin_ice_lake", imageFile: `${H}/hazard_primary.png`, imageWidth: 64, imageHeight: 64 },
    { role: "obstacle_decor", tileType: "OBSTACLE", spriteId: "winter.frozen_cairn", imageFile: `${H}/obstacle_decor.png`, imageWidth: 64, imageHeight: 64 },
    { role: "decoration_minor", tileType: "WALKABLE", spriteId: "winter.snowflake", imageFile: `${H}/decoration_minor.png` },
    { role: "door_closed", tileType: "DOOR", spriteId: "winter.frosted_log_door", imageFile: `${H}/door_closed.png`, imageWidth: 64, imageHeight: 64 },
    { role: "stairs", tileType: "STAIRS", spriteId: "winter.ice_steps", imageFile: `${H}/stairs.png`, imageWidth: 64, imageHeight: 64 },
  ],
  ambient: { lightColor: "#0f1a2a", fogIntensity: 0.2 },
};
