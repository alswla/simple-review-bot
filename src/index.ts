import * as core from '@actions/core';
import * as github from '@actions/github';
import { createProvider, selectModel, countChangedLines } from './providers';
import { LLMProvider } from './providers/base';
import {
  SecurityAgent,
  PerformanceAgent,
  QualityAgent,
  UXAgent,
  Agent,
} from "./agents";
import { GitHubClient } from './github/client';
import { filterDiff, parseDiff } from './github/diff';
import { formatComment, buildInlineComments } from './github/comment';
import { loadConfig, normalizeAgentConfig } from "./utils/config";
import { loadGuidelines, buildPrompt } from "./utils/guidelines";
import { castVote, countVotes, AgentVote } from "./review/voter";
import { determineWeights, getAgentWeight } from "./review/weigher";
import { runDebate, EnrichedIssue } from './review/debate';
import { generatePRSummary } from './review/summary';
import * as logger from './utils/logger';

async function run(): Promise<void> {
  try {
    // 1. Load configuration
    const config = loadConfig();
    logger.info("Configuration loaded.");

    // 2. Initialize GitHub client and check event type
    const githubToken = process.env.GITHUB_TOKEN;
    const ghClient = new GitHubClient(githubToken);

    // Handle issue_comment event (re-review trigger)
    if (github.context.eventName === "issue_comment") {
      if (!ghClient.isReReviewTrigger()) {
        logger.info("Comment does not contain /review. Skipping.");
        return;
      }
      logger.info("🔄 Re-review triggered via /review comment.");
    }

    // 3. Get inputs
    const providerType =
      core.getInput("provider") || config.provider.type || "openai";
    const apiKey =
      core.getInput(`${providerType}_api_key`) ||
      core.getInput("api_key") ||
      "";

    const isVertexAI = config.provider.vertexai === true;

    if (!apiKey && !isVertexAI) {
      throw new Error(
        `API key is required. Set '${providerType}_api_key' input.`,
      );
    }

    // 4. Initialize provider
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

    // 5. Get PR diff
    const prNumber = ghClient.getPRNumber();
    logger.info(`Reviewing PR #${prNumber}`);

    const rawDiff = await ghClient.getPRDiff(prNumber);
    if (!rawDiff || rawDiff.trim().length === 0) {
      logger.info("No diff found. Skipping review.");
      return;
    }

    // 6. Filter diff based on ignore config
    const diff = filterDiff(
      rawDiff,
      config.ignore?.files,
      config.ignore?.paths,
    );

    if (!diff || diff.trim().length === 0) {
      logger.info("All changed files are ignored. Skipping review.");
      return;
    }

    // 7. Truncate diff if too large (LLM context limit)
    const MAX_DIFF_LENGTH = 100_000;
    const truncatedDiff =
      diff.length > MAX_DIFF_LENGTH
        ? diff.slice(0, MAX_DIFF_LENGTH) +
          "\n\n... (diff truncated due to size)"
        : diff;

    // 8. Hard Cut — skip oversized PRs
    const files = parseDiff(rawDiff);
    const totalChangedLines = countChangedLines(rawDiff);

    if (config.hard_cut?.enabled !== false) {
      const maxFiles = config.hard_cut?.max_changed_files ?? 300;
      const maxLines = config.hard_cut?.max_changed_lines ?? 10000;

      if (files.length > maxFiles || totalChangedLines > maxLines) {
        const msg = `⚠️ PR too large (${files.length} files, ${totalChangedLines} lines). Skipping review. (limit: ${maxFiles} files, ${maxLines} lines)`;
        logger.warn(msg);
        await ghClient.postComment(
          prNumber,
          `<!-- simple-review-bot -->\n## 🔍 simple-review-bot Review\n\n${msg}\n\n_Adjust \`hard_cut\` in \`.github/pr-lens.yml\` to change limits._`,
        );
        return;
      }
    }

    // 9. Generate PR Summary (in parallel with setup)
    let prSummary: string | undefined;
    if (config.summary?.enabled !== false) {
      prSummary = await generatePRSummary(truncatedDiff, files, provider);
    }

    // 10. Tiered model selection
    let tieredModel: string | undefined;
    if (config.tiered_model?.enabled) {
      tieredModel = selectModel(providerType, totalChangedLines);
      logger.info(`Tiered model: ${totalChangedLines} lines → ${tieredModel}`);
    }

    // 11. Determine agent weights based on file types
    const weights = determineWeights(
      rawDiff,
      config.weights?.auto_detect !== false
        ? undefined
        : config.weights?.overrides,
    );
    logger.info(
      `Weights: Security=${weights.security} Performance=${weights.performance} Quality=${weights.quality} UX=${weights.ux}`,
    );

    // 12. Initialize agents with custom guidelines and per-agent providers
    const allAgentEntries = [
      { key: 'security', agent: new SecurityAgent() as Agent },
      { key: 'performance', agent: new PerformanceAgent() as Agent },
      { key: 'quality', agent: new QualityAgent() as Agent },
      { key: 'ux', agent: new UXAgent() as Agent },
    ];

    const agentConfigs = config.agents || {};
    const agents: { agent: Agent; model?: string; agentProvider?: LLMProvider }[] = [];

    for (const { key, agent } of allAgentEntries) {
      const agentCfg = normalizeAgentConfig(
        agentConfigs[key as keyof typeof agentConfigs],
      );
      if (agentCfg.enabled) {
        // Load and apply custom guidelines + language
        const guidelines = loadGuidelines(key);
        const language = config.output?.language;
        agent.systemPrompt = buildPrompt(agent.systemPrompt, guidelines, language);

        // Create per-agent provider if configured
        let agentProvider: LLMProvider | undefined;
        if (agentCfg.provider) {
          const agentApiKey =
            agentCfg.api_key ||
            core.getInput(`${agentCfg.provider}_api_key`) ||
            '';
          if (agentApiKey) {
            agentProvider = createProvider({
              type: agentCfg.provider,
              apiKey: agentApiKey,
              model: agentCfg.model,
            });
            logger.info(
              `${key}: using ${agentCfg.provider} provider`,
            );
          }
        }

        agents.push({ agent, model: agentCfg.model, agentProvider });
      }
    }

    if (agents.length === 0) {
      logger.warn('No agents enabled. Skipping review.');
      return;
    }

    // 13. Run reviews in parallel (Round 1)
    // Priority: per-agent provider > default provider
    // Priority for model: per-agent model > tiered model > provider default
    logger.info(`🔍 Running reviews with ${agents.length} agents...`);
    const reviews = await Promise.all(
      agents.map(({ agent, model: agentModel, agentProvider }) => {
        const effectiveProvider = agentProvider || provider;
        const modelToUse = agentModel || tieredModel;
        if (modelToUse) {
          return agent.reviewWithModel(truncatedDiff, effectiveProvider, modelToUse);
        }
        return agent.review(truncatedDiff, effectiveProvider);
      }),
    );

    // 14. Cast votes based on review results
    const votes: AgentVote[] = reviews.map((review) =>
      castVote(
        review.agent,
        review.emoji,
        review.issues,
        getAgentWeight(review.agent, weights),
      ),
    );

    // 15. Run debate (Round 2 — cross-review) if enabled
    let enrichedIssues: EnrichedIssue[] | undefined;
    const debateConfig = config.debate || {};

    if (debateConfig.enabled) {
      enrichedIssues = await runDebate(provider, reviews, {
        enabled: true,
        trigger: debateConfig.trigger || "on-critical",
      });
    }

    // 16. Count votes with weighted scoring
    const votingSummary = countVotes(votes, {
      requiredApprovals: config.voting?.required_approvals ?? 2,
      conditionalWeight: config.voting?.conditional_weight ?? 0.5,
    });

    logger.info(
      `Vote result: ${votingSummary.verdict} (${votingSummary.totalWeightedScore.toFixed(1)}/${votingSummary.maxPossibleScore.toFixed(1)})`,
    );

    // 17. Format and post dashboard comment
    const comment = formatComment(
      reviews,
      votes,
      votingSummary,
      enrichedIssues,
      prSummary,
    );
    await ghClient.postComment(prNumber, comment);

    // 18. Post inline review comments (high-confidence issues only)
    const inlineComments = buildInlineComments(enrichedIssues, reviews);
    if (inlineComments.length > 0) {
      const reviewEvent =
        votingSummary.verdict === "approved"
          ? ("COMMENT" as const)
          : votingSummary.verdict === "changes-requested"
            ? ("REQUEST_CHANGES" as const)
            : ("COMMENT" as const);

      await ghClient.createInlineReview(
        prNumber,
        inlineComments,
        `🔍 simple-review-bot found ${inlineComments.length} issue(s) requiring attention.`,
        reviewEvent,
      );
    }

    // 19. Apply label if enabled
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
        await ghClient.applyLabel(prNumber, labelName);
      }
    }

    logger.success("Review complete!");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    core.setFailed(`Review failed: ${message}`);
  }
}

run();
