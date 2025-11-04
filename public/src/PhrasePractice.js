import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from './api';
import './HomePage.css';

// Single delay (ms) to wait after speaking (or on fallback) before advancing
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
  // code blocks ```...```
  txt = txt.replace(/```([\s\S]*?)```/g, (m, p1) => `<pre><code>${p1}</code></pre>`);
  // bold **text**
  txt = txt.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // italics *text* (but not **bold**)
  txt = txt.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
  // headings
  txt = txt.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
           .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
           .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
  // unordered lists
  txt = txt.replace(/^(?:[-*])\s+(.+)$/gm, '<li>$1</li>');
  // wrap list items with <ul>
  txt = txt.replace(/(<li>[\s\S]*?<\/li>)/g, (m) => `<ul>${m}</ul>`);
  // new lines to <br> inside paragraphs (avoid inside pre/code)
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

function PhrasePractice({ modelSentence, grammarRule }) {
  const [currentPhrase, setCurrentPhrase] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [inputPlaceholder, setInputPlaceholder] = useState('');
  const [generatedVariations, setGeneratedVariations] = useState([]);
  const [currentVariationIndex, setCurrentVariationIndex] = useState(0);
  const [isGeneratingVariations, setIsGeneratingVariations] = useState(false);
  const [learningSet, setLearningSet] = useState(null); // Set of korean strings
  const [showGrammar, setShowGrammar] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [explanationText, setExplanationText] = useState('');
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);
  const [explanationPhraseId, setExplanationPhraseId] = useState(null);

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
            // Speak again with a short pause
            setTimeout(() => speakOnce(), 500);
          } else {
            // Done with all repeats, call onEnd callback
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

  const fetchRandomPhrase = useCallback(async () => {
    try {
      const response = await api.getRandomPhrase();
      if (!response.ok) {
        if (response.status === 404) {
          setError('No phrases found. Try translating some Korean text first!');
          setLoading(false);
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setCurrentPhrase(data);
      setExplanationText(''); // Reset explanation when phrase changes
      setExplanationPhraseId(null);
      setShowExplanation(false);
      setLoading(false);
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }, []);

  const generateVariations = useCallback(async () => {
    if (!modelSentence) return;
    
    setIsGeneratingVariations(true);
    setError(null);
    setLoading(true);
    
    try {
      const response = await api.generateVariations(modelSentence.english, modelSentence.korean);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate variations');
      }
      
      if (data.variations && data.variations.length > 0) {
        setGeneratedVariations(data.variations);
        setCurrentVariationIndex(0);
        
        // Set first variation as current phrase
          setCurrentPhrase({
            korean_text: data.variations[0].korean,
            english_text: data.variations[0].english,
            id: `variation-0`,
            times_correct: 0
          });
          setExplanationText(''); // Reset explanation when phrase changes
          setExplanationPhraseId(null);
          setShowExplanation(false);
          // Save to cache
          try { await api.saveModelVariations(data.variations); } catch (_) {}
          setLoading(false);
      } else {
        throw new Error('No variations generated');
      }
    } catch (e) {
      setError('Failed to generate variations: ' + e.message);
      setLoading(false);
    } finally {
      setIsGeneratingVariations(false);
    }
  }, [modelSentence]);

  // Load learning words once
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.getLearningWords(500);
        const data = await res.json();
        if (!mounted) return;
        const s = new Set((Array.isArray(data) ? data : []).map(w => String(w.korean || '').trim()));
        setLearningSet(s);
      } catch (_) {
        setLearningSet(new Set());
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (modelSentence) {
      let cancelled = false;
      (async () => {
        try {
          const res = await api.getModelVariations();
          if (!cancelled && res.ok) {
            const cached = await res.json();
            if (cached && Array.isArray(cached.variations) && cached.variations.length > 0) {
              setGeneratedVariations(cached.variations);
              setCurrentVariationIndex(0);
              setCurrentPhrase({
                korean_text: cached.variations[0].korean,
                english_text: cached.variations[0].english,
                id: `variation-0`,
                times_correct: 0
              });
              setExplanationText(''); // Reset explanation when phrase changes
              setExplanationPhraseId(null);
              setShowExplanation(false);
              setLoading(false);
              return;
            }
          }
        } catch (_) {}
        if (!cancelled) {
          generateVariations();
        }
      })();
      return () => { cancelled = true; };
    } else {
      // No model sentence - use random phrases from database
      if (!currentPhrase && !loading) {
        fetchRandomPhrase();
      }
    }
  }, [modelSentence]);

  const createBlankPhrase = useCallback((phrase) => {
    if (!phrase) return { korean: '', blank: '', translation: '' };
    
    // Split Korean text into space-separated tokens; keep punctuation attached but avoid blanking it
    const koreanWords = phrase.korean_text.split(' ');
    const punctRe = /^[.,!?;:~"“”‘’()\[\]{}…·、，。ㆍ]+$/;
    const stripPunct = (tok) => {
      const leading = tok.match(/^[.,!?;:~"“”‘’()\[\]{}…·、，。ㆍ]+/);
      const trailing = tok.match(/[.,!?;:~"“”‘’()\[\]{}…·、，。ㆍ]+$/);
      const lead = leading ? leading[0] : '';
      const trail = trailing ? trailing[0] : '';
      const core = tok.slice(lead.length, tok.length - trail.length);
      return { lead, core, trail };
    };
    if (koreanWords.length < 2) {
      // If only one word, use it as the blank
      return {
        korean: '[BLANK]',
        blank: stripPunct(koreanWords[0]).core || koreanWords[0],
        translation: phrase.english_text,
        id: phrase.id
      };
    }
    
    // Choose word to blank: 90% chance prefer learning words present, else any (but never punctuation-only)
    const indices = koreanWords.map((_, i) => i);
    const normalize = (w) => String(w || '').trim();
    const candidates = indices.filter(i => {
      const { core } = stripPunct(koreanWords[i]);
      return core && !punctRe.test(core);
    });
    const learningIndices = (learningSet ? candidates.filter(i => learningSet.has(normalize(stripPunct(koreanWords[i]).core))) : []);
    let randomIndex;
    if (learningIndices.length > 0 && Math.random() < 0.9) {
      randomIndex = learningIndices[Math.floor(Math.random() * learningIndices.length)];
    } else {
      const pool = candidates.length > 0 ? candidates : indices;
      randomIndex = pool[Math.floor(Math.random() * pool.length)];
    }
    const parts = stripPunct(koreanWords[randomIndex]);
    const blankWord = parts.core || koreanWords[randomIndex];
    
    // Create the phrase with [BLANK] in place of the selected word
    const koreanWithBlank = koreanWords.map((word, index) => {
      if (index !== randomIndex) return word;
      const { lead, trail } = stripPunct(word);
      return `${lead}[BLANK]${trail}`;
    }).join(' ');
    
    return {
      korean: koreanWithBlank,
      blank: blankWord,
      translation: phrase.english_text,
      id: phrase.id
    };
  }, [learningSet]);

  const blankPhrase = useMemo(() => {
    return createBlankPhrase(currentPhrase);
  }, [currentPhrase, createBlankPhrase]);

  const handleSkip = useCallback(async () => {
    try {
      // Stop any ongoing speech
      try { const synth = window.speechSynthesis; if (synth) synth.cancel(); } catch (_) {}

      setFeedback('');
      setInputPlaceholder('');
      setInputValue('');

      if (generatedVariations.length > 0) {
        const nextIndex = (currentVariationIndex + 1) % generatedVariations.length;
        setCurrentVariationIndex(nextIndex);
        setCurrentPhrase({
          korean_text: generatedVariations[nextIndex].korean,
          english_text: generatedVariations[nextIndex].english,
          id: `variation-${nextIndex}`,
          times_correct: 0
        });
        setExplanationText(''); // Reset explanation when phrase changes
        setExplanationPhraseId(null);
        setShowExplanation(false);
      } else {
        setLoading(true);
        await fetchRandomPhrase();
      }
    } catch (_) {}
  }, [generatedVariations, currentVariationIndex, fetchRandomPhrase]);

  const handleInputChange = useCallback((event) => {
    setInputValue(event.target.value);
    if (inputPlaceholder) {
      setInputPlaceholder('');
    }
  }, [inputPlaceholder]);

  const fetchExplanation = useCallback(async () => {
    if (!currentPhrase || !blankPhrase) return;
    const currentId = blankPhrase.id || currentPhrase.id;
    if (explanationText && explanationPhraseId === currentId) return; // Already loaded for this phrase
    setIsLoadingExplanation(true);
    try {
      const korean = blankPhrase.korean.replace('[BLANK]', blankPhrase.blank);
      const english = blankPhrase.translation;
      const prompt = `Explain this Korean sentence in detail.
Korean: ${korean}
English: ${english}
Please include a clear breakdown of grammar (particles, tense, politeness), vocabulary with brief glosses, and any important notes for a learner.
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

  const handleKeyDown = useCallback(async (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (inputValue.toLowerCase() === blankPhrase.blank.toLowerCase()) {
        setFeedback('Correct!');
        
        async function proceedToNext() {
          // Update phrase stats in database (only if not a variation)
          if (!blankPhrase.id.startsWith('variation-')) {
            try {
              await api.updatePhraseStats(blankPhrase.id, true);
            } catch (error) {
              console.error('Failed to update phrase stats:', error);
            }
          }

          // Update per-word correct count for the filled blank (always)
          try {
            await api.updateWordCorrect(blankPhrase.blank);
            // If the word is now learned (>= threshold), remove from learning set
            try {
              const resp = await api.checkWordLearned(blankPhrase.blank, 20);
              const data = await resp.json();
              if (resp.ok && data && data.learned) {
                setLearningSet((prev) => {
                  const next = new Set(prev || []);
                  next.delete(blankPhrase.blank.trim());
                  return next;
                });
              }
            } catch (_) {}
          } catch (error) {
            console.error('Failed to update word correct count:', error);
          }
          
          setFeedback('');
          setInputPlaceholder('');
          setInputValue('');
          
          // If using variations, move to next variation or loop back
          if (generatedVariations.length > 0) {
            const nextIndex = (currentVariationIndex + 1) % generatedVariations.length;
            setCurrentVariationIndex(nextIndex);
            setCurrentPhrase({
              korean_text: generatedVariations[nextIndex].korean,
              english_text: generatedVariations[nextIndex].english,
              id: `variation-${nextIndex}`,
              times_correct: 0
            });
            setExplanationText(''); // Reset explanation when phrase changes
            setExplanationPhraseId(null);
            setShowExplanation(false);
          } else {
            // Fetch new random phrase from database
            setLoading(true);
            await fetchRandomPhrase();
          }
        };
        
        const fullPhraseKorean = blankPhrase.korean.replace('[BLANK]', blankPhrase.blank);
        speakText(fullPhraseKorean, proceedToNext);
      } else {
        setFeedback('Incorrect. Try again.');
        setInputValue('');
        setInputPlaceholder(blankPhrase.blank);
        
        // Speak the correct sentence so user can hear it
        const fullPhraseKorean = blankPhrase.korean.replace('[BLANK]', blankPhrase.blank);
        speakText(fullPhraseKorean);
      }
    }
  }, [inputValue, blankPhrase, speakText, fetchRandomPhrase, generatedVariations, currentVariationIndex]);

  if (loading) {
    return <div className="sentence-box">Loading phrases...</div>;
  }

  if (error) {
    return (
      <div className="sentence-box">
        <div className="error-message">{error}</div>
        {modelSentence && (
          <button onClick={generateVariations} className="generate-button">
            Try Again
          </button>
        )}
      </div>
    );
  }

  // If model sentence exists but no variations generated yet (and not currently generating)
  if (modelSentence && generatedVariations.length === 0 && !currentPhrase && !isGeneratingVariations) {
    return (
      <div className="sentence-box">
        <p className="instructions">Generating practice sentences based on your model sentence...</p>
      </div>
    );
  }

  if (!currentPhrase) {
    return <div className="sentence-box">No phrases available.</div>;
  }

  const koreanParts = blankPhrase.korean.split('[BLANK]');

  return (
    <div className="sentence-box">
      {generatedVariations.length > 0 && (
        <div className="variation-indicator">
          Similar Sentence {currentVariationIndex + 1} of {generatedVariations.length}
        </div>
      )}
      {modelSentence && (
        <div className="model-info">
          <small>Based on: {modelSentence.english}</small>
        </div>
      )}
      <p className="korean-sentence">
        {koreanParts[0]}
        <input
          type="text"
          className="fill-in-blank-input"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={inputPlaceholder}
          autoFocus
          style={{ width: `${Math.max(blankPhrase.blank.length * 1.5, 3)}em` }}
        />
        {koreanParts[1]}
      </p>
      {feedback && <p className="feedback">{feedback}</p>}
      <p className="translation">{blankPhrase.translation}</p>
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
      {grammarRule && (
        <div className="sentence-box" style={{ textAlign: 'left', marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Grammar Rule</h3>
            <button type="button" className="regenerate-button" onClick={() => setShowGrammar(v => !v)}>
              {showGrammar ? 'Hide' : 'Show'}
            </button>
          </div>
          {showGrammar && (
            <div style={{ marginTop: 8 }}>
              {grammarRule.title && <p style={{ margin: '4px 0', fontWeight: 600 }}>{grammarRule.title}</p>}
              {grammarRule.description && <p style={{ margin: '4px 0' }}>{grammarRule.description}</p>}
              {(grammarRule.example_korean || grammarRule.example_english) && (
                <p style={{ margin: '4px 0' }}>
                  {grammarRule.example_korean && <span style={{ fontWeight: 600, marginRight: 8 }}>{grammarRule.example_korean}</span>}
                  {grammarRule.example_english && <span style={{ color: '#6b7280' }}>{grammarRule.example_english}</span>}
                </p>
              )}
              {(grammarRule.model_korean || grammarRule.model_english) && (
                <p style={{ margin: '4px 0' }}>
                  <span style={{ color: '#6b7280', marginRight: 6 }}>Model:</span>
                  {grammarRule.model_korean && <span style={{ fontWeight: 600, marginRight: 8 }}>{grammarRule.model_korean}</span>}
                  {grammarRule.model_english && <span style={{ color: '#6b7280' }}>{grammarRule.model_english}</span>}
                </p>
              )}
            </div>
          )}
        </div>
      )}
      {currentPhrase.times_correct > 0 && (
        <p className="correct-count">Correct answers: {currentPhrase.times_correct}</p>
      )}
      {modelSentence && generatedVariations.length > 0 && (
        <button 
          onClick={generateVariations} 
          disabled={isGeneratingVariations}
          className="regenerate-button"
        >
          {isGeneratingVariations ? 'Generating...' : 'Generate New Similar Sentences'}
        </button>
      )}
      <button 
        onClick={handleSkip}
        className="regenerate-button"
        style={{ marginLeft: 8 }}
      >
        Skip
      </button>
    </div>
  );
}

export default PhrasePractice;
