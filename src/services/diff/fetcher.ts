/**
 * Get raw diff text from different sources.
 *
 * - File: read a .patch file or saved git diff output.
 * - Stdin: for CLI usage like `git diff | npx tsx src/cli/analyze.ts`.
 * - Later: GitHub API (compare base...head) will live here or in github/client.
 */
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';

export async function readDiffFromFile(filePath: string): Promise<string> {
  const absolutePath = resolve(filePath);
  const content = readFileSync(absolutePath, 'utf-8');
  return content;
}

/**
 * Read diff from stdin. Use when the user pipes e.g. `git diff` into the CLI.
 * Resolves when stdin ends (EOF).
 */
export function readDiffFromStdin(): Promise<string> {
  return new Promise((done, reject) => {
    const chunks: string[] = [];
    const rl = createInterface({ input: process.stdin, terminal: false });
    rl.on('line', (line) => chunks.push(line));
    rl.on('close', () => done(chunks.join('\n')));
    rl.on('error', reject);
  });
}
