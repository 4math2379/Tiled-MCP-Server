import type { Theme } from "../types.js";

// Sprite paths are "./assets/<theme_lowercase>/<role>.png", relative to the repository root
// (or TILED_ASSETS_DIR). save_to_disk rewrites them relative to the saved .tmj file.
const I = "./assets/flooded";

export const FLOODED: Theme = {
  key: "FLOODED",
  name: "Flooded Coast",
  description:
    "Towns swallowed by the sea, sunken ruins, hanging seaweed, brackish water. Drowned districts, broken bridges, submerged crypts.",
  tilesetName: "flooded-tileset",
  tilewidth: 64,
  tileheight: 32,
  tiles: [
    { role: "walkable_floor", tileType: "WALKABLE", spriteId: "flooded.stagnant_water", imageFile: `${I}/walkable_floor.png` },
    { role: "walkable_floor_alt", tileType: "WALKABLE", spriteId: "flooded.muddy_flats", imageFile: `${I}/walkable_floor_alt.png` },
    { role: "wall", tileType: "WALL", spriteId: "flooded.submerged_wall", imageFile: `${I}/wall.png`, imageWidth: 64, imageHeight: 64 },
    { role: "wall_corner", tileType: "WALL", spriteId: "flooded.drowned_corner", imageFile: `${I}/wall_corner.png`, imageWidth: 64, imageHeight: 64 },
    { role: "difficult_terrain", tileType: "DIFFICULT_TERRAIN", spriteId: "flooded.kelp_tangle", imageFile: `${I}/difficult_terrain.png` },
    { role: "hazard_primary", tileType: "HAZARD", spriteId: "flooded.deep_current", imageFile: `${I}/hazard_primary.png`, imageWidth: 64, imageHeight: 64 },
    { role: "obstacle_decor", tileType: "OBSTACLE", spriteId: "flooded.sunken_statue", imageFile: `${I}/obstacle_decor.png`, imageWidth: 64, imageHeight: 64 },
    { role: "decoration_minor", tileType: "WALKABLE", spriteId: "flooded.floating_debris", imageFile: `${I}/decoration_minor.png` },
    { role: "door_closed", tileType: "DOOR", spriteId: "flooded.bloated_door", imageFile: `${I}/door_closed.png`, imageWidth: 64, imageHeight: 64 },
    { role: "stairs", tileType: "STAIRS", spriteId: "flooded.slippery_steps", imageFile: `${I}/stairs.png`, imageWidth: 64, imageHeight: 64 },
  ],
  ambient: { lightColor: "#0a1a2a", fogIntensity: 0.35 },
};
