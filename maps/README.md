# Sample maps

Open any of these in [Tiled](https://www.mapeditor.org) (File, Open) or render a PNG preview:

```bash
npm run preview -- maps/forteresse-glace-etage.tmj
```

| File | Theme | Size | How it was made |
|---|---|---|---|
| `exemple-crypte-nemotron.tmj` | `CRYPT` | 20x14 | Built by a Nemotron agent through the MCP tools with an early version of the server. The crypt preset ran on a map smaller than it needs, so some rooms overlap and two doors share a cell; current versions refuse that size (the crypt preset needs 27x18). Kept as a real agent-made example. |
| `caverne-aquatique.tmj` | `AQUATIC` | 64x64 | `scripts/create-aquatic-map.mjs` |
| `forteresse-glace-etage.tmj` | `GLACIAIRE` | 64x64 | `scripts/create-glacier-map.mjs` |
| `reseau-electronique-repaire-hacker.tmj` | `ELECTRONIQUE` | 64x64 | `scripts/create-electronic-hacker-map.mjs` |

The three scripted maps are deterministic: `npm run examples` rebuilds them identically.

This folder is also the default output of `save_to_disk` for relative paths (change it with
`TILED_MAPS_DIR`). Sprite paths in these files point to `../assets/`, so keep the maps inside the
repository or save them again with `save_to_disk`.
