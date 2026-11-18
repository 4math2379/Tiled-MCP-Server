import { existsSync } from "node:fs";
import { join } from "node:path";
import { assetsRoot } from "../paths.js";
import { ASSET_PREFIX } from "../tmj.js";
import type { Theme } from "../types.js";
import { z } from "zod";
import { CRYPT } from "./crypt.js";
import { CASTLE } from "./castle.js";
import { WEREWOLF_DEN } from "./werewolf-den.js";
import { TAVERN_BLOOD_PRINCE } from "./tavern.js";
import { VILLAGE } from "./village.js";
import { HAUNTED_FOREST } from "./forest.js";
import { MAUSOLEUM } from "./mausoleum.js";
import { BLOOD_TOMB } from "./blood-tomb.js";
import { AQUATIC } from "./aquatic.js";
import { GLACIER } from "./glacier.js";
import { FLOODED } from "./flooded.js";
import { VOLCANO } from "./volcano.js";
import { DARK_FOREST } from "./dark-forest.js";
import { WINTER } from "./winter.js";
import { SPRING } from "./spring.js";
import { SUMMER } from "./summer.js";
import { AUTUMN } from "./autumn.js";
import { DESOLATION } from "./desolation.js";
import { FUTURISTIC } from "./futuristic.js";
import { ELECTRONIC } from "./electronic.js";

export const THEMES: Record<string, Theme> = {
  CRYPT,
  CASTLE,
  WEREWOLF_DEN,
  TAVERN_BLOOD_PRINCE,
  VILLAGE,
  HAUNTED_FOREST,
  MAUSOLEUM,
  BLOOD_TOMB,
  AQUATIC,
  GLACIER,
  FLOODED,
  VOLCANO,
  DARK_FOREST,
  WINTER,
  SPRING,
  SUMMER,
  AUTUMN,
  DESOLATION,
  FUTURISTIC,
  ELECTRONIC,
};

export const THEME_KEYS = Object.keys(THEMES) as [string, ...string[]];

/** French theme keys used before 0.5.0, mapped to their English replacement. */
export const LEGACY_THEME_KEYS: Record<string, string> = { GLACIAIRE: "GLACIER", INONDE: "FLOODED", VOLCAN: "VOLCANO", FORET: "DARK_FOREST", HIVER: "WINTER", PRINTEMPS: "SPRING", ETE: "SUMMER", AUTOMNE: "AUTUMN", FUTURISTE: "FUTURISTIC", ELECTRONIQUE: "ELECTRONIC" };

/** The current key for `key`, translating a pre-0.5.0 French key. */
export function resolveThemeKey(key: string): string {
  return LEGACY_THEME_KEYS[key] ?? key;
}

/** Tool input schema for a theme key; an old French key gets an error naming its replacement. */
export function themeKeySchema() {
  return z.enum(THEME_KEYS, {
    error: (issue) => {
      const renamed = typeof issue.input === "string" ? LEGACY_THEME_KEYS[issue.input] : undefined;
      return renamed ? `Theme '${String(issue.input)}' was renamed '${renamed}' in 0.5.0: use '${renamed}'.` : undefined;
    },
  });
}

export function getTheme(key: string): Theme {
  const theme = THEMES[resolveThemeKey(key)];
  if (!theme) {
    throw new Error(`Unknown theme '${key}'. Available themes: ${THEME_KEYS.join(", ")}`);
  }
  return theme;
}

/** Folder of a theme's sprites below the assets root, e.g. WEREWOLF_DEN -> werewolf_den. */
export function themeAssetDir(key: string): string {
  return key.toLowerCase();
}

/** How many of the theme's sprite files exist under the assets root. */
export function spriteAvailability(theme: Theme, root = assetsRoot()) {
  const files = theme.tiles.filter((t) => t.imageFile?.startsWith(ASSET_PREFIX));
  const missing = files
    .filter((t) => !existsSync(join(root, t.imageFile!.slice(ASSET_PREFIX.length))))
    .map((t) => t.role);
  const status = missing.length === 0 ? "all" : missing.length === files.length ? "none" : "partial";
  return { status, present: files.length - missing.length, total: files.length, missingRoles: missing };
}

export function describeThemes() {
  const root = assetsRoot();
  return Object.values(THEMES).map((t) => {
    const sprites = spriteAvailability(t, root);
    return {
      key: t.key,
      name: t.name,
      description: t.description,
      roles: t.tiles.map((tile) => tile.role),
      sprites: {
        status: sprites.status,
        present: sprites.present,
        total: sprites.total,
        ...(sprites.missingRoles.length ? { missingRoles: sprites.missingRoles } : {}),
      },
    };
  });
}
