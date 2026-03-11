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

  getPRNumber(): number {
    const prNumber = this.context.payload.pull_request?.number;
    if (!prNumber) {
      throw new Error("This action must be triggered by a pull_request event.");
    }
    return prNumber;
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
