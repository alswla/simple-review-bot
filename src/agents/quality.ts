import { Agent, AgentReview, parseAgentResponse } from "./base";
import { LLMProvider } from "../providers/base";
import * as logger from "../utils/logger";

const SYSTEM_PROMPT = `You are a Code Quality Engineer ensuring maintainability.

Focus on:
1. Naming conventions (variables, functions, classes)
2. Function length (flag > 30 lines)
3. Code duplication (DRY violations)
4. Missing error handling
5. Test coverage considerations
6. Documentation needs
7. SOLID principles

Respond ONLY in JSON format (no markdown, no code blocks):
{
  "severity": "critical" | "warning" | "info",
  "issues": [
    {
      "file": "path/to/file.ts",
      "line": 42,
      "severity": "critical" | "warning" | "info",
      "type": "naming" | "complexity" | "duplication" | "error-handling" | "testing" | "documentation" | "solid",
      "issue": "Description of the quality issue",
      "suggestion": "How to improve"
    }
  ],
  "summary": "One-line summary of quality findings"
}

If there are no issues, return an empty issues array with a positive summary.`;

export class QualityAgent implements Agent {
  name = "Quality";
  emoji = "🧹";
  systemPrompt = SYSTEM_PROMPT;

  async review(diff: string, provider: LLMProvider): Promise<AgentReview> {
    logger.agent(this.name, this.emoji, "Analyzing for code quality...");

    const userPrompt = `Review the following code diff for code quality:\n\n${diff}`;
    const response = await provider.chat(this.systemPrompt, userPrompt);

    return parseAgentResponse(response, this.name, this.emoji);
  }
}
