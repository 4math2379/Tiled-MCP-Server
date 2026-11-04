# Map format

The server writes standard [Tiled JSON maps](https://doc.mapeditor.org/en/stable/reference/json-map-format/)
(`.tmj`, format 1.10). This page describes what is inside, so you can read the maps from a game
engine or write an importer.

## Overview

| Field | Value |
|---|---|
| `orientation` | `isometric` (default) or `orthogonal` |
| `renderorder` | `right-down` |
| `width`, `height` | 1 to 64 cells each (tools accept 4 to 64) |
| `tilewidth`, `tileheight` | 64 x 32 pixels for every bundled theme |
| `infinite` | `false` |
| map properties | `theme` (theme key), `mapName` (display name) |

## Coordinates

Tools take **grid cells**: `x` is the column from 0 to width-1, `y` the row from 0 to height-1.
Cell `(x, y)` is stored at index `y * width + x` in every tile layer.

On an isometric map, cell (0,0) is the top corner of the diamond. `x` grows toward the lower
right and `y` toward the lower left:

```
              (0,0)
          (0,1)   (1,0)
      (0,2)   (1,1)   (2,0)
          (1,2)   (2,1)
              (2,2)
```

## Layers

Every map has the same five layers, in this order:

| id | Name | Type | Contents |
|---|---|---|---|
| 1 | `ground` | tile layer | floors, hazards, difficult terrain |
| 2 | `walls` | tile layer | walls; a cell with a wall is impassable even though it also has a floor |
| 3 | `decorations` | tile layer | props drawn above the ground; `OBSTACLE` props block movement |
| 4 | `objects` | object group | doors, chests, traps, levers, zone stairs |
| 5 | `spawns` | object group | player, enemy and NPC spawn points |

## Tilesets and tile properties

Each map embeds one **collection-of-images** tileset (`columns: 0`, one image per tile) built
from its theme. Every tile carries:

| Property | Type | Values |
|---|---|---|
| `tileType` | string | `WALKABLE`, `WALL`, `DIFFICULT_TERRAIN`, `HAZARD`, `DOOR`, `OBSTACLE`, `STAIRS` |
| `spriteId` | string | stable id such as `crypt.sarcophagus` |
| `hazardType` | string | damage type, `HAZARD` tiles only (e.g. `poison`) |
| `hazardNotation` | string | damage dice, `HAZARD` tiles only (e.g. `2d6`) |

Tools paint tiles by **role**; the theme maps each role to one tile:

| Role | Usual tile type | Image size |
|---|---|---|
| `walkable_floor`, `walkable_floor_alt` | `WALKABLE` | 64x32 |
| `wall`, `wall_corner` | `WALL` | 64x64 |
| `difficult_terrain` | `DIFFICULT_TERRAIN` | 64x32 |
| `hazard_primary` | `HAZARD` | 64x32 or 64x64 |
| `obstacle_decor` | `OBSTACLE` | 64x64 |
| `decoration_minor` | `WALKABLE` | 64x32 |
| `door_closed` | `DOOR` | 64x64 |
| `stairs` | `STAIRS` | 64x64 |

Not every theme defines every role; `list_themes` lists them. See [themes.md](themes.md).

### Image paths

Tiled resolves each tile `image` relative to the `.tmj` file.

- `save_to_disk` rewrites the paths relative to the file it writes, so a map saved anywhere
  finds the sprites in `assets/` (for example `../assets/crypt/wall.png` from `maps/`).
- `export_json` keeps the canonical form `./assets/<theme>/<role>.png`,
  relative to the repository root.

## Objects

Objects live in the `objects` group. `type` repeats the kind.

| Property | Type | Present on | Meaning |
|---|---|---|---|
| `kind` | string | all | `door`, `chest`, `trap`, `lever`, `stairs` |
| `state` | string | all | `closed`, `open`, `locked` (`stairs` objects are `open`) |
| `pickDC` | int | locked doors and chests | lock difficulty, 5 to 30 |
| `targetZoneId` | string | doors, stairs | id of the zone it leads to |
| `trapType` | string | traps | damage type |
| `trapNotation` | string | traps | damage dice, e.g. `2d6` |
| `trapSaveDC` | int | traps | saving throw difficulty, 5 to 30 |

## Spawns

Spawns live in the `spawns` group. `type` repeats the role.

| Property | Type | Meaning |
|---|---|---|
| `role` | string | `player`, `enemy` or `npc` |
| `npcName` | string | display name (optional) |
| `encounterId` | string | id of an encounter in your engine (optional, enemies) |

## Object coordinates

Tiled stores object positions in pixels, but on **isometric** maps those pixels are not screen
pixels. Tiled uses an unprojected space where both axes are measured in **tile height** units
([source](https://github.com/mapeditor/tiled/blob/master/src/libtiled/isometricrenderer.cpp),
`tileToPixelCoords`).

With the default `TILED_OBJECT_COORDS=tiled`, the server writes:

| | Isometric | Orthogonal |
|---|---|---|
| object (door, chest, ...) | rectangle `x = col*th`, `y = row*th`, `width = height = th` | rectangle `x = col*tw`, `y = row*th`, `width = tw`, `height = th` |
| spawn | point (`"point": true`) at `x = (col+0.5)*th`, `y = (row+0.5)*th` | point at `x = (col+0.5)*tw`, `y = (row+0.5)*th` |

`tw` and `th` are `tilewidth` and `tileheight`. To read a cell back:

```js
// isometric
const col = Math.floor(obj.x / map.tileheight);
const row = Math.floor(obj.y / map.tileheight);
// orthogonal
const col = Math.floor(obj.x / map.tilewidth);
const row = Math.floor(obj.y / map.tileheight);
```

Objects then open on the right tiles in Tiled, and moving them there keeps the formulas valid.

### Legacy encoding (`TILED_OBJECT_COORDS=screen`)

Versions before 0.2.0 wrote isometric objects in **screen space** without an origin offset:
`x = tw/2 * (col - row)`, `y = th/2 * (col + row)`, objects `tw x th`, spawns without size.
Importers written for that encoding decode with:

```js
const col = Math.floor((x / (tw / 2) + y / (th / 2)) / 2);
const row = Math.floor((y / (th / 2) - x / (tw / 2)) / 2);
```

Set `TILED_OBJECT_COORDS=screen` if your importer still expects it. Tiled does not display
legacy positions on the right tiles, so prefer migrating the importer to the formulas above.

## Validation

`validate_map` returns:

- **errors**: structural problems (missing fields, invalid size or orientation).
- **warnings**: no player spawn, an object or spawn on a wall or outside the painted ground,
  a door still inside a wall.

Your engine should still validate the map on import.
