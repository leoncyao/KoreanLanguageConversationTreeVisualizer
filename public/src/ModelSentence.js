import React, { useState, useEffect } from 'react';
import { api } from './api';
import './styles/ModelSentence.css';

function ModelSentence({ onModelUpdate }) {
  const [englishInput, setEnglishInput] = useState('');
  const [koreanTranslation, setKoreanTranslation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Load model sentence from database on mount
  useEffect(() => {
    const loadModelSentence = async () => {
      try {
        const response = await api.getModelSentence();
        if (response.ok) {
          const data = await response.json();
          setEnglishInput(data.english);
          setKoreanTranslation(data.korean);
          onModelUpdate({
            english: data.english,
            korean: data.korean
          });
        }
      } catch (err) {
        console.log('No model sentence found or error loading:', err);
      }
    };
    loadModelSentence();
  }, [onModelUpdate]);

  const handleTranslate = async () => {
    if (!englishInput.trim()) {
      setError('Please enter a sentence');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await api.translate(englishInput.trim());
      const data = await response.json();

      if (response.ok && data.corrected) {
        setKoreanTranslation(data.corrected);
        
        // Save to database
        try {
          await api.saveModelSentence(englishInput.trim(), data.corrected);
          try { await api.clearModelVariations(); } catch (_) {}
        } catch (saveErr) {
          console.error('Failed to save model sentence to database:', saveErr);
        }
        
        // Pass the model sentence up to parent
        onModelUpdate({
          english: englishInput.trim(),
          korean: data.corrected
        });
      } else {
        setError(data.error || 'Translation failed');
      }
    } catch (err) {
      setError('Failed to translate: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = async () => {
    setEnglishInput('');
    setKoreanTranslation('');
    setError('');
    onModelUpdate(null);
    
    try {
      await api.clearModelSentence();
    } catch (err) {
      console.error('Failed to clear model sentence:', err);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTranslate();
    }
  };

  return (
    <div className="model-sentence-container">
      <h3>Model Sentence</h3>
      <div className="model-sentence-input-group">
        <textarea
          value={englishInput}
          onChange={(e) => setEnglishInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type an English sentence..."
          className="model-sentence-input"
          rows="2"
          disabled={isLoading}
        />
        <button 
          onClick={handleTranslate}
          disabled={isLoading || !englishInput.trim()}
          className="translate-button"
        >
          {isLoading ? 'Translating...' : 'Translate'}
        </button>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      {koreanTranslation && (
        <div className="korean-translation">
          <div className="translation-label">Korean:</div>
          <div className="translation-text">{koreanTranslation}</div>
          <button 
            onClick={handleClear}
            className="clear-button"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}

export default ModelSentence;

