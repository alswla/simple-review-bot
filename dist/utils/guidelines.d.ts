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
export declare function loadGuidelines(agentKey: string, basePath?: string): GuidelineSet;
/**
 * Build the final prompt from default + guidelines + language.
 *
 * Priority:
 * 1. If agent-specific .md exists → replaces built-in prompt
 * 2. If not → uses built-in prompt
 * 3. common.md → always appended at the end
 * 4. language → appended as response language instruction
 */
export declare function buildPrompt(defaultPrompt: string, guidelines: GuidelineSet, language?: string): string;
//# sourceMappingURL=guidelines.d.ts.map