import { api } from '../api';

/**
 * Parse JSON array from text response
 */
const parseJsonArraySafe = (text) => {
  if (!text) return [];
  const m = String(text).match(/\[[\s\S]*\]/);
  if (!m) return [];
  try { const arr = JSON.parse(m[0]); return Array.isArray(arr) ? arr : []; } catch (_) { return []; }
};

/**
 * Generate a coherent 5-turn conversation (independent of learning words)
 * @param {string} contextKorean - Optional Korean context sentence
 * @param {string} contextEnglish - Optional English context sentence
 * @returns {Promise<Array<{korean: string, english: string}>>} Array of 5 conversation turns
 */
export const generateConversationSet = async (contextKorean = '', contextEnglish = '') => {
  try {
    // Log context sentences if provided
    if (contextKorean && contextKorean.trim() && contextEnglish && contextEnglish.trim()) {
      console.log('[generateConversationSet] Context sentences provided:', {
        korean: contextKorean.trim(),
        english: contextEnglish.trim()
      });
    } else {
      console.log('[generateConversationSet] No context sentences provided - will make up a random topic');
    }
    
    let prompt = `Return ONLY a JSON array of 5 objects like:
[{"speaker":"A","korean":"...","english":"..."}, ...]

No context was provided, so you must make up a random topic for the conversation. Simulate a random natural conversation between 2 people on any everyday topic or situation - it could be about plans, asking for help, sharing experiences, making suggestions, etc. Be creative and varied. Choose any topic that feels natural and everyday.

Requirements:
- Natural everyday conversation in polite style (요), 7–12 Korean words per turn
- Each turn must be EXACTLY ONE phrase/sentence per line (no multiple sentences, no periods in the middle)
- Avoid compound sentences with periods separating clauses; use simple, single-phrase statements
- Two speakers alternating ("A" then "B" then "A" then "B" then "A" or vice versa)
- Turns must be contextually related (follow-up questions/answers, short plans, clarifications)
- Avoid rare terms and proper nouns; use common daily-life topics
- Provide accurate English translations

`;
    
    // If user provided context sentences, include them in the prompt
    if (contextKorean && contextKorean.trim() && contextEnglish && contextEnglish.trim()) {
      prompt = `Return ONLY a JSON array of 5 objects like:
[{"speaker":"A","korean":"...","english":"..."}, ...]

CRITICAL: Create a conversation that is DIRECTLY about the topic, theme, and vocabulary from these example sentences. The conversation MUST focus on the same subject matter as the examples. Do NOT use generic topics like "weekend plans" or "cafe visits" unless those are explicitly mentioned in the examples.

Example sentences that define the conversation topic:
Korean: ${contextKorean.trim()}
English: ${contextEnglish.trim()}

Requirements:
- The conversation MUST be about the same topic/subject as the example sentences
- Use vocabulary and concepts directly related to the examples - if the example mentions "cars", the conversation should be about cars
- If the example mentions specific words or topics, those should be the PRIMARY focus of the conversation
- Natural everyday conversation in polite style (요), 7–12 Korean words per turn
- Each turn must be EXACTLY ONE phrase/sentence per line (no multiple sentences, no periods in the middle)
- Avoid compound sentences with periods separating clauses; use simple, single-phrase statements
- Two speakers alternating ("A" then "B" then "A" then "B" then "A" or vice versa)
- The conversation should feel natural and contextually related (follow-up questions/answers, short plans, clarifications)
- Avoid rare terms and proper nouns; use common daily-life topics
- Provide accurate English translations

`;
    }
    
    const res = await api.chat(prompt);
    const data = await res.json().catch(() => null);
    const arr = parseJsonArraySafe(data && (data.response || ''));
    const norm = (Array.isArray(arr) ? arr : [])
      .map((x) => {
        let korean = String((x.korean || x.ko || '')).trim();
        let english = String((x.english || x.en || '')).trim();
        
        // Clean up: remove periods in the middle, keep only the first phrase
        // Split by period and take the first part (but preserve question/exclamation marks at the end)
        const koMatch = korean.match(/^([^.]*[.!?]?)/);
        if (koMatch) {
          korean = koMatch[1].trim();
        }
        const enMatch = english.match(/^([^.]*[.!?]?)/);
        if (enMatch) {
          english = enMatch[1].trim();
        }
        
        return {
          speaker: String((x.speaker || x.role || '')).trim() || '',
          korean,
          english,
        };
      })
      .filter((x) => x.korean && x.english)
      .slice(0, 5);
    if (norm.length === 5) {
      return norm.map(({ korean, english }) => ({ korean, english }));
    }
  } catch (_) {}
  // Fallback: simple coherent seed conversation (5 turns)
  const seeds = [
    { korean: '오늘 저녁에 시간 있으세요?', english: 'Do you have time this evening?' },
    { korean: '네, 있어요', english: 'Yes, I do' },
    { korean: '같이 저녁 먹고 산책할까요?', english: 'Shall we have dinner together and take a walk?' },
    { korean: '좋아요! 몇 시에 만날까요?', english: 'Sounds good! What time should we meet?' },
    { korean: '여섯 시 어때요?', english: "How about six?" },
  ];
  return seeds;
};

