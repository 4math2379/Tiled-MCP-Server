// Optional, paid sprite generation with FLUX.1-dev through Hugging Face Inference Providers.
// Everything else in this server is free and offline. sharp and @huggingface/inference are
// loaded lazily so the map tools keep working even if those packages fail to install.
// In hosted mode the call is billed to the caller's own token and the sprite stays in their
// session (src/sprites.ts) instead of the server's disk.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { buildPrompt, NEGATIVE_PROMPT, type ThemeKey } from "../themes/prompts.js";
import { THEME_KEYS, themeAssetDir } from "../themes/index.js";
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

function hfProvider(): string {
  return process.env.TILED_HF_PROVIDER || "replicate";
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

/** Generate one sprite PNG and return the processed bytes. */
async function renderSprite(prompt: ReturnType<typeof buildPrompt>, seed?: number) {
  const sharp = await loadSharp();
  const { InferenceClient } = await import("@huggingface/inference");
  const client = new InferenceClient(hfToken()!);
  const blob = (await client.textToImage({
    model: "black-forest-labs/FLUX.1-dev",
    provider: hfProvider() as never,
    inputs: prompt.prompt,
    parameters: {
      width: prompt.dimensions.width,
      height: prompt.dimensions.height,
      negative_prompt: NEGATIVE_PROMPT,
      guidance_scale: 4.5,
      ...(seed !== undefined ? { seed } : {}),
    },
  })) as unknown as Blob;
  const raw = Buffer.from(await blob.arrayBuffer());
  return resizeForTile(sharp, await chromaKeyMagenta(sharp, raw), prompt.geometry);
}

const THEME = z.enum(THEME_KEYS).describe("Theme key from list_themes");
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
