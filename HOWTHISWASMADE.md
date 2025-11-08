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
- Files: `public/src/App.js`, `public/src/AudioLearningPage.js`
- Summary: Renamed route component to `AudioLearningPage` and wired `/quiz-mode` to it. `AudioLearningPage` currently re-exports the existing implementation to avoid regressions while keeping the new name.
- Rationale: Align component naming with navbar and user language.

### Edit: 2025-11-07
- Files: `public/src/audioTTS.js`, `public/src/audioLoop.js`
- Summary: Removed hidden-page auto-resume logic that attempted to restart audio when the app was minimized (visibilitychange listener and periodic resume checks).
- Rationale: Android hardware/media buttons can manage playback now; auto-resume caused unwanted restarts when minimized.

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

### Edit: 2025-11-07
- Files: `public/src/Navbar.js`, `public/src/Navbar.css`, `public/src/App.css`, `public/src/index.js`
- Summary: Added a dark mode toggle (default is dark). Theme is persisted in `localStorage` and applied early on startup to prevent flash.
- Rationale: Requested global dark theme with a simple UI toggle and dark-by-default behavior.
- Code refs:
```20:38:public/src/index.js
// Apply persisted theme early to avoid flash; default to dark
try {
  const savedTheme = localStorage.getItem('app_theme') || 'dark';
  if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
} catch (_) {}
```
```13:31:public/src/Navbar.js
  const [theme, setTheme] = React.useState(() => {
    try {
      const saved = localStorage.getItem('app_theme');
      return saved || 'dark';
    } catch (_) {
      return 'dark';
    }
  });
```
```80:93:public/src/Navbar.js
  React.useEffect(() => {
    try { localStorage.setItem('app_speech_speed', String(speechSpeed)); } catch (_) {}
    window.__APP_SPEECH_SPEED__ = speechSpeed;
  }, [speechSpeed]);

  // Apply theme (default dark)
  React.useEffect(() => {
    try { localStorage.setItem('app_theme', theme); } catch (_) {}
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);
```
```142:160:public/src/Navbar.js
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
          <button type="button" className="mute-button" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? '🌙 Dark' : '☀️ Light'}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', border: '1px solid #ddd', borderRadius: '5px', background: 'white' }}>
            <span style={{ fontSize: '0.75rem', color: '#666', whiteSpace: 'nowrap' }}>Speed:</span>
```
```1:22:public/src/App.css
/* Dark mode (default). We use an invert trick for broad coverage across inline styles. */
html.dark {
  background-color: #0b0b0b;
  color-scheme: dark;
  /* Invert most colors to simulate dark theme for inline-styled components */
  filter: invert(1) hue-rotate(180deg);
}

/* Cancel inversion for media and explicit opt-outs */
html.dark img,
html.dark video,
html.dark canvas,
html.dark iframe,
html.dark .no-invert {
  filter: invert(1) hue-rotate(180deg) !important;
}
```
```100:140:public/src/Navbar.css
/* Dark theme explicit color fixes for navbar surfaces (works alongside global invert) */
html.dark .navbar { background-color: #0f0f10; border-bottom-color: #1f1f22; }
html.dark .nav-link { color: #ddd; }
html.dark .nav-link:hover { background-color: #1a1a1d; }
html.dark .dropdown-menu { background-color: #0f0f10; border-color: #2a2a2e; box-shadow: 0 4px 14px rgba(0,0,0,0.6); }
html.dark .dropdown-item { color: #ddd; }
html.dark .dropdown-item:hover { background-color: #1a1a1d; }
html.dark .bottom-bar { background-color: #0f0f10; border-top-color: #1f1f22; }
html.dark .bottom-bar-text { color: #bbb; }
html.dark .mute-button { background-color: #111214; color: #e5e7eb; border-color: #2a2a2e; }
html.dark .mute-button:hover { background-color: #1a1a1d; border-color: #3a3a40; }
```
### Edit: 2025-11-07
- Files: `public/src/LearningModesPage.js`
- Summary: Added random pronouns and simple tense conjugations (present/past/future) for verbs during audio practice. Applied in Hands‑free Level 1 (20‑word sets) and Recording Level 1 (single‑word prompts).
- Rationale: User request to practice verbs with natural subject + tense variation; no honorifics required.
- Code refs:
```79:120:public/src/LearningModesPage.js
  // --- Verb conjugation + pronoun helpers (very simple heuristic) ---
  const PRONOUNS = React.useMemo(() => [
    { ko: '나는', en: 'I' },
    { ko: '너는', en: 'you' },
    { ko: '우리는', en: 'we' },
    { ko: '그는', en: 'he' },
    { ko: '그녀는', en: 'she' },
    { ko: '그들은', en: 'they' },
  ], []);
  const pickRandomPronoun = React.useCallback(() => PRONOUNS[Math.floor(Math.random() * PRONOUNS.length)], [PRONOUNS]);
  const conjugateVerbSimple = React.useCallback((baseForm, tense) => { /* 하다, 아/어, 았/었, (으)ㄹ 거예요 */ }, []);
  const applyPronounAndTenseIfVerb = React.useCallback((wordObj) => { /* prefix pronoun, conjugate */ }, [pickRandomPronoun, conjugateVerbSimple]);
```
```748:760:public/src/LearningModesPage.js
          const selectedWords = words.slice(start, Math.min(start + 20, words.length));
          const transformed = selectedWords.map(applyPronounAndTenseIfVerb);
          setCurrentSetWords(transformed);
          ...
          await generateAndPlayLoop(transformed, 'ko-KR', 1.0, quizDelaySec);
```
```824:831:public/src/LearningModesPage.js
          if (quizDifficulty === 1) {
            const w = words[Math.floor(Math.random() * words.length)];
            setCurrentQuizWord(w);
            setCurrentQuizSentence(null);
            english = String(w.english || '');
            const w2 = applyPronounAndTenseIfVerb(w);
            korean = String(w2.korean || '');
          }
```
```916:916:public/src/LearningModesPage.js
  }, [ensureLearningWords, ..., setIndex, randomizeSet, applyPronounAndTenseIfVerb]);
```

### Edit: 2025-11-07
- Files: `public/src/App.css`
- Summary: Ensured dark mode applies to the entire page by setting full-height on `html`, `body`, `#root` and explicitly dark backgrounds for `body` and `#root` under `html.dark`.
- Rationale: Prevent any white gaps around content and guarantee the dark backdrop spans the full viewport.
- Code refs:
```1:30:public/src/App.css
html,
body,
#root {
  min-height: 100%;
}
html.dark body { background: #0b0b0b; }
html.dark #root { background: #0b0b0b; }
```

### Edit: 2025-11-07
- Files: `public/src/App.css`
- Summary: Fixed dark mode readability for explanation panels and text inputs by canceling global invert on key elements and applying explicit dark UI colors to inputs, textareas, selects, buttons, and content cards.
- Rationale: Inputs/explanations appeared black-on-black under inversion; explicit overrides ensure sufficient contrast.
- Code refs:
```60:110:public/src/App.css
/* Form controls and key content boxes: cancel parent invert, then apply dark styles */
html.dark input,
html.dark textarea,
html.dark select,
html.dark button,
html.dark .sentence-box,
html.dark .audio-card,
html.dark .translation-card,
html.dark pre,
html.dark code,
html.dark details {
  filter: invert(1) hue-rotate(180deg) !important; /* cancel global invert */
}
html.dark input,
html.dark textarea,
html.dark select { background: #111214 !important; color: #e5e7eb !important; border: 1px solid #2a2a2e !important; }
html.dark input::placeholder,
html.dark textarea::placeholder { color: #9ca3af !important; }
html.dark .sentence-box,
html.dark .audio-card,
html.dark .translation-card,
html.dark details,
html.dark pre,
html.dark code { background: #0f0f10 !important; color: #e5e7eb !important; border-color: #2a2a2e !important; }
```

### Edit: 2025-11-07
- Files: `public/src/App.css`
- Summary: Switched to a pure global invert dark mode. Removed body/root explicit dark backgrounds and form-control overrides; kept a global `invert(1) hue-rotate(180deg)` on `html.dark` and a `.no-invert` utility. Media (img/video/canvas/iframe) remain re-inverted to keep natural colors.
- Rationale: Ensure dark mode applies uniformly to all elements with minimal per-element styling; simpler and more consistent.
- Code refs:
```16:46:public/src/App.css
html.dark {
  color-scheme: dark;
  /* Invert most colors to simulate dark theme for inline-styled components */
  filter: invert(1) hue-rotate(180deg);
}
/* Cancel inversion for media and explicit opt-outs */
html.dark img,
html.dark video,
html.dark canvas,
html.dark iframe,
html.dark .no-invert {
  filter: invert(1) hue-rotate(180deg) !important;
}
/* Body/root backgrounds are left default; invert will turn light to dark */
/* Utility: mark any element to keep original colors under dark mode */
html.dark .no-invert { filter: invert(1) hue-rotate(180deg) !important; }
```

### Edit: 2025-11-07
- Files: `public/src/Navbar.css`, `public/src/App.css`, `public/src/CurriculumPage.js`
- Summary: Made navbar rely on global invert by removing dark-mode overrides; added `.ko-text` style and applied it to Korean sentence display on Curriculum page for distinct coloring.
- Rationale: Ensure navbar fully follows global dark invert; visually distinguish Korean text in curriculum for readability.
- Code refs:
```119:156:public/src/Navbar.css
/* Dark mode uses global invert; no per-component overrides needed here. */
```
```90:98:public/src/App.css
/* Highlight Korean text distinctly */
.ko-text {
  color: #2dd4bf; /* teal; inverted in dark mode but remains distinct */
}
```
```633:639:public/src/CurriculumPage.js
<div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
  <span className="ko-text">
    {getBlankedSentence(phrase.korean_text, phrase.blank_word_indices || (phrase.blank_word_index !== null && phrase.blank_word_index !== undefined ? [phrase.blank_word_index] : []))}
  </span>
</div>
```

### Edit: 2025-11-07
- Files: `public/src/App.css`
- Summary: Prevent black text in dark mode by overriding common white-text button classes to pre-inverted dark `#111` under `html.dark`, resulting in light text after the global invert.
- Rationale: Several components used `color: white`, which becomes black when globally inverted, harming readability.
- Code refs:
```96:104:public/src/App.css
/* Ensure no black text result after invert: override classes that set white text */
html.dark .start-button,
html.dark .generate-button,
html.dark .regenerate-button,
html.dark .translate-button,
html.dark .clear-button {
  /* Pre-inverted dark so output appears light under global invert */
  color: #111 !important;
}
```

### Edit: 2025-11-07
- Files: `public/src/App.css`
- Summary: Enforced a global dark-mode text color to eliminate remaining black text across all pages. Restored a link tint for readability.
- Rationale: Some pages still displayed black text due to component-specific colors; a global override ensures consistent light text under invert.
- Code refs:
```104:114:public/src/App.css
/* Global text safety: force all text to pre-inverted dark so it renders light after invert */
html.dark,
html.dark body,
html.dark body * {
  color: #111 !important;
}
/* Restore link tint for readability under global override */
html.dark a { color: #035efc !important; }
```

### Edit: 2025-11-07
- Files: `public/src/LearningModesPage.js`
- Summary: Level 2 generation now builds sentences from learning words by combining a noun/pronoun with a conjugated verb (present/past/future). Removed Level 2 word-by-word explanation; playback is English then Korean.
- Rationale: Align Level 2 with the requirement to use words tagged "learning" in the DB and generate simple subject+verb sentences; previous behavior pulled from curriculum.
- Code refs:
```458:476:public/src/LearningModesPage.js
const generateQuizSentence = React.useCallback(async (difficulty) => {
  if (difficulty === 1) return null; // single word handled separately
  if (difficulty === 2) {
    // Level 2: build subject (noun or pronoun) + conjugated verb from learning words
    const words = await ensureLearningWords();
    if (!words || words.length === 0) return null;
    const pair = buildSubjectAndVerbPair(words);
    return pair;
  }
  // Level 3: keep AI-generated longer sentence...
```
```876:907:public/src/LearningModesPage.js
// Level 2 no longer performs word-by-word explanation; speak English then Korean only
```

### Edit: 2025-11-07
- Files: `public/src/CurriculumPracticePage.js`
- Summary: Added a "Speak x3 (KO)" button that reconstructs the full Korean sentence (filling blanks) and speaks it three times using SpeechSynthesis; cancels any in-progress speech before starting.
- Rationale: Requested quick audio repetition of the current sentence including blanked words for listening practice.
- Code refs:
```186:220:public/src/CurriculumPracticePage.js
const speakText = useCallback((text, onEnd, repeatCount = 3) => { /* SpeechSynthesis repeating */ }, []);
// Build full Korean sentence by replacing [BLANK] with the original words
const getFullKoreanSentence = useCallback(() => { /* replace blanks */ }, [blankPhrase]);
// Speak the full Korean sentence (with blanks filled) three times
const handleSpeakFullThreeTimes = useCallback(() => { /* cancel then speakText(full, null, 3) */ }, [getFullKoreanSentence, speakText]);
```
```906:921:public/src/CurriculumPracticePage.js
<button type="button" className="regenerate-button" onClick={handleSpeakFullThreeTimes} title="Speak full Korean sentence three times">
  Speak x3 (KO)
</button>
```

### Edit: 2025-11-07
- Files: `public/src/LearningModesPage.js`
- Summary: Hardened quiz level selection by coercing `quizDifficulty` to a number before branching. Prevents any possible Level 1/Level 2 swap due to string values.
- Rationale: Some browsers/flows can provide string values from `<select>`; explicit numeric coercion guarantees correct Level 1 (single words) vs Level 2/3 (sentences) behavior.
- Code refs:
```826:846:public/src/LearningModesPage.js
const level = Number(quizDifficulty) || 1;
if (quizMode === 'hands-free') {
  if (level === 1) { /* words loop */ } else { /* sentences */ }
}
```
```910:934:public/src/LearningModesPage.js
const level = Number(quizDifficulty) || 1;
if (level === 1) { /* single word (recording) */ } else { /* sentence (recording) */ }
```

### Edit: 2025-11-07
- Files: `public/src/LearningModesPage.js`
- Summary: Made Level 2 (hands-free) sentence generation robust by retrying up to 5 times to ensure a subject+verb pair (space-separated) and falling back to "I do / 나는 해요" if needed. Prevents occasional single-word outputs.
- Rationale: Users observed Level 2 sometimes producing only a single token; retries enforce a combined noun/pronoun + conjugated verb.
- Code refs:
```462:476:public/src/LearningModesPage.js
for (let attempt = 0; attempt < 5; attempt++) {
  const pair = buildSubjectAndVerbPair(words);
  if (pair && pair.english && pair.korean) {
    const en = String(pair.english).trim();
    const ko = String(pair.korean).trim();
    if (en.includes(' ') && ko.includes(' ')) {
      return pair;
    }
  }
}
return { english: 'I do', korean: '나는 해요' };
```

### Edit: 2025-11-07
- Files: `public/src/LearningModesPage.js`
- Summary: Level 2 now always uses pronouns (no noun subjects) by adding `buildPronounAndVerbPair` and using it in generation. Also added UI: renamed “Current prompt” to “Current words” and display a rolling list of generated sentences (EN+KO) for Level 2/3 under that section.
- Rationale: Requested sentences that make sense using pronouns; visibility into generated sentences during hands-free playback.
- Code refs:
```120:143:public/src/LearningModesPage.js
const buildPronounAndVerbPair = React.useCallback((words) => { /* pronoun-only subject + conjugated verb */ }, [ ... ]);
```
```456:473:public/src/LearningModesPage.js
// use buildPronounAndVerbPair with retries for Level 2
```
```63:63:public/src/LearningModesPage.js
const [generatedSentences, setGeneratedSentences] = React.useState([]);
```
```868:882:public/src/LearningModesPage.js
setGeneratedSentences([]);
// each loop: setGeneratedSentences((prev) => [{ english: sent.english, korean: sent.korean }, ...prev].slice(0, 10));
```
```1029:1060:public/src/LearningModesPage.js
<div style={{ fontSize: 12, fontWeight: 600 }}>Current words</div>
{generatedSentences && generatedSentences.length > 0 && (/* render list */)}
```

### Edit: 2025-11-07
- Files: `public/src/LearningModesPage.js`
- Summary: Added noun+adjective alternative for Level 2 generation with helpers `pickRandomAdjective` and `buildNounAndAdjectiveSentence`. Level 2 now randomly chooses pronoun+verb or noun+adjective and validates both EN/KO contain a space to avoid single-word outputs.
- Rationale: User requested Level 2 to sometimes describe nouns with adjectives, not only pronoun+verb sentences.
- Code refs:
```144:173:public/src/LearningModesPage.js
const pickRandomAdjective = ...
const buildNounAndAdjectiveSentence = ...
```
```474:497:public/src/LearningModesPage.js
// Randomly try pronoun+verb and noun+adjective with retries; ensure space in EN/KO
```

### Edit: 2025-11-07
- Files: `public/src/AudioLearningPage.css`
- Summary: Audio Learning cards now render white with black text in dark mode by canceling the global invert on `.audio-card` and forcing white backgrounds/black text for selects, inputs, buttons, and list rows inside the card.
- Rationale: User requested white boxes and black inner text for Mode/Difficulty and other controls while keeping global dark mode elsewhere.
- Code refs:
```36:72:public/src/AudioLearningPage.css
/* Make audio cards visually white with black text (cancel global invert within the card) */
html.dark .audio-card {
  filter: invert(1) hue-rotate(180deg) !important; /* cancel global invert */
  background: #ffffff !important;
  color: #000000 !important;
  border-color: #e5e7eb !important;
}
/* Inputs/selects/textareas inside card: white bg, black text */
html.dark .audio-card .audio-select,
html.dark .audio-card input,
html.dark .audio-card textarea {
  background: #ffffff !important;
  color: #000000 !important;
  border-color: #e5e7eb !important;
}
/* Labels and small text inside controls: black */
html.dark .audio-card .audio-actions span,
html.dark .audio-card .audio-actions label,
html.dark .audio-card .audio-actions option {
  color: #000000 !important;
}
/* Buttons inside card: white bg, black text */
html.dark .audio-card .audio-btn,
html.dark .audio-card .audio-mini-btn {
  background: #ffffff !important;
  color: #000000 !important;
  border-color: #e5e7eb !important;
}
```

