import type { Theme } from "../types.js";

// Sprite paths are "./assets/<theme_lowercase>/<role>.png", relative to the repository root
// (or TILED_ASSETS_DIR). save_to_disk rewrites them relative to the saved .tmj file.
const A = "./assets/werewolf_den";

export const WEREWOLF_DEN: Theme = {
  key: "WEREWOLF_DEN",
  name: "Tanière de loups-garous",
  description:
    "Cavernes humides creusées dans la forêt de Drakenmark, sol en terre battue jonché d'ossements, parois rocheuses entaillées par les griffes, mares de sang frénétique près des proies récentes.",
  tilesetName: "werewolf-den-tileset",
  tilewidth: 64,
  tileheight: 32,
  tiles: [
    { role: "walkable_floor", tileType: "WALKABLE", spriteId: "den.dirt", imageFile: `${A}/walkable_floor.png` },
    { role: "walkable_floor_alt", tileType: "WALKABLE", spriteId: "den.dirt_bloody", imageFile: `${A}/walkable_floor_alt.png` },
    { role: "wall", tileType: "WALL", spriteId: "den.cave_wall", imageFile: `${A}/wall.png`, imageWidth: 64, imageHeight: 64 },
    { role: "difficult_terrain", tileType: "DIFFICULT_TERRAIN", spriteId: "den.bone_pile", imageFile: `${A}/difficult_terrain.png` },
    {
      role: "hazard_primary",
      tileType: "HAZARD",
      spriteId: "den.blood_pool",
      hazardType: "necrotique",
      hazardNotation: "1d6",
      imageFile: `${A}/hazard_primary.png`,
    },
    { role: "obstacle_decor", tileType: "OBSTACLE", spriteId: "den.boulder", imageFile: `${A}/obstacle_decor.png`, imageWidth: 64, imageHeight: 64 },
    { role: "decoration_minor", tileType: "WALKABLE", spriteId: "den.fur", imageFile: `${A}/decoration_minor.png` },
    { role: "door_closed", tileType: "DOOR", spriteId: "den.hide_curtain", imageFile: `${A}/door_closed.png`, imageWidth: 64, imageHeight: 64 },
  ],
  ambient: { lightColor: "#1f1410", fogIntensity: 0.25 },
};
