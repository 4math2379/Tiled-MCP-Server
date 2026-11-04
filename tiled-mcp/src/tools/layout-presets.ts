// Ready-made layouts with a gothic-horror flavour: a crypt, a castle floor and a werewolf den.
// They are original arrangements (rooms, sizes and connections are not copied from any published
// adventure) meant as a starting point that an agent or a human then refines.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { describeMap, getMap, paintTile, placeObject, placeSpawn } from "../builder.js";
import { applyRoom } from "./procedural.js";
import { asText } from "./util.js";

interface RoomPlan {
  label: string;
  originX: number;
  originY: number;
  width: number;
  height: number;
  exits: { direction: "north" | "south" | "east" | "west"; offset?: number }[];
  hazardCenter?: boolean;
  obstacleCorners?: boolean;
}

interface CorridorPlan {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

/** Smallest map each preset fits in without rooms overlapping. */
const MIN_SIZE = {
  crypt: { width: 27, height: 18 },
  castle: { width: 27, height: 20 },
  den: { width: 22, height: 16 },
} as const;

function assertMinSize(mapId: string, preset: keyof typeof MIN_SIZE, tool: string): void {
  const state = getMap(mapId);
  const min = MIN_SIZE[preset];
  if (state.width < min.width || state.height < min.height) {
    throw new Error(
      `Map too small for ${tool}: ${state.width}x${state.height}. This layout needs at least ${min.width}x${min.height}; create a larger map or build rooms with generate_room.`,
    );
  }
}

function applyLayout(mapId: string, rooms: RoomPlan[], corridors: CorridorPlan[]) {
  const state = getMap(mapId);
  const floorGid = state.roleToGid.get("walkable_floor")!;

  for (const r of rooms) {
    applyRoom(mapId, r.originX, r.originY, r.width, r.height, r.exits ?? [], {
      hazardCenter: r.hazardCenter,
      obstacleCorners: r.obstacleCorners,
    });
  }

  // One-cell corridors: floor on the ground layer, walls cleared along the path.
  for (const c of corridors) {
    const xa = Math.min(c.fromX, c.toX);
    const xb = Math.max(c.fromX, c.toX);
    const ya = Math.min(c.fromY, c.toY);
    const yb = Math.max(c.fromY, c.toY);
    if (ya === yb) {
      for (let x = xa; x <= xb; x++) {
        state.ground.data[ya * state.width + x] = floorGid;
        state.walls.data[ya * state.width + x] = 0;
      }
    } else if (xa === xb) {
      for (let y = ya; y <= yb; y++) {
        state.ground.data[y * state.width + xa] = floorGid;
        state.walls.data[y * state.width + xa] = 0;
      }
    } else {
      // L-shaped: vertical leg first, then horizontal.
      for (let y = ya; y <= yb; y++) {
        state.ground.data[y * state.width + c.fromX] = floorGid;
        state.walls.data[y * state.width + c.fromX] = 0;
      }
      for (let x = xa; x <= xb; x++) {
        state.ground.data[c.toY * state.width + x] = floorGid;
        state.walls.data[c.toY * state.width + x] = 0;
      }
    }
  }
}

export function registerLayoutPresetTools(server: McpServer): void {
  server.registerTool(
    "generate_crypt_layout",
    {
      title: "Generate a crypt layout",
      description: `Fills a map with a crypt: entrance hall (west), central nave, north and south burial chambers, and a deep crypt (east) with a hazard tile and corner obstacles, all connected by doors and corridors. Needs a map of at least ${MIN_SIZE.crypt.width}x${MIN_SIZE.crypt.height}. Suited to the CRYPT, BLOOD_TOMB and MAUSOLEUM themes. Adds a player spawn in the entrance unless addPlayerSpawn is false.`,
      inputSchema: {
        mapId: z.string(),
        addPlayerSpawn: z.boolean().optional().describe("Place a player spawn in the entrance (default true)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async ({ mapId, addPlayerSpawn }) => {
      assertMinSize(mapId, "crypt", "generate_crypt_layout");
      const state = getMap(mapId);
      const w = state.width;
      const h = state.height;
      const cy = Math.floor(h / 2);

      const entrance: RoomPlan = { label: "entrance", originX: 0, originY: cy - 2, width: 6, height: 5, exits: [{ direction: "east" }] };
      const nave: RoomPlan = {
        label: "nave",
        originX: 8,
        originY: cy - 3,
        width: 10,
        height: 7,
        exits: [{ direction: "west" }, { direction: "north" }, { direction: "south" }, { direction: "east" }],
        obstacleCorners: true,
      };
      const northChamber: RoomPlan = { label: "north-chamber", originX: 10, originY: 0, width: 6, height: 5, exits: [{ direction: "south" }] };
      const southChamber: RoomPlan = { label: "south-chamber", originX: 10, originY: h - 5, width: 6, height: 5, exits: [{ direction: "north" }] };
      const deepCrypt: RoomPlan = {
        label: "deep-crypt",
        originX: Math.min(w - 8, 20),
        originY: cy - 3,
        width: 7,
        height: 7,
        exits: [{ direction: "west" }],
        hazardCenter: true,
        obstacleCorners: true,
      };

      const corridors: CorridorPlan[] = [
        { fromX: entrance.originX + entrance.width, fromY: cy, toX: nave.originX - 1, toY: cy },
        { fromX: nave.originX + nave.width, fromY: cy, toX: deepCrypt.originX - 1, toY: cy },
        { fromX: northChamber.originX + 3, fromY: northChamber.originY + northChamber.height, toX: northChamber.originX + 3, toY: nave.originY - 1 },
        { fromX: southChamber.originX + 3, fromY: nave.originY + nave.height, toX: southChamber.originX + 3, toY: southChamber.originY - 1 },
      ];

      const rooms = [entrance, nave, northChamber, southChamber, deepCrypt];
      applyLayout(mapId, rooms, corridors);

      if (addPlayerSpawn !== false) {
        placeSpawn(mapId, { x: entrance.originX + 1, y: entrance.originY + 2, role: "player" });
      }

      return asText({ ok: true, layout: "crypt", rooms: rooms.map((r) => r.label), summary: describeMap(mapId) });
    },
  );

  server.registerTool(
    "generate_castle_floor",
    {
      title: "Generate a castle floor",
      description: `Fills a map with a castle floor: antechamber (west) behind a locked main door (pick DC 18), a great hall, north and south wings, and a far room (east) whose content depends on floorVariant. The 'throne' variant adds a throne prop and an enemy 'Castle lord' spawn. Needs a map of at least ${MIN_SIZE.castle.width}x${MIN_SIZE.castle.height}. Suited to the CASTLE theme.`,
      inputSchema: {
        mapId: z.string(),
        floorVariant: z
          .enum(["entrance", "throne", "private_chambers"])
          .optional()
          .describe("entrance = inner courtyard, throne = throne room (default), private_chambers = private apartments"),
        addPlayerSpawn: z.boolean().optional().describe("Place a player spawn in the antechamber (default true)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async ({ mapId, floorVariant, addPlayerSpawn }) => {
      assertMinSize(mapId, "castle", "generate_castle_floor");
      const state = getMap(mapId);
      const variant = floorVariant ?? "throne";
      const w = state.width;
      const h = state.height;
      const cy = Math.floor(h / 2);

      const antechamber: RoomPlan = { label: "antechamber", originX: 0, originY: cy - 3, width: 6, height: 6, exits: [{ direction: "east" }] };
      const greatHall: RoomPlan = {
        label: "great-hall",
        originX: 8,
        originY: cy - 4,
        width: 10,
        height: 9,
        exits: [{ direction: "west" }, { direction: "north" }, { direction: "south" }, { direction: "east" }],
        obstacleCorners: variant === "throne",
      };
      const northWing: RoomPlan = { label: "north-wing", originX: 10, originY: 0, width: 7, height: 5, exits: [{ direction: "south" }] };
      const southWing: RoomPlan = { label: "south-wing", originX: 10, originY: h - 5, width: 7, height: 5, exits: [{ direction: "north" }] };
      const farRoom: RoomPlan = {
        label: variant === "throne" ? "throne-room" : variant === "private_chambers" ? "private-chambers" : "inner-courtyard",
        originX: Math.min(w - 8, 20),
        originY: cy - 3,
        width: 7,
        height: 7,
        exits: [{ direction: "west" }],
        obstacleCorners: variant !== "entrance",
      };

      const corridors: CorridorPlan[] = [
        { fromX: antechamber.originX + antechamber.width, fromY: cy, toX: greatHall.originX - 1, toY: cy },
        { fromX: greatHall.originX + greatHall.width, fromY: cy, toX: farRoom.originX - 1, toY: cy },
        { fromX: northWing.originX + 3, fromY: northWing.originY + northWing.height, toX: northWing.originX + 3, toY: greatHall.originY - 1 },
        { fromX: southWing.originX + 3, fromY: greatHall.originY + greatHall.height, toX: southWing.originX + 3, toY: southWing.originY - 1 },
      ];

      const rooms = [antechamber, greatHall, northWing, southWing, farRoom];
      applyLayout(mapId, rooms, corridors);

      if (variant === "throne") {
        const tx = farRoom.originX + Math.floor(farRoom.width / 2);
        const ty = farRoom.originY + 1;
        paintTile(mapId, "decorations", tx, ty, "obstacle_decor");
        placeSpawn(mapId, { x: tx, y: ty, role: "enemy", npcName: "Castle lord" });
      }

      if (addPlayerSpawn !== false) {
        placeSpawn(mapId, { x: antechamber.originX + 1, y: antechamber.originY + 3, role: "player" });
      }

      // The main entrance on the antechamber's west wall is a locked door in a wall opening.
      state.walls.data[(antechamber.originY + 3) * state.width + antechamber.originX] = 0;
      placeObject(mapId, {
        x: antechamber.originX,
        y: antechamber.originY + 3,
        kind: "door",
        state: "locked",
        pickDC: 18,
        name: "main-door",
      });

      return asText({ ok: true, layout: "castle", variant, rooms: rooms.map((r) => r.label), summary: describeMap(mapId) });
    },
  );

  server.registerTool(
    "generate_werewolf_den",
    {
      title: "Generate a werewolf den",
      description: `Fills a map with a cave den: cave mouth (west), hunting hall with bone obstacles, a nest of young wolves (north), a bone store (south) and the alpha's lair (east) with a hazard tile. Adds enemy spawns 'Alpha werewolf' and 'Werewolf cub'. Needs a map of at least ${MIN_SIZE.den.width}x${MIN_SIZE.den.height}. Suited to the WEREWOLF_DEN theme.`,
      inputSchema: {
        mapId: z.string(),
        addPlayerSpawn: z.boolean().optional().describe("Place a player spawn at the cave mouth (default true)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async ({ mapId, addPlayerSpawn }) => {
      assertMinSize(mapId, "den", "generate_werewolf_den");
      const state = getMap(mapId);
      const w = state.width;
      const h = state.height;
      const cy = Math.floor(h / 2);

      const caveMouth: RoomPlan = { label: "cave-mouth", originX: 0, originY: cy - 2, width: 5, height: 5, exits: [{ direction: "east" }] };
      const huntingHall: RoomPlan = {
        label: "hunting-hall",
        originX: 6,
        originY: cy - 4,
        width: 8,
        height: 8,
        exits: [{ direction: "west" }, { direction: "north" }, { direction: "south" }, { direction: "east" }],
        obstacleCorners: true,
      };
      const nest: RoomPlan = { label: "nest", originX: 8, originY: 0, width: 5, height: 4, exits: [{ direction: "south" }] };
      const alphaLair: RoomPlan = {
        label: "alpha-lair",
        originX: Math.min(w - 7, 15),
        originY: cy - 3,
        width: 7,
        height: 7,
        exits: [{ direction: "west" }],
        hazardCenter: true,
      };
      const boneStore: RoomPlan = { label: "bone-store", originX: 8, originY: h - 4, width: 5, height: 4, exits: [{ direction: "north" }] };

      const corridors: CorridorPlan[] = [
        { fromX: caveMouth.originX + caveMouth.width, fromY: cy, toX: huntingHall.originX - 1, toY: cy },
        { fromX: huntingHall.originX + huntingHall.width, fromY: cy, toX: alphaLair.originX - 1, toY: cy },
        { fromX: nest.originX + 2, fromY: nest.originY + nest.height, toX: nest.originX + 2, toY: huntingHall.originY - 1 },
        { fromX: boneStore.originX + 2, fromY: huntingHall.originY + huntingHall.height, toX: boneStore.originX + 2, toY: boneStore.originY - 1 },
      ];

      const rooms = [caveMouth, huntingHall, nest, alphaLair, boneStore];
      applyLayout(mapId, rooms, corridors);

      // The alpha stands just north of the lair's central hazard tile rather than on it.
      placeSpawn(mapId, {
        x: alphaLair.originX + 3,
        y: alphaLair.originY + 2,
        role: "enemy",
        npcName: "Alpha werewolf",
      });
      placeSpawn(mapId, { x: nest.originX + 2, y: nest.originY + 2, role: "enemy", npcName: "Werewolf cub" });

      if (addPlayerSpawn !== false) {
        placeSpawn(mapId, { x: caveMouth.originX + 1, y: caveMouth.originY + 2, role: "player" });
      }

      return asText({ ok: true, layout: "werewolf_den", rooms: rooms.map((r) => r.label), summary: describeMap(mapId) });
    },
  );
}
