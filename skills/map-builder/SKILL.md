---
name: map-builder
description: Design and build an isometric Tiled map (.tmj) for a tabletop or game dungeon zone with the tiled-map-builder MCP server. Use when the user types /map-builder, asks to compose, draw or generate a dungeon, crypt, castle, cave, tavern, village or other battle map, or wants an ASCII sketch turned into a Tiled map. Picks a theme, sketches the layout for confirmation, builds rooms, corridors, objects and spawns, validates, and saves the file.
---

# Map Builder

Turn a free-form description of a dungeon zone into a tactically coherent, atmospheric
isometric Tiled map, using the **tiled-map-builder** MCP server for every edit. This skill
decides *which* layout, theme, traps and spawns to use and *where*; the server does the editing,
validation and file output.

Reply in the user's language. Map, room and creature names follow the user's language too.

## Requirements

- The `tiled-map-builder` MCP server is connected (see the repository's `docs/client-setup.md`).
  In Claude Code its tools appear as `mcp__tiled-map-builder__<tool>`; the prefix follows the
  server name chosen in the client configuration.
- If the tools are missing: run `npm install && npm run build` at the repository root, then
  restart the MCP client.
- Clients without Agent Skills support can load this same workflow through the server's
  `map_builder` prompt.

## When to use

- The user types `/map-builder <description>` or `/map-builder` alone.
- The user asks to build, compose or draw a map for a zone, encounter or scene.
- The user provides an ASCII mock-up and wants it as a `.tmj` file.

Do not use it to edit a map that only exists as a file on disk: the server keeps maps in memory
and cannot load `.tmj` files. Suggest the Tiled editor for that.

## Accepted input

Free form:

```
/map-builder crypt 28x18 under an abandoned chapel, two skeletons patrol the nave, a ghoul lord sleeps in the deep crypt
```

Structured (recommended for complex maps):

```
/map-builder
  theme: CRYPT
  size: 28x18
  layout: crypt
  encounters:
    - npc: skeleton | position: nave | count: 2
    - npc: ghoul lord | position: deep
  hazards: poison vents x2
  output: crypt-chapel.tmj
```

## Procedure

### Step 1: understand the request

- **Theme**: infer it from the vocabulary (table below). When unsure, call `list_themes` and
  propose two options.
- **Size**: default 20x15 for a custom layout, minimum 12x10, maximum 64x64. Presets need at
  least: crypt 27x18, castle 27x20, werewolf den 22x16.
- **Mood**: combat means an open map, infiltration means narrow corridors, a narrative scene
  means a small map with NPCs.
- **Encounters**: every creature named becomes an enemy spawn (`npcName`, and `encounterId`
  when the user gives one).
- **Boss**: "finale" or "boss" means a large room at the far end with a single way in.
- **Output**: a `.tmj` file name.

| Vocabulary | Theme |
|---|---|
| crypt, chapel, ossuary | `CRYPT` |
| castle, throne room, keep | `CASTLE` |
| cave, den, lair, beasts | `WEREWOLF_DEN` |
| inn, tavern, interior | `TAVERN_BLOOD_PRINCE` |
| village, square, market, street | `VILLAGE` |
| haunted forest, undergrowth, clearing | `HAUNTED_FOREST` or `FORET` |
| mausoleum, tomb, statues | `MAUSOLEUM` |
| blood ritual, altar, sanctuary | `BLOOD_TOMB` |
| swamp, stagnant water, sunken ruins | `AQUATIC` |
| flooded city, drowned district | `INONDE` |
| ice, frozen fortress, tundra | `GLACIAIRE` or `HIVER` |
| volcano, lava, ash | `VOLCAN` |
| seasons: spring, summer, autumn | `PRINTEMPS`, `ETE`, `AUTOMNE` |
| wasteland, ruins after a cataclysm | `DESOLATION` |
| futuristic city, laboratory, neon | `FUTURISTE` |
| digital network, servers, hacker | `ELECTRONIQUE` |

### Step 2: reference material (optional)

If the user provides lore, an adventure module or a reference map, use it for atmosphere,
room purposes and creature choice. Paraphrase it. Never reproduce a published map layout or
text verbatim; the layout presets are original arrangements and can be reshaped freely.

### Step 3: sketch the layout and confirm

Always draw an ASCII sketch before calling any editing tool, and ask the user to confirm or
adjust it.

```
   0 1 2 3 4 5 6 7 8 9 ...
0  # # # # # # # # # # # # # # # # # # # # # # # #
1  # . . . . # # . . . . . # # . . . . . . . . #
2  # . P . . D . . . . . . . . . . . H . . . . #
3  # . . . . # # . . . . . D . . . . . . . . . #
4  # # # # # # # . . . . . # # . . . . . . . . #
                 ^ corridor        ^ deep crypt
```

Legend: `#` wall, `.` floor, `P` player spawn, `D` door, `H` hazard, `E` enemy, `B` boss,
`C` chest, `T` trap, `N` friendly NPC. `x` is the column, `y` the row, (0,0) top left.

### Step 4: check sprites (free) and variants (paid, optional)

1. `list_themes` reports `sprites.status` per theme: `all`, `partial` or `none`. Missing
   sprites never break a map; Tiled shows placeholders until the PNGs exist.
2. If sprites are missing and the user wants them, explain that generation is **paid**
   (one Hugging Face call per sprite, 20-40 s each), preview the prompt with
   `preview_sprite_prompt`, and only call `generate_tile_sprite` after the user agrees.
   For a whole theme, recommend the script `node scripts/gen-theme-set.mjs <THEME> --yes`.
3. Never regenerate an existing sprite unless the user asks (`force: true`).

Contextual variants give one map a special prop, for example a laboratory in a castle where the
default `obstacle_decor` is a throne:

1. Pick a short slug matching `[a-z0-9_]+`: `alembic`, `bookshelf`, `cauldron`, `iron_cage`, `altar`, `anvil`.
2. If `<role>__<variant>.png` does not exist yet and the user accepts the cost:
   `generate_tile_sprite(theme="CASTLE", role="obstacle_decor", variant="alembic", material="alchemical workbench with brass alembics and dusty tomes")`.
3. After `create_map`, bind it: `override_tile_image(mapId, role="obstacle_decor", variant="alembic")`.

| The description mentions | Variant ideas |
|---|---|
| laboratory, alchemy | `obstacle_decor=alembic`, `decoration_minor=scattered_tomes` |
| library, archives | `obstacle_decor=bookshelf` |
| kitchen, banquet | `obstacle_decor=banquet_table` |
| cell, dungeon, oubliette | `obstacle_decor=iron_cage`, `door_closed=barred_grate` |
| chapel, altar | `obstacle_decor=altar`, `decoration_minor=prayer_book` |
| workshop, forge | `obstacle_decor=anvil`, `decoration_minor=hammer_tongs` |

Use at most 2 variants per map, and none when the description has no strong context.

### Step 5: build the map

```text
1. list_themes                         sanity check, sprite availability
2. create_map(name, width, height, theme)            -> mapId
3. Layout, either:
   - a preset: generate_crypt_layout / generate_castle_floor / generate_werewolf_den
   - or custom: generate_room x N (exits open doorways with doors) + generate_corridor x M,
     then paint_rect / paint_tile for floors, hazards and props
4. Objects: place_door, place_chest, place_trap, place_lever, place_stairs_object
5. Spawns: place_spawn_player (at least one, at the entrance), place_spawn_enemy, place_spawn_npc
6. validate_map: fix every warning
7. save_to_disk("<slug>.tmj")
```

Placement rules the server enforces (a failing call explains why):

- Chests, traps, levers, zone stairs and spawns need a painted ground cell with no wall, no
  obstacle prop and no other object or spawn. Walls sit on their own layer above the ground,
  so check with `get_tile_info(layer="walls")` when unsure.
- Doors go in wall openings. `generate_room` exits do this for you; for a custom doorway, call
  `erase_tile(layer="walls")` first.
- Corridors are straight; chain two corridors for an L shape.

### Step 6: report

```markdown
# Map "<name>" ready

- **mapId**: <uuid>
- **Theme**: <theme>   **Size**: <W>x<H>   **Layout**: <preset or custom>
- **Spawns**: <n> player, <m> enemy, <k> NPC
- **Objects**: <n> doors, <m> chests, <k> traps, <l> stairs
- **Validation**: ok (warnings: <list or none>)
- **Output**: maps/<slug>.tmj

## Finishing suggestions
- <e.g. a trapped chest in the north chamber>
```

## Design heuristics

### Atmosphere by theme

- **CRYPT**: 1-2 poison vents (`hazard_primary`) in side chambers; sarcophagi as obstacles.
- **CASTLE**: great hall in the middle, throne room at the far end, locked
  antechamber door (pick DC 18). No hazards in the hall: the threat comes from its inhabitants.
- **BLOOD_TOMB**: bleeding runes (`hazard_primary`) in a ring around a central altar: a visible
  but costly obstacle.
- **WEREWOLF_DEN**: an alpha lair with boulders in the corners and bone piles
  (`difficult_terrain`), several scattered enemy spawns, no locked doors (caves).
- **HAUNTED_FOREST / FORET**: no full perimeter walls (open forest); use `obstacle_decor`
  (boulders, standing stones) to create chokepoints; parasitic mist (HAUNTED_FOREST) or
  quicksand (FORET) as hazards in damp areas.
- **MAUSOLEUM**: fallen-angel statues as obstacles, several small alcoves, no hazards
  (the theme has none: the mood is contemplative).
- **AQUATIC / INONDE**: deep water or currents as `hazard_primary`, stepping paths of floor tiles.
- **GLACIAIRE / HIVER**: cracked ice or slush (`difficult_terrain`) slows movement, thin ice is
  the hazard; open frozen halls.
- **VOLCAN**: lava flows as hazards with narrow bridges of floor tiles.
- **TAVERN_BLOOD_PRINCE / VILLAGE**: social scenes; tables or the well as obstacles,
  friendly NPC spawns, few or no traps.

### Tactics

- **Chokepoint**: a 1-cell corridor before the boss room isolates the fight.
- **Open arena**: at least 8x8 with pillars (`obstacle_decor` in a checkerboard), good against
  flying enemies.
- **Gothic sightline**: a corridor of 5+ cells with a hazard at the end builds tension.
- **Fair spawns**: never place an enemy spawn within 4 cells of a player spawn.
- **Restraint**: 1-2 well placed hazards beat 10 scattered ones.

### Rules values

- `trapNotation` and hazard damage use dice notation: `2d6`, `1d8+2`.
- `trapSaveDC` and `pickDC` range 5-30: 12-15 for levels 3-5, 16-18 for levels 6-10.

## Do not

- Skip the ASCII sketch confirmation.
- Skip `validate_map` before saving.
- Leave the map without a player spawn.
- Invent a theme: use only the keys returned by `list_themes`.
- Exceed 64x64, or run a preset below its minimum size.
- Generate paid sprites without the user's explicit agreement.
- Copy published map layouts or text verbatim.
- Use emojis in map, room or object names.
