import * as github from "@actions/github";
import * as core from "@actions/core";

export class GitHubClient {
  private octokit;
  private context;

  constructor(token?: string) {
    const ghToken = token || process.env.GITHUB_TOKEN;
    if (!ghToken) {
      throw new Error(
        "GitHub token is required. Set GITHUB_TOKEN environment variable.",
      );
    }
    this.octokit = github.getOctokit(ghToken);
    this.context = github.context;
  }

  /**
   * Get PR number from either pull_request or issue_comment event.
   */
  getPRNumber(): number {
    // pull_request event
    if (this.context.payload.pull_request) {
      return this.context.payload.pull_request.number;
    }
    // issue_comment event (re-review trigger via /review)
    if (this.context.payload.issue?.pull_request) {
      return this.context.payload.issue.number;
    }
    throw new Error(
      "This action must be triggered by pull_request or issue_comment event.",
    );
  }

  /**
   * Check if this is a re-review trigger from a comment.
   * Returns true if event is issue_comment AND body contains /review.
   */
  isReReviewTrigger(): boolean {
    if (this.context.eventName !== "issue_comment") return false;
    const body = this.context.payload.comment?.body || "";
    return body.trim().startsWith("/review");
  }

  async getPRDiff(prNumber: number): Promise<string> {
    const { owner, repo } = this.context.repo;

    const { data } = await this.octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
      mediaType: {
        format: "diff",
      },
    });

    // The response is a string when format is 'diff'
    return data as unknown as string;
  }

  async postComment(prNumber: number, body: string): Promise<void> {
    const { owner, repo } = this.context.repo;

    // Look for existing simple-review-bot comment to update
    const { data: comments } = await this.octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: prNumber,
    });

    const existingComment = comments.find((comment) =>
      comment.body?.includes("<!-- simple-review-bot -->"),
    );

    if (existingComment) {
      await this.octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: existingComment.id,
        body,
      });
      core.info("Updated existing review comment.");
    } else {
      await this.octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body,
      });
      core.info("Created new review comment.");
    }
  }

  /**
   * Create a GitHub Pull Request Review with inline comments on specific lines.
   * Only posts comments for high-confidence issues (filtered by debate).
   */
  async createInlineReview(
    prNumber: number,
    comments: { path: string; line: number; body: string }[],
    summary: string,
    event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT",
  ): Promise<void> {
    if (comments.length === 0) {
      core.info("No inline comments to post.");
      return;
    }

    const { owner, repo } = this.context.repo;

    try {
      await this.octokit.rest.pulls.createReview({
        owner,
        repo,
        pull_number: prNumber,
        body: summary,
        event,
        comments: comments.map((c) => ({
          path: c.path,
          line: c.line,
          body: c.body,
        })),
      });
      core.info(`Posted ${comments.length} inline review comment(s).`);
    } catch (error) {
      // If inline comments fail (e.g., line not in diff), fall back silently
      core.warning(
        `Failed to post some inline comments: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Apply a label to the PR. Creates the label if it doesn't exist.
   */
  async applyLabel(
    prNumber: number,
    labelName: string,
    color?: string,
  ): Promise<void> {
    const { owner, repo } = this.context.repo;

    // Ensure label exists
    try {
      await this.octokit.rest.issues.getLabel({ owner, repo, name: labelName });
    } catch {
      // Label doesn't exist, create it
      const labelColors: Record<string, string> = {
        "review:approved": "0E8A16",
        "review:changes-requested": "D93F0B",
        "review:needs-discussion": "FBCA04",
      };
      await this.octokit.rest.issues.createLabel({
        owner,
        repo,
        name: labelName,
        color: color || labelColors[labelName] || "EDEDED",
      });
    }

    // Remove any existing review labels
    const reviewLabels = [
      "review:approved",
      "review:changes-requested",
      "review:needs-discussion",
    ];
    const { data: currentLabels } =
      await this.octokit.rest.issues.listLabelsOnIssue({
        owner,
        repo,
        issue_number: prNumber,
      });

    for (const label of currentLabels) {
      if (reviewLabels.includes(label.name) && label.name !== labelName) {
        try {
          await this.octokit.rest.issues.removeLabel({
            owner,
            repo,
            issue_number: prNumber,
            name: label.name,
          });
        } catch {
          // Label might not exist, ignore
        }
      }
    }

    // Apply the new label
    await this.octokit.rest.issues.addLabels({
      owner,
      repo,
      issue_number: prNumber,
      labels: [labelName],
    });

    core.info(`Applied label: ${labelName}`);
  }
}
