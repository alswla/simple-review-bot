import { BaseAgent } from "./base";
export declare class QualityAgent extends BaseAgent {
    name: string;
    emoji: string;
    systemPrompt: string;
    protected buildUserPrompt(diff: string): string;
}
//# sourceMappingURL=quality.d.ts.map