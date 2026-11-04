import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { eraseTile, getTileInfo, paintRect, paintTile, paintWallBorder } from "../builder.js";
import { THEME_ROLES } from "../types.js";
import { GRID_HELP, asText } from "./util.js";

const LAYER = z
  .enum(["ground", "walls", "decorations"])
  .describe(
    "ground = floors, hazards and difficult terrain; walls = wall tiles drawn above the ground (a cell with a wall is impassable); decorations = props above the ground (obstacle_decor blocks movement, decoration_minor is walkable)",
  );
const ROLE = z.enum(THEME_ROLES).describe("Tile role, resolved to a sprite by the map's theme");
const CELL = z.number().int().min(0);

export function registerPaintTools(server: McpServer): void {
  server.registerTool(
    "paint_tile",
    {
      title: "Paint one tile",
      description: `Paints a single cell of a tile layer with a tile role. ${GRID_HELP}`,
      inputSchema: { mapId: z.string(), layer: LAYER, x: CELL, y: CELL, role: ROLE },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ mapId, layer, x, y, role }) => {
      paintTile(mapId, layer, x, y, role);
      return asText({ ok: true, mapId, layer, x, y, role });
    },
  );

  server.registerTool(
    "paint_rect",
    {
      title: "Paint a filled rectangle",
      description: `Paints every cell of the rectangle between two opposite corners (inclusive) on one layer. Typical use: paint_rect on 'ground' with walkable_floor for a room's floor. ${GRID_HELP}`,
      inputSchema: { mapId: z.string(), layer: LAYER, x1: CELL, y1: CELL, x2: CELL, y2: CELL, role: ROLE },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ mapId, layer, x1, y1, x2, y2, role }) => {
      const painted = paintRect(mapId, layer, x1, y1, x2, y2, role);
      return asText({ ok: true, painted, layer, role });
    },
  );

  server.registerTool(
    "paint_wall_border",
    {
      title: "Paint a wall border",
      description: `Paints walls on the outline of a rectangle (inclusive corners) on the 'walls' layer, to enclose a room quickly. Erase single wall cells afterwards (erase_tile layer=walls) to open doorways. ${GRID_HELP}`,
      inputSchema: { mapId: z.string(), x1: CELL, y1: CELL, x2: CELL, y2: CELL },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ mapId, x1, y1, x2, y2 }) => asText({ ok: true, painted: paintWallBorder(mapId, x1, y1, x2, y2) }),
  );

  server.registerTool(
    "erase_tile",
    {
      title: "Erase one tile",
      description: `Clears one cell of a tile layer (for example to open a doorway in a wall). ${GRID_HELP}`,
      inputSchema: { mapId: z.string(), layer: LAYER, x: CELL, y: CELL },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ mapId, layer, x, y }) => {
      eraseTile(mapId, layer, x, y);
      return asText({ ok: true, mapId, layer, x, y });
    },
  );

  server.registerTool(
    "get_tile_info",
    {
      title: "Inspect one tile",
      description: `Returns the tile on one layer at (x, y): gid (0 = empty), role, tile type and sprite id, plus the object or spawn standing on that cell if any. Check layer=walls before placing objects: a wall sits on top of a walkable ground tile. ${GRID_HELP}`,
      inputSchema: { mapId: z.string(), layer: LAYER, x: CELL, y: CELL },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ mapId, layer, x, y }) => asText(getTileInfo(mapId, layer, x, y)),
  );
}
