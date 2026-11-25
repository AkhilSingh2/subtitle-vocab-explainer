# 03 — UX / UI Specification

This document is the **single source of truth for look and behaviour**. Implement it exactly. Do not invent new colours, spacing or copy. If something is unspecified, choose the simplest option consistent with this document and log it in `docs/CHANGELOG-decisions.md`.

---

## 1. Design principles

1. **The video is the hero.** Nothing we add may reflow the page, cover the speaker's face by default, or cover the player controls.
2. **Answer first, detail second.** The one-line definition is visible instantly; the context and extras load in below it.
3. **Every state talks.** No silent spinners. Loading, empty, error and not-found states all have copy and, where relevant, a Retry.
4. **Undo what we do.** If we paused the video, we resume it. If we highlighted something, it costs zero layout.
5. **Keyboard and fullscreen are first-class**, not afterthoughts.

## 2. Design tokens

All tokens live in **`src/shared/tokens.ts`** (exported constants). The tooltip CSS (`src/content/tooltip.css.ts`) and `tailwind.config.js` both import from this one place.

### 2.1 Colour

| Token | Value | Use |
|---|---|---|
| `surface` | `rgba(22, 24, 29, 0.96)` (`#16181D` @ 96%) | Card and toast background |
| `surfaceRaised` | `#1F2229` | Buttons, inputs on dark surfaces |
| `border` | `rgba(255, 255, 255, 0.08)` | Card border, dividers |
| `textPrimary` | `#F5F7FA` | Headings, body |
| `textSecondary` | `#A9B1BD` | IPA, meta, labels |
| `accent` | `#7C9CFF` | Links, focus ring, hover highlight base |
| `success` | `#3DD68C` | Saved state, saved-word underline |
| `idiom` | `#FFB547` | Idiom underline, "idiom" tag |
| `error` | `#FF6B6B` | Error copy |
| `hoverBg` | `rgba(124, 156, 255, 0.25)` | Caption word hover background |
| `skeleton` | `rgba(255, 255, 255, 0.08)` → `0.14` shimmer | Loading placeholders |

**Level badges** (background / text):

| Level | Background | Text |
|---|---|---|
| A1/A2 | `#2A3B2F` | `#7FE0A0` |
| B1 | `#1F3D2B` | `#3DD68C` |
| B2 | `#173B3D` | `#4FD1C5` |
| C1 | `#2E2547` | `#A78BFA` |
| C2 | `#3D1F3A` | `#F472B6` |

In Free Mode the badge text is prefixed with `est.` (e.g. `est. B2`), because the level is a frequency estimate. Idioms in Free Mode show `B2+`.

**Popup theme:** follows `prefers-color-scheme`.
- Light: background `#FFFFFF`, text `#111318`, secondary `#5B6472`, border `#E6E8EC`, accent `#4F6EF7`.
- Dark: uses the card colours above.

### 2.2 Typography

Font stack: `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`. IPA uses the same stack.

| Role | Size / weight / line-height |
|---|---|
| Term (card header) | 20px / 600 / 1.25 |
| Body | 14px / 400 / 1.5 |
| Section label ("IN THIS SCENE") | 11px / 700 / 1.4, letter-spacing 0.08em, uppercase, `textSecondary` |
| Meta (IPA, tags, hints) | 12px / 500 / 1.4 |
| Button | 13px / 600 |

### 2.3 Spacing, shape, elevation, motion

- Spacing scale: **4, 8, 12, 16, 24** px. Card padding 16px; gap between sections 12px.
- Card: width **340px**, max-height **360px** (body scrolls internally), radius **14px**, border 1px `border`, shadow `0 12px 40px rgba(0,0,0,0.45)`, `backdrop-filter: blur(12px)`.
- Buttons: height 32px, radius 8px, padding 0 12px.
- Focus ring: `2px solid accent`, offset 2px, on every interactive element.
- Motion: open is **120 ms** `opacity 0→1` plus `translateY(4px→0)`, ease-out; close is 80 ms fade. With `prefers-reduced-motion: reduce`, there is no translate and a 0 ms duration.
- z-index of the tooltip host: `2147483647`.

## 3. Caption interactions (on the host page)

The page CSS is injected once into the host page (not the shadow root). All classes are prefixed `sve-`.

| Element | Style | Behaviour |
|---|---|---|
| `.sve-w` (word) | `cursor: pointer; border-radius: 4px; transition: background 80ms;` — **no padding, margin, font or line-height changes** (zero layout shift) | Hover sets `background: hoverBg`. |
| `.sve-p` (idiom group) | `text-decoration: underline dotted idiom 2px; text-underline-offset: 3px;` | Hovering any word inside highlights the **whole group**. Clicking any word inside opens the card for the **full phrase**. |
| `.sve-saved` (word already saved) | `text-decoration: underline solid success 1px; text-underline-offset: 3px;` | Resurfaces saved vocabulary. If a word is both saved and inside an idiom, the idiom underline wins. |
| Caption text containers | `pointer-events: auto !important; user-select: text !important;` | Lets the pointer reach captions (Netflix disables this by default). |

**Triggers**
- **Click mode (default):** click a word to open the card.
- **Hover mode:** pointer rests on a word for 350 ms to open the card; moving to another word re-targets after 350 ms; clicking still works.
- **Drag-select:** select 2–6 words within one caption line and release the mouse to open the card for the selected text. Selections of 1 word behave like a click; more than 6 words, or more than 60 characters, are ignored.
- Clicks handled by the extension must not toggle play/pause on the site (capture phase plus `stopPropagation`).

## 4. Hover card

### 4.1 Anatomy (AI Mode, loaded)

```
┌──────────────────────────────────────────┐
│ break the ice           🔊   [C1]   ✕    │  ← header: term · audio · level · close
│ /breɪk ðə aɪs/  · idiom · informal       │  ← meta: IPA · part of speech / "idiom" · register (if not neutral)
├──────────────────────────────────────────┤
│ To make people feel relaxed when they    │  ← shortDefinition (≤ 15 words)
│ first meet.                              │
│                                          │
│ IN THIS SCENE                            │  ← section label
│ Jim tells a joke so the new team stops   │  ← inContext (≤ 35 words)
│ feeling awkward at the meeting.          │
│                                          │
│ “He told a joke to break the ice.”       │  ← example (italic, textSecondary)
│ Simpler: start a friendly conversation   │  ← simpler (meta size)
├──────────────────────────────────────────┤
│ [ ☆ Save word ]        ← →  · Esc close  │  ← footer: save button · keyboard hint
└──────────────────────────────────────────┘
```

### 4.2 Free Mode, loaded

```
┌──────────────────────────────────────────┐
│ reluctant               🔊  [est. B2] ✕  │
│ /rɪˈlʌktənt/  · adjective                │
├──────────────────────────────────────────┤
│ Not wanting to do something; unwilling.  │  ← first definition matching the part of speech
│                                          │
│ “She was reluctant to leave.”            │  ← dictionary example if present
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ ✨ Add an AI key in Settings for      │ │  ← nudge (dismissible ✕, stays dismissed)
│ │    in-context meaning →              │ │
│ └──────────────────────────────────────┘ │
├──────────────────────────────────────────┤
│ [ ☆ Save word ]        ← →  · Esc close  │
└──────────────────────────────────────────┘
```

For an idiom in Free Mode, the definition comes from the bundled idiom list; the meta line shows `idiom`; the badge shows `B2+`.

### 4.3 Data priority

When both dictionary and AI results exist:

| Field | Source priority |
|---|---|
| IPA | dictionary `phonetic` → AI `ipa` → hidden |
| Part of speech | AI `partOfSpeech` → first dictionary meaning → hidden ("idiom" if `isIdiom`) |
| Level badge | AI `cefr` (no "est.") → frequency estimate (`est.`) |
| One-line definition | AI `shortDefinition` → first dictionary definition → idiom list meaning |
| Example | AI `example` → dictionary example → hidden |
| In this scene / Simpler | AI only |

When the AI result arrives after the dictionary result, swap fields in place with a 120 ms cross-fade and **no change in card position**. The card may grow downward only.

### 4.4 States and exact copy

| State | Trigger | What's shown |
|---|---|---|
| **Loading** | Card opened, no data yet | Header shows the term immediately (audio and badge hidden). Body: 3 skeleton bars (100%, 85%, 60% width, 10px tall, 8px gap) with a shimmer. |
| **Free loaded** | Dictionary or idiom result, no key | §4.2 layout. The nudge is shown unless `nudgeDismissed`. |
| **AI loading** | Dictionary shown, AI pending | §4.1 top part filled from the dictionary; under "IN THIS SCENE": 2 skeleton bars plus meta text "Reading the scene…". |
| **AI loaded** | AI result | §4.1. |
| **Not found (dictionary)** | Dictionary 404, not an idiom | Body: "No dictionary entry for ‘{term}’." If AI Mode: continue to AI loading/loaded and hide this line once AI arrives. If Free Mode: second line "It may be a name or slang." plus the nudge. |
| **Dictionary error** | Network failure | "Couldn't reach the dictionary." plus `[ Retry ]` button. |
| **AI error: INVALID_KEY** | 401 | Under "IN THIS SCENE": "Your API key was rejected. Check it in Settings." plus `[ Open Settings ]` (opens the popup via `chrome.runtime.openOptionsPage` fallback to a message). |
| **AI error: RATE_LIMIT** | 429 | "Too many requests — try again in a moment." plus `[ Retry ]`. |
| **AI error: NETWORK** | Connection failure | "Couldn't reach the AI service." plus `[ Retry ]`. |
| **AI error: UNKNOWN** | Anything else, including refusal or truncated output | "Couldn't explain this one." plus `[ Retry ]`. |
| **Saved** | Save clicked | Button becomes `✓ Saved` in `success` colour; clicking again un-saves and returns to `☆ Save word`. Matching caption words get `.sve-saved` immediately. |

Error copy always appears in `error` colour at body size. Dictionary and AI errors are independent: one failing never hides the other's result.

### 4.5 Placement rules

Implemented as a pure function `computePlacement(anchorRect, cardSize, viewport, playerRect)` that returns `{top, left, placement: 'above'|'below'|'left'|'right'}`.

1. Anchor to the bounding rect of the clicked word (or the phrase group or selection).
2. **Prefer above** the anchor with an 8px gap, horizontally centred on the anchor.
3. If there isn't room above, try **right**, then **left** (vertically centred on the anchor), then **below**.
4. Clamp to the viewport with an **8px margin**.
5. **Never overlap the bottom 64px of the player rect** (the controls). If a placement would, shift it up.
6. The card does not follow the pointer and does not move while open, except when the window is resized or fullscreen changes; then recompute.

**Fullscreen:** the shadow host element is a child of `document.fullscreenElement ?? document.body`. On `fullscreenchange`, move the host there and recompute placement.

**Close triggers:** ✕ button, `Esc`, a click outside the card (and not on a caption word), caption line changing while the pointer is outside the card, extension turned off.

### 4.6 Pronunciation

The 🔊 button and the `P` key play the dictionary `audioUrl` if present (via `new Audio(url)`); otherwise they use `speechSynthesis.speak()` with `lang = 'en-US'`, `rate = 0.9`. While playing, the icon shows an active state (accent colour). Video playback is not affected.

## 5. Smart pause

| Situation | Behaviour |
|---|---|
| Pointer enters the caption area while the video is playing | Pause; remember `pausedByUs = true`; show the toast. |
| Card opens while the video is playing | Same as above. |
| Pointer leaves the caption area and no card is open | If `pausedByUs`, play and reset `pausedByUs`. |
| Card closes and the pointer is not over captions | If `pausedByUs`, play and reset. |
| User presses play manually while paused by us | Reset `pausedByUs = false`; do **not** pause again until the next card open (hovering captions won't re-pause). |
| Video was already paused by the user | Never auto-resume. |
| Smart pause off in Settings | Never pause or resume. |

**Toast:** bottom-left of the player rect (16px inset), `surface` background, 12px/500 text "Paused for lookup", pill radius 999px, padding 6px 12px. Visible 1.2 s, then fades out over 200 ms. Rendered in the same shadow root as the card. Shown at most once every 10 s.

## 6. Keyboard

| Key | When | Action |
|---|---|---|
| `Esc` | Card open | Close card. |
| `S` | Card open | Toggle save. |
| `P` | Card open | Pronounce. |
| `←` / `→` | Card open | Move to the previous/next word in the current caption line and open its card (wraps within the line; idiom groups count as one item). |
| `Alt+Shift+V` | Anywhere (Chrome command `toggle-extension`) | Turn the extension on/off; a toast shows "Vocab Explainer on" / "off". |

Card keys are captured **only while a card is open**, with `preventDefault` and `stopPropagation` so YouTube/Netflix shortcuts (e.g. `←` seeks) don't fire. When no card is open, the extension does not intercept any keys. Keys are ignored when focus is in an input or textarea.

## 7. Popup (action)

Size **360 × 520 px**. React and Tailwind. Header: product name on the left, ON/OFF switch on the right (switch disabled state reads "OFF" in `textSecondary`). Three tabs below the header; the active tab has an accent underline.

### 7.1 Home tab

```
┌ Subtitle Vocab Explainer ─────── [ ON ●] ┐
│ [ Home ] [ Words (24) ] [ Settings ]     │
├──────────────────────────────────────────┤
│ ● Active on Netflix — captions detected  │
│                                          │
│ Your level   (B1) (B2●) (C1) (C2)        │
│ Mode         AI ✓  (Claude)              │
│ Smart pause  [●]                         │
│                                          │
│ Recently saved                           │
│  break the ice · idiom · C1      2m ago  │
│  reluctant · adj · B2           10m ago  │
│  see all →                               │
└──────────────────────────────────────────┘
```

**Status line** (coloured dot plus text; from `GET_STATE` sent to the active tab's content script):

| Condition | Dot | Text |
|---|---|---|
| Not a YouTube/Netflix tab, or no content script | grey | "Open a YouTube or Netflix video" |
| On site, not a watch page | grey | "Open a video to start" |
| Watch page, no captions seen in last 10 s | amber | "Turn on captions/subtitles to start" |
| Captions detected | green | "Active on {YouTube/Netflix} — captions detected" |
| Player found but no caption root matched for 30 s while video played | red | "Captions not detected — the site may have changed" |
| Extension off | grey | "Paused — turn on to use" |

- **Level picker:** segmented control B1/B2/C1/C2 (default B2).
- **Mode row:** "AI ✓ (Claude)" if a key is saved, else "Free · add AI key →" (link switches to the Settings tab).
- **Recently saved:** last 3 words.

### 7.2 Words tab

- Search input (filters by word, definition or context; case-insensitive).
- Sort: newest first.
- Row: **word** · type (part of speech or "idiom") · level badge · relative time. Click expands to show the definition, the context line in quotes, and the source ("YouTube · {page title}" linked to the URL), plus a 🗑 delete button.
- Footer: `[ Export CSV ]`. File name `vocab-YYYY-MM-DD.csv`. Columns: `word,definition,context,level,source,url,savedAt`. RFC 4180 quoting; UTF-8 with BOM so Excel opens it correctly.
- Empty state (centred, `textSecondary`): "Click any caption word to start your list."

### 7.3 Settings tab

| Control | Details |
|---|---|
| Anthropic API key | Password input plus "Show" toggle. `[ Save ]` and `[ Test key ]`. Test shows "✓ Key works" (success) or the mapped error copy. `[ Remove ]` when a key exists. Helper link: "Get a key at console.anthropic.com". |
| Model | Select: `Claude Opus 5.5` (`claude-opus-5-5`, default), `Claude Sonnet 5.5` (`claude-sonnet-5-5`), `Claude Haiku 5.5` (`claude-haiku-5-5`). Helper text under the select: "Haiku is the fastest and cheapest; Opus gives the richest explanations." |
| Card trigger | Radio: Click (default) / Hover. |
| Smart pause | Switch (default on). |
| Clear cache | Button; confirm text "Cache cleared". |
| Privacy note | "Your key is stored only in this browser and is sent only to api.anthropic.com. Words you look up are sent to dictionaryapi.dev (and to Anthropic in AI Mode)." |

All settings save immediately on change (except the key, which saves on `[ Save ]`), and open tabs react live.

## 8. Onboarding page (first install)

Opened via `chrome.runtime.onInstalled` (`reason === 'install'`). Full-page, centred column max 640px, uses the popup's light/dark theme.

1. Title: "Understand every word you hear." Subtitle: "Subtitle Vocab Explainer works on YouTube and Netflix captions."
2. Three step cards in a row (stacked under 640px wide), each with a simple CSS-shape illustration:
   1. **Turn on captions:** CC icon. "Turn on English captions or subtitles."
   2. **Click a word:** a caption line with one highlighted word. "Click any word, or drag across a phrase."
   3. **Optional: add AI:** sparkle icon. "Paste an Anthropic API key in Settings for in-context meanings."
3. Primary button: "Try it on a YouTube video" opens `https://www.youtube.com/watch?v=iG9CE55wbtY` in a new tab. (The implementer may substitute any TED talk with English captions; record the URL used.)
4. Secondary text: "Tip: press Alt+Shift+V to turn it on or off."

## 9. Accessibility

- Card: `role="dialog"`, `aria-modal="false"`, `aria-label="Definition of {term}"`; on open, focus moves to the ✕ button; on close, focus returns to the document.
- All buttons have accessible names (`aria-label` for icon buttons: "Pronounce", "Close", "Save word").
- Colour contrast meets WCAG AA on all text/background pairs above.
- Every popup control is reachable and operable by keyboard; visible focus ring everywhere.
- Respect `prefers-reduced-motion`.

## 10. Polish checklist (verify before M8 sign-off)

- [ ] No layout shift when hovering or highlighting captions on either site.
- [ ] Card never covers player controls; opens above the caption by default.
- [ ] Card visible and correctly placed in fullscreen on YouTube and Netflix.
- [ ] Every state in §4.4 can be reproduced and shows the exact copy.
- [ ] Clicking a caption word never toggles play/pause on the site.
- [ ] Smart pause follows every rule in §5.
- [ ] Keyboard shortcuts work only while a card is open and don't trigger site shortcuts.
- [ ] Popup light and dark themes both look correct.
- [ ] CSV opens correctly in Excel and Google Sheets (non-ASCII characters intact).
- [ ] Reduced-motion setting removes animations.
