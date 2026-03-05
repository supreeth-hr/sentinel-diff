#!/usr/bin/env node
import 'dotenv/config';
/**
 * Sentinel-Diff CLI: run the same pipeline locally.
 *
 * Usage:
 *   npx tsx src/cli/analyze.ts [diff-file]   # analyze a .patch file
 *   git diff main | npx tsx src/cli/analyze.ts   # analyze piped diff (no args = stdin)
 *
 * Config: SENTINEL_CONFIG_PATH or ./sentinel.config.yaml
 * Output: violations, risk score, then the PR comment (Markdown).
 */
import { loadConfig } from '../config/index.js';
import { readDiffFromFile, readDiffFromStdin, parseUnifiedDiff } from '../services/diff/index.js';
import { evaluateRules } from '../rules/index.js';
import { computeRiskScore } from '../services/risk/index.js';
import { detectDrift } from '../services/drift/index.js';
import { generateSummary } from '../services/summary/index.js';
import { buildPRComment } from '../github/index.js';

const configPath = process.env.SENTINEL_CONFIG_PATH ?? 'sentinel.config.yaml';
const diffFile = process.argv[2]; // optional: path to .diff / .patch file

async function main(): Promise<void> {
  const rawDiff = diffFile
    ? await readDiffFromFile(diffFile)
    : await readDiffFromStdin();

  if (!rawDiff.trim()) {
    console.error('No diff input. Provide a file path or pipe a diff (e.g. git diff main | ...).');
    process.exit(1);
  }

  const config = loadConfig(configPath);
  const parsed = parseUnifiedDiff(rawDiff);

  console.log('Sentinel-Diff — local analysis');
  console.log('Files changed:', parsed.files.length);
  parsed.files.forEach((f) => console.log('  ', f.path, `(+${f.additions}/-${f.deletions})`));

  const violations = evaluateRules(config, parsed);
  console.log('\nViolations:', violations.length);
  violations.forEach((v) => console.log(`  [${v.code}] ${v.path}${v.line != null ? `:${v.line}` : ''} — ${v.message}`));

  const driftFindings = detectDrift(parsed, config);
  if (driftFindings.length > 0) {
    console.log('\nDrift:', driftFindings.length);
    driftFindings.forEach((d) => console.log(`  [${d.ruleName}] ${d.path} — ${d.message}`));
  }

  const risk = computeRiskScore(config, parsed, violations);
  console.log('\nRisk score:', risk.score, '/ 10');
  risk.factors.forEach((f) => console.log('  ', f));

  const aiSummary = await generateSummary({ parsed, violations, risk });
  const comment = buildPRComment({
    risk,
    violations,
    driftFindings: driftFindings.length > 0 ? driftFindings : undefined,
    config,
    summary: aiSummary?.summary,
    risks: aiSummary?.risks,
    recommendations:
      aiSummary?.recommendations?.length
        ? aiSummary.recommendations
        : violations.length > 0
          ? ['Address the violations above before merging.']
          : undefined,
  });

  console.log('\n--- PR comment (preview) ---\n');
  console.log(comment);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
