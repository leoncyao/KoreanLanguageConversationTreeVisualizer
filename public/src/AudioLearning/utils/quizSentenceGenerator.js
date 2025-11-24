import { parseJsonObject } from './sentenceGenerators';
import { generateVerbPracticeSentence } from '../verbPractice';

export const generateQuizSentence = async (
  difficulty,
  api,
  ensureLearningWords,
  level2Words,
  buildVerbWithDateSentenceMemo,
  buildPronounAndVerbPairMemo,
  buildNounAndAdjectiveSentenceMemo
) => {
  if (difficulty === 1) return null; // single word handled separately
  if (difficulty === 2) {
    // Level 2: Use shared verb practice algorithm
    const result = await generateVerbPracticeSentence();
    if (result && result.korean && result.english) {
      return { korean: result.korean, english: result.english };
    }
    // Fallback to prior builders if shared function fails
    const all = await ensureLearningWords();
    if (!all || all.length === 0) return null;
    const pool = (Array.isArray(level2Words) && level2Words.length > 0) ? level2Words : all;
    const hasVerbIn = (arr) => Array.isArray(arr) && arr.some(w => {
      const ko = String(w.korean || '');
      const t = String(w.type || '').toLowerCase();
      return t === 'verb' || /다$/.test(ko);
    });
    const words = hasVerbIn(pool) ? pool : all;
    const primary = buildVerbWithDateSentenceMemo(words);
    if (primary && primary.english && primary.korean) {
      return primary;
    }
    const tryBuild = async () => {
      const tryOrder = Math.random() < 0.5 ? ['pv', 'na'] : ['na', 'pv'];
      for (const kind of tryOrder) {
        for (let attempt = 0; attempt < 3; attempt++) {
          const pair = kind === 'pv' ? buildPronounAndVerbPairMemo(words) : buildNounAndAdjectiveSentenceMemo(words);
          if (pair && pair.english && pair.korean) {
            const en = String(pair.english).trim();
            const ko = String(pair.korean).trim();
            if (en.includes(' ') && ko.includes(' ')) return pair;
          }
        }
      }
      return null;
    };
    const built = await tryBuild();
    return built || { english: 'I do', korean: '나는 해요' };
  }
  // Level 3: random conversational sentence (not tied to learning words)
  try {
    const prompt = `Return ONLY JSON: {"korean":"...","english":"..."}.
Create ONE natural everyday conversational Korean sentence in polite style (ending with 요), 7–12 words.
Avoid rare terms and proper nouns; keep to common daily-life topics.
Provide an accurate English translation.`;
    const res = await api.chat(prompt);
    const data = await res.json();
    const obj = parseJsonObject(data && data.response || '');
    if (obj && obj.korean && obj.english) {
      return { korean: String(obj.korean), english: String(obj.english) };
    }
  } catch (_) {}
  // Fallback: random conversational seeds (independent of learning words)
  const seeds = [
    { korean: '오늘 저녁에 같이 밥 먹을까요?', english: "Shall we have dinner together this evening?" },
    { korean: '주말에 시간 있으시면 커피 마셔요.', english: "If you have time on the weekend, let's have coffee." },
    { korean: '이거 어떻게 사용하는지 알려줄 수 있어요?', english: "Can you show me how to use this?" },
    { korean: '어제 본 영화가 정말 재미있었어요.', english: "The movie I saw yesterday was really fun." },
    { korean: '잠깐만 기다려 주세요. 금방 올게요.', english: "Please wait a moment. I'll be right back." },
    { korean: '사진을 보내 주시면 바로 확인할게요.', english: "If you send the photo, I'll check it right away." },
    { korean: '지하철이 너무 복잡해서 조금 늦었어요.', english: "The subway was too crowded, so I'm a bit late." },
    { korean: '내일 아침 일찍 출발하는 게 어때요?', english: "How about leaving early tomorrow morning?" },
    { korean: '도와주셔서 정말 감사합니다.', english: "Thank you so much for your help." },
    { korean: '이 근처에 맛있는 식당이 있을까요?', english: "Is there a good restaurant around here?" },
  ];
  const s = seeds[Math.floor(Math.random() * seeds.length)];
  return { korean: s.korean, english: s.english };
};

