import { LLMProvider, ProviderConfig } from "./base";
import { OpenAIProvider } from "./openai";
import { ClaudeProvider } from "./claude";
import { GeminiProvider } from "./gemini";
import { PRLensError } from "../utils/errors";

export { LLMProvider, ProviderConfig } from "./base";
export { OpenAIProvider } from "./openai";
export { ClaudeProvider } from "./claude";
export { GeminiProvider } from "./gemini";
export { selectModel, countChangedLines } from "./tiered-model";

export function createProvider(config: ProviderConfig): LLMProvider {
  switch (config.type) {
    case "openai":
      if (!config.apiKey) {
        throw new PRLensError(
          "API key is required for OpenAI",
          "MISSING_API_KEY",
        );
      }
      return new OpenAIProvider(config.apiKey, config.model);

    case "claude":
      if (!config.apiKey) {
        throw new PRLensError(
          "API key is required for Claude",
          "MISSING_API_KEY",
        );
      }
      return new ClaudeProvider(config.apiKey, config.model);

    case "gemini":
      if (config.vertexai) {
        // GCP Vertex AI mode — no API key needed
        if (!config.project || !config.location) {
          throw new PRLensError(
            "project and location are required for Vertex AI mode",
            "MISSING_VERTEX_CONFIG",
          );
        }
        return new GeminiProvider(
          {
            vertexai: true,
            project: config.project,
            location: config.location,
          },
          config.model,
        );
      }
      // API Key mode
      if (!config.apiKey) {
        throw new PRLensError(
          "API key is required for Gemini",
          "MISSING_API_KEY",
        );
      }
      return new GeminiProvider(config.apiKey, config.model);

    default:
      throw new PRLensError(
        `Unknown provider: ${config.type}. Supported: openai, claude, gemini`,
        "UNKNOWN_PROVIDER",
      );
  }
}
