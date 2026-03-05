/**
 * Rule engine: evaluate a parsed diff against sentinel config and produce violations.
 *
 * Rules we enforce:
 * 1. Sensitive paths — if any changed file path matches a sensitivePaths prefix, flag it.
 * 2. Allowed libraries — any added line that looks like an import must use an allowed
 *    package (exact match or prefix match, e.g. "node:" for built-ins).
 */
import type { SentinelConfig } from '../config/index.js';
import type { ParsedDiff, ParsedFile } from '../services/diff/types.js';
import type { Violation } from './types.js';

/** Extract package name from import/require. Returns null if line is not an import. */
function extractImportPackage(line: string): string | null {
  // import X from 'pkg' or import 'pkg' or import { a } from "pkg"
  const fromMatch = line.match(/from\s+['"]([^'"]+)['"]/);
  if (fromMatch) return fromMatch[1]!;
  // require('pkg') or require("pkg")
  const reqMatch = line.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
  if (reqMatch) return reqMatch[1]!;
  // dynamic import(): we could add later
  return null;
}

/** Check if package is allowed: exact match or prefix match (e.g. "node:"). */
function isPackageAllowed(pkg: string, allowed: string[]): boolean {
  if (allowed.length === 0) return true; // no restriction
  for (const a of allowed) {
    if (a === pkg) return true;
    if (a.endsWith(':') && pkg.startsWith(a)) return true; // e.g. "node:fs"
    if (a.endsWith('*') && pkg.startsWith(a.slice(0, -1))) return true;
  }
  return false;
}

/** Normalize path: consistent slashes, no leading ./. */
function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '');
}

/** Check if file path is under or equals any sensitive path. */
function isSensitivePath(filePath: string, sensitivePaths: string[]): boolean {
  const normalized = normalizePath(filePath);
  for (const prefix of sensitivePaths) {
    const p = normalizePath(prefix).replace(/\/$/, '');
    if (normalized === p || normalized.startsWith(p + '/')) return true;
    if (normalized.includes('/' + p + '/') || normalized.endsWith('/' + p)) return true;
  }
  return false;
}

/** Collect violations for a single file's added lines (disallowed imports). */
function checkAddedLines(file: ParsedFile, config: SentinelConfig): Violation[] {
  const violations: Violation[] = [];
  const allowed = config.allowedLibraries;
  if (allowed.length === 0) return violations;

  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      if (line.type !== 'add') continue;
      const pkg = extractImportPackage(line.content);
      if (pkg == null) continue;
      if (pkg.startsWith('.')) continue; // relative imports are not library imports
      if (!isPackageAllowed(pkg, allowed)) {
        violations.push({
          code: 'disallowed_library',
          message: `Disallowed import: "${pkg}". Allowed: ${allowed.join(', ')}.`,
          path: file.path,
          line: line.lineNumber,
        });
      }
    }
  }
  return violations;
}

/**
 * Run all rules against the parsed diff. Returns a flat list of violations.
 */
export function evaluateRules(config: SentinelConfig, diff: ParsedDiff): Violation[] {
  const violations: Violation[] = [];

  for (const file of diff.files) {
    if (isSensitivePath(file.path, config.sensitivePaths)) {
      violations.push({
        code: 'sensitive_path',
        message: `Changes in sensitive path: ${file.path}`,
        path: file.path,
      });
    }
    violations.push(...checkAddedLines(file, config));
  }

  return violations;
}
