/**
 * A single rule violation: what was broken, where, and a short message.
 * The risk scorer and PR comment will consume this list.
 */
export interface Violation {
  /** Machine-friendly code (e.g. "sensitive_path", "disallowed_library"). */
  code: string;
  /** Human-readable message. */
  message: string;
  /** File path that triggered the violation. */
  path: string;
  /** Line number in the new file (if applicable). */
  line?: number;
}
