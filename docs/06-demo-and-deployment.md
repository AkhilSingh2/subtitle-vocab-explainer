# 06 — Demo and Deployment

How to build the extension, load it in your own Chrome, run the demo, share it with testers, and (later, optionally) publish it to the Chrome Web Store.

---

## 1. Prerequisites

| Need | Details |
|---|---|
| Node.js | 20 or newer (`node -v`) |
| Chrome | 120 or newer, or any Chromium browser (Edge, Brave) |
| Netflix account | Needed for the Netflix part of the demo; use a title with **English subtitles** |
| Anthropic API key | Optional but recommended for AI Mode. Create one at https://console.anthropic.com → API keys |

## 2. Build

```bash
cd subtitle-vocab-explainer
npm install
npm run build
```

This produces the `dist/` folder, which **is** the extension.

## 3. Load it into Chrome

1. Open `chrome://extensions`.
2. Switch on **Developer mode** (top right).
3. Click **Load unpacked** and choose the `vocab-explainer/dist` folder.
4. Pin the extension: click the puzzle-piece icon in the toolbar, then the pin next to "Subtitle Vocab Explainer".
5. The onboarding page opens automatically on first install.

After rebuilding, click the **reload** icon on the extension card and refresh any open YouTube/Netflix tabs.

## 4. Set up AI Mode (optional)

1. Click the extension icon → **Settings** tab.
2. Paste your Anthropic API key → **Save** → **Test key**. You should see "✓ Key works".
3. Pick a model. For a snappy demo choose **Claude Haiku 5.5** (fastest, cheapest); choose **Claude Opus 5.5** (default) for the richest explanations.

Without a key the extension runs in **Free Mode** (dictionary + idiom list + estimated level), which is a good fallback if the network is flaky.

The key is stored only in this browser (`chrome.storage.local`) and is sent only to `api.anthropic.com`.

## 4b. Demo key (optional): skip typing a key

To let demo users use AI Mode without entering a key, bake a key into **your local build**:

```bash
cp .env.local.example .env.local
# edit .env.local and set:  VITE_EMBEDDED_API_KEY=<your key>
npm run build
```

Then reload the extension. Settings shows "This build includes a built-in demo key"; a key typed in Settings overrides it.

**This key is not secret.** Anyone who has the built extension can read it from the service worker's source
(`chrome://extensions` → Inspect views: service worker). Therefore:

- Use it only for a demo on your own machine; set a spend limit on the key and **revoke it afterwards**.
- `.env.local` is git-ignored. Never put the key in source files, docs, issues or chat.
- `npm run zip` **refuses** to package a build containing it. To make a shareable build, delete the key from
  `.env.local`, rebuild, then zip.
- The key is sent only to the host in `src/shared/apiConfig.ts`.

## 5. Development loop

```bash
npm run dev
```

crxjs serves the extension with hot reload; load the folder it prints (`dist/`) as unpacked. If a content-script change doesn't appear: click reload on the extension card and refresh the video tab. Service-worker logs: `chrome://extensions` → the extension card → **Inspect views: service worker**.

## 6. Demo script (≈ 5 minutes)

### Pre-demo checklist (do this 10 minutes before)

- [ ] Extension loaded and pinned; AI key saved and **tested** ✓; model chosen.
- [ ] Browser zoom at **100 %**; close other extensions that touch captions (Language Reactor, Trancy, etc.).
- [ ] Pick the demo videos in advance: a YouTube video with English captions and a Netflix title with English subtitles (the sample TED talk from the onboarding page works).
- [ ] **Warm the cache:** look up every word you plan to click, at the level you'll demo with, once, so the demo cards appear instantly. Note the exact words and idioms.
- [ ] Captions switched on in both players; stable Wi-Fi; Chrome notifications off.
- [ ] Popup level set to **B2**; Words tab emptied (or note the baseline).

### Script

| Step | Do | Say / show |
|---|---|---|
| 1 | Open the YouTube video, turn on CC | "Works on the site's own captions — no extra sidebar or page changes." |
| 2 | Hover over the captions | The video pauses by itself, words highlight, nothing shifts. "Smart pause — it only resumes if it paused." |
| 3 | Click a common but tricky word | Free-quality answer appears instantly: definition, IPA, level, example. |
| 4 | Click an underlined idiom | The whole phrase is explained; the **"In this scene"** section fills in. "Not every dictionary sense — what it means in *this* line." |
| 5 | Press the 🔊 button (or `P`) | Pronunciation plays. |
| 6 | Press `S` / click **Save word** | Button turns to "✓ Saved"; the word gets a green underline. |
| 7 | Drag across 3 words | Card opens for the selected phrase. |
| 8 | Go fullscreen, click another word | "Card works in fullscreen, above the caption, never over the controls." |
| 9 | Press `→` then `Esc` | Moves to the next word, then closes; the video resumes. |
| 10 | Switch to Netflix, play a title with subtitles, repeat steps 2–4 | "Same experience on Netflix." |
| 11 | Open the popup → **Words** tab | Show the saved list with the context lines; click **Export CSV**. |
| 12 | Popup → Home → change level **B2 → C1**, look up the same word again | The explanation wording changes with the level. |
| 13 | (Optional) Press `Alt+Shift+V` | Toast "Vocab Explainer off"; press again to turn on. |

### If something goes wrong during the demo

- AI card shows an error → click **Retry**; if it persists, say "Free Mode still works" and continue with dictionary-only results (remove the key in Settings to avoid repeated errors).
- Captions not highlighted → reload the video tab (`Cmd/Ctrl+R`) and turn captions off and on.
- Video didn't pause on Netflix → hover the caption again; if that fails, reload the tab.

## 7. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Popup says "Open a YouTube or Netflix video" on a video page | The content script isn't running. Reload the extension and refresh the tab. Confirm the URL is a watch page (`/watch`). |
| Popup says "Turn on captions/subtitles to start" | Captions are off in the player. Turn them on (English). |
| Popup says "Captions not detected — the site may have changed" | The site's caption DOM changed. In DevTools, inspect a caption line, find its container classes, then update the selector arrays in `src/content/siteAdapters.ts` (add the new selector first, keep the old ones as fallbacks), rebuild and reload. |
| Clicking a word toggles play/pause | Another extension or a site update is handling the click first. Disable other caption extensions; if it persists, check that the capture-phase listener in `content/index.ts` is registered on `document`. |
| Card invisible in fullscreen | The shadow host wasn't re-parented. Check the `fullscreenchange` handler in `ShadowTooltip.ts`. |
| "Your API key was rejected" | Wrong or revoked key; re-enter it in Settings and press **Test key**. |
| "Too many requests" | Rate limit; wait a moment, or choose a different model in Settings. |
| AI works in Test but not on the page | Open the service-worker console (Inspect views: service worker) and read the logged error code. |
| Nothing at all after an update | `chrome://extensions` → reload the extension, then hard-refresh the video tab. |
| Netflix: no pause/resume | Netflix can reject programmatic playback right after a navigation; reload the title. The extension only calls `video.pause()`/`play()` — never seeks. |

## 8. Share with a tester (no Web Store needed)

```bash
npm run zip
```

This creates `release/vocab-explainer-<version>.zip`. Send the zip. The tester:

1. Unzips it to a permanent folder.
2. Opens `chrome://extensions`, enables **Developer mode**, clicks **Load unpacked**, selects the unzipped folder.
3. Enters their own Anthropic key in Settings (optional).

Remind them that Developer-mode extensions show a "Disable developer mode extensions" prompt on some Chrome setups and may be disabled after a restart on managed devices.

## 9. CI and Chrome Web Store (later, optional — not needed for the demo)

### 9.1 What the pipeline does

`.github/workflows/ci.yml`:

- **`ci` job** — runs on every push and pull request: checkout → Node 20 → `npm ci` → `npm run typecheck` → `npm test` → `npm run build` → zip `dist/` → upload the zip as a build artifact.
- **`publish` job** — runs only on tags matching `v*` (e.g. `v0.1.0`), after `ci` succeeds: downloads the zip artifact and uploads/publishes it with `mnao305/chrome-extension-upload@v5` using these **GitHub repository secrets**: `EXTENSION_ID`, `CLIENT_ID`, `CLIENT_SECRET`, `REFRESH_TOKEN`.

Reference workflow:

```yaml
name: CI
on:
  push:
    branches: [main]
    tags: ['v*']
  pull_request:

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
      - name: Package extension
        run: |
          mkdir -p release
          VERSION=$(node -p "require('./package.json').version")
          (cd dist && zip -r ../release/vocab-explainer-$VERSION.zip .)
      - uses: actions/upload-artifact@v4
        with:
          name: extension-zip
          path: release/*.zip

  publish:
    needs: ci
    if: startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: extension-zip
          path: release
      - name: Locate zip
        id: zip
        run: echo "path=$(ls release/*.zip | head -n 1)" >> "$GITHUB_OUTPUT"
      - name: Upload to Chrome Web Store
        uses: mnao305/chrome-extension-upload@v5.0.0
        with:
          file-path: ${{ steps.zip.outputs.path }}
          extension-id: ${{ secrets.EXTENSION_ID }}
          client-id: ${{ secrets.CLIENT_ID }}
          client-secret: ${{ secrets.CLIENT_SECRET }}
          refresh-token: ${{ secrets.REFRESH_TOKEN }}
          publish: true
```

> Keep the `version` in `package.json` in sync with the tag (the Web Store rejects an upload whose manifest version isn't higher than the published one).

### 9.2 One-time Chrome Web Store setup

1. **Developer account:** register at https://chrome.google.com/webstore/devconsole (one-time $5 fee).
2. **First upload is manual:** zip `dist/` (`npm run zip`), create a new item in the developer dashboard, upload the zip, fill in the listing. Copy the **extension ID** from the item URL → `EXTENSION_ID` secret.
3. **Store listing assets:**
   - Icon 128×128 (already in the build).
   - At least one screenshot, 1280×800 (or 640×400): capture the card over a YouTube caption.
   - Short description (≤ 132 chars) and detailed description.
   - Category: Education.
4. **Privacy tab:**
   - Single-purpose statement: "Show the meaning of words and idioms in video captions."
   - Justify permissions: `storage` (settings, saved words, cache), `activeTab` (popup status), host permissions for `api.dictionaryapi.dev` (definitions) and `api.anthropic.com` (optional AI explanations), content scripts on YouTube and Netflix (caption interaction).
   - Data disclosure: the user's optional API key is stored locally; looked-up words and surrounding caption text are sent to dictionaryapi.dev and, if the user enables AI Mode, to Anthropic. No data is sold or sent to the developer.
   - Provide a **privacy policy URL** (a simple hosted page stating the above).
5. **API credentials for CI** (Google Cloud Console):
   1. Create a project, enable the **Chrome Web Store API**.
   2. OAuth consent screen: External, add yourself as a test user.
   3. Create an **OAuth client ID** of type *Desktop app* → note `CLIENT_ID` and `CLIENT_SECRET`.
   4. Get a **refresh token**: complete the OAuth flow once with scope `https://www.googleapis.com/auth/chromewebstore` (the `chrome-webstore-upload-keys` helper automates this: `npx chrome-webstore-upload-keys`), and store the resulting `REFRESH_TOKEN`.
6. **GitHub secrets:** repository → Settings → Secrets and variables → Actions → add `EXTENSION_ID`, `CLIENT_ID`, `CLIENT_SECRET`, `REFRESH_TOKEN`.
7. **Release:** bump `version` in `package.json`, commit, then `git tag v0.1.1 && git push --tags`. The pipeline uploads and submits for review. Review typically takes from hours to several days. For an invite-only rollout, set the item's visibility to **Unlisted** in the dashboard.

> Chrome Web Store publishing is **out of scope for v1** and is not needed for the demo; this section exists so the pipeline is ready when you want it.

## 10. Quick reference

| Task | Command |
|---|---|
| Install | `npm install` |
| Dev (hot reload) | `npm run dev` |
| Type-check | `npm run typecheck` |
| Tests | `npm test` |
| Production build | `npm run build` |
| Zip for sharing | `npm run zip` |
| Load in Chrome | `chrome://extensions` → Developer mode → Load unpacked → `dist/` |
