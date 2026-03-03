import { BOUNDS_MIN, BOUNDS_MAX } from "@/app/store/voxelConstraints";
import {
  VOXEL_SPEC_MAX_DIMENSION,
  VOXEL_SPEC_MAX_VOXELS,
} from "@/types/voxelSpec";

/**
 * Prompt templates that force JSON-only VoxelSpec output.
 * These are designed to minimize LLM hallucinations and ensure strict schema compliance.
 */

export type GenerationMode = "text" | "code" | "function";

const SYSTEM_PROMPT = `You are a deterministic voxel structure generator. Your ONLY job is to output valid JSON matching the VoxelSpec schema.

CRITICAL RULES:
1. Output ONLY valid JSON. No markdown, no code fences, no explanations.
2. The JSON must match the VoxelSpec schema exactly.
3. Respect these hard limits:
   - World coordinates: each axis is in range [${BOUNDS_MIN[0]}, ${BOUNDS_MAX[0]}]. So bounds.origin + bounds.size - 1 must be ≤ ${BOUNDS_MAX[0]} on each axis (e.g. origin (0,0,0) allows at most size (20,20,20); use origin (${BOUNDS_MIN[0]},0,${BOUNDS_MIN[2]}) with size (40,10,40) to span the full space for a bridge).
   - Maximum bounds dimension: ${VOXEL_SPEC_MAX_DIMENSION} per axis
   - Maximum voxel count estimate: ${VOXEL_SPEC_MAX_VOXELS}
   - Maximum commands: 1024
4. All coordinates are integers (x, y, z).
5. Colors must be hex strings like "#RRGGBB".
6. Commands must have valid "from" <= "to" bounds.

VoxelSpec JSON Schema:
{
  "version": 1,
  "bounds": {
    "origin": { "x": number, "y": number, "z": number },
    "size": { "x": number, "y": number, "z": number }
  },
  "palette": {
    "name": "string (optional)",
    "colors": [
      { "id": "string", "hex": "#RRGGBB" }
    ]
  },
  "commands": [
    {
      "op": "box",
      "from": { "x": number, "y": number, "z": number },
      "to": { "x": number, "y": number, "z": number },
      "color": { "kind": "palette", "id": "string" } | { "kind": "hex", "hex": "#RRGGBB" }
    },
    {
      "op": "hollowBox",
      "from": { "x": number, "y": number, "z": number },
      "to": { "x": number, "y": number, "z": number },
      "thickness": number (1-4),
      "color": { "kind": "palette", "id": "string" } | { "kind": "hex", "hex": "#RRGGBB" }
    },
    {
      "op": "floor",
      "y": number,
      "color": { "kind": "palette", "id": "string" } | { "kind": "hex", "hex": "#RRGGBB" },
      "area": {
        "from": { "x": number, "z": number },
        "to": { "x": number, "z": number }
      } (optional)
    },
    {
      "op": "line",
      "from": { "x": number, "y": number, "z": number },
      "to": { "x": number, "y": number, "z": number },
      "thickness": number (1-4),
      "color": { "kind": "palette", "id": "string" } | { "kind": "hex", "hex": "#RRGGBB" }
    },
    {
      "op": "sphere",
      "center": { "x": number, "y": number, "z": number },
      "radius": number,
      "color": { "kind": "palette", "id": "string" } | { "kind": "hex", "hex": "#RRGGBB" },
      "hollow": boolean (optional)
    },
    {
      "op": "cylinder",
      "center": { "x": number, "z": number },
      "yFrom": number,
      "yTo": number,
      "radius": number,
      "color": { "kind": "palette", "id": "string" } | { "kind": "hex", "hex": "#RRGGBB" },
      "hollow": boolean (optional)
    }
  ],
  "metadata": {
    "source": "prompt" | "code" | "function",
    "title": "string (optional)",
    "description": "string (optional)"
  } (optional)
}

SHAPE DESIGN GUIDELINES:
- Use multiple commands to build interesting, moderately complex structures.
- Prefer combining several "box" and "hollowBox" commands for layers, rooms, roofs, arches, and supports.
- Use "sphere" for domes, trees, or rounded features.
- Use "cylinder" for pillars, towers, and rounded columns.
- Use "floor" for ground planes, platforms, or interior floors.
- Use "line" for details like beams, rails, antennas, or decorative edges.
- For bridges or long spans: use bounds that span the full world (e.g. origin (${BOUNDS_MIN[0]},0,${BOUNDS_MIN[2]}) with size (40,10,10) for a long bridge along X).
- Aim for variation in height and silhouette (not just a single solid cube).
- Keep everything strictly within bounds and under the voxel cap.

Remember: Output ONLY the JSON object. Nothing else.`;

const DEVELOPER_PROMPT = `The user input was invalid JSON or failed schema validation. Fix the JSON to match the VoxelSpec schema exactly.

Previous attempt (may be invalid JSON):
{previousAttempt}

Errors (if any):
{errors}

User request:
{userInput}

Output ONLY the corrected JSON object. No explanations, no markdown.`;

function getUserPrompt(input: string, mode: GenerationMode): string {
  const modeInstructions: Record<GenerationMode, string> = {
    text: `Generate a voxel structure from this natural language description: "${input}"

Create a recognizable voxel sculpture that fits within the bounds limits and voxel cap.
Use a palette with 2-8 colors.
Use multiple commands (box, hollowBox, floor, line) to add layers, details, and variation in shape.`,
    code: `Generate a voxel structure from this code-like input: "${input}"

Interpret the code structure and translate it into voxel commands.
Use dimensions or parameters in the code to decide sizes and proportions (e.g., stories, width, depth).
Use multiple commands and vary height, thickness, and colors while keeping within bounds and voxel cap.`,
    function: `Generate a voxel structure from this function-style input: "${input}"

Parse the function call parameters and generate corresponding voxel commands.
Use multiple commands to reflect different parts (e.g., base, walls, roof, decorations).
Keep everything in bounds and under the voxel cap, but prefer richer shapes over a single solid box.`,
  };

  return modeInstructions[mode];
}

export function buildPrompt(
  input: string,
  mode: GenerationMode,
  isRetry: boolean = false,
  previousAttempt?: string,
  errors?: string
): Array<{ role: "system" | "user"; content: string }> {
  if (isRetry) {
    return [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: DEVELOPER_PROMPT.replace("{previousAttempt}", previousAttempt || "")
          .replace("{errors}", errors || "Invalid JSON or schema validation failed")
          .replace("{userInput}", input),
      },
    ];
  }

  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: getUserPrompt(input, mode) },
  ];
}

