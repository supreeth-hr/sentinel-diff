import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getPool, initSchema } from '../../db/client.js';
import { getRuns } from '../../db/repositories/runs.js';

interface Querystring {
  repo?: string;
  since?: string;
}

export async function registerRunsRoutes(app: FastifyInstance): Promise<void> {
  const pool = getPool();
  if (!pool) {
    app.get('/api/runs', async (_req: FastifyRequest, reply: FastifyReply) => {
      return reply.send({ runs: [], message: 'DATABASE_URL not set' });
    });
    return;
  }

  try {
    await initSchema(pool);
  } catch (err) {
    app.log.error(err, 'Failed to init DB schema');
  }

  app.get<{ Querystring: Querystring }>('/api/runs', async (request: FastifyRequest<{ Querystring: Querystring }>, reply: FastifyReply) => {
    const { repo, since } = request.query;
    const runs = await getRuns(pool, { repo, since });
    return reply.send({ runs });
  });
}
