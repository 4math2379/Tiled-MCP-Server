# Using the server with NVIDIA Nemotron

The MCP server does not talk to any model itself. An **agent** (a coding assistant or chat
client that supports MCP and tool calling) calls the map tools, and that agent can run on any
model. This server was developed alongside agents running **NVIDIA Nemotron** on the NVIDIA
API, which has a free tier.

So the NVIDIA key goes into your agent's configuration, not into this server.

## 1. Get an NVIDIA API key

1. Sign in at https://build.nvidia.com.
2. Open a Nemotron model page, for example **Nemotron 3.5 Super-VL**, and choose **Get API Key**.
   Keys start with `nvapi-`.
3. Export it in the shell that starts your agent:

   ```bash
   export NVIDIA_API_KEY="nvapi-..."        # macOS / Linux
   ```

   ```powershell
   $env:NVIDIA_API_KEY = "nvapi-..."         # Windows PowerShell
   ```

The NVIDIA API exposes an OpenAI-compatible endpoint at `https://integrate.api.nvidia.com/v1`.
The free tier is rate limited (about 40 requests per minute at the time of writing), and one
map typically takes 10 to 40 tool calls.

## 2. Example: OpenCode

[OpenCode](https://opencode.ai) can use any OpenAI-compatible provider and local MCP servers.
In `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "nvidia-build": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "NVIDIA API",
      "options": {
        "baseURL": "https://integrate.api.nvidia.com/v1",
        "apiKey": "{env:NVIDIA_API_KEY}"
      },
      "models": {
        "nvidia/nemotron-3.5-super-vl-120b-a12b": { "name": "Nemotron 3.5 Super-VL" }
      }
    }
  },
  "model": "nvidia-build/nvidia/nemotron-3.5-super-vl-120b-a12b",
  "mcp": {
    "tiled-map-builder": {
      "type": "local",
      "command": ["node", "/absolute/path/to/Tiled-MCP-Server/tiled-mcp/dist/index.js"],
      "enabled": true
    }
  }
}
```

Check the model catalog at https://build.nvidia.com for current model ids.

## 3. Give the agent the workflow

Nemotron follows the map-builder workflow best when it has it in context:

- OpenCode and other clients with prompt support: use the server's **`map_builder`** prompt.
- Otherwise, add `skills/map-builder/SKILL.md` to the agent's instructions (OpenCode:
  `"instructions": ["/absolute/path/to/skills/map-builder/SKILL.md"]`).

## Tips for smaller or faster models

- Ask for a preset first (`generate_crypt_layout` on a 28x18 map), then refine.
- Ask the agent to call `get_tile_info(layer="walls")` before placing objects; the tool errors
  explain any rejected placement, and the agent can retry with a neighbouring cell.
- Always finish with `validate_map`.
