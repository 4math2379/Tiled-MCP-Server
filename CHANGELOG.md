# Changelog

## 0.2.0

Usable by anyone from a fresh clone, with English documentation.

### Breaking

- **Object and spawn coordinates now follow Tiled's isometric convention**
  (`x = col * tileheight`, `y = row * tileheight`). Objects are one-tile rectangles and spawns are
  point objects at the tile centre, so everything opens on the right tiles in Tiled. The previous
  encoding added a half-map origin offset that neither Tiled nor existing importers decoded
  correctly. Importers that expect the older screen-space encoding can set
  `TILED_OBJECT_COORDS=screen`. See [docs/map-format.md](docs/map-format.md#object-coordinates).
- Node.js 20.9 or newer is required (sharp 0.35).
- The server identifies itself as `tiled-map-builder`, and the package is `tiled-map-builder-mcp`.
- Layout presets enforce the sizes they need to avoid overlapping rooms: crypt 27x18, castle
  27x20, werewolf den 22x16.
- Tool titles, descriptions and errors are in English.
- Three theme keys and their sprite folders were renamed to generic names: `CASTLE`
  (`assets/castle`), `VILLAGE` (`assets/village`) and `HAUNTED_FOREST`
  (`assets/haunted_forest`).
- The map properties holding the theme key and display name are now `theme` and `mapName`.

### Fixed

- The `map_builder` prompt loads `skills/map-builder/SKILL.md`, which is now in the repository.
- Sprite tools accept all 20 themes instead of 8.
- Default folders and the `.env` file are resolved inside the repository instead of the
  author's machine.
- Example scripts import the server and write maps with repository-relative paths.
- `save_to_disk` writes sprite paths relative to the saved file, so maps open in Tiled with
  their images; the sample maps were updated accordingly.
- The castle preset opens the wall under its locked main door.
- `paint_rect` and `paint_wall_border` reject rectangles outside the grid instead of painting
  part of them.
- `generate_room` rejects an exit offset beyond the wall.
- Declared dependency ranges match the APIs used (MCP SDK 1.23+, zod 4, sharp 0.35); a fresh
  install reports no known vulnerabilities.

### Added

- Placement checks: spawns, chests, traps, levers and zone stairs cannot go on a wall, outside
  the ground, on an obstacle prop or on an occupied cell. `get_tile_info` reports occupants.
- `validate_map` warns about objects on walls or outside the ground and doors left inside a wall.
- `list_themes` reports which sprites are present.
- `generate_tile_sprite` no longer overwrites an existing sprite unless `force: true`.
- MCP tool annotations (read-only, destructive, idempotent, network).
- Configuration: `TILED_MAPS_DIR`, `TILED_OBJECT_COORDS`, `TILED_HF_PROVIDER`, automatic
  `tiled-mcp/.env` loading.
- Scripts: `npm run smoke` (end-to-end checks), `npm run preview` (PNG renderer),
  `npm run docs` (generated tool and theme references), `gen-theme-set.mjs` with
  `--dry-run` and a required `--yes`.
- Documentation: client setup for seven clients and the MCP Inspector, tool reference, map format, themes,
  configuration, sprite generation, Nemotron, troubleshooting, contributing. MIT `LICENSE` file.
- The map-builder skill rewritten in English for any user, keeping the original workflow and
  design heuristics.

### Removed

- Superseded script drafts: the first aquatic script and glacier drafts 1 to 3 were removed, and
  the versions that produced the sample maps (aquatic v2, glacier v4) became
  `create-aquatic-map.mjs` and `create-glacier-map.mjs`.
- `gen-assets.mjs`, covered by `gen-theme-set.mjs`.
- The `upload_to_dungeon` tool and its environment variables. It only served one private web
  app; save maps with `save_to_disk` instead.

## 0.1.0

Initial public version.
