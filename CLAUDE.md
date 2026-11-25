# CLAUDE.md — handoff for the implementing model

You are implementing **Subtitle Vocab Explainer**, a Manifest V3 Chrome extension. All design decisions are already made; your job is to build exactly what the docs specify.

## Read first, in order

1. `docs/01-PRD.md` — scope (IN and OUT). Do not add anything from the OUT list.
2. `docs/03-ux-ui-spec.md` — look, copy, behaviour. Exact strings and tokens.
3. `docs/04-technical-design.md` — files, types, algorithms, prompts, tests.
4. `docs/05-implementation-tasks.md` — the milestone order and acceptance criteria. **Follow it.**
5. `docs/06-demo-and-deployment.md` — how it will be demoed. Skim; revisit at M8.
6. `docs/02-competitor-analysis.md` — background only.

## How to work

- Do **one milestone at a time** (M0 → M8). Finish, run the checks, commit, then continue.
- Before ticking a milestone run: `npm run typecheck && npm test && npm run build` — all must pass.
- Write the tests listed for the milestone in the same milestone.
- If the docs are ambiguous or something can't work as written, pick the **smallest** workable option and record it in `docs/CHANGELOG-decisions.md` (date, what, why). Don't silently change scope, copy or design tokens.

## Conventions

- TypeScript `strict`, `noUncheckedIndexedAccess`; **no `any`**, no `@ts-ignore`, no `TODO`/placeholder code.
- Named exports; small pure functions for anything testable (`computePlacement`, `findPhrasesInSentence`, `estimateLevel`, `mapAnthropicError`, `savedWordsToCsv`).
- Every background message handler returns `Result<T>` (see `src/shared/types.ts`); the `onMessage` listener must `return true`.
- Design tokens live in `src/shared/tokens.ts` and nowhere else.

## Hard rules (security and correctness)

- **Never** use `innerHTML` / `outerHTML` / `insertAdjacentHTML` with caption text, dictionary text or AI output. Use `textContent` and DOM APIs.
- The Anthropic key is read **only in the service worker**. Never send it to a content script, never log it, never store it in `chrome.storage.sync`.
- Never set `video.currentTime`. Only `video.pause()` / `video.play()`.
- Claude calls: `client.messages.parse` with `zodOutputFormat`, `effort: 'low'`, `dangerouslyAllowBrowser: true`. Do **not** pass `temperature`, `top_p`, `top_k`, `thinking`, prefill or `tool_choice` — these models reject them.
- No dependencies beyond those listed in `docs/04-technical-design.md` §1.
- No analytics, telemetry or remote code.

## Commands

```bash
npm install
npm run dev         # hot reload dev build
npm run typecheck
npm test            # vitest run
npm run build       # → dist/ (load unpacked in chrome://extensions)
npm run zip         # → release/vocab-explainer-<version>.zip
```

## Definition of done

See the end of `docs/05-implementation-tasks.md`.
