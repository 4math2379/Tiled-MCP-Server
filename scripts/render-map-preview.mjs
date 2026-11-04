// Render a .tmj map produced by this server to a PNG preview, without the Tiled editor.
// Draws the tile layers the way Tiled does (layer by layer, right-down order) and overlays
// a marker on every object and spawn so you can check where they landed.
//
// Usage (from the repository root, after npm install):
//   node scripts/render-map-preview.mjs maps/forteresse-glace-etage.tmj
//   node scripts/render-map-preview.mjs <map.tmj> [out.png] [--width 1600] [--no-markers]
//
// Supports isometric and orthogonal maps with image-collection tilesets (what this server
// writes). Object positions are decoded with Tiled's native convention.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

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
const maxWidth = Number(option("--width", "1600"));
const markers = !flag("--no-markers");

const mapPath = resolve(input);
const map = JSON.parse(readFileSync(mapPath, "utf8"));
const { width: W, height: H, tilewidth: tw, tileheight: th, orientation } = map;
const iso = orientation === "isometric";

// gid -> { buffer, width, height }
const tiles = new Map();
for (const ts of map.tilesets) {
  for (const t of ts.tiles ?? []) {
    if (!t.image) continue;
    const file = resolve(dirname(mapPath), t.image);
    try {
      tiles.set(ts.firstgid + t.id, { buffer: readFileSync(file), width: t.imagewidth, height: t.imageheight });
    } catch {
      console.warn(`missing sprite: ${t.image}`);
    }
  }
}
const tallest = Math.max(th, ...[...tiles.values()].map((t) => t.height));
const pad = tallest - th;

const canvasW = iso ? ((W + H) * tw) / 2 : W * tw;
const canvasH = (iso ? ((W + H) * th) / 2 : H * th) + pad;
const originX = iso ? (H * tw) / 2 : 0;

/** Top corner (iso) or top-left (ortho) of a cell, in canvas pixels. */
function cellToScreen(col, row) {
  return iso
    ? { x: ((col - row) * tw) / 2 + originX, y: ((col + row) * th) / 2 + pad }
    : { x: col * tw, y: row * th + pad };
}

const composites = [];
for (const layer of map.layers) {
  if (layer.type !== "tilelayer" || !layer.visible) continue;
  for (let row = 0; row < H; row++) {
    for (let col = 0; col < W; col++) {
      const gid = layer.data[row * W + col];
      const tile = gid && tiles.get(gid);
      if (!tile) continue;
      const p = cellToScreen(col, row);
      const left = Math.round(iso ? p.x - tw / 2 : p.x);
      const top = Math.round(p.y + th - tile.height);
      composites.push({ input: tile.buffer, left, top });
    }
  }
}

if (markers) {
  const COLORS = { player: "#3ddc84", enemy: "#ff4d4f", npc: "#4da3ff", door: "#c08a4a", chest: "#ffd84d", trap: "#c77dff", lever: "#bbbbbb", stairs: "#4dd8e6" };
  const LETTER = { player: "P", enemy: "E", npc: "N", door: "D", chest: "C", trap: "T", lever: "L", stairs: "S" };
  let svg = "";
  for (const layer of map.layers) {
    if (layer.type !== "objectgroup") continue;
    for (const o of layer.objects) {
      const unit = iso ? th : null;
      const col = Math.floor(o.x / (unit ?? tw));
      const row = Math.floor(o.y / (unit ?? th));
      const p = cellToScreen(col, row);
      const cx = iso ? p.x : p.x + tw / 2;
      const cy = p.y + th / 2;
      const kind = o.type ?? "";
      const color = COLORS[kind] ?? "#ffffff";
      const shape = iso
        ? `<polygon points="${cx},${cy - th / 2} ${cx + tw / 2},${cy} ${cx},${cy + th / 2} ${cx - tw / 2},${cy}" fill="${color}" fill-opacity="0.35" stroke="${color}" stroke-width="2"/>`
        : `<rect x="${p.x + 2}" y="${p.y + 2}" width="${tw - 4}" height="${th - 4}" fill="${color}" fill-opacity="0.35" stroke="${color}" stroke-width="2"/>`;
      svg += `${shape}<circle cx="${cx}" cy="${cy}" r="${th * 0.36}" fill="#111" stroke="${color}" stroke-width="2"/><text x="${cx}" y="${cy + th * 0.17}" font-family="Arial, Helvetica, sans-serif" font-size="${th * 0.48}" font-weight="700" fill="${color}" text-anchor="middle">${LETTER[kind] ?? "?"}</text>`;
    }
  }
  composites.push({
    input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}">${svg}</svg>`),
    left: 0,
    top: 0,
  });
}

const full = await sharp({
  create: { width: canvasW, height: canvasH, channels: 4, background: { r: 13, g: 17, b: 23, alpha: 1 } },
})
  .composite(composites)
  .png()
  .toBuffer();

const scale = Math.min(1, maxWidth / canvasW);
await sharp(full)
  .resize(Math.round(canvasW * scale), Math.round(canvasH * scale), { kernel: "lanczos3" })
  .png({ compressionLevel: 9, palette: true, quality: 90 })
  .toFile(output);
console.log(`Wrote ${output} (${Math.round(canvasW * scale)}x${Math.round(canvasH * scale)}, ${composites.length} sprites)`);
