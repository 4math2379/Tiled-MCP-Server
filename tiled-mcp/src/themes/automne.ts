import type { Theme } from "../types.js";

// Sprite paths are "./assets/<theme_lowercase>/<role>.png", relative to the repository root
// (or TILED_ASSETS_DIR). save_to_disk rewrites them relative to the saved .tmj file.
const AU = "./assets/automne";

export const AUTOMNE: Theme = {
  key: "AUTOMNE",
  name: "Foret d'Automne",
  description:
    "Feuilles rousses, champignons, brume matinale, gibier traqué. Bois automnal, sentiers couverts, tombes sous les érables.",
  tilesetName: "automne-tileset",
  tilewidth: 64,
  tileheight: 32,
  tiles: [
    { role: "walkable_floor", tileType: "WALKABLE", spriteId: "automne.fallen_leaves", imageFile: `${AU}/walkable_floor.png` },
    { role: "walkable_floor_alt", tileType: "WALKABLE", spriteId: "automne.damp_earth", imageFile: `${AU}/walkable_floor_alt.png` },
    { role: "wall", tileType: "WALL", spriteId: "automne.rustic_oak", imageFile: `${AU}/wall.png`, imageWidth: 64, imageHeight: 64 },
    { role: "wall_corner", tileType: "WALL", spriteId: "automne.twisted_branch", imageFile: `${AU}/wall_corner.png`, imageWidth: 64, imageHeight: 64 },
    { role: "difficult_terrain", tileType: "DIFFICULT_TERRAIN", spriteId: "automne.slippery_leaf_carpet", imageFile: `${AU}/difficult_terrain.png` },
    { role: "hazard_primary", tileType: "HAZARD", spriteId: "automne.bog_mire", imageFile: `${AU}/hazard_primary.png`, imageWidth: 64, imageHeight: 64 },
    { role: "obstacle_decor", tileType: "OBSTACLE", spriteId: "automne.scarecrow_withered", imageFile: `${AU}/obstacle_decor.png`, imageWidth: 64, imageHeight: 64 },
    { role: "decoration_minor", tileType: "WALKABLE", spriteId: "automne.acorn", imageFile: `${AU}/decoration_minor.png` },
    { role: "door_closed", tileType: "DOOR", spriteId: "automne.ivy_door", imageFile: `${AU}/door_closed.png`, imageWidth: 64, imageHeight: 64 },
    { role: "stairs", tileType: "STAIRS", spriteId: "automne.leaf_stairs", imageFile: `${AU}/stairs.png`, imageWidth: 64, imageHeight: 64 },
  ],
  ambient: { lightColor: "#2a1a0a", fogIntensity: 0.25 },
};
