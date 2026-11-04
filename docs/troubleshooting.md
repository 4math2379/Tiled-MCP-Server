# Troubleshooting

Start with the automated check. It starts the server and exercises it end to end, offline:

```bash
npm run build && npm run smoke
```

If it prints `39 passed, 0 failed`, the server works and the problem is in the client setup.

## The tools do not appear in my client

- Run `npm run build`: the client starts `tiled-mcp/dist/index.js`, which only exists after a build.
- Use an **absolute** path in the client configuration.
- Check the Node version with `node --version`; it must be 20.9 or newer. If your client starts
  a different Node than your terminal, put the full path to `node` in `command`.
- Restart the client after editing its configuration.
- Try `npm run inspect`: if the MCP Inspector lists the tools, the server is fine.

## `Unknown mapId`

Maps live in server memory. They disappear when the client restarts the server, and every
client session has its own server process. Call `list_maps`, or create the map again. Save with
`save_to_disk` before closing the session.

## Tiled shows red placeholder tiles

- The theme has no sprites yet: `list_themes` shows `sprites.status: "none"`. Use a theme with
  bundled sprites, or [generate them](sprite-generation.md).
- The file was produced by `export_json` and saved by hand somewhere else. Its image paths are
  relative to the repository root (`./assets/...`). Use `save_to_disk`, which writes paths
  relative to the file, or move the file to the repository root.
- You moved a saved `.tmj` to another folder. Save it again from the server, or fix the paths in
  Tiled (Map, Tileset properties).

## Objects or spawns are on the wrong tiles in my engine

Since 0.2.0, objects use Tiled's native isometric encoding. If your importer was written for the
older screen-space encoding, either update it with the formulas in
[map-format.md](map-format.md#object-coordinates) or set `TILED_OBJECT_COORDS=screen`.

## "Map too small for generate_crypt_layout"

Presets need room for their rooms not to overlap: crypt 27x18, castle 27x20, werewolf den 22x16.
Create a larger map, or build the layout with `generate_room` and `generate_corridor`.

## A placement is rejected

The error says why: a wall on that cell, no ground (outside the rooms), an obstacle prop, or
another object or spawn already there. Use `get_tile_info` on the `walls` and `ground` layers
and pick a free floor cell. Doors are the exception: they go in wall openings.

## Sprite generation fails

- `HUGGINGFACE_API_KEY (or HF_TOKEN) is not set`: add the token to `tiled-mcp/.env` or to the
  client's `env` block. See [sprite-generation.md](sprite-generation.md).
- `The sprite already exists`: nothing was billed. Pass `force: true` to regenerate.
- Provider or billing errors come from Hugging Face. Check that the provider (`TILED_HF_PROVIDER`,
  default `replicate`) is enabled for your account.
- `'sharp' could not be loaded`: run `npm install` again. Map editing works without it; only
  sprite generation and previews need it.
- The client times out on `generate_theme_sprite_set`: use `node scripts/gen-theme-set.mjs <THEME> --yes`.

## Running the server on WSL from a Windows client

See [client-setup.md](client-setup.md#windows-with-the-server-inside-wsl). Windows paths passed to
tools, such as `D:/maps/crypt.tmj`, are translated to `/mnt/d/...` automatically.
