import { AgentReview } from "../agents/base";
import { AgentVote, VotingSummary } from "../review/voter";
import { EnrichedIssue } from "../review/debate";
/**
 * Format the full PR comment with dashboard, issues, and action items.
 */
export declare function formatComment(reviews: AgentReview[], votes?: AgentVote[], votingSummary?: VotingSummary, enrichedIssues?: EnrichedIssue[], prSummary?: string): string;
/**
 * Build inline review comments from debate-filtered issues.
 *
 * Strategy:
 * - With debate: only issues with confidence >= threshold get inline comments
 * - Without debate: only critical + warning issues get inline comments
 * - Only issues with valid file + line numbers are included
 */
export declare function buildInlineComments(enrichedIssues: EnrichedIssue[] | undefined, reviews: AgentReview[], confidenceThreshold?: number): {
    path: string;
    line: number;
    body: string;
}[];
//# sourceMappingURL=comment.d.ts.map