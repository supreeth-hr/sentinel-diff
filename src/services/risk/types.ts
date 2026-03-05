/**
 * Result of the risk score computation: a 1-10 score and human-readable factors.
 */
export interface RiskResult {
  score: number;
  factors: string[];
}
