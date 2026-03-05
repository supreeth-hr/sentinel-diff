/**
 * Sentinel config schema (Zod).
 *
 * Why Zod? It validates at runtime and gives us a typed object. If the YAML
 * has a typo (e.g. "sensitivePath" instead of "sensitivePaths") or wrong types,
 * we get a clear error message instead of undefined behavior later.
 */
import { z } from 'zod';

/** Optional architecture layer rules for drift detection. */
export const architectureRuleSchema = z.object({
  /** Display name, e.g. "Controller must not access DB" */
  name: z.string(),
  /** Path prefix where this rule applies, e.g. "src/controllers" */
  pathPattern: z.string().optional(),
  /** Human-readable rule description */
  description: z.string().optional(),
  /** If set, drift is reported when an added line matches this regex (e.g. "import.*from.*['\"]\.*\/.*db" for DB access). */
  forbiddenPattern: z.string().optional(),
});

export type ArchitectureRule = z.infer<typeof architectureRuleSchema>;

export const sentinelConfigSchema = z.object({
  /** Package names (or patterns) that are allowed. Others will be flagged. */
  allowedLibraries: z.array(z.string()).default([]),
  /** Path prefixes that are considered sensitive (e.g. auth/, payment/). Touching these increases risk. */
  sensitivePaths: z.array(z.string()).default([]),
  /** Max risk score (1–10) before "strict mode" fails CI. Omit or null = no strict fail. */
  riskThreshold: z.number().min(1).max(10).nullable().optional(),
  /** Optional architecture rules for drift detection. */
  architecture: z.array(architectureRuleSchema).optional().default([]),
});

export type SentinelConfig = z.infer<typeof sentinelConfigSchema>;
