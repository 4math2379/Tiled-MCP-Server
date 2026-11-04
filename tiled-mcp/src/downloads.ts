// Map downloads for the hosted mode. A map is packed as a .zip holding the .tmj file and the
// sprites it uses, laid out so it opens directly in Tiled, and kept in memory for one hour
// behind an unguessable link.

import { randomBytes } from "node:crypto";
import { zipSync } from "fflate";
import { serializeMap, type MapId } from "./builder.js";
import { currentScope } from "./context.js";
import { readSprite } from "./sprites.js";
import { ASSET_PREFIX } from "./tmj.js";

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

/** File-system friendly slug of a map name, e.g. "Crypt under the chapel" -> "crypt-under-the-chapel". */
export function slugify(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "map";
}

/**
 * Pack a map as `<base>/<base>.tmj` plus `<base>/assets/<theme>/<sprite>.png`. The .tmj keeps its
 * "./assets/..." image paths, which resolve inside the archive.
 */
export function mapArchive(mapId: MapId, base: string): { zip: Buffer; tmj: Buffer; missingSprites: string[] } {
  const map = serializeMap(mapId);
  const tmj = Buffer.from(`${JSON.stringify(map, null, 2)}\n`, "utf8");
  const files: Record<string, [Uint8Array, { level: 0 | 6 }]> = { [`${base}/${base}.tmj`]: [tmj, { level: 6 }] };
  const missingSprites: string[] = [];
  for (const tileset of map.tilesets) {
    for (const tile of tileset.tiles ?? []) {
      if (!tile.image?.startsWith(ASSET_PREFIX)) continue;
      const rel = tile.image.slice(ASSET_PREFIX.length);
      const data = readSprite(rel);
      // PNGs are already compressed: store them as is.
      if (data) files[`${base}/assets/${rel}`] = [data, { level: 0 }];
      else missingSprites.push(rel);
    }
  }
  return { zip: Buffer.from(zipSync(files)), tmj, missingSprites };
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
