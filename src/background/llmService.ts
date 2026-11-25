import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import * as z from 'zod/v4';
import { API_BASE_URL } from '../shared/apiConfig';
import { normalizeContext, sha256Hex } from '../shared/hash';
import { isAppError, type AiExplanation, type AiModel, type AppError, type TargetLevel } from '../shared/types';
import { getOrFetch } from './cache';

/** Output shape; mirrors `AiExplanation` (checked at compile time below). */
export const AiExplanationSchema = z.object({
  lemma: z.string().describe('Base form of the term.'),
  ipa: z.string().describe('IPA pronunciation without surrounding slashes.'),
  partOfSpeech: z
    .string()
    .describe('For example "noun", "verb", "adjective", "idiom" or "phrasal verb".'),
  isIdiom: z.boolean().describe('True if the term is part of an idiom or phrasal verb here.'),
  register: z.enum(['neutral', 'informal', 'slang', 'formal', 'vulgar']),
  cefr: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).describe('How hard the term is for learners.'),
  shortDefinition: z.string().describe('At most 15 words.'),
  inContext: z.string().describe('What the term means in THIS subtitle line. At most 35 words.'),
  example: z.string().describe('A new, simple example sentence.'),
  simpler: z.string().describe('An easier synonym or paraphrase.'),
});

// Fails to compile if the schema and the shared type drift apart.
const _schemaMatchesType = (value: z.infer<typeof AiExplanationSchema>): AiExplanation => value;
void _schemaMatchesType;

// Adaptive thinking tokens count toward max_tokens, so leave room beyond the short JSON answer.
const MAX_TOKENS = 4096;
const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 1;

export interface ExplainInput {
  term: string;
  context: string;
  level: TargetLevel;
  pageTitle: string;
  model: AiModel;
  apiKey: string;
}

export function buildSystemPrompt(level: TargetLevel): string {
  return (
    `You explain English vocabulary to a learner at CEFR level ${level}. ` +
    'Explain the meaning the term has in the given subtitle context, not every dictionary sense. ' +
    "Use words at or below the learner's level in your explanations. " +
    'If the term is part of an idiom or phrasal verb in the context, explain the whole expression, ' +
    'and set isIdiom to true. ' +
    'Keep shortDefinition to at most 15 words and inContext to at most 35 words. ' +
    'Return only the requested fields.'
  );
}

export function buildUserMessage(term: string, context: string, pageTitle: string): string {
  return `Term: "${term}"\nSubtitle context: "${context}"\nShow: ${pageTitle}`;
}

/** Maps SDK and guard errors to the app's error codes. Never includes request details. */
export function mapAnthropicError(err: unknown): AppError {
  if (isAppError(err)) return err;
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return { code: 'INVALID_KEY', message: 'The API key was rejected.' };
  }
  if (err instanceof Anthropic.RateLimitError) {
    return { code: 'RATE_LIMIT', message: 'Too many requests.' };
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return { code: 'NETWORK', message: 'Could not reach the AI service.' };
  }
  return { code: 'UNKNOWN', message: 'The AI service could not explain this.' };
}

/** One uncached request to Claude. Throws an `AppError`. */
export async function callClaude(input: ExplainInput): Promise<AiExplanation> {
  const client = new Anthropic({
    apiKey: input.apiKey,
    // Explicit (see shared/apiConfig.ts), so the key only ever goes to the configured host.
    baseURL: API_BASE_URL,
    // Required in browser-like contexts (a service worker). Acceptable here: the key is the user's own,
    // stays in the service worker, and is only ever sent to api.anthropic.com.
    dangerouslyAllowBrowser: true,
    maxRetries: MAX_RETRIES,
    timeout: TIMEOUT_MS,
  });

  let response;
  try {
    response = await client.messages.parse({
      model: input.model,
      max_tokens: MAX_TOKENS,
      system: buildSystemPrompt(input.level),
      messages: [
        { role: 'user', content: buildUserMessage(input.term, input.context, input.pageTitle) },
      ],
      output_config: { format: zodOutputFormat(AiExplanationSchema), effort: 'low' },
    });
  } catch (err) {
    throw mapAnthropicError(err);
  }

  if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') {
    throw { code: 'UNKNOWN', message: 'The AI service did not finish its answer.' } satisfies AppError;
  }
  const parsed = response.parsed_output;
  if (!parsed) {
    throw { code: 'UNKNOWN', message: 'The AI service returned an unreadable answer.' } satisfies AppError;
  }
  return parsed;
}

/**
 * Cached explanation. Key: SHA-256 of term + context + learner level + model, so changing the level
 * or model gives a fresh answer while repeating a lookup is free.
 */
export async function explain(input: ExplainInput): Promise<AiExplanation> {
  const key =
    'ai:' +
    (await sha256Hex(
      [input.term.toLowerCase(), normalizeContext(input.context), input.level, input.model].join('|'),
    ));
  return getOrFetch<AiExplanation>(key, () => callClaude(input));
}

/** Checks that a key works with a tiny request (never cached). */
export async function testKey(apiKey: string, model: AiModel): Promise<void> {
  await callClaude({
    term: 'hello',
    context: 'Hello there, how are you?',
    level: 'B2',
    pageTitle: 'Key test',
    model,
    apiKey,
  });
}
