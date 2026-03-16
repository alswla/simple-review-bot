import { LLMProvider } from "../providers/base";
import { AgentReview, ReviewIssue } from "../agents/base";
import * as logger from "../utils/logger";

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
  confidence: number; // 0-100
}

const DEFAULT_DEBATE_CONFIG: DebateConfig = {
  enabled: false,
  trigger: "on-critical",
};

const CROSS_REVIEW_SYSTEM_PROMPT = `You are a code review expert performing a cross-review of another agent's findings.

For each issue listed below, evaluate whether you agree, disagree, or have no opinion (abstain).
- "agree" = the issue is valid and worth fixing
- "disagree" = the issue is a false positive or not significant enough to report
- "abstain" = outside your expertise, no opinion

Respond ONLY in JSON format (no markdown, no code blocks):
{
  "reviews": [
    {
      "issueIndex": 0,
      "verdict": "agree" | "disagree" | "abstain",
      "reason": "Brief explanation"
    }
  ]
}`;

/**
 * Check if debate should trigger.
 */
export function shouldDebate(
  reviews: AgentReview[],
  config: DebateConfig = DEFAULT_DEBATE_CONFIG,
): boolean {
  if (!config.enabled) return false;
  if (config.trigger === "always") return true;

  if (config.trigger === "on-critical") {
    return reviews.some((r) => r.issues.some((i) => i.severity === "critical"));
  }

  if (config.trigger === "on-disagreement") {
    // Check if any two agents have conflicting views on similar files
    const allFiles = new Set(
      reviews.flatMap((r) => r.issues.map((i) => i.file)),
    );
    // If multiple agents report on the same file with different severities → disagreement
    for (const file of allFiles) {
      const severities = new Set(
        reviews.flatMap((r) =>
          r.issues.filter((i) => i.file === file).map((i) => i.severity),
        ),
      );
      if (severities.size > 1) return true;
    }
  }

  return false;
}

/**
 * Build the user prompt for cross-review.
 */
function buildCrossReviewPrompt(
  reviewerName: string,
  targetAgent: string,
  issues: ReviewIssue[],
): string {
  const issueList = issues
    .map(
      (issue, idx) =>
        `Issue #${idx}:
  - File: ${issue.file}${issue.line ? `:${issue.line}` : ""}
  - Severity: ${issue.severity}
  - Type: ${issue.type}
  - Description: ${issue.issue}
  - Suggestion: ${issue.suggestion}`,
    )
    .join("\n\n");

  return `You are the ${reviewerName} agent. Cross-review the following issues found by the ${targetAgent} agent:

${issueList}

Evaluate each issue from your perspective.`;
}

/**
 * Parse the cross-review LLM response.
 */
function parseCrossReviewResponse(
  raw: string,
  reviewerAgent: string,
  reviewerEmoji: string,
  targetAgent: string,
): CrossReviewResult[] {
  try {
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : raw.trim();
    const parsed = JSON.parse(jsonStr);

    return (parsed.reviews || []).map((r: Record<string, unknown>) => ({
      reviewerAgent,
      reviewerEmoji,
      targetAgent,
      issueIndex: (r.issueIndex as number) ?? 0,
      verdict: (r.verdict as CrossReviewVerdict) || "abstain",
      reason: (r.reason as string) || undefined,
    }));
  } catch {
    return [];
  }
}

/**
 * Calculate confidence score for an issue based on cross-reviews.
 * confidence = agree / (agree + disagree) * 100
 * If no cross-reviews or only abstains → confidence = 50 (neutral).
 */
function calculateConfidence(crossReviews: CrossReviewResult[]): number {
  if (crossReviews.length === 0) return 50; // No cross-reviews → neutral

  const agrees = crossReviews.filter((r) => r.verdict === 'agree').length;
  const disagrees = crossReviews.filter((r) => r.verdict === 'disagree').length;
  const total = agrees + disagrees;

  if (total === 0) return 50; // All abstained → neutral
  return Math.round((agrees / total) * 100);
}

/**
 * Run cross-review debate round.
 * Each agent reviews other agents' issues.
 */
export async function runDebate(
  provider: LLMProvider,
  reviews: AgentReview[],
  config: DebateConfig = DEFAULT_DEBATE_CONFIG,
): Promise<EnrichedIssue[]> {
  if (!shouldDebate(reviews, config)) {
    logger.info("Debate skipped (not triggered or disabled).");
    // Return issues without cross-review data
    return reviews.flatMap((review) =>
      review.issues.map((issue) => ({
        ...issue,
        foundBy: review.agent,
        foundByEmoji: review.emoji,
        crossReviews: [],
        confidence: 50,
      })),
    );
  }

  logger.info("💬 Starting cross-review debate...");

  const allCrossReviews: CrossReviewResult[] = [];

  // Each agent reviews every other agent's issues in parallel
  const crossReviewTasks: Promise<CrossReviewResult[]>[] = [];

  for (const reviewer of reviews) {
    for (const target of reviews) {
      if (reviewer.agent === target.agent) continue;
      if (target.issues.length === 0) continue;

      const task = (async () => {
        logger.agent(
          reviewer.agent,
          reviewer.emoji,
          `Cross-reviewing ${target.emoji} ${target.agent}'s ${target.issues.length} issue(s)...`,
        );

        const userPrompt = buildCrossReviewPrompt(
          reviewer.agent,
          target.agent,
          target.issues,
        );

        try {
          const response = await provider.chat(
            CROSS_REVIEW_SYSTEM_PROMPT,
            userPrompt,
          );
          return parseCrossReviewResponse(
            response,
            reviewer.agent,
            reviewer.emoji,
            target.agent,
          );
        } catch (error) {
          logger.warn(
            `Cross-review failed for ${reviewer.agent} → ${target.agent}: ${error}`,
          );
          return [];
        }
      })();

      crossReviewTasks.push(task);
    }
  }

  const crossReviewResults = await Promise.all(crossReviewTasks);
  for (const results of crossReviewResults) {
    allCrossReviews.push(...results);
  }

  // Enrich issues with cross-review data
  const enrichedIssues: EnrichedIssue[] = [];

  for (const review of reviews) {
    for (let i = 0; i < review.issues.length; i++) {
      const issue = review.issues[i];
      // Match cross-reviews: try both 0-based and 1-based issueIndex
      const crossReviews = allCrossReviews.filter(
        (cr) =>
          cr.targetAgent === review.agent &&
          (cr.issueIndex === i || cr.issueIndex === i + 1),
      );

      enrichedIssues.push({
        ...issue,
        foundBy: review.agent,
        foundByEmoji: review.emoji,
        crossReviews,
        confidence: calculateConfidence(crossReviews),
      });
    }
  }

  // Sort: critical first, then by confidence descending
  enrichedIssues.sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return b.confidence - a.confidence;
  });

  logger.success(
    `Cross-review complete. ${enrichedIssues.length} issues enriched.`,
  );
  return enrichedIssues;
}
