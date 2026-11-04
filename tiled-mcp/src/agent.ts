// "Describe a map" agent behind the hosted web page. An open model on Hugging Face Inference
// Providers drives this server's own MCP tools (through an in-process MCP client), guided by the
// map-builder skill, until the map is built and valid. Every model call is made with the
// visitor's own token, so it is billed to their Hugging Face account, never to the host.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { readFile } from "node:fs/promises";
import { describeMap, listMaps, serializeMap, type MapSummary } from "./builder.js";
import { newWorkspace, runInScope } from "./context.js";
import { publishMap, slugify } from "./downloads.js";
import { skillFile } from "./paths.js";
import { renderMapPreview } from "./render.js";
import { createServer, SERVER_VERSION } from "./server.js";
import { readSprite } from "./sprites.js";
import { ASSET_PREFIX } from "./tmj.js";

export const DEFAULT_MODEL = process.env.TILED_AGENT_MODEL || "openai/gpt-oss-120b";

/** Open models served with tool calling on Hugging Face Inference Providers (checked 2026-11). */
export const SUGGESTED_MODELS = [
  { id: "openai/gpt-oss-120b", label: "gpt-oss-120b: fast and cheap" },
  { id: "deepseek-ai/DeepSeek-V4.1-Flash", label: "DeepSeek V4.1 Flash" },
  { id: "zai-org/GLM-5.3-Flash", label: "GLM 5.3 Flash" },
  { id: "Qwen/Qwen3.8-27B", label: "Qwen 3.8 27B" },
  { id: "moonshotai/Kimi-K2.6", label: "Kimi K2.6: stronger, pricier" },
];

/** A model id as accepted by the router, with an optional ":provider" or ":policy" suffix. */
export const MODEL_ID = /^[\w.-]+\/[\w.-]+(:[\w.-]+)?$/;

const MAX_MODEL_CALLS = 40;
const MAX_TOOL_CALLS = 160;
const TOOL_RESULT_CHARS = 12_000;

/** Tools the web agent never sees: the page handles the output, and one job builds one map. */
const HIDDEN_TOOLS = new Set(["save_to_disk", "export_json", "list_maps", "discard_map", "generate_theme_sprite_set"]);
/** Offered only when the visitor allows paid sprite generation. */
const PAID_TOOLS = new Set(["generate_tile_sprite", "preview_sprite_prompt"]);

/** A failure whose message is meant for the visitor. */
export class AgentError extends Error {}

export interface AgentRequest {
  description: string;
  theme?: string;
  model?: string;
  allowPaidSprites?: boolean;
}

export type AgentEvent =
  | { type: "status"; message: string }
  | { type: "note"; text: string }
  | { type: "tool"; name: string; args: unknown; ok: boolean; result: string }
  | {
      type: "done";
      map: MapSummary;
      report: string;
      warnings: string[];
      previewPng: string;
      zipUrl: string;
      tmjUrl: string;
      expiresAt: string;
      model: string;
      usage: { modelCalls: number; toolCalls: number; promptTokens: number; completionTokens: number };
    };

export interface AgentContext {
  token: string;
  baseUrl: string;
  signal: AbortSignal;
  emit: (event: AgentEvent) => void;
}

interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

interface ChatReply {
  choices?: Array<{ message?: { content?: string | null; tool_calls?: Array<Partial<ToolCall>> } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

function inferenceBase(): string {
  return (process.env.TILED_INFERENCE_URL || "https://router.huggingface.co/v1").replace(/\/+$/, "");
}

/** Build one map from a description in a fresh workspace, streaming progress through ctx.emit. */
export async function runMapAgent(req: AgentRequest, ctx: AgentContext): Promise<void> {
  await runInScope({ workspace: newWorkspace(), hfToken: ctx.token, baseUrl: ctx.baseUrl }, () => agentLoop(req, ctx));
}

async function agentLoop(req: AgentRequest, ctx: AgentContext): Promise<void> {
  const model = req.model || DEFAULT_MODEL;
  const server = createServer();
  const client = new Client({ name: "tiled-web-agent", version: SERVER_VERSION });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  await client.connect(clientSide);

  try {
    const { tools } = await client.listTools();
    const offered = tools.filter((t) => !HIDDEN_TOOLS.has(t.name) && (req.allowPaidSprites || !PAID_TOOLS.has(t.name)));
    const offeredNames = new Set(offered.map((t) => t.name));
    const toolDefs = offered.map((t) => {
      const { $schema: _ignored, ...parameters } = t.inputSchema as Record<string, unknown>;
      return { type: "function", function: { name: t.name, description: t.description ?? t.title ?? t.name, parameters } };
    });

    let skill: string;
    try {
      skill = (await readFile(skillFile(), "utf8")).replace(/^---[\s\S]*?---\s*/, "");
    } catch {
      skill = "";
    }
    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt(skill, !!req.allowPaidSprites) },
      { role: "user", content: `Map request: ${req.description}${req.theme ? `\nUse the theme ${req.theme}.` : ""}` },
    ];

    const usage = { modelCalls: 0, toolCalls: 0, promptTokens: 0, completionTokens: 0 };
    let report = "";
    ctx.emit({ type: "status", message: `${model} is planning the map...` });

    while (usage.modelCalls < MAX_MODEL_CALLS) {
      const reply = await chat(
        ctx,
        { model, messages, tools: toolDefs, tool_choice: "auto", temperature: 0.2, max_tokens: 4096 },
      );
      usage.modelCalls++;
      usage.promptTokens += reply.usage?.prompt_tokens ?? 0;
      usage.completionTokens += reply.usage?.completion_tokens ?? 0;

      const msg = reply.choices?.[0]?.message;
      if (!msg) throw new AgentError(`${model} returned an empty answer. Try again or pick another model.`);
      const calls: ToolCall[] = (msg.tool_calls ?? []).map((c, i) => ({
        id: c.id || `call_${usage.modelCalls}_${i}`,
        type: "function",
        function: { name: c.function?.name ?? "", arguments: c.function?.arguments ?? "{}" },
      }));
      const content = (msg.content ?? "").trim();
      if (!calls.length) {
        report = content;
        break;
      }
      if (content) ctx.emit({ type: "note", text: content });
      messages.push({ role: "assistant", content, tool_calls: calls });

      for (const call of calls) {
        usage.toolCalls++;
        const { name } = call.function;
        let args: unknown = {};
        let ok = false;
        let output: string;
        if (usage.toolCalls > MAX_TOOL_CALLS) {
          output = "Tool call limit reached: stop calling tools and write the final report now.";
        } else if (!offeredNames.has(name)) {
          output = `The tool '${name}' is not available here.`;
        } else {
          try {
            args = call.function.arguments.trim() ? JSON.parse(call.function.arguments) : {};
            const result = await client.callTool({ name, arguments: args as Record<string, unknown> });
            ok = !result.isError;
            output = resultText(result.content);
          } catch (err) {
            output = err instanceof SyntaxError
              ? `The arguments are not valid JSON (${err.message}). Send a JSON object.`
              : err instanceof Error ? err.message : String(err);
          }
        }
        ctx.emit({ type: "tool", name, args, ok, result: output.length > 400 ? `${output.slice(0, 400)}...` : output });
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: output.length > TOOL_RESULT_CHARS ? `${output.slice(0, TOOL_RESULT_CHARS)}\n[truncated]` : output,
        });
      }
    }

    const built = listMaps().sort((a, b) => b.createdAt - a.createdAt)[0];
    if (!built) {
      throw new AgentError(
        `${model} stopped without creating a map. Try again with more detail, or pick another model.${report ? ` Its last answer: ${report.slice(0, 300)}` : ""}`,
      );
    }
    ctx.emit({ type: "status", message: "Rendering the preview and packing the download..." });
    const validation = JSON.parse(
      resultText((await client.callTool({ name: "validate_map", arguments: { mapId: built.mapId } })).content),
    ) as { warnings?: string[] };
    const preview = await renderMapPreview(
      serializeMap(built.mapId),
      (image) => (image.startsWith(ASSET_PREFIX) ? readSprite(image.slice(ASSET_PREFIX.length)) : undefined),
      { maxWidth: 1400 },
    );
    const links = publishMap(built.mapId, `${slugify(built.name)}.tmj`);
    ctx.emit({
      type: "done",
      map: describeMap(built.mapId),
      report: report || "The map is ready.",
      warnings: validation.warnings ?? [],
      previewPng: `data:image/png;base64,${preview.toString("base64")}`,
      zipUrl: links.zipUrl,
      tmjUrl: links.tmjUrl,
      expiresAt: links.expiresAt,
      model,
      usage,
    });
  } finally {
    await client.close().catch(() => {});
    await server.close().catch(() => {});
  }
}

function systemPrompt(skill: string, allowPaid: boolean): string {
  return [
    "You build isometric Tiled maps with the tiled-map-builder tools for a person using a web page.",
    "",
    "This session differs from the skill below in these ways:",
    "- The person cannot answer while you work. Never ask questions or wait for confirmation: make sensible choices and build the map right away. Sketch the layout for yourself if it helps, but do not ask for approval.",
    "- Build exactly one map with create_map. When a call fails, read the error, fix the arguments and carry on.",
    "- Finish with validate_map and fix every warning; the map needs at least one player spawn.",
    "- Do not save or export the map: the web page offers the download.",
    '- Prefer themes whose sprites.status is "all" in list_themes. Themes without sprites still work but show grey placeholder tiles in the preview and in Tiled: use one only when the person asks for it or nothing else fits.',
    allowPaid
      ? "- The person allowed paid sprite generation (billed to them). Use generate_tile_sprite only for at most 2 contextual variants that clearly fit the description, then bind them with override_tile_image."
      : "- Sprite generation is not available: use the sprites every theme already ships.",
    `- You have at most ${MAX_TOOL_CALLS} tool calls. Prefer layout presets, generate_room and generate_corridor over painting cells one by one.`,
    "- Write the map name, creature names and your final report in the language of the map request. Theme display names are often French: do not let them change your language.",
    "- When the map is valid, reply with a short report: name, theme, size, layout, spawns, objects, validation result. Leave out the mapId and file paths.",
    "",
    "Skill:",
    "",
    skill,
  ].join("\n");
}

function resultText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content
    .map((c: { type?: string; text?: string }) => (c.type === "text" ? (c.text ?? "") : `[${c.type ?? "content"}]`))
    .join("\n");
}

async function chat(ctx: AgentContext, body: Record<string, unknown>): Promise<ChatReply> {
  const delays = [2000, 6000];
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${inferenceBase()}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${ctx.token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctx.signal,
      });
    } catch (err) {
      if (ctx.signal.aborted) throw new AgentError("The job was stopped.");
      throw new AgentError(`Could not reach Hugging Face Inference Providers: ${err instanceof Error ? err.message : String(err)}`);
    }
    const text = await res.text();
    if (res.ok) {
      try {
        return JSON.parse(text) as ChatReply;
      } catch {
        throw new AgentError("The inference service sent an unreadable answer. Try again.");
      }
    }
    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && attempt < delays.length && !ctx.signal.aborted) {
      await new Promise((r) => setTimeout(r, delays[attempt]));
      continue;
    }
    throw new AgentError(explainHttpError(res.status, text, String(body.model)));
  }
}

function explainHttpError(status: number, text: string, model: string): string {
  let detail = text;
  try {
    const j = JSON.parse(text) as { error?: string | { message?: string }; message?: string };
    detail = (typeof j.error === "string" ? j.error : j.error?.message) ?? j.message ?? text;
  } catch {
    // keep the raw text
  }
  detail = String(detail).slice(0, 400);
  switch (status) {
    case 401:
      return "Hugging Face rejected your token. Sign in again, or use an access token that can make calls to Inference Providers.";
    case 402:
      return "Your Hugging Face account has no inference credits left. Add credits or a payment method in your Hugging Face billing settings, then try again.";
    case 403:
      return `Your token may not call Inference Providers (${detail}). Sign in again and accept the inference permission, or create a token with the "Make calls to Inference Providers" permission.`;
    case 429:
      return "Hugging Face is rate limiting your requests. Wait a minute and try again.";
    case 400:
    case 404:
    case 422:
      return `${model} could not run this request: ${detail}. Try another model.`;
    default:
      return `The inference service answered ${status}: ${detail}`;
  }
}
