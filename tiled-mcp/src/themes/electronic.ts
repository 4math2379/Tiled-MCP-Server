import type { Theme } from "../types.js";

// Sprite paths are "./assets/<theme_lowercase>/<role>.png", relative to the repository root
// (or TILED_ASSETS_DIR). save_to_disk rewrites them relative to the saved .tmj file.
const EL = "./assets/electronic";

export const ELECTRONIC: Theme = {
  key: "ELECTRONIC",
  name: "Electronic Network",
  description:
    "Printed circuits, optical fibres, streaming data, silent servers. Digital matrix, compute nodes, AI cores.",
  tilesetName: "electronic-tileset",
  tilewidth: 64,
  tileheight: 32,
  tiles: [
    { role: "walkable_floor", tileType: "WALKABLE", spriteId: "electronic.pcb_trace", imageFile: `${EL}/walkable_floor.png` },
    { role: "walkable_floor_alt", tileType: "WALKABLE", spriteId: "electronic.chip_substrate", imageFile: `${EL}/walkable_floor_alt.png` },
    { role: "wall", tileType: "WALL", spriteId: "electronic.server_casing", imageFile: `${EL}/wall.png`, imageWidth: 64, imageHeight: 64 },
    { role: "wall_corner", tileType: "WALL", spriteId: "electronic.circuit_corner", imageFile: `${EL}/wall_corner.png`, imageWidth: 64, imageHeight: 64 },
    { role: "difficult_terrain", tileType: "DIFFICULT_TERRAIN", spriteId: "electronic.tangled_cable", imageFile: `${EL}/difficult_terrain.png` },
    { role: "hazard_primary", tileType: "HAZARD", spriteId: "electronic.power_surge", imageFile: `${EL}/hazard_primary.png`, imageWidth: 64, imageHeight: 64 },
    { role: "obstacle_decor", tileType: "OBSTACLE", spriteId: "electronic.mainframe_core", imageFile: `${EL}/obstacle_decor.png`, imageWidth: 64, imageHeight: 64 },
    { role: "decoration_minor", tileType: "WALKABLE", spriteId: "electronic.blinking_led", imageFile: `${EL}/decoration_minor.png` },
    { role: "door_closed", tileType: "DOOR", spriteId: "electronic.biometric_door", imageFile: `${EL}/door_closed.png`, imageWidth: 64, imageHeight: 64 },
    { role: "stairs", tileType: "STAIRS", spriteId: "electronic.access_ladder", imageFile: `${EL}/stairs.png`, imageWidth: 64, imageHeight: 64 },
  ],
  ambient: { lightColor: "#0a0a1a", fogIntensity: 0.2 },
};
