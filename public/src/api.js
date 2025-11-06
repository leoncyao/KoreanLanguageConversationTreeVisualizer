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
  chat: (prompt) => fetch(`${API_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
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
  getLearningWords: (limit = 200) => fetch(`${API_BASE_URL}/api/words/learning?limit=${limit}`),
  getWordsSummary: () => fetch(`${API_BASE_URL}/api/words/stats/summary`),
  updateWordCorrect: (word) => fetch(`${API_BASE_URL}/api/words/correct`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ word })
  }),
  updateWordTags: (type, korean, tags) => fetch(`${API_BASE_URL}/api/words/tags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, korean, ...tags })
  }),
  checkWordLearned: (word, threshold = 20) => fetch(`${API_BASE_URL}/api/words/check-learned`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ word, threshold })
  }),
  getGrammarRules: (limit = 200) => fetch(`${API_BASE_URL}/api/grammar-rules?limit=${limit}`),
  addGrammarRule: (rule) => fetch(`${API_BASE_URL}/api/grammar-rules`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rule)
  }),
  deleteGrammarRule: (id) => fetch(`${API_BASE_URL}/api/grammar-rules/${id}`, { method: 'DELETE' }),
  getModelVariations: () => fetch(`${API_BASE_URL}/api/model-variations`),
  saveModelVariations: (variations) => fetch(`${API_BASE_URL}/api/model-variations`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ variations })
  }),
  clearModelVariations: () => fetch(`${API_BASE_URL}/api/model-variations`, { method: 'DELETE' }),

  // Model sentence
  getModelSentence: () => fetch(`${API_BASE_URL}/api/model-sentence`),
  saveModelSentence: (english, korean) => fetch(`${API_BASE_URL}/api/model-sentence`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ english, korean })
  }),
  clearModelSentence: () => fetch(`${API_BASE_URL}/api/model-sentence`, {
    method: 'DELETE'
  }),

  // Curriculum phrases API
  getCurriculumPhrases: () => fetch(`${API_BASE_URL}/api/curriculum-phrases`),
  getRandomCurriculumPhrase: () => fetch(`${API_BASE_URL}/api/curriculum-phrases/random`),
  addCurriculumPhrase: (phrase) => fetch(`${API_BASE_URL}/api/curriculum-phrases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(phrase)
  }),
  updateCurriculumPhrase: (id, phrase) => fetch(`${API_BASE_URL}/api/curriculum-phrases/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(phrase)
  }),
  deleteCurriculumPhrase: (id) => fetch(`${API_BASE_URL}/api/curriculum-phrases/${id}`, {
    method: 'DELETE'
  }),
  updateCurriculumPhraseStats: (id, correct) => fetch(`${API_BASE_URL}/api/curriculum-phrases/${id}/correct`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correct })
  }),

  // Journal API
  saveJournalEntry: (englishText, koreanText, date) => fetch(`${API_BASE_URL}/api/journal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ english_text: englishText, korean_text: koreanText, date })
  }),
  getJournalDays: (limit = 60) => fetch(`${API_BASE_URL}/api/journal/days?limit=${limit}`),
  getJournalEntriesByDate: (date) => fetch(`${API_BASE_URL}/api/journal?date=${encodeURIComponent(date)}`),
  
  // Health
  health: () => fetch(`${API_BASE_URL}/api/health`)
};


