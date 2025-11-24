import { updateMediaSession } from '../backgroundAudio';
import { generateAndPlayLoop, stopLoop, pauseLoop, resumeLoop } from '../audioLoop';
import { prepareLevel3AudioData, generateLevel3Audio } from '../audioPattern';

export const createHandleStartQuizLoop = ({
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
  generateAndPlayLoop: generateAndPlayLoopFn,
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
}) => {
  return async () => {
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
        updateMediaSession('Audio Learning', 'Korean Learning', true, {
          play: () => {},
          pause: () => {},
          stop: () => {},
          nexttrack: isPlaylistMode && playlist.length > 1 ? (() => {
            console.log('[MediaSession] Next track triggered (play)');
            if (playNextConversationRef.current) {
              playNextConversationRef.current();
            }
          }) : undefined,
          previoustrack: isPlaylistMode && playlist.length > 1 ? (() => {
            console.log('[MediaSession] Previous track triggered (play)');
            if (playPreviousConversationRef.current) {
              playPreviousConversationRef.current();
            }
          }) : undefined,
        });
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
        updateMediaSession('Audio Learning', 'Korean Learning', false, {
          play: () => {},
          pause: () => {},
          stop: () => {},
          nexttrack: isPlaylistMode && playlist.length > 1 ? (() => {
            console.log('[MediaSession] Next track triggered (pause)');
            if (playNextConversationRef.current) {
              playNextConversationRef.current();
            }
          }) : undefined,
          previoustrack: isPlaylistMode && playlist.length > 1 ? (() => {
            console.log('[MediaSession] Previous track triggered (pause)');
            if (playPreviousConversationRef.current) {
              playPreviousConversationRef.current();
            }
          }) : undefined,
        });
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
      },
      nexttrack: isPlaylistMode && playlist.length > 1 ? (() => {
        console.log('[MediaSession] Next track triggered');
        if (playNextConversationRef.current) {
          playNextConversationRef.current();
        }
      }) : undefined,
      previoustrack: isPlaylistMode && playlist.length > 1 ? (() => {
        console.log('[MediaSession] Previous track triggered');
        if (playPreviousConversationRef.current) {
          playPreviousConversationRef.current();
        }
      }) : undefined,
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
          const transformed = selectedWords.map(applyPronounAndTenseIfVerbMemo);
          setCurrentSetWords(transformed);
          try {
            // Show progress while batch TTS is generated
            setLoopGenerating(true);
            setLoopProgress(10);
            const timer = setInterval(() => setLoopProgress((p) => Math.min(90, p + 5)), 300);
            await generateAndPlayLoopFn(transformed, 'ko-KR', 1.0, quizDelaySec);
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
            const s = await generateQuizSentenceMemo(2);
            if (s && s.english && s.korean) batch.push({ english: String(s.english), korean: String(s.korean) });
          }
          if (batch.length === 0) {
            // Fallback: generate continuously if batch failed
            while (playingRef.current && quizLoopRef.current) {
              await waitWhilePaused(); if (!playingRef.current) break;
              const sent = await generateQuizSentenceMemo(2);
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
          const batch3 = await generateConversationSetLocal();
          if (batch3.length === 0) {
            // Fallback: generate one sentence if batch failed
            const sent = await generateQuizSentenceMemo(3);
            if (sent) {
              setGeneratedSentences([{ english: String(sent.english || ''), korean: String(sent.korean || '') }]);
            }
          } else {
            // Show the batch in UI
            setGeneratedSentences(batch3);
            
            // Show loading state
            setIsGeneratingLevel3Audio(true);
            setLevel3AudioProgress(0);
            
            // Check if batch3 already has wordPairs saved (from loaded conversation)
            // If they do, use them; otherwise generate new ones
            const hasWordPairs = batch3.every(item => Array.isArray(item.wordPairs) && item.wordPairs.length > 0);
            
            let sentencesWithPairs;
            if (hasWordPairs) {
              // Use saved word pairs - format them for prepareLevel3AudioData
              setLevel3AudioProgress(10);
              sentencesWithPairs = batch3.map(item => ({
                english: String(item.english || ''),
                korean: String(item.korean || ''),
                wordPairs: Array.isArray(item.wordPairs) ? item.wordPairs.map(pair => {
                  // Only include ko and en fields, explicitly exclude korean and english
                  const ko = String(pair.ko || pair.korean || '').trim();
                  const en = String(pair.en || pair.english || '').trim();
                  return { ko, en };
                }).filter(p => p.ko && p.en) : []
              }));
              setLevel3AudioProgress(50);
            } else {
              // Generate word pairs for all sentences using audio pattern utility
              setLevel3AudioProgress(10);
              sentencesWithPairs = await prepareLevel3AudioData(
                batch3,
                getWordByWordPairsMemo,
                (progress) => setLevel3AudioProgress(progress)
              );
            }
            
            // Generate Level 3 audio using audio pattern utility
            setLevel3AudioProgress(60);
            const audioUrl = await generateLevel3Audio(
              sentencesWithPairs,
              Math.max(0, Number(quizDelaySec) || 0.5)
            );
            setLevel3AudioProgress(100);
            
            if (audioUrl) {
              setConversationAudioUrl(audioUrl);
              setIsGeneratingLevel3Audio(false);
              setLevel3AudioProgress(0);
              // Find conversation title from saved conversations or use default
              const currentConv = savedConversations.find(c => c.audioUrl === audioUrl) || 
                                 (isPlaylistMode && playlistIndex >= 0 && playlistIndex < playlist.length ? playlist[playlistIndex] : null);
              const convTitle = currentConv ? currentConv.title : (currentConversationTitle || 'New Conversation');
              setCurrentConversationTitle(convTitle);
              // Play the audio immediately (it will loop automatically)
              await playConversationAudio(true, audioUrl, convTitle); // true = loop, pass URL directly
              // Keep the loop running while playing (audio loops automatically)
              while (playingRef.current && quizLoopRef.current) {
                await waitWhilePaused();
                if (!playingRef.current || !quizLoopRef.current) break;
                await new Promise(r => setTimeout(r, 500));
              }
            } else {
              setIsGeneratingLevel3Audio(false);
              setLevel3AudioProgress(0);
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
            const w2 = applyPronounAndTenseIfVerbMemo(w);
            korean = String(w2.korean || '');
          } else {
            // Level 2 or 3: Sentences
            const sent = await generateQuizSentenceMemo(level);
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
            const pairs = await getWordByWordPairsMemo(english, korean);
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
  };
};

