# 02 — Competitor Analysis

**Research date:** October 2026
**Caveat:** several comparison articles cited below are written by competing vendors (Trancy, Linglass, Sabi, TubeVocab, Sublo), so treat their claims with care. Chrome-stats figures come from search snippets and may be approximate.

---

## 1. Summary

**Language Reactor** is still the default tool, but it is unreliable and maintenance looks stalled, so there is room for a new entrant. The market has moved to AI-assisted glosses on freemium plans. The same weak spots show up across products:

1. Lookup popups are thin, or overloaded with dictionary dumps.
2. Sidebars take over and reflow the page.
3. Vocabulary is capped or locked behind a paywall.
4. Tools break when Netflix updates, and fail silently ("Loading…" forever).
5. Fullscreen and player controls get in the way (misclicks).

The closest functional competitor for English learners is **eJOY AI Dictionary**.

## 2. Competitor matrix

| Product | Users / rating | Pricing | Lookup UX | AI | Top complaints |
|---|---|---|---|---|---|
| **Language Reactor** (formerly Language Learning with Netflix) | ~2M users, 4.17★ (~4.4k reviews) | Free; Pro ~$5/mo | Dual subtitles in a bar at the bottom; clickable transcript **sidebar**; click a word for a popup with translation, dictionary and save | Pro adds AI translations | Stuck on "Loading…", NETWORK_ERROR, breaks on Netflix updates (June 2026 thread), YouTube sidebar rearranges the page with "no lightweight mode", shallow popup (no IPA/synonyms/examples), seen as "pretty much dead" |
| **Trancy** | ~300k downloads, 4.7★ lifetime, ~3.8★ last 100 reviews | Account required; free saves capped < 100; $3.49–9.90/mo | AI dual subtitles; learning sidebar (transcript, dictionary, word book); saved words highlighted when they recur | GPT-based; grammar parser; speaking coach | Forced logouts, HTTP 429, blank Netflix translations, overlay lag on old machines, "wall of text" segmentation, button next to fullscreen causes misclicks, **single words only (no phrases)**, injects markup into unrelated pages |
| **eJOY AI Dictionary** | ~700k users, 4.76★ (~5k reviews) | Freemium; Premium ~$4.99/mo | Hover gives a quick meaning; click gives the full entry with synonyms/examples; `[<]` `[>]` move between words | AI phrase/idiom detection, grammar notes | Bugs on some sites, broken pronunciation audio, weak sync — **closest competitor** |
| **Migaku** | — (reviews ~3/5) | $9–14/mo or $399 lifetime; no free tier | Dictionary + sentence mining + SRS | — | Expensive, buggy, hours of setup across three apps; focused on Japanese/Korean/Chinese |
| **Lingopie extension** | New (Apr 2026) | Needs Lingopie subscription ($12/mo) | Netflix only; dual subtitles; click-to-translate | — | Spanish/French/Italian/German only — **no use for English learners**; no YouTube |
| **Others** (Linglass, Sublo, 2Subs, Funlingo, Sabi, Glot) | Small | Mostly freemium (€2.89–$4.99/mo) | Varied: IPA, TTS, FSRS flashcards | Some use Gemini/GPT | Vocabulary locked when you cancel; paywalls |

## 3. What users complain about most (cross-product)

1. **Reliability:** silent failures, endless loading, breaks after site updates.
2. **Intrusiveness:** sidebars reflow YouTube; overlays cover the speaker or the controls.
3. **Shallow or overloaded popups:** either too little (no IPA/examples) or a wall of dictionary senses.
4. **Paywalls and lock-in:** capped saves, vocabulary inaccessible after cancelling, forced accounts.
5. **Phrases ignored:** most tools are word-only; idioms and phrasal verbs are where learners actually struggle.
6. **Performance:** lag on older machines; markup injected on unrelated pages.
7. **Fullscreen and controls:** misclicks near the fullscreen button; popups invisible in fullscreen.

## 4. Our differentiators

Each differentiator maps to a concrete rule in [03-ux-ui-spec.md](03-ux-ui-spec.md) and a component in [04-technical-design.md](04-technical-design.md).

| # | Differentiator | Beats | UX rule (03) | Component (04) |
|---|---|---|---|---|
| D1 | **Stays out of the way.** No sidebar, no page reflow. The card sits above the caption line, never over player controls. | LR sidebar, Trancy overlay | §4 Placement rules; §3 no layout shift | `ShadowTooltip.computePlacement` |
| D2 | **The meaning in this scene, not a dictionary dump.** AI explains the sense used in this line, in plain English at the learner's level. | LR shallow popup; dictionary dumps | §3.3 card layout, "IN THIS SCENE" | `llmService` |
| D3 | **Idioms and phrasal verbs come first.** Auto-underlined; any phrase can be drag-selected. | Trancy (single words only) | §2 Caption interactions | `idiomMatcher`, drag-select in `content/index.ts` |
| D4 | **Smart pause that undoes itself.** Resumes only if we paused; configurable. | Blunt auto-pause after every line (LR) | §5 Smart pause | `smartPause.ts` |
| D5 | **Instant answers, no dead ends.** Dictionary result first, AI fills in, everything cached; every state has a message and a retry. | LR "Loading…" | §3.4 Card states | `cache.ts`, progressive render |
| D6 | **No account, no paywall, your data.** Unlimited saves, CSV export. | Trancy cap, Migaku price, Lingopie subscription | §7 Words tab | `storage.ts`, CSV export |
| D7 | **Fullscreen-safe and keyboard-first.** Esc, S, P, ←/→. | Fullscreen issues, Trancy misclicks | §4 re-parenting; §6 Keyboard | `ShadowTooltip` |
| D8 | **Light footprint, honest status.** Active only on watch pages, minimal permissions, a clear status when captions aren't detected. | Trancy/Glot injection and lag | §7 Home status line | `siteAdapters.ts`, `GET_STATE` |

## 5. Positioning statement

> For English learners who watch YouTube and Netflix, **Subtitle Vocab Explainer** explains any word or idiom *as it's used in the scene*, in one click, without sidebars, accounts or paywalls. Unlike Language Reactor and Trancy, it treats idioms as first-class, never rearranges the page, and keeps your vocabulary yours.

## 6. Sources

**Language Reactor**
- https://www.classcentral.com/report/review-language-reactor/
- https://www.tubevocab.com/blog/en/language-reactor-review
- https://tooltivity.com/extensions/language-reactor
- https://forum.languagelearningwithnetflix.com/t/language-reactor-alternative/36445/22
- https://forum.languagelearningwithnetflix.com/t/language-reactor-not-working/10598
- https://www.languagereactor.com/settings
- https://chrome-stats.com/d/hoombieeljmmljlkjmnheibnpciblicm

**Trancy**
- https://tooltivity.com/extensions/trancy
- https://www.trancy.org/blog/best-language-reactor-alternative-in-2026-31f9d225200580db8bb4f68a6f5370c5
- https://chrome-stats.com/d/trancyfordesktop

**Migaku**
- https://www.japademy.com/japanese-course-reviews/migaku
- https://community.wanikani.com/t/is-migaku-misleading-users/69129
- https://www.tofugu.com/japanese-learning-resources-database/migaku/

**Lingopie**
- https://linglass.app/blog/free-lingopie-alternative
- https://lingtuitive.com/blog/lingopie-review
- https://www.fluentu.com/blog/reviews/lingopie/

**eJOY / Glot**
- https://chromewebstore.google.com/detail/ejoy-ai-dictionary/amfojhdiedpdnlijjbhjnhokbnohfdfb
- https://ejoy-english.com/en/help/how-to-look-up-words-on-different-video-sites-with-ejoy
- https://chrome-stats.com/blog/best-of/netflix
- https://chrome-stats.com/d/dbnjpielondlkmdjbembloegkaabfakc

**Alternatives roundups**
- https://linglass.app/blog/best-language-reactor-alternatives
- https://subloapp.com/blog/language-reactor-alternative
- https://wordbyword.io/en/blog/language-reactor-alternatives
- https://www.joinsabi.com/blog/language-reactor-not-working
- https://alternativeto.net/software/language-learning-with-netflix
- https://medium.com/@hello_57962/language-reactor-is-dead-in-2026-heres-what-50-000-language-learners-are-switching-to-6b8f17fb8ce7
