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

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  ko: 'Korean',
  ja: 'Japanese',
  zh: 'Chinese',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  pt: 'Portuguese',
};

/**
 * Build the final prompt from default + guidelines + language.
 *
 * Priority:
 * 1. If agent-specific .md exists → replaces built-in prompt
 * 2. If not → uses built-in prompt
 * 3. common.md → always appended at the end
 * 4. language → appended as response language instruction
 */
export function buildPrompt(
  defaultPrompt: string,
  guidelines: GuidelineSet,
  language?: string,
): string {
  // Use custom agent prompt if provided, otherwise use default
  let prompt = guidelines.agent || defaultPrompt;

  // Always append common guidelines if they exist
  if (guidelines.common) {
    prompt += '\n\n## Additional Team Guidelines\n\n' + guidelines.common;
  }

  // Append language instruction if not English
  if (language && language !== 'en') {
    const langName = LANGUAGE_NAMES[language] || language;
    prompt += `\n\nIMPORTANT: You MUST write ALL your responses (issue descriptions, suggestions, summaries) in ${langName}. The JSON keys must remain in English, but all values must be in ${langName}.`;
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
