/**
 * Count total changed lines (additions + deletions) from raw diff.
 */
export declare function countChangedLines(rawDiff: string): number;
/**
 * Select a model based on diff size and provider type.
 * Smaller diffs → cheaper/faster models.
 * Larger diffs → more capable models.
 */
export declare function selectModel(providerType: string, changedLines: number): string;
//# sourceMappingURL=tiered-model.d.ts.map