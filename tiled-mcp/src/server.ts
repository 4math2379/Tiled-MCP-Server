// Builds one MCP server instance with every tool and prompt. The stdio entry point (index.ts)
// creates one; the hosted entry point (http.ts) creates one per MCP session and one per web job.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerLifecycleTools } from "./tools/lifecycle.js";
import { registerPaintTools } from "./tools/paint.js";
import { registerObjectTools } from "./tools/objects.js";
import { registerProceduralTools } from "./tools/procedural.js";
import { registerLayoutPresetTools } from "./tools/layout-presets.js";
import { registerExportTools } from "./tools/export.js";
import { registerGenerationTools } from "./tools/generation.js";
import { registerPrompts } from "./prompts.js";

export const SERVER_NAME = "tiled-map-builder";
export const SERVER_VERSION = "0.3.0";

export function createServer(): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  registerLifecycleTools(server);
  registerPaintTools(server);
  registerObjectTools(server);
  registerProceduralTools(server);
  registerLayoutPresetTools(server);
  registerExportTools(server);
  registerGenerationTools(server);
  registerPrompts(server);
  return server;
}
