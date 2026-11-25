import { describe, expect, it } from 'vitest';
import { normalizeContext, sha256Hex } from '../src/shared/hash';

describe('sha256Hex', () => {
  it('matches known test vectors', async () => {
    expect(await sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('handles non-ASCII input', async () => {
    const hash = await sha256Hex('café ☕');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('normalizeContext', () => {
  it('lowercases, collapses whitespace and trims', () => {
    expect(normalizeContext('  Hello   WORLD \n there ')).toBe('hello world there');
  });
});
