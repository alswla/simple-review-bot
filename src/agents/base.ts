import { LLMProvider } from "../providers/base";

export interface ReviewIssue {
  file: string;
  line?: number;
  severity: "critical" | "warning" | "info";
  type: string;
  issue: string;
  suggestion: string;
  confidence?: number; // 0-100, set by debate cross-review
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
}

export function parseAgentResponse(
  raw: string,
  agentName: string,
  emoji: string,
): AgentReview {
  try {
    // Try to extract JSON from markdown code blocks if present
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : raw.trim();
    const parsed = JSON.parse(jsonStr);

    return {
      agent: agentName,
      emoji,
      summary: parsed.summary || "No summary provided.",
      issues: (parsed.issues || []).map((issue: Record<string, unknown>) => ({
        file: (issue.file as string) || "unknown",
        line: issue.line as number | undefined,
        severity: (issue.severity as ReviewIssue["severity"]) || "info",
        type:
          (issue.type as string) || (issue.complexity as string) || "general",
        issue: (issue.issue as string) || "No description",
        suggestion: (issue.suggestion as string) || "No suggestion",
      })),
    };
  } catch {
    // If JSON parsing fails, return a fallback review
    return {
      agent: agentName,
      emoji,
      summary: raw.slice(0, 200),
      issues: [],
    };
  }
}
