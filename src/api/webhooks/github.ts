/**
 * GitHub PR webhook: verify signature, parse payload, enqueue PR analysis job.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { addPrAnalysisJob } from '../../jobs/queue.js';

const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET ?? '';

function verifySignature(payload: string, signature: string | undefined): boolean {
  if (!WEBHOOK_SECRET || !signature || !signature.startsWith('sha256=')) return false;
  const expected = 'sha256=' + createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');
  if (expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(signature, 'utf8'));
}

interface GitHubPRPayload {
  action?: string;
  pull_request?: {
    number: number;
    base: { ref: string };
    head: { ref: string };
  };
  repository?: {
    owner: { login: string };
    name: string;
  };
}

export async function registerGitHubWebhook(app: FastifyInstance): Promise<void> {
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    done(null, body as string);
  });

  app.post('/webhooks/github', async (request: FastifyRequest<{ Body: string }>, reply: FastifyReply) => {
    const rawBody = typeof request.body === 'string' ? request.body : JSON.stringify(request.body ?? '');
    const signature = request.headers['x-hub-signature-256'] as string | undefined;

    if (!verifySignature(rawBody, signature)) {
      return reply.status(401).send({ error: 'Invalid signature' });
    }

    let payload: GitHubPRPayload;
    try {
      payload = JSON.parse(rawBody) as GitHubPRPayload;
    } catch {
      return reply.status(400).send({ error: 'Invalid JSON' });
    }

    const action = payload.action;
    if (action !== 'opened' && action !== 'synchronize') {
      return reply.code(200).send({ ok: true, skipped: 'ignored action' });
    }

    const pr = payload.pull_request;
    const repo = payload.repository;
    if (!pr || !repo) {
      return reply.status(400).send({ error: 'Missing pull_request or repository' });
    }

    const owner = repo.owner.login;
    const repoName = repo.name;
    const pullNumber = pr.number;
    const base = pr.base.ref;
    const head = pr.head.ref;

    try {
      await addPrAnalysisJob({ owner, repo: repoName, pullNumber, base, head });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      request.log.error(err, 'Failed to enqueue PR analysis');
      return reply.status(500).send({
        error: 'Failed to enqueue job',
        detail: message.includes('ECONNREFUSED') ? 'Redis unreachable. Start Redis (e.g. brew services start redis).' : message,
      });
    }

    return reply.code(202).send({ ok: true, job: 'queued' });
  });
}
