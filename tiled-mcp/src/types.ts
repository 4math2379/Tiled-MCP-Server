// Tiled JSON map format (.tmj) types, limited to what this server emits.
// Reference: https://doc.mapeditor.org/en/stable/reference/json-map-format/

export type TileType =
  | "WALKABLE"
  | "WALL"
  | "DIFFICULT_TERRAIN"
  | "HAZARD"
  | "DOOR"
  | "OBSTACLE"
  | "STAIRS";

/**
 * Object kinds on the 'objects' layer. 'entrance' and 'exit' are map transitions written by
 * place_building; door and stairs objects become transitions too when link_maps gives them a
 * targetMap. 'building' objects live on the 'buildings' layer.
 */
export type ObjectKind = "door" | "chest" | "stairs" | "lever" | "trap" | "entrance" | "exit" | "building";
export type ObjectState = "closed" | "open" | "locked" | "triggered";
/** 'arrival' marks where a player lands when coming through a map transition. */
export type SpawnRole = "player" | "enemy" | "npc" | "arrival";

export interface TiledProperty {
  name: string;
  value: string | number | boolean;
  /** 'file' holds a path relative to the map file (Tiled opens it on right-click). */
  type?: "string" | "int" | "float" | "bool" | "file";
}

export interface TiledTilesetTile {
  id: number;
  properties?: TiledProperty[];
  image?: string;
  imagewidth?: number;
  imageheight?: number;
}

export interface TiledTileset {
  firstgid: number;
  name: string;
  tilewidth: number;
  tileheight: number;
  tilecount: number;
  columns: number;
  tiles?: TiledTilesetTile[];
  grid?: { orientation: "isometric" | "orthogonal"; width: number; height: number };
  /** Anchor of tile objects using this tileset; the building tileset uses "bottom". */
  objectalignment?: "unspecified" | "bottom";
}

export interface TiledTileLayer {
  id: number;
  name: string;
  type: "tilelayer";
  visible: boolean;
  width: number;
  height: number;
  data: number[];
  opacity: number;
  x: number;
  y: number;
}

export interface TiledObject {
  id: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  name?: string;
  type?: string;
  gid?: number;
  visible?: boolean;
  rotation?: number;
  /** Point object (used for spawns). */
  point?: boolean;
  properties?: TiledProperty[];
}

export interface TiledObjectGroup {
  id: number;
  name: string;
  type: "objectgroup";
  visible: boolean;
  objects: TiledObject[];
  opacity: number;
  x: number;
  y: number;
  draworder?: "topdown" | "index";
}

export type TiledLayer = TiledTileLayer | TiledObjectGroup;

export interface TiledMap {
  type: "map";
  version: string;
  tiledversion: string;
  orientation: "isometric" | "orthogonal";
  renderorder: "right-down" | "right-up" | "left-down" | "left-up";
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  infinite: boolean;
  nextlayerid: number;
  nextobjectid: number;
  tilesets: TiledTileset[];
  layers: TiledLayer[];
  properties?: TiledProperty[];
}

// Roles a theme tile can fulfil in the procedural pipeline. Every theme
// must provide at least walkable_floor and wall; the others are optional.
export const THEME_ROLES = [
  "walkable_floor",
  "walkable_floor_alt",
  "wall",
  "wall_corner",
  "difficult_terrain",
  "hazard_primary",
  "obstacle_decor",
  "decoration_minor",
  "door_closed",
  "stairs",
] as const;

export type ThemeRole = (typeof THEME_ROLES)[number];

export interface ThemeTileDef {
  role: ThemeRole;
  tileType: TileType;
  spriteId?: string;
  hazardType?: string;
  hazardNotation?: string;
  /** Absolute or relative path to a PNG used as Tiled image for this tile.
   *  When present, the builder emits the tileset in "collection of images" mode. */
  imageFile?: string;
  /** Pixel dimensions of imageFile. Defaults to tileset tilewidth/tileheight. */
  imageWidth?: number;
  imageHeight?: number;
}

export interface Theme {
  key: string;
  name: string;
  description: string;
  tilesetName: string;
  tilewidth: number;
  tileheight: number;
  tiles: ThemeTileDef[];
  ambient?: {
    lightColor?: string;
    fogIntensity?: number;
  };
}
