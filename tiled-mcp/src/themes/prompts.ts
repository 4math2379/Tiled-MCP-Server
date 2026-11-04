// FLUX.1-dev prompt templates for isometric tile sprites.
//
// Target tone: gothic horror, not demonic. Decay, melancholy, faded grandeur.
// No pentagrams, blood pools, infernal or hellish imagery.
// Validated style "v2-flat-no-depth": flat 2D painterly, no 3D depth shading.

import type { ThemeRole } from "../types.js";

export type ThemeKey =
  | "CRYPT"
  | "CASTLE"
  | "WEREWOLF_DEN"
  | "TAVERN_BLOOD_PRINCE"
  | "VILLAGE"
  | "HAUNTED_FOREST"
  | "MAUSOLEUM"
  | "BLOOD_TOMB"
    | "AQUATIC"
    | "GLACIAIRE"
    | "INONDE"
    | "VOLCAN"
    | "FORET"
    | "HIVER"
    | "PRINTEMPS"
    | "ETE"
    | "AUTOMNE"
    | "DESOLATION"
    | "FUTURISTE"
    | "ELECTRONIQUE";

interface RoleVisual {
  /** Material / subject description for the tile. */
  material: string;
  /** Lighting cue specific to this tile and theme. */
  lighting: string;
  /** Either "surface" (64x32 flat floor) or "cube" (64x64 vertical block). */
  geometry: "surface" | "cube";
}

// Critical: NEVER put these words in the positive prompt, not even negated, because they
// prime the model: candle, candles, torch, torches, flame, fire, bonfire, lantern, amber,
// warm orange, glow source. Lighting stays colour-neutral (intensity and direction only).
// They are excluded explicitly through NEGATIVE_PROMPT instead.
const POSITIVE_FRAMING =
  `clean empty composition, only the main subject in frame, ` +
  `completely empty apart from the main subject, plain solid background, ` +
  `no decorative props, no ornaments around the subject`;

// Pure magenta #FF00FF background: a colour never present in a gothic sprite, so a magenta
// chroma key removes the background cleanly without touching the subject (which may have
// deep blacks, shadows, iron, etc.).
const SURFACE_TEMPLATE = (material: string, lighting: string) =>
  `flat 2D illustration of a single isometric floor tile at 30 degree angle, ` +
  `painterly oil paint style, ${material}, ` +
  `${lighting}, hand-drawn smooth lines, gothic horror dark fantasy palette, ` +
  `no 3D depth shading, no perspective distortion beyond isometric projection, ` +
  `decayed elegance, faded grandeur, brooding melancholy, ` +
  `single isolated tile centered on pure bright magenta solid background, ` +
  `chroma key background #FF00FF, ` +
  `${POSITIVE_FRAMING}, game asset for 2D tactical RPG`;

const CUBE_TEMPLATE = (material: string, lighting: string) =>
  `isometric view of a single cube block at 30 degree angle, ` +
  `hand-painted digital illustration, painterly oil paint style, ` +
  `${material}, ${lighting}, gothic horror dark fantasy palette, ` +
  `decayed elegance, faded grandeur, brooding melancholy, ` +
  `smooth lines no 3D ray-traced effects, no depth-of-field, ` +
  `single isolated object centered on pure bright magenta solid background, ` +
  `chroma key background #FF00FF, ` +
  `${POSITIVE_FRAMING}, game asset for 2D tactical RPG`;

/**
 * Negative prompt sent alongside the positive prompt: an aggressive list of everything
 * that must NOT appear. FLUX.1-dev accepts negative_prompt through Inference Providers.
 */
export const NEGATIVE_PROMPT =
  `candle, candles, candlelight, candelabra, candleholder, ` +
  `torch, torches, torchlight, sconce, brazier, ` +
  `flame, flames, fire, ember, smoke, ` +
  `lantern, lamp, oil lamp, light bulb, lightsource, ` +
  `multiple tiles, multiple objects, several items, tile grid, tile sheet, ` +
  `scenery, landscape, room scene, dungeon scene, interior view, ` +
  `characters, people, person, figure, hand, face, eye, ` +
  `text, letters, numbers, watermark, signature, logo, UI element, ` +
  `border, frame, vignette, gradient background, ` +
  `bright glow, halo, lens flare, light beam, light rays, ` +
  `props, decorations around, foreground object, extra item, ` +
  `furniture in background, ornaments, knick-knacks, ` +
  `realistic photo, photograph, 3D render, voxel, blender render, ` +
  `cartoon, anime, manga, chibi, pixelated low-res`;

// Lighting policy : color-neutral descriptors only. Surface material carries
// the warmth/coolness via its color. Never use "warm/amber/orange/umber/sepia"
// in lightings — these are flame triggers for FLUX.
export const ROLE_VISUALS: Partial<Record<ThemeKey, Partial<Record<ThemeRole, RoleVisual>>>> = {
  CASTLE: {
    walkable_floor: {
      material: "polished black marble floor with subtle crimson veining, centuries of footwear",
      lighting: "soft top-down ambient illumination, low key",
      geometry: "surface",
    },
    walkable_floor_alt: {
      material:
        "threadbare crimson velvet carpet with faded golden embroidery on flagstone, tattered edges",
      lighting: "soft top-down ambient illumination, low key",
      geometry: "surface",
    },
    wall: {
      material:
        "weathered obsidian basalt brick wall with mortar lines, gothic cathedral stonework, time-worn",
      lighting: "soft directional ambient lighting from the upper left, low key",
      geometry: "cube",
    },
    wall_corner: {
      material:
        "weathered obsidian basalt corner block, gothic cathedral cornerstone, carved relief",
      lighting: "soft directional ambient lighting from the upper left, low key",
      geometry: "cube",
    },
    difficult_terrain: {
      material:
        "scattered stone debris and broken gothic statue fragments on flagstone, dust and rubble",
      lighting: "muted desaturated ambient lighting",
      geometry: "surface",
    },
    obstacle_decor: {
      material:
        "ornate gothic carved stone block with weathered relief carvings of wolves and bats, single solitary object",
      lighting: "soft top-down ambient illumination, soft shadow underneath",
      geometry: "cube",
    },
    decoration_minor: {
      material:
        "tattered crimson heraldic banner with faded wolf sigil, draped on flagstone, dust",
      lighting: "very low key ambient illumination",
      geometry: "surface",
    },
    door_closed: {
      material:
        "iron-bound oak gothic door, closed, studded with black iron rivets and a heavy ring handle",
      lighting: "soft directional ambient illumination on the wood grain",
      geometry: "cube",
    },
    stairs: {
      material:
        "weathered stone gothic stairs descending, marble steps worn smooth at the center",
      lighting: "soft ambient illumination, slight gradient from below",
      geometry: "cube",
    },
  },
  CRYPT: {
    walkable_floor: {
      material:
        "cracked flagstone floor with green moss in the seams, weathered gravestone surface",
      lighting: "muted cool ambient lighting, slight greenish tint",
      geometry: "surface",
    },
    walkable_floor_alt: {
      material:
        "moss-covered ancient flagstone with subtle bone fragments, gray dust",
      lighting: "very low key neutral ambient illumination",
      geometry: "surface",
    },
    wall: {
      material:
        "mossy stone wall with niche carvings for funerary urns, weeping water stains",
      lighting: "directional cool ambient lighting from above, no source visible",
      geometry: "cube",
    },
    wall_corner: {
      material: "mossy stone corner block with carved family crest, time-worn",
      lighting: "directional cool ambient lighting from above, no source visible",
      geometry: "cube",
    },
    difficult_terrain: {
      material: "pile of bones and skull fragments on flagstone, scattered, dusty",
      lighting: "muted gray ambient lighting",
      geometry: "surface",
    },
    hazard_primary: {
      material:
        "cracked flagstone with sickly green poison vapor seeping upward from the cracks, faint wisps",
      lighting: "eerie green underglow from the cracks themselves",
      geometry: "surface",
    },
    obstacle_decor: {
      material:
        "stone sarcophagus lid carved with effigy of a sleeping noble, weathered, single object",
      lighting: "soft directional ambient lighting from above, soft shadow under the lid",
      geometry: "cube",
    },
    decoration_minor: {
      material: "dust and scattered bone shards on flagstone, very subtle",
      lighting: "low key cool ambient tint",
      geometry: "surface",
    },
    door_closed: {
      material:
        "rusted iron crypt door, closed, oxidized, gothic ironwork patterns",
      lighting: "soft directional ambient illumination on the metal",
      geometry: "cube",
    },
    stairs: {
      material:
        "worn stone stairs descending into deeper crypt, narrow, slippery moss",
      lighting: "dark cool ambient gloom rising from below",
      geometry: "cube",
    },
  },
  WEREWOLF_DEN: {
    walkable_floor: {
      material: "packed earth and dirt floor with claw marks, scratched by beast tracks",
      lighting: "low key ambient lighting",
      geometry: "surface",
    },
    walkable_floor_alt: {
      material: "packed earth darkened by old dried bloodstains, matted fur scraps",
      lighting: "dim ambient lighting",
      geometry: "surface",
    },
    wall: {
      material:
        "rough natural cave wall of dark rock, deeply gouged by claws, damp",
      lighting: "soft directional ambient from above",
      geometry: "cube",
    },
    difficult_terrain: {
      material: "scattered pile of gnawed bones and animal skulls on dirt floor",
      lighting: "muted ambient lighting",
      geometry: "surface",
    },
    hazard_primary: {
      material:
        "dark congealed blood pool on dirt floor, viscous and stagnant, faint red glow",
      lighting: "subtle dark red ambient glow from the pool itself",
      geometry: "surface",
    },
    obstacle_decor: {
      material: "rough boulder of dark rock with claw-deep gouges, single object",
      lighting: "soft directional ambient, soft shadow below",
      geometry: "cube",
    },
    decoration_minor: {
      material: "matted clump of dark fur and shed claws on dirt floor",
      lighting: "low key ambient illumination",
      geometry: "surface",
    },
    door_closed: {
      material:
        "heavy hide and bone curtain draped across an opening, primitive doorway",
      lighting: "dim ambient illumination",
      geometry: "cube",
    },
  },
  MAUSOLEUM: {
    walkable_floor: {
      material:
        "polished gray-veined white marble floor, cool and somber, faintly chipped",
      lighting: "pale cool blue ambient lighting from above",
      geometry: "surface",
    },
    walkable_floor_alt: {
      material:
        "cracked white marble slab with hairline fractures and slight dust drift",
      lighting: "pale cool ambient, very low key",
      geometry: "surface",
    },
    wall: {
      material:
        "smooth gray granite wall with carved niche showing an empty urn alcove",
      lighting: "pale cool directional ambient from above, no source visible",
      geometry: "cube",
    },
    difficult_terrain: {
      material: "scattered shards of broken funerary urns and white marble dust",
      lighting: "muted pale ambient",
      geometry: "surface",
    },
    obstacle_decor: {
      material:
        "weathered marble statue of a fallen angel with broken wings, kneeling, single isolated object",
      lighting: "pale cool ambient from above, soft shadow under the statue",
      geometry: "cube",
    },
    decoration_minor: {
      material: "small bronze plaque set in marble floor with weathered inscriptions",
      lighting: "low key cool ambient",
      geometry: "surface",
    },
    door_closed: {
      material:
        "tarnished bronze double door with gothic relief of mourning figures, sealed",
      lighting: "pale ambient lighting on the metal, no source visible",
      geometry: "cube",
    },
    stairs: {
      material: "wide marble stairs descending, worn smooth at the center, somber",
      lighting: "pale cool ambient gloom from below",
      geometry: "cube",
    },
  },
  BLOOD_TOMB: {
    walkable_floor: {
      material:
        "dark ritual stone slab with faint crimson runes etched along the seams, weathered",
      lighting: "very low key dark red ambient",
      geometry: "surface",
    },
    walkable_floor_alt: {
      material:
        "ritual stone slab darkened by old dried bloodstains in concentric ring patterns",
      lighting: "subtle dark red ambient",
      geometry: "surface",
    },
    wall: {
      material:
        "black volcanic stone wall carved with bleeding crimson runes that drip downward",
      lighting: "ominous dark red ambient glow from the runes themselves",
      geometry: "cube",
    },
    difficult_terrain: {
      material:
        "thick layer of dried dark blood and ritual ash spread across the stone floor",
      lighting: "muted dark red ambient",
      geometry: "surface",
    },
    hazard_primary: {
      material:
        "single bleeding ritual rune carved into stone slab, glowing crimson, viscous",
      lighting: "intense crimson glow emanating from the rune itself",
      geometry: "surface",
    },
    obstacle_decor: {
      material:
        "weathered black stone ritual altar carved with bleeding sigils, single isolated object",
      lighting: "subtle crimson ambient glow, ominous shadow below",
      geometry: "cube",
    },
    decoration_minor: {
      material:
        "shallow groove etched into stone slab in spiral pattern, dark blood residue",
      lighting: "very low key dark red ambient",
      geometry: "surface",
    },
    door_closed: {
      material:
        "massive black stone door sealed with crimson wax seal and gothic carvings",
      lighting: "subtle dark red ambient on the stone, no source visible",
      geometry: "cube",
    },
  },
  VILLAGE: {
    walkable_floor: {
      material:
        "wet cobblestone street glistening with rain, dark stones with mossy gaps",
      lighting: "cool overcast daylight, muted blue-gray",
      geometry: "surface",
    },
    walkable_floor_alt: {
      material:
        "muddy ground with shallow puddles and trampled grass at the edges",
      lighting: "overcast muted daylight",
      geometry: "surface",
    },
    wall: {
      material:
        "timber-framed plaster wall of a gothic eastern european village house, weathered wood beams and cracked plaster",
      lighting: "cool overcast daylight, ambient from above",
      geometry: "cube",
    },
    difficult_terrain: {
      material:
        "deep mud puddle in cobblestone street, reflective with rain ripples",
      lighting: "overcast cool reflection",
      geometry: "surface",
    },
    obstacle_decor: {
      material:
        "old stone village well with iron crank, weathered and moss-covered, single isolated object",
      lighting: "overcast daylight from above, soft shadow",
      geometry: "cube",
    },
    decoration_minor: {
      material:
        "abandoned wooden market stall planks on cobblestone, draped with damp canvas",
      lighting: "cool overcast ambient",
      geometry: "surface",
    },
    door_closed: {
      material:
        "weathered wooden cottage door with iron hinges, closed, planks dark from rain",
      lighting: "overcast cool daylight on the wood",
      geometry: "cube",
    },
  },
  HAUNTED_FOREST: {
    walkable_floor: {
      material:
        "dark forest floor covered in black moss and tangled roots, damp and uneven",
      lighting: "deep green-tinted ambient, very low key",
      geometry: "surface",
    },
    walkable_floor_alt: {
      material:
        "carpet of dead russet leaves and twigs on dark forest soil",
      lighting: "muted ambient lighting",
      geometry: "surface",
    },
    wall: {
      material:
        "tall dead tree trunk with peeling bark and dead branches, blocking passage, gnarled",
      lighting: "dark green-tinted ambient from above",
      geometry: "cube",
    },
    difficult_terrain: {
      material:
        "dense bramble thicket of dark thorny vines on forest floor",
      lighting: "muted green ambient",
      geometry: "surface",
    },
    hazard_primary: {
      material:
        "patch of swirling parasitic mist on the forest floor, pale gray-green wisps",
      lighting: "sickly pale green underglow from the mist",
      geometry: "surface",
    },
    obstacle_decor: {
      material:
        "large moss-covered boulder in dark forest, single isolated object",
      lighting: "dark green ambient from above, soft shadow below",
      geometry: "cube",
    },
    decoration_minor: {
      material:
        "cluster of small pale mushrooms growing on moss-covered forest floor",
      lighting: "dim green ambient",
      geometry: "surface",
    },
  },
  TAVERN_BLOOD_PRINCE: {
    walkable_floor: {
      material:
        "dark oak plank floor with knots and grain lines, slightly worn at the center",
      lighting: "soft top-down ambient illumination",
      geometry: "surface",
    },
    walkable_floor_alt: {
      material:
        "darker oak plank floor with ale stains and scuffs near the tables",
      lighting: "low key ambient illumination",
      geometry: "surface",
    },
    wall: {
      material:
        "cream plaster wall with cracked patches and exposed dark wooden beams, gothic country inn",
      lighting: "soft directional ambient illumination",
      geometry: "cube",
    },
    difficult_terrain: {
      material:
        "spilled puddle of dark ale on plank floor, with broken wooden mug shards",
      lighting: "soft ambient reflection on the puddle",
      geometry: "surface",
    },
    obstacle_decor: {
      material:
        "sturdy round wooden table with dark stained surface and turned legs, single isolated object",
      lighting: "soft top-down ambient illumination, soft shadow below",
      geometry: "cube",
    },
    decoration_minor: {
      material:
        "single wooden chair tipped over on plank floor, dark stained finish",
      lighting: "low key ambient illumination",
      geometry: "surface",
    },
    door_closed: {
      material:
        "thick oak tavern door with iron strapping and a small barred window slot",
      lighting: "soft directional ambient on the wood",
      geometry: "cube",
    },
    stairs: {
      material:
        "narrow wooden tavern stairs ascending, dark oak with worn treads",
      lighting: "soft ambient illumination, slight gradient from below",
      geometry: "cube",
    },
  },
  AQUATIC: {
    walkable_floor: {
      material: "still black water with lily pads and submerged ruins, oily surface",
      lighting: "dim diffuse moonlight filtering through mist, low key",
      geometry: "surface",
    },
    walkable_floor_alt: {
      material: "murky stagnant water with floating algae and submerged debris",
      lighting: "very low key neutral ambient illumination",
      geometry: "surface",
    },
    wall: {
      material: "weeping stone wall with water seepage and dark mildew stains",
      lighting: "directional cool ambient lighting from above, no source visible",
      geometry: "cube",
    },
    wall_corner: {
      material: "damp stone corner block with algae growth, time-worn",
      lighting: "directional cool ambient lighting from above, no source visible",
      geometry: "cube",
    },
    difficult_terrain: {
      material: "slick algae-covered flagstone with puddles and slippery moss",
      lighting: "muted gray ambient lighting",
      geometry: "surface",
    },
    hazard_primary: {
      material: "deep black water with unseen undertow and faint ripples on surface",
      lighting: "eerie blue-green underglow from below the water",
      geometry: "surface",
    },
    obstacle_decor: {
      material: "half-submerged stone sarcophagus lid with carved effigy, weathered",
      lighting: "soft directional ambient lighting from above, soft shadow under water",
      geometry: "cube",
    },
    decoration_minor: {
      material: "single floating white water lily on black water surface",
      lighting: "low key cool ambient tint",
      geometry: "surface",
    },
    door_closed: {
      material: "iron-bound oak door with barnacles and dark water stains, closed",
      lighting: "soft directional ambient illumination on the wet wood",
      geometry: "cube",
    },
    stairs: {
      material: "stone steps descending into dark water, narrow, slippery with slime",
      lighting: "dark cool ambient gloom rising from below",
      geometry: "cube",
    },
  },
  GLACIAIRE: {
    walkable_floor: {
      material: "black ice with trapped air bubbles and frozen debris inside",
      lighting: "dim diffuse pale blue light, low key",
      geometry: "surface",
    },
    walkable_floor_alt: {
      material: "frost-rimed flagstone with ice patches and hoarfrost",
      lighting: "very low key neutral ambient illumination",
      geometry: "surface",
    },
    wall: {
      material: "glacial ice wall with frozen figures trapped inside, pale blue",
      lighting: "directional cool ambient lighting from above, no source visible",
      geometry: "cube",
    },
    wall_corner: {
      material: "sharp ice corner block with frost rime and crack lines",
      lighting: "directional cool ambient lighting from above, no source visible",
      geometry: "cube",
    },
    difficult_terrain: {
      material: "cracked ice sheets and frost heaves on stone, jagged",
      lighting: "muted pale blue ambient lighting",
      geometry: "surface",
    },
    hazard_primary: {
      material: "thin ice over freezing water with visible cracks and bubbles beneath",
      lighting: "eerie pale blue underglow from cracks in the ice",
      geometry: "surface",
    },
    obstacle_decor: {
      material: "frozen stone statue encased in clear ice, single solitary object",
      lighting: "soft directional ambient lighting from above, soft shadow under ice",
      geometry: "cube",
    },
    decoration_minor: {
      material: "icicles hanging from stone ledge, glistening, very subtle",
      lighting: "low key cool ambient tint",
      geometry: "surface",
    },
    door_closed: {
      material: "iron-bound oak door rimed with thick frost and ice crystals",
      lighting: "soft directional ambient illumination on the frosted wood",
      geometry: "cube",
    },
    stairs: {
      material: "ice-slick stone stairs descending into blue gloom, narrow",
      lighting: "dark cool ambient gloom rising from below",
      geometry: "cube",
    },
  },
  INONDE: {
    walkable_floor: {
      material: "stagnant black water with floating debris and oil sheen",
      lighting: "dim diffuse gray-green light, low key",
      geometry: "surface",
    },
    walkable_floor_alt: {
      material: "muddy tidal flats with cracked silt and shallow puddles",
      lighting: "muted neutral ambient illumination",
      geometry: "surface",
    },
    wall: {
      material: "waterlogged stone wall with barnacles and seaweed stains",
      lighting: "directional cool ambient lighting from above, no source visible",
      geometry: "cube",
    },
    wall_corner: {
      material: "submerged stone corner block with algae and mineral deposits",
      lighting: "directional cool ambient lighting from above, no source visible",
      geometry: "cube",
    },
    difficult_terrain: {
      material: "tangled kelp and seaweed on silt-covered floor",
      lighting: "muted blue-green ambient lighting",
      geometry: "surface",
    },
    hazard_primary: {
      material: "deep underwater current with visible undertow and swirling silt",
      lighting: "eerie blue-green underglow from below the water",
      geometry: "surface",
    },
    obstacle_decor: {
      material: "sunken stone statue half-buried in silt, weathered",
      lighting: "soft directional ambient lighting from above, soft shadow under water",
      geometry: "cube",
    },
    decoration_minor: {
      material: "floating driftwood fragment on black water surface",
      lighting: "low key cool ambient tint",
      geometry: "surface",
    },
    door_closed: {
      material: "bloated wood door swollen by water, rusted iron bands",
      lighting: "soft directional ambient illumination on the wet wood",
      geometry: "cube",
    },
    stairs: {
      material: "slippery stone steps descending into dark water, algae-covered",
      lighting: "dark cool ambient gloom rising from below",
      geometry: "cube",
    },
  },
  VOLCAN: {
    walkable_floor: {
      material: "cooled black lava with rough, jagged surface",
      lighting: "dim red ambient glow from below",
      geometry: "surface",
    },
    walkable_floor_alt: {
      material: "gray ash ground with scattered cinders",
      lighting: "muted warm neutral ambient illumination",
      geometry: "surface",
    },
    wall: {
      material: "dark basalt wall with volcanic pores and heat cracks",
      lighting: "directional warm ambient lighting from above, no source visible",
      geometry: "cube",
    },
    wall_corner: {
      material: "magma-heated stone corner with glowing fissures",
      lighting: "directional warm ambient lighting from above, no source visible",
      geometry: "cube",
    },
    difficult_terrain: {
      material: "cracked obsidian shards and volcanic glass",
      lighting: "muted orange-red ambient lighting",
      geometry: "surface",
    },
    hazard_primary: {
      material: "flowing lava with bright molten core and black crust",
      lighting: "intense red-orange underglow from molten rock",
      geometry: "surface",
    },
    obstacle_decor: {
      material: "obsidian menhir with volcanic etchings, single solitary block",
      lighting: "soft directional ambient lighting from above, soft shadow",
      geometry: "cube",
    },
    decoration_minor: {
      material: "glowing ember ash floating in hot air",
      lighting: "low key warm ambient tint",
      geometry: "surface",
    },
    door_closed: {
      material: "iron-bound door with volcanic rivets and heat stains",
      lighting: "soft directional ambient illumination on hot metal",
      geometry: "cube",
    },
    stairs: {
      material: "ash-covered stone stairs descending into volcanic darkness",
      lighting: "dark warm ambient gloom rising from below",
      geometry: "cube",
    },
  },
  FORET: {
    walkable_floor: {
      material: "thick moss-covered forest floor with exposed roots",
      lighting: "dappled green ambient light filtering through canopy",
      geometry: "surface",
    },
    walkable_floor_alt: {
      material: "pine needles and decaying leaves on soft earth",
      lighting: "muted forest green ambient illumination",
      geometry: "surface",
    },
    wall: {
      material: "ancient gnarled tree trunk with bark and sap",
      lighting: "directional cool ambient lighting from above, no source visible",
      geometry: "cube",
    },
    wall_corner: {
      material: "twisted forest root corner with moss and soil",
      lighting: "directional cool ambient lighting from above, no source visible",
      geometry: "cube",
    },
    difficult_terrain: {
      material: "dense thicket of brambles and thorny vines",
      lighting: "muted green-gray ambient lighting",
      geometry: "surface",
    },
    hazard_primary: {
      material: "quicksand pool with sucking mud and floating debris",
      lighting: "eerie green-gray underglow from below the mire",
      geometry: "surface",
    },
    obstacle_decor: {
      material: "standing stone circle monolith covered in lichen",
      lighting: "soft directional ambient lighting from above, soft shadow under stone",
      geometry: "cube",
    },
    decoration_minor: {
      material: "single fallen autumn leaf on moss",
      lighting: "low key cool ambient tint",
      geometry: "surface",
    },
    door_closed: {
      material: "heavy wooden gate with iron bands and moss growth",
      lighting: "soft directional ambient illumination on weathered wood",
      geometry: "cube",
    },
    stairs: {
      material: "root-entwined stone steps descending into woodland gloom",
      lighting: "dark cool ambient gloom rising from below",
      geometry: "cube",
    },
  },
  HIVER: {
    walkable_floor: {
      material: "fresh powder snow with subtle wind ripples",
      lighting: "bright cool white ambient light, low key",
      geometry: "surface",
    },
    walkable_floor_alt: {
      material: "packed ice with frost patterns and trapped air",
      lighting: "very low key neutral ambient illumination",
      geometry: "surface",
    },
    wall: {
      material: "snow drift wall with compacted ice layers",
      lighting: "directional cool ambient lighting from above, no source visible",
      geometry: "cube",
    },
    wall_corner: {
      material: "frozen ice corner with rime and crack lines",
      lighting: "directional cool ambient lighting from above, no source visible",
      geometry: "cube",
    },
    difficult_terrain: {
      material: "slush and half-melted snow with hidden ice",
      lighting: "muted pale blue ambient lighting",
      geometry: "surface",
    },
    hazard_primary: {
      material: "thin ice over frozen lake with visible cracks beneath",
      lighting: "eerie pale blue underglow from cracks in ice",
      geometry: "surface",
    },
    obstacle_decor: {
      material: "frozen stone cairn encased in clear ice, solitary",
      lighting: "soft directional ambient lighting from above, soft shadow under ice",
      geometry: "cube",
    },
    decoration_minor: {
      material: "single snowflake crystal on ice surface",
      lighting: "low key cool ambient tint",
      geometry: "surface",
    },
    door_closed: {
      material: "frosted log door with thick ice crystals and snow",
      lighting: "soft directional ambient illumination on frosted wood",
      geometry: "cube",
    },
    stairs: {
      material: "ice-slick stone stairs descending into winter darkness",
      lighting: "dark cool ambient gloom rising from below",
      geometry: "cube",
    },
  },
  PRINTEMPS: {
    walkable_floor: {
      material: "green meadow grass with small wildflowers",
      lighting: "soft pale green ambient light, bright",
      geometry: "surface",
    },
    walkable_floor_alt: {
      material: "clover field with dew-covered leaves",
      lighting: "muted fresh green ambient illumination",
      geometry: "surface",
    },
    wall: {
      material: "living hedge wall with intertwined branches and blossoms",
      lighting: "directional soft ambient lighting from above, no source visible",
      geometry: "cube",
    },
    wall_corner: {
      material: "flowered arch corner with vines and spring blooms",
      lighting: "directional soft ambient lighting from above, no source visible",
      geometry: "cube",
    },
    difficult_terrain: {
      material: "muddy spring puddle with reeds and wet earth",
      lighting: "muted green-gray ambient lighting",
      geometry: "surface",
    },
    hazard_primary: {
      material: "swollen spring stream with fast current and foam",
      lighting: "eerie pale green underglow from moving water",
      geometry: "surface",
    },
    obstacle_decor: {
      material: "maypole with ribbons and flower garlands, solitary",
      lighting: "soft directional ambient lighting from above, soft shadow",
      geometry: "cube",
    },
    decoration_minor: {
      material: "single wildflower on green grass",
      lighting: "low key fresh ambient tint",
      geometry: "surface",
    },
    door_closed: {
      material: "woven wicker door with spring flowers and vines",
      lighting: "soft directional ambient illumination on woven wood",
      geometry: "cube",
    },
    stairs: {
      material: "moss-covered stone steps descending into spring glade",
      lighting: "dark soft ambient gloom rising from below",
      geometry: "cube",
    },
  },
  ETE: {
    walkable_floor: {
      material: "golden wheat field with ripe stalks",
      lighting: "warm pale yellow ambient light, bright",
      geometry: "surface",
    },
    walkable_floor_alt: {
      material: "dry summer grass with scattered straw",
      lighting: "muted warm neutral ambient illumination",
      geometry: "surface",
    },
    wall: {
      material: "sunbaked clay wall with cracks and dust",
      lighting: "directional warm ambient lighting from above, no source visible",
      geometry: "cube",
    },
    wall_corner: {
      material: "terracotta corner block with heat-cured surface",
      lighting: "directional warm ambient lighting from above, no source visible",
      geometry: "cube",
    },
    difficult_terrain: {
      material: "cracked dry earth with dust and pebbles",
      lighting: "muted orange-brown ambient lighting",
      geometry: "surface",
    },
    hazard_primary: {
      material: "heat haze pool with shimmering air distortion",
      lighting: "eerie warm underglow from heated ground",
      geometry: "surface",
    },
    obstacle_decor: {
      material: "weathered scarecrow with straw and tattered cloth",
      lighting: "soft directional ambient lighting from above, soft shadow",
      geometry: "cube",
    },
    decoration_minor: {
      material: "single dried herb on golden wheat",
      lighting: "low key warm ambient tint",
      geometry: "surface",
    },
    door_closed: {
      material: "weathered plank door with sun-bleached wood",
      lighting: "soft directional ambient illumination on dry wood",
      geometry: "cube",
    },
    stairs: {
      material: "dusty stone steps descending into summer heat",
      lighting: "dark warm ambient gloom rising from below",
      geometry: "cube",
    },
  },
  AUTOMNE: {
    walkable_floor: {
      material: "thick carpet of fallen autumn leaves in rust and gold",
      lighting: "soft warm amber ambient light, low key",
      geometry: "surface",
    },
    walkable_floor_alt: {
      material: "damp earth with fallen leaves and pine cones",
      lighting: "muted brown-green ambient illumination",
      geometry: "surface",
    },
    wall: {
      material: "rustic oak wall with bark and autumn vines",
      lighting: "directional warm ambient lighting from above, no source visible",
      geometry: "cube",
    },
    wall_corner: {
      material: "twisted branch corner with autumn leaves and moss",
      lighting: "directional warm ambient lighting from above, no source visible",
      geometry: "cube",
    },
    difficult_terrain: {
      material: "slippery leaf carpet with hidden roots and mud",
      lighting: "muted orange-brown ambient lighting",
      geometry: "surface",
    },
    hazard_primary: {
      material: "bog mire with sucking mud and floating autumn leaves",
      lighting: "eerie brown-green underglow from below the mire",
      geometry: "surface",
    },
    obstacle_decor: {
      material: "withered scarecrow with tattered autumn cloth",
      lighting: "soft directional ambient lighting from above, soft shadow",
      geometry: "cube",
    },
    decoration_minor: {
      material: "single acorn on leaf carpet",
      lighting: "low key warm ambient tint",
      geometry: "surface",
    },
    door_closed: {
      material: "ivy-covered wooden door with autumn leaves",
      lighting: "soft directional ambient illumination on wood and vines",
      geometry: "cube",
    },
    stairs: {
      material: "leaf-covered stone steps descending into autumn woods",
      lighting: "dark warm ambient gloom rising from below",
      geometry: "cube",
    },
  },
  DESOLATION: {
    walkable_floor: {
      material: "cold gray ash with fine soot and scattered cinders",
      lighting: "dim gray ambient light, desaturated",
      geometry: "surface",
    },
    walkable_floor_alt: {
      material: "scorched black rock with heat fractures",
      lighting: "muted dark gray ambient illumination",
      geometry: "surface",
    },
    wall: {
      material: "charred stone wall with soot stains and burn marks",
      lighting: "directional cool gray ambient lighting from above, no source visible",
      geometry: "cube",
    },
    wall_corner: {
      material: "burnt corner block with ash and carbon deposits",
      lighting: "directional cool gray ambient lighting from above, no source visible",
      geometry: "cube",
    },
    difficult_terrain: {
      material: "sharp ash debris and broken glass shards",
      lighting: "muted gray ambient lighting",
      geometry: "surface",
    },
    hazard_primary: {
      material: "ash pit with sucking gray dust and hidden embers",
      lighting: "eerie gray underglow from below the ash",
      geometry: "surface",
    },
    obstacle_decor: {
      material: "skeletal dead tree with blackened branches, solitary",
      lighting: "soft directional ambient lighting from above, soft shadow",
      geometry: "cube",
    },
    decoration_minor: {
      material: "single dust mote floating in gray air",
      lighting: "low key neutral ambient tint",
      geometry: "surface",
    },
    door_closed: {
      material: "warped metal door with rust and burn scars",
      lighting: "soft directional ambient illumination on corroded metal",
      geometry: "cube",
    },
    stairs: {
      material: "rubble steps descending into desolation darkness",
      lighting: "dark gray ambient gloom rising from below",
      geometry: "cube",
    },
  },
  FUTURISTE: {
    walkable_floor: {
      material: "plasteel floor plate with brushed metal finish",
      lighting: "dim cool blue ambient light, low key",
      geometry: "surface",
    },
    walkable_floor_alt: {
      material: "circuit board floor with etched traces and pads",
      lighting: "muted neon-blue ambient illumination",
      geometry: "surface",
    },
    wall: {
      material: "chrome panel wall with reflective surface",
      lighting: "directional cool ambient lighting from above, no source visible",
      geometry: "cube",
    },
    wall_corner: {
      material: "alloy corner block with seamless joints",
      lighting: "directional cool ambient lighting from above, no source visible",
      geometry: "cube",
    },
    difficult_terrain: {
      material: "broken conduit with exposed wiring and sparks",
      lighting: "muted electric blue ambient lighting",
      geometry: "surface",
    },
    hazard_primary: {
      material: "plasma leak with ionized gas and electrical arcs",
      lighting: "intense neon-purple underglow from plasma",
      geometry: "surface",
    },
    obstacle_decor: {
      material: "server rack with blinking lights and cables",
      lighting: "soft directional ambient lighting from above, soft shadow",
      geometry: "cube",
    },
    decoration_minor: {
      material: "holographic data tag floating in air",
      lighting: "low key cool ambient tint",
      geometry: "surface",
    },
    door_closed: {
      material: "sliding airlock door with sealed seam and indicator lights",
      lighting: "soft directional ambient illumination on metal",
      geometry: "cube",
    },
    stairs: {
      material: "metal grating stairs descending into futuristic depths",
      lighting: "dark cool ambient gloom rising from below",
      geometry: "cube",
    },
  },
  ELECTRONIQUE: {
    walkable_floor: {
      material: "PCB trace floor with copper lines and solder pads",
      lighting: "dim cool green ambient light, low key",
      geometry: "surface",
    },
    walkable_floor_alt: {
      material: "chip substrate floor with printed circuits",
      lighting: "muted neon-green ambient illumination",
      geometry: "surface",
    },
    wall: {
      material: "server casing wall with metal panels and vents",
      lighting: "directional cool ambient lighting from above, no source visible",
      geometry: "cube",
    },
    wall_corner: {
      material: "circuit corner block with etched pathways",
      lighting: "directional cool ambient lighting from above, no source visible",
      geometry: "cube",
    },
    difficult_terrain: {
      material: "tangled fiber optic cables and data wires",
      lighting: "muted electric cyan ambient lighting",
      geometry: "surface",
    },
    hazard_primary: {
      material: "power surge with crackling electricity and arcs",
      lighting: "intense electric blue underglow from surge",
      geometry: "surface",
    },
    obstacle_decor: {
      material: "mainframe core with data drives and cooling",
      lighting: "soft directional ambient lighting from above, soft shadow",
      geometry: "cube",
    },
    decoration_minor: {
      material: "blinking LED indicator on dark panel",
      lighting: "low key cool ambient tint",
      geometry: "surface",
    },
    door_closed: {
      material: "biometric door with scanner panel and sealed frame",
      lighting: "soft directional ambient illumination on metal",
      geometry: "cube",
    },
    stairs: {
      material: "access ladder with metal rungs and cable trays",
      lighting: "dark cool ambient gloom rising from below",
      geometry: "cube",
    },
  },
};

export interface RenderedPrompt {
  prompt: string;
  geometry: "surface" | "cube";
  dimensions: { width: number; height: number };
}

/**
 * Build a final prompt string for FLUX-dev based on theme + role + optional
 * overrides. Returns the prompt plus the target geometry (used to set the
 * generation width/height and the post-process crop target).
 */
export function buildPrompt(
  theme: ThemeKey,
  role: ThemeRole,
  overrides?: { material?: string; lighting?: string; extraDetail?: string },
): RenderedPrompt {
  const visual = ROLE_VISUALS[theme]?.[role];
  if (!visual) {
    throw new Error(
      `Pas de prompt visual défini pour theme=${theme} role=${role}. ` +
        `Ajoute une entrée dans ROLE_VISUALS dans src/themes/prompts.ts, ` +
        `ou passe material+lighting via overrides.`,
    );
  }
  const material = overrides?.material ?? visual.material;
  const lighting = overrides?.lighting ?? visual.lighting;
  const base =
    visual.geometry === "surface"
      ? SURFACE_TEMPLATE(material, lighting)
      : CUBE_TEMPLATE(material, lighting);
  const prompt = overrides?.extraDetail ? `${base}, ${overrides.extraDetail}` : base;
  return {
    prompt,
    geometry: visual.geometry,
    dimensions:
      visual.geometry === "surface"
        ? { width: 1024, height: 1024 } // FLUX préfère carré, on croppe en post-process
        : { width: 1024, height: 1024 },
  };
}
