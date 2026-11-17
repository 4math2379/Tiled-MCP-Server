// Writing maps to disk. Theme tiles reference their sprites as "./assets/<theme>/<file>.png",
// a path relative to the repository root. Tiled resolves tile images relative to the .tmj
// file itself, so before writing a file we rewrite those paths relative to its folder.

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import { serializeMap, type MapId } from "./builder.js";
import { assetsRoot } from "./paths.js";
import type { TiledMap } from "./types.js";

export const ASSET_PREFIX = "./assets/";

/** Rewrite "./assets/..." tile images so they resolve from the folder of `outFile`. */
export function relativizeImagePaths(map: TiledMap, outFile: string, root = assetsRoot()): TiledMap {
  const fromDir = dirname(outFile);
  for (const tileset of map.tilesets) {
    for (const tile of tileset.tiles ?? []) {
      if (!tile.image?.startsWith(ASSET_PREFIX)) continue;
      const target = join(root, tile.image.slice(ASSET_PREFIX.length));
      const rel = relative(fromDir, target);
      // Different Windows drives have no relative path: keep the absolute one.
      tile.image = isAbsolute(rel)
        ? target.split(sep).join("/")
        : rel.startsWith("..")
          ? rel.split(sep).join("/")
          : `./${rel.split(sep).join("/")}`;
    }
  }
  return map;
}

/**
 * Map JSON as written to .tmj files: indented like Tiled's own output, but every tile layer's
 * `data` array on a single line. A 256x256 map then stays a few hundred kilobytes instead of
 * hundreds of thousands of one-number lines.
 */
export function stringifyMap(map: TiledMap): string {
  const rows: string[] = [];
  const marker = `__tiled_layer_data_${Date.now().toString(36)}_`;
  const text = JSON.stringify(
    map,
    (key, value) => {
      if (key === "data" && Array.isArray(value)) {
        rows.push(value.join(","));
        return `${marker}${rows.length - 1}`;
      }
      return value;
    },
    2,
  );
  return `${text.replace(new RegExp(`"${marker}(\\d+)"`, "g"), (_, i: string) => `[${rows[Number(i)]}]`)}\n`;
}

/** Serialize a map and write it as a .tmj file whose sprite paths resolve from its location. */
export async function saveMapFile(id: MapId, outFile: string): Promise<{ path: string; bytes: number }> {
  const map = relativizeImagePaths(serializeMap(id), outFile);
  const text = stringifyMap(map);
  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, text, "utf8");
  return { path: outFile, bytes: Buffer.byteLength(text) };
}
