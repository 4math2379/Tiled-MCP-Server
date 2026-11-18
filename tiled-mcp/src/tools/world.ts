import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { maxMapSize, getMap } from "../builder.js";
import { BUILDINGS, BUILDING_TYPES } from "../buildings.js";
import { isHosted } from "../context.js";
import { publishWorld } from "../downloads.js";
import { slugify } from "../names.js";
import { mapsRoot, resolveUserPath } from "../paths.js";
import { themeKeySchema } from "../themes/index.js";
import { saveMapFile } from "../tmj.js";
import { linkMaps, placeBuilding, validateWorld, worldOf } from "../world.js";
import { GRID_HELP, asText } from "./util.js";

const CELL = z.number().int().min(0);
const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;

const FOOTPRINTS = BUILDING_TYPES.map((t) => `${t} ${BUILDINGS[t].footprint}x${BUILDINGS[t].footprint}`).join(", ");

const TRANSITION_HELP =
  "A transition is an object with targetMap (a 'file' property: the .tmj file of the other map) and targetSpawn (the name of an 'arrival' spawn in that map). In the game, stepping on it loads targetMap and puts the player on targetSpawn.";

export function registerWorldTools(server: McpServer): void {
  const max = maxMapSize();

  server.registerTool(
    "place_building",
    {
      title: "Place a building with an interior",
      description:
        `Puts a building on an outdoor map and, by default, creates its interior as a new map linked both ways. Footprints are square: ${FOOTPRINTS} cells, starting at (x, y), the footprint's top corner; every footprint cell needs painted ground, no wall and no object (props on the decorations layer are cleared). ` +
        "The building is drawn by a large sprite (assets/buildings/<type>.png, made with generate_building_sprite) on a 'buildings' layer; until it exists Tiled and the preview show a placeholder. " +
        "With an interior, the call adds an 'entrance' on the door cell of the footprint edge (door=south, the default, or east), an 'arrival' spawn on the free cell in front of it, and in the interior map an 'exit' in the wall and an 'arrival' spawn just inside. " +
        `Interiors default to a furnished single room (house, shop, tavern, temple, tower) or a full castle floor (castle, needs 27x20); edit them afterwards with the usual tools using the returned interior mapId. ${TRANSITION_HELP} ${GRID_HELP}`,
      inputSchema: {
        mapId: z.string().describe("The outdoor map"),
        buildingType: z.enum(BUILDING_TYPES),
        x: CELL.describe("Column of the footprint's top corner"),
        y: CELL.describe("Row of the footprint's top corner"),
        name: z.string().min(1).max(80).optional().describe("Display name, e.g. 'Miller house'; also the base of the building id"),
        door: z.enum(["south", "east"]).optional().describe("Footprint edge with the door: south (default, bottom-left face) or east (bottom-right face)"),
        interior: z.boolean().optional().describe("Create and link an interior map (default true); false places a building that cannot be entered"),
        interiorTheme: themeKeySchema().optional().describe("Theme of the interior (default per type: TAVERN_BLOOD_PRINCE, MAUSOLEUM or CASTLE)"),
        interiorWidth: z.number().int().min(5).max(max).optional().describe("Interior width in cells (default per type)"),
        interiorHeight: z.number().int().min(5).max(max).optional().describe("Interior height in cells (default per type)"),
        spriteVariant: z
          .string()
          .regex(/^[a-z0-9_]+$/)
          .optional()
          .describe("Use assets/buildings/<type>__<variant>.png instead of <type>.png"),
      },
      annotations: WRITE,
    },
    async ({ mapId, buildingType, x, y, name, door, interior, interiorTheme, interiorWidth, interiorHeight, spriteVariant }) =>
      asText({
        ok: true,
        ...placeBuilding(mapId, {
          type: buildingType,
          x,
          y,
          name,
          door,
          interior,
          interiorTheme,
          interiorWidth,
          interiorHeight,
          spriteVariant,
        }),
      }),
  );

  server.registerTool(
    "link_maps",
    {
      title: "Link two maps",
      description:
        `Joins two maps both ways with a door or stairs object on each side, for example the floors of a castle or a cave under a house. Each object leads to the other map; an 'arrival' spawn is put on a free floor cell next to each object (or on the arrival cell you pass). A door cell may be in a wall: the wall is opened. ${TRANSITION_HELP} ${GRID_HELP}`,
      inputSchema: {
        fromMapId: z.string(),
        fromX: CELL,
        fromY: CELL,
        toMapId: z.string(),
        toX: CELL,
        toY: CELL,
        kind: z.enum(["door", "stairs"]).describe("Object placed on both sides"),
        name: z.string().min(1).max(80).optional().describe("Base name of the two objects (default '<kind>-to-<map name>')"),
        fromArrivalX: CELL.optional(),
        fromArrivalY: CELL.optional(),
        toArrivalX: CELL.optional(),
        toArrivalY: CELL.optional(),
      },
      annotations: WRITE,
    },
    async (a) => {
      const arrival = (x?: number, y?: number) => (x !== undefined && y !== undefined ? { x, y } : undefined);
      return asText({
        ok: true,
        ...linkMaps(
          { mapId: a.fromMapId, x: a.fromX, y: a.fromY, arrival: arrival(a.fromArrivalX, a.fromArrivalY) },
          { mapId: a.toMapId, x: a.toX, y: a.toY, arrival: arrival(a.toArrivalX, a.toArrivalY) },
          a.kind,
          a.name,
        ),
      });
    },
  );

  server.registerTool(
    "validate_world",
    {
      title: "Validate linked maps",
      description:
        "Checks the maps linked to mapId (or every map of the session): each transition leads to a map of this session and to an arrival spawn that exists there (errors), every link has a way back, every map can be entered, some map has a player spawn, building sprites exist, and the whole world can be walked: starting from the player spawn and following each transition the player can reach on foot, every object and floor area of every map is reachable and no arrival point is walled in (warnings, prefixed with the map's file name). Also lists the maps with their file names and every link. Run validate_map on each map too.",
      inputSchema: { mapId: z.string().optional().describe("Any map of the world; omit to check every map of the session") },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ mapId }) => asText(validateWorld(mapId)),
  );

  if (isHosted()) {
    // The hosted server never writes to its own disk: the caller gets a download link instead.
    server.registerTool(
      "save_world",
      {
        title: "Save linked maps (download link)",
        description:
          "Hosted server: packs mapId and every map linked to it into one .zip, each .tmj under the file name its links use plus the sprites they need, ready to open in Tiled. Returns a download link valid for one hour.",
        inputSchema: {
          mapId: z.string().describe("Any map of the world, usually the outdoor map"),
          name: z.string().min(1).max(80).optional().describe("Name of the .zip (default: the map's name)"),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      async ({ mapId, name }) => {
        const members = worldOf(mapId);
        return asText({ ok: true, ...publishWorld(members.map((s) => s.id), name ?? getMap(mapId).name) });
      },
    );
    return;
  }

  server.registerTool(
    "save_world",
    {
      title: "Save linked maps",
      description:
        "Writes mapId and every map linked to it (buildings' interiors, linked floors) into one folder, each under the file name its links use (describe_map and validate_world show them), with sprite paths relative to the folder. A relative folder is resolved against the maps folder (the repository's maps/ by default, or TILED_MAPS_DIR); default: a folder named after the map. Existing files are overwritten.",
      inputSchema: {
        mapId: z.string().describe("Any map of the world, usually the outdoor map"),
        folder: z.string().min(1).optional().describe("Target folder, e.g. 'village-world' or an absolute path"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ mapId, folder }) => {
      const members = worldOf(mapId);
      const dir = resolveUserPath(folder ?? slugify(getMap(mapId).name), mapsRoot());
      const files = [];
      for (const s of members) files.push({ mapId: s.id, name: s.name, ...(await saveMapFile(s.id, join(dir, s.fileName))) });
      const check = validateWorld(mapId);
      return asText({ ok: true, folder: dir, files, startMaps: check.startMaps, errors: check.errors, warnings: check.warnings });
    },
  );
}
