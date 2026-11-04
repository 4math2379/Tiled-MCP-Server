#!/usr/bin/env node
// Tiled Map Builder, hosted mode: one HTTP server for a public deployment such as a
// Hugging Face Space (see docs/hugging-face.md).
//
//   GET  /                  web page: describe a map, an AI model builds it, preview, download
//   POST /api/generate      runs that agent and streams its progress as NDJSON
//   *    /mcp               every MCP tool over Streamable HTTP, for agents (Claude, Cursor, ...)
//   GET  /login             "Sign in with Hugging Face" (Space OAuth), then /login/callback
//   GET  /download/<id>/..  map downloads (one hour)
//
// Paid calls (the AI model, FLUX sprites) only ever use the caller's own Hugging Face token,
// sent as "Authorization: Bearer hf_...", so they are billed to the caller. The server holds no
// token of its own, writes nothing to disk, and forgets a caller's maps when the session ends.

import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { AgentError, DEFAULT_MODEL, MODEL_ID, SUGGESTED_MODELS, runMapAgent, type AgentEvent } from "./agent.js";
import { newWorkspace, runInScope, setHostedMode, type Workspace } from "./context.js";
import { getDownload } from "./downloads.js";
import { loadEnvFile } from "./env.js";
import { PACKAGE_ROOT } from "./paths.js";
import { createServer, SERVER_VERSION } from "./server.js";
import { assetFile } from "./sprites.js";
import { THEME_KEYS, describeThemes } from "./themes/index.js";

setHostedMode(true);
loadEnvFile();

const PORT = Number(process.env.PORT || 7860);
const HOST = process.env.HOST || "127.0.0.1";
const WEB_ROOT = join(PACKAGE_ROOT, "web");
const MAX_JOBS = Math.max(1, Number(process.env.TILED_MAX_JOBS) || 4);
const JOB_TIMEOUT_MS = 8 * 60 * 1000;
const MAX_DESCRIPTION = 2000;
const MAX_SESSIONS = 200;
const SESSION_IDLE_MS = 30 * 60 * 1000;

const OAUTH =
  process.env.OAUTH_CLIENT_ID && process.env.OAUTH_CLIENT_SECRET
    ? {
        clientId: process.env.OAUTH_CLIENT_ID,
        clientSecret: process.env.OAUTH_CLIENT_SECRET,
        scopes: process.env.OAUTH_SCOPES || "openid profile inference-api",
        provider: (process.env.OPENID_PROVIDER_URL || "https://huggingface.co").replace(/\/+$/, ""),
      }
    : null;

const PAGE_CSP =
  "default-src 'self'; img-src 'self' data: https:; style-src 'self'; script-src 'self'; connect-src 'self'; " +
  "base-uri 'none'; form-action 'self'; frame-ancestors 'self' https://huggingface.co";

const STATIC: Record<string, { file: string; type: string }> = {
  "/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/index.html": { file: "index.html", type: "text/html; charset=utf-8" },
  "/app.js": { file: "app.js", type: "text/javascript; charset=utf-8" },
  "/style.css": { file: "style.css", type: "text/css; charset=utf-8" },
  "/favicon.svg": { file: "favicon.svg", type: "image/svg+xml" },
};

// ---------- small helpers ----------

function send(res: ServerResponse, status: number, body: string | Buffer, headers: Record<string, string> = {}): void {
  res.writeHead(status, { "X-Content-Type-Options": "nosniff", ...headers });
  res.end(body);
}

function json(res: ServerResponse, status: number, payload: unknown): void {
  send(res, status, JSON.stringify(payload), { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
}

function bearer(req: IncomingMessage): string | undefined {
  const m = /^Bearer\s+(\S+)\s*$/i.exec(req.headers.authorization ?? "");
  return m?.[1];
}

/** Public base URL, used in download links. */
function baseUrl(req: IncomingMessage): string {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/+$/, "");
  if (process.env.SPACE_HOST) return `https://${process.env.SPACE_HOST.split(",")[0].trim()}`;
  const proto = String(req.headers["x-forwarded-proto"] ?? "http").split(",")[0].trim();
  return `${proto}://${req.headers.host ?? `localhost:${PORT}`}`;
}

async function readBody(req: IncomingMessage, limit: number): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new Error("too large");
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

// ---------- MCP over Streamable HTTP ----------

interface Session {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
  workspace: Workspace;
  lastSeen: number;
}

const sessions = new Map<string, Session>();

function dropSession(id: string): void {
  const s = sessions.get(id);
  if (!s) return;
  sessions.delete(id);
  void s.server.close().catch(() => {});
}

function sweepSessions(): void {
  const now = Date.now();
  for (const [id, s] of sessions) if (now - s.lastSeen > SESSION_IDLE_MS) dropSession(id);
  while (sessions.size >= MAX_SESSIONS) {
    const oldest = [...sessions.entries()].sort((a, b) => a[1].lastSeen - b[1].lastSeen)[0];
    dropSession(oldest[0]);
  }
}

function mcpCors(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-Id");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
}

async function handleMcp(req: IncomingMessage, res: ServerResponse): Promise<void> {
  mcpCors(res);
  if (req.method === "OPTIONS") return send(res, 204, "");
  const scope = (workspace: Workspace) => ({ workspace, hfToken: bearer(req), baseUrl: baseUrl(req) });
  const sessionId = req.headers["mcp-session-id"];

  if (typeof sessionId === "string") {
    const s = sessions.get(sessionId);
    if (!s) {
      return json(res, 404, { jsonrpc: "2.0", error: { code: -32001, message: "Session not found or expired: start a new MCP session." }, id: null });
    }
    s.lastSeen = Date.now();
    await runInScope(scope(s.workspace), () => s.transport.handleRequest(req, res));
    return;
  }
  if (req.method !== "POST") {
    return json(res, 400, { jsonrpc: "2.0", error: { code: -32000, message: "Missing Mcp-Session-Id header: initialize a session first." }, id: null });
  }

  sweepSessions();
  const workspace = newWorkspace();
  const server = createServer();
  const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (id) => {
      sessions.set(id, { transport, server, workspace, lastSeen: Date.now() });
    },
    onsessionclosed: (id) => dropSession(id),
  });
  transport.onclose = () => {
    if (transport.sessionId) sessions.delete(transport.sessionId);
  };
  await server.connect(transport);
  await runInScope(scope(workspace), () => transport.handleRequest(req, res));
  if (!transport.sessionId) await server.close().catch(() => {});
}

// ---------- the web agent ----------

let activeJobs = 0;

async function handleGenerate(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const token = bearer(req);
  if (!token) {
    return json(res, 401, { error: "Sign in with Hugging Face, or send your own access token: the AI model runs on your account." });
  }
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(await readBody(req, 16_384)) as Record<string, unknown>;
  } catch {
    return json(res, 400, { error: "The request body must be a small JSON object." });
  }
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!description) return json(res, 400, { error: "Describe the map first." });
  if (description.length > MAX_DESCRIPTION) {
    return json(res, 400, { error: `The description is too long (${description.length} characters, at most ${MAX_DESCRIPTION}).` });
  }
  const theme = typeof body.theme === "string" && body.theme ? body.theme : undefined;
  if (theme && !THEME_KEYS.includes(theme)) return json(res, 400, { error: `Unknown theme '${theme}'.` });
  const model = typeof body.model === "string" && body.model.trim() ? body.model.trim() : DEFAULT_MODEL;
  if (!MODEL_ID.test(model)) return json(res, 400, { error: `'${model}' is not a model id such as openai/gpt-oss-120b.` });
  if (activeJobs >= MAX_JOBS) {
    return json(res, 503, { error: "The server is busy with other maps. Try again in a minute, or duplicate the Space to get your own copy." });
  }

  activeJobs++;
  res.writeHead(200, {
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Accel-Buffering": "no",
    "X-Content-Type-Options": "nosniff",
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), JOB_TIMEOUT_MS);
  res.on("close", () => {
    if (!res.writableFinished) controller.abort();
  });
  const emit = (event: AgentEvent | { type: "ping" } | { type: "error"; message: string }) => {
    if (!res.writableEnded) res.write(`${JSON.stringify(event)}\n`);
  };
  // Keeps proxies from closing the stream while the model thinks.
  const ping = setInterval(() => emit({ type: "ping" }), 15_000);
  try {
    await runMapAgent(
      { description, theme, model, allowPaidSprites: body.allowPaidSprites === true },
      { token, baseUrl: baseUrl(req), signal: controller.signal, emit },
    );
  } catch (err) {
    if (err instanceof AgentError) emit({ type: "error", message: err.message });
    else if (controller.signal.aborted) emit({ type: "error", message: "The job took too long and was stopped." });
    else {
      console.error("generate failed:", err);
      emit({ type: "error", message: `Unexpected server error: ${err instanceof Error ? err.message : String(err)}` });
    }
  } finally {
    clearInterval(ping);
    clearTimeout(timeout);
    activeJobs--;
    res.end();
  }
}

// ---------- Sign in with Hugging Face ----------

const pendingLogins = new Map<string, number>();

function handleLogin(req: IncomingMessage, res: ServerResponse): void {
  if (!OAUTH) {
    return send(res, 404, "Sign-in with Hugging Face is only available on a Hugging Face Space with hf_oauth enabled. Paste an access token instead.", {
      "Content-Type": "text/plain; charset=utf-8",
    });
  }
  const now = Date.now();
  for (const [state, expires] of pendingLogins) if (expires < now) pendingLogins.delete(state);
  if (pendingLogins.size > 10_000) pendingLogins.clear();
  const state = randomBytes(16).toString("hex");
  pendingLogins.set(state, now + 10 * 60 * 1000);
  const params = new URLSearchParams({
    client_id: OAUTH.clientId,
    redirect_uri: `${baseUrl(req)}/login/callback`,
    scope: OAUTH.scopes,
    state,
    response_type: "code",
  });
  send(res, 302, "", { Location: `${OAUTH.provider}/oauth/authorize?${params}`, "Cache-Control": "no-store" });
}

function loginPage(res: ServerResponse, payload: object | null, message: string): void {
  const nonce = randomBytes(16).toString("base64");
  const script = payload
    ? `try{sessionStorage.setItem("tiled.hf",${JSON.stringify(JSON.stringify(payload)).replace(/</g, "\\u003c")})}catch(e){}location.replace("/");`
    : "";
  send(
    res,
    payload ? 200 : 400,
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Tiled Map Builder</title></head>` +
      `<body style="font-family:system-ui,sans-serif;background:#0d1117;color:#e6edf3;padding:2rem">` +
      `<p>${escapeHtml(message)}</p><p><a style="color:#7ab7ff" href="/">Back to Tiled Map Builder</a></p>` +
      (script ? `<script nonce="${nonce}">${script}</script>` : "") +
      `</body></html>`,
    {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'`,
    },
  );
}

async function handleLoginCallback(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  if (!OAUTH) return loginPage(res, null, "Sign-in is not enabled on this server.");
  const error = url.searchParams.get("error");
  if (error) return loginPage(res, null, `Sign-in was cancelled or refused (${error}).`);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? "";
  const expires = pendingLogins.get(state);
  pendingLogins.delete(state);
  if (!code || !expires || expires < Date.now()) return loginPage(res, null, "This sign-in link expired. Please sign in again.");

  const redirectUri = `${baseUrl(req)}/login/callback`;
  const tokenRes = await fetch(`${OAUTH.provider}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${OAUTH.clientId}:${OAUTH.clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri, client_id: OAUTH.clientId }),
  }).catch(() => null);
  if (!tokenRes?.ok) return loginPage(res, null, "Hugging Face did not accept the sign-in. Please try again.");
  const tokens = (await tokenRes.json()) as { access_token?: string; expires_in?: number };
  if (!tokens.access_token) return loginPage(res, null, "Hugging Face did not return an access token. Please try again.");

  type UserInfo = { name?: string; preferred_username?: string; picture?: string };
  const info: UserInfo = await fetch(`${OAUTH.provider}/oauth/userinfo`, { headers: { Authorization: `Bearer ${tokens.access_token}` } })
    .then((r) => (r.ok ? (r.json() as Promise<UserInfo>) : {}))
    .catch(() => ({}));
  loginPage(
    res,
    {
      token: tokens.access_token,
      expiresAt: Date.now() + (tokens.expires_in ?? 8 * 3600) * 1000,
      user: { name: info.name ?? info.preferred_username ?? "", username: info.preferred_username ?? "", avatar: info.picture ?? "" },
      via: "oauth",
    },
    "Signed in. Opening Tiled Map Builder...",
  );
}

async function handleWhoami(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const token = bearer(req);
  if (!token) return json(res, 401, { error: "No token." });
  const r = await fetch("https://huggingface.co/api/whoami-v2", { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
  if (!r) return json(res, 502, { error: "Could not reach Hugging Face." });
  if (!r.ok) return json(res, r.status === 401 ? 401 : 502, { error: r.status === 401 ? "Hugging Face rejected this token." : "Could not check the token." });
  const w = (await r.json()) as { name?: string; fullname?: string; avatarUrl?: string };
  json(res, 200, { username: w.name ?? "", name: w.fullname ?? w.name ?? "", avatar: w.avatarUrl ?? "" });
}

// ---------- routing ----------

function config(req: IncomingMessage) {
  const models = SUGGESTED_MODELS.some((m) => m.id === DEFAULT_MODEL)
    ? SUGGESTED_MODELS
    : [{ id: DEFAULT_MODEL, label: DEFAULT_MODEL }, ...SUGGESTED_MODELS];
  return {
    version: SERVER_VERSION,
    oauth: !!OAUTH,
    defaultModel: DEFAULT_MODEL,
    models,
    maxDescription: MAX_DESCRIPTION,
    mcpUrl: `${baseUrl(req)}/mcp`,
    themes: describeThemes().map((t) => ({ key: t.key, name: t.name, description: t.description, sprites: t.sprites.status })),
  };
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = url.pathname;
  const method = req.method ?? "GET";

  if (path === "/mcp") return handleMcp(req, res);
  if (path === "/api/generate" && method === "POST") return handleGenerate(req, res);
  if (method !== "GET" && method !== "HEAD") return json(res, 405, { error: "Method not allowed." });

  if (path === "/healthz") return json(res, 200, { ok: true, version: SERVER_VERSION, sessions: sessions.size, jobs: activeJobs });
  if (path === "/api/config") return json(res, 200, config(req));
  if (path === "/api/whoami") return handleWhoami(req, res);
  if (path === "/login") return handleLogin(req, res);
  if (path === "/login/callback") return handleLoginCallback(req, res, url);

  const download = /^\/download\/([\w-]+)\/[^/]+$/.exec(path);
  if (download) {
    const d = getDownload(download[1]);
    if (!d) return send(res, 404, "This download link expired (links last one hour). Build or save the map again.", { "Content-Type": "text/plain; charset=utf-8" });
    return send(res, 200, d.data, {
      "Content-Type": d.contentType,
      "Content-Disposition": `attachment; filename="${d.name.replace(/[^\w.-]/g, "_")}"`,
      "Cache-Control": "private, no-store",
    });
  }

  const asset = /^\/assets\/([a-z0-9_]+\/[a-z0-9_]+\.png)$/.exec(path);
  if (asset) {
    const file = assetFile(asset[1]);
    const data = file ? await readFile(file).catch(() => null) : null;
    if (!data) return send(res, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
    return send(res, 200, data, { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" });
  }

  const page = STATIC[path];
  if (page) {
    const data = await readFile(join(WEB_ROOT, page.file)).catch(() => null);
    if (!data) return send(res, 500, "The web page files are missing (tiled-mcp/web).", { "Content-Type": "text/plain; charset=utf-8" });
    const headers: Record<string, string> = { "Content-Type": page.type, "Cache-Control": "no-cache" };
    if (extname(page.file) === ".html") {
      headers["Content-Security-Policy"] = PAGE_CSP;
      headers["Referrer-Policy"] = "no-referrer";
    }
    return send(res, 200, data, headers);
  }
  send(res, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
}

const httpServer = createHttpServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error("request failed:", err);
    if (!res.headersSent) json(res, 500, { error: "Internal server error." });
    else res.end();
  });
});

setInterval(sweepSessions, 5 * 60 * 1000).unref();

httpServer.listen(PORT, HOST, () => {
  console.log(
    `Tiled Map Builder ${SERVER_VERSION} on http://${HOST}:${PORT}  (web page /, MCP /mcp, Hugging Face sign-in ${OAUTH ? "on" : "off"}, default model ${DEFAULT_MODEL})`,
  );
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    httpServer.close();
    for (const id of [...sessions.keys()]) dropSession(id);
    process.exit(0);
  });
}
