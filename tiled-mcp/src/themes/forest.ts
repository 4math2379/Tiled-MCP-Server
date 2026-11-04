import type { Theme } from "../types.js";

// Sprite paths are "./assets/<theme_lowercase>/<role>.png", relative to the repository root
// (or TILED_ASSETS_DIR). save_to_disk rewrites them relative to the saved .tmj file.
const A = "./assets/haunted_forest";

export const HAUNTED_FOREST: Theme = {
  key: "HAUNTED_FOREST",
  name: "Forêt de Drakenmark",
  description:
    "Sous-bois étouffant de mousses noires, troncs morts couchés, brumes parasitaires qui s'enroulent autour des chevilles et ralentissent la marche.",
  tilesetName: "forest-tileset",
  tilewidth: 64,
  tileheight: 32,
  tiles: [
    { role: "walkable_floor", tileType: "WALKABLE", spriteId: "forest.moss", imageFile: `${A}/walkable_floor.png` },
    { role: "walkable_floor_alt", tileType: "WALKABLE", spriteId: "forest.dead_leaves", imageFile: `${A}/walkable_floor_alt.png` },
    { role: "wall", tileType: "WALL", spriteId: "forest.dead_tree", imageFile: `${A}/wall.png`, imageWidth: 64, imageHeight: 64 },
    { role: "difficult_terrain", tileType: "DIFFICULT_TERRAIN", spriteId: "forest.bramble", imageFile: `${A}/difficult_terrain.png` },
    {
      role: "hazard_primary",
      tileType: "HAZARD",
      spriteId: "forest.parasitic_mist",
      hazardType: "necrotique",
      hazardNotation: "1d4",
      imageFile: `${A}/hazard_primary.png`,
    },
    { role: "obstacle_decor", tileType: "OBSTACLE", spriteId: "forest.boulder", imageFile: `${A}/obstacle_decor.png`, imageWidth: 64, imageHeight: 64 },
    { role: "decoration_minor", tileType: "WALKABLE", spriteId: "forest.mushroom", imageFile: `${A}/decoration_minor.png` },
  ],
  ambient: { lightColor: "#1a1f18", fogIntensity: 0.5 },
};
