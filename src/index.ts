import 'dotenv/config';
/**
 * Sentinel-Diff entry point.
 * Starts Fastify API server and BullMQ worker for webhooks and PR analysis.
 */
async function main(): Promise<void> {
  const { createServer } = await import('./api/server.js');
  const { createPrAnalysisWorker } = await import('./jobs/queue.js');

  const app = await createServer();
  const worker = createPrAnalysisWorker();

  const port = Number(process.env.PORT) || 3000;
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`Sentinel-Diff API listening on http://0.0.0.0:${port}`);
  console.log('Webhook: POST /webhooks/github (set GITHUB_WEBHOOK_SECRET)');
  console.log('Worker running. Redis:', process.env.REDIS_URL ?? 'redis://localhost:6379');

  worker.on('failed', (job, err) => {
    console.error('Job failed', job?.id, err);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
