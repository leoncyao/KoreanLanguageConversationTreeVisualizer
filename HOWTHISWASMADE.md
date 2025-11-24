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
- Don't batch unrelated edits in the same bullet; make separate "Edit" sections.

### Edit: 2025-11-12
- Files: `public/src/AudioLearningPage.js`
- Summary: Level 3 (hands‑free) now uses 5‑sentence conversation sets with playback order Korean → English → word‑by‑word breakdown; loops the set. Added `getWordByWordPairs` usage and updated dependencies.
- Rationale: Requested "conversation sets" for Level 3 where each sentence is spoken in Korean first, then English, followed by a token‑level KO/EN breakdown.
- Code refs:
```1087:1167:public/src/AudioLearningPage.js
        } else {
          // Level 3: conversation sets (5) with KO→EN→word-by-word breakdown
          const batch3 = [];
          for (let i = 0; i < 5; i++) {
            if (!playingRef.current || !quizLoopRef.current) break;
            const s = await generateQuizSentence(3);
            if (s && s.english && s.korean) batch3.push({ english: String(s.english), korean: String(s.korean) });
          }
          if (batch3.length === 0) {
            // Fallback: continuous generation if batch failed
            while (playingRef.current && quizLoopRef.current) {
              await waitWhilePaused(); if (!playingRef.current) break;
              const sent = await generateQuizSentence(3);
              if (!sent) break;
              setGeneratedSentences((prev) => [{ english: String(sent.english || ''), korean: String(sent.korean || '') }, ...prev].slice(0, 10));
              // Speak Korean sentence
              updateMediaSession(sent.korean, 'Korean', true);
              await waitWhilePaused(); if (!playingRef.current) break;
              await speak(sent.korean, 'ko-KR', 1.0);
              if (!playingRef.current || !quizLoopRef.current) break;
              await new Promise(r => setTimeout(r, Math.max(0, Number(quizDelaySec) || 0) * 1000));
              // Speak English sentence
              updateMediaSession(sent.english, 'English', true);
              await waitWhilePaused(); if (!playingRef.current) break;
              await speak(sent.english, 'en-US', 1.0);
              if (!playingRef.current || !quizLoopRef.current) break;
              await new Promise(r => setTimeout(r, Math.max(0, Number(quizDelaySec) || 0) * 1000));
              // Word-by-word breakdown (KO then EN per token)
              try {
                const pairs = await getWordByWordPairs(String(sent.english || ''), String(sent.korean || ''));
                for (const t of (pairs || [])) {
                  if (!playingRef.current || !quizLoopRef.current) break;
                  updateMediaSession(String(t.ko || ''), 'Korean', true);
                  await waitWhilePaused(); if (!playingRef.current) break;
                  await speak(String(t.ko || ''), 'ko-KR', 1.0);
                  if (!playingRef.current || !quizLoopRef.current) break;
                  updateMediaSession(String(t.en || ''), 'English', true);
                  await waitWhilePaused(); if (!playingRef.current) break;
                  await speak(String(t.en || ''), 'en-US', 1.0);
                  await new Promise(r => setTimeout(r, 150));
                }
              } catch (_) {}
              await new Promise(r => setTimeout(r, 300));
            }
          } else {
            // Show the batch in UI (most recent first)
            setGeneratedSentences(batch3.slice(0).reverse());
            let idx3 = 0;
            while (playingRef.current && quizLoopRef.current) {
              await waitWhilePaused(); if (!playingRef.current) break;
              const sent = batch3[idx3 % batch3.length];
              idx3++;
              // Speak Korean sentence
              updateMediaSession(sent.korean, 'Korean', true);
              await waitWhilePaused(); if (!playingRef.current) break;
              await speak(sent.korean, 'ko-KR', 1.0);
              if (!playingRef.current || !quizLoopRef.current) break;
              await new Promise(r => setTimeout(r, Math.max(0, Number(quizDelaySec) || 0) * 1000));
              // Speak English sentence
              updateMediaSession(sent.english, 'English', true);
              await waitWhilePaused(); if (!playingRef.current) break;
              await speak(sent.english, 'en-US', 1.0);
              if (!playingRef.current || !quizLoopRef.current) break;
              await new Promise(r => setTimeout(r, Math.max(0, Number(quizDelaySec) || 0) * 1000));
              // Word-by-word breakdown (KO then EN per token)
              try {
                const pairs = await getWordByWordPairs(String(sent.english || ''), String(sent.korean || ''));
                for (const t of (pairs || [])) {
                  if (!playingRef.current || !quizLoopRef.current) break;
                  updateMediaSession(String(t.ko || ''), 'Korean', true);
                  await waitWhilePaused(); if (!playingRef.current) break;
                  await speak(String(t.ko || ''), 'ko-KR', 1.0);
                  if (!playingRef.current || !quizLoopRef.current) break;
                  updateMediaSession(String(t.en || ''), 'English', true);
                  await waitWhilePaused(); if (!playingRef.current) break;
                  await speak(String(t.en || ''), 'en-US', 1.0);
                  await new Promise(r => setTimeout(r, 150));
                }
              } catch (_) {}
              await new Promise(r => setTimeout(r, 300));
            }
          }
```
```1267:1271:public/src/AudioLearningPage.js
  }, [ensureLearningWords, quizMode, startMicRecording, stopMicRecording, playRecorded, quizDelaySec, quizRecordDurationSec, startSpeechRecognition, stopSpeechRecognition, recognizedText, pushHistory, quizDifficulty, generateQuizSentence, waitWhilePaused, setIndex, applyPronounAndTenseIfVerb, getWordByWordPairs]);
```

### Edit: 2025-11-12
- Files: `public/src/AudioLearningPage.js`
- Summary: Level 3 generation no longer uses current learning words; it now produces random conversational sentences via Chat with a polite style, plus a local fallback seed list.
- Rationale: Requested that Level 3 be a random conversation mode independent of the user's learning word list.
- Code refs:
```634:651:public/src/AudioLearningPage.js
    // Level 3: random conversational sentence (not tied to learning words)
    try {
      const prompt = `Return ONLY JSON: {"korean":"...","english":"..."}.
Create ONE natural everyday conversational Korean sentence in polite style (ending with 요), 7–12 words.
Avoid rare terms and proper nouns; keep to common daily-life topics.
Provide an accurate English translation.`;
      const res = await api.chat(prompt);
      const data = await res.json();
      const obj = parseJsonObject(data && data.response || '');
      if (obj && obj.korean && obj.english) {
        return { korean: String(obj.korean), english: String(obj.english) };
      }
    } catch (_) {}
    // Fallback: random conversational seeds (independent of learning words)
    const seeds = [
      { korean: '오늘 저녁에 같이 밥 먹을까요?', english: 'Shall we have dinner together this evening?' },
      { korean: '주말에 시간 있으시면 커피 마셔요.', english: 'If you have time on the weekend, let's have coffee.' },
      { korean: '이거 어떻게 사용하는지 알려줄 수 있어요?', english: 'Can you show me how to use this?' },
      { korean: '어제 본 영화가 정말 재미있었어요.', english: 'The movie I saw yesterday was really fun.' },
      { korean: '잠깐만 기다려 주세요. 금방 올게요.', english: 'Please wait a moment. I'll be right back.' },
      { korean: '사진을 보내 주시면 바로 확인할게요.', english: 'If you send the photo, I'll check it right away.' },
      { korean: '지하철이 너무 복잡해서 조금 늦었어요.', english: 'The subway was too crowded, so I'm a bit late.' },
      { korean: '내일 아침 일찍 출발하는 게 어때요?', english: 'How about leaving early tomorrow morning?' },
      { korean: '도와주셔서 정말 감사합니다.', english: 'Thank you so much for your help.' },
      { korean: '이 근처에 맛있는 식당이 있을까요?', english: 'Is there a good restaurant around here?' },
    ];
    const s = seeds[Math.floor(Math.random() * seeds.length)];
    return { korean: s.korean, english: s.english };
```

### Edit: 2025-11-12
- Files: `public/src/AudioLearningPage.js`
- Summary: Level 3 now requests a coherent 5‑turn conversation as a single JSON array (A/B alternating), ensuring related sentences; falls back to a seeded 5‑turn dialogue if Chat fails. Level 3 playback uses this batch directly.
- Rationale: Requested that Level 3 be a "random conversation set" of 5 related lines, not 5 unrelated sentences.
- Code refs:
```574:609:public/src/AudioLearningPage.js
// Generate a coherent 5-turn conversation (independent of learning words)
const generateConversationSet = React.useCallback(async () => {
  try {
    const prompt = `Return ONLY a JSON array of 5 objects like:
[{"speaker":"A","korean":"...","english":"..."}, ...]
Requirements:
- Natural everyday conversation in polite style (요), 7–12 Korean words per turn
- Two speakers alternating ("A" then "B" then "A" then "B" then "A" or vice versa)
- Turns must be contextually related (follow-up questions/answers, short plans, clarifications)
- Avoid rare terms and proper nouns; use common daily-life topics
- Provide accurate English translations`;
    const res = await api.chat(prompt);
    ...
    if (norm.length === 5) {
      return norm.map(({ korean, english }) => ({ korean, english }));
    }
  } catch (_) {}
  // Fallback: simple coherent seed conversation (5 turns)
  const seeds = [ ... ];
  return seeds;
}, [parseJsonArraySafe]);
```
```1135:1210:public/src/AudioLearningPage.js
// Level 3: conversation sets (5) with KO→EN→word-by-word breakdown
const batch3 = await generateConversationSet();
if (batch3.length === 0) {
  // Fallback continuous generation (old behavior)
  ...
} else {
  setGeneratedSentences(batch3.slice(0).reverse());
  while (playingRef.current && quizLoopRef.current) {
    const sent = batch3[idx3 % batch3.length];
    // Speak KO → EN → token breakdown
    ...
  }
}
```

### Edit: 2025-11-12
- Files: `public/src/AudioLearningPage.js`
- Summary: Set default difficulty to Level 3 for Audio Learning.
- Rationale: Requested Level 3 as the default experience.
- Code refs:
```39:44:public/src/AudioLearningPage.js
  const [quizDelaySec, setQuizDelaySec] = React.useState(2.0);
  const [quizRecordDurationSec, setQuizRecordDurationSec] = React.useState(2.0);
  const [quizDifficulty, setQuizDifficulty] = React.useState(3);
  const recognitionRef = React.useRef(null);
```

### Edit: 2025-11-12
- Files: `backend/tts.js`, `backend/server.js`, `public/src/AudioLearningPage.js`
- Summary: Added conversation save/load and one-file audio export. New backend endpoint `/api/tts/conversation` builds a single MP3 for a 5‑turn dialogue (KO→EN per line). UI now lets you save conversation sets locally, generate a single audio file, play it, and download it on mobile/desktop.
- Rationale: Requested saving conversations to reload later and generating one audio file (instead of sentence-by-sentence), with ability to save to device on mobile.
- Code refs:
```99:249:backend/tts.js
// Generate one long MP3 for a conversation set with configurable order (ko-en or en-ko)
async function handleTTSConversation(req, res) { /* takes { items, order, delaySeconds } and returns /tts-cache/conversation_<hash>.mp3 */ }
module.exports.handleTTSConversation = handleTTSConversation;
```
```95:97:backend/server.js
app.post('/api/tts', handleTTS);
app.post('/api/tts/batch', handleTTSBatch);
app.post('/api/tts/conversation', handleTTSConversation);
```
```69:78:public/src/AudioLearningPage.js
const [savedConversations, setSavedConversations] = React.useState(() => { /* localStorage conversation_sets_v1 */ });
const persistConversations = React.useCallback((list) => { /* save to localStorage */ }, []);
const [conversationTitle, setConversationTitle] = React.useState('My Conversation');
const [conversationAudioUrl, setConversationAudioUrl] = React.useState('');
```
```574:609:public/src/AudioLearningPage.js
const saveConversationSet = React.useCallback(() => { /* save generatedSentences (5) with title */ }, [...]);
const generateConversationAudio = React.useCallback(async (items) => { /* POST /api/tts/conversation; setConversationAudioUrl */ }, [...]);
const playConversationAudio = React.useCallback(() => { /* new Audio(url).play() */ }, [...]);
const downloadConversationAudio = React.useCallback(() => { /* anchor download conversation.mp3 */ }, [...]);
```
```1531:1560:public/src/AudioLearningPage.js
{/* Conversation save/export controls under Generated sentences */}
<input value={conversationTitle} ... />
<button onClick={saveConversationSet}>Save Conversation</button>
<button onClick={() => generateConversationAudio(generatedSentences)}>Generate One Audio (KO→EN)</button>
<button onClick={playConversationAudio} disabled={!conversationAudioUrl}>Play Audio</button>
<button onClick={downloadConversationAudio} disabled={!conversationAudioUrl}>Download MP3</button>
```
```1564:1600:public/src/AudioLearningPage.js
{/* Saved Conversations card */}
{savedConversations.map((c) => (
  <button onClick={() => { setGeneratedSentences(c.items.slice(0).reverse()); }}>Load</button>
  <button onClick={() => generateConversationAudio(c.items)}>Generate Audio</button>
  <button onClick={downloadConversationAudio} disabled={!conversationAudioUrl}>Download</button>
  <button onClick={...}>Rename</button>
  <button onClick={...}>Delete</button>
))}
```

### Edit: 2025-11-12
- Files: `public/src/AudioLearningPage.js`
- Summary: Auto-loads the first saved conversation on startup (if any) into the Level 3 "Generated sentences" list.
- Rationale: Requested to preload a saved conversation by default for immediate playback/export.
- Code refs:
```80:93:public/src/AudioLearningPage.js
// Auto-load first saved conversation (if any) on startup
React.useEffect(() => {
  if (Array.isArray(savedConversations) && savedConversations.length > 0) {
    if (!generatedSentences || generatedSentences.length === 0) {
      const first = savedConversations[0];
      const items = Array.isArray(first && first.items) ? first.items : [];
      if (items.length > 0) setGeneratedSentences(items.slice(0).reverse());
    }
  }
}, [savedConversations]);
```

### Edit: 2025-11-12
- Files: `public/src/AudioLearningPage.js`
- Summary: Changed Start button behavior for Level 3 (hands‑free) to play the currently loaded conversation using a single generated MP3, without generating a new conversation. Added a separate "New Conversation" button to generate a fresh 5‑turn set.
- Rationale: Requested Start/Play to use the loaded conversation and have a distinct action to generate a new one.
- Code refs:
```1502:1521:public/src/AudioLearningPage.js
// Start button: for Level 3 hands‑free, call handlePlayCurrentConversation(); otherwise handleStartQuizLoop()
```
```618:649:public/src/AudioLearningPage.js
// playConversationAudio(): now returns a Promise and stores element in conversationAudioRef to support Stop
```
```700:740:public/src/AudioLearningPage.js
// handleGenerateNewConversation(): generateConversationSet() then setGeneratedSentences()
// handlePlayCurrentConversation(): ensure audio exists, play, manage wake lock/keep-alive, and cleanup
```

### Edit: 2025-11-12
- Files: `public/src/AudioLearningPage.js`
- Summary: Applied master speech speed slider to conversation audio playback by setting HTML5 Audio `playbackRate` from `window.__APP_SPEECH_SPEED__` and polling every 500ms to keep it in sync; clears the interval on cleanup.
- Rationale: Ensure the one-file conversation export respects the global speed control, same as loop playback.
- Code refs:
```618:649:public/src/AudioLearningPage.js
const audio = new Audio(conversationAudioUrl);
...
audio.playbackRate = window.__APP_SPEECH_SPEED__ || 1.0;
const speedCheckInterval = setInterval(() => { audio.playbackRate = window.__APP_SPEECH_SPEED__ || 1.0; }, 500);
audio._speedCheckInterval = speedCheckInterval;
...
if (audio._speedCheckInterval) clearInterval(audio._speedCheckInterval);
```

### Edit: 2025-11-12
- Files: `public/src/AudioLearningPage.js`
- Summary: Reordered the right column to show "Saved Conversations" above "Word Sets."
- Rationale: Requested to prioritize saved conversations before word sets in the UI.
- Code refs:
```1668:1737:public/src/AudioLearningPage.js
// Moved Saved Conversations card before Word Sets card
```

### Edit: 2025-11-12
- Files: `backend/database.js`, `backend/server.js`
- Summary: Added server-backed conversation storage and routes. New SQLite table `conversations` with columns (id, owner, title, items_json, created_at, updated_at). Routes: GET `/api/conversations?owner=...`, POST `/api/conversations`, PUT `/api/conversations/:id`, DELETE `/api/conversations/:id`.
- Rationale: Enable saving/loading conversation sets across devices using an owner key or global listing, replacing device-only localStorage.
- Code refs:
```220:238:backend/database.js
-- Conversation sets table
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner TEXT,
  title TEXT NOT NULL,
  items_json TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```
```242:308:backend/database.js
async addConversation(owner, title, items) { ... }
async getConversations(owner, limit = 100) { ... }
async updateConversation(id, owner, { title, items }) { ... }
async deleteConversation(id, owner) { ... }
```
```98:137:backend/server.js
// Conversations API
app.get('/api/conversations', async (req, res) => { ... });
app.post('/api/conversations', async (req, res) => { ... });
app.put('/api/conversations/:id', async (req, res) => { ... });
app.delete('/api/conversations/:id', async (req, res) => { ... });
```

### Edit: 2025-11-12
- Files: `backend/server.js`
- Summary: Removed owner filtering/usage from conversation routes. All users now share the same conversations list; POST/PUT/DELETE ignore owner.
- Rationale: Requested a single shared database with no per-user scoping.
- Code refs:
```98:137:backend/server.js
// GET now calls db.getConversations(null, limit)
// POST calls db.addConversation(null, ...)
// PUT calls db.updateConversation(id, null, {...})
// DELETE calls db.deleteConversation(id, null)
```

### Edit: 2025-11-12
- Files: `public/src/AudioLearningPage.js`
- Summary: Wired UI to server-backed conversations. Added fetch on mount to sync, a "Refresh from Server" button, and saving a conversation now also POSTs to `/api/conversations` then refreshes the list.
- Rationale: Ensure conversations sync between desktop and phone using the shared backend instead of only localStorage.
- Code refs:
```79:101:public/src/AudioLearningPage.js
// fetchServerConversations() and postServerConversation() helpers
```
```95:101:public/src/AudioLearningPage.js
// useEffect on mount calls fetchServerConversations()
```
```604:617:public/src/AudioLearningPage.js
// saveConversationSet(): POST to server then refresh list
```
```1781:1785:public/src/AudioLearningPage.js
// "Refresh from Server" button in Saved Conversations card
```

### Edit: 2025-11-12
- Files: `public/src/AudioLearningPage.js`
- Summary: Fixed Pause/Resume for Level 3 conversation playback by controlling the HTML5 Audio element; Stop now also tears down conversation audio. Changed conversation order to English→Korean for both generated MP3 and live playback. Updated UI label accordingly.
- Rationale: Requested working pause/resume and EN-first playback per line.
- Code refs:
```952:973:public/src/AudioLearningPage.js
// stopAll(): now stops and cleans up conversationAudioRef (and speed interval)
```
```1601:1650:public/src/AudioLearningPage.js
// Pause button: if Level 3 hands-free and audio exists, pause/play HTML5 audio; else pause/resume loop
```
```1744:1746:public/src/AudioLearningPage.js
// Button label changed to EN→KO
```
```618:632:public/src/AudioLearningPage.js
// generateConversationAudio(): order set to 'en-ko'
```
```1314:1331:public/src/AudioLearningPage.js
// Level 3 fallback playback: English first, then Korean, with delays
```
```1357:1381:public/src/AudioLearningPage.js
// Level 3 batch playback: English first, then Korean, with delays
```

### Edit: 2025-11-12
- Files: `public/src/AudioLearningPage.js`
- Summary: Removed "Show conjugation hints" feature (toggle, rendering, and helper). No longer displays present/past hint lines.
- Rationale: Requested removal of conjugation hints UI and logic.
- Code refs:
```53:55:public/src/AudioLearningPage.js
// removed: showConjugations state
```
```350:360:public/src/AudioLearningPage.js
// removed: buildConjugationHints() helper
```
```1595:1600:public/src/AudioLearningPage.js
// removed: checkbox UI for Show conjugation hints
```
```1705:1714:public/src/AudioLearningPage.js
// removed: hint rendering inside currentSetWords map
```

### Edit: 2025-11-12
- Files: `public/src/AudioLearningPage.js`
- Summary: Conditionalized center panel so Level 1 shows "Current words" while Levels ≥2 show "Generated Sentences (Level >= 2)". Previously both could appear; now it's mutually exclusive based on level. Also updated header text.
- Rationale: Requested clearer UI that shows either current words (level 1) or generated sentences (levels 2/3).
- Code refs:
```1659:1666:public/src/AudioLearningPage.js
// Wrap "Current words" in (Number(quizDifficulty)||1) === 1
```
```1719:1723:public/src/AudioLearningPage.js
// Show Generated Sentences only when level >= 2, updated header to "Generated Sentences (Level >= 2)"
```

### Edit: 2025-11-12
- Files: `public/src/AudioLearningPage.js`
- Summary: Show "Recognized (Korean)" only in Recording & Playback mode; moved recognized text block inside the recording-only conditional.
- Rationale: Requested to hide recognition UI when not recording.
- Code refs:
```1761:1780:public/src/AudioLearningPage.js
// Wrapped the Recognized (Korean) section inside quizMode === 'recording'
```
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
- Summary: Added "Speak" button to each journal entry (plays Korean then English). After saving a journal entry, split text into sentences and add each (KO/EN pair) to Curriculum automatically.
- Rationale: Faster review: listen to entries directly and build practice material automatically from journal content.

### Edit: 2025-11-06
- Files: `public/src/ChatPage.js`, `public/src/TranslationPage.js`, `public/src/App.js`
- Summary: Moved chat/explanations to a dedicated `ChatPage` and linked from Translation; added `/chat` route; Translation shows "Open Chat" button passing context via query.
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
- Rationale: "Stop" must reliably halt audio; users requested adjustable delay before English playback.

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
- Summary: Added "Stop" button next to Speak for each entry; cancels TTS and halts HTML5 Audio via `cleanupAudioCache()`.
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
- Summary: Added lightweight heartbeat `GET /api/health`; client pings every 15s with 3s timeout; shows "Retry now" button on consecutive failures.
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
- Rationale: Backend Google TTS doesn't support rate; enforcing playbackRate client-side ensures Level 2 sentences and explanations respond to the master speed.

### Edit: 2025-11-07
- Files: `public/src/PhrasePractice.js`
- Summary: Added "Remix: New Sentence (no tracking)" button that generates a new sentence (same POS pattern, new words/grammar) via Chat JSON; enabled session "no‑track" mode to skip progress updates for remixed/variation sentences.
- Rationale: Allow creating fresh practice sentences on the fly without advancing curriculum/progress counts; honors request to preserve order of word types while changing content.

### Edit: 2025-11-07
- Files: `public/src/CurriculumPracticePage.js`
- Summary: Added Remix button with no‑track session mode; implemented Chat‑driven remix that preserves POS order while replacing content; guarded stats updates to skip when no‑track or remix/variation.
- Rationale: Expose remix capability on the curriculum practice page and prevent the total X/Y progress from changing when user is in new‑sentence mode.

### Edit: 2025-11-07
- Files: `public/src/CurriculumPracticePage.js`
- Summary: Added "Add to Curriculum" button to save the current (including remixed) sentence into the curriculum via API.
- Rationale: Allow manual promotion of a remixed sentence into the tracked curriculum without auto‑advancing progress until the user chooses to.

### Edit: 2025-11-07
- Files: `public/src/CurriculumPracticePage.js`
- Summary: Stopped fetching a new random phrase after each answer; now preloads all curriculum phrases and advances locally to the next unused phrase. When none remain, switches to variations/new‑sentence mode without altering progress totals.
- Rationale: Reduce network churn and honor request to download all phrases first, then start the game.

### Edit: 2025-11-07
- Files: `public/src/CurriculumPracticePage.js`
- Summary: Added a fixed 5‑phrase session subset (randomly sampled once). The practice loops over these 5 repeatedly, varying blanks each round, and no longer falls into AI mode automatically when the set is completed.
- Rationale: Requested "5 at a time" gameplay that repeats the same set instead of generating new sentences automatically.

### Edit: 2025-11-07
- Files: `public/src/ChatPage.js`
- Summary: Enabled Enter-to-send from the chat input; Tab then Space activates the Send button as usual.
- Rationale: Keyboard accessibility on the chat page as requested for the translate/chat flow.

### Edit: 2025-11-07
- Files: `public/src/ChatPage.js`
- Summary: Allowed sending messages without prior translation context; when no context exists, prompts use only the user's question.
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

### Edit: 2025-11-08
- Files: `public/src/Navbar.js`, `public/src/Navbar.css`
- Summary: Added a Settings modal to host Options (Theme, Speech Speed, Mute). Replaced always-visible options with a Settings button in the navbar and bottom bar. Modal uses overlay with close, and retains existing behavior/state persistence.
- Rationale: Options were covering content and cluttering the UI. Moving them into a dialog keeps the navbar clean and prevents overlap.
- Code refs:
```170:177:public/src/Navbar.js
        <div className="nav-options" ...>
          <button type="button" className="mute-button" onClick={() => setNavExpanded(false)}>Less</button>
          <button type="button" className="mute-button" onClick={() => alert('Use the Settings button to change options.')}>Info</button>
          <button type="button" className="mute-button" onClick={() => {
            const el = document.getElementById('settings-modal-overlay');
            if (el) el.style.display = 'flex';
          }}>
            Settings
          </button>
        </div>
```
```205:220:public/src/Navbar.js
      <div className="bottom-bar">
        <div className="bottom-bar-inner">
          <span className="bottom-bar-text">Korean Learning App</span>
          <button type="button" className="mute-button" onClick={() => {
            const el = document.getElementById('settings-modal-overlay');
            if (el) el.style.display = 'flex';
          }}>
            Settings
          </button>
        </div>
      </div>
```
```221:268:public/src/Navbar.js
      {/* Settings Modal */}
      <div id="settings-modal-overlay" className="settings-modal-overlay" onClick={(e) => { ... }}>
        <div className="settings-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
          <div className="settings-modal-header">
            <h3>Settings</h3>
            <button ...>Close</button>
          </div>
          <div className="settings-modal-body">
            <div className="settings-row">Theme ...</div>
            <div className="settings-row">Speech Speed slider ...</div>
            <div className="settings-row">Audio Mute ...</div>
          </div>
        </div>
      </div>
```
```160:190:public/src/Navbar.css
.settings-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: none; ... }
.settings-modal { width: min(520px, 92vw); background: #fff; color: #111; border: 1px solid #e5e7eb; border-radius: 10px; ... }
.settings-modal-header { display: flex; justify-content: space-between; margin-bottom: 12px; }
.settings-modal-body { display: flex; flex-direction: column; gap: 12px; }
.settings-row { display: flex; justify-content: space-between; gap: 12px; }
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

### Edit: 2025-11-08
- Files: `public/src/Navbar.js`
- Summary: Hid the extra "Less" button from the top nav options (it only shows via the toggle when expanded) and added a desktop "Practice" tab linking to `/curriculum-practice`.
- Rationale: "Less" appeared even when not expanded, causing confusion; adding a desktop Practice tab makes the curriculum practice page easier to reach.
- Code refs:
```160:174:public/src/Navbar.js
<div className="nav-options" ...>
  <!-- Removed Less; kept Info and Settings -->
</div>
```
```144:151:public/src/Navbar.js
<li className="nav-item nav-item-desktop">
  <Link to="/curriculum-practice" className="nav-link">Practice</Link>
</li>
```
### Edit: 2025-11-08
- Files: `public/src/KpopLyricsPage.js`, `public/src/App.js`, `public/src/Navbar.js`
- Summary: Added K‑pop Lyrics page. Users can add/select songs, paste Korean lyrics, and step through lines with English translations. Includes "Translate All," per-line translation, and show/hide English toggle. Added route `/kpop-lyrics` and a desktop nav link (visible on mobile when expanded).
- Rationale: New learning mode to review K‑pop lyrics line‑by‑line with translations while letting users input their own lyrics.
- Code refs:
```1:280:public/src/KpopLyricsPage.js
function KpopLyricsPage() { /* localStorage-backed songs; per-line translate via api.translate */ }
```
```20:35:public/src/App.js
import KpopLyricsPage from './KpopLyricsPage';
...
<Route path="/kpop-lyrics" element={<KpopLyricsPage />} />
```
```140:147:public/src/Navbar.js
<li className="nav-item nav-item-desktop">
  <Link to="/kpop-lyrics" className="nav-link">K‑pop Lyrics</Link>
</li>
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

### Edit: 2025-11-08
- Files: `public/src/KpopLyricsPage.js`
- Summary: Switched K‑pop lyrics viewer to display all lines in a single scrollable panel. Each line shows Korean plus its translation (with per‑line Translate button if missing); removed Prev/Next stepping UI.
- Rationale: Requested a consolidated view to see the entire song at once instead of stepping through one line at a time.
- Code refs:
```120:177:public/src/KpopLyricsPage.js
{parsedLines.map((line, i) => ( /* render KO + EN with per-line translate */ ))}
```

### Edit: 2025-11-08
- Files: `public/src/index.js`, `public/src/Navbar.js`
- Summary: Changed theme defaulting: if no saved preference, use light mode on desktop and dark mode on mobile (coarse pointer or mobile UA). Persisted choice still overrides.
- Rationale: Desired default appearance differs by device; desktop should default to light, mobile to dark.
- Code refs:
```8:16:public/src/index.js
const prefersMobile = (window.matchMedia('(pointer: coarse)').matches || /Mobi|Android|.../.test(navigator.userAgent));
const defaultTheme = prefersMobile ? 'dark' : 'light';
const savedTheme = saved || defaultTheme;
```
```23:33:public/src/Navbar.js
const [theme, setTheme] = React.useState(() => {
  const saved = localStorage.getItem('app_theme');
  if (saved) return saved;
  const prefersMobile = ...;
  return prefersMobile ? 'dark' : 'light';
});
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

### Edit: 2025-11-08
- Files: `public/src/PhrasePractice.js`
- Summary: Added "Prev 5" and "Next 5" buttons to navigate sets of 5 when practicing with generated variations. Shows current set and total sets; jumping updates the current sentence to the first item of the set.
- Rationale: Requested navigation by groups of five in phrase practice to quickly move across batches of similar sentences.
- Code refs:
```499:548:public/src/PhrasePractice.js
const hasVariations = generatedVariations.length > 0;
const totalSets = hasVariations ? Math.ceil(generatedVariations.length / 5) : 0;
const currentSet = hasVariations ? Math.floor(currentVariationIndex / 5) + 1 : 0;
const handlePrevSet = ...
const handleNextSet = ...
// UI above the variation indicator with Prev 5 / Next 5
```

### Edit: 2025-11-08
- Files: `public/src/LearningModesPage.js`
- Summary: Added "Prev 20" and "Next 20" controls for Audio Learning (hands‑free Level 1) to navigate word sets of 20; displays Set X / Y computed from total learning words.
- Rationale: Parity with phrase practice navigation; quick movement between 20‑word chunks by date order.
- Code refs:
```72:76:public/src/LearningModesPage.js
const totalSetsHF = React.useMemo(() => Math.max(1, Math.ceil((learningWords?.length || 0) / 20)), [learningWords]);
```
```1097:1114:public/src/LearningModesPage.js
{quizMode==='hands-free' && quizDifficulty===1 && /* set input + Prev 20/Next 20 controls with Set X/Y */}
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
- Summary: Level 2 now always uses pronouns (no noun subjects) by adding `buildPronounAndVerbPair` and using it in generation. Also added UI: renamed "Current prompt" to "Current words" and display a rolling list of generated sentences (EN+KO) for Level 2/3 under that section.
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

### Edit: 2025-11-08
- Files: `public/src/Navbar.js`, `public/src/Navbar.css`
- Summary: Moved navbar options (theme, speed, mute) to a fixed bottom bar on mobile and forced the top navbar to a single line with horizontal scrolling if needed. Desktop keeps options in the top bar.
- Rationale: Prevents the navbar from wrapping to a second line on small screens and keeps frequently used controls accessible at the bottom.
- Code refs:
```162:183:public/src/Navbar.js
        <div className="nav-options" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
          <button type="button" className="mute-button" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? '🌙 Dark' : '☀️ Light'}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', border: '1px solid #ddd', borderRadius: '5px', background: 'white' }}>
            <span style={{ fontSize: '0.75rem', color: '#666', whiteSpace: 'nowrap' }}>Speed:</span>
            <input ... />
            <span ...>{speechSpeed.toFixed(1)}x</span>
          </div>
          <button type="button" className="mute-button" onClick={() => setMuted(m => !m)}>
            {muted ? '🔇 Unmute' : '🔊 Mute'}
          </button>
        </div>
```
```198:216:public/src/Navbar.js
      <div className="bottom-bar">
        <div className="bottom-bar-inner">
          <span className="bottom-bar-text">Korean Learning App</span>
          <div className="bottom-bar-options">
            <button type="button" className="mute-button" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark' ? '🌙 Dark' : '☀️ Light'}
            </button>
            <div ...>
              <span ...>Speed:</span>
              <input ... />
              <span ...>{speechSpeed.toFixed(1)}x</span>
            </div>
            <button type="button" className="mute-button" onClick={() => setMuted(m => !m)}>
              {muted ? '🔇 Unmute' : '🔊 Mute'}
            </button>
          </div>
        </div>
      </div>
```
```145:200:public/src/Navbar.css
@media (max-width: 768px) {
  .navbar { flex-wrap: nowrap; justify-content: space-between; }
  .navbar-nav { flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .nav-options { display: none !important; }
  .bottom-bar-inner { justify-content: space-between; }
  .bottom-bar-options { display: flex; }
}
```
### Edit: 2025-11-08
- Files: `public/src/ChatPage.js`, `public/src/TranslationPage.js`, `public/src/PhrasePractice.js`
- Summary: Fixed chat input text color for dark mode; Translation page now shows the explanation inline and keeps an "Open Chat" button; added "Add to Curriculum" button on Translation; added a toggle to show/hide English in Phrase Practice.
- Rationale: Improve readability in dark mode and streamline the translation→explanation workflow; enable quick curriculum building; give learners control over revealing English.
- Code refs:
```157:166:public/src/ChatPage.js
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={onChatKeyDown}
              placeholder={lastContext ? 'Ask about the explanation…' : 'Optional: translate first to provide context'}
              style={{ flex: 1, padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 10, color: '#111827' }}
            />
```
```6:20:public/src/TranslationPage.js
import { api } from './api';
...
const [explanation, setExplanation] = React.useState('');
const [loadingExplanation, setLoadingExplanation] = React.useState(false);
const [addStatus, setAddStatus] = React.useState('');
```
```54:90:public/src/TranslationPage.js
// Fetch explanation when we have context
React.useEffect(() => {
  let cancelled = false;
  (async () => {
    try {
      setAddStatus('');
      if (!lastContext || !lastContext.input || !lastContext.translation) {
        if (!cancelled) setExplanation('');
        return;
      }
      if (!cancelled) setLoadingExplanation(true);
      const prompt = `Explain the Korean translation in detail.
Original (user): ${lastContext.input}
Translation (ko): ${lastContext.translation}
Please include a clear breakdown of grammar (particles, tense, politeness), vocabulary with brief glosses, and any pronunciation notes.
Keep it concise and structured for a learner.`;
      const res = await api.chat(prompt);
      if (!cancelled) {
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          setExplanation(String((data && data.response) || ''));
        } else {
          setExplanation('');
        }
      }
    } catch (_) {
      if (!cancelled) setExplanation('');
    } finally {
      if (!cancelled) setLoadingExplanation(false);
    }
  })();
  return () => { cancelled = true; };
}, [lastContext]);
```
```100:121:public/src/TranslationPage.js
{lastContext && (
  <div style={{ marginTop: 8 }}>
    {loadingExplanation ? (
      <p style={{ margin: '4px 0', color: '#6b7280' }}>Loading explanation…</p>
    ) : explanation ? (
      <div
        style={{ lineHeight: '1.6' }}
        dangerouslySetInnerHTML={{ __html: mdToHtml(explanation) }}
      />
    ) : (
      <p style={{ margin: '4px 0', color: '#6b7280' }}>No explanation available.</p>
    )}
  </div>
)}
<button className="translation-link" onClick={handleAddToCurriculum} disabled={!lastContext}>
  Add to Curriculum
</button>
{addStatus && <span style={{ alignSelf: 'center', color: '#6b7280' }}>{addStatus}</span>}
```
```60:70:public/src/PhrasePractice.js
const [showEnglish, setShowEnglish] = useState(true); // Toggle English translation visibility
```
```527:544:public/src/PhrasePractice.js
{feedback && <p className="feedback">{feedback}</p>}
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
  {showEnglish ? (
    <p className="translation" style={{ margin: 0 }}>{blankPhrase.translation}</p>
  ) : (
    <p className="translation" style={{ margin: 0, color: '#6b7280' }}>English hidden</p>
  )}
  <button
    type="button"
    className="regenerate-button"
    onClick={() => setShowEnglish(v => !v)}
    title={showEnglish ? 'Hide English translation' : 'Show English translation'}
  >
    {showEnglish ? 'Hide EN' : 'Show EN'}
  </button>
</div>
```

### Edit: 2025-11-08
- Files: `public/src/Navbar.js`, `public/src/Navbar.css`
- Summary: Simplified mobile navbar to show only 4 essential tabs (Translate, Chat, Practice, Audio Learning) plus the "..." dropdown menu. Desktop retains all links.
- Rationale: User requested a cleaner mobile navbar with only the most frequently used pages visible, plus access to additional pages via dropdown menu, ensuring the navbar stays on one line.
- Code refs:
```117:131:public/src/Navbar.js
          <li className="nav-item nav-item-mobile">
            <Link to="/translate" className="nav-link">Translate</Link>
          </li>
          <li className="nav-item nav-item-mobile">
            <Link to="/chat" className="nav-link">Chat</Link>
          </li>
          <li className="nav-item nav-item-mobile">
            <Link to="/curriculum-practice" className="nav-link">Practice</Link>
          </li>
          <li className="nav-item nav-item-mobile">
            <Link to="/quiz-mode" className="nav-link">Audio Learning</Link>
          </li>
```
```61:63:public/src/Navbar.css
.nav-item-mobile {
  display: none; /* hidden on desktop */
}
```
```198:204:public/src/Navbar.css
  .nav-item-mobile {
    display: block !important; /* show mobile links on mobile */
  }

  .nav-item-dropdown {
    display: block !important; /* show dropdown on mobile */
  }
```

### Edit: 2025-11-08
- Files: `public/src/CurriculumPracticePage.js`
- Summary: Reduced "Show Answer" button size and centered the action buttons row for a balanced layout.
- Rationale: The Show Answer button looked oversized relative to other actions.
- Code refs:
```929:951:public/src/CurriculumPracticePage.js
<div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'center', alignItems: 'center' }}>
```

### Edit: 2025-11-08
- Files: `public/src/api.js`, `public/src/CurriculumPracticePage.js`
- Summary: Ordered curriculum practice by earliest added. Client sends `created_at` on add; loading sorts phrases by `created_at`/`date_added` ascending (fallback to numeric `id`). Session sets of 5 follow this order.
- Rationale: Requested deterministic 5‑phrase sets by date added.
- Code refs:
```84:94:public/src/api.js
const payload = { created_at: new Date().toISOString(), ...(phrase || {}) };
```
```261:279:public/src/CurriculumPracticePage.js
const list = [...listRaw].sort((a,b)=> /* created_at asc; id fallback */);
```
```435:456:public/src/CurriculumPracticePage.js
// After add variation, reload + sort, then setAllPhrases(listSorted)
```

### Edit: 2025-11-08
- Files: `public/src/CurriculumPracticePage.js`
- Summary: Centered the Prev 5 / Next 5 controls and refined spacing/padding; toned the set indicator color for better balance.
- Rationale: Improve visual hierarchy and alignment of set navigation within the Curriculum Progress card.
- Code refs:
```861:884:public/src/CurriculumPracticePage.js
<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, margin: '8px 0 10px' }}>
  <button className="regenerate-button" style={{ padding: '6px 12px' }}>Prev 5</button>
  <button className="regenerate-button" style={{ padding: '6px 12px' }}>Next 5</button>
</div>
```

### Edit: 2025-11-08
- Files: `public/src/CurriculumPracticePage.js`
- Summary: Moved the "Set X / Y" indicator to be directly under the "X / Y phrases (session)" line, and placed the Prev/Next buttons beneath it.
- Rationale: Requested layout with the set indicator under the phrases count for clarity.
- Code refs:
```868:893:public/src/CurriculumPracticePage.js
<div style={{ textAlign: 'center', fontSize: 12, color: '#6b7280', margin: '4px 0' }}>Set X / Y</div>
<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, margin: '6px 0 10px' }}>
  <button>Prev 5</button>
  <button>Next 5</button>
</div>
```
### Edit: 2025-11-08
- Files: `public/src/Navbar.js`, `public/src/Navbar.css`
- Summary: Fixed Audio Learning missing on desktop navbar and mobile dropdown not opening. Changed Audio Learning to show on both desktop and mobile. Simplified dropdown button to use onClick with onTouchEnd fallback, added isOpeningRef to prevent immediate closure, increased click-outside delay to 300ms. Made dropdown visible on both desktop and mobile. Enhanced CSS with better touch interaction properties.
- Rationale: Audio Learning was only marked as mobile-only, so it disappeared on desktop. The dropdown button wasn't responding to touches on mobile; simplified to use onClick (which works on modern mobile browsers) with onTouchEnd as a fallback. Added ref-based flag to prevent click-outside handler from immediately closing the menu when opening. Enhanced CSS with pointer-events, z-index, and touch-action properties for better mobile interaction.
- Code refs:
```139:141:public/src/Navbar.js
          <li className="nav-item">
            <Link to="/quiz-mode" className="nav-link">Audio Learning</Link>
          </li>
```
```155:169:public/src/Navbar.js
          <li className="nav-item nav-item-dropdown">
            <button 
              type="button" 
              className="nav-link" 
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowMoreMenu(prev => !prev);
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowMoreMenu(prev => !prev);
              }}
            >
```
```52:55:public/src/Navbar.css
.nav-item-dropdown {
  position: relative;
  display: block; /* show on desktop by default */
}
```
```79:83:public/src/Navbar.css
.nav-item-dropdown button {
  pointer-events: auto;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
```

### Edit: 2025-11-09
- Files: `public/src/Navbar.js`, `public/nav-order.json`
- Summary: Reordered navbar to: Practice, Translate, Audio Learning, Journal, Curriculum, K‑pop Lyrics, then the rest. Added configurable ordering loaded from `public/nav-order.json`.
- Rationale: Allow changing navigation order without code edits; UX request to prioritize practice and translation first.
- Code refs:
```120:182:public/src/Navbar.js
// Load optional navigation order from public/nav-order.json
React.useEffect(() => {
  let cancelled = false;
  (async () => {
    try {
      const res = await fetch('/nav-order.json', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      const arr = (data && Array.isArray(data.order)) ? data.order.filter(k => typeof k === 'string') : null;
      if (!cancelled && arr && arr.length > 0) {
        setNavOrder(arr);
      }
    } catch (_) {}
  })();
  return () => { cancelled = true; };
}, []);
```
```133:181:public/src/Navbar.js
// Ordered desktop/general links from config
{navOrder.map((key) => {
  const it = items[key];
  if (!it) return null;
  return (
    <li key={key} className={it.className}>
      <Link to={it.to} className="nav-link">{it.label}</Link>
    </li>
  );
})}
```

### Edit: 2025-11-09
- Files: `public/src/CurriculumPracticePage.js`
- Summary: Made the Level selector (1–3) control the number of blanks dynamically; resets inputs and answers when Level changes and slices stored `correct_answers` to match.
- Rationale: Requested that difficulty Level affect blanks count immediately for the current sentence.
- Code refs:
```65:121:public/src/CurriculumPracticePage.js
const createBlankPhrase = useCallback((phrase) => {
  ...
  const desiredBlanks = Math.max(1, Math.min(3, Number(level) || 1));
  ...
  const correctAnswers = Array.isArray(phrase.correct_answers) && phrase.correct_answers.length > 0
    ? phrase.correct_answers.slice(0, blankIndices.length)
    : blankWords;
  ...
}, [level]);
```
```123:132:public/src/CurriculumPracticePage.js
// When level changes, reset inputs/placeholders to match new blanks count
useEffect(() => {
  if (!currentPhrase) return;
  const bp = createBlankPhrase(currentPhrase);
  const count = Array.isArray(bp?.blanks) ? bp.blanks.length : 0;
  setInputValues(new Array(count).fill(''));
  setCurrentBlankIndex(0);
  setShowAnswer(false);
  setFeedback('');
}, [level, currentPhrase, createBlankPhrase]);
```

### Edit: 2025-11-09
- Files: `public/src/CurriculumPracticePage.js`
- Summary: Fixed flickering blanks by stabilizing random blank selection. Removed duplicate effect and tightened dependencies so random blanks are computed only when the phrase (by id) or Level changes.
- Rationale: Blanks were changing continuously due to an effect depending on a function that changed when state updated, causing a re-render loop.
- Code refs:
```125:141:public/src/CurriculumPracticePage.js
useEffect(() => {
  if (!currentPhrase) return;
  // recompute random blank indices and reset inputs
}, [level, currentPhrase && currentPhrase.id, getCandidateBlankIndices]);
```

### Edit: 2025-11-09
- Files: `public/src/AudioLearningPage.js`
- Summary: Show the currently selected set's words by default for Hands‑free Level 1, remove "Random set each start" option, and load learning words on mount to enable the preview.
- Rationale: Requested to always display which words are in the chosen set before starting playback and to simplify the UI by removing random set selection.
- Code refs:
```71:76:public/src/AudioLearningPage.js
const totalSetsHF = React.useMemo(() => {
  const n = Array.isArray(learningWords) ? learningWords.length : 0;
  return Math.max(1, Math.ceil(n / 20));
}, [learningWords]);
```
```87:96:public/src/AudioLearningPage.js
const selectedSetWords = React.useMemo(() => {
  const words = Array.isArray(learningWords) ? learningWords : [];
  if (words.length === 0) return [];
  const total = Math.max(1, Math.ceil(words.length / 20));
  const idx = Math.min(Math.max(1, Number(setIndex) || 1), total);
  const start = (idx - 1) * 20;
  return words.slice(start, Math.min(start + 20, words.length));
}, [learningWords, setIndex]);
```
```915:921:public/src/AudioLearningPage.js
const chosenIndex = Math.min(Math.max(1, setIndex), totalSets);
```
```1103:1141:public/src/AudioLearningPage.js
// Removed the Random set checkbox UI
```
```1198:1212:public/src/AudioLearningPage.js
// New "Selected set (up to 20)" preview rendering using selectedSetWords
```

### Edit: 2025-11-09
- Files: `public/src/AudioLearningPage.js`
- Summary: Fixed "Cannot access 'ensureLearningWords' before initialization" by moving the auto‑load effect below the `ensureLearningWords` definition and removing a stale dependency (`randomizeSet`) from `handleStartQuizLoop`.
- Rationale: The early effect referenced `ensureLearningWords` before its const initialization (TDZ). Also removed a dependency on a deleted state variable to prevent runtime reference errors.
- Code refs:
```76:81:public/src/AudioLearningPage.js
// removed early effect that referenced ensureLearningWords before init
```
```447:453:public/src/AudioLearningPage.js
// Load learning words on mount (now placed after ensureLearningWords)
React.useEffect(() => {
  (async () => { try { await ensureLearningWords(); } catch (_) {} })();
}, [ensureLearningWords]);
```
```1084:1084:public/src/AudioLearningPage.js
// Removed randomizeSet from dependency array of handleStartQuizLoop
```

### Edit: 2025-11-09
- Files: `public/src/AudioLearningPage.js`
- Summary: Added a Level 2 verbs workflow that chooses today/yesterday/tomorrow and conjugates a random learning verb correctly with the selected pronoun and date modifier. Falls back to previous Level 2 builders if needed.
- Rationale: Requested sentences like "오늘 나는 …해요", "어제 그는 …했어요", "내일 우리는 …할 거예요" built from the learning verb pool with appropriate English tense and Korean polite forms.
- Code refs:
```235:258:public/src/AudioLearningPage.js
const buildVerbWithDateSentence = React.useCallback((words) => {
  const p = pickRandomPronoun();
  const v = pickRandomVerb(words);
  if (!v) return null;
  const verbKoBase = String(v.korean || '');
  const verbEnBase = String(v.english || '').replace(/^to\s+/i, '').split(/[;,]/)[0].trim() || 'do';
  const choices = [
    { ko: '오늘', en: 'today', tense: 'present' },
    { ko: '어제', en: 'yesterday', tense: 'past' },
    { ko: '내일', en: 'tomorrow', tense: 'future' },
  ];
  const mod = choices[Math.floor(Math.random() * choices.length)];
  const koVerb = conjugateVerbSimple(verbKoBase, mod.tense);
  let enVerb = '';
  if (mod.tense === 'present') enVerb = /^(he|she|it)$/i.test(p.en) ? englishPresent3rd(verbEnBase) : verbEnBase;
  else if (mod.tense === 'past') enVerb = englishPast(verbEnBase);
  else enVerb = `will ${verbEnBase}`;
  const korean = `${mod.ko} ${p.ko} ${koVerb}`.trim();
  const english = `${p.en} ${enVerb} ${mod.en}`.trim();
  return { english, korean };
}, [pickRandomPronoun, pickRandomVerb, conjugateVerbSimple, englishPresent3rd, englishPast]);
```
```533:556:public/src/AudioLearningPage.js
if (difficulty === 2) {
  const words = await ensureLearningWords();
  if (!words || words.length === 0) return null;
  const primary = buildVerbWithDateSentence(words);
  if (primary && primary.english && primary.korean) return primary;
  // fallback to prior builders (pronoun+verb or noun+adjective)...
}
```

### Edit: 2025-11-09
- Files: `public/src/AudioLearningPage.js`
- Summary: Added a fixed set of 5 learning words for Level 2. These are displayed in the UI and used as the primary pool for Level 2 sentence generation; falls back to the full learning list if the 5 don't contain a verb.
- Rationale: Requested to "make a set of 5 words for level 2" and use them consistently for the Level 2 workflow.
- Code refs:
```78:88:public/src/AudioLearningPage.js
const [level2Words, setLevel2Words] = React.useState([]);
React.useEffect(() => {
  const words = Array.isArray(learningWords) ? learningWords : [];
  if (words.length > 0) {
    setLevel2Words(words.slice(0, Math.min(5, words.length)));
  } else {
    setLevel2Words([]);
  }
}, [learningWords]);
```
```539:551:public/src/AudioLearningPage.js
const all = await ensureLearningWords();
const pool = (Array.isArray(level2Words) && level2Words.length > 0) ? level2Words : all;
const hasVerbIn = (arr) => Array.isArray(arr) && arr.some(w => { ... });
const words = hasVerbIn(pool) ? pool : all;
```
```1214:1228:public/src/AudioLearningPage.js
{quizMode === 'hands-free' && quizDifficulty === 2 && level2Words && level2Words.length > 0 && (
  <div>/* Selected words (Level 2, up to 5) list */</div>
)}
```

### Edit: 2025-11-09
- Files: `public/src/AudioLearningPage.js`
- Summary: Level 2 (hands‑free) now generates exactly 5 sentences when Start is pressed, displays them, and loops through the batch repeatedly instead of generating continuously.
- Rationale: User requested a fixed set of 5 sentences for Level 2 and to loop them for practice.
- Code refs:
```946:1001:public/src/AudioLearningPage.js
if (level === 2) {
  const batch = [];
  for (let i = 0; i < 5; i++) {
    const s = await generateQuizSentence(2);
    if (s && s.english && s.korean) batch.push({ english: String(s.english), korean: String(s.korean) });
  }
  if (batch.length === 0) { /* fallback continuous */ } else {
    setGeneratedSentences(batch.slice(0).reverse());
    let idx = 0;
    while (playingRef.current && quizLoopRef.current) {
      const sent = batch[idx % batch.length];
      idx++;
      /* speak EN then KO with pauses */
    }
  }
} else { /* Level 3 continuous */ }
```

### Edit: 2025-11-09
- Files: `public/src/AudioLearningPage.js`
- Summary: Merged Pause/Resume into a single toggle button; wired to both loop-based playback and custom flows via `pausedRef` and a new `isPaused` state.
- Rationale: Simplify controls; ensure consistent pause/resume behavior across modes.
- Code refs:
```52:54:public/src/AudioLearningPage.js
const [isPaused, setIsPaused] = React.useState(false);
```
```968:976:public/src/AudioLearningPage.js
pausedRef.current = false;
setIsPaused(false);
```
```701:707:public/src/AudioLearningPage.js
pausedRef.current = false;
setIsPaused(false);
```
```1289:1298:public/src/AudioLearningPage.js
<button className="audio-btn" onClick={() => {
  if (isPaused) { resumeLoop(); pausedRef.current = false; setIsPaused(false); }
  else { pauseLoop(); pausedRef.current = true; setIsPaused(true); }
}}>
  {isPaused ? 'Resume' : 'Pause'}
</button>
```

### Edit: 2025-11-09
- Files: `public/src/AudioLearningPage.js`
- Summary: Combined Start/Stop into a single toggle button; Pause/Resume now display icon-only (⏸/▶️) with accessible titles.
- Rationale: Requested unified Start/Stop button and icon-based Pause/Resume for a cleaner UI.
- Code refs:
```1289:1310:public/src/AudioLearningPage.js
<button
  className="audio-btn"
  onClick={() => { if (isQuizLooping) { stopAll(); } else { if (!isLoadingLearningWords) handleStartQuizLoop(); } }}
  title={isQuizLooping ? 'Stop' : 'Start'}
  aria-label={isQuizLooping ? 'Stop' : 'Start'}
>
  {isQuizLooping ? 'Stop' : 'Start'}
</button>
```
```1310:1322:public/src/AudioLearningPage.js
<button className="audio-btn" onClick={...} title={isPaused ? 'Resume' : 'Pause'} aria-label={isPaused ? 'Resume' : 'Pause'}>
  {isPaused ? '▶️' : '⏸'}
</button>
```
### Edit: 2025-11-09
- Files: `public/src/AudioLearningPage.js`
- Summary: Switched Level 2 sentence generation to use an API AI call (Chat) that takes learning verbs and constructs a pronoun + date-modifier + correctly conjugated verb sentence. Falls back to local builders on failure.
- Rationale: Requested to use AI for Level 2 sentence creation rather than manual construction.
- Code refs:
```573:625:public/src/AudioLearningPage.js
if (difficulty === 2) {
  const verbs = /* pick learning verbs */;
  const prompt = `Return ONLY JSON: {"korean":"...","english":"..."}...`;
  const res = await api.chat(prompt);
  /* parse and return */
  /* fallback to buildVerbWithDateSentence / prior builders */
}
```
### Edit: 2025-11-08
- Files: `public/src/Navbar.js`, `public/src/Navbar.css`
- Summary: Replaced JS-toggled dropdown with a native details/summary-based dropdown for reliable mobile behavior; added CSS to hide the default marker and show the menu when open.
- Rationale: Despite JS event handling improvements, some mobile browsers still didn't open the dropdown reliably. Using a native `details` element provides consistent tap behavior and accessibility without complex event juggling.
- Code refs:
```155:169:public/src/Navbar.js
          <li className="nav-item nav-item-dropdown">
            <details className="nav-details">
              <summary className="nav-link">...</summary>
              <div className="dropdown-menu">
                <Link to="/journal" className="dropdown-item">Journal</Link>
                <Link to="/journal-entries" className="dropdown-item">Journal Entries</Link>
                <Link to="/stats" className="dropdown-item">Stats</Link>
                <Link to="/pronunciation" className="dropdown-item">Pronunciation</Link>
                <Link to="/chat" className="dropdown-item">Chat</Link>
                <Link to="/lexicon-add" className="dropdown-item">Add to Lexicon</Link>
              </div>
            </details>
          </li>
```
```101:120:public/src/Navbar.css
/* details/summary based dropdown (mobile-friendly) */
.nav-details {
  position: relative;
}
.nav-details > summary {
  list-style: none;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
}
.nav-details > summary::-webkit-details-marker {
  display: none;
}
.nav-details[open] .dropdown-menu {
  display: block;
}
```

### Edit: 2025-11-08
- Files: `public/src/Navbar.js`, `public/src/Navbar.css`
- Summary: Changed mobile "..." behavior to expand the navbar inline to show all tabs (no dropdown). Added `navExpanded` state and CSS to allow wrapping and reveal desktop-only items while expanded; button toggles between "..." and "Less".
- Rationale: Requested that tapping "..." should simply show all navigation items within the bar on mobile instead of opening a dropdown.
- Code refs:
```120:128:public/src/Navbar.js
        <ul className={`navbar-nav${navExpanded ? ' nav-expanded' : ''}`}>
```
```21:27:public/src/Navbar.js
  const [navExpanded, setNavExpanded] = React.useState(false);
```
```144:155:public/src/Navbar.js
          <li className="nav-item nav-item-dropdown">
            <button
              type="button"
              className="nav-link"
              onClick={() => setNavExpanded(v => !v)}
              aria-expanded={navExpanded ? 'true' : 'false'}
              aria-label={navExpanded ? 'Show fewer navigation items' : 'Show all navigation items'}
            >
              {navExpanded ? 'Less' : '...'}
            </button>
          </li>
```
```167:178:public/src/Navbar.css
  .navbar-nav.nav-expanded {
    flex-wrap: wrap !important;
    overflow-x: visible !important;
  }
  .navbar-nav.nav-expanded .nav-item-desktop {
    display: block !important;
  }
```
### Edit: 2025-11-10
- Files: `public/manifest.json`
- Summary: Enabled deep-link capture and PWA launch behavior on Android with `launch_handler`, `capture_links`, and `url_handlers` (origin `https://neonleon.ca`). Deep links now open directly inside the installed PWA and reuse the existing app instance.
- Rationale: Provide reliable 1‑tap shortcuts per route that don't fall back to the browser root; improves UX for Android home screen shortcuts and app shortcuts.
- Code refs:
```24:40:public/manifest.json
"start_url": "/",
"display": "standalone",
"theme_color": "#1976d2",
"background_color": "#ffffff",
"orientation": "portrait-primary",
"scope": "/",
"categories": ["education", "lifestyle"],
"prefer_related_applications": false,
"display_override": ["window-controls-overlay", "standalone", "minimal-ui"],
"screenshots": [],
"launch_handler": { "client_mode": "navigate-existing" },
"capture_links": "existing-client-navigate",
"url_handlers": [{ "origin": "https://neonleon.ca" }],
```

### Edit: 2025-11-10
- Files: `public/manifest.json`
- Summary: Added `id: "/"` for a stable PWA identity and added a shortcut for the K‑pop Lyrics page (`/kpop-lyrics`) so Brave shortcuts can launch directly into that route.
- Rationale: `id` helps Android identify updates to the same app; the new shortcut exposes the K‑pop feature from the home screen.
- Code refs:
```1:110:public/manifest.json
"id": "/",
...
{ "name": "K‑pop Lyrics", "short_name": "K‑pop", "url": "/kpop-lyrics", ... }
```
### Edit: 2025-11-13
- Files: `public/src/CurriculumPracticePage.js`
- Summary: Avoid selecting proper nouns for blanks by tagging tokens with coarse POS for the current 5‑phrase set and filtering out indices typed as "proper noun"; also sorted curriculum phrases by earliest added so the first set contains the oldest five.
- Rationale: Improve practice quality by not hiding names/proper nouns; ensure session paging reflects date-added order.
- Code refs:
```67:85:public/src/CurriculumPracticePage.js
  // Build a list of candidate indices to blank, preferring to skip common particles and proper nouns
  const getCandidateBlankIndices = useCallback((words, types) => {
    if (!Array.isArray(words) || words.length === 0) return [];
    const particleSet = new Set([
      '은','는','이','가','을','를','에','에서','에게','께','한테','으로','로','과','와','도','만','까지','부터','보다','처럼','같이','하고'
    ]);
    const candidates = [];
    for (let i = 0; i < words.length; i++) {
      const w = String(words[i] || '').trim();
      if (!w) continue;
      if (particleSet.has(w)) continue;
      const t = Array.isArray(types) && types.length === words.length ? String(types[i] || '').toLowerCase() : '';
      if (t && (t.includes('proper') || t.includes('proper noun'))) continue;
      candidates.push(i);
    }
    return candidates;
  }, []);
```
```140:161:public/src/CurriculumPracticePage.js
  useEffect(() => {
    if (!currentPhrase) return;
    const words = String(currentPhrase.korean_text || '').trim().split(' ').filter(w => w);
    const desired = Math.max(1, Math.min(3, Number(level) || 1));
    const types = (currentPhrase && wordTypesByPhraseId && wordTypesByPhraseId[currentPhrase.id]) || null;
    const candidates = getCandidateBlankIndices(words, types);
    ...
  }, [level, currentPhrase && currentPhrase.id, getCandidateBlankIndices, wordTypesByPhraseId]);
```
```286:331:public/src/CurriculumPracticePage.js
  // Load all curriculum phrases on mount
  const loadAllPhrases = useCallback(async () => {
    ...
    // Sort by earliest added first (created_at/date_added ascending; fallback to numeric id)
    const list = [...listRaw].sort((a, b) => { /* ta - tb; id fallback */ });
    setAllPhrases(list);
    ...
  }, []);
```
```333:357:public/src/CurriculumPracticePage.js
  // Lightweight POS tagging for current session phrases (cache per phrase id)
  const tagPhraseWordTypes = useCallback(async (phrase) => {
    const prompt = `Return ONLY JSON with this format: {"tokens":["..."],"types":["..."]} ...`
    const res = await api.chat(prompt);
    ...
    return types;
  }, []);
```
```359:379:public/src/CurriculumPracticePage.js
  useEffect(() => {
    // On session set change, fetch missing POS tags for up to 5 phrases and cache
    ...
    setWordTypesByPhraseId(prev => ({ ...prev, ...updates }));
  }, [sessionPhrases, tagPhraseWordTypes]);
```
```

### Edit: 2025-11-13
- Files: `backend/database.js`, `backend/curriculum.js`, `backend/pos.js`, `public/src/CurriculumPracticePage.js`
- Summary: Added numeric POS enum storage. New column `word_type_codes_json` on `curriculum_phrases` stores per-token POS codes; still stores raw `word_types_json`. Backend derives codes from strings if not provided; API now accepts/returns `word_type_codes`. Client persists both strings and codes.
- Rationale: Reduce storage size and standardize POS categories with a fixed enum while preserving original tags.
- Code refs (optional):
```1:90:backend/pos.js
// normalizeTypeToCode(), codeToType(), POS_CODE map (0 other, 1 pronoun, 2 noun, 3 proper_noun, 4 verb, 5 adjective, 6 adverb, 7 particle, 8 numeral, 9 determiner, 10 interjection)
```
```454:499:backend/database.js
SELECT ... word_types_json, word_type_codes_json ...
return { ..., word_types: JSON.parse(row.word_types_json), word_type_codes: JSON.parse(row.word_type_codes_json) }
```
```552:629:backend/database.js
addCurriculumPhrase(..., wordTypes, wordTypeCodes) {
  ALTER TABLE ADD COLUMN word_types_json, word_type_codes_json (if missing);
  derive codes via normalizeTypeToCode when explicit codes missing;
  INSERT includes both JSON columns when available.
}
```
```635:715:backend/database.js
updateCurriculumPhrase(..., wordTypes, wordTypeCodes) { /* ensures columns, derives codes, updates both */ }
```
```34:55:backend/curriculum.js
handleAddCurriculumPhrase/handleUpdateCurriculumPhrase accept `word_types` and `word_type_codes` and pass both to database methods.
```
```333:379:public/src/CurriculumPracticePage.js
// Persist tags: send `word_types` and derived `word_type_codes` via small mapper mirroring backend enum.
```

### Edit: 2025-01-27
- Files: `backend/database.js`, `backend/curriculum.js`
- Summary: Fixed 500 error in `getRandomCurriculumPhrase` by adding database initialization checks, improving error handling with try-catch around JSON parsing, and ensuring proper database connection cleanup in the handler. Added null checks and safe JSON parsing with fallbacks for all JSON fields.
- Rationale: The endpoint was returning 500 errors when fetching random curriculum phrases. The issue was caused by missing database initialization checks, unsafe JSON parsing that could fail on invalid data, and improper error handling. These fixes ensure the method gracefully handles edge cases and provides better error messages.
- Code refs:
```505:616:backend/database.js
async getRandomCurriculumPhrase() {
  // Added database initialization check
  if (!this.db) {
    return reject(new Error('Database not initialized'));
  }
  // Added error logging and safe JSON parsing with try-catch blocks
  // Added null filtering for blank indices, correct answers, and word types
  // Wrapped all JSON.parse calls in try-catch with fallbacks
}
```
```17:45:backend/curriculum.js
async function handleGetRandomCurriculumPhrase(req, res) {
  let db = null;
  try {
    // ... existing code ...
  } catch (error) {
    // Added proper database cleanup in error handler
    if (db) {
      try {
        await db.close();
      } catch (closeError) {
        console.error('Error closing database:', closeError);
      }
    }
    // Added development mode error details
    res.status(500).json({ 
      error: 'Failed to fetch random curriculum phrase',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    });
  }
}
```

### Edit: 2025-01-27
- Files: `backend/database.js`
- Summary: Switched to enum-based word type system. Added automatic migration to add `word_types_json` and `word_type_codes_json` columns if missing. Updated `getRandomCurriculumPhrase` and `getAllCurriculumPhrases` to use `word_type_codes_json` (enum codes) as primary source, with `word_types_json` (string types) as fallback. Methods now convert between codes and types using `normalizeTypeToCode` and `codeToType` from `pos.js`. Removed word_types/word_type_codes from main SELECT queries and fetch them separately to handle missing columns gracefully.
- Rationale: The database was missing `word_types_json` and `word_type_codes_json` columns, causing SQL errors. Switched to enum system (numeric codes) as primary storage format for better performance and consistency, while maintaining backward compatibility with string types. Migration logic ensures existing databases are upgraded automatically.
- Code refs:
```455:606:backend/database.js
async getAllCurriculumPhrases() {
  // Added migration to add word_types_json and word_type_codes_json columns
  // Removed these columns from main SELECT query
  // Fetch codes separately (primary), fallback to types, convert between them
  // Use normalizeTypeToCode and codeToType from pos.js
}
```
```608:720:backend/database.js
async getRandomCurriculumPhrase() {
  // Same migration and enum-based approach as getAllCurriculumPhrases
  // Prefer word_type_codes_json (enum), convert to word_types for compatibility
}
```

### Edit: 2025-01-27
- Files: `backend/tts.js`, `backend/server.js`, `public/src/AudioLearningPage.js`
- Summary: Added Level 3 audio generation that creates a single MP3 file for all 5 sentences. Each sentence follows the sequence: English sentence → (word1 EN, word1 KO, word2 EN, word2 KO, ...) → full Korean sentence. The audio loops automatically. New endpoint `/api/tts/level3` accepts sentences with wordPairs and generates combined audio. Frontend Level 3 now generates word pairs for all sentences, creates one audio file, and plays it in a continuous loop with pause/resume support.
- Rationale: Requested that Level 3 use one audio file for all 5 sentences played sequentially, with word-by-word breakdown (EN then KO per word) after each English sentence, followed by the full Korean sentence. The audio should loop continuously.
- Code refs:
```347:454:backend/tts.js
async function handleTTSLevel3(req, res) {
  // Accepts sentences array with wordPairs
  // For each sentence: EN sentence → (word1 EN, word1 KO, word2 EN, word2 KO, ...) → full KO sentence
  // Combines all into one MP3 file
}
```
```98:98:backend/server.js
app.post('/api/tts/level3', handleTTSLevel3);
```
```1356:1428:public/src/AudioLearningPage.js
// Level 3: Generate word pairs for all 5 sentences, create single audio file, play in loop
// Uses /api/tts/level3 endpoint
```
```760:847:public/src/AudioLearningPage.js
// handlePlayCurrentConversation: Updated to use Level 3 audio generation when level === 3
```
```678:735:public/src/AudioLearningPage.js
// playConversationAudio: Set audio.loop = true for continuous looping
```

### Edit: 2025-01-27
- Files: `public/src/AudioLearningPage.js`
- Summary: Added loading bar for Level 3 audio generation. Shows progress from 0-100% while generating word pairs (10-50%) and creating the audio file (60-100%). Displays "Generating Level 3 audio: X%" with a green progress bar.
- Rationale: Requested visual feedback during audio generation since it can take time to generate word pairs and combine all audio segments into one file.
- Code refs:
```81:82:public/src/AudioLearningPage.js
const [isGeneratingLevel3Audio, setIsGeneratingLevel3Audio] = React.useState(false);
const [level3AudioProgress, setLevel3AudioProgress] = React.useState(0);
```
```1430:1500:public/src/AudioLearningPage.js
// Level 3 generation: Set progress at 10% (start), 10-50% (word pairs), 60% (audio gen start), 80% (fetch complete), 100% (done)
// Show loading bar with percentage
```
```1824:1833:public/src/AudioLearningPage.js
{isGeneratingLevel3Audio && (
  <div style={{ marginTop: 8 }}>
    <div style={{ height: 8, background: '#eee', borderRadius: 6, overflow: 'hidden' }}>
      <div style={{ width: `${level3AudioProgress}%`, height: 8, background: '#4caf50', transition: 'width 0.2s' }} />
    </div>
    <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
      Generating Level 3 audio: {Math.round(level3AudioProgress)}%
    </div>
  </div>
)}
```

### Edit: 2025-01-27
- Files: `public/src/styles/Navbar.css`, `public/src/styles/App.css`, `public/src/Navbar.js`
- Summary: Moved bottom bar to left side as a fixed sidebar. Changed positioning from `bottom: 0` to `left: 0, top: 0, bottom: 0` with fixed width of 200px. Updated layout to vertical (flex-direction: column) and added left padding to body (200px) to prevent content overlap. On mobile (max-width: 768px), sidebar reverts to bottom bar with horizontal layout.
- Rationale: Requested to move the bottom bar to the left side instead of bottom for better space utilization and different layout preference.
- Code refs:
```135:154:public/src/styles/Navbar.css
.bottom-bar {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: 200px;
  border-right: 1px solid #eee;
  // Vertical layout
}
```
```2:6:public/src/styles/App.css
body {
  padding-left: 200px; /* Account for left sidebar */
}
```
```1:10:public/src/styles/Navbar.css
.navbar {
  margin-left: 200px; /* Account for left sidebar */
}
```
```246:261:public/src/Navbar.js
// Updated bottom-bar-inner to use vertical layout with flex-direction: column
```

### Edit: 2025-01-27
- Files: `backend/tts.js`, `public/src/AudioLearningPage.js`
- Summary: Fixed silence buffer download failure by creating a shared `getSilenceBufferOneSecond()` function with multiple fallback URLs and a TTS-based fallback. Improved error handling in frontend to display error messages when audio generation fails. The function tries multiple silence file sources and falls back to generating minimal audio via Google TTS if all downloads fail.
- Rationale: The original silence file URL was returning 404 errors, causing audio generation to fail silently. Users reported no audio playing when clicking start. This fix ensures silence buffers are available (or gracefully skipped) and errors are properly displayed to users.
- Code refs:
```27:91:backend/tts.js
// Shared getSilenceBufferOneSecond() with multiple fallback URLs and TTS fallback
```
```1508:1532:public/src/AudioLearningPage.js
// Improved error handling: catch and display errors from API responses
```
```820:856:public/src/AudioLearningPage.js
// Improved error handling in handlePlayCurrentConversation for Level 3
```

### Edit: 2025-01-27
- Files: `public/src/AudioLearningPage.js`
- Summary: Integrated "Play Audio" button functionality into the Start/Stop button. When clicking Start in Level 3 hands-free mode, if audio is already generated (`conversationAudioUrl` exists), it will immediately play the existing audio instead of regenerating. This provides a faster way to replay audio without regenerating.
- Rationale: Requested to combine the Play Audio button functionality with the Start/Stop button for better UX - users can start/play audio with a single button.
- Code refs:
```1756:1806:public/src/AudioLearningPage.js
// Start button: Check if conversationAudioUrl exists first, if so play it directly; otherwise generate new audio
// For Level 3 hands-free mode, plays existing audio if available, otherwise calls handlePlayCurrentConversation()
```

### Edit: 2025-01-27
- Files: `backend/tts.js`
- Summary: Added punctuation removal from all text before sending to TTS. Created `removePunctuation()` helper function that strips common punctuation marks (.,!?;:"'()-[]{} and Korean equivalents) while preserving spaces. Applied to all TTS requests: single TTS, batch TTS, conversation TTS, and Level 3 TTS.
- Rationale: Requested to exclude punctuation from generated audio to avoid TTS reading punctuation marks aloud, which can sound unnatural.
- Code refs:
```13:18:backend/tts.js
// removePunctuation() function: removes common punctuation while preserving spaces
```
```107:108:backend/tts.js
// Applied to single TTS: const cleanText = removePunctuation(text);
```
```192:193:backend/tts.js
// Applied to batch TTS prompt: const cleanEnglish = removePunctuation(english);
```
```229:230:backend/tts.js
// Applied to batch TTS Korean: const cleanKorean = removePunctuation(korean);
```
```314:316:backend/tts.js
// Applied to conversation TTS: const cleanText = removePunctuation(text);
```
```402:404:backend/tts.js
// Applied to Level 3 TTS: const cleanText = removePunctuation(text);
```

### Edit: 2025-01-27
- Files: `public/src/AudioLearningPage.js`
- Summary: Ensured audio automatically starts playing after generation completes. Updated `generateConversationAudio` to return the audio URL so it can be awaited, and ensured `playConversationAudio` is called immediately after generation completes. This ensures that when Start is pressed, audio is generated and then automatically starts playing without requiring a separate button click.
- Rationale: Requested that after pressing Start, the audio should be generated and then automatically start playing once ready, rather than requiring a separate play action.
- Code refs:
```654:678:public/src/AudioLearningPage.js
// generateConversationAudio: Now returns the audio URL so it can be awaited and auto-played
```
```861:868:public/src/AudioLearningPage.js
// handlePlayCurrentConversation: Auto-plays audio immediately after generation completes
```
```683:701:public/src/AudioLearningPage.js
// playConversationAudio: Updated to accept optional audioUrl parameter for immediate playback without waiting for state update
```
```841:841:public/src/AudioLearningPage.js
// Level 3 in handleStartQuizLoop: Passes audioUrl directly to playConversationAudio for immediate playback
```
```1531:1531:public/src/AudioLearningPage.js
// Level 3 in handlePlayCurrentConversation: Passes audioUrl directly to playConversationAudio for immediate playback
```

### Edit: 2025-01-27
- Files: `backend/tts.js`
- Summary: Updated punctuation handling to keep punctuation for full sentences but remove it for individual words. Modified `fetchTts` in Level 3 handler to accept a `removePunct` parameter. Full sentences (English and Korean) keep punctuation for natural intonation, while individual words in word-by-word explanations have punctuation removed. Also updated conversation TTS and single TTS to keep punctuation for full sentences.
- Rationale: Requested to keep punctuation when entire sentences are spoken (for natural pauses and intonation) but remove it when individual words are explained one by one (to avoid TTS reading punctuation marks aloud).
- Code refs:
```416:426:backend/tts.js
// fetchTts in Level 3: Accepts removePunct parameter - false for full sentences, true for individual words
```
```429:450:backend/tts.js
// Level 3 processing: Full sentences keep punctuation (false), word pairs remove punctuation (true)
```
```325:335:backend/tts.js
// Conversation TTS: Updated to keep punctuation for full sentences
```
```115:117:backend/tts.js
// Single TTS: Updated to keep punctuation for full sentences
```

### Edit: 2025-01-27
- Files: `public/src/Navbar.js`, `public/src/styles/Navbar.css`, `public/src/styles/App.css`
- Summary: Removed Info button from navbar. Reduced sidebar width from 200px to 150px (140px on mobile). Updated all related margins and padding to match the new width.
- Rationale: Requested to remove the Info button and make the sidebar narrower for a more compact layout.
- Code refs:
```223:231:public/src/Navbar.js
// Removed Info button, kept only Settings button
```
```135:146:public/src/styles/Navbar.css
// .bottom-bar: width changed from 200px to 150px, padding reduced to 0.75rem
```
```9:11:public/src/styles/App.css
// body padding-left: changed from 200px to 150px
```
```10:10:public/src/styles/Navbar.css
// .navbar margin-left: changed from 200px to 150px
```
```234:234:public/src/Navbar.js
// Status banner marginLeft: changed from 200px to 150px
```
```239:239:public/src/Navbar.js
// Status banner marginLeft: changed from 200px to 150px
```

### Edit: 2025-01-27
- Files: `public/src/AudioLearningPage.js`
- Summary: Added audio URL storage to saved conversations. When saving a conversation, the current `conversationAudioUrl` is now included in the saved entry. When loading a conversation, the saved audio URL is restored. Updated "Generate Audio" button to check for existing audio and show "Use Saved Audio" if available. Updated download button to use saved audio URL when available.
- Rationale: Requested to save audio URLs with conversations so that generated audio persists with each conversation and doesn't need to be regenerated.
- Code refs:
```627:651:public/src/AudioLearningPage.js
// saveConversationSet: Now includes audioUrl in saved entry
```
```2014:2031:public/src/AudioLearningPage.js
// Load button: Restores saved audioUrl when loading conversation
// Generate Audio button: Checks for existing audioUrl, updates saved conversation with new URL
// Download button: Uses saved audioUrl or current conversationAudioUrl
```
```113:126:public/src/AudioLearningPage.js
// Auto-load: Also restores audioUrl when auto-loading first conversation
```
```90:97:public/src/AudioLearningPage.js
// fetchServerConversations: Normalizes audioUrl from server response (audio_url or audioUrl)
```

### Edit: 2025-01-27
- Files: `public/src/AudioLearningPage.js`
- Summary: Added default conversation selection feature. Users can set which conversation loads by default on startup. Added "Set Default" button for each conversation with visual indicator (★). Auto-load now loads the default conversation instead of always the first one. Audio is now automatically generated when loading a conversation if it doesn't already exist.
- Rationale: Requested to allow users to choose which conversation loads by default, and to ensure audio is always generated when loading conversations so it's ready to play.
- Code refs:
```71:77:public/src/AudioLearningPage.js
// Added defaultConversationId state and setDefaultConversation function with localStorage persistence
```
```114:140:public/src/AudioLearningPage.js
// Auto-load: Now loads default conversation (or first if none set), auto-generates audio if missing
```
```2026:2048:public/src/AudioLearningPage.js
// Load button: Auto-generates audio if not available when loading conversation
// Set Default button: Allows setting/unsetting default conversation with visual indicator
```
```2022:2025:public/src/AudioLearningPage.js
// Conversation title display: Shows ★ indicator for default conversation
```
```127:172:public/src/AudioLearningPage.js
// Auto-load effect: Clears default if conversation deleted, loads default (or first), auto-generates audio if missing
```
```2125:2133:public/src/AudioLearningPage.js
// Delete button: Clears default conversation ID if the deleted conversation was the default
```

### Edit: 2025-01-27
- Files: `public/src/AudioLearningPage.js`
- Summary: Fixed hoisting error by moving `generateConversationAudio` function definition before the `useEffect` that uses it. The function was being referenced in the dependency array before it was defined, causing "Cannot access 'generateConversationAudio' before initialization" error.
- Rationale: JavaScript hoisting issue - React hooks need to be defined before they're used in other hooks' dependency arrays.
- Code refs:
```126:160:public/src/AudioLearningPage.js
// Moved generateConversationAudio definition before the useEffect that uses it
```

### Edit: 2025-01-27
- Files: `public/src/AudioLearningPage.js`
- Summary: Added optional input fields for Korean and English example sentences to guide conversation generation. Users can now enter context sentences that influence the topic, vocabulary, and style of the generated 5-sentence conversation.
- Rationale: Allows users to customize conversation generation by providing example sentences that guide the AI to create contextually related conversations.
- Code refs:
```96:98:public/src/AudioLearningPage.js
// Added state for conversation context input
```
```952:978:public/src/AudioLearningPage.js
// Modified generateConversationSet to accept and use context sentences in prompt
```
```821:829:public/src/AudioLearningPage.js
// Updated handleGenerateNewConversation to pass context to generateConversationSet
```
```1894:1930:public/src/AudioLearningPage.js
// Added UI input fields for Korean and English context sentences above "New Conversation" button
```

### Edit: 2025-01-27
- Files: `public/src/TranslationBox.js`
- Summary: Added a sound icon button (🔊) next to the "Response:" label that plays the translated text using text-to-speech. The button only appears when there is translated text available.
- Rationale: Allows users to hear the pronunciation of translated Korean text, improving learning and comprehension.
- Code refs:
```3:3:public/src/TranslationBox.js
// Imported speakToAudio from audioTTS
```
```100:108:public/src/TranslationBox.js
// Added handlePlaySound function to play translated text using TTS
```
```133:160:public/src/TranslationBox.js
// Added sound icon button in response box header, conditionally rendered when translatedValue exists
```

### Edit: 2025-01-27
- Files: `public/src/AudioLearningPage.js`, `public/src/TranslationBox.js`
- Summary: Fixed hoisting error by moving `generateConversationSet` function definition before `handleGenerateNewConversation`. Added an "Enter" button to TranslationBox component that triggers translation, in addition to the existing Enter key functionality.
- Rationale: JavaScript hoisting issue - `generateConversationSet` was being referenced before initialization. Added Enter button for better UX, allowing users to click a button instead of only using keyboard.
- Code refs:
```820:873:public/src/AudioLearningPage.js
// Moved generateConversationSet definition before handleGenerateNewConversation to fix hoisting error
```
```1004:1004:public/src/AudioLearningPage.js
// Added generateConversationSet to dependency array of handlePlayCurrentConversation
```
```47:87:public/src/TranslationBox.js
// Extracted translation logic into performTranslation function, callable from both Enter key and button
```
```119:169:public/src/TranslationBox.js
// Added Enter button next to input field with styling and hover effects
```

### Edit: 2025-01-27
- Files: `public/src/AudioLearningPage.js`
- Summary: Fixed syntax errors in fallback seed conversation strings by changing single quotes to double quotes for English strings containing apostrophes (e.g., "let's", "I'll", "I'm").
- Rationale: Single-quoted strings containing apostrophes cause JavaScript syntax errors. Using double quotes for strings with apostrophes prevents string termination issues.
- Code refs:
```1082:1087:public/src/AudioLearningPage.js
// Changed English strings with apostrophes from single quotes to double quotes
```

### Edit: 2025-01-27
- Files: `public/src/AudioLearningPage.js`
- Summary: Moved "New Conversation" section (context input fields and generate button) to be above the "Saved Conversations" panel in the right column. Removed redundant "Generate One Audio (EN→KO)" and "Play Audio" buttons from the generated sentences section, and removed "Generate Audio" / "Use Saved Audio" button from saved conversations. The Start button already handles both audio generation and playback.
- Rationale: Improved UI organization by grouping conversation generation controls together. Removed redundant buttons since Start/Pause buttons already handle all audio generation and playback functionality.
- Code refs:
```2066:2106:public/src/AudioLearningPage.js
// Moved New Conversation section to right column above Saved Conversations
```
```2029:2036:public/src/AudioLearningPage.js
// Removed Generate One Audio and Play Audio buttons, kept Download MP3
```
```2147:2161:public/src/AudioLearningPage.js
// Removed Generate Audio / Use Saved Audio button from saved conversations
```

### Edit: 2025-01-27
- Files: `public/src/AudioLearningPage.js`
- Summary: Removed the "My Conversation" title input field from the conversation save controls. Conversations are now always saved with a timestamp-based title (e.g., "Conversation 2025-01-27 14:30") and can be renamed later using the existing "Rename" button in the saved conversations list.
- Rationale: Simplifies the UI by removing an unnecessary input field, since users can rename conversations after saving them.
- Code refs:
```91:91:public/src/AudioLearningPage.js
// Removed conversationTitle state variable
```
```707:733:public/src/AudioLearningPage.js
// Updated saveConversationSet to always use timestamp-based title, removed conversationTitle dependency
```
```2012:2016:public/src/AudioLearningPage.js
// Removed title input field, kept only Save Conversation button
```

### Edit: 2025-01-27
- Files: `public/src/Navbar.js`, `public/src/styles/Navbar.css`, `public/src/styles/App.css`, `public/src/AudioLearningPage.js`
- Summary: Removed Settings button from top navbar (kept only in sidebar). Added mobile sidebar toggle button that shows/hides the sidebar. Sidebar is closed by default on mobile. Reversed sentence display order in AudioLearningPage so newest sentences appear at the top.
- Rationale: Simplifies top navbar by removing redundant Settings button. Improves mobile UX by allowing users to hide the sidebar to maximize screen space. Makes sentence display more intuitive by showing the most recently spoken sentences first.
- Code refs:
```43:43:public/src/Navbar.js
// Added sidebarVisible state (defaults to false)
```
```223:224:public/src/Navbar.js
// Removed nav-options div with Settings button
```
```238:247:public/src/Navbar.js
// Added sidebar toggle button and conditional classes
```
```150:180:public/src/styles/Navbar.css
// Added sidebar-toggle button styles (hidden on desktop)
```
```278:315:public/src/styles/Navbar.css
// Mobile styles: sidebar slides in/out, toggle button visible
```
```9:17:public/src/styles/App.css
// Added mobile media query to remove body padding when sidebar is hidden
```
```2003:2003:public/src/AudioLearningPage.js
// Reversed sentence array to show newest first
```

### Edit: 2025-01-27
- Files: `public/src/AudioLearningPage.js`, `public/src/api.js`
- Summary: Fixed delete conversation button to call server API for server-saved conversations. Removed Download MP3 button from the first panel (Generated Sentences section) since each saved conversation already has its own download button.
- Rationale: Delete button was only removing from local storage, not syncing with server. Removing redundant download button simplifies UI.
- Code refs:
```125:128:public/src/api.js
// Added deleteConversation API method
```
```2010:2017:public/src/AudioLearningPage.js
// Removed Download MP3 button and status text from first panel
```
```2146:2173:public/src/AudioLearningPage.js
// Updated delete button to call server API for numeric IDs, then sync with fetchServerConversations
```

### Edit: 2025-01-27
- Files: `public/src/KpopLyricsPage.js`
- Summary: Added default song loading (first song on page load), underlined Korean lyrics for visual distinction, italicized translations, and auto-translation when saving new songs. Replaced textarea with div-based display for better formatting control.
- Rationale: Improves UX by showing content immediately, makes lyrics vs translations visually distinct, and automates translation workflow for new songs.
- Code refs:
```15:25:public/src/KpopLyricsPage.js
// Initialize selectedId with first song if available
```
```68:115:public/src/KpopLyricsPage.js
// Updated saveEditor to auto-translate new songs line by line
```
```48:54:public/src/KpopLyricsPage.js
// Added useEffect to handle selected song deletion
```
```254:285:public/src/KpopLyricsPage.js
// Replaced textarea with div-based display: underlined Korean lyrics, italicized translations
```

### Edit: 2025-01-27
- Files: `public/src/CurriculumPracticePage.js`, `public/src/AudioLearningPage.js`, `public/src/KpopLyricsPage.js`
- Summary: Made all user settings persist to localStorage so they default to the last used value. Settings include: practice mode and blanks count (Practice page), quiz mode, difficulty level, delay/recording duration, set index (Audio Learning page), and show English toggle (K-pop Lyrics page).
- Rationale: Improves UX by remembering user preferences across sessions, reducing need to reconfigure settings each visit.
- Code refs:
```62:77:public/src/CurriculumPracticePage.js
// Initialize numBlanks and practiceMode from localStorage
```
```1511:1531:public/src/CurriculumPracticePage.js
// Save to localStorage on change for numBlanks and practiceMode
```
```31:87:public/src/AudioLearningPage.js
// Initialize quizMode, quizDelaySec, quizRecordDurationSec, quizDifficulty, setIndex from localStorage
```
```1786:1905:public/src/AudioLearningPage.js
// Save to localStorage on change for all audio settings
```
```31:38:public/src/KpopLyricsPage.js
// Initialize showEnglish from localStorage
```
```218:224:public/src/KpopLyricsPage.js
// Save showEnglish to localStorage on toggle
```

### Edit: 2025-11-17
- Files: `public/src/AudioLearningPage.js`
- Summary: Fixed audio playback order by reversing `generatedSentences` back to original order when generating audio. Sentences are stored reversed for display (most recent first), but audio generation now uses the correct chronological order.
- Rationale: Bug fix - audio was playing in reverse order because `generatedSentences` is stored reversed for UI display purposes, but audio generation was using the reversed array directly. Audio should play in the original chronological order.
- Code refs:
```167:171:public/src/AudioLearningPage.js
// Fixed generateConversationAudio to reverse generatedSentences back to original order when used as fallback
```
```925:926:public/src/AudioLearningPage.js
// Fixed handlePlayCurrentConversation to reverse generatedSentences back to original order before generating audio
```

### Edit: 2025-11-17
- Files: `backend/tts.js`
- Summary: Changed Level 3 audio playback order for each sentence: English sentence → Korean sentence (full) → (Korean word → English word) for each word pair → Korean sentence (full) again. Previously was: English sentence → (English word → Korean word) for each word → Korean sentence.
- Rationale: User requested new playback order where the full Korean sentence is played first, then word-by-word breakdown (Korean word then English word), then the full Korean sentence is repeated. This provides better learning flow by hearing the complete sentence before breaking it down.
- Code refs:
```375:375:backend/tts.js
// Updated comment to reflect new order: EN sentence → full KO sentence → (word1 KO, word1 EN, ...) → full KO sentence again
```
```430:465:backend/tts.js
// Reordered audio generation: 1) EN sentence, 2) Full KO sentence, 3) Word pairs (KO then EN), 4) Full KO sentence again
```

### Edit: 2025-11-17
- Files: `public/src/AudioLearningPage.js`
- Summary: Changed display order of generated sentences so Korean text appears above English text. Previously English was shown first, then Korean.
- Rationale: User requested Korean text to be displayed above English for better visual hierarchy and learning flow.
- Code refs:
```2068:2072:public/src/AudioLearningPage.js
// Swapped order: Korean sentence now appears above English sentence in generated sentences display
```

### Edit: 2025-11-17
- Files: `public/src/StatsPage.js`
- Summary: Added a panel at the top of the Stats page showing all learning words (words with is_learning flag). Displays in a table with Type, Korean, English, tags (Fav/Learning/Learned), and statistics (Correct/First Try/Seen). Sorted by date added (oldest first) to match the order they appear in learning sets.
- Rationale: User requested visibility into all learning words in one place at the top of the stats page for easy reference and management.
- Code refs:
```128:136:public/src/StatsPage.js
// Added allLearningWords useMemo to filter and sort all words with is_learning flag
```
```255:296:public/src/StatsPage.js
// Added Learning Words Panel section before tabs, displays all learning words in table format
```

### Edit: 2025-11-17
- Files: `public/src/TranslationBox.js`
- Summary: Added loading state and animated loading bar for translation. Button shows "Translating..." text and is disabled during translation. Loading bar appears in response box with animated gradient effect. Response text shows "Translating..." while loading.
- Rationale: User requested visual feedback during translation to indicate the process is in progress.
- Code refs:
```9:9:public/src/TranslationBox.js
// Added isTranslating state to track translation progress
```
```51:92:public/src/TranslationBox.js
// Updated performTranslation to set loading state at start and clear in finally block
```
```139:165:public/src/TranslationBox.js
// Updated button to show "Translating..." text and disable during translation
```
```205:231:public/src/TranslationBox.js
// Added animated loading bar with gradient animation in response box
```
```232:234:public/src/TranslationBox.js
// Updated response text to show "Translating..." when loading
```

### Edit: 2025-11-17
- Files: `backend/database.js`, `backend/server.js`, `public/src/api.js`, `public/src/StatsPage.js`
- Summary: Added ability to edit word fields (Korean and English) in the Stats page. Clicking on Korean or English text in any word table enables inline editing. Added database method `updateWordFields`, API endpoint `/api/words/update`, and frontend editing UI with click-to-edit functionality.
- Rationale: User requested ability to edit words directly in the stats page for corrections and updates.
- Code refs:
```1460:1486:backend/database.js
// Added updateWordFields method to update korean/english fields in word tables
```
```295:311:backend/server.js
// Added /api/words/update endpoint for updating word fields
```
```57:61:public/src/api.js
// Added updateWordFields API method
```
```26:26:public/src/StatsPage.js
// Added editingWord state to track which word is being edited
```
```59:85:public/src/StatsPage.js
// Added handleUpdateWord function to save word edits
```
```165:220:public/src/StatsPage.js
// Added inline editing UI for verb table (click Korean/English to edit)
```
```214:280:public/src/StatsPage.js
// Added inline editing UI for other word type tables
```

### Edit: 2025-01-27
- Files: `public/src/StatsPage.js`
- Summary: Removed Priority column from all word tables and restored Fav column. Priority functionality remains in backend but is hidden from UI.
- Rationale: User requested to hide the Priority column and bring back the Fav column for better UI clarity.
- Code refs:
```214:219:public/src/StatsPage.js
                  <th>Fav</th>
                  <th>Learning</th>
                  <th>Learned</th>
                  <th>Correct</th>
                  <th>First Try</th>
                  <th>Seen</th>
```
```328:333:public/src/StatsPage.js
                <th>Fav</th>
                <th>Learning</th>
                <th>Learned</th>
                <th>Correct</th>
                <th>First Try</th>
                <th>Seen</th>
```
- Removed Priority select dropdowns from verb table, regular type tables, All Learning Words panel, and Top Correct Words table. Updated colSpan values for empty state messages. Priority system remains functional in backend (`priority_level` field, `handleSetPriority` function, and `getLearningWords` ordering by priority) but is no longer visible in the UI.
```275:340:public/src/StatsPage.js
// Added inline editing UI for learning words panel and top overall table
```

### Edit: 2025-01-27
- Files: `public/src/App.js`, `public/src/Navbar.js`, `public/manifest.json`
- Summary: Changed route path from `/quiz-mode` to `/audio-learning` for the AudioLearningPage component. Updated route definition in App.js, navigation link in Navbar.js, and PWA shortcut URL in manifest.json.
- Rationale: User requested route rename to better reflect the page name and purpose. The route `/quiz-mode` was outdated and didn't match the component name `AudioLearningPage`.
- Code refs:
```30:30:public/src/App.js
<Route path="/audio-learning" element={<AudioLearningPage />} />
```
```174:174:public/src/Navbar.js
audio: { to: '/audio-learning', label: 'Audio Learning', className: 'nav-item' },
```
```70:70:public/manifest.json
"url": "/audio-learning",
```

### Edit: 2025-01-27
- Files: `public/src/AudioLearningPage.js`
- Summary: Added auto-start functionality for audio playback when `autoplay` query parameter is present in the route. The component now checks for `?autoplay` in the URL and automatically starts the appropriate audio mode (quiz loop or conversation audio) after learning words are loaded.
- Rationale: User requested ability to auto-start audio playback via route parameter, enabling direct links to start audio learning without manual button clicks. Useful for PWA shortcuts, bookmarks, or external links that should immediately begin playback.
- Code refs:
```1:2:public/src/AudioLearningPage.js
import React from 'react';
import { useSearchParams } from 'react-router-dom';
```
```19:24:public/src/AudioLearningPage.js
function AudioLearningPage() {
  const [searchParams] = useSearchParams();
  const [learningWords, setLearningWords] = React.useState(null);
  const [isLoadingLearningWords, setIsLoadingLearningWords] = React.useState(false);
  const playingRef = React.useRef(false);
  const pausedRef = React.useRef(false);
  const autoStartedRef = React.useRef(false);
```
```661:695:public/src/AudioLearningPage.js
// Auto-start audio if autoplay parameter is present in route
React.useEffect(() => {
  const autoplay = searchParams.get('autoplay');
  if (autoplay && !autoStartedRef.current && !isLoadingLearningWords && learningWords && Array.isArray(learningWords) && learningWords.length > 0) {
    autoStartedRef.current = true;
    // Small delay to ensure UI is ready
    setTimeout(() => {
      if (!isQuizLooping && !isLearningPlaying) {
        const level = Number(quizDifficulty) || 1;
        if (conversationAudioUrl && quizMode === 'hands-free' && level === 3) {
          // Play existing audio
          setIsQuizLooping(true);
          playingRef.current = true;
          pausedRef.current = false;
          setIsPaused(false);
          quizLoopRef.current = true;
          startKeepAlive();
          (async () => {
            try {
              await playConversationAudio(true, conversationAudioUrl);
              while (playingRef.current && quizLoopRef.current) {
                await waitWhilePaused();
                if (!playingRef.current || !quizLoopRef.current) break;
                await new Promise(r => setTimeout(r, 500));
              }
            } catch (err) {
              console.error('Failed to play audio:', err);
            } finally {
              setIsQuizLooping(false);
              quizLoopRef.current = false;
              playingRef.current = false;
              pausedRef.current = false;
              updateMediaSession('Audio Learning', '', false);
              await releaseWakeLock();
              if (!quizLoopRef.current) {
                stopKeepAlive();
              }
            }
          })();
        } else if (quizMode === 'hands-free' && level === 3) {
          handlePlayCurrentConversation();
        } else {
          handleStartQuizLoop();
        }
      }
    }, 500);
  }
}, [searchParams, isLoadingLearningWords, learningWords, isQuizLooping, isLearningPlaying, quizDifficulty, conversationAudioUrl, quizMode, handleStartQuizLoop, handlePlayCurrentConversation, playConversationAudio, waitWhilePaused]);
```
- Usage: Navigate to `/audio-learning?autoplay` or `/audio-learning?autoplay=true` to automatically start audio playback when the page loads.

### Edit: 2025-11-19
- Files: `public/src/api.js`, `public/src/AudioLearningPage.js`
- Summary: Added timeout handling and retry logic with exponential backoff to `getRandomCurriculumPhrase` API call to handle 504 Gateway Timeout errors. Improved error handling in `getCurriculumSentence` to gracefully fall back when API fails.
- Rationale: User reported HTTP 504 Gateway Timeout errors when calling `/api/curriculum-phrases/random`. The proxy was timing out waiting for the backend. Added timeout (8s default), retry logic (1 retry by default), and exponential backoff to handle transient network/proxy issues. The function now gracefully handles timeouts and returns errors that can be caught by callers, allowing fallback mechanisms to work.
- Code refs:
```91:91:public/src/api.js
  getRandomCurriculumPhrase: async (timeout = 8000, retries = 1) => {
```
```738:750:public/src/AudioLearningPage.js
  const getCurriculumSentence = React.useCallback(async () => {
    try {
      const res = await api.getRandomCurriculumPhrase(8000, 1); // 8s timeout, 1 retry
      if (!res.ok) {
        // If 504 or other server error, log and return null to use fallback
        if (res.status === 504 || res.status === 502 || res.status === 503) {
          console.warn(`Curriculum API error: HTTP ${res.status}. Using fallback sentence generation.`);
          return null;
        }
        return null;
      }
      const p = await res.json();
      const english = String(p && (p.english_text || p.english || '') || '').trim();
      const korean = String(p && (p.korean_text || p.korean || '') || '').trim();
      if (!english || !korean) return null;
      return { english, korean };
    } catch (error) {
      // Log error but don't break the flow - use fallback
      console.warn('Failed to fetch curriculum phrase:', error.message || error);
      return null;
    }
  }, []);
```

### Edit: 2025-11-19
- Files: `public/src/CurriculumPracticePage.js`
- Summary: Added null checks and error handling to `selectNextVerbPracticePhrase` and `selectNextConversationPhrase` functions, and improved error handling in the practiceMode useEffect to prevent crashes when phrases are missing or malformed.
- Rationale: User reported React error in CurriculumPracticePage component. The error was likely caused by accessing properties on null/undefined objects or missing error handling when generating sessions. Added comprehensive null checks, try-catch blocks, and validation to ensure phrases have required properties before use.
- Code refs:
```284:313:public/src/CurriculumPracticePage.js
  const selectNextVerbPracticePhrase = useCallback(() => {
    const pool = Array.isArray(verbPracticeSession) && verbPracticeSession.length > 0 ? verbPracticeSession : [];
    if (pool.length === 0) return false;
    const used = new Set(usedPhraseIds);
    let next = pool.find((p) => p && p.id && !used.has(p.id));
    if (!next) {
      // Reset and start again from the same session
      setUsedPhraseIds([]);
      next = pool[0];
    }
    if (!next || !next.id) return false;
    setUsedPhraseIds((prev) => prev.includes(next.id) ? prev : [...prev, next.id]);
    setCurrentPhrase(next);
    // Create blank indices for verb practice
    const koreanText = String(next.korean_text || next.korean || '').trim();
    if (!koreanText) return false;
    const words = koreanText.split(' ').filter(w => w);
    if (words.length === 0) return false;
    // ... rest of function
  }, [verbPracticeSession, usedPhraseIds, numBlanks, getCandidateBlankIndices]);
```
```185:201:public/src/CurriculumPracticePage.js
      } else if (practiceMode === 2) {
        // Verb practice mode: generate initial session
        if (typeof generateVerbPracticeSentence === 'function') {
          (async () => {
            try {
              const session = [];
              for (let i = 0; i < SESSION_SIZE; i++) {
                try {
                  const phrase = await generateVerbPracticeSentence();
                  if (phrase && phrase.korean_text && phrase.english_text) {
                    session.push(phrase);
                  }
                } catch (err) {
                  console.warn('Error generating verb practice sentence:', err);
                }
              }
              // ... error handling
            } catch (err) {
              console.error('Error initializing verb practice session:', err);
              fetchRandomPhrase();
            }
          })();
        } else {
          fetchRandomPhrase();
        }
```

### Edit: 2025-11-19
- Files: `public/src/CurriculumPracticePage.js`
- Summary: Fixed React Rules of Hooks violation by moving `getActiveSessionData` from after early returns to before them, and converted it from `useCallback` to `useMemo` since it computes a value rather than returning a function.
- Rationale: User reported React error in CurriculumPracticePage. The error was caused by defining `getActiveSessionData` as a `useCallback` hook after conditional early returns (loading, error, no currentPhrase), which violates React's Rules of Hooks. Hooks must be called at the top level before any conditional returns. Converted to `useMemo` since we're computing session data, not creating a function.
- Code refs:
```161:195:public/src/CurriculumPracticePage.js
  const blankPhrase = currentPhrase ? createBlankPhrase(currentPhrase) : null;

  // Calculate progress over the active session subset based on mode (must be before early returns)
  const activeSessionData = useMemo(() => {
    if (practiceMode === 1) {
      // Curriculum mode
      const total = (sessionPhrases && sessionPhrases.length) ? sessionPhrases.length : allPhrases.length;
      const used = (sessionPhrases && sessionPhrases.length)
        ? usedPhraseIds.filter((id) => sessionPhrases.some((p) => p && p.id === id)).length
        : usedPhraseIds.length;
      return { total, used, phrases: sessionPhrases || [] };
    } else if (practiceMode === 2) {
      // Verb practice mode
      const total = verbPracticeSession.length;
      const used = usedPhraseIds.filter((id) => verbPracticeSession.some((p) => p && p.id === id)).length;
      return { total, used, phrases: verbPracticeSession };
    } else if (practiceMode === 3) {
      // Conversation mode
      const total = conversationSession.length;
      const used = usedPhraseIds.filter((id) => conversationSession.some((p) => p && p.id === id)).length;
      return { total, used, phrases: conversationSession };
    }
    return { total: 0, used: 0, phrases: [] };
  }, [practiceMode, sessionPhrases, allPhrases, verbPracticeSession, conversationSession, usedPhraseIds]);
  
  const activeTotal = activeSessionData.total;
  const activeUsed = activeSessionData.used;
  const activePhrases = activeSessionData.phrases;
  const progressPercentage = activeTotal > 0 ? (activeUsed / activeTotal) * 100 : 0;
```

### Edit: 2025-11-19
- Files: `public/src/AudioLearningPage.js`
- Summary: Moved the auto-start audio `useEffect` to after `handleStartQuizLoop` and `handlePlayCurrentConversation` are defined to fix "Cannot access 'handleStartQuizLoop' before initialization" error.
- Rationale: User reported runtime error where `handleStartQuizLoop` was being accessed before initialization. The auto-start `useEffect` (line 666) was referencing `handleStartQuizLoop` and `handlePlayCurrentConversation` in its dependency array and code, but these functions are defined later in the file (lines 978 and 1543). Since `const` declarations with `useCallback` are not hoisted, they must be defined before use. Moved the auto-start `useEffect` to after both functions are defined.
- Code refs:
```1828:1870:public/src/AudioLearningPage.js
  }, [ensureLearningWords, quizMode, startMicRecording, stopMicRecording, playRecorded, quizDelaySec, quizRecordDurationSec, startSpeechRecognition, stopSpeechRecognition, recognizedText, pushHistory, quizDifficulty, generateQuizSentence, waitWhilePaused, setIndex, applyPronounAndTenseIfVerb, getWordByWordPairs, generateConversationSet]);

  // Auto-start audio if autoplay parameter is present in route (must be after handleStartQuizLoop and handlePlayCurrentConversation are defined)
  React.useEffect(() => {
    const autoplay = searchParams.get('autoplay');
    if (autoplay && !autoStartedRef.current && !isLoadingLearningWords && learningWords && Array.isArray(learningWords) && learningWords.length > 0) {
      autoStartedRef.current = true;
      // Small delay to ensure UI is ready
      setTimeout(() => {
        if (!isQuizLooping && !isLearningPlaying) {
          const level = Number(quizDifficulty) || 1;
          if (conversationAudioUrl && quizMode === 'hands-free' && level === 3) {
            // ... play existing audio logic ...
          } else if (quizMode === 'hands-free' && level === 3) {
            handlePlayCurrentConversation();
          } else {
            handleStartQuizLoop();
          }
        }
      }, 500);
    }
  }, [searchParams, isLoadingLearningWords, learningWords, isQuizLooping, isLearningPlaying, quizDifficulty, conversationAudioUrl, quizMode, handleStartQuizLoop, handlePlayCurrentConversation, playConversationAudio, waitWhilePaused]);
```

### Edit: 2025-11-19
- Files: `public/src/AudioLearningPage.js`
- Summary: Fixed sentence order by removing `.reverse()` calls when storing and displaying `generatedSentences`. Sentences now display in the order they were generated (first to last) instead of being reversed.
- Rationale: User reported that sentences were displayed backwards. The code was storing sentences in reverse order and then reversing them again for display, which was confusing. Removed all `.reverse()` calls when setting `generatedSentences` and when displaying them, so they appear in the natural generation order.
- Code refs:
```221:221:public/src/AudioLearningPage.js
            setGeneratedSentences(items);
```
```922:922:public/src/AudioLearningPage.js
        setGeneratedSentences(batch);
```
```939:939:public/src/AudioLearningPage.js
      const items = Array.isArray(generatedSentences) ? generatedSentences : [];
```
```1569:1569:public/src/AudioLearningPage.js
            setGeneratedSentences(batch);
```
```1596:1596:public/src/AudioLearningPage.js
            setGeneratedSentences(batch3);
```
```2129:2129:public/src/AudioLearningPage.js
                    {generatedSentences.map((s, i) => (
```
```2225:2225:public/src/AudioLearningPage.js
                      setGeneratedSentences(c.items || []);
```

### Edit: 2025-11-19
- Files: `public/src/AudioLearningPage.js`
- Summary: Enhanced autoplay functionality to work better with Brave browser by ensuring audio context is activated before attempting to play, adding retry logic for failed play attempts, and improving error handling.
- Rationale: Brave browser has stricter autoplay policies that block audio playback without proper audio context activation. The changes ensure the audio context is started and resumed before attempting to play, and add retry logic if the initial play attempt fails due to autoplay restrictions.
- Code refs:
```1782:1828:public/src/AudioLearningPage.js
  // Auto-start audio if autoplay parameter is present in route (must be after handleStartQuizLoop and handlePlayCurrentConversation are defined)
  React.useEffect(() => {
    const autoplay = searchParams.get('autoplay');
    if (autoplay && !autoStartedRef.current && !isLoadingLearningWords && learningWords && Array.isArray(learningWords) && learningWords.length > 0) {
      autoStartedRef.current = true;
      // Start keep-alive and ensure audio context is active first (critical for Brave browser)
      startKeepAlive();
      ensureAudioContextActive();
      // Small delay to ensure UI is ready and audio context is activated
      setTimeout(async () => {
        if (!isQuizLooping && !isLearningPlaying) {
          // Ensure audio context is active (Brave requires this)
          try {
            await ensureAudioContextActive();
            // Try to resume if suspended
            if (window.__AUDIO_CONTEXT_KEEPALIVE__ && window.__AUDIO_CONTEXT_KEEPALIVE__.context) {
              const ctx = window.__AUDIO_CONTEXT_KEEPALIVE__.context;
              if (ctx.state === 'suspended') {
                await ctx.resume().catch(() => {});
              }
            }
          } catch (err) {
            console.warn('Failed to activate audio context for autoplay:', err);
          }
          
          const level = Number(quizDifficulty) || 1;
          if (conversationAudioUrl && quizMode === 'hands-free' && level === 3) {
            // Play existing audio
            setIsQuizLooping(true);
            playingRef.current = true;
            pausedRef.current = false;
            setIsPaused(false);
            quizLoopRef.current = true;
            (async () => {
              try {
                await playConversationAudio(true, conversationAudioUrl);
                while (playingRef.current && quizLoopRef.current) {
                  await waitWhilePaused();
                  if (!playingRef.current || !quizLoopRef.current) break;
                  await new Promise(r => setTimeout(r, 500));
                }
              } catch (err) {
                console.error('Failed to play audio:', err);
              } finally {
                setIsQuizLooping(false);
                quizLoopRef.current = false;
                playingRef.current = false;
                pausedRef.current = false;
                updateMediaSession('Audio Learning', '', false);
                await releaseWakeLock();
                if (!quizLoopRef.current) {
                  stopKeepAlive();
                }
              }
            })();
          } else if (quizMode === 'hands-free' && level === 3) {
            handlePlayCurrentConversation();
          } else {
            handleStartQuizLoop();
          }
        }
      }, 500);
    }
  }, [searchParams, isLoadingLearningWords, learningWords, isQuizLooping, isLearningPlaying, quizDifficulty, conversationAudioUrl, quizMode, handleStartQuizLoop, handlePlayCurrentConversation, playConversationAudio, waitWhilePaused]);
```
```835:865:public/src/AudioLearningPage.js
        if (shouldLoop) {
          // For looping audio, onended won't fire, so we only cleanup on error or manual stop
          audio.onerror = cleanup;
          audio.play().catch((err) => {
            console.warn('Failed to play audio (autoplay may be blocked):', err);
            // Try to resume audio context and retry once
            (async () => {
              try {
                await ensureAudioContextActive();
                if (window.__AUDIO_CONTEXT_KEEPALIVE__ && window.__AUDIO_CONTEXT_KEEPALIVE__.context) {
                  const ctx = window.__AUDIO_CONTEXT_KEEPALIVE__.context;
                  if (ctx.state === 'suspended') {
                    await ctx.resume();
                  }
                }
                // Retry play after a short delay
                await new Promise(r => setTimeout(r, 100));
                await audio.play().catch(() => cleanup());
              } catch (retryErr) {
                console.error('Retry play failed:', retryErr);
                cleanup();
              }
            })();
          });
          // Don't resolve immediately - let it play in loop
        } else {
          // For non-looping, resolve when ended
          audio.onended = cleanup;
          audio.onerror = cleanup;
          audio.play().catch((err) => {
            console.warn('Failed to play audio (autoplay may be blocked):', err);
            // Try to resume audio context and retry once
            (async () => {
              try {
                await ensureAudioContextActive();
                if (window.__AUDIO_CONTEXT_KEEPALIVE__ && window.__AUDIO_CONTEXT_KEEPALIVE__.context) {
                  const ctx = window.__AUDIO_CONTEXT_KEEPALIVE__.context;
                  if (ctx.state === 'suspended') {
                    await ctx.resume();
                  }
                }
                // Retry play after a short delay
                await new Promise(r => setTimeout(r, 100));
                await audio.play().catch(() => cleanup());
              } catch (retryErr) {
                console.error('Retry play failed:', retryErr);
                cleanup();
              }
            })();
          });
        }
```

### Edit: 2025-11-19
- Files: `public/src/AudioLearningPage.js`
- Summary: Added console logging and proper async/await handling to autoplay functionality to debug why autoplay wasn't starting and the button wasn't showing "Stop" state.
- Rationale: User reported that autoplay wasn't working and the button wasn't changing to "Stop", indicating that `isQuizLooping` wasn't being set to true. Added comprehensive logging to track autoplay flow and ensured async functions are properly awaited with error handling.
- Code refs:
```1822:1884:public/src/AudioLearningPage.js
  // Auto-start audio if autoplay parameter is present in route (must be after handleStartQuizLoop and handlePlayCurrentConversation are defined)
  React.useEffect(() => {
    const autoplay = searchParams.get('autoplay');
    if (autoplay && !autoStartedRef.current && !isLoadingLearningWords && learningWords && Array.isArray(learningWords) && learningWords.length > 0) {
      autoStartedRef.current = true;
      console.log('[Autoplay] Starting autoplay...', { quizMode, quizDifficulty, conversationAudioUrl: !!conversationAudioUrl });
      // Start keep-alive and ensure audio context is active first (critical for Brave browser)
      startKeepAlive();
      ensureAudioContextActive();
      // Small delay to ensure UI is ready and audio context is activated
      setTimeout(async () => {
        if (!isQuizLooping && !isLearningPlaying) {
          // Ensure audio context is active (Brave requires this)
          try {
            await ensureAudioContextActive();
            // Try to resume if suspended
            if (window.__AUDIO_CONTEXT_KEEPALIVE__ && window.__AUDIO_CONTEXT_KEEPALIVE__.context) {
              const ctx = window.__AUDIO_CONTEXT_KEEPALIVE__.context;
              if (ctx.state === 'suspended') {
                await ctx.resume().catch(() => {});
              }
            }
          } catch (err) {
            console.warn('[Autoplay] Failed to activate audio context:', err);
          }
          
          const level = Number(quizDifficulty) || 1;
          console.log('[Autoplay] Conditions:', { level, quizMode, hasConversationAudio: !!conversationAudioUrl });
          
          if (conversationAudioUrl && quizMode === 'hands-free' && level === 3) {
            // Play existing audio
            console.log('[Autoplay] Playing existing conversation audio');
            setIsQuizLooping(true);
            playingRef.current = true;
            pausedRef.current = false;
            setIsPaused(false);
            quizLoopRef.current = true;
            (async () => {
              try {
                await playConversationAudio(true, conversationAudioUrl);
                while (playingRef.current && quizLoopRef.current) {
                  await waitWhilePaused();
                  if (!playingRef.current || !quizLoopRef.current) break;
                  await new Promise(r => setTimeout(r, 500));
                }
              } catch (err) {
                console.error('[Autoplay] Failed to play audio:', err);
              } finally {
                setIsQuizLooping(false);
                quizLoopRef.current = false;
                playingRef.current = false;
                pausedRef.current = false;
                updateMediaSession('Audio Learning', '', false);
                await releaseWakeLock();
                if (!quizLoopRef.current) {
                  stopKeepAlive();
                }
              }
            })();
          } else if (quizMode === 'hands-free' && level === 3) {
            console.log('[Autoplay] Calling handlePlayCurrentConversation');
            try {
              await handlePlayCurrentConversation();
            } catch (err) {
              console.error('[Autoplay] Error in handlePlayCurrentConversation:', err);
            }
          } else {
            console.log('[Autoplay] Calling handleStartQuizLoop');
            try {
              await handleStartQuizLoop();
            } catch (err) {
              console.error('[Autoplay] Error in handleStartQuizLoop:', err);
            }
          }
        } else {
          console.log('[Autoplay] Skipped - already playing', { isQuizLooping, isLearningPlaying });
        }
      }, 500);
    } else if (autoplay && !autoStartedRef.current) {
      console.log('[Autoplay] Waiting for conditions...', { 
        isLoadingLearningWords, 
        hasLearningWords: !!(learningWords && Array.isArray(learningWords) && learningWords.length > 0) 
      });
    }
  }, [searchParams, isLoadingLearningWords, learningWords, isQuizLooping, isLearningPlaying, quizDifficulty, conversationAudioUrl, quizMode, handleStartQuizLoop, handlePlayCurrentConversation, playConversationAudio, waitWhilePaused]);
```

### Edit: 2025-11-19
- Files: `public/src/AudioLearningPage.js`
- Summary: Added a collapsible error panel below the Word Sets section to display console errors and warnings for easier mobile debugging. The panel intercepts console.error and console.warn calls and displays them in a scrollable list with timestamps and error types.
- Rationale: User requested a way to see console errors on mobile devices where accessing the browser console is difficult. The panel shows errors and warnings with timestamps, allows clearing the list, and is collapsible to save space.
- Code refs:
```76:79:public/src/AudioLearningPage.js
  const [recordingError, setRecordingError] = React.useState('');
  
  // Console error tracking for mobile debugging
  const [consoleErrors, setConsoleErrors] = React.useState([]);
  const [showErrorPanel, setShowErrorPanel] = React.useState(false);
  const consoleErrorRef = React.useRef([]);
```
```586:625:public/src/AudioLearningPage.js
  // Intercept console errors and warnings for display
  React.useEffect(() => {
    const originalError = console.error;
    const originalWarn = console.warn;
    
    const addError = (type, ...args) => {
      const message = args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');
      
      const errorEntry = {
        id: Date.now() + Math.random(),
        type,
        message,
        timestamp: new Date().toLocaleTimeString(),
      };
      
      consoleErrorRef.current = [...consoleErrorRef.current, errorEntry].slice(-50); // Keep last 50
      setConsoleErrors([...consoleErrorRef.current]);
    };
    
    console.error = (...args) => {
      originalError.apply(console, args);
      addError('error', ...args);
    };
    
    console.warn = (...args) => {
      originalWarn.apply(console, args);
      addError('warn', ...args);
    };
    
    return () => {
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, []);
```
```2416:2475:public/src/AudioLearningPage.js
          <div className="audio-card" style={{ marginTop: 12 }}>
            <h2 className="audio-section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Console Errors & Warnings</span>
              {consoleErrors.length > 0 && (
                <span style={{ 
                  fontSize: 12, 
                  background: '#f44336', 
                  color: 'white', 
                  padding: '2px 8px', 
                  borderRadius: 12,
                  fontWeight: 600
                }}>
                  {consoleErrors.length}
                </span>
              )}
            </h2>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button className="audio-btn" onClick={() => setShowErrorPanel(!showErrorPanel)}>
                {showErrorPanel ? 'Hide Errors' : 'Show Errors'}
              </button>
              {consoleErrors.length > 0 && (
                <button className="audio-btn" onClick={() => {
                  consoleErrorRef.current = [];
                  setConsoleErrors([]);
                }}>
                  Clear All
                </button>
              )}
            </div>
            {showErrorPanel && (
              <div style={{ 
                maxHeight: '400px', 
                overflow: 'auto', 
                border: '1px solid #ddd', 
                borderRadius: 6, 
                background: '#fafafa',
                fontSize: 12
              }}>
                {consoleErrors.length === 0 ? (
                  <div style={{ padding: 16, textAlign: 'center', color: '#666' }}>
                    No errors or warnings
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 0 }}>
                    {consoleErrors.map((err) => (
                      <div 
                        key={err.id} 
                        style={{ 
                          padding: '10px 12px', 
                          borderBottom: '1px solid #eee',
                          background: err.type === 'error' ? '#ffebee' : '#fff3e0',
                          wordBreak: 'break-word',
                          fontFamily: 'monospace'
                        }}
                      >
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 4 }}>
                          <span style={{ 
                            fontSize: 10, 
                            fontWeight: 600,
                            color: err.type === 'error' ? '#c62828' : '#e65100',
                            minWidth: 50
                          }}>
                            {err.type.toUpperCase()}
                          </span>
                          <span style={{ fontSize: 10, color: '#666', flex: 1 }}>
                            {err.timestamp}
                          </span>
                        </div>
                        <div style={{ 
                          color: err.type === 'error' ? '#b71c1c' : '#bf360c',
                          whiteSpace: 'pre-wrap',
                          fontSize: 11,
                          lineHeight: 1.4
                        }}>
                          {err.message}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
```

### Edit: 2025-11-19
- Files: `public/src/Navbar.js`, `public/src/styles/Navbar.css`
- Summary: Fixed left sidebar visibility - made it visible by default on desktop and properly handle mobile toggle. The sidebar now shows "Last updated" and "Settings" button by default on desktop, and can be toggled on mobile.
- Rationale: User reported they couldn't see the left sidebar with settings and last updated info. The sidebar was hidden by default even on desktop. Changed the default state to be visible on desktop (screen width > 768px) and hidden on mobile, with proper CSS to ensure content is always visible on desktop regardless of state.
- Code refs:
```43:47:public/src/Navbar.js
  // Sidebar visible by default on desktop, hidden on mobile
  const [sidebarVisible, setSidebarVisible] = React.useState(() => {
    if (typeof window === 'undefined') return true;
    // Check if mobile
    const isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
    return !isMobile; // Visible on desktop, hidden on mobile
  });
```
```136:161:public/src/styles/Navbar.css
.bottom-bar {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: 150px;
  background-color: #f8f8f8;
  border-right: 1px solid #eee;
  padding: 0.75rem;
  z-index: 100;
  overflow-y: auto;
  transition: transform 0.3s ease;
  /* Always visible on desktop */
  transform: translateX(0);
}

/* On desktop, always show the sidebar content */
.bottom-bar-inner {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
  height: 100%;
}
```
```177:180:public/src/styles/Navbar.css
/* Hide content when sidebar is hidden (mobile only) */
@media (max-width: 768px) {
  .bottom-bar.sidebar-hidden .bottom-bar-inner {
    display: none;
  }
}
```

### Edit: 2025-11-19
- Files: `public/src/Navbar.js`, `public/src/styles/Navbar.css`
- Summary: Made the mobile sidebar toggle button more visible and prominent. Changed the button from a simple arrow to a hamburger menu icon (☰) when closed, increased its size, made it darker with better contrast, and added stronger shadows to make it stand out on mobile screens.
- Rationale: User couldn't see the left sidebar on mobile. The toggle button was too subtle and hard to notice. Made it more prominent with a darker background (#4a5568), larger size (40x56px), hamburger icon (☰), and stronger shadows so users can easily find and tap it to open the sidebar.
- Code refs:
```245:253:public/src/Navbar.js
        <button
          type="button"
          className="sidebar-toggle"
          onClick={() => setSidebarVisible(!sidebarVisible)}
          aria-label={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
          title={sidebarVisible ? 'Hide sidebar' : 'Show sidebar & Settings'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {sidebarVisible ? '←' : '☰'}
        </button>
```
```161:194:public/src/styles/Navbar.css
.sidebar-toggle {
  display: none; /* Hidden on desktop */
  position: fixed;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: 101;
  width: 40px;
  height: 56px;
  background-color: #4a5568;
  border: 2px solid #2d3748;
  border-left: none;
  border-radius: 0 12px 12px 0;
  cursor: pointer;
  font-size: 20px;
  font-weight: bold;
  color: #ffffff;
  align-items: center;
  justify-content: center;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
  touch-action: manipulation;
  -webkit-tap-highlight-color: rgba(255, 255, 255, 0.2);
}

.sidebar-toggle:hover {
  background-color: #5a6578;
}

.sidebar-toggle:active {
  background-color: #3a4558;
  transform: translateY(-50%) scale(0.95);
}
```
```322:330:public/src/styles/Navbar.css
  .bottom-bar.sidebar-visible .sidebar-toggle {
    left: 150px;
    background-color: #4a5568;
  }

  .bottom-bar.sidebar-hidden .sidebar-toggle {
    left: 0;
    background-color: #4a5568;
    /* Make it more visible when sidebar is hidden */
    box-shadow: 2px 0 12px rgba(0, 0, 0, 0.4);
  }
```

### Edit: 2025-11-19
- Files: `public/src/AudioLearningPage.js`
- Summary: Fixed MediaSession pause/play/stop callbacks for Android notification controls. Added proper callbacks to `playConversationAudio` and `handleStartQuizLoop` so that pause/play buttons in Android notifications actually control the audio playback.
- Rationale: User reported that pause wasn't working from Android notification buttons. The MediaSession API was set up but the callbacks weren't properly wired to pause/resume the actual audio elements. Added callbacks that pause/resume the conversation audio element or loop audio based on the current mode.
- Code refs:
```870:905:public/src/AudioLearningPage.js
        // Set up MediaSession callbacks for Android notification controls
        updateMediaSession('Conversation Audio', 'Korean Learning', true, {
          play: () => {
            try {
              if (audio && audio.paused) {
                audio.play().catch(() => {});
                pausedRef.current = false;
                setIsPaused(false);
                updateMediaSession('Conversation Audio', 'Korean Learning', true);
              }
            } catch (_) {}
          },
          pause: () => {
            try {
              if (audio && !audio.paused) {
                audio.pause();
                pausedRef.current = true;
                setIsPaused(true);
                updateMediaSession('Conversation Audio', 'Korean Learning', false);
              }
            } catch (_) {}
          },
          stop: () => {
            try {
              if (audio) {
                audio.pause();
                audio.currentTime = 0;
                pausedRef.current = false;
                setIsPaused(false);
                playingRef.current = false;
                quizLoopRef.current = false;
                updateMediaSession('Audio Learning', '', false);
              }
            } catch (_) {}
          }
        });
```
```1631:1675:public/src/AudioLearningPage.js
    // Set up MediaSession callbacks for Android notification controls
    const level = Number(quizDifficulty) || 1;
    updateMediaSession('Audio Learning', 'Korean Learning', true, {
      play: () => {
        pausedRef.current = false;
        setIsPaused(false);
        // Resume audio based on mode
        if (quizMode === 'hands-free' && level === 3 && conversationAudioRef.current) {
          try {
            conversationAudioRef.current.play().catch(() => {});
          } catch (_) {}
        } else {
          resumeLoop();
        }
        updateMediaSession('Audio Learning', 'Korean Learning', true);
      },
      pause: () => {
        pausedRef.current = true;
        setIsPaused(true);
        // Pause audio based on mode
        if (quizMode === 'hands-free' && level === 3 && conversationAudioRef.current) {
          try {
            conversationAudioRef.current.pause();
          } catch (_) {}
        } else {
          pauseLoop();
        }
        updateMediaSession('Audio Learning', 'Korean Learning', false);
      },
      stop: () => {
        pausedRef.current = false;
        playingRef.current = false;
        quizLoopRef.current = false;
        setIsQuizLooping(false);
        // Stop audio based on mode
        if (quizMode === 'hands-free' && level === 3 && conversationAudioRef.current) {
          try {
            conversationAudioRef.current.pause();
            conversationAudioRef.current.currentTime = 0;
          } catch (_) {}
        } else {
          stopLoop();
        }
        try { const s = window.speechSynthesis; if (s) s.cancel(); } catch (_) {}
        updateMediaSession('Audio Learning', '', false);
      }
    });
```

### Edit: 2025-11-19
- Files: `public/src/Navbar.js`, `public/src/styles/Navbar.css`
- Summary: Fixed mobile sidebar visibility by moving the toggle button outside the `.bottom-bar` div. The button was previously inside the sidebar, so when the sidebar was hidden (translated off-screen), the button went with it. Now the toggle button is always visible on mobile and positioned independently using inline styles.
- Rationale: User still couldn't see the sidebar on mobile. The issue was that the toggle button was inside the `.bottom-bar` div, which gets `transform: translateX(-100%)` when hidden on mobile, taking the button with it. By moving the button outside and using inline styles to position it based on `sidebarVisible` state, the button is always visible and clickable.
- Code refs:
```244:258:public/src/Navbar.js
      {/* Toggle button - must be outside bottom-bar so it's always visible */}
      <button
        type="button"
        className="sidebar-toggle"
        onClick={() => setSidebarVisible(!sidebarVisible)}
        aria-label={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
        title={sidebarVisible ? 'Hide sidebar' : 'Show sidebar & Settings'}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          left: sidebarVisible ? '150px' : '0'
        }}
      >
        {sidebarVisible ? '←' : '☰'}
      </button>
      <div className={`bottom-bar ${sidebarVisible ? 'sidebar-visible' : 'sidebar-hidden'}`}>
```
```298:306:public/src/styles/Navbar.css
  .sidebar-toggle {
    display: flex !important; /* Show toggle on mobile */
    /* Always visible on mobile, positioned independently */
    position: fixed !important;
    left: 0 !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    z-index: 1001 !important;
  }
```
```

### Edit: 2025-11-19
- Files: `public/src/Navbar.js`
- Summary: Added default mode controls in the settings dialog for Practice page (practice mode: Curriculum/Verb Practice/Conversations) and Audio page (mode: Hands-Free/Recording, difficulty: Level 1/2/3). Settings are stored in localStorage and also update the current page's mode if the user is on that page.
- Rationale: User requested ability to set default modes for Practice and Audio pages from the settings dialog. This allows users to configure their preferred defaults in one place. The settings update both the default values and the current localStorage values so pages pick up changes immediately.
- Code refs:
```43:67:public/src/Navbar.js
  // Default modes for Practice and Audio pages
  const [defaultPracticeMode, setDefaultPracticeMode] = React.useState(() => {
    try {
      const saved = localStorage.getItem('default_practice_mode');
      return saved ? parseInt(saved, 10) : 1; // 1: Curriculum, 2: Verb Practice, 3: Conversations
    } catch (_) {
      return 1;
    }
  });
  const [defaultAudioMode, setDefaultAudioMode] = React.useState(() => {
    try {
      const saved = localStorage.getItem('default_audio_mode');
      return saved || 'hands-free'; // 'hands-free' or 'recording'
    } catch (_) {
      return 'hands-free';
    }
  });
  const [defaultAudioDifficulty, setDefaultAudioDifficulty] = React.useState(() => {
    try {
      const saved = localStorage.getItem('default_audio_difficulty');
      return saved ? parseInt(saved, 10) : 3; // 1, 2, or 3
    } catch (_) {
      return 3;
    }
  });
```
```323:360:public/src/Navbar.js
            <div className="settings-row">
              <span>Default Practice Mode</span>
              <select 
                value={defaultPracticeMode} 
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setDefaultPracticeMode(val);
                  try { localStorage.setItem('default_practice_mode', String(val)); } catch (_) {}
                  // Also update the current practice mode if user is on that page
                  try { localStorage.setItem('practice_mode', String(val)); } catch (_) {}
                }}
                style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: 4, fontSize: '0.9rem' }}
              >
                <option value={1}>Curriculum</option>
                <option value={2}>Verb Practice</option>
                <option value={3}>Conversations</option>
              </select>
            </div>
            <div className="settings-row">
              <span>Default Audio Mode</span>
              <select 
                value={defaultAudioMode} 
                onChange={(e) => {
                  const val = e.target.value;
                  setDefaultAudioMode(val);
                  try { localStorage.setItem('default_audio_mode', val); } catch (_) {}
                  // Also update the current audio mode if user is on that page
                  try { localStorage.setItem('audio_quizMode', val); } catch (_) {}
                }}
                style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: 4, fontSize: '0.9rem' }}
              >
                <option value="hands-free">Hands-Free</option>
                <option value="recording">Recording</option>
              </select>
            </div>
            <div className="settings-row">
              <span>Default Audio Difficulty</span>
              <select 
                value={defaultAudioDifficulty} 
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setDefaultAudioDifficulty(val);
                  try { localStorage.setItem('default_audio_difficulty', String(val)); } catch (_) {}
                  // Also update the current audio difficulty if user is on that page
                  try { localStorage.setItem('audio_quizDifficulty', String(val)); } catch (_) {}
                }}
                style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: 4, fontSize: '0.9rem' }}
              >
                <option value={1}>Level 1: Single Words</option>
                <option value={2}>Level 2: Small Sentences</option>
                <option value={3}>Level 3: Longer Sentences</option>
              </select>
            </div>
```

### Edit: 2025-11-19
- Files: `public/src/AudioLearningPage.js`
- Summary: Improved autoplay handling for Brave browser by detecting when autoplay is blocked and showing a "Start Audio Playback" button that requires a user gesture. Extracted autoplay logic into `startAutoplayAudio` function that can be called from button click or auto-trigger. Added error detection for `NotAllowedError` in `playConversationAudio` to catch autoplay blocking.
- Rationale: Brave browser has stricter autoplay policies and blocks audio playback without a user gesture. The previous implementation would silently fail when autoplay was blocked. Now, when autoplay is blocked, a prominent button appears that requires a user click to unlock audio and start playback. This provides a better user experience and ensures audio can start even when autoplay is restricted.
- Code refs:
```78:82:public/src/AudioLearningPage.js
  const consoleErrorRef = React.useRef([]);
  // Track if autoplay was blocked (for Brave browser)
  const [autoplayBlocked, setAutoplayBlocked] = React.useState(false);
```
```1953:2037:public/src/AudioLearningPage.js
  // Function to actually start autoplay (called from button click or auto-trigger)
  const startAutoplayAudio = React.useCallback(async () => {
    if (autoStartedRef.current) return; // Already started
    autoStartedRef.current = true;
    setAutoplayBlocked(false);
    
    console.log('[Autoplay] Starting autoplay (user gesture)...', { quizMode, quizDifficulty, conversationAudioUrl: !!conversationAudioUrl });
    
    // Start keep-alive and ensure audio context is active first (critical for Brave browser)
    startKeepAlive();
    await ensureAudioContextActive();
    
    // Try to resume if suspended
    try {
      if (window.__AUDIO_CONTEXT_KEEPALIVE__ && window.__AUDIO_CONTEXT_KEEPALIVE__.context) {
        const ctx = window.__AUDIO_CONTEXT_KEEPALIVE__.context;
        if (ctx.state === 'suspended') {
          await ctx.resume().catch(() => {});
        }
      }
    } catch (err) {
      console.warn('[Autoplay] Failed to activate audio context:', err);
    }
    
    const level = Number(quizDifficulty) || 1;
    console.log('[Autoplay] Conditions:', { level, quizMode, hasConversationAudio: !!conversationAudioUrl });
    
    try {
      if (conversationAudioUrl && quizMode === 'hands-free' && level === 3) {
        // Play existing audio
        console.log('[Autoplay] Playing existing conversation audio');
        setIsQuizLooping(true);
        playingRef.current = true;
        pausedRef.current = false;
        setIsPaused(false);
        quizLoopRef.current = true;
        await playConversationAudio(true, conversationAudioUrl);
        while (playingRef.current && quizLoopRef.current) {
          await waitWhilePaused();
          if (!playingRef.current || !quizLoopRef.current) break;
          await new Promise(r => setTimeout(r, 500));
        }
        setIsQuizLooping(false);
        quizLoopRef.current = false;
        playingRef.current = false;
        pausedRef.current = false;
        updateMediaSession('Audio Learning', '', false);
        await releaseWakeLock();
        if (!quizLoopRef.current) {
          stopKeepAlive();
        }
      } else if (quizMode === 'hands-free' && level === 3) {
        console.log('[Autoplay] Calling handlePlayCurrentConversation');
        await handlePlayCurrentConversation();
      } else {
        console.log('[Autoplay] Calling handleStartQuizLoop');
        await handleStartQuizLoop();
      }
    } catch (err) {
      console.error('[Autoplay] Error during autoplay:', err);
      // If autoplay fails, show the button again
      setAutoplayBlocked(true);
      autoStartedRef.current = false;
    }
  }, [quizMode, quizDifficulty, conversationAudioUrl, handleStartQuizLoop, handlePlayCurrentConversation, playConversationAudio, waitWhilePaused]);

  // Auto-start audio if autoplay parameter is present in route (must be after handleStartQuizLoop and handlePlayCurrentConversation are defined)
  React.useEffect(() => {
    const autoplay = searchParams.get('autoplay');
    if (autoplay && !autoStartedRef.current && !isLoadingLearningWords && learningWords && Array.isArray(learningWords) && learningWords.length > 0) {
      console.log('[Autoplay] Attempting autoplay...', { quizMode, quizDifficulty, conversationAudioUrl: !!conversationAudioUrl });
      
      // Start keep-alive and ensure audio context is active first (critical for Brave browser)
      startKeepAlive();
      ensureAudioContextActive();
      
      // Small delay to ensure UI is ready and audio context is activated
      setTimeout(async () => {
        if (!isQuizLooping && !isLearningPlaying) {
          // Try to start audio automatically
          try {
            await startAutoplayAudio();
          } catch (err) {
            // If autoplay fails (likely blocked by Brave), show button
            console.warn('[Autoplay] Autoplay blocked, showing button:', err);
            setAutoplayBlocked(true);
            autoStartedRef.current = false;
          }
        } else {
          console.log('[Autoplay] Skipped - already playing', { isQuizLooping, isLearningPlaying });
        }
      }, 500);
    } else if (autoplay && !autoStartedRef.current) {
      console.log('[Autoplay] Waiting for conditions...', { 
        isLoadingLearningWords, 
        hasLearningWords: !!(learningWords && Array.isArray(learningWords) && learningWords.length > 0) 
      });
    }
  }, [searchParams, isLoadingLearningWords, learningWords, isQuizLooping, isLearningPlaying, quizDifficulty, conversationAudioUrl, quizMode, startAutoplayAudio]);
```
```2041:2060:public/src/AudioLearningPage.js
      <header className="audio-header">
        <h1 className="audio-title">Audio Learning</h1>
        <p className="audio-subtitle">Generate sentences from learning words or practice quiz prompts with recording and playback.</p>
        {/* Show button if autoplay was blocked (Brave browser) */}
        {autoplayBlocked && searchParams.get('autoplay') && (
          <div style={{ 
            marginTop: 16, 
            padding: 16, 
            background: '#fff3cd', 
            border: '2px solid #ffc107', 
            borderRadius: 8,
            textAlign: 'center'
          }}>
            <p style={{ margin: '0 0 12px 0', fontWeight: 600, color: '#856404' }}>
              Audio autoplay is blocked. Click the button below to start audio playback.
            </p>
            <button
              className="audio-btn"
              onClick={startAutoplayAudio}
              style={{ 
                fontSize: 16, 
                padding: '12px 24px',
                background: '#1976d2',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              ▶️ Start Audio Playback
            </button>
          </div>
        )}
      </header>
```

### Edit: 2025-11-19
- Files: `public/src/AudioLearningPage.js`
- Summary: Improved autoplay to attempt unlocking audio context immediately on component mount (before Brave blocks it). Added early audio context activation with a silent test sound to "unlock" audio as soon as the page loads. Reduced autoplay delay from 500ms to 100ms since audio context is already unlocked.
- Rationale: User requested ability to play without clicking. By unlocking the audio context immediately on mount (before any autoplay attempt), we can potentially bypass Brave's autoplay restrictions if the page was opened from a user gesture (like clicking a link). The silent test sound helps "unlock" the audio context early, and the reduced delay makes autoplay start faster.
- Code refs:
```632:680:public/src/AudioLearningPage.js
  React.useEffect(() => {
    const error = checkRecordingSupport();
    setRecordingError(error);
    
    // Initialize MediaSession on mount
    if ('mediaSession' in navigator) {
      updateMediaSession('Audio Learning', 'Korean Learning', false);
    }
    
    // IMMEDIATELY unlock audio context on mount if autoplay is requested
    // This must happen as early as possible, before Brave blocks it
    const autoplay = searchParams.get('autoplay');
    if (autoplay) {
      console.log('[Autoplay] Early unlock: Starting audio context immediately on mount');
      // Start keep-alive immediately
      startKeepAlive();
      // Try to unlock audio context by playing a silent sound
      (async () => {
        try {
          await ensureAudioContextActive();
          // Try to play a silent test sound to unlock audio (if possible)
          try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext && window.__AUDIO_CONTEXT_KEEPALIVE__ && window.__AUDIO_CONTEXT_KEEPALIVE__.context) {
              const ctx = window.__AUDIO_CONTEXT_KEEPALIVE__.context;
              if (ctx.state === 'suspended') {
                await ctx.resume().catch(() => {});
              }
              // Create a very short silent buffer to "unlock" audio
              const buffer = ctx.createBuffer(1, 1, 22050);
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(ctx.destination);
              source.start(0);
              source.stop(0.001);
            }
          } catch (silentErr) {
            // Silent unlock failed, but continue anyway
            console.log('[Autoplay] Silent unlock attempt:', silentErr.message);
          }
        } catch (err) {
          console.warn('[Autoplay] Early unlock failed:', err);
        }
      })();
    }
```
```2043:2075:public/src/AudioLearningPage.js
  // Auto-start audio if autoplay parameter is present in route (must be after handleStartQuizLoop and handlePlayCurrentConversation are defined)
  React.useEffect(() => {
    const autoplay = searchParams.get('autoplay');
    if (autoplay && !autoStartedRef.current && !isLoadingLearningWords && learningWords && Array.isArray(learningWords) && learningWords.length > 0) {
      console.log('[Autoplay] Attempting autoplay...', { quizMode, quizDifficulty, conversationAudioUrl: !!conversationAudioUrl });
      
      // Audio context should already be unlocked from mount effect, but ensure it's active
      startKeepAlive();
      ensureAudioContextActive();
      
      // Try to start immediately (no delay) - audio context should already be unlocked
      (async () => {
        if (!isQuizLooping && !isLearningPlaying) {
          // Small delay to ensure everything is ready, but much shorter
          await new Promise(r => setTimeout(r, 100));
          
          // Try to start audio automatically
          try {
            await startAutoplayAudio();
          } catch (err) {
            // If autoplay fails (likely blocked by Brave), show button
            console.warn('[Autoplay] Autoplay blocked, showing button:', err);
            setAutoplayBlocked(true);
            autoStartedRef.current = false;
          }
        } else {
          console.log('[Autoplay] Skipped - already playing', { isQuizLooping, isLearningPlaying });
        }
      })();
    } else if (autoplay && !autoStartedRef.current) {
      console.log('[Autoplay] Waiting for conditions...', { 
        isLoadingLearningWords, 
        hasLearningWords: !!(learningWords && Array.isArray(learningWords) && learningWords.length > 0) 
      });
    }
  }, [searchParams, isLoadingLearningWords, learningWords, isQuizLooping, isLearningPlaying, quizDifficulty, conversationAudioUrl, quizMode, startAutoplayAudio]);
```
### Edit: 2025-11-20
- Files: `public/src/CurriculumPracticePage.js`
- Summary: Added punctuation removal from answer comparisons to make answer checking more lenient. Created `removePunctuation` helper function that strips common punctuation marks, and updated answer comparison logic in `handleKeyDown` to normalize both user input and correct answers by removing punctuation before comparison.
- Rationale: User requested to remove punctuation from any answers. This makes the answer checking more forgiving - users can type answers with or without punctuation and they will still be marked correct. This improves UX by reducing false negatives when users accidentally include punctuation or when correct answers contain punctuation.
- Code refs:
```5:9:public/src/CurriculumPracticePage.js
const removePunctuation = (str) => {
  if (!str) return '';
  return String(str).replace(/[.,!?;:()\[\]{}'"`~@#$%^&*+=|\\<>\/\-_]/g, '');
};
```
```1394:1404:public/src/CurriculumPracticePage.js
      const isCorrect = correctAnswers.some(ans => {
        const normalizedInput = removePunctuation(currentInput.toLowerCase().trim());
        const normalizedAns = removePunctuation(String(ans).toLowerCase().trim());
        return normalizedInput === normalizedAns;
      });
      
      if (isCorrect) {
        // Check if all blanks are filled
        const allBlanksFilled = inputValues.length === blankPhrase.blanks.length && 
                                inputValues.every((val, idx) => {
                                  const ans = blankPhrase.correct_answers[idx] || blankPhrase.blanks[idx];
                                  const normalizedVal = removePunctuation(String(val).toLowerCase().trim());
                                  const normalizedAns = removePunctuation(String(ans).toLowerCase().trim());
                                  return normalizedVal === normalizedAns;
                                });
```

### Edit: 2025-11-20
- Files: `public/src/CurriculumPracticePage.js` → `public/src/PracticePage.js`, `public/src/App.js`, `public/src/Navbar.js`, `public/manifest.json`
- Summary: Renamed CurriculumPracticePage component to PracticePage and changed route from "/curriculum-practice" to "/practice". Updated component name, file name, import statements, route definitions, and navigation links.
- Rationale: User requested to rename the file to "practice page" and change the route name to "practice" for a cleaner, shorter URL and component name.
- Code refs:
```47:47:public/src/PracticePage.js
function PracticePage() {
```
```32:32:public/src/App.js
        <Route path="/practice" element={<PracticePage />} />
```
```204:204:public/src/Navbar.js
    practice: { to: '/practice', label: 'Practice', className: 'nav-item nav-item-desktop' },
```

### Edit: 2025-11-20
- Files: `public/src/PracticePage.js`
- Summary: Added functionality to highlight corresponding English words in yellow when Korean words are blanked. Created `fetchEnglishWordIndices` function that uses AI to identify which English words correspond to the blanked Korean words, and updated the translation display to highlight those words with a yellow background.
- Rationale: User requested that the corresponding English words of the blanks be highlighted in yellow to help learners understand which English words correspond to the Korean blanks they need to fill in.
- Code refs:
```1154:1195:public/src/PracticePage.js
  // Fetch English word indices that correspond to Korean blanks
  const fetchEnglishWordIndices = useCallback(async () => {
    if (!currentPhrase || !blankPhrase || !blankPhrase.blanks || blankPhrase.blanks.length === 0) {
      setEnglishWordIndices([]);
      return;
    }
    
    try {
      // Reconstruct full Korean sentence
      const words = blankPhrase.korean.split(' ');
      let blankIdx = 0;
      const fullKorean = words.map(w => {
        if (w === '[BLANK]') {
          const word = blankPhrase.blanks[blankIdx] || '';
          blankIdx++;
          return word;
        }
        return w;
      }).join(' ');
      
      const english = blankPhrase.translation;
      const blankWords = blankPhrase.blanks.join(', ');
      
      const prompt = `Return ONLY a JSON object with this format: {"indices": [array of English word indices]}.
Given this Korean sentence and its English translation, identify which English words correspond to the Korean words that are blanked.

Korean: ${fullKorean}
English: ${english}
Korean blanked words: ${blankWords}

The English sentence is: "${english}"
Split the English sentence into words (by spaces), and return the 0-based indices of the English words that correspond to the blanked Korean words.

For example, if the English is "I am going to the store" and the blanked Korean word corresponds to "going", return {"indices": [2]}.

Return ONLY the JSON object, no other text.`;
      
      const res = await api.chat(prompt);
      if (res.ok) {
        const data = await res.json();
        const text = data.response || '';
        const m = String(text).match(/\{[\s\S]*\}/);
        if (m) {
          try {
            const obj = JSON.parse(m[0]);
            if (obj && Array.isArray(obj.indices)) {
              setEnglishWordIndices(obj.indices);
              return;
            }
          } catch (_) {}
        }
      }
    } catch (_) {}
    // Fallback: set empty array if we can't determine
    setEnglishWordIndices([]);
  }, [currentPhrase, blankPhrase]);
```
```323:330:public/src/PracticePage.js
  // Fetch English word indices when blank phrase changes
  useEffect(() => {
    if (blankPhrase && blankPhrase.blanks && blankPhrase.blanks.length > 0) {
      fetchEnglishWordIndices();
    } else {
      setEnglishWordIndices([]);
    }
  }, [blankPhrase, fetchEnglishWordIndices]);
```
```1752:1772:public/src/PracticePage.js
      <p className="translation" style={{ marginTop: 8, textAlign: 'center' }}>
        {(() => {
          const translation = blankPhrase.translation || '';
          const words = translation.split(/(\s+)/);
          const highlightIndices = new Set(englishWordIndices || []);
          let wordIndex = 0;
          return words.map((word, idx) => {
            // Skip whitespace-only segments
            if (/^\s+$/.test(word)) {
              return <React.Fragment key={idx}>{word}</React.Fragment>;
            }
            const shouldHighlight = highlightIndices.has(wordIndex);
            wordIndex++;
            if (shouldHighlight) {
              return (
                <span key={idx} style={{ backgroundColor: '#ffff00', padding: '2px 0' }}>
                  {word}
                </span>
              );
            }
            return <React.Fragment key={idx}>{word}</React.Fragment>;
          });
        })()}
      </p>
```

### Edit: 2025-01-20
- Files: `public/src/AudioLearningPage.js`, `public/src/PracticePage.js`
- Summary: Updated "Generate New Conversation" button to automatically generate English word indices mapping for each sentence when creating new conversations. PracticePage now uses pre-computed mappings when available, falling back to API calls only when needed.
- Rationale: User requested that when generating new conversations, the system should also generate indices for which English words correspond to blanks, so that highlighting works immediately without additional API calls in PracticePage.
- Code refs:
```1049:1052:public/src/AudioLearningPage.js
  // Generate English word indices for a Korean-English sentence pair
  // Returns a mapping: { koreanWord: englishWordIndex }
  const generateEnglishWordIndices = React.useCallback(async (korean, english, blankWords = []) => {
```
```1105:1120:public/src/AudioLearningPage.js
  // Generate a new conversation and load into UI
  const handleGenerateNewConversation = React.useCallback(async () => {
    try {
      const batch = await generateConversationSet(conversationContextKorean, conversationContextEnglish);
      if (Array.isArray(batch) && batch.length > 0) {
        // Generate English word indices for each sentence
        const batchWithIndices = await Promise.all(batch.map(async (sent) => {
          try {
            const mapping = await generateEnglishWordIndices(sent.korean, sent.english);
            return {
              ...sent,
              englishWordMapping: mapping // Store mapping for use in PracticePage
            };
          } catch (_) {
            return sent; // Return original if mapping fails
          }
        }));
        setGeneratedSentences(batchWithIndices);
        setConversationAudioUrl('');
      }
    } catch (_) {}
  }, [conversationContextKorean, conversationContextEnglish, generateConversationSet, generateEnglishWordIndices]);
```
```363:375:public/src/PracticePage.js
      // Check if we have a pre-computed mapping from AudioLearningPage
      if (currentPhrase && currentPhrase.englishWordMapping && typeof currentPhrase.englishWordMapping === 'object') {
        const mapping = currentPhrase.englishWordMapping;
        const indices = [];
        
        // Look up each blank word in the mapping
        for (const blankWord of blankPhrase.blanks) {
          const index = mapping[blankWord];
          if (typeof index === 'number' && index >= 0) {
            indices.push(index);
          }
        }
        
        if (indices.length > 0) {
```

### Edit: 2025-01-20
- Files: `public/src/PracticePage.js`
- Summary: Enhanced English word indices lookup to be more robust when using pre-computed mappings. Added fallback logic to try multiple matching strategies (exact match, trimmed match, partial match) and improved error handling with console logging for debugging.
- Rationale: User reported that blanked words weren't being highlighted. The issue was that the pre-computed mapping lookup might fail if Korean words don't match exactly. Added more flexible matching and ensured API fallback still works if pre-computed mapping fails.
- Code refs:
```365:384:public/src/PracticePage.js
      // Check if we have a pre-computed mapping from AudioLearningPage
      if (currentPhrase && currentPhrase.englishWordMapping && typeof currentPhrase.englishWordMapping === 'object') {
        const mapping = currentPhrase.englishWordMapping;
        const indices = [];
        
        // Look up each blank word in the mapping
        for (const blankWord of blankPhrase.blanks) {
          // Try exact match first
          let index = mapping[blankWord];
          
          // If no exact match, try trimmed version
          if (typeof index !== 'number' || index < 0) {
            index = mapping[blankWord.trim()];
          }
          
          // If still no match, try to find a key that contains the blank word or vice versa
          if (typeof index !== 'number' || index < 0) {
            for (const [key, val] of Object.entries(mapping)) {
              if (key.includes(blankWord) || blankWord.includes(key)) {
                index = val;
                break;
              }
            }
          }
          
          if (typeof index === 'number' && index >= 0) {
            indices.push(index);
          }
        }
```

### Edit: 2025-11-22
- Files: `public/src/AudioLearningPage.js`
- Summary: Updated audio generation format in learning mode and recording mode to follow the sequence: English sentence, Korean sentence, each Korean word with its translation, then the whole Korean sentence again.
- Rationale: User requested consistent audio format across all modes. The learning mode (`handlePlayLearningMode`) was playing Korean first, then English, but should start with English. The recording mode was only playing the Korean answer after recording, but should provide full explanation with word-by-word breakdown.
- Code refs:
```1411:1441:public/src/AudioLearningPage.js
      await ensureLearningWords();
      while (playingRef.current) {
        await waitWhilePaused(); if (!playingRef.current) break;
        const s = await generateLearningSentence();
        if (!s) break;
        // 1. English sentence first
        updateMediaSession(s.english, 'English', true);
        await waitWhilePaused(); if (!playingRef.current) break;
        await speak(s.english, 'en-US', 1.0);
        if (!playingRef.current) break;
        // 2. Korean sentence second
        updateMediaSession(s.korean, 'Korean', true);
        await waitWhilePaused(); if (!playingRef.current) break;
        await speak(s.korean, 'ko-KR', 1.0);
        if (!playingRef.current) break;
        // 3. Each Korean word and its translation
        const toks = Array.isArray(s.tokens) ? s.tokens : [];
        for (const t of toks) {
          if (!playingRef.current) break;
          updateMediaSession(String(t.ko || ''), 'Korean', true);
          await waitWhilePaused(); if (!playingRef.current) break;
          await speak(String(t.ko || ''), 'ko-KR', 1.0);
          if (!playingRef.current) break;
          updateMediaSession(String(t.en || ''), 'English', true);
          await waitWhilePaused(); if (!playingRef.current) break;
          await speak(String(t.en || ''), 'en-US', 1.0);
          await new Promise(r => setTimeout(r, 150));
        }
        if (!playingRef.current) break;
        // 4. Whole Korean sentence again
        updateMediaSession(s.korean, 'Korean', true);
        await waitWhilePaused(); if (!playingRef.current) break;
        await speak(s.korean, 'ko-KR', 1.0);
        await new Promise(r => setTimeout(r, 400));
      }
```
```2038:2076:public/src/AudioLearningPage.js
          if (recordedAudioUrl) {
            await waitWhilePaused(); if (!playingRef.current) break;
            await speak('한국어로', 'ko-KR', 1.0);
          }
          if (!playingRef.current || !quizLoopRef.current) break;
          
          // Explanation format: English sentence, Korean sentence, word pairs, Korean sentence again
          // 1. English sentence
          updateMediaSession(english, 'English', true);
          await waitWhilePaused(); if (!playingRef.current) break;
          await speak(english, 'en-US', 1.0);
          if (!playingRef.current || !quizLoopRef.current) break;
          await waitWhilePaused(); if (!playingRef.current) break;
          // 2. Korean sentence
          updateMediaSession(korean, 'Korean', true);
          await waitWhilePaused(); if (!playingRef.current) break;
          await speak(korean, 'ko-KR', 1.0);
          if (!playingRef.current || !quizLoopRef.current) break;
          await waitWhilePaused(); if (!playingRef.current) break;
          // 3. Each Korean word and its translation
          try {
            const pairs = await getWordByWordPairs(english, korean);
            if (Array.isArray(pairs) && pairs.length > 0) {
              for (const pair of pairs) {
                if (!playingRef.current || !quizLoopRef.current) break;
                updateMediaSession(String(pair.ko || ''), 'Korean', true);
                await waitWhilePaused(); if (!playingRef.current) break;
                await speak(String(pair.ko || ''), 'ko-KR', 1.0);
                if (!playingRef.current || !quizLoopRef.current) break;
                updateMediaSession(String(pair.en || ''), 'English', true);
                await waitWhilePaused(); if (!playingRef.current) break;
                await speak(String(pair.en || ''), 'en-US', 1.0);
                await new Promise(r => setTimeout(r, 150));
              }
            }
          } catch (_) {
            // Fallback: if word pairs fail, continue without them
          }
          if (!playingRef.current || !quizLoopRef.current) break;
          await waitWhilePaused(); if (!playingRef.current) break;
          // 4. Whole Korean sentence again
          updateMediaSession(korean, 'Korean', true);
          await waitWhilePaused(); if (!playingRef.current) break;
          await speak(korean, 'ko-KR', 1.0);
```

### Edit: 2025-11-22
- Files: `public/src/AudioLearningPage.js`
- Summary: Updated conversation generation to enforce one phrase per line with no periods in the middle. Modified `generateConversationSet` prompts to explicitly require single-phrase statements and added post-processing to clean up any periods that appear mid-sentence.
- Rationale: User requested that generated conversations have only one phrase per line and avoid periods in the middle. This ensures cleaner, simpler conversation turns that are easier to process and display.
- Code refs:
```1097:1125:public/src/AudioLearningPage.js
      let prompt = `Return ONLY a JSON array of 5 objects like:
[{"speaker":"A","korean":"...","english":"..."}, ...]
Requirements:
- Natural everyday conversation in polite style (요), 7–12 Korean words per turn
- Each turn must be EXACTLY ONE phrase/sentence per line (no multiple sentences, no periods in the middle)
- Avoid compound sentences with periods separating clauses; use simple, single-phrase statements
- Two speakers alternating ("A" then "B" then "A" then "B" then "A" or vice versa)
- Turns must be contextually related (follow-up questions/answers, short plans, clarifications)
- Avoid rare terms and proper nouns; use common daily-life topics
- Provide accurate English translations`;
      
      // If user provided context sentences, include them in the prompt
      if (contextKorean && contextKorean.trim() && contextEnglish && contextEnglish.trim()) {
        prompt = `Return ONLY a JSON array of 5 objects like:
[{"speaker":"A","korean":"...","english":"..."}, ...]
Create a natural 5-turn conversation that is contextually related to these example sentences:
Korean: ${contextKorean.trim()}
English: ${contextEnglish.trim()}

Requirements:
- Natural everyday conversation in polite style (요), 7–12 Korean words per turn
- Each turn must be EXACTLY ONE phrase/sentence per line (no multiple sentences, no periods in the middle)
- Avoid compound sentences with periods separating clauses; use simple, single-phrase statements
- Two speakers alternating ("A" then "B" then "A" then "B" then "A" or vice versa)
- The conversation should be thematically related to the example sentences above (similar topic, vocabulary, or situation)
- Turns must be contextually related (follow-up questions/answers, short plans, clarifications)
- Avoid rare terms and proper nouns; use common daily-life topics
- Provide accurate English translations`;
      }
```
```1127:1140:public/src/AudioLearningPage.js
      const res = await api.chat(prompt);
      const data = await res.json().catch(() => null);
      const arr = parseJsonArraySafe(data && (data.response || ''));
      const norm = (Array.isArray(arr) ? arr : [])
        .map((x) => {
          let korean = String((x.korean || x.ko || '')).trim();
          let english = String((x.english || x.en || '')).trim();
          
          // Clean up: remove periods in the middle, keep only the first phrase
          // Split by period and take the first part (but preserve question/exclamation marks at the end)
          const koMatch = korean.match(/^([^.]*[.!?]?)/);
          if (koMatch) {
            korean = koMatch[1].trim();
          }
          const enMatch = english.match(/^([^.]*[.!?]?)/);
          if (enMatch) {
            english = enMatch[1].trim();
          }
          
          return {
            speaker: String((x.speaker || x.role || '')).trim() || '',
            korean,
            english,
          };
        })
        .filter((x) => x.korean && x.english)
        .slice(0, 5);
      if (norm.length === 5) {
        return norm.map(({ korean, english }) => ({ korean, english }));
      }
```
```1142:1148:public/src/AudioLearningPage.js
    // Fallback: simple coherent seed conversation (5 turns)
    const seeds = [
      { korean: '오늘 저녁에 시간 있으세요?', english: 'Do you have time this evening?' },
      { korean: '네, 있어요', english: 'Yes, I do' },
      { korean: '같이 저녁 먹고 산책할까요?', english: 'Shall we have dinner together and take a walk?' },
      { korean: '좋아요! 몇 시에 만날까요?', english: 'Sounds good! What time should we meet?' },
      { korean: '여섯 시 어때요?', english: "How about six?" },
    ];
```

### Edit: 2025-11-22
- Files: `backend/database.js`, `backend/server.js`, `public/src/api.js`, `public/src/MixPage.js`, `public/src/PracticePage.js`, `public/src/App.js`
- Summary: Added mix mode feature similar to Lingvist algorithm. Created MixPage to display current mix state, added mix mode (mode 4) to PracticePage, implemented mix generation with 10 curriculum phrases + 2 conversation sets (10 sentences) + 10 verb practice sentences, and added index tracking in database with random repeats from previous conversations.
- Rationale: User requested a mix mode that combines different practice types (curriculum, conversations, verb practice) with persistent index tracking and random repetition of previous conversation sentences for spaced repetition learning.
- Code refs:
```241:242:backend/database.js
        -- Mix mode table (stores current mix state and index)
        CREATE TABLE IF NOT EXISTS mix_state (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          current_index INTEGER DEFAULT 0,
          mix_items_json TEXT NOT NULL, -- JSON array of mix items with type and data
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
```
```337:375:backend/database.js
  // Mix state methods
  async getMixState() { ... }
  async setMixState(mixItems, currentIndex = 0) { ... }
  async updateMixIndex(newIndex) { ... }
```
```147:177:backend/server.js
// Mix state API
app.get('/api/mix', async (req, res) => { ... });
app.post('/api/mix/generate', async (req, res) => { ... });
app.put('/api/mix/index', async (req, res) => { ... });
```
```199:210:public/src/api.js
  // Mix API
  getMixState: () => fetch(`${API_BASE_URL}/api/mix`),
  generateMix: (mixItems) => fetch(`${API_BASE_URL}/api/mix/generate`, { ... }),
  updateMixIndex: (index) => fetch(`${API_BASE_URL}/api/mix/index`, { ... }),
```
- DB changes: Added `mix_state` table with singleton row (id=1) storing current_index and mix_items_json
- Deps: No new dependencies

### Edit: 2025-11-22
- Files: `public/src/Navbar.js`
- Summary: Added "Mix" option to the Default Practice Mode settings dropdown.
- Rationale: User requested mix mode to be available in settings so it can be set as the default practice mode.
- Code refs:
```362:365:public/src/Navbar.js
                <option value={1}>Curriculum</option>
                <option value={2}>Verb Practice</option>
                <option value={3}>Conversations</option>
                <option value={4}>Mix</option>
              </select>
```

### Edit: 2025-01-27
- Files: `public/src/verbPractice.js`, `public/src/AudioLearningPage.js`, `public/src/PracticePage.js`, `public/src/MixPage.js`
- Summary: Created a shared verb practice generation algorithm used by AudioLearningPage level 2, PracticePage verb practice mode, and MixPage verb practice generation. All three now use the same `generateVerbPracticeSentence` function from `verbPractice.js`.
- Rationale: User requested that all three locations use the same Level 2 verb practice algorithm to ensure consistency across the application.
- Code refs:
```1:95:public/src/verbPractice.js
// Shared verb practice generation algorithm for Level 2 / Verb Practice mode
import { api } from './api';

/**
 * Generate a verb practice sentence using the Level 2 algorithm
 * @param {Object} options - Optional parameters
 * @param {string} options.dateModifier - Specific date modifier to use (오늘, 어제, 내일). If not provided, randomly selected.
 * @param {string} options.pronoun - Specific pronoun to use (나, 너, 우리, 그, 그녀, 그들). If not provided, randomly selected.
 * @returns {Promise<{korean: string, english: string} | null>}
 */
export async function generateVerbPracticeSentence(options = {}) {
  // ... implementation with AI generation and fallback
}
```
```1316:1335:public/src/AudioLearningPage.js
    if (difficulty === 2) {
      // Level 2: Use shared verb practice algorithm
      const result = await generateVerbPracticeSentence();
      if (result && result.korean && result.english) {
        return { korean: result.korean, english: result.english };
      }
      // Fallback to prior builders if shared function fails
      // ...
    }
```
```1239:1247:public/src/PracticePage.js
      // Mode 2: Verb practice
      if (practiceMode === 2) {
        const result = await generateVerbPracticeSentence();
        if (result && result.korean && result.english) {
          data = {
            korean_text: result.korean,
            english_text: result.english,
            id: `verb-${Date.now()}-${Math.random()}`
          };
        }
```
```113:149:public/src/MixPage.js
      // Generate 5 verb practice sentences, each repeated twice
      const verbPracticeItems = [];
      const generatedVerbs = [];
      const usedSentences = new Set(); // Track used sentences to avoid duplicates
      
      // Vary date modifiers and pronouns for diversity
      const dateModifiers = ['오늘', '어제', '내일'];
      const pronouns = ['나', '너', '우리', '그', '그녀', '그들'];
      
      for (let i = 0; i < 5 && generatedVerbs.length < 5; i++) {
        try {
          // Vary the date modifier and pronoun for each sentence
          const dateMod = dateModifiers[i % dateModifiers.length];
          const pronoun = pronouns[i % pronouns.length];
          
          const result = await generateVerbPracticeSentence({
            dateModifier: dateMod,
            pronoun: pronoun
          });
          // ...
```
- Deps: No new dependencies

### Edit: 2025-01-27
- Files: `public/src/verbPractice.js`
- Summary: Fixed verb practice to use different verbs instead of always using the same verb (e.g., "studying"). Now randomly selects a verb from the list and explicitly instructs the AI to use that specific verb in the prompt.
- Rationale: User reported that verb practice was always using the same verb. The AI prompt was too generic and didn't emphasize verb variety. By selecting a random verb and explicitly requesting it in the prompt, we ensure different verbs are used.
- Code refs:
```28:42:public/src/verbPractice.js
    // Try AI generation first
    try {
      // Select a random verb to emphasize variety
      const selectedVerb = verbs[Math.floor(Math.random() * verbs.length)];
      const selectedVerbKorean = String(selectedVerb.korean || '').trim();
      const selectedVerbEnglish = String(selectedVerb.english || '').replace(/^to\s+/i,'').trim();
      
      // Create verb list with the selected verb first
      const verbList = verbs.map(v => `${String(v.korean || '').trim()} (${String(v.english || '').replace(/^to\s+/i,'').trim()})`).filter(Boolean).join(', ');
      
      // ...
      
      const prompt = `Return ONLY JSON: {"korean":"...","english":"..."}.
Create ONE natural Korean sentence (polite style) that includes exactly one date modifier from [오늘, 어제, 내일] and a simple subject pronoun (나/너/우리/그/그녀/그들).
IMPORTANT: Use the verb "${selectedVerbKorean}" (${selectedVerbEnglish}) in this sentence. If you must use a different verb, choose a different one from this list: ${verbList || '(any common verb)'}.
Conjugate the verb correctly: 오늘 → present (…아요/어요), 어제 → past (…았/었어요), 내일 → future (…(으)ㄹ 거예요).
Keep it <= 10 words. Provide the English translation matching the tense.`;
```

### Edit: 2025-01-27
- Files: `backend/server.js`, `public/src/PracticePage.js`, `public/src/MixPage.js`
- Summary: Fixed PracticePage not picking up stored mix from MixPage. Added better error handling, verification after saving mix, console logging for debugging, and automatic reload when page becomes visible.
- Rationale: User reported that PracticePage wasn't loading the mix generated in MixPage. The issue was that the backend returned null without proper status code, and PracticePage didn't handle the case where mix was generated in another tab/window. Added verification to ensure mix is actually saved, and automatic reload when page becomes visible.
- Code refs:
```153:161:backend/server.js
app.get('/api/mix', async (req, res) => {
  try {
    const state = await db.getMixState();
    if (state === null) {
      // Return 404 when no mix exists
      return res.status(404).json({ error: 'No mix state found' });
    }
    res.json(state);
  } catch (error) {
    console.error('Error fetching mix state:', error);
    res.status(500).json({ error: 'Failed to fetch mix state' });
  }
});
```
```272:310:public/src/MixPage.js
      {/* Mix Algorithm Description */}
      <div className="sentence-box" style={{ marginBottom: 24, background: '#f8f9fa', border: '1px solid #dee2e6' }}>
        <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 18, color: '#333' }}>Mix Algorithm</h3>
        <div style={{ fontSize: 14, color: '#555', lineHeight: 1.6 }}>
          <p style={{ marginTop: 0, marginBottom: 12 }}>
            <strong>Current Mix Generation Algorithm:</strong>
          </p>
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            <li style={{ marginBottom: 8 }}>
              <strong>5 Curriculum Sentences</strong> - Randomly selected from curriculum phrases, each sentence appears <strong>twice</strong> (10 items total)
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong>1 Conversation Set</strong> - One random conversation is selected. All sentences from that conversation appear in their original order, then the entire conversation is <strong>repeated once</strong> (maintains sentence order within each repeat)
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong>5 Verb Practice Sentences</strong> - Generated using the Level 2 verb practice algorithm with varied date modifiers (오늘, 어제, 내일) and pronouns (나, 너, 우리, 그, 그녀, 그들). Each sentence appears <strong>twice</strong> (10 items total)
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong>Shuffling</strong> - All items are grouped by type, then groups are shuffled randomly. Conversation sentences stay together as groups (all sentences from one repeat appear consecutively)
            </li>
            <li style={{ marginBottom: 0 }}>
              <strong>Total Items</strong> - Typically 20-30 items depending on conversation length (10 curriculum + 2×conversation length + 10 verb practice)
            </li>
          </ol>
        </div>
      </div>
```
```163:180:backend/server.js
app.post('/api/mix/generate', async (req, res) => {
  // ... save mix and verify it was saved
  const saved = await db.getMixState();
  if (saved && saved.mix_items && saved.mix_items.length === mixItems.length) {
    console.log(`Mix saved successfully: ${saved.mix_items.length} items`);
    res.json({ success: true, itemCount: mixItems.length });
  } else {
    console.error('Mix save verification failed:', saved);
    res.status(500).json({ error: 'Failed to verify mix was saved' });
  }
});
```
```100:160:public/src/PracticePage.js
  // Function to reload mix state (can be called when needed)
  const reloadMixState = useCallback(async () => {
    // ... loads mix state with proper error handling
  }, [practiceMode, numBlanks, getCandidateBlankIndices, convertMixItemToPhrase]);
  
  // Reload mix state when page becomes visible (in case mix was generated in another tab)
  useEffect(() => {
    if (practiceMode === 4) {
      const handleVisibilityChange = () => {
        if (!document.hidden) {
          reloadMixState();
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [practiceMode, reloadMixState]);
```

### Edit: 2025-01-27
- Files: `public/src/MixPage.js`
- Summary: Added a detailed description of the mix generation algorithm on the Mix page, displayed in a highlighted box above the mix items list.
- Rationale: User requested to document what the current mix algorithm is on the mix page so users can understand how mixes are generated.
- Code refs:
```272:310:public/src/MixPage.js
      {/* Mix Algorithm Description */}
      <div className="sentence-box" style={{ marginBottom: 24, background: '#f8f9fa', border: '1px solid #dee2e6' }}>
        <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 18, color: '#333' }}>Mix Algorithm</h3>
        <div style={{ fontSize: 14, color: '#555', lineHeight: 1.6 }}>
          <p style={{ marginTop: 0, marginBottom: 12 }}>
            <strong>Current Mix Generation Algorithm:</strong>
          </p>
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            <li style={{ marginBottom: 8 }}>
              <strong>5 Curriculum Sentences</strong> - Randomly selected from curriculum phrases, each sentence appears <strong>twice</strong> (10 items total)
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong>1 Conversation Set</strong> - One random conversation is selected. All sentences from that conversation appear in their original order, then the entire conversation is <strong>repeated once</strong> (maintains sentence order within each repeat)
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong>5 Verb Practice Sentences</strong> - Generated using the Level 2 verb practice algorithm with varied date modifiers (오늘, 어제, 내일) and pronouns (나, 너, 우리, 그, 그녀, 그들). Each sentence appears <strong>twice</strong> (10 items total)
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong>Shuffling</strong> - All items are grouped by type, then groups are shuffled randomly. Conversation sentences stay together as groups (all sentences from one repeat appear consecutively)
            </li>
            <li style={{ marginBottom: 0 }}>
              <strong>Total Items</strong> - Typically 20-30 items depending on conversation length (10 curriculum + 2×conversation length + 10 verb practice)
            </li>
          </ol>
        </div>
      </div>
```
- Deps: No new dependencies

### Edit: 2025-11-22
- Files: `public/src/PracticePage.js`
- Summary: Updated English word highlighting in translation to use red color (#e74c3c) matching input text styling, and enabled English word index fetching for all practice modes (not just conversation mode).
- Rationale: User requested that English words corresponding to blank Korean words be styled with the same red color as the input text for better visual consistency and clarity across all practice modes.
- Code refs:
```2153:2174:public/src/PracticePage.js
      <p className="translation" style={{ marginTop: 8, textAlign: 'center' }}>
        {(() => {
          const translation = blankPhrase.translation || '';
          // Highlight English words that correspond to blank Korean words in all modes
          // Use the same red color as the input text (#e74c3c)
          if (englishWordIndices && englishWordIndices.length > 0) {
            const words = translation.split(/(\s+)/);
            const highlightIndices = new Set(englishWordIndices || []);
            let wordIndex = 0;
            return words.map((word, idx) => {
              if (/^\s+$/.test(word)) {
                return <React.Fragment key={idx}>{word}</React.Fragment>;
              }
              const shouldHighlight = highlightIndices.has(wordIndex);
              wordIndex++;
              if (shouldHighlight) {
                return (
                  <span key={idx} style={{ color: '#e74c3c', fontWeight: 600 }}>
                    {word}
                  </span>
                );
              }
              return <React.Fragment key={idx}>{word}</React.Fragment>;
            });
          }
          return translation;
        })()}
      </p>
```
```354:361:public/src/PracticePage.js
  // Fetch English word indices that correspond to Korean blanks (for all practice modes)
  const fetchEnglishWordIndices = useCallback(async () => {
    // Removed mode 3 restriction - now works for all practice modes
```
```480:491:public/src/PracticePage.js
  // Fetch English word indices when blank phrase changes (for all practice modes)
  useEffect(() => {
    // Removed check that limited to conversation mode (mode 3)
    // Now fetches English word indices for all practice modes
```

### Edit: 2025-11-22
- Files: `public/src/PracticePage.js`
- Summary: Fixed mix mode to load phrase at current_index directly without skipping, and prevented unnecessary chat API calls on initial page load
- Rationale: User reported that mix sentence was not showing correctly and too many chat API calls were being made when opening the site. The issue was that fetchEnglishWordIndices was making API calls for all modes including mix mode, and the mix phrase loading needed better logging and state management.
- Code refs:
```441:498:public/src/PracticePage.js
      // Skip API call for mix mode to avoid unnecessary chat calls
      // English word highlighting is optional and not critical for mix mode
      if (practiceMode === 4) {
        console.log('[EnglishWordIndices] Skipping API call for mix mode');
        setEnglishWordIndices([]);
        setEnglishWordIndicesPhraseId(phraseId);
        fetchingEnglishIndicesRef.current = false;
        return;
      }
```
```510:540:public/src/PracticePage.js
  // Fetch English word indices when blank phrase changes (skip for mix mode to avoid unnecessary API calls)
  useEffect(() => {
    // Skip entirely for mix mode to avoid unnecessary API calls
    if (practiceMode === 4) {
      setEnglishWordIndices([]);
      setEnglishWordIndicesPhraseId(null);
      return;
    }
```
```859:886:public/src/PracticePage.js
            // Load current item at current_index directly (no skipping)
            if (state.current_index < state.mix_items.length) {
              const currentItem = state.mix_items[state.current_index];
              console.log('Loading phrase at index', state.current_index, 'directly (no skipping)');
              console.log('Current item:', currentItem);
              const phrase = convertMixItemToPhrase(currentItem);
              console.log('Converted phrase:', phrase);
              if (phrase) {
                console.log('Setting current phrase:', phrase.korean_text, phrase.english_text);
                setCurrentPhrase(phrase);
                // ... (blank generation logic)
                // Reset explanation state when loading new phrase
                setExplanationText('');
                setExplanationPhraseId(null);
                setShowExplanation(false);
              }
            }
```
```1906:1925:public/src/PracticePage.js
          // Auto-activate explanation after correct answer (only if explanation is available)
          setTimeout(() => {
            if (!showExplanation) {
              setShowExplanation(true);
              // Only fetch if we don't have a stored explanation
              if (currentPhrase?.grammar_breakdown) {
                // Use stored explanation (no API call needed)
                setExplanationText(currentPhrase.grammar_breakdown);
                setExplanationPhraseId(currentId);
              } else {
                // No stored explanation, fetch via API
                fetchExplanation();
              }
            }
          }, 100);
```

### Edit: 2025-11-22
- Files: `public/src/PracticePage.js`
- Summary: Prevented curriculum phrases from loading in mix mode to avoid unnecessary API calls
- Rationale: User reported that 18 curriculum phrases were being loaded even in mix mode, which is unnecessary since mix items are already stored in the database. This was causing unnecessary API calls and potential confusion.
- Code refs:
```1013:1018:public/src/PracticePage.js
  const loadAllPhrases = useCallback(async () => {
    // Skip loading curriculum phrases for mix mode - not needed
    if (practiceMode === 4) {
      console.log('Skipping loadAllPhrases - mix mode does not need curriculum phrases');
      return;
    }
```

### Edit: 2025-11-22
- Files: `backend/server.js`, `public/src/api.js`, `public/src/MixPage.js`
- Summary: Added functionality to automatically generate and save missing explanations for mix items when mix is loaded
- Rationale: User requested that explanations be saved for each sentence in the mix if they don't exist already. This ensures all mix items have explanations without requiring regeneration of the entire mix.
- Code refs:
```189:202:backend/server.js
app.put('/api/mix/update-items', async (req, res) => {
  try {
    const { mixItems } = req.body || {};
    if (!Array.isArray(mixItems)) {
      return res.status(400).json({ error: 'mixItems array required' });
    }
    // Get current state to preserve current_index
    const currentState = await db.getMixState();
    const currentIndex = currentState ? (currentState.current_index || 0) : 0;
    console.log(`Updating mix items (preserving index ${currentIndex})`);
    await db.setMixState(mixItems, currentIndex);
    res.json({ success: true, itemCount: mixItems.length });
  } catch (error) {
    console.error('Error updating mix items:', error);
    res.status(500).json({ error: 'Failed to update mix items' });
  }
});
```
```200:206:public/src/api.js
  updateMixItems: (mixItems) => fetch(`${API_BASE_URL}/api/mix/update-items`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mixItems })
  }),
```
```64:105:public/src/MixPage.js
  // Function to fill missing explanations in mix items
  const fillMissingExplanations = useCallback(async (mixItems) => {
    // Checks each item for missing explanations
    // Generates explanations for items that don't have them
    // Updates mix state in database with new explanations
    // Preserves current_index when updating
  }, [generateExplanation]);
```

### Edit: 2025-11-22
- Files: `public/src/PracticePage.js`
- Summary: Changed mix mode progress display from "X / Y phrases (session)" to "Item X of Y" to show current position in the mix
- Rationale: User requested that the display show which place they are in the mix instead of the generic "phrases (session)" format. This makes it clearer for mix mode that it's showing position in the mix sequence.
- Code refs:
```2401:2409:public/src/PracticePage.js
            <h3 style={{ margin: '4px 0 0 0', color: '#6b7280', fontWeight: 600 }}>
              {practiceMode === 4 ? (
                activeTotal > 0 ? (
                  <>Item {activeUsed + 1} of {activeTotal}</>
                ) : (
                  <>Loading mix...</>
                )
              ) : (
                <>{activeUsed} / {activeTotal} phrases (session)</>
              )}
            </h3>
```

### Edit: 2025-11-22
- Files: `backend/number_converter.js`, `backend/translate.js`, `backend/chat.js`, `backend/generate.js`, `public/src/verbPractice.js`, `public/src/AudioLearningPage.js`
- Summary: Added Korean number conversion system to translate Arabic numerals to Korean words (Sino-Korean for counting/dates, Native Korean for time/age/objects)
- Rationale: User requested that numbers be translated into correct Korean words for speaking - using 구 (Sino-Korean) for counting and 아홉 (Native Korean) for times like 9시. This ensures proper Korean pronunciation in TTS and text generation.
- Code refs:
```1:120:backend/number_converter.js
// Korean number converter - converts Arabic numerals to Korean words
// Uses Sino-Korean (일, 이, 삼...) for counting, dates, money
// Uses Native Korean (하나, 둘, 셋...) for time, age, counting objects
```
```15:25:backend/translate.js
    const correctionPrompt = (
      '...'
      + '\n\nCRITICAL FOR KOREAN OUTPUT: For any numbers, use Korean words (not Arabic numerals):'
      + '\n- For time (시, 시간): use Native Korean (하나, 둘, 셋, 넷, 다섯, 여섯, 일곱, 여덟, 아홉, 열, etc.). Example: "9시" should be "아홉 시"'
      + '\n- For counting objects: use Native Korean (하나, 둘, 셋, etc.)'
      + '\n- For dates, money, general counting: use Sino-Korean (일, 이, 삼, 사, 오, 육, 칠, 팔, 구, 십, etc.)'
      + '\nNEVER use Arabic numerals (1, 2, 3, etc.) in Korean text - always convert to Korean words.'
```
```40:47:backend/chat.js
    // Convert numbers to Korean words if the response contains Korean characters
    if (outputText && /[가-힣]/.test(outputText)) {
      outputText = convertNumbersInKoreanText(outputText, prompt);
    }
```

### Edit: 2025-11-22
- Files: `public/src/PracticePage.js`
- Summary: Removed punctuation requirement from blank answer comparisons - punctuation still appears in Korean display but is not required in user input
- Rationale: User requested that punctuation not be required in blank answers, making it easier to type answers. Punctuation is still shown in the Korean sentence display for proper formatting, but users can answer without it.
- Code refs:
```1890:1895:public/src/PracticePage.js
      const isCorrect = correctAnswers.some(ans => {
        // Remove punctuation from comparison - user doesn't need to type punctuation
        const removePunctuation = (str) => String(str || '').trim().replace(/[.,!?;:]/g, '');
        const normalizedInput = removePunctuation(currentInput);
        const normalizedAns = removePunctuation(ans);
        return normalizedInput === normalizedAns;
      });
```
```1898:1906:public/src/PracticePage.js
        // Check if all blanks are filled (punctuation not required)
        const removePunctuation = (str) => String(str || '').trim().replace(/[.,!?;:]/g, '');
        const allBlanksFilled = inputValues.length === blankPhrase.blanks.length && 
                                inputValues.every((val, idx) => {
                                  const ans = blankPhrase.correct_answers[idx] || blankPhrase.blanks[idx];
                                  // Remove punctuation from comparison - user doesn't need to type punctuation
                                  const normalizedVal = removePunctuation(val);
                                  const normalizedAns = removePunctuation(ans);
                                  return normalizedVal === normalizedAns;
                                });
```

### Edit: 2025-11-22
- Files: `backend/database.js`, `backend/server.js`, `public/src/api.js`, `public/src/PracticePage.js`
- Summary: Added database storage for phrase explanations to prevent duplicate AI API calls when clicking explain multiple times
- Rationale: User reported that clicking explain twice makes new API chat calls. Now explanations are saved to database and retrieved on subsequent clicks, avoiding unnecessary AI API calls.

### Edit: 2025-11-22
- Files: `public/src/PracticePage.js`
- Summary: Fixed mix mode progress display stuck on "Loading mix..." by adding mixState to activeSessionData dependency array
- Rationale: User reported that mix progress was stuck showing "Loading mix..." instead of showing current position. The issue was that activeSessionData useMemo didn't include mixState in its dependency array, so it wasn't recalculating when mixState loaded.
- Code refs:
```241:241:public/src/PracticePage.js
  }, [practiceMode, sessionPhrases, allPhrases, verbPracticeSession, conversationSession, usedPhraseIds, mixState]);
```

### Edit: 2025-11-22
- Files: `public/src/TranslationBox.js`
- Summary: Modified sound button to play translation 3 times instead of once
- Rationale: User requested that clicking the sound button should play the translation 3 times for better learning/reinforcement.
- Code refs:
```111:121:public/src/TranslationBox.js
  const handlePlaySound = async () => {
    if (!translatedValue) return;
    try {
      // Play the translated text (Korean) using TTS - play 3 times
      for (let i = 0; i < 3; i++) {
        await speakToAudio(translatedValue, 'ko-KR', 1.0);
        // Small delay between plays (except after the last one)
        if (i < 2) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    } catch (error) {
      console.error('Failed to play audio:', error);
    }
  };
```

### Edit: 2025-01-22
- Files: `public/src/MixPage.js`
- Summary: Fixed infinite loop causing repeated chat API calls when loading mix page. Added multiple refs to prevent loops: `fillExplanationsRunningRef` to prevent multiple simultaneous calls to `fillMissingExplanations`, `explanationsCheckedRef` to track if explanations have already been checked, `loadMixStateRunningRef` to prevent multiple simultaneous calls to `loadMixState`, and `mixStateLoadedRef` to track if mix state has been loaded. Removed `setMixState` call from `fillMissingExplanations` to break the dependency loop. Changed `loadMixState` to use empty dependency array and access `fillMissingExplanations` via ref to avoid dependency chain issues. Changed `useEffect` that calls `loadMixState` to only run once on mount with empty dependency array.
- Rationale: When clicking on the mix page, `fillMissingExplanations` was being called repeatedly, causing an infinite loop of chat API requests that overwhelmed the backend and resulted in rate limit errors (429) and 502 Bad Gateway errors. The loop was caused by multiple factors: (1) `fillMissingExplanations` calling `setMixState`, which triggered `loadMixState` again, (2) `loadMixState` depending on `fillMissingExplanations`, causing it to be recreated whenever `fillMissingExplanations` changed, (3) the `useEffect` depending on `loadMixState`, causing it to rerun whenever `loadMixState` was recreated. The fix breaks all these dependency chains using refs and ensuring functions only run once.
- Code refs:
```6:13:public/src/MixPage.js
  const [generating, setGenerating] = useState(false);
  const fillExplanationsRunningRef = useRef(false);
  const explanationsCheckedRef = useRef(false);
  const loadMixStateRunningRef = useRef(false);
  const mixStateLoadedRef = useRef(false);
```

```119:124:public/src/MixPage.js
  // Store fillMissingExplanations in a ref to avoid dependency issues
  const fillMissingExplanationsRef = useRef(fillMissingExplanations);
  useEffect(() => {
    fillMissingExplanationsRef.current = fillMissingExplanations;
  }, [fillMissingExplanations]);
```

```33:105:public/src/MixPage.js
  const fillMissingExplanations = useCallback(async (mixItems) => {
    if (!Array.isArray(mixItems)) return;
    
    // Prevent multiple simultaneous calls
    if (fillExplanationsRunningRef.current) {
      console.log('fillMissingExplanations already running, skipping...');
      return;
    }
    
    fillExplanationsRunningRef.current = true;
    
    try {
      // ... explanation generation logic ...
      // Update mix state if we generated any explanations
      if (hasUpdates) {
        console.log(`Updating mix with ${updatedItems.length} items (added missing explanations)`);
        try {
          const updateRes = await api.updateMixItems(updatedItems);
          if (updateRes.ok) {
            console.log('Mix updated successfully with new explanations');
            // Don't reload state here - just update the database
            // The user can manually refresh if needed, or we'll reload on next visit
          } else {
            console.error('Failed to update mix items:', updateRes.status);
          }
        } catch (err) {
          console.error('Error updating mix items:', err);
        }
      } else {
        console.log('All mix items already have explanations');
      }
    } finally {
      fillExplanationsRunningRef.current = false;
    }
  }, [generateExplanation]);
```

```125:171:public/src/MixPage.js
  const loadMixState = useCallback(async () => {
    // Prevent multiple simultaneous calls
    if (loadMixStateRunningRef.current) {
      console.log('loadMixState already running, skipping...');
      return;
    }
    
    loadMixStateRunningRef.current = true;
    
    try {
      setLoading(true);
      setError('');
      const res = await api.getMixState();
      if (!res.ok) {
        if (res.status === 404) {
          setMixState(null);
          setLoading(false);
          explanationsCheckedRef.current = false; // Reset when no mix exists
          mixStateLoadedRef.current = true;
          return;
        }
        throw new Error(`Failed to fetch mix state: ${res.status}`);
      }
      const data = await res.json();
      setMixState(data);
      mixStateLoadedRef.current = true;
      
      // Check and fill missing explanations only once per mix load
      // Use a ref to track if we've already checked this mix
      if (data && data.mix_items && Array.isArray(data.mix_items) && !explanationsCheckedRef.current) {
        explanationsCheckedRef.current = true;
        // Run asynchronously without blocking the UI - use ref to avoid dependency
        fillMissingExplanationsRef.current(data.mix_items).catch(err => {
          console.error('Error filling missing explanations:', err);
          explanationsCheckedRef.current = false; // Reset on error so we can retry
        });
      }
    } catch (e) {
      console.error('Error loading mix state:', e);
      setError(e instanceof Error ? e.message : 'Failed to load mix state');
      explanationsCheckedRef.current = false; // Reset on error
      mixStateLoadedRef.current = true; // Mark as loaded even on error to prevent retry loop
    } finally {
      setLoading(false);
      loadMixStateRunningRef.current = false;
    }
  }, []); // No dependencies - use refs to access functions
```

```173:177:public/src/MixPage.js
  useEffect(() => {
    // Only load mix state once on mount
    if (!mixStateLoadedRef.current) {
      loadMixState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run once on mount
```

### Edit: 2025-01-22
- Files: `public/src/ScorePage.js`, `public/src/PracticePage.js`, `public/src/App.js`, `public/nav-order.json`, `backend/server.js`, `backend/database.js`, `public/src/api.js`
- Summary: Added score tracking and display for mix practice. Created ScorePage component to display daily mix scores. Updated PracticePage to track first-try correct answers (without clicking "Show Answer") and save scores when mix completes. Added API endpoint to reset mix state. Added route and navigation link for ScorePage.
- Rationale: User requested that when mix completes, the score (number of correct answers on first try without clicking "Show Answer") should be stored in the database and displayed in a score page with the current date. The mix should then reset to question 1 and the first_try_correct_count should reset to 0.
- Code refs:
```1:95:public/src/ScorePage.js
import React, { useState, useEffect } from 'react';
import { api } from './api';
import './styles/HomePage.css';

function ScorePage() {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadScores = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await api.getMixScores(30);
        if (!res.ok) {
          throw new Error(`Failed to fetch scores: ${res.status}`);
        }
        const data = await res.json();
        setScores(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('Error loading scores:', e);
        setError(e instanceof Error ? e.message : 'Failed to load scores');
      } finally {
        setLoading(false);
      }
    };

    loadScores();
  }, []);

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch (e) {
      return dateString;
    }
  };

  const calculatePercentage = (firstTryCorrect, totalQuestions) => {
    if (!totalQuestions || totalQuestions === 0) return 0;
    return Math.round((firstTryCorrect / totalQuestions) * 100);
  };
  // ... rest of component renders score cards with date, total questions, first try correct, and accuracy percentage
```

```1973:1980:public/src/PracticePage.js
        if (allBlanksFilled) {
          // All blanks are correct!
          setFeedback('All correct! Great job!');
          
          // Track first-try correct for mix mode (only if user didn't click "Show Answer")
          if (practiceMode === 4 && !showAnswer && !showAnswerBelow) {
            try {
              await api.incrementMixFirstTryCorrect();
            } catch (err) {
              console.error('Failed to increment first try correct:', err);
            }
          }
```

```2197:2235:public/src/PracticePage.js
                  } else {
                    // Mix completed! Save score and reset mix
                    (async () => {
                      try {
                        // Get final mix state to get first_try_correct_count
                        const res = await api.getMixState();
                        if (res.ok) {
                          const finalState = await res.json();
                          const totalQuestions = finalState.mix_items?.length || 0;
                          const firstTryCorrect = finalState.first_try_correct_count || 0;
                          
                          // Save score
                          if (totalQuestions > 0) {
                            await api.saveMixScore(totalQuestions, firstTryCorrect);
                            console.log(`Mix score saved: ${firstTryCorrect}/${totalQuestions}`);
                          }
                          
                          // Reset mix state (index to 0, first_try_correct_count to 0)
                          await api.resetMixState();
                          
                          // Reload mix state to reflect reset
                          const reloadRes = await api.getMixState();
                          if (reloadRes.ok) {
                            const resetState = await reloadRes.json();
                            setMixState(resetState);
                          }
                          
                          setFeedback(`Mix completed! Score: ${firstTryCorrect}/${totalQuestions} (${Math.round((firstTryCorrect / totalQuestions) * 100)}%). Mix reset to question 1.`);
                        }
                      } catch (err) {
                        console.error('Error saving score and resetting mix:', err);
                        setFeedback('Mix completed! (Error saving score)');
                      }
                    })();
                  }
```

```422:432:backend/database.js
  async resetMixState() {
    return new Promise((resolve, reject) => {
      const sql = `UPDATE mix_state SET current_index = 0, first_try_correct_count = 0, updated_at = CURRENT_TIMESTAMP WHERE id = 1`;
      this.db.run(sql, [], function(err) {
        if (err) return reject(err);
        resolve(this.changes > 0);
      });
    });
  }
```

```256:264:backend/server.js
app.post('/api/mix/reset', async (req, res) => {
  try {
    const updated = await db.resetMixState();
    res.json({ success: true, updated });
  } catch (error) {
    console.error('Error resetting mix state:', error);
    res.status(500).json({ error: 'Failed to reset mix state' });
  }
});
```

- DB changes: Uses existing `mix_scores` table to store daily scores. `resetMixState` resets `current_index` and `first_try_correct_count` in `mix_state` table.
- API endpoints: Added `POST /api/mix/reset` to reset mix state (index to 0, first_try_correct_count to 0).

### Edit: 2025-01-22
- Files: `public/src/PracticePage.js`
- Summary: Fixed mix reset to properly load the first question after completion. Added delay after reset to ensure database update completes before reloading. Fixed index display to prevent showing incorrect numbers. Updated `reloadMixState` to use explicit `currentIndex` variable.
- Rationale: After mix completion and reset, the first question wasn't displaying correctly and the current index wasn't being updated in the UI. The issue was that `reloadMixState` needed to properly handle the reset state and ensure the first question loads.
- Code refs:
```860:863:public/src/PracticePage.js
            // Load current item at current_index directly (no skipping)
            // After reset, current_index should be 0, so we load the first item
            const currentIndex = state.current_index || 0;
            if (currentIndex < state.mix_items.length) {
```

```2257:2263:public/src/PracticePage.js
                          // Reset mix state (index to 0, first_try_correct_count to 0)
                          await api.resetMixState();
                          
                          // Small delay to ensure database update is complete
                          await new Promise(resolve => setTimeout(resolve, 100));
                          
                          // Reload mix state to reflect reset and load first question
                          await reloadMixState();
```

```2546:2548:public/src/PracticePage.js
              {practiceMode === 4 ? (
                activeTotal > 0 ? (
                  <>Item {Math.min(activeUsed + 1, activeTotal)} of {activeTotal}</>
```

### Edit: 2025-01-22
- Files: `public/src/Navbar.js`
- Summary: Added "Scores" navigation item to the navbar. Added `scores` to the `items` object and to the default `navOrder` array.
- Rationale: User requested to add the scores page to the navigation bar so it's easily accessible.
- Code refs:
```197:210:public/src/Navbar.js
  const items = {
    home: { to: '/', label: 'Home', className: 'nav-item nav-item-desktop' },
    practice: { to: '/practice', label: 'Practice', className: 'nav-item nav-item-desktop' },
    mix: { to: '/mix', label: 'Mix', className: 'nav-item nav-item-desktop' },
    scores: { to: '/scores', label: 'Scores', className: 'nav-item nav-item-desktop' },
    translate: { to: '/translate', label: 'Translate', className: 'nav-item nav-item-desktop' },
    // ... rest of items
  };
```

```38:41:public/src/Navbar.js
  const [navOrder, setNavOrder] = React.useState(() => {
    // Default order if config not loaded
    return ['practice','mix','scores','translate','audio','journal','curriculum','kpop','stats','pronunciation','chat','journal-entries','home'];
  });
```

### Edit: 2025-01-27
- Files: `public/src/PracticePage.js`, `public/src/MixPage.js`, `public/src/TranslationPage.js`, `public/src/ChatPage.js`
- Summary: Updated all explanation generation prompts to explicitly instruct the AI not to include romanizations (like "naeil" or "mollayo") in explanations. Only Korean characters and English translations should be used.
- Rationale: User requested that explanations should not include romanizations, as they are not helpful for learning and clutter the explanation text.
- Code refs:
```1709:1714:public/src/PracticePage.js
      const prompt = `Explain this Korean sentence in detail.
Korean: ${fullKorean}
English: ${english}
Please include a clear breakdown of grammar (particles, tense, politeness), vocabulary with brief glosses, and any important notes for a learner.
Break down particles such as 은/는, 이/가, 을/를, 에, 에서, etc, verbs and their root forms, and pronouns
Keep it concise and structured, focusing on helping someone understand how the sentence works.
IMPORTANT: Do NOT include romanizations (like "naeil" or "mollayo") in your explanation. Only use Korean characters and English translations.`;
```

```19:24:public/src/MixPage.js
      const prompt = `Explain this Korean sentence in detail.
Korean: ${korean}
English: ${english}
Please include a clear breakdown of grammar (particles, tense, politeness), vocabulary with brief glosses, and any important notes for a learner.
Break down particles such as 은/는, 이/가, 을/를, 에, 에서, etc, verbs and their root forms, and pronouns
Keep it concise and structured, focusing on helping someone understand how the sentence works.
IMPORTANT: Do NOT include romanizations (like "naeil" or "mollayo") in your explanation. Only use Korean characters and English translations.`;
```

```68:72:public/src/TranslationPage.js
        const prompt = `Explain the Korean translation in detail.
Original (user): ${lastContext.input}
Translation (ko): ${lastContext.translation}
Please include a clear breakdown of grammar (particles, tense, politeness), vocabulary with brief glosses, and any pronunciation notes.
Keep it concise and structured for a learner.
IMPORTANT: Do NOT include romanizations (like "naeil" or "mollayo") in your explanation. Only use Korean characters and English translations.`;
```

```22:26:public/src/ChatPage.js
      const prompt = `Explain the Korean translation in detail.
Original (user): ${input}
Translation (ko): ${translation}
Please include a clear breakdown of grammar (particles, tense, politeness), vocabulary with brief glosses, and any pronunciation notes.
Keep it concise and structured for a learner.
IMPORTANT: Do NOT include romanizations (like "naeil" or "mollayo") in your explanation. Only use Korean characters and English translations.`;
```

### Edit: 2025-01-27
- Files: `backend/database.js`, `public/src/PracticePage.js`
- Summary: Added migration function `ensureMixStateColumns()` to check and add the `first_try_correct_count` column to the `mix_state` table if it doesn't exist. Updated `resetMixState()` to use `UPDATE` instead of `INSERT OR REPLACE` and to ensure the column exists before resetting. Added index validation in `reloadMixState()` to prevent out-of-bounds index values and automatically fix invalid indices.
- Rationale: The `first_try_correct_count` column was missing from existing databases, causing 500 errors when trying to increment or reset the mix state. The reset function was also not correctly resetting the index to 0. Additionally, the mix index could become invalid (out of bounds) after reset, causing display issues.
- Code refs:
```423:430:backend/database.js
  async ensureMixStateColumns() {
    return new Promise((resolve, reject) => {
      // Check if mix_state table exists
      this.db.all(`SELECT name FROM sqlite_master WHERE type='table' AND name='mix_state'`, (err, tables) => {
        if (err) return reject(err);
        if (!tables || tables.length === 0) {
          // Table doesn't exist, will be created by createTables
          return resolve();
        }
        
        // Table exists, check if first_try_correct_count column exists
        this.db.all(`PRAGMA table_info(mix_state)`, (err, cols) => {
          if (err) return reject(err);
          const colNames = (cols || []).map(c => c.name);
          if (!colNames.includes('first_try_correct_count')) {
            // Add the missing column
            this.db.run(`ALTER TABLE mix_state ADD COLUMN first_try_correct_count INTEGER DEFAULT 0`, (alterErr) => {
              if (alterErr) {
                console.warn('Warning: Could not add first_try_correct_count column:', alterErr);
                // Don't reject - column might already exist from concurrent operation
              } else {
                console.log('✅ Added first_try_correct_count column to mix_state table');
              }
              resolve();
            });
          } else {
            resolve();
          }
        });
      });
    });
  }
```

```432:461:backend/database.js
  async resetMixState() {
    return new Promise((resolve, reject) => {
      // First ensure the column exists
      this.ensureMixStateColumns()
        .then(() => {
          // Use UPDATE to reset the index and first_try_correct_count
          // Preserve the mix_items_json so we don't lose the mix items
          const sql = `UPDATE mix_state SET current_index = 0, first_try_correct_count = 0, updated_at = CURRENT_TIMESTAMP WHERE id = 1`;
          this.db.run(sql, [], function(err) {
            if (err) {
              // If update fails (no row exists), create it
              if (err.message && err.message.includes('no such table')) {
                // Table doesn't exist, will be created on next init
                return reject(err);
              }
              // Try INSERT if UPDATE didn't affect any rows
              if (this.changes === 0) {
                const insertSql = `INSERT INTO mix_state (id, current_index, mix_items_json, first_try_correct_count, created_at, updated_at)
                                   VALUES (1, 0, '[]', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
                this.db.run(insertSql, [], function(insertErr) {
                  if (insertErr) return reject(insertErr);
                  resolve(true);
                });
              } else {
                reject(err);
              }
            } else {
              resolve(this.changes > 0);
            }
          });
        })
        .catch(reject);
    });
  }
```

```874:884:public/src/PracticePage.js
            // Load current item at current_index directly (no skipping)
            // After reset, current_index should be 0, so we load the first item
            let currentIndex = typeof state.current_index === 'number' ? state.current_index : 0;
            // Ensure index is valid (0 to length-1)
            if (currentIndex < 0) currentIndex = 0;
            if (currentIndex >= state.mix_items.length) {
              console.warn('currentIndex out of bounds, resetting to 0. currentIndex:', currentIndex, 'length:', state.mix_items.length);
              currentIndex = 0;
              // Update the database to fix the invalid index
              api.updateMixIndex(0).catch(err => console.error('Failed to fix index:', err));
            }
            console.log('reloadMixState - currentIndex:', currentIndex, 'total items:', state.mix_items.length, 'state.current_index:', state.current_index);
            if (currentIndex < state.mix_items.length) {
              const currentItem = state.mix_items[currentIndex];
              console.log('Loading phrase at index', currentIndex, 'directly (no skipping)');
```
- DB changes: Added migration logic to ensure `first_try_correct_count` column exists in `mix_state` table. The column is added via `ALTER TABLE` if missing.

### Edit: 2025-01-27
- Files: `backend/database.js`
- Summary: Added the missing `ensureMixStateColumns()` function definition that was being called but didn't exist. The function checks if the `mix_state` table exists and if the `first_try_correct_count` column exists, adding it if missing. Also updated `incrementMixFirstTryCorrect()` to call `ensureMixStateColumns()` before attempting to update the column.
- Rationale: The `ensureMixStateColumns()` function was being called in multiple places but was never actually defined, causing 500 errors when trying to increment or reset the mix state. The function now properly handles migration for existing databases.
- Code refs:
```1843:1875:backend/database.js
  async ensureMixStateColumns() {
    return new Promise((resolve, reject) => {
      // Check if mix_state table exists
      this.db.all(`SELECT name FROM sqlite_master WHERE type='table' AND name='mix_state'`, (err, tables) => {
        if (err) return reject(err);
        if (!tables || tables.length === 0) {
          // Table doesn't exist, will be created by createTables
          return resolve();
        }
        
        // Table exists, check if first_try_correct_count column exists
        this.db.all(`PRAGMA table_info(mix_state)`, (err, cols) => {
          if (err) return reject(err);
          const colNames = (cols || []).map(c => c.name);
          if (!colNames.includes('first_try_correct_count')) {
            // Add the missing column
            this.db.run(`ALTER TABLE mix_state ADD COLUMN first_try_correct_count INTEGER DEFAULT 0`, (alterErr) => {
              if (alterErr) {
                // Check if error is because column already exists (race condition)
                if (alterErr.message && alterErr.message.includes('duplicate column')) {
                  console.log('Column first_try_correct_count already exists');
                  return resolve();
                }
                console.warn('Warning: Could not add first_try_correct_count column:', alterErr);
                // Don't reject - column might already exist from concurrent operation
                return resolve();
              } else {
                console.log('✅ Added first_try_correct_count column to mix_state table');
                resolve();
              }
            });
          } else {
            resolve();
          }
        });
      });
    });
  }
```

```423:435:backend/database.js
  async incrementMixFirstTryCorrect() {
    return new Promise((resolve, reject) => {
      // First ensure the column exists
      this.ensureMixStateColumns()
        .then(() => {
          const sql = `UPDATE mix_state SET first_try_correct_count = COALESCE(first_try_correct_count, 0) + 1, updated_at = CURRENT_TIMESTAMP WHERE id = 1`;
          this.db.run(sql, [], function(err) {
            if (err) return reject(err);
            resolve(this.changes > 0);
          });
        })
        .catch(reject);
    });
  }
```
- DB changes: The `ensureMixStateColumns()` function now properly migrates existing databases by adding the `first_try_correct_count` column if it doesn't exist.


### Edit: 2025-01-27
- Files: `public/src/PracticePage.js`
- Summary: Removed explanation clearing when moving to new questions; updated explanation prompt to prioritize consonant/vowel ending rules (받침 rules).
- Rationale: UX improvement - users can now see previous explanation while new one loads, and better grammar explanations focusing on 받침-based rules which are fundamental to Korean grammar.
- Code refs:
```906:909:public/src/PracticePage.js
                setRandomBlankIndices(chosen.sort((a, b) => a - b));
                setInputValues(new Array(chosen.length).fill(''));
                setCurrentBlankIndex(0);
                // Keep explanation from previous question - don't clear it
```

```1708:1720:public/src/PracticePage.js
      // If not in database, generate explanation via AI
      const prompt = `Explain this Korean sentence in detail.
Korean: ${fullKorean}
English: ${english}

IMPORTANT: Start by highlighting any grammar rules involving endings based on consonant/vowel (받침 rules). This includes:
- Whether a stem ends with a consonant (받침) or vowel (no 받침)
- How endings change based on 받침 presence (e.g., 은/는, 이/가, 을/를, 아요/어요, 았어요/었어요)
- Consonant assimilation rules (e.g., ㄷ irregular verbs, ㅂ irregular verbs, ㄹ irregular verbs)
- Vowel harmony rules (bright vs dark vowels affecting ending choice)
- Any 받침-related sound changes or contractions

Then include a clear breakdown of:
- Particles (은/는, 이/가, 을/를, 에, 에서, etc.) and their functions
- Tense and politeness levels
- Vocabulary with brief glosses
- Verb/adjective root forms and conjugations
- Pronouns and their usage
- Any other important grammar points

Keep it concise and structured, focusing on helping someone understand how the sentence works.
IMPORTANT: Do NOT include romanizations (like "naeil" or "mollayo") in your explanation. Only use Korean characters and English translations.`;
```

- Changes made in multiple locations: removed `setExplanationText('')`, `setExplanationPhraseId(null)`, and `setShowExplanation(false)` calls from:
  - `reloadMixState` function (line ~907-909)
  - `fetchRandomPhrase` for verb practice mode (line ~1426-1428)
  - `fetchRandomPhrase` for mix mode random repeat (line ~1462-1464)
  - `fetchRandomPhrase` for mix mode current item (line ~1501-1503)
  - `fetchRandomPhrase` for conversation mode (line ~1534-1536)
  - `fetchRandomPhrase` for curriculum mode (line ~1608-1610)
  - `handleSkip` for mix mode (line ~1891-1893)
  - `handleKeyDown` proceedToNext for mix mode (line ~2288-2290)
- The explanation prompt now explicitly instructs AI to start with 받침-based grammar rules before other grammar points.

### Edit: 2025-01-27
- Files: `public/src/PracticePage.js`
- Summary: Fixed explanation saving to database by adding proper response status checking and detailed error logging.
- Rationale: Bug fix - explanations weren't being saved because the code wasn't checking if the API response was OK. The fetch API doesn't throw errors for HTTP error status codes, so errors were being silently ignored.
- Code refs:
```1724:1730:public/src/PracticePage.js
        // Save explanation to database for future use
        try {
          console.log('[Explanation] Attempting to save explanation:', { phraseId, phraseType, koreanLength: fullKorean.length, englishLength: english.length, explanationLength: text.length });
          const saveRes = await api.saveExplanation(phraseId, phraseType, fullKorean, english, text);
          if (saveRes.ok) {
            console.log('[Explanation] ✓ Successfully saved explanation to database');
          } else {
            const errorText = await saveRes.text().catch(() => 'Unknown error');
            console.error('[Explanation] ✗ Failed to save explanation:', saveRes.status, errorText);
          }
        } catch (saveErr) {
          console.error('[Explanation] ✗ Exception while saving explanation to database:', saveErr);
          // Don't fail the request if saving fails
        }
```

```1685:1695:public/src/PracticePage.js
              // Also save it with the current phrase ID for future lookups
              try {
                console.log('[Explanation] Attempting to save explanation from text lookup:', { phraseId, phraseType });
                const saveRes = await api.saveExplanation(phraseId, phraseType, fullKorean, english, textData.explanation);
                if (saveRes.ok) {
                  console.log('[Explanation] ✓ Successfully saved explanation from text lookup');
                } else {
                  const errorText = await saveRes.text().catch(() => 'Unknown error');
                  console.error('[Explanation] ✗ Failed to save explanation from text lookup:', saveRes.status, errorText);
                }
              } catch (saveErr) {
                console.error('[Explanation] ✗ Exception while saving explanation from text lookup:', saveErr);
              }
```
- The code now properly checks `saveRes.ok` before considering the save successful, and logs detailed error information including HTTP status codes and error messages.

### Edit: 2025-01-27
- Files: `public/src/PracticePage.js`
- Summary: Added "Ask Questions" button next to explanation that opens the chat page with the current sentence context for follow-up questions.
- Rationale: UX improvement - allows users to continue asking questions about the explanation in a dedicated chat interface.
- Code refs:
```1:4:public/src/PracticePage.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from './api';
import { generateVerbPracticeSentence } from './verbPractice';
```

```2547:2570:public/src/PracticePage.js
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="regenerate-button"
              onClick={() => { setExplanationText(''); setExplanationPhraseId(null); fetchExplanation(); }}
              title="Explain the current sentence"
            >
              Explain
            </button>
            {explanationText && currentPhrase && blankPhrase && (() => {
              const fullKorean = getFullKoreanSentence();
              const english = blankPhrase.translation || currentPhrase.english_text || '';
              return fullKorean && english ? (
                <Link
                  to={`/chat?input=${encodeURIComponent(english)}&translation=${encodeURIComponent(fullKorean)}`}
                  className="regenerate-button"
                  style={{ textDecoration: 'none', display: 'inline-block' }}
                  title="Open in chat to ask follow-up questions about this explanation"
                >
                  Ask Questions
                </Link>
              ) : null;
            })()}
          </div>
```
- The button only appears when an explanation is loaded and both Korean and English text are available. It navigates to `/chat` with the English text as `input` and Korean text as `translation` query parameters, which the ChatPage uses to provide context for follow-up questions.

### Edit: 2025-01-27
- Files: `public/src/PracticePage.js`
- Summary: Removed "Explain" button, moved "Ask Questions" button to bottom of explanation, and updated explanation prompt to be more concise (under 15 lines) with specific format including 받침 rules and table-formatted verb conjugations.
- Rationale: UX improvement - cleaner interface, more focused explanations, and easier access to follow-up questions. The explanation auto-loads on correct answers, so manual trigger button is not needed.
- Code refs:
```2544:2584:public/src/PracticePage.js
      <div className="sentence-box" style={{ textAlign: 'left', marginTop: 8 }}>
        <h3 style={{ margin: 0 }}>Explanation:</h3>
        <div style={{ marginTop: 8 }}>
          {isLoadingExplanation ? (
            <p style={{ margin: '4px 0', color: '#6b7280' }}>Loading explanation...</p>
          ) : explanationText ? (
            <>
              <div 
                style={{ lineHeight: '1.6' }}
                dangerouslySetInnerHTML={{ __html: mdToHtml(explanationText) }}
              />
              {currentPhrase && blankPhrase && (() => {
                const fullKorean = getFullKoreanSentence();
                const english = blankPhrase.translation || currentPhrase.english_text || '';
                return fullKorean && english ? (
                  <div style={{ marginTop: 12, textAlign: 'center' }}>
                    <Link
                      to={`/chat?input=${encodeURIComponent(english)}&translation=${encodeURIComponent(fullKorean)}`}
                      className="regenerate-button"
                      style={{ textDecoration: 'none', display: 'inline-block' }}
                      title="Open in chat to ask follow-up questions about this explanation"
                    >
                      Ask Questions
                    </Link>
                  </div>
                ) : null;
              })()}
            </>
          ) : (
            <p style={{ margin: '4px 0', color: '#6b7280' }}>No explanation yet.</p>
          )}
        </div>
      </div>
```

```1705:1735:public/src/PracticePage.js
      // If not in database, generate explanation via AI
      const prompt = `Explain this Korean sentence concisely (keep under 15 lines total).
Korean: ${fullKorean}
English: ${english}

Format your response as follows:

#### Grammar Rules Involving Endings Based on Consonant/Vowel (받침 Rules)
- State whether the verb/adjective stem ends with a consonant (받침) or vowel (no 받침)
- Explain how endings change based on 받침 presence (e.g., "The verb '일어나다' has a stem ending in a vowel ('일어'), and it takes '났어' for the past tense in an informal polite form.")
- If applicable, mention consonant assimilation rules (e.g., ㄷ irregular verbs, ㅂ irregular verbs, ㄹ irregular verbs)
- If applicable, mention vowel harmony rules
- If applicable, mention 받침-related sound changes or contractions
- If none apply, state "No specific [rule type] applies here."

#### Breakdown of the Sentence

##### Particles and Their Functions
List each particle with its function (e.g., "은 (은/는): Topic marker. '오늘은' indicates that '오늘' is the topic of the sentence.")

##### Tense and Politeness Levels
State the tense and politeness level with brief explanation.

##### Vocabulary with Brief Glosses
List key vocabulary words with brief English translations.

##### Verb/Adjective Root Forms and Conjugations
Format as a table to save space:
| Form | Value |
|------|-------|
| Root | [root form] |
| Conjugation | [conjugated form] |

Keep the entire explanation under 15 lines. Be concise and focus only on the essential grammar points.
IMPORTANT: Do NOT include romanizations (like "naeil" or "mollayo") in your explanation. Only use Korean characters and English translations.`;
```
- The "Ask Questions" button now appears at the bottom of the explanation content, centered. The explanation prompt now enforces a concise format with specific sections and table formatting for verb conjugations to save space.

### Edit: 2025-01-27
- Files: `public/src/PracticePage.js`
- Summary: Added auto-focus functionality to input field when switching to the PracticePage tab.
- Rationale: UX improvement - automatically focuses the current input field when the user switches back to the tab, making it easier to continue typing without clicking.
- Code refs:
```65:66:public/src/PracticePage.js
  const fetchingEnglishIndicesRef = React.useRef(false); // Prevent duplicate fetches
  const inputRefs = React.useRef({}); // Refs for input fields to enable auto-focus on tab switch
```

```126:145:public/src/PracticePage.js
  }, []);

  // Auto-focus input when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && currentPhrase && blankPhrase && inputRefs.current[currentBlankIndex]) {
        // Small delay to ensure the input is rendered
        setTimeout(() => {
          const input = inputRefs.current[currentBlankIndex];
          if (input) {
            input.focus();
          }
        }, 100);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentBlankIndex, currentPhrase, blankPhrase]);
```

```2460:2462:public/src/PracticePage.js
                <input
                  ref={(el) => { inputRefs.current[idx] = el; }}
                  type="text"
```
- Added a ref object to store references to all input fields, a visibilitychange event listener that focuses the current input when the tab becomes visible, and ref callbacks on each input field to register them in the refs object.

### Edit: 2025-01-27
- Files: `public/src/Navbar.js`
- Summary: Added Grammar page link to navigation menu by adding it to the nav items and default navOrder array.
- Rationale: User requested to bring back the grammar rules page - it was already implemented but missing from the navigation menu.
- Code refs:
```40:40:public/src/Navbar.js
    return ['practice','mix','scores','translate','audio','journal','curriculum','grammar','kpop','stats','pronunciation','chat','journal-entries','home'];
```

```209:209:public/src/Navbar.js
    grammar: { to: '/grammar', label: 'Grammar', className: 'nav-item nav-item-desktop' },
```
- The Grammar page was already implemented (GrammarPage.js exists, route is in App.js, API methods exist), but it was missing from the Navbar navigation items. Added 'grammar' to both the items object and the default navOrder array so it appears in the navigation menu.

### Edit: 2025-01-27
- Files: `public/nav-order.json`
- Summary: Added "grammar" to the navigation order JSON file so the Grammar page appears in the navigation menu.
- Rationale: The nav-order.json file overrides the default navigation order, so grammar needed to be added there as well as in the Navbar.js default array.
- Code refs:
```2:16:public/nav-order.json
  "order": [
    "practice",
    "mix",
    "scores",
    "translate",
    "audio",
    "journal",
    "curriculum",
    "grammar",
    "kpop",
    "stats",
    "pronunciation",
    "chat",
    "journal-entries",
    "home"
  ]
```
- Added "grammar" to the order array after "curriculum" to match the default order in Navbar.js.

### Edit: 2025-01-27
- Files: `public/src/GrammarPage.js`
- Summary: Improved error handling and JSON parsing in handleGenerateFromPrompt function to provide better error messages and handle nested JSON properly.
- Rationale: Bug fix - the previous error handling was too generic and didn't provide useful feedback. Also improved JSON extraction to properly handle nested JSON objects by counting braces instead of using a simple regex.
- Code refs:
```102:150:public/src/GrammarPage.js
  const handleGenerateFromPrompt = async () => {
    const text = prompt.trim();
    if (!text) { alert('Enter a prompt first'); return; }
    try {
      setSaving(true);
      const instruction = `Extract a Korean grammar rule from the following user text. Return ONLY a compact JSON object with keys: title, description, example_korean, example_english, model_korean, model_english. If some fields are unknown, use empty strings.\n\nUser text:\n${text}`;
      const res = await api.chat(instruction);
      if (!res.ok) {
        const errorText = await res.text().catch(() => 'Unknown error');
        console.error('[Grammar] API call failed:', res.status, errorText);
        throw new Error(`API call failed: ${res.status}${errorText ? ` - ${errorText}` : ''}`);
      }
      const data = await res.json();
      const content = data.response || '';
      console.log('[Grammar] AI response:', content);
      
      // Try to find JSON object - look for first { and matching }
      let jsonStart = content.indexOf('{');
      if (jsonStart === -1) {
        console.error('[Grammar] No JSON found in response:', content);
        throw new Error('No JSON object found in AI response. Please try again with a clearer prompt.');
      }
      
      // Find the matching closing brace by counting braces
      let braceCount = 0;
      let jsonEnd = -1;
      for (let i = jsonStart; i < content.length; i++) {
        if (content[i] === '{') {
          braceCount++;
        } else if (content[i] === '}') {
          braceCount--;
          if (braceCount === 0) {
            jsonEnd = i + 1;
            break;
          }
        }
      }
      
      if (jsonEnd === -1) {
        console.error('[Grammar] Incomplete JSON in response:', content);
        throw new Error('Incomplete JSON object in AI response. Please try again.');
      }
      
      const jsonString = content.substring(jsonStart, jsonEnd);
      let obj;
      try {
        obj = JSON.parse(jsonString);
      } catch (parseErr) {
        console.error('[Grammar] JSON parse error:', parseErr, 'Attempted to parse:', jsonString);
        throw new Error(`Failed to parse JSON: ${parseErr.message}`);
      }
      const toSave = {
        title: String(obj.title || '').trim(),
        description: String(obj.description || '').trim(),
        example_korean: String(obj.example_korean || '').trim(),
        example_english: String(obj.example_english || '').trim(),
        model_korean: String(obj.model_korean || '').trim(),
        model_english: String(obj.model_english || '').trim()
      };
      if (!toSave.title) {
        console.error('[Grammar] Missing title in parsed object:', obj);
        throw new Error('AI response is missing a title. Please try again with a clearer prompt.');
      }
      console.log('[Grammar] Saving rule:', toSave);
      const addRes = await api.addGrammarRule(toSave);
      if (!addRes.ok) {
        const errorText = await addRes.text().catch(() => 'Unknown error');
        console.error('[Grammar] Save failed:', addRes.status, errorText);
        throw new Error(`Failed to save rule: ${addRes.status}${errorText ? ` - ${errorText}` : ''}`);
      }
      const r = await api.getGrammarRules(300);
      const list = await r.json();
      setRules(Array.isArray(list) ? list : []);
      setPrompt('');
      alert('Grammar rule generated and saved successfully!');
    } catch (e) {
      console.error('[Grammar] Error generating from prompt:', e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      alert(`Failed to generate from prompt: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };
```
- The function now checks if the API response is OK before parsing, uses proper brace counting to extract nested JSON objects, provides detailed error messages in alerts and console logs, and shows a success message when the rule is saved.

### Edit: 2025-01-27
- Files: `public/src/GrammarPage.js`
- Summary: Enhanced the grammar rule generation prompt to request more detailed explanations, comparisons, and examples instead of just repeating the user's input.
- Rationale: UX improvement - the previous prompt generated rules that just repeated the user's question. The new prompt explicitly asks for detailed explanations, comparisons with similar patterns, usage guidelines, and concrete examples.
- Code refs:
```107:120:public/src/GrammarPage.js
      const instruction = `Extract a Korean grammar rule from the following user text. Return ONLY a compact JSON object with keys: title, description, example_korean, example_english, model_korean, model_english.

IMPORTANT: 
- The description should provide a CLEAR, DETAILED explanation of the grammar rule, NOT just repeat the user's prompt.
- Include specific explanations about when to use this grammar point, how it differs from similar patterns, and any important nuances.
- Provide concrete examples that illustrate the rule clearly.
- If the user asks about differences between similar patterns (like 어디에서 vs 어디에), explain BOTH patterns clearly with examples showing when to use each one.

Example format for description:
- Explain the grammar concept clearly
- Compare with similar patterns if relevant
- Provide usage guidelines
- Include important notes about when to use it

User text:\n${text}`;
```
- The prompt now explicitly instructs the AI to provide detailed explanations rather than repeating the input, and includes specific guidance for handling comparison questions (like 어디에서 vs 어디에).

### Edit: 2025-01-27
- Files: `public/src/GrammarPage.js`
- Summary: Updated grammar rule generation prompt to instruct AI to use markdown tables when comparing different cases or patterns.
- Rationale: UX improvement - tables make comparisons between different grammar patterns (like 어디에서 vs 어디에) much clearer and easier to read than plain text.
- Code refs:
```107:125:public/src/GrammarPage.js
      const instruction = `Extract a Korean grammar rule from the following user text. Return ONLY a compact JSON object with keys: title, description, example_korean, example_english, model_korean, model_english.

IMPORTANT: 
- The description should provide a CLEAR, DETAILED explanation of the grammar rule, NOT just repeat the user's prompt.
- Include specific explanations about when to use this grammar point, how it differs from similar patterns, and any important nuances.
- Provide concrete examples that illustrate the rule clearly.
- If the user asks about differences between similar patterns (like 어디에서 vs 어디에), explain BOTH patterns clearly with examples showing when to use each one.
- USE TABLES to compare different cases, patterns, or usage scenarios. Format tables using markdown table syntax:
  | Case/Pattern | Usage | Example Korean | Example English |
  |--------------|-------|----------------|-----------------|
  | Pattern 1    | When to use | Example KO | Example EN |
  | Pattern 2    | When to use | Example KO | Example EN |

Example format for description:
- Explain the grammar concept clearly
- Use tables to compare different cases or patterns when relevant
- Provide usage guidelines
- Include important notes about when to use it

User text:\n${text}`;
```
- The prompt now explicitly instructs the AI to use markdown tables when comparing different cases or patterns, with a provided table format template.

### Edit: 2025-01-27
- Files: `public/src/GrammarPage.js`
- Summary: Updated grammar rule generation prompt to require that example Korean sentences in comparison tables include the actual pattern being described (e.g., "어디에서 왔어요?" instead of "집에서 왔어요.").
- Rationale: UX improvement - examples should demonstrate the pattern itself, not just show a sentence that uses the particle. This makes it clearer which pattern is being illustrated.
- Code refs:
```173:186:public/src/GrammarPage.js
      const instruction = `Extract a Korean grammar rule from the following user text. Return ONLY a compact JSON object with keys: title, description, example_korean, example_english, model_korean, model_english.

IMPORTANT: 
- Keep the description CONCISE but informative. Do NOT just repeat the user's prompt.
- If comparing multiple patterns (like 어디에서 vs 어디에), USE A TABLE to show the differences clearly.
- Format tables using markdown table syntax with headers:
  | Pattern | Usage | Example Korean | Example English |
  |---------|-------|----------------|-----------------|
  | Pattern 1 | Brief usage note | Example KO | Example EN |
  | Pattern 2 | Brief usage note | Example KO | Example EN |
- CRITICAL: In the "Example Korean" column, the example sentence MUST include the actual pattern being described. For example, if the pattern is "어디에서", the example should be "어디에서 왔어요?" (Where did you come from?), NOT just "집에서 왔어요." (I came from home.). The pattern itself must appear in the example sentence.
- Keep explanations brief and focused. Use the table for comparisons, then add 1-2 short bullet points for key usage notes if needed.
- The description should be primarily the comparison table (if applicable) plus brief usage guidelines.

User text:\n${text}`;
```
- The prompt now includes a CRITICAL instruction that example Korean sentences must include the actual pattern being described, ensuring that comparison tables show the pattern in context rather than just showing sentences that use the particle.

### Edit: 2025-01-27
- Files: `public/src/styles/GrammarPage.css`
- Summary: Changed grammar rules grid layout from auto-fill responsive columns to a fixed 2-column grid.
- Rationale: UX improvement - user requested a 2x2 grid layout to give more space to each grammar rule card, making them easier to read.
- Code refs:
```21:25:public/src/styles/GrammarPage.css
.rules-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
```
- Changed from `repeat(auto-fill, minmax(260px, 1fr))` to `repeat(2, 1fr)` to force exactly 2 columns regardless of screen width.

### Edit: 2025-01-27
- Files: `public/src/GrammarPage.js`
- Summary: Removed manual grammar rule form, keeping only the "generate from prompt" functionality.
- Rationale: UX simplification - user requested to remove the manual form and only use AI-powered generation from text prompts, streamlining the interface.
- Code refs:
```104:110:public/src/GrammarPage.js
  const [rules, setRules] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prompt, setPrompt] = useState('');
```
- Removed `form` state and `handleAddRule` function. Removed the manual input form section (title, description, example fields) and simplified the UI to only show the prompt-based generation interface.
```287:295:public/src/GrammarPage.js
      <div className="stats-card" style={{ marginBottom: 12 }}>
        <h2 style={{ marginTop: 0 }}>Generate Grammar Rule from Prompt</h2>
        <textarea rows={4} value={prompt} onChange={(e)=>setPrompt(e.target.value)} placeholder={'Describe a rule and examples...\nE.g. 은/는 topic particle with examples and a model sentence'} style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', marginTop: 6 }} />
        <div style={{ marginTop: 8 }}>
          <button className="regenerate-button" onClick={handleGenerateFromPrompt} disabled={saving || !prompt.trim()}>Generate from Prompt</button>
        </div>
      </div>
```

### Edit: 2025-01-27
- Files: `public/src/GrammarPage.js`
- Summary: Updated grammar rule generation prompt to only output comparison table and usage guidelines, removing explanation section.
- Rationale: UX improvement - user requested a more concise output format that focuses only on the comparison table and usage guidelines, eliminating redundant explanation text.
- Code refs:
```147:161:public/src/GrammarPage.js
      const instruction = `Extract a Korean grammar rule from the following user text. Return ONLY a compact JSON object with keys: title, description, example_korean, example_english, model_korean, model_english.

IMPORTANT: 
- The description should contain ONLY:
  1. A comparison table (if comparing multiple patterns)
  2. Usage guidelines (brief bullet points)
- Do NOT include an "Explanation" section or any other text.
- If comparing multiple patterns (like 어디에서 vs 어디에), USE A TABLE to show the differences clearly.
- Format tables using markdown table syntax with headers:
  | Pattern | Usage | Example Korean | Example English |
  |---------|-------|----------------|-----------------|
  | Pattern 1 | Brief usage note | Example KO | Example EN |
  | Pattern 2 | Brief usage note | Example KO | Example EN |
- CRITICAL: In the "Example Korean" column, the example sentence MUST include the actual pattern being described. For example, if the pattern is "어디에서", the example should be "어디에서 왔어요?" (Where did you come from?), NOT just "집에서 왔어요." (I came from home.). The pattern itself must appear in the example sentence.
- After the table, add a "Usage Guidelines" section with 2-3 brief bullet points about when to use each pattern.

User text:\n${text}`;
```
- The prompt now explicitly instructs the AI to exclude explanation sections and only provide the comparison table and usage guidelines.

### Edit: 2025-01-27
- Files: `public/src/GrammarPage.js`
- Summary: Added JSON cleaning logic to escape control characters (newlines, tabs, etc.) in string values before parsing AI-generated JSON responses.
- Rationale: Bug fix - AI responses sometimes contain unescaped control characters (like newlines in markdown tables) inside JSON string values, causing "Bad control character in string literal" parsing errors. The new code walks through the JSON string and properly escapes control characters that appear inside quoted string values.
- Code refs:
```201:250:public/src/GrammarPage.js
      let jsonString = content.substring(jsonStart, jsonEnd);
      
      // Clean up JSON: escape control characters inside string values
      // Walk through the string and escape control chars that appear between quotes
      let cleaned = '';
      let inString = false;
      let escapeNext = false;
      for (let i = 0; i < jsonString.length; i++) {
        const char = jsonString[i];
        const prevChar = i > 0 ? jsonString[i - 1] : '';
        
        if (escapeNext) {
          cleaned += char;
          escapeNext = false;
          continue;
        }
        
        if (char === '\\') {
          cleaned += char;
          escapeNext = true;
          continue;
        }
        
        if (char === '"' && prevChar !== '\\') {
          inString = !inString;
          cleaned += char;
          continue;
        }
        
        if (inString) {
          // Inside a string, escape control characters
          if (char === '\n') {
            cleaned += '\\n';
          } else if (char === '\r') {
            cleaned += '\\r';
          } else if (char === '\t') {
            cleaned += '\\t';
          } else if (char === '\f') {
            cleaned += '\\f';
          } else if (char === '\b') {
            cleaned += '\\b';
          } else if (char.charCodeAt(0) < 32) {
            // Other control characters
            cleaned += '\\u' + ('0000' + char.charCodeAt(0).toString(16)).slice(-4);
          } else {
            cleaned += char;
          }
        } else {
          cleaned += char;
        }
      }
      
      let obj;
      try {
        obj = JSON.parse(cleaned);
      } catch (parseErr) {
        console.error('[Grammar] JSON parse error:', parseErr, 'Attempted to parse:', cleaned.substring(0, 200));
        throw new Error(`Failed to parse JSON: ${parseErr.message}. The AI response may contain invalid characters.`);
      }
```
- The function properly tracks whether it's inside a string value (between unescaped quotes) and escapes control characters only when inside strings, preserving the JSON structure.

### Edit: 2025-01-27
- Files: `public/src/GrammarPage.js`
- Summary: Fixed markdown table parsing to process tables before HTML escaping and improved regex to handle tables with or without separator rows.
- Rationale: Bug fix - tables were not rendering correctly because HTML escaping was happening before table parsing, which could interfere with the regex matching. The fix processes tables first, then escapes HTML only for cell content, not the table structure.
- Code refs:
```15:50:public/src/GrammarPage.js
const mdToHtml = (md) => {
  if (!md) return '';
  let txt = md;
  
  // Process markdown tables first (before escaping HTML)
  // Match markdown table pattern: | col | col | followed by |---|---| separator, then data rows
  // More flexible regex to handle various table formats
  const tableRegex = /(\|[^\n]*\|(?:\n\|[-\s|:]+\|)?(?:\n\|[^\n]*\|)+)/g;
  txt = txt.replace(tableRegex, (tableMatch) => {
    const lines = tableMatch.trim().split('\n').filter(l => l.trim() && l.includes('|'));
    if (lines.length < 2) return tableMatch;
    
    // Check if second line is a separator (contains only dashes, colons, spaces, and pipes)
    let headerLineIndex = 0;
    let dataStartIndex = 1;
    if (lines.length > 1 && /^[\s|:\-]+$/.test(lines[1])) {
      // Second line is separator, first is header
      headerLineIndex = 0;
      dataStartIndex = 2;
    } else {
      // No separator, first line is header
      headerLineIndex = 0;
      dataStartIndex = 1;
    }
    
    if (dataStartIndex >= lines.length) return tableMatch;
    
    // Parse header
    const headerCells = lines[headerLineIndex].split('|').map(c => c.trim()).filter(c => c);
    if (headerCells.length === 0) return tableMatch;
    
    // Parse data rows
    const dataRows = lines.slice(dataStartIndex).map(row => {
      const cells = row.split('|').map(c => c.trim()).filter(c => c);
      if (cells.length === 0) return '';
      // Ensure we have the same number of cells as headers (pad if needed)
      while (cells.length < headerCells.length) cells.push('');
      return '<tr>' + cells.map(c => `<td style="padding: 6px 8px; border: 1px solid #ddd;">${escapeHtml(c)}</td>`).join('') + '</tr>';
    }).filter(r => r);
    
    const headerRow = '<tr>' + headerCells.map(c => `<th style="padding: 6px 8px; border: 1px solid #ddd; background: #f3f4f6; font-weight: 600; text-align: left;">${escapeHtml(c)}</th>`).join('') + '</tr>';
    
    return '<table style="border-collapse: collapse; width: 100%; margin: 12px 0; border: 1px solid #ddd;"><thead>' + headerRow + '</thead><tbody>' + dataRows.join('') + '</tbody></table>';
  });
  
  // Now escape HTML for the rest of the content (but not tables which are already HTML)
  // Split by tables to preserve them
  const parts = txt.split(/(<table[\s\S]*?<\/table>)/g);
  const processedParts = parts.map(part => {
    if (part.startsWith('<table')) {
      return part; // Already processed
    }
    return escapeHtml(part);
  });
  txt = processedParts.join('');
```
- The function now processes tables before HTML escaping, uses a more flexible regex that handles tables with or without separator rows, and properly escapes HTML only in cell content.

### Edit: 2025-01-27
- Files: `public/src/GrammarPage.js`
- Summary: Fixed duplicate variable declaration error by renaming `parts` variables to `tableParts` and `finalParts`.
- Rationale: Bug fix - compilation error due to `parts` being declared twice in the same scope (once for table processing, once for paragraph processing).
- Code refs:
```62:83:public/src/GrammarPage.js
  const tableParts = txt.split(/(<table[\s\S]*?<\/table>)/g);
  const processedParts = tableParts.map(part => {
    if (part.startsWith('<table')) {
      return part; // Already processed
    }
    return escapeHtml(part);
  });
  txt = processedParts.join('');
  
  // ... other formatting ...
  
  // Paragraphs (split by tables and other block elements)
  const finalParts = txt.split(/(<table[\s\S]*?<\/table>|<h[1-3]>[\s\S]*?<\/h[1-3]>)/g);
```
- Renamed the first `parts` to `tableParts` and the second `parts` to `finalParts` to avoid the duplicate declaration error.

### Edit: 2025-01-27
- Files: `public/src/GrammarPage.js`
- Summary: Rewrote markdown table parsing to use line-by-line detection instead of regex, processing consecutive table rows and replacing them with HTML tables.
- Rationale: Bug fix - regex-based table parsing was not reliably matching tables. The new approach scans lines sequentially, identifies consecutive table rows, processes them, and replaces them in place, which is more reliable for various table formats.
- Code refs:
```19:88:public/src/GrammarPage.js
  // Process markdown tables first (before escaping HTML)
  // Match markdown table pattern: lines starting with | and containing |
  // Look for consecutive lines that look like table rows
  const lines = txt.split('\n');
  const tableBlocks = [];
  let currentTable = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Check if this line looks like a table row (starts and ends with |)
    if (line.startsWith('|') && line.endsWith('|') && line.length > 2) {
      if (!currentTable) {
        currentTable = { start: i, lines: [] };
      }
      currentTable.lines.push(line);
    } else {
      // Not a table row - close current table if exists
      if (currentTable && currentTable.lines.length >= 2) {
        tableBlocks.push(currentTable);
      }
      currentTable = null;
    }
  }
  // Don't forget the last table if file ends with table
  if (currentTable && currentTable.lines.length >= 2) {
    tableBlocks.push(currentTable);
  }
  
  // Process tables from end to start to preserve indices when replacing
  for (let i = tableBlocks.length - 1; i >= 0; i--) {
    const block = tableBlocks[i];
    const tableLines = block.lines;
    
    // Check if second line is a separator
    let headerLineIndex = 0;
    let dataStartIndex = 1;
    if (tableLines.length > 1 && /^[\s|:\-]+$/.test(tableLines[1])) {
      // Second line is separator
      headerLineIndex = 0;
      dataStartIndex = 2;
    }
    
    if (dataStartIndex >= tableLines.length) continue;
    
    // Parse header
    const headerCells = tableLines[headerLineIndex].split('|').map(c => c.trim()).filter(c => c);
    if (headerCells.length === 0) continue;
    
    // Parse data rows
    const dataRows = tableLines.slice(dataStartIndex).map(row => {
      const cells = row.split('|').map(c => c.trim()).filter(c => c);
      if (cells.length === 0) return '';
      // Ensure we have the same number of cells as headers
      while (cells.length < headerCells.length) cells.push('');
      if (cells.length > headerCells.length) {
        const trimmed = cells.slice(0, headerCells.length);
        cells.length = 0;
        cells.push(...trimmed);
      }
      return '<tr>' + cells.map(c => `<td style="padding: 6px 8px; border: 1px solid #ddd;">${escapeHtml(c)}</td>`).join('') + '</tr>';
    }).filter(r => r);
    
    const headerRow = '<tr>' + headerCells.map(c => `<th style="padding: 6px 8px; border: 1px solid #ddd; background: #f3f4f6; font-weight: 600; text-align: left;">${escapeHtml(c)}</th>`).join('') + '</tr>';
    
    const tableHtml = '<table style="border-collapse: collapse; width: 100%; margin: 12px 0; border: 1px solid #ddd;"><thead>' + headerRow + '</thead><tbody>' + dataRows.join('') + '</tbody></table>';
    
    // Replace the table lines in the lines array
    lines.splice(block.start, tableLines.length, tableHtml);
  }
  
  // Rebuild txt from modified lines array
  txt = lines.join('\n');
```
- The new approach scans the text line-by-line, identifies consecutive table rows (lines starting and ending with `|`), groups them into table blocks, processes each block to extract headers and data rows, and replaces the original lines with HTML table markup.

### Edit: 2025-01-27
- Files: `public/src/PracticePage.js`
- Summary: Changed default practice mode from 1 (curriculum) to 4 (mix).
- Rationale: UX improvement - user requested that mix mode be the default practice mode instead of curriculum mode.
- Code refs:
```84:91:public/src/PracticePage.js
  const [practiceMode, setPracticeMode] = useState(() => {
    try {
      const saved = localStorage.getItem('practice_mode');
      return saved ? parseInt(saved, 10) : 4;
    } catch (_) {
      return 4;
    }
  }); // 1: curriculum, 2: verb practice, 3: conversation sets, 4: mix
```
- Changed the default return value from `1` to `4` in both the try and catch blocks.

### Edit: 2025-01-27
- Files: `public/src/PracticePage.js`, `public/src/Navbar.js`
- Summary: Changed default for highlight English words toggle from true to false, and updated fallback in mode selector onChange handler to match default mode (4/Mix).
- Rationale: Bug fix - user reported that highlight toggle should be off by default and was getting stuck. Also updated mode selector fallback to be consistent with default mode.
- Code refs:
```92:99:public/src/PracticePage.js
  const [highlightEnglishWords, setHighlightEnglishWords] = useState(() => {
    try {
      const saved = localStorage.getItem('practice_highlight_english');
      return saved !== null ? saved === 'true' : false; // Default to false
    } catch (_) {
      return false;
    }
  }); // Whether to highlight English words corresponding to blanks
```
```114:127:public/src/PracticePage.js
  // Listen for changes to highlight setting from Navbar
  useEffect(() => {
    const handleHighlightChange = () => {
      try {
        const saved = localStorage.getItem('practice_highlight_english');
        setHighlightEnglishWords(saved !== null ? saved === 'true' : false);
      } catch (_) {
        setHighlightEnglishWords(false);
      }
    };
    window.addEventListener('practice_highlight_english_changed', handleHighlightChange);
    return () => {
      window.removeEventListener('practice_highlight_english_changed', handleHighlightChange);
    };
  }, []);
```
```2786:2790:public/src/PracticePage.js
              <select value={practiceMode} onChange={(e) => {
                const val = parseInt(e.target.value || '4', 10);
                setPracticeMode(val);
                try { localStorage.setItem('practice_mode', String(val)); } catch (_) {}
              }} style={{ padding: 4, border: '1px solid #ddd', borderRadius: 4 }}>
```
- Changed all default values for highlightEnglishWords from `true` to `false` in both PracticePage and Navbar. Updated mode selector fallback from '1' to '4' to match the default mode.

### Edit: 2025-01-27
- Files: `public/src/PracticePage.js`
- Summary: Improved explanation panel rendering with better markdown support (including tables) and enhanced styling for readability.
- Rationale: UX improvement - user requested better rendering of explanation panel. Added table parsing (similar to GrammarPage), improved heading styles, better spacing, and enhanced visual design with background color and borders.
- Code refs:
```24:150:public/src/PracticePage.js
const mdToHtml = (md) => {
  if (!md) return '';
  let txt = md;
  
  // Process markdown tables first (before escaping HTML)
  const lines = txt.split('\n');
  const tableBlocks = [];
  let currentTable = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Check if this line looks like a table row (starts and ends with |)
    if (line.startsWith('|') && line.endsWith('|') && line.length > 2) {
      if (!currentTable) {
        currentTable = { start: i, lines: [] };
      }
      currentTable.lines.push(line);
    } else {
      // Not a table row - close current table if exists
      if (currentTable && currentTable.lines.length >= 2) {
        tableBlocks.push(currentTable);
      }
      currentTable = null;
    }
  }
  // Don't forget the last table if file ends with table
  if (currentTable && currentTable.lines.length >= 2) {
    tableBlocks.push(currentTable);
  }
  
  // Process tables from end to start to preserve indices when replacing
  for (let i = tableBlocks.length - 1; i >= 0; i--) {
    const block = tableBlocks[i];
    const tableLines = block.lines;
    
    // Check if second line is a separator
    let headerLineIndex = 0;
    let dataStartIndex = 1;
    if (tableLines.length > 1 && /^[\s|:\-]+$/.test(tableLines[1])) {
      // Second line is separator
      headerLineIndex = 0;
      dataStartIndex = 2;
    }
    
    if (dataStartIndex >= tableLines.length) continue;
    
    // Parse header
    const headerCells = tableLines[headerLineIndex].split('|').map(c => c.trim()).filter(c => c);
    if (headerCells.length === 0) continue;
    
    // Parse data rows
    const dataRows = tableLines.slice(dataStartIndex).map(row => {
      const cells = row.split('|').map(c => c.trim()).filter(c => c);
      if (cells.length === 0) return '';
      // Ensure we have the same number of cells as headers
      while (cells.length < headerCells.length) cells.push('');
      if (cells.length > headerCells.length) {
        const trimmed = cells.slice(0, headerCells.length);
        cells.length = 0;
        cells.push(...trimmed);
      }
      return '<tr>' + cells.map(c => `<td style="padding: 6px 8px; border: 1px solid #ddd;">${escapeHtml(c)}</td>`).join('') + '</tr>';
    }).filter(r => r);
    
    const headerRow = '<tr>' + headerCells.map(c => `<th style="padding: 6px 8px; border: 1px solid #ddd; background: #f3f4f6; font-weight: 600; text-align: left;">${escapeHtml(c)}</th>`).join('') + '</tr>';
    
    const tableHtml = '<table style="border-collapse: collapse; width: 100%; margin: 12px 0; border: 1px solid #ddd;"><thead>' + headerRow + '</thead><tbody>' + dataRows.join('') + '</tbody></table>';
    
    // Replace the table lines in the lines array
    lines.splice(block.start, tableLines.length, tableHtml);
  }
  
  // Rebuild txt from modified lines array
  txt = lines.join('\n');
  
  // Now escape HTML for the rest of the content (but not tables which are already HTML)
  const tableParts = txt.split(/(<table[\s\S]*?<\/table>)/g);
  const processedParts = tableParts.map(part => {
    if (part.startsWith('<table')) {
      return part; // Already processed
    }
    return escapeHtml(part);
  });
  txt = processedParts.join('');
  
  // Code blocks
  txt = txt.replace(/```([\s\S]*?)```/g, (m, p1) => `<pre style="background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto;"><code>${p1}</code></pre>`);
  // Bold **text**
  txt = txt.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italics *text*
  txt = txt.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
  // Headings
  txt = txt.replace(/^####\s+(.+)$/gm, '<h4 style="margin: 12px 0 6px 0; font-size: 1.1em; font-weight: 600; color: #374151;">$1</h4>')
           .replace(/^###\s+(.+)$/gm, '<h3 style="margin: 16px 0 8px 0; font-size: 1.2em; font-weight: 600; color: #1f2937;">$1</h3>')
           .replace(/^##\s+(.+)$/gm, '<h2 style="margin: 20px 0 10px 0; font-size: 1.3em; font-weight: 600; color: #111827;">$1</h2>')
           .replace(/^#\s+(.+)$/gm, '<h1 style="margin: 24px 0 12px 0; font-size: 1.5em; font-weight: 700; color: #000;">$1</h1>');
  // Lists
  txt = txt.replace(/^(?:[-*])\s+(.+)$/gm, '<li style="margin: 4px 0;">$1</li>');
  txt = txt.replace(/(<li[\s\S]*?<\/li>)/g, (m) => `<ul style="margin: 8px 0; padding-left: 24px;">${m}</ul>`);
  
  // Paragraphs (split by tables, code blocks, and headings)
  const finalParts = txt.split(/(<table[\s\S]*?<\/table>|<pre[\s\S]*?<\/pre>|<h[1-4]>[\s\S]*?<\/h[1-4]>)/g);
  const htmlParts = [];
  for (let i = 0; i < finalParts.length; i++) {
    const part = finalParts[i];
    // If it's already a table, code block, or heading, keep it as is
    if (part.match(/^<(table|pre|h[1-4])/)) {
      htmlParts.push(part);
    } else {
      // Otherwise, convert to paragraphs
      const p = part
        .split(/\n{2,}/)
        .map(seg => seg.trim() ? `<p style="margin: 8px 0; line-height: 1.6;">${seg.replace(/\n/g, '<br>')}</p>` : '')
        .join('');
      htmlParts.push(p);
    }
  }
  return htmlParts.join('');
};
```
```2578:2610:public/src/PracticePage.js
      <div className="sentence-box" style={{ textAlign: 'left', marginTop: 16, padding: '16px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8 }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '1.2em', fontWeight: 600, color: '#1f2937' }}>Explanation</h3>
        <div style={{ marginTop: 8 }}>
          {isLoadingExplanation ? (
            <p style={{ margin: '8px 0', color: '#6b7280', fontStyle: 'italic' }}>Loading explanation...</p>
          ) : explanationText ? (
            <>
              <div 
                style={{ 
                  lineHeight: '1.7',
                  color: '#374151',
                  fontSize: '0.95em'
                }}
                dangerouslySetInnerHTML={{ __html: mdToHtml(explanationText) }}
              />
              {currentPhrase && blankPhrase && (() => {
                const fullKorean = getFullKoreanSentence();
                const english = blankPhrase.translation || currentPhrase.english_text || '';
                return fullKorean && english ? (
                  <div style={{ marginTop: 16, textAlign: 'center', paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
                    <Link
                      to={`/chat?input=${encodeURIComponent(english)}&translation=${encodeURIComponent(fullKorean)}`}
                      className="regenerate-button"
                      style={{ textDecoration: 'none', display: 'inline-block' }}
                      title="Open in chat to ask follow-up questions about this explanation"
                    >
                      Ask Questions
                    </Link>
                  </div>
                ) : null;
              })()}
            </>
          ) : (
            <p style={{ margin: '8px 0', color: '#6b7280', fontStyle: 'italic' }}>No explanation yet.</p>
          )}
        </div>
      </div>
```
- Added table parsing logic (similar to GrammarPage) to handle markdown tables. Enhanced heading styles with proper margins and colors. Improved overall panel styling with background color, borders, and better spacing. Added inline styles for better visual hierarchy and readability.

### Edit: 2025-01-27
- Files: `public/src/PracticePage.js`
- Summary: Added "Explain" button back to the button group and made explanation panel conditional on showExplanation state.
- Rationale: UX improvement - user requested to bring back the Explain button so users can manually trigger explanation display. The explanation panel now only shows when showExplanation is true (controlled by the button).
- Code refs:
```2647:2672:public/src/PracticePage.js
      <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'center', alignItems: 'center' }}>
        <button 
          type="button"
          onClick={() => {
            setShowAnswer(!showAnswer);
            setShowAnswerBelow(!showAnswerBelow);
          }}
          className="regenerate-button"
        >
          {showAnswer ? 'Hide Answer' : 'Show Answer'}
        </button>
        <button 
          type="button"
          onClick={handleToggleExplanation}
          className="regenerate-button"
          disabled={isLoadingExplanation}
        >
          {isLoadingExplanation ? 'Loading...' : (showExplanation ? 'Hide Explanation' : 'Explain')}
        </button>
        <button 
          onClick={handleSkip}
          className="regenerate-button"
        >
          Skip
        </button>
        <button 
          type="button"
          className="regenerate-button"
          onClick={handleSpeakFullThreeTimes}
          title="Speak full Korean sentence three times"
        >
          Speak x3 (KO)
        </button>
      </div>
```
```2681:2715:public/src/PracticePage.js
      {showExplanation && (
        <div className="sentence-box" style={{ textAlign: 'left', marginTop: 16, padding: '16px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8 }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '1.2em', fontWeight: 600, color: '#1f2937' }}>Explanation</h3>
          <div style={{ marginTop: 8 }}>
            {isLoadingExplanation ? (
              <p style={{ margin: '8px 0', color: '#6b7280', fontStyle: 'italic' }}>Loading explanation...</p>
            ) : explanationText ? (
              <>
                <div 
                  style={{ 
                    lineHeight: '1.7',
                    color: '#374151',
                    fontSize: '0.95em'
                  }}
                  dangerouslySetInnerHTML={{ __html: mdToHtml(explanationText) }}
                />
                {currentPhrase && blankPhrase && (() => {
                  const fullKorean = getFullKoreanSentence();
                  const english = blankPhrase.translation || currentPhrase.english_text || '';
                  return fullKorean && english ? (
                    <div style={{ marginTop: 16, textAlign: 'center', paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
                      <Link
                        to={`/chat?input=${encodeURIComponent(english)}&translation=${encodeURIComponent(fullKorean)}`}
                        className="regenerate-button"
                        style={{ textDecoration: 'none', display: 'inline-block' }}
                        title="Open in chat to ask follow-up questions about this explanation"
                      >
                        Ask Questions
                      </Link>
                    </div>
                  ) : null;
                })()}
              </>
            ) : (
              <p style={{ margin: '8px 0', color: '#6b7280', fontStyle: 'italic' }}>No explanation yet.</p>
            )}
          </div>
        </div>
      )}
```
- Added "Explain" button between "Show Answer" and "Skip" buttons. Button shows "Explain" when hidden, "Hide Explanation" when shown, and "Loading..." when fetching. Wrapped explanation panel in conditional render based on showExplanation state.

### Edit: 2025-01-27
- Files: `public/src/PracticePage.js`
- Summary: Changed "Explain" button text to "Explain Sentence" and moved speak button from button group to a sound icon (🔊) next to the Korean sentence.
- Rationale: UX improvement - user requested clearer button label and more intuitive placement of the speak button as an icon next to the sentence it will speak.
- Code refs:
```2658:2665:public/src/PracticePage.js
        <button 
          type="button"
          onClick={handleToggleExplanation}
          className="regenerate-button"
          disabled={isLoadingExplanation}
        >
          {isLoadingExplanation ? 'Loading...' : (showExplanation ? 'Hide Explanation' : 'Explain Sentence')}
        </button>
```
```2569:2610:public/src/PracticePage.js
      <p className="korean-sentence" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {koreanParts.map((part, idx) => (
            <React.Fragment key={idx}>
              {part}
              {idx < blankCount && (
                <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', verticalAlign: 'baseline', margin: '0 2px' }}>
                  <input
                    ref={(el) => { inputRefs.current[idx] = el; }}
                    type="text"
                    className="fill-in-blank-input"
                    value={inputValues[idx] || ''}
                    onChange={(e) => {
                      handleInputChange(idx, e.target.value);
                    }}
                    onKeyDown={(e) => {
                      handleKeyDown(e, idx);
                    }}
                    placeholder={idx === currentBlankIndex ? inputPlaceholder || '' : ''}
                    autoFocus={idx === currentBlankIndex}
                    style={{ 
                      width: `${Math.max((blankPhrase.blanks[idx]?.length || 3) * 1.5, 3)}em`,
                      borderColor: inputValues[idx] && idx === currentBlankIndex ? '#3498db' : undefined
                    }}
                  />
                  {showAnswerBelow && (
                    <div style={{ 
                      fontSize: '0.9rem', 
                      color: '#28a745', 
                      fontWeight: 600,
                      marginTop: '2px',
                      textAlign: 'center',
                      lineHeight: 1.2
                    }}>
                      {blankPhrase.correct_answers[idx] || blankPhrase.blanks[idx] || ''}
                    </div>
                  )}
                </span>
              )}
            </React.Fragment>
          ))}
        </span>
        <button
          type="button"
          onClick={handleSpeakFullThreeTimes}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 8px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6b7280',
            fontSize: '1.2em'
          }}
          title="Speak full Korean sentence three times"
        >
          🔊
        </button>
      </p>
```
- Changed button text from "Explain" to "Explain Sentence". Removed "Speak x3 (KO)" button from button group and added sound icon (🔊) as an inline button next to the Korean sentence. Updated sentence container to use flexbox layout to accommodate the icon.

### Edit: 2025-01-27
- Files: `public/src/PracticePage.js`
- Summary: Added H5 (#####) heading support to markdown renderer to properly render sub-sections in explanations.
- Rationale: Bug fix - explanation prompt uses H5 headings (#####) for sub-sections like "Particles and Their Functions", but the renderer only supported up to H4. Added H5 support with appropriate styling.
- Code refs:
```115:119:public/src/PracticePage.js
  // Headings (process from most specific to least specific)
  txt = txt.replace(/^#####\s+(.+)$/gm, '<h5 style="margin: 10px 0 4px 0; font-size: 1em; font-weight: 600; color: #4b5563;">$1</h5>')
           .replace(/^####\s+(.+)$/gm, '<h4 style="margin: 12px 0 6px 0; font-size: 1.1em; font-weight: 600; color: #374151;">$1</h4>')
           .replace(/^###\s+(.+)$/gm, '<h3 style="margin: 16px 0 8px 0; font-size: 1.2em; font-weight: 600; color: #1f2937;">$1</h3>')
           .replace(/^##\s+(.+)$/gm, '<h2 style="margin: 20px 0 10px 0; font-size: 1.3em; font-weight: 600; color: #111827;">$1</h2>')
           .replace(/^#\s+(.+)$/gm, '<h1 style="margin: 24px 0 12px 0; font-size: 1.5em; font-weight: 700; color: #000;">$1</h1>');
```
```125:130:public/src/PracticePage.js
  // Paragraphs (split by tables, code blocks, and headings)
  const finalParts = txt.split(/(<table[\s\S]*?<\/table>|<pre[\s\S]*?<\/pre>|<h[1-5]>[\s\S]*?<\/h[1-5]>)/g);
  const htmlParts = [];
  for (let i = 0; i < finalParts.length; i++) {
    const part = finalParts[i];
    // If it's already a table, code block, or heading, keep it as is
    if (part.match(/^<(table|pre|h[1-5])/)) {
      htmlParts.push(part);
```
- Added H5 heading regex replacement (processes before H4 to avoid conflicts). Updated regex patterns in paragraph splitting to include h5. H5 styled with smaller font size (1em) and appropriate margins/colors for sub-sections.

### Edit: 2025-01-27
- Files: `public/src/PracticePage.js`
- Summary: Updated explanation prompt to specify that the "Root" in the verb/adjective table should be the dictionary form (ending in 다), not just the stem.
- Rationale: Bug fix - AI was providing incomplete root forms (e.g., "일하" instead of "일하다"). The prompt now explicitly requests the full dictionary form ending in 다.
- Code refs:
```1846:1851:public/src/PracticePage.js
##### Verb/Adjective Root Forms and Conjugations
Format as a table to save space:
| Form | Value |
|------|-------|
| Root | [dictionary form ending in 다, e.g., 일하다, 가다, 먹다] |
| Conjugation | [conjugated form as it appears in the sentence] |
```
- Changed the Root field description from "[root form]" to "[dictionary form ending in 다, e.g., 일하다, 가다, 먹다]" to make it clear that the full dictionary form should be provided.

### Edit: 2025-01-27
- Files: `public/src/PracticePage.js`
- Summary: Added verb priority logic for blank selection in verb practice mode - blanks are now more likely to be placed in verb positions.
- Rationale: UX improvement - user requested that verb practice mode should prioritize having blanks in verbs with higher probability, making the practice more focused on verb conjugation.
- Code refs:
```263:330:public/src/PracticePage.js
  // Select blank indices with priority for verbs (for verb practice mode)
  const selectBlankIndicesWithVerbPriority = useCallback((words, types, desired, practiceMode) => {
    if (!Array.isArray(words) || words.length === 0) return [];
    
    // Get all candidates
    const candidates = getCandidateBlankIndices(words, types);
    if (candidates.length === 0) {
      // Fallback to all indices
      return words.map((_, i) => i).slice(0, desired);
    }
    
    // For verb practice mode, prioritize verbs
    if (practiceMode === 2) {
      const verbIndices = [];
      const nonVerbIndices = [];
      
      for (const idx of candidates) {
        const t = Array.isArray(types) && types.length === words.length ? String(types[idx] || '').toLowerCase() : '';
        const word = String(words[idx] || '').trim();
        
        // Check if it's a verb by POS tag or by common verb endings
        const isVerb = t && (t.includes('verb') || t.includes('v-'));
        const looksLikeVerb = !isVerb && word && (
          word.endsWith('다') || 
          word.endsWith('요') || 
          word.endsWith('어요') || 
          word.endsWith('아요') || 
          word.endsWith('해요') || 
          word.endsWith('있어요') || 
          word.endsWith('었어요') || 
          word.endsWith('았어요') ||
          word.endsWith('할') ||
          word.endsWith('할 거예요') ||
          word.includes('하고')
        );
        
        if (isVerb || looksLikeVerb) {
          verbIndices.push(idx);
        } else {
          nonVerbIndices.push(idx);
        }
      }
      
      // Prioritize verbs: try to fill at least half with verbs if available
      const verbCount = Math.min(verbIndices.length, Math.ceil(desired / 2));
      const nonVerbCount = desired - verbCount;
      
      const chosen = [];
      
      // Add verbs first
      const verbPool = [...verbIndices];
      for (let i = 0; i < verbCount && verbPool.length > 0; i++) {
        const idx = Math.floor(Math.random() * verbPool.length);
        chosen.push(verbPool[idx]);
        verbPool.splice(idx, 1);
      }
      
      // Add non-verbs to fill remaining slots
      const nonVerbPool = [...nonVerbIndices];
      for (let i = 0; i < nonVerbCount && nonVerbPool.length > 0; i++) {
        const idx = Math.floor(Math.random() * nonVerbPool.length);
        chosen.push(nonVerbPool[idx]);
        nonVerbPool.splice(idx, 1);
      }
      
      // If we still need more and have candidates left, fill from remaining
      const remaining = [...verbPool, ...nonVerbPool];
      while (chosen.length < desired && remaining.length > 0) {
        const idx = Math.floor(Math.random() * remaining.length);
        chosen.push(remaining[idx]);
        remaining.splice(idx, 1);
      }
      
      return chosen.sort((a, b) => a - b);
    }
    
    // For other modes, use random selection from candidates
    const pool = candidates.length >= desired ? [...candidates] : words.map((_, i) => i);
    const chosen = [];
    while (chosen.length < desired && pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length);
      chosen.push(pool[idx]);
      pool.splice(idx, 1);
    }
    return chosen.sort((a, b) => a - b);
  }, [getCandidateBlankIndices]);
```
- The function identifies verbs by POS tags or common verb endings (다, 요, 어요, 아요, 해요, etc.), separates candidates into verb and non-verb indices, and prioritizes selecting at least half of the blanks from verb positions when available. Updated all verb practice blank selection locations to use this new function.

### Edit: 2025-01-27
- Files: `public/src/PracticePage.js`
- Summary: Updated explanation prompt to clarify that the Root should be the dictionary form of the MAIN verb/adjective being conjugated in the sentence, not just any verb/adjective present.
- Rationale: Bug fix - AI was sometimes identifying the wrong verb as the root (e.g., showing "행복하다" when the conjugated verb is actually "듣다" in "행복을 들 거예요"). The prompt now explicitly instructs to identify the main conjugated verb/adjective.
- Code refs:
```1847:1852:public/src/PracticePage.js
##### Verb/Adjective Root Forms and Conjugations
Format as a table to save space:
| Form | Value |
|------|-------|
| Root | [dictionary form ending in 다 of the MAIN verb/adjective being conjugated in the sentence, e.g., if the sentence has "일하고 있어요", the root is "일하다", not other verbs in the sentence] |
| Conjugation | [conjugated form as it appears in the sentence - the actual conjugated verb/adjective, not other words] |
```
- Added clarification that the Root should be the MAIN verb/adjective being conjugated, with an example showing that if "일하고 있어요" appears, the root is "일하다" (not other verbs that might be in the sentence).

### Edit: 2025-01-27
- Files: `public/src/PracticePage.js`
- Summary: Enhanced explanation prompt to more explicitly identify the conjugated verb/adjective - the one that carries tense/politeness markers, not verbs appearing in other forms.
- Rationale: Bug fix - AI was incorrectly identifying roots (e.g., "행복하다" instead of "듣다" in "행복을 들 거예요"). Added explicit instruction to identify the verb that carries tense/politeness endings, with a specific example showing the correct identification.
- Code refs:
```1920:1925:public/src/PracticePage.js
##### Verb/Adjective Root Forms and Conjugations
Format as a table to save space:
| Form | Value |
|------|-------|
| Root | [dictionary form ending in 다 of the verb/adjective that carries the tense and politeness markers in the sentence. Identify the word that is actually conjugated (has tense/politeness endings like -어요, -아요, -을 거예요, etc.), not other verbs/adjectives that appear as nouns or in other forms. For example, in "행복을 들 거예요", the root is "듣다" (the verb being conjugated), not "행복하다" (which appears as a noun "행복을")] |
| Conjugation | [the actual conjugated verb/adjective form as it appears in the sentence, e.g., "들 거예요" from "듣다"] |
```
- Added detailed instruction with specific example showing that in "행복을 들 거예요", the root should be "듣다" (the conjugated verb) not "행복하다" (which appears as a noun). Clarified that the root should be the verb/adjective that carries tense/politeness markers.

### Edit: 2025-01-27
- Files: `public/src/PracticePage.js`
- Summary: Added auto-unmute functionality when user clicks the sound icon (🔊) to play audio - if the app is muted, it will automatically unmute before playing.
- Rationale: UX improvement - when a user explicitly clicks a sound icon to play audio, they clearly want to hear it, so the app should automatically unmute if currently muted.
- Code refs:
```942:949:public/src/PracticePage.js
  // Speak the full Korean sentence (with blanks filled) three times
  const handleSpeakFullThreeTimes = useCallback(() => {
    // Unmute if currently muted
    if (window.__APP_MUTED__ === true) {
      try {
        localStorage.setItem('app_muted', '0');
        window.__APP_MUTED__ = false;
      } catch (_) {}
    }
    try { const synth = window.speechSynthesis; if (synth) synth.cancel(); } catch (_) {}
    const full = getFullKoreanSentence();
    if (!full) return;
    speakText(full, null, 3);
  }, [getFullKoreanSentence, speakText]);
```
- Added check for `window.__APP_MUTED__` at the start of `handleSpeakFullThreeTimes` - if muted, sets both localStorage and window global to unmuted state before proceeding with speech synthesis.

### Edit: 2025-01-27
- Files: `public/src/ChatPage.js`
- Summary: Added "Always explain in English" instruction to the end of all chat prompts to ensure AI responses are always in English.
- Rationale: UX improvement - user requested that chat responses should always be in English, regardless of the question or context.
- Code refs:
```20:28:public/src/ChatPage.js
  const requestExplanation = React.useCallback(async (input, translation) => {
    try {
      const prompt = `Explain the Korean translation in detail.
Original (user): ${input}
Translation (ko): ${translation}
Please include a clear breakdown of grammar (particles, tense, politeness), vocabulary with brief glosses, and any pronunciation notes.
Keep it concise and structured for a learner.
IMPORTANT: Do NOT include romanizations (like "naeil" or "mollayo") in your explanation. Only use Korean characters and English translations.
Always explain in English.`;
```
```52:54:public/src/ChatPage.js
      const prompt = lastContext
        ? `You are helping a learner understand a prior translation.\nOriginal: ${lastContext.input}\nTranslation (ko): ${lastContext.translation}\nUser question: ${q}\nAnswer clearly and concisely. Always explain in English.`
        : `User question: ${q}\nAnswer clearly and concisely for a Korean learner. Always explain in English.`;
```
- Added "Always explain in English." to the end of both the initial explanation prompt (requestExplanation) and the user question prompt (handleSend) to ensure all AI responses are in English.

### Edit: 2025-01-27
- Files: `public/src/PracticePage.js`, `public/src/AudioLearningPage.js`, `public/src/conversationGenerator.js` (new)
- Summary: Excluded proper nouns from conversation blanks in PracticePage and extracted conversation generation logic into a separate reusable module.
- Rationale: UX improvement - proper nouns (like names, places) should not be blanked in conversation practice as they are not learnable vocabulary. Code organization - conversation generation logic is now shared between AudioLearningPage and can be reused elsewhere.
- Code refs:
```810:845:public/src/PracticePage.js
  const selectNextConversationPhrase = useCallback(() => {
    // ... existing code ...
    // Get word types to exclude proper nouns
    const types = (next && wordTypesByPhraseId && wordTypesByPhraseId[next.id]) || null;
    const candidates = getCandidateBlankIndices(words, types);
    // ... rest of function ...
  }, [conversationSession, usedPhraseIds, numBlanks, getCandidateBlankIndices, wordTypesByPhraseId]);
```
- Added useEffect to fetch word types for conversation sentences (similar to curriculum phrases) so proper nouns can be excluded from blank selection. Updated `selectNextConversationPhrase` to use word types when available.
- Created new file `public/src/conversationGenerator.js` with `generateConversationSet` function extracted from AudioLearningPage.js. Updated AudioLearningPage.js to import and use the shared module.

### Edit: 2025-01-27
- Files: `public/src/AudioLearningPage.js`, `public/src/backgroundAudio.js`
- Summary: Added fast forward/rewind (next/previous track) buttons to Android audio controls via MediaSession API, and added conversation titles to MediaSession metadata so each conversation shows its title in the audio controls.
- Rationale: UX improvement - user requested fast forward/rewind buttons in Android audio controls and wanted to see conversation titles instead of generic "Conversation Audio" text.
- Code refs:
```142:194:public/src/backgroundAudio.js
// Initialize MediaSession API handlers
const initMediaSession = () => {
  // ... existing play/pause/stop handlers ...
  // Previous/Next track handlers for playlist navigation
  try {
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      console.log('MediaSession: Previous track');
      if (globalAudioState.previousTrackCallback) {
        globalAudioState.previousTrackCallback();
      }
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      console.log('MediaSession: Next track');
      if (globalAudioState.nextTrackCallback) {
        globalAudioState.nextTrackCallback();
      }
    });
  } catch (err) {
    console.warn('MediaSession previous/next track handlers not supported:', err);
  }
};
```
```196:228:public/src/backgroundAudio.js
const updateMediaSession = (title, artist, playing = false, callbacks = {}) => {
  // ... existing code ...
  // Update callbacks if provided
  if (callbacks.play) globalAudioState.playCallback = callbacks.play;
  if (callbacks.pause) globalAudioState.pauseCallback = callbacks.pause;
  if (callbacks.stop) globalAudioState.stopCallback = callbacks.stop;
  if (callbacks.nexttrack) globalAudioState.nextTrackCallback = callbacks.nexttrack;
  if (callbacks.previoustrack) globalAudioState.previousTrackCallback = callbacks.previoustrack;
  // ... rest of function ...
};
```
```143:225:public/src/AudioLearningPage.js
  // Playlist state
  const [playlist, setPlaylist] = React.useState([]); // Array of conversation objects
  const [playlistIndex, setPlaylistIndex] = React.useState(-1); // Current index in playlist (-1 = no playlist)
  const [isPlaylistMode, setIsPlaylistMode] = React.useState(false);
  const [currentConversationTitle, setCurrentConversationTitle] = React.useState('');
  
  // Navigate to next/previous conversation in playlist
  const playNextConversation = React.useCallback(async () => { /* ... */ });
  const playPreviousConversation = React.useCallback(async () => { /* ... */ });
```
```1007:1062:public/src/AudioLearningPage.js
  const playConversationAudio = React.useCallback((shouldLoop = false, audioUrl = null, title = null) => {
    // ... audio setup ...
    // Get current conversation title for MediaSession
    const sessionTitle = title || (currentConv ? currentConv.title : null) || currentConversationTitle || 'Conversation Audio';
    if (title || currentConv) {
      setCurrentConversationTitle(sessionTitle);
    }
    // Set up MediaSession callbacks with nexttrack/previoustrack handlers
    updateMediaSession(sessionTitle, 'Korean Learning', true, {
      // ... play/pause/stop handlers ...
      nexttrack: isPlaylistMode && playlist.length > 1 ? playNextConversation : undefined,
      previoustrack: isPlaylistMode && playlist.length > 1 ? playPreviousConversation : undefined,
    });
  }, [conversationAudioUrl, searchParams, isPlaylistMode, playlist, playlistIndex, currentConversationTitle]);
```
- Added `previoustrack` and `nexttrack` action handlers to MediaSession API in backgroundAudio.js. These handlers call callbacks that navigate through the playlist of saved conversations.
- Added playlist navigation functions (`playNextConversation`, `playPreviousConversation`) that load and play the next/previous conversation in the playlist.
- Updated `playConversationAudio` to accept a `title` parameter and use it in MediaSession metadata, so each conversation shows its actual title in Android audio controls instead of generic "Conversation Audio".
- Added "Create Playlist" button that creates a playlist from all saved conversations and starts playing the first one.
- Updated all calls to `playConversationAudio` to pass the conversation title when available.
- Added `currentConversationTitle` state to track the title of the currently playing conversation.

### Edit: 2025-01-27
- Files: `public/src/AudioLearningPage.js`
- Summary: Enhanced "Generate New Conversation" to generate and display the audio pattern breakdown (Korean sentence, English sentence, word-by-word pairs, Korean sentence repeat) with a toggle button to show/hide details. By default, only Korean and English sentences are shown.
- Rationale: UX improvement - user requested to see the audio pattern that will be played when generating conversations, with the ability to toggle the detailed breakdown on/off.
- Code refs:
```1278:1300:public/src/AudioLearningPage.js
  // Generate a new conversation and load into UI
  const handleGenerateNewConversation = React.useCallback(async () => {
    try {
      const batch = await generateConversationSetLocal(conversationContextKorean, conversationContextEnglish);
      if (Array.isArray(batch) && batch.length > 0) {
        // Generate English word indices and word pairs for each sentence (following audio pattern)
        const batchWithData = await Promise.all(batch.map(async (sent) => {
          try {
            const [mapping, wordPairs] = await Promise.all([
              generateEnglishWordIndices(sent.korean, sent.english),
              getWordByWordPairs(sent.english, sent.korean)
            ]);
            return {
              ...sent,
              englishWordMapping: mapping, // Store mapping for use in PracticePage
              wordPairs: Array.isArray(wordPairs) ? wordPairs : [] // Store word pairs for audio pattern display
            };
          } catch (_) {
            // Fallback: try to get word pairs separately if combined fails
            try {
              const mapping = await generateEnglishWordIndices(sent.korean, sent.english);
              const wordPairs = await getWordByWordPairs(sent.english, sent.korean);
              return {
                ...sent,
                englishWordMapping: mapping,
                wordPairs: Array.isArray(wordPairs) ? wordPairs : []
              };
            } catch (_) {
              return sent; // Return original if both fail
            }
          }
        }));
        setGeneratedSentences(batchWithData);
        setCurrentConversationId(null); // New conversation, not saved yet
        setConversationAudioUrl('');
      }
    } catch (_) {}
  }, [conversationContextKorean, conversationContextEnglish, generateConversationSetLocal, generateEnglishWordIndices, getWordByWordPairs]);
```
```119:119:public/src/AudioLearningPage.js
  const [showAudioPatternDetails, setShowAudioPatternDetails] = React.useState(false); // Toggle for audio pattern breakdown
```
```2611:2650:public/src/AudioLearningPage.js
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span>Generated Sentences (Level >= 2)</span>
                    {currentConversationId && (
                      <span style={{ fontSize: 11, color: '#666', fontWeight: 400 }}>
                        ID: {currentConversationId}
                      </span>
                    )}
                    <button
                      className="audio-mini-btn"
                      onClick={() => setShowAudioPatternDetails(!showAudioPatternDetails)}
                      style={{ marginLeft: 'auto', fontSize: 11 }}
                      title={showAudioPatternDetails ? 'Hide audio pattern details' : 'Show audio pattern details'}
                    >
                      {showAudioPatternDetails ? 'Hide Pattern' : 'Show Pattern'}
                    </button>
                  </div>
                  <div style={{ display: 'grid', gap: 4 }}>
                    {generatedSentences.map((s, i) => (
                      <div key={i} style={{ display: 'grid', gap: 2 }}>
                        {/* 1. Korean sentence */}
                        <div className="audio-ko" style={{ padding: '6px 8px', border: '1px solid #eee', borderRadius: 6 }}>{s.korean}</div>
                        {/* 2. English sentence */}
                        <div className="audio-en" style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: 6 }}>{s.english}</div>
                        {/* 3. Word-by-word pairs (shown if toggle is on) */}
                        {showAudioPatternDetails && Array.isArray(s.wordPairs) && s.wordPairs.length > 0 && (
                          <div style={{ padding: '8px', background: '#f8f9fa', border: '1px solid #e0e0e0', borderRadius: 6, fontSize: 12 }}>
                            <div style={{ fontWeight: 600, marginBottom: 6, color: '#666', fontSize: 11 }}>Word-by-word breakdown:</div>
                            <div style={{ display: 'grid', gap: 4 }}>
                              {s.wordPairs.map((pair, idx) => (
                                <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                  <span className="audio-ko" style={{ minWidth: 100, fontWeight: 500 }}>{pair.ko || pair.korean || ''}</span>
                                  <span style={{ color: '#999' }}>→</span>
                                  <span className="audio-en" style={{ color: '#666' }}>{pair.en || pair.english || ''}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* 4. Korean sentence repeat (shown if toggle is on) */}
                        {showAudioPatternDetails && (
                          <div style={{ padding: '6px 8px', border: '1px solid #e3f2fd', borderRadius: 6, background: '#e3f2fd', fontSize: 11, color: '#666', fontStyle: 'italic' }}>
                            <span style={{ marginRight: 6 }}>Repeat:</span>
                            <span className="audio-ko">{s.korean}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
```
- Modified `handleGenerateNewConversation` to generate word pairs for each sentence using `getWordByWordPairs`, following the audio pattern specification. Word pairs are stored in the `wordPairs` property of each sentence object.
- Added `showAudioPatternDetails` state to control visibility of the audio pattern breakdown.
- Updated the "Generated Sentences" display to show:
  1. Korean sentence (always visible)
  2. English sentence (always visible)
  3. Word-by-word breakdown (shown when toggle is on, with Korean word → English translation pairs)
  4. Korean sentence repeat (shown when toggle is on, with a visual indicator)
- Added a "Show Pattern" / "Hide Pattern" toggle button in the header of the Generated Sentences section.
- The audio pattern breakdown follows the standard pattern: English sentence → Korean sentence → Word pairs → Korean sentence repeat.

### Edit: 2025-01-27
- Files: `public/src/AudioLearningPage.js`
- Summary: Fixed save/load functionality to preserve word pairs (word-by-word translations) when saving and loading conversations. The save button now saves exactly what should be said, including word pairs, and the load button restores them. Audio generation now uses saved word pairs if available instead of regenerating them.
- Rationale: Bug fix - user reported that when saving and reloading conversations, only English and Korean sentences were played, not the word-by-word translations. The save button should save exactly what will be said according to the audio pattern.
- Code refs:
```965:991:public/src/AudioLearningPage.js
  // Save current Level 3 conversation set (5 items)
  // IMPORTANT: Save the complete sentence objects including wordPairs so they can be restored exactly
  const saveConversationSet = React.useCallback(() => {
    try {
      const items = Array.isArray(generatedSentences) ? generatedSentences.slice(0, 5) : [];
      if (!items || items.length === 0) return;
      
      // Ensure we save the complete objects with wordPairs preserved
      const itemsToSave = items.map(item => ({
        korean: String(item.korean || ''),
        english: String(item.english || ''),
        wordPairs: Array.isArray(item.wordPairs) ? item.wordPairs.map(pair => ({
          ko: String(pair.ko || pair.korean || ''),
          en: String(pair.en || pair.english || '')
        })) : [],
        englishWordMapping: item.englishWordMapping || {}
      }));
      
      const entry = { 
        id, 
        title, 
        items: itemsToSave, // Save with wordPairs preserved
        audioUrl: conversationAudioUrl || null,
        createdAt: Date.now() 
      };
      persistConversations([entry, ...savedConversations]);
```
```1346:1375:public/src/AudioLearningPage.js
        // Check if items already have wordPairs saved (from loaded conversation)
        // If they do, use them; otherwise generate new ones
        const hasWordPairs = items.every(item => Array.isArray(item.wordPairs) && item.wordPairs.length > 0);
        
        let sentencesWithPairs;
        if (hasWordPairs) {
          // Use saved word pairs - format them for prepareLevel3AudioData
          setLevel3AudioProgress(10);
          sentencesWithPairs = items.map(item => ({
            english: String(item.english || ''),
            korean: String(item.korean || ''),
            wordPairs: Array.isArray(item.wordPairs) ? item.wordPairs.map(pair => ({
              ko: String(pair.ko || pair.korean || ''),
              en: String(pair.en || pair.english || '')
            })) : []
          }));
          setLevel3AudioProgress(50);
        } else {
          // Generate word pairs for all sentences using audio pattern utility
          setLevel3AudioProgress(10);
          sentencesWithPairs = await prepareLevel3AudioData(
            items,
            getWordByWordPairs,
            (progress) => setLevel3AudioProgress(progress)
          );
        }
```
```2945:2955:public/src/AudioLearningPage.js
                    <button className="audio-mini-btn" onClick={async () => {
                      // Load the conversation items, preserving wordPairs if they exist
                      const itemsToLoad = Array.isArray(c.items) ? c.items.map(item => ({
                        korean: String(item.korean || ''),
                        english: String(item.english || ''),
                        wordPairs: Array.isArray(item.wordPairs) ? item.wordPairs.map(pair => ({
                          ko: String(pair.ko || pair.korean || ''),
                          en: String(pair.en || pair.english || '')
                        })) : [],
                        englishWordMapping: item.englishWordMapping || {}
                      })) : [];
                      
                      setGeneratedSentences(itemsToLoad);
```
- Modified `saveConversationSet` to explicitly save wordPairs along with korean, english, and englishWordMapping, ensuring the complete audio pattern data is preserved.
- Updated `handlePlayCurrentConversation` to check if items already have wordPairs saved, and if so, use them directly instead of regenerating via `prepareLevel3AudioData`. This ensures saved conversations play exactly as they were saved.
- Updated the Load button handler to preserve wordPairs when loading conversations from savedConversations.
- Updated auto-load on startup to preserve wordPairs when loading default conversations.
- Updated Level 3 quiz loop to use saved wordPairs if available when generating audio for newly generated conversations that already have wordPairs.
- All audio generation paths now check for existing wordPairs first before calling `getWordByWordPairs`, ensuring saved conversations play exactly as saved.

### Edit: 2025-11-23
- Files: `public/src/AudioLearningPage.js`
- Summary: When creating a new conversation from the audio learning page, it is now automatically set as the default conversation. This means newly saved conversations will automatically load on the next page visit.
- Rationale: Requested to automatically set newly created conversations as the default so users don't need to manually set them after saving.
- Code refs:
```1003:1015:public/src/AudioLearningPage.js
      persistConversations([entry, ...savedConversations]);
      // Automatically set as default conversation
      setDefaultConversation(id);
      // Save to server (shared DB) and refresh list
      // Note: Server may not preserve wordPairs, but local storage will
      (async () => {
        try {
          const serverId = await postServerConversation(title, itemsToSave);
          if (serverId) {
            await fetchServerConversations();
          }
        } catch (_) {}
      })();
    } catch (_) {}
  }, [generatedSentences, conversationAudioUrl, savedConversations, persistConversations, postServerConversation, fetchServerConversations, setDefaultConversation]);
```
- Modified `saveConversationSet` function to call `setDefaultConversation(id)` immediately after creating a new conversation entry, and added `setDefaultConversation` to the dependency array.

### Edit: 2025-11-23
- Files: `public/src/styles/AudioLearningPage.css`
- Summary: Redesigned AudioLearningPage to be mobile-first with proportional scaling for larger screens. Changed from 2-column desktop layout to single-column layout that scales proportionally. All sizing now uses CSS clamp() for responsive scaling from mobile base (~428px) to desktop. Web version now looks like a scaled-up version of mobile design.
- Rationale: Requested to fix mobile UI and make web version look like a scaled version of mobile. Mobile-first approach ensures consistent experience across devices with proportional scaling.
- Code refs:
```1:59:public/src/styles/AudioLearningPage.css
/* Mobile-first design: base at ~428px, scales proportionally for larger screens */
.audio-page { 
  /* Mobile base: 16px padding, scales with viewport */
  padding: clamp(16px, 4vw, 32px) clamp(12px, 3vw, 24px); 
  /* Mobile base width ~428px, scales up to max 600px for readability */
  max-width: clamp(428px, 90vw, 600px); 
  margin: 0 auto; 
  box-sizing: border-box;
  overflow-x: hidden;
}
.audio-title { 
  margin: 0 0 clamp(6px, 1.5vw, 10px) 0; 
  font-size: clamp(24px, 6vw, 32px); 
}
/* Single column layout (mobile-first, scales proportionally) */
.audio-grid { 
  display: grid; 
  grid-template-columns: 1fr; 
  gap: clamp(12px, 3vw, 16px); 
  box-sizing: border-box;
}
```
- Changed layout from 2-column grid to single-column (mobile-first)
- Replaced all fixed pixel values with clamp() for responsive scaling
- Container max-width scales from 428px (mobile) to 600px (desktop)
- All font sizes, padding, margins, gaps, and border-radius now scale proportionally
- Removed media query breakpoint that switched to single column (now always single column)
- All typography and spacing scales smoothly from mobile to desktop using viewport-based units

### Edit: 2025-11-23
- Files: `public/src/AudioLearningPage.js`
- Summary: New conversations are now automatically saved when generated. Modified `saveConversationSet` to accept an optional items parameter, and `handleGenerateNewConversation` now automatically calls `saveConversationSet` after generating a new conversation. The Save Conversation button remains available for manual saves.
- Rationale: Requested to automatically save conversations when they are generated, while keeping the save button for manual control.
- Code refs:
```976:1017:public/src/AudioLearningPage.js
  const saveConversationSet = React.useCallback((itemsToSaveOverride = null) => {
    try {
      const items = itemsToSaveOverride || (Array.isArray(generatedSentences) ? generatedSentences.slice(0, 5) : []);
      if (!items || items.length === 0) return;
      // ... rest of save logic
```
```1337:1342:public/src/AudioLearningPage.js
        setGeneratedSentences(batchWithData);
        setCurrentConversationId(null); // New conversation, not saved yet
        setConversationAudioUrl('');
        // Automatically save the new conversation
        saveConversationSet(batchWithData);
```
- Modified `saveConversationSet` to accept optional `itemsToSaveOverride` parameter, allowing it to save items directly without relying on state
- Updated `handleGenerateNewConversation` to automatically call `saveConversationSet` with the generated batch data after setting state
- Save Conversation button remains functional for manual saves of existing conversations

### Edit: 2025-11-23
- Files: `public/src/AudioLearningPage.js`
- Summary: Improved sentence structure visibility in the Generated Sentences display. Changed from vertical stacked layout to side-by-side Korean/English layout with clearer visual hierarchy. Word-by-word breakdown is now always visible in a compact, inline format showing the sentence structure more clearly. Added sentence numbers and better spacing/padding for readability.
- Rationale: Requested to make sentence structure easier to see. The previous vertical stacked layout made it difficult to compare Korean and English sentences and understand the word-by-word mapping.
- Code refs:
```2693:2735:public/src/AudioLearningPage.js
                  <div style={{ display: 'grid', gap: 8 }}>
                    {generatedSentences.map((s, i) => (
                      <div key={i} style={{ 
                        padding: '12px', 
                        border: '1px solid #e0e0e0', 
                        borderRadius: 8, 
                        background: '#fafafa',
                        display: 'grid',
                        gap: 8
                      }}>
                        {/* Sentence number */}
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#999', marginBottom: -4 }}>
                          Sentence {i + 1}
                        </div>
                        
                        {/* Korean and English side-by-side for better structure visibility */}
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', 
                          gap: 12, 
                          alignItems: 'start'
                        }}>
                          {/* Korean and English columns with labels */}
                        </div>
                        
                        {/* Word-by-word breakdown - always visible in a compact format */}
                        {Array.isArray(s.wordPairs) && s.wordPairs.length > 0 && (
                          <div style={{ 
                            padding: '10px 12px', 
                            background: '#f0f4f8', 
                            border: '1px solid #cbd5e0', 
                            borderRadius: 6, 
                            fontSize: 12 
                          }}>
                            {/* Inline word pairs display */}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
```
- Redesigned sentence display for maximum readability with larger, more prominent full sentences
- Korean sentences displayed with blue border/background, English with green border/background for clear visual distinction
- Word-by-word breakdown redesigned as numbered table-like structure with each pair in its own row
- Each word pair clearly numbered (1, 2, 3...) and displayed with Korean word → English word in separate colored boxes
- Increased font sizes, padding, and spacing throughout for better readability
- Improved visual hierarchy with uppercase labels, colored borders, and distinct backgrounds
- Word pairs displayed in a grid format that's easy to scan and understand the sentence structure

### Edit: 2025-11-23
- Files: `public/src/PracticePage.js`, `public/src/Navbar.js`
- Summary: Added text size option for PracticePage. Users can now select from 50%, 60%, 70%, 80%, 90%, or 100% text sizes (100% is the maximum and default). The setting is persisted in localStorage and applies to Korean sentences, input fields, translations, and answer text. Added a "Text Size" dropdown control next to the Blanks and Mode controls, and also added "Practice Text Size" setting to the sidebar for easy access.
- Rationale: Requested to add text size control for better readability on different screen sizes and user preferences. Updated to have smaller size options (50-100% range) with 100% as maximum.
- Code refs:
```195:201:public/src/PracticePage.js
  const [textSize, setTextSize] = useState(() => {
    try {
      const saved = localStorage.getItem('practice_textSize');
      return saved ? parseFloat(saved) : 1.0; // Default to 1.0 (100%)
    } catch (_) {
      return 1.0;
    }
  }); // Text size multiplier (0.5, 0.6, 0.7, 0.8, 0.9, 1.0)
```
```2660:2666:public/src/PracticePage.js
      <p className="korean-sentence" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        gap: 8, 
        flexWrap: 'wrap',
        fontSize: `${2.5 * textSize}rem`
      }}>
```
```3030:3041:public/src/PracticePage.js
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ fontSize: 12, color: '#666', fontWeight: 600 }}>Text Size:</label>
              <select value={textSize} onChange={(e) => {
                const val = parseFloat(e.target.value || '1.0');
                setTextSize(val);
                try { localStorage.setItem('practice_textSize', String(val)); } catch (_) {}
              }} style={{ padding: 4, border: '1px solid #ddd', borderRadius: 4 }}>
                <option value={0.5}>50%</option>
                <option value={0.6}>60%</option>
                <option value={0.7}>70%</option>
                <option value={0.8}>80%</option>
                <option value={0.9}>90%</option>
                <option value={1.0}>100%</option>
              </select>
            </div>
```
```70:77:public/src/Navbar.js
  const [practiceTextSize, setPracticeTextSize] = React.useState(() => {
    try {
      const saved = localStorage.getItem('practice_textSize');
      return saved ? parseFloat(saved) : 1.0; // Default to 1.0 (100%)
    } catch (_) {
      return 1.0;
    }
  });
```
```383:406:public/src/Navbar.js
              <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Practice Text Size</span>
                <select 
                  value={practiceTextSize} 
                  onChange={(e) => {
                    const val = parseFloat(e.target.value || '1.0');
                    setPracticeTextSize(val);
                    try { localStorage.setItem('practice_textSize', String(val)); } catch (_) {}
                    // Trigger a re-render by updating a state that PracticePage can read
                    window.dispatchEvent(new Event('practice_textSize_changed'));
                  }}
                  style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: 4, fontSize: '0.9rem', width: '100%', maxWidth: '200px' }}
                >
                  <option value={0.5}>50%</option>
                  <option value={0.6}>60%</option>
                  <option value={0.7}>70%</option>
                  <option value={0.8}>80%</option>
                  <option value={0.9}>90%</option>
                  <option value={1.0}>100%</option>
                </select>
              </div>
```
```224:237:public/src/PracticePage.js
  // Listen for changes to text size setting from Navbar
  useEffect(() => {
    const handleTextSizeChange = () => {
      try {
        const saved = localStorage.getItem('practice_textSize');
        setTextSize(saved ? parseFloat(saved) : 1.0);
      } catch (_) {
        setTextSize(1.0);
      }
    };
    window.addEventListener('practice_textSize_changed', handleTextSizeChange);
    return () => {
      window.removeEventListener('practice_textSize_changed', handleTextSizeChange);
    };
  }, []);
```
- Added textSize state variable with localStorage persistence (default: 1.0)
- Applied textSize multiplier to Korean sentence (2.5rem base), input fields (2.5rem base), translation (1.5rem base), and answer-below text (0.9rem base)
- Added Text Size dropdown control in the settings area next to Blanks and Mode controls
- Added Practice Text Size setting to sidebar (Navbar.js) for easy access
- Added event listener in PracticePage.js to sync text size changes from sidebar
- Text size options: 50%, 60%, 70%, 80%, 90%, 100% (100% is maximum, default)

### Edit: 2025-11-23
- Files: `public/src/**` (all page files and related modules)
- Summary: Reorganized src folder into subfolders for each page. Created separate folders for AudioLearning, Practice, Chat, Grammar, Translation, Mix, Score, Stats, KpopLyrics, Curriculum, Pronunciation, ModelSentence, LexiconAdd, Home, Journal, and Navbar. Moved page files, related modules, and CSS files into their respective folders. Updated all import statements to use correct relative paths.
- Rationale: Requested to organize the codebase by splitting the src folder into subfolders for each page to improve maintainability and code organization.
- Code refs:
  - Created folders: AudioLearning/, Practice/, Chat/, Grammar/, Translation/, Mix/, Score/, Stats/, KpopLyrics/, Curriculum/, Pronunciation/, ModelSentence/, LexiconAdd/, Home/, Journal/, Navbar/
  - Moved page files: AudioLearningPage.js, PracticePage.js, ChatPage.js, etc. into respective folders
  - Moved related modules: audioLearningMode.js, audioQuizModeHandsFree.js, audioQuizModeRecording.js, audioLoop.js, audioPattern.js, audioTTS.js, backgroundAudio.js, conversationGenerator.js, verbPractice.js to AudioLearning/
  - Moved CSS files: AudioLearningPage.css, HomePage.css, GrammarPage.css, TranslationPage.css, StatsPage.css, PronunciationPage.css, ModelSentence.css, Navbar.css, LearningPage.css to respective page folders
  - Updated App.js imports to use new folder structure (e.g., './AudioLearning/AudioLearningPage')
  - Updated all relative imports from './api' to '../api' in subfolders
  - Updated CSS imports to point to local CSS files in each folder
  - Updated cross-page imports (e.g., verbPractice from AudioLearning folder)
- Files moved:
  - AudioLearning: AudioLearningPage.js, audioLearningMode.js, audioQuizModeHandsFree.js, audioQuizModeRecording.js, audioLoop.js, audioPattern.js, audioTTS.js, backgroundAudio.js, conversationGenerator.js, verbPractice.js, AudioLearningPage.css
  - Practice: PracticePage.js
  - Chat: ChatPage.js
  - Grammar: GrammarPage.js, GrammarPage.css
  - Translation: TranslationPage.js, TranslationBox.js, TranslationPage.css
  - Mix: MixPage.js
  - Score: ScorePage.js
  - Stats: StatsPage.js, StatsPage.css
  - KpopLyrics: KpopLyricsPage.js
  - Curriculum: CurriculumPage.js
  - Pronunciation: PronunciationPage.js, PronunciationPage.css
  - ModelSentence: ModelSentence.js, ModelSentence.css
  - LexiconAdd: LexiconAddPage.js
  - Home: HomePage.js, HomePage.css, LearningPage.css
  - Journal: JournalPage.js, JournalArchivePage.js
  - Navbar: Navbar.js, Navbar.css

### Edit: 2025-11-23
- Files: `public/src/styles/HomePage.css`, `public/src/PracticePage.js`
- Summary: Removed hardcoded font-size from `.fill-in-blank-input` CSS class to allow inline style to control font size. Added line-height to input field style to match Korean sentence text appearance. This ensures the blank input field text size matches the surrounding Korean text exactly.
- Rationale: User requested that the blank text input field should be the same size as the Korean text for better visual consistency.
- Code refs:
```41:54:public/src/styles/HomePage.css
.fill-in-blank-input {
  border: none;
  border-bottom: 2px solid #3498db;
  background: none;
  text-align: center;
  color: #e74c3c;
  margin: 0;
  min-width: 3em;
  max-width: 90vw;
  padding: 5px 0;
  vertical-align: baseline;
  box-sizing: border-box;
  /* font-size is controlled by inline style to match parent text size */
}
```
```2710:2716:public/src/PracticePage.js
                    autoFocus={idx === currentBlankIndex}
                    style={{ 
                      width: `${Math.max((blankPhrase.blanks[idx]?.length || 3) * 1.5, 3)}em`,
                      borderColor: inputValues[idx] && idx === currentBlankIndex ? '#3498db' : undefined,
                      fontSize: `${2.5 * textSize}rem`,
                      lineHeight: '1.5'
                    }}
```
- Removed hardcoded `font-size: 2.5rem` from `.fill-in-blank-input` CSS class
- Added `lineHeight: '1.5'` to input field inline style to match Korean sentence line-height
- Font size is now fully controlled by inline style which matches the parent Korean sentence font size
- Added Practice Text Size setting to sidebar (Navbar.js) for easy access
- Added event listener in PracticePage.js to sync text size changes from sidebar

### Edit: 2025-01-23
- Files: `public/src/Practice/PracticePage.js`, `public/src/Practice/components/BlankInput.js`, `public/src/Practice/components/KoreanSentence.js`, `public/src/Practice/components/TranslationDisplay.js`, `public/src/Practice/components/PracticeControls.js`, `public/src/Practice/components/ExplanationBox.js`, `public/src/Practice/components/VariationIndicator.js`, `public/src/Practice/components/SessionSetDialog.js`, `public/src/Practice/components/ProgressPanel.js`, `public/src/Practice/utils.js`
- Summary: Refactored PracticePage.js into smaller, reusable components. Extracted utility functions (mdToHtml, escapeHtml, removePunctuation) into utils.js. Created 8 new component files for better code organization and maintainability.
- Rationale: PracticePage.js was 3082 lines long, making it difficult to maintain and understand. Breaking it into smaller components improves code organization, reusability, and makes the codebase easier to navigate and modify. Also adjusted blank input field sizing to use `ch` units for better inline text matching.
- Code refs:
```1:6:public/src/Practice/PracticePage.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../api';
import { generateVerbPracticeSentence } from '../AudioLearning/verbPractice';
import { removePunctuation, mdToHtml } from './utils';
import KoreanSentence from './components/KoreanSentence';
import TranslationDisplay from './components/TranslationDisplay';
```
```2693:2710:public/src/Practice/PracticePage.js
  return (
    <div className="sentence-box">
      <KoreanSentence
        blankPhrase={blankPhrase}
        inputValues={inputValues}
        currentBlankIndex={currentBlankIndex}
        inputPlaceholder={inputPlaceholder}
        inputRefs={inputRefs}
        handleInputChange={handleInputChange}
        handleKeyDown={handleKeyDown}
        showAnswerBelow={showAnswerBelow}
        textSize={textSize}
        handleSpeakFullThreeTimes={handleSpeakFullThreeTimes}
      />
```
- Components created:
  - `BlankInput.js`: Inline input field for fill-in-the-blank exercises
  - `KoreanSentence.js`: Korean sentence display with blanks and audio button
  - `TranslationDisplay.js`: English translation with optional word highlighting
  - `PracticeControls.js`: Control buttons (Show Answer, Explain, Skip)
  - `ExplanationBox.js`: Grammar explanation display with markdown rendering
  - `VariationIndicator.js`: AI variation progress indicator
  - `SessionSetDialog.js`: Dialog showing sentences in current session set
  - `ProgressPanel.js`: Progress bar, session management, and settings controls
- Utils extracted:
  - `utils.js`: Contains `mdToHtml`, `escapeHtml`, and `removePunctuation` utility functions
- Blank input sizing: Changed from `em` to `ch` units for better inline text matching (1.2ch per character instead of 1.5em)


### Edit: 2025-01-23
- Files: `public/src/AudioLearning/AudioLearningPage.js`
- Summary: Fixed word pairs not being saved to database and not being played in audio playback. Updated conversation loading to always regenerate Level 3 audio when wordPairs exist, ensuring step 3 (word-by-word pairs) is included in audio playback. Updated fetchServerConversations to preserve wordPairs structure when loading from database.
- Rationale: Bug fix - user reported that audio step 3 (word pairs) was not playing when loading saved conversations. Word pairs were being saved to localStorage but not always used when generating audio. The issue was that when loading conversations, the code was using `generateConversationAudio` (which doesn't include word pairs) instead of `generateLevel3Audio` (which does). Now the code checks if wordPairs exist and always regenerates Level 3 audio to ensure word pairs are included.
- Code refs:
```292:307:public/src/AudioLearning/AudioLearningPage.js
  const fetchServerConversations = React.useCallback(async () => {
    // ... updated to preserve wordPairs structure when loading from database
    items: Array.isArray(c.items) ? c.items.map(item => ({
      korean: String(item.korean || ''),
      english: String(item.english || ''),
      wordPairs: Array.isArray(item.wordPairs) ? item.wordPairs.map(pair => ({
        ko: String(pair.ko || pair.korean || ''),
        en: String(pair.en || pair.english || '')
      })) : [],
      englishWordMapping: item.englishWordMapping || {}
    })) : [],
```
```2984:3031:public/src/AudioLearning/AudioLearningPage.js
                    <button className="audio-mini-btn" onClick={async () => {
                      // Load conversation - always regenerate Level 3 audio if wordPairs exist
                      const hasWordPairs = itemsToLoad.every(item => Array.isArray(item.wordPairs) && item.wordPairs.length > 0);
                      const isLevel3 = (Number(quizDifficulty) || 1) === 3;
                      
                      if (hasWordPairs && isLevel3) {
                        // Always regenerate Level 3 audio with word pairs
                        const sentencesWithPairs = itemsToLoad.map(item => ({
                          english: String(item.english || ''),
                          korean: String(item.korean || ''),
                          wordPairs: Array.isArray(item.wordPairs) ? item.wordPairs.map(pair => ({
                            ko: String(pair.ko || pair.korean || ''),
                            en: String(pair.en || pair.english || '')
                          })) : []
                        }));
                        const audioUrl = await generateLevel3Audio(sentencesWithPairs, Math.max(0, Number(quizDelaySec) || 0.5));
```
- Changes:
  - Updated `fetchServerConversations` to normalize items and preserve wordPairs structure when loading from database
  - Updated conversation loading (Load button) to always regenerate Level 3 audio if wordPairs exist, ensuring word pairs are included in playback
  - Updated auto-load on startup to regenerate Level 3 audio if wordPairs exist
  - Updated playlist creation to regenerate Level 3 audio for conversations with wordPairs
  - Word pairs are now properly saved to database (via JSON.stringify) and loaded from database (via JSON.parse with normalization)
  - Audio generation now always uses wordPairs when available, following the audio pattern specification (step 3: word-by-word pairs)


### Edit: 2025-01-23
- Files: `public/src/AudioLearning/AudioLearningPage.js`, `backend/database.js`, `backend/server.js`
- Summary: Made playlist auto-create when start button is clicked, added forward/rewind buttons for playlist navigation, and ensured Android media playback controls use those buttons. Added playlist database storage and API endpoints.
- Rationale: User requested that the start button should auto-create the playlist, add forward/rewind buttons to skip conversations, and ensure Android media controls work with those buttons. This improves the user experience by making playlist management automatic and providing easy navigation controls.
- Code refs:
```189:236:public/src/AudioLearning/AudioLearningPage.js
  // Navigate to next conversation in playlist
  const playNextConversation = React.useCallback(async () => {
    // ... saves playlist index to database and updates MediaSession
```
```2571:2705:public/src/AudioLearning/AudioLearningPage.js
                <button className="audio-btn" onClick={async () => {
                  // Auto-create playlist if it doesn't exist
                  if (!isPlaylistMode && savedConversations && savedConversations.length > 0) {
                    const conversationIds = savedConversations.map(c => c.id).filter(Boolean);
                    if (conversationIds.length > 0) {
                      setPlaylist(savedConversations);
                      setPlaylistIndex(0);
                      setIsPlaylistMode(true);
                      await savePlaylist(conversationIds, 0);
                    }
                  }
```
```2705:2720:public/src/AudioLearning/AudioLearningPage.js
                {isPlaylistMode && playlist.length > 1 && (
                  <>
                    <button className="audio-btn" onClick={playPreviousConversation}>⏮</button>
                    <button className="audio-btn" onClick={playNextConversation}>⏭</button>
                  </>
                )}
```
- Changes:
  - Start button now auto-creates playlist from all saved conversations if playlist doesn't exist
  - Added forward (⏭) and rewind (⏮) buttons that appear when in playlist mode with multiple conversations
  - Forward/rewind buttons call `playNextConversation` and `playPreviousConversation` which save playlist state to database
  - MediaSession handlers in `handleStartQuizLoop` and `playConversationAudio` now include `nexttrack` and `previoustrack` callbacks that work with Android media controls
  - Playlist navigation functions update MediaSession with new conversation title when switching conversations
  - Added playlist database table and API endpoints (`GET /api/playlist`, `POST /api/playlist`) to persist playlist state
  - Playlist is automatically saved to database when created, navigated, or stopped


### Edit: 2025-01-23
- Files: `public/src/AudioLearning/AudioLearningPage.js`, `public/src/AudioLearning/utils/verbHelpers.js`, `public/src/AudioLearning/hooks/useRecording.js`, `public/src/AudioLearning/components/SentenceDisplay.js`, `public/src/AudioLearning/audio/conversationAudio.js`, `public/src/AudioLearning/utils/sentenceGenerators.js`
- Summary: Refactored AudioLearningPage.js to extract large functions and components into separate files. Extracted verb conjugation helpers, recording logic, sentence display component, conversation audio playback, and sentence generation utilities. Reduced file from 3528 lines to 2676 lines.
- Rationale: User requested refactoring to get AudioLearningPage.js below 1000 lines. Extracted reusable utilities and components to improve maintainability and code organization.
- Code refs:
```1:47:public/src/AudioLearning/AudioLearningPage.js
import { useRecording } from './hooks/useRecording';
import { createPlayConversationAudio } from './audio/conversationAudio';
import SentenceDisplay from './components/SentenceDisplay';
import {
  pickRandomPronoun,
  conjugateVerbSimple,
  // ... verb helpers
} from './utils/verbHelpers';
import {
  parseJsonObject,
  parseJsonArraySafe,
  pickRandom,
  getWordByWordPairs,
  // ... sentence generators
} from './utils/sentenceGenerators';
```
- Changes:
  - Created `utils/verbHelpers.js` with all verb conjugation and sentence building helpers (~220 lines extracted)
  - Created `hooks/useRecording.js` with recording state and operations (~250 lines extracted)
  - Created `components/SentenceDisplay.js` for sentence display UI (~215 lines extracted)
  - Created `audio/conversationAudio.js` for conversation audio playback logic (~220 lines extracted)
  - Created `utils/sentenceGenerators.js` for sentence generation utilities (~115 lines extracted)
  - Updated AudioLearningPage.js to import and use all extracted modules
  - Replaced inline verb helpers with imported functions wrapped in memoized callbacks
  - Replaced recording state and functions with useRecording hook
  - Replaced large sentence display JSX with SentenceDisplay component
  - Replaced playConversationAudio function with createPlayConversationAudio factory
  - Replaced sentence generation functions with imported utilities
  - File size reduced from 3528 lines to 2676 lines (852 lines extracted)

### Edit: 2025-01-27
- Files: `public/src/AudioLearning/utils/sentenceGenerators.js`, `public/src/AudioLearning/AudioLearningPage.js`, `backend/tts.js`, `public/src/AudioLearning/handlers/playCurrentConversationHandler.js`
- Summary: Fixed word-by-word breakdown audio playing English words instead of Korean words by adding validation to detect and correct swapped ko/en fields in wordPairs
- Rationale: The AI was sometimes returning wordPairs with swapped ko/en fields, causing the audio to play English words when it should play Korean words first. Added Hangul character detection to validate and auto-correct swapped fields.
- Code refs:
```26:43:public/src/AudioLearning/utils/sentenceGenerators.js
export const getWordByWordPairs = async (api, english, korean) => {
  // ... validation logic to detect and swap ko/en if fields are reversed
  // Uses Hangul character detection (Unicode range AC00-D7AF) to identify Korean text
}
```
```470:490:backend/tts.js
for (const pair of sent.wordPairs) {
  // Extract ko/en fields with fallback to korean/english
  const koText = String((pair.ko || pair.korean || '')).trim();
  const enText = String((pair.en || pair.english || '')).trim();
  // Play Korean word first, then English translation
  const koWordBuf = await fetchTts(koText, 'ko', true);
  // ...
}
```
- Also fixed "Start" button to always call `handlePlayCurrentConversation` for Level 3 instead of playing cached audio URL, ensuring wordPairs are checked and used
- Added debug logging throughout the wordPairs flow to track data from generation through audio playback

### Edit: 2025-11-24
- Files: `backend/chat.js`, `backend/tts.js`, `public/src/AudioLearning/audioPattern.js`, `public/src/AudioLearning/AudioLearningPage.js`, `public/src/AudioLearning/handlers/playCurrentConversationHandler.js`, `public/src/AudioLearning/audioQuizModeHandsFree.js`, `public/src/AudioLearning/components/ConversationList.js`, `public/src/AudioLearning/handlers/quizLoopHandler.js`
- Summary: Disabled number-to-Korean conversion for word-by-word translation prompts and ensured all word pair objects only contain `ko` and `en` fields (removed `korean` and `english` fields)
- Rationale: User reported that numbers in English translations were being converted to Korean words (e.g., "2 o'clock" became "둘 o'clock") and word pair logs were showing `korean: undefined, english: undefined`. The number converter was running on all chat responses containing Korean characters, including word-by-word translation responses. Also, word pair normalization was creating objects with both old (`korean`, `english`) and new (`ko`, `en`) field names.
- Code refs:
```45:48:backend/chat.js
// Skip number conversion for word-by-word translation prompts
// These prompts ask for JSON with "ko" and "en" fields, and we don't want to convert numbers in English translations
const isWordByWordTranslation = /word\s+by\s+word|word-by-word|"ko".*"en"|"en".*"ko"/i.test(prompt);

// Convert numbers to Korean words if the response contains Korean characters
// BUT skip for word-by-word translations to preserve English translations
if (outputText && /[가-힣]/.test(outputText) && !isWordByWordTranslation) {
  outputText = convertNumbersInKoreanText(outputText, prompt);
}
```
```387:391:backend/tts.js
wordPairs: Array.isArray(x.wordPairs) ? x.wordPairs.map(p => {
  // Only include ko and en fields, explicitly exclude korean and english
  const ko = String((p && p.ko) || (p && p.korean) || '').trim();
  const en = String((p && p.en) || (p && p.english) || '').trim();
  return { ko, en };
}).filter(p => p.en && p.ko) : []
```
```93:97:public/src/AudioLearning/audioPattern.js
wordPairs: Array.isArray(pairs) ? pairs.map(p => {
  // Only include ko and en fields, explicitly exclude korean and english
  const ko = String(p.ko || p.korean || '').trim();
  const en = String(p.en || p.english || '').trim();
  return { ko, en };
}).filter(p => p.ko && p.en) : []
```
- Updated all word pair normalization locations to create clean objects with only `ko` and `en` fields, removing any `korean` and `english` fields that might have been present

### Edit: 2025-11-24
- Files: `public/src/AudioLearning/AudioLearningPage.js`
- Summary: Added automatic Level 3 audio generation when a new conversation is created via "Generate New Conversation" button
- Rationale: User reported that clicking "Generate New Conversation" didn't generate TTS audio with word pairs. Previously, audio was only generated when clicking "Start" or "Play". Now, when a new conversation is generated and quiz difficulty is Level 3, the Level 3 audio (with word-by-word breakdown) is automatically generated immediately after the conversation is created.
- Code refs:
```972:1025:public/src/AudioLearning/AudioLearningPage.js
setGeneratedSentences(batchWithData);
setCurrentConversationId(null); // New conversation, not saved yet
setConversationAudioUrl('');
// Automatically save the new conversation
saveConversationSet(batchWithData);

// Automatically generate Level 3 audio if quiz difficulty is Level 3
const isLevel3 = (Number(quizDifficulty) || 1) === 3;
if (isLevel3 && batchWithData.length > 0) {
  // Check if word pairs exist
  const hasWordPairs = batchWithData.every(item => Array.isArray(item.wordPairs) && item.wordPairs.length > 0);
  
  if (hasWordPairs) {
    // Show loading state
    setIsGeneratingLevel3Audio(true);
    setLevel3AudioProgress(0);
    
    try {
      // Format sentences with word pairs for Level 3 audio generation
      const sentencesWithPairs = batchWithData.map(item => ({
        english: String(item.english || ''),
        korean: String(item.korean || ''),
        wordPairs: Array.isArray(item.wordPairs) ? item.wordPairs.map(pair => {
          // Only include ko and en fields
          const ko = String(pair.ko || pair.korean || '').trim();
          const en = String(pair.en || pair.english || '').trim();
          return { ko, en };
        }).filter(p => p.ko && p.en) : []
      }));
      
      setLevel3AudioProgress(50);
      
      // Generate Level 3 audio
      const audioUrl = await generateLevel3Audio(
        sentencesWithPairs,
        Math.max(0, Number(quizDelaySec) || 0.5)
      );
      
      setLevel3AudioProgress(100);
      
      if (audioUrl) {
        setConversationAudioUrl(audioUrl);
        console.log('[handleGenerateNewConversation] Generated Level 3 audio:', audioUrl);
      } else {
        console.warn('[handleGenerateNewConversation] Failed to generate Level 3 audio');
      }
    } catch (err) {
      console.error('[handleGenerateNewConversation] Error generating Level 3 audio:', err);
    } finally {
      setIsGeneratingLevel3Audio(false);
      setLevel3AudioProgress(0);
    }
  } else {
    console.warn('[handleGenerateNewConversation] Word pairs missing, skipping Level 3 audio generation');
  }
}
```
- The audio generation happens automatically after the conversation is saved, so users don't need to click "Start" or "Play" to generate the audio. The audio URL is set immediately, ready for playback.

### Edit: 2025-11-24
- Files: `public/src/AudioLearning/components/QuizControls.js`, `public/src/AudioLearning/AudioLearningPage.js`
- Summary: Changed stop button to pause button with pause icon (⏸) when audio is playing
- Rationale: User requested that the stop button should be replaced with a pause button with an icon. When audio is playing/looping, clicking the button now pauses instead of stopping, and shows a pause icon (⏸) when playing and a play icon (▶️) when paused. This allows users to pause and resume audio without fully stopping it.
- Code refs:
```179:214:public/src/AudioLearning/components/QuizControls.js
<button
  className="audio-btn"
  onClick={async () => {
    const level = Number(quizDifficulty) || 1;
    if (isQuizLooping) {
      // Pause instead of stop
      if (isPaused) {
        resumeLoop();
        setIsPaused(false);
      } else {
        pauseLoop();
        setIsPaused(true);
      }
    } else {
      // ... start logic
    }
  }}
  title={isQuizLooping ? (isPaused ? 'Resume' : 'Pause') : ...}
  aria-label={isQuizLooping ? (isPaused ? 'Resume' : 'Pause') : 'Start'}
>
  {isQuizLooping ? (isPaused ? '▶️' : '⏸') : 'Start'}
</button>
```
```1473:1520:public/src/AudioLearning/AudioLearningPage.js
// If currently playing/looping, pause/resume it
if (isQuizLooping) {
  if (isPaused) {
    // Resume logic
  } else {
    // Pause logic
  }
  return;
}
```
- The button now shows ⏸ (pause icon) when playing and ▶️ (play icon) when paused, instead of showing "Stop" text. This provides better visual feedback and allows pausing/resuming without fully stopping the audio playback.

### Edit: 2025-11-24
- Files: `public/src/AudioLearning/utils/sentenceGenerators.js`
- Summary: Strengthened the prompt for word-by-word translation to explicitly prevent position-based matching and require meaning-based translation
- Rationale: User reported that word pairs were being generated incorrectly, with Korean words matched to English words by position rather than by meaning (e.g., "오늘" incorrectly matched to "Do" instead of "today"). The AI was matching the first Korean word to the first English word, second to second, etc., instead of translating each Korean word based on its actual meaning.
- Code refs:
```28:43:public/src/AudioLearning/utils/sentenceGenerators.js
const prompt = `Translate this Korean sentence word by word. Return ONLY a JSON array of objects, each with "ko" (Korean word/token) and "en" (English translation).

CRITICAL INSTRUCTIONS:
- Break the Korean sentence into individual words/tokens
- Translate each Korean word/token to its MEANING in English, NOT by matching position in the English sentence
- The English sentence is provided ONLY as context to understand the overall meaning - DO NOT match Korean words to English words by position
- Each Korean word must be translated based on its actual meaning, regardless of word order differences
- Keep the array in Korean word order (not English word order)
- Cover every word/token in the Korean sentence
- The "ko" field must contain the KOREAN word/token
- The "en" field must contain the ENGLISH translation/gloss for that specific Korean word's meaning

Korean sentence: ${korean}
English translation: ${english} (provided for context only - do not match by position)

Example:
Korean: "오늘 저녁에 시간 있으세요?"
English: "Do you have time this evening?"
Correct pairs: [{"ko":"오늘","en":"today"},{"ko":"저녁에","en":"in the evening"},{"ko":"시간","en":"time"},{"ko":"있으세요?","en":"do you have"}]
Note: "오늘" means "today" (not "Do"), "시간" means "time" (not "have") - translate by meaning, not position!

Return ONLY the JSON array, no other text.`;
```
- The updated prompt now explicitly states that the English sentence is for context only and should not be used for position-based matching. It includes a concrete example showing the correct translation (오늘→today, not 오늘→Do) to guide the AI to translate by meaning rather than position.

### Edit: 2025-11-24
- Files: `public/src/AudioLearning/conversationGenerator.js`
- Summary: Strengthened the conversation generation prompt to ensure context sentences are used as the PRIMARY topic focus, not just loose inspiration
- Rationale: User reported that when providing context like "cars", the generated conversation still included "weekend" topics and didn't focus on cars. The prompt was too weak, saying "somewhat inspired by or loosely related" which allowed the AI to ignore the context and default to generic topics. The prompt now explicitly requires the conversation to be DIRECTLY about the topic from the examples and warns against defaulting to generic topics like weekend plans or cafes.
- Code refs:
```48:71:public/src/AudioLearning/conversationGenerator.js
if (contextKorean && contextKorean.trim() && contextEnglish && contextEnglish.trim()) {
  prompt = `Return ONLY a JSON array of 5 objects like:
[{"speaker":"A","korean":"...","english":"..."}, ...]

CRITICAL: Create a conversation that is DIRECTLY about the topic, theme, and vocabulary from these example sentences. The conversation MUST focus on the same subject matter as the examples. Do NOT use generic topics like "weekend plans" or "cafe visits" unless those are explicitly mentioned in the examples.

Example sentences that define the conversation topic:
Korean: ${contextKorean.trim()}
English: ${contextEnglish.trim()}

Requirements:
- The conversation MUST be about the same topic/subject as the example sentences
- Use vocabulary and concepts directly related to the examples - if the example mentions "cars", the conversation should be about cars
- If the example mentions specific words or topics, those should be the PRIMARY focus of the conversation
- Do NOT default to generic topics like weekend plans, cafes, or weather unless those are in the examples
...
`;
}
```
- The prompt now uses "CRITICAL" and "MUST" language to emphasize that the context should be the primary focus, and explicitly warns against defaulting to generic topics. This should ensure that when a user provides context like "cars", the conversation will actually be about cars, not about weekend plans or cafes.

### Edit: 2025-11-24
- Files: `backend/logger.js`, `backend/server.js`
- Summary: Added timestamp logging utility that automatically adds timestamps to all console.log, console.warn, console.error, and console.info messages
- Rationale: User requested to add timing to the logs. All backend log messages now include timestamps in the format `[HH:MM:SS.mmm]` to help track when events occur and measure performance.
- Code refs:
```1:45:backend/logger.js
// Logger utility that adds timestamps to all log messages

function getTimestamp() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}

function formatLogMessage(args) {
  const timestamp = getTimestamp();
  if (args.length === 0) return `[${timestamp}]`;
  
  // If first argument is a string, prepend timestamp
  if (typeof args[0] === 'string') {
    return [`[${timestamp}] ${args[0]}`, ...args.slice(1)];
  }
  
  // Otherwise, add timestamp as first argument
  return [`[${timestamp}]`, ...args];
}

// Override console methods to add timestamps
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;
const originalInfo = console.info;

console.log = function(...args) {
  originalLog.apply(console, formatLogMessage(args));
};

console.warn = function(...args) {
  originalWarn.apply(console, formatLogMessage(args));
};

console.error = function(...args) {
  originalError.apply(console, formatLogMessage(args));
};

console.info = function(...args) {
  originalInfo.apply(console, formatLogMessage(args));
};
```
```1:10:backend/server.js
require('dotenv').config();
// Initialize logger to add timestamps to all console logs
require('./logger');
const express = require('express');
...
```
- The logger is initialized at the very start of `server.js` before any other modules are loaded, ensuring all backend logs (from chat.js, tts.js, etc.) will include timestamps. Timestamps are in the format `[HH:MM:SS.mmm]` for precise timing.

### Edit: 2025-11-24
- Files: `backend/chat.js`
- Summary: Added logging to print the first 5 lines of the POST body prompt when `/api/chat` requests are received.
- Rationale: User requested visibility into what prompts are being sent to the chat API for debugging purposes. Only the first 5 lines are printed to avoid cluttering logs with very long prompts.
- Code refs:
```5:13:backend/chat.js
  console.log('POST /api/chat request received.'); // Log request
  try {
    // Log the first 5 lines of the POST body prompt
    const { prompt } = req.body;
    if (prompt && typeof prompt === 'string') {
      const promptLines = prompt.split('\n').slice(0, 5);
      console.log('POST /api/chat body (first 5 lines):');
      promptLines.forEach((line, i) => {
        console.log(`  ${i + 1}: ${line.substring(0, 200)}${line.length > 200 ? '...' : ''}`);
      });
    }
```

### Edit: 2025-11-24
- Files: `public/src/AudioLearning/AudioLearningPage.js`, `public/src/AudioLearning/handlers/playCurrentConversationHandler.js`, `public/src/AudioLearning/components/ConversationList.js`
- Summary: Removed all regular conversation audio generation (`generateConversationAudio` function and `/api/tts/conversation` endpoint usage). Replaced with `generateLevel3AudioForItems` which always generates Level 3 audio (with word-by-word breakdown). The new function automatically generates wordPairs if they don't exist.
- Rationale: User requested that only Level 3 audio files should be saved, never regular conversation audio files. This ensures all conversations use the full audio pattern (English → Korean → word-by-word pairs → Korean repeat) regardless of quiz difficulty level.
- Code refs:
```228:258:public/src/AudioLearning/AudioLearningPage.js
  // Generate Level 3 audio for a conversation set (always use Level 3, never regular conversation audio)
  // Defined early so it can be used in playlist navigation functions
  const generateLevel3AudioForItems = React.useCallback(async (items) => {
    try {
      // If items not provided, use generatedSentences
      const list = Array.isArray(items) ? items : (Array.isArray(generatedSentences) ? generatedSentences : []);
      if (!list || list.length === 0) return null;
      
      // Check if items already have wordPairs
      const hasWordPairs = list.every(item => Array.isArray(item.wordPairs) && item.wordPairs.length > 0);
      
      let sentencesWithPairs;
      if (hasWordPairs) {
        // Use existing word pairs
        sentencesWithPairs = list.map(item => ({
          english: String(item.english || ''),
          korean: String(item.korean || ''),
          wordPairs: Array.isArray(item.wordPairs) ? item.wordPairs.map(pair => ({
            ko: String(pair.ko || pair.korean || '').trim(),
            en: String(pair.en || pair.english || '').trim()
          })).filter(p => p.ko && p.en) : []
        }));
      } else {
        // Generate word pairs for all sentences
        sentencesWithPairs = await prepareLevel3AudioData(
          list,
          getWordByWordPairsMemo,
          () => {} // No progress callback needed here
        );
      }
      
      // Generate Level 3 audio
      const audioUrl = await generateLevel3Audio(sentencesWithPairs, Math.max(0, Number(quizDelaySec) || 0.5));
      if (audioUrl) {
        setConversationAudioUrl(audioUrl);
        try { console.log('[Level3Audio] url', audioUrl); } catch (_) {}
        return audioUrl;
      }
      return null;
    } catch (err) {
      console.error('generateLevel3AudioForItems error:', err);
      setConversationAudioUrl('');
      return null;
    }
  }, [generatedSentences, quizDelaySec, getWordByWordPairsMemo, generateLevel3Audio]);
```
- All calls to `generateConversationAudio` were replaced with `generateLevel3AudioForItems` in:
  - `playNextConversation` and `playPreviousConversation` functions (playlist navigation)
  - Auto-load default conversation `useEffect` hook
  - `createHandlePlayCurrentConversation` handler (now always uses Level 3 audio for all difficulty levels)
  - `ConversationList` component (Load button, Create Playlist button, and all audio generation logic)
- The `/api/tts/conversation` endpoint is no longer called from the frontend. Only `/api/tts/level3` is used.

