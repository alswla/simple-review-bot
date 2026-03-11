import OpenAI from "openai";
import { LLMProvider } from "./base";
import { ProviderError, RateLimitError } from "../utils/errors";
import { withRetry } from "../utils/retry";

export class OpenAIProvider implements LLMProvider {
  name = "openai";
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model || "gpt-4o";
  }

  async chat(systemPrompt: string, userPrompt: string): Promise<string> {
    return withRetry(async () => {
      try {
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 4096,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new ProviderError("openai", "Empty response from model");
        }
        return content;
      } catch (error: unknown) {
        if (error instanceof ProviderError || error instanceof RateLimitError) {
          throw error;
        }
        const err = error as { status?: number; message?: string };
        if (err.status === 429) {
          throw new RateLimitError();
        }
        throw new ProviderError("openai", err.message || "Unknown error");
      }
    });
  }
}
