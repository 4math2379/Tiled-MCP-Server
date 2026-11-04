// PAID: generate the missing sprites of one or more themes with FLUX.1-dev via Hugging Face.
// Runs the MCP server as a child process and calls its generate_theme_sprite_set tool, which
// skips sprites that already exist (unless --force). Each generated sprite is a paid call.
//
// Usage (from the repository root, after npm install && npm run build):
//   node scripts/gen-theme-set.mjs VOLCAN --yes
//   node scripts/gen-theme-set.mjs VOLCAN HIVER ETE --yes
//   node scripts/gen-theme-set.mjs --missing --yes     # every theme with missing sprites
//   node scripts/gen-theme-set.mjs --dry-run VOLCAN    # list what would be generated, free
//
// Needs HUGGINGFACE_API_KEY (or HF_TOKEN) in the environment or in tiled-mcp/.env.
// See docs/sprite-generation.md for costs and providers.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const yes = args.includes("--yes");
const force = args.includes("--force");
const dryRun = args.includes("--dry-run");
const missingOnly = args.includes("--missing");
const requested = args.filter((a) => !a.startsWith("--")).map((a) => a.toUpperCase());

if (!requested.length && !missingOnly) {
  console.error("Usage: node scripts/gen-theme-set.mjs <THEME...> | --missing  [--yes] [--force] [--dry-run]");
  process.exit(1);
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
  return new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    server.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}
async function callTool(name, args) {
  const res = await request("tools/call", { name, arguments: args });
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
    clientInfo: { name: "gen-theme-set", version: "1.0.0" },
  });
  server.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

  const themes = await callTool("list_themes", {});
  const known = new Map(themes.map((t) => [t.key, t]));
  const unknown = requested.filter((k) => !known.has(k));
  if (unknown.length) throw new Error(`Unknown theme(s): ${unknown.join(", ")}. Known: ${[...known.keys()].join(", ")}`);

  const targets = (missingOnly ? themes.filter((t) => t.sprites.status !== "all") : requested.map((k) => known.get(k)));
  const plan = targets.map((t) => ({ key: t.key, toGenerate: force ? t.sprites.total : t.sprites.total - t.sprites.present }));
  const total = plan.reduce((n, p) => n + p.toGenerate, 0);

  console.log("Sprites to generate (one paid call each):");
  for (const p of plan) console.log(`  ${p.key.padEnd(22)} ${p.toGenerate}`);
  console.log(`  ${"total".padEnd(22)} ${total}`);

  if (dryRun || total === 0) {
    console.log(total === 0 ? "Nothing to generate." : "Dry run: nothing generated.");
  } else if (!yes) {
    console.log("\nThis spends money on Hugging Face Inference Providers. Re-run with --yes to proceed.");
  } else {
    let ok = 0;
    let failed = 0;
    for (const p of plan) {
      if (p.toGenerate === 0) continue;
      console.log(`\n=== ${p.key} ===`);
      const res = await callTool("generate_theme_sprite_set", { theme: p.key, force });
      if (res.ok === false) throw new Error(res.error);
      for (const r of res.results) {
        const status = r.skipped ? "skipped (exists)" : r.ok ? `generated in ${Math.round(r.durationMs / 1000)}s` : `FAILED: ${r.error}`;
        console.log(`  ${r.role.padEnd(20)} ${status}`);
        if (!r.skipped) r.ok ? ok++ : failed++;
      }
    }
    console.log(`\nDone: ${ok} generated, ${failed} failed.`);
  }
} catch (err) {
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
} finally {
  server.kill();
}
