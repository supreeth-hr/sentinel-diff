/**
 * PR analysis job processor: fetch diff → parse → rules → risk → build comment → post.
 * Uses config from SENTINEL_CONFIG_PATH or sentinel.config.yaml.
 */
import type { Job } from 'bullmq';
import { loadConfig } from '../config/index.js';
import { parseUnifiedDiff } from '../services/diff/index.js';
import { evaluateRules } from '../rules/index.js';
import { computeRiskScore } from '../services/risk/index.js';
import { detectDrift } from '../services/drift/index.js';
import { buildPRComment } from '../github/index.js';
import { fetchCompareDiff, postPRComment } from '../github/client.js';
import { generateSummary } from '../services/summary/index.js';
import { buildDiffContext } from '../services/summary/diff-context.js';
import { getSimilarContext, storePrContext } from '../services/rag/index.js';
import { getPool } from '../db/client.js';
import { insertRun } from '../db/repositories/runs.js';
import type { PrAnalysisJobData } from './queue.js';

const configPath = process.env.SENTINEL_CONFIG_PATH ?? 'sentinel.config.yaml';
const ragEnabled = process.env.RAG_ENABLED === '1';
const ragTopK = Math.min(parseInt(process.env.RAG_TOP_K ?? '3', 10) || 3, 10);

export async function prAnalysisProcessor(job: Job<PrAnalysisJobData, unknown, 'analyze'>): Promise<void> {
  const { owner, repo, pullNumber, base, head } = job.data;

  const rawDiff = await fetchCompareDiff(owner, repo, base, head);
  const parsed = parseUnifiedDiff(rawDiff);
  const config = loadConfig(configPath);
  const violations = evaluateRules(config, parsed);
  const risk = computeRiskScore(config, parsed, violations);
  const driftFindings = detectDrift(parsed, config);

  const contextForRag = buildDiffContext(parsed, violations, risk);
  let similarContext = '';
  const poolForRag = getPool();
  if (ragEnabled && poolForRag) {
    try {
      similarContext = await getSimilarContext(poolForRag, contextForRag, {
        repoOwner: owner,
        repoName: repo,
        limit: ragTopK,
      });
    } catch (err) {
      job.log?.('RAG getSimilarContext failed: ' + String(err));
    }
  }

  const aiSummary = await generateSummary({
    parsed,
    violations,
    risk,
    similarContext: similarContext || undefined,
  });
  const body = buildPRComment({
    risk,
    violations,
    driftFindings: driftFindings.length > 0 ? driftFindings : undefined,
    config,
    overview: aiSummary?.overview,
    themes: aiSummary?.themes,
    driftNarrative: aiSummary?.driftNarrative,
    pastContextSummary: aiSummary?.pastContextSummary,
    quickWins: aiSummary?.quickWins,
    summary: aiSummary?.summary,
    risks: aiSummary?.risks,
    recommendations: aiSummary?.recommendations?.length
      ? aiSummary.recommendations
      : violations.length > 0
        ? ['Address the violations above before merging.']
        : undefined,
    longTermImprovements: aiSummary?.longTermImprovements,
  });

  await postPRComment(owner, repo, pullNumber, body);

  const pool = getPool();
  if (pool) {
    try {
      await insertRun(pool, {
        repoOwner: owner,
        repoName: repo,
        prNumber: pullNumber,
        riskScore: risk.score,
        violationCount: violations.length,
        driftCount: driftFindings.length,
      });
    } catch (err) {
      job.log?.('Failed to store run metrics: ' + String(err));
    }
    if (ragEnabled) {
      try {
        await storePrContext(pool, {
          owner,
          repo,
          prNumber: pullNumber,
          content: contextForRag,
        });
      } catch (err) {
        job.log?.('RAG storePrContext failed: ' + String(err));
      }
    }
  }
}
