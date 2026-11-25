import { estimateLevel } from '../shared/level';
import { getSettings, removeWord, saveWord } from '../shared/storage';
import {
  isAppError,
  type AiExplanation,
  type AppError,
  type BgRequest,
  type LookupData,
  type Result,
} from '../shared/types';
import { resolveApiKey } from './apiKey';
import { clearCache } from './cache';
import { getDefinition } from './dictionaryService';
import { explain, testKey } from './llmService';

const ok = <T>(data: T): Result<T> => ({ ok: true, data });
const fail = (error: AppError): Result<never> => ({ ok: false, error });

function toAppError(err: unknown): AppError {
  if (isAppError(err)) return err;
  return { code: 'UNKNOWN', message: err instanceof Error ? err.message : 'Unknown error.' };
}

async function lookup(
  req: Extract<BgRequest, { type: 'LOOKUP' }>,
): Promise<Result<LookupData>> {
  const level = estimateLevel(req.term, req.isPhrase);
  if (req.isPhrase) {
    const dictionary = req.phraseMeaning
      ? {
          word: req.term,
          meanings: [{ partOfSpeech: 'idiom', definitions: [{ definition: req.phraseMeaning }] }],
        }
      : null;
    return ok({ dictionary, level });
  }
  return ok({ dictionary: await getDefinition(req.term), level });
}

async function explainTerm(
  req: Extract<BgRequest, { type: 'EXPLAIN' }>,
): Promise<Result<AiExplanation>> {
  const [resolved, { aiModel }] = await Promise.all([resolveApiKey(), getSettings()]);
  if (!resolved) return fail({ code: 'NO_KEY', message: 'No API key is set.' });
  return ok(
    await explain({
      term: req.term,
      context: req.context,
      level: req.level,
      pageTitle: req.pageTitle,
      model: aiModel,
      apiKey: resolved.key,
    }),
  );
}

/** Tests the typed key if given, otherwise the key in use (user's, else built-in). */
async function checkKey(typedKey: string | undefined): Promise<Result<null>> {
  const apiKey = typedKey?.trim() || (await resolveApiKey())?.key;
  if (!apiKey) return fail({ code: 'NO_KEY', message: 'No API key is set.' });
  const { aiModel } = await getSettings();
  await testKey(apiKey, aiModel);
  return ok(null);
}

/** Asks the popup to open on its Settings tab. Chrome may refuse; the caller then shows a hint. */
async function openSettings(): Promise<Result<null>> {
  await chrome.storage.local.set({ popupTab: 'settings' });
  try {
    await chrome.action.openPopup();
    return ok(null);
  } catch {
    return fail({ code: 'UNKNOWN', message: 'Could not open the popup.' });
  }
}

/** Handles one message from a content script or the popup. Always resolves to a Result. */
export async function handleMessage(req: BgRequest): Promise<Result<unknown>> {
  try {
    switch (req.type) {
      case 'LOOKUP':
        return await lookup(req);
      case 'HAS_KEY':
        return ok((await resolveApiKey()) !== null);
      case 'KEY_SOURCE':
        return ok((await resolveApiKey())?.source ?? null);
      case 'SAVE_WORD':
        await saveWord(req.word);
        return ok(null);
      case 'REMOVE_WORD':
        await removeWord(req.id);
        return ok(null);
      case 'CLEAR_CACHE':
        await clearCache();
        return ok(null);
      case 'OPEN_SETTINGS':
        return await openSettings();
      case 'EXPLAIN':
        return await explainTerm(req);
      case 'TEST_KEY':
        return await checkKey(req.apiKey);
      default:
        return fail({ code: 'UNKNOWN', message: 'Unknown request.' });
    }
  } catch (err) {
    return fail(toAppError(err));
  }
}
