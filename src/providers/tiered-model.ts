import { parseDiff } from "../github/diff";

interface ModelTier {
  maxLines: number;
  model: string;
}

const TIERS: Record<string, ModelTier[]> = {
  openai: [
    { maxLines: 50, model: "gpt-4o-mini" },
    { maxLines: 300, model: "gpt-4o" },
    { maxLines: Infinity, model: "gpt-4o" },
  ],
  claude: [
    { maxLines: 50, model: "claude-haiku-4-20250514" },
    { maxLines: 300, model: "claude-sonnet-4-20250514" },
    { maxLines: Infinity, model: "claude-sonnet-4-20250514" },
  ],
  gemini: [
    { maxLines: 50, model: "gemini-2.5-flash" },
    { maxLines: 300, model: "gemini-2.5-flash" },
    { maxLines: Infinity, model: "gemini-2.5-pro" },
  ],
};

/**
 * Count total changed lines (additions + deletions) from raw diff.
 */
export function countChangedLines(rawDiff: string): number {
  const files = parseDiff(rawDiff);
  return files.reduce((sum, file) => {
    return sum + file.additions.length + file.deletions.length;
  }, 0);
}

/**
 * Select a model based on diff size and provider type.
 * Smaller diffs → cheaper/faster models.
 * Larger diffs → more capable models.
 */
export function selectModel(
  providerType: string,
  changedLines: number,
): string {
  const tiers = TIERS[providerType];
  if (!tiers) {
    throw new Error(`Unknown provider type for tiered model: ${providerType}`);
  }
  const tier = tiers.find((t) => changedLines <= t.maxLines);
  return tier ? tier.model : tiers[tiers.length - 1].model;
}
