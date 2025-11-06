import React from 'react';
import { api } from './api';
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

// Use speakToAudio for background playback support (HTML5 Audio + MediaSession)
const speak = speakToAudio;

function LearningModesPage() {
  const [learningWords, setLearningWords] = React.useState(null);
  const [isLoadingLearningWords, setIsLoadingLearningWords] = React.useState(false);
  const playingRef = React.useRef(false);
  const pausedRef = React.useRef(false);

  // Learning Mode state
  const [isLearningPlaying, setIsLearningPlaying] = React.useState(false);

  // Quiz mode state (seconds, decimals allowed)
  const [isQuizLooping, setIsQuizLooping] = React.useState(false);
  const quizLoopRef = React.useRef(false);
  // Quiz mode: 'hands-free' (no recording) or 'recording' (with recording and playback)
  const [quizMode, setQuizMode] = React.useState('hands-free');
  const [isMicRecording, setIsMicRecording] = React.useState(false);
  const recorderRef = React.useRef(null);
  const mediaStreamRef = React.useRef(null);
  const recordedChunksRef = React.useRef([]);
  const [recordedUrl, setRecordedUrl] = React.useState('');
  const [currentQuizWord, setCurrentQuizWord] = React.useState(null);
  const [currentQuizSentence, setCurrentQuizSentence] = React.useState(null);
  const [quizDelaySec, setQuizDelaySec] = React.useState(2.0);
  const [quizRecordDurationSec, setQuizRecordDurationSec] = React.useState(2.0);
  const [quizDifficulty, setQuizDifficulty] = React.useState(1);
  const recognitionRef = React.useRef(null);
  const recognizedRef = React.useRef('');
  const [recognizedText, setRecognizedText] = React.useState('');
  const [recordingError, setRecordingError] = React.useState('');

  // Loop/sets UI state
  const [currentSetWords, setCurrentSetWords] = React.useState([]); // words currently used in loop
  const [loopGenerating, setLoopGenerating] = React.useState(false);
  const [loopProgress, setLoopProgress] = React.useState(0);
  const [showConjugations, setShowConjugations] = React.useState(false);

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

  const parseJsonArray = (text) => {
    if (!text) return [];
    // Try to find a JSON array in the response
    const m = String(text).match(/\[[\s\S]*\]/);
    if (!m) return [];
    try { const arr = JSON.parse(m[0]); return Array.isArray(arr) ? arr : []; } catch (_) { return []; }
  };

  // Very simple conjugation hints for base-form verbs/adjectives (ends with '다')
  const buildConjugationHints = React.useCallback((ko) => {
    if (!ko || typeof ko !== 'string') return null;
    if (!ko.endsWith('다')) return null;
    const stem = ko.slice(0, -1 * '다'.length);
    // Heuristic for ㅏ/ㅗ bright vowels -> 아요/았어요 else 어요/었어요
    const bright = /[ㅏㅗ]$/.test(stem);
    const present = stem + (bright ? '아요' : '어요');
    const past = stem + (bright ? '았어요' : '었어요');
    return { present, past };
  }, []);

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

  React.useEffect(() => {
    const error = checkRecordingSupport();
    setRecordingError(error);
    
    // Initialize MediaSession on mount
    if ('mediaSession' in navigator) {
      updateMediaSession('Audio Learning', 'Korean Learning', false);
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
  }, [checkRecordingSupport]);

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

  const generateLearningSentence = React.useCallback(async () => {
    const words = await ensureLearningWords();
    if (!words || words.length === 0) return null;
    const subset = pickRandom(words, Math.max(3, Math.min(7, Math.floor(Math.random()*6)+3)));
    const examples = subset.map(w => `${w.korean} (${w.english})`).join(', ');
    const prompt = `Using ONLY some of these Korean learning words: ${examples}\nCreate ONE natural, simple Korean sentence (<= 10 words) that is grammatically correct.\nReturn ONLY JSON: {"korean":"...","english":"...","tokens":[{"ko":"...","en":"..."}, ...]}\ntokens should list the key words in the sentence (3-8 items) with their English.`;
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

  const generateQuizSentence = React.useCallback(async (difficulty) => {
    const words = await ensureLearningWords();
    if (!words || words.length === 0) return null;
    if (difficulty === 1) return null; // single word handled separately
    
    const subset = pickRandom(words, difficulty === 2 ? Math.max(2, Math.min(5, Math.floor(Math.random()*4)+2)) : Math.max(4, Math.min(8, Math.floor(Math.random()*5)+4)));
    const examples = subset.map(w => `${w.korean} (${w.english})`).join(', ');
    let prompt = '';
    if (difficulty === 2) {
      prompt = `Using ONLY some of these Korean learning words: ${examples}\nCreate ONE simple Korean sentence (3-6 words) that uses basic grammar rules.\nReturn ONLY JSON: {"korean":"...","english":"..."}`;
    } else {
      prompt = `Using ONLY some of these Korean learning words: ${examples}\nCreate ONE longer, more complex Korean sentence (7-12 words) with proper grammar, particles, and natural structure.\nReturn ONLY JSON: {"korean":"...","english":"..."}`;
    }
    try {
      const res = await api.chat(prompt);
      const data = await res.json();
      const obj = parseJsonObject(data && data.response || '');
      if (obj && obj.korean && obj.english) {
        return { korean: String(obj.korean), english: String(obj.english) };
      }
    } catch (_) {}
    // Fallback: naive sentence from subset words
    const kor = subset.map(w => w.korean).join(' ');
    const eng = subset.map(w => w.english).join(' ');
    return { korean: kor, english: eng };
  }, [ensureLearningWords]);

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
        updateMediaSession(s.korean, 'Korean', true);
        await waitWhilePaused(); if (!playingRef.current) break;
        await speak(s.korean, 'ko-KR', 1.0);
        if (!playingRef.current) break;
        updateMediaSession(s.english, 'English', true);
        await waitWhilePaused(); if (!playingRef.current) break;
        await speak(s.english, 'en-US', 1.0);
        if (!playingRef.current) break;
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
    setIsLearningPlaying(false);
    setIsQuizLooping(false);
    quizLoopRef.current = false;
    // Stop loop if playing
    stopLoop();
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
    quizLoopRef.current = true;
    // Request wake lock for background playback
    await requestWakeLock();
    // Start keep-alive to prevent audio suspension
    startKeepAlive();
    
    try {
      const words = await ensureLearningWords();
      if (!words || words.length === 0) return;
      
      if (quizMode === 'hands-free') {
        // Hands-free mode: Use first 20 learning words in order
        const selectedWords = words.slice(0, Math.min(20, words.length));
        setCurrentSetWords(selectedWords);
        try {
          // Show progress while batch TTS is generated
          setLoopGenerating(true);
          setLoopProgress(10);
          const timer = setInterval(() => setLoopProgress((p) => Math.min(90, p + 5)), 300);
          await generateAndPlayLoop(selectedWords, 'ko-KR', 1.0, quizDelaySec);
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
        // Recording mode: Use individual audio files
        updateMediaSession('Audio Learning', 'Korean Learning', true);
        while (playingRef.current && quizLoopRef.current) {
          await waitWhilePaused(); if (!playingRef.current) break;
          let english = '';
          let korean = '';
          if (quizDifficulty === 1) {
            // Level 1: Single word
            const w = words[Math.floor(Math.random() * words.length)];
            setCurrentQuizWord(w);
            setCurrentQuizSentence(null);
            english = String(w.english || '');
            korean = String(w.korean || '');
          } else {
            // Level 2 or 3: Sentences
            const sent = await generateQuizSentence(quizDifficulty);
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
  }, [ensureLearningWords, quizMode, startMicRecording, stopMicRecording, playRecorded, quizDelaySec, quizRecordDurationSec, startSpeechRecognition, stopSpeechRecognition, recognizedText, pushHistory, quizDifficulty, generateQuizSentence, waitWhilePaused]);

  return (
    <div className="audio-page">
      <header className="audio-header">
        <h1 className="audio-title">Audio Learning</h1>
        <p className="audio-subtitle">Generate sentences from learning words or practice quiz prompts with recording and playback.</p>
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
                <select className="audio-select" value={quizMode} onChange={(e)=>setQuizMode(e.target.value)} style={{ width: '100%' }}>
                  <option value="hands-free">Hands-Free Mode (No Recording)</option>
                  <option value="recording">Recording & Playback Mode</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Difficulty Level</span>
                <select className="audio-select" value={quizDifficulty} onChange={(e)=>setQuizDifficulty(parseInt(e.target.value||'1'))} style={{ width: '100%' }}>
                  <option value={1}>Level 1: Single Words</option>
                  <option value={2}>Level 2: Small Sentences (3-6 words)</option>
                  <option value={3}>Level 3: Longer Sentences (7-12 words)</option>
                </select>
              </div>
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
                  <input type="number" min={0} step={0.1} value={quizDelaySec} onChange={(e)=>setQuizDelaySec(parseFloat(e.target.value||'0'))} />
                </label>
                {quizMode === 'recording' && (
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>Recording duration (sec)</span>
                    <input type="number" min={0} step={0.1} value={quizRecordDurationSec} onChange={(e)=>setQuizRecordDurationSec(parseFloat(e.target.value||'0'))} />
                  </label>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" checked={showConjugations} onChange={(e)=>setShowConjugations(e.target.checked)} />
                  <span style={{ fontSize: 12, fontWeight: 600 }}>Show conjugation hints</span>
                </label>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="audio-btn" onClick={handleStartQuizLoop} disabled={isQuizLooping || isLoadingLearningWords}>Start</button>
                <button className="audio-btn" onClick={() => { pauseLoop(); pausedRef.current = true; }}>Pause</button>
                <button className="audio-btn" onClick={() => { resumeLoop(); pausedRef.current = false; }}>Resume</button>
                <button className="audio-btn" onClick={stopAll}>Stop</button>
              </div>
            {loopGenerating && (
              <div style={{ marginTop: 8 }}>
                <div style={{ height: 8, background: '#eee', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${loopProgress}%`, height: 8, background: '#1976d2', transition: 'width 0.2s' }} />
                </div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>Generating audio…</div>
              </div>
            )}
              <div style={{ display: 'grid', gap: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>Current prompt</div>
                <div className="audio-en" style={{ padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6, minHeight: 20 }}>
                  {currentQuizWord ? `How do you say "${currentQuizWord.english}"?` : (currentQuizSentence ? `How do you say "${currentQuizSentence.english}"?` : '—')}
                </div>
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
                        {showConjugations && (() => {
                          const hint = buildConjugationHints(w.korean);
                          return hint ? (
                            <div style={{ marginLeft: 20, fontSize: 12, color: '#6b7280' }}>
                              <span style={{ marginRight: 8 }}>Present: <span className="audio-ko">{hint.present}</span></span>
                              <span>Past: <span className="audio-ko">{hint.past}</span></span>
                            </div>
                          ) : null;
                        })()}
                      </div>
                    ))}
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
                  </>
                )}
                <div style={{ fontSize: 12, fontWeight: 600, marginTop: 6 }}>Recognized (Korean)</div>
                <div className="audio-ko" style={{ padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6, minHeight: 20 }}>
                  {recognizedText || '—'}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="audio-column">
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

export default LearningModesPage;
