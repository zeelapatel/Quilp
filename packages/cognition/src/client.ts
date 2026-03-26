import Anthropic from "@anthropic-ai/sdk";
import { TIMEOUTS } from "./constants.js";

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error("ANTHROPIC_API_KEY is required");
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: TIMEOUTS.singleLlmCall,
  maxRetries: 2,
});

export interface LlmCallResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
}

export async function callLLM(params: {
  model: string;
  system: string;
  user: string;
  maxTokens: number;
}): Promise<LlmCallResult> {
  const response = await anthropic.messages.create({
    model: params.model,
    system: params.system,
    max_tokens: params.maxTokens,
    messages: [{ role: "user", content: params.user }],
  });

  const textContent = response.content
    .filter(block => block.type === "text")
    .map(block => block.text)
    .join("\n")
    .trim();

  if (!textContent) {
    throw new Error("LLM returned empty content");
  }

  return {
    content: textContent,
    inputTokens: response.usage.input_tokens ?? 0,
    outputTokens: response.usage.output_tokens ?? 0,
  };
}
