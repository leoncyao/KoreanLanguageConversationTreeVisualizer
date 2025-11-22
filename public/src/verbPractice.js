// Shared verb practice generation algorithm for Level 2 / Verb Practice mode
import { api } from './api';

/**
 * Generate a verb practice sentence using the Level 2 algorithm
 * @param {Object} options - Optional parameters
 * @param {string} options.dateModifier - Specific date modifier to use (오늘, 어제, 내일). If not provided, randomly selected.
 * @param {string} options.pronoun - Specific pronoun to use (나, 너, 우리, 그, 그녀, 그들). If not provided, randomly selected.
 * @returns {Promise<{korean: string, english: string} | null>}
 */
export async function generateVerbPracticeSentence(options = {}) {
  try {
    // Get learning words
    const response = await api.getLearningWords(200);
    if (!response.ok) return null;
    const all = await response.json().catch(() => []);
    if (!Array.isArray(all) || all.length === 0) return null;

    // Filter verbs
    const verbs = all.filter((w) => {
      const ko = String(w.korean || '');
      const t = String(w.type || '').toLowerCase();
      return t === 'verb' || /다$/.test(ko);
    }).slice(0, 20);

    if (verbs.length === 0) return null;

    // Try AI generation first
    try {
      // Select a random verb to emphasize variety
      const selectedVerb = verbs[Math.floor(Math.random() * verbs.length)];
      const selectedVerbKorean = String(selectedVerb.korean || '').trim();
      const selectedVerbEnglish = String(selectedVerb.english || '').replace(/^to\s+/i,'').trim();
      
      // Create verb list with the selected verb first
      const verbList = verbs.map(v => `${String(v.korean || '').trim()} (${String(v.english || '').replace(/^to\s+/i,'').trim()})`).filter(Boolean).join(', ');
      
      // Use provided date modifier and pronoun, or random
      const dateModifiers = ['오늘', '어제', '내일'];
      const pronouns = ['나', '너', '우리', '그', '그녀', '그들'];
      const dateMod = options.dateModifier || dateModifiers[Math.floor(Math.random() * dateModifiers.length)];
      const pronoun = options.pronoun || pronouns[Math.floor(Math.random() * pronouns.length)];
      
      const prompt = `Return ONLY JSON: {"korean":"...","english":"..."}.
Create ONE natural Korean sentence (polite style) that includes exactly one date modifier from [오늘, 어제, 내일] and a simple subject pronoun (나/너/우리/그/그녀/그들).
IMPORTANT: Use the verb "${selectedVerbKorean}" (${selectedVerbEnglish}) in this sentence. If you must use a different verb, choose a different one from this list: ${verbList || '(any common verb)'}.

CRITICAL: For any numbers in the Korean sentence, use Korean words:
- For time (시, 시간): use Native Korean (하나, 둘, 셋, 넷, 다섯, 여섯, 일곱, 여덟, 아홉, 열, etc.). Example: "9시" should be "아홉 시", not "9 시"
- For counting objects: use Native Korean (하나, 둘, 셋, etc.)
- For dates, money, general counting: use Sino-Korean (일, 이, 삼, 사, 오, 육, 칠, 팔, 구, 십, etc.)
NEVER use Arabic numerals (1, 2, 3, etc.) in Korean text - always convert to Korean words.

CRITICAL CONJUGATION RULES - You MUST conjugate irregular verbs correctly:

1. ㅂ irregular verbs:
   - 춥다 → present: 추워요, past: 추웠어요 (NOT 추어요/추었어요)
   - 쉽다 → present: 쉬워요, past: 쉬웠어요
   - 아름답다 → present: 아름다워요, past: 아름다웠어요

2. ㄷ irregular verbs:
   - 듣다 → present: 들어요, past: 들었어요 (NOT 듣어요/듣었어요)
   - 걷다 → present: 걸어요, past: 걸었어요

3. 르 irregular verbs (CRITICAL - these are often wrong):
   - 모르다 → present: 몰라요, past: 몰랐어요 (NOT 모르어요/모르었어요)
   - 부르다 → present: 불러요, past: 불렀어요 (NOT 부르어요/부르었어요)
   - 빠르다 → present: 빨라요, past: 빨랐어요
   - 다르다 → present: 달라요, past: 달랐어요
   - Rule: Remove ㄹ, add ㄹ라/ㄹ러 for present, ㄹ랐/ㄹ렀 for past

4. ㅅ irregular verbs:
   - 낫다 → present: 나아요, past: 나았어요 (NOT 낫어요)
   - 짓다 → present: 지어요, past: 지었어요

5. Regular verbs: follow standard 아요/어요 rules based on vowel harmony

Conjugate the verb correctly based on tense:
- 오늘 → present tense (…아요/어요/워요/라요/etc. depending on verb type)
- 어제 → past tense (…았어요/었어요/였어요/웠어요/랐어요/etc.)
- 내일 → future tense (…(으)ㄹ 거예요)

VERY IMPORTANT: For "${selectedVerbKorean}", check if it's irregular and conjugate accordingly. Double-check your conjugation before returning.

Keep it <= 10 words. Provide the English translation matching the tense.`;
      
      const res = await api.chat(prompt);
      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        const m = data && data.response && data.response.match(/\{[\s\S]*\}/);
        if (m && m[0]) {
          try {
            const obj = JSON.parse(m[0]);
            if (obj && obj.korean && obj.english) {
              const koreanSentence = String(obj.korean).trim();
              
              // Verify conjugation correctness using AI
              try {
                const verificationPrompt = `You are a Korean language expert. Verify if this Korean sentence has correct verb conjugation.

Sentence: "${koreanSentence}"
Base verb used: "${selectedVerbKorean}" (${selectedVerbEnglish})

Check if the verb conjugation is correct, especially for irregular verbs:

1. ㅂ irregular: 춥다 → 추워요/추웠어요 (NOT 추어요/추었어요)
2. ㄷ irregular: 듣다 → 들어요/들었어요 (NOT 듣어요/듣었어요)
3. 르 irregular (CRITICAL): 
   - 모르다 → 몰라요/몰랐어요 (NOT 모르어요/모르었어요)
   - 부르다 → 불러요/불렀어요 (NOT 부르어요/부르었어요)
   - 빠르다 → 빨라요/빨랐어요
   - 다르다 → 달라요/달랐어요
4. ㅅ irregular: 낫다 → 나아요/나았어요 (NOT 낫어요)

Common mistakes to check:
- 모르다 past tense MUST be 몰랐어요, NOT 모르었어요
- 부르다 past tense MUST be 불렀어요, NOT 부르었어요
- 르 irregular verbs: remove ㄹ and add appropriate ending

Return ONLY JSON: {"correct": true/false, "issue": "description if incorrect, empty if correct"}`;
                
                const verifyRes = await api.chat(verificationPrompt);
                if (verifyRes && verifyRes.ok) {
                  const verifyData = await verifyRes.json().catch(() => null);
                  const verifyMatch = verifyData && verifyData.response && verifyData.response.match(/\{[\s\S]*\}/);
                  if (verifyMatch && verifyMatch[0]) {
                    const verifyObj = JSON.parse(verifyMatch[0]);
                    if (verifyObj && verifyObj.correct === false) {
                      console.warn('AI detected incorrect conjugation:', verifyObj.issue);
                      // Regenerate with more explicit instructions
                      const correctedPrompt = `Return ONLY JSON: {"korean":"...","english":"..."}.
Create ONE natural Korean sentence (polite style) that includes exactly one date modifier from [오늘, 어제, 내일] and a simple subject pronoun (나/너/우리/그/그녀/그들).

MUST use the verb "${selectedVerbKorean}" (${selectedVerbEnglish}) and conjugate it CORRECTLY.

SPECIFIC CONJUGATION FOR "${selectedVerbKorean}":
${selectedVerbKorean.endsWith('춥다') ? '- This is a ㅂ irregular verb. Conjugate as: 춥다 → 추워요 (present), 추웠어요 (past), 추울 거예요 (future). NEVER use 추어요 or 추었어요.' : ''}
${selectedVerbKorean.endsWith('쉽다') ? '- This is a ㅂ irregular verb. Conjugate as: 쉽다 → 쉬워요 (present), 쉬웠어요 (past), 쉬울 거예요 (future). NEVER use 쉬어요 or 쉬었어요.' : ''}
${selectedVerbKorean.endsWith('아름답다') ? '- This is a ㅂ irregular verb. Conjugate as: 아름답다 → 아름다워요 (present), 아름다웠어요 (past), 아름다울 거예요 (future).' : ''}
${selectedVerbKorean.endsWith('듣다') ? '- This is a ㄷ irregular verb. Conjugate as: 듣다 → 들어요 (present), 들었어요 (past), 들을 거예요 (future). NEVER use 듣어요 or 듣었어요.' : ''}
${selectedVerbKorean.endsWith('걷다') ? '- This is a ㄷ irregular verb. Conjugate as: 걷다 → 걸어요 (present), 걸었어요 (past), 걸을 거예요 (future). NEVER use 걷어요 or 걷었어요.' : ''}
${selectedVerbKorean.endsWith('모르다') ? '- This is a 르 irregular verb. CRITICAL: Conjugate as: 모르다 → 몰라요 (present), 몰랐어요 (past), 모를 거예요 (future). NEVER use 모르어요, 모르었어요, or 모르었어요. The past tense MUST be 몰랐어요.' : ''}
${selectedVerbKorean.endsWith('부르다') ? '- This is a 르 irregular verb. CRITICAL: Conjugate as: 부르다 → 불러요 (present), 불렀어요 (past), 부를 거예요 (future). NEVER use 부르어요 or 부르었어요. The past tense MUST be 불렀어요.' : ''}
${selectedVerbKorean.endsWith('빠르다') ? '- This is a 르 irregular verb. Conjugate as: 빠르다 → 빨라요 (present), 빨랐어요 (past), 빠를 거예요 (future).' : ''}
${selectedVerbKorean.endsWith('다르다') ? '- This is a 르 irregular verb. Conjugate as: 다르다 → 달라요 (present), 달랐어요 (past), 다를 거예요 (future).' : ''}
${selectedVerbKorean.endsWith('낫다') ? '- This is a ㅅ irregular verb. Conjugate as: 낫다 → 나아요 (present), 나았어요 (past), 나을 거예요 (future). NEVER use 낫어요 or 낫었어요.' : ''}
${!selectedVerbKorean.match(/춥다|쉽다|아름답다|듣다|걷다|모르다|부르다|빠르다|다르다|낫다/) ? '- Check if this verb has irregular conjugation patterns (ㅂ, ㄷ, 르, ㅅ irregular). If regular, use standard 아요/어요 rules.' : ''}

Tense rules:
- 오늘 → present tense
- 어제 → past tense  
- 내일 → future tense

Keep it <= 10 words. Provide the English translation matching the tense.`;
                      
                      const correctedRes = await api.chat(correctedPrompt);
                      if (correctedRes && correctedRes.ok) {
                        const correctedData = await correctedRes.json().catch(() => null);
                        const correctedMatch = correctedData && correctedData.response && correctedData.response.match(/\{[\s\S]*\}/);
                        if (correctedMatch && correctedMatch[0]) {
                          const correctedObj = JSON.parse(correctedMatch[0]);
                          if (correctedObj && correctedObj.korean && correctedObj.english) {
                            console.log('Using corrected conjugation');
                            return { 
                              korean: String(correctedObj.korean).trim(), 
                              english: String(correctedObj.english).trim() 
                            };
                          }
                        }
                      }
                    }
                  }
                }
              } catch (verifyErr) {
                console.warn('Verification step failed, using original:', verifyErr);
              }
              
              return { 
                korean: koreanSentence, 
                english: String(obj.english).trim() 
              };
            }
          } catch (_) {}
        }
      }
    } catch (_) {}

    // Fallback: simple verb sentence (same as PracticePage fallback)
    const verb = verbs[Math.floor(Math.random() * verbs.length)];
    const tenses = ['present', 'past', 'future'];
    const tense = tenses[Math.floor(Math.random() * tenses.length)];
    
    // Simple conjugation helper
    const conjugateVerbSimple = (baseForm, tense) => {
      if (!baseForm || typeof baseForm !== 'string') return baseForm;
      const stem = baseForm.endsWith('다') ? baseForm.slice(0, -1) : baseForm;
      
      // 하다 special case
      if (baseForm === '하다' || stem.endsWith('하')) {
        if (tense === 'present') return '해요';
        if (tense === 'past') return '했어요';
        return '할 거예요';
      }
      
      const endsWithBrightVowel = (s) => /[ㅏㅗ]$/.test(s);
      const bright = endsWithBrightVowel(stem);
      
      if (tense === 'present') return stem + (bright ? '아요' : '어요');
      if (tense === 'past') return stem + (bright ? '았어요' : '었어요');
      
      // future
      const needsEu = /[^aeiou가-힣]$/.test(stem) || /[ㄱ-ㅎ]$/.test(stem);
      return stem + (stem.endsWith('ㄹ') ? ' 거예요' : (needsEu ? '을 거예요' : 'ㄹ 거예요'));
    };
    
    const PRONOUNS = [
      { ko: '나는', en: 'I' },
      { ko: '너는', en: 'you' },
      { ko: '우리는', en: 'we' },
      { ko: '그는', en: 'he' },
      { ko: '그녀는', en: 'she' },
      { ko: '그들은', en: 'they' },
    ];
    
    const pron = PRONOUNS[Math.floor(Math.random() * PRONOUNS.length)];
    const conj = conjugateVerbSimple(verb.korean, tense);
    const korean = `${pron.ko} ${conj}`;
    const english = `${pron.en} ${verb.english || 'do'}${tense === 'past' ? 'ed' : tense === 'future' ? ' will' : ''}`;
    
    return { korean: korean.trim(), english: english.trim() };
  } catch (e) {
    console.error('Error generating verb practice sentence:', e);
    return null;
  }
}

