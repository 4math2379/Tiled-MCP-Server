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
check("30 tools listed", tools.length === 30, tools.length);
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
const prev = await call("preview_sprite_prompt", { theme: "VOLCAN", role: "wall" });
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

console.log(`\n${pass} passed, ${fail} failed`);
if (stderr.trim()) console.log("SERVER STDERR:", stderr.slice(0, 500));
child.kill();
rmSync(outDir, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
