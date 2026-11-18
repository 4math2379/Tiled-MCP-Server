import type { Theme } from "../types.js";

// Sprite paths are "./assets/<theme_lowercase>/<role>.png", relative to the repository root
// (or TILED_ASSETS_DIR). save_to_disk rewrites them relative to the saved .tmj file.
const F = "./assets/dark_forest";

export const DARK_FOREST: Theme = {
  key: "DARK_FOREST",
  name: "Dark Forest",
  description:
    "Twisted woods, thick moss, exposed roots, misty clearings. Haunted forest, woodcutters' huts, graves under the oaks.",
  tilesetName: "dark-forest-tileset",
  tilewidth: 64,
  tileheight: 32,
  tiles: [
    { role: "walkable_floor", tileType: "WALKABLE", spriteId: "dark_forest.moss_ground", imageFile: `${F}/walkable_floor.png` },
    { role: "walkable_floor_alt", tileType: "WALKABLE", spriteId: "dark_forest.pine_needles", imageFile: `${F}/walkable_floor_alt.png` },
    { role: "wall", tileType: "WALL", spriteId: "dark_forest.ancient_trunk", imageFile: `${F}/wall.png`, imageWidth: 64, imageHeight: 64 },
    { role: "wall_corner", tileType: "WALL", spriteId: "dark_forest.gnarled_root", imageFile: `${F}/wall_corner.png`, imageWidth: 64, imageHeight: 64 },
    { role: "difficult_terrain", tileType: "DIFFICULT_TERRAIN", spriteId: "dark_forest.thicket", imageFile: `${F}/difficult_terrain.png` },
    { role: "hazard_primary", tileType: "HAZARD", spriteId: "dark_forest.quicksand_pool", imageFile: `${F}/hazard_primary.png`, imageWidth: 64, imageHeight: 64 },
    { role: "obstacle_decor", tileType: "OBSTACLE", spriteId: "dark_forest.standing_stone", imageFile: `${F}/obstacle_decor.png`, imageWidth: 64, imageHeight: 64 },
    { role: "decoration_minor", tileType: "WALKABLE", spriteId: "dark_forest.fallen_leaf", imageFile: `${F}/decoration_minor.png` },
    { role: "door_closed", tileType: "DOOR", spriteId: "dark_forest.wooden_gate", imageFile: `${F}/door_closed.png`, imageWidth: 64, imageHeight: 64 },
    { role: "stairs", tileType: "STAIRS", spriteId: "dark_forest.root_stairs", imageFile: `${F}/stairs.png`, imageWidth: 64, imageHeight: 64 },
  ],
  ambient: { lightColor: "#1a2a1a", fogIntensity: 0.3 },
};
