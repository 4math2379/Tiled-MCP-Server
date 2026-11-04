// End-to-end test of the hosted mode (tiled-mcp/dist/http.js): web routes, MCP over HTTP with
// isolated sessions and download links, and the web agent driven by a scripted stand-in for the
// AI model. Free and offline: the "model" is a local stub that replaces Hugging Face Inference
// Providers, so nothing is billed.
//
// Usage (after npm run build):
//   npm run smoke:http
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { unzipSync } from "fflate";

const httpPath = fileURLToPath(new URL("../tiled-mcp/dist/http.js", import.meta.url));
const repoMaps = fileURLToPath(new URL("../maps/", import.meta.url));
const VISITOR_TOKEN = "hf_visitor_token_for_tests";
const SERVER_ENV_TOKEN = "hf_server_env_token_must_never_be_used";

let pass = 0, fail = 0;
const check = (label, cond, detail) => {
  if (cond) { pass++; console.log("PASS", label); }
  else { fail++; console.log("FAIL", label, detail !== undefined ? JSON.stringify(detail).slice(0, 400) : ""); }
};

// ---------- stand-in for the inference router ----------
const seenAuth = new Set();
let seenTools = [];
const fakeModel = createServer(async (req, res) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw);
  seenAuth.add(req.headers.authorization);
  seenTools = body.tools.map((t) => t.function.name);
  const step = body.messages.filter((m) => m.role === "assistant").length;
  let mapId;
  for (const m of body.messages) {
    if (m.role !== "tool") continue;
    try { mapId ??= JSON.parse(m.content).mapId; } catch { /* not JSON */ }
  }
  const call = (name, args) => ({
    role: "assistant",
    content: null,
    tool_calls: [{ id: `call_${step}`, type: "function", function: { name, arguments: JSON.stringify(args) } }],
  });
  const script = [
    () => call("create_map", { name: "Smoke crypt", width: 28, height: 18, theme: "CRYPT" }),
    () => call("generate_crypt_layout", { mapId }),
    () => call("save_to_disk", { mapId, path: "../../escape.tmj" }),
    () => call("place_spawn_enemy", { mapId, x: 22, y: 9, npcName: "Ghoul lord" }),
    () => call("validate_map", { mapId }),
  ];
  const message = step < script.length ? script[step]() : { role: "assistant", content: "Smoke crypt is ready." };
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ choices: [{ message }], usage: { prompt_tokens: 1000, completion_tokens: 50 } }));
});
await new Promise((r) => fakeModel.listen(0, "127.0.0.1", r));
const fakeUrl = `http://127.0.0.1:${fakeModel.address().port}/v1`;

// ---------- start the hosted server ----------
const port = 20000 + Math.floor(Math.random() * 20000);
const env = { ...process.env, PORT: String(port), HOST: "127.0.0.1", TILED_INFERENCE_URL: fakeUrl, HF_TOKEN: SERVER_ENV_TOKEN };
for (const k of ["HUGGINGFACE_API_KEY", "OAUTH_CLIENT_ID", "OAUTH_CLIENT_SECRET", "SPACE_HOST", "PUBLIC_URL", "TILED_ASSETS_DIR", "TILED_AGENT_MODEL", "TILED_ENV_FILE"]) delete env[k];
env.TILED_ENV_FILE = fileURLToPath(new URL("./does-not-exist.env", import.meta.url));
const child = spawn(process.execPath, [httpPath], { env, stdio: ["ignore", "pipe", "pipe"] });
let stderr = "";
child.stderr.on("data", (d) => (stderr += d));
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error(`server did not start: ${stderr}`)), 15000);
  child.stdout.on("data", (d) => { if (String(d).includes(`:${port}`)) { clearTimeout(t); resolve(); } });
});
const base = `http://127.0.0.1:${port}`;

// ---------- web routes ----------
const home = await fetch(`${base}/`);
check("home page served with a CSP", home.status === 200 && /Tiled Map Builder/.test(await home.text()) && /script-src 'self'/.test(home.headers.get("content-security-policy") ?? ""));
const config = await (await fetch(`${base}/api/config`)).json();
check("config: 20 themes, no sign-in without a Space, MCP url", config.themes.length === 20 && config.oauth === false && config.mcpUrl === `${base}/mcp`, config);
check("config: default model is offered", config.models.some((m) => m.id === config.defaultModel), config.models);
const sprite = await fetch(`${base}/assets/crypt/wall.png`);
check("bundled sprite served", sprite.status === 200 && sprite.headers.get("content-type") === "image/png");
check("asset route refuses paths outside the sprites", (await fetch(`${base}/assets/..%2Fpackage.json`)).status === 404);
check("login is off outside a Space", (await fetch(`${base}/login`, { redirect: "manual" })).status === 404);
check("unknown download is 404", (await fetch(`${base}/download/nope/x.zip`)).status === 404);

// ---------- MCP over HTTP ----------
async function connect(token) {
  const transport = new StreamableHTTPClientTransport(new URL(`${base}/mcp`), token ? { requestInit: { headers: { Authorization: `Bearer ${token}` } } } : undefined);
  const client = new Client({ name: "smoke-http", version: "1" });
  await client.connect(transport);
  return { client, transport };
}
const data = (r) => { try { return JSON.parse(r.content?.[0]?.text ?? ""); } catch { return r.content?.[0]?.text; } };

const a = await connect();
const b = await connect();
const tools = (await a.client.listTools()).tools;
check("30 tools over HTTP", tools.length === 30, tools.length);
const created = data(await a.client.callTool({ name: "create_map", arguments: { name: "Session A", width: 28, height: 18, theme: "CRYPT" } }));
const mapA = created.mapId;
check("session A creates a map", typeof mapA === "string", created);
check("session A lists its map", data(await a.client.callTool({ name: "list_maps", arguments: {} })).length === 1);
check("session B does not see session A's maps", data(await b.client.callTool({ name: "list_maps", arguments: {} })).length === 0);
const foreign = await b.client.callTool({ name: "describe_map", arguments: { mapId: mapA } });
check("session B cannot open session A's map", foreign.isError === true, foreign);

await a.client.callTool({ name: "generate_crypt_layout", arguments: { mapId: mapA } });
const saved = data(await a.client.callTool({ name: "save_to_disk", arguments: { mapId: mapA, path: "../../escape.tmj" } }));
check("save_to_disk returns download links", saved.ok && /\/download\/.+\/escape\.zip$/.test(saved.zipUrl) && /escape\.tmj$/.test(saved.tmjUrl), saved);
check("save_to_disk wrote nothing to the server's disk", !existsSync(join(repoMaps, "escape.tmj")) && !existsSync(resolve(repoMaps, "../../escape.tmj")));
const zipRes = await fetch(saved.zipUrl);
const files = unzipSync(new Uint8Array(await zipRes.arrayBuffer()));
const names = Object.keys(files);
check("zip holds the .tmj and its sprites", zipRes.headers.get("content-type") === "application/zip" && names.includes("escape/escape.tmj") && names.some((n) => /^escape\/assets\/crypt\/.+\.png$/.test(n)), names);
const tmj = JSON.parse(new TextDecoder().decode(files["escape/escape.tmj"]));
const images = tmj.tilesets[0].tiles.map((t) => t.image).filter(Boolean);
check("every sprite path in the .tmj resolves inside the zip", images.every((p) => names.includes(`escape/${p.replace(/^\.\//, "")}`)), images);
check("bare .tmj link works", (await fetch(saved.tmjUrl)).status === 200);

const noToken = data(await a.client.callTool({ name: "generate_tile_sprite", arguments: { theme: "CRYPT", role: "wall", force: true } }));
check("paid tool without a caller token refuses (server env token ignored)", noToken.ok === false && /No Hugging Face token was sent/.test(noToken.error), noToken);

const c = await connect(VISITOR_TOKEN);
const outDir = data(await c.client.callTool({ name: "generate_tile_sprite", arguments: { theme: "CRYPT", role: "wall", outputDir: "/tmp" } }));
check("hosted mode refuses outputDir before any paid call", outDir.ok === false && /outputDir is not available/.test(outDir.error), outDir);
const existing = data(await c.client.callTool({ name: "generate_tile_sprite", arguments: { theme: "CRYPT", role: "wall" } }));
check("existing bundled sprite is not regenerated", existing.skipped === true, existing);

await a.transport.terminateSession();
const gone = await fetch(`${base}/mcp`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", "Mcp-Session-Id": a.transport.sessionId ?? "x" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
});
check("a closed session is gone", gone.status === 404 || gone.status === 400, gone.status);
await b.client.close();
await c.client.close();

// ---------- web agent ----------
const post = (body, token) => fetch(`${base}/api/generate`, {
  method: "POST",
  headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body),
});
check("generate without a token is refused", (await post({ description: "a crypt" })).status === 401);
check("generate with an unknown theme is refused", (await post({ description: "a crypt", theme: "NOPE" }, VISITOR_TOKEN)).status === 400);
check("generate with a malformed model id is refused", (await post({ description: "a crypt", model: "not a model" }, VISITOR_TOKEN)).status === 400);

const run = await post({ description: "A small crypt with a ghoul lord", theme: "CRYPT" }, VISITOR_TOKEN);
const events = (await run.text()).trim().split("\n").map((l) => JSON.parse(l));
const done = events.find((e) => e.type === "done");
const toolEvents = events.filter((e) => e.type === "tool");
check("agent run streams NDJSON and finishes", run.headers.get("content-type")?.startsWith("application/x-ndjson") && !!done, events.filter((e) => e.type === "error"));
check("agent ran the scripted tools", toolEvents.map((e) => e.name).join(",") === "create_map,generate_crypt_layout,save_to_disk,place_spawn_enemy,validate_map", toolEvents.map((e) => e.name));
check("agent cannot call hidden tools", toolEvents.find((e) => e.name === "save_to_disk")?.ok === false);
check("model only offered the web tool set", !seenTools.includes("save_to_disk") && !seenTools.includes("export_json") && !seenTools.includes("generate_tile_sprite") && seenTools.includes("create_map"), seenTools);
check("every model call used the visitor's token, never the server's", seenAuth.size === 1 && seenAuth.has(`Bearer ${VISITOR_TOKEN}`), [...seenAuth]);
if (done) {
  check("result has a PNG preview", done.previewPng.startsWith("data:image/png;base64,") && done.previewPng.length > 2000);
  check("result map is the crypt with one enemy", done.map.name === "Smoke crypt" && done.map.spawns === 2, done.map);
  check("result has no validation warnings", done.warnings.length === 0, done.warnings);
  check("result reports usage and the final answer", done.usage.modelCalls === 6 && done.usage.promptTokens === 6000 && /ready/.test(done.report), done.usage);
  const zip = unzipSync(new Uint8Array(await (await fetch(done.zipUrl)).arrayBuffer()));
  check("result zip downloads", Object.keys(zip).includes("smoke-crypt/smoke-crypt.tmj"), Object.keys(zip));
}

const health = await (await fetch(`${base}/healthz`)).json();
check("health check reports no running job", health.ok && health.jobs === 0, health);

child.kill();
fakeModel.close();
console.log(`\n${pass} passed, ${fail} failed`);
if (stderr.trim()) console.log("server stderr:\n" + stderr);
process.exit(fail ? 1 : 0);
