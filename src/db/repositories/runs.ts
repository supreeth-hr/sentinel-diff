import type { Pool } from 'pg';

export interface RunRow {
  id: number;
  repo_owner: string;
  repo_name: string;
  pr_number: number;
  risk_score: number;
  violation_count: number;
  drift_count: number;
  created_at: Date;
}

export interface InsertRunInput {
  repoOwner: string;
  repoName: string;
  prNumber: number;
  riskScore: number;
  violationCount: number;
  driftCount: number;
}

export async function insertRun(pool: Pool, input: InsertRunInput): Promise<void> {
  await pool.query(
    `INSERT INTO runs (repo_owner, repo_name, pr_number, risk_score, violation_count, drift_count)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      input.repoOwner,
      input.repoName,
      input.prNumber,
      input.riskScore,
      input.violationCount,
      input.driftCount,
    ]
  );
}

export interface GetRunsFilters {
  repo?: string; // "owner/name"
  since?: string; // ISO date
}

export async function getRuns(pool: Pool, filters: GetRunsFilters = {}): Promise<RunRow[]> {
  let query = 'SELECT id, repo_owner, repo_name, pr_number, risk_score, violation_count, drift_count, created_at FROM runs WHERE 1=1';
  const params: unknown[] = [];
  let i = 1;
  if (filters.repo) {
    const [owner, name] = filters.repo.split('/');
    if (owner && name) {
      query += ` AND repo_owner = $${i} AND repo_name = $${i + 1}`;
      params.push(owner, name);
      i += 2;
    }
  }
  if (filters.since) {
    query += ` AND created_at >= $${i}`;
    params.push(filters.since);
    i += 1;
  }
  query += ' ORDER BY created_at DESC LIMIT 200';
  const result = await pool.query(query, params);
  return result.rows as RunRow[];
}
