# Sample maps

Open any of these in [Tiled](https://www.mapeditor.org) (File, Open) or render a PNG preview:

```bash
npm run preview -- maps/ice-fortress.tmj
```

| File | Theme | Size | How it was made |
|---|---|---|---|
| `nemotron-crypt-example.tmj` | `CRYPT` | 20x14 | Built by a Nemotron agent through the MCP tools with an early version of the server. The crypt preset ran on a map smaller than it needs, so some rooms overlap and two doors share a cell; current versions refuse that size (the crypt preset needs 27x18). A prop behind the north door also seals the north room, which `validate_map`'s walking check now reports. Kept as a real agent-made example; its names were translated to English. |
| `water-cavern.tmj` | `AQUATIC` | 64x64 | `scripts/create-aquatic-map.mjs` |
| `ice-fortress.tmj` | `GLACIER` | 64x64 | `scripts/create-glacier-map.mjs` |
| `hacker-lair.tmj` | `ELECTRONIC` | 64x64 | `scripts/create-electronic-hacker-map.mjs` |
| `crossroads-village/` | `VILLAGE` and interiors | 40x40 + 7 maps | `scripts/create-village-world.mjs` |

`crossroads-village/` is a sample **world**: an outdoor map with six buildings you can enter
(house, shop, tavern, chapel, watchtower, castle), the interior map of each, and a cellar under
the castle reached by stairs. Open `crossroads-village/crossroads-village.tmj`; in Tiled, select
an entrance on the `objects` layer and right-click its `targetMap` property to open the interior.
How the links work, and a Godot loader: [docs/worlds-and-buildings.md](../docs/worlds-and-buildings.md).

The scripted maps and the world are deterministic: `npm run examples` rebuilds them identically,
and every room of them can be walked to from the player spawn.

This folder is also the default output of `save_to_disk` for relative paths (change it with
`TILED_MAPS_DIR`). Sprite paths in these files point to `../assets/`, so keep the maps inside the
repository or save them again with `save_to_disk`.
