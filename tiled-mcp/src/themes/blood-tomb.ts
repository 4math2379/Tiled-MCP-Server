import type { Theme } from "../types.js";

// Sprite paths are "./assets/<theme_lowercase>/<role>.png", relative to the repository root
// (or TILED_ASSETS_DIR). save_to_disk rewrites them relative to the saved .tmj file.
const A = "./assets/blood_tomb";

export const BLOOD_TOMB: Theme = {
  key: "BLOOD_TOMB",
  name: "Tombeau de sang",
  description:
    "Sanctuaire profond consacré aux pactes anciens. Dalles rituelles, runes saignantes qui pulsent au passage, autel central, candélabres en fer noir. Le sang ne sèche jamais sur ce sol.",
  tilesetName: "blood-tomb-tileset",
  tilewidth: 64,
  tileheight: 32,
  tiles: [
    { role: "walkable_floor", tileType: "WALKABLE", spriteId: "tomb.ritual_slab", imageFile: `${A}/walkable_floor.png` },
    { role: "walkable_floor_alt", tileType: "WALKABLE", spriteId: "tomb.ritual_slab_stained", imageFile: `${A}/walkable_floor_alt.png` },
    { role: "wall", tileType: "WALL", spriteId: "tomb.bleeding_wall", imageFile: `${A}/wall.png`, imageWidth: 64, imageHeight: 64 },
    { role: "difficult_terrain", tileType: "DIFFICULT_TERRAIN", spriteId: "tomb.blood_layer", imageFile: `${A}/difficult_terrain.png` },
    {
      role: "hazard_primary",
      tileType: "HAZARD",
      spriteId: "tomb.bleeding_rune",
      hazardType: "necrotique",
      hazardNotation: "3d6",
      imageFile: `${A}/hazard_primary.png`,
    },
    { role: "obstacle_decor", tileType: "OBSTACLE", spriteId: "tomb.altar", imageFile: `${A}/obstacle_decor.png`, imageWidth: 64, imageHeight: 64 },
    { role: "decoration_minor", tileType: "WALKABLE", spriteId: "tomb.candelabra", imageFile: `${A}/decoration_minor.png` },
    { role: "door_closed", tileType: "DOOR", spriteId: "tomb.sealed_door", imageFile: `${A}/door_closed.png`, imageWidth: 64, imageHeight: 64 },
  ],
  ambient: { lightColor: "#220808", fogIntensity: 0.3 },
};
