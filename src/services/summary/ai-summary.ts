/**
 * AI-generated PR summary using Groq (LLaMA) and LangChain.
 * Returns null if GROQ_API_KEY is unset or the request fails (caller keeps default behavior).
 */
import { ChatGroq } from '@langchain/groq';
import { aiSummaryOutputSchema, type AISummaryOutput } from './schema.js';
import { buildDiffContext } from './diff-context.js';
import type { ParsedDiff } from '../diff/types.js';
import type { Violation } from '../../rules/types.js';
import type { RiskResult } from '../risk/types.js';

const SYSTEM_PROMPT = `You are a senior code review assistant.

Given:
- a code diff (files changed, unified diff snippet)
- rule violations (codes, messages, paths, and lines)
- a computed risk score with human-readable risk factors
- optionally, similar past PR context

Produce a rich but concise analysis for a pull request, and output **valid JSON only** with these exact keys:
- summary (string): 2-4 sentence plain-language summary of what changed and its impact.
- risks (string[]): 0-5 bullet-style risk statements focused on what could go wrong.
- recommendations (string[]): 0-5 concrete, action-oriented suggestions.
- overview (string, optional): short high-level overview of the PR scope (size, main areas/directories, intent).
- themes (string[], optional): 1-5 short labels or sentences describing the main themes in the violations and risks (e.g. "Auth changes in sensitive paths", "Direct DB access from UI components").
- driftNarrative (string, optional): brief explanation of any architectural drift (how this PR diverges from the intended layering or boundaries).
- pastContextSummary (string, optional): short summary of how this PR relates to similar past PRs, based on the provided context (e.g. repeated patterns, regressions, or consistency concerns).
- quickWins (string[], optional): 0-5 very concrete, high-impact fixes that reviewers should prioritize before merge.
- longTermImprovements (string[], optional): 0-5 refactors or structural improvements that are valuable but not strictly required before merge.

Guidelines:
- Be specific: mention key files, modules, or layers when helpful.
- Do not restate the raw diff; instead, interpret it.
- Keep everything concise and skimmable.
- If some information is not relevant or you have nothing meaningful to say, omit optional fields rather than filling them with generic text.`;

export interface GenerateSummaryInput {
  parsed: ParsedDiff;
  violations: Violation[];
  risk: RiskResult;
  /** Optional: similar past PR context for RAG (injected into prompt). */
  similarContext?: string;
}

/**
 * Generate summary, risks, and recommendations from the LLM. Returns null if disabled or on error.
 */
export async function generateSummary(input: GenerateSummaryInput): Promise<AISummaryOutput | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key?.trim()) return null;

  const context = buildDiffContext(input.parsed, input.violations, input.risk);
  const userContent =
    input.similarContext?.trim()
      ? `${context}\n\n## Similar past PRs (for context)\n${input.similarContext}`
      : context;

  const model = new ChatGroq({
    model: 'llama-3.3-70b-versatile',
    temperature: 0,
    apiKey: key,
  });

  const structuredModel = model.withStructuredOutput(aiSummaryOutputSchema);

  try {
    const result = await structuredModel.invoke([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ]);
    console.log("Output from the AI", result);
    return result as AISummaryOutput;
  } catch {
    return null;
  }
}
