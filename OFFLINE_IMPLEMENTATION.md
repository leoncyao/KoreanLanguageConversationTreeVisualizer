# Offline Implementation Guide

This document outlines how to make the Korean Language Conversation Tree Visualizer app work offline by disabling API calls for translation and AI generation features when the device is offline.

## Overview

The app currently relies on several backend API endpoints for:
- **Translation**: `/api/translate` - Translates Korean text to English
- **AI Chat/Generation**: `/api/chat` - Generates sentences, conversations, word sets, etc.
- **Sentence Variations**: `/api/generate-variations` - Creates sentence variations

When offline, these features should be gracefully disabled with clear user feedback.

## Current Offline Detection

The app already has basic offline detection in `Navbar.js`:
- Uses `navigator.onLine` to detect online/offline status
- Shows a status banner when offline
- Has a `pingBackend` function that checks backend health

## Implementation Strategy

### 1. Create Offline Detection Hook

Create a shared hook/utility for offline detection:

**File: `public/src/hooks/useOffline.js`**
```javascript
import { useState, useEffect } from 'react';

export function useOffline() {
  const [isOffline, setIsOffline] = useState(() => {
    return typeof navigator !== 'undefined' ? !navigator.onLine : false;
  });

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOffline;
}
```

### 2. Modify API Calls to Check Offline Status

**File: `public/src/api.js`**

Wrap API calls with offline checks:

```javascript
// Add at the top
const checkOffline = () => {
  return typeof navigator !== 'undefined' && !navigator.onLine;
};

export const api = {
  // ... existing code ...

  translate: (text, targetLang) => {
    if (checkOffline()) {
      return Promise.reject(new Error('Offline: Translation unavailable'));
    }
    return fetch(`${API_BASE_URL}/api/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, targetLang })
    });
  },

  chat: (prompt) => {
    if (checkOffline()) {
      return Promise.reject(new Error('Offline: AI generation unavailable'));
    }
    return fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
  },

  generateVariations: (english, korean) => {
    if (checkOffline()) {
      return Promise.reject(new Error('Offline: Sentence variations unavailable'));
    }
    return fetch(`${API_BASE_URL}/api/generate-variations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ english, korean })
    });
  },

  // ... rest of API methods ...
};
```

### 3. Update Components to Handle Offline State

#### A. TranslationBox.js

**Current location**: `public/src/TranslationBox.js`

**Changes needed**:
1. Import `useOffline` hook
2. Disable translate button when offline
3. Show offline message
4. Use cached translations when available

```javascript
import { useOffline } from './hooks/useOffline';

function TranslationBox() {
  const isOffline = useOffline();
  
  // ... existing code ...

  const performTranslation = async () => {
    if (!freeInputValue.trim()) return;
    
    if (isOffline) {
      // Try to use cached translation
      const cached = getCachedTranslation(freeInputValue);
      if (cached) {
        setTranslatedValue(cached);
        return;
      }
      // Show error message
      setError('Translation unavailable while offline. Please connect to the internet.');
      return;
    }

    // ... existing translation logic ...
  };

  return (
    // ... existing JSX ...
    <button
      onClick={performTranslation}
      disabled={!freeInputValue.trim() || isOffline}
      title={isOffline ? 'Translation unavailable offline' : 'Translate (Enter)'}
    >
      Enter
    </button>
    {isOffline && (
      <div style={{ color: '#856404', fontSize: '12px', marginTop: '4px' }}>
        ⚠️ Offline: Translation unavailable
      </div>
    )}
  );
}
```

#### B. AudioLearningPage.js

**Current location**: `public/src/AudioLearningPage.js`

**Key functions to modify**:
- `generateLearningSentence` - Uses `api.chat`
- `generateConversationSet` - Uses `api.chat`
- `generateQuizSentence` - Uses `api.chat`
- `getWordByWordPairs` - Uses `api.chat`
- `handleGenerateSet` - Uses `api.chat`

**Changes needed**:
1. Import `useOffline` hook
2. Disable buttons that trigger AI generation when offline
3. Show error messages
4. Provide fallback behavior where possible

```javascript
import { useOffline } from './hooks/useOffline';

function AudioLearningPage() {
  const isOffline = useOffline();
  
  // ... existing code ...

  const generateConversationSet = React.useCallback(async (contextKorean = '', contextEnglish = '') => {
    if (isOffline) {
      throw new Error('Offline: Cannot generate conversations. Please connect to the internet.');
    }
    // ... existing generation logic ...
  }, [isOffline, /* other deps */]);

  // Update UI to disable buttons
  return (
    // ... existing JSX ...
    <button
      className="audio-btn"
      onClick={handleGenerateNewConversation}
      disabled={isOffline}
      title={isOffline ? 'AI generation unavailable offline' : 'Generate a new 5‑turn conversation'}
    >
      Generate New Conversation
    </button>
    {isOffline && (
      <div style={{ padding: '8px', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 6, fontSize: '12px', color: '#856404', marginTop: '8px' }}>
        ⚠️ Offline: AI features unavailable. Some functions require internet connection.
      </div>
    )}
  );
}
```

#### C. CurriculumPracticePage.js

**Current location**: `public/src/CurriculumPracticePage.js`

**Key functions to modify**:
- `generateVariation` - Uses `api.generateVariations`
- `generateVerbPracticeSentence` - Uses `api.chat`
- `getNextConversationSentence` - Uses `api.chat` (if needed)

**Changes needed**:
1. Import `useOffline` hook
2. Disable "Generate Variation" button when offline
3. Show error messages
4. Skip AI-generated variations when offline

```javascript
import { useOffline } from './hooks/useOffline';

function CurriculumPracticePage() {
  const isOffline = useOffline();
  
  // ... existing code ...

  const generateVariation = useCallback(async (phrase) => {
    if (isOffline) {
      setError('Offline: Cannot generate sentence variations. Please connect to the internet.');
      return null;
    }
    // ... existing variation logic ...
  }, [isOffline, /* other deps */]);

  // Update UI
  return (
    // ... existing JSX ...
    <button
      onClick={handleGenerateVariation}
      disabled={isOffline || isLoadingExplanation}
      title={isOffline ? 'AI generation unavailable offline' : 'Generate variation'}
    >
      Generate Variation
    </button>
  );
}
```

#### D. KpopLyricsPage.js

**Current location**: `public/src/KpopLyricsPage.js`

**Key functions to modify**:
- `translateLine` - Uses `api.translate`
- `translateAll` - Uses `api.translate` (via `translateLine`)
- `saveEditor` - Auto-translates new songs (uses `api.translate`)

**Changes needed**:
1. Import `useOffline` hook
2. Disable translate buttons when offline
3. Skip auto-translation when offline
4. Show clear offline messages

```javascript
import { useOffline } from './hooks/useOffline';

function KpopLyricsPage() {
  const isOffline = useOffline();
  
  // ... existing code ...

  const translateLine = React.useCallback(async (index) => {
    if (isOffline) {
      return null; // Silently fail when offline
    }
    // ... existing translation logic ...
  }, [isOffline, /* other deps */]);

  const saveEditor = React.useCallback(async () => {
    // ... existing save logic ...
    
    // Auto-translate line by line for new songs
    if (isNew && editorLyrics.trim() && !isOffline) {
      // Only auto-translate if online
      // ... existing auto-translation logic ...
    }
  }, [isOffline, /* other deps */]);

  return (
    // ... existing JSX ...
    <button
      type="button"
      className="translate-button"
      onClick={translateAll}
      disabled={!selectedSong || parsedLines.length === 0 || translatingAll || isOffline}
      title={isOffline ? 'Translation unavailable offline' : 'Translate all lines'}
    >
      {translatingAll ? 'Translating…' : 'Translate All'}
    </button>
    {isOffline && (
      <div style={{ padding: '8px', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 6, fontSize: '12px', color: '#856404', marginTop: '8px' }}>
        ⚠️ Offline: Translation unavailable. Please connect to the internet.
      </div>
    )}
  );
}
```

### 4. Enhance Offline Caching (Optional)

For better offline experience, implement caching for translations:

**File: `public/src/utils/translationCache.js`**
```javascript
const CACHE_KEY = 'translation_cache_v1';
const MAX_CACHE_SIZE = 1000; // Limit cache size

export function getCachedTranslation(text, targetLang = 'en') {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    const key = `${targetLang}:${text}`;
    return cache[key] || null;
  } catch (_) {
    return null;
  }
}

export function setCachedTranslation(text, translation, targetLang = 'en') {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    const key = `${targetLang}:${text}`;
    cache[key] = translation;
    
    // Limit cache size
    const keys = Object.keys(cache);
    if (keys.length > MAX_CACHE_SIZE) {
      // Remove oldest entries (simple FIFO)
      const toRemove = keys.slice(0, keys.length - MAX_CACHE_SIZE);
      toRemove.forEach(k => delete cache[k]);
    }
    
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (_) {
    // Cache full or localStorage unavailable
  }
}
```

Then update `TranslationBox.js` to use cache:
```javascript
import { getCachedTranslation, setCachedTranslation } from './utils/translationCache';

const performTranslation = async () => {
  // ... existing code ...
  
  // Check cache first
  const cached = getCachedTranslation(freeInputValue, 'en');
  if (cached) {
    setTranslatedValue(cached);
    return;
  }
  
  // If offline and no cache, show error
  if (isOffline) {
    setError('Translation unavailable while offline. Please connect to the internet.');
    return;
  }
  
  // Make API call
  const res = await api.translate(freeInputValue, 'en');
  // ... handle response ...
  
  // Cache the result
  if (translatedValue) {
    setCachedTranslation(freeInputValue, translatedValue, 'en');
  }
};
```

## Files to Modify

### Core Files
1. **`public/src/hooks/useOffline.js`** - NEW: Offline detection hook
2. **`public/src/api.js`** - Add offline checks to API methods
3. **`public/src/utils/translationCache.js`** - NEW: Translation caching utility (optional)

### Component Files
4. **`public/src/TranslationBox.js`** - Handle offline state, disable translate, use cache
5. **`public/src/AudioLearningPage.js`** - Disable AI generation buttons, show offline messages
6. **`public/src/CurriculumPracticePage.js`** - Disable variation generation, handle offline
7. **`public/src/KpopLyricsPage.js`** - Disable translation, skip auto-translate when offline

## Testing Checklist

- [ ] Test offline detection (toggle airplane mode or disconnect network)
- [ ] Verify offline banner appears in Navbar
- [ ] Test that translate buttons are disabled when offline
- [ ] Test that AI generation buttons are disabled when offline
- [ ] Verify error messages appear when trying to use offline features
- [ ] Test that cached translations work when offline (if implemented)
- [ ] Test that features work again when coming back online
- [ ] Verify no console errors when offline
- [ ] Test on mobile devices (iOS/Android)

## User Experience Considerations

1. **Clear Feedback**: Always show why features are disabled (offline status)
2. **Graceful Degradation**: Use cached data when available
3. **No Silent Failures**: Show error messages, don't just fail silently
4. **Consistent Messaging**: Use consistent offline messaging across all components
5. **Visual Indicators**: Disable buttons visually, not just functionally

## Additional Notes

- The app already has some offline detection in `Navbar.js` - this can be reused
- Consider using a Service Worker for more advanced offline capabilities (future enhancement)
- Some features like curriculum practice (using local data) should work fine offline
- TTS (Text-to-Speech) features may still work offline if audio files are cached
- Database operations (curriculum phrases, conversations) are server-side, so they won't work offline unless you implement local storage fallback

## Implementation Priority

1. **High Priority**: Translation features (most commonly used)
2. **High Priority**: AI generation in Audio Learning page
3. **Medium Priority**: Sentence variations in Practice page
4. **Low Priority**: Translation caching (nice-to-have enhancement)

## Related Documentation

- **Android App Updates**: See `ANDROID_UPDATE_GUIDE.md` for information on how users can update the app on Android devices, including in-app update mechanisms and APK distribution options.



