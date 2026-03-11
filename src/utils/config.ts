import * as fs from "fs";
import * as yaml from "js-yaml";
import * as core from "@actions/core";

export interface PRLensConfig {
  provider: {
    type: "openai" | "claude" | "gemini";
    model?: string;
  };
  agents?: {
    security?: boolean;
    performance?: boolean;
    quality?: boolean;
    ux?: boolean;
  };
  voting?: {
    required_approvals?: number;
    conditional_weight?: number;
  };
  debate?: {
    enabled?: boolean;
    trigger?: "always" | "on-critical" | "on-disagreement";
  };
  weights?: {
    auto_detect?: boolean;
    overrides?: {
      security?: number;
      performance?: number;
      quality?: number;
      ux?: number;
    };
  };
  labels?: {
    enabled?: boolean;
    approved?: string;
    rejected?: string;
    discussion?: string;
  };
  output?: {
    style?: "detailed" | "summary";
    includeEmoji?: boolean;
  };
  ignore?: {
    files?: string[];
    paths?: string[];
  };
}

const DEFAULT_CONFIG: PRLensConfig = {
  provider: {
    type: "openai",
  },
  agents: {
    security: true,
    performance: true,
    quality: true,
    ux: true,
  },
  voting: {
    required_approvals: 2,
    conditional_weight: 0.5,
  },
  debate: {
    enabled: false,
    trigger: "on-critical",
  },
  weights: {
    auto_detect: true,
  },
  labels: {
    enabled: false,
    approved: "review:approved",
    rejected: "review:changes-requested",
    discussion: "review:needs-discussion",
  },
  output: {
    style: "detailed",
    includeEmoji: true,
  },
  ignore: {
    files: ["*.lock", "*.generated.*"],
    paths: ["node_modules/", "dist/"],
  },
};

export function loadConfig(configPath?: string): PRLensConfig {
  const path =
    configPath || core.getInput("config_path") || ".github/pr-lens.yml";

  try {
    if (fs.existsSync(path)) {
      const raw = fs.readFileSync(path, "utf8");
      const userConfig = yaml.load(raw) as Partial<PRLensConfig>;

      return {
        ...DEFAULT_CONFIG,
        ...userConfig,
        provider: {
          ...DEFAULT_CONFIG.provider,
          ...userConfig.provider,
        },
        agents: {
          ...DEFAULT_CONFIG.agents,
          ...userConfig.agents,
        },
        voting: {
          ...DEFAULT_CONFIG.voting,
          ...userConfig.voting,
        },
        debate: {
          ...DEFAULT_CONFIG.debate,
          ...userConfig.debate,
        },
        weights: {
          ...DEFAULT_CONFIG.weights,
          ...userConfig.weights,
          overrides: {
            ...userConfig.weights?.overrides,
          },
        },
        labels: {
          ...DEFAULT_CONFIG.labels,
          ...userConfig.labels,
        },
        output: {
          ...DEFAULT_CONFIG.output,
          ...userConfig.output,
        },
        ignore: {
          files: [
            ...(DEFAULT_CONFIG.ignore?.files || []),
            ...(userConfig.ignore?.files || []),
          ],
          paths: [
            ...(DEFAULT_CONFIG.ignore?.paths || []),
            ...(userConfig.ignore?.paths || []),
          ],
        },
      };
    }
  } catch (error) {
    core.warning(`Failed to load config from ${path}: ${error}`);
  }

  return DEFAULT_CONFIG;
}
