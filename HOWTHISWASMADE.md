# How This Was Made – Change Log

This document explains meaningful code edits: what changed, why, and where.

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


