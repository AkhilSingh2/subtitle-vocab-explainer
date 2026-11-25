import Anthropic from '@anthropic-ai/sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildSystemPrompt,
  buildUserMessage,
  callClaude,
  explain,
  mapAnthropicError,
  testKey,
  type ExplainInput,
} from '../src/background/llmService';
import { API_BASE_URL } from '../src/shared/apiConfig';
import type { AiExplanation } from '../src/shared/types';
import { chromeMock } from './setup';

const explanation: AiExplanation = {
  lemma: 'reluctant',
  ipa: 'rɪˈlʌktənt',
  partOfSpeech: 'adjective',
  isIdiom: false,
  register: 'neutral',
  cefr: 'C1',
  shortDefinition: 'Not wanting to do something.',
  inContext: 'He did not want to leave the party.',
  example: 'I was reluctant to go.',
  simpler: 'unwilling',
};

const input: ExplainInput = {
  term: 'reluctant',
  context: 'He was reluctant to leave.',
  level: 'C1',
  pageTitle: 'My Show',
  model: 'claude-opus-5-5',
  apiKey: 'sk-ant-test-key',
};

function messageResponse(overrides: Record<string, unknown> = {}, text: string = JSON.stringify(explanation)): Response {
  return new Response(
    JSON.stringify({
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      model: 'claude-opus-5-5',
      content: [{ type: 'text', text }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 20 },
      ...overrides,
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

const errorResponse = (status: number): Response =>
  new Response(JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'nope' } }), {
    status,
    headers: { 'content-type': 'application/json', 'x-should-retry': 'false' },
  });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(async () => messageResponse());
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const requestBody = (): Record<string, unknown> => {
  const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
  return JSON.parse(init.body as string) as Record<string, unknown>;
};

describe('prompts', () => {
  it('system prompt names the learner level and the required behaviour', () => {
    const prompt = buildSystemPrompt('C1');
    expect(prompt).toContain('CEFR level C1');
    expect(prompt).toContain('in the given subtitle context, not every dictionary sense');
    expect(prompt).toContain('set isIdiom to true');
    expect(prompt).toContain('at most 15 words');
    expect(prompt).toContain('at most 35 words');
    expect(prompt).toContain('Return only the requested fields.');
  });

  it('user message has the term, the context and the show', () => {
    expect(buildUserMessage('break the ice', 'He broke the ice.', 'The Office')).toBe(
      'Term: "break the ice"\nSubtitle context: "He broke the ice."\nShow: The Office',
    );
  });
});

describe('callClaude (real SDK, stubbed network)', () => {
  it('returns the parsed explanation', async () => {
    expect(await callClaude(input)).toEqual(explanation);
  });

  it('sends the documented request and nothing these models reject', async () => {
    await callClaude(input);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${API_BASE_URL}/v1/messages`);

    const headers = new Headers(init.headers);
    expect(headers.get('x-api-key')).toBe('sk-ant-test-key');
    expect(headers.get('anthropic-dangerous-direct-browser-access')).toBe('true');

    const body = requestBody();
    expect(body['model']).toBe('claude-opus-5-5');
    expect(body['max_tokens']).toBe(4096);
    expect(body['system']).toContain('CEFR level C1');
    expect(body['messages']).toEqual([
      { role: 'user', content: 'Term: "reluctant"\nSubtitle context: "He was reluctant to leave."\nShow: My Show' },
    ]);
    const outputConfig = body['output_config'] as { effort: string; format: { type: string } };
    expect(outputConfig.effort).toBe('low');
    expect(outputConfig.format.type).toBe('json_schema');

    for (const forbidden of ['temperature', 'top_p', 'top_k', 'thinking', 'tool_choice', 'tools']) {
      expect(body, forbidden).not.toHaveProperty(forbidden);
    }
    // never prefill: the last message must be from the user
    expect((body['messages'] as Array<{ role: string }>).at(-1)?.role).toBe('user');
  });

  it('uses the selected model', async () => {
    await callClaude({ ...input, model: 'claude-haiku-5-5' });
    expect(requestBody()['model']).toBe('claude-haiku-5-5');
  });

  it.each([
    [401, 'INVALID_KEY'],
    [403, 'INVALID_KEY'],
    [429, 'RATE_LIMIT'],
    [500, 'UNKNOWN'],
    [400, 'UNKNOWN'],
  ])('maps HTTP %i to %s', async (status, code) => {
    fetchMock.mockResolvedValue(errorResponse(status));
    await expect(callClaude(input)).rejects.toMatchObject({ code });
  });

  it('maps a network failure to NETWORK', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(callClaude(input)).rejects.toMatchObject({ code: 'NETWORK' });
  }, 15_000);

  it('treats a refusal or truncated answer as UNKNOWN', async () => {
    fetchMock.mockResolvedValue(messageResponse({ stop_reason: 'refusal' }));
    await expect(callClaude(input)).rejects.toMatchObject({ code: 'UNKNOWN' });
    fetchMock.mockResolvedValue(messageResponse({ stop_reason: 'max_tokens' }));
    await expect(callClaude(input)).rejects.toMatchObject({ code: 'UNKNOWN' });
  });

  it('treats unparseable or wrongly shaped output as UNKNOWN', async () => {
    fetchMock.mockResolvedValue(messageResponse({}, 'not json at all'));
    await expect(callClaude(input)).rejects.toMatchObject({ code: 'UNKNOWN' });
    fetchMock.mockResolvedValue(messageResponse({}, JSON.stringify({ lemma: 'only this' })));
    await expect(callClaude(input)).rejects.toMatchObject({ code: 'UNKNOWN' });
  });

  it('never leaks the API key or response details into errors', async () => {
    fetchMock.mockResolvedValue(errorResponse(401));
    const error = await callClaude(input).catch((e: unknown) => e);
    expect(JSON.stringify(error)).not.toContain('sk-ant');
    expect(JSON.stringify(error)).not.toContain('nope');
  });
});

describe('explain (cached)', () => {
  it('serves a repeated lookup from the cache', async () => {
    expect(await explain(input)).toEqual(explanation);
    expect(await explain(input)).toEqual(explanation);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('treats context case/whitespace differences as the same lookup', async () => {
    await explain(input);
    await explain({ ...input, context: '  HE was   reluctant to leave. ' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('makes a new request when the level, model, term or context changes', async () => {
    await explain(input);
    await explain({ ...input, level: 'B1' });
    await explain({ ...input, model: 'claude-haiku-5-5' });
    await explain({ ...input, term: 'leave' });
    await explain({ ...input, context: 'A different line.' });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('never caches a failure', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(500)).mockResolvedValueOnce(messageResponse());
    await expect(explain(input)).rejects.toMatchObject({ code: 'UNKNOWN' });
    expect(await explain(input)).toEqual(explanation);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keys the cache by a hash and never stores the API key', async () => {
    await explain(input);
    const dump = chromeMock.storage.local.__dump();
    const keys = Object.keys(dump).filter((k) => k.startsWith('ai:'));
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^ai:[0-9a-f]{64}$/);
    expect(JSON.stringify(dump)).not.toContain('sk-ant-test-key');
  });
});

describe('testKey', () => {
  it('makes a real (uncached) request every time', async () => {
    await testKey('sk-ant-test-key', 'claude-haiku-5-5');
    await testKey('sk-ant-test-key', 'claude-haiku-5-5');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(Object.keys(chromeMock.storage.local.__dump()).some((k) => k.startsWith('ai:'))).toBe(false);
  });

  it('rejects with INVALID_KEY for a bad key', async () => {
    fetchMock.mockResolvedValue(errorResponse(401));
    await expect(testKey('bad', 'claude-opus-5-5')).rejects.toMatchObject({ code: 'INVALID_KEY' });
  });
});

describe('mapAnthropicError', () => {
  it('passes app errors through unchanged', () => {
    const err = { code: 'NO_KEY' as const, message: 'x' };
    expect(mapAnthropicError(err)).toBe(err);
  });

  it('maps SDK error classes', () => {
    const make = (Cls: new (...args: never[]) => Error): Error =>
      Object.create((Cls as unknown as { prototype: object }).prototype) as Error;
    expect(mapAnthropicError(make(Anthropic.AuthenticationError)).code).toBe('INVALID_KEY');
    expect(mapAnthropicError(make(Anthropic.PermissionDeniedError)).code).toBe('INVALID_KEY');
    expect(mapAnthropicError(make(Anthropic.RateLimitError)).code).toBe('RATE_LIMIT');
    expect(mapAnthropicError(make(Anthropic.APIConnectionError)).code).toBe('NETWORK');
    expect(mapAnthropicError(make(Anthropic.APIConnectionTimeoutError)).code).toBe('NETWORK');
  });

  it('maps everything else to UNKNOWN', () => {
    expect(mapAnthropicError(new Error('boom')).code).toBe('UNKNOWN');
    expect(mapAnthropicError('weird').code).toBe('UNKNOWN');
    expect(mapAnthropicError(null).code).toBe('UNKNOWN');
  });
});
