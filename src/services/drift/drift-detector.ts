/**
 * Pattern-based architectural drift detection.
 * For each architecture rule with pathPattern + forbiddenPattern, check added lines in matching files.
 */
import type { SentinelConfig } from '../../config/index.js';
import type { ParsedDiff } from '../diff/types.js';
import type { DriftFinding } from './types.js';

function pathMatchesRule(filePath: string, pathPattern: string): boolean {
  const n = filePath.replace(/\\/g, '/');
  const p = pathPattern.replace(/\\/g, '/').replace(/\*\*$/, '').replace(/\*$/, '');
  return n === p || n.startsWith(p + '/') || n.includes('/' + p + '/');
}

/**
 * Detect drift: for each architecture rule that has pathPattern and forbiddenPattern,
 * check files matching pathPattern for added lines matching the regex.
 */
export function detectDrift(parsed: ParsedDiff, config: SentinelConfig): DriftFinding[] {
  const findings: DriftFinding[] = [];
  const rules = config.architecture ?? [];
  if (rules.length === 0) return findings;

  for (const file of parsed.files) {
    for (const rule of rules) {
      if (!rule.pathPattern || !rule.forbiddenPattern) continue;
      if (!pathMatchesRule(file.path, rule.pathPattern)) continue;

      let regex: RegExp;
      try {
        regex = new RegExp(rule.forbiddenPattern);
      } catch {
        continue;
      }

      for (const hunk of file.hunks) {
        for (const line of hunk.lines) {
          if (line.type !== 'add') continue;
          if (regex.test(line.content)) {
            findings.push({
              path: file.path,
              ruleName: rule.name,
              message: rule.description ?? `Added line matches forbidden pattern: ${rule.name}`,
            });
            break; // one finding per rule per file
          }
        }
      }
    }
  }
  return findings;
}
