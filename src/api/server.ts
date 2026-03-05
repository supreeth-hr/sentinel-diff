/**
 * Fastify API server: webhook, health, runs API, dashboard.
 */
import Fastify from 'fastify';
import { registerGitHubWebhook } from './webhooks/github.js';
import { registerRunsRoutes } from './routes/runs.js';
import { getDashboardHtml } from './dashboard-html.js';

export async function createServer(): Promise<Fastify.FastifyInstance> {
  const app = Fastify({ logger: true });

  app.get('/health', async (_, reply) => {
    return reply.send({ status: 'ok' });
  });

  await registerGitHubWebhook(app);
  await registerRunsRoutes(app);

  app.get('/dashboard', async (_, reply) => {
    return reply.type('text/html').send(getDashboardHtml());
  });

  return app;
}
