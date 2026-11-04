// Render a .tmj map produced by this server to a PNG preview, without the Tiled editor.
// Draws the tile layers the way Tiled does (layer by layer, right-down order) and overlays
// a marker on every object and spawn so you can check where they landed.
//
// Usage (from the repository root, after npm install && npm run build):
//   node scripts/render-map-preview.mjs maps/forteresse-glace-etage.tmj
//   node scripts/render-map-preview.mjs <map.tmj> [out.png] [--width 1600] [--no-markers]
//
// The renderer itself lives in tiled-mcp/src/render.ts and is shared with the hosted web page.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { renderMapPreview } from "../tiled-mcp/dist/render.js";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const positional = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1] === "--width"));
const [input, output = input?.replace(/\.(tmj|json)$/i, "") + ".png"] = positional;
if (!input) {
  console.error("Usage: node scripts/render-map-preview.mjs <map.tmj> [out.png] [--width 1600] [--no-markers]");
  process.exit(1);
}

const mapPath = resolve(input);
const map = JSON.parse(readFileSync(mapPath, "utf8"));
let sprites = 0;
const png = await renderMapPreview(
  map,
  (image) => {
    try {
      const data = readFileSync(resolve(dirname(mapPath), image));
      sprites++;
      return data;
    } catch {
      console.warn(`missing sprite: ${image}`);
      return undefined;
    }
  },
  { maxWidth: Number(option("--width", "1600")), markers: !flag("--no-markers") },
);
writeFileSync(output, png);
console.log(`Wrote ${output} (${sprites} tile sprites loaded)`);
