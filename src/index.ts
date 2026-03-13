import * as core from "@actions/core";
import { createProvider, selectModel, countChangedLines } from "./providers";
import {
  SecurityAgent,
  PerformanceAgent,
  QualityAgent,
  UXAgent,
  Agent,
} from "./agents";
import { GitHubClient } from "./github/client";
import { filterDiff } from "./github/diff";
import { formatComment } from "./github/comment";
import { loadConfig, normalizeAgentConfig } from "./utils/config";
import { castVote, countVotes, AgentVote } from "./review/voter";
import { determineWeights, getAgentWeight } from "./review/weigher";
import { runDebate, EnrichedIssue } from "./review/debate";
import * as logger from "./utils/logger";

async function run(): Promise<void> {
  try {
    // 1. Load configuration
    const config = loadConfig();
    logger.info("Configuration loaded.");

    // 2. Get inputs
    const providerType =
      core.getInput("provider") || config.provider.type || "openai";
    const apiKey =
      core.getInput(`${providerType}_api_key`) ||
      core.getInput("api_key") ||
      "";

    // For Vertex AI, API key is not required
    const isVertexAI = config.provider.vertexai === true;

    if (!apiKey && !isVertexAI) {
      throw new Error(
        `API key is required. Set '${providerType}_api_key' input.`,
      );
    }

    // 3. Initialize provider
    const provider = createProvider({
      type: providerType as "openai" | "claude" | "gemini",
      apiKey,
      model: config.provider.model,
      vertexai: config.provider.vertexai,
      project: config.provider.project || core.getInput("gcp_project"),
      location:
        config.provider.location ||
        core.getInput("gcp_location") ||
        "us-central1",
    });
    logger.info(`Provider initialized: ${provider.name}`);

    // 4. Initialize GitHub client and get diff
    const githubToken = process.env.GITHUB_TOKEN;
    const github = new GitHubClient(githubToken);
    const prNumber = github.getPRNumber();
    logger.info(`Reviewing PR #${prNumber}`);

    const rawDiff = await github.getPRDiff(prNumber);
    if (!rawDiff || rawDiff.trim().length === 0) {
      logger.info("No diff found. Skipping review.");
      return;
    }

    // 5. Filter diff based on ignore config
    const diff = filterDiff(
      rawDiff,
      config.ignore?.files,
      config.ignore?.paths,
    );

    if (!diff || diff.trim().length === 0) {
      logger.info("All changed files are ignored. Skipping review.");
      return;
    }

    // 6. Truncate diff if too large (LLM context limit)
    const MAX_DIFF_LENGTH = 100_000;
    const truncatedDiff =
      diff.length > MAX_DIFF_LENGTH
        ? diff.slice(0, MAX_DIFF_LENGTH) +
          "\n\n... (diff truncated due to size)"
        : diff;

    // 7. Tiered model selection (auto-select model based on diff size)
    let tieredModel: string | undefined;
    if (config.tiered_model?.enabled) {
      const changedLines = countChangedLines(rawDiff);
      tieredModel = selectModel(providerType, changedLines);
      logger.info(`Tiered model: ${changedLines} lines → ${tieredModel}`);
    }

    // 8. Determine agent weights based on file types
    const weights = determineWeights(
      rawDiff,
      config.weights?.auto_detect !== false
        ? undefined
        : config.weights?.overrides,
    );
    logger.info(
      `Weights: Security=${weights.security} Performance=${weights.performance} Quality=${weights.quality} UX=${weights.ux}`,
    );

    // 9. Initialize agents based on config (supports boolean and object formats)
    const allAgentEntries = [
      { key: "security", agent: new SecurityAgent() as Agent },
      { key: "performance", agent: new PerformanceAgent() as Agent },
      { key: "quality", agent: new QualityAgent() as Agent },
      { key: "ux", agent: new UXAgent() as Agent },
    ];

    const agentConfigs = config.agents || {};
    const agents: { agent: Agent; model?: string }[] = [];
    for (const { key, agent } of allAgentEntries) {
      const agentCfg = normalizeAgentConfig(
        agentConfigs[key as keyof typeof agentConfigs],
      );
      if (agentCfg.enabled) {
        agents.push({ agent, model: agentCfg.model });
      }
    }

    if (agents.length === 0) {
      logger.warn("No agents enabled. Skipping review.");
      return;
    }

    // 10. Run reviews in parallel (Round 1)
    // Priority: per-agent model > tiered model > default model
    logger.info(`🔍 Running reviews with ${agents.length} agents...`);
    const reviews = await Promise.all(
      agents.map(({ agent, model: agentModel }) => {
        const modelToUse = agentModel || tieredModel;
        if (modelToUse) {
          return agent.reviewWithModel(truncatedDiff, provider, modelToUse);
        }
        return agent.review(truncatedDiff, provider);
      }),
    );

    // 11. Cast votes based on review results
    const votes: AgentVote[] = reviews.map((review) =>
      castVote(
        review.agent,
        review.emoji,
        review.issues,
        getAgentWeight(review.agent, weights),
      ),
    );

    // 12. Run debate (Round 2 — cross-review) if enabled
    let enrichedIssues: EnrichedIssue[] | undefined;
    const debateConfig = config.debate || {};

    if (debateConfig.enabled) {
      enrichedIssues = await runDebate(provider, reviews, {
        enabled: true,
        trigger: debateConfig.trigger || "on-critical",
      });
    }

    // 13. Count votes with weighted scoring
    const votingSummary = countVotes(votes, {
      requiredApprovals: config.voting?.required_approvals ?? 2,
      conditionalWeight: config.voting?.conditional_weight ?? 0.5,
    });

    logger.info(
      `Vote result: ${votingSummary.verdict} (${votingSummary.totalWeightedScore.toFixed(1)}/${votingSummary.maxPossibleScore.toFixed(1)})`,
    );

    // 14. Format and post comment
    const comment = formatComment(
      reviews,
      votes,
      votingSummary,
      enrichedIssues,
    );
    await github.postComment(prNumber, comment);

    // 15. Apply label if enabled
    if (config.labels?.enabled) {
      const labelMap: Record<string, string> = {
        approved: config.labels.approved || "review:approved",
        "changes-requested":
          config.labels.rejected || "review:changes-requested",
        "needs-discussion":
          config.labels.discussion || "review:needs-discussion",
      };
      const labelName = labelMap[votingSummary.verdict];
      if (labelName) {
        await github.applyLabel(prNumber, labelName);
      }
    }

    logger.success("Review complete!");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    core.setFailed(`Review failed: ${message}`);
  }
}

run();
