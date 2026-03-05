/**
 * Build the PR comment body (Markdown) from the Sentinel report.
 * Includes risk score, violations, optional drift findings, summary, and recommendations.
 */
import type { Violation } from '../rules/types.js';
import type { RiskResult } from '../services/risk/types.js';
import type { DriftFinding } from '../services/drift/types.js';
import type { SentinelConfig } from '../config/index.js';

export interface CommentInput {
  risk: RiskResult;
  violations: Violation[];
  driftFindings?: DriftFinding[];
  summary?: string;
  overview?: string;
  themes?: string[];
  driftNarrative?: string;
  pastContextSummary?: string;
  quickWins?: string[];
  longTermImprovements?: string[];
  risks?: string[];
  recommendations?: string[];
  config: SentinelConfig;
}

/**
 * Format a single violation as a list item.
 */
function formatViolation(v: Violation): string {
  const loc = v.line != null ? ` (line ${v.line})` : '';
  return `- **${v.path}**${loc}: ${v.message}`;
}

/**
 * Build Markdown for the PR comment.
 * Optional strict-mode note when risk exceeds threshold.
 */
export function buildPRComment(input: CommentInput): string {
  const {
    risk,
    violations,
    driftFindings,
    summary,
    overview,
    themes,
    driftNarrative,
    pastContextSummary,
    quickWins,
    longTermImprovements,
    risks,
    recommendations,
    config,
  } = input;
  const lines: string[] = [];

  lines.push('## Sentinel-Diff Report');
  lines.push('');

  const threshold = config.riskThreshold ?? null;
  const overThreshold = threshold != null && risk.score > threshold;
  if (overThreshold) {
    lines.push(`> **Strict mode:** Risk score **${risk.score}** exceeds threshold **${threshold}**. Consider addressing issues before merge.`);
    lines.push('');
  }

  if (overview) {
    lines.push('### Overview');
    lines.push('');
    lines.push(overview);
    lines.push('');
  }

  lines.push(`### Risk score: ${risk.score}/10`);
  lines.push('');
  risk.factors.forEach((f) => lines.push(`- ${f}`));
  lines.push('');

  if (violations.length > 0) {
    lines.push('### Violations');
    lines.push('');
    violations.map(formatViolation).forEach((s) => lines.push(s));
    lines.push('');
  }

  if (driftFindings && driftFindings.length > 0) {
    lines.push('### Architectural drift');
    lines.push('');
    driftFindings.forEach((d) => lines.push(`- **${d.path}** (${d.ruleName}): ${d.message}`));
    lines.push('');
  }

  if (driftNarrative) {
    lines.push('### Drift overview');
    lines.push('');
    lines.push(driftNarrative);
    lines.push('');
  }

  if (themes && themes.length > 0) {
    lines.push('### Themes');
    lines.push('');
    themes.forEach((t) => lines.push(`- ${t}`));
    lines.push('');
  }

  if (summary) {
    lines.push('### Summary');
    lines.push('');
    lines.push(summary);
    lines.push('');
  }

  if (pastContextSummary) {
    lines.push('### Past context & patterns');
    lines.push('');
    lines.push(pastContextSummary);
    lines.push('');
  }

  if (risks && risks.length > 0) {
    lines.push('### Risks');
    lines.push('');
    risks.forEach((r) => lines.push(`- ${r}`));
    lines.push('');
  }

  if (recommendations && recommendations.length > 0) {
    lines.push('### Recommendations');
    lines.push('');
    recommendations.forEach((r) => lines.push(`- ${r}`));
    lines.push('');
  }

  if (quickWins && quickWins.length > 0) {
    lines.push('### Quick wins');
    lines.push('');
    quickWins.forEach((q) => lines.push(`- ${q}`));
    lines.push('');
  }

  if (longTermImprovements && longTermImprovements.length > 0) {
    lines.push('### Longer-term improvements');
    lines.push('');
    longTermImprovements.forEach((i) => lines.push(`- ${i}`));
    lines.push('');
  }

  lines.push('---');
  lines.push('*Powered by Sentinel-Diff*');
  return lines.join('\n');
}
