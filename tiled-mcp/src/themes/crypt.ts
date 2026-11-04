import type { Theme } from "../types.js";

// Sprite paths are "./assets/<theme_lowercase>/<role>.png", relative to the repository root
// (or TILED_ASSETS_DIR). save_to_disk rewrites them relative to the saved .tmj file.
const A = "./assets/crypt";

export const CRYPT: Theme = {
  key: "CRYPT",
  name: "Crypte mournevaldienne",
  description:
    "Caveaux funéraires sous les chapelles, dalles fissurées, runes mortuaires, gaz toxiques émanant des sarcophages disjoints.",
  tilesetName: "crypt-tileset",
  tilewidth: 64,
  tileheight: 32,
  tiles: [
    { role: "walkable_floor", tileType: "WALKABLE", spriteId: "crypt.flagstone", imageFile: `${A}/walkable_floor.png` },
    { role: "walkable_floor_alt", tileType: "WALKABLE", spriteId: "crypt.flagstone_cracked", imageFile: `${A}/walkable_floor_alt.png` },
    { role: "wall", tileType: "WALL", spriteId: "crypt.wall_mossy", imageFile: `${A}/wall.png`, imageWidth: 64, imageHeight: 64 },
    { role: "wall_corner", tileType: "WALL", spriteId: "crypt.wall_corner", imageFile: `${A}/wall_corner.png`, imageWidth: 64, imageHeight: 64 },
    { role: "difficult_terrain", tileType: "DIFFICULT_TERRAIN", spriteId: "crypt.rubble", imageFile: `${A}/difficult_terrain.png` },
    {
      role: "hazard_primary",
      tileType: "HAZARD",
      spriteId: "crypt.poison_vent",
      hazardType: "poison",
      hazardNotation: "2d6",
      imageFile: `${A}/hazard_primary.png`,
    },
    { role: "obstacle_decor", tileType: "OBSTACLE", spriteId: "crypt.sarcophagus", imageFile: `${A}/obstacle_decor.png`, imageWidth: 64, imageHeight: 64 },
    { role: "decoration_minor", tileType: "WALKABLE", spriteId: "crypt.bones", imageFile: `${A}/decoration_minor.png` },
    { role: "door_closed", tileType: "DOOR", spriteId: "crypt.iron_door", imageFile: `${A}/door_closed.png`, imageWidth: 64, imageHeight: 64 },
    { role: "stairs", tileType: "STAIRS", spriteId: "crypt.stone_stairs", imageFile: `${A}/stairs.png`, imageWidth: 64, imageHeight: 64 },
  ],
  ambient: { lightColor: "#2a1f1f", fogIntensity: 0.4 },
};
