export interface AgentWeights {
    security: number;
    performance: number;
    quality: number;
    ux: number;
}
/**
 * Determine weights based on PR file types.
 * Averages weights across all matching file type profiles.
 */
export declare function determineWeights(rawDiff: string, overrides?: Partial<AgentWeights>): AgentWeights;
/**
 * Get the weight for a specific agent.
 */
export declare function getAgentWeight(agentName: string, weights: AgentWeights): number;
//# sourceMappingURL=weigher.d.ts.map