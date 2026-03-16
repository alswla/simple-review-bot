import { AgentReview, ReviewIssue } from "../agents/base";
import {
  AgentVote,
  VotingSummary,
  getVoteEmoji,
  getVerdictDisplay,
} from "../review/voter";
import { EnrichedIssue, CrossReviewResult } from "../review/debate";

const SEVERITY_EMOJI: Record<string, string> = {
  critical: "🔴",
  warning: "🟡",
  info: "💡",
};

/**
 * Build a text-based progress bar.
 */
function progressBar(percent: number, length = 20): string {
  const filled = Math.round((percent / 100) * length);
  const empty = length - filled;
  return "▓".repeat(filled) + "░".repeat(empty);
}

/**
 * Format confidence badge.
 */
function confidenceBadge(confidence: number): string {
  if (confidence >= 80) return `<kbd>✅ ${confidence}% confidence</kbd>`;
  if (confidence >= 50) return `<kbd>🟡 ${confidence}% confidence</kbd>`;
  return `<kbd>⚠️ ${confidence}% confidence</kbd>`;
}

/**
 * Format cross-review verdicts inline.
 */
function formatCrossReviews(crossReviews: CrossReviewResult[]): string {
  if (crossReviews.length === 0) return "";

  const verdicts = crossReviews.map((cr) => {
    const emoji =
      cr.verdict === "agree" ? "👍" : cr.verdict === "disagree" ? "👎" : "➖";
    return `${cr.reviewerEmoji} ${emoji}`;
  });

  return `**Cross-review:** ${verdicts.join(" · ")}`;
}

/**
 * Format the dashboard vote table.
 */
function formatVoteTable(votes: AgentVote[]): string {
  const rows = votes.map((v) => {
    const voteEmoji = getVoteEmoji(v.vote);
    const issuesSummary =
      [
        v.criticalCount > 0 ? `${v.criticalCount} critical` : "",
        v.warningCount > 0 ? `${v.warningCount} warning` : "",
        v.infoCount > 0 ? `${v.infoCount} info` : "",
      ]
        .filter(Boolean)
        .join(", ") || "None";

    return `| ${v.emoji} ${v.agent} | ${voteEmoji} ${v.vote} | ×${v.weight.toFixed(1)} | ${issuesSummary} | ${v.weightedScore.toFixed(1)} |`;
  });

  return [
    "| Agent | Vote | Weight | Issues | Score |",
    "|-------|------|--------|--------|-------|",
    ...rows,
  ].join("\n");
}

/**
 * Format enriched issues with cross-review data.
 */
function formatEnrichedIssues(issues: EnrichedIssue[]): string {
  if (issues.length === 0) return "_No issues found._ ✨\n";

  const blocks = issues.map((issue) => {
    const sevEmoji = SEVERITY_EMOJI[issue.severity] || "💡";
    const location = issue.line ? `${issue.file}:${issue.line}` : issue.file;
    const badge = confidenceBadge(issue.confidence);
    const crossReview = formatCrossReviews(issue.crossReviews);

    const lines = [
      `<details>`,
      `<summary>${sevEmoji} <b>${issue.issue}</b> — <code>${location}</code> ${badge}</summary>`,
      "",
      `**Found by:** ${issue.foundByEmoji} ${issue.foundBy}`,
    ];

    if (crossReview) {
      lines.push(crossReview);
    }

    lines.push(`**Suggestion:** ${issue.suggestion}`);
    lines.push("", "</details>", "");

    return lines.join("\n");
  });

  return blocks.join("\n");
}

/**
 * Format action items checklist from reject/conditional votes.
 */
function formatActionItems(issues: EnrichedIssue[]): string {
  const actionable = issues.filter(
    (i) => i.severity === "critical" || i.severity === "warning",
  );

  if (actionable.length === 0) return "";

  const items = actionable.map((issue) => {
    const location = issue.line
      ? `\`${issue.file}:${issue.line}\``
      : `\`${issue.file}\``;
    return `- [ ] ${issue.suggestion} — ${location} (${issue.foundByEmoji} ${issue.foundBy})`;
  });

  return ["---", "### 📋 Action Items\n", ...items, ""].join("\n");
}

/**
 * Format the full PR comment with dashboard, issues, and action items.
 */
export function formatComment(
  reviews: AgentReview[],
  votes?: AgentVote[],
  votingSummary?: VotingSummary,
  enrichedIssues?: EnrichedIssue[],
  prSummary?: string,
): string {
  const lines: string[] = [
    "<!-- simple-review-bot -->",
    "## 🔍 simple-review-bot Review\n",
  ];

  // PR Summary section
  if (prSummary) {
    lines.push(
      "<details>",
      "<summary>📝 <b>PR Summary</b></summary>",
      "",
      prSummary,
      "",
      "</details>",
      "",
    );
  }

  // Dashboard section (if voting is available)
  if (votes && votingSummary) {
    lines.push("### 📊 Dashboard");
    lines.push(getVerdictDisplay(votingSummary));
    lines.push("");
    lines.push(formatVoteTable(votes));
    lines.push("");
    lines.push(
      `${progressBar(votingSummary.confidencePercent)} ${votingSummary.confidencePercent}% confidence`,
    );
    lines.push("");
  }

  // Issues section
  if (enrichedIssues && enrichedIssues.length > 0) {
    lines.push("---");
    lines.push(`### 🔍 Issues (${enrichedIssues.length} found)\n`);
    lines.push(formatEnrichedIssues(enrichedIssues));

    // Action items
    const actionItems = formatActionItems(enrichedIssues);
    if (actionItems) {
      lines.push(actionItems);
    }
  } else if (!enrichedIssues) {
    // Fallback: use raw reviews (no debate mode)
    const totalIssues = reviews.reduce((sum, r) => sum + r.issues.length, 0);
    if (totalIssues > 0) {
      lines.push("---");
      lines.push(`### 🔍 Issues (${totalIssues} found)\n`);

      for (const review of reviews) {
        if (review.issues.length === 0) continue;
        lines.push(`#### ${review.emoji} ${review.agent}`);
        lines.push(`**Summary:** ${review.summary}\n`);

        const rows = review.issues.map((issue) => {
          const sev = SEVERITY_EMOJI[issue.severity] || issue.severity;
          const loc = issue.line
            ? `\`${issue.file}:${issue.line}\``
            : `\`${issue.file}\``;
          return `| ${sev} ${issue.severity} | ${loc} | ${issue.issue} | ${issue.suggestion} |`;
        });

        lines.push("| Severity | File | Issue | Suggestion |");
        lines.push("|----------|------|-------|------------|");
        lines.push(...rows);
        lines.push("");
      }
    } else {
      lines.push("");
      lines.push("_No issues found across all agents._ ✨");
      lines.push("");
    }
  } else {
    lines.push("");
    lines.push("_No issues found across all agents._ ✨");
    lines.push("");
  }

  // Footer
  lines.push("---");
  lines.push(
    "*Reviewed by [simple-review-bot](https://github.com/minjihan/simple-review-bot)*",
  );

  return lines.join("\n");
}

/**
 * Build inline review comments from debate-filtered issues.
 *
 * Strategy:
 * - With debate: only issues with confidence >= threshold get inline comments
 * - Without debate: only critical + warning issues get inline comments
 * - Only issues with valid file + line numbers are included
 */
export function buildInlineComments(
  enrichedIssues: EnrichedIssue[] | undefined,
  reviews: AgentReview[],
  confidenceThreshold: number = 50,
): { path: string; line: number; body: string }[] {
  const comments: { path: string; line: number; body: string }[] = [];

  if (enrichedIssues && enrichedIssues.length > 0) {
    // Debate mode: use confidence-filtered enriched issues
    for (const issue of enrichedIssues) {
      if (!issue.file || !issue.line || issue.file === "unknown") continue;
      if (issue.confidence < confidenceThreshold) continue;

      const sevEmoji = SEVERITY_EMOJI[issue.severity] || "💡";
      const badge = `${issue.confidence}% confidence`;
      const body = [
        `${sevEmoji} **${issue.severity.toUpperCase()}** — ${issue.issue}`,
        "",
        `> **Suggestion:** ${issue.suggestion}`,
        "",
        `_Found by ${issue.foundByEmoji} ${issue.foundBy} · ${badge}_`,
      ].join("\n");

      comments.push({ path: issue.file, line: issue.line, body });
    }
  } else {
    // No debate: use raw review issues (critical + warning only)
    for (const review of reviews) {
      for (const issue of review.issues) {
        if (!issue.file || !issue.line || issue.file === "unknown") continue;
        if (issue.severity !== "critical" && issue.severity !== "warning")
          continue;

        const sevEmoji = SEVERITY_EMOJI[issue.severity] || "💡";
        const body = [
          `${sevEmoji} **${issue.severity.toUpperCase()}** — ${issue.issue}`,
          "",
          `> **Suggestion:** ${issue.suggestion}`,
          "",
          `_Found by ${review.emoji} ${review.agent}_`,
        ].join("\n");

        comments.push({ path: issue.file, line: issue.line, body });
      }
    }
  }

  return comments;
}
