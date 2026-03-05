/**
 * Minimal GitHub REST client for Sentinel-Diff.
 * Uses GITHUB_TOKEN from env. All requests go to https://api.github.com.
 */

const GITHUB_API = 'https://api.github.com';

function getHeaders(): HeadersInit {
  const token = process.env.GITHUB_TOKEN;
  return {
    Accept: 'application/vnd.github.v3+json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Fetch the diff between two refs (e.g. base and head).
 * GET /repos/:owner/:repo/compare/:base...:head with Accept: application/vnd.github.diff
 * Returns the raw diff text (same format as git diff).
 */
export async function fetchCompareDiff(
  owner: string,
  repo: string,
  base: string,
  head: string
): Promise<string> {
  const url = `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`;
  const res = await fetch(url, {
    headers: { ...getHeaders(), Accept: 'application/vnd.github.diff' },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub compare failed ${res.status}: ${body}`);
  }
  return res.text();
}

/**
 * Post a comment on a PR (issue comment).
 * POST /repos/:owner/:repo/issues/:issue_number/comments
 */
export async function postPRComment(
  owner: string,
  repo: string,
  pullNumber: number,
  body: string
): Promise<{ id: number; body: string }> {
  const url = `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${pullNumber}/comments`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...getHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub post comment failed ${res.status}: ${text}`);
  }
  const data = (await res.json()) as { id: number; body: string };
  return data;
}
