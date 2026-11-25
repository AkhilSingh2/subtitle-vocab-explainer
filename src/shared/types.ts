export type Cefr = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type TargetLevel = 'B1' | 'B2' | 'C1' | 'C2';
export type Register = 'neutral' | 'informal' | 'slang' | 'formal' | 'vulgar';
export type CardTrigger = 'click' | 'hover';
export type AiModel = 'claude-opus-5-5' | 'claude-sonnet-5-5' | 'claude-haiku-5-5';
export type SiteId = 'youtube' | 'netflix';

export interface Settings {
  enabled: boolean;
  level: TargetLevel;
  aiModel: AiModel;
  cardTrigger: CardTrigger;
  smartPause: boolean;
  nudgeDismissed: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  level: 'B2',
  aiModel: 'claude-haiku-5-5',
  cardTrigger: 'click',
  smartPause: true,
  nudgeDismissed: false,
};

export interface DictDefinition {
  definition: string;
  example?: string;
}
export interface DictMeaning {
  partOfSpeech: string;
  definitions: DictDefinition[];
}
export interface DictResult {
  word: string;
  phonetic?: string;
  audioUrl?: string;
  meanings: DictMeaning[];
}

export interface LevelInfo {
  level: Cefr;
  estimated: boolean;
}

export interface AiExplanation {
  lemma: string;
  ipa: string;
  partOfSpeech: string;
  isIdiom: boolean;
  register: Register;
  cefr: Cefr;
  shortDefinition: string;
  inContext: string;
  example: string;
  simpler: string;
}

export interface SavedWord {
  /** `${term.toLowerCase()}|${sha256(context).slice(0, 8)}` */
  id: string;
  term: string;
  definition: string;
  context: string;
  level: Cefr;
  estimated: boolean;
  /** 'idiom' for phrases */
  partOfSpeech: string;
  site: SiteId;
  pageTitle: string;
  url: string;
  /** epoch ms */
  savedAt: number;
}

export type ErrorCode =
  | 'NOT_FOUND'
  | 'NETWORK'
  | 'INVALID_KEY'
  | 'RATE_LIMIT'
  | 'NO_KEY'
  | 'UNKNOWN';

export interface AppError {
  code: ErrorCode;
  message: string;
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: AppError };

export interface LookupData {
  dictionary: DictResult | null;
  level: LevelInfo;
}

/** content/popup -> background */
export type BgRequest =
  | { type: 'LOOKUP'; term: string; isPhrase: boolean; phraseMeaning?: string }
  | { type: 'EXPLAIN'; term: string; context: string; level: TargetLevel; pageTitle: string }
  | { type: 'SAVE_WORD'; word: SavedWord }
  | { type: 'REMOVE_WORD'; id: string }
  | { type: 'TEST_KEY'; apiKey?: string }
  | { type: 'HAS_KEY' }
  | { type: 'KEY_SOURCE' }
  | { type: 'OPEN_SETTINGS' }
  | { type: 'CLEAR_CACHE' };

/** popup -> content (via chrome.tabs.sendMessage) */
export type ContentRequest = { type: 'GET_STATE' };

export interface ContentState {
  site: SiteId;
  isWatchPage: boolean;
  captionsStatus: 'waiting' | 'detected' | 'not-detected';
  enabled: boolean;
}

/** background -> content (reserved; not implemented unless needed) */
export type BgToContent = { type: 'TOGGLE_ENABLED' };

export function isAppError(value: unknown): value is AppError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    typeof (value as AppError).message === 'string'
  );
}
