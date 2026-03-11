export interface LLMProvider {
  name: string;
  chat(systemPrompt: string, userPrompt: string): Promise<string>;
}

export interface ProviderConfig {
  type: "openai" | "claude" | "gemini";
  apiKey: string;
  model?: string;
}
