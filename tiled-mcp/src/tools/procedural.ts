import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getMap, paintRect, paintTile, paintWallBorder, placeObject } from "../builder.js";
import { GRID_HELP, asText } from "./util.js";

const EXIT_DIR = z.enum(["north", "south", "east", "west"]);

interface ExitSpec {
  direction: "north" | "south" | "east" | "west";
  offset?: number;
}

/**
 * Paints a room: walkable floor, a wall border, a doorway (wall removed + door object) per
 * exit, and optionally a central hazard and corner obstacles. North is the room's top edge
 * (row originY), west its left edge (column originX).
 */
function applyRoom(
  mapId: string,
  originX: number,
  originY: number,
  width: number,
  height: number,
  exits: ExitSpec[],
  options: { hazardCenter?: boolean; obstacleCorners?: boolean },
): { painted: number; doors: number[] } {
  const state = getMap(mapId);
  if (originX < 0 || originY < 0 || originX + width > state.width || originY + height > state.height) {
    throw new Error(
      `Room out of bounds: origin (${originX},${originY}) size ${width}x${height} does not fit in the ${state.width}x${state.height} grid.`,
    );
  }

  const painted = paintRect(
    mapId,
    "ground",
    originX,
    originY,
    originX + width - 1,
    originY + height - 1,
    "walkable_floor",
  );
  paintWallBorder(mapId, originX, originY, originX + width - 1, originY + height - 1);

  // Doorways: open the wall, keep a floor tile under it, add a closed door object.
  const doors: number[] = [];
  for (const exit of exits) {
    const along = exit.direction === "north" || exit.direction === "south" ? width : height;
    const offset = exit.offset ?? Math.floor(along / 2);
    if (offset >= along) {
      throw new Error(`Exit offset ${offset} is outside the ${exit.direction} wall (length ${along}).`);
    }
    let dx = originX;
    let dy = originY;
    switch (exit.direction) {
      case "north":
        dx = originX + offset;
        dy = originY;
        break;
      case "south":
        dx = originX + offset;
        dy = originY + height - 1;
        break;
      case "west":
        dx = originX;
        dy = originY + offset;
        break;
      case "east":
        dx = originX + width - 1;
        dy = originY + offset;
        break;
    }
    state.walls.data[dy * state.width + dx] = 0;
    paintTile(mapId, "ground", dx, dy, "walkable_floor");
    doors.push(placeObject(mapId, { x: dx, y: dy, kind: "door", state: "closed" }));
  }

  if (options.hazardCenter && state.roleToGid.has("hazard_primary")) {
    const cx = originX + Math.floor(width / 2);
    const cy = originY + Math.floor(height / 2);
    paintTile(mapId, "ground", cx, cy, "hazard_primary");
  }

  if (options.obstacleCorners && state.roleToGid.has("obstacle_decor")) {
    const corners = [
      { x: originX + 1, y: originY + 1 },
      { x: originX + width - 2, y: originY + 1 },
      { x: originX + 1, y: originY + height - 2 },
      { x: originX + width - 2, y: originY + height - 2 },
    ];
    for (const c of corners) {
      if (c.x > originX && c.x < originX + width - 1 && c.y > originY && c.y < originY + height - 1) {
        paintTile(mapId, "decorations", c.x, c.y, "obstacle_decor");
      }
    }
  }

  return { painted, doors };
}

export function registerProceduralTools(server: McpServer): void {
  server.registerTool(
    "generate_room",
    {
      title: "Generate a room",
      description: `Builds a rectangular room in one call: walkable floor, a wall border, and a doorway with a closed door for each exit. Options add a hazard tile in the centre and obstacle props in the four inner corners (only if the theme defines those roles). originX/originY is the room's top-left cell; the walls are part of the room's width and height. ${GRID_HELP}`,
      inputSchema: {
        mapId: z.string(),
        originX: z.number().int().min(0),
        originY: z.number().int().min(0),
        width: z.number().int().min(3).max(40).describe("Outer width including walls"),
        height: z.number().int().min(3).max(40).describe("Outer height including walls"),
        exits: z
          .array(
            z.object({
              direction: EXIT_DIR.describe("north = top edge (row originY), west = left edge (column originX)"),
              offset: z
                .number()
                .int()
                .min(1)
                .optional()
                .describe("Cells from the start of that wall (default: middle). 1 is the first cell after the corner."),
            }),
          )
          .max(4)
          .optional(),
        hazardCenter: z.boolean().optional().describe("Paint the theme's hazard_primary tile at the room centre"),
        obstacleCorners: z.boolean().optional().describe("Paint obstacle_decor props in the four inner corners"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async ({ mapId, originX, originY, width, height, exits, hazardCenter, obstacleCorners }) => {
      const result = applyRoom(mapId, originX, originY, width, height, exits ?? [], { hazardCenter, obstacleCorners });
      return asText({ ok: true, ...result });
    },
  );

  server.registerTool(
    "generate_corridor",
    {
      title: "Generate a corridor",
      description: `Draws a straight, axis-aligned corridor between (fromX,fromY) and (toX,toY): walkable floor plus side walls. Interior width defaults to 1 (3 cells including both walls). Side walls that cross an existing room are painted too, so connect corridors to doorways. ${GRID_HELP}`,
      inputSchema: {
        mapId: z.string(),
        fromX: z.number().int().min(0),
        fromY: z.number().int().min(0),
        toX: z.number().int().min(0),
        toY: z.number().int().min(0),
        width: z.number().int().min(1).max(4).optional().describe("Interior width in cells (default 1)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async ({ mapId, fromX, fromY, toX, toY, width }) => {
      const w = width ?? 1;
      const state = getMap(mapId);
      const isHoriz = fromY === toY;
      const isVert = fromX === toX;
      if (!isHoriz && !isVert) {
        throw new Error("A corridor must be strictly horizontal or vertical: use the same y (horizontal) or the same x (vertical), or chain two corridors.");
      }

      const xa = Math.min(fromX, toX);
      const xb = Math.max(fromX, toX);
      const ya = Math.min(fromY, toY);
      const yb = Math.max(fromY, toY);

      let painted = 0;
      if (isHoriz) {
        const halfW = Math.floor(w / 2);
        const top = ya - halfW;
        const bottom = ya + (w - halfW - 1);
        for (let x = xa; x <= xb; x++) {
          for (let y = top; y <= bottom; y++) {
            if (y < 0 || y >= state.height) continue;
            paintTile(mapId, "ground", x, y, "walkable_floor");
            painted++;
          }
          if (top - 1 >= 0) paintTile(mapId, "walls", x, top - 1, "wall");
          if (bottom + 1 < state.height) paintTile(mapId, "walls", x, bottom + 1, "wall");
        }
      } else {
        const halfW = Math.floor(w / 2);
        const left = xa - halfW;
        const right = xa + (w - halfW - 1);
        for (let y = ya; y <= yb; y++) {
          for (let x = left; x <= right; x++) {
            if (x < 0 || x >= state.width) continue;
            paintTile(mapId, "ground", x, y, "walkable_floor");
            painted++;
          }
          if (left - 1 >= 0) paintTile(mapId, "walls", left - 1, y, "wall");
          if (right + 1 < state.width) paintTile(mapId, "walls", right + 1, y, "wall");
        }
      }
      return asText({ ok: true, painted, length: isHoriz ? xb - xa + 1 : yb - ya + 1, width: w });
    },
  );
}

export { applyRoom };
