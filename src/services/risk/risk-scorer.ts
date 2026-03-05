/**
 * Deterministic risk scorer: combine diff size, sensitive path touches, and
 * violations into a 1-10 score and human-readable factors.
 */
import type { SentinelConfig } from '../../config/index.js';
import type { ParsedDiff } from '../diff/types.js';
import type { Violation } from '../../rules/types.js';
import type { RiskResult } from './types.js';

/** Base score from lines changed: 0-50 low, 50-200 medium, 200+ high. */
function baseScoreFromLines(totalLines: number): number {
  if (totalLines <= 50) return 1;
  if (totalLines <= 200) return 2;
  return 3;
}

/** Base score from file count: 1-3 low, 4-10 medium, 10+ high. */
function baseScoreFromFiles(fileCount: number): number {
  if (fileCount <= 3) return 0;
  if (fileCount <= 10) return 1;
  return 2;
}

/**
 * Compute risk score (1-10) and factors from config, diff, and violations.
 * Uses violations for sensitive_path count to avoid duplicating path-matching logic.
 */
export function computeRiskScore(
  _config: SentinelConfig,
  diff: ParsedDiff,
  violations: Violation[]
): RiskResult {
  const factors: string[] = [];

  const totalLines = diff.files.reduce((sum, f) => sum + f.additions + f.deletions, 0);
  const fileCount = diff.files.length;

  const baseFromLines = baseScoreFromLines(totalLines);
  const baseFromFiles = baseScoreFromFiles(fileCount);
  let score = baseFromLines + baseFromFiles;

  factors.push(`Change size: ${totalLines} lines, ${fileCount} file(s)`);

  const sensitiveCount = violations.filter((v) => v.code === 'sensitive_path').length;
  if (sensitiveCount > 0) {
    const add = Math.min(sensitiveCount, 3);
    score += add;
    factors.push(`Sensitive path(s) touched: ${sensitiveCount}`);
  }

  const otherViolations = violations.filter((v) => v.code !== 'sensitive_path').length;
  if (otherViolations > 0) {
    const add = Math.min(Math.ceil(otherViolations * 0.5), 3);
    score += add;
    factors.push(`${otherViolations} rule violation(s)`);
  }

  score = Math.max(1, Math.min(10, score));

  return { score, factors };
}
