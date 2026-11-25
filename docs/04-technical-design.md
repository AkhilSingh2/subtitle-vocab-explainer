# 04 — Technical Design

Implement exactly this design. Where it names a file, function or type, use that name. UX behaviour is defined in [03-ux-ui-spec.md](03-ux-ui-spec.md); scope in [01-PRD.md](01-PRD.md).

---

## 1. Stack

| Concern | Choice |
|---|---|
| Build | Vite 6 + `@crxjs/vite-plugin` 2.x (manifest defined in `src/manifest.ts` via `defineManifest`) |
| Language | TypeScript, `strict: true`, `noUncheckedIndexedAccess: true`, no `any` |
| Popup / onboarding UI | React 18 + Tailwind CSS 3 |
| Content script | Plain TypeScript (no React) to stay small |
| AI | `@anthropic-ai/sdk` + `zod`, **service worker only** |
| Tests | Vitest + jsdom |
| Types | `@types/chrome` |
| Node | 20+ |

No other runtime dependencies. Dev dependencies are limited to the build, test and type tooling above (plus `typescript`, `postcss`, `autoprefixer`, `@vitejs/plugin-react`, `@types/react`, `@types/react-dom`, `jsdom`).

## 2. Repository layout

```
vocab-explainer/
├── .github/workflows/ci.yml
├── docs/                      (these documents + CHANGELOG-decisions.md)
├── public/icons/              icon-16.png icon-32.png icon-48.png icon-128.png
├── scripts/zip.mjs            zips dist/ into release/vocab-explainer-<version>.zip
├── src/
│   ├── manifest.ts
│   ├── background/
│   │   ├── index.ts           message router, onInstalled, command handler
│   │   ├── dictionaryService.ts
│   │   ├── llmService.ts
│   │   └── cache.ts
│   ├── content/
│   │   ├── index.ts           bootstrap, SPA navigation, event delegation, orchestration
│   │   ├── siteAdapters.ts
│   │   ├── captionWrapper.ts  tokenise + wrap caption text
│   │   ├── idiomMatcher.ts
│   │   ├── smartPause.ts
│   │   ├── ShadowTooltip.ts   card + toast UI
│   │   ├── placement.ts       computePlacement (pure)
│   │   ├── pageStyles.ts      string of host-page CSS (sve- classes)
│   │   └── tooltip.css.ts     string of shadow-root CSS
│   ├── popup/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── index.css          Tailwind directives
│   │   └── components/{HomeTab,WordsTab,SettingsTab}.tsx
│   ├── onboarding/{index.html,main.tsx}
│   └── shared/
│       ├── types.ts
│       ├── tokens.ts          design tokens from 03 §2
│       ├── storage.ts
│       ├── hash.ts
│       ├── idioms.ts          ~300 entries
│       ├── wordFrequency.ts   rank map
│       ├── level.ts
│       ├── lemma.ts           lemmatise helpers (shared by idiomMatcher and dictionaryService)
│       └── csv.ts
├── tests/
│   ├── setup.ts               chrome.* mock
│   └── *.test.ts
├── package.json  vite.config.ts  vitest.config.ts  tsconfig.json
├── tailwind.config.js  postcss.config.js
└── README.md  CLAUDE.md
```

## 3. Manifest (`src/manifest.ts`)

```ts
import { defineManifest } from '@crxjs/vite-plugin';
import pkg from '../package.json';

export default defineManifest({
  manifest_version: 3,
  name: 'Subtitle Vocab Explainer',
  version: pkg.version,
  description: 'Click any word or idiom in YouTube and Netflix captions to see what it means in the scene.',
  icons: { '16': 'public/icons/icon-16.png', '32': 'public/icons/icon-32.png', '48': 'public/icons/icon-48.png', '128': 'public/icons/icon-128.png' },
  action: { default_popup: 'src/popup/index.html', default_title: 'Subtitle Vocab Explainer' },
  background: { service_worker: 'src/background/index.ts', type: 'module' },
  content_scripts: [{
    matches: ['https://www.youtube.com/*', 'https://www.netflix.com/*'],
    js: ['src/content/index.ts'],
    run_at: 'document_idle',
    all_frames: false,
  }],
  permissions: ['storage', 'activeTab'],
  host_permissions: ['https://api.dictionaryapi.dev/*', 'https://api.anthropic.com/*'],
  commands: {
    'toggle-extension': {
      suggested_key: { default: 'Alt+Shift+V' },
      description: 'Turn Subtitle Vocab Explainer on or off',
    },
  },
});
```

Notes:
- `tabs` permission is **not** requested. The popup finds the active tab with `chrome.tabs.query({active:true,currentWindow:true})` (allowed with `activeTab` when the popup is opened) and talks to it with `chrome.tabs.sendMessage`.
- The content script injects on every page of the two hosts but **self-activates only on watch pages** (see §6.1).
- `src/onboarding/index.html` must be added to `web_accessible_resources` only if crxjs requires it; opening it with `chrome.tabs.create({ url: chrome.runtime.getURL('src/onboarding/index.html') })` does not need it. Register it as an extra Vite input in `vite.config.ts` (`build.rollupOptions.input`).

## 4. Shared types (`src/shared/types.ts`)

```ts
export type Cefr = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type TargetLevel = 'B1' | 'B2' | 'C1' | 'C2';
export type Register = 'neutral' | 'informal' | 'slang' | 'formal' | 'vulgar';
export type CardTrigger = 'click' | 'hover';
export type AiModel = 'claude-opus-5-5' | 'claude-sonnet-5-5' | 'claude-haiku-5-5';
export type SiteId = 'youtube' | 'netflix';

export interface Settings {
  enabled: boolean;          // default true
  level: TargetLevel;        // default 'B2'
  aiModel: AiModel;          // default 'claude-opus-5-5'
  cardTrigger: CardTrigger;  // default 'click'
  smartPause: boolean;       // default true
  nudgeDismissed: boolean;   // default false
}

export interface DictDefinition { definition: string; example?: string }
export interface DictMeaning { partOfSpeech: string; definitions: DictDefinition[] }
export interface DictResult {
  word: string;
  phonetic?: string;
  audioUrl?: string;
  meanings: DictMeaning[];
}

export interface LevelInfo { level: Cefr; estimated: boolean }

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
  id: string;                // `${term.toLowerCase()}|${sha256(context).slice(0,8)}`
  term: string;
  definition: string;
  context: string;
  level: Cefr;
  estimated: boolean;
  partOfSpeech: string;      // 'idiom' for phrases
  site: SiteId;
  pageTitle: string;
  url: string;
  savedAt: number;           // epoch ms
}

export type ErrorCode = 'NOT_FOUND' | 'NETWORK' | 'INVALID_KEY' | 'RATE_LIMIT' | 'NO_KEY' | 'UNKNOWN';
export interface AppError { code: ErrorCode; message: string }
export type Result<T> = { ok: true; data: T } | { ok: false; error: AppError };

// content/popup -> background
export type BgRequest =
  | { type: 'LOOKUP'; term: string; isPhrase: boolean; phraseMeaning?: string }
  | { type: 'EXPLAIN'; term: string; context: string; level: TargetLevel; pageTitle: string }
  | { type: 'SAVE_WORD'; word: SavedWord }
  | { type: 'REMOVE_WORD'; id: string }
  | { type: 'TEST_KEY' }
  | { type: 'CLEAR_CACHE' };

export interface LookupData { dictionary: DictResult | null; level: LevelInfo }

// popup -> content (via chrome.tabs.sendMessage)
export type ContentRequest = { type: 'GET_STATE' };
export interface ContentState {
  site: SiteId;
  isWatchPage: boolean;
  captionsStatus: 'waiting' | 'detected' | 'not-detected';
}

// background -> content (via chrome.tabs.sendMessage)
export type BgToContent = { type: 'TOGGLE_ENABLED' };
```

`Result<T>` is the response shape of **every** background message handler.

## 5. Shared modules

### 5.1 `storage.ts`

Typed wrapper over `chrome.storage`:

| Data | Area | Key |
|---|---|---|
| `Settings` | `sync` | `settings` (merged over defaults on read) |
| API key | **`local` only, never sync** | `apiKey` |
| `SavedWord[]` | `local` | `savedWords` |
| Cache entries | `local` | `ai:<hash>`, `dict:<word>`, plus `cacheIndex: {key:string, savedAt:number}[]` |

API: `getSettings()`, `setSettings(patch)`, `getApiKey()`, `setApiKey(k | null)`, `getSavedWords()`, `saveWord(w)`, `removeWord(id)`, `onSettingsChanged(cb)`, `onSavedWordsChanged(cb)` (the latter two use `chrome.storage.onChanged`, return an unsubscribe function).

### 5.2 `hash.ts`
`sha256Hex(input: string): Promise<string>` using `crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))`. Also `normalizeContext(s)`: lowercase, collapse whitespace, trim.

### 5.3 `level.ts`
`estimateLevel(term: string, isIdiom: boolean): LevelInfo`

- Idiom → `{ level: 'B2', estimated: true }` with the display label `B2+` (UI rule in 03 §2.1; the `+` is added by the UI when `isPhrase`).
- Otherwise look up `wordFrequency[lemma(term)]` (rank, 1 = most common): ≤1500 → A2, ≤3000 → B1, ≤5000 → B2, ≤9000 → C1, otherwise (including unknown) → C2. Always `estimated: true`.

### 5.4 `wordFrequency.ts`
Exports `Record<string, number>` mapping a lowercase word to its rank for the top ~20,000 English words. Source: the MIT-licensed `google-10000-english` list extended with a public-domain frequency list. The implementer should generate the file with a one-off script (not committed) from a downloadable list, and record the source and licence in a comment at the top of the file. If only 10k words are available, document that in `docs/CHANGELOG-decisions.md`; rank thresholds above still apply.

### 5.5 `lemma.ts`
`lemmatize(word: string): string` — lowercase, strip `'s`, then:
1. Irregular map (at least: was/were/been/is/are→be; went/gone/goes→go; broke/broken→break; took/taken→take; made→make; got/gotten→get; came→come; saw/seen→see; gave/given→give; knew/known→know; thought→think; told→tell; found→find; kept→keep; left→leave; felt→feel; ran→run; brought→bring; held→hold; stood→stand; said→say; paid→pay; met→meet; fell/fallen→fall; threw/thrown→throw; drew/drawn→draw; ate/eaten→eat; wrote/written→write; spoke/spoken→speak; won→win; lost→lose; put/set/cut/let→same).
2. Suffix rules, trying candidates in order and returning the first that exists in `wordFrequency` (else the original): `ies→y`, `es→""`, `s→""`, `ied→y`, `ed→""`, `ed→"e"`, doubled consonant + `ed`/`ing` → single consonant, `ing→""`, `ing→"e"`.

### 5.6 `idioms.ts`
`export const IDIOMS: Record<string, string>` — key: lowercase base-form phrase (2–4 words); value: a plain-English meaning of ≤ 15 words. About **300 entries** covering, in roughly equal parts: (a) common idioms ("break the ice", "piece of cake", "under the weather", "hit the sack", "spill the beans", "call it a day", "cost an arm and a leg"), (b) phrasal verbs ("give up", "look forward to", "run out of", "figure out", "turn down", "put up with"), (c) fixed expressions and informal phrases ("no big deal", "you bet", "come on", "for real"). Keys use the base form of verbs (`break the ice`, not `broke the ice`). No duplicate keys; no keys longer than 4 words. A test asserts these invariants.

### 5.7 `csv.ts`
`savedWordsToCsv(words: SavedWord[]): string` — header `word,definition,context,level,source,url,savedAt`; RFC 4180 quoting (wrap in `"`, double inner `"`); `source` = `YouTube · {pageTitle}` or `Netflix · {pageTitle}`; `savedAt` ISO 8601; lines joined with `\r\n`; the caller prefixes a UTF-8 BOM (`﻿`) when creating the Blob.

### 5.8 `tokens.ts`
Exports the colours, type scale, spacing and motion constants from 03 §2 as typed `const` objects; consumed by `tooltip.css.ts`, `pageStyles.ts`, and `tailwind.config.js` (via `import` in the config).

## 6. Content script

### 6.1 Bootstrap and SPA navigation (`content/index.ts`)

1. Identify the site from `location.hostname` → `SiteAdapter` (see 6.2). Unknown host: return.
2. `isWatchPage()` = adapter `matchesUrl(location)`. YouTube: `pathname === '/watch'`. Netflix: `pathname.startsWith('/watch/')`.
3. Detect SPA navigation: on YouTube listen for the `yt-navigate-finish` event on `document`; on both sites also poll `location.href` every 500 ms and, on change, re-evaluate. When entering a watch page → `start()`; when leaving → `stop()`.
4. `start()`: read settings; if `!enabled`, remain idle but listen for settings changes. Otherwise wait for the player element (poll every 500 ms, up to 30 s) then create a `CaptionController` (below).
5. `stop()`: disconnect observers, remove injected style tag and listeners, close the card, unwrap nothing (wrapped spans are harmless and will be discarded with the caption DOM).
6. Subscribe to `onSettingsChanged`: re-evaluate `enabled`, `cardTrigger` and `smartPause` live; changing `level` doesn't affect already-open cards.
7. Listen for `chrome.runtime.onMessage`: `GET_STATE` → reply `ContentState`; `TOGGLE_ENABLED` → flip via `setSettings`.

### 6.2 Site adapters (`siteAdapters.ts`)

```ts
export interface SiteAdapter {
  id: SiteId;
  matchesUrl(loc: Location): boolean;
  playerSelectors: string[];        // first match wins
  captionRootSelectors: string[];   // container(s) that hold caption lines
  captionLineSelectors: string[];   // element(s) that represent one caption line
  videoSelectors: string[];
}
```

| | YouTube | Netflix |
|---|---|---|
| `playerSelectors` | `#movie_player`, `.html5-video-player` | `.watch-video--player-view`, `[data-uia="player"]`, `.NFPlayer` |
| `captionRootSelectors` | `.ytp-caption-window-container` | `.player-timedtext` |
| `captionLineSelectors` | `.ytp-caption-segment` | `.player-timedtext-text-container span` (leaf spans) |
| `videoSelectors` | `video.html5-main-video`, `video` | `video` |

Helpers: `queryFirst(selectors, root?)`. When the first selector in an array fails, try the next (this is the fallback mechanism). If the player exists but no caption root is ever found while the video is playing for 30 s, the controller reports `captionsStatus: 'not-detected'`.

### 6.3 Caption pipeline (`captionWrapper.ts`, `content/index.ts`)

`CaptionController` responsibilities:

1. **Inject page styles** once: `<style id="sve-page-styles">` with the CSS from `pageStyles.ts` (03 §3), appended to `document.head`.
2. **Observe:** `MutationObserver` on the player element with `{ childList: true, subtree: true, characterData: true }`. Callback schedules `processCaptions()` through `requestAnimationFrame` (coalesced: at most one pending frame).
3. **processCaptions():** find caption lines with `captionLineSelectors` inside the caption root. For each line element **without** `data-sve-done`:
   - Read `line.textContent`. Skip if empty.
   - Compute the full caption sentence = text of all lines in the same caption root joined with a space (needed so idioms spanning two DOM lines still match; in the matcher the sentence is used only for matching, and wrapping is per line).
   - `tokenize(text)` → tokens (word / non-word).
   - `findPhrasesInSentence(sentence, IDIOMS)` → phrase matches; map phrase token ranges onto this line's tokens (a phrase that crosses DOM lines is skipped).
   - **Disconnect the observer**, rebuild the line's children, set `data-sve-done="1"`, **reconnect**.
   - Update the ring buffer (below).
4. **Rebuilding** (security-critical): create nodes with `document.createElement('span')` and `textContent`. **Never** use `innerHTML` with caption text.
   - Word tokens → `<span class="sve-w" data-sve-i="N">word</span>` (N = index within the line).
   - Non-word tokens → text nodes.
   - Phrase tokens → wrapped in `<span class="sve-p" data-sve-phrase="base form key">` containing the `sve-w` spans.
   - Words matching saved words (lowercase lemma equality) additionally get `sve-saved`; refresh these when `onSavedWordsChanged` fires.
5. **Ring buffer** `CaptionHistory`: stores the last 2 distinct caption sentences (text of the whole caption window). `getContext()` returns `previous + ' ' + current` trimmed (previous omitted if absent). Capped at 300 characters (trim from the start).
6. **Event delegation** on `document` in the **capture** phase (`{ capture: true }`):
   - `pointerover` / `pointerout`: manage hover-dwell timer in hover mode and smart-pause enter/leave (caption area = caption root or the card).
   - `click`: if target is within `.sve-w` → `event.preventDefault()`, `event.stopPropagation()`, open the card for the word, or the full phrase if inside `.sve-p`. Ignore if `window.getSelection()` has non-collapsed text (drag-select handles it).
   - `mouseup`: if the selection is non-collapsed, within one caption line (`anchorNode` and `focusNode` both inside caption lines), 2–6 words and ≤ 60 characters → open the card for `selection.toString().trim()` as a phrase. Then clear the selection.
   - `keydown` (capture): active only while a card is open (03 §6).
7. **Opening a card** (`openCard(term, isPhrase, anchorEl)`):
   1. Compute `context = history.getContext()` and `level = settings.level`.
   2. `smartPause.onCardOpen()`.
   3. `tooltip.show({ term, isPhrase, anchorRect, ... })` renders the loading state immediately.
   4. Send `LOOKUP` and (if a key exists — known from `GET_STATE`-style `hasKey` flag in the storage read) `EXPLAIN` **in parallel** with `chrome.runtime.sendMessage`. Update the tooltip as each resolves. Ignore late responses if the card was closed or re-targeted (compare a monotonic `requestId`).
   5. For phrases, pass `phraseMeaning` (from `IDIOMS` when the phrase is a known idiom, else undefined) to `LOOKUP` so Free Mode can show it without calling the dictionary. Unknown user-selected phrases in Free Mode show "No dictionary entry…" with the nudge.

### 6.4 `idiomMatcher.ts`

```ts
export interface PhraseMatch {
  phrase: string;        // dictionary key that matched, e.g. "break the ice"
  meaning: string;
  startToken: number;    // index into the word-tokens array of the sentence
  endToken: number;      // inclusive
}

export function findPhrasesInSentence(
  sentence: string,
  dictionary: Record<string, string>,
): PhraseMatch[];
```

Algorithm:
1. Extract word tokens from the sentence with `/[\p{L}\p{M}][\p{L}\p{M}'’-]*/gu`; normalise each: lowercase, curly quote → `'`, strip leading/trailing `'` and `-`.
2. For each start index `i` left to right, for `n` from **4 down to 2**: build the candidate by joining tokens `i..i+n-1` with a space, **after lemmatising the first token only** (so "broke the ice" → "break the ice"; "giving up" → "give up"). If the candidate is a key in `dictionary` → record the match, set `i += n`, and continue (no overlaps; the longest match wins).
3. If no n-gram matched at `i`, check the **single token** (lemmatised) against `dictionary`; a hit is returned as a 1-token match. (This lets callers fall back to token-level lookups.) Single-token matches are appended **after** all multi-word matches in the returned array, preserving order within each group.
4. Complexity O(tokens × 3) lookups.
5. Return matches; never throws; empty input → `[]`.

Required tests include: longest match beats shorter, inflected first token, punctuation and curly quotes, adjacent matches, overlapping candidates, no match, empty string.

### 6.5 `smartPause.ts`

```ts
export class SmartPause {
  constructor(getVideo: () => HTMLVideoElement | null, getEnabled: () => boolean, onToast: () => void);
  onCaptionEnter(): void;  onCaptionLeave(isCardOpen: boolean): void;
  onCardOpen(): void;      onCardClose(isPointerOverCaptions: boolean): void;
  onUserPlay(): void;      // listen to the video 'play' event, ignoring plays we trigger
}
```
Implements the table in 03 §5 exactly. Internal flags: `pausedByUs`, `userResumedWhileOpen`, `ourPlayInFlight`. Uses only `video.pause()` / `video.play()` (catch and ignore the `play()` promise rejection). Toast rate limit 10 s.

### 6.6 `ShadowTooltip.ts` and `placement.ts`

`ShadowTooltip` (class):
- Creates a host `<div id="sve-host">` with `all: initial; position: fixed; z-index: 2147483647; top:0; left:0` appended to `document.fullscreenElement ?? document.body`; `host.attachShadow({ mode: 'closed' })`. Keeps the shadow root reference privately.
- Injects `tooltipCss` (from `tooltip.css.ts`) as a `<style>` into the shadow root.
- Public API: `show(opts)`, `update(partial)`, `close()`, `isOpen()`, `contains(node)` (via `event.composedPath().includes(host)`), `toast(text)`, `onClose(cb)`, `onSave(cb)`, `onRetry(cb)`, `onNavigate(dir)`.
- Renders every state in 03 §4.4. Build DOM with helper `h(tag, attrs, ...children)` using `textContent` only (no `innerHTML`).
- Pronunciation: dictionary audio via `new Audio(url).play()`, else `speechSynthesis`.
- On `fullscreenchange`: move the host to the new parent, call `reposition()`.
- On `window` `resize` and `scroll` (capture): `reposition()`.
- Focus: on show, focus the ✕ button inside the shadow root; the host root element has `role="dialog"`, `aria-label`.

`placement.ts`:
```ts
export interface Rect { top: number; left: number; width: number; height: number }
export interface Placement { top: number; left: number; placement: 'above' | 'below' | 'left' | 'right' }
export function computePlacement(
  anchor: Rect, card: { width: number; height: number },
  viewport: { width: number; height: number }, playerRect: Rect | null,
): Placement;
```
Follows 03 §4.5. It is pure; the tests cover all four placements, clamping and the control-bar avoidance.

## 7. Background service worker

### 7.1 Router (`background/index.ts`)
- `chrome.runtime.onMessage.addListener((msg: BgRequest, sender, sendResponse) => { handle(msg).then(sendResponse); return true; })` — **must return `true`** to keep the channel open for async responses.
- `handle` switches on `msg.type` and always returns `Result<…>`; wraps each branch in try/catch → `{ ok: false, error: { code: 'UNKNOWN', ... } }`.
- `LOOKUP`: if `isPhrase && phraseMeaning` → `{ dictionary: { word: term, meanings: [{ partOfSpeech: 'idiom', definitions: [{ definition: phraseMeaning }] }] }, level: estimateLevel(term, true) }`. If `isPhrase` without a meaning → `{ dictionary: null, level: estimateLevel(term, true) }`. Otherwise `getDefinition(term)` from `dictionaryService`; NOT_FOUND → `{ dictionary: null, level }` (not an error).
- `EXPLAIN`: `getApiKey()`; none → `{ ok:false, error:{ code:'NO_KEY' } }`; else `explain(...)` (cached).
- `SAVE_WORD` / `REMOVE_WORD`: storage wrapper.
- `TEST_KEY`: minimal request (term `"hello"`, context `"hello there"`) bypassing the cache; return `{ ok: true, data: null }` or the mapped error.
- `CLEAR_CACHE`: remove all `ai:*`, `dict:*` keys and `cacheIndex`.
- `chrome.runtime.onInstalled`: on `reason === 'install'`, open the onboarding page; also write default settings if absent.
- `chrome.commands.onCommand`: for `toggle-extension`, flip `enabled` through `setSettings` (content scripts react to the storage change and show the toast), no messaging required. (The `BgToContent` `TOGGLE_ENABLED` type is reserved; do not implement unless needed.)

### 7.2 `dictionaryService.ts`
`getDefinition(word: string): Promise<DictResult | null>` (null = not found; throws `AppError`-shaped errors for network failures).

1. `key = 'dict:' + word.toLowerCase()`; check the cache (`cache.getOrFetch`).
2. `GET https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`.
3. `404` → retry once with `lemmatize(word)` if different; still 404 → cache the negative result as `null` for 1 day (shorter TTL) and return `null`.
4. Other non-2xx or fetch failure → throw `{ code: 'NETWORK', message }`.
5. Normalise the response array: `word` = first entry's `word`; `phonetic` = first entry `phonetic` or first `phonetics[].text`; `audioUrl` = first non-empty `phonetics[].audio` (prefix `https:` if it starts with `//`); `meanings` = all entries' meanings with up to 3 definitions each.

### 7.3 `llmService.ts`

```ts
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
```

Zod schema `AiExplanationSchema` mirrors `AiExplanation` (enums for `register` and `cefr`; `.describe()` hints such as "at most 15 words" on text fields).

`explain(input: { term; context; level; pageTitle; model; apiKey }): Promise<AiExplanation>`:
1. Cache key `ai:` + `sha256Hex([term.toLowerCase(), normalizeContext(context), level, model].join('|'))`.
2. Through `cache.getOrFetch(key, loader)`: the loader builds the client and makes the call:
   ```ts
   const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
   const response = await client.messages.parse({
     model,
     max_tokens: 1024,
     system: buildSystemPrompt(level),
     messages: [{ role: 'user', content: buildUserMessage(term, context, pageTitle) }],
     output_config: { format: zodOutputFormat(AiExplanationSchema), effort: 'low' },
   });
   ```
   `dangerouslyAllowBrowser: true` is **required** because a service worker is a browser-like context. It is acceptable because the key is the user's own and is only sent to `api.anthropic.com`.
3. Do not set `temperature`, `top_p`, `top_k`, `thinking` or prefill: they are rejected on these models. Do not use `tool_choice`.
4. Guard: if `response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens' || !response.parsed_output` → throw `{ code: 'UNKNOWN' }` (never cache).
5. Error mapping (most specific first): `Anthropic.AuthenticationError` and `Anthropic.PermissionDeniedError` → `INVALID_KEY`; `Anthropic.RateLimitError` → `RATE_LIMIT`; `Anthropic.APIConnectionError` → `NETWORK`; anything else → `UNKNOWN`. Export a pure `mapAnthropicError(err: unknown): AppError` for testing.

**System prompt** (`buildSystemPrompt(level)`), verbatim:

> You explain English vocabulary to a learner at CEFR level {level}. Explain the meaning the term has in the given subtitle context, not every dictionary sense. Use words at or below the learner's level in your explanations. If the term is part of an idiom or phrasal verb in the context, explain the whole expression, and set isIdiom to true. Keep shortDefinition to at most 15 words and inContext to at most 35 words. Return only the requested fields.

**User message** (`buildUserMessage`):
```
Term: "{term}"
Subtitle context: "{context}"
Show: {pageTitle}
```

Field intent: `lemma` = base form; `ipa` = IPA without slashes; `partOfSpeech` = e.g. "noun", "verb", "adjective", "idiom", "phrasal verb"; `cefr` = the term's difficulty for learners (not the learner's level); `inContext` = what it means *in this scene*; `example` = a new simple example sentence; `simpler` = an easier synonym or paraphrase.

**Model notes:** The default `claude-opus-5-5` (thinking cannot be disabled; `effort: 'low'` keeps latency down). `claude-haiku-5-5` is by far the cheapest and fastest (~$0.10 / $0.50 per MTok) and is a good choice for this short structured task; it is user-selectable in Settings. Prompt caching is not used (the prompt is shorter than the minimum cacheable prefix).

### 7.4 `cache.ts`

```ts
export async function getOrFetch<T>(key: string, loader: () => Promise<T>, ttlMs?: number): Promise<T>;
export async function clearCache(): Promise<void>;
```
- Stored value `{ v: T; savedAt: number }`. Default TTL 30 days; negative dictionary entries 1 day. Expired entries are treated as a miss.
- `cacheIndex: {key, savedAt}[]` updated on each write; when it exceeds **3000**, delete the oldest 300 keys in one `chrome.storage.local.remove`.
- In-flight dedupe: module-level `Map<string, Promise<unknown>>`; concurrent calls with the same key share one promise; the entry is removed in `finally`.
- Errors are never cached.

## 8. Popup and onboarding (React)

- `popup/main.tsx` renders `<App />`; `App.tsx` holds the `tab` state and loads settings through a `useSettings()` hook (backed by `getSettings` + `onSettingsChanged`).
- `HomeTab`: sends `GET_STATE` to the active tab; on error (no listener) maps to "Open a YouTube or Netflix video". Level picker writes `setSettings({ level })`.
- `WordsTab`: `useSavedWords()` hook; search, expand, delete via `REMOVE_WORD`; CSV export builds a Blob (`'﻿' + csv`) and clicks a temporary `<a download>`.
- `SettingsTab`: key input; `Save` → `setApiKey`; `Test key` → `TEST_KEY` message with a loading state; model select; trigger radios; smart-pause switch; `Clear cache` → `CLEAR_CACHE`.
- Tailwind: `darkMode: 'media'`; colours from `tokens.ts`.
- Onboarding: static React page per 03 §8.

## 9. Build configuration

- `package.json` scripts:
  - `dev`: `vite`
  - `build`: `tsc --noEmit && vite build`
  - `typecheck`: `tsc --noEmit`
  - `test`: `vitest run`
  - `zip`: `npm run build && node scripts/zip.mjs`
- `vite.config.ts`: plugins `[react(), crx({ manifest })]`; `build.rollupOptions.input` includes the onboarding HTML; `build.target: 'es2022'`; `server.port: 5173`, `server.hmr.port: 5173`, `server.cors: true` (needed by crxjs dev mode).
- `scripts/zip.mjs`: Node script (no extra dependency) that zips `dist/` into `release/vocab-explainer-${version}.zip`. Use the `zip` CLI via `child_process.execFileSync('zip', ['-r', outfile, '.'], { cwd: 'dist' })` on macOS/Linux; fall back to PowerShell `Compress-Archive` on Windows.
- `tsconfig.json`: `target ES2022`, `module ESNext`, `moduleResolution Bundler`, `strict`, `noUncheckedIndexedAccess`, `jsx react-jsx`, `lib ["ES2022","DOM","DOM.Iterable"]`, `types ["chrome","vite/client"]`, `resolveJsonModule`, `include ["src","tests","vite.config.ts","vitest.config.ts"]`.
- `vitest.config.ts`: `environment: 'jsdom'`, `setupFiles: ['tests/setup.ts']`, `globals: false`.

## 10. Security and privacy

- No remote code, no `eval`, no inline scripts. The default MV3 CSP is used unchanged.
- Caption text is only ever inserted with `textContent` / text nodes (subtitles are untrusted input).
- The shadow root is `closed`; the host page cannot read or style the card.
- The API key is read only in the service worker and never leaves it, other than as the `x-api-key` header sent by the SDK to `api.anthropic.com`. It is stored in `chrome.storage.local`, never in `sync`.
- Do not log the API key, caption text or user words anywhere. `console.error` is allowed only for error codes and messages.
- No analytics or telemetry.

## 11. Testing plan (Vitest)

`tests/setup.ts` installs a minimal in-memory `chrome` mock: `storage.local`/`storage.sync` (`get`, `set`, `remove`, `onChanged`), `runtime.sendMessage`/`onMessage`, `tabs.query`/`sendMessage`.

| Test file | Covers |
|---|---|
| `idiomMatcher.test.ts` | longest match, 2–4 grams, inflected first token, punctuation and curly quotes, adjacent and overlapping candidates, single-token fallback ordering, empty input |
| `idioms.test.ts` | invariants: 250–400 entries, lowercase keys, 2–4 words, meaning non-empty and ≤ 15 words, no duplicates |
| `lemma.test.ts` | irregular and suffix rules |
| `level.test.ts` | rank thresholds, unknown words → C2, idiom → B2 estimated |
| `hash.test.ts` | SHA-256 known vector, `normalizeContext` |
| `cache.test.ts` | hit, miss, TTL expiry (fake timers), pruning past 3000, in-flight dedupe, errors not cached |
| `dictionaryService.test.ts` | response normalisation, 404 → lemma retry → null, network error mapping (mock `fetch`) |
| `llmService.test.ts` | prompt builders, `mapAnthropicError` for each class, refusal/max_tokens guard, parsed output returned and cached (mock `@anthropic-ai/sdk` with `vi.mock`) |
| `captionWrapper.test.ts` | jsdom: wraps tokens, idempotent via `data-sve-done`, preserves text exactly, phrase grouping, no `innerHTML` injection with `<img onerror>` captions |
| `placement.test.ts` | above, below, left, right, viewport clamp, control-bar avoidance |
| `smartPause.test.ts` | every row of 03 §5 with a fake video element |
| `storage.test.ts` | defaults merge, key stored in local not sync, saved words add/remove, change subscription |
| `csv.test.ts` | quoting of commas, quotes and newlines; header; BOM handled by caller |
| `ShadowTooltip.test.ts` | renders loading, free, AI, not found and error states with exact copy; Save toggle; `Esc` closes |

`npm test` must pass with zero skipped tests.

## 12. Performance budget

- Content script bundle ≤ 120 KB min (IDIOMS ~15 KB; wordFrequency may be loaded lazily in the **service worker only** — `level.ts`/`lemma.ts` are used by the matcher in the content script, so `lemma.ts` must use a small suffix-rule + irregular map and **must not import `wordFrequency`** in the content bundle; the frequency-based candidate check described in 5.5 applies only when `lemmatize` is called from the service worker with an optional `exists` predicate argument). Concretely: `lemmatize(word, exists?: (w: string) => boolean)`; without `exists`, the first suffix-rule candidate that yields a non-empty stem is returned.
- `processCaptions()` should do no more than O(caption length) work per mutation burst and never block longer than 4 ms on a typical line.
- No timers are running when the extension is off or the page isn't a watch page, apart from the 500 ms URL poll.
