import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readFile } from "node:fs/promises";
import { skillFile } from "./paths.js";

// Serves the map-builder skill (skills/map-builder/SKILL.md) as an MCP prompt, so clients
// without Agent Skills support can still load the full workflow with one prompt call.
export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    "map_builder",
    {
      title: "Build an isometric Tiled map (map-builder skill)",
      description:
        "Loads the map-builder skill and applies it to your description of the map: theme, size, encounters, traps, output.",
      argsSchema: {
        description: z
          .string()
          .describe("Free-form description, e.g. 'crypt 28x18 under a chapel, two skeletons, a locked chest DC 15'"),
      },
    },
    async ({ description }) => {
      const file = skillFile();
      let skill: string;
      try {
        skill = await readFile(file, "utf8");
      } catch {
        throw new Error(`Skill file not found at ${file}. Set TILED_SKILL_FILE or restore skills/map-builder/SKILL.md.`);
      }
      const body = skill.replace(/^---[\s\S]*?---\s*/, "");
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `Follow this skill step by step using the tiled-map-builder MCP tools.\n\n${body}\n\n---\n\nMap request: ${description}`,
            },
          },
        ],
      };
    },
  );
}
