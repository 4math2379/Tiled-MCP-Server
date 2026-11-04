# Use it on Hugging Face

The project runs as a public Hugging Face Space:
**[huggingface.co/spaces/4math/tiled-map-builder](https://huggingface.co/spaces/4math/tiled-map-builder)**.
The Space is the same code as this repository, built from the [`Dockerfile`](../Dockerfile),
and offers two things on one address:

| | Address | For |
|---|---|---|
| Web page | `https://4math-tiled-map-builder.hf.space/` | Anyone: describe a map, an AI model builds it, preview and download it |
| MCP endpoint | `https://4math-tiled-map-builder.hf.space/mcp` | AI agents (Claude, Cursor, VS Code, ...) that call the 30 map tools themselves |

## Who pays for what

The Space owner pays for nothing a visitor does. Everything that costs money runs on the
**visitor's own Hugging Face account**:

| Action | Cost | Billed to |
|---|---|---|
| Map tools (create, paint, rooms, objects, validate, download) | free | nobody: they run on the Space's free CPU |
| The AI model behind the web page | a few cents per map with the default model | the signed-in visitor, through [Inference Providers](https://huggingface.co/docs/inference-providers) |
| FLUX sprite generation (opt-in) | per image | the visitor, through Inference Providers |

Hugging Face accounts get monthly inference credits (more with PRO), which usually cover a few
maps. The server holds no token of its own: it reads `Authorization: Bearer <token>` from each
request and uses that token for that request only. It never reads `HF_TOKEN` from its environment
in hosted mode, writes nothing to disk, and forgets a visitor's maps when their session ends.

## The web page

1. Open the Space and click **Sign in with Hugging Face**. Inside the huggingface.co page the
   sign-in opens the app in a new tab; carry on there. The Space asks for one permission,
   *make calls to Inference Providers on your behalf*.
   Instead of signing in you can paste an access token created at
   [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) with the permission
   "Make calls to Inference Providers". Either way the token stays in that browser tab
   (`sessionStorage`) and is sent only with your own requests.
2. Describe the map in any language. Optionally pick a theme and a model.
3. Click **Build the map**. The page streams each tool call the model makes. A map usually takes
   20 to 40 tool calls and 30 to 90 seconds.
4. Download the **.zip**: it holds the `.tmj` and every sprite it uses, laid out so the `.tmj`
   opens directly in [Tiled](https://www.mapeditor.org). Links last one hour.

The default model is `openai/gpt-oss-120b`, which is cheap and good at tool calling. The page
offers a few other open models with tool calling, and **Other model...** takes any model id
served by Inference Providers with tool support (append `:provider` to force a provider).
Themes without bundled sprites still work; the preview and Tiled show grey placeholder tiles.

## Connect an AI agent to the MCP endpoint

Send your own token in the `Authorization` header. The map tools are free; only
`generate_tile_sprite` and `generate_theme_sprite_set` spend money, on that token.

Claude Code:

```bash
claude mcp add --transport http tiled-map-builder https://4math-tiled-map-builder.hf.space/mcp \
  --header "Authorization: Bearer hf_YOUR_TOKEN"
```

Clients configured with JSON (Cursor, VS Code, Windsurf, ...):

```json
{
  "mcpServers": {
    "tiled-map-builder": {
      "url": "https://4math-tiled-map-builder.hf.space/mcp",
      "headers": { "Authorization": "Bearer hf_YOUR_TOKEN" }
    }
  }
}
```

Differences from the local server:

- `save_to_disk` cannot write on your machine. It returns `zipUrl` (the `.tmj` plus its sprites)
  and `tmjUrl`, valid for one hour.
- Generated sprites stay with your MCP session: they are returned as images and included in
  your downloads. `outputDir` is refused.
- Each MCP session has its own maps (at most 20) and is closed after 30 minutes without
  requests. Other sessions cannot see them.
- The map tools work without a token; the header is only needed for sprite generation.

## Run your own copy

- **Duplicate the Space**: on the Space page, open the menu and choose *Duplicate this Space*.
  Your copy runs under your account with the same sign-in flow.
- **Docker** anywhere:

  ```bash
  docker build -t tiled-map-builder .
  docker run -p 7860:7860 tiled-map-builder
  ```

  Then open `http://localhost:7860`. Without the Space sign-in, the page asks for an access
  token.
- **Node** from a clone: `npm install && npm run build && npm run start:web`, then open
  `http://127.0.0.1:7860`.

Settings for the hosted mode (`PORT`, `HOST`, `TILED_AGENT_MODEL`, `TILED_MAX_JOBS`, ...) are in
[configuration.md](configuration.md#hosted-mode).

## Update the Space

The Space repository is a copy of this one: same files, plus the Space card at the top of its
`README.md` (from [`huggingface/space-card.md`](../huggingface/space-card.md)). After a change
lands on `main`:

```bash
pip install -U huggingface_hub   # provides the hf command
hf auth login                    # a token with write access to the Space
huggingface/sync-space.sh        # or: huggingface/sync-space.sh OWNER/SPACE
```

The script uploads the current commit, removes files that no longer exist, and the Space
rebuilds by itself (a few minutes). Anyone can clone the Space's code with
`git clone https://huggingface.co/spaces/4math/tiled-map-builder`.

## Test it without spending anything

`npm run smoke:http` starts the hosted server against a scripted stand-in for the AI model and
checks the web routes, MCP sessions, downloads, session isolation, and that every model call
uses the caller's token. It is free and offline.
