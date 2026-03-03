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
    }
  ],
  "metadata": {
    "source": "prompt" | "code" | "function",
    "title": "string (optional)",
    "description": "string (optional)"
  } (optional)
}

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

Create a reasonable structure that fits within the bounds limits. Use a palette with 2-8 colors. Keep the structure simple and recognizable.`,
    code: `Generate a voxel structure from this code-like input: "${input}"

Interpret the code structure and translate it into voxel commands. Use appropriate colors and keep within bounds.`,
    function: `Generate a voxel structure from this function-style input: "${input}"

Parse the function call and generate corresponding voxel commands. Use appropriate colors and keep within bounds.`,
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

