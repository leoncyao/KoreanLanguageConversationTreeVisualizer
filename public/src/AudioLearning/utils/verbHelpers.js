// Verb conjugation and sentence building helpers

export const PRONOUNS = [
  { ko: '나는', en: 'I' },
  { ko: '너는', en: 'you' },
  { ko: '우리는', en: 'we' },
  { ko: '그는', en: 'he' },
  { ko: '그녀는', en: 'she' },
  { ko: '그들은', en: 'they' },
];

export const pickRandomPronoun = () => PRONOUNS[Math.floor(Math.random() * PRONOUNS.length)];

export const endsWithBrightVowel = (stem) => /[ㅏㅗ]$/.test(stem);

export const conjugateVerbSimple = (baseForm, tense) => {
  if (!baseForm || typeof baseForm !== 'string') return baseForm;
  const stem = baseForm.endsWith('다') ? baseForm.slice(0, -1 * '다'.length) : baseForm;
  // 하다 special
  if (baseForm === '하다' || stem.endsWith('하')) {
    if (tense === 'present') return '해요';
    if (tense === 'past') return '했어요';
    return '할 거예요';
  }
  const bright = endsWithBrightVowel(stem);
  if (tense === 'present') return stem + (bright ? '아요' : '어요');
  if (tense === 'past') return stem + (bright ? '았어요' : '었어요');
  // future
  const needsEu = /[^aeiou가-힣]$/.test(stem) || /[ㄱ-ㅎ]$/.test(stem); // rough guard
  return stem + (stem.endsWith('ㄹ') ? ' 거예요' : (needsEu ? '을 거예요' : 'ㄹ 거예요'));
};

export const applyPronounAndTenseIfVerb = (wordObj, pickRandomPronounFn, conjugateVerbSimpleFn) => {
  if (!wordObj || !wordObj.korean) return wordObj;
  // Only apply if type says 'verb' (learning words) or looks like dictionary form ending in 다
  const isVerb = String(wordObj.type || '').toLowerCase() === 'verb' || /다$/.test(wordObj.korean);
  if (!isVerb) return wordObj;
  const tenses = ['present', 'past', 'future'];
  const tense = tenses[Math.floor(Math.random() * tenses.length)];
  const pron = pickRandomPronounFn();
  const conj = conjugateVerbSimpleFn(wordObj.korean, tense);
  return { ...wordObj, korean: `${pron.ko} ${conj}` };
};

export const hasFinalConsonant = (k) => {
  if (!k || typeof k !== 'string') return false;
  const ch = k.trim().slice(-1);
  const code = ch.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return false;
  const jong = code % 28;
  return jong !== 0;
};

export const pickRandomVerb = (words) => {
  const candidates = (Array.isArray(words) ? words : []).filter((w) => {
    const ko = String(w.korean || '');
    const t = String(w.type || '').toLowerCase();
    return t === 'verb' || /다$/.test(ko);
  });
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
};

export const pickRandomNoun = (words) => {
  const candidates = (Array.isArray(words) ? words : []).filter((w) => {
    const ko = String(w.korean || '');
    const t = String(w.type || '').toLowerCase();
    const looksVerb = /다$/.test(ko);
    return t === 'noun' || (!looksVerb && t !== 'verb');
  });
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
};

export const pickRandomAdjective = (words) => {
  const candidates = (Array.isArray(words) ? words : []).filter((w) => {
    const t = String(w.type || '').toLowerCase();
    const ko = String(w.korean || '');
    return t === 'adjective' || /다$/.test(ko); // heuristic for descriptive verbs
  });
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
};

export const englishPresent3rd = (base) => {
  const b = String(base || '').trim();
  const irregular = { have: 'has', do: 'does', go: 'goes', be: 'is' };
  if (irregular[b]) return irregular[b];
  if (/[^aeiou]y$/i.test(b)) return b.replace(/y$/i, 'ies');
  if (/(s|x|z|ch|sh)$/i.test(b)) return b + 'es';
  return b + 's';
};

export const englishPast = (base) => {
  const b = String(base || '').trim();
  const irregular = { go: 'went', have: 'had', do: 'did', be: 'was', eat: 'ate', see: 'saw', make: 'made', take: 'took', come: 'came', get: 'got', say: 'said', write: 'wrote', read: 'read' };
  if (irregular[b]) return irregular[b];
  if (/e$/i.test(b)) return b + 'd';
  if (/[^aeiou]y$/i.test(b)) return b.replace(/y$/i, 'ied');
  return b + 'ed';
};

export const buildSubjectAndVerbPair = (words, pickRandomPronounFn, pickRandomNounFn, pickRandomVerbFn, hasFinalConsonantFn, conjugateVerbSimpleFn, englishPresent3rdFn, englishPastFn) => {
  // Pick subject: 50% pronoun, else noun from words (fallback to pronoun)
  let subjectKo = '';
  let subjectEn = '';
  let thirdPersonSingular = false;
  const usePronoun = Math.random() < 0.5;
  if (usePronoun) {
    const p = pickRandomPronounFn();
    subjectKo = p.ko; subjectEn = p.en;
    thirdPersonSingular = /^(he|she|it)$/i.test(p.en);
  } else {
    const n = pickRandomNounFn(words);
    if (n) {
      const particle = hasFinalConsonantFn(String(n.korean || '')) ? '은' : '는';
      subjectKo = `${String(n.korean || '').trim()} ${particle}`.trim();
      subjectEn = String(n.english || String(n.korean || ''));
      thirdPersonSingular = true;
    } else {
      const pFallback = pickRandomPronounFn();
      subjectKo = pFallback.ko; subjectEn = pFallback.en;
      thirdPersonSingular = /^(he|she|it)$/i.test(pFallback.en);
    }
  }

  // Pick verb
  const v = pickRandomVerbFn(words);
  if (!v) return null;
  const verbKoBase = String(v.korean || '');
  const verbEnBase = String(v.english || '').replace(/^to\s+/i, '').split(/[;,]/)[0].trim() || 'do';
  const tenses = ['present', 'past', 'future'];
  const tense = tenses[Math.floor(Math.random() * tenses.length)];
  const koVerb = conjugateVerbSimpleFn(verbKoBase, tense);
  let enVerb = '';
  if (tense === 'present') {
    enVerb = thirdPersonSingular ? englishPresent3rdFn(verbEnBase) : verbEnBase;
  } else if (tense === 'past') {
    enVerb = englishPastFn(verbEnBase);
  } else {
    enVerb = `will ${verbEnBase}`;
  }
  const english = `${subjectEn} ${enVerb}`.trim();
  const korean = `${subjectKo} ${koVerb}`.trim();
  return { english, korean };
};

export const buildPronounAndVerbPair = (words, pickRandomPronounFn, pickRandomVerbFn, conjugateVerbSimpleFn, englishPresent3rdFn, englishPastFn) => {
  const p = pickRandomPronounFn();
  const v = pickRandomVerbFn(words);
  if (!v) return null;
  const verbKoBase = String(v.korean || '');
  const verbEnBase = String(v.english || '').replace(/^to\s+/i, '').split(/[;,]/)[0].trim() || 'do';
  const tenses = ['present', 'past', 'future'];
  const tense = tenses[Math.floor(Math.random() * tenses.length)];
  const koVerb = conjugateVerbSimpleFn(verbKoBase, tense);
  let enVerb = '';
  if (tense === 'present') {
    enVerb = /^(he|she|it)$/i.test(p.en) ? englishPresent3rdFn(verbEnBase) : verbEnBase;
  } else if (tense === 'past') {
    enVerb = englishPastFn(verbEnBase);
  } else {
    enVerb = `will ${verbEnBase}`;
  }
  const english = `${p.en} ${enVerb}`.trim();
  const korean = `${p.ko} ${koVerb}`.trim();
  return { english, korean };
};

export const buildVerbWithDateSentence = (words, pickRandomPronounFn, pickRandomVerbFn, conjugateVerbSimpleFn, englishPresent3rdFn, englishPastFn) => {
  const p = pickRandomPronounFn();
  const v = pickRandomVerbFn(words);
  if (!v) return null;
  const verbKoBase = String(v.korean || '');
  const verbEnBase = String(v.english || '').replace(/^to\s+/i, '').split(/[;,]/)[0].trim() || 'do';
  // Pick date modifier and map to tense
  const choices = [
    { ko: '오늘', en: 'today', tense: 'present' },
    { ko: '어제', en: 'yesterday', tense: 'past' },
    { ko: '내일', en: 'tomorrow', tense: 'future' },
  ];
  const mod = choices[Math.floor(Math.random() * choices.length)];
  const koVerb = conjugateVerbSimpleFn(verbKoBase, mod.tense);
  let enVerb = '';
  if (mod.tense === 'present') {
    enVerb = /^(he|she|it)$/i.test(p.en) ? englishPresent3rdFn(verbEnBase) : verbEnBase;
  } else if (mod.tense === 'past') {
    enVerb = englishPastFn(verbEnBase);
  } else {
    enVerb = `will ${verbEnBase}`;
  }
  // Compose sentences
  const korean = `${mod.ko} ${p.ko} ${koVerb}`.trim();
  const english = `${p.en} ${enVerb} ${mod.en}`.trim();
  return { english, korean };
};

export const buildNounAndAdjectiveSentence = (words, pickRandomNounFn, pickRandomAdjectiveFn, hasFinalConsonantFn, conjugateVerbSimpleFn) => {
  const n = pickRandomNounFn(words);
  const a = pickRandomAdjectiveFn(words);
  if (!n || !a) return null;
  const nounKo = String(n.korean || '').trim();
  const nounEn = String(n.english || String(n.korean || '')).trim();
  const particle = hasFinalConsonantFn(nounKo) ? '은' : '는';
  const adjKoBase = String(a.korean || '').trim();
  const adjEnBaseRaw = String(a.english || '').trim();
  // Conjugate adjective to present polite
  const koAdj = conjugateVerbSimpleFn(adjKoBase, 'present');
  // Heuristic: strip leading "to be " or "be " to get adjective gloss
  let adjEn = adjEnBaseRaw.replace(/^to\s+be\s+/i, '').replace(/^be\s+/i, '');
  // Build sentences
  const korean = `${nounKo} ${particle} ${koAdj}`.trim();
  const english = `The ${nounEn} is ${adjEn}`.trim();
  return { english, korean };
};

