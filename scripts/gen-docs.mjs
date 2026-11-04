// Regenerate docs/tools.md and docs/themes.md from the running server (tools/list,
// prompts/list, list_themes), so the references always match the code.
// Run after `npm run build`:
//   npm run docs        (or: node scripts/gen-docs.mjs)

import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const serverPath = fileURLToPath(new URL("../tiled-mcp/dist/index.js", import.meta.url));
const outPath = fileURLToPath(new URL("../docs/tools.md", import.meta.url));
const themesPath = fileURLToPath(new URL("../docs/themes.md", import.meta.url));

// English one-line summaries; display names and descriptions come from the server.
const SUMMARY = {
  CRYPT: "Burial vaults under chapels, cracked flagstones, poison vents from broken sarcophagi.",
  CASTLE: "Black marble and basalt halls, broken stained glass, throne room, grand stairs.",
  WEREWOLF_DEN: "Damp caves dug into the forest, bone-strewn earth floor, claw-marked rock, blood pools.",
  TAVERN_BLOOD_PRINCE: "Dark floorboards, heavy beams, oak tables, crackling hearth. No active traps.",
  VILLAGE: "Rain-soaked cobblestones, shuttered half-timbered houses, abandoned stalls, well and gallows.",
  HAUNTED_FOREST: "Stifling undergrowth of black moss, fallen trunks, parasitic mist that slows walkers.",
  MAUSOLEUM: "Grey-veined marble, fallen-angel statues, funeral urns in niches. No hazards.",
  BLOOD_TOMB: "Deep ritual sanctuary, pulsing bleeding runes, central altar.",
  AQUATIC: "Black stagnant water, water lilies, sunken ruins, haunted marsh.",
  GLACIAIRE: "Black ice, figures frozen in the ice, frost, haunted tundra.",
  INONDE: "Drowned city under the waves, hanging kelp, broken bridges, deep currents.",
  VOLCAN: "Lava flows, cooled black rock, flying ash, active caldera.",
  FORET: "Twisted woods, thick moss, exposed roots, misty clearings, quicksand.",
  HIVER: "Powder snow, frozen lakes, frosted branches, trappers' huts.",
  PRINTEMPS: "Flowering meadows, clear streams, budding trees, druid circles.",
  ETE: "Golden grass, ripe wheat, cloudless heat, abandoned granaries.",
  AUTOMNE: "Russet leaves, mushrooms, morning mist, bog mire.",
  DESOLATION: "Cold ash, charred trees, barren ground, post-cataclysm ruins.",
  FUTURISTE: "Chrome, cold neon, holographic panels, dystopian megacity.",
  ELECTRONIQUE: "Circuit boards, optic fibre, silent servers, AI cores.",
};

const GROUPS = [
  ["Map lifecycle", ["list_themes", "create_map", "list_maps", "describe_map", "discard_map"]],
  ["Painting tiles", ["paint_tile", "paint_rect", "paint_wall_border", "erase_tile", "get_tile_info"]],
  ["Rooms and corridors", ["generate_room", "generate_corridor"]],
  ["Layout presets", ["generate_crypt_layout", "generate_castle_floor", "generate_werewolf_den"]],
  ["Objects", ["place_door", "place_chest", "place_stairs_object", "place_trap", "place_lever"]],
  ["Spawns", ["place_spawn_player", "place_spawn_enemy", "place_spawn_npc"]],
  ["Validation and export", ["validate_map", "export_json", "save_to_disk"]],
  ["Sprites (optional, generation is paid)", ["preview_sprite_prompt", "generate_tile_sprite", "generate_theme_sprite_set", "override_tile_image"]],
];

const server = spawn(process.execPath, [serverPath], { stdio: ["pipe", "pipe", "inherit"] });
let buffer = "";
const pending = new Map();
server.stdout.on("data", (chunk) => {
  buffer += chunk;
  let i;
  while ((i = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, i).trim();
    buffer = buffer.slice(i + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    if (msg.id !== undefined && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});
let nextId = 1;
const request = (method, params) =>
  new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    server.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });

await request("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "gen-tool-docs", version: "1" } });
server.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
const { tools } = (await request("tools/list", {})).result;
const { prompts } = (await request("prompts/list", {})).result;
const themes = JSON.parse((await request("tools/call", { name: "list_themes", arguments: {} })).result.content[0].text);
server.kill();

const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");

function typeOf(schema) {
  if (schema.enum) return schema.enum.map((v) => `\`${v}\``).join(", ");
  if (schema.type === "array") {
    const item = schema.items ?? {};
    if (item.type === "object") {
      const fields = Object.entries(item.properties ?? {}).map(([k, v]) => `${k}: ${typeOf(v)}`);
      return `array of { ${fields.join("; ")} }`;
    }
    return `array of ${typeOf(item)}`;
  }
  return schema.type === "integer" ? "integer" : schema.type ?? "any";
}

function constraints(schema) {
  const out = [];
  if (schema.minimum !== undefined && schema.maximum !== undefined) out.push(`${schema.minimum}..${schema.maximum}`);
  else if (schema.minimum !== undefined) out.push(`>= ${schema.minimum}`);
  else if (schema.maximum !== undefined) out.push(`<= ${schema.maximum}`);
  if (schema.minLength !== undefined && schema.maxLength !== undefined) out.push(`${schema.minLength}..${schema.maxLength} chars`);
  else if (schema.minLength !== undefined) out.push(`min ${schema.minLength} chars`);
  if (schema.maxItems !== undefined) out.push(`max ${schema.maxItems} items`);
  if (schema.pattern) out.push(`pattern \`${schema.pattern}\``);
  return out.join(", ");
}

function hints(a = {}) {
  const tags = [];
  if (a.readOnlyHint) tags.push("read-only");
  if (a.destructiveHint) tags.push("destructive");
  if (a.idempotentHint) tags.push("idempotent");
  if (a.openWorldHint) tags.push("network");
  return tags.length ? tags.map((t) => `\`${t}\``).join(" ") : "`writes map`";
}

const byName = new Map(tools.map((t) => [t.name, t]));
const listed = new Set(GROUPS.flatMap(([, names]) => names));
const unlisted = tools.filter((t) => !listed.has(t.name)).map((t) => t.name);
if (unlisted.length) GROUPS.push(["Other", unlisted]);

let md = `# Tool reference

<!-- Generated by scripts/gen-docs.mjs from the server's tools/list. Do not edit by hand. -->

The server exposes **${tools.length} tools** and **${prompts.length} prompt**. Every tool returns a JSON document as text.
Invalid input or an impossible action (unknown \`mapId\`, a cell outside the grid, a chest on a wall)
comes back as a tool error whose message says how to fix the call.

Coordinates are grid cells: \`x\` is the column (0..width-1) and \`y\` the row (0..height-1).
On an isometric map, cell (0,0) is the top corner of the diamond; \`x\` grows toward the lower right
and \`y\` toward the lower left. See [map-format.md](map-format.md) for the layers and properties.

Tags: \`read-only\` never changes anything, \`destructive\` can delete or overwrite, \`idempotent\` is safe
to repeat, \`network\` calls an external service.

## Contents

`;
for (const [group, names] of GROUPS) {
  md += `- **${group}**: ${names.map((n) => `[\`${n}\`](#${n})`).join(", ")}\n`;
}
md += `- **Prompt**: ${prompts.map((p) => `[\`${p.name}\`](#prompt-${p.name})`).join(", ")}\n`;

for (const [group, names] of GROUPS) {
  md += `\n## ${group}\n`;
  for (const name of names) {
    const t = byName.get(name);
    if (!t) continue;
    md += `\n### ${name}\n\n${hints(t.annotations)}\n\n${t.description}\n`;
    const props = Object.entries(t.inputSchema?.properties ?? {});
    const required = new Set(t.inputSchema?.required ?? []);
    if (!props.length) {
      md += `\nNo parameters.\n`;
      continue;
    }
    md += `\n| Parameter | Type | Required | Notes |\n|---|---|---|---|\n`;
    for (const [pname, schema] of props) {
      const notes = [schema.description, constraints(schema)].filter(Boolean).join(". ");
      md += `| \`${pname}\` | ${esc(typeOf(schema))} | ${required.has(pname) ? "yes" : "no"} | ${esc(notes)} |\n`;
    }
  }
}

md += `\n## Prompts\n`;
for (const p of prompts) {
  md += `\n### Prompt: ${p.name}\n\n${p.description}\n\n| Argument | Required | Notes |\n|---|---|---|\n`;
  for (const a of p.arguments ?? []) md += `| \`${a.name}\` | ${a.required ? "yes" : "no"} | ${esc(a.description)} |\n`;
}

writeFileSync(outPath, md.replace(/\n{3,}/g, "\n\n"), "utf8");
console.log(`Wrote ${outPath} (${tools.length} tools, ${prompts.length} prompt(s))`);

// ---------- docs/themes.md ----------
const STATUS = { all: "bundled", partial: "partial", none: "not generated yet" };
const bundled = themes.filter((t) => t.sprites.status === "all").length;
let tmd = `# Themes

<!-- Generated by scripts/gen-docs.mjs from the server's list_themes. Do not edit by hand. -->

A theme is a tile palette: it maps each **role** used by the tools (\`walkable_floor\`, \`wall\`,
\`hazard_primary\`, ...) to one sprite and one tile type. Pass its key to \`create_map\`.
Display names and descriptions are in French, the language the themes were written in.

**${themes.length} themes**, ${bundled} with bundled sprites. Themes without sprites still produce valid
maps; Tiled shows placeholders until the PNGs exist (see [sprite-generation.md](sprite-generation.md)).
Sprites live in \`assets/<theme_lowercase>/<role>.png\`.

| Key | Display name | Setting | Roles | Sprites |
|---|---|---|---|---|
`;
for (const t of themes) {
  tmd += `| \`${t.key}\` | ${esc(t.name)} | ${esc(SUMMARY[t.key] ?? "")} | ${t.roles.length} | ${STATUS[t.sprites.status]} (${t.sprites.present}/${t.sprites.total}) |\n`;
}
tmd += `\n## Roles per theme\n\n| Key | Roles |\n|---|---|\n`;
for (const t of themes) tmd += `| \`${t.key}\` | ${t.roles.map((r) => `\`${r}\``).join(", ")} |\n`;
tmd += `\n## Original descriptions\n`;
for (const t of themes) tmd += `\n**${t.key}** (${t.name}): ${t.description}\n`;
tmd += `
## Adding a theme

1. Create \`tiled-mcp/src/themes/<name>.ts\` exporting a \`Theme\` (copy an existing one). It must
   define at least \`walkable_floor\` and \`wall\`.
2. Register it in \`tiled-mcp/src/themes/index.ts\`.
3. Add its prompt entries to \`ROLE_VISUALS\` and its key to \`ThemeKey\` in
   \`tiled-mcp/src/themes/prompts.ts\` if you want sprite generation.
4. Put sprites in \`assets/<key_lowercase>/<role>.png\` (64x32 floors, 64x64 walls and props),
   or generate them.
5. \`npm run build && npm run docs && npm run smoke\`.
`;
writeFileSync(themesPath, tmd, "utf8");
console.log(`Wrote ${themesPath} (${themes.length} themes)`);
