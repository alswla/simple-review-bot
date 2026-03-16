export declare class GitHubClient {
    private octokit;
    private context;
    constructor(token?: string);
    /**
     * Get PR number from either pull_request or issue_comment event.
     */
    getPRNumber(): number;
    /**
     * Check if this is a re-review trigger from a comment.
     * Returns true if event is issue_comment AND body contains /review.
     */
    isReReviewTrigger(): boolean;
    getPRDiff(prNumber: number): Promise<string>;
    postComment(prNumber: number, body: string): Promise<void>;
    /**
     * Create a GitHub Pull Request Review with inline comments on specific lines.
     * Only posts comments for high-confidence issues (filtered by debate).
     */
    createInlineReview(prNumber: number, comments: {
        path: string;
        line: number;
        body: string;
    }[], summary: string, event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT"): Promise<void>;
    /**
     * Apply a label to the PR. Creates the label if it doesn't exist.
     */
    applyLabel(prNumber: number, labelName: string, color?: string): Promise<void>;
}
//# sourceMappingURL=client.d.ts.map