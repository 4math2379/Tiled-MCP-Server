import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PACKAGE_ROOT, REPO_ROOT, resolveUserPath } from "./paths.js";

/**
 * Minimal `.env` loader (no dependency). Reads `KEY=value` lines and only fills variables
 * that are not already set, so values passed by the MCP client always win.
 *
 * Lookup order: TILED_ENV_FILE if set, otherwise `tiled-mcp/.env`.
 * Returns the file that was loaded, or null.
 */
export function loadEnvFile(): string | null {
  const configured = process.env.TILED_ENV_FILE;
  const file = configured ? resolveUserPath(configured, REPO_ROOT) : join(PACKAGE_ROOT, ".env");
  if (!existsSync(file)) return null;
  const raw = readFileSync(file, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
  }
  return file;
}
