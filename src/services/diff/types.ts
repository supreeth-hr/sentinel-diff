/**
 * Structured representation of a parsed diff.
 *
 * Unified diff format has:
 * - File headers (--- a/path, +++ b/path)
 * - Hunks: @@ -oldStart,oldCount +newStart,newCount @@
 * - Lines: " " (context), "-" (removed), "+" (added)
 *
 * We keep enough structure so the rule engine can answer: "which files changed?"
 * and "what lines were added?" (to scan for disallowed imports, etc.).
 */

export type DiffLineType = 'add' | 'del' | 'context';

export interface DiffLine {
  type: DiffLineType;
  /** Raw line content (no leading space/minus/plus). */
  content: string;
  /** 1-based line number in the new file (for additions) or old file (for deletions). */
  lineNumber?: number;
}

export interface Hunk {
  /** Start line in the old file. */
  oldStart: number;
  /** Number of lines in the old file. */
  oldCount: number;
  /** Start line in the new file. */
  newStart: number;
  /** Number of lines in the new file. */
  newCount: number;
  lines: DiffLine[];
}

export interface ParsedFile {
  /** Path as in the diff (e.g. "src/foo.ts" from "b/src/foo.ts"). */
  path: string;
  /** Old path if renamed (optional). */
  oldPath?: string;
  hunks: Hunk[];
  /** Total added lines in this file. */
  additions: number;
  /** Total removed lines in this file. */
  deletions: number;
}

export interface ParsedDiff {
  files: ParsedFile[];
}
