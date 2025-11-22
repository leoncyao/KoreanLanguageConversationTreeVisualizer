import React, { useState, useRef } from 'react';
import { api } from './api';
import { speakToAudio } from './audioTTS';
import './styles/HomePage.css';

function TranslationBox({ onTranslated }) {
  const [freeInputValue, setFreeInputValue] = useState('');
  const [translatedValue, setTranslatedValue] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const inputRef = useRef(null);

  // Simple offline cache translator: stores full sentences and token pairs in localStorage
  const loadCache = () => {
    try { const raw = localStorage.getItem('offline_translations_v1'); return raw ? JSON.parse(raw) : { sentences: {}, tokens: {} }; } catch (_) { return { sentences: {}, tokens: {} }; }
  };
  const saveCache = (cache) => { try { localStorage.setItem('offline_translations_v1', JSON.stringify(cache)); } catch (_) {} };
  const cacheTokensFromPair = (en, ko) => {
    const cache = loadCache();
    const normEn = String(en || '').trim().toLowerCase();
    const normKo = String(ko || '').trim();
    if (normEn && normKo) {
      cache.sentences[normEn] = normKo;
      // Heuristic token mapping
      const enTokens = normEn.split(/\s+/);
      const koTokens = normKo.split(/\s+/);
      const n = Math.min(enTokens.length, koTokens.length);
      for (let i = 0; i < n; i++) {
        const e = enTokens[i];
        const k = koTokens[i];
        if (e && k) cache.tokens[e] = k;
      }
      saveCache(cache);
    }
  };
  const offlineTranslate = (text) => {
    const cache = loadCache();
    const norm = String(text || '').trim().toLowerCase();
    if (!norm) return '';
    if (cache.sentences[norm]) return cache.sentences[norm];
    const tokens = norm.split(/\s+/).map(t => cache.tokens[t] || t);
    return tokens.join(' ');
  };

  const handleFreeInputChange = (event) => {
    setFreeInputValue(event.target.value);
  };

  const performTranslation = async () => {
    if (!freeInputValue.trim()) return;
    
    setIsTranslating(true);
    try {
      // If offline, use cached/offline translator
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        const offline = offlineTranslate(freeInputValue);
        if (offline) {
          setTranslatedValue(offline);
          if (onTranslated) { try { onTranslated({ input: freeInputValue, translation: offline }); } catch (_) {} }
          setIsTranslating(false);
          return;
        }
        setTranslatedValue('Offline: no cached translation. Connect to translate.');
        setIsTranslating(false);
        return;
      }
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 6000);
      const response = await api.translate(freeInputValue, 'ko');
      clearTimeout(t);
      
      if (response.ok) {
        const data = await response.json();
        setTranslatedValue(data.corrected || '');
        cacheTokensFromPair(freeInputValue, data.corrected || '');
        if (onTranslated && data.corrected) {
          try {
            onTranslated({ input: freeInputValue, translation: data.corrected });
          } catch (_) {}
        }
      } else {
        // Fallback to offline cache
        const offline = offlineTranslate(freeInputValue);
        setTranslatedValue(offline || 'Translation failed');
        if (offline && onTranslated) { try { onTranslated({ input: freeInputValue, translation: offline }); } catch (_) {} }
      }
    } catch (error) {
      const offline = offlineTranslate(freeInputValue);
      setTranslatedValue(offline || 'Translation error');
      if (offline && onTranslated) { try { onTranslated({ input: freeInputValue, translation: offline }); } catch (_) {} }
    } finally {
      setIsTranslating(false);
    }
  };

  const handleTranslate = async (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      await performTranslation();
    }
  };

  const handleClear = () => {
    setFreeInputValue('');
    setTranslatedValue('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handlePlaySound = async () => {
    if (!translatedValue) return;
    try {
      // Play the translated text (Korean) using TTS
      await speakToAudio(translatedValue, 'ko-KR', 1.0);
    } catch (error) {
      console.error('Failed to play audio:', error);
    }
  };

  return (
    <div className="extra-box">
      <div className="translation-input-container">
        <p className="extra-title">Free input:</p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            className="translation-input"
            value={freeInputValue}
            onChange={handleFreeInputChange}
            onKeyDown={handleTranslate}
            placeholder="Type anything here"
            ref={inputRef}
            style={{ flex: 1 }}
          />
          <button
            type="button"
            onClick={performTranslation}
            disabled={!freeInputValue.trim() || isTranslating}
            style={{
              padding: '8px 16px',
              backgroundColor: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: (freeInputValue.trim() && !isTranslating) ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              fontWeight: 500,
              opacity: (freeInputValue.trim() && !isTranslating) ? 1 : 0.6,
              transition: 'opacity 0.2s, background-color 0.2s'
            }}
            title="Translate (Enter)"
            aria-label="Translate"
            onMouseEnter={(e) => {
              if (freeInputValue.trim() && !isTranslating) {
                e.currentTarget.style.backgroundColor = '#1565c0';
              }
            }}
            onMouseLeave={(e) => {
              if (freeInputValue.trim() && !isTranslating) {
                e.currentTarget.style.backgroundColor = '#1976d2';
              }
            }}
          >
            {isTranslating ? 'Translating...' : 'Enter'}
          </button>
          <button
            type="button"
            className="clear-input-button"
            onClick={handleClear}
            disabled={!freeInputValue}
          >
            Clear
          </button>
        </div>
      </div>
      <div className="response-box">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <p className="extra-title" style={{ margin: 0 }}>Response:</p>
          {translatedValue && !isTranslating && (
            <button
              type="button"
              onClick={handlePlaySound}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                color: '#1976d2',
                transition: 'opacity 0.2s'
              }}
              title="Play translation"
              aria-label="Play translation"
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              🔊
            </button>
          )}
        </div>
        {isTranslating && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ 
              height: 4, 
              background: '#e0e0e0', 
              borderRadius: 2, 
              overflow: 'hidden',
              position: 'relative'
            }}>
              <div style={{
                height: '100%',
                width: '100%',
                background: '#1976d2',
                borderRadius: 2,
                animation: 'translateX 1.5s ease-in-out infinite',
                backgroundImage: 'linear-gradient(90deg, #1976d2 0%, #42a5f5 50%, #1976d2 100%)',
                backgroundSize: '200% 100%'
              }} />
            </div>
            <style>{`
              @keyframes translateX {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
              }
            `}</style>
          </div>
        )}
        <p className="response-text">
          {isTranslating ? 'Translating...' : (translatedValue || 'Enter text above and press Enter to translate')}
        </p>
      </div>
    </div>
  );
}

export default TranslationBox;
