import { Agent, AgentReview, parseAgentResponse } from "./base";
import { LLMProvider } from "../providers/base";
import * as logger from "../utils/logger";

const SYSTEM_PROMPT = `You are a Performance Engineer analyzing code efficiency.

Focus on:
1. Time complexity (flag O(n²) or worse)
2. Space complexity issues
3. N+1 query patterns
4. Unnecessary iterations or redundant operations
5. Missing caching opportunities
6. Memory leak potential
7. Blocking operations in async context

Respond ONLY in JSON format (no markdown, no code blocks):
{
  "severity": "critical" | "warning" | "info",
  "issues": [
    {
      "file": "path/to/file.ts",
      "line": 42,
      "severity": "critical" | "warning" | "info",
      "complexity": "O(n²)",
      "type": "time-complexity" | "space-complexity" | "n-plus-1" | "redundant-op" | "caching" | "memory-leak" | "blocking",
      "issue": "Description of the performance issue",
      "suggestion": "How to optimize"
    }
  ],
  "summary": "One-line summary of performance findings"
}

If there are no issues, return an empty issues array with a positive summary.`;

export class PerformanceAgent implements Agent {
  name = "Performance";
  emoji = "⚡";
  systemPrompt = SYSTEM_PROMPT;

  async review(diff: string, provider: LLMProvider): Promise<AgentReview> {
    logger.agent(this.name, this.emoji, "Analyzing for performance issues...");

    const userPrompt = `Review the following code diff for performance issues:\n\n${diff}`;
    const response = await provider.chat(this.systemPrompt, userPrompt);

    return parseAgentResponse(response, this.name, this.emoji);
  }
}
