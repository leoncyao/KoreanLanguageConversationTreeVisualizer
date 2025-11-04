import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { api } from './api';
import './HomePage.css';

// Single delay (ms) to wait after speaking (or on fallback) before advancing
const SPEAK_ADVANCE_DELAY_MS = 1200;
let hasRun = false;

function SentencePractice() {
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [feedback, setFeedback] = useState('');
  const [sentences, setSentences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [inputPlaceholder, setInputPlaceholder] = useState('');

  const speakText = (text, onEnd) => {
    try {
      const synth = window.speechSynthesis;
      if (!synth) {
        setTimeout(() => { if (onEnd) onEnd(); }, SPEAK_ADVANCE_DELAY_MS);
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ko-KR';
      utterance.rate = 0.75;
      utterance.onend = () => {
        setTimeout(() => { if (onEnd) onEnd(); }, SPEAK_ADVANCE_DELAY_MS);
      };
      synth.cancel();
      synth.speak(utterance);
    } catch (e) {
      setTimeout(() => { if (onEnd) onEnd(); }, SPEAK_ADVANCE_DELAY_MS);
    }
  };

  useEffect(() => {
    if (!hasRun) {
      hasRun = true;
      const fetchSentences = async () => {
        try {
          const response = await api.getSentences();
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data = await response.json();
          setSentences(data);
          const randIndex = 0;
          setCurrentSentenceIndex(randIndex);
          console.log('Initial currentSentenceIndex set to:', randIndex);
          setLoading(false);
        } catch (e) {
          setError(e.message);
          setLoading(false);
        }
      };
      fetchSentences();
    }
  }, []);

  const currentSentence = useMemo(() => {
    return sentences && sentences.length > 0 ? sentences[currentSentenceIndex] : undefined;
  }, [sentences, currentSentenceIndex]);

  const handleInputChange = useCallback((event) => {
    setInputValue(event.target.value);
    if (inputPlaceholder) {
      setInputPlaceholder('');
    }
  }, [inputPlaceholder]);

  const handleKeyDown = useCallback(async (event) => {
    console.log('handleKeyDown', event.key);
    console.log('currentSentence', currentSentence);
    if (event.key === 'Enter') {
      event.preventDefault();
      if (inputValue.toLowerCase() === currentSentence.blank.toLowerCase()) {
        setFeedback('Correct!');
        
        async function proceedToNext() {
          // Make API call with current sentence BEFORE updating state
          api.updateSentenceStats(currentSentence.id, true).catch(() => {});
          
          // Batch all state updates together to prevent multiple re-renders
          const nextIndex = (currentSentenceIndex + 1) % sentences.length;
          setCurrentSentenceIndex(nextIndex);
          setFeedback('');
          setInputPlaceholder('');
          setInputValue('');
        };
        const fullSentenceKorean = currentSentence.korean.replace('[BLANK]', currentSentence.blank);
        speakText(fullSentenceKorean, proceedToNext);
      } else {
        setFeedback('Incorrect. Try again.');
        setInputValue('');
        setInputPlaceholder(currentSentence.blank);
      }
    }
  }, [inputValue, currentSentence, currentSentenceIndex, sentences.length]);

  if (loading) {
    return <div className="homepage">Loading sentences...</div>;
  }

  if (error) {
    return <div className="homepage">Error: {error}</div>;
  }

  if (sentences.length === 0) {
    return <div className="homepage">No sentences available.</div>;
  }

  const koreanParts = currentSentence ? currentSentence.korean.split('[BLANK]') : ['', ''];

  return (
    <div className="sentence-box">
      <p className="korean-sentence">
        {koreanParts[0]}
        <input
          type="text"
          className="fill-in-blank-input"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={inputPlaceholder}
        />
        {koreanParts[1]}
      </p>
      {feedback && <p className="feedback">{feedback}</p>}
      <p className="translation">{currentSentence.translation}</p>
      <p className="correct-count">Correct answers: {currentSentence.correctCount}</p>
    </div>
  );
}

export default SentencePractice;



