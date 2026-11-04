import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Directory layout, resolved from this file's location so the server works no matter
 * which working directory the MCP client launches it from:
 *
 *   <repo>/                 REPO_ROOT
 *   <repo>/tiled-mcp/       PACKAGE_ROOT (package.json, .env)
 *   <repo>/tiled-mcp/dist/  compiled server (this file runs from here as paths.js)
 *   <repo>/assets/          bundled sprites     (override with TILED_ASSETS_DIR)
 *   <repo>/maps/            default .tmj output (override with TILED_MAPS_DIR)
 *   <repo>/skills/          agent skills        (override with TILED_SKILL_FILE)
 */
export const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));
export const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));

/**
 * Some MCP clients (for example Zed opened on a WSL project) run the server on the Linux
 * side while users keep typing Windows paths such as `D:/maps/crypt.tmj`. On a non-Windows
 * platform, translate `X:/...` or `X:\...` into `/mnt/x/...`. Other paths pass through.
 */
export function toLocalPath(p: string): string {
  const m = p.match(/^([A-Za-z]):[\\/](.*)$/);
  if (process.platform === "win32" || !m) return p;
  return `/mnt/${m[1].toLowerCase()}/${m[2].replace(/\\/g, "/")}`;
}

/** Resolve a user-supplied path: WSL translation first, then relative paths against `base`. */
export function resolveUserPath(p: string, base: string): string {
  const local = toLocalPath(p);
  return isAbsolute(local) ? resolve(local) : resolve(base, local);
}

/** Root folder holding the `<theme_lowercase>/<role>.png` sprites. */
export function assetsRoot(): string {
  const configured = process.env.TILED_ASSETS_DIR;
  return configured ? resolveUserPath(configured, REPO_ROOT) : join(REPO_ROOT, "assets");
}

/** Folder used by `save_to_disk` when it receives a relative path. */
export function mapsRoot(): string {
  const configured = process.env.TILED_MAPS_DIR;
  return configured ? resolveUserPath(configured, REPO_ROOT) : join(REPO_ROOT, "maps");
}

/** Path of the map-builder skill served as the `map_builder` MCP prompt. */
export function skillFile(): string {
  const configured = process.env.TILED_SKILL_FILE;
  return configured
    ? resolveUserPath(configured, REPO_ROOT)
    : join(REPO_ROOT, "skills", "map-builder", "SKILL.md");
}
