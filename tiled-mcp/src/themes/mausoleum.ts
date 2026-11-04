import type { Theme } from "../types.js";

// Sprite paths are "./assets/<theme_lowercase>/<role>.png", relative to the repository root
// (or TILED_ASSETS_DIR). save_to_disk rewrites them relative to the saved .tmj file.
const A = "./assets/mausoleum";

export const MAUSOLEUM: Theme = {
  key: "MAUSOLEUM",
  name: "Mausolée",
  description:
    "Marbre veiné de gris, statues d'anges déchus aux ailes brisées, urnes funéraires alignées dans les niches, chuchotements à la limite de l'audible.",
  tilesetName: "mausoleum-tileset",
  tilewidth: 64,
  tileheight: 32,
  tiles: [
    { role: "walkable_floor", tileType: "WALKABLE", spriteId: "mausoleum.marble_floor", imageFile: `${A}/walkable_floor.png` },
    { role: "walkable_floor_alt", tileType: "WALKABLE", spriteId: "mausoleum.marble_cracked", imageFile: `${A}/walkable_floor_alt.png` },
    { role: "wall", tileType: "WALL", spriteId: "mausoleum.granite_wall", imageFile: `${A}/wall.png`, imageWidth: 64, imageHeight: 64 },
    { role: "difficult_terrain", tileType: "DIFFICULT_TERRAIN", spriteId: "mausoleum.broken_urns", imageFile: `${A}/difficult_terrain.png` },
    { role: "obstacle_decor", tileType: "OBSTACLE", spriteId: "mausoleum.fallen_angel", imageFile: `${A}/obstacle_decor.png`, imageWidth: 64, imageHeight: 64 },
    { role: "decoration_minor", tileType: "WALKABLE", spriteId: "mausoleum.urn_niche", imageFile: `${A}/decoration_minor.png` },
    { role: "door_closed", tileType: "DOOR", spriteId: "mausoleum.bronze_door", imageFile: `${A}/door_closed.png`, imageWidth: 64, imageHeight: 64 },
    { role: "stairs", tileType: "STAIRS", spriteId: "mausoleum.marble_stairs", imageFile: `${A}/stairs.png`, imageWidth: 64, imageHeight: 64 },
  ],
  ambient: { lightColor: "#1f1f24", fogIntensity: 0.15 },
};
