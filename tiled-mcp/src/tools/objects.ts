import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { assertPlaceable, placeObject, placeSpawn } from "../builder.js";
import { GRID_HELP, asText } from "./util.js";

const CELL = z.number().int().min(0);
const DC = z.number().int().min(5).max(30);
const PLACEMENT_RULE =
  "The cell must be painted ground without a wall and without another object or spawn; otherwise the call fails with an explanation.";
const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;

export function registerObjectTools(server: McpServer): void {
  server.registerTool(
    "place_door",
    {
      title: "Place a door",
      description: `Adds a door to the 'objects' layer. Put doors in a wall opening: erase the wall at that cell first (erase_tile layer=walls) and keep a ground tile under it; generate_room does this for its exits. A locked door needs pickDC to be picked open. ${GRID_HELP}`,
      inputSchema: {
        mapId: z.string(),
        x: CELL,
        y: CELL,
        locked: z.boolean().optional().describe("Defaults to false (closed but unlocked)"),
        pickDC: DC.optional().describe("Difficulty class to pick the lock (5..30)"),
        targetZoneId: z.string().optional().describe("Optional id of the zone this door leads to (for multi-zone dungeons)"),
        name: z.string().optional(),
      },
      annotations: WRITE,
    },
    async ({ mapId, x, y, locked, pickDC, targetZoneId, name }) => {
      const objectId = placeObject(mapId, {
        x,
        y,
        kind: "door",
        state: locked ? "locked" : "closed",
        pickDC,
        targetZoneId,
        name,
      });
      return asText({ ok: true, objectId, kind: "door" });
    },
  );

  server.registerTool(
    "place_chest",
    {
      title: "Place a chest",
      description: `Adds a chest to the 'objects' layer. A locked chest needs pickDC to be opened. ${PLACEMENT_RULE} ${GRID_HELP}`,
      inputSchema: {
        mapId: z.string(),
        x: CELL,
        y: CELL,
        locked: z.boolean().optional(),
        pickDC: DC.optional().describe("Difficulty class to pick the lock (5..30)"),
        name: z.string().optional(),
      },
      annotations: WRITE,
    },
    async ({ mapId, x, y, locked, pickDC, name }) => {
      assertPlaceable(mapId, x, y);
      const objectId = placeObject(mapId, { x, y, kind: "chest", state: locked ? "locked" : "closed", pickDC, name });
      return asText({ ok: true, objectId, kind: "chest" });
    },
  );

  server.registerTool(
    "place_stairs_object",
    {
      title: "Place zone stairs",
      description: `Adds a stairs object that moves the party to another zone (targetZoneId). Unlike the decorative 'stairs' tile role, this object carries the zone link. ${PLACEMENT_RULE} ${GRID_HELP}`,
      inputSchema: {
        mapId: z.string(),
        x: CELL,
        y: CELL,
        targetZoneId: z.string().describe("Id of the destination zone"),
        name: z.string().optional(),
      },
      annotations: WRITE,
    },
    async ({ mapId, x, y, targetZoneId, name }) => {
      assertPlaceable(mapId, x, y);
      const objectId = placeObject(mapId, { x, y, kind: "stairs", state: "open", targetZoneId, name });
      return asText({ ok: true, objectId, kind: "stairs", targetZoneId });
    },
  );

  server.registerTool(
    "place_trap",
    {
      title: "Place a trap",
      description: `Adds a trap to the 'objects' layer. Entering the cell triggers a saving throw when trapSaveDC is set, otherwise the damage applies automatically. ${PLACEMENT_RULE} ${GRID_HELP}`,
      inputSchema: {
        mapId: z.string(),
        x: CELL,
        y: CELL,
        trapType: z.string().describe("Damage type, e.g. piercing, fire, poison, lightning"),
        trapNotation: z
          .string()
          .regex(/^\d+[dD]\d+([+-]\d+)?$/)
          .describe("Damage dice, e.g. 2d6 or 3d4+1"),
        trapSaveDC: DC.optional().describe("Saving throw difficulty class (5..30)"),
        name: z.string().optional(),
      },
      annotations: WRITE,
    },
    async ({ mapId, x, y, trapType, trapNotation, trapSaveDC, name }) => {
      assertPlaceable(mapId, x, y);
      const objectId = placeObject(mapId, { x, y, kind: "trap", state: "closed", trapType, trapNotation, trapSaveDC, name });
      return asText({ ok: true, objectId, kind: "trap", trapType, trapNotation, trapSaveDC });
    },
  );

  server.registerTool(
    "place_lever",
    {
      title: "Place a lever",
      description: `Adds a lever players can pull. Its effect is up to the game engine that loads the map. ${PLACEMENT_RULE} ${GRID_HELP}`,
      inputSchema: { mapId: z.string(), x: CELL, y: CELL, name: z.string().optional() },
      annotations: WRITE,
    },
    async ({ mapId, x, y, name }) => {
      assertPlaceable(mapId, x, y);
      const objectId = placeObject(mapId, { x, y, kind: "lever", state: "closed", name });
      return asText({ ok: true, objectId, kind: "lever" });
    },
  );

  server.registerTool(
    "place_spawn_player",
    {
      title: "Place a player spawn",
      description: `Adds a player start point to the 'spawns' layer. Every playable map needs at least one (validate_map warns otherwise). ${PLACEMENT_RULE} ${GRID_HELP}`,
      inputSchema: { mapId: z.string(), x: CELL, y: CELL, name: z.string().optional() },
      annotations: WRITE,
    },
    async ({ mapId, x, y, name }) => {
      assertPlaceable(mapId, x, y);
      const objectId = placeSpawn(mapId, { x, y, role: "player", name });
      return asText({ ok: true, objectId, role: "player" });
    },
  );

  server.registerTool(
    "place_spawn_enemy",
    {
      title: "Place an enemy spawn",
      description: `Adds an enemy spawn point to the 'spawns' layer. encounterId links it to an encounter defined by the game engine; npcName is the creature's display name. ${PLACEMENT_RULE} ${GRID_HELP}`,
      inputSchema: {
        mapId: z.string(),
        x: CELL,
        y: CELL,
        encounterId: z.string().optional().describe("Id of an existing encounter in the game engine"),
        npcName: z.string().optional().describe("Display name, e.g. 'Alpha werewolf'"),
        name: z.string().optional(),
      },
      annotations: WRITE,
    },
    async ({ mapId, x, y, encounterId, npcName, name }) => {
      assertPlaceable(mapId, x, y);
      const objectId = placeSpawn(mapId, { x, y, role: "enemy", encounterId, npcName, name });
      return asText({ ok: true, objectId, role: "enemy" });
    },
  );

  server.registerTool(
    "place_spawn_npc",
    {
      title: "Place a friendly NPC spawn",
      description: `Adds a non-hostile NPC spawn point (merchant, quest giver, ally) to the 'spawns' layer. ${PLACEMENT_RULE} ${GRID_HELP}`,
      inputSchema: {
        mapId: z.string(),
        x: CELL,
        y: CELL,
        npcName: z.string().optional().describe("Display name, e.g. 'Old innkeeper'"),
        name: z.string().optional(),
      },
      annotations: WRITE,
    },
    async ({ mapId, x, y, npcName, name }) => {
      assertPlaceable(mapId, x, y);
      const objectId = placeSpawn(mapId, { x, y, role: "npc", npcName, name });
      return asText({ ok: true, objectId, role: "npc" });
    },
  );
}
