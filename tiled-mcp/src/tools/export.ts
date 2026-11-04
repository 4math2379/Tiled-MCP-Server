import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { basename, extname } from "node:path";
import { getMap, objectCoordMode, serializeMap } from "../builder.js";
import { isHosted } from "../context.js";
import { publishMap } from "../downloads.js";
import { mapsRoot, resolveUserPath } from "../paths.js";
import { saveMapFile } from "../tmj.js";
import { asText } from "./util.js";

/** Structural check of the Tiled JSON. The game engine that imports the map should re-validate. */
function validateTiledShape(json: unknown): string[] {
  const errors: string[] = [];
  if (!json || typeof json !== "object") return ["The root of the map JSON must be an object."];
  const o = json as Record<string, unknown>;
  for (const k of ["width", "height", "tilewidth", "tileheight", "orientation", "layers"]) {
    if (!(k in o)) errors.push(`Missing required field: ${k}`);
  }
  if (typeof o.width !== "number" || (o.width as number) <= 0) errors.push("Invalid width");
  if (typeof o.height !== "number" || (o.height as number) <= 0) errors.push("Invalid height");
  if (o.orientation !== "isometric" && o.orientation !== "orthogonal") {
    errors.push(`Unsupported orientation: ${String(o.orientation)}`);
  }
  if (!Array.isArray(o.layers)) errors.push("layers must be an array");
  return errors;
}

export function registerExportTools(server: McpServer): void {
  server.registerTool(
    "validate_map",
    {
      title: "Validate a map",
      description:
        "Checks the map before export: Tiled structure (errors) and gameplay sanity (warnings): at least one player spawn, no object or spawn on a wall or outside the painted ground, no door left inside a wall. Returns { ok, errors, warnings }.",
      inputSchema: { mapId: z.string() },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ mapId }) => {
      const state = getMap(mapId);
      const errors = validateTiledShape(serializeMap(mapId));
      const warnings: string[] = [];

      const hasPlayer = state.spawns.objects.some((o) =>
        o.properties?.some((p) => p.name === "role" && p.value === "player"),
      );
      if (!hasPlayer) warnings.push("No 'player' spawn: the map is not playable until one is placed (place_spawn_player).");

      for (const [key, who] of state.occupied) {
        const [x, y] = key.split(",").map(Number);
        const i = y * state.width + x;
        const onWall = state.walls.data[i] !== 0;
        const onGround = state.ground.data[i] !== 0;
        if (who.type === "door") {
          if (onWall) warnings.push(`Door "${who.name}" at (${x}, ${y}) is still inside a wall: erase the wall tile (erase_tile layer=walls).`);
          continue;
        }
        if (onWall) warnings.push(`"${who.name}" (${who.type}) at (${x}, ${y}) stands on a wall.`);
        else if (!onGround) warnings.push(`"${who.name}" (${who.type}) at (${x}, ${y}) stands outside the painted ground.`);
      }

      return asText({ ok: errors.length === 0, errors, warnings, objectCoordinates: objectCoordMode() });
    },
  );

  server.registerTool(
    "export_json",
    {
      title: "Export as Tiled JSON",
      description:
        "Returns the full Tiled JSON (.tmj content) of a map as text. Sprite paths are written as './assets/<theme>/<role>.png' relative to the repository root; use save_to_disk to get a file whose sprite paths resolve from where it is saved.",
      inputSchema: { mapId: z.string() },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ mapId }) => asText(serializeMap(mapId)),
  );

  if (isHosted()) {
    // The hosted server never writes to its own disk: the caller gets a download link instead.
    server.registerTool(
      "save_to_disk",
      {
        title: "Save (download link)",
        description:
          "Hosted server: packs the map into a .zip holding the .tmj file and the sprites it uses (including sprites generated in this session), laid out to open directly in Tiled, and returns a download link plus a link to the bare .tmj. Links expire after one hour. Only the file name of path is used; folders are ignored.",
        inputSchema: {
          mapId: z.string(),
          path: z.string().min(1).describe("File name ending in .tmj or .json, e.g. 'crypt-chapel.tmj'"),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      async ({ mapId, path }) => {
        const name = basename(path.replace(/\\/g, "/"));
        const ext = extname(name).toLowerCase();
        if (ext !== ".tmj" && ext !== ".json") {
          throw new Error(`The file name must end in .tmj or .json (got '${path}').`);
        }
        getMap(mapId);
        return asText({ ok: true, ...publishMap(mapId, name) });
      },
    );
    return;
  }

  server.registerTool(
    "save_to_disk",
    {
      title: "Save to disk",
      description:
        "Writes the map to a .tmj file that opens directly in the Tiled editor. A relative path is resolved against the maps folder (the repository's maps/ by default, or TILED_MAPS_DIR); an absolute path is used as is. Missing folders are created and an existing file is overwritten. Sprite paths inside the file are rewritten relative to its location so Tiled finds the PNGs.",
      inputSchema: {
        mapId: z.string(),
        path: z
          .string()
          .min(1)
          .describe("File path ending in .tmj or .json, e.g. 'crypt-chapel.tmj' (goes to the maps folder) or an absolute path"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ mapId, path }) => {
      const ext = extname(path).toLowerCase();
      if (ext !== ".tmj" && ext !== ".json") {
        throw new Error(`The file name must end in .tmj or .json (got '${path}').`);
      }
      getMap(mapId);
      const target = resolveUserPath(path, mapsRoot());
      const saved = await saveMapFile(mapId, target);
      return asText({ ok: true, ...saved });
    },
  );
}
