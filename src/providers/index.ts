import { LLMProvider, ProviderConfig } from "./base";
import { OpenAIProvider } from "./openai";
import { ClaudeProvider } from "./claude";
import { GeminiProvider } from "./gemini";
import { PRLensError } from "../utils/errors";

export { LLMProvider, ProviderConfig } from "./base";
export { OpenAIProvider } from "./openai";
export { ClaudeProvider } from "./claude";
export { GeminiProvider } from "./gemini";

export function createProvider(config: ProviderConfig): LLMProvider {
  if (!config.apiKey) {
    throw new PRLensError(
      `API key is required for provider: ${config.type}`,
      "MISSING_API_KEY",
    );
  }

  switch (config.type) {
    case "openai":
      return new OpenAIProvider(config.apiKey, config.model);
    case "claude":
      return new ClaudeProvider(config.apiKey, config.model);
    case "gemini":
      return new GeminiProvider(config.apiKey, config.model);
    default:
      throw new PRLensError(
        `Unknown provider: ${config.type}. Supported: openai, claude, gemini`,
        "UNKNOWN_PROVIDER",
      );
  }
}
