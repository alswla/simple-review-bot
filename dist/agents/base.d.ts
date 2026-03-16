import { LLMProvider } from "../providers/base";
export interface ReviewIssue {
    file: string;
    line?: number;
    severity: "critical" | "warning" | "info";
    type: string;
    issue: string;
    suggestion: string;
    confidence?: number;
}
export interface AgentReview {
    agent: string;
    emoji: string;
    summary: string;
    issues: ReviewIssue[];
}
export interface Agent {
    name: string;
    emoji: string;
    systemPrompt: string;
    review(diff: string, provider: LLMProvider): Promise<AgentReview>;
    reviewWithModel(diff: string, provider: LLMProvider, model: string): Promise<AgentReview>;
}
/**
 * Base class for agents. Provides default reviewWithModel implementation
 * that delegates to provider.chatWithModel().
 */
export declare abstract class BaseAgent implements Agent {
    abstract name: string;
    abstract emoji: string;
    abstract systemPrompt: string;
    protected buildUserPrompt(diff: string): string;
    review(diff: string, provider: LLMProvider): Promise<AgentReview>;
    reviewWithModel(diff: string, provider: LLMProvider, model: string): Promise<AgentReview>;
}
export declare function parseAgentResponse(raw: string, agentName: string, emoji: string): AgentReview;
//# sourceMappingURL=base.d.ts.map