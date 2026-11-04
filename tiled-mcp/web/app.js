// Tiled Map Builder web page. Talks to the same server: /api/config, /api/whoami,
// /api/generate (NDJSON stream). The Hugging Face token lives in sessionStorage only.
"use strict";

const $ = (id) => document.getElementById(id);
const STORE_KEY = "tiled.hf";

const EXAMPLES = [
  ["Crypt", "A crypt 28x18 under an abandoned chapel: two skeletons patrol the nave, a ghoul lord sleeps in the deep crypt behind a locked door (DC 15), and a poison trap guards the reliquary."],
  ["Ice fortress", "A frozen fortress 30x22: a great hall with ice pillars, a throne room at the far end where a frost giant waits, two guard rooms, and slippery ice in the corridors."],
  ["Tavern", "A cozy tavern 20x14 with a bar, tables, a hearth and stairs to the cellar. The innkeeper and three patrons are friendly NPCs; a thief hides in the storeroom."],
  ["Repaire (FR)", "Un repaire de loups-garous 24x18 dans une grotte humide : l'alpha dort au fond de sa tanière, des tas d'os ralentissent le passage, et trois loups attendent en embuscade près de l'entrée."],
];

let session = loadSession();
let config = null;
let controller = null;
const inIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

function loadSession() {
  try {
    const s = JSON.parse(sessionStorage.getItem(STORE_KEY) || "null");
    if (s && s.token && (!s.expiresAt || s.expiresAt > Date.now() + 60_000)) return s;
  } catch {
    // storage unavailable
  }
  return null;
}

function saveSession(s) {
  session = s;
  try {
    if (s) sessionStorage.setItem(STORE_KEY, JSON.stringify(s));
    else sessionStorage.removeItem(STORE_KEY);
  } catch {
    // storage unavailable: the session lasts until the page is reloaded
  }
  renderAccount();
}

function el(tag, attrs = {}, text) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderAccount() {
  const box = $("account");
  box.replaceChildren();
  $("signin").hidden = !!session;
  if (!session) return;
  const user = session.user || {};
  if (user.avatar && /^https:\/\//.test(user.avatar)) box.append(el("img", { src: user.avatar, alt: "", width: "28", height: "28", class: "avatar" }));
  box.append(el("span", { class: "who" }, user.username || user.name || "Signed in"));
  const out = el("button", { class: "button small", type: "button" }, "Sign out");
  out.addEventListener("click", () => saveSession(null));
  box.append(out);
}

function showError(id, message) {
  const p = $(id);
  p.textContent = message || "";
  p.hidden = !message;
}

function mcpSnippet(url) {
  return [
    "# Claude Code",
    `claude mcp add --transport http tiled-map-builder ${url} \\`,
    '  --header "Authorization: Bearer hf_YOUR_TOKEN"',
    "",
    "# Clients configured with JSON (Cursor, VS Code, ...)",
    JSON.stringify({ mcpServers: { "tiled-map-builder": { url, headers: { Authorization: "Bearer hf_YOUR_TOKEN" } } } }, null, 2),
  ].join("\n");
}

async function init() {
  for (const [label, text] of EXAMPLES) {
    const chip = el("button", { type: "button", class: "chip" }, label);
    chip.addEventListener("click", () => {
      $("description").value = text;
      $("description").focus();
    });
    $("examples").append(chip);
  }
  renderAccount();

  try {
    config = await fetch("/api/config").then((r) => r.json());
  } catch {
    showError("form-error", "Could not load the server configuration. Reload the page.");
    return;
  }
  for (const t of config.themes) {
    const option = new Option(`${t.name} (${t.key})${t.sprites === "all" ? "" : ", no sprites yet: grey placeholders"}`, t.key);
    option.title = t.description;
    $("theme").add(option);
  }
  for (const m of config.models) $("model").add(new Option(m.label, m.id));
  $("model").add(new Option("Other model...", "__custom"));
  $("model").value = config.defaultModel;
  $("model").addEventListener("change", () => {
    $("model-custom").hidden = $("model").value !== "__custom";
  });
  $("description").maxLength = config.maxDescription;
  $("mcp-snippet").textContent = mcpSnippet(config.mcpUrl);
  $("version").textContent = config.version;

  $("login").hidden = !config.oauth;
  if (config.oauth && inIframe) {
    $("login").target = "_blank";
    $("login").rel = "noopener";
    $("iframe-note").hidden = false;
  }
  if (!config.oauth) $("token-box").open = true;
}

$("token-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const token = $("token-input").value.trim();
  showError("token-error", "");
  if (!token) return;
  const res = await fetch("/api/whoami", { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
  if (!res || !res.ok) {
    const j = res ? await res.json().catch(() => ({})) : {};
    showError("token-error", j.error || "Could not check the token.");
    return;
  }
  const user = await res.json();
  $("token-input").value = "";
  saveSession({ token, user, via: "token" });
});

function argsPreview(args) {
  const text = JSON.stringify(args ?? {});
  return text.length > 140 ? `${text.slice(0, 140)}...` : text;
}

function addStep(className, title, detail) {
  const li = el("li", { class: className });
  li.append(el("span", { class: "step-title" }, title));
  if (detail) li.append(el("span", { class: "step-detail" }, detail));
  $("steps").append(li);
  li.scrollIntoView({ block: "nearest" });
}

function showResult(e) {
  $("result").hidden = false;
  $("result-title").textContent = `${e.map.name} (${e.map.theme}, ${e.map.width}x${e.map.height})`;
  $("dl-zip").href = e.zipUrl;
  $("dl-tmj").href = e.tmjUrl;
  $("dl-note").textContent = `Download links last one hour (until ${new Date(e.expiresAt).toLocaleTimeString()}). The .zip holds the .tmj and its sprites; open the .tmj in Tiled.`;
  $("preview").src = e.previewPng;
  $("warnings").replaceChildren(...e.warnings.map((w) => el("li", {}, w)));
  $("report").textContent = e.report;
  const u = e.usage;
  $("usage").textContent = `${e.model}: ${u.modelCalls} model calls, ${u.toolCalls} tool calls, ${u.promptTokens.toLocaleString()} input and ${u.completionTokens.toLocaleString()} output tokens billed to your account.`;
  $("result").scrollIntoView({ behavior: "smooth", block: "start" });
}

function handleEvent(e) {
  switch (e.type) {
    case "status":
      $("status").textContent = e.message;
      break;
    case "note":
      addStep("note", e.text);
      break;
    case "tool":
      addStep(e.ok ? "ok" : "fail", `${e.name} ${argsPreview(e.args)}`, e.ok ? "" : e.result);
      $("status").textContent = `Working... ${$("steps").children.length} steps`;
      break;
    case "done":
      $("status").textContent = "Done.";
      showResult(e);
      break;
    case "error":
      $("status").textContent = "Stopped.";
      showError("form-error", e.message);
      if (/rejected your token/.test(e.message)) saveSession(null);
      break;
    default:
      break;
  }
}

function setRunning(running) {
  $("run").disabled = running;
  $("run").textContent = running ? "Building..." : "Build the map";
  $("stop").hidden = !running;
}

$("stop").addEventListener("click", () => controller?.abort());

$("gen-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  showError("form-error", "");
  session = loadSession() || session;
  if (!session) {
    showError("form-error", "Sign in with Hugging Face (or use an access token) first: the AI model runs on your account.");
    $("signin").scrollIntoView({ behavior: "smooth" });
    return;
  }
  const model = $("model").value === "__custom" ? $("model-custom").value.trim() : $("model").value;
  const body = {
    description: $("description").value.trim(),
    theme: $("theme").value || undefined,
    model,
    allowPaidSprites: $("paid").checked,
  };
  if (!body.description) {
    showError("form-error", "Describe the map first.");
    return;
  }

  $("progress").hidden = false;
  $("result").hidden = true;
  $("steps").replaceChildren();
  $("status").textContent = "Starting...";
  setRunning(true);
  controller = new AbortController();
  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      if (res.status === 401) saveSession(null);
      $("status").textContent = "Not started.";
      showError("form-error", j.error || `The server answered ${res.status}.`);
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let i;
      while ((i = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, i).trim();
        buffer = buffer.slice(i + 1);
        if (line) handleEvent(JSON.parse(line));
      }
    }
  } catch (err) {
    if (err.name === "AbortError") {
      $("status").textContent = "Stopped.";
    } else {
      showError("form-error", `The connection was lost: ${err.message}`);
    }
  } finally {
    setRunning(false);
    controller = null;
  }
});

init();
