import type { Theme } from "../types.js";

// Sprite paths are "./assets/<theme_lowercase>/<role>.png", relative to the repository root
// (or TILED_ASSETS_DIR). save_to_disk rewrites them relative to the saved .tmj file.
const I = "./assets/inonde";

export const INONDE: Theme = {
  key: "INONDE",
  name: "Cote Inondee",
  description:
    "Villes englouties sous les flots, ruines submergees, algues pendantes, eaux saumustres. Quartiers noyés, ponts rompus, cryptes immergees.",
  tilesetName: "inonde-tileset",
  tilewidth: 64,
  tileheight: 32,
  tiles: [
    { role: "walkable_floor", tileType: "WALKABLE", spriteId: "inonde.stagnant_water", imageFile: `${I}/walkable_floor.png` },
    { role: "walkable_floor_alt", tileType: "WALKABLE", spriteId: "inonde.muddy_flats", imageFile: `${I}/walkable_floor_alt.png` },
    { role: "wall", tileType: "WALL", spriteId: "inonde.submerged_wall", imageFile: `${I}/wall.png`, imageWidth: 64, imageHeight: 64 },
    { role: "wall_corner", tileType: "WALL", spriteId: "inonde.drowned_corner", imageFile: `${I}/wall_corner.png`, imageWidth: 64, imageHeight: 64 },
    { role: "difficult_terrain", tileType: "DIFFICULT_TERRAIN", spriteId: "inonde.kelp_tangle", imageFile: `${I}/difficult_terrain.png` },
    { role: "hazard_primary", tileType: "HAZARD", spriteId: "inonde.deep_current", imageFile: `${I}/hazard_primary.png`, imageWidth: 64, imageHeight: 64 },
    { role: "obstacle_decor", tileType: "OBSTACLE", spriteId: "inonde.sunken_statue", imageFile: `${I}/obstacle_decor.png`, imageWidth: 64, imageHeight: 64 },
    { role: "decoration_minor", tileType: "WALKABLE", spriteId: "inonde.floating_debris", imageFile: `${I}/decoration_minor.png` },
    { role: "door_closed", tileType: "DOOR", spriteId: "inonde.bloated_door", imageFile: `${I}/door_closed.png`, imageWidth: 64, imageHeight: 64 },
    { role: "stairs", tileType: "STAIRS", spriteId: "inonde.slippery_steps", imageFile: `${I}/stairs.png`, imageWidth: 64, imageHeight: 64 },
  ],
  ambient: { lightColor: "#0a1a2a", fogIntensity: 0.35 },
};
