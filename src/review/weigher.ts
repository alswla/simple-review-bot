import { parseDiff } from "../github/diff";

export interface AgentWeights {
  security: number;
  performance: number;
  quality: number;
  ux: number;
}

interface FileTypeProfile {
  extensions: string[];
  weights: AgentWeights;
}

const FILE_TYPE_PROFILES: FileTypeProfile[] = [
  {
    // Frontend files
    extensions: [
      ".tsx",
      ".jsx",
      ".css",
      ".scss",
      ".less",
      ".html",
      ".vue",
      ".svelte",
    ],
    weights: { security: 1.0, performance: 0.8, quality: 1.0, ux: 1.5 },
  },
  {
    // Backend / API files
    extensions: [".ts", ".js", ".py", ".go", ".java", ".rs", ".rb"],
    weights: { security: 1.5, performance: 1.2, quality: 1.0, ux: 0.5 },
  },
  {
    // Database / query files
    extensions: [".sql", ".prisma", ".graphql", ".gql"],
    weights: { security: 1.5, performance: 1.5, quality: 1.0, ux: 0.3 },
  },
  {
    // Infrastructure / config files
    extensions: [".yml", ".yaml", ".dockerfile", ".tf", ".toml", ".env"],
    weights: { security: 2.0, performance: 0.5, quality: 1.0, ux: 0.3 },
  },
  {
    // Test files
    extensions: [
      ".test.ts",
      ".test.js",
      ".spec.ts",
      ".spec.js",
      ".test.tsx",
      ".spec.tsx",
    ],
    weights: { security: 0.5, performance: 0.5, quality: 1.5, ux: 0.3 },
  },
];

const DEFAULT_WEIGHTS: AgentWeights = {
  security: 1.0,
  performance: 1.0,
  quality: 1.0,
  ux: 1.0,
};

/**
 * Extract file extensions from a raw diff.
 */
function getChangedExtensions(rawDiff: string): string[] {
  const files = parseDiff(rawDiff);
  return files
    .map((f) => {
      // Handle compound extensions like .test.ts
      const basename = f.filename.split("/").pop() || "";
      const testMatch = basename.match(/\.(test|spec)\.[^.]+$/);
      if (testMatch) return testMatch[0];
      const dotIdx = basename.lastIndexOf(".");
      return dotIdx >= 0 ? basename.slice(dotIdx) : "";
    })
    .filter(Boolean);
}

/**
 * Determine weights based on PR file types.
 * Averages weights across all matching file type profiles.
 */
export function determineWeights(
  rawDiff: string,
  overrides?: Partial<AgentWeights>,
): AgentWeights {
  const extensions = getChangedExtensions(rawDiff);

  if (extensions.length === 0) {
    return { ...DEFAULT_WEIGHTS, ...overrides };
  }

  // Count how many files match each profile
  const profileMatches: { profile: FileTypeProfile; count: number }[] = [];

  for (const profile of FILE_TYPE_PROFILES) {
    const count = extensions.filter((ext) =>
      profile.extensions.some((profileExt) => ext.endsWith(profileExt)),
    ).length;
    if (count > 0) {
      profileMatches.push({ profile, count });
    }
  }

  if (profileMatches.length === 0) {
    return { ...DEFAULT_WEIGHTS, ...overrides };
  }

  // Weighted average based on file count
  const totalFiles = profileMatches.reduce((sum, m) => sum + m.count, 0);
  const weights: AgentWeights = {
    security: 0,
    performance: 0,
    quality: 0,
    ux: 0,
  };

  for (const { profile, count } of profileMatches) {
    const ratio = count / totalFiles;
    weights.security += profile.weights.security * ratio;
    weights.performance += profile.weights.performance * ratio;
    weights.quality += profile.weights.quality * ratio;
    weights.ux += profile.weights.ux * ratio;
  }

  // Round to 1 decimal
  weights.security = Math.round(weights.security * 10) / 10;
  weights.performance = Math.round(weights.performance * 10) / 10;
  weights.quality = Math.round(weights.quality * 10) / 10;
  weights.ux = Math.round(weights.ux * 10) / 10;

  // Apply manual overrides
  if (overrides) {
    if (overrides.security !== undefined) weights.security = overrides.security;
    if (overrides.performance !== undefined)
      weights.performance = overrides.performance;
    if (overrides.quality !== undefined) weights.quality = overrides.quality;
    if (overrides.ux !== undefined) weights.ux = overrides.ux;
  }

  return weights;
}

/**
 * Get the weight for a specific agent.
 */
export function getAgentWeight(
  agentName: string,
  weights: AgentWeights,
): number {
  const key = agentName.toLowerCase() as keyof AgentWeights;
  return weights[key] ?? 1.0;
}
