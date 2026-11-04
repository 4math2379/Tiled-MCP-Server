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

/** Serialize a map and write it as a .tmj file whose sprite paths resolve from its location. */
export async function saveMapFile(id: MapId, outFile: string): Promise<{ path: string; bytes: number }> {
  const map = relativizeImagePaths(serializeMap(id), outFile);
  const text = `${JSON.stringify(map, null, 2)}\n`;
  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, text, "utf8");
  return { path: outFile, bytes: Buffer.byteLength(text) };
}
