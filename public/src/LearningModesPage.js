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

async function speak(text, lang = 'ko-KR', rate = 0.9) {
  try {
    if (!text || window.__APP_MUTED__ === true) return Promise.resolve();
    const synth = window.speechSynthesis;
    if (!synth) return Promise.resolve();
    
    // Ensure audio context and wake lock are active BEFORE speaking
    await ensureAudioContextActive();
    await requestWakeLock();
    
    synth.cancel();
    const globalSpeed = window.__APP_SPEECH_SPEED__ || 1.0;
    
    // Update MediaSession for background playback
    updateMediaSession(text.substring(0, 50), lang === 'ko-KR' ? 'Korean' : 'English', true);
    
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.rate = rate * globalSpeed;
      u.onstart = async () => {
        // Ensure wake lock is active during playback
        await requestWakeLock();
        // Keep audio context active
        await ensureAudioContextActive();
      };
      u.onend = () => {
        resolve();
      };
      u.onerror = () => {
        resolve();
      };
      synth.speak(u);
    });
  } catch (_) {
    return Promise.resolve();
  }
}

function LearningModesPage() {
  const [learningWords, setLearningWords] = React.useState(null);
  const [isLoadingLearningWords, setIsLoadingLearningWords] = React.useState(false);
  const playingRef = React.useRef(false);

  // Learning Mode state
  const [isLearningPlaying, setIsLearningPlaying] = React.useState(false);

  // Quiz mode state (seconds, decimals allowed)
  const [isQuizLooping, setIsQuizLooping] = React.useState(false);
  const quizLoopRef = React.useRef(false);
  const [quizRecordAndPlaybackEnabled, setQuizRecordAndPlaybackEnabled] = React.useState(false);
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
  const [quizHistory, setQuizHistory] = React.useState([]);
  const [recordingError, setRecordingError] = React.useState('');

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

  // Load history from localStorage
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem('quiz_history_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setQuizHistory(parsed);
      }
    } catch (_) {}
  }, []);

  const pushHistory = React.useCallback((entry) => {
    try {
      const next = [entry, ...quizHistory].slice(0, 50);
      setQuizHistory(next);
      localStorage.setItem('quiz_history_v1', JSON.stringify(next));
    } catch (_) {}
  }, [quizHistory]);

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
        // Resume playback (if paused)
        playingRef.current = true;
        setIsLearningPlaying(true);
      },
      pause: () => {
        // Pause playback
        playingRef.current = false;
        try { const s = window.speechSynthesis; if (s) s.cancel(); } catch (_) {}
      },
      stop: () => {
        // Stop playback completely
        playingRef.current = false;
        setIsLearningPlaying(false);
        try { const s = window.speechSynthesis; if (s) s.cancel(); } catch (_) {}
      }
    });
    try {
      await ensureLearningWords();
      while (playingRef.current) {
        const s = await generateLearningSentence();
        if (!s) break;
        updateMediaSession(s.korean, 'Korean', true);
        await speak(s.korean, 'ko-KR', 1.0);
        if (!playingRef.current) break;
        updateMediaSession(s.english, 'English', true);
        await speak(s.english, 'en-US', 1.0);
        if (!playingRef.current) break;
        const toks = Array.isArray(s.tokens) ? s.tokens : [];
        for (const t of toks) {
          if (!playingRef.current) break;
          updateMediaSession(String(t.ko || ''), 'Korean', true);
          await speak(String(t.ko || ''), 'ko-KR', 1.0);
          if (!playingRef.current) break;
          updateMediaSession(String(t.en || ''), 'English', true);
          await speak(String(t.en || ''), 'en-US', 1.0);
          await new Promise(r => setTimeout(r, 150));
        }
        if (!playingRef.current) break;
        updateMediaSession(s.korean, 'Korean', true);
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
    setIsLearningPlaying(false);
    setIsQuizLooping(false);
    quizLoopRef.current = false;
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
          cleanup();
        };
        
        const onCanPlay = () => {
          audio.play().then(() => {
            // Wait for ended event
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
    quizLoopRef.current = true;
    // Request wake lock for background playback
    await requestWakeLock();
    // Start keep-alive to prevent audio suspension
    startKeepAlive();
    updateMediaSession('Quiz Mode', 'Korean Learning', true);
    try {
      const words = await ensureLearningWords();
      if (!words || words.length === 0) return;
      while (playingRef.current && quizLoopRef.current) {
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
        setRecordedUrl((prev) => { if (prev) { try { URL.revokeObjectURL(prev); } catch (_) {} } return ''; });
        let recordedAudioUrl = null;
        if (quizRecordAndPlaybackEnabled) {
          const srStarted = startSpeechRecognition();
          if (!playingRef.current || !quizLoopRef.current) break;
          await startMicRecording();
          await new Promise(r => setTimeout(r, Math.max(0, Number(quizRecordDurationSec) || 0) * 1000));
          recordedAudioUrl = await stopMicRecording();
          if (srStarted) {
            // allow SR to finalize result
            await new Promise(r => setTimeout(r, 200));
            stopSpeechRecognition();
          }
          if (!playingRef.current || !quizLoopRef.current) break;
          await speak('Recording stopped.', 'en-US', 1.0);
        }
        if (!playingRef.current || !quizLoopRef.current) break;
        await new Promise(r => setTimeout(r, Math.max(0, Number(quizDelaySec) || 0) * 1000));
        if (quizRecordAndPlaybackEnabled && recordedAudioUrl) {
          await speak('Playing recording.', 'en-US', 1.0);
          if (!playingRef.current || !quizLoopRef.current) break;
          await playRecorded(recordedAudioUrl);
        }
        if (!playingRef.current || !quizLoopRef.current) break;
        await new Promise(r => setTimeout(r, Math.max(0, Number(quizDelaySec) || 0) * 1000));
        if (quizRecordAndPlaybackEnabled && recordedAudioUrl) {
          await speak('한국어로', 'ko-KR', 1.0);
        }
        updateMediaSession(korean, 'Korean', true);
        await speak(korean, 'ko-KR', 1.0);
        // Push to history
        pushHistory({
          ts: Date.now(),
          english: english,
          recognized: String(recognizedRef.current || recognizedText || ''),
          korean: korean
        });
        await new Promise(r => setTimeout(r, 500));
      }
    } finally {
      setIsQuizLooping(false);
      quizLoopRef.current = false;
      playingRef.current = false;
      updateMediaSession('Audio Learning', '', false);
      // Release wake lock when done
      await releaseWakeLock();
      // Stop keep-alive if learning mode is not running
      if (!playingRef.current) {
        stopKeepAlive();
      }
    }
  }, [ensureLearningWords, quizRecordAndPlaybackEnabled, startMicRecording, stopMicRecording, playRecorded, quizDelaySec, quizRecordDurationSec, startSpeechRecognition, stopSpeechRecognition, recognizedText, pushHistory, quizDifficulty, generateQuizSentence]);

  return (
    <div className="audio-page">
      <header className="audio-header">
        <h1 className="audio-title">Audio Learning</h1>
        <p className="audio-subtitle">Generate sentences from learning words or practice quiz prompts with recording and playback.</p>
      </header>

      <div className="audio-grid">
        <div className="audio-column">
          <div className="audio-card">
            <h2 className="audio-section-title">Quiz Mode (Learning Words)</h2>
            <p className="audio-help">Prompt: How do you say "[English]"? → "Record your answer" → play your recording → correct Korean. Loops until stopped.</p>
            <div className="audio-actions" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Difficulty Level</span>
                <select className="audio-select" value={quizDifficulty} onChange={(e)=>setQuizDifficulty(parseInt(e.target.value||'1'))} style={{ width: '100%' }}>
                  <option value={1}>Level 1: Single Words</option>
                  <option value={2}>Level 2: Small Sentences (3-6 words)</option>
                  <option value={3}>Level 3: Longer Sentences (7-12 words)</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" checked={quizRecordAndPlaybackEnabled} onChange={(e)=>setQuizRecordAndPlaybackEnabled(e.target.checked)} />
                  <span style={{ fontSize: 12, fontWeight: 600 }}>Record and play back my answer</span>
                </label>
              </div>
              {recordingError && (
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
              {!recordingError && !window.isSecureContext && location.protocol === 'http:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1' && (
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
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>Recording duration (sec)</span>
                  <input type="number" min={0} step={0.1} value={quizRecordDurationSec} onChange={(e)=>setQuizRecordDurationSec(parseFloat(e.target.value||'0'))} />
                </label>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="audio-btn" onClick={handleStartQuizLoop} disabled={isQuizLooping || isLoadingLearningWords}>Start</button>
                <button className="audio-btn" onClick={stopAll}>Stop</button>
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>Current prompt</div>
                <div className="audio-en" style={{ padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6, minHeight: 20 }}>
                  {currentQuizWord ? `How do you say "${currentQuizWord.english}"?` : (currentQuizSentence ? `How do you say "${currentQuizSentence.english}"?` : '—')}
                </div>
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
              </div>
            </div>
          </div>
        </div>
        <div className="audio-column">
          <div className="audio-card">
            <h2 className="audio-section-title">History (this session)</h2>
            <div className="audio-list" style={{ maxHeight: 280, overflow: 'auto' }}>
              {quizHistory && quizHistory.length ? (
                quizHistory.map((h, i) => (
                  <div key={i} className="audio-row">
                    <div className="audio-en" style={{ flex: 2 }}>{`EN: ${h.english}`}</div>
                    <div className="audio-ko" style={{ flex: 2 }}>{`You: ${h.recognized || '—'}`}</div>
                    <div className="audio-ko" style={{ flex: 2, opacity: 0.7 }}>{`KO: ${h.korean}`}</div>
                  </div>
                ))
              ) : (
                <div className="audio-empty">No history yet.</div>
              )}
            </div>
          </div>
          <div className="audio-card" style={{ marginTop: 12 }}>
            <h2 className="audio-section-title">Learning Mode (from Learning Words)</h2>
            <p className="audio-help">Generates simple sentences from words tagged as learning, then speaks sentence, translation, each word pair, and sentence again.</p>
            <div className="audio-actions">
              <button className="audio-btn" onClick={handlePlayLearningMode} disabled={isLearningPlaying || isLoadingLearningWords}>Play</button>
              <button className="audio-btn" onClick={stopAll}>Stop</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LearningModesPage;
