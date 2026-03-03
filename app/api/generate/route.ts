import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { voxelSpecSchema, type VoxelSpec } from "@/types/voxelSpec";
import { buildPrompt, type GenerationMode } from "@/app/lib/llmPrompts";

/**
 * API route for LLM-based voxel generation.
 *
 * POST /api/generate
 * Body: { input: string, mode: "text" | "code" | "function" }
 *
 * Returns: { spec: VoxelSpec } | { error: string }
 */

const requestSchema = z.object({
  input: z.string().min(1).max(2000),
  mode: z.enum(["text", "code", "function"]),
});

interface ApiError {
  error: string;
  code?: string;
}

/**
 * Extracts JSON from LLM response, handling markdown code fences.
 */
function extractJSON(text: string): string | null {
  // Try parsing as-is first
  try {
    JSON.parse(text);
    return text;
  } catch {
    // Look for JSON in markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) {
      return jsonMatch[1];
    }
    // Look for JSON object boundaries
    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) {
      return objMatch[0];
    }
    return null;
  }
}

/**
 * Calls LLM provider (OpenAI-compatible API).
 */
async function callLLM(
  messages: Array<{ role: "system" | "user"; content: string }>
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const apiUrl = process.env.OPENAI_API_URL || "https://api.openai.com/v1/chat/completions";
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3, // Lower temperature for more deterministic output
      max_tokens: 4000,
      response_format: { type: "json_object" }, // Force JSON mode if supported
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("LLM returned empty response");
  }

  return content;
}

/**
 * Validates and parses VoxelSpec JSON.
 */
function parseAndValidateVoxelSpec(jsonText: string): VoxelSpec {
  const jsonStr = extractJSON(jsonText);
  if (!jsonStr) {
    throw new Error("No valid JSON found in LLM response");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    throw new Error(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }

  const result = voxelSpecSchema.safeParse(parsed);
  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join("; ");
    throw new Error(`Schema validation failed: ${errors}`);
  }

  return result.data;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = requestSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json<ApiError>(
        {
          error: "Invalid request body",
          code: "INVALID_REQUEST",
        },
        { status: 400 }
      );
    }

    const { input, mode } = validated.data;

    // First attempt
    let messages = buildPrompt(input, mode as GenerationMode, false);
    let llmResponse: string | undefined;
    let spec: VoxelSpec;

    try {
      llmResponse = await callLLM(messages);
      spec = parseAndValidateVoxelSpec(llmResponse);
    } catch (firstError) {
      // Retry once with "fix JSON" prompt
      const errorMessage =
        firstError instanceof Error ? firstError.message : String(firstError);
      messages = buildPrompt(input, mode as GenerationMode, true, llmResponse || "", errorMessage);

      try {
        llmResponse = await callLLM(messages);
        spec = parseAndValidateVoxelSpec(llmResponse);
      } catch (retryError) {
        const retryMessage =
          retryError instanceof Error ? retryError.message : String(retryError);
        return NextResponse.json<ApiError>(
          {
            error: `Generation failed after retry: ${retryMessage}`,
            code: "GENERATION_FAILED",
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ spec });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json<ApiError>(
      {
        error: `Server error: ${message}`,
        code: "SERVER_ERROR",
      },
      { status: 500 }
    );
  }
}

