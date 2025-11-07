# How This Was Made – Change Log

This document explains meaningful code edits: what changed, why, and where.

## Authoring rules (be exhaustive)
- Log every change, no matter how small. UI text tweaks, prop renames, CSS, config flips, routes, and content edits all count.
- For each entry include:
  - Files: exact relative paths (group when truly identical)
  - Summary: 1–2 lines of what changed
  - Rationale: why the change was needed (bug, UX, maintenance, performance, security, clarity, consistency)
  - Code refs: when non-trivial, add one or more code reference fences that show the changed function/lines
    - Use the strict fence: ```startLine:endLine:path/to/file\n<snippet>\n``` (no language tag)
    - Prefer citing function/method names in prose too
  - Database: call out schema/table/column/index changes and migration filenames
  - Dependencies: list added/removed/updated packages with versions
  - Commands: note key commands executed (build/migrate/generate) if relevant
- Use the current date in UTC or local (consistent per file).
- If a previous entry is superseded, add a new entry rather than deleting the old one.
- Prefer many small entries over one large umbrella entry.
- Backend/API changes should mention the endpoint and behavior (status, shape).
- SW/caching changes should call out caching strategy and affected paths.
- Don’t batch unrelated edits in the same bullet; make separate “Edit” sections.

### Edit: 2025-11-06
- Files: `public/src/CurriculumPage.js`
- Summary: Moved the `detectWordType` hook above `autoSelectBlanks`.
- Rationale: `autoSelectBlanks` referenced `detectWordType` in its dependency array before initialization, causing "Cannot access 'detectWordType' before initialization" at runtime.

### Edit: 2025-11-06
- Files: `public/sw.js`, `public/src/index.js`
- Summary: Adjusted service worker behavior in development and gated registration to secure contexts.
- Rationale: Continuous refresh was caused by the service worker intercepting dev HMR/SSE connections. The SW now bypasses typical HMR endpoints and registration only occurs on HTTPS or localhost to avoid interference when served over plain HTTP.

### Edit: 2025-11-06
- Files: `public/src/LearningModesPage.js`
- Summary: Added Media Session-friendly pause/resume without restarting playback; hardware buttons now control playback.
- Rationale: Hardware pause previously stopped the loop causing restarts. Introduced `pausedRef` and `waitWhilePaused()` gate, updated Media Session callbacks to pause without tearing down loops, and respected pause across learning and quiz flows.

### Edit: 2025-11-06
- Files: `public/src/index.js`
- Summary: Added service worker update detection with user prompt to reload when a new version is installed.
- Rationale: Improves PWA UX by detecting new SW versions (`registration.onupdatefound` + `state==='installed'`) and offering an immediate reload to apply updates.

### Edit: 2025-11-06
- Files: `public/src/index.js`
- Summary: Throttled SW-driven reloads and disabled auto-prompt in development to stop refresh loops.
- Rationale: In dev, SW updates can happen frequently; gating prompts to production and throttling reloads prevents rapid reload cycles.

### Edit: 2025-11-06
- Files: `public/src/index.js`, `public/sw.js`
- Summary: Disabled SW in HMR/dev and added `?nosw=1` override; switched navigation handling to network-first with offline fallback.
- Rationale: Continuous refresh was likely caused by SW + dev client interaction. Unregistering during HMR and safer navigation handling stops reload loops while keeping offline support.

### Edit: 2025-11-06
- Files: `public/src/index.js`
- Summary: Turned SW off by default; only enable with `?sw=1`. On startup, unregisters any existing SW, clears caches, and reloads once if a controller was active.
- Rationale: Provide a hard kill-switch to conclusively stop refresh loops across devices while testing. Developers can explicitly re-enable when stable.

### Edit: 2025-11-06
- Files: `webpack.config.js`
- Summary: Ignored `public/tts-cache/**` and `public/static/**` from static watching, limited `watchFiles` to `src/**/*` and key public files, and disabled dev client reconnect.
- Rationale: Audio generation writes MP3s into `public/tts-cache`, which triggered continuous HMR reloads. Ignoring these paths and reducing watch scope stops the rapid refresh.

### Edit: 2025-11-06
- Files: `public/src/App.js`, `public/src/Navbar.js`, `public/src/LearningModesPage.js`
- Summary: Added direct link to Journal Entries and renamed route from `/journal-archive` to `/journal-entries`; removed separate Audio page and retitled Quiz Mode to Audio Learning Mode.
- Rationale: Navigation simplification: surface Journal Entries directly, standardize naming, and consolidate audio functionality under one page.

### Edit: 2025-11-06
- Files: `public/src/JournalArchivePage.js`, `public/src/JournalPage.js`
- Summary: Added “Speak” button to each journal entry (plays Korean then English). After saving a journal entry, split text into sentences and add each (KO/EN pair) to Curriculum automatically.
- Rationale: Faster review: listen to entries directly and build practice material automatically from journal content.

### Edit: 2025-11-06
- Files: `public/src/ChatPage.js`, `public/src/TranslationPage.js`, `public/src/App.js`
- Summary: Moved chat/explanations to a dedicated `ChatPage` and linked from Translation; added `/chat` route; Translation shows “Open Chat” button passing context via query.
- Rationale: Avoids crowding the translator UI and makes chat reusable and focused.

### Edit: 2025-11-06
- Files: `public/src/LearningModesPage.js`
- Summary: Removed History UI and its localStorage persistence on the audio learning screen.
- Rationale: Simplify UI and avoid storing potentially confusing session history.

### Edit: 2025-11-06
- Files: `backend/tts.js`
- Summary: Fixed batch TTS delay handling to allow 0 seconds; changed pause chunk calculation to floor seconds and allow zero chunks.
- Rationale: Users can now choose no delay between items in loop mode; previous code forced at least one second.

### Edit: 2025-11-06
- Files: `public/src/AudioLearningPage.js`
- Summary: Ensured Stop cancels SpeechSynthesis and HTML5 Audio via `cleanupAudioCache`; added KO→EN delay slider for per‑pair playback.
- Rationale: “Stop” must reliably halt audio; users requested adjustable delay before English playback.

### Edit: 2025-11-06
- Files: `public/src/LearningModesPage.js`
- Summary: Added saved word sets with generate/save/play; display the playing list (up to 20). Added optional conjugation hints for dictionary‑form verbs. Added Pause/Resume buttons for loop control.
- Rationale: Enable creating and managing practice sets, quickly reviewing items, and pausing loops without teardown.

### Edit: 2025-11-06
- Files: `public/src/audioLoop.js`, `public/src/LearningModesPage.js`
- Summary: Implemented `pauseLoop`/`resumeLoop` and wired buttons; left `stopLoop` intact.
- Rationale: Hardware and UI pause should not destroy loop state.

### Edit: 2025-11-06
- Files: `public/src/StatsPage.js`
- Summary: Confirmed and documented sort by date added; default remains date with tie‑breakers.
- Rationale: Backlog item asked for date ordering; this is the current behavior.

### Edit: 2025-11-06
- Files: `public/src/LexiconAddPage.js`, `public/src/App.js`, `public/src/Navbar.js`
- Summary: Added `/lexicon-add` page to paste English phrases and translate/add them; linked it in the Navbar overflow menu.
- Rationale: Batch ingestion of phrases into the lexicon without manual repetition.

### Edit: 2025-11-06
- Files: `public/src/CurriculumPracticePage.js`
- Summary: Added Levels 1/2/3 to control number of blanks; derives blank indices when missing; UI selector added above practice.
- Rationale: Adjustable difficulty based on blanks requested in backlog.

### Edit: 2025-11-06
- Files: `public/src/JournalArchivePage.js`
- Summary: Added “Stop” button next to Speak for each entry; cancels TTS and halts HTML5 Audio via `cleanupAudioCache()`.
- Rationale: Provide immediate user control during playback.

### Edit: 2025-11-06
- Files: `public/sw.js`
- Summary: Bumped version and cached `/tts-cache/**` via cache‑first strategy to allow replaying generated audio offline.
- Rationale: Improve offline UX for previously generated audio loops.

### Edit: 2025-11-06
- Files: `public/src/Navbar.js`
- Summary: Added a yellow offline banner (browser offline) and a red server‑disconnect banner.
- Rationale: Clear, persistent feedback about connectivity states.

### Edit: 2025-11-06
- Files: `backend/server.js`, `public/src/api.js`, `public/src/Navbar.js`
- Summary: Added lightweight heartbeat `GET /api/health`; client pings every 15s with 3s timeout; shows “Retry now” button on consecutive failures.
- Rationale: Distinguish offline vs backend down and provide quick retry.

### Edit: 2025-11-06
- Files: `public/src/JournalPage.js`, `public/src/JournalArchivePage.js`
- Summary: Stopped auto‑adding journal entries to curriculum. Added buttons to split sentences and add (with progress) on both the Journal page (last saved entry) and per entry in Journal Entries.
- Rationale: Give users control over what gets added to practice; explicit opt‑in workflow.

### Edit: 2025-11-07
- Files: `backend/database.js`
- Summary: Sorted `getLearningWords` by `created_at` ascending and exposed `created_at` in the union result.
- Rationale: Enables deterministic 20‑word sets by date for audio loop sets.

### Edit: 2025-11-07
- Files: `public/src/LearningModesPage.js`
- Summary: Added set selection for hands‑free Level 1 (20 words per set) with optional random set. Hands‑free Level 2/3 now generate sentences (no recording) instead of single words.
- Rationale: Requested multiple sets by date order and correct level behavior for sentence generation.

### Edit: 2025-11-07
- Files: `public/src/Navbar.js`
- Summary: Added a primary "Chat" link in the navbar and in the overflow dropdown.
- Rationale: Quick access to the dedicated chat/explanations page from all screens.

### Edit: 2025-11-07
- Files: `public/src/LearningModesPage.js`
- Summary: Fixed set selection not taking effect by adding `setIndex` and `randomizeSet` to the `handleStartQuizLoop` dependencies; previously the closure captured the initial Set=1.
- Rationale: Changing the Set field to 2+ did not alter the chosen 20‑word slice because the callback used stale state.

### Edit: 2025-11-07
- Files: `public/src/LearningModesPage.js`
- Summary: Level 2 now draws sentences from curriculum. Playback order: English sentence → word‑by‑word explanation (via Chat, JSON to pairs) → Korean sentence. Level 3 remains AI‑generated longer sentences.
- Rationale: Align Level 2 with curriculum practice and provide explicit per‑word explanations for better learning.

### Edit: 2025-11-07
- Files: `public/src/LearningModesPage.js`
- Summary: Changed Level 2 word-by-word explanation to alternate speech per token (KO then EN for each pair) instead of a single English narration.
- Rationale: Matches user request to switch between Korean and English for corresponding words, improving reinforcement.

### Edit: 2025-11-07
- Files: `public/src/LearningModesPage.js`
- Summary: Reordered Level 2 token explanation to speak English first, then the corresponding Korean token, for each pair.
- Rationale: User preference to hear the English gloss before the Korean word during word-by-word explanation.

### Edit: 2025-11-07
- Files: `public/src/audioTTS.js`
- Summary: Applied master speed slider to all TTS playback by setting HTML5 Audio `playbackRate` from `window.__APP_SPEECH_SPEED__` on init, onplay, and right after play starts.
- Rationale: Backend Google TTS doesn’t support rate; enforcing playbackRate client-side ensures Level 2 sentences and explanations respond to the master speed.

### Edit: 2025-11-07
- Files: `public/src/PhrasePractice.js`
- Summary: Added “Remix: New Sentence (no tracking)” button that generates a new sentence (same POS pattern, new words/grammar) via Chat JSON; enabled session “no‑track” mode to skip progress updates for remixed/variation sentences.
- Rationale: Allow creating fresh practice sentences on the fly without advancing curriculum/progress counts; honors request to preserve order of word types while changing content.

### Edit: 2025-11-07
- Files: `public/src/CurriculumPracticePage.js`
- Summary: Added Remix button with no‑track session mode; implemented Chat‑driven remix that preserves POS order while replacing content; guarded stats updates to skip when no‑track or remix/variation.
- Rationale: Expose remix capability on the curriculum practice page and prevent the total X/Y progress from changing when user is in new‑sentence mode.

### Edit: 2025-11-07
- Files: `public/src/CurriculumPracticePage.js`
- Summary: Added “Add to Curriculum” button to save the current (including remixed) sentence into the curriculum via API.
- Rationale: Allow manual promotion of a remixed sentence into the tracked curriculum without auto‑advancing progress until the user chooses to.

### Edit: 2025-11-07
- Files: `public/src/CurriculumPracticePage.js`
- Summary: Stopped fetching a new random phrase after each answer; now preloads all curriculum phrases and advances locally to the next unused phrase. When none remain, switches to variations/new‑sentence mode without altering progress totals.
- Rationale: Reduce network churn and honor request to download all phrases first, then start the game.

### Edit: 2025-11-07
- Files: `public/src/CurriculumPracticePage.js`
- Summary: Added a fixed 5‑phrase session subset (randomly sampled once). The practice loops over these 5 repeatedly, varying blanks each round, and no longer falls into AI mode automatically when the set is completed.
- Rationale: Requested “5 at a time” gameplay that repeats the same set instead of generating new sentences automatically.

### Edit: 2025-11-07
- Files: `public/src/ChatPage.js`
- Summary: Enabled Enter-to-send from the chat input; Tab then Space activates the Send button as usual.
- Rationale: Keyboard accessibility on the chat page as requested for the translate/chat flow.

### Edit: 2025-11-07
- Files: `public/src/ChatPage.js`
- Summary: Allowed sending messages without prior translation context; when no context exists, prompts use only the user’s question.
- Rationale: Prevent silent no-op when opening Chat directly; make Send always work.

### Edit: 2025-11-07
- Files: `public/manifest.json`
- Summary: Added Android PWA app shortcuts for key pages (Translate, Chat, Practice, Audio Learning, Curriculum, Journal, Journal Entries, Stats, Pronunciation). Fixed Audio Learning shortcut route to `/quiz-mode`.
- Rationale: Provide home-screen long‑press shortcuts on Android for fast navigation to common destinations.

### Edit: 2025-11-07
- Files: `public/src/TranslationBox.js`
- Summary: Implemented offline translation fallback using a local cache. On successful online translations, store sentence and token pairs in `localStorage.offline_translations_v1`. When offline or API fails, return the cached sentence or a token-mapped reconstruction.
- Rationale: Allow translations without Wi‑Fi by using previously cached results; aligns with request to use an offline translator.
- Code refs:
```14:37:public/src/TranslationBox.js
  const loadCache = () => { /* localStorage offline_translations_v1 */ };
  const saveCache = (cache) => { /* persist */ };
  const cacheTokensFromPair = (en, ko) => { /* cache sentence + token pairs */ };
  const offlineTranslate = (text) => { /* sentence lookup or token mapping */ };
```
```19:41:public/src/TranslationBox.js
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          const offline = offlineTranslate(freeInputValue);
          ...
        }
        const controller = new AbortController();
        ... // on success cacheTokensFromPair
        ... // on failure fallback to offlineTranslate
```


