import { LLMProvider } from '../providers/base';
import { DiffFile } from '../github/diff';
/**
 * Generate a PR summary using LLM from the diff content.
 */
export declare function generatePRSummary(diff: string, files: DiffFile[], provider: LLMProvider): Promise<string>;
//# sourceMappingURL=summary.d.ts.map