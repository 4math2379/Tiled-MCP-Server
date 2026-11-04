#!/usr/bin/env node
// Tiled Map Builder MCP server, stdio transport.
// Exposes tools to compose isometric Tiled maps in memory, validate them, save .tmj files
// and optionally generate tile sprites (paid).
// stdout carries the MCP protocol: log to stderr only.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadEnvFile } from "./env.js";
import { registerLifecycleTools } from "./tools/lifecycle.js";
import { registerPaintTools } from "./tools/paint.js";
import { registerObjectTools } from "./tools/objects.js";
import { registerProceduralTools } from "./tools/procedural.js";
import { registerLayoutPresetTools } from "./tools/layout-presets.js";
import { registerExportTools } from "./tools/export.js";
import { registerGenerationTools } from "./tools/generation.js";
import { registerPrompts } from "./prompts.js";

export const SERVER_NAME = "tiled-map-builder";
export const SERVER_VERSION = "0.2.0";

loadEnvFile();

const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

registerLifecycleTools(server);
registerPaintTools(server);
registerObjectTools(server);
registerProceduralTools(server);
registerLayoutPresetTools(server);
registerExportTools(server);
registerGenerationTools(server);
registerPrompts(server);

await server.connect(new StdioServerTransport());
