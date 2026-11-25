# 01 — Product Requirements Document

**Product:** Subtitle Vocab Explainer (Chrome extension, Manifest V3)
**Status:** Approved for implementation (v1 / demo)
**Last updated:** 2026-10-10

---

## 1. Problem

English learners watching YouTube and Netflix keep running into unknown words, idioms and slang. To look one up they have to pause, open a dictionary tab, scroll through a dozen senses and guess which one the speaker meant. That breaks immersion, so most learners stop looking things up at all.

The tools that exist today are cluttered (sidebars that reflow the page), paywalled (vocabulary capped or locked), or fragile (they break when Netflix updates). See [02-competitor-analysis.md](02-competitor-analysis.md).

## 2. Goal

A **one-click, in-place explanation of what a word or idiom means in *this* scene**. It is shown in a polished card that never gets in the way of the video, works without an account, and stays fast through caching.

## 3. Personas

| Persona | Description | Primary need |
|---|---|---|
| **Priya, B1–B2 learner** | Watches Netflix series to practise English. Knows everyday words; trips on less common vocabulary. | Fast, simple definitions in easy English; save words to review later. |
| **Marco, C1 learner** | Watches YouTube talks and comedy. Vocabulary is good; idioms, slang and cultural references trip him up. | Explanation of idioms and slang *in context*, register (informal/slang) labels. |
| **Demo audience** | Stakeholders seeing the extension live. | A smooth, impressive, glitch-free 5-minute demo. |

## 4. Scope

### 4.1 IN scope (v1 / demo)

| # | Feature | Details |
|---|---|---|
| F1 | **Sites** | `https://www.youtube.com/watch*` and `https://www.netflix.com/watch*`, using the site's own caption/subtitle text (no caption generation). |
| F2 | **Interactive captions** | Every caption word is hoverable (highlight). Click opens the **hover card**. Optional "hover" trigger mode (350 ms dwell). |
| F3 | **Smart pause** | The video pauses when the pointer enters the caption area or a card opens. It resumes when the pointer leaves and the card is closed, **only if the extension paused it**. Can be turned off in Settings. |
| F4 | **Idiom / phrasal-verb detection** | Matched automatically against a bundled list (~300 entries), multi-word n-gram matching up to 4 tokens with light inflection handling. Matches get a dotted amber underline; clicking explains the whole phrase. |
| F5 | **Drag-select phrases** | Selecting 2–6 caption words and releasing the mouse opens the card for that phrase. |
| F6 | **Hover card** | Word or phrase, IPA, 🔊 pronunciation, level badge, one-line definition, "In this scene" contextual explanation (AI Mode), example, "Simpler" paraphrase (AI Mode), Save toggle. Rendered in a closed Shadow DOM. |
| F7 | **Free Mode** (default, no key) | Definition from `dictionaryapi.dev`; idiom meaning from the bundled list; estimated level ("est. B2") from a bundled word-frequency list. |
| F8 | **AI Mode** (optional, Anthropic key) | A Claude call explains the sense used in *this* caption line at the learner's level, assigns a CEFR level, flags idioms and register, gives a simpler paraphrase. **Progressive:** the dictionary result renders first, the AI section fills in below. |
| F9 | **Caching** | Dictionary and AI results are cached in `chrome.storage.local`. AI entries are keyed by SHA-256 of term + context + level + model. 30-day TTL, pruned past 3000 entries, in-flight requests deduplicated. |
| F10 | **Popup** | Three tabs. **Home:** on/off switch, current-tab status, level picker (B1/B2/C1/C2), mode and smart-pause summary, recently saved words. **Words:** saved list with search, expand, delete, CSV export. **Settings:** API key (with Test), model, card trigger, smart pause, clear cache. |
| F11 | **Fullscreen support** | The card and toast render correctly in fullscreen on both sites. |
| F12 | **Keyboard** | While a card is open: `Esc` close, `S` save, `P` pronounce, `←`/`→` previous/next word. Global `Alt+Shift+V` toggles the extension. |
| F13 | **Onboarding page** | Opens on first install: three steps, plus a "Try it on YouTube" button. |
| F14 | **Tests** | Vitest unit tests for all pure logic and DOM wrappers (see 04 §11). |
| F15 | **CI** | GitHub Actions: typecheck, test, build, zip artifact. Optional tag-triggered Chrome Web Store publish job, **documented but not run for the demo**. |

### 4.2 OUT of scope (v1)

These are deliberately excluded. Do **not** implement them; record requests for them in `docs/CHANGELOG-decisions.md`.

- Dual subtitles, or translating captions into other languages.
- Any site other than YouTube and Netflix (Prime, Disney+, Coursera, etc.).
- Firefox, Safari, mobile browsers.
- Generating captions for videos without them; image-based (bitmap) subtitles.
- User accounts, cloud sync, payments, subscriptions.
- A backend or proxy server of any kind.
- Spaced-repetition review or flashcard practice mode. v1 only **saves and exports**.
- Direct Anki integration (CSV export only).
- A transcript sidebar or any panel that reflows the host page.
- Analytics, telemetry, crash reporting.
- UI languages other than English.
- Actually publishing to the Chrome Web Store (the pipeline is documented only).
- Restyling captions beyond the highlight and underline classes defined in 03.

## 5. User stories and acceptance criteria

| ID | Story | Acceptance criteria |
|---|---|---|
| US1 | As Priya, I click an unknown word and see its meaning without leaving the video. | Card opens within 300 ms (warm cache) or 1.5 s (cold); the video is paused; closing the card resumes playback. |
| US2 | As Marco, I see idioms highlighted and get the meaning of the whole phrase. | Idioms in the bundled list are underlined; clicking any word inside one opens the card for the full phrase. |
| US3 | As Marco, I want to know what a word means *here*, not every sense. | With an AI key, "In this scene" explains the sense used in the current line in ≤ 35 words; appears within 4 s. |
| US4 | As Priya, I save words and review/export them later. | Save toggles; saved words appear in the popup's Words tab with context and source; CSV export downloads a valid file. |
| US5 | As any user, I use it in fullscreen. | Card and toast visible and positioned correctly in fullscreen on both sites. |
| US6 | As any user, I control intrusiveness. | Smart pause and card trigger mode can be changed in Settings and apply immediately to open tabs. |
| US7 | As any user, I know when something is wrong. | Popup shows a clear status ("Turn on captions", "Captions not detected — the site may have changed", etc.); card errors have readable messages and a Retry button. |

## 6. Success criteria (demo)

- Free Mode card: **< 300 ms** warm cache, **< 1.5 s** cold.
- AI section: **< 4 s** after click.
- **Zero layout shift** on YouTube/Netflix pages (no sidebar, no reflow, highlight does not change font metrics).
- Works in **fullscreen** on both sites.
- **No console errors** on the host page caused by the extension.
- `npm run typecheck && npm test && npm run build` all pass.
- The demo script in [06-demo-and-deployment.md](06-demo-and-deployment.md) runs end-to-end without a glitch.

## 7. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| YouTube/Netflix change their caption DOM | Extension stops detecting captions | Selector arrays with fallbacks in `siteAdapters.ts`; popup status "Captions not detected — the site may have changed"; selectors documented in 06 troubleshooting. |
| API key stored in the browser | Key exposure if the profile is compromised | Key lives only in `chrome.storage.local` (never `sync`), used only in the service worker, never sent to content scripts; privacy note in Settings. |
| Netflix player quirks (it dislikes external seeking) | Player errors | Only ever call `video.pause()` / `video.play()`; never set `currentTime`. |
| Free dictionary misses words / gives wrong sense | Weak Free Mode answers | Lemma retry; bundled idiom list; "not found" state; AI Mode nudge. |
| LLM cost/latency | Slow cards, user cost | Cache, deduplication, short fixed-shape output (`max_tokens` 1024, `effort: low`), model selectable (Haiku 5.5 is cheapest). |
| Host-page click handlers toggle play/pause | Clicking a word toggles video | Capture-phase listeners with `stopPropagation()` on handled clicks. |

## 8. Glossary

- **Card / hover card:** the floating explanation panel (Shadow DOM).
- **Free Mode:** no API key; dictionary + idiom list + frequency level.
- **AI Mode:** Anthropic API key present; adds contextual explanation.
- **CEFR:** Common European Framework levels A1–C2.
- **Term:** a single word or a multi-word phrase being looked up.
- **Context:** the previous caption line plus the current caption line.
