// Buildings that place_building puts on an outdoor map: a large sprite drawn as a Tiled tile
// object over a square footprint, an entrance, and an interior map linked both ways.
//
// Sprites live in <assets>/buildings/<type>.png (or <type>__<variant>.png) and are generated
// with FLUX (generate_building_sprite, paid). Their size matches the footprint on the 64x32
// isometric grid every bundled theme uses: the image is footprint*64 pixels wide, so its left
// and right edges meet the corners of the footprint diamond, and it is anchored at its bottom
// centre on the footprint's bottom corner.

export const BUILDING_TYPES = ["house", "shop", "tavern", "temple", "tower", "castle"] as const;
export type BuildingType = (typeof BUILDING_TYPES)[number];

export interface BuildingDef {
  label: string;
  /** Side of the square footprint, in cells. */
  footprint: number;
  imageWidth: number;
  imageHeight: number;
  /** Theme and size of the interior map place_building creates. */
  interiorTheme: string;
  interiorWidth: number;
  interiorHeight: number;
  /** FLUX subject description. */
  material: string;
}

export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  house: {
    label: "House",
    footprint: 3,
    imageWidth: 192,
    imageHeight: 192,
    interiorTheme: "TAVERN_BLOOD_PRINCE",
    interiorWidth: 12,
    interiorHeight: 10,
    material:
      "small two-storey half-timbered village house with a steep slate roof, shuttered windows, a stone chimney and a wooden front door",
  },
  shop: {
    label: "Shop",
    footprint: 3,
    imageWidth: 192,
    imageHeight: 192,
    interiorTheme: "TAVERN_BLOOD_PRINCE",
    interiorWidth: 10,
    interiorHeight: 8,
    material:
      "narrow timber-framed village shop with a hanging wooden sign, a cloth awning over the display window and a front door",
  },
  tavern: {
    label: "Tavern",
    footprint: 4,
    imageWidth: 256,
    imageHeight: 256,
    interiorTheme: "TAVERN_BLOOD_PRINCE",
    interiorWidth: 16,
    interiorHeight: 12,
    material:
      "large timber-framed roadside tavern with two stone chimneys, a wooden balcony, a hanging sign and a wide front door",
  },
  temple: {
    label: "Temple",
    footprint: 4,
    imageWidth: 256,
    imageHeight: 256,
    interiorTheme: "MAUSOLEUM",
    interiorWidth: 14,
    interiorHeight: 12,
    material: "small weathered stone chapel with a bell tower, a pointed arch doorway and tall narrow windows",
  },
  tower: {
    label: "Tower",
    footprint: 2,
    imageWidth: 128,
    imageHeight: 192,
    interiorTheme: "CASTLE",
    interiorWidth: 9,
    interiorHeight: 9,
    material: "tall round stone watchtower with a conical slate roof, arrow slits and a heavy wooden door at its base",
  },
  castle: {
    label: "Castle",
    footprint: 6,
    imageWidth: 384,
    imageHeight: 384,
    interiorTheme: "CASTLE",
    interiorWidth: 27,
    interiorHeight: 20,
    material:
      "fortified dark stone castle keep with four corner towers, crenellated walls and a gatehouse with a closed portcullis",
  },
};

/** Sprite file of a building below the assets root, e.g. "buildings/house.png". */
export function buildingSpriteFile(type: BuildingType, variant?: string): string {
  return `buildings/${variant ? `${type}__${variant}` : type}.png`;
}
