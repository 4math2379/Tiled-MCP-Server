// In-memory Tiled map builder. Each MapId is one map being composed during this server
// session. Maps are not persisted between restarts: call save_to_disk or export_json.
// The builder owns the tileset GIDs, the three tile layers and the two object groups.
// Maps live in the caller's workspace (src/context.ts): one per MCP session in hosted mode.

import { randomUUID } from "node:crypto";
import { currentScope, isHosted } from "./context.js";
import { slugify, uniqueName } from "./names.js";
import type {
  Theme,
  ThemeRole,
  TiledMap,
  TiledObject,
  TiledObjectGroup,
  TiledProperty,
  TiledTileLayer,
  TiledTileset,
  TiledTilesetTile,
  ObjectKind,
  ObjectState,
  SpawnRole,
} from "./types.js";

export type MapId = string;

/** Largest map side when TILED_MAX_MAP_SIZE is not set: 256 locally, 128 on a shared server. */
export const DEFAULT_MAX_MAP_SIZE = 256;
export const DEFAULT_HOSTED_MAX_MAP_SIZE = 128;
const MAX_MAP_SIZE_CEILING = 1024;

/** Largest allowed map side in cells (TILED_MAX_MAP_SIZE, 16..1024, overrides the default). */
export function maxMapSize(): number {
  const configured = Number(process.env.TILED_MAX_MAP_SIZE);
  if (Number.isInteger(configured) && configured >= 16) return Math.min(configured, MAX_MAP_SIZE_CEILING);
  return isHosted() ? DEFAULT_HOSTED_MAX_MAP_SIZE : DEFAULT_MAX_MAP_SIZE;
}

/**
 * Links between maps are stored as "map:<mapId>" in 'file' properties while the maps live in
 * memory, and written as the target's file name (e.g. "house-1.tmj") by serializeMap, so they
 * resolve when the linked maps are saved side by side (save_world).
 */
const MAP_REF_PREFIX = "map:";

export function mapRef(id: MapId): string {
  return `${MAP_REF_PREFIX}${id}`;
}

/** mapId behind a stored link value, or undefined when the value is not a map link. */
export function mapRefTarget(value: unknown): MapId | undefined {
  return typeof value === "string" && value.startsWith(MAP_REF_PREFIX) ? value.slice(MAP_REF_PREFIX.length) : undefined;
}

export interface Occupant {
  name: string;
  type: string;
}

export interface BuilderState {
  id: MapId;
  name: string;
  /** File name this map is written under by save_world and used by links pointing to it. */
  fileName: string;
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  orientation: "isometric" | "orthogonal";
  theme: Theme;
  tileset: TiledTileset;
  // role -> gid, resolved once at creation
  roleToGid: Map<ThemeRole, number>;
  ground: TiledTileLayer;
  walls: TiledTileLayer;
  decorations: TiledTileLayer;
  objects: TiledObjectGroup;
  spawns: TiledObjectGroup;
  /** Building sprites as tile objects; created with the first building (layer id 6). */
  buildings?: TiledObjectGroup;
  /** Image-collection tileset of the building sprites, after the theme tileset. */
  buildingTileset?: TiledTileset;
  /** sprite file ("buildings/house.png") -> gid in buildingTileset */
  buildingGids: Map<string, number>;
  /** Extra map properties, e.g. buildingId and parentMap on an interior. */
  properties: TiledProperty[];
  // "x,y" -> object or spawn standing on that cell
  occupied: Map<string, Occupant>;
  nextObjectId: number;
  createdAt: number;
}

/** Maps of the current caller's workspace. */
function maps(): Map<MapId, BuilderState> {
  return currentScope().workspace.maps;
}

/** In hosted mode, how many maps one session may hold, so one caller cannot fill the shared memory. */
export const MAX_HOSTED_MAPS = 20;

const TILED_VERSION = "1.10.2";
const FORMAT_VERSION = "1.10";

export interface CreateOptions {
  name: string;
  width: number;
  height: number;
  theme: Theme;
  orientation?: "isometric" | "orthogonal";
}

export function createMap(opts: CreateOptions): { mapId: MapId; summary: MapSummary } {
  const max = maxMapSize();
  if (opts.width < 1 || opts.width > max || opts.height < 1 || opts.height > max) {
    throw new Error(`Map size out of range: ${opts.width}x${opts.height} (allowed 1..${max} per side).`);
  }
  if (isHosted() && maps().size >= MAX_HOSTED_MAPS) {
    throw new Error(
      `This session already holds ${MAX_HOSTED_MAPS} maps, the limit on the hosted server: discard_map the ones you no longer need.`,
    );
  }

  const id = randomUUID();
  const orientation = opts.orientation ?? "isometric";
  const theme = opts.theme;
  const firstgid = 1;

  const usesImages = theme.tiles.some((t) => t.imageFile);

  const tiles: TiledTilesetTile[] = theme.tiles.map((t, idx) => {
    const props: TiledProperty[] = [{ name: "tileType", value: t.tileType, type: "string" }];
    if (t.spriteId) props.push({ name: "spriteId", value: t.spriteId, type: "string" });
    if (t.tileType === "HAZARD") {
      if (t.hazardType) props.push({ name: "hazardType", value: t.hazardType, type: "string" });
      if (t.hazardNotation) {
        props.push({ name: "hazardNotation", value: t.hazardNotation, type: "string" });
      }
    }
    const tile: TiledTilesetTile = { id: idx, properties: props };
    if (t.imageFile) {
      tile.image = t.imageFile;
      tile.imagewidth = t.imageWidth ?? theme.tilewidth;
      tile.imageheight = t.imageHeight ?? theme.tileheight;
    }
    return tile;
  });

  const tileset: TiledTileset = {
    firstgid,
    name: theme.tilesetName,
    tilewidth: theme.tilewidth,
    tileheight: theme.tileheight,
    tilecount: tiles.length,
    columns: usesImages ? 0 : Math.max(1, Math.min(tiles.length, 8)),
    tiles,
  };
  if (usesImages) {
    tileset.grid = { orientation, width: theme.tilewidth, height: theme.tileheight };
  }

  const roleToGid = new Map<ThemeRole, number>();
  theme.tiles.forEach((t, idx) => {
    if (!roleToGid.has(t.role)) roleToGid.set(t.role, firstgid + idx);
  });

  const emptyData = (): number[] => new Array(opts.width * opts.height).fill(0);

  const mkTileLayer = (layerId: number, name: string): TiledTileLayer => ({
    id: layerId,
    name,
    type: "tilelayer",
    visible: true,
    width: opts.width,
    height: opts.height,
    data: emptyData(),
    opacity: 1,
    x: 0,
    y: 0,
  });
  const mkObjectGroup = (layerId: number, name: string): TiledObjectGroup => ({
    id: layerId,
    name,
    type: "objectgroup",
    visible: true,
    objects: [],
    opacity: 1,
    x: 0,
    y: 0,
    draworder: "topdown",
  });

  const takenFiles = new Set(Array.from(maps().values(), (m) => m.fileName));
  const state: BuilderState = {
    id,
    name: opts.name,
    fileName: `${uniqueName(slugify(opts.name), (c) => takenFiles.has(`${c}.tmj`))}.tmj`,
    width: opts.width,
    height: opts.height,
    tilewidth: theme.tilewidth,
    tileheight: theme.tileheight,
    orientation,
    theme,
    tileset,
    roleToGid,
    ground: mkTileLayer(1, "ground"),
    walls: mkTileLayer(2, "walls"),
    decorations: mkTileLayer(3, "decorations"),
    objects: mkObjectGroup(4, "objects"),
    spawns: mkObjectGroup(5, "spawns"),
    buildingGids: new Map(),
    properties: [],
    occupied: new Map(),
    nextObjectId: 1,
    createdAt: Date.now(),
  };

  maps().set(id, state);
  return { mapId: id, summary: summarize(state) };
}

export interface MapSummary {
  mapId: MapId;
  name: string;
  fileName: string;
  width: number;
  height: number;
  orientation: "isometric" | "orthogonal";
  theme: string;
  tileCount: {
    walkable: number;
    wall: number;
    difficultTerrain: number;
    hazard: number;
    door: number;
    obstacle: number;
    stairs: number;
  };
  objects: number;
  spawns: number;
  buildings: number;
  /** Objects that lead to another map (entrances, exits, linked doors and stairs). */
  transitions: number;
  createdAt: number;
}

/** True when the object leads to another map. */
export function isTransition(obj: TiledObject): boolean {
  return obj.properties?.some((p) => p.name === "targetMap") ?? false;
}

function summarize(state: BuilderState): MapSummary {
  const counts = {
    walkable: 0,
    wall: 0,
    difficultTerrain: 0,
    hazard: 0,
    door: 0,
    obstacle: 0,
    stairs: 0,
  };
  for (const data of [state.ground.data, state.walls.data, state.decorations.data]) {
    for (const gid of data) {
      if (gid === 0) continue;
      const tile = state.theme.tiles[gid - state.tileset.firstgid];
      if (!tile) continue;
      switch (tile.tileType) {
        case "WALKABLE":
          counts.walkable++;
          break;
        case "WALL":
          counts.wall++;
          break;
        case "DIFFICULT_TERRAIN":
          counts.difficultTerrain++;
          break;
        case "HAZARD":
          counts.hazard++;
          break;
        case "DOOR":
          counts.door++;
          break;
        case "OBSTACLE":
          counts.obstacle++;
          break;
        case "STAIRS":
          counts.stairs++;
          break;
      }
    }
  }
  return {
    mapId: state.id,
    name: state.name,
    fileName: state.fileName,
    width: state.width,
    height: state.height,
    orientation: state.orientation,
    theme: state.theme.key,
    tileCount: counts,
    objects: state.objects.objects.length,
    spawns: state.spawns.objects.length,
    buildings: state.buildings?.objects.length ?? 0,
    transitions: state.objects.objects.filter(isTransition).length,
    createdAt: state.createdAt,
  };
}

/** Every map of the current caller's workspace (hosted: one MCP session). */
export function allMaps(): BuilderState[] {
  return Array.from(maps().values());
}

export function getMap(id: MapId): BuilderState {
  const m = maps().get(id);
  if (!m) {
    throw new Error(
      `Unknown mapId '${id}'. Call create_map first, or list_maps to see the maps of this session (maps are lost when the server restarts).`,
    );
  }
  return m;
}

export function listMaps(): MapSummary[] {
  return Array.from(maps().values()).map((m) => summarize(m));
}

export function describeMap(id: MapId): MapSummary {
  return summarize(getMap(id));
}

export function discardMap(id: MapId): boolean {
  return maps().delete(id);
}

// ---------- Tile editing ----------

export function gidForRole(state: BuilderState, role: ThemeRole): number {
  const gid = state.roleToGid.get(role);
  if (!gid) {
    throw new Error(
      `Theme '${state.theme.key}' does not define the role '${role}'. Call list_themes to see the roles of each theme.`,
    );
  }
  return gid;
}

export type LayerName = "ground" | "walls" | "decorations";

export function assertInGrid(state: BuilderState, x: number, y: number, what = "Cell"): void {
  if (x < 0 || x >= state.width || y < 0 || y >= state.height) {
    throw new Error(
      `${what} (${x}, ${y}) is outside the ${state.width}x${state.height} grid (valid x: 0..${state.width - 1}, y: 0..${state.height - 1}).`,
    );
  }
}

export function paintTile(id: MapId, layer: LayerName, x: number, y: number, role: ThemeRole): void {
  const state = getMap(id);
  assertInGrid(state, x, y);
  const gid = gidForRole(state, role);
  state[layer].data[y * state.width + x] = gid;
}

export function eraseTile(id: MapId, layer: LayerName, x: number, y: number): void {
  const state = getMap(id);
  assertInGrid(state, x, y);
  state[layer].data[y * state.width + x] = 0;
}

export function paintRect(
  id: MapId,
  layer: LayerName,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  role: ThemeRole,
): number {
  const state = getMap(id);
  const xa = Math.min(x1, x2);
  const xb = Math.max(x1, x2);
  const ya = Math.min(y1, y2);
  const yb = Math.max(y1, y2);
  assertInGrid(state, xa, ya, "Rectangle corner");
  assertInGrid(state, xb, yb, "Rectangle corner");
  const gid = gidForRole(state, role);
  let painted = 0;
  for (let y = ya; y <= yb; y++) {
    for (let x = xa; x <= xb; x++) {
      state[layer].data[y * state.width + x] = gid;
      painted++;
    }
  }
  return painted;
}

export function paintWallBorder(id: MapId, x1: number, y1: number, x2: number, y2: number): number {
  const state = getMap(id);
  const xa = Math.min(x1, x2);
  const xb = Math.max(x1, x2);
  const ya = Math.min(y1, y2);
  const yb = Math.max(y1, y2);
  assertInGrid(state, xa, ya, "Rectangle corner");
  assertInGrid(state, xb, yb, "Rectangle corner");
  let painted = 0;
  const wallGid = gidForRole(state, "wall");
  for (let x = xa; x <= xb; x++) {
    state.walls.data[ya * state.width + x] = wallGid;
    state.walls.data[yb * state.width + x] = wallGid;
    painted += 2;
  }
  for (let y = ya + 1; y < yb; y++) {
    state.walls.data[y * state.width + xa] = wallGid;
    state.walls.data[y * state.width + xb] = wallGid;
    painted += 2;
  }
  return painted;
}

// ---------- Objects & spawns ----------

/**
 * How object and spawn positions are written to the .tmj (see docs/map-format.md).
 *
 * - "tiled" (default): Tiled's native encoding. On isometric maps Tiled stores object
 *   positions in an unprojected space where BOTH axes use the tile height:
 *   x = col * tileheight, y = row * tileheight (Tiled's IsometricRenderer::tileToPixelCoords).
 *   Interactive objects are one-tile rectangles anchored on the tile's top corner and spawns
 *   are point objects at the tile centre, so everything lands on the right tile in Tiled.
 *   Inverse: col = floor(x / tileheight), row = floor(y / tileheight).
 * - "screen": the encoding of earlier versions of this server, kept for importers that decode
 *   screen-space positions: x = tilewidth/2 * (col - row), y = tileheight/2 * (col + row),
 *   with no origin offset. Tiled itself does not place these on the right tiles.
 *
 * Orthogonal maps always use x = col * tilewidth, y = row * tileheight.
 */
export type ObjectCoordMode = "tiled" | "screen";

export function objectCoordMode(): ObjectCoordMode {
  return process.env.TILED_OBJECT_COORDS?.trim().toLowerCase() === "screen" ? "screen" : "tiled";
}

type Placement = Pick<TiledObject, "x" | "y" | "width" | "height" | "point">;

function placementFor(state: BuilderState, col: number, row: number, as: "object" | "spawn"): Placement {
  const tw = state.tilewidth;
  const th = state.tileheight;
  if (state.orientation === "orthogonal") {
    return as === "spawn"
      ? { x: (col + 0.5) * tw, y: (row + 0.5) * th, point: true }
      : { x: col * tw, y: row * th, width: tw, height: th };
  }
  if (objectCoordMode() === "screen") {
    const pos = { x: (tw / 2) * (col - row), y: (th / 2) * (col + row) };
    return as === "spawn" ? pos : { ...pos, width: tw, height: th };
  }
  return as === "spawn"
    ? { x: (col + 0.5) * th, y: (row + 0.5) * th, point: true }
    : { x: col * th, y: row * th, width: th, height: th };
}

/**
 * Throws when a spawn, chest, trap or lever would land on a wall, an unpainted cell or a cell
 * already holding an object or spawn. Walls sit on their own layer above a walkable ground tile,
 * so the ground layer alone cannot tell; models placing objects blindly get an actionable error
 * instead of a broken map.
 */
export function assertPlaceable(id: MapId, x: number, y: number): void {
  const state = getMap(id);
  assertInGrid(state, x, y);
  const i = y * state.width + x;
  if (state.walls.data[i]) {
    throw new Error(
      `Cell (${x}, ${y}) holds a wall: pick a floor cell inside a room (check with get_tile_info layer=walls).`,
    );
  }
  if (!state.ground.data[i]) {
    throw new Error(`Cell (${x}, ${y}) has no ground tile (it is outside every room): pick a painted floor cell.`);
  }
  const deco = state.decorations.data[i];
  if (deco && state.theme.tiles[deco - state.tileset.firstgid]?.tileType === "OBSTACLE") {
    throw new Error(`Cell (${x}, ${y}) holds an obstacle prop on the decorations layer: pick a free floor cell.`);
  }
  const taken = state.occupied.get(`${x},${y}`);
  if (taken) {
    throw new Error(
      `Cell (${x}, ${y}) is already occupied by "${taken.name}" (${taken.type}): pick a neighbouring cell.`,
    );
  }
}

export interface PlaceObjectOptions {
  x: number;
  y: number;
  kind: ObjectKind;
  state?: ObjectState;
  name?: string;
  pickDC?: number;
  targetZoneId?: string;
  trapType?: string;
  trapNotation?: string;
  trapSaveDC?: number;
  /** Extra properties written after the standard ones, e.g. targetMap and targetSpawn. */
  properties?: TiledProperty[];
}

export function placeObject(id: MapId, opts: PlaceObjectOptions): number {
  const state = getMap(id);
  assertInGrid(state, opts.x, opts.y, "Object");
  const objectId = state.nextObjectId++;
  const properties: TiledProperty[] = [
    { name: "kind", value: opts.kind, type: "string" },
    { name: "state", value: opts.state ?? "closed", type: "string" },
  ];
  if (opts.pickDC !== undefined) {
    properties.push({ name: "pickDC", value: opts.pickDC, type: "int" });
  }
  if (opts.targetZoneId) {
    properties.push({ name: "targetZoneId", value: opts.targetZoneId, type: "string" });
  }
  if (opts.trapType && opts.trapNotation) {
    properties.push({ name: "trapType", value: opts.trapType, type: "string" });
    properties.push({ name: "trapNotation", value: opts.trapNotation, type: "string" });
  }
  if (opts.trapSaveDC !== undefined) {
    properties.push({ name: "trapSaveDC", value: opts.trapSaveDC, type: "int" });
  }
  if (opts.properties) properties.push(...opts.properties);
  const name = opts.name ?? `${opts.kind}-${objectId}`;
  const obj: TiledObject = {
    id: objectId,
    ...placementFor(state, opts.x, opts.y, "object"),
    name,
    type: opts.kind,
    visible: true,
    rotation: 0,
    properties,
  };
  state.objects.objects.push(obj);
  state.occupied.set(`${opts.x},${opts.y}`, { name, type: opts.kind });
  return objectId;
}

export interface PlaceSpawnOptions {
  x: number;
  y: number;
  role: SpawnRole;
  name?: string;
  encounterId?: string;
  npcName?: string;
}

export function placeSpawn(id: MapId, opts: PlaceSpawnOptions): number {
  const state = getMap(id);
  assertInGrid(state, opts.x, opts.y, "Spawn");
  const objectId = state.nextObjectId++;
  const properties: TiledProperty[] = [{ name: "role", value: opts.role, type: "string" }];
  if (opts.encounterId) {
    properties.push({ name: "encounterId", value: opts.encounterId, type: "string" });
  }
  if (opts.npcName) {
    properties.push({ name: "npcName", value: opts.npcName, type: "string" });
  }
  const name = opts.name ?? `${opts.role}-${objectId}`;
  const obj: TiledObject = {
    id: objectId,
    ...placementFor(state, opts.x, opts.y, "spawn"),
    name,
    type: opts.role,
    visible: true,
    rotation: 0,
    properties,
  };
  state.spawns.objects.push(obj);
  state.occupied.set(`${opts.x},${opts.y}`, { name, type: `${opts.role} spawn` });
  return objectId;
}

/** True when any object, spawn or building of the map already uses `name`. */
export function objectNameTaken(state: BuilderState, name: string): boolean {
  const groups = [state.objects, state.spawns, ...(state.buildings ? [state.buildings] : [])];
  return groups.some((g) => g.objects.some((o) => o.name === name));
}

// ---------- Buildings ----------

/**
 * gid of a building sprite in this map's building tileset, adding the tileset (after the theme
 * tileset) and the 'buildings' layer the first time. `file` is below the assets root,
 * e.g. "buildings/house.png".
 */
export function buildingGid(
  state: BuilderState,
  file: string,
  imageWidth: number,
  imageHeight: number,
  buildingType: string,
): number {
  const known = state.buildingGids.get(file);
  if (known) return known;
  if (!state.buildingTileset) {
    state.buildingTileset = {
      firstgid: state.tileset.firstgid + state.tileset.tilecount,
      name: "buildings",
      tilewidth: state.tilewidth,
      tileheight: state.tileheight,
      tilecount: 0,
      columns: 0,
      grid: { orientation: state.orientation, width: state.tilewidth, height: state.tileheight },
      objectalignment: "bottom",
      tiles: [],
    };
  }
  if (!state.buildings) {
    state.buildings = {
      id: 6,
      name: "buildings",
      type: "objectgroup",
      visible: true,
      objects: [],
      opacity: 1,
      x: 0,
      y: 0,
      draworder: "topdown",
    };
  }
  const ts = state.buildingTileset;
  const localId = ts.tilecount;
  ts.tiles!.push({
    id: localId,
    image: `./assets/${file}`,
    imagewidth: imageWidth,
    imageheight: imageHeight,
    properties: [
      { name: "tileType", value: "BUILDING", type: "string" },
      { name: "buildingType", value: buildingType, type: "string" },
    ],
  });
  ts.tilecount++;
  const gid = ts.firstgid + localId;
  state.buildingGids.set(file, gid);
  return gid;
}

/**
 * Position of a building tile object whose square footprint starts at cell (x, y) and spans
 * `size` cells. The building tileset anchors images at their bottom centre, so the object sits
 * on the footprint's bottom corner (isometric) or the middle of its bottom edge (orthogonal).
 */
export function buildingPlacement(state: BuilderState, x: number, y: number, size: number): { x: number; y: number } {
  const tw = state.tilewidth;
  const th = state.tileheight;
  if (state.orientation === "orthogonal") return { x: (x + size / 2) * tw, y: (y + size) * th };
  const col = x + size;
  const row = y + size;
  if (objectCoordMode() === "screen") return { x: (tw / 2) * (col - row), y: (th / 2) * (col + row) };
  return { x: col * th, y: row * th };
}

// ---------- Serialization ----------

/** Rewrite "map:<mapId>" link values as the target map's file name ("" if it was discarded). */
function resolveMapRefs(objects: TiledObject[] | undefined, properties: TiledProperty[] | undefined): void {
  const fix = (props: TiledProperty[] | undefined) => {
    for (const p of props ?? []) {
      const target = mapRefTarget(p.value);
      if (target !== undefined) p.value = maps().get(target)?.fileName ?? "";
    }
  };
  for (const o of objects ?? []) fix(o.properties);
  fix(properties);
}

/** Returns a deep copy of the map as Tiled JSON, safe for callers to modify. */
export function serializeMap(id: MapId): TiledMap {
  const state = getMap(id);
  const tilesets = state.buildingTileset ? [state.tileset, state.buildingTileset] : [state.tileset];
  const layers = state.buildings
    ? [state.ground, state.walls, state.decorations, state.buildings, state.objects, state.spawns]
    : [state.ground, state.walls, state.decorations, state.objects, state.spawns];
  const map: TiledMap = {
    type: "map",
    version: FORMAT_VERSION,
    tiledversion: TILED_VERSION,
    orientation: state.orientation,
    renderorder: "right-down",
    width: state.width,
    height: state.height,
    tilewidth: state.tilewidth,
    tileheight: state.tileheight,
    infinite: false,
    nextlayerid: state.buildings ? 7 : 6,
    nextobjectid: state.nextObjectId,
    tilesets,
    layers,
    properties: [
      { name: "theme", value: state.theme.key, type: "string" },
      { name: "mapName", value: state.name, type: "string" },
      ...state.properties,
    ],
  };
  const copy = structuredClone(map);
  for (const layer of copy.layers) {
    if (layer.type === "objectgroup") resolveMapRefs(layer.objects, undefined);
  }
  resolveMapRefs(undefined, copy.properties);
  return copy;
}

// ---------- Per-map sprite overrides & inspection ----------

/**
 * Point one role of this map's tileset at another image, for example the contextual variant
 * `obstacle_decor__alembic.png` for a laboratory. Only the in-memory tileset of this map
 * changes; other maps and the theme definition are untouched.
 */
export function overrideTileImage(
  id: MapId,
  role: ThemeRole,
  imagePath: string,
  imageWidth?: number,
  imageHeight?: number,
): void {
  const state = getMap(id);
  const gid = state.roleToGid.get(role);
  if (!gid) {
    throw new Error(`Role '${role}' is not defined by theme '${state.theme.key}'.`);
  }
  const localId = gid - state.tileset.firstgid;
  const tile = state.tileset.tiles?.[localId];
  if (!tile) {
    throw new Error(`Tile #${localId} not found in the tileset.`);
  }
  tile.image = imagePath;
  if (imageWidth !== undefined) tile.imagewidth = imageWidth;
  if (imageHeight !== undefined) tile.imageheight = imageHeight;
}

export function getTileInfo(
  id: MapId,
  layer: LayerName,
  x: number,
  y: number,
): { gid: number; role?: ThemeRole; tileType?: string; spriteId?: string; occupiedBy?: Occupant } {
  const state = getMap(id);
  assertInGrid(state, x, y);
  const gid = state[layer].data[y * state.width + x];
  const occupied = state.occupied.get(`${x},${y}`);
  const occupiedBy = occupied ? { occupiedBy: occupied } : {};
  if (gid === 0) return { gid: 0, ...occupiedBy };
  const def = state.theme.tiles[gid - state.tileset.firstgid];
  if (!def) return { gid, ...occupiedBy };
  return { gid, role: def.role, tileType: def.tileType, spriteId: def.spriteId, ...occupiedBy };
}
