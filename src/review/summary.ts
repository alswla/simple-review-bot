import { LLMProvider } from '../providers/base';
import { DiffFile } from '../github/diff';
import * as logger from '../utils/logger';

const SUMMARY_PROMPT = `You are a technical writer summarizing code changes in a pull request.

Generate a concise, developer-friendly summary of the changes.

Rules:
1. Start with a one-line overview of what the PR does
2. List the key changes grouped by area (e.g., "New Features", "Bug Fixes", "Refactoring")
3. Use bullet points, keep each point to 1 line
4. Do NOT list individual file names unless they are new files
5. Do NOT include code snippets
6. Maximum 10 bullet points total
7. Write in English

Respond in this exact format (plain text, no JSON, no code blocks):

**Summary:** <one-line overview>

**Changes:**
- <change 1>
- <change 2>
...`;

/**
 * Generate a PR summary using LLM from the diff content.
 */
export async function generatePRSummary(
  diff: string,
  files: DiffFile[],
  provider: LLMProvider,
): Promise<string> {
  logger.info('📝 Generating PR summary...');

  const fileList = files.map((f) => {
    const adds = f.additions.length;
    const dels = f.deletions.length;
    return `  ${f.filename} (+${adds} -${dels})`;
  }).join('\n');

  const userPrompt = [
    'Summarize the following pull request changes.',
    '',
    `Changed files (${files.length}):`,
    fileList,
    '',
    'Diff:',
    diff.slice(0, 30_000), // Limit diff size for summary
  ].join('\n');

  try {
    const response = await provider.chat(SUMMARY_PROMPT, userPrompt);
    return response.trim();
  } catch (error) {
    logger.warn(`Failed to generate summary: ${error}`);
    return '';
  }
}
