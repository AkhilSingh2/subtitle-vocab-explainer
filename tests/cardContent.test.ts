import { describe, expect, it } from 'vitest';
import { aiErrorCopy, createInitialModel, deriveCardContent, type CardModel } from '../src/content/cardContent';
import type { AiExplanation, DictResult } from '../src/shared/types';

const dict: DictResult = {
  word: 'reluctant',
  phonetic: '/rɪˈlʌktənt/',
  audioUrl: 'https://example.com/a.mp3',
  meanings: [
    { partOfSpeech: 'adjective', definitions: [{ definition: 'Unwilling.', example: 'She was reluctant.' }] },
  ],
};

const ai: AiExplanation = {
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

function model(patch: Partial<CardModel> = {}): CardModel {
  return { ...createInitialModel('reluctant', false, false), ...patch };
}

describe('deriveCardContent', () => {
  it('is empty while loading', () => {
    const c = deriveCardContent(model());
    expect(c.definition).toBeNull();
    expect(c.levelLabel).toBeNull();
    expect(c.ipa).toBeNull();
  });

  it('uses the dictionary and an estimated level in Free Mode', () => {
    const c = deriveCardContent(
      model({
        dictionary: { status: 'ready', data: dict },
        level: { level: 'B2', estimated: true },
        hasKey: false,
      }),
    );
    expect(c.definition).toBe('Unwilling.');
    expect(c.example).toBe('She was reluctant.');
    expect(c.ipa).toBe('/rɪˈlʌktənt/');
    expect(c.partOfSpeech).toBe('adjective');
    expect(c.levelLabel).toBe('est. B2');
    expect(c.audioUrl).toBe('https://example.com/a.mp3');
    expect(c.inContext).toBeNull();
  });

  it('prefers AI fields over dictionary fields, with a non-estimated level', () => {
    const c = deriveCardContent(
      model({
        dictionary: { status: 'ready', data: dict },
        level: { level: 'B2', estimated: true },
        ai: { status: 'ready', data: ai },
      }),
    );
    expect(c.definition).toBe('Not wanting to do something.');
    expect(c.example).toBe('I was reluctant to go.');
    expect(c.levelLabel).toBe('C1');
    expect(c.levelKey).toBe('C1');
    expect(c.inContext).toBe('He did not want to leave the party.');
    expect(c.simpler).toBe('unwilling');
    // phonetic still comes from the dictionary first
    expect(c.ipa).toBe('/rɪˈlʌktənt/');
  });

  it('falls back to the AI ipa (adding slashes) when the dictionary has no entry', () => {
    const c = deriveCardContent(
      model({ dictionary: { status: 'ready', data: null }, ai: { status: 'ready', data: ai } }),
    );
    expect(c.ipa).toBe('/rɪˈlʌktənt/');
    expect(c.audioUrl).toBeNull();
  });

  it('labels idioms "B2+" and "idiom"', () => {
    const idiom = deriveCardContent(
      model({
        term: 'break the ice',
        isPhrase: true,
        dictionary: {
          status: 'ready',
          data: { word: 'break the ice', meanings: [{ partOfSpeech: 'idiom', definitions: [{ definition: 'Relax people.' }] }] },
        },
        level: { level: 'B2', estimated: true },
      }),
    );
    expect(idiom.levelLabel).toBe('B2+');
    expect(idiom.partOfSpeech).toBe('idiom');
    expect(idiom.definition).toBe('Relax people.');
  });

  it('shows a register only when it is not neutral', () => {
    const slang = deriveCardContent(
      model({ ai: { status: 'ready', data: { ...ai, register: 'slang' } } }),
    );
    expect(slang.register).toBe('slang');
    expect(deriveCardContent(model({ ai: { status: 'ready', data: ai } })).register).toBeNull();
  });

  it('marks AI idioms as "idiom"', () => {
    const c = deriveCardContent(model({ ai: { status: 'ready', data: { ...ai, isIdiom: true } } }));
    expect(c.partOfSpeech).toBe('idiom');
  });
});

describe('aiErrorCopy', () => {
  it('returns the exact copy from the UX spec', () => {
    expect(aiErrorCopy({ code: 'INVALID_KEY', message: '' })).toEqual({
      text: 'Your API key was rejected. Check it in Settings.',
      action: 'settings',
    });
    expect(aiErrorCopy({ code: 'RATE_LIMIT', message: '' }).text).toBe(
      'Too many requests — try again in a moment.',
    );
    expect(aiErrorCopy({ code: 'NETWORK', message: '' }).text).toBe('Couldn’t reach the AI service.');
    expect(aiErrorCopy({ code: 'UNKNOWN', message: '' })).toEqual({
      text: 'Couldn’t explain this one.',
      action: 'retry',
    });
  });
});
