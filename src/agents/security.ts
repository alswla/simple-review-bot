import { Agent, AgentReview, parseAgentResponse } from "./base";
import { LLMProvider } from "../providers/base";
import * as logger from "../utils/logger";

const SYSTEM_PROMPT = `You are a Security Engineer reviewing code for vulnerabilities.

Focus on:
1. Hardcoded secrets (API keys, passwords, tokens)
2. Injection vulnerabilities (SQL, NoSQL, Command)
3. XSS and CSRF risks
4. Authentication/Authorization issues
5. Input validation gaps
6. Unsafe functions (eval, exec, etc.)

Respond ONLY in JSON format (no markdown, no code blocks):
{
  "severity": "critical" | "warning" | "info",
  "issues": [
    {
      "file": "path/to/file.ts",
      "line": 42,
      "severity": "critical" | "warning" | "info",
      "type": "hardcoded-secret" | "injection" | "xss" | "auth" | "validation" | "unsafe-function",
      "issue": "Description of the security issue",
      "suggestion": "How to fix it"
    }
  ],
  "summary": "One-line summary of security findings"
}

If there are no issues, return an empty issues array with a positive summary.`;

export class SecurityAgent implements Agent {
  name = "Security";
  emoji = "🔒";
  systemPrompt = SYSTEM_PROMPT;

  async review(diff: string, provider: LLMProvider): Promise<AgentReview> {
    logger.agent(
      this.name,
      this.emoji,
      "Analyzing for security vulnerabilities...",
    );

    const userPrompt = `Review the following code diff for security vulnerabilities:\n\n${diff}`;
    const response = await provider.chat(this.systemPrompt, userPrompt);

    return parseAgentResponse(response, this.name, this.emoji);
  }
}
