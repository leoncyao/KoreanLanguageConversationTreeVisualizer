import React from 'react';
import { Link } from 'react-router-dom';
import TranslationBox from './TranslationBox';
import './TranslationPage.css';

function TranslationPage() {
  return (
    <div className="translation-page">
      <div className="translation-container">
        <header className="translation-header">
          <h1 className="translation-title">Translator</h1>
          <p className="translation-subtitle">Type and press Enter to translate to Korean.</p>
        </header>

        <div className="translation-card">
          <TranslationBox />
        </div>

        <div className="translation-actions">
          <Link to="/" className="translation-link">Back to Home</Link>
        </div>
      </div>
    </div>
  );
}

export default TranslationPage;


