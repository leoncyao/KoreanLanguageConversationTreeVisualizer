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
  updateWordFields: (type, oldKorean, fields) => fetch(`${API_BASE_URL}/api/words/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, korean: oldKorean, ...fields })
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
  getRandomCurriculumPhrase: async (timeout = 8000, retries = 1) => {
    const url = `${API_BASE_URL}/api/curriculum-phrases/random`;
    
    // Helper to fetch with timeout (using Promise.race for compatibility)
    const fetchWithTimeout = async (url, timeoutMs) => {
      // Check if AbortController is available
      if (typeof AbortController !== 'undefined') {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const response = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);
          return response;
        } catch (error) {
          clearTimeout(timeoutId);
          if (error.name === 'AbortError' || error.name === 'AbortError') {
            throw new Error(`Request timeout after ${timeoutMs}ms`);
          }
          throw error;
        }
      } else {
        // Fallback for browsers without AbortController
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Request timeout after ${timeoutMs}ms`)), timeoutMs)
        );
        return Promise.race([fetch(url), timeoutPromise]);
      }
    };
    
    // Retry logic with exponential backoff
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetchWithTimeout(url, timeout);
        if (response.ok) {
          return response;
        }
        // For 504/502/503/408, retry if we have attempts left
        if ((response.status === 504 || response.status === 502 || response.status === 503 || response.status === 408) && attempt < retries) {
          lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
          // Exponential backoff: wait 500ms, 1000ms
          await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt)));
          continue;
        }
        // For other errors, return immediately
        return response;
      } catch (error) {
        lastError = error;
        // Only retry on timeout/network errors if we have attempts left
        const isRetryable = error.message && (
          error.message.includes('timeout') || 
          error.message.includes('Failed to fetch') || 
          error.name === 'TypeError' ||
          error.name === 'NetworkError'
        );
        if (attempt < retries && isRetryable) {
          // Exponential backoff: wait 500ms, 1000ms
          await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt)));
          continue;
        }
        // If no more retries or not retryable, throw
        throw error;
      }
    }
    throw lastError || new Error('Failed to fetch curriculum phrase after retries');
  },
  addCurriculumPhrase: (phrase) => {
    const now = new Date();
    const createdAt = now.toISOString ? now.toISOString() : String(Date.now());
    const payload = { created_at: createdAt, ...(phrase || {}) };
    return fetch(`${API_BASE_URL}/api/curriculum-phrases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },
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
  archiveCurriculumPhrase: (id, isArchived) => fetch(`${API_BASE_URL}/api/curriculum-phrases/${id}/archive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_archived: isArchived })
  }),

  // Journal API
  saveJournalEntry: (englishText, koreanText, date) => fetch(`${API_BASE_URL}/api/journal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ english_text: englishText, korean_text: koreanText, date })
  }),
  getJournalDays: (limit = 60) => fetch(`${API_BASE_URL}/api/journal/days?limit=${limit}`),
  getJournalEntriesByDate: (date) => fetch(`${API_BASE_URL}/api/journal?date=${encodeURIComponent(date)}`),
  
  // Conversations API
  deleteConversation: (id) => fetch(`${API_BASE_URL}/api/conversations/${id}`, {
    method: 'DELETE'
  }),

  // Mix API
  getMixState: () => fetch(`${API_BASE_URL}/api/mix`),
  generateMix: (mixItems) => fetch(`${API_BASE_URL}/api/mix/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mixItems })
  }),
  updateMixItems: (mixItems) => fetch(`${API_BASE_URL}/api/mix/update-items`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mixItems })
  }),
  updateMixIndex: (index) => fetch(`${API_BASE_URL}/api/mix/index`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ index })
  }),
  incrementMixFirstTryCorrect: () => fetch(`${API_BASE_URL}/api/mix/increment-first-try`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }),
  saveMixScore: (totalQuestions, firstTryCorrect) => fetch(`${API_BASE_URL}/api/mix/save-score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ totalQuestions, firstTryCorrect })
  }),
  getMixScores: (limit = 30) => fetch(`${API_BASE_URL}/api/mix/scores?limit=${limit}`),
  resetMixState: () => fetch(`${API_BASE_URL}/api/mix/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }),

  // Explanations
  saveExplanation: (phraseId, phraseType, koreanText, englishText, explanation) => fetch(`${API_BASE_URL}/api/explanations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phraseId, phraseType, koreanText, englishText, explanation })
  }),
  getExplanation: (phraseId, phraseType) => fetch(`${API_BASE_URL}/api/explanations/${encodeURIComponent(phraseId)}/${encodeURIComponent(phraseType)}`),
  getExplanationByText: (koreanText, englishText) => fetch(`${API_BASE_URL}/api/explanations/by-text?koreanText=${encodeURIComponent(koreanText)}&englishText=${encodeURIComponent(englishText)}`),

  // Version & Updates
  getVersion: () => fetch(`${API_BASE_URL}/api/version`),

  // Health
  health: () => fetch(`${API_BASE_URL}/api/health`)
};


