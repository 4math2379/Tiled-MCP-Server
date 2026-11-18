// Walking reachability: can the player get, on foot, from where they start or arrive to
// everything placed on the map?
//
// A cell is walkable when its ground is painted, it holds no wall, no obstacle prop on the
// decorations layer and no building (a building's entrance cell stays walkable). Objects and
// spawns do not block. Moves go to the four side neighbours, never diagonally. A transition (an
// object with targetMap) can be reached but not crossed: stepping on it loads another map, and
// the walk carries on there from its targetSpawn. The world walk starts on the player spawns, or
// on every arrival point when no map of the world has a player spawn yet.

import { isTransition, mapRefTarget, objectCoordMode, type BuilderState, type MapId } from "./builder.js";
import type { TiledObject } from "./types.js";

type Cell = { x: number; y: number };

const prop = (o: TiledObject, name: string) => o.properties?.find((p) => p.name === name)?.value;

/** Grid cell of an object written by this server, from its stored position. */
export function objectCell(state: BuilderState, o: TiledObject): Cell {
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

/** 1 where the player can stand, 0 where the void, a wall, an obstacle prop or a building blocks. */
function walkableCells(state: BuilderState): Uint8Array {
  const walk = new Uint8Array(state.width * state.height);
  const first = state.tileset.firstgid;
  for (let i = 0; i < walk.length; i++) {
    if (!state.ground.data[i] || state.walls.data[i]) continue;
    const deco = state.decorations.data[i];
    if (deco && state.theme.tiles[deco - first]?.tileType === "OBSTACLE") continue;
    walk[i] = 1;
  }
  for (const [key, who] of state.occupied) {
    if (who.type !== "building") continue;
    const [x, y] = key.split(",").map(Number);
    walk[y * state.width + x] = 0;
  }
  return walk;
}

interface MapWalk {
  state: BuilderState;
  walk: Uint8Array;
  /** cell index -> the transition standing there */
  sinks: Map<number, TiledObject>;
  /** Cells reached from any entry of this map that the world walk got to. */
  reached: Uint8Array;
  entered: boolean;
  /** Entries from which no transition of the map can be reached (only when the map has one). */
  walledIn: Array<{ name: string; x: number; y: number }>;
}

/** Marks the cells reachable from `start` in m.reached; returns the transitions reached. */
function flood(m: MapWalk, start: Cell): TiledObject[] {
  const { width: w, height: h } = m.state;
  if (start.x < 0 || start.y < 0 || start.x >= w || start.y >= h) return [];
  const seen = new Uint8Array(w * h);
  const queue = [start.y * w + start.x];
  seen[queue[0]] = 1;
  const transitions: TiledObject[] = [];
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    m.reached[i] = 1;
    const sink = m.sinks.get(i);
    if (sink && q > 0) {
      transitions.push(sink);
      continue;
    }
    const x = i % w;
    const y = (i - x) / w;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (seen[j] || !m.walk[j]) continue;
      seen[j] = 1;
      queue.push(j);
    }
  }
  return transitions;
}

const spawnsWithRole = (state: BuilderState, role: string) =>
  state.spawns.objects.filter((o) => prop(o, "role") === role);

/** Walks the world made of `members`, following transitions from map to map. */
export function walkWorld(members: BuilderState[]): Map<MapId, MapWalk> {
  const walks = new Map<MapId, MapWalk>();
  for (const state of members) {
    const sinks = new Map<number, TiledObject>();
    for (const o of state.objects.objects.filter(isTransition)) {
      const c = objectCell(state, o);
      sinks.set(c.y * state.width + c.x, o);
    }
    walks.set(state.id, {
      state,
      walk: walkableCells(state),
      sinks,
      reached: new Uint8Array(state.width * state.height),
      entered: false,
      walledIn: [],
    });
  }

  let starts = members.flatMap((s) => spawnsWithRole(s, "player").map((o) => ({ m: walks.get(s.id)!, o })));
  if (!starts.length) starts = members.flatMap((s) => spawnsWithRole(s, "arrival").map((o) => ({ m: walks.get(s.id)!, o })));
  const visited = new Set(starts.map(({ m, o }) => `${m.state.id}|${o.name}`));
  for (let q = 0; q < starts.length; q++) {
    const { m, o } = starts[q];
    m.entered = true;
    const cell = objectCell(m.state, o);
    const reachedTransitions = flood(m, cell);
    if (m.sinks.size && !reachedTransitions.length) m.walledIn.push({ name: o.name ?? "", ...cell });
    for (const t of reachedTransitions) {
      const target = walks.get(mapRefTarget(prop(t, "targetMap")) ?? "");
      const spawn = target?.state.spawns.objects.find((s) => s.name === prop(t, "targetSpawn"));
      if (!target || !spawn) continue; // broken links are validate_world errors
      const key = `${target.state.id}|${spawn.name}`;
      if (visited.has(key)) continue;
      visited.add(key);
      starts.push({ m: target, o: spawn });
    }
  }
  return walks;
}

const MAX_LISTED = 5;

/**
 * Warnings for one walked map; `where` prefixes each one (e.g. the file name in validate_world).
 * Objects standing on a wall or outside the ground are left to validate_map's placement checks.
 */
export function reachabilityWarnings(m: MapWalk, where = ""): string[] {
  const { state } = m;
  const w = state.width;
  const say = (text: string) => (where ? `${where}${text}` : text[0].toUpperCase() + text.slice(1));
  const entries = [...spawnsWithRole(state, "player"), ...spawnsWithRole(state, "arrival")];
  if (!m.entered) {
    return entries.length
      ? [say(`nothing on this map can be reached from where the game starts: every way into it is cut off on another map (see validate_world).`)]
      : [];
  }
  const warnings: string[] = [];
  for (const e of m.walledIn) {
    warnings.push(
      say(`from "${e.name}" at (${e.x}, ${e.y}) the player cannot walk to any way out of this map (an exit, entrance, door or stairs leading to another map): clear a path (erase_tile layer=decorations or walls).`),
    );
  }

  // A transition must be stepped on; anything else (chest, lever, enemy...) can be used from a
  // cell next to it where the player can stand (not a transition, which would load another map).
  const inGrid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < state.height;
  const standable = (x: number, y: number) => inGrid(x, y) && m.reached[y * w + x] === 1 && !m.sinks.has(y * w + x);
  const cut: string[] = [];
  for (const o of [...state.objects.objects, ...state.spawns.objects]) {
    const c = objectCell(state, o);
    const i = c.y * w + c.x;
    if ((inGrid(c.x, c.y) && m.reached[i]) || state.walls.data[i] || !state.ground.data[i]) continue;
    if (!isTransition(o) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => standable(c.x + dx, c.y + dy))) continue;
    cut.push(`"${o.name}" (${o.type}) at (${c.x}, ${c.y})`);
  }
  if (cut.length) {
    const more = cut.length > MAX_LISTED ? ` and ${cut.length - MAX_LISTED} more` : "";
    warnings.push(
      say(`${cut.length === 1 ? "1 object cannot" : `${cut.length} objects cannot`} be reached on foot from where the player starts or arrives: ${cut.slice(0, MAX_LISTED).join(", ")}${more}. Clear a path (erase_tile layer=decorations or walls) or move ${cut.length === 1 ? "it" : "them"}.`),
    );
  }

  // Walkable cells the walk never got to, grouped into areas.
  const done = new Uint8Array(m.walk.length);
  const areas: Array<{ size: number; at: Cell }> = [];
  for (let start = 0; start < m.walk.length; start++) {
    if (!m.walk[start] || m.reached[start] || done[start]) continue;
    const queue = [start];
    done[start] = 1;
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q];
      const x = i % w;
      const y = (i - x) / w;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= state.height) continue;
        const j = ny * w + nx;
        if (done[j] || !m.walk[j] || m.reached[j]) continue;
        done[j] = 1;
        queue.push(j);
      }
    }
    areas.push({ size: queue.length, at: { x: start % w, y: Math.floor(start / w) } });
  }
  if (areas.length) {
    const total = areas.reduce((n, a) => n + a.size, 0);
    const largest = areas.reduce((a, b) => (b.size > a.size ? b : a));
    warnings.push(
      say(`${total} floor ${total === 1 ? "cell" : "cells"} in ${areas.length} ${areas.length === 1 ? "area" : "areas"} cannot be reached on foot (largest: ${largest.size} ${largest.size === 1 ? "cell" : "cells"} from (${largest.at.x}, ${largest.at.y})): connect ${areas.length === 1 ? "it" : "them"} with a corridor or a door opening, or fill ${areas.length === 1 ? "it" : "them"} in.`),
    );
  }
  return warnings;
}
