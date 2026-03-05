import type { ParsedDiff } from '../diff/types.js';
import type { Violation } from '../../rules/types.js';
import type { RiskResult } from '../risk/types.js';

const MAX_DIFF_CHARS = 6000;

/**
 * Build a short text context for the LLM: file list, violation list, risk factors, and a truncated diff.
 */
export function buildDiffContext(
  parsed: ParsedDiff,
  violations: Violation[],
  risk: RiskResult
): string {
  const lines: string[] = [];

  lines.push('## Files changed');
  for (const f of parsed.files) {
    lines.push(`- ${f.path} (+${f.additions}/-${f.deletions})`);
  }
  lines.push('');

  if (violations.length > 0) {
    lines.push('## Rule violations');
    violations.forEach((v) => lines.push(`- [${v.code}] ${v.path}: ${v.message}`));
    lines.push('');
  }

  lines.push('## Risk score: ' + risk.score + '/10');
  risk.factors.forEach((f) => lines.push('- ' + f));
  lines.push('');

  const diffSnippet = getDiffSnippet(parsed, MAX_DIFF_CHARS);
  lines.push('## Diff snippet (unified diff format)');
  lines.push(diffSnippet);

  return lines.join('\n');
}

function getDiffSnippet(parsed: ParsedDiff, maxChars: number): string {
  const parts: string[] = [];
  let len = 0;
  for (const f of parsed.files) {
    parts.push(`--- a/${f.path}`);
    parts.push(`+++ b/${f.path}`);
    for (const h of f.hunks) {
      if (len >= maxChars) break;
      parts.push(`@@ -${h.oldStart},${h.oldCount} +${h.newStart},${h.newCount} @@`);
      for (const line of h.lines) {
        const prefix = line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' ';
        const s = prefix + line.content + '\n';
        if (len + s.length > maxChars) break;
        parts.push(prefix + line.content);
        len += s.length;
      }
    }
  }
  return parts.join('\n').slice(0, maxChars);
}
