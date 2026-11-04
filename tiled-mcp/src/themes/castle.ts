import type { Theme } from "../types.js";

// Sprite paths are "./assets/<theme_lowercase>/<role>.png", relative to the repository root
// (or TILED_ASSETS_DIR). save_to_disk rewrites them relative to the saved .tmj file.
const A = "./assets/castle";

export const CASTLE: Theme = {
  key: "CASTLE",
  name: "Castel Von Drak",
  description:
    "Marbres noirs, basalte poli, vitraux brisés, bannières frappées du blason des Von Drak. Salle du trône, escaliers grandioses, candélabres en fer noir.",
  tilesetName: "castle-tileset",
  tilewidth: 64,
  tileheight: 32,
  tiles: [
    { role: "walkable_floor", tileType: "WALKABLE", spriteId: "castle.black_marble", imageFile: `${A}/walkable_floor.png` },
    { role: "walkable_floor_alt", tileType: "WALKABLE", spriteId: "castle.red_carpet", imageFile: `${A}/walkable_floor_alt.png` },
    { role: "wall", tileType: "WALL", spriteId: "castle.basalt_wall", imageFile: `${A}/wall.png`, imageWidth: 64, imageHeight: 64 },
    { role: "wall_corner", tileType: "WALL", spriteId: "castle.basalt_corner", imageFile: `${A}/wall_corner.png`, imageWidth: 64, imageHeight: 64 },
    { role: "difficult_terrain", tileType: "DIFFICULT_TERRAIN", spriteId: "castle.debris", imageFile: `${A}/difficult_terrain.png` },
    { role: "obstacle_decor", tileType: "OBSTACLE", spriteId: "castle.throne", imageFile: `${A}/obstacle_decor.png`, imageWidth: 64, imageHeight: 64 },
    { role: "decoration_minor", tileType: "WALKABLE", spriteId: "castle.banner", imageFile: `${A}/decoration_minor.png` },
    { role: "door_closed", tileType: "DOOR", spriteId: "castle.oak_door", imageFile: `${A}/door_closed.png`, imageWidth: 64, imageHeight: 64 },
    { role: "stairs", tileType: "STAIRS", spriteId: "castle.grand_stairs", imageFile: `${A}/stairs.png`, imageWidth: 64, imageHeight: 64 },
  ],
  ambient: { lightColor: "#1a0a0a", fogIntensity: 0.1 },
};
