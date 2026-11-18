# Scripts

Run them from the repository root after `npm install && npm run build`.

| Script | npm shortcut | Cost | What it does |
|---|---|---|---|
| `smoke-test.mjs` | `npm run smoke` | free, offline | Starts the server and runs 96 end-to-end checks over stdio, including the walking checks and a loop over every theme. Pass `screen` to test the legacy coordinate mode. |
| `test-loop.mjs` | `npm test`, `npm run test:loop` | free, offline | Runs every suite above (both coordinate modes and the hosted mode) once, or 5 times in a row with `test:loop` (`node scripts/test-loop.mjs 20` for 20); stops at the first failure. |
| `smoke-http.mjs` | `npm run smoke:http` | free, offline | Starts the hosted mode with a scripted stand-in for the AI model: web routes, MCP sessions over HTTP, downloads, isolation, and that every paid call uses the caller's token. |
| `render-map-preview.mjs` | `npm run preview -- <map.tmj>` | free | Renders a `.tmj` to PNG with object markers. Options: `[out.png] [--width 1600] [--no-markers]`. |
| `gen-docs.mjs` | `npm run docs` | free | Regenerates `docs/tools.md` and `docs/themes.md` from the server. |
| `create-aquatic-map.mjs` | `npm run examples` | free | Rebuilds `maps/water-cavern.tmj` with the builder API. |
| `create-glacier-map.mjs` | `npm run examples` | free | Rebuilds `maps/ice-fortress.tmj`. |
| `create-electronic-hacker-map.mjs` | `npm run examples` | free | Rebuilds `maps/hacker-lair.tmj`. |
| `create-village-world.mjs` | `npm run examples` | free | Rebuilds the sample world `maps/crossroads-village/`: an outdoor map, six buildings and their linked interiors. |
| `gen-theme-set.mjs` | | **paid** | Generates a theme's missing sprites with FLUX.1-dev. Needs `--yes`; try `--dry-run` first. See [docs/sprite-generation.md](../docs/sprite-generation.md). |
| `gen-building-sprites.mjs` | | **paid** (`--clean` free) | Generates missing building sprites with FLUX.1-dev (`--yes`, try `--dry-run` first); `--clean` removes leftover background from existing ones. |

The `create-*` scripts show how to build maps from code without an MCP client: they import
`tiled-mcp/dist/builder.js` and `tiled-mcp/dist/tmj.js` directly, and the world script
`tiled-mcp/dist/world.js` too.
