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
    let prompt = `Return ONLY a JSON array of 5 objects like:
[{"speaker":"A","korean":"...","english":"..."}, ...]
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

IMPORTANT: Create a conversation that is somewhat inspired by or loosely related to these example sentences. The conversation should feel natural and varied - it doesn't need to match exactly, just be somewhat based on the context. Do NOT use generic weather or template conversations.

Example sentences for inspiration (use as a loose guide):
Korean: ${contextKorean.trim()}
English: ${contextEnglish.trim()}

Requirements:
- The conversation should be somewhat related to the example sentences (similar topic, theme, or situation, but can vary)
- You may incorporate similar vocabulary or concepts from the examples, but feel free to be creative and expand
- Natural everyday conversation in polite style (요), 7–12 Korean words per turn
- Each turn must be EXACTLY ONE phrase/sentence per line (no multiple sentences, no periods in the middle)
- Avoid compound sentences with periods separating clauses; use simple, single-phrase statements
- Two speakers alternating ("A" then "B" then "A" then "B" then "A" or vice versa)
- The conversation should feel natural and contextually related (follow-up questions/answers, short plans, clarifications)
- Avoid rare terms and proper nouns; use common daily-life topics
- Provide accurate English translations
- DO NOT default to weather conversations or generic templates - be creative and varied while staying somewhat related to the context

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

