import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from './api';
import './HomePage.css';

// Single delay (ms) to wait after speaking (or on fallback) before advancing
const SPEAK_ADVANCE_DELAY_MS = 1200;

function PhrasePractice({ modelSentence }) {
  const [currentPhrase, setCurrentPhrase] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [inputPlaceholder, setInputPlaceholder] = useState('');
  const [generatedVariations, setGeneratedVariations] = useState([]);
  const [currentVariationIndex, setCurrentVariationIndex] = useState(0);
  const [isGeneratingVariations, setIsGeneratingVariations] = useState(false);

  const speakText = useCallback((text, onEnd, repeatCount = 3) => {
    try {
      const synth = window.speechSynthesis;
      if (!synth) {
        setTimeout(() => { if (onEnd) onEnd(); }, SPEAK_ADVANCE_DELAY_MS);
        return;
      }
      
      synth.cancel();
      
      let currentRepeat = 0;
      const speakOnce = () => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ko-KR';
        utterance.rate = 0.6;
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

  useEffect(() => {
    if (modelSentence) {
      // Auto-generate variations when model sentence is set
      if (generatedVariations.length === 0) {
        generateVariations();
      }
    } else {
      // No model sentence - use random phrases from database
      if (!currentPhrase && !loading) {
        fetchRandomPhrase();
      }
    }
  }, [modelSentence, generateVariations, generatedVariations.length, fetchRandomPhrase, currentPhrase, loading]);

  const createBlankPhrase = useCallback((phrase) => {
    if (!phrase) return { korean: '', blank: '', translation: '' };
    
    // Split Korean text into words
    const koreanWords = phrase.korean_text.split(' ');
    if (koreanWords.length < 2) {
      // If only one word, use it as the blank
      return {
        korean: '[BLANK]',
        blank: koreanWords[0],
        translation: phrase.english_text,
        id: phrase.id
      };
    }
    
    // Randomly select a word to blank out
    const randomIndex = Math.floor(Math.random() * koreanWords.length);
    const blankWord = koreanWords[randomIndex];
    
    // Create the phrase with [BLANK] in place of the selected word
    const koreanWithBlank = koreanWords.map((word, index) => 
      index === randomIndex ? '[BLANK]' : word
    ).join(' ');
    
    return {
      korean: koreanWithBlank,
      blank: blankWord,
      translation: phrase.english_text,
      id: phrase.id
    };
  }, []);

  const blankPhrase = useMemo(() => {
    return createBlankPhrase(currentPhrase);
  }, [currentPhrase, createBlankPhrase]);

  const handleInputChange = useCallback((event) => {
    setInputValue(event.target.value);
    if (inputPlaceholder) {
      setInputPlaceholder('');
    }
  }, [inputPlaceholder]);

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
    </div>
  );
}

export default PhrasePractice;
