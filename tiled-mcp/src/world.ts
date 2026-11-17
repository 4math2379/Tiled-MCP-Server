// Worlds: maps of one session linked to each other. A transition is an object carrying
// targetMap (a 'file' property: the target's .tmj file name) and targetSpawn (the name of an
// 'arrival' spawn in the target map). When the player steps on it, the game loads targetMap and
// puts the player on targetSpawn, which sits next to the transition leading back.
//
// place_building puts a building on an outdoor map (sprite, footprint, entrance) and creates its
// interior map with the exit back; link_maps joins any two maps with a door or stairs pair.

import { BUILDINGS, buildingSpriteFile, type BuildingType } from "./buildings.js";
import {
  allMaps,
  assertInGrid,
  assertPlaceable,
  buildingGid,
  buildingPlacement,
  createMap,
  discardMap,
  getMap,
  isTransition,
  mapRef,
  mapRefTarget,
  objectCoordMode,
  objectNameTaken,
  paintTile,
  placeObject,
  placeSpawn,
  type BuilderState,
  type MapId,
} from "./builder.js";
import { slugify, uniqueName } from "./names.js";
import { spriteExists } from "./sprites.js";
import { getTheme } from "./themes/index.js";
import { buildCastleFloor } from "./tools/layout-presets.js";
import { applyRoom } from "./tools/procedural.js";
import type { TiledObject, TiledProperty } from "./types.js";

export interface Cell {
  x: number;
  y: number;
}

const prop = (o: TiledObject, name: string) => o.properties?.find((p) => p.name === name)?.value;

/** Why a cell cannot take a building footprint, or undefined when it can. */
function footprintProblem(state: BuilderState, x: number, y: number): string | undefined {
  const i = y * state.width + x;
  if (!state.ground.data[i]) return `(${x}, ${y}) has no ground`;
  if (state.walls.data[i]) return `(${x}, ${y}) holds a wall`;
  const taken = state.occupied.get(`${x},${y}`);
  return taken ? `(${x}, ${y}) holds "${taken.name}" (${taken.type})` : undefined;
}

/** Re-throw a placement error with the context of what was being placed. */
function withContext<T>(what: string, fn: () => T): T {
  try {
    return fn();
  } catch (err) {
    throw new Error(`${what}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ---------- Buildings ----------

export interface PlaceBuildingOptions {
  type: BuildingType;
  /** Top corner (isometric) / top-left (orthogonal) cell of the square footprint. */
  x: number;
  y: number;
  name?: string;
  /** Footprint edge holding the door: south = bottom-left face, east = bottom-right face. */
  door?: "south" | "east";
  /** Create and link an interior map (default true). */
  interior?: boolean;
  interiorTheme?: string;
  interiorWidth?: number;
  interiorHeight?: number;
  /** Use assets/buildings/<type>__<variant>.png instead of <type>.png. */
  spriteVariant?: string;
}

/** Lays out an interior and returns its exit cell (a wall opening) and the cell just inside. */
function buildInterior(mapId: MapId, type: BuildingType): { exit: Cell; inside: Cell; layout: string } {
  if (type === "castle") {
    const { entrance, inside } = buildCastleFloor(mapId, "throne", { addPlayerSpawn: false, mainDoor: false });
    return { exit: entrance, inside, layout: "castle floor (antechamber, great hall, wings, throne room)" };
  }
  const state = getMap(mapId);
  const w = state.width;
  const h = state.height;
  applyRoom(mapId, 0, 0, w, h, [], { obstacleCorners: true });
  const exit = { x: Math.floor(w / 2), y: h - 1 };
  state.walls.data[exit.y * w + exit.x] = 0;
  paintTile(mapId, "ground", exit.x, exit.y, "walkable_floor");
  return { exit, inside: { x: exit.x, y: exit.y - 1 }, layout: "single room with props in the corners" };
}

export function placeBuilding(mapId: MapId, opts: PlaceBuildingOptions) {
  const state = getMap(mapId);
  const def = BUILDINGS[opts.type];
  const n = def.footprint;
  assertInGrid(state, opts.x, opts.y, "Footprint corner");
  assertInGrid(state, opts.x + n - 1, opts.y + n - 1, `Footprint corner (a ${opts.type} covers ${n}x${n} cells)`);

  const mid = Math.floor(n / 2);
  const side = opts.door ?? "south";
  const door = side === "south" ? { x: opts.x + mid, y: opts.y + n - 1 } : { x: opts.x + n - 1, y: opts.y + mid };
  const outside = side === "south" ? { x: door.x, y: door.y + 1 } : { x: door.x + 1, y: door.y };
  const withInterior = opts.interior !== false;

  // Validate everything before changing anything.
  const problems: string[] = [];
  for (let y = opts.y; y < opts.y + n; y++) {
    for (let x = opts.x; x < opts.x + n; x++) {
      const problem = footprintProblem(state, x, y);
      if (problem) problems.push(problem);
    }
  }
  if (problems.length) {
    const more = problems.length > 4 ? ` and ${problems.length - 4} more` : "";
    throw new Error(
      `The ${n}x${n} footprint of the ${opts.type} at (${opts.x}, ${opts.y}) is not free: ${problems.slice(0, 4).join("; ")}${more}. Paint ground there (paint_rect layer=ground) or move the building.`,
    );
  }
  if (withInterior) {
    withContext(`The cell in front of the ${opts.type}'s ${side} door`, () => assertPlaceable(mapId, outside.x, outside.y));
  }
  const interiorWidth = opts.interiorWidth ?? def.interiorWidth;
  const interiorHeight = opts.interiorHeight ?? def.interiorHeight;
  if (withInterior && opts.type === "castle" && (interiorWidth < 27 || interiorHeight < 20)) {
    throw new Error(`A castle interior needs at least 27x20 cells (got ${interiorWidth}x${interiorHeight}).`);
  }

  const existingIds = new Set(
    (state.buildings?.objects ?? []).map((o) => String(prop(o, "buildingId") ?? "")),
  );
  const count = (state.buildings?.objects ?? []).filter((o) => prop(o, "buildingType") === opts.type).length;
  const name = opts.name?.trim() || `${def.label} ${count + 1}`;
  const buildingId = uniqueName(
    slugify(name),
    (c) => existingIds.has(c) || objectNameTaken(state, `${c}-entrance`) || objectNameTaken(state, `${c}-outside`),
  );

  // The interior first: if it cannot be created (session map limit), the outdoor map is untouched.
  let interior: { state: BuilderState; exit: Cell; inside: Cell; layout: string } | undefined;
  if (withInterior) {
    const created = createMap({
      name: `${name} interior`,
      width: interiorWidth,
      height: interiorHeight,
      theme: getTheme(opts.interiorTheme ?? def.interiorTheme),
      orientation: state.orientation,
    });
    try {
      interior = { state: getMap(created.mapId), ...buildInterior(created.mapId, opts.type) };
    } catch (err) {
      discardMap(created.mapId);
      throw err;
    }
  }

  // Outdoor map: clear props under the footprint, then the sprite and the occupied cells.
  let clearedProps = 0;
  for (let y = opts.y; y < opts.y + n; y++) {
    for (let x = opts.x; x < opts.x + n; x++) {
      const i = y * state.width + x;
      if (state.decorations.data[i]) {
        state.decorations.data[i] = 0;
        clearedProps++;
      }
      state.occupied.set(`${x},${y}`, { name, type: "building" });
    }
  }
  const spriteFile = buildingSpriteFile(opts.type, opts.spriteVariant);
  const gid = buildingGid(state, spriteFile, def.imageWidth, def.imageHeight, opts.type);
  const properties: TiledProperty[] = [
    { name: "kind", value: "building", type: "string" },
    { name: "buildingType", value: opts.type, type: "string" },
    { name: "buildingId", value: buildingId, type: "string" },
    { name: "footprintX", value: opts.x, type: "int" },
    { name: "footprintY", value: opts.y, type: "int" },
    { name: "footprintSize", value: n, type: "int" },
  ];
  if (interior) properties.push({ name: "interiorMap", value: mapRef(interior.state.id), type: "file" });
  const objectId = state.nextObjectId++;
  state.buildings!.objects.push({
    id: objectId,
    gid,
    ...buildingPlacement(state, opts.x, opts.y, n),
    width: def.imageWidth,
    height: def.imageHeight,
    name,
    type: "building",
    visible: true,
    rotation: 0,
    properties,
  });

  const result = {
    buildingId,
    name,
    buildingType: opts.type,
    objectId,
    footprint: { x: opts.x, y: opts.y, size: n },
    sprite: {
      file: `assets/${spriteFile}`,
      exists: spriteExists(spriteFile),
      size: `${def.imageWidth}x${def.imageHeight}`,
    },
    clearedProps,
  };
  if (!interior) return { ...result, interior: null };

  // Entrance on the footprint edge, arrival point in front of it, exit and arrival inside.
  const outsideName = `${buildingId}-outside`;
  const insideName = `${buildingId}-inside`;
  const idProp: TiledProperty = { name: "buildingId", value: buildingId, type: "string" };
  placeObject(mapId, {
    ...door,
    kind: "entrance",
    state: "closed",
    name: `${buildingId}-entrance`,
    properties: [
      { name: "targetMap", value: mapRef(interior.state.id), type: "file" },
      { name: "targetSpawn", value: insideName, type: "string" },
      idProp,
    ],
  });
  placeSpawn(mapId, { ...outside, role: "arrival", name: outsideName });
  placeObject(interior.state.id, {
    ...interior.exit,
    kind: "exit",
    state: "closed",
    name: `${buildingId}-exit`,
    properties: [
      { name: "targetMap", value: mapRef(mapId), type: "file" },
      { name: "targetSpawn", value: outsideName, type: "string" },
      idProp,
    ],
  });
  placeSpawn(interior.state.id, { ...interior.inside, role: "arrival", name: insideName });
  interior.state.properties.push(idProp, { name: "parentMap", value: mapRef(mapId), type: "file" });

  return {
    ...result,
    entrance: { ...door, name: `${buildingId}-entrance` },
    outsideArrival: { ...outside, name: outsideName },
    interior: {
      mapId: interior.state.id,
      name: interior.state.name,
      fileName: interior.state.fileName,
      theme: interior.state.theme.key,
      width: interior.state.width,
      height: interior.state.height,
      layout: interior.layout,
      exit: { ...interior.exit, name: `${buildingId}-exit` },
      insideArrival: { ...interior.inside, name: insideName },
    },
  };
}

// ---------- Links between any two maps ----------

export interface LinkEnd {
  mapId: MapId;
  x: number;
  y: number;
  arrival?: Cell;
}

/** Cells around (x, y) where an arrival point may stand, nearest first. */
function neighbours(x: number, y: number): Cell[] {
  return [
    { x, y: y + 1 },
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y - 1 },
  ];
}

function canStand(state: BuilderState, c: Cell, avoid: Cell[]): boolean {
  if (c.x < 0 || c.y < 0 || c.x >= state.width || c.y >= state.height) return false;
  if (avoid.some((a) => a.x === c.x && a.y === c.y)) return false;
  try {
    assertPlaceable(state.id, c.x, c.y);
    return true;
  } catch {
    return false;
  }
}

/** Checks a transition cell and picks its arrival cell; changes nothing. */
function planEnd(end: LinkEnd, kind: "door" | "stairs", label: string, avoid: Cell[]): Cell {
  const state = getMap(end.mapId);
  assertInGrid(state, end.x, end.y, `${label} cell`);
  const i = end.y * state.width + end.x;
  const taken = state.occupied.get(`${end.x},${end.y}`);
  if (taken) throw new Error(`${label} cell (${end.x}, ${end.y}) is already occupied by "${taken.name}" (${taken.type}).`);
  if (kind === "stairs") {
    withContext(`${label} cell`, () => assertPlaceable(end.mapId, end.x, end.y));
  } else if (!state.ground.data[i] && !state.walls.data[i]) {
    throw new Error(`${label} cell (${end.x}, ${end.y}) is outside every room: put the door in a wall or on painted ground.`);
  }
  const trigger = { x: end.x, y: end.y };
  if (end.arrival) {
    if (!canStand(state, end.arrival, [trigger, ...avoid])) {
      withContext(`${label} arrival cell`, () => assertPlaceable(end.mapId, end.arrival!.x, end.arrival!.y));
      throw new Error(`${label} arrival cell (${end.arrival.x}, ${end.arrival.y}) must differ from the ${kind} cell.`);
    }
    return end.arrival;
  }
  const pick = neighbours(end.x, end.y).find((c) => canStand(state, c, [trigger, ...avoid]));
  if (!pick) {
    throw new Error(
      `${label}: no free floor cell next to (${end.x}, ${end.y}) for the arrival point. Free a neighbouring cell or pass the arrival cell explicitly.`,
    );
  }
  return pick;
}

/**
 * Joins two maps both ways with a door or stairs object on each side. Each object leads to the
 * other map's arrival point, placed next to the object leading back.
 */
export function linkMaps(from: LinkEnd, to: LinkEnd, kind: "door" | "stairs", name?: string) {
  const a = getMap(from.mapId);
  const b = getMap(to.mapId);
  const same = a.id === b.id;
  if (same && from.x === to.x && from.y === to.y) throw new Error("Both ends of the link are the same cell.");
  const arrivalA = planEnd(from, kind, "From", same ? [{ x: to.x, y: to.y }] : []);
  const arrivalB = planEnd(to, kind, "To", same ? [{ x: from.x, y: from.y }, arrivalA] : []);

  const nameA = uniqueName(
    slugify(name ?? `${kind}-to-${b.name}`),
    (c) => objectNameTaken(a, c) || objectNameTaken(a, `${c}-arrival`),
  );
  const nameB = uniqueName(
    slugify(name ? `${name}-back` : `${kind}-to-${a.name}`),
    (c) => objectNameTaken(b, c) || objectNameTaken(b, `${c}-arrival`) || (same && c === nameA),
  );

  const place = (end: LinkEnd, objName: string, target: BuilderState, targetSpawn: string, arrival: Cell, arrivalName: string) => {
    const state = getMap(end.mapId);
    if (kind === "door") {
      const i = end.y * state.width + end.x;
      state.walls.data[i] = 0;
      if (!state.ground.data[i]) paintTile(end.mapId, "ground", end.x, end.y, "walkable_floor");
    }
    placeObject(end.mapId, {
      x: end.x,
      y: end.y,
      kind,
      state: kind === "stairs" ? "open" : "closed",
      name: objName,
      properties: [
        { name: "targetMap", value: mapRef(target.id), type: "file" },
        { name: "targetSpawn", value: targetSpawn, type: "string" },
      ],
    });
    placeSpawn(end.mapId, { ...arrival, role: "arrival", name: arrivalName });
  };
  place(from, nameA, b, `${nameB}-arrival`, arrivalA, `${nameA}-arrival`);
  place(to, nameB, a, `${nameA}-arrival`, arrivalB, `${nameB}-arrival`);

  const describe = (s: BuilderState, end: LinkEnd, objName: string, arrival: Cell) => ({
    mapId: s.id,
    fileName: s.fileName,
    object: { name: objName, x: end.x, y: end.y },
    arrival: { name: `${objName}-arrival`, ...arrival },
  });
  return { kind, from: describe(a, from, nameA, arrivalA), to: describe(b, to, nameB, arrivalB) };
}

// ---------- World graph, validation ----------

/** Map ids this map's objects, buildings and properties link to. */
function linkedIds(state: BuilderState): MapId[] {
  const ids: MapId[] = [];
  const scan = (props: TiledProperty[] | undefined) => {
    for (const p of props ?? []) {
      const target = mapRefTarget(p.value);
      if (target !== undefined) ids.push(target);
    }
  };
  for (const o of [...state.objects.objects, ...(state.buildings?.objects ?? [])]) scan(o.properties);
  scan(state.properties);
  return ids;
}

/** Every map connected to `mapId` through links in either direction, the map itself first. */
export function worldOf(mapId: MapId): BuilderState[] {
  const start = getMap(mapId);
  const all = allMaps();
  const neighboursOf = new Map<MapId, Set<MapId>>(all.map((s) => [s.id, new Set<MapId>()]));
  for (const s of all) {
    for (const t of linkedIds(s)) {
      if (!neighboursOf.has(t)) continue;
      neighboursOf.get(s.id)!.add(t);
      neighboursOf.get(t)!.add(s.id);
    }
  }
  const seen = new Set<MapId>([start.id]);
  const queue = [start.id];
  while (queue.length) {
    for (const next of neighboursOf.get(queue.shift()!) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return all.filter((s) => seen.has(s.id)).sort((x, y) => (x.id === start.id ? -1 : y.id === start.id ? 1 : x.createdAt - y.createdAt));
}

/** Grid cell of an object written by this server, from its stored position. */
function objectCell(state: BuilderState, o: TiledObject): Cell {
  const tw = state.tilewidth;
  const th = state.tileheight;
  if (state.orientation === "orthogonal") return { x: Math.floor(o.x / tw), y: Math.floor(o.y / th) };
  if (objectCoordMode() === "screen") {
    return {
      x: Math.floor((o.x / (tw / 2) + o.y / (th / 2)) / 2),
      y: Math.floor((o.y / (th / 2) - o.x / (tw / 2)) / 2),
    };
  }
  return { x: Math.floor(o.x / th), y: Math.floor(o.y / th) };
}

const hasRole = (state: BuilderState, role: string) =>
  state.spawns.objects.some((o) => prop(o, "role") === role);

/** Checks every link of the world `mapId` belongs to (or of every map in the session). */
export function validateWorld(mapId?: MapId) {
  const members = mapId ? worldOf(mapId) : allMaps();
  const byId = new Map(allMaps().map((s) => [s.id, s]));
  const errors: string[] = [];
  const warnings: string[] = [];
  const links: Array<Record<string, unknown>> = [];

  for (const s of members) {
    for (const o of s.objects.objects.filter(isTransition)) {
      const targetId = mapRefTarget(prop(o, "targetMap"));
      const target = targetId ? byId.get(targetId) : undefined;
      const spawn = prop(o, "targetSpawn");
      links.push({
        from: s.fileName,
        object: o.name,
        kind: prop(o, "kind"),
        cell: objectCell(s, o),
        to: target?.fileName ?? null,
        targetSpawn: spawn ?? null,
      });
      if (!target) {
        errors.push(`"${o.name}" on ${s.fileName} leads to a map that is no longer in this session (discarded).`);
        continue;
      }
      if (!spawn) {
        errors.push(`"${o.name}" on ${s.fileName} has no targetSpawn.`);
      } else if (!target.spawns.objects.some((sp) => sp.name === spawn)) {
        errors.push(`"${o.name}" on ${s.fileName} sends the player to "${spawn}", which ${target.fileName} does not have.`);
      }
      if (!target.objects.objects.some((t) => mapRefTarget(prop(t, "targetMap")) === s.id)) {
        warnings.push(`${target.fileName} has no way back to ${s.fileName} ("${o.name}" is one-way).`);
      }
    }
    if (!hasRole(s, "player") && !hasRole(s, "arrival")) {
      warnings.push(`${s.fileName} has neither a player spawn nor an arrival point: nothing leads into it.`);
    }
    for (const tile of s.buildingTileset?.tiles ?? []) {
      const file = tile.image?.replace(/^\.\/assets\//, "");
      if (file && !spriteExists(file)) {
        warnings.push(
          `Building sprite assets/${file} is missing: generate it with generate_building_sprite (paid), otherwise Tiled and the preview show a placeholder.`,
        );
      }
    }
  }
  const startMaps = members.filter((s) => hasRole(s, "player")).map((s) => s.fileName);
  if (members.length && !startMaps.length) {
    warnings.push("No map of this world has a player spawn: add one where the game starts (place_spawn_player).");
  }
  return {
    ok: errors.length === 0,
    maps: members.map((s) => ({
      mapId: s.id,
      name: s.name,
      fileName: s.fileName,
      theme: s.theme.key,
      size: `${s.width}x${s.height}`,
      buildings: s.buildings?.objects.length ?? 0,
      transitions: s.objects.objects.filter(isTransition).length,
    })),
    startMaps,
    links,
    errors,
    warnings: [...new Set(warnings)],
  };
}
