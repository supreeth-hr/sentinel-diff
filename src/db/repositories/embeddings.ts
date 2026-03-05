/**
 * Store and retrieve PR context embeddings for RAG (pgvector).
 */
import type { Pool } from 'pg';
import { toSql } from 'pgvector';

export interface InsertEmbeddingInput {
  repoOwner: string;
  repoName: string;
  prNumber: number;
  content: string;
  embedding: number[];
}

export async function insertPrEmbedding(pool: Pool, input: InsertEmbeddingInput): Promise<void> {
  const embeddingStr = toSql(input.embedding);
  await pool.query(
    `INSERT INTO pr_embeddings (repo_owner, repo_name, pr_number, content, embedding)
     VALUES ($1, $2, $3, $4, $5::vector)`,
    [input.repoOwner, input.repoName, input.prNumber, input.content, embeddingStr]
  );
}

export interface FindSimilarOptions {
  repoOwner?: string;
  repoName?: string;
  limit?: number;
}

export async function findSimilar(
  pool: Pool,
  embedding: number[],
  options: FindSimilarOptions = {}
): Promise<{ content: string }[]> {
  const limit = Math.min(options.limit ?? 3, 10);
  const embeddingStr = toSql(embedding);
  const params: unknown[] = [embeddingStr, limit];
  let where = '';
  let paramIndex = 3;
  if (options.repoOwner) {
    where += ` AND repo_owner = $${paramIndex}`;
    params.push(options.repoOwner);
    paramIndex += 1;
  }
  if (options.repoName) {
    where += ` AND repo_name = $${paramIndex}`;
    params.push(options.repoName);
    paramIndex += 1;
  }
  const result = await pool.query(
    `SELECT content FROM pr_embeddings WHERE 1=1 ${where}
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    params
  );
  return result.rows as { content: string }[];
}
