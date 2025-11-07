import React, { useState, useRef } from 'react';
import { api } from './api';
import './HomePage.css';

function TranslationBox({ onTranslated }) {
  const [freeInputValue, setFreeInputValue] = useState('');
  const [translatedValue, setTranslatedValue] = useState('');
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

  const handleTranslate = async (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      
      try {
        // If offline, use cached/offline translator
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          const offline = offlineTranslate(freeInputValue);
          if (offline) {
            setTranslatedValue(offline);
            if (onTranslated) { try { onTranslated({ input: freeInputValue, translation: offline }); } catch (_) {} }
            return;
          }
          setTranslatedValue('Offline: no cached translation. Connect to translate.');
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
