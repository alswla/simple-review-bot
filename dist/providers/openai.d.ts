import { LLMProvider } from "./base";
export declare class OpenAIProvider implements LLMProvider {
    name: string;
    private client;
    private model;
    constructor(apiKey: string, model?: string);
    chat(systemPrompt: string, userPrompt: string): Promise<string>;
    chatWithModel(systemPrompt: string, userPrompt: string, model: string): Promise<string>;
}
//# sourceMappingURL=openai.d.ts.map