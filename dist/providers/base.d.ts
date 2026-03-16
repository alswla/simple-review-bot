export interface LLMProvider {
    name: string;
    chat(systemPrompt: string, userPrompt: string): Promise<string>;
    chatWithModel(systemPrompt: string, userPrompt: string, model: string): Promise<string>;
}
export interface ProviderConfig {
    type: "openai" | "claude" | "gemini";
    apiKey: string;
    model?: string;
    vertexai?: boolean;
    project?: string;
    location?: string;
}
//# sourceMappingURL=base.d.ts.map