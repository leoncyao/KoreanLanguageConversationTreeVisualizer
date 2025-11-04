import React, { useState, useEffect, useCallback } from 'react';
import { api } from './api';
import './HomePage.css';

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

function CurriculumPage() {
  const [phrases, setPhrases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingPhrase, setEditingPhrase] = useState(null);
  const [newPhrase, setNewPhrase] = useState({ 
    korean_text: '', 
    english_text: '', 
    blank_word_indices: [], 
    correct_answers: [],
    blank_word_types: [],
    grammar_breakdown: null
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isAnalyzingGrammar, setIsAnalyzingGrammar] = useState(false);

  const loadPhrases = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      let res;
      try {
        res = await api.getCurriculumPhrases();
      } catch (fetchError) {
        // Network error or CORS issue
        if (fetchError instanceof TypeError && fetchError.message.includes('fetch')) {
          throw new Error('Network error: Unable to connect to server. Please check if the backend is running.');
        }
        throw fetchError;
      }
      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`Failed to fetch phrases: ${res.status} ${res.statusText}${errorText ? ` - ${errorText}` : ''}`);
      }
      const data = await res.json();
      setPhrases(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Error loading phrases:', e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(errorMessage || 'Failed to load phrases. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPhrases();
  }, [loadPhrases]);

  const detectLanguage = useCallback((text) => {
    if (!text) return null;
    // Simple heuristic: check if text contains Korean characters (Hangul)
    const koreanPattern = /[가-힣ㄱ-ㅎㅏ-ㅣ]/;
    return koreanPattern.test(text) ? 'ko' : 'en';
  }, []);

  const translateText = useCallback(async (text, targetLang) => {
    if (!text || !text.trim()) return '';
    setIsTranslating(true);
    try {
      const res = await api.translate(text, targetLang);
      if (!res.ok) {
        setError('Translation failed');
        return '';
      }
      const data = await res.json();
      return data.corrected || '';
    } catch (e) {
      setError('Translation error: ' + String(e && e.message || e));
      return '';
    } finally {
      setIsTranslating(false);
    }
  }, []);

  const analyzeGrammar = useCallback(async (korean, english) => {
    if (!korean || !english) return null;
    setIsAnalyzingGrammar(true);
    try {
      const prompt = `Break down this Korean sentence grammatically, including all particles, word functions, and sentence structure.

Korean: ${korean}
English: ${english}

Provide a detailed grammatical analysis including:
1. Each word/phrase and its role (subject, object, verb, adjective, etc.)
2. All particles (은/는, 이/가, 을/를, 에, 에서, etc.) and their functions
3. Verb tense and conjugation
4. Sentence structure (subject-object-verb order)
5. Any special grammar points or patterns

For each word in the sentence, identify its part of speech (noun, verb, adjective, adverb, particle, pronoun, conjunction).

Format the response clearly and structured, using markdown if helpful.`;
      const res = await api.chat(prompt);
      if (!res.ok) {
        setError('Grammar analysis failed');
        return null;
      }
      const data = await res.json();
      const breakdown = data.response || '';
      return breakdown;
    } catch (e) {
      setError('Grammar analysis error: ' + String(e && e.message || e));
      return null;
    } finally {
      setIsAnalyzingGrammar(false);
    }
  }, []);

  const detectWordType = useCallback((word, grammarBreakdown, koreanWords, wordIndex) => {
    if (!word || !grammarBreakdown) return null;
    
    // Simple heuristic: check if word is a particle
    const particles = ['은', '는', '이', '가', '을', '를', '에', '에서', '으로', '로', '와', '과', '의', '도', '만', '부터', '까지'];
    if (particles.includes(word.trim())) {
      return 'particle';
    }
    
    // Check grammar breakdown for word type
    const wordLower = word.toLowerCase();
    const breakdownLower = grammarBreakdown.toLowerCase();
    
    // Try to find the word in the breakdown and extract its type
    // Look for patterns like "word (type)" or "word - type"
    const patterns = [
      new RegExp(`${word}\\s*\\([^)]*(?:noun|verb|adjective|adverb|particle|pronoun|conjunction)[^)]*\\)`, 'i'),
      new RegExp(`${word}\\s*[-:]\\s*(?:a\\s+)?(noun|verb|adjective|adverb|particle|pronoun|conjunction)`, 'i'),
    ];
    
    for (const pattern of patterns) {
      const match = grammarBreakdown.match(pattern);
      if (match) {
        const typeMatch = match[0].match(/(noun|verb|adjective|adverb|particle|pronoun|conjunction)/i);
        if (typeMatch) {
          const detectedType = typeMatch[1].toLowerCase();
          // Normalize types
          if (detectedType === 'proper noun' || detectedType.includes('proper')) return 'proper-noun';
          return detectedType;
        }
      }
    }
    
    // Heuristic: verbs typically end with certain suffixes
    if (/[아어오우]요$|[습니다]$|[다]$|[는다]$/.test(word)) {
      return 'verb';
    }
    
    // Adjectives often end with certain patterns
    if (/[은는을를]$/.test(word) && word.length > 2) {
      return 'adjective';
    }
    
    return null; // Unknown
  }, []);

  const handleKoreanChange = useCallback((value) => {
    setNewPhrase({ ...newPhrase, korean_text: value });
  }, [newPhrase]);

  const handleEnglishChange = useCallback((value) => {
    setNewPhrase({ ...newPhrase, english_text: value });
  }, [newPhrase]);

  const handleKoreanKeyDown = useCallback(async (e) => {
    if (e.key === 'Enter' && newPhrase.korean_text && !newPhrase.english_text) {
      e.preventDefault();
      const translated = await translateText(newPhrase.korean_text, 'en');
      if (translated) {
        setNewPhrase(prev => ({ ...prev, english_text: translated }));
        // Auto-analyze grammar after translation
        const breakdown = await analyzeGrammar(newPhrase.korean_text, translated);
        if (breakdown) {
          setNewPhrase(prev => ({ ...prev, grammar_breakdown: breakdown }));
        }
      }
    }
  }, [newPhrase.korean_text, newPhrase.english_text, translateText, analyzeGrammar]);

  const handleEnglishKeyDown = useCallback(async (e) => {
    if (e.key === 'Enter' && newPhrase.english_text && !newPhrase.korean_text) {
      e.preventDefault();
      const translated = await translateText(newPhrase.english_text, 'ko');
      if (translated) {
        setNewPhrase(prev => ({ ...prev, korean_text: translated }));
        // Auto-analyze grammar after translation
        const breakdown = await analyzeGrammar(translated, newPhrase.english_text);
        if (breakdown) {
          setNewPhrase(prev => ({ ...prev, grammar_breakdown: breakdown }));
        }
      }
    }
  }, [newPhrase.korean_text, newPhrase.english_text, translateText, analyzeGrammar]);

  const toggleBlankWord = useCallback((index) => {
    setNewPhrase(prev => {
      const words = prev.korean_text.trim().split(' ').filter(w => w);
      if (index < 0 || index >= words.length) return prev;
      
      const currentIndices = prev.blank_word_indices || [];
      const newIndices = currentIndices.includes(index)
        ? currentIndices.filter(i => i !== index)
        : [...currentIndices, index].sort((a, b) => a - b);
      
      // Auto-populate correct answers from selected blank words
      const correctAnswers = newIndices.map(i => words[i]);
      
      // Detect word types for selected blanks
      const wordTypes = newIndices.map(i => {
        const word = words[i];
        return detectWordType(word, prev.grammar_breakdown, words, i) || null;
      });
      
      return {
        ...prev,
        blank_word_indices: newIndices,
        correct_answers: correctAnswers,
        blank_word_types: wordTypes
      };
    });
  }, [detectWordType]);

  const handleAdd = useCallback(async () => {
    try {
      if (!newPhrase.korean_text || !newPhrase.english_text) {
        setError('Korean and English text are required');
        return;
      }
      const words = newPhrase.korean_text.trim().split(' ').filter(w => w);
      const blankIndices = newPhrase.blank_word_indices || [];
      if (blankIndices.length === 0) {
        setError('Please select at least one word to blank');
        return;
      }
      // Validate all indices
      for (const idx of blankIndices) {
        if (idx < 0 || idx >= words.length) {
          setError(`Blank word index ${idx} is invalid (must be between 0 and ${words.length - 1})`);
          return;
        }
      }
      const res = await api.addCurriculumPhrase({
        korean_text: newPhrase.korean_text,
        english_text: newPhrase.english_text,
        blank_word_indices: blankIndices,
        correct_answers: Array.isArray(newPhrase.correct_answers) ? newPhrase.correct_answers : [],
        grammar_breakdown: newPhrase.grammar_breakdown || null,
        blank_word_types: Array.isArray(newPhrase.blank_word_types) ? newPhrase.blank_word_types : []
      });
      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`Failed to add phrase: ${res.status} ${res.statusText}${errorText ? ` - ${errorText}` : ''}`);
      }
      setNewPhrase({ korean_text: '', english_text: '', blank_word_indices: [], correct_answers: [], blank_word_types: [], grammar_breakdown: null });
      setShowAddForm(false);
      await loadPhrases();
    } catch (e) {
      setError(String(e && e.message || e));
    }
  }, [newPhrase, loadPhrases]);


  const handleUpdate = useCallback(async (id, phrase) => {
    try {
      const words = phrase.korean_text.trim().split(' ').filter(w => w);
      const blankIndices = phrase.blank_word_indices || [];
      if (blankIndices.length === 0) {
        setError('Please select at least one word to blank');
        return;
      }
      // Validate all indices
      for (const idx of blankIndices) {
        if (idx < 0 || idx >= words.length) {
          setError(`Blank word index ${idx} is invalid (must be between 0 and ${words.length - 1})`);
          return;
        }
      }
      // Detect word types for blanks if not already set
      const wordTypes = blankIndices.map((idx, arrayIdx) => {
        if (phrase.blank_word_types && phrase.blank_word_types[arrayIdx]) {
          return phrase.blank_word_types[arrayIdx];
        }
        const word = words[idx];
        return detectWordType(word, phrase.grammar_breakdown, words, idx) || null;
      });
      
      const res = await api.updateCurriculumPhrase(id, {
        korean_text: phrase.korean_text,
        english_text: phrase.english_text,
        blank_word_indices: blankIndices,
        correct_answers: Array.isArray(phrase.correct_answers) ? phrase.correct_answers : [],
        grammar_breakdown: phrase.grammar_breakdown || null,
        blank_word_types: wordTypes
      });
      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`Failed to update phrase: ${res.status} ${res.statusText}${errorText ? ` - ${errorText}` : ''}`);
      }
      setEditingId(null);
      setEditingPhrase(null);
      await loadPhrases();
    } catch (e) {
      setError(String(e && e.message || e));
    }
  }, [loadPhrases, detectWordType]);

  const handleDelete = useCallback(async (id) => {
    if (!window.confirm('Delete this phrase?')) return;
    try {
      const res = await api.deleteCurriculumPhrase(id);
      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`Failed to delete phrase: ${res.status} ${res.statusText}${errorText ? ` - ${errorText}` : ''}`);
      }
      await loadPhrases();
    } catch (e) {
      console.error('Error deleting phrase:', e);
      setError(String(e && e.message || e));
    }
  }, [loadPhrases]);

  const getBlankedSentence = (korean, blankIndices) => {
    const words = korean.trim().split(' ').filter(w => w);
    if (!Array.isArray(blankIndices) || blankIndices.length === 0) return korean;
    
    // Sort indices in descending order to replace from end to start
    const sortedIndices = [...blankIndices].sort((a, b) => b - a);
    const result = [...words];
    
    // Replace selected words with ____
    sortedIndices.forEach(idx => {
      if (idx >= 0 && idx < result.length) {
        result[idx] = '____';
      }
    });
    
    return result.join(' ');
  };

  if (loading) {
    return <div className="sentence-box">Loading curriculum phrases...</div>;
  }

  return (
    <div className="homepage">
      <h1>Current Curriculum</h1>
      <p>Manage phrases for practice</p>

      {error && (
        <div className="error-message" style={{ marginBottom: 16, padding: '12px', background: '#fee', border: '1px solid #fcc', borderRadius: 4, color: '#c33' }}>
          <strong>Error:</strong> {error}
          {(error.includes('Network error') || error.includes('CONNECTION_REFUSED') || error.includes('Failed to fetch') || error.includes('Unable to connect')) ? (
            <div style={{ marginTop: 8, fontSize: 12 }}>
              <strong>Tip:</strong> Make sure the backend server is running. Try running: <code style={{ background: '#fdd', padding: '2px 4px', borderRadius: 2 }}>npm run start-server-dev</code>
            </div>
          ) : null}
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <button className="generate-button" onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? 'Cancel' : 'Add New Phrase'}
        </button>
      </div>

      {showAddForm && (
        <div className="sentence-box" style={{ marginBottom: 20, textAlign: 'left' }}>
          <h3>Add New Phrase</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
                Korean Text {isTranslating && <span style={{ color: '#666', fontSize: 12 }}>(Translating...)</span>}
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={newPhrase.korean_text}
                  onChange={(e) => handleKoreanChange(e.target.value)}
                  onKeyDown={handleKoreanKeyDown}
                  placeholder="예: 제 기차는 지연돼요 (press Enter to translate to English)"
                  style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: 4 }}
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (newPhrase.korean_text && !newPhrase.english_text) {
                      const translated = await translateText(newPhrase.korean_text, 'en');
                      if (translated) {
                        setNewPhrase(prev => ({ ...prev, english_text: translated }));
                        // Auto-analyze grammar after translation
                        const breakdown = await analyzeGrammar(newPhrase.korean_text, translated);
                        if (breakdown) {
                          setNewPhrase(prev => ({ ...prev, grammar_breakdown: breakdown }));
                        }
                      }
                    }
                  }}
                  disabled={!newPhrase.korean_text || !!newPhrase.english_text || isTranslating || isAnalyzingGrammar}
                  style={{ padding: '8px 16px', border: '1px solid #ddd', borderRadius: 4, background: 'white', cursor: 'pointer' }}
                >
                  → EN
                </button>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
                English Text {isTranslating && <span style={{ color: '#666', fontSize: 12 }}>(Translating...)</span>}
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={newPhrase.english_text}
                  onChange={(e) => handleEnglishChange(e.target.value)}
                  onKeyDown={handleEnglishKeyDown}
                  placeholder="My train is delayed (press Enter to translate to Korean)"
                  style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: 4 }}
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (newPhrase.english_text && !newPhrase.korean_text) {
                      const translated = await translateText(newPhrase.english_text, 'ko');
                      if (translated) {
                        setNewPhrase(prev => ({ ...prev, korean_text: translated }));
                        // Auto-analyze grammar after translation
                        const breakdown = await analyzeGrammar(translated, newPhrase.english_text);
                        if (breakdown) {
                          setNewPhrase(prev => ({ ...prev, grammar_breakdown: breakdown }));
                        }
                      }
                    }
                  }}
                  disabled={!newPhrase.english_text || !!newPhrase.korean_text || isTranslating || isAnalyzingGrammar}
                  style={{ padding: '8px 16px', border: '1px solid #ddd', borderRadius: 4, background: 'white', cursor: 'pointer' }}
                >
                  → KO
                </button>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
                Blank Words (click words below to select multiple)
              </label>
              {newPhrase.korean_text ? (
                <div style={{ marginTop: 8, fontSize: 16, lineHeight: '1.8' }}>
                  {newPhrase.korean_text.trim().split(' ').filter(w => w).map((w, i) => {
                    const blankIndices = newPhrase.blank_word_indices || [];
                    const isSelected = blankIndices.includes(i);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleBlankWord(i)}
                        style={{
                          margin: '0 4px 4px 0',
                          padding: '6px 12px',
                          border: isSelected ? '2px solid #3498db' : '1px solid #ddd',
                          borderRadius: 4,
                          background: isSelected ? '#e3f2fd' : 'white',
                          color: isSelected ? '#1976d2' : '#333',
                          fontWeight: isSelected ? 'bold' : 'normal',
                          cursor: 'pointer',
                          fontSize: 14
                        }}
                      >
                        {i}: {w}
                      </button>
                    );
                  })}
                  <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                    Selected: {newPhrase.blank_word_indices?.length || 0} word(s) - {newPhrase.blank_word_indices?.map((i, idx) => {
                      const word = newPhrase.korean_text.trim().split(' ').filter(w => w)[i];
                      const wordType = newPhrase.blank_word_types && newPhrase.blank_word_types[idx] ? ` (${newPhrase.blank_word_types[idx]})` : '';
                      return `${i}:${word}${wordType}`;
                    }).join(', ') || 'none'}
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 8, fontSize: 14, color: '#999' }}>
                  Enter Korean text above to see selectable words
                </div>
              )}
            </div>
            {newPhrase.grammar_breakdown && (
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
                  Grammar Breakdown {isAnalyzingGrammar && <span style={{ color: '#666', fontSize: 12 }}>(Analyzing...)</span>}
                </label>
                <div 
                  style={{ 
                    marginTop: 8, 
                    padding: '12px', 
                    background: '#f8f9fa', 
                    border: '1px solid #ddd', 
                    borderRadius: 4,
                    fontSize: 14,
                    lineHeight: '1.6',
                    maxHeight: '300px',
                    overflowY: 'auto'
                  }}
                  dangerouslySetInnerHTML={{ __html: mdToHtml(newPhrase.grammar_breakdown) }}
                />
              </div>
            )}
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
                Correct Answers (comma-separated, optional)
              </label>
              <input
                type="text"
                value={Array.isArray(newPhrase.correct_answers) ? newPhrase.correct_answers.join(', ') : ''}
                onChange={(e) => {
                  const answers = e.target.value.split(',').map(a => a.trim()).filter(a => a);
                  setNewPhrase({ ...newPhrase, correct_answers: answers });
                }}
                placeholder="지연, 지연돼요"
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: 4 }}
              />
            </div>
            <button className="generate-button" onClick={handleAdd}>Add Phrase</button>
          </div>
        </div>
      )}

      {phrases.length === 0 ? (
        <div className="sentence-box">No curriculum phrases yet. Add some to get started!</div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {phrases.map((phrase) => {
            const isEditing = editingId === phrase.id;
            const words = phrase.korean_text.trim().split(' ').filter(w => w);

            return (
              <div key={phrase.id} className="sentence-box" style={{ textAlign: 'left' }}>
                {!isEditing ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
                        {getBlankedSentence(phrase.korean_text, phrase.blank_word_indices || (phrase.blank_word_index !== null && phrase.blank_word_index !== undefined ? [phrase.blank_word_index] : []))}
                      </div>
                      <div style={{ color: '#666', marginBottom: 8 }}>{phrase.english_text}</div>
                      <div style={{ fontSize: 12, color: '#999' }}>
                        Blank words: {phrase.blank_word_indices?.map((i, idx) => {
                          const word = words[i];
                          const wordType = phrase.blank_word_types && phrase.blank_word_types[idx] ? ` (${phrase.blank_word_types[idx]})` : '';
                          return `${i}:${word}${wordType}`;
                        }).join(', ') || (phrase.blank_word_index !== null && phrase.blank_word_index !== undefined ? `${phrase.blank_word_index}:${words[phrase.blank_word_index]}` : 'none')}
                        {phrase.correct_answers && phrase.correct_answers.length > 0 && (
                          <span> | Answers: {phrase.correct_answers.join(', ')}</span>
                        )}
                      </div>
                      {phrase.grammar_breakdown && (
                        <details style={{ marginTop: 8, fontSize: 12 }}>
                          <summary style={{ cursor: 'pointer', color: '#666' }}>Show Grammar Breakdown</summary>
                          <div 
                            style={{ 
                              marginTop: 8, 
                              padding: '8px', 
                              background: '#f8f9fa', 
                              border: '1px solid #ddd', 
                              borderRadius: 4,
                              fontSize: 12,
                              lineHeight: '1.5'
                            }}
                            dangerouslySetInnerHTML={{ __html: mdToHtml(phrase.grammar_breakdown) }}
                          />
                        </details>
                      )}
                      <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                        ✓ {phrase.times_correct || 0} | ✗ {phrase.times_incorrect || 0}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="regenerate-button" onClick={() => {
                        // Ensure blank_word_types is properly initialized when editing
                        const phraseToEdit = {
                          ...phrase,
                          blank_word_types: phrase.blank_word_types || []
                        };
                        setEditingId(phrase.id);
                        setEditingPhrase(phraseToEdit);
                      }}>Edit</button>
                      <button className="regenerate-button" onClick={() => handleDelete(phrase.id)}>Delete</button>
                    </div>
                  </div>
                ) : editingPhrase && editingPhrase.id === phrase.id ? (
                  <div style={{ display: 'grid', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>Korean Text</label>
                      <input
                        type="text"
                        value={editingPhrase.korean_text || ''}
                        onChange={(e) => setEditingPhrase({ ...editingPhrase, korean_text: e.target.value })}
                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: 4 }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>English Text</label>
                      <input
                        type="text"
                        value={editingPhrase.english_text || ''}
                        onChange={(e) => setEditingPhrase({ ...editingPhrase, english_text: e.target.value })}
                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: 4 }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
                        Blank Words (click words below to select multiple)
                      </label>
                      {editingPhrase.korean_text ? (
                        <div style={{ marginTop: 8, fontSize: 16, lineHeight: '1.8' }}>
                          {editingPhrase.korean_text.trim().split(' ').filter(w => w).map((w, i) => {
                            const blankIndices = editingPhrase.blank_word_indices || (editingPhrase.blank_word_index !== null && editingPhrase.blank_word_index !== undefined ? [editingPhrase.blank_word_index] : []);
                            const isSelected = blankIndices.includes(i);
                            return (
                              <button
                                key={i}
                                type="button"
                                onClick={() => {
                                  const words = editingPhrase.korean_text.trim().split(' ').filter(w => w);
                                  if (i < 0 || i >= words.length) return;
                                  const currentIndices = editingPhrase.blank_word_indices || (editingPhrase.blank_word_index !== null && editingPhrase.blank_word_index !== undefined ? [editingPhrase.blank_word_index] : []);
                                  const newIndices = currentIndices.includes(i)
                                    ? currentIndices.filter(idx => idx !== i)
                                    : [...currentIndices, i].sort((a, b) => a - b);
                                  const correctAnswers = newIndices.map(idx => words[idx]);
                                  // Detect word types for blanks
                                  const wordTypes = newIndices.map(idx => {
                                    const word = words[idx];
                                    return detectWordType(word, editingPhrase.grammar_breakdown, words, idx) || null;
                                  });
                                  setEditingPhrase({ ...editingPhrase, blank_word_indices: newIndices, correct_answers: correctAnswers, blank_word_types: wordTypes });
                                }}
                                style={{
                                  margin: '0 4px 4px 0',
                                  padding: '6px 12px',
                                  border: isSelected ? '2px solid #3498db' : '1px solid #ddd',
                                  borderRadius: 4,
                                  background: isSelected ? '#e3f2fd' : 'white',
                                  color: isSelected ? '#1976d2' : '#333',
                                  fontWeight: isSelected ? 'bold' : 'normal',
                                  cursor: 'pointer',
                                  fontSize: 14
                                }}
                              >
                                {i}: {w}
                              </button>
                            );
                          })}
                          <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                            Selected: {(editingPhrase.blank_word_indices || (editingPhrase.blank_word_index !== null && editingPhrase.blank_word_index !== undefined ? [editingPhrase.blank_word_index] : [])).length} word(s)
                            {editingPhrase.blank_word_indices && editingPhrase.blank_word_indices.length > 0 && (
                              <div style={{ marginTop: 4 }}>
                                {editingPhrase.blank_word_indices.map((idx, arrayIdx) => {
                                  const words = editingPhrase.korean_text.trim().split(' ').filter(w => w);
                                  const word = words[idx];
                                  const wordType = editingPhrase.blank_word_types && editingPhrase.blank_word_types[arrayIdx] ? ` (${editingPhrase.blank_word_types[arrayIdx]})` : '';
                                  return (
                                    <span key={idx} style={{ marginRight: 8, fontSize: 11 }}>
                                      {idx}:{word}{wordType}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div style={{ marginTop: 8, fontSize: 14, color: '#999' }}>
                          Enter Korean text above to see selectable words
                        </div>
                      )}
                    </div>
                    {editingPhrase.blank_word_indices && editingPhrase.blank_word_indices.length > 0 && (
                      <div>
                        <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Correct Answers for Each Blank</label>
                        {editingPhrase.blank_word_indices.map((wordIndex, idx) => {
                          const words = editingPhrase.korean_text.trim().split(' ').filter(w => w);
                          const word = words[wordIndex];
                          const wordType = editingPhrase.blank_word_types && editingPhrase.blank_word_types[idx] ? editingPhrase.blank_word_types[idx] : null;
                          const currentAnswer = Array.isArray(editingPhrase.correct_answers) && idx < editingPhrase.correct_answers.length 
                            ? editingPhrase.correct_answers[idx] 
                            : word; // Default to the word itself if no answer set
                          return (
                            <div key={idx} style={{ marginBottom: 8 }}>
                              <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: '#666' }}>
                                Blank {idx + 1}: Word at index {wordIndex} "{word}"{wordType ? ` (${wordType})` : ''}
                              </label>
                              <input
                                type="text"
                                value={currentAnswer}
                                onChange={(e) => {
                                  const newAnswers = [...(editingPhrase.correct_answers || [])];
                                  while (newAnswers.length <= idx) {
                                    newAnswers.push('');
                                  }
                                  newAnswers[idx] = e.target.value;
                                  setEditingPhrase({ ...editingPhrase, correct_answers: newAnswers });
                                }}
                                placeholder={word}
                                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: 4 }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="generate-button" onClick={() => handleUpdate(phrase.id, editingPhrase)}>Save</button>
                      <button className="regenerate-button" onClick={() => { setEditingId(null); setEditingPhrase(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default CurriculumPage;

