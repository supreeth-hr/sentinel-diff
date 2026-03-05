/**
 * Store PR context in pgvector and retrieve similar past PRs for RAG.
 */
import type { Pool } from 'pg';
import { insertPrEmbedding, findSimilar } from '../../db/repositories/embeddings.js';
import { embedText } from './embeddings.js';

export interface StorePrContextInput {
  owner: string;
  repo: string;
  prNumber: number;
  content: string;
}

/**
 * Embed content and store in pr_embeddings. No-op if pool missing, RAG disabled, or embed fails.
 */
export async function storePrContext(pool: Pool, input: StorePrContextInput): Promise<void> {
  const embedding = await embedText(input.content);
  if (!embedding) return;
  try {
    await insertPrEmbedding(pool, {
      repoOwner: input.owner,
      repoName: input.repo,
      prNumber: input.prNumber,
      content: input.content.slice(0, 10000),
      embedding,
    });
  } catch {
    // non-fatal: log in caller if needed
  }
}

export interface GetSimilarContextOptions {
  repoOwner?: string;
  repoName?: string;
  limit?: number;
}

/**
 * Get similar past PR context strings for the given content. Returns concatenated snippet for prompt.
 */
export async function getSimilarContext(
  pool: Pool,
  content: string,
  options: GetSimilarContextOptions = {}
): Promise<string> {
  const embedding = await embedText(content);
  if (!embedding) return '';
  const limit = options.limit ?? 3;
  const rows = await findSimilar(pool, embedding, {
    repoOwner: options.repoOwner,
    repoName: options.repoName,
    limit,
  });
  if (rows.length === 0) return '';
  return rows.map((r) => r.content).join('\n\n---\n\n');
}
