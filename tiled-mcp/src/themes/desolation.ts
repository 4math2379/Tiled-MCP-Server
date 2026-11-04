import type { Theme } from "../types.js";

// Sprite paths are "./assets/<theme_lowercase>/<role>.png", relative to the repository root
// (or TILED_ASSETS_DIR). save_to_disk rewrites them relative to the saved .tmj file.
const D = "./assets/desolation";

export const DESOLATION: Theme = {
  key: "DESOLATION",
  name: "Terre Desolee",
  description:
    "Cendres froides, arbres carbonisés, sols stériles, ciel gris. Paysage post-cataclysmique, ruines calcinées, ossuaires à ciel ouvert.",
  tilesetName: "desolation-tileset",
  tilewidth: 64,
  tileheight: 32,
  tiles: [
    { role: "walkable_floor", tileType: "WALKABLE", spriteId: "desolation.cold_ash", imageFile: `${D}/walkable_floor.png` },
    { role: "walkable_floor_alt", tileType: "WALKABLE", spriteId: "desolation.scorched_rock", imageFile: `${D}/walkable_floor_alt.png` },
    { role: "wall", tileType: "WALL", spriteId: "desolation.charred_wall", imageFile: `${D}/wall.png`, imageWidth: 64, imageHeight: 64 },
    { role: "wall_corner", tileType: "WALL", spriteId: "desolation.burnt_corner", imageFile: `${D}/wall_corner.png`, imageWidth: 64, imageHeight: 64 },
    { role: "difficult_terrain", tileType: "DIFFICULT_TERRAIN", spriteId: "desolation.sharp_debris", imageFile: `${D}/difficult_terrain.png` },
    { role: "hazard_primary", tileType: "HAZARD", spriteId: "desolation.ash_pit", imageFile: `${D}/hazard_primary.png`, imageWidth: 64, imageHeight: 64 },
    { role: "obstacle_decor", tileType: "OBSTACLE", spriteId: "desolation.skeletal_tree", imageFile: `${D}/obstacle_decor.png`, imageWidth: 64, imageHeight: 64 },
    { role: "decoration_minor", tileType: "WALKABLE", spriteId: "desolation.dust_mote", imageFile: `${D}/decoration_minor.png` },
    { role: "door_closed", tileType: "DOOR", spriteId: "desolation.warped_metal_door", imageFile: `${D}/door_closed.png`, imageWidth: 64, imageHeight: 64 },
    { role: "stairs", tileType: "STAIRS", spriteId: "desolation.rubble_steps", imageFile: `${D}/stairs.png`, imageWidth: 64, imageHeight: 64 },
  ],
  ambient: { lightColor: "#1a1a1a", fogIntensity: 0.45 },
};
