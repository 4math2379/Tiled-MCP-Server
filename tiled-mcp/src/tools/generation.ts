// Optional, paid sprite generation with FLUX.1-dev through Hugging Face Inference Providers.
// Everything else in this server is free and offline. sharp and @huggingface/inference are
// loaded lazily so the map tools keep working even if those packages fail to install.
// In hosted mode the call is billed to the caller's own token and the sprite stays in their
// session (src/sprites.ts) instead of the server's disk.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { buildBuildingPrompt, buildPrompt, NEGATIVE_PROMPT, type ThemeKey } from "../themes/prompts.js";
import { BUILDINGS, BUILDING_TYPES, buildingSpriteFile } from "../buildings.js";
import { themeAssetDir, themeKeySchema } from "../themes/index.js";
import { THEME_ROLES } from "../types.js";
import { getMap, overrideTileImage } from "../builder.js";
import { assetsRoot, resolveUserPath } from "../paths.js";
import { ASSET_PREFIX } from "../tmj.js";
import { currentScope, isHosted } from "../context.js";
import { loadSharp, type Sharp } from "../sharp.js";
import { saveSprite, spriteExists } from "../sprites.js";
import { asText } from "./util.js";

/**
 * Magenta chroma key. FLUX is asked for a pure #FF00FF background, a colour no gothic sprite
 * contains, so removing it keeps the subject intact (deep blacks, shadows, iron included).
 * Uses R/G and B/G ratios to also catch the desaturated magenta FLUX often produces
 * (e.g. R142 G41 B100). Fully magenta pixels become transparent neutral grey (no halo after
 * resize); partially magenta edge pixels fade out and are desaturated.
 */
async function chromaKeyMagenta(sharp: Sharp, buf: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.from(data);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const gSafe = Math.max(g, 1);
    const rRatio = r / gSafe;
    const bRatio = b / gSafe;
    const isFullMagenta = g < 80 && rRatio > 1.4 && bRatio > 1.4;
    const isPartialMagenta = g < 130 && rRatio > 1.2 && bRatio > 1.2;
    if (isFullMagenta) {
      out[i] = 128;
      out[i + 1] = 128;
      out[i + 2] = 128;
      out[i + 3] = 0;
    } else if (isPartialMagenta) {
      const fade = (g - 80) / 50; // 0..1: the greener, the more we keep
      out[i + 3] = Math.round(fade * 255);
      const avg = Math.round((r + g + b) / 3);
      const ds = 1 - fade;
      out[i] = Math.round(r * fade + avg * ds);
      out[i + 1] = Math.round(g * fade + avg * ds);
      out[i + 2] = Math.round(b * fade + avg * ds);
    }
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

/**
 * Downsample to the final iso tile size, keeping alpha:
 * - surface (floors, minor decorations): centre 2:1 strip, resized to 64x32
 * - cube (walls, obstacles, doors, stairs): centre square, resized to 64x64
 */
async function resizeForTile(sharp: Sharp, buf: Buffer, geometry: "surface" | "cube"): Promise<Buffer> {
  const meta = await sharp(buf).metadata();
  const w = meta.width ?? 1024;
  const h = meta.height ?? 1024;
  if (geometry === "surface") {
    const cropH = Math.floor(w / 2);
    const top = Math.max(0, Math.floor((h - cropH) / 2));
    return sharp(buf)
      .extract({ left: 0, top, width: w, height: cropH })
      .resize(64, 32, { kernel: "lanczos3" })
      .png()
      .toBuffer();
  }
  const side = Math.min(w, h);
  return sharp(buf)
    .extract({ left: Math.floor((w - side) / 2), top: Math.floor((h - side) / 2), width: side, height: side })
    .resize(64, 64, { kernel: "lanczos3" })
    .png()
    .toBuffer();
}

/** The token paid calls use. Hosted mode only ever uses the caller's own token. */
function hfToken(): string | null {
  if (isHosted()) return currentScope().hfToken ?? null;
  return process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN || null;
}

const FLUX_MODEL = "black-forest-labs/FLUX.1-dev";
/** How long the provider picked automatically is reused before asking the Hub again. */
const PROVIDER_TTL_MS = 60 * 60 * 1000;
let autoProvider: { name: string; at: number } | undefined;

/**
 * Providers routing FLUX.1-dev right now, from the Hub's public routing table. The list changes
 * over time (Replicate stopped serving the model in 2026), so it is never hard-coded.
 */
async function fluxProviders(): Promise<Array<{ provider: string; status: string }>> {
  const res = await fetch(`https://huggingface.co/api/models/${FLUX_MODEL}?expand[]=inferenceProviderMapping`);
  if (!res.ok) throw new Error(`Hugging Face did not return the providers of ${FLUX_MODEL} (HTTP ${res.status}).`);
  const raw = ((await res.json()) as { inferenceProviderMapping?: unknown }).inferenceProviderMapping;
  if (Array.isArray(raw)) {
    return raw.map((m: { provider?: unknown; status?: unknown }) => ({ provider: String(m.provider), status: String(m.status) }));
  }
  return Object.entries((raw ?? {}) as Record<string, { status?: unknown }>).map(([provider, m]) => ({
    provider,
    status: String(m?.status),
  }));
}

/** TILED_HF_PROVIDER when set (other than "auto"), otherwise the first provider live for FLUX.1-dev. */
export async function resolveFluxProvider(): Promise<string> {
  const configured = process.env.TILED_HF_PROVIDER?.trim();
  if (configured && configured.toLowerCase() !== "auto") return configured;
  if (!autoProvider || Date.now() - autoProvider.at > PROVIDER_TTL_MS) {
    const live = (await fluxProviders()).filter((p) => p.status === "live");
    if (!live.length) throw new Error(`No Inference Provider serves ${FLUX_MODEL} right now: see https://huggingface.co/${FLUX_MODEL}.`);
    autoProvider = { name: live[0].provider, at: Date.now() };
  }
  return autoProvider.name;
}

/** Image size in the parameter shape each provider reads (they pass parameters through as is). */
function sizeParameters(provider: string, d: { width: number; height: number }): Record<string, unknown> {
  switch (provider) {
    case "fal-ai":
      return { image_size: { width: d.width, height: d.height } };
    case "wavespeed":
      return { size: `${d.width}*${d.height}` };
    default:
      return { width: d.width, height: d.height };
  }
}

function missingToken() {
  return isHosted()
    ? {
        ok: false,
        error: "No Hugging Face token was sent with this request. Sprite generation is a paid Hugging Face service billed to your own account; map editing does not need it.",
        hint: "Configure your MCP client to send the header 'Authorization: Bearer hf_...' with a token that can make calls to Inference Providers. See docs/hugging-face.md.",
      }
    : {
        ok: false,
        error: "HUGGINGFACE_API_KEY (or HF_TOKEN) is not set. Sprite generation is a paid Hugging Face service; map editing does not need it.",
        hint: "Add the token to tiled-mcp/.env or to the env block of your MCP client configuration. See docs/sprite-generation.md.",
      };
}

/**
 * One FLUX.1-dev call; returns the image with its magenta background made transparent, and the
 * provider that served it. A provider error says which providers serve the model now.
 */
async function fluxKeyed(
  sharp: Sharp,
  prompt: string,
  dimensions: { width: number; height: number },
  seed?: number,
): Promise<{ keyed: Buffer; provider: string }> {
  const provider = await resolveFluxProvider();
  const parameters: Record<string, unknown> = {
    ...sizeParameters(provider, dimensions),
    negative_prompt: NEGATIVE_PROMPT,
    guidance_scale: 4.5,
    ...(seed !== undefined ? { seed } : {}),
  };
  const { InferenceClient } = await import("@huggingface/inference");
  const client = new InferenceClient(hfToken()!);
  let blob: Blob;
  try {
    blob = (await client.textToImage({
      model: FLUX_MODEL,
      provider: provider as never,
      inputs: prompt,
      parameters: parameters as never,
    })) as unknown as Blob;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!/provider/i.test(message)) throw err;
    const live = await fluxProviders()
      .then((list) => list.filter((p) => p.status === "live").map((p) => p.provider))
      .catch(() => [] as string[]);
    throw new Error(
      `${message} Provider used: ${provider}. Providers serving ${FLUX_MODEL} now: ${live.join(", ") || "unknown"}. Set TILED_HF_PROVIDER to one of them, or remove it to pick one automatically.`,
    );
  }
  return { keyed: await chromaKeyMagenta(sharp, Buffer.from(await blob.arrayBuffer())), provider };
}

/** Generate one sprite PNG and return the processed bytes. */
async function renderSprite(prompt: ReturnType<typeof buildPrompt>, seed?: number) {
  const sharp = await loadSharp();
  const { keyed } = await fluxKeyed(sharp, prompt.prompt, prompt.dimensions, seed);
  return resizeForTile(sharp, keyed, prompt.geometry);
}

/** Pixels with less alpha than this count as background when the key left a veil or specks. */
const SOLID_ALPHA = 250;
/** Pixels with less alpha than this count as background when the key left a clean border. */
const CLEAR_ALPHA = 32;

/**
 * Keep only the building of a keyed image, cropped to it. FLUX does not always paint a clean
 * magenta background (fal-ai often returns a pale pink or a grey noisy one), so the chroma key
 * can leave a translucent veil or specks; it can also half-erase purple-grey parts of the
 * building such as slate roofs. Here:
 * - background is what connects to the image border through see-through pixels: any pixel
 *   that is not fully opaque when the border holds a veil or specks, only nearly transparent
 *   ones when the border is already clean (so a half-keyed roof is not swept away);
 * - of the rest, only the largest connected shape is kept, which drops opaque specks;
 * - see-through pixels enclosed by the building (windows or roof tiles keyed out because they
 *   looked magenta) become opaque again.
 */
async function isolateSubject(sharp: Sharp, buf: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const n = w * h;
  let borderPixels = 0;
  let clearBorder = 0;
  for (let i = 0; i < n; i++) {
    const x = i % w;
    if (x !== 0 && x !== w - 1 && i >= w && i < n - w) continue;
    borderPixels++;
    if (data[i * 4 + 3] < CLEAR_ALPHA) clearBorder++;
  }
  const threshold = clearBorder >= 0.9 * borderPixels ? CLEAR_ALPHA : SOLID_ALPHA;
  const background = new Uint8Array(n);
  const stack: number[] = [];
  const reach = (i: number) => {
    if (!background[i] && data[i * 4 + 3] < threshold) {
      background[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x++) {
    reach(x);
    reach((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    reach(y * w);
    reach(y * w + w - 1);
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w;
    if (x > 0) reach(i - 1);
    if (x < w - 1) reach(i + 1);
    if (i >= w) reach(i - w);
    if (i < n - w) reach(i + w);
  }

  // Largest 8-connected shape among the remaining pixels.
  const label = new Int32Array(n);
  let best = 0;
  let bestSize = 0;
  let next = 0;
  for (let s = 0; s < n; s++) {
    if (background[s] || label[s]) continue;
    label[s] = ++next;
    let size = 0;
    stack.push(s);
    while (stack.length) {
      const i = stack.pop()!;
      size++;
      const x = i % w;
      const y = (i - x) / w;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if ((!dx && !dy) || xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const j = yy * w + xx;
          if (!background[j] && !label[j]) {
            label[j] = next;
            stack.push(j);
          }
        }
      }
    }
    if (size > bestSize) {
      bestSize = size;
      best = next;
    }
  }
  if (!best) return buf;

  const out = Buffer.from(data);
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    if (label[i] !== best) {
      out[p] = out[p + 1] = out[p + 2] = out[p + 3] = 0;
      continue;
    }
    const x = i % w;
    const y = (i - x) / w;
    if (data[p + 3] < 255) {
      const touchesBackground =
        (x > 0 && background[i - 1]) || (x < w - 1 && background[i + 1]) || (y > 0 && background[i - w]) || (y < h - 1 && background[i + w]);
      if (!touchesBackground) out[p + 3] = 255;
    }
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
    .png()
    .toBuffer();
}

/**
 * Turn a generated (or hand-made) building image into its sprite: isolate the building from its
 * background, then fit it into width x height standing on the bottom edge. Exported for
 * scripts/gen-building-sprites.mjs --clean, which repairs existing sprites for free.
 */
export async function cleanBuildingSprite(buf: Buffer, width: number, height: number): Promise<Buffer> {
  const sharp = await loadSharp();
  return fitBuilding(sharp, await isolateSubject(sharp, buf), width, height);
}

/**
 * Fit a keyed building image into its sprite size: trim the transparent margin, then scale it
 * to fit, standing on the bottom edge (the tile object's anchor) and centred horizontally.
 */
async function fitBuilding(sharp: Sharp, buf: Buffer, width: number, height: number): Promise<Buffer> {
  let trimmed = buf;
  try {
    trimmed = await sharp(buf).trim().toBuffer();
  } catch {
    // Nothing to trim (uniform image): keep it whole.
  }
  return sharp(trimmed)
    .resize(width, height, {
      fit: "contain",
      position: "south",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: "lanczos3",
    })
    .png()
    .toBuffer();
}

const THEME = themeKeySchema().describe("Theme key from list_themes");
const ROLE = z.enum(THEME_ROLES).describe("Tile role, e.g. walkable_floor, wall, obstacle_decor");
const PAID = { readOnlyHint: false, destructiveHint: false, openWorldHint: true } as const;

export function registerGenerationTools(server: McpServer): void {
  server.registerTool(
    "generate_tile_sprite",
    {
      title: "Generate one tile sprite (paid)",
      description:
        isHosted()
          ? "PAID, billed to the Hugging Face token you send: generates one isometric sprite for (theme, role) with FLUX.1-dev via Hugging Face Inference Providers, removes the magenta background and resizes it to 64x32 (floors) or 64x64 (walls, props). The sprite is returned as an image and kept with your session as <theme>/<role>.png, or <role>__<variant>.png when variant is set; maps of this session use it in previews and save_to_disk downloads. Takes 20-40 s and costs money per call; preview the prompt with preview_sprite_prompt first. Every theme already ships its sprites, so an existing one is kept unless force is true."
          : "PAID: generates one isometric sprite for (theme, role) with FLUX.1-dev via Hugging Face Inference Providers, removes the magenta background and resizes it to 64x32 (floors) or 64x64 (walls, props). Saves <assets>/<theme>/<role>.png, or <role>__<variant>.png when variant is set. Takes 20-40 s and costs money per call; check that the file is missing first (list_themes shows missing sprites) and preview the prompt with preview_sprite_prompt. An existing file is kept unless force is true.",
      inputSchema: {
        theme: THEME,
        role: ROLE,
        variant: z
          .string()
          .regex(/^[a-z0-9_]+$/)
          .optional()
          .describe("Contextual variant slug, e.g. 'alembic' for a laboratory: saved as <role>__<variant>.png and bound to a map with override_tile_image"),
        material: z.string().optional().describe("Override of the material description, e.g. 'alchemical workbench with brass alembics'"),
        lighting: z.string().optional().describe("Override of the lighting description"),
        extraDetail: z.string().optional().describe("Free text appended to the prompt"),
        seed: z.number().int().optional().describe("Seed for reproducibility"),
        force: z.boolean().optional().describe("Regenerate even if the file already exists (paid again)"),
        outputDir: z
          .string()
          .optional()
          .describe("Output folder; relative paths resolve against the assets folder. Defaults to <assets>/<theme_lowercase>/"),
      },
      annotations: PAID,
    },
    async ({ theme, role, variant, material, lighting, extraDetail, seed, force, outputDir }) => {
      if (!hfToken()) return asText(missingToken());
      const hosted = isHosted();
      if (hosted && outputDir) {
        return asText({
          ok: false,
          error: "outputDir is not available on the hosted server: generated sprites stay with your session and are included in the map download (save_to_disk).",
        });
      }
      const key = theme as ThemeKey;
      let rendered;
      try {
        rendered = buildPrompt(key, role, { material, lighting, extraDetail });
      } catch (err) {
        return asText({ ok: false, error: err instanceof Error ? err.message : String(err) });
      }

      const fileName = variant ? `${role}__${variant}.png` : `${role}.png`;
      const relPath = `${themeAssetDir(key)}/${fileName}`;
      const dir = outputDir ? resolveUserPath(outputDir, assetsRoot()) : join(assetsRoot(), themeAssetDir(key));
      const outPath = hosted ? relPath : join(dir, fileName);
      if ((hosted ? spriteExists(relPath) : existsSync(outPath)) && !force) {
        return asText({
          ok: false,
          skipped: true,
          outputPath: outPath,
          error: "The sprite already exists; nothing was generated or billed. Pass force: true to regenerate it.",
        });
      }

      const start = Date.now();
      try {
        const buf = await renderSprite(rendered, seed);
        const saved = await saveSprite(relPath, buf, outPath);
        const result = asText({
          ok: true,
          theme,
          role,
          variant: variant ?? null,
          geometry: rendered.geometry,
          outputPath: saved,
          finalSize: rendered.geometry === "surface" ? "64x32" : "64x64",
          relativePath: `${ASSET_PREFIX}${relPath}`,
          bytes: buf.length,
          durationMs: Date.now() - start,
          promptUsed: rendered.prompt,
        });
        // Hosted callers cannot read the server's disk: send them the image itself as well.
        return hosted
          ? { content: [...result.content, { type: "image" as const, data: buf.toString("base64"), mimeType: "image/png" }] }
          : result;
      } catch (err) {
        return asText({ ok: false, error: err instanceof Error ? err.message : String(err), promptAttempted: rendered.prompt });
      }
    },
  );

  server.registerTool(
    "override_tile_image",
    {
      title: "Use a sprite variant on one map",
      description:
        "Points one role of a single map's tileset at a variant image, e.g. obstacle_decor__alembic.png instead of obstacle_decor.png. Only that map changes; other maps and the theme keep their defaults. Call after create_map and before saving or exporting.",
      inputSchema: {
        mapId: z.string(),
        role: ROLE,
        variant: z
          .string()
          .regex(/^[a-z0-9_]+$/)
          .describe("Variant slug: the file <assets>/<theme>/<role>__<variant>.png should exist"),
        imageWidth: z.number().int().optional().describe("Image width in pixels if it differs from the default"),
        imageHeight: z.number().int().optional().describe("Image height in pixels if it differs from the default"),
        customPath: z
          .string()
          .optional()
          .describe("Use this image path verbatim instead of the './assets/<theme>/<role>__<variant>.png' convention"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ mapId, role, variant, imageWidth, imageHeight, customPath }) => {
      const state = getMap(mapId);
      const file = `${themeAssetDir(state.theme.key)}/${role}__${variant}.png`;
      const path = customPath ?? `${ASSET_PREFIX}${file}`;
      overrideTileImage(mapId, role, path, imageWidth, imageHeight);
      const fileExists = customPath ? undefined : spriteExists(file);
      const where = isHosted() ? file : join(assetsRoot(), file);
      return asText({
        ok: true,
        mapId,
        role,
        variant,
        imagePath: path,
        ...(fileExists === false
          ? { warning: `No file at ${where} yet: generate it with generate_tile_sprite (variant '${variant}') or Tiled will show a placeholder.` }
          : {}),
      });
    },
  );

  server.registerTool(
    "preview_sprite_prompt",
    {
      title: "Preview a sprite prompt (free)",
      description:
        "Free: returns the exact FLUX prompt, geometry and size generate_tile_sprite would use for (theme, role) with optional overrides, without calling any service. Use it to iterate on wording before paying for a generation.",
      inputSchema: {
        theme: THEME,
        role: ROLE,
        material: z.string().optional(),
        lighting: z.string().optional(),
        extraDetail: z.string().optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ theme, role, material, lighting, extraDetail }) => {
      try {
        return asText({ ok: true, ...buildPrompt(theme as ThemeKey, role, { material, lighting, extraDetail }) });
      } catch (err) {
        return asText({ ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    },
  );

  server.registerTool(
    "generate_building_sprite",
    {
      title: "Generate a building sprite (paid)",
      description:
        `PAID unless dryRun is true: generates the sprite place_building draws for a building type (${BUILDING_TYPES.join(", ")}) with FLUX.1-dev via Hugging Face Inference Providers, removes the magenta background and fits the building into its footprint size (house and shop 192x192, tavern and temple 256x256, tower 128x192, castle 384x384). ` +
        (isHosted()
          ? "The sprite is returned as an image and kept with your session as buildings/<type>.png (or <type>__<variant>.png); maps of this session use it in previews and downloads. "
          : "Saves <assets>/buildings/<type>.png, or <type>__<variant>.png when variant is set. ") +
        "Takes 20-40 s and costs money per call; dryRun returns the prompt for free. An existing sprite is kept unless force is true.",
      inputSchema: {
        buildingType: z.enum(BUILDING_TYPES).describe("Building type, as in place_building"),
        variant: z
          .string()
          .regex(/^[a-z0-9_]+$/)
          .optional()
          .describe("Variant slug, e.g. 'snowy': saved as <type>__<variant>.png and used with place_building spriteVariant"),
        material: z.string().optional().describe("Override of the building description"),
        lighting: z.string().optional().describe("Override of the lighting description"),
        extraDetail: z.string().optional().describe("Free text appended to the prompt"),
        seed: z.number().int().optional().describe("Seed for reproducibility"),
        force: z.boolean().optional().describe("Regenerate even if the sprite already exists (paid again)"),
        dryRun: z.boolean().optional().describe("Return the prompt and target size without generating anything (free)"),
      },
      annotations: PAID,
    },
    async ({ buildingType, variant, material, lighting, extraDetail, seed, force, dryRun }) => {
      const def = BUILDINGS[buildingType];
      const rendered = buildBuildingPrompt(material ?? def.material, { lighting, extraDetail });
      const relPath = buildingSpriteFile(buildingType, variant);
      const size = `${def.imageWidth}x${def.imageHeight}`;
      if (dryRun) return asText({ ok: true, dryRun: true, buildingType, file: relPath, size, prompt: rendered.prompt });
      if (!hfToken()) return asText(missingToken());
      const hosted = isHosted();
      const outPath = hosted ? relPath : join(assetsRoot(), relPath);
      if (spriteExists(relPath) && !force) {
        return asText({
          ok: false,
          skipped: true,
          outputPath: outPath,
          error: "The sprite already exists; nothing was generated or billed. Pass force: true to regenerate it.",
        });
      }
      const start = Date.now();
      try {
        const sharp = await loadSharp();
        const { keyed, provider } = await fluxKeyed(sharp, rendered.prompt, rendered.dimensions, seed);
        const buf = await fitBuilding(sharp, await isolateSubject(sharp, keyed), def.imageWidth, def.imageHeight);
        const saved = await saveSprite(relPath, buf, outPath);
        const result = asText({
          ok: true,
          buildingType,
          variant: variant ?? null,
          provider,
          outputPath: saved,
          finalSize: size,
          relativePath: `${ASSET_PREFIX}${relPath}`,
          bytes: buf.length,
          durationMs: Date.now() - start,
          promptUsed: rendered.prompt,
        });
        return hosted
          ? { content: [...result.content, { type: "image" as const, data: buf.toString("base64"), mimeType: "image/png" }] }
          : result;
      } catch (err) {
        return asText({ ok: false, error: err instanceof Error ? err.message : String(err), promptAttempted: rendered.prompt });
      }
    },
  );

  server.registerTool(
    "generate_theme_sprite_set",
    {
      title: "Generate a theme's missing sprites (paid)",
      description:
        "PAID and slow: generates every sprite of a theme that is missing on disk (about 30 s and one paid call per sprite, typically 8-10 sprites, so 4-5 minutes). Existing sprites are skipped unless force is true. Many MCP clients time out on calls this long; for a whole theme prefer the command line script: node scripts/gen-theme-set.mjs <THEME> --yes.",
      inputSchema: {
        theme: THEME,
        force: z.boolean().optional().describe("Regenerate sprites that already exist (paid again)"),
        seed: z.number().int().optional(),
      },
      annotations: PAID,
    },
    async ({ theme, force, seed }) => {
      if (!hfToken()) return asText(missingToken());
      const key = theme as ThemeKey;
      const hosted = isHosted();
      const dir = hosted ? themeAssetDir(key) : join(assetsRoot(), themeAssetDir(key));

      const results: Array<{ role: string; ok: boolean; path?: string; error?: string; durationMs?: number; skipped?: boolean }> = [];
      for (const role of THEME_ROLES) {
        const relPath = `${themeAssetDir(key)}/${role}.png`;
        let rendered;
        try {
          rendered = buildPrompt(key, role);
        } catch {
          continue; // no prompt for this role in this theme
        }
        if (spriteExists(relPath) && !force) {
          results.push({ role, ok: true, path: hosted ? relPath : join(assetsRoot(), relPath), skipped: true });
          continue;
        }
        const start = Date.now();
        try {
          const path = await saveSprite(relPath, await renderSprite(rendered, seed));
          results.push({ role, ok: true, path, durationMs: Date.now() - start });
        } catch (err) {
          results.push({ role, ok: false, error: err instanceof Error ? err.message : String(err), durationMs: Date.now() - start });
        }
      }
      return asText({ theme, dir, results });
    },
  );
}
