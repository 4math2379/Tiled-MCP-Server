/** Wrap a JSON-serialisable payload as an MCP text result. */
export function asText(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
  };
}

/** Shared wording so every tool explains the grid the same way. */
export const GRID_HELP =
  "Coordinates are grid cells: x is the column (0..width-1), y is the row (0..height-1), (0,0) is the top corner of an isometric map (top-left of an orthogonal one).";
