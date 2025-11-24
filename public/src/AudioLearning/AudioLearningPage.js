import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import './AudioLearningPage.css';
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
import { generateConversationSet } from './conversationGenerator';
import { generateLevel3Audio, prepareLevel3AudioData } from './audioPattern';
import { playLearningMode } from './audioLearningMode';
import { playQuizModeHandsFree } from './audioQuizModeHandsFree';
import { playQuizModeRecording } from './audioQuizModeRecording';
import { useRecording } from './hooks/useRecording';
import { useConsoleErrors } from './hooks/useConsoleErrors';
import { useMediaSession } from './hooks/useMediaSession';
import { createPlayConversationAudio } from './audio/conversationAudio';
import SentenceDisplay from './components/SentenceDisplay';
import ConversationList from './components/ConversationList';
import WordSetManager from './components/WordSetManager';
import ConsoleErrors from './components/ConsoleErrors';
import NewConversationForm from './components/NewConversationForm';
import { generateQuizSentence } from './utils/quizSentenceGenerator';
import { createHandleStartQuizLoop } from './handlers/quizLoopHandler';
import { createHandlePlayCurrentConversation } from './handlers/playCurrentConversationHandler';
import { createHandleGenerateSet, createSaveGeneratedSet, createPlaySet } from './handlers/wordSetHandlers';
import {
  pickRandomPronoun,
  conjugateVerbSimple,
  applyPronounAndTenseIfVerb,
  hasFinalConsonant,
  pickRandomVerb,
  pickRandomNoun,
  pickRandomAdjective,
  englishPresent3rd,
  englishPast,
  buildSubjectAndVerbPair,
  buildPronounAndVerbPair,
  buildVerbWithDateSentence,
  buildNounAndAdjectiveSentence,
} from './utils/verbHelpers';
import {
  parseJsonObject,
  parseJsonArraySafe,
  pickRandom,
  getWordByWordPairs,
  getCurriculumSentence,
  generateLearningSentence,
  generateEnglishWordIndices,
} from './utils/sentenceGenerators';

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
  // Recording hook
  const {
    isMicRecording,
    recordedUrl,
    recordingError,
    recognizedText,
    recognizedRef,
    checkRecordingSupport,
    startMicRecording,
    stopMicRecording,
    playRecorded,
    startSpeechRecognition,
    stopSpeechRecognition,
    recorderRef,
    mediaStreamRef,
  } = useRecording();
  
  // Console error tracking for mobile debugging
  const { consoleErrors, setConsoleErrors, consoleErrorRef } = useConsoleErrors();
  const [showErrorPanel, setShowErrorPanel] = React.useState(false);
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
  const [currentConversationId, setCurrentConversationId] = React.useState(null); // ID of currently loaded conversation
  const [showAudioPatternDetails, setShowAudioPatternDetails] = React.useState(false); // Toggle for audio pattern breakdown
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
  // Playlist state
  const [playlist, setPlaylist] = React.useState([]); // Array of conversation objects
  const [playlistIndex, setPlaylistIndex] = React.useState(-1); // Current index in playlist (-1 = no playlist)
  const [isPlaylistMode, setIsPlaylistMode] = React.useState(true); // Always in playlist mode by default
  // Refs for playlist navigation functions to break circular dependency
  const playNextConversationRef = React.useRef(null);
  const playPreviousConversationRef = React.useRef(null);
  const playConversationAudioRef = React.useRef(null);
  
  // Save playlist to database (defined early so it can be used in navigation functions)
  const savePlaylist = React.useCallback(async (conversationIds, currentIndex = 0) => {
    try {
      const res = await fetch('/api/playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationIds, currentIndex })
      });
      if (!res.ok) {
        console.warn('Failed to save playlist');
      }
    } catch (_) {
      console.warn('Error saving playlist');
    }
  }, []);

  // Load playlist from database
  const loadPlaylist = React.useCallback(async () => {
    try {
      const res = await fetch('/api/playlist', { cache: 'no-store' });
      if (!res.ok) return null;
      const data = await res.json().catch(() => null);
      return data;
    } catch (_) {
      return null;
    }
  }, []);
  
  // Sentence generators - using extracted utilities (defined early for use in generateLevel3AudioForItems)
  const getWordByWordPairsMemo = React.useCallback(async (english, korean) => 
    getWordByWordPairs(api, english, korean), []);
  
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
  
  // Navigate to next conversation in playlist
  const playNextConversation = React.useCallback(async () => {
    console.log('[playNextConversation] Called:', { isPlaylistMode, playlistLength: playlist.length, playlistIndex });
    if (!isPlaylistMode || playlist.length === 0 || playlistIndex < 0) {
      console.log('[playNextConversation] Early return:', { isPlaylistMode, playlistLength: playlist.length, playlistIndex });
      return;
    }
    const nextIndex = (playlistIndex + 1) % playlist.length;
    setPlaylistIndex(nextIndex);
    // Save playlist index to database
    const conversationIds = playlist.map(c => c.id).filter(Boolean);
    if (conversationIds.length > 0) {
      await savePlaylist(conversationIds, nextIndex);
    }
    const nextConv = playlist[nextIndex];
    if (!nextConv) return;
    
    // Load and play the next conversation
    setGeneratedSentences(nextConv.items || []);
    setCurrentConversationId(nextConv.id || null);
    setCurrentConversationTitle(nextConv.title);
    if (nextConv.audioUrl) {
      setConversationAudioUrl(nextConv.audioUrl);
      // Stop current audio
      try {
        const audio = conversationAudioRef.current;
        if (audio) {
          audio.pause();
          audio.currentTime = 0;
        }
      } catch (_) {}
      // Play next conversation and update MediaSession
      if (playConversationAudioRef.current) {
        await playConversationAudioRef.current(false, nextConv.audioUrl, nextConv.title);
      }
    } else {
      // Generate Level 3 audio for next conversation
      setConversationAudioUrl('');
      try {
        const audioUrl = await generateLevel3AudioForItems(nextConv.items);
        if (audioUrl) {
          setConversationAudioUrl(audioUrl);
          // Update the saved conversation with the new audio URL
          const next = savedConversations.map(x => 
            x.id === nextConv.id ? { ...x, audioUrl } : x
          );
          persistConversations(next);
          if (playConversationAudioRef.current) {
            await playConversationAudioRef.current(false, audioUrl, nextConv.title);
          }
        }
      } catch (_) {}
    }
  }, [isPlaylistMode, playlist, playlistIndex, generateLevel3AudioForItems, persistConversations, savedConversations, savePlaylist]);
  
  // Update ref after function is defined
  React.useEffect(() => {
    playNextConversationRef.current = playNextConversation;
  }, [playNextConversation]);
  
  // Navigate to previous conversation in playlist
  const playPreviousConversation = React.useCallback(async () => {
    console.log('[playPreviousConversation] Called:', { isPlaylistMode, playlistLength: playlist.length, playlistIndex });
    if (!isPlaylistMode || playlist.length === 0 || playlistIndex < 0) {
      console.log('[playPreviousConversation] Early return:', { isPlaylistMode, playlistLength: playlist.length, playlistIndex });
      return;
    }
    const prevIndex = playlistIndex === 0 ? playlist.length - 1 : playlistIndex - 1;
    setPlaylistIndex(prevIndex);
    // Save playlist index to database
    const conversationIds = playlist.map(c => c.id).filter(Boolean);
    if (conversationIds.length > 0) {
      await savePlaylist(conversationIds, prevIndex);
    }
    const prevConv = playlist[prevIndex];
    if (!prevConv) return;
    
    // Load and play the previous conversation
    setGeneratedSentences(prevConv.items || []);
    setCurrentConversationId(prevConv.id || null);
    setCurrentConversationTitle(prevConv.title);
    if (prevConv.audioUrl) {
      setConversationAudioUrl(prevConv.audioUrl);
      // Stop current audio
      try {
        const audio = conversationAudioRef.current;
        if (audio) {
          audio.pause();
          audio.currentTime = 0;
        }
      } catch (_) {}
      // Play previous conversation and update MediaSession
      if (playConversationAudioRef.current) {
        await playConversationAudioRef.current(false, prevConv.audioUrl, prevConv.title);
      }
    } else {
      // Generate Level 3 audio for previous conversation
      setConversationAudioUrl('');
      try {
        const audioUrl = await generateLevel3AudioForItems(prevConv.items);
        if (audioUrl) {
          setConversationAudioUrl(audioUrl);
          // Update the saved conversation with the new audio URL
          const next = savedConversations.map(x => 
            x.id === prevConv.id ? { ...x, audioUrl } : x
          );
          persistConversations(next);
          if (playConversationAudioRef.current) {
            await playConversationAudioRef.current(false, audioUrl, prevConv.title);
          }
        }
      } catch (_) {}
    }
  }, [isPlaylistMode, playlist, playlistIndex, generateLevel3AudioForItems, persistConversations, savedConversations, savePlaylist]);
  
  // Update ref after function is defined
  React.useEffect(() => {
    playPreviousConversationRef.current = playPreviousConversation;
  }, [playPreviousConversation]);
  
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
      const normalized = list.map((c) => {
        const items = Array.isArray(c.items) ? c.items.map(item => {
          const wordPairs = Array.isArray(item.wordPairs) ? item.wordPairs.map(pair => {
            // Only include ko and en fields, explicitly exclude korean and english
            const ko = String(pair.ko || pair.korean || '').trim();
            const en = String(pair.en || pair.english || '').trim();
            return { ko, en };
          }).filter(p => p.ko && p.en) : [];
          // Debug: log if wordPairs are missing when loading
          if (wordPairs.length === 0 && item.korean && item.english) {
            console.warn('[fetchServerConversations] No wordPairs found for item:', { 
              korean: item.korean, 
              english: item.english,
              rawItem: item
            });
          }
          return {
            korean: String(item.korean || ''),
            english: String(item.english || ''),
            wordPairs,
            englishWordMapping: item.englishWordMapping || {}
          };
        }) : [];
        return {
        id: c.id,
        title: String(c.title || 'Untitled'),
          items,
        audioUrl: String(c.audio_url || c.audioUrl || '').trim() || null,
        createdAt: Date.parse(c.created_at || '') || Date.now()
        };
      });
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
            // Preserve wordPairs when loading from saved conversations
            const itemsWithWordPairs = items.map(item => ({
              korean: String(item.korean || ''),
              english: String(item.english || ''),
              wordPairs: Array.isArray(item.wordPairs) ? item.wordPairs.map(pair => ({
                ko: String(pair.ko || pair.korean || ''),
                en: String(pair.en || pair.english || '')
              })) : [],
              englishWordMapping: item.englishWordMapping || {}
            }));
            setGeneratedSentences(itemsWithWordPairs);
            setCurrentConversationId(convToLoad.id || null);
            
            // Auto-generate audio - always regenerate Level 3 if wordPairs exist to ensure word pairs are included
            const hasWordPairs = itemsWithWordPairs.every(item => Array.isArray(item.wordPairs) && item.wordPairs.length > 0);
            const isLevel3 = (Number(quizDifficulty) || 1) === 3;
            
            if (hasWordPairs && isLevel3) {
              // Always regenerate Level 3 audio with word pairs to ensure they're included
              (async () => {
                try {
                  const sentencesWithPairs = itemsWithWordPairs.map(item => ({
                    english: String(item.english || ''),
                    korean: String(item.korean || ''),
                    wordPairs: Array.isArray(item.wordPairs) ? item.wordPairs.map(pair => ({
                      ko: String(pair.ko || pair.korean || ''),
                      en: String(pair.en || pair.english || '')
                    })) : []
                  }));
                  const audioUrl = await generateLevel3Audio(sentencesWithPairs, Math.max(0, Number(quizDelaySec) || 0.5));
                  if (audioUrl) {
                    // Update the saved conversation with the new audio URL
                    const next = savedConversations.map(x => 
                      x.id === convToLoad.id ? { ...x, audioUrl } : x
                    );
                    persistConversations(next);
                    setConversationAudioUrl(audioUrl);
                  }
                } catch (_) {}
              })();
            } else if (convToLoad.audioUrl) {
              // Use existing Level 3 audio
              setConversationAudioUrl(convToLoad.audioUrl);
            } else {
              // Generate Level 3 audio if no audioUrl exists
              (async () => {
                try {
                  const audioUrl = await generateLevel3AudioForItems(items);
                  if (audioUrl) {
                    // Update the saved conversation with the new audio URL
                    const next = savedConversations.map(x => 
                      x.id === convToLoad.id ? { ...x, audioUrl } : x
                    );
                    persistConversations(next);
                    setConversationAudioUrl(audioUrl);
                  }
                } catch (_) {}
              })();
            }
          }
        }
      }
    } catch (_) {}
  }, [savedConversations, defaultConversationId, generateLevel3AudioForItems, generateLevel3Audio, quizDifficulty, quizDelaySec, persistConversations, setDefaultConversation]);

  // Auto-create and save playlist when conversations are available (always in playlist mode)
  React.useEffect(() => {
    if (savedConversations && savedConversations.length > 0 && playlist.length === 0) {
      // Check if playlist exists in database first
      (async () => {
        try {
          const playlistData = await loadPlaylist();
          if (!playlistData || !playlistData.conversationIds || playlistData.conversationIds.length === 0) {
            // No playlist in database, auto-create from all conversations
            const conversationIds = savedConversations.map(c => c.id).filter(Boolean);
            if (conversationIds.length > 0) {
              setPlaylist(savedConversations);
              setPlaylistIndex(0);
              setIsPlaylistMode(true);
              // Save to database
              await savePlaylist(conversationIds, 0);
            }
          }
        } catch (_) {}
      })();
    }
  }, [savedConversations, playlist.length, savePlaylist, loadPlaylist]);

  // Update playlist when savedConversations changes (sync playlist with current conversations)
  React.useEffect(() => {
    if (!isPlaylistMode) return;
    
    if (!savedConversations || savedConversations.length === 0) {
      // If no conversations, clear playlist
      setPlaylist([]);
      setPlaylistIndex(-1);
      return;
    }
    
    // Update playlist to match current savedConversations
    // Keep the current index if the conversation still exists, otherwise adjust
    (async () => {
      try {
        const conversationIds = savedConversations.map(c => c.id).filter(Boolean);
        if (conversationIds.length === 0) {
          setPlaylist([]);
          setPlaylistIndex(-1);
          return;
        }
        
        // Update playlist to include all current conversations
        setPlaylist(savedConversations);
        
        // Adjust playlist index if current conversation was deleted
        setPlaylistIndex(prevIndex => {
          let newIndex;
          if (prevIndex >= savedConversations.length) {
            newIndex = Math.max(0, savedConversations.length - 1);
          } else if (prevIndex >= 0 && prevIndex < savedConversations.length) {
            // Current index is still valid, keep it
            newIndex = prevIndex;
          } else {
            // Invalid index, reset to 0
            newIndex = 0;
          }
          
          // Save updated playlist to database
          savePlaylist(conversationIds, newIndex);
          return newIndex;
        });
      } catch (_) {}
    })();
  }, [savedConversations, isPlaylistMode, savePlaylist]);

  // Load playlist on mount (after conversations are loaded)
  React.useEffect(() => {
    if (!savedConversations || savedConversations.length === 0) return;
    
    (async () => {
      try {
        const playlistData = await loadPlaylist();
        if (playlistData && playlistData.conversationIds && playlistData.conversationIds.length > 0) {
          // Find conversations by IDs
          const playlistConversations = playlistData.conversationIds
            .map(id => savedConversations.find(c => String(c.id) === String(id)))
            .filter(Boolean);
          
          if (playlistConversations.length > 0) {
            setPlaylist(playlistConversations);
            setPlaylistIndex(Math.max(0, Math.min(playlistData.currentIndex || 0, playlistConversations.length - 1)));
            setIsPlaylistMode(true);
          }
        }
      } catch (_) {}
    })();
  }, [savedConversations, loadPlaylist]); // Run when conversations are loaded

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

  // Verb helpers - memoized callbacks using extracted utilities
  const pickRandomPronounMemo = React.useCallback(() => pickRandomPronoun(), []);
  const conjugateVerbSimpleMemo = React.useCallback((baseForm, tense) => conjugateVerbSimple(baseForm, tense), []);
  const applyPronounAndTenseIfVerbMemo = React.useCallback((wordObj) => 
    applyPronounAndTenseIfVerb(wordObj, pickRandomPronounMemo, conjugateVerbSimpleMemo), 
    [pickRandomPronounMemo, conjugateVerbSimpleMemo]
  );
  const hasFinalConsonantMemo = React.useCallback((k) => hasFinalConsonant(k), []);
  const pickRandomVerbMemo = React.useCallback((words) => pickRandomVerb(words), []);
  const pickRandomNounMemo = React.useCallback((words) => pickRandomNoun(words), []);
  const pickRandomAdjectiveMemo = React.useCallback((words) => pickRandomAdjective(words), []);
  const englishPresent3rdMemo = React.useCallback((base) => englishPresent3rd(base), []);
  const englishPastMemo = React.useCallback((base) => englishPast(base), []);
  const buildSubjectAndVerbPairMemo = React.useCallback((words) => 
    buildSubjectAndVerbPair(words, pickRandomPronounMemo, pickRandomNounMemo, pickRandomVerbMemo, hasFinalConsonantMemo, conjugateVerbSimpleMemo, englishPresent3rdMemo, englishPastMemo),
    [pickRandomPronounMemo, pickRandomNounMemo, pickRandomVerbMemo, hasFinalConsonantMemo, conjugateVerbSimpleMemo, englishPresent3rdMemo, englishPastMemo]
  );
  const buildPronounAndVerbPairMemo = React.useCallback((words) => 
    buildPronounAndVerbPair(words, pickRandomPronounMemo, pickRandomVerbMemo, conjugateVerbSimpleMemo, englishPresent3rdMemo, englishPastMemo),
    [pickRandomPronounMemo, pickRandomVerbMemo, conjugateVerbSimpleMemo, englishPresent3rdMemo, englishPastMemo]
  );
  const buildVerbWithDateSentenceMemo = React.useCallback((words) => 
    buildVerbWithDateSentence(words, pickRandomPronounMemo, pickRandomVerbMemo, conjugateVerbSimpleMemo, englishPresent3rdMemo, englishPastMemo),
    [pickRandomPronounMemo, pickRandomVerbMemo, conjugateVerbSimpleMemo, englishPresent3rdMemo, englishPastMemo]
  );
  const buildNounAndAdjectiveSentenceMemo = React.useCallback((words) => 
    buildNounAndAdjectiveSentence(words, pickRandomNounMemo, pickRandomAdjectiveMemo, hasFinalConsonantMemo, conjugateVerbSimpleMemo),
    [pickRandomNounMemo, pickRandomAdjectiveMemo, hasFinalConsonantMemo, conjugateVerbSimpleMemo]
  );

  const handleGenerateSet = React.useCallback(
    createHandleGenerateSet(api, generatorPrompt, generatedSetTitle, setGeneratorLoading, setGeneratedWords, setGeneratedSetTitle),
    [api, generatorPrompt, generatedSetTitle, setGeneratorLoading, setGeneratedWords, setGeneratedSetTitle]
  );

  const saveGeneratedSet = React.useCallback(
    createSaveGeneratedSet(generatedWords, generatedSetTitle, wordSets, persistSets, setShowGenerator, setGeneratedWords),
    [generatedWords, generatedSetTitle, wordSets, persistSets, setShowGenerator, setGeneratedWords]
  );

  const playSet = React.useCallback(
    createPlaySet(quizDelaySec, setIsQuizLooping, playingRef, pausedRef, quizLoopRef, setCurrentSetWords, setLoopGenerating, setLoopProgress),
    [quizDelaySec, setIsQuizLooping, playingRef, pausedRef, quizLoopRef, setCurrentSetWords, setLoopGenerating, setLoopProgress]
  );

  // Initialize MediaSession and handle autoplay
  useMediaSession(playingRef, quizLoopRef);

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

  // Sentence generators - using extracted utilities (getWordByWordPairsMemo moved earlier)
  const getCurriculumSentenceMemo = React.useCallback(async () => 
    getCurriculumSentence(api), []);
  const generateLearningSentenceMemo = React.useCallback(async () => 
    generateLearningSentence(api, ensureLearningWords, pickRandom), [ensureLearningWords]);
  const generateEnglishWordIndicesMemo = React.useCallback(async (korean, english, blankWords) => 
    generateEnglishWordIndices(api, korean, english, blankWords), []);

  // Generate a coherent 5-turn conversation (independent of learning words)
  // Now using the shared conversationGenerator module
  const generateConversationSetLocal = React.useCallback(async (contextKorean = '', contextEnglish = '') => {
    return await generateConversationSet(contextKorean, contextEnglish);
  }, []);


  // Note: getWordByWordPairs is imported from sentenceGenerators.js and used via getWordByWordPairsMemo
  // The imported version includes validation to ensure ko/en fields are correctly identified

  const generateLearningSentence = React.useCallback(async () => {
    const words = await ensureLearningWords();
    if (!words || words.length === 0) return null;
    const subset = pickRandom(words, Math.max(3, Math.min(7, Math.floor(Math.random()*6)+3)));
    const examples = subset.map(w => `${w.korean} (${w.english})`).join(', ');
    const prompt = `Using ONLY some of these Korean learning words: ${examples}\nCreate ONE natural, simple Korean sentence (<= 10 words) that is grammatically correct.\nReturn ONLY JSON: {"korean":"...","english":"...","tokens":[{"ko":"...","en":"..."}, ...]}\ntokens should list the key words in the sentence (3-8 items) with their English.

`;
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
  // IMPORTANT: Save the complete sentence objects including wordPairs so they can be restored exactly
  const saveConversationSet = React.useCallback((itemsToSaveOverride = null, audioUrlOverride = null) => {
    try {
      const items = itemsToSaveOverride || (Array.isArray(generatedSentences) ? generatedSentences.slice(0, 5) : []);
      if (!items || items.length === 0) return;
      
      // Ensure we save the complete objects with wordPairs preserved
      const itemsToSave = items.map(item => {
        const wordPairs = Array.isArray(item.wordPairs) ? item.wordPairs.map(pair => {
          // Only include ko and en fields, explicitly exclude korean and english
          const ko = String(pair.ko || pair.korean || '').trim();
          const en = String(pair.en || pair.english || '').trim();
          return { ko, en };
        }).filter(p => p.ko && p.en) : [];
        // Debug: log if wordPairs are missing
        if (wordPairs.length === 0 && item.korean && item.english) {
          console.warn('[saveConversationSet] No wordPairs found for item:', { korean: item.korean, english: item.english, hasWordPairs: !!item.wordPairs });
        }
        return {
        korean: String(item.korean || ''),
        english: String(item.english || ''),
          wordPairs,
        englishWordMapping: item.englishWordMapping || {}
        };
      });
      
      const id = Date.now().toString(36);
      const ts = new Date();
      const title = `Conversation ${ts.getFullYear()}-${String(ts.getMonth()+1).padStart(2,'0')}-${String(ts.getDate()).padStart(2,'0')} ${String(ts.getHours()).padStart(2,'0')}:${String(ts.getMinutes()).padStart(2,'0')}`;
      // Include audio URL if available (use override if provided, otherwise use state)
      const entry = { 
        id, 
        title, 
        items: itemsToSave, // Save with wordPairs preserved
        audioUrl: audioUrlOverride || conversationAudioUrl || null,
        createdAt: Date.now() 
      };
      persistConversations([entry, ...savedConversations]);
      // Automatically set as default conversation
      setDefaultConversation(id);
      // Save to server (shared DB) and refresh list
      // Ensure wordPairs are included when saving to server
      (async () => {
        try {
          // Verify wordPairs are present before sending
          const hasWordPairs = itemsToSave.some(item => Array.isArray(item.wordPairs) && item.wordPairs.length > 0);
          console.log('[saveConversationSet] Saving to server:', { 
            itemCount: itemsToSave.length, 
            hasWordPairs,
            sampleItem: itemsToSave[0] ? {
              korean: itemsToSave[0].korean,
              english: itemsToSave[0].english,
              wordPairsCount: itemsToSave[0].wordPairs?.length || 0
            } : null
          });
          const serverId = await postServerConversation(title, itemsToSave);
          if (serverId) {
            await fetchServerConversations();
          }
        } catch (err) {
          console.error('Error saving conversation to server:', err);
        }
      })();
    } catch (_) {}
  }, [generatedSentences, conversationAudioUrl, savedConversations, persistConversations, postServerConversation, fetchServerConversations, setDefaultConversation]);

  const [currentConversationTitle, setCurrentConversationTitle] = React.useState('');
  
  // Create conversation audio playback function using extracted utility
  const playConversationAudio = React.useCallback(
    createPlayConversationAudio({
      conversationAudioUrl,
      conversationAudioRef,
      searchParams,
      isPlaylistMode,
      playlist,
      playlistIndex,
      currentConversationTitle,
      setCurrentConversationTitle,
      setAutoplayBlocked,
      autoStartedRef,
      playNextConversationRef,
      playPreviousConversationRef,
      pausedRef,
      setIsPaused,
      playingRef,
      quizLoopRef,
    }),
    [conversationAudioUrl, searchParams, isPlaylistMode, playlist, playlistIndex, currentConversationTitle]
  );
  
  // Update ref after playConversationAudio is defined
  React.useEffect(() => {
    playConversationAudioRef.current = playConversationAudio;
  }, [playConversationAudio]);

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


  // Generate a new conversation and load into UI
  const handleGenerateNewConversation = React.useCallback(async () => {
    try {
      const batch = await generateConversationSetLocal(conversationContextKorean, conversationContextEnglish);
      if (Array.isArray(batch) && batch.length > 0) {
        // Generate English word indices and word pairs for each sentence (following audio pattern)
        const batchWithData = await Promise.all(batch.map(async (sent) => {
          try {
            const [mapping, wordPairs] = await Promise.all([
              generateEnglishWordIndicesMemo(sent.korean, sent.english),
              getWordByWordPairsMemo(sent.english, sent.korean)
            ]);
            return {
              ...sent,
              englishWordMapping: mapping, // Store mapping for use in PracticePage
              wordPairs: Array.isArray(wordPairs) ? wordPairs : [] // Store word pairs for audio pattern display
            };
          } catch (_) {
            // Fallback: try to get word pairs separately if combined fails
            try {
              const mapping = await generateEnglishWordIndicesMemo(sent.korean, sent.english);
              const wordPairs = await getWordByWordPairsMemo(sent.english, sent.korean);
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
        
        // Automatically generate Level 3 audio FIRST if quiz difficulty is Level 3
        // This ensures we save the conversation WITH the audioUrl, preventing regular conversation audio generation
        const isLevel3 = (Number(quizDifficulty) || 1) === 3;
        let generatedAudioUrl = null;
        
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
              generatedAudioUrl = await generateLevel3Audio(
                sentencesWithPairs,
                Math.max(0, Number(quizDelaySec) || 0.5)
              );
              
              setLevel3AudioProgress(100);
              
              if (generatedAudioUrl) {
                setConversationAudioUrl(generatedAudioUrl);
                console.log('[handleGenerateNewConversation] Generated Level 3 audio:', generatedAudioUrl);
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
        
        // Save the conversation AFTER generating Level 3 audio (if applicable)
        // Pass the audioUrl directly to saveConversationSet to ensure it's saved correctly
        // This prevents the auto-load useEffect from generating regular conversation audio
        saveConversationSet(batchWithData, generatedAudioUrl || null);
      }
    } catch (_) {}
  }, [conversationContextKorean, conversationContextEnglish, generateConversationSetLocal, generateEnglishWordIndices, getWordByWordPairs, saveConversationSet, quizDifficulty, quizDelaySec, setIsGeneratingLevel3Audio, setLevel3AudioProgress, generateLevel3Audio]);

  // Play currently loaded conversation using single MP3 (do not generate a new conversation)
  const handlePlayCurrentConversation = React.useCallback(
    createHandlePlayCurrentConversation({
      setIsQuizLooping,
      playingRef,
      pausedRef,
      setIsPaused,
      quizLoopRef,
      requestWakeLock,
      startKeepAlive,
      releaseWakeLock,
      stopKeepAlive,
      updateMediaSession,
      generatedSentences,
      quizDifficulty,
      setIsGeneratingLevel3Audio,
      setLevel3AudioProgress,
      getWordByWordPairsMemo,
      generateLevel3Audio,
      quizDelaySec,
      setConversationAudioUrl,
      savedConversations,
      isPlaylistMode,
      playlist,
      playlistIndex,
      currentConversationTitle,
      setCurrentConversationTitle,
      playConversationAudio,
      waitWhilePaused,
      conversationAudioUrl,
      generateLevel3AudioForItems,
    }),
    [generatedSentences, conversationAudioUrl, generateLevel3AudioForItems, playConversationAudio, quizDifficulty, quizDelaySec, getWordByWordPairsMemo, waitWhilePaused, savedConversations, isPlaylistMode, playlist, playlistIndex, currentConversationTitle]
  );

  const generateQuizSentenceMemo = React.useCallback(async (difficulty) => 
    generateQuizSentence(
      difficulty,
      api,
      ensureLearningWords,
      level2Words,
      buildVerbWithDateSentenceMemo,
      buildPronounAndVerbPairMemo,
      buildNounAndAdjectiveSentenceMemo
    ),
    [api, ensureLearningWords, level2Words, buildVerbWithDateSentenceMemo, buildPronounAndVerbPairMemo, buildNounAndAdjectiveSentenceMemo]
  );

  const handlePlayLearningMode = React.useCallback(async () => {
    await playLearningMode({
      ensureLearningWords,
      generateLearningSentence: generateLearningSentenceMemo,
      waitWhilePaused,
      speak,
      updateMediaSession,
      requestWakeLock,
      releaseWakeLock,
      startKeepAlive,
      stopKeepAlive,
      setIsLearningPlaying,
      pausedRef,
      playingRef,
      quizLoopRef
    });
  }, [ensureLearningWords, generateLearningSentenceMemo, waitWhilePaused, speak, updateMediaSession, requestWakeLock, releaseWakeLock, startKeepAlive, stopKeepAlive]);

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


  const handleStartQuizLoop = React.useCallback(
    createHandleStartQuizLoop({
      setIsQuizLooping,
      playingRef,
      pausedRef,
      setIsPaused,
      quizLoopRef,
      requestWakeLock,
      startKeepAlive,
      releaseWakeLock,
      stopKeepAlive,
      quizDifficulty,
      quizMode,
      conversationAudioRef,
      isPlaylistMode,
      playlist,
      playNextConversationRef,
      playPreviousConversationRef,
      ensureLearningWords,
      setIndex,
      applyPronounAndTenseIfVerbMemo,
      setCurrentSetWords,
      setLoopGenerating,
      setLoopProgress,
      generateAndPlayLoop,
      quizDelaySec,
      waitWhilePaused,
      generateQuizSentenceMemo,
      setGeneratedSentences,
      speak,
      generateConversationSetLocal,
      setIsGeneratingLevel3Audio,
      setLevel3AudioProgress,
      getWordByWordPairsMemo,
      setConversationAudioUrl,
      savedConversations,
      playlistIndex,
      currentConversationTitle,
      setCurrentConversationTitle,
      playConversationAudio,
      quizRecordDurationSec,
      startMicRecording,
      stopMicRecording,
      playRecorded,
      startSpeechRecognition,
      stopSpeechRecognition,
      recognizedRef,
      recognizedText,
      pushHistory,
      setCurrentQuizWord,
      setCurrentQuizSentence,
    }),
    [ensureLearningWords, quizMode, startMicRecording, stopMicRecording, playRecorded, quizDelaySec, quizRecordDurationSec, startSpeechRecognition, stopSpeechRecognition, recognizedText, waitWhilePaused, setIndex, applyPronounAndTenseIfVerbMemo, getWordByWordPairsMemo, generateConversationSetLocal, isPlaylistMode, playlist, playlistIndex, currentConversationTitle, playConversationAudio, generateQuizSentenceMemo]
  );

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
        // Find conversation title from saved conversations
        const currentConv = savedConversations.find(c => c.audioUrl === conversationAudioUrl) || 
                           (isPlaylistMode && playlistIndex >= 0 && playlistIndex < playlist.length ? playlist[playlistIndex] : null);
        const convTitle = currentConv ? currentConv.title : (currentConversationTitle || 'Conversation Audio');
        setCurrentConversationTitle(convTitle);
        await playConversationAudio(true, conversationAudioUrl, convTitle);
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
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  className="audio-btn"
                  onClick={() => {
                    console.log('[Playlist] Previous button clicked:', { isPlaylistMode, playlistLength: playlist.length, playlistIndex });
                    playPreviousConversation();
                  }}
                  title="Previous Conversation"
                  aria-label="Previous Conversation"
                  disabled={!isPlaylistMode || playlist.length <= 1}
                  style={{ opacity: (!isPlaylistMode || playlist.length <= 1) ? 0.5 : 1, cursor: (!isPlaylistMode || playlist.length <= 1) ? 'not-allowed' : 'pointer' }}
                >
                  ⏮
                </button>
                <button
                  className="audio-btn"
                  onClick={async () => {
                    const level = Number(quizDifficulty) || 1;
                    const audio = conversationAudioRef.current;
                    
                    // If currently playing/looping, pause/resume it
                    if (isQuizLooping) {
                      if (isPaused) {
                        if (quizMode === 'hands-free' && level === 3 && audio) {
                          try { 
                            audio.play().catch(_ => {});
                          } catch (_) {}
                          pausedRef.current = false;
                          setIsPaused(false);
                        } else {
                          resumeLoop();
                          pausedRef.current = false;
                          setIsPaused(false);
                        }
                      } else {
                        if (quizMode === 'hands-free' && level === 3 && audio) {
                          try { 
                            audio.pause(); 
                          } catch (_) {}
                          pausedRef.current = true;
                          setIsPaused(true);
                        } else {
                          pauseLoop();
                          pausedRef.current = true;
                          setIsPaused(true);
                        }
                      }
                      return;
                    }
                    
                    // Check if audio exists and can be played/paused
                    const hasAudio = (quizMode === 'hands-free' && level === 3 && audio && conversationAudioUrl) ||
                                   (quizMode !== 'hands-free' || level !== 3);
                    
                    // If audio exists and we're paused, resume
                    if (hasAudio && isPaused) {
                    if (quizMode === 'hands-free' && level === 3 && audio) {
                        try { 
                          audio.play().catch(_ => {});
                        } catch (_) {}
                        pausedRef.current = false;
                        setIsPaused(false);
                      } else {
                        resumeLoop();
                        pausedRef.current = false;
                        setIsPaused(false);
                      }
                      return;
                    }
                    
                    // If audio exists and is playing, pause it
                    if (hasAudio && !isPaused && (audio && !audio.paused || !audio)) {
                      if (quizMode === 'hands-free' && level === 3 && audio) {
                        try { 
                          audio.pause(); 
                        } catch (_) {}
                        pausedRef.current = true;
                        setIsPaused(true);
                      } else {
                        pauseLoop();
                        pausedRef.current = true;
                        setIsPaused(true);
                      }
                      return;
                    }
                    
                    // Otherwise, start/generate audio
                    if (!isLoadingLearningWords) {
                      // Auto-create playlist if it doesn't exist and we have conversations (always in playlist mode)
                      if (playlist.length === 0 && savedConversations && savedConversations.length > 0) {
                        const conversationIds = savedConversations.map(c => c.id).filter(Boolean);
                        if (conversationIds.length > 0) {
                          setPlaylist(savedConversations);
                          setPlaylistIndex(0);
                          setIsPlaylistMode(true);
                          await savePlaylist(conversationIds, 0);
                        }
                      }
                      
                      // For Level 3, always use handlePlayCurrentConversation which checks for wordPairs
                      // This ensures wordPairs are included in the audio generation
                      if (quizMode === 'hands-free' && level === 3) {
                        handlePlayCurrentConversation();
                      } else {
                        handleStartQuizLoop();
                      }
                    }
                  }}
                  title={
                    isQuizLooping 
                      ? (isPaused ? 'Resume' : 'Pause')
                      : (isPaused 
                          ? 'Resume' 
                          : ((conversationAudioUrl && (Number(quizDifficulty) || 1) === 3 && conversationAudioRef.current && !conversationAudioRef.current.paused) || (!conversationAudioUrl && (Number(quizDifficulty) || 1) !== 3))
                            ? 'Pause' 
                            : 'Start')
                  }
                  aria-label={isQuizLooping ? (isPaused ? 'Resume' : 'Pause') : (isPaused ? 'Resume' : 'Start/Play')}
                >
                  {isQuizLooping 
                    ? (isPaused ? '▶️' : '⏸')
                    : (isPaused 
                        ? '▶️' 
                        : ((conversationAudioUrl && (Number(quizDifficulty) || 1) === 3 && conversationAudioRef.current && !conversationAudioRef.current.paused) || (!conversationAudioUrl && (Number(quizDifficulty) || 1) !== 3))
                          ? '⏸' 
                          : '▶️')
                  }
                </button>
                <button
                  className="audio-btn"
                  onClick={() => {
                    console.log('[Playlist] Next button clicked:', { isPlaylistMode, playlistLength: playlist.length, playlistIndex });
                    playNextConversation();
                  }}
                  title="Next Conversation"
                  aria-label="Next Conversation"
                  disabled={!isPlaylistMode || playlist.length <= 1}
                  style={{ opacity: (!isPlaylistMode || playlist.length <= 1) ? 0.5 : 1, cursor: (!isPlaylistMode || playlist.length <= 1) ? 'not-allowed' : 'pointer' }}
                >
                  ⏭
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
                <SentenceDisplay
                  generatedSentences={generatedSentences}
                  currentConversationId={currentConversationId}
                  showAudioPatternDetails={showAudioPatternDetails}
                  setShowAudioPatternDetails={setShowAudioPatternDetails}
                  saveConversationSet={saveConversationSet}
                  savedConversations={savedConversations}
                  defaultConversationId={defaultConversationId}
                  setDefaultConversation={setDefaultConversation}
                  fetchServerConversations={fetchServerConversations}
                  persistConversations={persistConversations}
                  api={api}
                  setGeneratedSentences={setGeneratedSentences}
                  setCurrentConversationId={setCurrentConversationId}
                  setConversationAudioUrl={setConversationAudioUrl}
                  setCurrentConversationTitle={setCurrentConversationTitle}
                  isQuizLooping={isQuizLooping}
                  stopAll={stopAll}
                  conversationAudioRef={conversationAudioRef}
                />
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
          <NewConversationForm
            quizMode={quizMode}
            quizDifficulty={quizDifficulty}
            conversationContextKorean={conversationContextKorean}
            setConversationContextKorean={setConversationContextKorean}
            conversationContextEnglish={conversationContextEnglish}
            setConversationContextEnglish={setConversationContextEnglish}
            handleGenerateNewConversation={handleGenerateNewConversation}
          />
          <ConversationList
            savedConversations={savedConversations}
            defaultConversationId={defaultConversationId}
            setDefaultConversation={setDefaultConversation}
            fetchServerConversations={fetchServerConversations}
            setPlaylist={setPlaylist}
            setPlaylistIndex={setPlaylistIndex}
            setIsPlaylistMode={setIsPlaylistMode}
            isPlaylistMode={isPlaylistMode}
            playlist={playlist}
            playlistIndex={playlistIndex}
            savePlaylist={savePlaylist}
            quizDifficulty={quizDifficulty}
            quizDelaySec={quizDelaySec}
            generateLevel3Audio={generateLevel3Audio}
            generateLevel3AudioForItems={generateLevel3AudioForItems}
            setGeneratedSentences={setGeneratedSentences}
            setCurrentConversationId={setCurrentConversationId}
            setCurrentConversationTitle={setCurrentConversationTitle}
            setConversationAudioUrl={setConversationAudioUrl}
            playConversationAudioRef={playConversationAudioRef}
            persistConversations={persistConversations}
            conversationAudioUrl={conversationAudioUrl}
            api={api}
            playPreviousConversation={playPreviousConversation}
            playNextConversation={playNextConversation}
          />
          <WordSetManager
            showGenerator={showGenerator}
            setShowGenerator={setShowGenerator}
            generatorPrompt={generatorPrompt}
            setGeneratorPrompt={setGeneratorPrompt}
            generatorLoading={generatorLoading}
            setGeneratorLoading={setGeneratorLoading}
            generatedSetTitle={generatedSetTitle}
            setGeneratedSetTitle={setGeneratedSetTitle}
            generatedWords={generatedWords}
            setGeneratedWords={setGeneratedWords}
            handleGenerateSet={handleGenerateSet}
            saveGeneratedSet={saveGeneratedSet}
            playSet={playSet}
            showManageSets={showManageSets}
            setShowManageSets={setShowManageSets}
            wordSets={wordSets}
            persistSets={persistSets}
          />
          <ConsoleErrors
            consoleErrors={consoleErrors}
            showErrorPanel={showErrorPanel}
            setShowErrorPanel={setShowErrorPanel}
            consoleErrorRef={consoleErrorRef}
            setConsoleErrors={setConsoleErrors}
          />
                </div>
              </div>
            </div>
  );
}

export default AudioLearningPage;

