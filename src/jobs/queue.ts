/**
 * BullMQ queue for PR analysis jobs.
 * Redis URL from env REDIS_URL (default: redis://localhost:6379).
 */
import { Queue, Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';
import { prAnalysisProcessor } from './pr-analysis-job.js';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

export const PR_ANALYSIS_QUEUE_NAME = 'sentinel-pr-analysis';

export const prAnalysisQueue = new Queue(PR_ANALYSIS_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { count: 100 },
  },
});

export function createPrAnalysisWorker(): Worker<PrAnalysisJobData, unknown, 'analyze'> {
  return new Worker<PrAnalysisJobData, unknown, 'analyze'>(
    PR_ANALYSIS_QUEUE_NAME,
    async (job) => prAnalysisProcessor(job),
    { connection, concurrency: 2 }
  );
}

export type PrAnalysisJobData = {
  owner: string;
  repo: string;
  pullNumber: number;
  base: string;
  head: string;
};

export async function addPrAnalysisJob(data: PrAnalysisJobData): Promise<Job> {
  const jobId = `pr-${data.owner}-${data.repo}-${data.pullNumber}`;
  return prAnalysisQueue.add('analyze', data, { jobId });
}
