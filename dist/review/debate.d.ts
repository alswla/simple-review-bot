import { LLMProvider } from "../providers/base";
import { AgentReview, ReviewIssue } from "../agents/base";
export type CrossReviewVerdict = "agree" | "disagree" | "abstain";
export interface CrossReviewResult {
    reviewerAgent: string;
    reviewerEmoji: string;
    targetAgent: string;
    issueIndex: number;
    verdict: CrossReviewVerdict;
    reason?: string;
}
export interface DebateConfig {
    enabled: boolean;
    trigger: "always" | "on-critical" | "on-disagreement";
}
export interface EnrichedIssue extends ReviewIssue {
    foundBy: string;
    foundByEmoji: string;
    crossReviews: CrossReviewResult[];
    confidence: number;
}
/**
 * Check if debate should trigger.
 */
export declare function shouldDebate(reviews: AgentReview[], config?: DebateConfig): boolean;
/**
 * Run cross-review debate round.
 * Each agent reviews other agents' issues.
 */
export declare function runDebate(provider: LLMProvider, reviews: AgentReview[], config?: DebateConfig): Promise<EnrichedIssue[]>;
//# sourceMappingURL=debate.d.ts.map