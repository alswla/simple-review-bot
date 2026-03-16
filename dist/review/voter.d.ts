export type VoteResult = "approve" | "reject" | "conditional";
export interface AgentVote {
    agent: string;
    emoji: string;
    vote: VoteResult;
    weight: number;
    weightedScore: number;
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    reason: string;
}
export interface VotingSummary {
    totalVoters: number;
    totalWeightedScore: number;
    maxPossibleScore: number;
    approvals: number;
    rejections: number;
    conditionals: number;
    passed: boolean;
    verdict: "approved" | "changes-requested" | "needs-discussion";
    requiredApprovals: number;
    confidencePercent: number;
}
export interface VotingConfig {
    requiredApprovals: number;
    conditionalWeight: number;
}
/**
 * Cast a vote based on the agent's review issues.
 */
export declare function castVote(agentName: string, emoji: string, issues: {
    severity: string;
}[], weight: number): AgentVote;
/**
 * Count votes with weighted scoring.
 */
export declare function countVotes(votes: AgentVote[], config?: VotingConfig): VotingSummary;
/**
 * Get vote emoji.
 */
export declare function getVoteEmoji(vote: VoteResult): string;
/**
 * Get verdict display string.
 */
export declare function getVerdictDisplay(summary: VotingSummary): string;
//# sourceMappingURL=voter.d.ts.map