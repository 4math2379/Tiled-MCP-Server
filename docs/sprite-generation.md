# Sprite generation (optional, paid)

> [!WARNING]
> Generating sprites calls **FLUX.1-dev through Hugging Face Inference Providers and costs
> money for every sprite**. Map building, validation, export and previews are free and
> offline. Nothing in this project enforces a spending cap: set a budget on your provider
> account. You are responsible for the costs you incur.

## When you need it

12 of the 20 themes ship with sprites in `assets/`. The other 8 (`VOLCANO`, `DARK_FOREST`, `WINTER`,
`SPRING`, `SUMMER`, `AUTUMN`, `DESOLATION`, `FUTURISTIC`) produce valid maps, but Tiled shows
placeholders until their PNGs exist. `list_themes` reports the status of every theme.

You also need generation for **contextual variants**, such as an alembic instead of the default
throne for a castle laboratory.

## Setup

1. Create a Hugging Face account and an access token with permission to call Inference
   Providers: https://huggingface.co/settings/tokens
2. Make sure billing is set up. By default the server asks Hugging Face which providers serve
   `black-forest-labs/FLUX.1-dev` right now and uses the first live one (fal-ai in November
   2026; Replicate no longer serves it). The model page lists them under "Inference Providers".
3. Put the token in `tiled-mcp/.env` or your MCP client's `env` block:

   ```
   HUGGINGFACE_API_KEY=hf_xxx
   # optional: force one provider that serves black-forest-labs/FLUX.1-dev
   TILED_HF_PROVIDER=fal-ai
   ```

## Generate a whole theme (recommended)

A full theme is about 8 to 10 sprites and takes several minutes, longer than many MCP clients
wait for a single tool call. Use the script:

```bash
npm run build
node scripts/gen-theme-set.mjs VOLCANO --dry-run     # free: lists the sprites it would generate
node scripts/gen-theme-set.mjs VOLCANO --yes         # paid
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

## Building sprites

`place_building` draws houses, shops, taverns, temples, towers and castles with one large image
each, `assets/buildings/<type>.png`, sized to the building's footprint (192x192 up to 384x384).
They are generated the same way, one paid call per building:

```bash
node scripts/gen-building-sprites.mjs --dry-run   # free: prompts and sizes
node scripts/gen-building-sprites.mjs --yes       # every missing building sprite
node scripts/gen-building-sprites.mjs --clean     # free: re-cut the background of existing sprites
```

Providers do not always paint the clean magenta background the prompt asks for (fal-ai often
returns pale pink or grey noise). Generation therefore isolates the building from whatever is
left around it and refills windows the key erased. `--clean` runs the same cleanup on sprites
already on disk, for example older ones or images you drew yourself.

From an agent, `generate_building_sprite(buildingType, variant?, material?, extraDetail?)`
does one; `dryRun: true` returns the prompt for free. The image is trimmed and fitted standing
on its bottom edge, which is where the map anchors it. See
[worlds-and-buildings.md](worlds-and-buildings.md).

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
