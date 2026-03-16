export interface DiffFile {
    filename: string;
    additions: string[];
    deletions: string[];
    chunks: string;
}
/**
 * Parse a raw unified diff string into structured file-level diffs.
 */
export declare function parseDiff(rawDiff: string): DiffFile[];
/**
 * Filter out files that match ignore patterns.
 */
export declare function filterDiff(rawDiff: string, ignoreFiles?: string[], ignorePaths?: string[]): string;
//# sourceMappingURL=diff.d.ts.map