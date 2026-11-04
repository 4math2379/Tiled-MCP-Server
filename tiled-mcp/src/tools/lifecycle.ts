import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createMap, describeMap, discardMap, listMaps, MAX_MAP_SIZE } from "../builder.js";
import { THEME_KEYS, describeThemes, getTheme } from "../themes/index.js";
import { asText } from "./util.js";

export function registerLifecycleTools(server: McpServer): void {
  server.registerTool(
    "list_themes",
    {
      title: "List themes",
      description:
        "Lists the available map themes (tile palettes): key, display name, description, the tile roles each theme provides, and whether its sprite PNGs are present locally (sprites.status: all, partial or none). Themes without sprites still produce valid maps; Tiled shows placeholders until the sprites exist.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => asText(describeThemes()),
  );

  server.registerTool(
    "create_map",
    {
      title: "Create a map",
      description:
        "Creates an empty isometric (default) or orthogonal Tiled map in the given theme and returns its mapId, which every other tool needs. The map has three tile layers (ground, walls, decorations) and two object layers (objects, spawns). Maps live in server memory until saved with save_to_disk or exported with export_json; they are lost when the server restarts.",
      inputSchema: {
        name: z.string().min(1).max(120).describe("Display name of the map, e.g. 'Crypt under the abandoned chapel'"),
        width: z.number().int().min(4).max(MAX_MAP_SIZE).describe("Width in cells (1 cell = 5 ft in tabletop terms)"),
        height: z.number().int().min(4).max(MAX_MAP_SIZE).describe("Height in cells"),
        theme: z.enum(THEME_KEYS).describe("Theme key from list_themes, e.g. CRYPT"),
        orientation: z.enum(["isometric", "orthogonal"]).optional().describe("Defaults to isometric"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async ({ name, width, height, theme, orientation }) =>
      asText(createMap({ name, width, height, theme: getTheme(theme), orientation })),
  );

  server.registerTool(
    "list_maps",
    {
      title: "List maps",
      description: "Lists the maps held in memory by this server session, with their summaries.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => asText(listMaps()),
  );

  server.registerTool(
    "describe_map",
    {
      title: "Describe a map",
      description:
        "Returns a summary of one map: size, orientation, theme, tile counts per tile type, and number of objects and spawns.",
      inputSchema: {
        mapId: z.string().describe("mapId returned by create_map"),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ mapId }) => asText(describeMap(mapId)),
  );

  server.registerTool(
    "discard_map",
    {
      title: "Discard a map",
      description:
        "Deletes a map from server memory. Irreversible unless it was saved or exported first.",
      inputSchema: {
        mapId: z.string().describe("mapId returned by create_map"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ mapId }) => asText({ ok: discardMap(mapId), mapId }),
  );
}
