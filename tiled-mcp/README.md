# tiled-map-builder-mcp

The MCP server package of [Tiled Map Builder MCP](../README.md): a stdio Model Context Protocol
server that composes isometric [Tiled](https://www.mapeditor.org) maps in memory and saves them
as `.tmj` files. The same package has a hosted mode (`dist/http.js`): a web page with an AI
agent and the MCP tools over HTTP, as run on Hugging Face ([docs/hugging-face.md](../docs/hugging-face.md)).

It runs from inside the repository, because it reads sprites from `../assets`, the skill from
`../skills` and writes maps to `../maps` by default. It is not published to npm.

## Build and run

From the repository root:

```bash
npm install
npm run build         # tsc: src/ -> dist/
npm run smoke         # 38 offline end-to-end checks (stdio)
npm run smoke:http    # offline checks of the hosted mode
npm run start:web     # hosted mode on http://127.0.0.1:7860
```

The client command is `node <repo>/tiled-mcp/dist/index.js`. See
[docs/client-setup.md](../docs/client-setup.md).

## Source layout

| File | Role |
|---|---|
| `src/index.ts` | Entry point (stdio): loads `.env`, connects one server to stdin/stdout |
| `src/server.ts` | Builds a server instance with every tool and the prompt |
| `src/http.ts` | Entry point (hosted): web page, `/api/generate`, MCP over HTTP at `/mcp`, Hugging Face sign-in, downloads |
| `src/agent.ts` | Web agent: an Inference Providers model drives the tools in-process with the visitor's token |
| `src/context.ts` | Per-session workspace (maps, sprites) and per-request token in hosted mode |
| `src/downloads.ts` | Tiled-ready `.zip` and `.tmj` download links (hosted mode) |
| `src/render.ts` | PNG preview renderer, shared with `scripts/render-map-preview.mjs` |
| `src/sprites.ts` | Reads and stores sprites: assets folder locally, session memory when hosted |
| `src/sharp.ts` | Lazy loader for the sharp image library |
| `src/builder.ts` | In-memory map model: layers, painting, objects, spawns, occupancy, serialization, object coordinates |
| `src/tmj.ts` | Writes `.tmj` files with sprite paths relative to the file |
| `src/paths.ts` | Repository paths, configurable folders, WSL path translation |
| `src/env.ts` | Minimal `.env` loader |
| `src/prompts.ts` | `map_builder` prompt that serves `skills/map-builder/SKILL.md` |
| `src/types.ts` | Tiled JSON types, tile roles, theme types |
| `src/tools/lifecycle.ts` | `list_themes`, `create_map`, `list_maps`, `describe_map`, `discard_map` |
| `src/tools/paint.ts` | `paint_tile`, `paint_rect`, `paint_wall_border`, `erase_tile`, `get_tile_info` |
| `src/tools/procedural.ts` | `generate_room`, `generate_corridor` |
| `src/tools/layout-presets.ts` | `generate_crypt_layout`, `generate_castle_floor`, `generate_werewolf_den` |
| `src/tools/objects.ts` | `place_door`, `place_chest`, `place_stairs_object`, `place_trap`, `place_lever`, `place_spawn_*` |
| `src/tools/export.ts` | `validate_map`, `export_json`, `save_to_disk` |
| `src/tools/generation.ts` | Sprite tools: `preview_sprite_prompt`, `generate_tile_sprite`, `generate_theme_sprite_set`, `override_tile_image` |
| `src/themes/*.ts` | One file per theme, registry in `index.ts`, FLUX prompt catalog in `prompts.ts` |
| `web/` | The hosted web page: `index.html`, `app.js`, `style.css` |

Tool reference: [docs/tools.md](../docs/tools.md). Map format: [docs/map-format.md](../docs/map-format.md).
