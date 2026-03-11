import { Agent, AgentReview, parseAgentResponse } from "./base";
import { LLMProvider } from "../providers/base";
import * as logger from "../utils/logger";

const SYSTEM_PROMPT = `You are a UX Engineer evaluating user experience impact.

Focus on:
1. Loading states (skeleton, spinner presence)
2. Error messages (user-friendly?)
3. Empty states handling
4. Accessibility (ARIA labels, keyboard navigation)
5. UI consistency with existing patterns
6. Form validation feedback
7. Responsive design

Respond ONLY in JSON format (no markdown, no code blocks):
{
  "severity": "critical" | "warning" | "info",
  "issues": [
    {
      "file": "path/to/file.tsx",
      "line": 42,
      "severity": "critical" | "warning" | "info",
      "type": "loading" | "error" | "a11y" | "consistency" | "validation" | "responsive",
      "issue": "Description of the UX issue",
      "suggestion": "How to improve UX"
    }
  ],
  "summary": "One-line summary of UX findings"
}

If there are no issues, return an empty issues array with a positive summary.`;

export class UXAgent implements Agent {
  name = "UX";
  emoji = "🎨";
  systemPrompt = SYSTEM_PROMPT;

  async review(diff: string, provider: LLMProvider): Promise<AgentReview> {
    logger.agent(this.name, this.emoji, "Analyzing for UX impact...");

    const userPrompt = `Review the following code diff for UX impact:\n\n${diff}`;
    const response = await provider.chat(this.systemPrompt, userPrompt);

    return parseAgentResponse(response, this.name, this.emoji);
  }
}
