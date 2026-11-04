# Scripts

Run them from the repository root after `npm install && npm run build`.

| Script | npm shortcut | Cost | What it does |
|---|---|---|---|
| `smoke-test.mjs` | `npm run smoke` | free, offline | Starts the server and runs 39 end-to-end checks over stdio. Pass `screen` to test the legacy coordinate mode. |
| `render-map-preview.mjs` | `npm run preview -- <map.tmj>` | free | Renders a `.tmj` to PNG with object markers. Options: `[out.png] [--width 1600] [--no-markers]`. |
| `gen-docs.mjs` | `npm run docs` | free | Regenerates `docs/tools.md` and `docs/themes.md` from the server. |
| `create-aquatic-map.mjs` | `npm run examples` | free | Rebuilds `maps/caverne-aquatique.tmj` with the builder API. |
| `create-glacier-map.mjs` | `npm run examples` | free | Rebuilds `maps/forteresse-glace-etage.tmj`. |
| `create-electronic-hacker-map.mjs` | `npm run examples` | free | Rebuilds `maps/reseau-electronique-repaire-hacker.tmj`. |
| `gen-theme-set.mjs` | | **paid** | Generates a theme's missing sprites with FLUX.1-dev. Needs `--yes`; try `--dry-run` first. See [docs/sprite-generation.md](../docs/sprite-generation.md). |

The three `create-*` scripts show how to build maps from code without an MCP client: they import
`tiled-mcp/dist/builder.js` and `tiled-mcp/dist/tmj.js` directly.
