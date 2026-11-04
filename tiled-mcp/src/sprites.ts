// Where sprite PNGs are read and written.
//
// Local mode (stdio): files below the assets folder, as always.
// Hosted mode: the bundled sprites are read-only and shared by every caller, so sprites a caller
// generates stay in their workspace (memory) and ship inside their map download.
// A sprite is named by its path below the assets root: "<theme_dir>/<file>.png".

import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { currentScope, isHosted } from "./context.js";
import { assetsRoot } from "./paths.js";

/** In hosted mode, how many sprites one session may generate and keep. */
export const MAX_HOSTED_SPRITES = 40;

/** Absolute path of a sprite below the assets root, or undefined if `relPath` would escape it. */
export function assetFile(relPath: string): string | undefined {
  const root = resolve(assetsRoot());
  const file = resolve(root, relPath);
  return file.startsWith(root + sep) ? file : undefined;
}

export function spriteExists(relPath: string): boolean {
  if (isHosted() && currentScope().workspace.sprites.has(relPath)) return true;
  const file = assetFile(relPath);
  return file !== undefined && existsSync(file);
}

/** Bytes of a sprite: the caller's own generated one first (hosted mode), then the bundled file. */
export function readSprite(relPath: string): Buffer | undefined {
  const own = isHosted() ? currentScope().workspace.sprites.get(relPath) : undefined;
  if (own) return own;
  const file = assetFile(relPath);
  if (!file) return undefined;
  try {
    return readFileSync(file);
  } catch {
    return undefined;
  }
}

/**
 * Store a generated sprite. Local mode writes `file` (default: below the assets root);
 * hosted mode keeps it in the caller's workspace. Returns where it went.
 */
export async function saveSprite(relPath: string, data: Buffer, file = join(assetsRoot(), relPath)): Promise<string> {
  if (isHosted()) {
    const sprites = currentScope().workspace.sprites;
    if (!sprites.has(relPath) && sprites.size >= MAX_HOSTED_SPRITES) {
      throw new Error(`This session already holds ${MAX_HOSTED_SPRITES} generated sprites, the limit on the hosted server.`);
    }
    sprites.set(relPath, data);
    return `session:${relPath}`;
  }
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, data);
  return file;
}
