/**
 * Load and validate sentinel.config.yaml.
 *
 * We read from the repo root (or a path you pass). If the file is missing,
 * we return a default config so the tool still runs with no rules. If the file
 * exists but is invalid, we throw so the user gets a clear error.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import YAML from 'yaml';
import { sentinelConfigSchema, type SentinelConfig } from './schema.js';

const DEFAULT_CONFIG: SentinelConfig = {
  allowedLibraries: [],
  sensitivePaths: [],
  architecture: [],
};

/**
 * Load config from a path. If the file doesn't exist, returns default config.
 * If it exists but fails validation, throws with Zod's error message.
 */
export function loadConfig(configPath: string): SentinelConfig {
  const absolutePath = resolve(configPath);
  let raw: unknown;

  try {
    const content = readFileSync(absolutePath, 'utf-8');
    raw = YAML.parse(content);
  } catch (err) {
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr?.code === 'ENOENT') {
      return DEFAULT_CONFIG;
    }
    throw new Error(`Failed to read config at ${configPath}: ${(err as Error).message}`);
  }

  if (raw == null || typeof raw !== 'object') {
    return DEFAULT_CONFIG;
  }

  const result = sentinelConfigSchema.safeParse(raw);
  if (!result.success) {
    const msg = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid sentinel.config.yaml: ${msg}`);
  }
  return result.data;
}
