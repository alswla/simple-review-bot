import { LLMProvider } from "./base";
export declare class ClaudeProvider implements LLMProvider {
    name: string;
    private client;
    private model;
    constructor(apiKey: string, model?: string);
    chat(systemPrompt: string, userPrompt: string): Promise<string>;
    chatWithModel(systemPrompt: string, userPrompt: string, model: string): Promise<string>;
}
//# sourceMappingURL=claude.d.ts.map