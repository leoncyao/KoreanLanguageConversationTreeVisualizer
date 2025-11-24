/**
 * Learning Mode Audio Generation
 * Handles the learning mode audio playback loop
 */

export async function playLearningMode({
  ensureLearningWords,
  generateLearningSentence,
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
}) {
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
      await waitWhilePaused(); 
      if (!playingRef.current) break;
      
      const s = await generateLearningSentence();
      if (!s) break;
      
      // 1. English sentence first
      updateMediaSession(s.english, 'English', true);
      await waitWhilePaused(); 
      if (!playingRef.current) break;
      await speak(s.english, 'en-US', 1.0);
      if (!playingRef.current) break;
      
      // 2. Korean sentence second
      updateMediaSession(s.korean, 'Korean', true);
      await waitWhilePaused(); 
      if (!playingRef.current) break;
      await speak(s.korean, 'ko-KR', 1.0);
      if (!playingRef.current) break;
      
      // 3. Each Korean word and its translation
      const toks = Array.isArray(s.tokens) ? s.tokens : [];
      for (const t of toks) {
        if (!playingRef.current) break;
        updateMediaSession(String(t.ko || ''), 'Korean', true);
        await waitWhilePaused(); 
        if (!playingRef.current) break;
        await speak(String(t.ko || ''), 'ko-KR', 1.0);
        if (!playingRef.current) break;
        updateMediaSession(String(t.en || ''), 'English', true);
        await waitWhilePaused(); 
        if (!playingRef.current) break;
        await speak(String(t.en || ''), 'en-US', 1.0);
        await new Promise(r => setTimeout(r, 150));
      }
      
      if (!playingRef.current) break;
      
      // 4. Whole Korean sentence again
      updateMediaSession(s.korean, 'Korean', true);
      await waitWhilePaused(); 
      if (!playingRef.current) break;
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
}

