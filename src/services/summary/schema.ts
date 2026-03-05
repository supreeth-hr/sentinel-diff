import { z } from 'zod';

export const aiSummaryOutputSchema = z.object({
  summary: z.string().describe('Short human-readable summary of what changed and its impact'),
  risks: z.array(z.string()).describe('Bullet points of potential risks or concerns'),
  recommendations: z.array(z.string()).describe('Suggested improvements or actions'),
  overview: z
    .string()
    .optional()
    .describe('High-level overview of the PR: scope, main areas touched, and intent'),
  themes: z
    .array(z.string())
    .optional()
    .describe('High-level themes grouping violations and risks (e.g. auth, data access, tests)'),
  driftNarrative: z
    .string()
    .optional()
    .describe('Narrative explanation of architectural drift and how this PR deviates from the intended architecture'),
  pastContextSummary: z
    .string()
    .optional()
    .describe('Summary of how this PR relates to similar past PRs and patterns, based on retrieved context'),
  quickWins: z
    .array(z.string())
    .optional()
    .describe('Short list of concrete, high-impact fixes that can be done before merge'),
  longTermImprovements: z
    .array(z.string())
    .optional()
    .describe('Longer-term refactors or improvements suggested by the analysis'),
});

export type AISummaryOutput = z.infer<typeof aiSummaryOutputSchema>;
