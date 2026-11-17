// Map downloads for the hosted mode. A map is packed as a .zip holding the .tmj file and the
// sprites it uses, laid out so it opens directly in Tiled, and kept in memory for one hour
// behind an unguessable link.

import { randomBytes } from "node:crypto";
import { zipSync } from "fflate";
import { getMap, serializeMap, type MapId } from "./builder.js";
import { currentScope } from "./context.js";
import { slugify } from "./names.js";
import { readSprite } from "./sprites.js";
import { ASSET_PREFIX, stringifyMap } from "./tmj.js";
import type { TiledMap } from "./types.js";

export { slugify };

const TTL_MS = 60 * 60 * 1000;
const MAX_TOTAL_BYTES = 256 * 1024 * 1024;

interface Download {
  name: string;
  contentType: string;
  data: Buffer;
  expires: number;
}

const DOWNLOADS = new Map<string, Download>();
let totalBytes = 0;

function drop(id: string): void {
  const d = DOWNLOADS.get(id);
  if (!d) return;
  totalBytes -= d.data.length;
  DOWNLOADS.delete(id);
}

function sweep(): void {
  const now = Date.now();
  for (const [id, d] of DOWNLOADS) if (d.expires <= now) drop(id);
  // Oldest first (Map keeps insertion order) until the store fits its budget.
  for (const id of DOWNLOADS.keys()) {
    if (totalBytes <= MAX_TOTAL_BYTES) break;
    drop(id);
  }
}

export function getDownload(id: string): Download | undefined {
  const d = DOWNLOADS.get(id);
  if (!d || d.expires <= Date.now()) {
    drop(id);
    return undefined;
  }
  return d;
}

function publish(name: string, contentType: string, data: Buffer): string {
  const id = randomBytes(18).toString("base64url");
  DOWNLOADS.set(id, { name, contentType, data, expires: Date.now() + TTL_MS });
  totalBytes += data.length;
  sweep();
  return `${currentScope().baseUrl ?? ""}/download/${id}/${encodeURIComponent(name)}`;
}

type ZipFiles = Record<string, [Uint8Array, { level: 0 | 6 }]>;

/** Add the sprites a map uses below `<base>/assets/`; returns the ones that are missing. */
function addSprites(files: ZipFiles, map: TiledMap, base: string): string[] {
  const missing: string[] = [];
  for (const tileset of map.tilesets) {
    for (const tile of tileset.tiles ?? []) {
      if (!tile.image?.startsWith(ASSET_PREFIX)) continue;
      const rel = tile.image.slice(ASSET_PREFIX.length);
      const key = `${base}/assets/${rel}`;
      if (files[key]) continue;
      const data = readSprite(rel);
      // PNGs are already compressed: store them as is.
      if (data) files[key] = [data, { level: 0 }];
      else missing.push(rel);
    }
  }
  return missing;
}

/**
 * Pack a map as `<base>/<base>.tmj` plus `<base>/assets/<theme>/<sprite>.png`. The .tmj keeps its
 * "./assets/..." image paths, which resolve inside the archive.
 */
export function mapArchive(mapId: MapId, base: string): { zip: Buffer; tmj: Buffer; missingSprites: string[] } {
  const map = serializeMap(mapId);
  const tmj = Buffer.from(stringifyMap(map), "utf8");
  const files: ZipFiles = { [`${base}/${base}.tmj`]: [tmj, { level: 6 }] };
  const missingSprites = addSprites(files, map, base);
  return { zip: Buffer.from(zipSync(files)), tmj, missingSprites };
}

/**
 * Pack linked maps side by side as `<base>/<fileName>` (the names their links use) with one
 * shared `<base>/assets/` folder.
 */
export function worldArchive(mapIds: MapId[], base: string): { zip: Buffer; files: string[]; missingSprites: string[] } {
  const files: ZipFiles = {};
  const missing = new Set<string>();
  const names: string[] = [];
  for (const id of mapIds) {
    const map = serializeMap(id);
    const fileName = getMap(id).fileName;
    files[`${base}/${fileName}`] = [Buffer.from(stringifyMap(map), "utf8"), { level: 6 }];
    names.push(fileName);
    for (const m of addSprites(files, map, base)) missing.add(m);
  }
  return { zip: Buffer.from(zipSync(files)), files: names, missingSprites: [...missing] };
}

/** Publish one map's bare .tmj (its links point at sibling files the world .zip holds). */
export function publishTmj(mapId: MapId, fileName: string): string {
  return publish(fileName, "application/json", Buffer.from(stringifyMap(serializeMap(mapId)), "utf8"));
}

/** Publish linked maps as one .zip; returns its link. */
export function publishWorld(mapIds: MapId[], name: string) {
  const base = slugify(name);
  const { zip, files, missingSprites } = worldArchive(mapIds, base);
  return {
    zipUrl: publish(`${base}.zip`, "application/zip", zip),
    files,
    expiresAt: new Date(Date.now() + TTL_MS).toISOString(),
    ...(missingSprites.length ? { missingSprites } : {}),
  };
}

/** Publish a map as a .zip (Tiled-ready, with sprites) and as a bare .tmj; returns both links. */
export function publishMap(mapId: MapId, fileName: string) {
  const base = slugify(fileName.replace(/\.(tmj|json)$/i, ""));
  const { zip, tmj, missingSprites } = mapArchive(mapId, base);
  return {
    zipUrl: publish(`${base}.zip`, "application/zip", zip),
    tmjUrl: publish(`${base}.tmj`, "application/json", tmj),
    expiresAt: new Date(Date.now() + TTL_MS).toISOString(),
    ...(missingSprites.length ? { missingSprites } : {}),
  };
}
