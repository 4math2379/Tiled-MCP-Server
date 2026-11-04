#!/usr/bin/env node
// Tiled Map Builder MCP server, stdio transport.
// Exposes tools to compose isometric Tiled maps in memory, validate them, save .tmj files
// and optionally generate tile sprites (paid). For the hosted web and HTTP mode see http.ts.
// stdout carries the MCP protocol: log to stderr only.

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadEnvFile } from "./env.js";
import { createServer } from "./server.js";

export { SERVER_NAME, SERVER_VERSION } from "./server.js";

loadEnvFile();

await createServer().connect(new StdioServerTransport());
