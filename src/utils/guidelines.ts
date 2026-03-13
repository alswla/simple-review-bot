import * as fs from "fs";
import * as path from "path";
import * as core from "@actions/core";

const DEFAULT_BASE_PATH = ".github/review-bot";

export interface GuidelineSet {
  common?: string;
  agent?: string;
}

/**
 * Load custom guideline markdown files for an agent.
 *
 * File structure:
 *   .github/review-bot/
 *   ├── common.md        # Appended to ALL agents
 *   ├── security.md      # Replaces Security agent's built-in prompt
 *   ├── performance.md   # Replaces Performance agent's built-in prompt
 *   ├── quality.md       # Replaces Quality agent's built-in prompt
 *   └── ux.md            # Replaces UX agent's built-in prompt
 */
export function loadGuidelines(
  agentKey: string,
  basePath: string = DEFAULT_BASE_PATH,
): GuidelineSet {
  return {
    common: readFileIfExists(path.join(basePath, "common.md")),
    agent: readFileIfExists(
      path.join(basePath, `${agentKey.toLowerCase()}.md`),
    ),
  };
}

/**
 * Build the final prompt from default + guidelines.
 *
 * Priority:
 * 1. If agent-specific .md exists → replaces built-in prompt
 * 2. If not → uses built-in prompt
 * 3. common.md → always appended at the end
 */
export function buildPrompt(
  defaultPrompt: string,
  guidelines: GuidelineSet,
): string {
  // Use custom agent prompt if provided, otherwise use default
  let prompt = guidelines.agent || defaultPrompt;

  // Always append common guidelines if they exist
  if (guidelines.common) {
    prompt += "\n\n## Additional Team Guidelines\n\n" + guidelines.common;
  }

  return prompt;
}

function readFileIfExists(filePath: string): string | undefined {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf8").trim();
      if (content.length > 0) {
        core.info(`Loaded custom guideline: ${filePath}`);
        return content;
      }
    }
  } catch {
    // File not readable, skip
  }
  return undefined;
}
