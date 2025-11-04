import React, { useState, useEffect, useCallback } from 'react';
import ModelSentence from './ModelSentence';
import PhrasePractice from './PhrasePractice';
import { api } from './api';
import './HomePage.css';

function HomePage() {
  const [modelSentence, setModelSentence] = useState(null);
  const [activeGrammarRule, setActiveGrammarRule] = useState(null);
  const [showModelDialog, setShowModelDialog] = useState(false);

  // Load model sentence from database on mount
  useEffect(() => {
    const loadModelSentence = async () => {
      try {
        const response = await api.getModelSentence();
        if (response.ok) {
          const data = await response.json();
          setModelSentence(data);
        }
      } catch (err) {
        console.log('No model sentence found:', err);
      }
    };
    loadModelSentence();
  }, []);

  const handleModelUpdate = useCallback((sentence) => {
    setModelSentence(sentence);
  }, []);

  // If a model sentence is already set (e.g., from DB), try to find its grammar rule
  useEffect(() => {
    if (!modelSentence) return;
    let mounted = true;
    (async () => {
      try {
        const res = await api.getGrammarRules(300);
        if (!res.ok) return;
        const rules = await res.json();
        const match = (Array.isArray(rules) ? rules : []).find(r => r && r.model_korean === modelSentence.korean && r.model_english === modelSentence.english);
        if (mounted && match) {
          setActiveGrammarRule(match);
        }
      } catch (_) {}
    })();
    return () => { mounted = false; };
  }, [modelSentence]);

  const handleRandomGrammarModel = useCallback(async () => {
    try {
      const res = await api.getGrammarRules(300);
      if (!res.ok) return;
      const rules = await res.json();
      const candidates = (Array.isArray(rules) ? rules : []).filter(r => r && r.model_korean && r.model_english);
      if (candidates.length === 0) return;
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      await api.saveModelSentence(pick.model_english, pick.model_korean);
      setModelSentence({ english: pick.model_english, korean: pick.model_korean });
      setActiveGrammarRule(pick);
    } catch (_) {}
  }, []);

  return (
    <div className="homepage">
      {/* Phrase box at the top */}
      <PhrasePractice modelSentence={modelSentence} grammarRule={activeGrammarRule} />

      {/* Open dialog for model & grammar controls */}
      <button onClick={() => setShowModelDialog(true)} className="regenerate-button" style={{ marginTop: 12 }}>
        Model & Grammar Settings
      </button>

      {showModelDialog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, width: 'min(720px, 92vw)', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h2 style={{ margin: 0 }}>Model & Grammar</h2>
              <button type="button" className="regenerate-button" onClick={() => setShowModelDialog(false)}>Close</button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <ModelSentence onModelUpdate={handleModelUpdate} />
              <button onClick={handleRandomGrammarModel} className="regenerate-button" style={{ marginTop: 12 }}>
                Random Grammar Model
              </button>
              {activeGrammarRule && (
                <div className="sentence-box" style={{ textAlign: 'left', marginTop: 12 }}>
                  <h3 style={{ margin: 0 }}>Current Grammar Rule</h3>
                  {activeGrammarRule.title && <p style={{ margin: '6px 0', fontWeight: 600 }}>{activeGrammarRule.title}</p>}
                  {activeGrammarRule.description && <p style={{ margin: '6px 0' }}>{activeGrammarRule.description}</p>}
                  {(activeGrammarRule.example_korean || activeGrammarRule.example_english) && (
                    <p style={{ margin: '6px 0' }}>
                      {activeGrammarRule.example_korean && <span style={{ fontWeight: 600, marginRight: 8 }}>{activeGrammarRule.example_korean}</span>}
                      {activeGrammarRule.example_english && <span style={{ color: '#6b7280' }}>{activeGrammarRule.example_english}</span>}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HomePage;
