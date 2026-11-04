import type { Theme } from "../types.js";

// Sprite paths are "./assets/<theme_lowercase>/<role>.png", relative to the repository root
// (or TILED_ASSETS_DIR). save_to_disk rewrites them relative to the saved .tmj file.
const G = "./assets/glaciaire";

export const GLACIAIRE: Theme = {
  key: "GLACIAIRE",
  name: "Toundra Glacée",
  description:
    "Glace noire, figures gelées prises dans la glace, givre, stalactites de pierre. Toundra hantée, pontons de gel, cryptes sous pergélisol.",
  tilesetName: "glaciaire-tileset",
  tilewidth: 64,
  tileheight: 32,
  tiles: [
    { role: "walkable_floor", tileType: "WALKABLE", spriteId: "glaciaire.black_ice", imageFile: `${G}/walkable_floor.png` },
    { role: "walkable_floor_alt", tileType: "WALKABLE", spriteId: "glaciaire.frost_flagstone", imageFile: `${G}/walkable_floor_alt.png` },
    { role: "wall", tileType: "WALL", spriteId: "glaciaire.glacial_ice", imageFile: `${G}/wall.png`, imageWidth: 64, imageHeight: 64 },
    { role: "wall_corner", tileType: "WALL", spriteId: "glaciaire.frost_corner", imageFile: `${G}/wall_corner.png`, imageWidth: 64, imageHeight: 64 },
    { role: "difficult_terrain", tileType: "DIFFICULT_TERRAIN", spriteId: "glaciaire.cracked_ice", imageFile: `${G}/difficult_terrain.png` },
    { role: "hazard_primary", tileType: "HAZARD", spriteId: "glaciaire.thin_ice", imageFile: `${G}/hazard_primary.png`, imageWidth: 64, imageHeight: 64 },
    { role: "obstacle_decor", tileType: "OBSTACLE", spriteId: "glaciaire.frozen_statue", imageFile: `${G}/obstacle_decor.png`, imageWidth: 64, imageHeight: 64 },
    { role: "decoration_minor", tileType: "WALKABLE", spriteId: "glaciaire.icicles", imageFile: `${G}/decoration_minor.png` },
    { role: "door_closed", tileType: "DOOR", spriteId: "glaciaire.frosted_door", imageFile: `${G}/door_closed.png`, imageWidth: 64, imageHeight: 64 },
    { role: "stairs", tileType: "STAIRS", spriteId: "glaciaire.ice_stairs", imageFile: `${G}/stairs.png`, imageWidth: 64, imageHeight: 64 },
  ],
  ambient: { lightColor: "#0a1a2a", fogIntensity: 0.25 },
};
