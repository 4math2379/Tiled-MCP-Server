// Render a Tiled map produced by this server to a PNG preview, without the Tiled editor.
// Draws the layers the way Tiled does (layer by layer, right-down order, tile objects such as
// buildings anchored at their bottom centre) and overlays a marker on every object and spawn so
// you can check where they landed. Supports isometric and orthogonal maps with image-collection
// tilesets (what this server writes); object positions are decoded with Tiled's native convention.
//
// Large maps are drawn straight at a reduced scale into a raw pixel buffer, so a 256x256 map
// never allocates its full-size canvas (16384 pixels wide) or hands sharp 200,000 overlays.

import { loadSharp } from "./sharp.js";
import type { TiledMap, TiledObjectGroup, TiledTileLayer } from "./types.js";

export interface PreviewOptions {
  /** Downscale the image to at most this width in pixels. Default 1600. */
  maxWidth?: number;
  /** Draw object and spawn markers. Default true. */
  markers?: boolean;
}

/** Above this many pixels the map is drawn at a reduced scale before the final resize. */
const FULL_RES_PIXELS = 16_000_000;
const BACKGROUND = [13, 17, 23] as const;

const COLORS: Record<string, string> = {
  player: "#3ddc84",
  enemy: "#ff4d4f",
  npc: "#4da3ff",
  arrival: "#e6e6e6",
  door: "#c08a4a",
  chest: "#ffd84d",
  trap: "#c77dff",
  lever: "#bbbbbb",
  stairs: "#4dd8e6",
  entrance: "#ff9f1c",
  exit: "#ff9f1c",
};
const LETTER: Record<string, string> = {
  player: "P",
  enemy: "E",
  npc: "N",
  arrival: "A",
  door: "D",
  chest: "C",
  trap: "T",
  lever: "L",
  stairs: "S",
  entrance: "I",
  exit: "O",
};

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

/** A walled box with a pitched roof over the footprint, standing in for a missing building sprite. */
function buildingPlaceholderSvg(w: number, h: number): string {
  const dh = w / 2; // height of the footprint diamond
  const k = Math.max(dh / 2, (h - dh) * 0.55); // wall height
  const by = h; // bottom corner
  const sy = h - dh / 2; // left and right corners
  const stroke = `stroke="#0d1117" stroke-opacity="0.6" stroke-width="2"`;
  const apex = `${w / 2},${Math.max(0, sy - k - dh / 2)}`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<polygon points="0,${sy} ${w / 2},${by} ${w / 2},${by - k} 0,${sy - k}" fill="#8a6a48" ${stroke}/>` +
    `<polygon points="${w / 2},${by} ${w},${sy} ${w},${sy - k} ${w / 2},${by - k}" fill="#6e5238" ${stroke}/>` +
    `<polygon points="0,${sy - k} ${w / 2},${by - k} ${apex}" fill="#7a3b33" ${stroke}/>` +
    `<polygon points="${w / 2},${by - k} ${w},${sy - k} ${apex}" fill="#5e2c26" ${stroke}/>` +
    `</svg>`
  );
}

interface TileImage {
  buffer: Buffer;
  width: number;
  height: number;
}

interface Draw {
  gid: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Pixels {
  data: Buffer;
  w: number;
  h: number;
}

/** Alpha-blend `src` onto the opaque RGBA canvas `dst` at (x0, y0), clipped to the canvas. */
function blend(dst: Buffer, dw: number, dh: number, src: Pixels, x0: number, y0: number): void {
  const xs = Math.max(0, -x0);
  const ys = Math.max(0, -y0);
  const xe = Math.min(src.w, dw - x0);
  const ye = Math.min(src.h, dh - y0);
  const s = src.data;
  for (let y = ys; y < ye; y++) {
    let si = (y * src.w + xs) * 4;
    let di = ((y0 + y) * dw + x0 + xs) * 4;
    for (let x = xs; x < xe; x++, si += 4, di += 4) {
      const a = s[si + 3];
      if (a === 0) continue;
      if (a === 255) {
        dst[di] = s[si];
        dst[di + 1] = s[si + 1];
        dst[di + 2] = s[si + 2];
        continue;
      }
      const k = a / 255;
      dst[di] = (s[si] * k + dst[di] * (1 - k) + 0.5) | 0;
      dst[di + 1] = (s[si + 1] * k + dst[di + 1] * (1 - k) + 0.5) | 0;
      dst[di + 2] = (s[si + 2] * k + dst[di + 2] * (1 - k) + 0.5) | 0;
    }
  }
}

/**
 * @param readImage returns the bytes of a tile image given its path as written in the map
 *   (e.g. "./assets/crypt/wall.png"), or undefined when it is missing (a placeholder is drawn).
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

  // gid -> image; tiles whose sprite is missing get a placeholder coloured by tile type, so maps
  // in themes without sprites still show their layout.
  const images = new Map<number, TileImage>();
  const bottomAligned = new Set<number>();
  const placeholders = new Map<string, TileImage>();
  for (const ts of map.tilesets) {
    for (const t of ts.tiles ?? []) {
      const gid = ts.firstgid + t.id;
      if (ts.objectalignment === "bottom") bottomAligned.add(gid);
      const width = t.imagewidth ?? tw;
      const height = t.imageheight ?? th;
      const buffer = t.image ? readImage(t.image) : undefined;
      if (buffer) {
        images.set(gid, { buffer, width, height });
        continue;
      }
      const type = String(t.properties?.find((p) => p.name === "tileType")?.value ?? "WALKABLE");
      const key = type === "BUILDING" ? `BUILDING:${width}x${height}` : type;
      if (!placeholders.has(key)) {
        if (type === "BUILDING") {
          const png = await sharp(Buffer.from(buildingPlaceholderSvg(width, height))).png().toBuffer();
          placeholders.set(key, { buffer: png, width, height });
        } else {
          const svg = placeholderSvg(type, tw, th, iso);
          const png = await sharp(Buffer.from(svg.markup)).png().toBuffer();
          placeholders.set(key, { buffer: png, width: tw, height: svg.height });
        }
      }
      images.set(gid, placeholders.get(key)!);
    }
  }

  /** Top corner (iso) or top-left (ortho) of a cell, in map pixels (cell (0,0) at x = 0). */
  const cellTop = (col: number, row: number) =>
    iso ? { x: ((col - row) * tw) / 2, y: ((col + row) * th) / 2 } : { x: col * tw, y: row * th };

  const draws: Draw[] = [];
  for (const layer of map.layers) {
    if (!layer.visible) continue;
    if (layer.type === "tilelayer") {
      const data = (layer as TiledTileLayer).data;
      for (let row = 0; row < H; row++) {
        for (let col = 0; col < W; col++) {
          const gid = data[row * W + col];
          const img = gid ? images.get(gid) : undefined;
          if (!img) continue;
          const p = cellTop(col, row);
          draws.push({ gid, left: iso ? p.x - tw / 2 : p.x, top: p.y + th - img.height, width: img.width, height: img.height });
        }
      }
      continue;
    }
    // Tile objects (building sprites), back to front.
    const tileObjects = (layer as TiledObjectGroup).objects
      .filter((o) => o.gid && o.visible !== false)
      .sort((a, b) => a.x + a.y - (b.x + b.y));
    for (const o of tileObjects) {
      const gid = o.gid! & 0x1fffffff;
      const img = images.get(gid);
      if (!img) continue;
      const w = o.width ?? img.width;
      const h = o.height ?? img.height;
      const p = iso ? { x: ((o.x - o.y) / th) * (tw / 2), y: (o.x + o.y) / 2 } : { x: o.x, y: o.y };
      const centred = iso || bottomAligned.has(gid);
      draws.push({ gid, left: centred ? p.x - w / 2 : p.x, top: p.y - h, width: w, height: h });
    }
  }

  // Canvas bounds in map pixels: the whole grid plus anything drawn outside it.
  let minX = iso ? -(H * tw) / 2 : 0;
  let minY = 0;
  let maxX = iso ? (W * tw) / 2 : W * tw;
  let maxY = iso ? ((W + H) * th) / 2 : H * th;
  for (const d of draws) {
    minX = Math.min(minX, d.left);
    minY = Math.min(minY, d.top);
    maxX = Math.max(maxX, d.left + d.width);
    maxY = Math.max(maxY, d.top + d.height);
  }
  const fullW = Math.ceil(maxX - minX);
  const fullH = Math.ceil(maxY - minY);
  const target = Math.min(1, maxWidth / fullW);
  const scale = fullW * fullH <= FULL_RES_PIXELS ? 1 : Math.max(target, Math.sqrt(FULL_RES_PIXELS / (fullW * fullH)));
  const cw = Math.max(1, Math.round(fullW * scale));
  const ch = Math.max(1, Math.round(fullH * scale));

  // Decode every distinct (image, size) once at the drawing scale.
  const sizeOf = (d: Draw) => ({ w: Math.max(1, Math.round(d.width * scale)), h: Math.max(1, Math.round(d.height * scale)) });
  const pixels = new Map<string, Pixels>();
  for (const d of draws) {
    const { w, h } = sizeOf(d);
    const key = `${d.gid}:${w}x${h}`;
    if (pixels.has(key)) continue;
    const data = await sharp(images.get(d.gid)!.buffer)
      .resize(w, h, { fit: "fill", kernel: "lanczos3" })
      .ensureAlpha()
      .raw()
      .toBuffer();
    pixels.set(key, { data, w, h });
  }

  const canvas = Buffer.alloc(cw * ch * 4);
  for (let i = 0; i < canvas.length; i += 4) {
    canvas[i] = BACKGROUND[0];
    canvas[i + 1] = BACKGROUND[1];
    canvas[i + 2] = BACKGROUND[2];
    canvas[i + 3] = 255;
  }
  for (const d of draws) {
    const { w, h } = sizeOf(d);
    blend(canvas, cw, ch, pixels.get(`${d.gid}:${w}x${h}`)!, Math.round((d.left - minX) * scale), Math.round((d.top - minY) * scale));
  }

  let image = sharp(canvas, { raw: { width: cw, height: ch, channels: 4 } });
  if (markers) {
    let svg = "";
    for (const layer of map.layers) {
      if (layer.type !== "objectgroup") continue;
      for (const o of (layer as TiledObjectGroup).objects) {
        if (o.gid) continue; // building sprites are drawn, not marked
        const col = Math.floor(o.x / (iso ? th : tw));
        const row = Math.floor(o.y / th);
        const p = cellTop(col, row);
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
    if (svg) {
      const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${cw}" height="${ch}" viewBox="${minX} ${minY} ${fullW} ${fullH}" preserveAspectRatio="none">${svg}</svg>`;
      image = sharp(await image.composite([{ input: Buffer.from(overlay), left: 0, top: 0 }]).png().toBuffer());
    }
  }

  const finalScale = Math.min(1, target / scale);
  return image
    .resize(Math.max(1, Math.round(cw * finalScale)), Math.max(1, Math.round(ch * finalScale)), { kernel: "lanczos3" })
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toBuffer();
}
