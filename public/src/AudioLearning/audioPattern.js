/**
 * Audio Pattern Specification and Utilities
 * 
 * This module defines the standard audio playback pattern for Korean learning conversations
 * and provides utilities for generating audio data according to this pattern.
 */

/**
 * Standard Audio Pattern for Conversation Sentences
 * 
 * For each sentence in a conversation, the audio playback follows this exact sequence:
 * 
 * 1. English sentence - Play the full English translation
 * 2. Korean sentence - Play the full Korean sentence  
 * 3. Word-by-word pairs - For each Korean word in the sentence:
 *    - Play the Korean word
 *    - Play its English translation/gloss
 *    - (Repeat for all words in order)
 * 4. Korean sentence (repeat) - Play the full Korean sentence again
 * 
 * Example:
 * For "오늘 저녁에 시간 있으세요?" / "Do you have time this evening?"
 * 
 * Audio sequence:
 * 1. "Do you have time this evening?"
 * 2. "오늘 저녁에 시간 있으세요?"
 * 3. "오늘" → "today"
 *    "저녁에" → "in the evening"
 *    "시간" → "time"
 *    "있으세요?" → "do you have"
 * 4. "오늘 저녁에 시간 있으세요?" (repeat)
 */

export const AUDIO_PATTERN = {
  /**
   * Pattern sequence steps
   */
  STEPS: {
    ENGLISH_SENTENCE: 'english_sentence',
    KOREAN_SENTENCE: 'korean_sentence',
    WORD_PAIRS: 'word_pairs',
    KOREAN_SENTENCE_REPEAT: 'korean_sentence_repeat'
  },
  
  /**
   * Pattern order (array of step names in sequence)
   */
  ORDER: [
    'english_sentence',
    'korean_sentence',
    'word_pairs',
    'korean_sentence_repeat'
  ],
  
  /**
   * Description of the pattern
   */
  DESCRIPTION: `Standard conversation audio pattern:
1. English sentence (full translation)
2. Korean sentence (full sentence)
3. Word-by-word pairs (Korean word → English gloss, for each word)
4. Korean sentence (repeat for reinforcement)`
};

/**
 * Prepare sentence data for Level 3 audio generation according to the audio pattern
 * 
 * @param {Array<{korean: string, english: string}>} sentences - Array of sentence objects
 * @param {Function} getWordPairs - Async function to get word pairs: (english, korean) => Promise<Array<{ko: string, en: string}>>
 * @param {Function} onProgress - Optional progress callback: (percent: number) => void
 * @returns {Promise<Array<{english: string, korean: string, wordPairs: Array<{ko: string, en: string}>}>>}
 */
export const prepareLevel3AudioData = async (sentences, getWordPairs, onProgress = null) => {
  if (!Array.isArray(sentences) || sentences.length === 0) {
    return [];
  }
  
  const sentencesWithPairs = await Promise.all(sentences.map(async (sent, idx) => {
    try {
      const pairs = await getWordPairs(
        String(sent.english || ''),
        String(sent.korean || '')
      );
      
      if (onProgress) {
        const progress = 10 + ((idx + 1) / sentences.length) * 40; // 10-50%
        onProgress(progress);
      }
      
      return {
        english: String(sent.english || ''),
        korean: String(sent.korean || ''),
        wordPairs: Array.isArray(pairs) ? pairs.map(p => {
          // Only include ko and en fields, explicitly exclude korean and english
          const ko = String(p.ko || p.korean || '').trim();
          const en = String(p.en || p.english || '').trim();
          return { ko, en };
        }).filter(p => p.ko && p.en) : []
      };
    } catch (error) {
      console.warn('Failed to get word pairs for sentence:', error);
      // Fallback: simple split by spaces
      const koParts = String(sent.korean || '').split(/\s+/).filter(Boolean);
      const enParts = String(sent.english || '').split(/\s+/).filter(Boolean);
      const n = Math.min(koParts.length, enParts.length);
      
      if (onProgress) {
        const progress = 10 + ((idx + 1) / sentences.length) * 40;
        onProgress(progress);
      }
      
      return {
        english: String(sent.english || ''),
        korean: String(sent.korean || ''),
        wordPairs: new Array(n).fill(0).map((_, i) => {
          // Only include ko and en fields
          const ko = String(koParts[i] || '').trim();
          const en = String(enParts[i] || '').trim();
          return { ko, en };
        }).filter(p => p.ko && p.en)
      };
    }
  }));
  
  return sentencesWithPairs;
};

/**
 * Generate Level 3 audio URL using the standard audio pattern
 * 
 * @param {Array<{english: string, korean: string, wordPairs: Array<{ko: string, en: string}>}>} sentencesWithPairs - Prepared sentence data
 * @param {number} delaySeconds - Delay between audio segments (default: 0.5)
 * @returns {Promise<string|null>} Audio URL or null if generation fails
 */
export const generateLevel3Audio = async (sentencesWithPairs, delaySeconds = 0.5) => {
  try {
    // Verify wordPairs are present before sending
    const hasWordPairs = sentencesWithPairs.some(s => Array.isArray(s.wordPairs) && s.wordPairs.length > 0);
    const totalWordPairs = sentencesWithPairs.reduce((sum, s) => sum + (Array.isArray(s.wordPairs) ? s.wordPairs.length : 0), 0);
    console.log('[generateLevel3Audio] Sending to server:', {
      sentencesCount: sentencesWithPairs.length,
      hasWordPairs,
      totalWordPairs,
      sampleSentence: sentencesWithPairs[0] ? {
        korean: sentencesWithPairs[0].korean,
        english: sentencesWithPairs[0].english,
        wordPairsCount: sentencesWithPairs[0].wordPairs?.length || 0,
        wordPairs: sentencesWithPairs[0].wordPairs
      } : null
    });
    
    const res = await fetch('/api/tts/level3', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sentences: sentencesWithPairs,
        delaySeconds: Math.max(0, Number(delaySeconds) || 0.5)
      })
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: Failed to generate Level 3 audio`);
    }
    
    const data = await res.json().catch(() => null);
    console.log('[generateLevel3Audio] Server response:', { url: data?.url, cached: data?.cached });
    return (data && data.url) ? data.url : null;
  } catch (error) {
    console.error('generateLevel3Audio error:', error);
    return null;
  }
};

/**
 * Validate that sentence data follows the audio pattern structure
 * 
 * @param {any} data - Data to validate
 * @returns {boolean} True if valid
 */
export const validateAudioPatternData = (data) => {
  if (!Array.isArray(data)) return false;
  
  return data.every(item => {
    return (
      typeof item === 'object' &&
      item !== null &&
      typeof item.english === 'string' &&
      typeof item.korean === 'string' &&
      Array.isArray(item.wordPairs) &&
      item.wordPairs.every(pair => 
        typeof pair === 'object' &&
        pair !== null &&
        typeof pair.ko === 'string' &&
        typeof pair.en === 'string'
      )
    );
  });
};

/**
 * Get pattern description as a formatted string
 * 
 * @returns {string} Formatted description
 */
export const getPatternDescription = () => {
  return AUDIO_PATTERN.DESCRIPTION;
};

