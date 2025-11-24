// Sentence generation utilities

export const parseJsonObject = (text) => {
  const m = text && text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { const obj = JSON.parse(m[0]); return obj && typeof obj === 'object' ? obj : null; } catch (_) { return null; }
};

export const parseJsonArraySafe = (text) => {
  if (!text) return [];
  const m = String(text).match(/\[[\s\S]*\]/);
  if (!m) return [];
  try { const arr = JSON.parse(m[0]); return Array.isArray(arr) ? arr : []; } catch (_) { return []; }
};

export const pickRandom = (arr, n) => {
  const copy = [...arr];
  const out = [];
  while (copy.length && out.length < n) {
    const i = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
};

export const getWordByWordPairs = async (api, english, korean) => {
  try {
    const prompt = `Translate this Korean sentence word by word. Return ONLY a JSON array of objects, each with "ko" (Korean word/token) and "en" (English translation).

CRITICAL INSTRUCTIONS:
- Break the Korean sentence into individual words/tokens
- Translate each Korean word/token to its MEANING in English, NOT by matching position in the English sentence
- The English sentence is provided ONLY as context to understand the overall meaning - DO NOT match Korean words to English words by position
- Each Korean word must be translated based on its actual meaning, regardless of word order differences
- Keep the array in Korean word order (not English word order)
- Cover every word/token in the Korean sentence
- The "ko" field must contain the KOREAN word/token
- The "en" field must contain the ENGLISH translation/gloss for that specific Korean word's meaning

Korean sentence: ${korean}
English translation: ${english} (provided for context only - do not match by position)

Example:
Korean: "오늘 저녁에 시간 있으세요?"
English: "Do you have time this evening?"
Correct pairs: [{"ko":"오늘","en":"today"},{"ko":"저녁에","en":"in the evening"},{"ko":"시간","en":"time"},{"ko":"있으세요?","en":"do you have"}]
Note: "오늘" means "today" (not "Do"), "시간" means "time" (not "have") - translate by meaning, not position!

Return ONLY the JSON array, no other text.`;
    
    const res = await api.chat(prompt);
    const data = await res.json().catch(() => null);
    const arr = parseJsonArraySafe(data && (data.response || ''));
    
    if (arr && arr.length > 0) {
      const norm = arr.map(x => {
        const possibleKo = String((x.ko || x.korean || '')).trim();
        const possibleEn = String((x.en || x.english || '')).trim();
        
        const hasHangul = (text) => /[\uAC00-\uD7AF]/.test(text);
        
        // If fields appear swapped, swap them back
        if (hasHangul(possibleEn) && !hasHangul(possibleKo)) {
          console.warn('[getWordByWordPairs] Detected swapped fields, correcting:', { originalKo: possibleKo, originalEn: possibleEn });
          return { ko: possibleEn, en: possibleKo };
        }
        
        return { ko: possibleKo, en: possibleEn };
      }).filter(x => x.ko && x.en);
      
      if (norm && norm.length > 0) {
        // Final validation: ensure ko fields contain Korean characters
        return norm.map(pair => {
          const koHasHangul = /[\uAC00-\uD7AF]/.test(pair.ko);
          const enHasHangul = /[\uAC00-\uD7AF]/.test(pair.en);
          
          if (koHasHangul && !enHasHangul) {
            return pair; // Correct
          } else if (!koHasHangul && enHasHangul) {
            console.warn('[getWordByWordPairs] Swapping fields:', pair);
            return { ko: pair.en, en: pair.ko }; // Swap
          } else {
            return pair; // Keep as-is
          }
        });
      }
    }
  } catch (err) {
    console.error('[getWordByWordPairs] Error:', err);
  }
  
  // Fallback: naive split by spaces
  const koParts = String(korean || '').split(/\s+/).filter(Boolean);
  const enParts = String(english || '').split(/\s+/).filter(Boolean);
  const n = Math.min(koParts.length, enParts.length);
  return new Array(n).fill(0).map((_, i) => ({ ko: koParts[i], en: enParts[i] }));
};

export const getCurriculumSentence = async (api) => {
  try {
    const res = await api.getRandomCurriculumPhrase(8000, 1); // 8s timeout, 1 retry
    if (!res.ok) {
      // If 504 or other server error, log and return null to use fallback
      if (res.status === 504 || res.status === 502 || res.status === 503) {
        console.warn(`Curriculum API error: HTTP ${res.status}. Using fallback sentence generation.`);
        return null;
      }
      return null;
    }
    const p = await res.json();
    const english = String(p && (p.english_text || p.english || '') || '').trim();
    const korean = String(p && (p.korean_text || p.korean || '') || '').trim();
    if (!english || !korean) return null;
    return { english, korean };
  } catch (error) {
    // Log error but don't break the flow - use fallback
    console.warn('Failed to fetch curriculum phrase:', error.message || error);
    return null;
  }
};

export const generateLearningSentence = async (api, ensureLearningWords, pickRandomFn) => {
  const words = await ensureLearningWords();
  if (!words || words.length === 0) return null;
  const subset = pickRandomFn(words, Math.max(3, Math.min(7, Math.floor(Math.random()*6)+3)));
  const examples = subset.map(w => `${w.korean} (${w.english})`).join(', ');
  const prompt = `Using ONLY some of these Korean learning words: ${examples}\nCreate ONE natural, simple Korean sentence (<= 10 words) that is grammatically correct.\nReturn ONLY JSON: {"korean":"...","english":"...","tokens":[{"ko":"...","en":"..."}, ...]}\ntokens should list the key words in the sentence (3-8 items) with their English.

`;
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
};

export const generateEnglishWordIndices = async (api, korean, english, blankWords = []) => {
  try {
    if (!korean || !english) return {};
    
    const blankWordsStr = Array.isArray(blankWords) && blankWords.length > 0 
      ? blankWords.join(', ') 
      : '';
    
    const prompt = `Return ONLY a JSON object with this format: {"mapping": {"korean_word": english_word_index}}.
Given this Korean sentence and its English translation, create a mapping from each Korean word to its corresponding English word index.

Korean: ${korean}
English: ${english}
${blankWordsStr ? `Korean blanked words: ${blankWordsStr}` : ''}

The English sentence is: "${english}"
Split the English sentence into words (by spaces), and return the 0-based index of the English word that corresponds to each Korean word.

For example, if the Korean is "나는 학교에 가요" and the English is "I go to school", return:
{"mapping": {"나는": 0, "학교에": 2, "가요": 1}}

If blanked words are provided, prioritize mapping those words accurately.

Return ONLY the JSON object, no other text.`;
    
    const res = await api.chat(prompt);
    if (res.ok) {
      const data = await res.json();
      const text = data.response || '';
      const m = String(text).match(/\{[\s\S]*\}/);
      if (m) {
        try {
          const obj = JSON.parse(m[0]);
          if (obj && obj.mapping && typeof obj.mapping === 'object') {
            return obj.mapping;
          }
        } catch (_) {}
      }
    }
  } catch (_) {}
  return {};
};

