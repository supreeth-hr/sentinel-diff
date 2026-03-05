/**
 * Parse unified diff text into a structured ParsedDiff.
 *
 * Unified diff format (simplified):
 *   diff --git a/path b/path
 *   --- a/path
 *   +++ b/path
 *   @@ -oldStart,oldCount +newStart,newCount @@
 *   (lines: " " context, "-" removed, "+" added)
 *
 * We walk line-by-line and track current file + current hunk. When we see
 * a new "diff --git" or "---", we push the previous file and start a new one.
 */
import type { DiffLine, Hunk, ParsedDiff, ParsedFile } from './types.js';

const GIT_HEADER = /^diff --git a\/(.+?) b\/(.+?)(?:$| )/;
const OLD_FILE = /^--- a\/(.+?)(?:$| )/;
const NEW_FILE = /^\+\+\+ b\/(.+?)(?:$| )/;
const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

export function parseUnifiedDiff(diffText: string): ParsedDiff {
  const lines = diffText.split(/\r?\n/);
  const files: ParsedFile[] = [];
  let currentFile: ParsedFile | null = null;
  let currentHunk: Hunk | null = null;
  let newPath: string | null = null;
  let oldPath: string | null = null;

  function flushHunk(): void {
    if (currentFile && currentHunk) {
      currentFile.hunks.push(currentHunk);
      currentHunk = null;
    }
  }

  function flushFile(): void {
    flushHunk();
    if (currentFile) {
      files.push(currentFile);
      currentFile = null;
    }
    newPath = null;
    oldPath = null;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const gitMatch = line.match(GIT_HEADER);
    const oldMatch = line.match(OLD_FILE);
    const newMatch = line.match(NEW_FILE);
    const hunkMatch = line.match(HUNK_HEADER);

    if (gitMatch) {
      flushFile();
      oldPath = gitMatch[1] ?? null;
      newPath = gitMatch[2] ?? null;
      continue;
    }

    if (oldMatch) {
      oldPath = oldMatch[1] ?? null;
      continue;
    }

    if (newMatch) {
      newPath = newMatch[1] ?? null;
      if (newPath && !currentFile) {
        currentFile = {
          path: newPath,
          oldPath: oldPath ?? undefined,
          hunks: [],
          additions: 0,
          deletions: 0,
        };
      }
      continue;
    }

    if (hunkMatch) {
      flushHunk();
      if (!currentFile && newPath) {
        currentFile = {
          path: newPath,
          oldPath: oldPath ?? undefined,
          hunks: [],
          additions: 0,
          deletions: 0,
        };
      }
      const oldStart = parseInt(hunkMatch[1]!, 10);
      const oldCount = parseInt(hunkMatch[2] ?? '1', 10);
      const newStart = parseInt(hunkMatch[3]!, 10);
      const newCount = parseInt(hunkMatch[4] ?? '1', 10);
      currentHunk = {
        oldStart,
        oldCount,
        newStart,
        newCount,
        lines: [],
      };
      continue;
    }

    // Content line
    if (!currentHunk) continue;

    const first = line[0];
    const rest = first === ' ' || first === '-' || first === '+' ? line.slice(1) : line;
    let type: DiffLine['type'] = 'context';
    if (first === '+') {
      type = 'add';
      currentFile && (currentFile.additions += 1);
    } else if (first === '-') {
      type = 'del';
      currentFile && (currentFile.deletions += 1);
    } else {
      type = 'context';
    }

    let lineNumber: number | undefined;
    const addCount = currentHunk.lines.filter((l) => l.type === 'add').length;
    const delCount = currentHunk.lines.filter((l) => l.type === 'del').length;
    if (type === 'add') {
      lineNumber = currentHunk.newStart + addCount;
    } else if (type === 'del') {
      lineNumber = currentHunk.oldStart + delCount;
    }

    currentHunk.lines.push({ type, content: rest, lineNumber });
  }

  flushFile();
  return { files };
}
