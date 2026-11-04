import { existsSync } from "node:fs";
import { join } from "node:path";
import { assetsRoot } from "../paths.js";
import { ASSET_PREFIX } from "../tmj.js";
import type { Theme } from "../types.js";
import { CRYPT } from "./crypt.js";
import { CASTLE } from "./castle.js";
import { WEREWOLF_DEN } from "./werewolf-den.js";
import { TAVERN_BLOOD_PRINCE } from "./tavern.js";
import { VILLAGE } from "./village.js";
import { HAUNTED_FOREST } from "./forest.js";
import { MAUSOLEUM } from "./mausoleum.js";
import { BLOOD_TOMB } from "./blood-tomb.js";
import { AQUATIC } from "./aquatic.js";
import { GLACIAIRE } from "./glaciaire.js";
import { INONDE } from "./inonde.js";
import { VOLCAN } from "./volcan.js";
import { FORET } from "./foret.js";
import { HIVER } from "./hiver.js";
import { PRINTEMPS } from "./printemps.js";
import { ETE } from "./ete.js";
import { AUTOMNE } from "./automne.js";
import { DESOLATION } from "./desolation.js";
import { FUTURISTE } from "./futuriste.js";
import { ELECTRONIQUE } from "./electronique.js";

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
  GLACIAIRE,
  INONDE,
  VOLCAN,
  FORET,
  HIVER,
  PRINTEMPS,
  ETE,
  AUTOMNE,
  DESOLATION,
  FUTURISTE,
  ELECTRONIQUE,
};

export const THEME_KEYS = Object.keys(THEMES) as [string, ...string[]];

export function getTheme(key: string): Theme {
  const theme = THEMES[key];
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
