# Connect an MCP client

The server speaks MCP over **stdio**: the client starts `node tiled-mcp/dist/index.js` and
talks to it through stdin and stdout. Build it once first:

```bash
npm install
npm run build
```

Every example below uses the name **`tiled-map-builder`** and a placeholder path. Replace
`/absolute/path/to/Tiled-MCP-Server` with the folder you cloned. On Windows, write paths with
forward slashes (`C:/Users/me/Tiled-MCP-Server/...`) or doubled backslashes in JSON.

Optional settings go in an `env` block or in `tiled-mcp/.env`; see
[configuration.md](configuration.md). Restart the client after changing its configuration.

> **No install?** The same tools run as a remote MCP server on Hugging Face. Give your client
> the URL `https://4math-tiled-map-builder.hf.space/mcp` and the header
> `Authorization: Bearer hf_YOUR_TOKEN` instead of a command; see
> [hugging-face.md](hugging-face.md#connect-an-ai-agent-to-the-mcp-endpoint).

## Claude Code

From the repository folder:

```bash
claude mcp add tiled-map-builder -- node "$(pwd)/tiled-mcp/dist/index.js"
```

Add `--scope project` to write a shareable `.mcp.json` in the current project, or
`--scope user` to make it available everywhere. The equivalent `.mcp.json`:

```json
{
  "mcpServers": {
    "tiled-map-builder": {
      "command": "node",
      "args": ["/absolute/path/to/Tiled-MCP-Server/tiled-mcp/dist/index.js"]
    }
  }
}
```

Install the skill so `/map-builder` is available:

```bash
mkdir -p ~/.claude/skills
cp -r skills/map-builder ~/.claude/skills/
```

The tools appear as `mcp__tiled-map-builder__<tool>`. Check the connection with `/mcp`.

## Claude Desktop

Edit `claude_desktop_config.json` (Settings, Developer, Edit Config):

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "tiled-map-builder": {
      "command": "node",
      "args": ["/absolute/path/to/Tiled-MCP-Server/tiled-mcp/dist/index.js"]
    }
  }
}
```

Use the `map_builder` prompt from the attachment menu to load the workflow.

## Cursor

`~/.cursor/mcp.json` (all projects) or `.cursor/mcp.json` (one project):

```json
{
  "mcpServers": {
    "tiled-map-builder": {
      "command": "node",
      "args": ["/absolute/path/to/Tiled-MCP-Server/tiled-mcp/dist/index.js"]
    }
  }
}
```

## VS Code (GitHub Copilot agent mode)

`.vscode/mcp.json` in your workspace:

```json
{
  "servers": {
    "tiled-map-builder": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/Tiled-MCP-Server/tiled-mcp/dist/index.js"]
    }
  }
}
```

## Windsurf

`~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "tiled-map-builder": {
      "command": "node",
      "args": ["/absolute/path/to/Tiled-MCP-Server/tiled-mcp/dist/index.js"]
    }
  }
}
```

## Zed

In Zed's `settings.json`:

```json
{
  "context_servers": {
    "tiled-map-builder": {
      "command": "node",
      "args": ["/absolute/path/to/Tiled-MCP-Server/tiled-mcp/dist/index.js"],
      "env": {}
    }
  }
}
```

### Windows with the server inside WSL

If Node is installed in WSL rather than on Windows, let `wsl.exe` start it. Environment
variables can be passed through `env`:

```json
{
  "context_servers": {
    "tiled-map-builder": {
      "command": "wsl.exe",
      "args": ["-e", "env", "TILED_MAPS_DIR=D:/maps", "node", "/mnt/d/Tiled-MCP-Server/tiled-mcp/dist/index.js"]
    }
  }
}
```

Windows-style paths such as `D:/maps` are translated to `/mnt/d/maps` by the server.

## OpenCode

In `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "tiled-map-builder": {
      "type": "local",
      "command": ["node", "/absolute/path/to/Tiled-MCP-Server/tiled-mcp/dist/index.js"],
      "enabled": true
    }
  }
}
```

To run it with NVIDIA Nemotron, see [nemotron.md](nemotron.md).

## Any other client

Any MCP client that can start a stdio server works. It needs:

| Field | Value |
|---|---|
| command | `node` |
| args | `<repo>/tiled-mcp/dist/index.js` |
| env | optional, see [configuration.md](configuration.md) |

## Test without an agent: MCP Inspector

```bash
npm run inspect
```

This opens the official [MCP Inspector](https://github.com/modelcontextprotocol/inspector) in
your browser, connected to the server. You can list the tools, call `create_map`, then
`generate_crypt_layout`, then `save_to_disk`, and open the file in Tiled.

For an automated check, `npm run smoke` runs 39 end-to-end checks without any network access.
