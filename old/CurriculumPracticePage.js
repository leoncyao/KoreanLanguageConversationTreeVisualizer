import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from './api';
import './styles/HomePage.css';

const SPEAK_ADVANCE_DELAY_MS = 1200;

const removePunctuation = (str) => {
  if (!str) return '';
  return String(str).replace(/[.,!?;:()\[\]{}'"`~@#$%^&*+=|\\<>\/\-_]/g, '');
};

const escapeHtml = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const mdToHtml = (md) => {
  if (!md) return '';
  let txt = escapeHtml(md);
  txt = txt.replace(/```([\s\S]*?)```/g, (m, p1) => `<pre><code>${p1}</code></pre>`);
  txt = txt.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  txt = txt.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
  txt = txt.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
           .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
           .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
  txt = txt.replace(/^(?:[-*])\s+(.+)$/gm, '<li>$1</li>');
  txt = txt.replace(/(<li>[\s\S]*?<\/li>)/g, (m) => `<ul>${m}</ul>`);
  const parts = txt.split(/<pre>[\s\S]*?<\/pre>/g);
  const preMatches = txt.match(/<pre>[\s\S]*?<\/pre>/g) || [];
  const htmlParts = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]
      .split(/\n{2,}/)
      .map(seg => seg.trim() ? `<p>${seg.replace(/\n/g, '<br>')}</p>` : '')
      .join('');
    htmlParts.push(p);
    if (preMatches[i]) htmlParts.push(preMatches[i]);
  }
  return htmlParts.join('');
};

function PracticePage() {
  const [currentPhrase, setCurrentPhrase] = useState(null);
  const [inputValues, setInputValues] = useState([]); // Array of input values for multiple blanks
  const [currentBlankIndex, setCurrentBlankIndex] = useState(0); // Which blank we're currently filling
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false); // Start as false, will be set to true when fetching
  const [error, setError] = useState(null);
  const [inputPlaceholder, setInputPlaceholder] = useState('');
  const [showExplanation, setShowExplanation] = useState(false);
  const [explanationText, setExplanationText] = useState('');
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);
  const [explanationPhraseId, setExplanationPhraseId] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [englishWordIndices, setEnglishWordIndices] = useState([]); // English word indices that correspond to blanks
  const [usedPhraseIds, setUsedPhraseIds] = useState([]); // Track which phrases we've used
  const [allPhrases, setAllPhrases] = useState([]); // Store all curriculum phrases
  const [usingVariations, setUsingVariations] = useState(false); // Whether we're in variation mode
  const [sessionNoTrack, setSessionNoTrack] = useState(false); // Session flag: do not track stats for remixed/new sentences
  const SESSION_SIZE = 5;
  const [sessionPhrases, setSessionPhrases] = useState([]); // Fixed subset for this session (mode 1: curriculum)
  const [verbPracticeSession, setVerbPracticeSession] = useState([]); // Session phrases for mode 2 (verb practice)
  const [conversationSession, setConversationSession] = useState([]); // Session phrases for mode 3 (conversations)
  const [sessionPage, setSessionPage] = useState(0); // 0-based page of 5-phrase sets
  const [numBlanks, setNumBlanks] = useState(() => {
    try {
      const saved = localStorage.getItem('practice_numBlanks');
      return saved ? parseInt(saved, 10) : 1;
    } catch (_) {
      return 1;
    }
  }); // 1, 2, 3 -> number of blanks
  const [practiceMode, setPracticeMode] = useState(() => {
    try {
      const saved = localStorage.getItem('practice_mode');
      return saved ? parseInt(saved, 10) : 1;
    } catch (_) {
      return 1;
    }
  }); // 1: curriculum, 2: verb practice, 3: conversation sets
  const [showSetDialog, setShowSetDialog] = useState(false); // Show/hide current set sentences
  const [randomBlankIndices, setRandomBlankIndices] = useState([]); // Random blank positions for current phrase
  const [wordTypesByPhraseId, setWordTypesByPhraseId] = useState({}); // POS tags per phrase id (tokens aligned to spaces)
  // Conversation sets state (for Mode 3)
  const [savedConversations, setSavedConversations] = useState(() => {
    try { const raw = localStorage.getItem('conversation_sets_v1'); const arr = raw ? JSON.parse(raw) : []; return Array.isArray(arr) ? arr : []; } catch (_) { return []; }
  });
  const [currentConversationIndex, setCurrentConversationIndex] = useState(0); // Which conversation set
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0); // Which sentence in current conversation

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
      // Skip tokens that are just particles
      if (particleSet.has(w)) continue;
      // Skip tokens tagged as proper nouns if types provided
      const t = Array.isArray(types) && types.length === words.length ? String(types[i] || '').toLowerCase() : '';
      if (t && (t.includes('proper') || t.includes('proper noun'))) continue;
      candidates.push(i);
    }
    return candidates;
  }, []);

  const createBlankPhrase = useCallback((phrase) => {
    if (!phrase) return { korean: '', blanks: [], translation: '', correct_answers: [] };
    
    const koreanWords = phrase.korean_text.trim().split(' ').filter(w => w);
    
    // Determine blank indices: prefer precomputed random indices; otherwise derive a fallback
    let blankIndices = Array.isArray(randomBlankIndices) ? randomBlankIndices : [];
    const desiredBlanks = Math.max(1, Math.min(3, Number(numBlanks) || 1));
    if (!blankIndices || blankIndices.length === 0) {
      // Fallback: evenly spaced indices if random wasn't set
      const n = Math.min(desiredBlanks, Math.max(1, Math.floor(koreanWords.length / 3)));
      const step = Math.max(1, Math.floor(koreanWords.length / (n + 1)));
      const derived = [];
      for (let i = 1; i <= n; i++) {
        const idx = Math.min(koreanWords.length - 1, i * step);
        if (!derived.includes(idx)) derived.push(idx);
      }
      blankIndices = derived;
    } else {
      // Cap to desired count just in case
      blankIndices = blankIndices.slice(0, desiredBlanks);
    }

    // Sort indices in descending order to replace from end to start
    const sortedIndices = [...blankIndices].sort((a, b) => b - a);
    const result = [...koreanWords];
    const blankWords = [];
    
    // Replace selected words with [BLANK] and collect the blank words
    sortedIndices.forEach(idx => {
      if (idx >= 0 && idx < result.length) {
        blankWords.unshift(koreanWords[idx]); // unshift to maintain original order
        result[idx] = '[BLANK]';
      }
    });
    
    const koreanWithBlanks = result.join(' ');
    
    // For random blanks, the correct answers are the words we blanked
    const correctAnswers = blankWords;
    
    return {
      korean: koreanWithBlanks,
      blanks: blankWords,
      blankIndices: blankIndices.sort((a, b) => a - b),
      translation: phrase.english_text,
      correct_answers: correctAnswers,
      id: phrase.id
    };
  }, [numBlanks, randomBlankIndices]);

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

  // When practiceMode changes, reset and initialize session for that mode
  useEffect(() => {
    try {
      if (practiceMode === 3) {
        // Reset conversation indices when switching to mode 3
        setCurrentConversationIndex(0);
        setCurrentSentenceIndex(0);
      }
      // Reset used phrases when mode changes
      setUsedPhraseIds([]);
      setSessionPage(0);
      // Initialize session for the new mode
      if (practiceMode === 1) {
        // Curriculum mode: session is already managed by sessionPhrases
        if (sessionPhrases.length > 0) {
          setCurrentPhrase(sessionPhrases[0]);
        } else if (allPhrases.length > 0) {
          const firstSubset = allPhrases.slice(0, Math.min(SESSION_SIZE, allPhrases.length));
          setSessionPhrases(firstSubset);
          if (firstSubset.length > 0) {
            setCurrentPhrase(firstSubset[0]);
          }
        } else {
          fetchRandomPhrase();
        }
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
              if (session.length > 0) {
                setVerbPracticeSession(session);
                setCurrentPhrase(session[0]);
              } else {
                fetchRandomPhrase();
              }
            } catch (err) {
              console.error('Error initializing verb practice session:', err);
              fetchRandomPhrase();
            }
          })();
        } else {
          // Function not available yet, use fallback
          fetchRandomPhrase();
        }
      } else if (practiceMode === 3) {
        // Conversation mode: build session from conversations
        try {
          if (Array.isArray(savedConversations) && savedConversations.length > 0) {
            const session = [];
            let convIdx = 0;
            let sentIdx = 0;
            while (session.length < SESSION_SIZE && convIdx < savedConversations.length) {
              const conv = savedConversations[convIdx];
              if (conv && Array.isArray(conv.items) && conv.items.length > 0) {
                const sent = conv.items[sentIdx % conv.items.length];
                if (sent && (sent.korean || sent.english)) {
                  session.push({
                    korean_text: String(sent.korean || ''),
                    english_text: String(sent.english || ''),
                    id: `conv-${conv.id || convIdx}-${sentIdx % conv.items.length}`
                  });
                }
                sentIdx++;
                if (sentIdx >= conv.items.length) {
                  convIdx++;
                  sentIdx = 0;
                }
              } else {
                convIdx++;
              }
            }
            if (session.length > 0) {
              setConversationSession(session);
              setCurrentPhrase(session[0]);
            } else {
              fetchRandomPhrase();
            }
          } else {
            fetchRandomPhrase();
          }
        } catch (err) {
          console.error('Error initializing conversation session:', err);
          fetchRandomPhrase();
        }
      }
    } catch (err) {
      console.error('Error in practiceMode useEffect:', err);
      setError(err.message || 'Failed to initialize practice mode');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceMode]); // Only trigger on mode change, not numBlanks (to avoid loops)

  // When numBlanks changes, reset inputs/placeholders to match new blanks count
  useEffect(() => {
    if (!currentPhrase) return;
    // Recompute random indices for the current phrase based on numBlanks
    const words = String(currentPhrase.korean_text || '').trim().split(' ').filter(w => w);
    const desired = Math.max(1, Math.min(3, Number(numBlanks) || 1));
    const types = (currentPhrase && wordTypesByPhraseId && wordTypesByPhraseId[currentPhrase.id]) || null;
    const candidates = getCandidateBlankIndices(words, types);
    let pool = candidates.length >= desired ? [...candidates] : words.map((_, i) => i);
    const chosen = [];
    while (chosen.length < desired && pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length);
      const [picked] = pool.splice(idx, 1);
      if (!chosen.includes(picked)) chosen.push(picked);
    }
    setRandomBlankIndices(chosen.sort((a, b) => a - b));
    const count = chosen.length;
    setInputValues(new Array(count).fill(''));
    setCurrentBlankIndex(0);
    setShowAnswer(false);
    setFeedback('');
  }, [numBlanks, currentPhrase && currentPhrase.id, getCandidateBlankIndices, wordTypesByPhraseId]);


  // Choose next phrase from locally loaded curriculum, without refetching (Mode 1)
  const selectNextCurriculumPhrase = useCallback(() => {
    // Work from the fixed session subset; when exhausted, loop the same subset
    const pool = Array.isArray(sessionPhrases) && sessionPhrases.length > 0 ? sessionPhrases : allPhrases;
    if (!Array.isArray(pool) || pool.length === 0) return false;
    const used = new Set(usedPhraseIds);
    let next = pool.find((p) => !used.has(p.id));
    if (!next) {
      // Reset and start again from the same 5
      setUsedPhraseIds([]);
      next = pool[0];
    }
    setUsedPhraseIds((prev) => prev.includes(next.id) ? prev : [...prev, next.id]);
    setCurrentPhrase(next);
    setUsingVariations(false);
    return true;
  }, [sessionPhrases, allPhrases, usedPhraseIds]);

  // Choose next phrase from verb practice session (Mode 2)
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
    const desired = Math.max(1, Math.min(3, Number(numBlanks) || 1));
    const candidates = getCandidateBlankIndices(words, null);
    let candidatePool = candidates.length >= desired ? [...candidates] : words.map((_, i) => i);
    const chosen = [];
    while (chosen.length < desired && candidatePool.length > 0) {
      const idx = Math.floor(Math.random() * candidatePool.length);
      chosen.push(candidatePool[idx]);
      candidatePool.splice(idx, 1);
    }
    setRandomBlankIndices(chosen.sort((a, b) => a - b));
    setInputValues(new Array(chosen.length).fill(''));
    setCurrentBlankIndex(0);
    setShowAnswer(false);
    setFeedback('');
    return true;
  }, [verbPracticeSession, usedPhraseIds, numBlanks, getCandidateBlankIndices]);

  // Choose next phrase from conversation session (Mode 3)
  const selectNextConversationPhrase = useCallback(() => {
    const pool = Array.isArray(conversationSession) && conversationSession.length > 0 ? conversationSession : [];
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
    // Create blank indices for conversation sentence
    const koreanText = String(next.korean_text || next.korean || '').trim();
    if (!koreanText) return false;
    const words = koreanText.split(' ').filter(w => w);
    if (words.length === 0) return false;
    const desired = Math.max(1, Math.min(3, Number(numBlanks) || 1));
    const candidates = getCandidateBlankIndices(words, null);
    let candidatePool = candidates.length >= desired ? [...candidates] : words.map((_, i) => i);
    const chosen = [];
    while (chosen.length < desired && candidatePool.length > 0) {
      const idx = Math.floor(Math.random() * candidatePool.length);
      chosen.push(candidatePool[idx]);
      candidatePool.splice(idx, 1);
    }
    setRandomBlankIndices(chosen.sort((a, b) => a - b));
    setInputValues(new Array(chosen.length).fill(''));
    setCurrentBlankIndex(0);
    setShowAnswer(false);
    setFeedback('');
    return true;
  }, [conversationSession, usedPhraseIds, numBlanks, getCandidateBlankIndices]);

  // Extract first JSON object from a chat response
  const parseJsonObject = useCallback((text) => {
    if (!text) return null;
    const m = String(text).match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { const obj = JSON.parse(m[0]); return obj && typeof obj === 'object' ? obj : null; } catch (_) { return null; }
  }, []);

  // Remix current sentence: keep POS order, replace words/grammar; enter no-track mode
  const handleRemixSentence = useCallback(async () => {
    try {
      const en = String(currentPhrase?.english_text || '').trim();
      const ko = String(currentPhrase?.korean_text || '').trim();
      if (!en || !ko) return;
      setSessionNoTrack(true);
      const prompt = `Create ONE new sentence pair (Korean + English) by REMIXING the content of the given sentence while preserving the sequence of parts of speech (POS) and clause order. Keep it natural and grammatical. Replace verbs, nouns, adjectives, tenses, and particles as needed, but mirror the original POS silhouette. Return ONLY JSON with these keys: {"korean":"…","english":"…"}.\nOriginal (EN): ${en}\nOriginal (KO): ${ko}`;
      const res = await api.chat(prompt);
      const data = await res.json().catch(() => null);
      const obj = parseJsonObject(data && (data.response || ''));
      if (obj && obj.korean && obj.english) {
        setCurrentPhrase({ id: `remix-${Date.now()}`, korean_text: String(obj.korean), english_text: String(obj.english), times_correct: 0 });
        setFeedback('');
        setInputPlaceholder('');
        setInputValues([]);
        setCurrentBlankIndex(0);
        setShowAnswer(false);
      }
    } catch (_) {}
  }, [currentPhrase, parseJsonObject]);

  // Add the current sentence to curriculum (manual save)
  const handleAddCurrentToCurriculum = useCallback(async () => {
    try {
      const en = String(currentPhrase?.english_text || '').trim();
      const ko = String(currentPhrase?.korean_text || '').trim();
      if (!en || !ko) return;
      const res = await api.addCurriculumPhrase({ korean_text: ko, english_text: en });
      if (res.ok) {
        setFeedback('Added to curriculum ✓');
      } else {
        const t = await res.text().catch(() => '');
        setFeedback('Failed to add to curriculum' + (t ? `: ${t}` : ''));
      }
    } catch (e) {
      setFeedback('Failed to add to curriculum');
    }
  }, [currentPhrase]);

  const speakText = useCallback((text, onEnd, repeatCount = 3) => {
    try {
      const synth = window.speechSynthesis;
      if (!synth || window.__APP_MUTED__ === true) {
        setTimeout(() => { if (onEnd) onEnd(); }, SPEAK_ADVANCE_DELAY_MS);
        return;
      }
      
      synth.cancel();
      
      let currentRepeat = 0;
      const globalSpeed = window.__APP_SPEECH_SPEED__ || 1.0;
      const speakOnce = () => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ko-KR';
        utterance.rate = 0.6 * globalSpeed;
        utterance.onend = () => {
          currentRepeat++;
          if (currentRepeat < repeatCount) {
            setTimeout(() => speakOnce(), 500);
          } else {
            setTimeout(() => { if (onEnd) onEnd(); }, SPEAK_ADVANCE_DELAY_MS);
          }
        };
        synth.speak(utterance);
      };
      
      speakOnce();
    } catch (e) {
      setTimeout(() => { if (onEnd) onEnd(); }, SPEAK_ADVANCE_DELAY_MS);
    }
  }, []);

  // Build full Korean sentence by replacing [BLANK] with the original words
  const getFullKoreanSentence = useCallback(() => {
    if (!blankPhrase) return '';
    const words = String(blankPhrase.korean || '').split(' ');
    let bi = 0;
    return words.map(w => {
      if (w === '[BLANK]') {
        const word = blankPhrase.blanks[bi] || '';
        bi++;
        return word;
      }
      return w;
    }).join(' ');
  }, [blankPhrase]);

  // Speak the full Korean sentence (with blanks filled) three times
  const handleSpeakFullThreeTimes = useCallback(() => {
    try { const synth = window.speechSynthesis; if (synth) synth.cancel(); } catch (_) {}
    const full = getFullKoreanSentence();
    if (!full) return;
    speakText(full, null, 3);
  }, [getFullKoreanSentence, speakText]);

  // Load conversation sets from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('conversation_sets_v1');
      const arr = raw ? JSON.parse(raw) : [];
      setSavedConversations(Array.isArray(arr) ? arr : []);
    } catch (_) {
      setSavedConversations([]);
    }
  }, []);

  // Verb practice helpers (from AudioLearningPage)
  const PRONOUNS = [
    { ko: '나는', en: 'I' },
    { ko: '너는', en: 'you' },
    { ko: '우리는', en: 'we' },
    { ko: '그는', en: 'he' },
    { ko: '그녀는', en: 'she' },
    { ko: '그들은', en: 'they' },
  ];

  const pickRandomPronoun = useCallback(() => {
    return PRONOUNS[Math.floor(Math.random() * PRONOUNS.length)];
  }, []);

  const endsWithBrightVowel = (stem) => /[ㅏㅗ]$/.test(stem);

  const conjugateVerbSimple = useCallback((baseForm, tense) => {
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
    const needsEu = /[^aeiou가-힣]$/.test(stem) || /[ㄱ-ㅎ]$/.test(stem);
    return stem + (stem.endsWith('ㄹ') ? ' 거예요' : (needsEu ? '을 거예요' : 'ㄹ 거예요'));
  }, []);

  // Generate verb practice sentence (Mode 2)
  const generateVerbPracticeSentence = useCallback(async () => {
    try {
      // Get learning words
      const response = await api.getLearningWords(200);
      if (!response.ok) return null;
      const all = await response.json().catch(() => []);
      if (!Array.isArray(all) || all.length === 0) return null;

      // Filter verbs
      const verbs = all.filter((w) => {
        const ko = String(w.korean || '');
        const t = String(w.type || '').toLowerCase();
        return t === 'verb' || /다$/.test(ko);
      }).slice(0, 20);

      if (verbs.length === 0) return null;

      // Try AI generation first
      try {
        const verbList = verbs.map(v => `${String(v.korean || '').trim()} (${String(v.english || '').replace(/^to\s+/i,'').trim()})`).filter(Boolean).join(', ');
        const prompt = `Return ONLY JSON: {"korean":"...","english":"..."}.
Create ONE natural Korean sentence (polite style) that includes exactly one date modifier from [오늘, 어제, 내일] and a simple subject pronoun (나/너/우리/그/그녀/그들).
Use a verb from this list when possible: ${verbList || '(any common verb)'}.
Conjugate the verb correctly: 오늘 → present (…아요/어요), 어제 → past (…았/었어요), 내일 → future (…(으)ㄹ 거예요).
Keep it <= 10 words. Provide the English translation matching the tense.`;
        const res = await api.chat(prompt);
        if (res && res.ok) {
          const data = await res.json().catch(() => null);
          const m = data && data.response && data.response.match(/\{[\s\S]*\}/);
          if (m && m[0]) {
            try {
              const obj = JSON.parse(m[0]);
              if (obj && obj.korean && obj.english) {
                return { korean_text: String(obj.korean), english_text: String(obj.english), id: `verb-${Date.now()}` };
              }
            } catch (_) {}
          }
        }
      } catch (_) {}

      // Fallback: simple verb sentence
      const verb = verbs[Math.floor(Math.random() * verbs.length)];
      const tenses = ['present', 'past', 'future'];
      const tense = tenses[Math.floor(Math.random() * tenses.length)];
      const pron = pickRandomPronoun();
      const conj = conjugateVerbSimple(verb.korean, tense);
      const korean = `${pron.ko} ${conj}`;
      const english = `${pron.en} ${verb.english || 'do'}${tense === 'past' ? 'ed' : tense === 'future' ? ' will' : ''}`;
      return { korean_text: korean, english_text: english, id: `verb-${Date.now()}` };
    } catch (e) {
      console.error('Error generating verb practice sentence:', e);
      return null;
    }
  }, [pickRandomPronoun, conjugateVerbSimple]);

  // Get next sentence from conversation sets (Mode 3)
  const getNextConversationSentence = useCallback(() => {
    if (!Array.isArray(savedConversations) || savedConversations.length === 0) return null;
    
    // Get current conversation
    const conv = savedConversations[currentConversationIndex];
    if (!conv || !Array.isArray(conv.items) || conv.items.length === 0) {
      // Move to next conversation
      const nextConvIndex = (currentConversationIndex + 1) % savedConversations.length;
      setCurrentConversationIndex(nextConvIndex);
      setCurrentSentenceIndex(0);
      const nextConv = savedConversations[nextConvIndex];
      if (!nextConv || !Array.isArray(nextConv.items) || nextConv.items.length === 0) return null;
      const firstSent = nextConv.items[0];
      return { korean_text: String(firstSent.korean || ''), english_text: String(firstSent.english || ''), id: `conv-${nextConv.id}-0` };
    }

    // Get current sentence
    const sent = conv.items[currentSentenceIndex];
    if (!sent) {
      // Move to next conversation
      const nextConvIndex = (currentConversationIndex + 1) % savedConversations.length;
      setCurrentConversationIndex(nextConvIndex);
      setCurrentSentenceIndex(0);
      const nextConv = savedConversations[nextConvIndex];
      if (!nextConv || !Array.isArray(nextConv.items) || nextConv.items.length === 0) return null;
      const firstSent = nextConv.items[0];
      return { korean_text: String(firstSent.korean || ''), english_text: String(firstSent.english || ''), id: `conv-${nextConv.id}-0` };
    }

    // Move to next sentence
    const nextSentIndex = (currentSentenceIndex + 1) % conv.items.length;
    if (nextSentIndex === 0) {
      // Move to next conversation
      const nextConvIndex = (currentConversationIndex + 1) % savedConversations.length;
      setCurrentConversationIndex(nextConvIndex);
    } else {
      setCurrentSentenceIndex(nextSentIndex);
    }

    return { korean_text: String(sent.korean || ''), english_text: String(sent.english || ''), id: `conv-${conv.id}-${currentSentenceIndex}` };
  }, [savedConversations, currentConversationIndex, currentSentenceIndex]);

  // Load all curriculum phrases on mount
  const loadAllPhrases = useCallback(async () => {
    try {
      const response = await api.getCurriculumPhrases();
      if (!response.ok) {
        console.error('Failed to load phrases');
        return;
      }
      const phrases = await response.json();
      const listRaw = Array.isArray(phrases) ? phrases : [];
      // Sort by earliest added first (created_at/date_added ascending; fallback to numeric id)
      const normTs = (p) => {
        const ts = p && (p.created_at || p.date_added || p.createdAt || p.added_at);
        if (!ts) return null;
        const n = Number(ts);
        if (!Number.isNaN(n) && n > 0) return n;
        const d = Date.parse(String(ts));
        return Number.isNaN(d) ? null : d;
      };
      const list = [...listRaw].sort((a, b) => {
        const ta = normTs(a);
        const tb = normTs(b);
        if (ta !== null && tb !== null) return ta - tb;
        if (ta !== null) return -1;
        if (tb !== null) return 1;
        const ida = Number(a && a.id);
        const idb = Number(b && b.id);
        if (!Number.isNaN(ida) && !Number.isNaN(idb)) return ida - idb;
        return 0;
      });
      setAllPhrases(list);
      console.log('Loaded', list.length, 'curriculum phrases');
      // Initialize first session subset (first 5)
      const firstSubset = list.slice(0, Math.min(SESSION_SIZE, list.length));
      setSessionPage(0);
      setSessionPhrases(firstSubset);
      setUsedPhraseIds([]);
      if (firstSubset.length > 0) {
        setCurrentPhrase(firstSubset[0]);
      } else {
        setCurrentPhrase(null);
      }
    } catch (e) {
      console.error('Error loading phrases:', e);
    }
  }, []);

  // Lightweight POS tagging for current session phrases (cache per phrase id)
  const tagPhraseWordTypes = useCallback(async (phrase) => {
    try {
      const ko = String(phrase?.korean_text || '').trim();
      if (!ko) return null;
      const prompt = `Return ONLY JSON with this format: {"tokens":["..."],"types":["..."]}. 
Tokens must be the exact Korean tokens split by spaces from the given sentence, in order.
Types must be one of: pronoun, noun, proper noun, verb, adjective, adverb, particle, numeral, determiner, interjection, other.
Korean: ${ko}`;
      const res = await api.chat(prompt);
      if (!res || !res.ok) return null;
      const data = await res.json().catch(() => null);
      const text = data && (data.response || '');
      const m = String(text).match(/\{[\s\S]*\}/);
      if (!m) return null;
      let obj = null;
      try { obj = JSON.parse(m[0]); } catch (_) { return null; }
      const tokens = Array.isArray(obj && obj.tokens) ? obj.tokens : null;
      const types = Array.isArray(obj && obj.types) ? obj.types : null;
      if (!tokens || !types || tokens.length !== types.length) return null;
      return types;
    } catch (_) {
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const subset = Array.isArray(sessionPhrases) ? sessionPhrases.slice(0, SESSION_SIZE) : [];
      const updates = {};
      const toCodes = (t) => {
        const s = String(t || '').toLowerCase();
        if (s.includes('proper')) return 3;
        if (s.includes('pronoun')) return 1;
        if (s.includes('verb')) return 4;
        if (s.includes('adjective')) return 5;
        if (s.includes('adverb')) return 6;
        if (s.includes('particle') || s.includes('postposition')) return 7;
        if (s.includes('numeral') || s.includes('number')) return 8;
        if (s.includes('determiner') || s.includes('det')) return 9;
        if (s.includes('interjection')) return 10;
        if (s.includes('noun')) return 2;
        return 0;
      };
      await Promise.all(subset.map(async (p) => {
        const pid = p && p.id;
        if (!pid) return;
        if (wordTypesByPhraseId && wordTypesByPhraseId[pid]) return;
        const types = await tagPhraseWordTypes(p);
        if (!cancelled && types && Array.isArray(types)) {
          updates[pid] = types;
        }
      }));
      if (!cancelled && Object.keys(updates).length > 0) {
        setWordTypesByPhraseId(prev => ({ ...prev, ...updates }));
        // Persist to backend for each phrase with new tags
        try {
          await Promise.all(
            subset.map(async (p) => {
              const pid = p && p.id;
              if (!pid || !updates[pid]) return;
              try {
                await api.updateCurriculumPhrase(pid, {
                  korean_text: p.korean_text,
                  english_text: p.english_text,
                  // Preserve blanks and metadata if present
                  blank_word_indices: Array.isArray(p.blank_word_indices) ? p.blank_word_indices : [],
                  correct_answers: Array.isArray(p.correct_answers) ? p.correct_answers : [],
                  grammar_breakdown: p.grammar_breakdown || null,
                  blank_word_types: Array.isArray(p.blank_word_types) ? p.blank_word_types : [],
                  word_types: updates[pid],
                  word_type_codes: updates[pid].map(toCodes)
                });
              } catch (_) {}
            })
          );
        } catch (_) {}
      }
    })();
    return () => { cancelled = true; };
  }, [sessionPhrases, tagPhraseWordTypes]); 

  // Generate a variation of a phrase using AI
  const generateVariation = useCallback(async (basePhrase) => {
    try {
      console.log('Generating variation for phrase:', basePhrase.id);
      
      // Get words by type for each blank
      const blankIndices = basePhrase.blank_word_indices || [];
      const blankTypes = basePhrase.blank_word_types || [];
      
      // Fetch words for each blank type
      const wordOptions = {};
      for (let i = 0; i < blankTypes.length; i++) {
        const wordType = blankTypes[i];
        if (!wordType) continue;
        
        if (!wordOptions[wordType]) {
          try {
            const wordsRes = await api.getWordsByType(wordType, 50);
            if (wordsRes.ok) {
              const words = await wordsRes.json();
              wordOptions[wordType] = words.map(w => w.korean || w.korean_word).filter(Boolean);
            }
          } catch (e) {
            console.error(`Failed to fetch ${wordType} words:`, e);
          }
        }
      }
      
      // Build prompt for AI to generate variation
      const koreanWords = basePhrase.korean_text.trim().split(' ').filter(w => w);
      const blankInfo = blankIndices.map((idx, i) => {
        const word = koreanWords[idx];
        const type = blankTypes[i] || 'unknown';
        const options = wordOptions[type] || [];
        return {
          index: idx,
          word: word,
          type: type,
          options: options.slice(0, 10).join(', ') // Top 10 options
        };
      });
      
      const prompt = `Generate a Korean sentence variation by replacing some blank words in this sentence.

Original Korean: ${basePhrase.korean_text}
Original English: ${basePhrase.english_text}

Blank words to replace:
${blankInfo.map((b, i) => `Blank ${i + 1} (index ${b.index}): "${b.word}" (type: ${b.type}). Suggested replacements: ${b.options || 'any appropriate ' + b.type}`).join('\n')}

Generate a new Korean sentence with the same structure and meaning, but replace one or more of the blank words with other appropriate words of the same type. Keep the sentence grammatically correct and natural.

Respond with ONLY a JSON object in this format:
{
  "korean_text": "new sentence with replaced words",
  "english_text": "translation of new sentence",
  "replaced_blanks": [list of blank indices that were replaced]
}`;

      let chatRes;
      try {
        chatRes = await api.chat(prompt);
      } catch (fetchError) {
        console.error('Network error calling chat API:', fetchError);
        throw new Error('Failed to connect to AI service. Please make sure the backend server is running.');
      }
      
      if (!chatRes.ok) {
        const errorText = await chatRes.text().catch(() => '');
        throw new Error(`AI service returned error: ${chatRes.status}${errorText ? ` - ${errorText}` : ''}`);
      }
      
      const chatData = await chatRes.json();
      const responseText = chatData.response || '';
      
      // Extract JSON from response - try to find the first complete JSON object
      let variation = null;
      let jsonStart = responseText.indexOf('{');
      
      if (jsonStart === -1) {
        throw new Error('No JSON object found in response');
      }
      
      // Find the matching closing brace by counting braces
      let braceCount = 0;
      let jsonEnd = -1;
      for (let i = jsonStart; i < responseText.length; i++) {
        if (responseText[i] === '{') {
          braceCount++;
        } else if (responseText[i] === '}') {
          braceCount--;
          if (braceCount === 0) {
            jsonEnd = i + 1;
            break;
          }
        }
      }
      
      if (jsonEnd === -1) {
        throw new Error('Incomplete JSON object in response');
      }
      
      const jsonString = responseText.substring(jsonStart, jsonEnd);
      try {
        variation = JSON.parse(jsonString);
      } catch (parseError) {
        console.error('JSON parsing error:', parseError);
        console.error('Attempted to parse:', jsonString);
        throw new Error(`Failed to parse JSON: ${parseError.message}`);
      }
      
      // Create a new phrase object based on the variation
      const newPhrase = {
        ...basePhrase,
        korean_text: variation.korean_text,
        english_text: variation.english_text,
        id: `variation-${Date.now()}`, // Temporary ID for variations
        // Ensure blank_word_indices, correct_answers, and blank_word_types are preserved
        blank_word_indices: basePhrase.blank_word_indices || [],
        correct_answers: basePhrase.correct_answers || [],
        blank_word_types: basePhrase.blank_word_types || []
      };
      
      console.log('[VARIATION] Created variation phrase object:', {
        id: newPhrase.id,
        korean_text: newPhrase.korean_text,
        english_text: newPhrase.english_text,
        blank_word_indices: newPhrase.blank_word_indices,
        correct_answers: newPhrase.correct_answers,
        blank_word_types: newPhrase.blank_word_types,
        has_grammar_breakdown: !!newPhrase.grammar_breakdown
      });
      
      // Immediately add the variation to the curriculum
      console.log('[VARIATION] ===== Adding variation to curriculum immediately =====');
      try {
        const phraseData = {
          korean_text: newPhrase.korean_text,
          english_text: newPhrase.english_text,
          blank_word_indices: newPhrase.blank_word_indices || [],
          correct_answers: newPhrase.correct_answers || [],
          grammar_breakdown: newPhrase.grammar_breakdown || null,
          blank_word_types: newPhrase.blank_word_types || []
        };
        console.log('[VARIATION] Sending variation data to API:', JSON.stringify(phraseData, null, 2));
        
        const addRes = await api.addCurriculumPhrase(phraseData);
        console.log('[VARIATION] Add to curriculum API response status:', addRes.status, addRes.statusText);
        console.log('[VARIATION] Add to curriculum API response ok:', addRes.ok);
        
        if (addRes.ok) {
          const responseData = await addRes.json().catch(() => null);
          console.log('[VARIATION] Add to curriculum API response data:', responseData);
          
          // Update the variation object with the actual database ID
          if (responseData && responseData.id) {
            newPhrase.id = responseData.id;
            newPhrase.db_id = responseData.id;
            console.log('[VARIATION] ✓ Variation added to curriculum with ID:', responseData.id);
          } else {
            console.log('[VARIATION] ✓ Variation added to curriculum (response ID not found)');
          }
          
          // Reload phrases list to include the new one
          console.log('[VARIATION] Reloading phrases list...');
          const phrasesRes = await api.getCurriculumPhrases();
          if (phrasesRes.ok) {
          const phrases = await phrasesRes.json();
          const listRaw = Array.isArray(phrases) ? phrases : [];
          const normTs = (p) => {
            const ts = p && (p.created_at || p.date_added || p.createdAt || p.added_at);
            if (!ts) return null;
            const n = Number(ts);
            if (!Number.isNaN(n) && n > 0) return n;
            const d = Date.parse(String(ts));
            return Number.isNaN(d) ? null : d;
          };
          const listSorted = [...listRaw].sort((a, b) => {
            const ta = normTs(a);
            const tb = normTs(b);
            if (ta !== null && tb !== null) return ta - tb;
            if (ta !== null) return -1;
            if (tb !== null) return 1;
            const ida = Number(a && a.id);
            const idb = Number(b && b.id);
            if (!Number.isNaN(ida) && !Number.isNaN(idb)) return ida - idb;
            return 0;
          });
          console.log('[VARIATION] Loaded phrases count:', listSorted.length);
          setAllPhrases(listSorted);
          console.log('[VARIATION] ✓ Phrases list reloaded (sorted by created_at)');
          }
        } else {
          const errorText = await addRes.text().catch(() => '');
          console.error('[VARIATION] ✗ Failed to add variation to curriculum');
          console.error('[VARIATION] Error status:', addRes.status);
          console.error('[VARIATION] Error text:', errorText);
        }
      } catch (addError) {
        console.error('[VARIATION] ✗ Exception while adding variation to curriculum:', addError);
        console.error('[VARIATION] Error stack:', addError.stack);
      }
      console.log('[VARIATION] ===== Finished adding variation to curriculum =====');
      
      return newPhrase;
    } catch (e) {
      console.error('Error generating variation:', e);
      throw e;
    }
  }, [setAllPhrases]);

  const fetchRandomPhrase = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      let data;
      
      // Mode 2: Verb practice
      if (practiceMode === 2) {
        data = await generateVerbPracticeSentence();
        if (!data) {
          setError('Failed to generate verb practice sentence. Please try again.');
          setLoading(false);
          return;
        }
        setCurrentPhrase(data);
        // Create blank indices for verb practice
        const words = data.korean_text.trim().split(' ').filter(w => w);
        const desired = Math.max(1, Math.min(3, Number(numBlanks) || 1));
        const candidates = getCandidateBlankIndices(words, null);
        let pool = candidates.length >= desired ? [...candidates] : words.map((_, i) => i);
        const chosen = [];
        while (chosen.length < desired && pool.length > 0) {
          const idx = Math.floor(Math.random() * pool.length);
          chosen.push(pool[idx]);
          pool.splice(idx, 1);
        }
        setRandomBlankIndices(chosen.sort((a, b) => a - b));
        const blankIndices = chosen.sort((a, b) => a - b);
        setInputValues(new Array(blankIndices.length).fill(''));
        setCurrentBlankIndex(0);
        setExplanationText('');
        setExplanationPhraseId(null);
        setShowExplanation(false);
        setShowAnswer(false);
        setLoading(false);
        return;
      }

      // Mode 3: Conversation sets
      if (practiceMode === 3) {
        data = getNextConversationSentence();
        if (!data) {
          setError('No conversation sets found. Create some in Audio Learning page first!');
          setLoading(false);
          return;
        }
        setCurrentPhrase(data);
        // Create blank indices for conversation sentence
        const words = data.korean_text.trim().split(' ').filter(w => w);
        const desired = Math.max(1, Math.min(3, Number(numBlanks) || 1));
        const candidates = getCandidateBlankIndices(words, null);
        let pool = candidates.length >= desired ? [...candidates] : words.map((_, i) => i);
        const chosen = [];
        while (chosen.length < desired && pool.length > 0) {
          const idx = Math.floor(Math.random() * pool.length);
          chosen.push(pool[idx]);
          pool.splice(idx, 1);
        }
        setRandomBlankIndices(chosen.sort((a, b) => a - b));
        const blankIndices = chosen.sort((a, b) => a - b);
        setInputValues(new Array(blankIndices.length).fill(''));
        setCurrentBlankIndex(0);
        setExplanationText('');
        setExplanationPhraseId(null);
        setShowExplanation(false);
        setShowAnswer(false);
        setLoading(false);
        return;
      }

      // Mode 1: Normal curriculum practice
      // First, try to use an unused phrase from our list
      if (allPhrases.length > 0) {
        const unusedPhrases = allPhrases.filter(p => !usedPhraseIds.includes(p.id));
        
        if (unusedPhrases.length > 0) {
          // Pick a random unused phrase
          const randomIndex = Math.floor(Math.random() * unusedPhrases.length);
          const selectedPhrase = unusedPhrases[randomIndex];
          
          console.log('Using phrase from curriculum:', selectedPhrase.id);
          data = selectedPhrase;
          setUsedPhraseIds(prev => [...prev, selectedPhrase.id]);
          setUsingVariations(false);
        } else {
          // All phrases used, generate a variation
          console.log('All phrases used, generating variation...');
          setUsingVariations(true);
          
          // Pick a random base phrase to vary
          const randomBaseIndex = Math.floor(Math.random() * allPhrases.length);
          const basePhrase = allPhrases[randomBaseIndex];
          
          try {
            // Generate variation
            data = await generateVariation(basePhrase);
            console.log('Generated variation:', data);
          } catch (variationError) {
            console.error('Failed to generate variation:', variationError);
            // If AI generation fails, reset used phrases and cycle through again
            // This prevents getting stuck when AI is unavailable
            setUsedPhraseIds([]);
            setUsingVariations(false);
            
            // Pick a random phrase from the list
            const fallbackIndex = Math.floor(Math.random() * allPhrases.length);
            data = allPhrases[fallbackIndex];
            setUsedPhraseIds([data.id]);
            
            throw new Error(`Failed to generate AI variation: ${variationError.message}. Cycling through curriculum phrases again.`);
          }
        }
      } else {
        // Fallback to API if we haven't loaded phrases yet
        console.log('Fetching random curriculum phrase from API...');
        const response = await api.getRandomCurriculumPhrase();
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('No curriculum phrases found. Add some phrases to the curriculum first!');
            setLoading(false);
            return;
          }
          const errorText = await response.text().catch(() => '');
          throw new Error(`HTTP error! status: ${response.status}${errorText ? ` - ${errorText}` : ''}`);
        }
        
        data = await response.json();
      }
      
      setCurrentPhrase(data);
      // Initialize input values based on number of blanks
      const blankIndices = data.blank_word_indices || (data.blank_word_index !== null && data.blank_word_index !== undefined ? [data.blank_word_index] : []);
      setInputValues(new Array(blankIndices.length).fill(''));
      setCurrentBlankIndex(0);
      setExplanationText('');
      setExplanationPhraseId(null);
      setShowExplanation(false);
      setShowAnswer(false);
      setLoading(false);
      console.log('Fetch completed successfully');
    } catch (e) {
      console.error('Error fetching random phrase:', e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(errorMessage || 'Failed to load phrase. Please try again.');
      setLoading(false);
      console.log('Error state set, loading set to false');
    }
  }, [allPhrases, usedPhraseIds, generateVariation, practiceMode, generateVerbPracticeSentence, getNextConversationSentence, numBlanks, getCandidateBlankIndices]);

  const fetchExplanation = useCallback(async () => {
    if (!currentPhrase || !blankPhrase) return;
    const currentId = blankPhrase.id || currentPhrase.id;
    if (explanationText && explanationPhraseId === currentId) {
      // Check if we have stored grammar breakdown
      if (currentPhrase.grammar_breakdown) {
        setExplanationText(currentPhrase.grammar_breakdown);
        setExplanationPhraseId(currentId);
        return;
      }
    }
    setIsLoadingExplanation(true);
    try {
      // Use stored grammar breakdown if available, otherwise fetch via API
      if (currentPhrase.grammar_breakdown) {
        setExplanationText(currentPhrase.grammar_breakdown);
        setExplanationPhraseId(currentId);
        setIsLoadingExplanation(false);
        return;
      }
      
      // Reconstruct full Korean sentence (replace all [BLANK]s with actual words)
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
      const prompt = `Explain this Korean sentence in detail.
Korean: ${fullKorean}
English: ${english}
Please include a clear breakdown of grammar (particles, tense, politeness), vocabulary with brief glosses, and any important notes for a learner.
Break down particles such as 은/는, 이/가, 을/를, 에, 에서, etc, verbs and their root forms, and pronouns
Keep it concise and structured, focusing on helping someone understand how the sentence works.`;
      const res = await api.chat(prompt);
      if (res.ok) {
        const data = await res.json();
        const text = data.response || '';
        setExplanationText(text);
        setExplanationPhraseId(currentId);
      }
    } catch (_) {
      setExplanationText('Failed to load explanation.');
    } finally {
      setIsLoadingExplanation(false);
    }
  }, [currentPhrase, blankPhrase, explanationText, explanationPhraseId]);

  const handleToggleExplanation = useCallback(() => {
    setShowExplanation(v => {
      const currentId = blankPhrase?.id || currentPhrase?.id;
      if (!v && (!explanationText || explanationPhraseId !== currentId) && !isLoadingExplanation) {
        fetchExplanation();
      }
      return !v;
    });
  }, [showExplanation, explanationText, explanationPhraseId, isLoadingExplanation, fetchExplanation, blankPhrase, currentPhrase]);

  // Load all phrases on mount
  useEffect(() => {
    loadAllPhrases();
  }, [loadAllPhrases]);

  useEffect(() => {
    console.log('useEffect triggered - currentPhrase:', currentPhrase, 'loading:', loading, 'error:', error);
    // Fetch on mount if we don't have a phrase yet, or if we're not currently loading/errored
    if (!currentPhrase && !loading && !error) {
      console.log('Calling fetchRandomPhrase...');
      fetchRandomPhrase();
    } else {
      console.log('Skipping fetch - currentPhrase:', !!currentPhrase, 'loading:', loading, 'error:', !!error);
    }
    // If there's an error and no phrase, don't keep trying - let user manually retry
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Recompute session subset when page or full list changes (Mode 1: Curriculum only)
  useEffect(() => {
    if (practiceMode !== 1) return; // Only update session for curriculum mode
    
    const total = allPhrases.length;
    if (total === 0) {
      setSessionPhrases([]);
      setCurrentPhrase(null);
      setUsedPhraseIds([]);
      return;
    }
    const start = Math.max(0, Math.min(sessionPage * SESSION_SIZE, Math.max(0, total - 1)));
    const end = Math.min(start + SESSION_SIZE, total);
    const subset = allPhrases.slice(start, end);
    setSessionPhrases(subset);
    setUsedPhraseIds([]);
    if (subset.length > 0) {
      setCurrentPhrase(subset[0]);
      setInputValues([]);
      setCurrentBlankIndex(0);
      setShowAnswer(false);
      setFeedback('');
    }
  }, [sessionPage, allPhrases, practiceMode]);

  const handleSkip = useCallback(async () => {
    try {
      try { const synth = window.speechSynthesis; if (synth) synth.cancel(); } catch (_) {}
      setFeedback('');
      setInputPlaceholder('');
      setInputValues([]);
      setCurrentBlankIndex(0);
      setShowAnswer(false);
      
      // Mode 1: Use curriculum phrase selection
      if (practiceMode === 1) {
        const advanced = selectNextCurriculumPhrase();
        if (!advanced) {
          setLoading(true);
          await fetchRandomPhrase();
        }
      } else if (practiceMode === 2) {
        // Mode 2: Use verb practice session
        const advanced = selectNextVerbPracticePhrase();
        if (!advanced) {
          // Regenerate session if exhausted
          setLoading(true);
          const session = [];
          for (let i = 0; i < SESSION_SIZE; i++) {
            const phrase = await generateVerbPracticeSentence();
            if (phrase) {
              session.push(phrase);
            }
          }
          if (session.length > 0) {
            setVerbPracticeSession(session);
            setUsedPhraseIds([]);
            setCurrentPhrase(session[0]);
            const words = session[0].korean_text.trim().split(' ').filter(w => w);
            const desired = Math.max(1, Math.min(3, Number(numBlanks) || 1));
            const candidates = getCandidateBlankIndices(words, null);
            let pool = candidates.length >= desired ? [...candidates] : words.map((_, i) => i);
            const chosen = [];
            while (chosen.length < desired && pool.length > 0) {
              const idx = Math.floor(Math.random() * pool.length);
              chosen.push(pool[idx]);
              pool.splice(idx, 1);
            }
            setRandomBlankIndices(chosen.sort((a, b) => a - b));
            setInputValues(new Array(chosen.length).fill(''));
            setCurrentBlankIndex(0);
          }
          setLoading(false);
        }
      } else if (practiceMode === 3) {
        // Mode 3: Use conversation session
        const advanced = selectNextConversationPhrase();
        if (!advanced) {
          // Rebuild session if exhausted
          if (Array.isArray(savedConversations) && savedConversations.length > 0) {
            const session = [];
            let convIdx = 0;
            let sentIdx = 0;
            while (session.length < SESSION_SIZE && convIdx < savedConversations.length) {
              const conv = savedConversations[convIdx];
              if (Array.isArray(conv.items) && conv.items.length > 0) {
                const sent = conv.items[sentIdx % conv.items.length];
                if (sent) {
                  session.push({
                    korean_text: String(sent.korean || ''),
                    english_text: String(sent.english || ''),
                    id: `conv-${conv.id}-${sentIdx % conv.items.length}`
                  });
                }
                sentIdx++;
                if (sentIdx >= conv.items.length) {
                  convIdx++;
                  sentIdx = 0;
                }
              } else {
                convIdx++;
              }
            }
            if (session.length > 0) {
              setConversationSession(session);
              setUsedPhraseIds([]);
              setCurrentPhrase(session[0]);
              const words = session[0].korean_text.trim().split(' ').filter(w => w);
              const desired = Math.max(1, Math.min(3, Number(numBlanks) || 1));
              const candidates = getCandidateBlankIndices(words, null);
              let pool = candidates.length >= desired ? [...candidates] : words.map((_, i) => i);
              const chosen = [];
              while (chosen.length < desired && pool.length > 0) {
                const idx = Math.floor(Math.random() * pool.length);
                chosen.push(pool[idx]);
                pool.splice(idx, 1);
              }
              setRandomBlankIndices(chosen.sort((a, b) => a - b));
              setInputValues(new Array(chosen.length).fill(''));
              setCurrentBlankIndex(0);
            } else {
              setLoading(true);
              await fetchRandomPhrase();
            }
          } else {
            setLoading(true);
            await fetchRandomPhrase();
          }
        }
      }
    } catch (_) {}
  }, [fetchRandomPhrase, selectNextCurriculumPhrase, selectNextVerbPracticePhrase, selectNextConversationPhrase, practiceMode, generateVerbPracticeSentence, numBlanks, getCandidateBlankIndices, savedConversations]);

  const handleInputChange = useCallback((index, value) => {
    const newInputValues = [...inputValues];
    newInputValues[index] = value;
    setInputValues(newInputValues);
    if (inputPlaceholder) {
      setInputPlaceholder('');
    }
  }, [inputValues, inputPlaceholder]);

  const handleKeyDown = useCallback(async (event, blankIndex) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (!blankPhrase || !blankPhrase.blanks || blankPhrase.blanks.length === 0) return;
      
      const currentInput = inputValues[blankIndex] || '';
      const currentBlank = blankPhrase.blanks[blankIndex];
      // Handle correct_answers: could be array of arrays (one per blank) or flat array (one per blank in order)
      let correctAnswers = [currentBlank];
      if (Array.isArray(blankPhrase.correct_answers)) {
        if (blankPhrase.correct_answers.length > blankIndex) {
          const answer = blankPhrase.correct_answers[blankIndex];
          // If answer is itself an array (multiple correct answers for this blank), use it; otherwise wrap in array
          correctAnswers = Array.isArray(answer) ? answer : [answer];
        }
      }
      
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
        
        if (allBlanksFilled) {
          // All blanks are correct!
          setFeedback('All correct! Great job!');
          
          async function proceedToNext() {
            try {
              // Only update stats when not in no-track mode and not a generated/remix entry
              const isGenerated = currentPhrase && (String(currentPhrase.id).startsWith('variation-') || String(currentPhrase.id).startsWith('remix-'));
              if (sessionNoTrack || isGenerated) {
                // Skip tracking
              } else if (usingVariations && currentPhrase && String(currentPhrase.id).startsWith('variation-')) {
                // Check if variation was already added (has db_id)
                if (currentPhrase.db_id) {
                  console.log('[CURRICULUM] Variation already in curriculum with ID:', currentPhrase.db_id);
                  console.log('[CURRICULUM] Updating stats for variation:', currentPhrase.db_id);
                  try {
                    await api.updateCurriculumPhraseStats(currentPhrase.db_id, true);
                    console.log('[CURRICULUM] ✓ Stats updated for variation');
                    setFeedback('All correct! Variation already in curriculum - stats updated!');
                  } catch (e) {
                    console.error('[CURRICULUM] ✗ Failed to update stats:', e);
                    setFeedback('All correct! (Failed to update stats)');
                  }
                } else {
                  // Fallback: try to add if not already added
                  console.log('[CURRICULUM] Variation not found in curriculum, attempting to add...');
                  try {
                    const phraseData = {
                      korean_text: currentPhrase.korean_text,
                      english_text: currentPhrase.english_text,
                      blank_word_indices: currentPhrase.blank_word_indices || [],
                      correct_answers: currentPhrase.correct_answers || [],
                      grammar_breakdown: currentPhrase.grammar_breakdown || null,
                      blank_word_types: currentPhrase.blank_word_types || []
                    };
                    const res = await api.addCurriculumPhrase(phraseData);
                    if (res.ok) {
                      const phrasesRes = await api.getCurriculumPhrases();
                      if (phrasesRes.ok) {
                        const phrases = await phrasesRes.json();
                        setAllPhrases(Array.isArray(phrases) ? phrases : []);
                        setUsedPhraseIds([]);
                        setFeedback('All correct! Variation added to curriculum!');
                      }
                    }
                  } catch (e) {
                    console.error('[CURRICULUM] ✗ Failed to add variation:', e);
                    setFeedback('All correct!');
                  }
                }
              } else {
                // Only update stats for actual curriculum phrases, not variations
                if (blankPhrase.id && String(blankPhrase.id) && !String(blankPhrase.id).startsWith('variation-')) {
                  console.log('[CURRICULUM] Updating stats for curriculum phrase:', blankPhrase.id);
                  await api.updateCurriculumPhraseStats(blankPhrase.id, true);
                  console.log('[CURRICULUM] ✓ Stats updated for curriculum phrase');
                } else {
                  console.log('[CURRICULUM] Skipping stats update - not a curriculum phrase (ID:', blankPhrase.id, ')');
                }
              }
            } catch (error) {
              console.error('[CURRICULUM] ✗ Failed to update phrase stats:', error);
              console.error('[CURRICULUM] Error stack:', error.stack);
            }
            
            setInputPlaceholder('');
            setInputValues([]);
            setCurrentBlankIndex(0);
            setShowAnswer(false);
            setLoading(false);
            // After a short delay to show feedback, advance locally without refetching
            setTimeout(() => {
              setFeedback('');
              if (practiceMode === 1) {
                const ok = selectNextCurriculumPhrase();
                if (!ok) {
                  // No more local phrases; stay in session without changing total
                  setUsingVariations(true);
                }
              } else if (practiceMode === 2) {
                const ok = selectNextVerbPracticePhrase();
                if (!ok) {
                  // Regenerate session
                  (async () => {
                    const session = [];
                    for (let i = 0; i < SESSION_SIZE; i++) {
                      const phrase = await generateVerbPracticeSentence();
                      if (phrase) session.push(phrase);
                    }
                    if (session.length > 0) {
                      setVerbPracticeSession(session);
                      setUsedPhraseIds([]);
                      setCurrentPhrase(session[0]);
                      const words = session[0].korean_text.trim().split(' ').filter(w => w);
                      const desired = Math.max(1, Math.min(3, Number(numBlanks) || 1));
                      const candidates = getCandidateBlankIndices(words, null);
                      let pool = candidates.length >= desired ? [...candidates] : words.map((_, i) => i);
                      const chosen = [];
                      while (chosen.length < desired && pool.length > 0) {
                        const idx = Math.floor(Math.random() * pool.length);
                        chosen.push(pool[idx]);
                        pool.splice(idx, 1);
                      }
                      setRandomBlankIndices(chosen.sort((a, b) => a - b));
                      setInputValues(new Array(chosen.length).fill(''));
                      setCurrentBlankIndex(0);
                    }
                  })();
                }
              } else if (practiceMode === 3) {
                const ok = selectNextConversationPhrase();
                if (!ok) {
                  // Rebuild session
                  if (Array.isArray(savedConversations) && savedConversations.length > 0) {
                    const session = [];
                    let convIdx = 0;
                    let sentIdx = 0;
                    while (session.length < SESSION_SIZE && convIdx < savedConversations.length) {
                      const conv = savedConversations[convIdx];
                      if (Array.isArray(conv.items) && conv.items.length > 0) {
                        const sent = conv.items[sentIdx % conv.items.length];
                        if (sent) {
                          session.push({
                            korean_text: String(sent.korean || ''),
                            english_text: String(sent.english || ''),
                            id: `conv-${conv.id}-${sentIdx % conv.items.length}`
                          });
                        }
                        sentIdx++;
                        if (sentIdx >= conv.items.length) {
                          convIdx++;
                          sentIdx = 0;
                        }
                      } else {
                        convIdx++;
                      }
                    }
                    if (session.length > 0) {
                      setConversationSession(session);
                      setUsedPhraseIds([]);
                      setCurrentPhrase(session[0]);
                      const words = session[0].korean_text.trim().split(' ').filter(w => w);
                      const desired = Math.max(1, Math.min(3, Number(numBlanks) || 1));
                      const candidates = getCandidateBlankIndices(words, null);
                      let pool = candidates.length >= desired ? [...candidates] : words.map((_, i) => i);
                      const chosen = [];
                      while (chosen.length < desired && pool.length > 0) {
                        const idx = Math.floor(Math.random() * pool.length);
                        chosen.push(pool[idx]);
                        pool.splice(idx, 1);
                      }
                      setRandomBlankIndices(chosen.sort((a, b) => a - b));
                      setInputValues(new Array(chosen.length).fill(''));
                      setCurrentBlankIndex(0);
                    }
                  }
                }
              }
            }, 800);
          };
          
          // Reconstruct full sentence for speaking
          const words = blankPhrase.korean.split(' ');
          let wordIdx = 0;
          const fullSentence = words.map(w => {
            if (w === '[BLANK]') {
              const answer = blankPhrase.blanks[wordIdx] || '';
              wordIdx++;
              return answer;
            }
            return w;
          }).join(' ');
          
          speakText(fullSentence, proceedToNext);
        } else {
          // Move to next blank
          if (blankIndex < blankPhrase.blanks.length - 1) {
            setCurrentBlankIndex(blankIndex + 1);
            setFeedback('Correct! Continue...');
          } else {
            setFeedback('All blanks filled! Check your answers.');
          }
        }
      } else {
        setFeedback('Incorrect. Try again.');
        const newInputValues = [...inputValues];
        newInputValues[blankIndex] = '';
        setInputValues(newInputValues);
        setInputPlaceholder(currentBlank);
        
        // Update stats on incorrect (only for actual curriculum phrases, not variations)
        try {
          const isGenerated = currentPhrase && (String(currentPhrase.id).startsWith('variation-') || String(currentPhrase.id).startsWith('remix-'));
          if (!sessionNoTrack && !isGenerated && blankPhrase.id && String(blankPhrase.id) && !String(blankPhrase.id).startsWith('variation-')) {
            await api.updateCurriculumPhraseStats(blankPhrase.id, false);
          }
        } catch (error) {
          console.error('Failed to update phrase stats:', error);
        }
      }
    }
  }, [inputValues, blankPhrase, speakText, fetchRandomPhrase]);

  if (loading) {
    return (
      <div className="sentence-box">
        <div>Loading phrases...</div>
        <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
          If this takes too long, the backend server may not be running. Check the console for errors.
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sentence-box">
        <div className="error-message" style={{ padding: '12px', background: '#fee', border: '1px solid #fcc', borderRadius: 4, color: '#c33', marginBottom: 12 }}>
          <strong>Error:</strong> {error}
          {(error.includes('Network error') || error.includes('CONNECTION_REFUSED') || error.includes('Unable to connect')) ? (
            <div style={{ marginTop: 8, fontSize: 12 }}>
              <strong>Tip:</strong> Make sure the backend server is running. Try running: <code style={{ background: '#fdd', padding: '2px 4px', borderRadius: 2 }}>npm run start-server-dev</code>
            </div>
          ) : null}
        </div>
        <button onClick={fetchRandomPhrase} className="generate-button" style={{ marginTop: 12 }}>
          Try Again
        </button>
      </div>
    );
  }

  if (!currentPhrase || !blankPhrase) {
    return <div className="sentence-box">No phrases available.</div>;
  }

  // Split Korean sentence by [BLANK] and create input fields
  const koreanParts = blankPhrase.korean.split('[BLANK]');
  const blankCount = blankPhrase.blanks?.length || 0;

  return (
    <div className="sentence-box">
      {/* Progress box moved to bottom */}
      <p className="korean-sentence">
        {koreanParts.map((part, idx) => (
          <React.Fragment key={idx}>
            {part}
            {idx < blankCount && (
              <input
                type="text"
                className="fill-in-blank-input"
                value={showAnswer ? (blankPhrase.correct_answers[idx] || blankPhrase.blanks[idx] || '') : (inputValues[idx] || '')}
                onChange={(e) => {
                  if (!showAnswer) {
                    handleInputChange(idx, e.target.value);
                  }
                }}
                onKeyDown={(e) => {
                  if (!showAnswer) {
                    handleKeyDown(e, idx);
                  }
                }}
                placeholder={idx === currentBlankIndex ? inputPlaceholder || '' : ''}
                autoFocus={idx === currentBlankIndex && !showAnswer}
                disabled={showAnswer}
                style={{ 
                  width: `${Math.max((blankPhrase.blanks[idx]?.length || 3) * 1.5, 3)}em`,
                  borderColor: inputValues[idx] && idx === currentBlankIndex ? '#3498db' : undefined,
                  backgroundColor: showAnswer ? '#e8f5e9' : undefined,
                  cursor: showAnswer ? 'not-allowed' : undefined
                }}
              />
            )}
          </React.Fragment>
        ))}
      </p>
      <p className="translation" style={{ marginTop: 8, textAlign: 'center' }}>{blankPhrase.translation}</p>
      {feedback && <p className="feedback">{feedback}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'center', alignItems: 'center' }}>
        <button 
          type="button"
          onClick={() => setShowAnswer(!showAnswer)}
          className="regenerate-button"
        >
          {showAnswer ? 'Hide Answer' : 'Show Answer'}
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
      <div className="sentence-box" style={{ textAlign: 'left', marginTop: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Explanation:</h3>
          <button
            type="button"
            className="regenerate-button"
            onClick={() => { setExplanationText(''); setExplanationPhraseId(null); fetchExplanation(); }}
            title="Explain the current sentence"
          >
            Explain
          </button>
        </div>
        <div style={{ marginTop: 8 }}>
          {isLoadingExplanation ? (
            <p style={{ margin: '4px 0', color: '#6b7280' }}>Loading explanation...</p>
          ) : explanationText ? (
            <div 
              style={{ lineHeight: '1.6' }}
              dangerouslySetInnerHTML={{ __html: mdToHtml(explanationText) }}
            />
          ) : (
            <p style={{ margin: '4px 0', color: '#6b7280' }}>No explanation yet.</p>
          )}
        </div>
      </div>
      {usingVariations && (
        <div style={{ marginTop: 8, padding: '12px', background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: 8 }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <p style={{ fontSize: 12, color: '#666', fontStyle: 'italic', margin: 0 }}>
                AI-generated variation (will be added to curriculum on completion)
              </p>
              <span style={{ fontSize: 12, color: '#1976d2', fontWeight: 600 }}>
                {allPhrases.length > 0 ? `${usedPhraseIds.length} / ${allPhrases.length} phrases completed` : '0 / 0 phrases completed'}
              </span>
            </div>
            {allPhrases.length > 0 && (
              <div style={{ width: '100%', height: 8, background: '#fff', borderRadius: 4, overflow: 'hidden', marginTop: 8 }}>
                <div 
                  style={{ 
                    width: `${(usedPhraseIds.length / allPhrases.length) * 100}%`, 
                    height: '100%', 
                    background: '#4caf50',
                    transition: 'width 0.3s ease'
                  }} 
                />
              </div>
            )}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'center' }}>
        <button type="button" className="regenerate-button" onClick={handleRemixSentence}>
          Remix: New Sentence (no tracking)
        </button>
        <button type="button" className="regenerate-button" onClick={handleAddCurrentToCurriculum}>
          Add to Curriculum
        </button>
        {sessionNoTrack && (
          <span style={{ alignSelf: 'center', fontSize: 12, color: '#6b7280' }}>New sentence mode active — progress not tracked</span>
        )}
      </div>
      {currentPhrase.times_correct > 0 && currentPhrase.id && String(currentPhrase.id) && !String(currentPhrase.id).startsWith('variation-') && (
        <p className="correct-count">Correct answers: {currentPhrase.times_correct}</p>
      )}

      {((practiceMode === 1 && (allPhrases.length > 0 || (sessionPhrases && sessionPhrases.length > 0))) ||
        (practiceMode === 2 && verbPracticeSession.length > 0) ||
        (practiceMode === 3 && conversationSession.length > 0)) && (
        <div style={{ marginTop: 16, padding: '10px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 6 }}>
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            {practiceMode === 1 && (
              <h2 style={{ margin: 0 }}>
                Set {Math.min(sessionPage + 1, Math.max(1, Math.ceil((allPhrases.length || 0) / SESSION_SIZE)))} / {Math.max(1, Math.ceil((allPhrases.length || 0) / SESSION_SIZE))}
              </h2>
            )}
            {(practiceMode === 2 || practiceMode === 3) && (
              <h2 style={{ margin: 0 }}>
                {practiceMode === 2 ? 'Verb Practice' : 'Conversation'} Session
              </h2>
            )}
            <h3 style={{ margin: '4px 0 0 0', color: '#6b7280', fontWeight: 600 }}>
              {activeUsed} / {activeTotal} phrases (session)
            </h3>
          </div>
          {practiceMode === 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, margin: '6px 0 10px' }}>
              <button
                type="button"
                className="regenerate-button"
                onClick={() => setSessionPage((p) => Math.max(0, p - 1))}
                disabled={sessionPage <= 0}
                title="Previous 5-phrase set"
                style={{ padding: '6px 14px' }}
              >
                Prev 5
              </button>
              <button
                  type="button"
                  className="regenerate-button"
                  onClick={() => setSessionPage((p) => {
                    const totalSets = Math.max(1, Math.ceil((allPhrases.length || 0) / SESSION_SIZE));
                    return Math.min(totalSets - 1, p + 1);
                  })}
                  disabled={sessionPage >= Math.max(1, Math.ceil((allPhrases.length || 0) / SESSION_SIZE)) - 1}
                  title="Next 5-phrase set"
                  style={{ padding: '6px 14px' }}
                >
                  Next 5
                </button>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
            <button
              type="button"
              className="regenerate-button"
              onClick={() => setShowSetDialog(v => !v)}
              title={showSetDialog ? 'Hide sentences in this set' : 'Show sentences in this set'}
              style={{ padding: '6px 14px' }}
            >
              {showSetDialog ? 'Hide Set' : 'Show Set'}
            </button>
          </div>
          {showSetDialog && (
            <div style={{ marginTop: 6, padding: '10px', background: '#ffffff', border: '1px solid #ddd', borderRadius: 8 }}>
              <h3 style={{ marginTop: 0, marginBottom: 8 }}>Sentences in this set</h3>
              {Array.isArray(activePhrases) && activePhrases.length > 0 ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  {activePhrases.map((p, i) => (
                    <div key={p.id || i} style={{ border: '1px solid #eee', borderRadius: 6, padding: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        <span style={{ color: '#999', fontSize: 12 }}>{i + 1}.</span>
                        <div className="ko-text" style={{ fontWeight: 700 }}>{p.korean_text}</div>
                      </div>
                      <div style={{ color: '#374151', marginTop: 4 }}>{p.english_text}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#6b7280', fontSize: 12 }}>No sentences in this set.</div>
              )}
            </div>
          )}
          <div style={{ width: '100%', height: 12, background: '#e0e0e0', borderRadius: 6, overflow: 'hidden' }}>
            <div 
              style={{ 
                width: `${progressPercentage}%`, 
                height: '100%', 
                background: progressPercentage === 100 ? '#4caf50' : '#2196f3',
                transition: 'width 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }} 
            >
              {progressPercentage > 15 && (
                <span style={{ fontSize: 10, color: '#fff', fontWeight: 600 }}>
                  {Math.round(progressPercentage)}%
                </span>
              )}
            </div>
          </div>
          {progressPercentage === 100 && practiceMode === 1 && (
            <p style={{ fontSize: 11, color: '#4caf50', marginTop: 6, marginBottom: 0, textAlign: 'center' }}>
              ✓ All curriculum phrases completed! Now practicing with AI variations.
            </p>
          )}
          {progressPercentage === 100 && practiceMode === 2 && (
            <p style={{ fontSize: 11, color: '#4caf50', marginTop: 6, marginBottom: 0, textAlign: 'center' }}>
              ✓ All verb practice phrases completed! Session will regenerate.
            </p>
          )}
          {progressPercentage === 100 && practiceMode === 3 && (
            <p style={{ fontSize: 11, color: '#4caf50', marginTop: 6, marginBottom: 0, textAlign: 'center' }}>
              ✓ All conversation phrases completed! Session will regenerate.
            </p>
          )}
          <div style={{ marginTop: 8, display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ fontSize: 12, color: '#666', fontWeight: 600 }}>Blanks:</label>
              <select value={numBlanks} onChange={(e) => {
                const val = parseInt(e.target.value || '1', 10);
                setNumBlanks(val);
                try { localStorage.setItem('practice_numBlanks', String(val)); } catch (_) {}
              }} style={{ padding: 4, border: '1px solid #ddd', borderRadius: 4 }}>
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ fontSize: 12, color: '#666', fontWeight: 600 }}>Mode:</label>
              <select value={practiceMode} onChange={(e) => {
                const val = parseInt(e.target.value || '1', 10);
                setPracticeMode(val);
                try { localStorage.setItem('practice_mode', String(val)); } catch (_) {}
              }} style={{ padding: 4, border: '1px solid #ddd', borderRadius: 4 }}>
                <option value={1}>Curriculum</option>
                <option value={2}>Verb Practice</option>
                <option value={3}>Conversations</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PracticePage;

