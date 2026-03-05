/**
 * A single architectural drift finding.
 */
export interface DriftFinding {
  /** File path that triggered the finding */
  path: string;
  /** Rule name from config (e.g. "Controllers must not access DB") */
  ruleName: string;
  /** Short message (e.g. "Added line matches forbidden pattern: direct DB access") */
  message: string;
}
