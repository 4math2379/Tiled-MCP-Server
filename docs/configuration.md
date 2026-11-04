# Configuration

Map building needs **no configuration**: clone, build, connect a client. Everything below is
optional.

## Where settings come from

The server reads environment variables. You can set them in two places:

1. The `env` block of your MCP client configuration (see [client-setup.md](client-setup.md)).
2. A `.env` file. At startup the server loads `tiled-mcp/.env`, or the file named by
   `TILED_ENV_FILE`. Start from the template:

   ```bash
   cp tiled-mcp/.env.example tiled-mcp/.env
   ```

A variable that is already set in the environment always wins over the `.env` file.
Relative paths in variables are resolved against the repository root.

## Variables

| Variable | Default | Used by | Purpose |
|---|---|---|---|
| `TILED_MAPS_DIR` | `<repo>/maps` | `save_to_disk` | Folder for relative output paths |
| `TILED_ASSETS_DIR` | `<repo>/assets` | sprites, `list_themes`, `save_to_disk` | Sprite root holding `<theme_lowercase>/<role>.png` |
| `TILED_OBJECT_COORDS` | `tiled` | object and spawn placement | `tiled` writes Tiled's native isometric object positions; `screen` writes the legacy screen-space encoding (see [map-format.md](map-format.md#object-coordinates)) |
| `TILED_SKILL_FILE` | `<repo>/skills/map-builder/SKILL.md` | `map_builder` prompt | Skill text served by the prompt |
| `TILED_ENV_FILE` | `<repo>/tiled-mcp/.env` | startup | Alternative `.env` file to load |
| `HUGGINGFACE_API_KEY` or `HF_TOKEN` | none | sprite generation | Hugging Face token. **Paid usage**, see [sprite-generation.md](sprite-generation.md) |
| `TILED_HF_PROVIDER` | `replicate` | sprite generation | Hugging Face Inference Provider serving FLUX.1-dev |

`NVIDIA_API_KEY` is **not** read by this server. It belongs to the agent that drives it, for
example OpenCode running Nemotron (see [nemotron.md](nemotron.md)).

## Hosted mode

`npm run start:web` (`node tiled-mcp/dist/http.js`, the Docker image, the Hugging Face Space)
serves the web page and the MCP tools over HTTP. See [hugging-face.md](hugging-face.md). In this
mode paid calls only use the token each caller sends, so `HF_TOKEN` and `HUGGINGFACE_API_KEY`
are ignored.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `7860` | HTTP port |
| `HOST` | `127.0.0.1` (`0.0.0.0` in Docker) | Interface to listen on |
| `PUBLIC_URL` | from `SPACE_HOST` or the request | Public base URL used in download links, e.g. `https://maps.example.com` |
| `TILED_AGENT_MODEL` | `openai/gpt-oss-120b` | Default model of the web page's AI agent (any Inference Providers model with tool calling) |
| `TILED_MAX_JOBS` | `4` | Web agent runs allowed at the same time; extra visitors get "busy, try again" |
| `TILED_INFERENCE_URL` | `https://router.huggingface.co/v1` | OpenAI-compatible endpoint the agent calls; the HTTP smoke test points it at a local stand-in |

A Hugging Face Space sets these itself; do not set them by hand:

| Variable | Purpose |
|---|---|
| `SPACE_HOST` | The Space's public host name, used for links and the sign-in redirect |
| `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, `OAUTH_SCOPES`, `OPENID_PROVIDER_URL` | "Sign in with Hugging Face", enabled by `hf_oauth: true` in the Space card |

## Paths on Windows and WSL

Paths can use forward or back slashes. When the server runs on Linux, for example a client
that launches it inside WSL, Windows paths such as `D:/maps/crypt.tmj` are translated to
`/mnt/d/maps/crypt.tmj` automatically.

## Secrets

- `.env` and `.env.local` are git-ignored. Never commit real keys, and never paste them into
  issues or chat transcripts.
- Prefer the client's `env` block or your shell profile for keys on shared machines.
- If a key ever lands in git history, rotate it at the provider; deleting the file is not enough.
