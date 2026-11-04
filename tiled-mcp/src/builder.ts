// In-memory Tiled map builder. Each MapId is one map being composed during this server
// session. Maps are not persisted between restarts: call save_to_disk or export_json.
// The builder owns the tileset GIDs, the three tile layers and the two object groups.

import { randomUUID } from "node:crypto";
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

export const MAX_MAP_SIZE = 64;

export interface Occupant {
  name: string;
  type: string;
}

interface BuilderState {
  id: MapId;
  name: string;
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
  // "x,y" -> object or spawn standing on that cell
  occupied: Map<string, Occupant>;
  nextObjectId: number;
  createdAt: number;
}

const MAPS = new Map<MapId, BuilderState>();

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
  if (opts.width < 1 || opts.width > MAX_MAP_SIZE || opts.height < 1 || opts.height > MAX_MAP_SIZE) {
    throw new Error(
      `Map size out of range: ${opts.width}x${opts.height} (allowed 1..${MAX_MAP_SIZE} per side).`,
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

  const state: BuilderState = {
    id,
    name: opts.name,
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
    occupied: new Map(),
    nextObjectId: 1,
    createdAt: Date.now(),
  };

  MAPS.set(id, state);
  return { mapId: id, summary: summarize(state) };
}

export interface MapSummary {
  mapId: MapId;
  name: string;
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
  createdAt: number;
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
    width: state.width,
    height: state.height,
    orientation: state.orientation,
    theme: state.theme.key,
    tileCount: counts,
    objects: state.objects.objects.length,
    spawns: state.spawns.objects.length,
    createdAt: state.createdAt,
  };
}

export function getMap(id: MapId): BuilderState {
  const m = MAPS.get(id);
  if (!m) {
    throw new Error(
      `Unknown mapId '${id}'. Call create_map first, or list_maps to see the maps of this session (maps are lost when the server restarts).`,
    );
  }
  return m;
}

export function listMaps(): MapSummary[] {
  return Array.from(MAPS.values()).map((m) => summarize(m));
}

export function describeMap(id: MapId): MapSummary {
  return summarize(getMap(id));
}

export function discardMap(id: MapId): boolean {
  return MAPS.delete(id);
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

function assertInGrid(state: BuilderState, x: number, y: number, what = "Cell"): void {
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

// ---------- Serialization ----------

/** Returns a deep copy of the map as Tiled JSON, safe for callers to modify. */
export function serializeMap(id: MapId): TiledMap {
  const state = getMap(id);
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
    nextlayerid: 6,
    nextobjectid: state.nextObjectId,
    tilesets: [state.tileset],
    layers: [state.ground, state.walls, state.decorations, state.objects, state.spawns],
    properties: [
      { name: "theme", value: state.theme.key, type: "string" },
      { name: "mapName", value: state.name, type: "string" },
    ],
  };
  return structuredClone(map);
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
