import type { Theme } from "../types.js";

// Sprite paths are "./assets/<theme_lowercase>/<role>.png", relative to the repository root
// (or TILED_ASSETS_DIR). save_to_disk rewrites them relative to the saved .tmj file.
const F = "./assets/foret";

export const FORET: Theme = {
  key: "FORET",
  name: "Foret Sombre",
  description:
    "Bois sylvains tordus, mousse épaisse, racines apparentes, clairières brumeuses. Foret hantée, huttes de bûcherons, tombes sous les chênes.",
  tilesetName: "foret-tileset",
  tilewidth: 64,
  tileheight: 32,
  tiles: [
    { role: "walkable_floor", tileType: "WALKABLE", spriteId: "foret.moss_ground", imageFile: `${F}/walkable_floor.png` },
    { role: "walkable_floor_alt", tileType: "WALKABLE", spriteId: "foret.pine_needles", imageFile: `${F}/walkable_floor_alt.png` },
    { role: "wall", tileType: "WALL", spriteId: "foret.ancient_trunk", imageFile: `${F}/wall.png`, imageWidth: 64, imageHeight: 64 },
    { role: "wall_corner", tileType: "WALL", spriteId: "foret.gnarled_root", imageFile: `${F}/wall_corner.png`, imageWidth: 64, imageHeight: 64 },
    { role: "difficult_terrain", tileType: "DIFFICULT_TERRAIN", spriteId: "foret.thicket", imageFile: `${F}/difficult_terrain.png` },
    { role: "hazard_primary", tileType: "HAZARD", spriteId: "foret.quicksand_pool", imageFile: `${F}/hazard_primary.png`, imageWidth: 64, imageHeight: 64 },
    { role: "obstacle_decor", tileType: "OBSTACLE", spriteId: "foret.standing_stone", imageFile: `${F}/obstacle_decor.png`, imageWidth: 64, imageHeight: 64 },
    { role: "decoration_minor", tileType: "WALKABLE", spriteId: "foret.fallen_leaf", imageFile: `${F}/decoration_minor.png` },
    { role: "door_closed", tileType: "DOOR", spriteId: "foret.wooden_gate", imageFile: `${F}/door_closed.png`, imageWidth: 64, imageHeight: 64 },
    { role: "stairs", tileType: "STAIRS", spriteId: "foret.root_stairs", imageFile: `${F}/stairs.png`, imageWidth: 64, imageHeight: 64 },
  ],
  ambient: { lightColor: "#1a2a1a", fogIntensity: 0.3 },
};
