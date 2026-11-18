// End-to-end smoke test: starts the built MCP server and drives it over stdio like a client
// would, checking tools, prompt, presets, placement rules, coordinates and file output.
// Free and offline: it never calls a paid or remote service.
//
// Usage (after npm run build):
//   npm run smoke                       # Tiled-native object coordinates (default)
//   node scripts/smoke-test.mjs screen  # legacy screen-space coordinates
import { spawn } from "node:child_process";
import { existsSync, readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const mode = process.argv[2];
const serverPath = fileURLToPath(new URL("../tiled-mcp/dist/index.js", import.meta.url));
const outDir = mkdtempSync(join(tmpdir(), "tiled-mcp-smoke-"));
const env = { ...process.env, TILED_MAPS_DIR: outDir, TILED_ENV_FILE: resolve(outDir, "does-not-exist.env") };
for (const k of ["HUGGINGFACE_API_KEY", "HF_TOKEN", "TILED_ASSETS_DIR", "TILED_OBJECT_COORDS"]) delete env[k];
if (mode === "screen") env.TILED_OBJECT_COORDS = "screen";

const child = spawn(process.execPath, [serverPath], { env, stdio: ["pipe", "pipe", "pipe"] });
let buf = "";
const pending = new Map();
let stderr = "";
child.stderr.on("data", (d) => (stderr += d));
child.stdout.on("data", (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { console.log("NON-JSON STDOUT:", line); continue; }
    if (msg.id !== undefined && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  }
});
let nextId = 1;
const rpc = (method, params) => new Promise((res) => { const id = nextId++; pending.set(id, res); child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n"); });
const notify = (method, params) => child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
const call = async (name, args) => {
  const r = await rpc("tools/call", { name, arguments: args });
  if (r.error) return { protocolError: r.error };
  const text = r.result.content?.[0]?.text ?? "";
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { isError: !!r.result.isError, data };
};

let pass = 0, fail = 0;
const check = (label, cond, detail) => { if (cond) { pass++; console.log("PASS", label); } else { fail++; console.log("FAIL", label, detail !== undefined ? JSON.stringify(detail).slice(0, 400) : ""); } };

const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "smoke", version: "1" } });
check("initialize", init.result?.serverInfo?.name === "tiled-map-builder", init.result?.serverInfo);
notify("notifications/initialized", {});

const tools = (await rpc("tools/list", {})).result.tools;
check("35 tools listed", tools.length === 35, tools.length);
const nonAscii = tools.filter((t) => /[^\x00-\x7F]/.test(JSON.stringify([t.title, t.description, t.inputSchema])));
check("tool text is plain English/ASCII", nonAscii.length === 0, nonAscii.map((t) => t.name));
check("every tool has annotations", tools.every((t) => t.annotations && typeof t.annotations.readOnlyHint === "boolean"), tools.filter((t) => !t.annotations).map((t) => t.name));
const createMapTool = tools.find((t) => t.name === "create_map");
check("create_map theme enum has 20 themes", createMapTool.inputSchema.properties.theme.enum.length === 20, createMapTool.inputSchema.properties.theme);
const genTool = tools.find((t) => t.name === "generate_tile_sprite");
check("generate_tile_sprite accepts 20 themes", genTool.inputSchema.properties.theme.enum.length === 20);

const prompts = (await rpc("prompts/list", {})).result.prompts;
check("map_builder prompt listed", prompts.some((p) => p.name === "map_builder"));
const pg = await rpc("prompts/get", { name: "map_builder", arguments: { description: "crypt 28x18" } });
check("map_builder prompt loads the skill", !pg.error && pg.result.messages[0].content.text.includes("Map request: crypt 28x18") && pg.result.messages[0].content.text.length > 2000, pg.error ?? pg.result?.messages?.[0]?.content?.text?.slice(0, 200));

const themes = (await call("list_themes", {})).data;
check("list_themes returns 20", themes.length === 20, themes.length);
const crypt = themes.find((t) => t.key === "CRYPT");
check("CRYPT sprites all present", crypt.sprites.status === "all", crypt.sprites);
check("every theme reports sprite status", themes.every((t) => ["all", "partial", "none"].includes(t.sprites.status)));

// Every theme, in a loop: English key, name and description; each layout preset builds a map
// the player can walk with no warning; a saved map records its theme and finds its sprites.
const LEGACY_KEYS = ["GLACIAIRE", "INONDE", "VOLCAN", "FORET", "HIVER", "PRINTEMPS", "ETE", "AUTOMNE", "FUTURISTE", "ELECTRONIQUE"];
const FRENCH = /[À-ſ]|\b(le|la|les|des|du|et|sous|aux|une|dans|avec)\b/i;
check("no theme keeps a pre-0.5.0 French key", !themes.some((t) => LEGACY_KEYS.includes(t.key)) && !createMapTool.inputSchema.properties.theme.enum.some((k) => LEGACY_KEYS.includes(k)), themes.map((t) => t.key));
const PRESETS = [
  ["generate_crypt_layout", 27, 18, {}],
  ["generate_castle_floor", 27, 20, { floorVariant: "throne" }],
  ["generate_werewolf_den", 22, 16, {}],
];
for (const t of themes) {
  const problems = [];
  if (!/^[A-Z][A-Z_]*$/.test(t.key)) problems.push(`key ${t.key}`);
  if (FRENCH.test(t.name) || !t.name.trim()) problems.push(`name "${t.name}"`);
  if (FRENCH.test(t.description) || t.description.length < 20) problems.push(`description "${t.description}"`);
  for (const [preset, w, h, extra] of PRESETS) {
    const m = (await call("create_map", { name: `${preset} ${t.key}`, width: w, height: h, theme: t.key })).data;
    const r = await call(preset, { mapId: m.mapId, ...extra });
    const v = (await call("validate_map", { mapId: m.mapId })).data;
    if (r.isError || !v.ok || v.warnings.length) problems.push(`${preset}: ${r.isError ? r.data : JSON.stringify(v.warnings).slice(0, 200)}`);
    await call("discard_map", { mapId: m.mapId });
  }
  const room = (await call("create_map", { name: `Room ${t.key}`, width: 10, height: 8, theme: t.key })).data;
  await call("generate_room", { mapId: room.mapId, originX: 0, originY: 0, width: 10, height: 8 });
  await call("place_spawn_player", { mapId: room.mapId, x: 2, y: 4 });
  const saved = await call("save_to_disk", { mapId: room.mapId, path: `themes/${t.key.toLowerCase()}.tmj` });
  if (saved.isError) problems.push(`save: ${saved.data}`);
  else {
    const file = resolve(outDir, "themes", `${t.key.toLowerCase()}.tmj`);
    const tmj = JSON.parse(readFileSync(file, "utf8"));
    if (tmj.properties?.find((p) => p.name === "theme")?.value !== t.key) problems.push("saved map does not record its theme");
    const images = tmj.tilesets[0].tiles.map((tile) => tile.image).filter(Boolean);
    if (images.some((img) => !img.includes(`/assets/${t.key.toLowerCase()}/`))) problems.push("sprite paths outside the theme's folder");
    const missing = images.filter((img) => !existsSync(resolve(dirname(file), img)));
    if (t.sprites.status === "all" && missing.length) problems.push(`missing sprites: ${missing.join(", ")}`);
  }
  await call("discard_map", { mapId: room.mapId });
  check(`theme ${t.key} ("${t.name}"): English, 3 presets walkable, saves with its sprites`, problems.length === 0, problems);
}
const legacyCall = await call("create_map", { name: "Old key", width: 10, height: 8, theme: "GLACIAIRE" });
check("an old French key is refused with its English replacement", (legacyCall.isError || legacyCall.protocolError) && JSON.stringify(legacyCall).includes("was renamed 'GLACIER'"), legacyCall);
const { getTheme: themeByKey } = await import("../tiled-mcp/dist/themes/index.js");
check("the builder API still accepts old French keys", themeByKey("ELECTRONIQUE").key === "ELECTRONIC" && themeByKey("GLACIAIRE").key === "GLACIER");

// Presets: minimum sizes enforced
const small = (await call("create_map", { name: "small", width: 20, height: 14, theme: "CRYPT" })).data;
const tooSmall = await call("generate_crypt_layout", { mapId: small.mapId });
check("crypt preset rejects 20x14 with a clear error", tooSmall.isError && /at least 27x18/.test(tooSmall.data), tooSmall);

const results = {};
for (const [preset, theme, w, h, extra] of [
  ["generate_crypt_layout", "CRYPT", 27, 18, {}],
  ["generate_castle_floor", "CASTLE", 27, 20, { floorVariant: "throne" }],
  ["generate_werewolf_den", "WEREWOLF_DEN", 22, 16, {}],
]) {
  const m = (await call("create_map", { name: `${preset} test`, width: w, height: h, theme })).data;
  const r = await call(preset, { mapId: m.mapId, ...extra });
  check(`${preset} at minimum size`, !r.isError && r.data.ok, r.data);
  const v = (await call("validate_map", { mapId: m.mapId })).data;
  check(`${preset} validates with no warnings`, v.ok && v.warnings.length === 0, v);
  results[preset] = m.mapId;
}

// Object placement rules on the crypt map
const cm = results.generate_crypt_layout;
const onWall = await call("place_chest", { mapId: cm, x: 8, y: 6 });
check("chest on a wall is rejected", onWall.isError && /wall/.test(onWall.data), onWall);
const onObstacle = await call("place_chest", { mapId: cm, x: 9, y: 7 });
check("chest on an obstacle prop is rejected", onObstacle.isError && /obstacle/.test(onObstacle.data), onObstacle);
const ok1 = await call("place_chest", { mapId: cm, x: 12, y: 8, locked: true, pickDC: 15 });
check("chest on floor accepted", !ok1.isError && ok1.data.ok, ok1);
const dup = await call("place_spawn_enemy", { mapId: cm, x: 12, y: 8, npcName: "Ghoul" });
check("spawn on occupied cell rejected", dup.isError && /occupied/.test(dup.data), dup);
const enemy = await call("place_spawn_enemy", { mapId: cm, x: 13, y: 8, npcName: "Ghoul" });
check("enemy spawn accepted", !enemy.isError, enemy);
const info = (await call("get_tile_info", { mapId: cm, layer: "ground", x: 12, y: 8 })).data;
check("get_tile_info reports occupant", info.occupiedBy?.type === "chest", info);
const oob = await call("paint_rect", { mapId: cm, layer: "ground", x1: 0, y1: 0, x2: 40, y2: 2, role: "walkable_floor" });
check("paint_rect out of grid rejected", oob.isError && /outside/.test(oob.data), oob);
const bogus = await call("describe_map", { mapId: "nope" });
check("unknown mapId gives a tool error", bogus.isError && /Unknown mapId/.test(bogus.data), bogus);

// Coordinates written to the file
const exp = (await call("export_json", { mapId: cm })).data;
const objs = exp.layers.find((l) => l.name === "objects").objects;
const spawns = exp.layers.find((l) => l.name === "spawns").objects;
const chest = objs.find((o) => o.type === "chest");
const ghoul = spawns.find((o) => o.properties.some((p) => p.value === "Ghoul"));
if (mode === "screen") {
  check("screen mode chest position", chest.x === 32 * (12 - 8) && chest.y === 16 * (12 + 8), chest);
  check("screen mode spawn position", ghoul.x === 32 * (13 - 8) && ghoul.y === 16 * (13 + 8) && !ghoul.point, ghoul);
} else {
  check("tiled mode chest at col*th,row*th size th", chest.x === 12 * 32 && chest.y === 8 * 32 && chest.width === 32 && chest.height === 32, chest);
  check("tiled mode spawn is a centred point", ghoul.point === true && ghoul.x === 13.5 * 32 && ghoul.y === 8.5 * 32, ghoul);
}
check("export keeps ./assets paths", exp.tilesets[0].tiles[0].image.startsWith("./assets/crypt/"), exp.tilesets[0].tiles[0].image);

// Save to disk
const badExt = await call("save_to_disk", { mapId: cm, path: "crypt.txt" });
check("save_to_disk rejects non-.tmj", badExt.isError, badExt);
const saved = (await call("save_to_disk", { mapId: cm, path: "nested/smoke-crypt.tmj" })).data;
check("save_to_disk relative path lands in maps dir", saved.ok && resolve(saved.path) === resolve(outDir, "nested/smoke-crypt.tmj"), saved);
const file = JSON.parse(readFileSync(saved.path, "utf8"));
const missing = file.tilesets[0].tiles.filter((t) => !existsSync(resolve(dirname(saved.path), t.image)));
check("saved sprite paths resolve from the file location", missing.length === 0, missing.map((t) => t.image));

// Paid tools without credentials
const gen = await call("generate_tile_sprite", { theme: "AQUATIC", role: "wall" });
check("sprite generation without token: clean message, no network", gen.data.ok === false && /HUGGINGFACE_API_KEY/.test(gen.data.error), gen);
const prev = await call("preview_sprite_prompt", { theme: "VOLCANO", role: "wall" });
check("prompt preview works for a newer theme", prev.data.ok && /magenta/.test(prev.data.prompt), prev);
const ovr = (await call("override_tile_image", { mapId: cm, role: "obstacle_decor", variant: "alembic" })).data;
check("override to a missing variant warns", ovr.ok && /No file/.test(ovr.warning ?? ""), ovr);

// Orthogonal map
const om = (await call("create_map", { name: "ortho", width: 10, height: 8, theme: "TAVERN_BLOOD_PRINCE", orientation: "orthogonal" })).data;
await call("generate_room", { mapId: om.mapId, originX: 0, originY: 0, width: 10, height: 8, exits: [{ direction: "south", offset: 3 }] });
await call("place_spawn_player", { mapId: om.mapId, x: 2, y: 2 });
const oexp = (await call("export_json", { mapId: om.mapId })).data;
const ps = oexp.layers.find((l) => l.name === "spawns").objects[0];
const door = oexp.layers.find((l) => l.name === "objects").objects[0];
check("orthogonal spawn point at tile centre", ps.point && ps.x === 2.5 * 64 && ps.y === 2.5 * 32, ps);
check("orthogonal door rect", door.x === 3 * 64 && door.y === 7 * 32 && door.width === 64, door);
const badExit = await call("generate_room", { mapId: om.mapId, originX: 0, originY: 0, width: 5, height: 5, exits: [{ direction: "north", offset: 9 }] });
check("exit offset past the wall rejected", badExit.isError, badExit);

// Worlds: a 256x256 outdoor map with buildings whose interiors are linked maps
const tooBig = await call("create_map", { name: "too big", width: 300, height: 10, theme: "VILLAGE" });
check("maps above 256 cells per side are rejected", tooBig.isError || tooBig.protocolError, tooBig);
const out = (await call("create_map", { name: "Smoke village", width: 256, height: 256, theme: "VILLAGE" })).data;
check("256x256 outdoor map created", out.mapId && out.summary.fileName === "smoke-village.tmj", out);
await call("paint_rect", { mapId: out.mapId, layer: "ground", x1: 0, y1: 0, x2: 255, y2: 255, role: "walkable_floor" });
await call("paint_tile", { mapId: out.mapId, layer: "decorations", x: 11, y: 11, role: "obstacle_decor" });
const house = (await call("place_building", { mapId: out.mapId, buildingType: "house", x: 10, y: 10, name: "Miller house" })).data;
check("house placed with a linked interior", house.ok && house.buildingId === "miller-house" && house.interior?.fileName === "miller-house-interior.tmj", house);
check("house entrance on the south edge, arrival in front", house.entrance.x === 11 && house.entrance.y === 12 && house.outsideArrival.y === 13, house);
check("props under the footprint are cleared", house.clearedProps === 1, house.clearedProps);
const overlap = await call("place_building", { mapId: out.mapId, buildingType: "house", x: 11, y: 11 });
check("overlapping footprint rejected", overlap.isError, overlap);
const castle = (await call("place_building", { mapId: out.mapId, buildingType: "castle", x: 40, y: 40, door: "east" })).data;
check("castle placed with a castle-floor interior", castle.ok && castle.interior.width === 27 && castle.entrance.x === 45, castle);
const tower = (await call("place_building", { mapId: out.mapId, buildingType: "tower", x: 70, y: 20, interior: false })).data;
check("building without interior has no entrance", tower.ok && tower.interior === null && !tower.entrance, tower);
const cellar = (await call("create_map", { name: "Castle cellar", width: 12, height: 10, theme: "CRYPT" })).data;
await call("generate_room", { mapId: cellar.mapId, originX: 0, originY: 0, width: 12, height: 10 });
const link = (await call("link_maps", { fromMapId: castle.interior.mapId, fromX: 12, fromY: 8, toMapId: cellar.mapId, toX: 5, toY: 4, kind: "stairs" })).data;
check("link_maps joins castle and cellar both ways", link.ok && link.from.arrival.name && link.to.object.name, link);
await call("place_spawn_player", { mapId: out.mapId, x: 5, y: 5 });
const interiorCheck = (await call("validate_map", { mapId: house.interior.mapId })).data;
check("interior with an arrival point needs no player spawn", !interiorCheck.warnings.some((w) => /player/.test(w)), interiorCheck);
const world = (await call("validate_world", { mapId: out.mapId })).data;
check("world validates: 4 linked maps, no errors", world.ok && world.maps.length === 4 && world.errors.length === 0, world);
check("world has no one-way links", !world.warnings.some((w) => /no way back/.test(w)), world.warnings);
check("world start map is the outdoor map", world.startMaps.length === 1 && world.startMaps[0] === "smoke-village.tmj", world.startMaps);
check("whole world can be walked: no reachability warning", !world.warnings.some((w) => /on foot|way out|cannot be reached/.test(w)), world.warnings);

const savedWorld = (await call("save_world", { mapId: out.mapId, folder: "world" })).data;
check("save_world writes the 4 maps side by side", savedWorld.ok && savedWorld.files.length === 4, savedWorld);
const outText = readFileSync(resolve(outDir, "world/smoke-village.tmj"), "utf8");
const outFile = JSON.parse(outText);
check("tile layer data written on one line each", outText.split("\n").length < 600, outText.split("\n").length);
const bTileset = outFile.tilesets.find((t) => t.name === "buildings");
check("buildings tileset after the theme tileset, bottom aligned", bTileset && bTileset.firstgid === outFile.tilesets[0].tilecount + 1 && bTileset.objectalignment === "bottom", bTileset);
const bLayer = outFile.layers.find((l) => l.name === "buildings");
const houseObj = bLayer?.objects.find((o) => o.name === "Miller house");
// Bottom corner of the footprint = tile point (13, 13): Tiled space (13*th, 13*th), legacy screen space (tw/2*(13-13), th/2*(13+13)).
const anchor = mode === "screen" ? { x: 0, y: 13 * 32 } : { x: 13 * 32, y: 13 * 32 };
check("house is a tile object anchored on the footprint's bottom corner", houseObj && houseObj.gid >= bTileset.firstgid && houseObj.x === anchor.x && houseObj.y === anchor.y && houseObj.width === 192, houseObj);
check("buildings layer sits before objects and spawns", outFile.layers.map((l) => l.name).join(",") === "ground,walls,decorations,buildings,objects,spawns", outFile.layers.map((l) => l.name));
const entrance = outFile.layers.find((l) => l.name === "objects").objects.find((o) => o.name === "miller-house-entrance");
const targetMap = entrance?.properties.find((p) => p.name === "targetMap");
const targetSpawn = entrance?.properties.find((p) => p.name === "targetSpawn")?.value;
check("entrance targetMap is a file property naming the interior", targetMap?.type === "file" && targetMap.value === "miller-house-interior.tmj", entrance);
const interiorFile = JSON.parse(readFileSync(resolve(outDir, "world", targetMap.value), "utf8"));
check("interior holds the entrance's targetSpawn", interiorFile.layers.find((l) => l.name === "spawns").objects.some((o) => o.name === targetSpawn), targetSpawn);
const exitObj = interiorFile.layers.find((l) => l.name === "objects").objects.find((o) => o.type === "exit");
check("interior exit leads back to the outdoor map", exitObj?.properties.some((p) => p.name === "targetMap" && p.value === "smoke-village.tmj"), exitObj);
check("interior records its parent map", interiorFile.properties.some((p) => p.name === "parentMap" && p.type === "file" && p.value === "smoke-village.tmj"), interiorFile.properties);

const { renderMapPreview } = await import("../tiled-mcp/dist/render.js");
const t0 = Date.now();
const png = await renderMapPreview(outFile, (image) => {
  try { return readFileSync(resolve(outDir, "world", image)); } catch { return undefined; }
}, { maxWidth: 1600 });
const ms = Date.now() - t0;
const width = png.readUInt32BE(16);
check(`256x256 preview renders at 1600 px wide (${ms} ms)`, width === 1600 && ms < 60000, { width, ms });

await call("discard_map", { mapId: house.interior.mapId });
const broken = (await call("validate_world", { mapId: out.mapId })).data;
check("a discarded interior is reported as a broken link", !broken.ok && broken.errors.some((e) => /miller-house-entrance/.test(e)), broken.errors);

// Walking reachability (flood fill from where the player starts or arrives)
const hall = (await call("create_map", { name: "Split hall", width: 14, height: 10, theme: "CRYPT" })).data;
await call("generate_room", { mapId: hall.mapId, originX: 0, originY: 0, width: 14, height: 10 });
await call("place_spawn_player", { mapId: hall.mapId, x: 2, y: 5 });
await call("place_chest", { mapId: hall.mapId, x: 11, y: 5, name: "far-chest" });
for (let y = 1; y <= 8; y++) await call("paint_tile", { mapId: hall.mapId, layer: "decorations", x: 7, y, role: "obstacle_decor" });
const split = (await call("validate_map", { mapId: hall.mapId })).data;
check("a row of props cutting a room hides the chest behind it", split.warnings.some((w) => /cannot be reached on foot/.test(w) && w.includes('"far-chest"')), split.warnings);
check("the cut-off half of the room is reported as unreachable floor", split.warnings.some((w) => /floor cells in 1 area cannot be reached/.test(w)), split.warnings);
await call("erase_tile", { mapId: hall.mapId, layer: "decorations", x: 7, y: 5 });
const opened = (await call("validate_map", { mapId: hall.mapId })).data;
check("one gap in the row of props clears every warning", opened.warnings.length === 0, opened.warnings);

const yard = (await call("create_map", { name: "Fenced yard", width: 20, height: 20, theme: "VILLAGE" })).data;
await call("paint_rect", { mapId: yard.mapId, layer: "ground", x1: 0, y1: 0, x2: 19, y2: 19, role: "walkable_floor" });
await call("place_spawn_player", { mapId: yard.mapId, x: 2, y: 2 });
const hut = (await call("place_building", { mapId: yard.mapId, buildingType: "house", x: 10, y: 10, name: "Hut" })).data;
const clean = (await call("validate_world", { mapId: yard.mapId })).data;
check("a building on open ground can be walked to and back", clean.ok && !clean.warnings.some((w) => /on foot|way out|cannot be reached/.test(w)), clean.warnings);
// Fence the doorway: entrance and arrival point stay valid links, but the player cannot walk there.
const front = hut.outsideArrival;
for (const [x, y] of [[front.x - 1, front.y], [front.x + 1, front.y], [front.x, front.y + 1]]) {
  await call("paint_tile", { mapId: yard.mapId, layer: "decorations", x, y, role: "obstacle_decor" });
}
const fenced = (await call("validate_world", { mapId: yard.mapId })).data;
check("fenced doorway: links still valid (no errors)", fenced.ok && fenced.errors.length === 0, fenced.errors);
check("fenced doorway: entrance reported unreachable from the start", fenced.warnings.some((w) => w.startsWith("fenced-yard.tmj:") && w.includes('"hut-entrance"')), fenced.warnings);
check("fenced doorway: the interior is reported as cut off", fenced.warnings.some((w) => w.startsWith("hut-interior.tmj:") && /nothing on this map can be reached/.test(w)), fenced.warnings);
const fencedMap = (await call("validate_map", { mapId: yard.mapId })).data;
check("validate_map reports the fenced doorway too", fencedMap.warnings.some((w) => w.includes('"hut-entrance"')), fencedMap.warnings);
await call("erase_tile", { mapId: yard.mapId, layer: "decorations", x: front.x, y: front.y + 1 });
const unfenced = (await call("validate_world", { mapId: yard.mapId })).data;
check("opening the fence clears the walking warnings", !unfenced.warnings.some((w) => /on foot|way out|cannot be reached/.test(w)), unfenced.warnings);
// Block the interior exit: the arrival point inside can no longer walk out.
const exitCell = (await call("validate_world", { mapId: yard.mapId })).data.links.find((l) => l.from === "hut-interior.tmj").cell;
await call("paint_tile", { mapId: hut.interior.mapId, layer: "decorations", x: exitCell.x, y: exitCell.y, role: "obstacle_decor" });
const trapped = (await call("validate_map", { mapId: hut.interior.mapId })).data;
check("an arrival point with no reachable way out is reported", trapped.warnings.some((w) => /cannot walk to any way out/.test(w) && w.includes("hut-inside")), trapped.warnings);

console.log(`\n${pass} passed, ${fail} failed`);
if (stderr.trim()) console.log("SERVER STDERR:", stderr.slice(0, 500));
child.kill();
rmSync(outDir, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
