/**
 * Optional PostgreSQL connection for storing run metrics.
 * If DATABASE_URL is unset, getPool() returns null and no storage is performed.
 */
import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool | null {
  if (pool !== null) return pool;
  const url = process.env.DATABASE_URL;
  if (!url?.trim()) return null;
  pool = new Pool({ connectionString: url, max: 5 });
  return pool;
}

const EMBEDDING_DIM = 768; // Google text-embedding-004

export async function initSchema(p: pg.Pool): Promise<void> {
  await p.query(`
    CREATE TABLE IF NOT EXISTS runs (
      id SERIAL PRIMARY KEY,
      repo_owner VARCHAR(255) NOT NULL,
      repo_name VARCHAR(255) NOT NULL,
      pr_number INTEGER NOT NULL,
      risk_score INTEGER NOT NULL,
      violation_count INTEGER NOT NULL DEFAULT 0,
      drift_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  try {
    await p.query('CREATE EXTENSION IF NOT EXISTS vector');
    await p.query(`
      CREATE TABLE IF NOT EXISTS pr_embeddings (
        id SERIAL PRIMARY KEY,
        repo_owner VARCHAR(255) NOT NULL,
        repo_name VARCHAR(255) NOT NULL,
        pr_number INTEGER NOT NULL,
        content TEXT NOT NULL,
        embedding vector(${EMBEDDING_DIM}) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  } catch (err) {
    console.warn('pgvector/pr_embeddings init skipped (extension or table failed):', (err as Error).message);
  }
}
