import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from './api';
import './styles/AudioLearningPage.css';
import {
  requestWakeLock,
  releaseWakeLock,
  startKeepAlive,
  stopKeepAlive,
  updateMediaSession,
  ensureAudioContextActive,
} from './backgroundAudio';
import { speakToAudio } from './audioTTS';
import { generateAndPlayLoop, stopLoop, pauseLoop, resumeLoop } from './audioLoop';
import { generateVerbPracticeSentence } from './verbPractice';

// Use speakToAudio for background playback support (HTML5 Audio + MediaSession)
const speak = speakToAudio;

function AudioLearningPage() {
  const [searchParams] = useSearchParams();
  const [learningWords, setLearningWords] = React.useState(null);
  const [isLoadingLearningWords, setIsLoadingLearningWords] = React.useState(false);
  const playingRef = React.useRef(false);
  const pausedRef = React.useRef(false);
  const autoStartedRef = React.useRef(false);

  // Learning Mode state
  const [isLearningPlaying, setIsLearningPlaying] = React.useState(false);

  // Quiz mode state (seconds, decimals allowed)
  const [isQuizLooping, setIsQuizLooping] = React.useState(false);
  const quizLoopRef = React.useRef(false);
  // Quiz mode: 'hands-free' (no recording) or 'recording' (with recording and playback)
  const [quizMode, setQuizMode] = React.useState(() => {
    try {
      const saved = localStorage.getItem('audio_quizMode');
      return saved || 'hands-free';
    } catch (_) {
      return 'hands-free';
    }
  });
  const [isMicRecording, setIsMicRecording] = React.useState(false);
  const recorderRef = React.useRef(null);
  const mediaStreamRef = React.useRef(null);
  const recordedChunksRef = React.useRef([]);
  const [recordedUrl, setRecordedUrl] = React.useState('');
  const [currentQuizWord, setCurrentQuizWord] = React.useState(null);
  const [currentQuizSentence, setCurrentQuizSentence] = React.useState(null);
  const [quizDelaySec, setQuizDelaySec] = React.useState(() => {
    try {
      const saved = localStorage.getItem('audio_quizDelaySec');
      return saved ? parseFloat(saved) : 2.0;
    } catch (_) {
      return 2.0;
    }
  });
  const [quizRecordDurationSec, setQuizRecordDurationSec] = React.useState(() => {
    try {
      const saved = localStorage.getItem('audio_quizRecordDurationSec');
      return saved ? parseFloat(saved) : 2.0;
    } catch (_) {
      return 2.0;
    }
  });
  const [quizDifficulty, setQuizDifficulty] = React.useState(() => {
    try {
      const saved = localStorage.getItem('audio_quizDifficulty');
      return saved ? parseInt(saved, 10) : 3;
    } catch (_) {
      return 3;
    }
  });
  const recognitionRef = React.useRef(null);
  const recognizedRef = React.useRef('');
  const [recognizedText, setRecognizedText] = React.useState('');
  const [recordingError, setRecordingError] = React.useState('');
  
  // Console error tracking for mobile debugging
  const [consoleErrors, setConsoleErrors] = React.useState([]);
  const [showErrorPanel, setShowErrorPanel] = React.useState(false);
  const consoleErrorRef = React.useRef([]);
  // Track if autoplay was blocked (for Brave browser)
  const [autoplayBlocked, setAutoplayBlocked] = React.useState(false);

  // Loop/sets UI state
  const [currentSetWords, setCurrentSetWords] = React.useState([]); // words currently used in loop
  const [loopGenerating, setLoopGenerating] = React.useState(false);
  const [loopProgress, setLoopProgress] = React.useState(0);
  // Hands-free word set selection (date-sorted from backend)
  const [setIndex, setSetIndex] = React.useState(() => {
    try {
      const saved = localStorage.getItem('audio_setIndex');
      return saved ? parseInt(saved, 10) : 1;
    } catch (_) {
      return 1;
    }
  }); // 1-based
  const [isPaused, setIsPaused] = React.useState(false);

  // Saved sets (local only)
  const [wordSets, setWordSets] = React.useState(() => {
    try { const raw = localStorage.getItem('word_sets_v1'); const arr = raw ? JSON.parse(raw) : []; return Array.isArray(arr) ? arr : []; } catch (_) { return []; }
  });
  const persistSets = React.useCallback((sets) => {
    setWordSets(sets);
    try { localStorage.setItem('word_sets_v1', JSON.stringify(sets)); } catch (_) {}
  }, []);
  const [showManageSets, setShowManageSets] = React.useState(false);
  const [showGenerator, setShowGenerator] = React.useState(false);
  const [generatorPrompt, setGeneratorPrompt] = React.useState('Return ONLY JSON array of up to 20 items like [{"korean":"...","english":"..."}]. A1–A2 words.');
  const [generatorLoading, setGeneratorLoading] = React.useState(false);
  const [generatedSetTitle, setGeneratedSetTitle] = React.useState('My Word Set');
  const [generatedWords, setGeneratedWords] = React.useState([]);
  const [generatedSentences, setGeneratedSentences] = React.useState([]); // recent generated sentences for Level 2/3
  // Saved conversation sets and audio export
  const [savedConversations, setSavedConversations] = React.useState(() => {
    try { const raw = localStorage.getItem('conversation_sets_v1'); const arr = raw ? JSON.parse(raw) : []; return Array.isArray(arr) ? arr : []; } catch (_) { return []; }
  });
  const [defaultConversationId, setDefaultConversationId] = React.useState(() => {
    try { return localStorage.getItem('default_conversation_id') || null; } catch (_) { return null; }
  });
  const persistConversations = React.useCallback((list) => {
    setSavedConversations(list);
    try { localStorage.setItem('conversation_sets_v1', JSON.stringify(list)); } catch (_) {}
  }, []);
  const setDefaultConversation = React.useCallback((id) => {
    setDefaultConversationId(id);
    try { 
      if (id) {
        localStorage.setItem('default_conversation_id', id);
      } else {
        localStorage.removeItem('default_conversation_id');
      }
    } catch (_) {}
  }, []);
  const [conversationAudioUrl, setConversationAudioUrl] = React.useState('');
  const conversationAudioRef = React.useRef(null);
  const [isGeneratingLevel3Audio, setIsGeneratingLevel3Audio] = React.useState(false);
  const [level3AudioProgress, setLevel3AudioProgress] = React.useState(0);
  // User input for conversation context
  const [conversationContextKorean, setConversationContextKorean] = React.useState('');
  const [conversationContextEnglish, setConversationContextEnglish] = React.useState('');
  // Server conversation helpers (shared DB)
  const fetchServerConversations = React.useCallback(async () => {
    try {
      const res = await fetch('/api/conversations?limit=100', { cache: 'no-store' });
      if (!res.ok) return;
      const list = await res.json().catch(() => []);
      if (!Array.isArray(list)) return;
      const normalized = list.map((c) => ({
        id: c.id,
        title: String(c.title || 'Untitled'),
        items: Array.isArray(c.items) ? c.items : [],
        audioUrl: String(c.audio_url || c.audioUrl || '').trim() || null,
        createdAt: Date.parse(c.created_at || '') || Date.now()
      }));
      persistConversations(normalized);
    } catch (_) {}
  }, [persistConversations]);
  const postServerConversation = React.useCallback(async (title, items) => {
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, items })
      });
      if (!res.ok) return null;
      const data = await res.json().catch(() => null);
      return (data && Number.isFinite(data.id)) ? data.id : null;
    } catch (_) {
      return null;
    }
  }, []);
  
  // Generate single audio file for a conversation set (KO→EN order)
  // Defined early so it can be used in useEffect
  const generateConversationAudio = React.useCallback(async (items) => {
    try {
      // If items not provided, use generatedSentences
      const list = Array.isArray(items) ? items : (Array.isArray(generatedSentences) ? generatedSentences : []);
      if (!list || list.length === 0) return null;
      const res = await fetch('/api/tts/conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: list.map(s => ({ korean: String(s.korean || ''), english: String(s.english || '') })),
          order: 'en-ko',
          delaySeconds: Math.max(0, Number(quizDelaySec) || 0)
        })
      });
      if (!res.ok) throw new Error('Failed to generate conversation audio');
      const data = await res.json().catch(() => null);
      const url = data && data.url ? data.url : '';
      if (url) {
        setConversationAudioUrl(url);
        try { console.log('[ConversationAudio] url', url); } catch (_) {}
        return url;
      }
      return null;
    } catch (err) {
      console.error('generateConversationAudio error:', err);
      setConversationAudioUrl('');
      return null;
    }
  }, [generatedSentences, quizDelaySec]);
  
  // Auto-load default conversation (or first one) on startup
  React.useEffect(() => {
    try {
      // Clear default if the conversation no longer exists
      if (defaultConversationId && Array.isArray(savedConversations)) {
        const exists = savedConversations.some(c => c.id === defaultConversationId);
        if (!exists) {
          setDefaultConversation(null);
        }
      }
      
      if (Array.isArray(savedConversations) && savedConversations.length > 0) {
        if (!generatedSentences || generatedSentences.length === 0) {
          // Find default conversation, or fall back to first
          const defaultConv = defaultConversationId 
            ? savedConversations.find(c => c.id === defaultConversationId)
            : null;
          const convToLoad = defaultConv || savedConversations[0];
          
          const items = Array.isArray(convToLoad && convToLoad.items) ? convToLoad.items : [];
          if (items.length > 0) {
            setGeneratedSentences(items);
            
            // Auto-generate audio if not available
            if (convToLoad.audioUrl) {
              setConversationAudioUrl(convToLoad.audioUrl);
            } else {
              // Generate audio automatically
              (async () => {
                try {
                  const audioUrl = await generateConversationAudio(items);
                  if (audioUrl) {
                    // Update the saved conversation with the new audio URL
                    const next = savedConversations.map(x => 
                      x.id === convToLoad.id ? { ...x, audioUrl } : x
                    );
                    persistConversations(next);
                  }
                } catch (_) {}
              })();
            }
          }
        }
      }
    } catch (_) {}
  }, [savedConversations, defaultConversationId, generateConversationAudio, persistConversations, setDefaultConversation]); 
  // On mount, try to sync from server so other devices are visible
  React.useEffect(() => {
    (async () => {
      try { await fetchServerConversations(); } catch (_) {}
    })();
  }, [fetchServerConversations]);
  // UI helper: total sets for hands-free Level 1 (20 per set)
  const totalSetsHF = React.useMemo(() => {
    const n = Array.isArray(learningWords) ? learningWords.length : 0;
    return Math.max(1, Math.ceil(n / 20));
  }, [learningWords]);

  // Level 2: selected set of 5 words
  const [level2Words, setLevel2Words] = React.useState([]);
  React.useEffect(() => {
    const words = Array.isArray(learningWords) ? learningWords : [];
    if (words.length > 0) {
      setLevel2Words(words.slice(0, Math.min(5, words.length)));
    } else {
      setLevel2Words([]);
    }
  }, [learningWords]);

  // Preview words for the currently selected set (hands-free Level 1)
  const selectedSetWords = React.useMemo(() => {
    const words = Array.isArray(learningWords) ? learningWords : [];
    if (words.length === 0) return [];
    const total = Math.max(1, Math.ceil(words.length / 20));
    const idx = Math.min(Math.max(1, Number(setIndex) || 1), total);
    const start = (idx - 1) * 20;
    return words.slice(start, Math.min(start + 20, words.length));
  }, [learningWords, setIndex]);

  const parseJsonArray = (text) => {
    if (!text) return [];
    // Try to find a JSON array in the response
    const m = String(text).match(/\[[\s\S]*\]/);
    if (!m) return [];
    try { const arr = JSON.parse(m[0]); return Array.isArray(arr) ? arr : []; } catch (_) { return []; }
  };

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

  const endsWithBrightVowel = (stem) => /[ㅏㅗ]$/.test(stem);

  const conjugateVerbSimple = React.useCallback((baseForm, tense) => {
    if (!baseForm || typeof baseForm !== 'string') return baseForm;
    const stem = baseForm.endsWith('다') ? baseForm.slice(0, -1 * '다'.length) : baseForm;
    // 하다 special
    if (baseForm === '하다' || stem.endsWith('하')) {
      if (tense === 'present') return '해요';
      if (tense === 'past') return '했어요';
      return '할 거예요';
    }
    const bright = endsWithBrightVowel(stem);
    if (tense === 'present') return stem + (bright ? '아요' : '어요');
    if (tense === 'past') return stem + (bright ? '았어요' : '었어요');
    // future
    const needsEu = /[^aeiou가-힣]$/.test(stem) || /[ㄱ-ㅎ]$/.test(stem); // rough guard
    return stem + (stem.endsWith('ㄹ') ? ' 거예요' : (needsEu ? '을 거예요' : 'ㄹ 거예요'));
  }, []);

  const applyPronounAndTenseIfVerb = React.useCallback((wordObj) => {
    if (!wordObj || !wordObj.korean) return wordObj;
    // Only apply if type says 'verb' (learning words) or looks like dictionary form ending in 다
    const isVerb = String(wordObj.type || '').toLowerCase() === 'verb' || /다$/.test(wordObj.korean);
    if (!isVerb) return wordObj;
    const tenses = ['present', 'past', 'future'];
    const tense = tenses[Math.floor(Math.random() * tenses.length)];
    const pron = pickRandomPronoun();
    const conj = conjugateVerbSimple(wordObj.korean, tense);
    return { ...wordObj, korean: `${pron.ko} ${conj}` };
  }, [pickRandomPronoun, conjugateVerbSimple]);

  // Helpers for Level 2: subject (pronoun or noun) + conjugated verb phrase
  const hasFinalConsonant = React.useCallback((k) => {
    if (!k || typeof k !== 'string') return false;
    const ch = k.trim().slice(-1);
    const code = ch.charCodeAt(0) - 0xac00;
    if (code < 0 || code > 11171) return false;
    const jong = code % 28;
    return jong !== 0;
  }, []);

  const pickRandomVerb = React.useCallback((words) => {
    const candidates = (Array.isArray(words) ? words : []).filter((w) => {
      const ko = String(w.korean || '');
      const t = String(w.type || '').toLowerCase();
      return t === 'verb' || /다$/.test(ko);
    });
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }, []);

  const pickRandomNoun = React.useCallback((words) => {
    const candidates = (Array.isArray(words) ? words : []).filter((w) => {
      const ko = String(w.korean || '');
      const t = String(w.type || '').toLowerCase();
      const looksVerb = /다$/.test(ko);
      return t === 'noun' || (!looksVerb && t !== 'verb');
    });
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }, []);

  const englishPresent3rd = React.useCallback((base) => {
    const b = String(base || '').trim();
    const irregular = { have: 'has', do: 'does', go: 'goes', be: 'is' };
    if (irregular[b]) return irregular[b];
    if (/[^aeiou]y$/i.test(b)) return b.replace(/y$/i, 'ies');
    if (/(s|x|z|ch|sh)$/i.test(b)) return b + 'es';
    return b + 's';
  }, []);

  const englishPast = React.useCallback((base) => {
    const b = String(base || '').trim();
    const irregular = { go: 'went', have: 'had', do: 'did', be: 'was', eat: 'ate', see: 'saw', make: 'made', take: 'took', come: 'came', get: 'got', say: 'said', write: 'wrote', read: 'read' };
    if (irregular[b]) return irregular[b];
    if (/e$/i.test(b)) return b + 'd';
    if (/[^aeiou]y$/i.test(b)) return b.replace(/y$/i, 'ied');
    return b + 'ed';
  }, []);

  const buildSubjectAndVerbPair = React.useCallback((words) => {
    // Pick subject: 50% pronoun, else noun from words (fallback to pronoun)
    let subjectKo = '';
    let subjectEn = '';
    let thirdPersonSingular = false;
    const usePronoun = Math.random() < 0.5;
    if (usePronoun) {
      const p = pickRandomPronoun();
      subjectKo = p.ko; subjectEn = p.en;
      thirdPersonSingular = /^(he|she|it)$/i.test(p.en);
    } else {
      const n = pickRandomNoun(words);
      if (n) {
        const particle = hasFinalConsonant(String(n.korean || '')) ? '은' : '는';
        subjectKo = `${String(n.korean || '').trim()} ${particle}`.trim();
        subjectEn = String(n.english || String(n.korean || ''));
        thirdPersonSingular = true;
      } else {
        const pFallback = pickRandomPronoun();
        subjectKo = pFallback.ko; subjectEn = pFallback.en;
        thirdPersonSingular = /^(he|she|it)$/i.test(pFallback.en);
      }
    }

    // Pick verb
    const v = pickRandomVerb(words);
    if (!v) return null;
    const verbKoBase = String(v.korean || '');
    const verbEnBase = String(v.english || '').replace(/^to\s+/i, '').split(/[;,]/)[0].trim() || 'do';
    const tenses = ['present', 'past', 'future'];
    const tense = tenses[Math.floor(Math.random() * tenses.length)];
    const koVerb = conjugateVerbSimple(verbKoBase, tense);
    let enVerb = '';
    if (tense === 'present') {
      enVerb = thirdPersonSingular ? englishPresent3rd(verbEnBase) : verbEnBase;
    } else if (tense === 'past') {
      enVerb = englishPast(verbEnBase);
    } else {
      enVerb = `will ${verbEnBase}`;
    }
    const english = `${subjectEn} ${enVerb}`.trim();
    const korean = `${subjectKo} ${koVerb}`.trim();
    return { english, korean };
  }, [pickRandomPronoun, pickRandomNoun, pickRandomVerb, hasFinalConsonant, conjugateVerbSimple, englishPresent3rd, englishPast]);

  // For Level 2 (hands-free), prefer pronouns-only subjects to keep sentences simple and natural
  const buildPronounAndVerbPair = React.useCallback((words) => {
    const p = pickRandomPronoun();
    const v = pickRandomVerb(words);
    if (!v) return null;
    const verbKoBase = String(v.korean || '');
    const verbEnBase = String(v.english || '').replace(/^to\s+/i, '').split(/[;,]/)[0].trim() || 'do';
    const tenses = ['present', 'past', 'future'];
    const tense = tenses[Math.floor(Math.random() * tenses.length)];
    const koVerb = conjugateVerbSimple(verbKoBase, tense);
    let enVerb = '';
    if (tense === 'present') {
      enVerb = /^(he|she|it)$/i.test(p.en) ? englishPresent3rd(verbEnBase) : verbEnBase;
    } else if (tense === 'past') {
      enVerb = englishPast(verbEnBase);
    } else {
      enVerb = `will ${verbEnBase}`;
    }
    const english = `${p.en} ${enVerb}`.trim();
    const korean = `${p.ko} ${koVerb}`.trim();
    return { english, korean };
  }, [pickRandomPronoun, pickRandomVerb, conjugateVerbSimple, englishPresent3rd, englishPast]);

  // Level 2 specialized workflow: pronoun + (오늘/어제/내일) + correctly conjugated verb
  const buildVerbWithDateSentence = React.useCallback((words) => {
    const p = pickRandomPronoun();
    const v = pickRandomVerb(words);
    if (!v) return null;
    const verbKoBase = String(v.korean || '');
    const verbEnBase = String(v.english || '').replace(/^to\s+/i, '').split(/[;,]/)[0].trim() || 'do';
    // Pick date modifier and map to tense
    const choices = [
      { ko: '오늘', en: 'today', tense: 'present' },
      { ko: '어제', en: 'yesterday', tense: 'past' },
      { ko: '내일', en: 'tomorrow', tense: 'future' },
    ];
    const mod = choices[Math.floor(Math.random() * choices.length)];
    const koVerb = conjugateVerbSimple(verbKoBase, mod.tense);
    let enVerb = '';
    if (mod.tense === 'present') {
      enVerb = /^(he|she|it)$/i.test(p.en) ? englishPresent3rd(verbEnBase) : verbEnBase;
    } else if (mod.tense === 'past') {
      enVerb = englishPast(verbEnBase);
    } else {
      enVerb = `will ${verbEnBase}`;
    }
    // Compose sentences
    const korean = `${mod.ko} ${p.ko} ${koVerb}`.trim();
    const english = `${p.en} ${enVerb} ${mod.en}`.trim();
    return { english, korean };
  }, [pickRandomPronoun, pickRandomVerb, conjugateVerbSimple, englishPresent3rd, englishPast]);

  // Level 2 alternative: noun + adjective sentence (present tense)
  const pickRandomAdjective = React.useCallback((words) => {
    const candidates = (Array.isArray(words) ? words : []).filter((w) => {
      const t = String(w.type || '').toLowerCase();
      const ko = String(w.korean || '');
      return t === 'adjective' || /다$/.test(ko); // heuristic for descriptive verbs
    });
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }, []);

  const buildNounAndAdjectiveSentence = React.useCallback((words) => {
    const n = pickRandomNoun(words);
    const a = pickRandomAdjective(words);
    if (!n || !a) return null;
    const nounKo = String(n.korean || '').trim();
    const nounEn = String(n.english || String(n.korean || '')).trim();
    const particle = hasFinalConsonant(nounKo) ? '은' : '는';
    const adjKoBase = String(a.korean || '').trim();
    const adjEnBaseRaw = String(a.english || '').trim();
    // Conjugate adjective to present polite
    const koAdj = conjugateVerbSimple(adjKoBase, 'present');
    // Heuristic: strip leading "to be " or "be " to get adjective gloss
    let adjEn = adjEnBaseRaw.replace(/^to\s+be\s+/i, '').replace(/^be\s+/i, '');
    // Build sentences
    const korean = `${nounKo} ${particle} ${koAdj}`.trim();
    const english = `The ${nounEn} is ${adjEn}`.trim();
    return { english, korean };
  }, [pickRandomNoun, pickRandomAdjective, hasFinalConsonant, conjugateVerbSimple]);

  // (Removed: conjugation hints)

  const handleGenerateSet = React.useCallback(async () => {
    try {
      setGeneratorLoading(true);
      setGeneratedWords([]);
      const resp = await api.chat(generatorPrompt);
      const data = await resp.json().catch(() => null);
      const arr = parseJsonArray(data && (data.response || ''));
      const norm = arr
        .map((x) => ({ korean: String((x.ko || x.korean || '')).trim(), english: String((x.en || x.english || '')).trim() }))
        .filter((x) => x.korean && x.english)
        .slice(0, 20);
      setGeneratedWords(norm);
      if (!generatedSetTitle || generatedSetTitle === 'My Word Set') {
        const ts = new Date();
        const t = `${ts.getFullYear()}-${String(ts.getMonth()+1).padStart(2,'0')}-${String(ts.getDate()).padStart(2,'0')} ${String(ts.getHours()).padStart(2,'0')}:${String(ts.getMinutes()).padStart(2,'0')}`;
        setGeneratedSetTitle(`Set ${t}`);
      }
    } catch (_) {
      setGeneratedWords([]);
    } finally {
      setGeneratorLoading(false);
    }
  }, [generatorPrompt, generatedSetTitle]);

  const saveGeneratedSet = React.useCallback(() => {
    if (!generatedWords || generatedWords.length === 0) return;
    const id = Date.now().toString(36);
    const set = { id, title: generatedSetTitle || 'Untitled', words: generatedWords, createdAt: Date.now() };
    persistSets([set, ...wordSets]);
    setShowGenerator(false);
    setGeneratedWords([]);
  }, [generatedWords, generatedSetTitle, wordSets, persistSets]);

  const playSet = React.useCallback(async (set) => {
    if (!set || !Array.isArray(set.words) || set.words.length === 0) return;
    setIsQuizLooping(true);
    playingRef.current = true;
    pausedRef.current = false;
    quizLoopRef.current = true;
    try {
      setCurrentSetWords(set.words.slice(0, 20));
      setLoopGenerating(true);
      setLoopProgress(10);
      const timer = setInterval(() => setLoopProgress((p) => Math.min(90, p + 5)), 300);
      await generateAndPlayLoop(set.words, 'ko-KR', 1.0, quizDelaySec);
      clearInterval(timer);
      setLoopProgress(100);
    } catch (_) {
    } finally {
      setLoopGenerating(false);
      setLoopProgress(0);
    }
  }, [quizDelaySec]);

  // Check if recording is supported
  const checkRecordingSupport = React.useCallback(() => {
    const isSecureContext = window.isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    
    if (!isSecureContext) {
      return 'Recording requires HTTPS on Android. Your connection is HTTP. Please access via HTTPS or localhost.';
    }
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return 'getUserMedia not available. Try Chrome or Firefox on HTTPS.';
    }
    
    if (!MediaRecorder) {
      return 'MediaRecorder not supported in this browser. Try Chrome or Firefox.';
    }
    
    return '';
  }, []);

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
    
    // Handle visibility changes to maintain wake lock and audio context
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && (playingRef.current || quizLoopRef.current)) {
        await requestWakeLock();
        // Resume audio context if suspended
        try {
          if (window.__AUDIO_CONTEXT_KEEPALIVE__ && window.__AUDIO_CONTEXT_KEEPALIVE__.context) {
            if (window.__AUDIO_CONTEXT_KEEPALIVE__.context.state === 'suspended') {
              await window.__AUDIO_CONTEXT_KEEPALIVE__.context.resume();
            }
          }
        } catch (_) {}
      }
    };
    
    // Handle page focus/blur to keep audio active
    const handlePageFocus = () => {
      try {
        if (window.__AUDIO_CONTEXT_KEEPALIVE__ && window.__AUDIO_CONTEXT_KEEPALIVE__.context) {
          if (window.__AUDIO_CONTEXT_KEEPALIVE__.context.state === 'suspended') {
            window.__AUDIO_CONTEXT_KEEPALIVE__.context.resume();
          }
        }
      } catch (_) {}
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handlePageFocus);
    window.addEventListener('blur', handlePageFocus);
    
    // Cleanup on unmount
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handlePageFocus);
      window.removeEventListener('blur', handlePageFocus);
      releaseWakeLock();
      stopKeepAlive();
    };
  }, [checkRecordingSupport, searchParams]);

  // Await while paused without tearing down the loop
  const waitWhilePaused = React.useCallback(async () => {
    while (pausedRef.current && playingRef.current) {
      await new Promise(r => setTimeout(r, 100));
    }
  }, []);

  // History disabled on audio page
  const pushHistory = React.useCallback(() => {}, []);

  const ensureLearningWords = React.useCallback(async () => {
    if (learningWords && Array.isArray(learningWords) && learningWords.length > 0) return learningWords;
    setIsLoadingLearningWords(true);
    try {
      const res = await api.getLearningWords(500);
      if (!res.ok) throw new Error('Failed to fetch learning words');
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      setLearningWords(arr);
      return arr;
    } catch (_) {
      setLearningWords([]);
      return [];
    } finally {
      setIsLoadingLearningWords(false);
    }
  }, [learningWords]);

  // Load learning words on mount to allow set preview by default
  React.useEffect(() => {
    (async () => {
      try { await ensureLearningWords(); } catch (_) {}
    })();
  }, [ensureLearningWords]);

  const parseJsonObject = (text) => {
    const m = text && text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { const obj = JSON.parse(m[0]); return obj && typeof obj === 'object' ? obj : null; } catch (_) { return null; }
  };

  const pickRandom = (arr, n) => {
    const copy = [...arr];
    const out = [];
    while (copy.length && out.length < n) {
      const i = Math.floor(Math.random() * copy.length);
      out.push(copy.splice(i, 1)[0]);
    }
    return out;
  };

  const parseJsonArraySafe = (text) => {
    if (!text) return [];
    const m = String(text).match(/\[[\s\S]*\]/);
    if (!m) return [];
    try { const arr = JSON.parse(m[0]); return Array.isArray(arr) ? arr : []; } catch (_) { return []; }
  };

  // Fetch one curriculum sentence (EN/KR) with error handling and fallback
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

  // Get word-by-word explanation pairs using chat (fallback to simple split)
  const getWordByWordPairs = React.useCallback(async (english, korean) => {
    try {
      const prompt = `Return ONLY a JSON array of objects each like {"ko":"…","en":"…"} that maps each token in this Korean sentence to a concise English gloss. Keep array in Korean word order and cover every token.
Korean: ${korean}
English: ${english}`;
      const res = await api.chat(prompt);
      const data = await res.json().catch(() => null);
      const arr = parseJsonArraySafe(data && (data.response || ''));
      const norm = arr.map(x => ({ ko: String((x.ko || x.korean || '')).trim(), en: String((x.en || x.english || '')).trim() }))
                     .filter(x => x.ko && x.en);
      if (norm && norm.length) return norm;
    } catch (_) {}
    // Fallback: naive split by spaces
    const koParts = String(korean || '').split(/\s+/).filter(Boolean);
    const enParts = String(english || '').split(/\s+/).filter(Boolean);
    const n = Math.min(koParts.length, enParts.length);
    return new Array(n).fill(0).map((_, i) => ({ ko: koParts[i], en: enParts[i] }));
  }, []);

  const generateLearningSentence = React.useCallback(async () => {
    const words = await ensureLearningWords();
    if (!words || words.length === 0) return null;
    const subset = pickRandom(words, Math.max(3, Math.min(7, Math.floor(Math.random()*6)+3)));
    const examples = subset.map(w => `${w.korean} (${w.english})`).join(', ');
    const prompt = `Using ONLY some of these Korean learning words: ${examples}\nCreate ONE natural, simple Korean sentence (<= 10 words) that is grammatically correct.\nReturn ONLY JSON: {"korean":"...","english":"...","tokens":[{"ko":"...","en":"..."}, ...]}\ntokens should list the key words in the sentence (3-8 items) with their English.

CRITICAL: For any numbers in the Korean sentence, use Korean words (not Arabic numerals):
- For time (시, 시간): use Native Korean (하나, 둘, 셋, 넷, 다섯, 여섯, 일곱, 여덟, 아홉, 열, etc.). Example: "9시" should be "아홉 시"
- For counting objects: use Native Korean (하나, 둘, 셋, etc.)
- For dates, money, general counting: use Sino-Korean (일, 이, 삼, 사, 오, 육, 칠, 팔, 구, 십, etc.)
NEVER use Arabic numerals (1, 2, 3, etc.) in Korean text - always convert to Korean words.`;
    try {
      const res = await api.chat(prompt);
      const data = await res.json();
      const obj = parseJsonObject(data && data.response || '');
      if (obj && obj.korean && obj.english) {
        const tokens = Array.isArray(obj.tokens) ? obj.tokens.filter(t => t && t.ko) : [];
        return { korean: String(obj.korean), english: String(obj.english), tokens };
      }
    } catch (_) {}
    // Fallback: naive sentence from subset words
    const kor = subset.map(w => w.korean).join(' ');
    const eng = subset.map(w => w.english).join(' ');
    const tokens = subset.map(w => ({ ko: w.korean, en: w.english }));
    return { korean: kor, english: eng, tokens };
  }, [ensureLearningWords]);

  // Save current Level 3 conversation set (5 items)
  const saveConversationSet = React.useCallback(() => {
    try {
      const items = Array.isArray(generatedSentences) ? generatedSentences.slice(0, 5) : [];
      if (!items || items.length === 0) return;
      const id = Date.now().toString(36);
      const ts = new Date();
      const title = `Conversation ${ts.getFullYear()}-${String(ts.getMonth()+1).padStart(2,'0')}-${String(ts.getDate()).padStart(2,'0')} ${String(ts.getHours()).padStart(2,'0')}:${String(ts.getMinutes()).padStart(2,'0')}`;
      // Include audio URL if available
      const entry = { 
        id, 
        title, 
        items, 
        audioUrl: conversationAudioUrl || null,
        createdAt: Date.now() 
      };
      persistConversations([entry, ...savedConversations]);
      // Save to server (shared DB) and refresh list
      (async () => {
        try {
          const serverId = await postServerConversation(title, items);
          if (serverId) {
            await fetchServerConversations();
          }
        } catch (_) {}
      })();
    } catch (_) {}
  }, [generatedSentences, conversationAudioUrl, savedConversations, persistConversations, postServerConversation, fetchServerConversations]);

  const playConversationAudio = React.useCallback((shouldLoop = false, audioUrl = null) => {
    return new Promise((resolve) => {
      try {
        const urlToPlay = audioUrl || conversationAudioUrl;
        if (!urlToPlay) return resolve();
        // Stop previous if exists
        try {
          const prev = conversationAudioRef.current;
          if (prev) {
            if (prev._speedCheckInterval) { try { clearInterval(prev._speedCheckInterval); } catch (_) {} }
            prev.onended = null;
            prev.onerror = null;
            prev.loop = false;
            prev.pause();
            prev.src = '';
            prev.load();
          }
        } catch (_) {}
        const audio = new Audio(urlToPlay);
        conversationAudioRef.current = audio;
        audio.setAttribute('playsinline', 'true');
        // Set loop only if requested (for Level 3)
        audio.loop = shouldLoop;
        // Apply master speed and keep it synced
        try {
          const currentSpeed = window.__APP_SPEECH_SPEED__ || 1.0;
          audio.playbackRate = currentSpeed;
        } catch (_) {}
        const speedCheckInterval = setInterval(() => {
          try {
            const desired = window.__APP_SPEECH_SPEED__ || 1.0;
            if (audio.playbackRate !== desired) {
              audio.playbackRate = desired;
            }
          } catch (_) {}
        }, 500);
        audio._speedCheckInterval = speedCheckInterval;
        
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
        const cleanup = () => {
          try {
            if (audio._speedCheckInterval) { try { clearInterval(audio._speedCheckInterval); } catch (_) {} }
            audio.onended = null;
            audio.onerror = null;
            audio.loop = false;
            audio.pause();
            audio.src = '';
            audio.load();
          } catch (_) {}
          if (conversationAudioRef.current === audio) {
            conversationAudioRef.current = null;
          }
          resolve();
        };
        if (shouldLoop) {
          // For looping audio, onended won't fire, so we only cleanup on error or manual stop
          audio.onerror = cleanup;
          audio.play().catch((err) => {
            console.warn('Failed to play audio (autoplay may be blocked):', err);
            // Check if this is an autoplay blocking error
            if (err.name === 'NotAllowedError' || err.name === 'NotAllowedError' || err.message?.includes('play') || err.message?.includes('user gesture')) {
              console.warn('[Autoplay] Autoplay blocked by browser - user gesture required');
              // Set autoplay blocked state if we're in autoplay mode
              if (searchParams.get('autoplay')) {
                setAutoplayBlocked(true);
                autoStartedRef.current = false;
              }
              cleanup();
              return;
            }
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
            // Check if this is an autoplay blocking error
            if (err.name === 'NotAllowedError' || err.name === 'NotAllowedError' || err.message?.includes('play') || err.message?.includes('user gesture')) {
              console.warn('[Autoplay] Autoplay blocked by browser - user gesture required');
              // Set autoplay blocked state if we're in autoplay mode
              if (searchParams.get('autoplay')) {
                setAutoplayBlocked(true);
                autoStartedRef.current = false;
              }
              cleanup();
              return;
            }
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
      } catch (_) { resolve(); }
    });
  }, [conversationAudioUrl, searchParams]);

  const downloadConversationAudio = React.useCallback(() => {
    try {
      if (!conversationAudioUrl) return;
      const a = document.createElement('a');
      a.href = conversationAudioUrl;
      a.download = 'conversation.mp3';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { try { document.body.removeChild(a); } catch (_) {} }, 0);
    } catch (_) {}
  }, [conversationAudioUrl]);

  // Generate English word indices for a Korean-English sentence pair
  // Returns a mapping: { koreanWord: englishWordIndex }
  const generateEnglishWordIndices = React.useCallback(async (korean, english, blankWords = []) => {
    try {
      if (!korean || !english) return {};
      
      const blankWordsStr = Array.isArray(blankWords) && blankWords.length > 0 
        ? blankWords.join(', ') 
        : '';
      
      const prompt = `Return ONLY a JSON object with this format: {"mapping": {"korean_word": english_word_index}}.
Given this Korean sentence and its English translation, create a mapping from each Korean word to its corresponding English word index.

Korean: ${korean}
English: ${english}
${blankWordsStr ? `Korean blanked words: ${blankWordsStr}` : ''}

The English sentence is: "${english}"
Split the English sentence into words (by spaces), and return the 0-based index of the English word that corresponds to each Korean word.

For example, if the Korean is "나는 학교에 가요" and the English is "I go to school", return:
{"mapping": {"나는": 0, "학교에": 2, "가요": 1}}

If blanked words are provided, prioritize mapping those words accurately.

Return ONLY the JSON object, no other text.`;
      
      const res = await api.chat(prompt);
      if (res.ok) {
        const data = await res.json();
        const text = data.response || '';
        const m = String(text).match(/\{[\s\S]*\}/);
        if (m) {
          try {
            const obj = JSON.parse(m[0]);
            if (obj && obj.mapping && typeof obj.mapping === 'object') {
              return obj.mapping;
            }
          } catch (_) {}
        }
      }
    } catch (_) {}
    return {};
  }, []);

  // Generate a coherent 5-turn conversation (independent of learning words)
  const generateConversationSet = React.useCallback(async (contextKorean = '', contextEnglish = '') => {
    try {
      let prompt = `Return ONLY a JSON array of 5 objects like:
[{"speaker":"A","korean":"...","english":"..."}, ...]
Requirements:
- Natural everyday conversation in polite style (요), 7–12 Korean words per turn
- Each turn must be EXACTLY ONE phrase/sentence per line (no multiple sentences, no periods in the middle)
- Avoid compound sentences with periods separating clauses; use simple, single-phrase statements
- Two speakers alternating ("A" then "B" then "A" then "B" then "A" or vice versa)
- Turns must be contextually related (follow-up questions/answers, short plans, clarifications)
- Avoid rare terms and proper nouns; use common daily-life topics
- Provide accurate English translations

CRITICAL: For any numbers in Korean sentences, use Korean words (not Arabic numerals):
- For time (시, 시간): use Native Korean (하나, 둘, 셋, 넷, 다섯, 여섯, 일곱, 여덟, 아홉, 열, etc.). Example: "9시" should be "아홉 시"
- For counting objects: use Native Korean (하나, 둘, 셋, etc.)
- For dates, money, general counting: use Sino-Korean (일, 이, 삼, 사, 오, 육, 칠, 팔, 구, 십, etc.)
NEVER use Arabic numerals (1, 2, 3, etc.) in Korean text - always convert to Korean words.`;
      
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
- Provide accurate English translations

CRITICAL: For any numbers in Korean sentences, use Korean words (not Arabic numerals):
- For time (시, 시간): use Native Korean (하나, 둘, 셋, 넷, 다섯, 여섯, 일곱, 여덟, 아홉, 열, etc.). Example: "9시" should be "아홉 시"
- For counting objects: use Native Korean (하나, 둘, 셋, etc.)
- For dates, money, general counting: use Sino-Korean (일, 이, 삼, 사, 오, 육, 칠, 팔, 구, 십, etc.)
NEVER use Arabic numerals (1, 2, 3, etc.) in Korean text - always convert to Korean words.`;
      }
      
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
    } catch (_) {}
    // Fallback: simple coherent seed conversation (5 turns)
    const seeds = [
      { korean: '오늘 저녁에 시간 있으세요?', english: 'Do you have time this evening?' },
      { korean: '네, 있어요', english: 'Yes, I do' },
      { korean: '같이 저녁 먹고 산책할까요?', english: 'Shall we have dinner together and take a walk?' },
      { korean: '좋아요! 몇 시에 만날까요?', english: 'Sounds good! What time should we meet?' },
      { korean: '여섯 시 어때요?', english: "How about six?" },
    ];
    return seeds;
  }, [parseJsonArraySafe]);

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

  // Play currently loaded conversation using single MP3 (do not generate a new conversation)
  const handlePlayCurrentConversation = React.useCallback(async () => {
    setIsQuizLooping(true);
    playingRef.current = true;
    pausedRef.current = false;
    setIsPaused(false);
    quizLoopRef.current = true;
    await requestWakeLock();
    startKeepAlive();
    try {
      // Use sentences in stored order for audio
      const items = Array.isArray(generatedSentences) ? generatedSentences : [];
      if (!items || items.length === 0) return;
      
      // For Level 3, generate word pairs and create Level 3 audio
      const level = Number(quizDifficulty) || 1;
      if (level === 3) {
        // Show loading state
        setIsGeneratingLevel3Audio(true);
        setLevel3AudioProgress(0);
        
        // Generate word pairs for all sentences
        setLevel3AudioProgress(10);
        const sentencesWithPairs = await Promise.all(items.map(async (sent, idx) => {
          try {
            const pairs = await getWordByWordPairs(String(sent.english || ''), String(sent.korean || ''));
            setLevel3AudioProgress(10 + (idx + 1) * 20); // 10-50% for word pairs
            return {
              english: String(sent.english || ''),
              korean: String(sent.korean || ''),
              wordPairs: Array.isArray(pairs) ? pairs.map(p => ({
                en: String(p.en || ''),
                ko: String(p.ko || '')
              })) : []
            };
          } catch (_) {
            // Fallback: simple split
            const koParts = String(sent.korean || '').split(/\s+/).filter(Boolean);
            const enParts = String(sent.english || '').split(/\s+/).filter(Boolean);
            const n = Math.min(koParts.length, enParts.length);
            setLevel3AudioProgress(10 + (idx + 1) * 20);
            return {
              english: String(sent.english || ''),
              korean: String(sent.korean || ''),
              wordPairs: new Array(n).fill(0).map((_, i) => ({ en: enParts[i] || '', ko: koParts[i] || '' }))
            };
          }
        }));
        
        // Generate Level 3 audio
        setLevel3AudioProgress(60);
        try {
          const res = await fetch('/api/tts/level3', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sentences: sentencesWithPairs,
              delaySeconds: Math.max(0, Number(quizDelaySec) || 0.5)
            })
          });
          setLevel3AudioProgress(80);
          if (res.ok) {
            const data = await res.json().catch(() => null);
            const audioUrl = data && data.url ? data.url : '';
            setLevel3AudioProgress(100);
            if (audioUrl) {
              setConversationAudioUrl(audioUrl);
              setIsGeneratingLevel3Audio(false);
              setLevel3AudioProgress(0);
              // Play the audio immediately (it will loop automatically)
              await playConversationAudio(true, audioUrl); // true = loop, pass URL directly
              // Keep the loop running while playing (audio loops automatically)
              while (playingRef.current && quizLoopRef.current) {
                await waitWhilePaused();
                if (!playingRef.current || !quizLoopRef.current) break;
                await new Promise(r => setTimeout(r, 500));
              }
            } else {
              setIsGeneratingLevel3Audio(false);
              setLevel3AudioProgress(0);
              setError('Failed to generate audio: No audio URL returned');
            }
          } else {
            const errorData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
            setIsGeneratingLevel3Audio(false);
            setLevel3AudioProgress(0);
            setError(`Failed to generate audio: ${errorData.error || `HTTP ${res.status}`}`);
          }
        } catch (err) {
          console.error('Failed to generate Level 3 audio:', err);
          setIsGeneratingLevel3Audio(false);
          setLevel3AudioProgress(0);
          setError(`Failed to generate audio: ${err.message || 'Unknown error'}`);
        }
      } else {
        // For other levels, use conversation audio (no loop)
        let audioUrl = conversationAudioUrl;
        if (!audioUrl) {
          audioUrl = await generateConversationAudio(items);
        }
        if (audioUrl) {
          // Play immediately with the generated URL (don't wait for state update)
          await playConversationAudio(false, audioUrl); // false = no loop
          await new Promise(r => setTimeout(r, 200));
        } else {
          setError('Failed to generate conversation audio');
        }
      }
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
  }, [generatedSentences, conversationAudioUrl, generateConversationAudio, playConversationAudio, quizDifficulty, quizDelaySec, getWordByWordPairs, waitWhilePaused, generateConversationSet]);

  const generateQuizSentence = React.useCallback(async (difficulty) => {
    if (difficulty === 1) return null; // single word handled separately
    if (difficulty === 2) {
      // Level 2: Use shared verb practice algorithm
      const result = await generateVerbPracticeSentence();
      if (result && result.korean && result.english) {
        return { korean: result.korean, english: result.english };
      }
      // Fallback to prior builders if shared function fails
      const all = await ensureLearningWords();
      if (!all || all.length === 0) return null;
      const pool = (Array.isArray(level2Words) && level2Words.length > 0) ? level2Words : all;
      const hasVerbIn = (arr) => Array.isArray(arr) && arr.some(w => {
        const ko = String(w.korean || '');
        const t = String(w.type || '').toLowerCase();
        return t === 'verb' || /다$/.test(ko);
      });
      const words = hasVerbIn(pool) ? pool : all;
      const primary = buildVerbWithDateSentence(words);
      if (primary && primary.english && primary.korean) {
        return primary;
      }
      const tryBuild = async () => {
        const tryOrder = Math.random() < 0.5 ? ['pv', 'na'] : ['na', 'pv'];
        for (const kind of tryOrder) {
          for (let attempt = 0; attempt < 3; attempt++) {
            const pair = kind === 'pv' ? buildPronounAndVerbPair(words) : buildNounAndAdjectiveSentence(words);
            if (pair && pair.english && pair.korean) {
              const en = String(pair.english).trim();
              const ko = String(pair.korean).trim();
              if (en.includes(' ') && ko.includes(' ')) return pair;
            }
          }
        }
        return null;
      };
      const built = await tryBuild();
      return built || { english: 'I do', korean: '나는 해요' };
    }
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
      { korean: '오늘 저녁에 같이 밥 먹을까요?', english: "Shall we have dinner together this evening?" },
      { korean: '주말에 시간 있으시면 커피 마셔요.', english: "If you have time on the weekend, let's have coffee." },
      { korean: '이거 어떻게 사용하는지 알려줄 수 있어요?', english: "Can you show me how to use this?" },
      { korean: '어제 본 영화가 정말 재미있었어요.', english: "The movie I saw yesterday was really fun." },
      { korean: '잠깐만 기다려 주세요. 금방 올게요.', english: "Please wait a moment. I'll be right back." },
      { korean: '사진을 보내 주시면 바로 확인할게요.', english: "If you send the photo, I'll check it right away." },
      { korean: '지하철이 너무 복잡해서 조금 늦었어요.', english: "The subway was too crowded, so I'm a bit late." },
      { korean: '내일 아침 일찍 출발하는 게 어때요?', english: "How about leaving early tomorrow morning?" },
      { korean: '도와주셔서 정말 감사합니다.', english: "Thank you so much for your help." },
      { korean: '이 근처에 맛있는 식당이 있을까요?', english: "Is there a good restaurant around here?" },
    ];
    const s = seeds[Math.floor(Math.random() * seeds.length)];
    return { korean: s.korean, english: s.english };
  }, [parseJsonObject]);

  const handlePlayLearningMode = React.useCallback(async () => {
    setIsLearningPlaying(true);
    playingRef.current = true;
    // Request wake lock for background playback
    await requestWakeLock();
    // Start keep-alive to prevent audio suspension
    startKeepAlive();
    // Wire up MediaSession callbacks for background control
    updateMediaSession('Learning Mode', 'Korean Learning', true, {
      play: () => {
        // Resume playback
        pausedRef.current = false;
        setIsLearningPlaying(true);
      },
      pause: () => {
        // Pause playback but keep loop alive
        pausedRef.current = true;
        setIsLearningPlaying(false);
        try { const s = window.speechSynthesis; if (s) s.cancel(); } catch (_) {}
      },
      stop: () => {
        // Fully stop
        pausedRef.current = false;
        playingRef.current = false;
        setIsLearningPlaying(false);
        try { const s = window.speechSynthesis; if (s) s.cancel(); } catch (_) {}
      }
    });
    try {
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
    } finally {
      setIsLearningPlaying(false);
      playingRef.current = false;
      updateMediaSession('Audio Learning', '', false);
      try { const synth = window.speechSynthesis; if (synth) synth.cancel(); } catch (_) {}
      // Release wake lock when done
      await releaseWakeLock();
      // Stop keep-alive if quiz mode is not running
      if (!quizLoopRef.current) {
        stopKeepAlive();
      }
    }
  }, [ensureLearningWords, generateLearningSentence]);

  const stopAll = React.useCallback(async () => {
    playingRef.current = false;
    pausedRef.current = false;
    setIsPaused(false);
    setIsLearningPlaying(false);
    setIsQuizLooping(false);
    quizLoopRef.current = false;
    // Stop loop if playing
    stopLoop();
    // Stop conversation audio if present
    try {
      const a = conversationAudioRef.current;
      if (a) {
        if (a._speedCheckInterval) { try { clearInterval(a._speedCheckInterval); } catch (_) {} }
        a.onended = null;
        a.onerror = null;
        a.pause();
        a.src = '';
        a.load();
        conversationAudioRef.current = null;
      }
    } catch (_) {}
    // Clear MediaSession callbacks and update state
    updateMediaSession('Audio Learning', '', false);
    try { const s = window.speechSynthesis; if (s) s.cancel(); } catch (_) {}
    try { const r = recognitionRef.current; if (r) { try { r.stop(); } catch (_) {}; try { r.abort && r.abort(); } catch (_) {} } } catch (_) {}
    try { const r = recorderRef.current; if (r && r.state !== 'inactive') r.stop(); } catch (_) {}
    try { const ms = mediaStreamRef.current; if (ms) { ms.getTracks().forEach(t => t.stop()); mediaStreamRef.current = null; } } catch (_) {}
    // Release wake lock when stopping
    await releaseWakeLock();
    // Stop keep-alive
    stopKeepAlive();
  }, []);

  // Recording helpers
  const startMicRecording = React.useCallback(async () => {
    try {
      if (isMicRecording) return;
      
      // Request audio permissions
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      mediaStreamRef.current = stream;
      
      let mr;
      let mimeType = '';
      
      // Better Android codec detection
      const codecs = [
        'audio/webm;codecs=opus',
        'audio/webm;codecs=pcm',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/mpeg',
        ''
      ];
      
      for (const codec of codecs) {
        try {
          if (!codec || MediaRecorder.isTypeSupported(codec)) {
            mimeType = codec;
            mr = codec ? new MediaRecorder(stream, { mimeType: codec }) : new MediaRecorder(stream);
            break;
          }
        } catch (e) {
          continue;
        }
      }
      
      if (!mr) {
        // Fallback: try without specifying mimeType
        try {
          mr = new MediaRecorder(stream);
        } catch (err) {
          console.error('MediaRecorder not supported:', err);
          setIsMicRecording(false);
          stream.getTracks().forEach(t => t.stop());
          return;
        }
      }
      
      recordedChunksRef.current = [];
      const recordingPromise = new Promise((resolve) => {
        mr.onerror = (e) => {
          console.error('MediaRecorder error:', e);
          resolve(null);
        };
        mr.ondataavailable = (e) => { 
          if (e && e.data && e.data.size > 0) {
            recordedChunksRef.current.push(e.data);
          }
        };
        mr.onstop = () => {
          try {
            const finalMimeType = mimeType || 'audio/webm';
            const blob = new Blob(recordedChunksRef.current, { type: finalMimeType });
            if (blob.size === 0) {
              console.warn('Empty recording blob');
              resolve(null);
              return;
            }
            const url = URL.createObjectURL(blob);
            setRecordedUrl((prev) => { if (prev) { try { URL.revokeObjectURL(prev); } catch (_) {} } return url; });
            resolve(url);
          } catch (err) {
            console.error('Error creating blob:', err);
            resolve(null);
          }
        };
      });
      recorderRef.current = mr;
      recorderRef.current._recordingPromise = recordingPromise;
      
      // Android often needs timeslice for continuous data
      const timeslice = 1000;
      mr.start(timeslice);
      setIsMicRecording(true);
      setRecordingError(''); // Clear any previous errors
    } catch (err) {
      console.error('Failed to start recording:', err);
      setIsMicRecording(false);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
      }
      let errorMsg = 'Recording failed. ';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg += 'Microphone permission denied. Please allow access.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMsg += 'No microphone found.';
      } else if (err.name === 'NotSupportedError' || err.name === 'TypeError') {
        errorMsg += 'MediaRecorder not supported. Try using Chrome/Firefox on HTTPS.';
      } else {
        errorMsg += err.message || String(err);
      }
      setRecordingError(errorMsg);
    }
  }, [isMicRecording]);

  const stopMicRecording = React.useCallback(async () => {
    let url = null;
    try {
      const r = recorderRef.current;
      if (r && r.state !== 'inactive' && r.state !== 'stopped') {
        try {
          r.stop();
        } catch (err) {
          console.warn('Error stopping recorder:', err);
        }
        if (r._recordingPromise) {
          // Android may need more time to finalize
          try {
            url = await Promise.race([
              r._recordingPromise,
              new Promise((resolve) => setTimeout(() => resolve(null), 3000))
            ]);
          } catch (err) {
            console.error('Error waiting for recording promise:', err);
          }
        }
      }
    } catch (err) {
      console.error('Error in stopMicRecording:', err);
    }
    setIsMicRecording(false);
    try { 
      const ms = mediaStreamRef.current; 
      if (ms) { 
        ms.getTracks().forEach(t => {
          try { t.stop(); } catch (_) {}
        }); 
        mediaStreamRef.current = null; 
      } 
    } catch (_) {}
    // Android may need more time to finalize blob
    await new Promise(r => setTimeout(r, 300));
    return url;
  }, []);

  const playRecorded = React.useCallback((url) => {
    return new Promise((resolve) => {
      try {
        const audioUrl = url || recordedUrl;
        if (!audioUrl) return resolve();
        
        try { console.log('[RecordedAudio] create', { url: audioUrl }); } catch (_) {}
        const audio = new Audio(audioUrl);
        let resolved = false;
        
        const cleanup = () => {
          if (resolved) return;
          resolved = true;
          try {
            audio.removeEventListener('ended', onEnded);
            audio.removeEventListener('error', onError);
            audio.removeEventListener('canplaythrough', onCanPlay);
            audio.pause();
            audio.src = '';
            audio.load();
          } catch (_) {}
          resolve();
        };
        
        const onError = (e) => {
          console.error('Audio playback error:', e);
          cleanup();
        };
        
        const onEnded = () => {
          try { console.log('[RecordedAudio] ended'); } catch (_) {}
          cleanup();
        };
        
        const onCanPlay = () => {
          try { console.log('[RecordedAudio] canplaythrough'); } catch (_) {}
          audio.play().then(() => {
            // Wait for ended event
            try { console.log('[RecordedAudio] playing'); } catch (_) {}
          }).catch((err) => {
            console.error('Audio play failed:', err);
            cleanup();
          });
        };
        
        audio.addEventListener('error', onError);
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('canplaythrough', onCanPlay);
        
        // Android may need explicit load
        audio.load();
        
        // Fallback timeout
        setTimeout(() => {
          if (!resolved) {
            console.warn('Audio playback timeout');
            cleanup();
          }
        }, 10000);
      } catch (err) {
        console.error('Audio creation error:', err);
        resolve();
      }
    });
  }, [recordedUrl]);

  // Speech recognition (Web Speech API)
  const startSpeechRecognition = React.useCallback(() => {
    try {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) return false;
      const rec = new SR();
      recognitionRef.current = rec;
      rec.lang = 'ko-KR';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      recognizedRef.current = '';
      setRecognizedText('');
      rec.onresult = (e) => {
        const t = (e && e.results && e.results[0] && e.results[0][0] && e.results[0][0].transcript) || '';
        recognizedRef.current = String(t);
        setRecognizedText(String(t));
      };
      rec.onerror = () => {};
      rec.onend = () => {};
      rec.start();
      return true;
    } catch (_) {
      return false;
    }
  }, []);

  const stopSpeechRecognition = React.useCallback(() => {
    try { const r = recognitionRef.current; if (r) { try { r.stop(); } catch (_) {}; try { r.abort && r.abort(); } catch (_) {} } } catch (_) {}
  }, []);

  const handleStartQuizLoop = React.useCallback(async () => {
    setIsQuizLooping(true);
    playingRef.current = true;
    pausedRef.current = false;
    setIsPaused(false);
    quizLoopRef.current = true;
    // Request wake lock for background playback
    await requestWakeLock();
    // Start keep-alive to prevent audio suspension
    startKeepAlive();
    
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
    
    try {
      const words = await ensureLearningWords();
      if (!words || words.length === 0) return;
      
      if (quizMode === 'hands-free') {
        if (level === 1) {
          // Hands-free Level 1: chunked words (20 per set) by date order, choose set or random set
          const totalSets = Math.max(1, Math.ceil(words.length / 20));
          const chosenIndex = Math.min(Math.max(1, setIndex), totalSets);
          const start = (chosenIndex - 1) * 20;
          const selectedWords = words.slice(start, Math.min(start + 20, words.length));
          const transformed = selectedWords.map(applyPronounAndTenseIfVerb);
          setCurrentSetWords(transformed);
          try {
            // Show progress while batch TTS is generated
            setLoopGenerating(true);
            setLoopProgress(10);
            const timer = setInterval(() => setLoopProgress((p) => Math.min(90, p + 5)), 300);
            await generateAndPlayLoop(transformed, 'ko-KR', 1.0, quizDelaySec);
            clearInterval(timer);
            setLoopProgress(100);
            // Keep playing until stopped (respect pause)
            while (playingRef.current && quizLoopRef.current) {
              await waitWhilePaused();
              await new Promise(r => setTimeout(r, 300));
            }
          } catch (err) {
            console.error('Failed to generate loop:', err);
          } finally {
            setLoopGenerating(false);
            setLoopProgress(0);
          }
        } else {
        // Hands-free Level 2/3: sentences (no recording)
        setCurrentSetWords([]);
        setGeneratedSentences([]);
        if (level === 2) {
          // Generate exactly 5 sentences once, then loop them
          const batch = [];
          for (let i = 0; i < 5; i++) {
            if (!playingRef.current || !quizLoopRef.current) break;
            const s = await generateQuizSentence(2);
            if (s && s.english && s.korean) batch.push({ english: String(s.english), korean: String(s.korean) });
          }
          if (batch.length === 0) {
            // Fallback: generate continuously if batch failed
            while (playingRef.current && quizLoopRef.current) {
              await waitWhilePaused(); if (!playingRef.current) break;
              const sent = await generateQuizSentence(2);
              if (!sent) break;
              setGeneratedSentences((prev) => [{ english: String(sent.english || ''), korean: String(sent.korean || '') }, ...prev].slice(0, 10));
              updateMediaSession(sent.english, 'English', true);
              await waitWhilePaused(); if (!playingRef.current) break;
              await speak(sent.english, 'en-US', 1.0);
              if (!playingRef.current || !quizLoopRef.current) break;
              await waitWhilePaused(); if (!playingRef.current) break;
              updateMediaSession(sent.korean, 'Korean', true);
              await speak(sent.korean, 'ko-KR', 1.0);
              await new Promise(r => setTimeout(r, 300));
            }
          } else {
            // Show the batch in UI
            setGeneratedSentences(batch);
            let idx = 0;
            while (playingRef.current && quizLoopRef.current) {
              await waitWhilePaused(); if (!playingRef.current) break;
              const sent = batch[idx % batch.length];
              idx++;
              updateMediaSession(sent.english, 'English', true);
              await waitWhilePaused(); if (!playingRef.current) break;
              await speak(sent.english, 'en-US', 1.0);
              if (!playingRef.current || !quizLoopRef.current) break;
              await waitWhilePaused(); if (!playingRef.current) break;
              updateMediaSession(sent.korean, 'Korean', true);
              await speak(sent.korean, 'ko-KR', 1.0);
              await new Promise(r => setTimeout(r, 300));
            }
          }
        } else {
          // Level 3: Generate one audio file for all 5 sentences with word-by-word breakdown
          const batch3 = await generateConversationSet();
          if (batch3.length === 0) {
            // Fallback: generate one sentence if batch failed
            const sent = await generateQuizSentence(3);
            if (sent) {
              setGeneratedSentences([{ english: String(sent.english || ''), korean: String(sent.korean || '') }]);
            }
          } else {
            // Show the batch in UI
            setGeneratedSentences(batch3);
            
            // Show loading state
            setIsGeneratingLevel3Audio(true);
            setLevel3AudioProgress(0);
            
            // Generate word pairs for all sentences
            setLevel3AudioProgress(10);
            const sentencesWithPairs = await Promise.all(batch3.map(async (sent, idx) => {
              try {
                const pairs = await getWordByWordPairs(String(sent.english || ''), String(sent.korean || ''));
                setLevel3AudioProgress(10 + (idx + 1) * 20); // 10-50% for word pairs
                return {
                  english: String(sent.english || ''),
                  korean: String(sent.korean || ''),
                  wordPairs: Array.isArray(pairs) ? pairs.map(p => ({
                    en: String(p.en || ''),
                    ko: String(p.ko || '')
                  })) : []
                };
              } catch (_) {
                // Fallback: simple split
                const koParts = String(sent.korean || '').split(/\s+/).filter(Boolean);
                const enParts = String(sent.english || '').split(/\s+/).filter(Boolean);
                const n = Math.min(koParts.length, enParts.length);
                setLevel3AudioProgress(10 + (idx + 1) * 20);
                return {
                  english: String(sent.english || ''),
                  korean: String(sent.korean || ''),
                  wordPairs: new Array(n).fill(0).map((_, i) => ({ en: enParts[i] || '', ko: koParts[i] || '' }))
                };
              }
            }));
            
            // Generate single audio file for all sentences
            setLevel3AudioProgress(60);
            try {
              const res = await fetch('/api/tts/level3', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sentences: sentencesWithPairs,
                  delaySeconds: Math.max(0, Number(quizDelaySec) || 0.5)
                })
              });
              setLevel3AudioProgress(80);
              if (res.ok) {
                const data = await res.json().catch(() => null);
                const audioUrl = data && data.url ? data.url : '';
                setLevel3AudioProgress(100);
                if (audioUrl) {
                  setConversationAudioUrl(audioUrl);
                  setIsGeneratingLevel3Audio(false);
                  setLevel3AudioProgress(0);
                  // Play the audio immediately (it will loop automatically)
                  await playConversationAudio(true, audioUrl); // true = loop, pass URL directly
                  // Keep the loop running while playing (audio loops automatically)
                  while (playingRef.current && quizLoopRef.current) {
                    await waitWhilePaused();
                    if (!playingRef.current || !quizLoopRef.current) break;
                    await new Promise(r => setTimeout(r, 500));
                  }
                } else {
                  setIsGeneratingLevel3Audio(false);
                  setLevel3AudioProgress(0);
                  setError('Failed to generate audio: No audio URL returned');
                }
              } else {
                const errorData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
                setIsGeneratingLevel3Audio(false);
                setLevel3AudioProgress(0);
                setError(`Failed to generate audio: ${errorData.error || `HTTP ${res.status}`}`);
              }
            } catch (err) {
              console.error('Failed to generate Level 3 audio:', err);
              setIsGeneratingLevel3Audio(false);
              setLevel3AudioProgress(0);
              setError(`Failed to generate audio: ${err.message || 'Unknown error'}`);
            }
          }
        }
        }
      } else {
        // Recording mode: Use individual audio files
        updateMediaSession('Audio Learning', 'Korean Learning', true);
        while (playingRef.current && quizLoopRef.current) {
          await waitWhilePaused(); if (!playingRef.current) break;
          let english = '';
          let korean = '';
          const level = Number(quizDifficulty) || 1;
          if (level === 1) {
            // Level 1: Single word
            const w = words[Math.floor(Math.random() * words.length)];
            setCurrentQuizWord(w);
            setCurrentQuizSentence(null);
            english = String(w.english || '');
            const w2 = applyPronounAndTenseIfVerb(w);
            korean = String(w2.korean || '');
          } else {
            // Level 2 or 3: Sentences
            const sent = await generateQuizSentence(level);
            if (!sent) break;
            setCurrentQuizWord(null);
            setCurrentQuizSentence(sent);
            english = String(sent.english || '');
            korean = String(sent.korean || '');
          }
          await speak(`How do you say "${english}"?`, 'en-US', 1.0);
          if (!playingRef.current || !quizLoopRef.current) break;
          await waitWhilePaused(); if (!playingRef.current) break;
          
          let recordedAudioUrl = null;
          let recognizedTextValue = '';
          
          // Recording mode: Record and play back user's answer
          setRecordedUrl((prev) => { if (prev) { try { URL.revokeObjectURL(prev); } catch (_) {} } return ''; });
          const srStarted = startSpeechRecognition();
          if (!playingRef.current || !quizLoopRef.current) break;
          await waitWhilePaused(); if (!playingRef.current) break;
          await startMicRecording();
          // Respect pause during recording window
          const recordUntil = Date.now() + Math.max(0, Number(quizRecordDurationSec) || 0) * 1000;
          while (Date.now() < recordUntil && playingRef.current && quizLoopRef.current) {
            if (pausedRef.current) break;
            await new Promise(r => setTimeout(r, 100));
          }
          recordedAudioUrl = await stopMicRecording();
          if (srStarted) {
            // allow SR to finalize result
            await new Promise(r => setTimeout(r, 200));
            stopSpeechRecognition();
            recognizedTextValue = String(recognizedRef.current || recognizedText || '');
          }
          if (!playingRef.current || !quizLoopRef.current) break;
          await waitWhilePaused(); if (!playingRef.current) break;
          await speak('Recording stopped.', 'en-US', 1.0);
          if (!playingRef.current || !quizLoopRef.current) break;
          await waitWhilePaused(); if (!playingRef.current) break;
          await new Promise(r => setTimeout(r, Math.max(0, Number(quizDelaySec) || 0) * 1000));
          if (recordedAudioUrl) {
            await waitWhilePaused(); if (!playingRef.current) break;
            await speak('Playing recording.', 'en-US', 1.0);
            if (!playingRef.current || !quizLoopRef.current) break;
            await playRecorded(recordedAudioUrl);
          }
          if (!playingRef.current || !quizLoopRef.current) break;
          await waitWhilePaused(); if (!playingRef.current) break;
          await new Promise(r => setTimeout(r, Math.max(0, Number(quizDelaySec) || 0) * 1000));
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
          // Push to history (only in recording mode if we have recognized text)
          if (recognizedTextValue) {
            pushHistory({
              ts: Date.now(),
              english: english,
              recognized: recognizedTextValue,
              korean: korean
            });
          }
          await new Promise(r => setTimeout(r, 500));
        }
      }
    } finally {
      setIsQuizLooping(false);
      quizLoopRef.current = false;
      playingRef.current = false;
      pausedRef.current = false;
      stopLoop(); // Stop the loop if it was playing
      updateMediaSession('Audio Learning', '', false);
      // Release wake lock when done
      await releaseWakeLock();
      // Stop keep-alive if learning mode is not running
      if (!playingRef.current) {
        stopKeepAlive();
      }
    }
  }, [ensureLearningWords, quizMode, startMicRecording, stopMicRecording, playRecorded, quizDelaySec, quizRecordDurationSec, startSpeechRecognition, stopSpeechRecognition, recognizedText, pushHistory, quizDifficulty, generateQuizSentence, waitWhilePaused, setIndex, applyPronounAndTenseIfVerb, getWordByWordPairs, generateConversationSet]);

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

  return (
    <div className="audio-page">
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

      <div className="audio-grid">
        <div className="audio-column">
          <div className="audio-card">
            <h2 className="audio-section-title">Audio Learning Mode</h2>
            <p className="audio-help">
              {quizMode === 'hands-free' 
                ? 'Hands-free mode: Listen to prompts and answers. Perfect for background learning while doing other tasks.'
                : 'Recording mode: Record and play back your answer, then hear the correct Korean. Includes speech recognition.'}
            </p>
            <div className="audio-actions" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Mode</span>
                <select className="audio-select" value={quizMode} onChange={(e) => {
                  const val = e.target.value;
                  setQuizMode(val);
                  try { localStorage.setItem('audio_quizMode', val); } catch (_) {}
                }} style={{ width: '100%' }}>
                  <option value="hands-free">Hands-Free Mode (No Recording)</option>
                  <option value="recording">Recording & Playback Mode</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Difficulty Level</span>
                <select className="audio-select" value={quizDifficulty} onChange={(e) => {
                  const val = parseInt(e.target.value||'1', 10);
                  setQuizDifficulty(val);
                  try { localStorage.setItem('audio_quizDifficulty', String(val)); } catch (_) {}
                }} style={{ width: '100%' }}>
                  <option value={1}>Level 1: Single Words</option>
                  <option value={2}>Level 2: Small Sentences (3-6 words)</option>
                  <option value={3}>Level 3: Longer Sentences (7-12 words)</option>
                </select>
              </div>
              {quizMode === 'hands-free' && quizDifficulty === 1 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>Set (20/each)</span>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={setIndex}
                      onChange={(e) => {
                        const val = Math.max(1, parseInt(e.target.value||'1', 10));
                        setSetIndex(val);
                        try { localStorage.setItem('audio_setIndex', String(val)); } catch (_) {}
                      }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                      <button
                        type="button"
                        className="audio-mini-btn"
                        onClick={() => {
                          const newVal = Math.max(1, (Number(setIndex)||1) - 1);
                          setSetIndex(newVal);
                          try { localStorage.setItem('audio_setIndex', String(newVal)); } catch (_) {}
                        }}
                        disabled={(Number(setIndex)||1) <= 1}
                        title="Previous 20"
                      >
                        Prev 20
                      </button>
                      <span style={{ fontSize: 12, color: '#666' }}>
                        Set {Math.min(Number(setIndex)||1, totalSetsHF)} / {totalSetsHF}
                      </span>
                      <button
                        type="button"
                        className="audio-mini-btn"
                        onClick={() => {
                          const newVal = Math.min(totalSetsHF, (Number(setIndex)||1) + 1);
                          setSetIndex(newVal);
                          try { localStorage.setItem('audio_setIndex', String(newVal)); } catch (_) {}
                        }}
                        disabled={(Number(setIndex)||1) >= totalSetsHF}
                        title="Next 20"
                      >
                        Next 20
                      </button>
                    </div>
                  </label>
                </div>
              )}
              {quizMode === 'recording' && recordingError && (
                <div style={{ padding: '10px', background: '#fee', border: '1px solid #fcc', borderRadius: 6, fontSize: 11, color: '#c33' }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>⚠️ {recordingError}</div>
                  {!window.isSecureContext && location.protocol === 'http:' && (
                    <div style={{ marginTop: 8, fontSize: 10 }}>
                      <strong>Solution:</strong> Recording on Android requires HTTPS due to browser security policies.<br/>
                      Options: (1) Access via <strong>https://</strong> instead of http://<br/>
                      (2) Use <strong>localhost</strong> or <strong>127.0.0.1</strong> (works over HTTP)<br/>
                      (3) Enable HTTPS on your server. Ask your admin or check server config.
                    </div>
                  )}
                </div>
              )}
              {quizMode === 'recording' && !recordingError && !window.isSecureContext && location.protocol === 'http:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1' && (
                <div style={{ padding: '10px', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 6, fontSize: 11, color: '#856404' }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>ℹ️ HTTPS Required for Recording</div>
                  <div style={{ fontSize: 10 }}>
                    Recording on Android requires HTTPS or localhost. You're on HTTP. 
                    Try accessing via <strong>https://</strong> or use <strong>localhost</strong>.
                  </div>
                </div>
              )}
              <div className="audio-actions" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>Delay between steps (sec)</span>
                  <input type="number" min={0} step={0.1} value={quizDelaySec} onChange={(e) => {
                    const val = parseFloat(e.target.value||'0');
                    setQuizDelaySec(val);
                    try { localStorage.setItem('audio_quizDelaySec', String(val)); } catch (_) {}
                  }} />
                </label>
                {quizMode === 'recording' && (
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>Recording duration (sec)</span>
                    <input type="number" min={0} step={0.1} value={quizRecordDurationSec} onChange={(e) => {
                    const val = parseFloat(e.target.value||'0');
                    setQuizRecordDurationSec(val);
                    try { localStorage.setItem('audio_quizRecordDurationSec', String(val)); } catch (_) {}
                  }} />
                  </label>
                )}
              </div>
              {/* Conjugation hints removed */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  className="audio-btn"
                  onClick={async () => {
                    const level = Number(quizDifficulty) || 1;
                    if (isQuizLooping) {
                      stopAll();
                    } else {
                      if (!isLoadingLearningWords) {
                        // If audio is already generated, just play it
                        if (conversationAudioUrl && quizMode === 'hands-free' && level === 3) {
                          setIsQuizLooping(true);
                          playingRef.current = true;
                          pausedRef.current = false;
                          setIsPaused(false);
                          quizLoopRef.current = true;
                          startKeepAlive();
                          try {
                            await playConversationAudio(true, conversationAudioUrl); // true = loop, pass URL directly
                            // Keep the loop running while playing (audio loops automatically)
                            while (playingRef.current && quizLoopRef.current) {
                              await waitWhilePaused();
                              if (!playingRef.current || !quizLoopRef.current) break;
                              await new Promise(r => setTimeout(r, 500));
                            }
                          } catch (err) {
                            console.error('Failed to play audio:', err);
                            setError(`Failed to play audio: ${err.message || 'Unknown error'}`);
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
                        } else if (quizMode === 'hands-free' && level === 3) {
                          handlePlayCurrentConversation();
                        } else {
                          handleStartQuizLoop();
                        }
                      }
                    }
                  }}
                  title={isQuizLooping ? 'Stop' : (conversationAudioUrl && (Number(quizDifficulty) || 1) === 3 ? 'Start/Play Audio' : 'Start')}
                  aria-label={isQuizLooping ? 'Stop' : 'Start'}
                >
                  {isQuizLooping ? 'Stop' : 'Start'}
                </button>
                <button
                  className="audio-btn"
                  onClick={() => {
                    const level = Number(quizDifficulty) || 1;
                    const audio = conversationAudioRef.current;
                    if (quizMode === 'hands-free' && level === 3 && audio) {
                      if (isPaused) {
                        try { 
                          audio.play().catch(_ => {});
                        } catch (_) {}
                        pausedRef.current = false;
                        setIsPaused(false);
                      } else {
                        try { 
                          audio.pause(); 
                        } catch (_) {}
                        pausedRef.current = true;
                        setIsPaused(true);
                      }
                    } else {
                      if (isPaused) {
                        resumeLoop();
                        pausedRef.current = false;
                        setIsPaused(false);
                      } else {
                        pauseLoop();
                        pausedRef.current = true;
                        setIsPaused(true);
                      }
                    }
                  }}
                  title={isPaused ? 'Resume' : 'Pause'}
                  aria-label={isPaused ? 'Resume' : 'Pause'}
                >
                  {isPaused ? '▶️' : '⏸'}
                </button>
              </div>
            {loopGenerating && (
              <div style={{ marginTop: 8 }}>
                <div style={{ height: 8, background: '#eee', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${loopProgress}%`, height: 8, background: '#1976d2', transition: 'width 0.2s' }} />
                </div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>Generating audio…</div>
              </div>
            )}
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
              <div style={{ display: 'grid', gap: 6 }}>
                {(Number(quizDifficulty) || 1) === 1 && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>Current words</div>
                    <div className="audio-en" style={{ padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6, minHeight: 20 }}>
                      {currentQuizWord ? `How do you say "${currentQuizWord.english}"?` : (currentQuizSentence ? `How do you say "${currentQuizSentence.english}"?` : '—')}
                    </div>
                  </>
                )}
              {quizMode === 'hands-free' && quizDifficulty === 2 && level2Words && level2Words.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Selected words (Level 2, up to 5):</div>
                  <div style={{ display: 'grid', gap: 4 }}>
                    {level2Words.map((w, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13 }}>
                        <span style={{ color: '#999' }}>{i + 1}.</span>
                        <span className="audio-ko" style={{ minWidth: 120 }}>{w.korean}</span>
                        <span className="audio-en" style={{ opacity: 0.8 }}>{w.english}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {quizMode === 'hands-free' && quizDifficulty === 1 && selectedSetWords && selectedSetWords.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Selected set (up to 20):</div>
                  <div style={{ display: 'grid', gap: 4 }}>
                    {selectedSetWords.map((w, i) => (
                      <div key={i} style={{ display: 'grid', gap: 2 }}>
                        <div style={{ display: 'flex', gap: 8, fontSize: 13 }}>
                          <span style={{ color: '#999' }}>{i + 1}.</span>
                          <span className="audio-ko" style={{ minWidth: 120 }}>{w.korean}</span>
                          <span className="audio-en" style={{ opacity: 0.8 }}>{w.english}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {currentSetWords && currentSetWords.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Now playing (up to 20):</div>
                  <div style={{ display: 'grid', gap: 4 }}>
                    {currentSetWords.map((w, i) => (
                      <div key={i} style={{ display: 'grid', gap: 2 }}>
                        <div style={{ display: 'flex', gap: 8, fontSize: 13 }}>
                          <span style={{ color: '#999' }}>{i + 1}.</span>
                          <span className="audio-ko" style={{ minWidth: 120 }}>{w.korean}</span>
                          <span className="audio-en" style={{ opacity: 0.8 }}>{w.english}</span>
                        </div>
                        {/* Conjugation hints removed */}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(Number(quizDifficulty) || 1) >= 2 && generatedSentences && generatedSentences.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Generated Sentences (Level >= 2)</div>
                  <div style={{ display: 'grid', gap: 4 }}>
                    {generatedSentences.map((s, i) => (
                      <div key={i} style={{ display: 'grid', gap: 2 }}>
                        <div className="audio-ko" style={{ padding: '6px 8px', border: '1px solid #eee', borderRadius: 6 }}>{s.korean}</div>
                        <div className="audio-en" style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: 6 }}>{s.english}</div>
                      </div>
                    ))}
                  </div>
                  {/* Conversation save/export controls (Level 3) */}
                  <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button className="audio-btn" onClick={saveConversationSet} title="Save this 5-sentence conversation">
                        Save Conversation
                      </button>
                    </div>
                  </div>
                </div>
              )}
                {quizMode === 'recording' && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 6 }}>Recorded</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div style={{ fontSize: 12 }}>{isMicRecording ? 'Recording...' : (recordedUrl ? 'Captured' : '—')}</div>
                      {recordedUrl && (
                        <button className="audio-mini-btn" onClick={() => { const a = new Audio(recordedUrl); a.play(); }}>Play Recorded</button>
                      )}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 6 }}>Recognized (Korean)</div>
                    <div className="audio-ko" style={{ padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6, minHeight: 20 }}>
                      {recognizedText || '—'}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="audio-column">
          {quizMode === 'hands-free' && (Number(quizDifficulty) || 1) === 3 && (
            <div className="audio-card" style={{ marginTop: 12 }}>
              <h2 className="audio-section-title">New Conversation</h2>
              <div style={{ display: 'grid', gap: 8, padding: '12px', background: '#f8f9fa', borderRadius: 6, border: '1px solid #ddd' }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Conversation Context (Optional)</div>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>
                  Enter example sentences to guide the conversation topic and style
                </div>
                <div style={{ display: 'grid', gap: 6 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600 }}>Korean Example</span>
                    <input
                      type="text"
                      value={conversationContextKorean}
                      onChange={(e) => setConversationContextKorean(e.target.value)}
                      placeholder="예: 오늘 날씨가 정말 좋네요"
                      style={{ padding: 8, border: '1px solid #ddd', borderRadius: 4, fontSize: 13 }}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600 }}>English Example</span>
                    <input
                      type="text"
                      value={conversationContextEnglish}
                      onChange={(e) => setConversationContextEnglish(e.target.value)}
                      placeholder="e.g., The weather is really nice today"
                      style={{ padding: 8, border: '1px solid #ddd', borderRadius: 4, fontSize: 13 }}
                    />
                  </label>
                </div>
                <button
                  className="audio-btn"
                  onClick={handleGenerateNewConversation}
                  title="Generate a new 5‑turn conversation"
                  aria-label="Generate new conversation"
                >
                  Generate New Conversation
                </button>
              </div>
            </div>
          )}
          <div className="audio-card" style={{ marginTop: 12 }}>
            <h2 className="audio-section-title">Saved Conversations</h2>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button className="audio-btn" onClick={fetchServerConversations}>Refresh from Server</button>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {(!savedConversations || savedConversations.length === 0) && (
                <div className="audio-empty">No saved conversations yet.</div>
              )}
              {savedConversations.map((c) => (
                <div key={c.id} className="audio-row" style={{ alignItems: 'center' }}>
                  <div style={{ flex: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {c.id === defaultConversationId && <span style={{ fontSize: '1.2em' }}>★</span>}
                    {c.title}
                  </div>
                  <div style={{ flex: 1, fontSize: 12, color: '#666' }}>{(c.items||[]).length} lines</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className="audio-mini-btn" onClick={async () => {
                      setGeneratedSentences(c.items || []);
                      // Auto-generate audio if not available
                      if (c.audioUrl) {
                        setConversationAudioUrl(c.audioUrl);
                      } else {
                        setConversationAudioUrl('');
                        // Generate audio automatically
                        try {
                          const audioUrl = await generateConversationAudio(c.items);
                          if (audioUrl) {
                            // Update the saved conversation with the new audio URL
                            const next = savedConversations.map(x => 
                              x.id === c.id ? { ...x, audioUrl } : x
                            );
                            persistConversations(next);
                          }
                        } catch (_) {}
                      }
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}>Load</button>
                    <button className="audio-mini-btn" onClick={() => {
                      setDefaultConversation(c.id === defaultConversationId ? null : c.id);
                    }} style={{ 
                      background: c.id === defaultConversationId ? '#4caf50' : undefined,
                      color: c.id === defaultConversationId ? 'white' : undefined
                    }} title={c.id === defaultConversationId ? 'Default (click to unset)' : 'Set as default'}>
                      {c.id === defaultConversationId ? '★ Default' : 'Set Default'}
                    </button>
                    <button className="audio-mini-btn" onClick={() => {
                      const urlToDownload = c.audioUrl || conversationAudioUrl;
                      if (!urlToDownload) return;
                      try {
                        const a = document.createElement('a');
                        a.href = urlToDownload;
                        a.download = 'conversation.mp3';
                        document.body.appendChild(a);
                        a.click();
                        setTimeout(() => { try { document.body.removeChild(a); } catch (_) {} }, 0);
                      } catch (_) {}
                    }} disabled={!c.audioUrl && !conversationAudioUrl}>Download</button>
                    <button className="audio-mini-btn" onClick={() => {
                      const t = prompt('Rename conversation', c.title);
                      if (t && t.trim()) {
                        const next = savedConversations.map(x => x.id===c.id ? { ...x, title: t.trim() } : x);
                        persistConversations(next);
                      }
                    }}>Rename</button>
                    <button className="audio-mini-btn" onClick={async () => {
                      if (!confirm('Delete this conversation?')) return;
                      try {
                        // Try to delete from server if it has a numeric ID (server-saved)
                        const serverId = typeof c.id === 'number' || /^\d+$/.test(String(c.id)) ? parseInt(c.id, 10) : null;
                        if (serverId && Number.isFinite(serverId)) {
                          try {
                            await api.deleteConversation(serverId);
                          } catch (err) {
                            console.warn('Failed to delete from server:', err);
                            // Continue with local deletion even if server delete fails
                          }
                        }
                        // Delete from local storage
                        const next = savedConversations.filter(x => x.id !== c.id);
                        persistConversations(next);
                        // Clear default if this was the default conversation
                        if (c.id === defaultConversationId) {
                          setDefaultConversation(null);
                        }
                        // Refresh from server to sync
                        try {
                          await fetchServerConversations();
                        } catch (_) {}
                      } catch (err) {
                        console.error('Error deleting conversation:', err);
                      }
                    }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="audio-card" style={{ marginTop: 12 }}>
            <h2 className="audio-section-title">Word Sets</h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <button className="audio-btn" onClick={() => setShowGenerator(true)}>Generate Set (Chat)</button>
              <button className="audio-btn" onClick={() => setShowManageSets((v)=>!v)}>{showManageSets ? 'Hide Sets' : 'Show Sets'}</button>
            </div>
            {showManageSets && (
              <div style={{ display: 'grid', gap: 8 }}>
                {(!wordSets || wordSets.length === 0) && (
                  <div className="audio-empty">No saved sets yet.</div>
                )}
                {wordSets.map((s) => (
                  <div key={s.id} className="audio-row" style={{ alignItems: 'center' }}>
                    <div style={{ flex: 2, fontWeight: 600 }}>{s.title}</div>
                    <div style={{ flex: 1, fontSize: 12, color: '#666' }}>{(s.words||[]).length} words</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="audio-mini-btn" onClick={() => playSet(s)}>Play</button>
                      <button className="audio-mini-btn" onClick={() => {
                        const t = prompt('Rename set', s.title);
                        if (t && t.trim()) {
                          const next = wordSets.map(x => x.id===s.id ? { ...x, title: t.trim() } : x);
                          persistSets(next);
                        }
                      }}>Rename</button>
                      <button className="audio-mini-btn" onClick={() => {
                        if (!confirm('Delete this set?')) return;
                        const next = wordSets.filter(x => x.id !== s.id);
                        persistSets(next);
                      }}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
        </div>
      </div>
      {showGenerator && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={() => setShowGenerator(false)}>
          <div style={{ background: 'white', padding: 16, borderRadius: 8, width: 'min(800px, 95vw)' }} onClick={(e)=>e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Generate Word Set (Chat)</h3>
            <div style={{ display: 'grid', gap: 8 }}>
              <textarea rows={6} value={generatorPrompt} onChange={(e)=>setGeneratorPrompt(e.target.value)} style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6 }} />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="audio-btn" onClick={handleGenerateSet} disabled={generatorLoading}>Generate</button>
                <input value={generatedSetTitle} onChange={(e)=>setGeneratedSetTitle(e.target.value)} placeholder="Set title" style={{ flex: 1, padding: 8, border: '1px solid #ddd', borderRadius: 6 }} />
                <button className="audio-btn" onClick={saveGeneratedSet} disabled={!generatedWords || generatedWords.length === 0}>Save Set</button>
                <button className="audio-btn" onClick={() => playSet({ id: 'tmp', title: generatedSetTitle, words: generatedWords })} disabled={!generatedWords || generatedWords.length === 0}>Play</button>
              </div>
              {generatorLoading && (
                <div style={{ height: 8, background: '#eee', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ width: '60%', height: 8, background: '#1976d2', animation: 'pulse 1s infinite alternate' }} />
                </div>
              )}
              {generatedWords && generatedWords.length > 0 && (
                <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid #eee', borderRadius: 6, padding: 8 }}>
                  {generatedWords.map((w, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13 }}>
                      <span style={{ color: '#999' }}>{i + 1}.</span>
                      <span className="audio-ko" style={{ minWidth: 120 }}>{w.korean}</span>
                      <span className="audio-en" style={{ opacity: 0.8 }}>{w.english}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button className="audio-btn" onClick={() => setShowGenerator(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AudioLearningPage;

