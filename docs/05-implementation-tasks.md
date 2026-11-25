# 05 — Implementation Tasks

For the implementing model. Work **one milestone at a time**, in order. Before ticking a milestone run:

```bash
npm run typecheck && npm test && npm run build
```

All three must pass. Read [03](03-ux-ui-spec.md) and [04](04-technical-design.md) before starting; this file only sequences the work.

## Ground rules

- **Do:** follow the names, types and copy in 03 and 04 exactly; keep functions small and pure where testable; write the tests listed for the milestone in the same milestone.
- **Do not:**
  - add dependencies beyond those in 04 §1;
  - use `innerHTML`, `outerHTML` or `insertAdjacentHTML` with any caption or API text;
  - leave placeholders, `TODO`s, `any`, or `@ts-ignore`;
  - change the design tokens, the copy, or the scope;
  - send the API key to the content script or log it;
  - call `video.currentTime = …`, ever.
- **Deviations:** if the design cannot be implemented as written, choose the smallest workable change and append an entry to `docs/CHANGELOG-decisions.md` (date, what, why).
- **Commits:** one commit per milestone, message `M<n>: <title>`.

---

## M0 — Scaffold

**Create:** `package.json` (scripts per 04 §9, `"version": "0.1.0"`), `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `tailwind.config.js`, `postcss.config.js`, `src/manifest.ts`, `scripts/zip.mjs`, `tests/setup.ts` (chrome mock), `public/icons/icon-{16,32,48,128}.png`, empty-but-valid entry files: `src/background/index.ts`, `src/content/index.ts`, `src/popup/{index.html,main.tsx,App.tsx,index.css}`, `src/onboarding/{index.html,main.tsx}`, `docs/CHANGELOG-decisions.md` (header only), `.gitignore` (`node_modules`, `dist`, `release`).

**Icons:** generate simple square PNGs (e.g. an accent-blue `#7C9CFF` rounded square with a white "V") with a one-off Node script using only built-in modules (write a minimal PNG encoder, or draw via a tiny inline SVG converted with the OS tool such as `sips`/`rsvg-convert` if available). Do not commit the generator script's dependencies.

**Acceptance**
- `npm install` succeeds.
- `npm run build` produces `dist/` with a valid `manifest.json`.
- `dist/` loads in `chrome://extensions` without manifest errors, and the popup opens showing a blank React page.
- `npm test` runs (may report "no tests" only if `passWithNoTests` is set; add one trivial test to avoid this).

## M1 — Shared modules + tests

**Create:** `src/shared/{types,tokens,storage,hash,level,lemma,idioms,wordFrequency,csv}.ts` and the tests `idioms`, `lemma`, `level`, `hash`, `storage`, `csv`.

**Steps**
1. `types.ts` and `tokens.ts` exactly as in 04 §4 and 03 §2.
2. `hash.ts`, `lemma.ts` (note the `exists?` predicate, 04 §12), `level.ts`, `csv.ts`, `storage.ts`.
3. `idioms.ts`: write ~300 entries (see 04 §5.6). Keep meanings ≤ 15 words, plain English.
4. `wordFrequency.ts`: generate from a downloaded frequency list (see 04 §5.4); put the source and licence in the file header.

**Acceptance:** all listed tests green; the idiom invariants test passes (250–350 entries, no duplicates, ≤ 4 words).

## M2 — Content: caption detection and wrapping

**Create:** `src/content/{siteAdapters,captionWrapper,idiomMatcher,pageStyles}.ts`, the bootstrap in `src/content/index.ts` (SPA navigation, controller, observer, event delegation **without** the card yet: log the clicked term to the console behind a `DEBUG` const that is `false`), tests `idiomMatcher`, `captionWrapper`.

**Steps**
1. Site adapters with selector arrays (04 §6.2).
2. `tokenize` and `wrapLine` in `captionWrapper.ts`; `idiomMatcher.ts` (04 §6.4).
3. Controller: wait for the player, inject styles, observe mutations with the rAF-coalesced `processCaptions`, history ring buffer.
4. Capture-phase `click` that stops propagation when a `.sve-w` is clicked.
5. Status tracking for `captionsStatus` (`waiting` → `detected` when the first line is wrapped; `not-detected` after 30 s of playback with no caption root).

**Acceptance**
- On a YouTube video with captions on: caption words highlight on hover, idioms are underlined with the dotted amber style, saved-word style class is applied (none yet).
- No layout shift (compare caption position with the extension off/on).
- Clicking a caption word does not toggle play/pause.
- Navigating between videos (SPA) re-initialises correctly.
- Tests green.

## M3 — ShadowTooltip (mock data)

**Create:** `src/content/{ShadowTooltip,placement,tooltip.css}.ts`, tests `placement`, `ShadowTooltip`.

**Steps**
1. `computePlacement` per 03 §4.5 with tests first.
2. `ShadowTooltip` renders **all** states from 03 §4.4 from a typed view-model; use fixture data from a dev-only `?sve-demo` query string flag *or* a test-only helper (do not ship dev flags in production code).
3. Fullscreen re-parenting, resize/scroll repositioning, focus handling, keyboard (`Esc`, `S`, `P`, arrows), toast.
4. Wire the content script: clicking a word shows the card in the **loading** state, then (temporarily) a mocked Free Mode result from a local function that M4 replaces.

**Acceptance**
- Card visually matches the mockups in 03 §4.1/4.2 (compare side by side).
- Works in fullscreen; never overlaps the bottom 64 px of the player; opens above the caption.
- Exact error/empty copy for each state.
- Tests green.

## M4 — Background, dictionary, cache: Free Mode end-to-end

**Create:** `src/background/{index,dictionaryService,cache}.ts`; tests `cache`, `dictionaryService`.

**Steps**
1. Cache (`getOrFetch`, TTL, prune, dedupe).
2. Dictionary service with normalisation and lemma retry.
3. Router handling `LOOKUP`, `SAVE_WORD`, `REMOVE_WORD`, `CLEAR_CACHE`; `onInstalled` (defaults and onboarding tab).
4. Replace the mock in the content script with `chrome.runtime.sendMessage({type:'LOOKUP', ...})`; render the dictionary/idiom result and the estimated level; implement Save/Unsave and `.sve-saved` refresh.

**Acceptance**
- Clicking a real word on YouTube shows the real definition, IPA, audio button, `est.` badge, and the AI nudge.
- Clicking an underlined idiom shows the idiom meaning with the `B2+` badge.
- A second lookup of the same word is served from the cache (verify in the service-worker DevTools: no network request).
- Save toggles; the word is underlined green on the page.
- Tests green.

## M5 — Smart pause, drag-select, Netflix

**Create:** `src/content/smartPause.ts` and its test; extend the controller.

**Steps**
1. `SmartPause` per 03 §5 / 04 §6.5; wire the caption enter/leave, card open/close and video `play` events; the toast.
2. Drag-select (`mouseup` handler) per 03 §3.
3. Hover trigger mode (350 ms dwell) driven by the settings.
4. Verify and fix the Netflix adapter on a real title (selectors may need adjusting; keep the fallback arrays and record the final selectors in `docs/CHANGELOG-decisions.md`).

**Acceptance**
- Every row of the 03 §5 table is demonstrably true on YouTube and Netflix.
- Selecting "break the ice" across words opens the card for the phrase.
- Netflix: captions wrap, click works, the card appears in fullscreen.
- Tests green.

## M6 — Claude AI Mode

**Create:** `src/background/llmService.ts`, test `llmService`; extend the router (`EXPLAIN`, `TEST_KEY`) and the card.

**Steps**
1. Install `@anthropic-ai/sdk` and `zod` if not yet present.
2. `llmService.explain` exactly per 04 §7.3 (`messages.parse`, `zodOutputFormat`, `effort: 'low'`, `dangerouslyAllowBrowser: true`, no temperature/thinking/prefill/`tool_choice`).
3. Parallel `LOOKUP` + `EXPLAIN`; progressive render with the data priority rules (03 §4.3) and the "Reading the scene…" state.
4. Error mapping and copy for `INVALID_KEY`, `RATE_LIMIT`, `NETWORK`, `UNKNOWN`; Retry re-sends only the failed request.
5. Ignore late responses for closed or re-targeted cards (`requestId`).

**Acceptance**
- With a valid key, "IN THIS SCENE" appears within 4 s and reflects the *current line*, not generic senses.
- With an invalid key: "Your API key was rejected. Check it in Settings."
- Changing the level B2 → C1 and re-looking up a word produces a **new** (not cached) explanation; repeating the same lookup is cached.
- Tests green (SDK mocked; no real API calls in the test suite).

## M7 — Popup, settings, onboarding, command

**Create:** `src/popup/*`, `src/onboarding/*`; extend the background (`chrome.commands`).

**Steps**
1. `App.tsx` tabs; `HomeTab` (status line via `GET_STATE`, level picker, mode row, recent words).
2. `WordsTab` (search, expand, delete, CSV export).
3. `SettingsTab` (key save/test/remove, model, trigger, smart pause, clear cache, privacy note).
4. Onboarding page per 03 §8; opens on install.
5. `Alt+Shift+V` command toggles `enabled`; the content script shows the "Vocab Explainer on/off" toast.
6. Live settings propagation to open tabs.

**Acceptance**
- Every popup control works and persists; settings changes apply immediately in an open video tab.
- CSV opens correctly in Excel/Sheets (non-ASCII intact).
- Light and dark themes both correct.
- Status line shows the right text for every case in 03 §7.1.

## M8 — CI, README, polish

**Create/update:** `.github/workflows/ci.yml` (see [06](06-demo-and-deployment.md) §8), `README.md`; fix everything found by the polish checklist.

**Steps**
1. CI workflow with `ci` and `publish` jobs.
2. Walk through the polish checklist in 03 §10 and fix each item.
3. Run the full demo script from 06 §6 twice on a clean Chrome profile.
4. `npm run zip` produces `release/vocab-explainer-0.1.0.zip` that loads unpacked.

**Acceptance:** the polish checklist is fully ticked; the demo script passes end-to-end twice; CI passes on a push.

---

## Definition of Done (whole project)

- [ ] `npm run typecheck`, `npm test` (zero skipped) and `npm run build` pass.
- [ ] All IN-scope features F1–F15 in the PRD work; nothing OUT of scope was added.
- [ ] Every UI state in 03 §4.4 renders with the exact copy.
- [ ] Polish checklist (03 §10) fully ticked.
- [ ] No `innerHTML` with dynamic text, no `any`, no `TODO`, no console logging of keys or captions.
- [ ] Demo script passes on YouTube and Netflix.
- [ ] `docs/CHANGELOG-decisions.md` lists every deviation.
