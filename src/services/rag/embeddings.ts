/**
 * Embed text using Google Gemini (text-embedding-004 / embedding-001). Returns null if GOOGLE_API_KEY is unset.
 */
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';

const MAX_TEXT_LENGTH = 8000; // keep under typical token limit for embedding

let model: GoogleGenerativeAIEmbeddings | null = null;

function getModel(): GoogleGenerativeAIEmbeddings | null {
  if (model !== null) return model;
  const key = process.env.GOOGLE_API_KEY;
  if (!key?.trim()) return null;
  model = new GoogleGenerativeAIEmbeddings({
    model: 'text-embedding-004',
    apiKey: key,
  });
  return model;
}

/**
 * Embed a single text. Truncates to MAX_TEXT_LENGTH. Returns null if disabled or on error.
 */
export async function embedText(text: string): Promise<number[] | null> {
  const m = getModel();
  if (!m) return null;
  const truncated = text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text;
  try {
    return await m.embedQuery(truncated);
  } catch {
    return null;
  }
}
