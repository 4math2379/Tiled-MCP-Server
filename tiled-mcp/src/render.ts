// Render a Tiled map produced by this server to a PNG preview, without the Tiled editor.
// Draws the tile layers the way Tiled does (layer by layer, right-down order) and overlays a
// marker on every object and spawn so you can check where they landed. Supports isometric and
// orthogonal maps with image-collection tilesets (what this server writes); object positions
// are decoded with Tiled's native convention.

import { loadSharp } from "./sharp.js";
import type { TiledMap, TiledObjectGroup, TiledTileLayer } from "./types.js";

export interface PreviewOptions {
  /** Downscale the image to at most this width in pixels. Default 1600. */
  maxWidth?: number;
  /** Draw object and spawn markers. Default true. */
  markers?: boolean;
}

const COLORS: Record<string, string> = {
  player: "#3ddc84",
  enemy: "#ff4d4f",
  npc: "#4da3ff",
  door: "#c08a4a",
  chest: "#ffd84d",
  trap: "#c77dff",
  lever: "#bbbbbb",
  stairs: "#4dd8e6",
};
const LETTER: Record<string, string> = { player: "P", enemy: "E", npc: "N", door: "D", chest: "C", trap: "T", lever: "L", stairs: "S" };

const PLACEHOLDER: Record<string, { color: string; block: boolean }> = {
  WALKABLE: { color: "#4a5363", block: false },
  DIFFICULT_TERRAIN: { color: "#8a7440", block: false },
  HAZARD: { color: "#b03a3a", block: false },
  WALL: { color: "#7d8796", block: true },
  OBSTACLE: { color: "#5b6472", block: true },
  DOOR: { color: "#9a6532", block: true },
  STAIRS: { color: "#4f8796", block: true },
};

/** A flat diamond (floors) or a small cube (walls, props) standing in for a missing sprite. */
function placeholderSvg(tileType: string, tw: number, th: number, iso: boolean): { markup: string; height: number } {
  const { color, block } = PLACEHOLDER[tileType] ?? PLACEHOLDER.WALKABLE;
  const stroke = `stroke="#0d1117" stroke-opacity="0.45" stroke-width="1"`;
  if (!iso) {
    return {
      markup: `<svg xmlns="http://www.w3.org/2000/svg" width="${tw}" height="${th}"><rect x="0.5" y="0.5" width="${tw - 1}" height="${th - 1}" fill="${color}" ${stroke}/></svg>`,
      height: th,
    };
  }
  const h = block ? th * 2 : th;
  const top = 0;
  const diamond = `${tw / 2},${top} ${tw},${top + th / 2} ${tw / 2},${top + th} 0,${top + th / 2}`;
  const faces = block
    ? `<polygon points="0,${th / 2} ${tw / 2},${th} ${tw / 2},${2 * th} 0,${1.5 * th}" fill="${color}" fill-opacity="0.75" ${stroke}/>` +
      `<polygon points="${tw},${th / 2} ${tw / 2},${th} ${tw / 2},${2 * th} ${tw},${1.5 * th}" fill="${color}" fill-opacity="0.55" ${stroke}/>`
    : "";
  return {
    markup: `<svg xmlns="http://www.w3.org/2000/svg" width="${tw}" height="${h}">${faces}<polygon points="${diamond}" fill="${color}" ${stroke}/></svg>`,
    height: h,
  };
}

/**
 * @param readImage returns the bytes of a tile image given its path as written in the map
 *   (e.g. "./assets/crypt/wall.png"), or undefined when it is missing (the tile is skipped).
 */
export async function renderMapPreview(
  map: TiledMap,
  readImage: (imagePath: string) => Buffer | undefined,
  options: PreviewOptions = {},
): Promise<Buffer> {
  const sharp = await loadSharp();
  const maxWidth = options.maxWidth ?? 1600;
  const markers = options.markers ?? true;
  const { width: W, height: H, tilewidth: tw, tileheight: th } = map;
  const iso = map.orientation === "isometric";

  // gid -> image; tiles whose sprite is missing get a flat placeholder coloured by tile type,
  // so maps in themes without sprites still show their layout.
  const tiles = new Map<number, { buffer: Buffer; height: number }>();
  const placeholders = new Map<string, { buffer: Buffer; height: number }>();
  for (const ts of map.tilesets) {
    for (const t of ts.tiles ?? []) {
      const buffer = t.image ? readImage(t.image) : undefined;
      if (buffer) {
        tiles.set(ts.firstgid + t.id, { buffer, height: t.imageheight ?? th });
        continue;
      }
      const type = String(t.properties?.find((p) => p.name === "tileType")?.value ?? "WALKABLE");
      if (!placeholders.has(type)) {
        const svg = placeholderSvg(type, tw, th, iso);
        placeholders.set(type, { buffer: await sharp(Buffer.from(svg.markup)).png().toBuffer(), height: svg.height });
      }
      tiles.set(ts.firstgid + t.id, placeholders.get(type)!);
    }
  }
  const tallest = Math.max(th, ...[...tiles.values()].map((t) => t.height));
  const pad = tallest - th;

  const canvasW = iso ? ((W + H) * tw) / 2 : W * tw;
  const canvasH = (iso ? ((W + H) * th) / 2 : H * th) + pad;
  const originX = iso ? (H * tw) / 2 : 0;

  /** Top corner (iso) or top-left (ortho) of a cell, in canvas pixels. */
  const cellToScreen = (col: number, row: number) =>
    iso
      ? { x: ((col - row) * tw) / 2 + originX, y: ((col + row) * th) / 2 + pad }
      : { x: col * tw, y: row * th + pad };

  const composites: Array<{ input: Buffer; left: number; top: number }> = [];
  for (const layer of map.layers) {
    if (layer.type !== "tilelayer" || !layer.visible) continue;
    const data = (layer as TiledTileLayer).data;
    for (let row = 0; row < H; row++) {
      for (let col = 0; col < W; col++) {
        const gid = data[row * W + col];
        const tile = gid ? tiles.get(gid) : undefined;
        if (!tile) continue;
        const p = cellToScreen(col, row);
        const left = Math.round(iso ? p.x - tw / 2 : p.x);
        const top = Math.round(p.y + th - tile.height);
        composites.push({ input: tile.buffer, left, top });
      }
    }
  }

  if (markers) {
    let svg = "";
    for (const layer of map.layers) {
      if (layer.type !== "objectgroup") continue;
      for (const o of (layer as TiledObjectGroup).objects) {
        const col = Math.floor(o.x / (iso ? th : tw));
        const row = Math.floor(o.y / th);
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
  return sharp(full)
    .resize(Math.round(canvasW * scale), Math.round(canvasH * scale), { kernel: "lanczos3" })
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toBuffer();
}
