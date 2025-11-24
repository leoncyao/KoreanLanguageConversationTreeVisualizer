/**
 * Quiz Mode Hands-Free Audio Generation
 * Handles hands-free quiz mode for all difficulty levels
 */

export async function playQuizModeHandsFree({
  level,
  ensureLearningWords,
  setIndex,
  applyPronounAndTenseIfVerb,
  generateQuizSentence,
  generateConversationSetLocal,
  getWordByWordPairs,
  prepareLevel3AudioData,
  generateLevel3Audio,
  generateAndPlayLoop,
  playConversationAudio,
  waitWhilePaused,
  speak,
  updateMediaSession,
  setCurrentSetWords,
  setGeneratedSentences,
  setLoopGenerating,
  setLoopProgress,
  setIsGeneratingLevel3Audio,
  setLevel3AudioProgress,
  setConversationAudioUrl,
  setCurrentConversationTitle,
  setError,
  quizDelaySec,
  savedConversations,
  isPlaylistMode,
  playlist,
  playlistIndex,
  currentConversationTitle,
  conversationAudioRef,
  playingRef,
  quizLoopRef,
  pausedRef
}) {
  const words = await ensureLearningWords();
  if (!words || words.length === 0) return;
  
  if (level === 1) {
    // Hands-free Level 1: chunked words (20 per set) by date order
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
  } else if (level === 2) {
    // Hands-free Level 2: sentences (no recording)
    setCurrentSetWords([]);
    setGeneratedSentences([]);
    
    // Generate exactly 5 sentences once, then loop them
    const batch = [];
    for (let i = 0; i < 5; i++) {
      if (!playingRef.current || !quizLoopRef.current) break;
      const s = await generateQuizSentence(2);
      if (s && s.english && s.korean) {
        batch.push({ english: String(s.english), korean: String(s.korean) });
      }
    }
    
    if (batch.length === 0) {
      // Fallback: generate continuously if batch failed
      while (playingRef.current && quizLoopRef.current) {
        await waitWhilePaused(); 
        if (!playingRef.current) break;
        
        const sent = await generateQuizSentence(2);
        if (!sent) break;
        
        setGeneratedSentences((prev) => [
          { english: String(sent.english || ''), korean: String(sent.korean || '') }, 
          ...prev
        ].slice(0, 10));
        
        updateMediaSession(sent.english, 'English', true);
        await waitWhilePaused(); 
        if (!playingRef.current) break;
        await speak(sent.english, 'en-US', 1.0);
        if (!playingRef.current || !quizLoopRef.current) break;
        
        await waitWhilePaused(); 
        if (!playingRef.current) break;
        updateMediaSession(sent.korean, 'Korean', true);
        await speak(sent.korean, 'ko-KR', 1.0);
        await new Promise(r => setTimeout(r, 300));
      }
    } else {
      // Show the batch in UI
      setGeneratedSentences(batch);
      let idx = 0;
      while (playingRef.current && quizLoopRef.current) {
        await waitWhilePaused(); 
        if (!playingRef.current) break;
        
        const sent = batch[idx % batch.length];
        idx++;
        
        updateMediaSession(sent.english, 'English', true);
        await waitWhilePaused(); 
        if (!playingRef.current) break;
        await speak(sent.english, 'en-US', 1.0);
        if (!playingRef.current || !quizLoopRef.current) break;
        
        await waitWhilePaused(); 
        if (!playingRef.current) break;
        updateMediaSession(sent.korean, 'Korean', true);
        await speak(sent.korean, 'ko-KR', 1.0);
        await new Promise(r => setTimeout(r, 300));
      }
    }
  } else if (level === 3) {
    // Level 3: Generate one audio file for all 5 sentences with word-by-word breakdown
    setCurrentSetWords([]);
    
    const batch3 = await generateConversationSetLocal();
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
      
      // Check if batch3 already has wordPairs saved (from loaded conversation)
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
          getWordByWordPairs,
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
        await playConversationAudio(true, audioUrl, convTitle);
        
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
    }
  }
}

