import React, { useState, useEffect, useCallback } from 'react';
import { api } from './api';
import './HomePage.css';

const SPEAK_ADVANCE_DELAY_MS = 1200;

const escapeHtml = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const mdToHtml = (md) => {
  if (!md) return '';
  let txt = escapeHtml(md);
  txt = txt.replace(/```([\s\S]*?)```/g, (m, p1) => `<pre><code>${p1}</code></pre>`);
  txt = txt.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  txt = txt.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
  txt = txt.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
           .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
           .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
  txt = txt.replace(/^(?:[-*])\s+(.+)$/gm, '<li>$1</li>');
  txt = txt.replace(/(<li>[\s\S]*?<\/li>)/g, (m) => `<ul>${m}</ul>`);
  const parts = txt.split(/<pre>[\s\S]*?<\/pre>/g);
  const preMatches = txt.match(/<pre>[\s\S]*?<\/pre>/g) || [];
  const htmlParts = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]
      .split(/\n{2,}/)
      .map(seg => seg.trim() ? `<p>${seg.replace(/\n/g, '<br>')}</p>` : '')
      .join('');
    htmlParts.push(p);
    if (preMatches[i]) htmlParts.push(preMatches[i]);
  }
  return htmlParts.join('');
};

function CurriculumPracticePage() {
  const [currentPhrase, setCurrentPhrase] = useState(null);
  const [inputValues, setInputValues] = useState([]); // Array of input values for multiple blanks
  const [currentBlankIndex, setCurrentBlankIndex] = useState(0); // Which blank we're currently filling
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false); // Start as false, will be set to true when fetching
  const [error, setError] = useState(null);
  const [inputPlaceholder, setInputPlaceholder] = useState('');
  const [showExplanation, setShowExplanation] = useState(false);
  const [explanationText, setExplanationText] = useState('');
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);
  const [explanationPhraseId, setExplanationPhraseId] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [usedPhraseIds, setUsedPhraseIds] = useState([]); // Track which phrases we've used
  const [allPhrases, setAllPhrases] = useState([]); // Store all curriculum phrases
  const [usingVariations, setUsingVariations] = useState(false); // Whether we're in variation mode
  const [sessionNoTrack, setSessionNoTrack] = useState(false); // Session flag: do not track stats for remixed/new sentences
  const SESSION_SIZE = 5;
  const [sessionPhrases, setSessionPhrases] = useState([]); // Fixed subset for this session
  const [level, setLevel] = useState(1); // 1, 2, 3 -> number of blanks

  const createBlankPhrase = useCallback((phrase) => {
    if (!phrase) return { korean: '', blanks: [], translation: '', correct_answers: [] };
    
    const koreanWords = phrase.korean_text.trim().split(' ').filter(w => w);
    
    // Get blank indices - support both new format (blank_word_indices) and old format (blank_word_index)
    let blankIndices = phrase.blank_word_indices || [];
    if (blankIndices.length === 0 && phrase.blank_word_index !== null && phrase.blank_word_index !== undefined) {
      blankIndices = [phrase.blank_word_index];
    }
    
    // Apply level: ensure we have N blanks based on level; derive if missing
    const desiredBlanks = Math.max(1, Math.min(3, Number(level) || 1));
    if (blankIndices.length === 0) {
      // Derive blanks by picking N indices from middle of the sentence (stable, not random)
      const n = Math.min(desiredBlanks, Math.max(1, Math.floor(koreanWords.length / 3)));
      const step = Math.max(1, Math.floor(koreanWords.length / (n + 1)));
      const derived = [];
      for (let i = 1; i <= n; i++) {
        const idx = Math.min(koreanWords.length - 1, i * step);
        if (!derived.includes(idx)) derived.push(idx);
      }
      blankIndices = derived;
    } else {
      // Respect existing blanks but cap to level
      blankIndices = blankIndices.slice(0, desiredBlanks);
    }

    // Sort indices in descending order to replace from end to start
    const sortedIndices = [...blankIndices].sort((a, b) => b - a);
    const result = [...koreanWords];
    const blankWords = [];
    
    // Replace selected words with [BLANK] and collect the blank words
    sortedIndices.forEach(idx => {
      if (idx >= 0 && idx < result.length) {
        blankWords.unshift(koreanWords[idx]); // unshift to maintain original order
        result[idx] = '[BLANK]';
      }
    });
    
    const koreanWithBlanks = result.join(' ');
    
    // Get correct answers - use stored correct_answers or derive from blank words
    const correctAnswers = Array.isArray(phrase.correct_answers) && phrase.correct_answers.length > 0
      ? phrase.correct_answers
      : blankWords;
    
    return {
      korean: koreanWithBlanks,
      blanks: blankWords,
      blankIndices: blankIndices.sort((a, b) => a - b),
      translation: phrase.english_text,
      correct_answers: correctAnswers,
      id: phrase.id
    };
  }, []);

  const blankPhrase = currentPhrase ? createBlankPhrase(currentPhrase) : null;

  // Choose next phrase from locally loaded curriculum, without refetching
  const selectNextCurriculumPhrase = useCallback(() => {
    // Work from the fixed session subset; when exhausted, loop the same subset
    const pool = Array.isArray(sessionPhrases) && sessionPhrases.length > 0 ? sessionPhrases : allPhrases;
    if (!Array.isArray(pool) || pool.length === 0) return false;
    const used = new Set(usedPhraseIds);
    let next = pool.find((p) => !used.has(p.id));
    if (!next) {
      // Reset and start again from the same 5
      setUsedPhraseIds([]);
      next = pool[0];
    }
    setUsedPhraseIds((prev) => prev.includes(next.id) ? prev : [...prev, next.id]);
    setCurrentPhrase(next);
    setUsingVariations(false);
    return true;
  }, [sessionPhrases, allPhrases, usedPhraseIds]);

  // Extract first JSON object from a chat response
  const parseJsonObject = useCallback((text) => {
    if (!text) return null;
    const m = String(text).match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { const obj = JSON.parse(m[0]); return obj && typeof obj === 'object' ? obj : null; } catch (_) { return null; }
  }, []);

  // Remix current sentence: keep POS order, replace words/grammar; enter no-track mode
  const handleRemixSentence = useCallback(async () => {
    try {
      const en = String(currentPhrase?.english_text || '').trim();
      const ko = String(currentPhrase?.korean_text || '').trim();
      if (!en || !ko) return;
      setSessionNoTrack(true);
      const prompt = `Create ONE new sentence pair (Korean + English) by REMIXING the content of the given sentence while preserving the sequence of parts of speech (POS) and clause order. Keep it natural and grammatical. Replace verbs, nouns, adjectives, tenses, and particles as needed, but mirror the original POS silhouette. Return ONLY JSON with these keys: {"korean":"…","english":"…"}.\nOriginal (EN): ${en}\nOriginal (KO): ${ko}`;
      const res = await api.chat(prompt);
      const data = await res.json().catch(() => null);
      const obj = parseJsonObject(data && (data.response || ''));
      if (obj && obj.korean && obj.english) {
        setCurrentPhrase({ id: `remix-${Date.now()}`, korean_text: String(obj.korean), english_text: String(obj.english), times_correct: 0 });
        setFeedback('');
        setInputPlaceholder('');
        setInputValues([]);
        setCurrentBlankIndex(0);
        setShowAnswer(false);
      }
    } catch (_) {}
  }, [currentPhrase, parseJsonObject]);

  // Add the current sentence to curriculum (manual save)
  const handleAddCurrentToCurriculum = useCallback(async () => {
    try {
      const en = String(currentPhrase?.english_text || '').trim();
      const ko = String(currentPhrase?.korean_text || '').trim();
      if (!en || !ko) return;
      const res = await api.addCurriculumPhrase({ korean_text: ko, english_text: en });
      if (res.ok) {
        setFeedback('Added to curriculum ✓');
      } else {
        const t = await res.text().catch(() => '');
        setFeedback('Failed to add to curriculum' + (t ? `: ${t}` : ''));
      }
    } catch (e) {
      setFeedback('Failed to add to curriculum');
    }
  }, [currentPhrase]);

  const speakText = useCallback((text, onEnd, repeatCount = 3) => {
    try {
      const synth = window.speechSynthesis;
      if (!synth || window.__APP_MUTED__ === true) {
        setTimeout(() => { if (onEnd) onEnd(); }, SPEAK_ADVANCE_DELAY_MS);
        return;
      }
      
      synth.cancel();
      
      let currentRepeat = 0;
      const globalSpeed = window.__APP_SPEECH_SPEED__ || 1.0;
      const speakOnce = () => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ko-KR';
        utterance.rate = 0.6 * globalSpeed;
        utterance.onend = () => {
          currentRepeat++;
          if (currentRepeat < repeatCount) {
            setTimeout(() => speakOnce(), 500);
          } else {
            setTimeout(() => { if (onEnd) onEnd(); }, SPEAK_ADVANCE_DELAY_MS);
          }
        };
        synth.speak(utterance);
      };
      
      speakOnce();
    } catch (e) {
      setTimeout(() => { if (onEnd) onEnd(); }, SPEAK_ADVANCE_DELAY_MS);
    }
  }, []);

  // Load all curriculum phrases on mount
  const loadAllPhrases = useCallback(async () => {
    try {
      const response = await api.getCurriculumPhrases();
      if (!response.ok) {
        console.error('Failed to load phrases');
        return;
      }
      const phrases = await response.json();
      const list = Array.isArray(phrases) ? phrases : [];
      setAllPhrases(list);
      console.log('Loaded', list.length, 'curriculum phrases');
      // Initialize fixed session subset (repeat these)
      const shuffled = [...list].sort(() => Math.random() - 0.5);
      const subset = shuffled.slice(0, Math.min(SESSION_SIZE, shuffled.length));
      setSessionPhrases(subset);
      setUsedPhraseIds([]);
      if (subset.length > 0) {
        setCurrentPhrase(subset[0]);
      }
    } catch (e) {
      console.error('Error loading phrases:', e);
    }
  }, []);

  // Generate a variation of a phrase using AI
  const generateVariation = useCallback(async (basePhrase) => {
    try {
      console.log('Generating variation for phrase:', basePhrase.id);
      
      // Get words by type for each blank
      const blankIndices = basePhrase.blank_word_indices || [];
      const blankTypes = basePhrase.blank_word_types || [];
      
      // Fetch words for each blank type
      const wordOptions = {};
      for (let i = 0; i < blankTypes.length; i++) {
        const wordType = blankTypes[i];
        if (!wordType) continue;
        
        if (!wordOptions[wordType]) {
          try {
            const wordsRes = await api.getWordsByType(wordType, 50);
            if (wordsRes.ok) {
              const words = await wordsRes.json();
              wordOptions[wordType] = words.map(w => w.korean || w.korean_word).filter(Boolean);
            }
          } catch (e) {
            console.error(`Failed to fetch ${wordType} words:`, e);
          }
        }
      }
      
      // Build prompt for AI to generate variation
      const koreanWords = basePhrase.korean_text.trim().split(' ').filter(w => w);
      const blankInfo = blankIndices.map((idx, i) => {
        const word = koreanWords[idx];
        const type = blankTypes[i] || 'unknown';
        const options = wordOptions[type] || [];
        return {
          index: idx,
          word: word,
          type: type,
          options: options.slice(0, 10).join(', ') // Top 10 options
        };
      });
      
      const prompt = `Generate a Korean sentence variation by replacing some blank words in this sentence.

Original Korean: ${basePhrase.korean_text}
Original English: ${basePhrase.english_text}

Blank words to replace:
${blankInfo.map((b, i) => `Blank ${i + 1} (index ${b.index}): "${b.word}" (type: ${b.type}). Suggested replacements: ${b.options || 'any appropriate ' + b.type}`).join('\n')}

Generate a new Korean sentence with the same structure and meaning, but replace one or more of the blank words with other appropriate words of the same type. Keep the sentence grammatically correct and natural.

Respond with ONLY a JSON object in this format:
{
  "korean_text": "new sentence with replaced words",
  "english_text": "translation of new sentence",
  "replaced_blanks": [list of blank indices that were replaced]
}`;

      let chatRes;
      try {
        chatRes = await api.chat(prompt);
      } catch (fetchError) {
        console.error('Network error calling chat API:', fetchError);
        throw new Error('Failed to connect to AI service. Please make sure the backend server is running.');
      }
      
      if (!chatRes.ok) {
        const errorText = await chatRes.text().catch(() => '');
        throw new Error(`AI service returned error: ${chatRes.status}${errorText ? ` - ${errorText}` : ''}`);
      }
      
      const chatData = await chatRes.json();
      const responseText = chatData.response || '';
      
      // Extract JSON from response - try to find the first complete JSON object
      let variation = null;
      let jsonStart = responseText.indexOf('{');
      
      if (jsonStart === -1) {
        throw new Error('No JSON object found in response');
      }
      
      // Find the matching closing brace by counting braces
      let braceCount = 0;
      let jsonEnd = -1;
      for (let i = jsonStart; i < responseText.length; i++) {
        if (responseText[i] === '{') {
          braceCount++;
        } else if (responseText[i] === '}') {
          braceCount--;
          if (braceCount === 0) {
            jsonEnd = i + 1;
            break;
          }
        }
      }
      
      if (jsonEnd === -1) {
        throw new Error('Incomplete JSON object in response');
      }
      
      const jsonString = responseText.substring(jsonStart, jsonEnd);
      try {
        variation = JSON.parse(jsonString);
      } catch (parseError) {
        console.error('JSON parsing error:', parseError);
        console.error('Attempted to parse:', jsonString);
        throw new Error(`Failed to parse JSON: ${parseError.message}`);
      }
      
      // Create a new phrase object based on the variation
      const newPhrase = {
        ...basePhrase,
        korean_text: variation.korean_text,
        english_text: variation.english_text,
        id: `variation-${Date.now()}`, // Temporary ID for variations
        // Ensure blank_word_indices, correct_answers, and blank_word_types are preserved
        blank_word_indices: basePhrase.blank_word_indices || [],
        correct_answers: basePhrase.correct_answers || [],
        blank_word_types: basePhrase.blank_word_types || []
      };
      
      console.log('[VARIATION] Created variation phrase object:', {
        id: newPhrase.id,
        korean_text: newPhrase.korean_text,
        english_text: newPhrase.english_text,
        blank_word_indices: newPhrase.blank_word_indices,
        correct_answers: newPhrase.correct_answers,
        blank_word_types: newPhrase.blank_word_types,
        has_grammar_breakdown: !!newPhrase.grammar_breakdown
      });
      
      // Immediately add the variation to the curriculum
      console.log('[VARIATION] ===== Adding variation to curriculum immediately =====');
      try {
        const phraseData = {
          korean_text: newPhrase.korean_text,
          english_text: newPhrase.english_text,
          blank_word_indices: newPhrase.blank_word_indices || [],
          correct_answers: newPhrase.correct_answers || [],
          grammar_breakdown: newPhrase.grammar_breakdown || null,
          blank_word_types: newPhrase.blank_word_types || []
        };
        console.log('[VARIATION] Sending variation data to API:', JSON.stringify(phraseData, null, 2));
        
        const addRes = await api.addCurriculumPhrase(phraseData);
        console.log('[VARIATION] Add to curriculum API response status:', addRes.status, addRes.statusText);
        console.log('[VARIATION] Add to curriculum API response ok:', addRes.ok);
        
        if (addRes.ok) {
          const responseData = await addRes.json().catch(() => null);
          console.log('[VARIATION] Add to curriculum API response data:', responseData);
          
          // Update the variation object with the actual database ID
          if (responseData && responseData.id) {
            newPhrase.id = responseData.id;
            newPhrase.db_id = responseData.id;
            console.log('[VARIATION] ✓ Variation added to curriculum with ID:', responseData.id);
          } else {
            console.log('[VARIATION] ✓ Variation added to curriculum (response ID not found)');
          }
          
          // Reload phrases list to include the new one
          console.log('[VARIATION] Reloading phrases list...');
          const phrasesRes = await api.getCurriculumPhrases();
          if (phrasesRes.ok) {
            const phrases = await phrasesRes.json();
            console.log('[VARIATION] Loaded phrases count:', Array.isArray(phrases) ? phrases.length : 0);
            setAllPhrases(Array.isArray(phrases) ? phrases : []);
            console.log('[VARIATION] ✓ Phrases list reloaded');
          }
        } else {
          const errorText = await addRes.text().catch(() => '');
          console.error('[VARIATION] ✗ Failed to add variation to curriculum');
          console.error('[VARIATION] Error status:', addRes.status);
          console.error('[VARIATION] Error text:', errorText);
        }
      } catch (addError) {
        console.error('[VARIATION] ✗ Exception while adding variation to curriculum:', addError);
        console.error('[VARIATION] Error stack:', addError.stack);
      }
      console.log('[VARIATION] ===== Finished adding variation to curriculum =====');
      
      return newPhrase;
    } catch (e) {
      console.error('Error generating variation:', e);
      throw e;
    }
  }, [setAllPhrases]);

  const fetchRandomPhrase = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      let data;
      
      // First, try to use an unused phrase from our list
      if (allPhrases.length > 0) {
        const unusedPhrases = allPhrases.filter(p => !usedPhraseIds.includes(p.id));
        
        if (unusedPhrases.length > 0) {
          // Pick a random unused phrase
          const randomIndex = Math.floor(Math.random() * unusedPhrases.length);
          const selectedPhrase = unusedPhrases[randomIndex];
          
          console.log('Using phrase from curriculum:', selectedPhrase.id);
          data = selectedPhrase;
          setUsedPhraseIds(prev => [...prev, selectedPhrase.id]);
          setUsingVariations(false);
        } else {
          // All phrases used, generate a variation
          console.log('All phrases used, generating variation...');
          setUsingVariations(true);
          
          // Pick a random base phrase to vary
          const randomBaseIndex = Math.floor(Math.random() * allPhrases.length);
          const basePhrase = allPhrases[randomBaseIndex];
          
          try {
            // Generate variation
            data = await generateVariation(basePhrase);
            console.log('Generated variation:', data);
          } catch (variationError) {
            console.error('Failed to generate variation:', variationError);
            // If AI generation fails, reset used phrases and cycle through again
            // This prevents getting stuck when AI is unavailable
            setUsedPhraseIds([]);
            setUsingVariations(false);
            
            // Pick a random phrase from the list
            const fallbackIndex = Math.floor(Math.random() * allPhrases.length);
            data = allPhrases[fallbackIndex];
            setUsedPhraseIds([data.id]);
            
            throw new Error(`Failed to generate AI variation: ${variationError.message}. Cycling through curriculum phrases again.`);
          }
        }
      } else {
        // Fallback to API if we haven't loaded phrases yet
        console.log('Fetching random curriculum phrase from API...');
        const response = await api.getRandomCurriculumPhrase();
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('No curriculum phrases found. Add some phrases to the curriculum first!');
            setLoading(false);
            return;
          }
          const errorText = await response.text().catch(() => '');
          throw new Error(`HTTP error! status: ${response.status}${errorText ? ` - ${errorText}` : ''}`);
        }
        
        data = await response.json();
      }
      
      setCurrentPhrase(data);
      // Initialize input values based on number of blanks
      const blankIndices = data.blank_word_indices || (data.blank_word_index !== null && data.blank_word_index !== undefined ? [data.blank_word_index] : []);
      setInputValues(new Array(blankIndices.length).fill(''));
      setCurrentBlankIndex(0);
      setExplanationText('');
      setExplanationPhraseId(null);
      setShowExplanation(false);
      setShowAnswer(false);
      setLoading(false);
      console.log('Fetch completed successfully');
    } catch (e) {
      console.error('Error fetching random phrase:', e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(errorMessage || 'Failed to load phrase. Please try again.');
      setLoading(false);
      console.log('Error state set, loading set to false');
    }
  }, [allPhrases, usedPhraseIds, generateVariation]);

  const fetchExplanation = useCallback(async () => {
    if (!currentPhrase || !blankPhrase) return;
    const currentId = blankPhrase.id || currentPhrase.id;
    if (explanationText && explanationPhraseId === currentId) {
      // Check if we have stored grammar breakdown
      if (currentPhrase.grammar_breakdown) {
        setExplanationText(currentPhrase.grammar_breakdown);
        setExplanationPhraseId(currentId);
        return;
      }
    }
    setIsLoadingExplanation(true);
    try {
      // Use stored grammar breakdown if available, otherwise fetch via API
      if (currentPhrase.grammar_breakdown) {
        setExplanationText(currentPhrase.grammar_breakdown);
        setExplanationPhraseId(currentId);
        setIsLoadingExplanation(false);
        return;
      }
      
      // Reconstruct full Korean sentence (replace all [BLANK]s with actual words)
      const words = blankPhrase.korean.split(' ');
      let blankIdx = 0;
      const fullKorean = words.map(w => {
        if (w === '[BLANK]') {
          const word = blankPhrase.blanks[blankIdx] || '';
          blankIdx++;
          return word;
        }
        return w;
      }).join(' ');
      
      const english = blankPhrase.translation;
      const prompt = `Explain this Korean sentence in detail.
Korean: ${fullKorean}
English: ${english}
Please include a clear breakdown of grammar (particles, tense, politeness), vocabulary with brief glosses, and any important notes for a learner.
Break down particles such as 은/는, 이/가, 을/를, 에, 에서, etc, verbs and their root forms, and pronouns
Keep it concise and structured, focusing on helping someone understand how the sentence works.`;
      const res = await api.chat(prompt);
      if (res.ok) {
        const data = await res.json();
        const text = data.response || '';
        setExplanationText(text);
        setExplanationPhraseId(currentId);
      }
    } catch (_) {
      setExplanationText('Failed to load explanation.');
    } finally {
      setIsLoadingExplanation(false);
    }
  }, [currentPhrase, blankPhrase, explanationText, explanationPhraseId]);

  const handleToggleExplanation = useCallback(() => {
    setShowExplanation(v => {
      const currentId = blankPhrase?.id || currentPhrase?.id;
      if (!v && (!explanationText || explanationPhraseId !== currentId) && !isLoadingExplanation) {
        fetchExplanation();
      }
      return !v;
    });
  }, [showExplanation, explanationText, explanationPhraseId, isLoadingExplanation, fetchExplanation, blankPhrase, currentPhrase]);

  // Load all phrases on mount
  useEffect(() => {
    loadAllPhrases();
  }, [loadAllPhrases]);

  useEffect(() => {
    console.log('useEffect triggered - currentPhrase:', currentPhrase, 'loading:', loading, 'error:', error);
    // Fetch on mount if we don't have a phrase yet, or if we're not currently loading/errored
    if (!currentPhrase && !loading && !error) {
      console.log('Calling fetchRandomPhrase...');
      fetchRandomPhrase();
    } else {
      console.log('Skipping fetch - currentPhrase:', !!currentPhrase, 'loading:', loading, 'error:', !!error);
    }
    // If there's an error and no phrase, don't keep trying - let user manually retry
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  const handleSkip = useCallback(async () => {
    try {
      try { const synth = window.speechSynthesis; if (synth) synth.cancel(); } catch (_) {}
      setFeedback('');
      setInputPlaceholder('');
      setInputValues([]);
      setCurrentBlankIndex(0);
      // Prefer advancing locally without refetching all the time
      const advanced = selectNextCurriculumPhrase();
      if (!advanced) {
        setLoading(true);
        await fetchRandomPhrase();
      }
    } catch (_) {}
  }, [fetchRandomPhrase, selectNextCurriculumPhrase]);

  const handleInputChange = useCallback((index, value) => {
    const newInputValues = [...inputValues];
    newInputValues[index] = value;
    setInputValues(newInputValues);
    if (inputPlaceholder) {
      setInputPlaceholder('');
    }
  }, [inputValues, inputPlaceholder]);

  const handleKeyDown = useCallback(async (event, blankIndex) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (!blankPhrase || !blankPhrase.blanks || blankPhrase.blanks.length === 0) return;
      
      const currentInput = inputValues[blankIndex] || '';
      const currentBlank = blankPhrase.blanks[blankIndex];
      // Handle correct_answers: could be array of arrays (one per blank) or flat array (one per blank in order)
      let correctAnswers = [currentBlank];
      if (Array.isArray(blankPhrase.correct_answers)) {
        if (blankPhrase.correct_answers.length > blankIndex) {
          const answer = blankPhrase.correct_answers[blankIndex];
          // If answer is itself an array (multiple correct answers for this blank), use it; otherwise wrap in array
          correctAnswers = Array.isArray(answer) ? answer : [answer];
        }
      }
      
      const isCorrect = correctAnswers.some(ans => 
        currentInput.toLowerCase().trim() === ans.toLowerCase().trim()
      );
      
      if (isCorrect) {
        // Check if all blanks are filled
        const allBlanksFilled = inputValues.length === blankPhrase.blanks.length && 
                                inputValues.every((val, idx) => {
                                  const ans = blankPhrase.correct_answers[idx] || blankPhrase.blanks[idx];
                                  return val.toLowerCase().trim() === ans.toLowerCase().trim();
                                });
        
        if (allBlanksFilled) {
          // All blanks are correct!
          setFeedback('All correct! Great job!');
          
          async function proceedToNext() {
            try {
              // Only update stats when not in no-track mode and not a generated/remix entry
              const isGenerated = currentPhrase && (String(currentPhrase.id).startsWith('variation-') || String(currentPhrase.id).startsWith('remix-'));
              if (sessionNoTrack || isGenerated) {
                // Skip tracking
              } else if (usingVariations && currentPhrase && String(currentPhrase.id).startsWith('variation-')) {
                // Check if variation was already added (has db_id)
                if (currentPhrase.db_id) {
                  console.log('[CURRICULUM] Variation already in curriculum with ID:', currentPhrase.db_id);
                  console.log('[CURRICULUM] Updating stats for variation:', currentPhrase.db_id);
                  try {
                    await api.updateCurriculumPhraseStats(currentPhrase.db_id, true);
                    console.log('[CURRICULUM] ✓ Stats updated for variation');
                    setFeedback('All correct! Variation already in curriculum - stats updated!');
                  } catch (e) {
                    console.error('[CURRICULUM] ✗ Failed to update stats:', e);
                    setFeedback('All correct! (Failed to update stats)');
                  }
                } else {
                  // Fallback: try to add if not already added
                  console.log('[CURRICULUM] Variation not found in curriculum, attempting to add...');
                  try {
                    const phraseData = {
                      korean_text: currentPhrase.korean_text,
                      english_text: currentPhrase.english_text,
                      blank_word_indices: currentPhrase.blank_word_indices || [],
                      correct_answers: currentPhrase.correct_answers || [],
                      grammar_breakdown: currentPhrase.grammar_breakdown || null,
                      blank_word_types: currentPhrase.blank_word_types || []
                    };
                    const res = await api.addCurriculumPhrase(phraseData);
                    if (res.ok) {
                      const phrasesRes = await api.getCurriculumPhrases();
                      if (phrasesRes.ok) {
                        const phrases = await phrasesRes.json();
                        setAllPhrases(Array.isArray(phrases) ? phrases : []);
                        setUsedPhraseIds([]);
                        setFeedback('All correct! Variation added to curriculum!');
                      }
                    }
                  } catch (e) {
                    console.error('[CURRICULUM] ✗ Failed to add variation:', e);
                    setFeedback('All correct!');
                  }
                }
              } else {
                // Only update stats for actual curriculum phrases, not variations
                if (blankPhrase.id && String(blankPhrase.id) && !String(blankPhrase.id).startsWith('variation-')) {
                  console.log('[CURRICULUM] Updating stats for curriculum phrase:', blankPhrase.id);
                  await api.updateCurriculumPhraseStats(blankPhrase.id, true);
                  console.log('[CURRICULUM] ✓ Stats updated for curriculum phrase');
                } else {
                  console.log('[CURRICULUM] Skipping stats update - not a curriculum phrase (ID:', blankPhrase.id, ')');
                }
              }
            } catch (error) {
              console.error('[CURRICULUM] ✗ Failed to update phrase stats:', error);
              console.error('[CURRICULUM] Error stack:', error.stack);
            }
            
            setInputPlaceholder('');
            setInputValues([]);
            setCurrentBlankIndex(0);
            setShowAnswer(false);
            setLoading(false);
            // After a short delay to show feedback, advance locally without refetching
            setTimeout(() => {
              setFeedback('');
              const ok = selectNextCurriculumPhrase();
              if (!ok) {
                // No more local phrases; stay in session without changing total
                setUsingVariations(true);
              }
            }, 800);
          };
          
          // Reconstruct full sentence for speaking
          const words = blankPhrase.korean.split(' ');
          let wordIdx = 0;
          const fullSentence = words.map(w => {
            if (w === '[BLANK]') {
              const answer = blankPhrase.blanks[wordIdx] || '';
              wordIdx++;
              return answer;
            }
            return w;
          }).join(' ');
          
          speakText(fullSentence, proceedToNext);
        } else {
          // Move to next blank
          if (blankIndex < blankPhrase.blanks.length - 1) {
            setCurrentBlankIndex(blankIndex + 1);
            setFeedback('Correct! Continue...');
          } else {
            setFeedback('All blanks filled! Check your answers.');
          }
        }
      } else {
        setFeedback('Incorrect. Try again.');
        const newInputValues = [...inputValues];
        newInputValues[blankIndex] = '';
        setInputValues(newInputValues);
        setInputPlaceholder(currentBlank);
        
        // Update stats on incorrect (only for actual curriculum phrases, not variations)
        try {
          const isGenerated = currentPhrase && (String(currentPhrase.id).startsWith('variation-') || String(currentPhrase.id).startsWith('remix-'));
          if (!sessionNoTrack && !isGenerated && blankPhrase.id && String(blankPhrase.id) && !String(blankPhrase.id).startsWith('variation-')) {
            await api.updateCurriculumPhraseStats(blankPhrase.id, false);
          }
        } catch (error) {
          console.error('Failed to update phrase stats:', error);
        }
      }
    }
  }, [inputValues, blankPhrase, speakText, fetchRandomPhrase]);

  if (loading) {
    return (
      <div className="sentence-box">
        <div>Loading phrases...</div>
        <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
          If this takes too long, the backend server may not be running. Check the console for errors.
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sentence-box">
        <div className="error-message" style={{ padding: '12px', background: '#fee', border: '1px solid #fcc', borderRadius: 4, color: '#c33', marginBottom: 12 }}>
          <strong>Error:</strong> {error}
          {(error.includes('Network error') || error.includes('CONNECTION_REFUSED') || error.includes('Unable to connect')) ? (
            <div style={{ marginTop: 8, fontSize: 12 }}>
              <strong>Tip:</strong> Make sure the backend server is running. Try running: <code style={{ background: '#fdd', padding: '2px 4px', borderRadius: 2 }}>npm run start-server-dev</code>
            </div>
          ) : null}
        </div>
        <button onClick={fetchRandomPhrase} className="generate-button" style={{ marginTop: 12 }}>
          Try Again
        </button>
      </div>
    );
  }

  if (!currentPhrase || !blankPhrase) {
    return <div className="sentence-box">No phrases available.</div>;
  }

  // Split Korean sentence by [BLANK] and create input fields
  const koreanParts = blankPhrase.korean.split('[BLANK]');
  const numBlanks = blankPhrase.blanks?.length || 0;

  // Calculate progress
  const progressPercentage = allPhrases.length > 0 ? (usedPhraseIds.length / allPhrases.length) * 100 : 0;

  return (
    <div className="sentence-box">
      {allPhrases.length > 0 && (
        <div style={{ marginBottom: 16, padding: '10px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: '#666', fontWeight: 600 }}>Curriculum Progress</span>
            <span style={{ fontSize: 13, color: '#333', fontWeight: 600 }}>
              {usedPhraseIds.length} / {allPhrases.length} phrases
            </span>
          </div>
          <div style={{ width: '100%', height: 12, background: '#e0e0e0', borderRadius: 6, overflow: 'hidden' }}>
            <div 
              style={{ 
                width: `${progressPercentage}%`, 
                height: '100%', 
                background: progressPercentage === 100 ? '#4caf50' : '#2196f3',
                transition: 'width 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }} 
            >
              {progressPercentage > 15 && (
                <span style={{ fontSize: 10, color: '#fff', fontWeight: 600 }}>
                  {Math.round(progressPercentage)}%
                </span>
              )}
            </div>
          </div>
          {progressPercentage === 100 && (
            <p style={{ fontSize: 11, color: '#4caf50', marginTop: 6, marginBottom: 0, textAlign: 'center' }}>
              ✓ All curriculum phrases completed! Now practicing with AI variations.
            </p>
          )}
          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ fontSize: 12, color: '#666', fontWeight: 600 }}>Level</label>
            <select value={level} onChange={(e)=>setLevel(parseInt(e.target.value || '1', 10))} style={{ padding: 4, border: '1px solid #ddd', borderRadius: 4 }}>
              <option value={1}>1 (one blank)</option>
              <option value={2}>2 (two blanks)</option>
              <option value={3}>3 (three blanks)</option>
            </select>
          </div>
        </div>
      )}
      <p className="korean-sentence">
        {koreanParts.map((part, idx) => (
          <React.Fragment key={idx}>
            {part}
            {idx < numBlanks && (
              <input
                type="text"
                className="fill-in-blank-input"
                value={showAnswer ? (blankPhrase.correct_answers[idx] || blankPhrase.blanks[idx] || '') : (inputValues[idx] || '')}
                onChange={(e) => {
                  if (!showAnswer) {
                    handleInputChange(idx, e.target.value);
                  }
                }}
                onKeyDown={(e) => {
                  if (!showAnswer) {
                    handleKeyDown(e, idx);
                  }
                }}
                placeholder={idx === currentBlankIndex ? inputPlaceholder || '' : ''}
                autoFocus={idx === currentBlankIndex && !showAnswer}
                disabled={showAnswer}
                style={{ 
                  width: `${Math.max((blankPhrase.blanks[idx]?.length || 3) * 1.5, 3)}em`,
                  borderColor: inputValues[idx] && idx === currentBlankIndex ? '#3498db' : undefined,
                  backgroundColor: showAnswer ? '#e8f5e9' : undefined,
                  cursor: showAnswer ? 'not-allowed' : undefined
                }}
              />
            )}
          </React.Fragment>
        ))}
      </p>
      <p className="translation" style={{ marginTop: 8, textAlign: 'center' }}>{blankPhrase.translation}</p>
      {feedback && <p className="feedback">{feedback}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button 
          type="button"
          onClick={() => setShowAnswer(!showAnswer)}
          className="regenerate-button"
          style={{ flex: 1 }}
        >
          {showAnswer ? 'Hide Answer' : 'Show Answer'}
        </button>
        <button 
          onClick={handleSkip}
          className="regenerate-button"
        >
          Skip
        </button>
      </div>
      <div className="sentence-box" style={{ textAlign: 'left', marginTop: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Explanation</h3>
          <button type="button" className="regenerate-button" onClick={handleToggleExplanation}>
            {showExplanation ? 'Hide' : 'Show'}
          </button>
        </div>
        {showExplanation && (
          <div style={{ marginTop: 8 }}>
            {isLoadingExplanation ? (
              <p style={{ margin: '4px 0', color: '#6b7280' }}>Loading explanation...</p>
            ) : explanationText ? (
              <div 
                style={{ lineHeight: '1.6' }}
                dangerouslySetInnerHTML={{ __html: mdToHtml(explanationText) }}
              />
            ) : (
              <p style={{ margin: '4px 0', color: '#6b7280' }}>No explanation available.</p>
            )}
          </div>
        )}
      </div>
      {usingVariations && (
        <div style={{ marginTop: 8, padding: '12px', background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: 8 }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <p style={{ fontSize: 12, color: '#666', fontStyle: 'italic', margin: 0 }}>
                AI-generated variation (will be added to curriculum on completion)
              </p>
              <span style={{ fontSize: 12, color: '#1976d2', fontWeight: 600 }}>
                {allPhrases.length > 0 ? `${usedPhraseIds.length} / ${allPhrases.length} phrases completed` : '0 / 0 phrases completed'}
              </span>
            </div>
            {allPhrases.length > 0 && (
              <div style={{ width: '100%', height: 8, background: '#fff', borderRadius: 4, overflow: 'hidden', marginTop: 8 }}>
                <div 
                  style={{ 
                    width: `${(usedPhraseIds.length / allPhrases.length) * 100}%`, 
                    height: '100%', 
                    background: '#4caf50',
                    transition: 'width 0.3s ease'
                  }} 
                />
              </div>
            )}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'center' }}>
        <button type="button" className="regenerate-button" onClick={handleRemixSentence}>
          Remix: New Sentence (no tracking)
        </button>
        <button type="button" className="regenerate-button" onClick={handleAddCurrentToCurriculum}>
          Add to Curriculum
        </button>
        {sessionNoTrack && (
          <span style={{ alignSelf: 'center', fontSize: 12, color: '#6b7280' }}>New sentence mode active — progress not tracked</span>
        )}
      </div>
      {currentPhrase.times_correct > 0 && currentPhrase.id && String(currentPhrase.id) && !String(currentPhrase.id).startsWith('variation-') && (
        <p className="correct-count">Correct answers: {currentPhrase.times_correct}</p>
      )}
    </div>
  );
}

export default CurriculumPracticePage;

