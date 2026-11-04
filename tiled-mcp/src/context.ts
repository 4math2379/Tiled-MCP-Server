// Per-caller state.
//
// Over stdio one person drives the server, so everything lives in one implicit workspace.
// In hosted mode (src/http.ts) many people share one process: every MCP session and every web
// job gets its own workspace (maps and generated sprites), and every request carries its own
// Hugging Face token. AsyncLocalStorage carries that scope from the HTTP handler down to the
// tool handlers, through the MCP SDK.

import { AsyncLocalStorage } from "node:async_hooks";
import type { BuilderState } from "./builder.js";

export interface Workspace {
  maps: Map<string, BuilderState>;
  /** Sprites generated in this workspace, keyed "<theme_dir>/<file>.png" (hosted mode only). */
  sprites: Map<string, Buffer>;
}

export interface Scope {
  workspace: Workspace;
  /** Hugging Face token sent with the current request; paid calls are billed to its owner. */
  hfToken?: string;
  /** Public base URL of the server, used to build download links, e.g. https://x.hf.space */
  baseUrl?: string;
}

const storage = new AsyncLocalStorage<Scope>();
const LOCAL: Scope = { workspace: newWorkspace() };
let hosted = false;

export function newWorkspace(): Workspace {
  return { maps: new Map(), sprites: new Map() };
}

/** Run `fn` (and everything it awaits) with `scope` as the current scope. */
export function runInScope<T>(scope: Scope, fn: () => T): T {
  return storage.run(scope, fn);
}

export function currentScope(): Scope {
  return storage.getStore() ?? LOCAL;
}

/**
 * Hosted mode: the server is shared over HTTP. Paid tools then only use the caller's token
 * (never HF_TOKEN from the environment), and nothing is written to the server's disk.
 */
export function setHostedMode(on: boolean): void {
  hosted = on;
}

export function isHosted(): boolean {
  return hosted;
}
