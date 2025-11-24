import { prepareLevel3AudioData, generateLevel3Audio } from '../audioPattern';

export const createHandlePlayCurrentConversation = ({
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
  generateLevel3Audio: generateLevel3AudioFn,
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
}) => {
  return async () => {
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
      
      // Always use Level 3 audio (never regular conversation audio)
      const level = Number(quizDifficulty) || 1;
      const shouldLoop = level === 3;
      
      // Show loading state
      setIsGeneratingLevel3Audio(true);
      setLevel3AudioProgress(0);
      
      // Check if items already have wordPairs saved (from loaded conversation)
      // If they do, use them; otherwise generate new ones
      const hasWordPairs = items.every(item => Array.isArray(item.wordPairs) && item.wordPairs.length > 0);
      const wordPairsCount = items.reduce((sum, item) => sum + (Array.isArray(item.wordPairs) ? item.wordPairs.length : 0), 0);
      console.log('[handlePlayCurrentConversation] Level 3 audio generation:', {
        itemCount: items.length,
        hasWordPairs,
        wordPairsCount,
        sampleItem: items[0] ? {
          korean: items[0].korean,
          english: items[0].english,
          wordPairs: items[0].wordPairs
        } : null
      });
      
      let sentencesWithPairs;
      if (hasWordPairs) {
        // Use saved word pairs - format them for prepareLevel3AudioData
        setLevel3AudioProgress(10);
        sentencesWithPairs = items.map(item => ({
          english: String(item.english || ''),
          korean: String(item.korean || ''),
          wordPairs: Array.isArray(item.wordPairs) ? item.wordPairs.map(pair => {
            // Only include ko and en fields, explicitly exclude korean and english
            const ko = String(pair.ko || pair.korean || '').trim();
            const en = String(pair.en || pair.english || '').trim();
            return { ko, en };
          }).filter(p => p.ko && p.en) : []
        }));
        console.log('[handlePlayCurrentConversation] Using saved wordPairs:', {
          sentencesCount: sentencesWithPairs.length,
          totalWordPairs: sentencesWithPairs.reduce((sum, s) => sum + s.wordPairs.length, 0),
          sampleSentence: sentencesWithPairs[0]
        });
        setLevel3AudioProgress(50);
      } else {
        // Generate word pairs for all sentences using audio pattern utility
        setLevel3AudioProgress(10);
        sentencesWithPairs = await prepareLevel3AudioData(
          items,
          getWordByWordPairsMemo,
          (progress) => setLevel3AudioProgress(progress)
        );
      }
      
      // Generate Level 3 audio using audio pattern utility
      setLevel3AudioProgress(60);
      console.log('[handlePlayCurrentConversation] Generating Level 3 audio with:', {
        sentencesCount: sentencesWithPairs.length,
        totalWordPairs: sentencesWithPairs.reduce((sum, s) => sum + (s.wordPairs?.length || 0), 0),
        delaySeconds: Math.max(0, Number(quizDelaySec) || 0.5)
      });
      const audioUrl = await generateLevel3AudioFn(
        sentencesWithPairs,
        Math.max(0, Number(quizDelaySec) || 0.5)
      );
      console.log('[handlePlayCurrentConversation] Generated audio URL:', audioUrl);
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
        // Play the audio (loop if level 3, otherwise play once)
        await playConversationAudio(shouldLoop, audioUrl, convTitle);
        // Keep the loop running while playing (only for level 3)
        if (shouldLoop) {
          while (playingRef.current && quizLoopRef.current) {
            await waitWhilePaused();
            if (!playingRef.current || !quizLoopRef.current) break;
            await new Promise(r => setTimeout(r, 500));
          }
        } else {
          await new Promise(r => setTimeout(r, 200));
        }
      } else {
        setIsGeneratingLevel3Audio(false);
        setLevel3AudioProgress(0);
        console.error('Failed to generate audio: No audio URL returned');
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
  };
};

