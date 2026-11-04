# Sprite generation (optional, paid)

> [!WARNING]
> Generating sprites calls **FLUX.1-dev through Hugging Face Inference Providers and costs
> money for every sprite**. Map building, validation, export and previews are free and
> offline. Nothing in this project enforces a spending cap: set a budget on your provider
> account. You are responsible for the costs you incur.

## When you need it

12 of the 20 themes ship with sprites in `assets/`. The other 8 (`VOLCAN`, `FORET`, `HIVER`,
`PRINTEMPS`, `ETE`, `AUTOMNE`, `DESOLATION`, `FUTURISTE`) produce valid maps, but Tiled shows
placeholders until their PNGs exist. `list_themes` reports the status of every theme.

You also need generation for **contextual variants**, such as an alembic instead of the default
throne for a castle laboratory.

## Setup

1. Create a Hugging Face account and an access token with permission to call Inference
   Providers: https://huggingface.co/settings/tokens
2. Make sure the provider you use (default `replicate`) is enabled for your account and that
   billing is set up.
3. Put the token in `tiled-mcp/.env` or your MCP client's `env` block:

   ```
   HUGGINGFACE_API_KEY=hf_xxx
   # optional: another provider that serves black-forest-labs/FLUX.1-dev
   TILED_HF_PROVIDER=replicate
   ```

## Generate a whole theme (recommended)

A full theme is about 8 to 10 sprites and takes several minutes, longer than many MCP clients
wait for a single tool call. Use the script:

```bash
npm run build
node scripts/gen-theme-set.mjs VOLCAN --dry-run     # free: lists the sprites it would generate
node scripts/gen-theme-set.mjs VOLCAN --yes         # paid
node scripts/gen-theme-set.mjs --missing --dry-run  # every theme that lacks sprites
```

Existing files are skipped. `--force` regenerates them and is billed again.

## Generate one sprite from an agent

1. `preview_sprite_prompt(theme, role, material?, lighting?, extraDetail?)` returns the exact
   prompt. It is free, so iterate on the wording there first.
2. `generate_tile_sprite(theme, role, ...)` generates and saves `assets/<theme>/<role>.png`.
   If the file already exists, nothing is generated or billed unless `force: true`.

### Contextual variants

```text
generate_tile_sprite(theme="CASTLE", role="obstacle_decor", variant="alembic",
                     material="alchemical workbench with brass alembics and dusty tomes")
  -> assets/castle/obstacle_decor__alembic.png

override_tile_image(mapId, role="obstacle_decor", variant="alembic")
  -> only this map uses the variant
```

## What the pipeline does

1. Builds a prompt from the theme's material and lighting for that role
   (`tiled-mcp/src/themes/prompts.ts`), in a flat 2D painterly gothic style on a pure magenta
   background, with a strong negative prompt against candles, torches and fire.
2. Requests a 1024x1024 image from FLUX.1-dev.
3. Removes the magenta background with a chroma key that also catches desaturated magenta at
   the edges.
4. Crops and resizes: floors and small decorations to **64x32**, walls, doors, stairs and
   obstacles to **64x64**.

## Cost control checklist

- Reuse the bundled sprites whenever they fit.
- Always run `--dry-run` or `preview_sprite_prompt` first.
- Keep variants to one or two per map.
- Watch your provider dashboard; this project cannot see or cap your spending.
