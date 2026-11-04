# Contributing

Thanks for helping. Bug reports, new themes, better presets and documentation fixes are all
welcome.

## Development loop

```bash
npm install
npm run build          # compile tiled-mcp/src to tiled-mcp/dist
npm run smoke          # 38 offline end-to-end checks; must stay green
npm run smoke:http     # hosted mode checks; must stay green
npm run docs           # regenerate docs/tools.md and docs/themes.md after changing tools or themes
npm run inspect        # try tools by hand in the MCP Inspector
npm run preview -- maps/<file>.tmj   # look at a map without Tiled
```

Node.js 20.9 or newer is required.

## Guidelines

- **Tool descriptions are documentation for agents.** Write them in English and say what the
  tool needs first (for example "call create_map first"), units, and what happens on failure.
  Add MCP annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`).
- **Fail with a useful message.** Throw an `Error` that tells the caller how to fix the call;
  the SDK returns it as a tool error.
- **Never write to stdout** from the server: stdout carries the MCP protocol. Use stderr.
- **Keep the output Tiled-correct.** Object positions follow
  [docs/map-format.md](docs/map-format.md#object-coordinates); check new output in Tiled or with
  `npm run preview`.
- **No machine-specific paths.** Resolve paths through `tiled-mcp/src/paths.ts`.
- **Paid calls stay opt-in.** Anything that spends money must be explicit and must not repeat
  work that already exists on disk.
- **Do not rename theme keys**: they name the asset folders and appear in existing maps.

## Adding a theme

See [docs/themes.md](docs/themes.md#adding-a-theme).

## Pull requests

1. One topic per pull request.
2. `npm run build && npm run smoke && npm run smoke:http` passes, and `npm run docs` shows no unexpected diff.
3. Update the README or `docs/` when behaviour changes, and add a line to `CHANGELOG.md`.

By contributing you agree that your contribution is licensed under the [MIT license](LICENSE).
