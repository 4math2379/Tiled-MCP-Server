import type { Theme } from "../types.js";

// Sprite paths are "./assets/<theme_lowercase>/<role>.png", relative to the repository root
// (or TILED_ASSETS_DIR). save_to_disk rewrites them relative to the saved .tmj file.
const AU = "./assets/autumn";

export const AUTUMN: Theme = {
  key: "AUTUMN",
  name: "Autumn Forest",
  description:
    "Russet leaves, mushrooms, morning mist, hunted game. Autumn woods, leaf-covered paths, graves under the maples.",
  tilesetName: "autumn-tileset",
  tilewidth: 64,
  tileheight: 32,
  tiles: [
    { role: "walkable_floor", tileType: "WALKABLE", spriteId: "autumn.fallen_leaves", imageFile: `${AU}/walkable_floor.png` },
    { role: "walkable_floor_alt", tileType: "WALKABLE", spriteId: "autumn.damp_earth", imageFile: `${AU}/walkable_floor_alt.png` },
    { role: "wall", tileType: "WALL", spriteId: "autumn.rustic_oak", imageFile: `${AU}/wall.png`, imageWidth: 64, imageHeight: 64 },
    { role: "wall_corner", tileType: "WALL", spriteId: "autumn.twisted_branch", imageFile: `${AU}/wall_corner.png`, imageWidth: 64, imageHeight: 64 },
    { role: "difficult_terrain", tileType: "DIFFICULT_TERRAIN", spriteId: "autumn.slippery_leaf_carpet", imageFile: `${AU}/difficult_terrain.png` },
    { role: "hazard_primary", tileType: "HAZARD", spriteId: "autumn.bog_mire", imageFile: `${AU}/hazard_primary.png`, imageWidth: 64, imageHeight: 64 },
    { role: "obstacle_decor", tileType: "OBSTACLE", spriteId: "autumn.scarecrow_withered", imageFile: `${AU}/obstacle_decor.png`, imageWidth: 64, imageHeight: 64 },
    { role: "decoration_minor", tileType: "WALKABLE", spriteId: "autumn.acorn", imageFile: `${AU}/decoration_minor.png` },
    { role: "door_closed", tileType: "DOOR", spriteId: "autumn.ivy_door", imageFile: `${AU}/door_closed.png`, imageWidth: 64, imageHeight: 64 },
    { role: "stairs", tileType: "STAIRS", spriteId: "autumn.leaf_stairs", imageFile: `${AU}/stairs.png`, imageWidth: 64, imageHeight: 64 },
  ],
  ambient: { lightColor: "#2a1a0a", fogIntensity: 0.25 },
};
