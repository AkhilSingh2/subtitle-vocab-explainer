import type { AiExplanation, AppError, Cefr, DictResult, LevelInfo, Register } from '../shared/types';

/** Everything the card needs to know to render (docs/03 §4). */
export interface CardModel {
  term: string;
  isPhrase: boolean;
  /** null until the HAS_KEY answer arrives. */
  hasKey: boolean | null;
  dictionary:
    | { status: 'loading' }
    | { status: 'ready'; data: DictResult | null }
    | { status: 'error'; error: AppError };
  /** Frequency-based estimate from LOOKUP. */
  level: LevelInfo | null;
  ai:
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'ready'; data: AiExplanation }
    | { status: 'error'; error: AppError };
  saved: boolean;
  nudgeDismissed: boolean;
}

export interface CardContent {
  ipa: string | null;
  partOfSpeech: string | null;
  register: Register | null;
  levelLabel: string | null;
  levelKey: Cefr | null;
  definition: string | null;
  example: string | null;
  inContext: string | null;
  simpler: string | null;
  audioUrl: string | null;
}

function slashed(ipa: string): string {
  const trimmed = ipa.trim();
  return trimmed.startsWith('/') || trimmed.startsWith('[') ? trimmed : `/${trimmed}/`;
}

function firstDefinition(dict: DictResult | null): { definition: string; example?: string } | null {
  const first = dict?.meanings[0]?.definitions[0];
  return first ?? null;
}

function firstExample(dict: DictResult | null): string | null {
  for (const meaning of dict?.meanings ?? []) {
    for (const def of meaning.definitions) if (def.example) return def.example;
  }
  return null;
}

/** Applies the data-priority table from docs/03 §4.3. */
export function deriveCardContent(model: CardModel): CardContent {
  const dict = model.dictionary.status === 'ready' ? model.dictionary.data : null;
  const ai = model.ai.status === 'ready' ? model.ai.data : null;

  const ipaRaw = dict?.phonetic ?? (ai?.ipa ? ai.ipa : null);
  const ipa = ipaRaw ? slashed(ipaRaw) : null;

  let partOfSpeech: string | null = null;
  if (ai?.isIdiom || (model.isPhrase && !ai)) partOfSpeech = 'idiom';
  else if (ai?.partOfSpeech) partOfSpeech = ai.partOfSpeech;
  else if (dict?.meanings[0]?.partOfSpeech) partOfSpeech = dict.meanings[0].partOfSpeech;

  const register = ai && ai.register !== 'neutral' ? ai.register : null;

  let levelLabel: string | null = null;
  let levelKey: Cefr | null = null;
  if (ai) {
    levelKey = ai.cefr;
    levelLabel = ai.cefr;
  } else if (model.level) {
    levelKey = model.level.level;
    const base = model.isPhrase ? `${model.level.level}+` : model.level.level;
    levelLabel = model.isPhrase ? base : model.level.estimated ? `est. ${base}` : base;
  }

  const definition = ai?.shortDefinition ?? firstDefinition(dict)?.definition ?? null;
  const example = ai?.example ?? firstExample(dict);

  return {
    ipa,
    partOfSpeech,
    register,
    levelLabel,
    levelKey,
    definition,
    example,
    inContext: ai?.inContext ?? null,
    simpler: ai?.simpler ?? null,
    audioUrl: dict?.audioUrl ?? null,
  };
}

export function createInitialModel(term: string, isPhrase: boolean, nudgeDismissed: boolean): CardModel {
  return {
    term,
    isPhrase,
    hasKey: null,
    dictionary: { status: 'loading' },
    level: null,
    ai: { status: 'idle' },
    saved: false,
    nudgeDismissed,
  };
}

/** Exact user-facing copy for AI errors (docs/03 §4.4). */
export function aiErrorCopy(error: AppError): { text: string; action: 'settings' | 'retry' } {
  switch (error.code) {
    case 'INVALID_KEY':
      return { text: 'Your API key was rejected. Check it in Settings.', action: 'settings' };
    case 'RATE_LIMIT':
      return { text: 'Too many requests — try again in a moment.', action: 'retry' };
    case 'NETWORK':
      return { text: 'Couldn’t reach the AI service.', action: 'retry' };
    default:
      return { text: 'Couldn’t explain this one.', action: 'retry' };
  }
}
