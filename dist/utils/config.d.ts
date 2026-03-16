export interface AgentConfig {
    enabled?: boolean;
    model?: string;
    provider?: 'openai' | 'claude' | 'gemini';
    api_key?: string;
}
export interface PRLensConfig {
    provider: {
        type: "openai" | "claude" | "gemini";
        model?: string;
        vertexai?: boolean;
        project?: string;
        location?: string;
    };
    agents?: {
        security?: boolean | AgentConfig;
        performance?: boolean | AgentConfig;
        quality?: boolean | AgentConfig;
        ux?: boolean | AgentConfig;
    };
    tiered_model?: {
        enabled?: boolean;
    };
    hard_cut?: {
        enabled?: boolean;
        max_changed_files?: number;
        max_changed_lines?: number;
    };
    summary?: {
        enabled?: boolean;
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
        style?: 'detailed' | 'summary';
        includeEmoji?: boolean;
        language?: string;
    };
    ignore?: {
        files?: string[];
        paths?: string[];
    };
}
/**
 * Normalize agent config: supports both boolean and object formats.
 * - `security: true` → `{ enabled: true }`
 * - `security: { enabled: true, model: 'gpt-4o' }` → as-is
 */
export declare function normalizeAgentConfig(value: boolean | AgentConfig | undefined): AgentConfig;
export declare function loadConfig(configPath?: string): PRLensConfig;
//# sourceMappingURL=config.d.ts.map