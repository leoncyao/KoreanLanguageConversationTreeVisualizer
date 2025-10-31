// API configuration
// Use relative URLs (empty string) for development - allows app to work from any device
// Webpack dev server's proxy forwards /api/* to backend
// In production, this can be set via environment variable or will default to empty string
const API_BASE_URL = process.env.API_BASE_URL || '';

export const api = {
  // Phrases API
  getRandomPhrase: () => fetch(`${API_BASE_URL}/api/phrases/random`),
  updatePhraseStats: (id, correct) => fetch(`${API_BASE_URL}/api/phrases/${id}/correct`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correct })
  }),
  
  // Sentences API
  getSentences: () => fetch(`${API_BASE_URL}/api/sentences`),
  updateSentenceStats: (id, correct) => fetch(`${API_BASE_URL}/api/sentences/${id}/correct`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correct })
  }),
  
  // Translation API
  translate: (text, targetLang) => fetch(`${API_BASE_URL}/api/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, targetLang })
  }),

  // Generate sentence variations
  generateVariations: (english, korean) => fetch(`${API_BASE_URL}/api/generate-variations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ english, korean })
  }),

  // Words by part of speech
  getWordsByType: (type, limit = 50) => fetch(`${API_BASE_URL}/api/words/${type}?limit=${limit}`),
  getWordsSummary: () => fetch(`${API_BASE_URL}/api/words/stats/summary`),
  updateWordCorrect: (word) => fetch(`${API_BASE_URL}/api/words/correct`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ word })
  }),

  // Model sentence
  getModelSentence: () => fetch(`${API_BASE_URL}/api/model-sentence`),
  saveModelSentence: (english, korean) => fetch(`${API_BASE_URL}/api/model-sentence`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ english, korean })
  }),
  clearModelSentence: () => fetch(`${API_BASE_URL}/api/model-sentence`, {
    method: 'DELETE'
  })
};


