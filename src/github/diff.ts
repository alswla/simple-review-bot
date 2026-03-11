import { minimatch } from "minimatch";

export interface DiffFile {
  filename: string;
  additions: string[];
  deletions: string[];
  chunks: string;
}

/**
 * Parse a raw unified diff string into structured file-level diffs.
 */
export function parseDiff(rawDiff: string): DiffFile[] {
  const files: DiffFile[] = [];
  const fileDiffs = rawDiff.split(/^diff --git /m).filter(Boolean);

  for (const fileDiff of fileDiffs) {
    const filenameMatch = fileDiff.match(/b\/(.+?)(?:\n|$)/);
    if (!filenameMatch) continue;

    const filename = filenameMatch[1];
    const additions: string[] = [];
    const deletions: string[] = [];

    const lines = fileDiff.split("\n");
    for (const line of lines) {
      if (line.startsWith("+") && !line.startsWith("+++")) {
        additions.push(line.substring(1));
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        deletions.push(line.substring(1));
      }
    }

    files.push({
      filename,
      additions,
      deletions,
      chunks: fileDiff,
    });
  }

  return files;
}

/**
 * Filter out files that match ignore patterns.
 */
export function filterDiff(
  rawDiff: string,
  ignoreFiles: string[] = [],
  ignorePaths: string[] = [],
): string {
  const files = parseDiff(rawDiff);

  const filtered = files.filter((file) => {
    // Check file patterns
    for (const pattern of ignoreFiles) {
      if (minimatch(file.filename, pattern)) {
        return false;
      }
    }

    // Check path patterns
    for (const pattern of ignorePaths) {
      if (
        file.filename.startsWith(pattern) ||
        minimatch(file.filename, `${pattern}**`)
      ) {
        return false;
      }
    }

    return true;
  });

  if (filtered.length === 0) {
    return "";
  }

  // Reconstruct diff from filtered files
  return filtered.map((f) => `diff --git ${f.chunks}`).join("\n");
}
