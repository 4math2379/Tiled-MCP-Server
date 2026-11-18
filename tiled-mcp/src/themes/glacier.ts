import type { Theme } from "../types.js";

// Sprite paths are "./assets/<theme_lowercase>/<role>.png", relative to the repository root
// (or TILED_ASSETS_DIR). save_to_disk rewrites them relative to the saved .tmj file.
const G = "./assets/glacier";

export const GLACIER: Theme = {
  key: "GLACIER",
  name: "Frozen Tundra",
  description:
    "Black ice, figures frozen in the ice, frost, stone stalactites. Haunted tundra, frozen pontoons, crypts under the permafrost.",
  tilesetName: "glacier-tileset",
  tilewidth: 64,
  tileheight: 32,
  tiles: [
    { role: "walkable_floor", tileType: "WALKABLE", spriteId: "glacier.black_ice", imageFile: `${G}/walkable_floor.png` },
    { role: "walkable_floor_alt", tileType: "WALKABLE", spriteId: "glacier.frost_flagstone", imageFile: `${G}/walkable_floor_alt.png` },
    { role: "wall", tileType: "WALL", spriteId: "glacier.glacial_ice", imageFile: `${G}/wall.png`, imageWidth: 64, imageHeight: 64 },
    { role: "wall_corner", tileType: "WALL", spriteId: "glacier.frost_corner", imageFile: `${G}/wall_corner.png`, imageWidth: 64, imageHeight: 64 },
    { role: "difficult_terrain", tileType: "DIFFICULT_TERRAIN", spriteId: "glacier.cracked_ice", imageFile: `${G}/difficult_terrain.png` },
    { role: "hazard_primary", tileType: "HAZARD", spriteId: "glacier.thin_ice", imageFile: `${G}/hazard_primary.png`, imageWidth: 64, imageHeight: 64 },
    { role: "obstacle_decor", tileType: "OBSTACLE", spriteId: "glacier.frozen_statue", imageFile: `${G}/obstacle_decor.png`, imageWidth: 64, imageHeight: 64 },
    { role: "decoration_minor", tileType: "WALKABLE", spriteId: "glacier.icicles", imageFile: `${G}/decoration_minor.png` },
    { role: "door_closed", tileType: "DOOR", spriteId: "glacier.frosted_door", imageFile: `${G}/door_closed.png`, imageWidth: 64, imageHeight: 64 },
    { role: "stairs", tileType: "STAIRS", spriteId: "glacier.ice_stairs", imageFile: `${G}/stairs.png`, imageWidth: 64, imageHeight: 64 },
  ],
  ambient: { lightColor: "#0a1a2a", fogIntensity: 0.25 },
};
