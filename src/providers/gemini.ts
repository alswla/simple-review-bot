import { GoogleGenAI } from "@google/genai";
import { LLMProvider } from "./base";
import { ProviderError, RateLimitError } from "../utils/errors";
import { withRetry } from "../utils/retry";

export class GeminiProvider implements LLMProvider {
  name = "gemini";
  private ai: GoogleGenAI;
  private model: string;

  constructor(apiKey: string, model?: string);
  constructor(
    options: { vertexai: true; project: string; location: string },
    model?: string,
  );
  constructor(
    apiKeyOrOptions:
      | string
      | { vertexai: true; project: string; location: string },
    model?: string,
  ) {
    if (typeof apiKeyOrOptions === "string") {
      // API Key mode
      this.ai = new GoogleGenAI({ apiKey: apiKeyOrOptions });
    } else {
      // GCP Vertex AI mode
      this.ai = new GoogleGenAI({
        vertexai: true,
        project: apiKeyOrOptions.project,
        location: apiKeyOrOptions.location,
      });
    }
    this.model = model || "gemini-2.5-flash";
  }

  async chat(systemPrompt: string, userPrompt: string): Promise<string> {
    return this.chatWithModel(systemPrompt, userPrompt, this.model);
  }

  async chatWithModel(
    systemPrompt: string,
    userPrompt: string,
    model: string,
  ): Promise<string> {
    return withRetry(async () => {
      try {
        const response = await this.ai.models.generateContent({
          model,
          contents: userPrompt,
          config: {
            systemInstruction: systemPrompt,
            maxOutputTokens: 8192,
          },
        });

        const text = response.text;
        if (!text) {
          throw new ProviderError("gemini", "Empty response from model");
        }
        return text;
      } catch (error: unknown) {
        if (error instanceof ProviderError || error instanceof RateLimitError) {
          throw error;
        }
        const err = error as { status?: number; message?: string };
        if (err.status === 429) {
          throw new RateLimitError();
        }
        throw new ProviderError("gemini", err.message || "Unknown error");
      }
    });
  }
}
