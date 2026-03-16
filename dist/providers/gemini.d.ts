import { LLMProvider } from "./base";
export declare class GeminiProvider implements LLMProvider {
    name: string;
    private ai;
    private model;
    constructor(apiKey: string, model?: string);
    constructor(options: {
        vertexai: true;
        project: string;
        location: string;
    }, model?: string);
    chat(systemPrompt: string, userPrompt: string): Promise<string>;
    chatWithModel(systemPrompt: string, userPrompt: string, model: string): Promise<string>;
}
//# sourceMappingURL=gemini.d.ts.map