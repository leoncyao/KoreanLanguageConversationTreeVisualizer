import React, { useState, useRef } from 'react';
import { api } from './api';
import './HomePage.css';

function TranslationBox({ onTranslated }) {
  const [freeInputValue, setFreeInputValue] = useState('');
  const [translatedValue, setTranslatedValue] = useState('');
  const inputRef = useRef(null);

  const handleFreeInputChange = (event) => {
    setFreeInputValue(event.target.value);
  };

  const handleTranslate = async (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      
      try {
        const response = await api.translate(freeInputValue, 'ko');
        
        if (response.ok) {
          const data = await response.json();
          setTranslatedValue(data.corrected || '');
          if (onTranslated && data.corrected) {
            try {
              onTranslated({ input: freeInputValue, translation: data.corrected });
            } catch (_) {}
          }
        } else {
          setTranslatedValue('Translation failed');
        }
      } catch (error) {
        setTranslatedValue('Translation error');
      }
    }
  };

  const handleClear = () => {
    setFreeInputValue('');
    setTranslatedValue('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className="extra-box">
      <div className="translation-input-container">
        <p className="extra-title">Free input:</p>
        <input
          type="text"
          className="translation-input"
          value={freeInputValue}
          onChange={handleFreeInputChange}
          onKeyDown={handleTranslate}
          placeholder="Type anything here"
          ref={inputRef}
        />
        <button
          type="button"
          className="clear-input-button"
          onClick={handleClear}
          disabled={!freeInputValue}
        >
          Clear
        </button>
      </div>
      <div className="response-box">
        <p className="extra-title">Response:</p>
        <p className="response-text">{translatedValue || 'Enter text above and press Enter to translate'}</p>
      </div>
    </div>
  );
}

export default TranslationBox;
