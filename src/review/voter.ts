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

const DEFAULT_VOTING_CONFIG: VotingConfig = {
  requiredApprovals: 2,
  conditionalWeight: 0.5,
};

/**
 * Cast a vote based on the agent's review issues.
 */
export function castVote(
  agentName: string,
  emoji: string,
  issues: { severity: string }[],
  weight: number,
): AgentVote {
  const criticalCount = issues.filter((i) => i.severity === "critical").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const infoCount = issues.filter((i) => i.severity === "info").length;

  let vote: VoteResult;
  let reason: string;

  if (criticalCount >= 1) {
    vote = "reject";
    reason = `${criticalCount} critical issue(s) found`;
  } else if (warningCount >= 2) {
    vote = "conditional";
    reason = `${warningCount} warnings need attention`;
  } else if (warningCount === 1) {
    vote = "conditional";
    reason = `1 warning found`;
  } else {
    vote = "approve";
    reason =
      issues.length === 0
        ? "No issues found"
        : `${infoCount} minor suggestion(s) only`;
  }

  const voteValue =
    vote === "approve"
      ? 1
      : vote === "conditional"
        ? DEFAULT_VOTING_CONFIG.conditionalWeight
        : 0;
  const weightedScore = voteValue * weight;

  return {
    agent: agentName,
    emoji,
    vote,
    weight,
    weightedScore,
    criticalCount,
    warningCount,
    infoCount,
    reason,
  };
}

/**
 * Count votes with weighted scoring.
 */
export function countVotes(
  votes: AgentVote[],
  config: VotingConfig = DEFAULT_VOTING_CONFIG,
): VotingSummary {
  const approvals = votes.filter((v) => v.vote === "approve").length;
  const rejections = votes.filter((v) => v.vote === "reject").length;
  const conditionals = votes.filter((v) => v.vote === "conditional").length;

  const totalWeightedScore = votes.reduce((sum, v) => sum + v.weightedScore, 0);
  const maxPossibleScore = votes.reduce((sum, v) => sum + v.weight, 0);

  // Effective approvals: full for approve, partial for conditional
  const effectiveApprovals =
    approvals + conditionals * config.conditionalWeight;
  const passed = effectiveApprovals >= config.requiredApprovals;

  // Determine verdict
  let verdict: VotingSummary["verdict"];
  if (passed && rejections === 0) {
    verdict = "approved";
  } else if (rejections >= 2 || !passed) {
    verdict = "changes-requested";
  } else {
    verdict = "needs-discussion";
  }

  const confidencePercent =
    maxPossibleScore > 0
      ? Math.round((totalWeightedScore / maxPossibleScore) * 100)
      : 0;

  return {
    totalVoters: votes.length,
    totalWeightedScore,
    maxPossibleScore,
    approvals,
    rejections,
    conditionals,
    passed,
    verdict,
    requiredApprovals: config.requiredApprovals,
    confidencePercent,
  };
}

/**
 * Get vote emoji.
 */
export function getVoteEmoji(vote: VoteResult): string {
  switch (vote) {
    case "approve":
      return "✅";
    case "reject":
      return "❌";
    case "conditional":
      return "⚠️";
  }
}

/**
 * Get verdict display string.
 */
export function getVerdictDisplay(summary: VotingSummary): string {
  switch (summary.verdict) {
    case "approved":
      return `✅ **APPROVED** (${summary.totalWeightedScore.toFixed(1)} / ${summary.maxPossibleScore.toFixed(1)} weighted votes)`;
    case "changes-requested":
      return `❌ **CHANGES REQUESTED** (${summary.approvals}/${summary.totalVoters} approved, ${summary.requiredApprovals} required)`;
    case "needs-discussion":
      return `🟡 **NEEDS DISCUSSION** (${summary.approvals}+${summary.conditionals} conditional / ${summary.totalVoters})`;
  }
}
