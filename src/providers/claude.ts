import Anthropic from "@anthropic-ai/sdk";
import { LLMProvider } from "./base";
import { ProviderError, RateLimitError } from "../utils/errors";
import { withRetry } from "../utils/retry";

export class ClaudeProvider implements LLMProvider {
  name = "claude";
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model || "claude-sonnet-4-20250514";
  }

  async chat(systemPrompt: string, userPrompt: string): Promise<string> {
    return withRetry(async () => {
      try {
        const response = await this.client.messages.create({
          model: this.model,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        });

        const textBlock = response.content.find(
          (block) => block.type === "text",
        );
        if (!textBlock || textBlock.type !== "text") {
          throw new ProviderError("claude", "Empty response from model");
        }
        return textBlock.text;
      } catch (error: unknown) {
        if (error instanceof ProviderError || error instanceof RateLimitError) {
          throw error;
        }
        const err = error as { status?: number; message?: string };
        if (err.status === 429) {
          throw new RateLimitError();
        }
        throw new ProviderError("claude", err.message || "Unknown error");
      }
    });
  }
}
