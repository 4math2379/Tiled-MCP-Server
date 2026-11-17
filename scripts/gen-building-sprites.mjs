// PAID: generate the building sprites place_building draws (house, shop, tavern, temple, tower,
// castle) with FLUX.1-dev via Hugging Face. Runs the MCP server as a child process and calls its
// generate_building_sprite tool, which skips sprites that already exist (unless --force).
// Each generated sprite is one paid call.
//
// Usage (from the repository root, after npm install && npm run build):
//   node scripts/gen-building-sprites.mjs --dry-run          # list sprites and prompts, free
//   node scripts/gen-building-sprites.mjs --yes              # every missing building sprite
//   node scripts/gen-building-sprites.mjs house castle --yes # only these types
//   node scripts/gen-building-sprites.mjs castle --force --yes
//   node scripts/gen-building-sprites.mjs --clean            # free: re-cut existing sprites
//
// --clean removes the background left around existing sprites (a pale veil or specks when the
// provider did not paint a clean magenta) and refits them, without any paid call. Use it too
// for building images you drew yourself.
//
// Needs HUGGINGFACE_API_KEY (or HF_TOKEN) in the environment or in tiled-mcp/.env.
// See docs/sprite-generation.md for costs and providers.

import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const yes = args.includes("--yes");
const force = args.includes("--force");
const dryRun = args.includes("--dry-run");
const clean = args.includes("--clean");
const requested = args.filter((a) => !a.startsWith("--")).map((a) => a.toLowerCase());

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const assetsRoot = process.env.TILED_ASSETS_DIR ? resolve(repoRoot, process.env.TILED_ASSETS_DIR) : join(repoRoot, "assets");

if (clean) {
  const { BUILDINGS, BUILDING_TYPES, buildingSpriteFile } = await import("../tiled-mcp/dist/buildings.js");
  const { cleanBuildingSprite } = await import("../tiled-mcp/dist/tools/generation.js");
  const types = requested.length ? requested : BUILDING_TYPES;
  for (const type of types) {
    const def = BUILDINGS[type];
    if (!def) {
      console.error(`Unknown building type: ${type}. Known: ${BUILDING_TYPES.join(", ")}`);
      process.exit(1);
    }
    const file = join(assetsRoot, buildingSpriteFile(type));
    if (!existsSync(file)) {
      console.log(`  ${type.padEnd(8)} no sprite yet, skipped`);
      continue;
    }
    writeFileSync(file, await cleanBuildingSprite(readFileSync(file), def.imageWidth, def.imageHeight));
    console.log(`  ${type.padEnd(8)} cleaned -> ${file}`);
  }
  process.exit(0);
}
const serverPath = fileURLToPath(new URL("../tiled-mcp/dist/index.js", import.meta.url));
const server = spawn(process.execPath, [serverPath], { stdio: ["pipe", "pipe", "inherit"] });

let buffer = "";
const pending = new Map();
server.stdout.on("data", (chunk) => {
  buffer += chunk;
  let i;
  while ((i = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, i).trim();
    buffer = buffer.slice(i + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id !== undefined && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    } catch {
      // ignore non-JSON lines
    }
  }
});

let nextId = 1;
function request(method, params) {
  return new Promise((done) => {
    const id = nextId++;
    pending.set(id, done);
    server.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}
async function callTool(name, toolArgs) {
  const res = await request("tools/call", { name, arguments: toolArgs });
  if (res.error) throw new Error(res.error.message);
  const text = res.result.content?.[0]?.text ?? "";
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text);
  }
}

try {
  await request("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "gen-building-sprites", version: "1.0.0" },
  });
  server.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

  const tools = (await request("tools/list", {})).result.tools;
  const types = tools.find((t) => t.name === "generate_building_sprite").inputSchema.properties.buildingType.enum;
  const unknown = requested.filter((t) => !types.includes(t));
  if (unknown.length) throw new Error(`Unknown building type(s): ${unknown.join(", ")}. Known: ${types.join(", ")}`);

  const plan = [];
  for (const type of requested.length ? requested : types) {
    const preview = await callTool("generate_building_sprite", { buildingType: type, dryRun: true });
    const exists = existsSync(join(assetsRoot, preview.file));
    plan.push({ type, file: preview.file, size: preview.size, prompt: preview.prompt, generate: force || !exists, exists });
  }
  const total = plan.filter((p) => p.generate).length;

  console.log("Building sprites (one paid call each):");
  for (const p of plan) {
    console.log(`  ${p.type.padEnd(8)} assets/${p.file.padEnd(24)} ${p.size.padEnd(8)} ${p.generate ? "to generate" : "exists"}`);
  }
  console.log(`  total to generate: ${total}`);

  if (dryRun) {
    for (const p of plan.filter((x) => x.generate)) console.log(`\n[${p.type}] ${p.prompt}`);
    console.log("\nDry run: nothing generated.");
  } else if (total === 0) {
    console.log("Nothing to generate.");
  } else if (!yes) {
    console.log("\nThis spends money on Hugging Face Inference Providers. Re-run with --yes to proceed.");
  } else {
    let ok = 0;
    let failed = 0;
    for (const p of plan.filter((x) => x.generate)) {
      const res = await callTool("generate_building_sprite", { buildingType: p.type, force });
      if (res.ok) {
        ok++;
        console.log(`  ${p.type.padEnd(8)} generated in ${Math.round(res.durationMs / 1000)}s -> ${res.outputPath}`);
      } else {
        failed++;
        console.log(`  ${p.type.padEnd(8)} ${res.skipped ? "skipped (exists)" : `FAILED: ${res.error}`}`);
        if (/HUGGINGFACE_API_KEY|token/i.test(res.error ?? "")) break;
      }
    }
    console.log(`\nDone: ${ok} generated, ${failed} not generated.`);
  }
} catch (err) {
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
} finally {
  server.kill();
}
