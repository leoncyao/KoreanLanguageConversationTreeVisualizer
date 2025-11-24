/**
 * Quiz Mode Recording Audio Generation
 * Handles recording mode quiz with user recording and playback
 */

export async function playQuizModeRecording({
  level,
  ensureLearningWords,
  applyPronounAndTenseIfVerb,
  generateQuizSentence,
  getWordByWordPairs,
  waitWhilePaused,
  speak,
  updateMediaSession,
  startMicRecording,
  stopMicRecording,
  playRecorded,
  startSpeechRecognition,
  stopSpeechRecognition,
  setCurrentQuizWord,
  setCurrentQuizSentence,
  setRecordedUrl,
  setRecognizedText,
  quizDelaySec,
  quizRecordDurationSec,
  recognizedRef,
  recognizedText,
  pushHistory,
  playingRef,
  quizLoopRef,
  pausedRef
}) {
  const words = await ensureLearningWords();
  if (!words || words.length === 0) return;
  
  updateMediaSession('Audio Learning', 'Korean Learning', true);
  
  while (playingRef.current && quizLoopRef.current) {
    await waitWhilePaused(); 
    if (!playingRef.current) break;
    
    let english = '';
    let korean = '';
    
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
    await waitWhilePaused(); 
    if (!playingRef.current) break;
    
    let recordedAudioUrl = null;
    let recognizedTextValue = '';
    
    // Recording mode: Record and play back user's answer
    setRecordedUrl((prev) => { 
      if (prev) { 
        try { URL.revokeObjectURL(prev); } catch (_) {} 
      } 
      return ''; 
    });
    
    const srStarted = startSpeechRecognition();
    if (!playingRef.current || !quizLoopRef.current) break;
    await waitWhilePaused(); 
    if (!playingRef.current) break;
    
    await startMicRecording();
    
    // Respect pause during recording window
    const recordUntil = Date.now() + Math.max(0, Number(quizRecordDurationSec) || 0) * 1000;
    while (Date.now() < recordUntil && playingRef.current && quizLoopRef.current) {
      if (pausedRef.current) break;
      await new Promise(r => setTimeout(r, 100));
    }
    
    recordedAudioUrl = await stopMicRecording();
    
    if (srStarted) {
      // Allow SR to finalize result
      await new Promise(r => setTimeout(r, 200));
      stopSpeechRecognition();
      recognizedTextValue = String(recognizedRef.current || recognizedText || '');
    }
    
    if (!playingRef.current || !quizLoopRef.current) break;
    await waitWhilePaused(); 
    if (!playingRef.current) break;
    await speak('Recording stopped.', 'en-US', 1.0);
    if (!playingRef.current || !quizLoopRef.current) break;
    await waitWhilePaused(); 
    if (!playingRef.current) break;
    await new Promise(r => setTimeout(r, Math.max(0, Number(quizDelaySec) || 0) * 1000));
    
    if (recordedAudioUrl) {
      await waitWhilePaused(); 
      if (!playingRef.current) break;
      await speak('Playing recording.', 'en-US', 1.0);
      if (!playingRef.current || !quizLoopRef.current) break;
      await playRecorded(recordedAudioUrl);
    }
    
    if (!playingRef.current || !quizLoopRef.current) break;
    await waitWhilePaused(); 
    if (!playingRef.current) break;
    await new Promise(r => setTimeout(r, Math.max(0, Number(quizDelaySec) || 0) * 1000));
    
    if (recordedAudioUrl) {
      await waitWhilePaused(); 
      if (!playingRef.current) break;
      await speak('한국어로', 'ko-KR', 1.0);
    }
    if (!playingRef.current || !quizLoopRef.current) break;
    
    // Explanation format: English sentence, Korean sentence, word pairs, Korean sentence again
    // 1. English sentence
    updateMediaSession(english, 'English', true);
    await waitWhilePaused(); 
    if (!playingRef.current) break;
    await speak(english, 'en-US', 1.0);
    if (!playingRef.current || !quizLoopRef.current) break;
    
    await waitWhilePaused(); 
    if (!playingRef.current) break;
    
    // 2. Korean sentence
    updateMediaSession(korean, 'Korean', true);
    await waitWhilePaused(); 
    if (!playingRef.current) break;
    await speak(korean, 'ko-KR', 1.0);
    if (!playingRef.current || !quizLoopRef.current) break;
    
    await waitWhilePaused(); 
    if (!playingRef.current) break;
    
    // 3. Each Korean word and its translation
    try {
      const pairs = await getWordByWordPairs(english, korean);
      if (Array.isArray(pairs) && pairs.length > 0) {
        for (const pair of pairs) {
          if (!playingRef.current || !quizLoopRef.current) break;
          updateMediaSession(String(pair.ko || ''), 'Korean', true);
          await waitWhilePaused(); 
          if (!playingRef.current) break;
          await speak(String(pair.ko || ''), 'ko-KR', 1.0);
          if (!playingRef.current || !quizLoopRef.current) break;
          updateMediaSession(String(pair.en || ''), 'English', true);
          await waitWhilePaused(); 
          if (!playingRef.current) break;
          await speak(String(pair.en || ''), 'en-US', 1.0);
          await new Promise(r => setTimeout(r, 150));
        }
      }
    } catch (_) {
      // Fallback: if word pairs fail, continue without them
    }
    
    if (!playingRef.current || !quizLoopRef.current) break;
    await waitWhilePaused(); 
    if (!playingRef.current) break;
    
    // 4. Whole Korean sentence again
    updateMediaSession(korean, 'Korean', true);
    await waitWhilePaused(); 
    if (!playingRef.current) break;
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

