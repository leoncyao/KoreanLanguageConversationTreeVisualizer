// Text-to-Speech using HTML5 Audio (works with MediaSession for background playback)
// Uses backend TTS API to generate audio, then plays with HTML5 Audio element

import { updateMediaSession, requestWakeLock, ensureAudioContextActive } from './backgroundAudio';

// API base URL (same pattern as api.js)
const API_BASE_URL = process.env.API_BASE_URL || '';

// Global audio element for MediaSession integration
let currentAudioElement = null;

// Cache for audio URLs (memoization)
const audioCache = new Map();
const MAX_CACHE_SIZE = 100;

// Clean up old cache entries
function cleanupCache() {
  if (audioCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(audioCache.entries());
    // Remove oldest entries
    const toRemove = entries.slice(0, entries.length - MAX_CACHE_SIZE);
    toRemove.forEach(([key, url]) => {
      try {
        URL.revokeObjectURL(url);
      } catch (_) {}
      audioCache.delete(key);
    });
  }
}

// Get TTS audio URL from backend
async function getTTSAudioUrl(text, lang = 'ko-KR', rate = 0.9) {
  try {
    // Check cache first
    const cacheKey = `${text}_${lang}_${rate}`;
    if (audioCache.has(cacheKey)) {
      return audioCache.get(cacheKey);
    }
    
    // Call backend TTS API
    const response = await fetch(`${API_BASE_URL}/api/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, lang, rate }),
    });
    
    if (!response.ok) {
      throw new Error(`TTS API returned ${response.status}`);
    }
    
    // Get audio blob
    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    
    // Cache the URL
    audioCache.set(cacheKey, audioUrl);
    cleanupCache();
    
    return audioUrl;
  } catch (err) {
    console.error('TTS API error:', err);
    throw err;
  }
}

// Play audio using HTML5 Audio element (works with MediaSession)
async function playAudioWithMediaSession(audioUrl, text, lang) {
  return new Promise((resolve) => {
    try {
      // Stop any current audio
      if (currentAudioElement) {
        try {
          currentAudioElement.pause();
          currentAudioElement.src = '';
          currentAudioElement.load();
        } catch (_) {}
      }
      
      const audio = new Audio(audioUrl);
      currentAudioElement = audio;
      
      // Enable background playback attributes
      audio.setAttribute('playsinline', 'true');
      audio.setAttribute('preload', 'auto');
      
      // Set up MediaSession metadata and handlers
      updateMediaSession(
        text.substring(0, 50),
        lang === 'ko-KR' ? 'Korean' : 'English',
        true,
        {
          play: () => {
            audio.play().catch(() => {});
          },
          pause: () => {
            audio.pause();
            updateMediaSession(text.substring(0, 50), lang === 'ko-KR' ? 'Korean' : 'English', false);
          },
          stop: () => {
            audio.pause();
            audio.currentTime = 0;
            updateMediaSession(text.substring(0, 50), lang === 'ko-KR' ? 'Korean' : 'English', false);
            resolve();
          }
        }
      );
      
      // Ensure audio context and wake lock are active
      ensureAudioContextActive();
      requestWakeLock();
      
      // Set up event handlers
      audio.onended = () => {
        updateMediaSession(text.substring(0, 50), lang === 'ko-KR' ? 'Korean' : 'English', false);
        resolve();
      };
      
      audio.onerror = (err) => {
        console.error('Audio playback error:', err);
        updateMediaSession(text.substring(0, 50), lang === 'ko-KR' ? 'Korean' : 'English', false);
        resolve();
      };
      
      audio.onpause = () => {
        updateMediaSession(text.substring(0, 50), lang === 'ko-KR' ? 'Korean' : 'English', false);
      };
      
      audio.onplay = () => {
        updateMediaSession(text.substring(0, 50), lang === 'ko-KR' ? 'Korean' : 'English', true);
        ensureAudioContextActive();
        requestWakeLock();
      };
      
      // Play the audio
      audio.play().then(() => {
        // Audio started playing
      }).catch((err) => {
        console.error('Audio play failed:', err);
        updateMediaSession(text.substring(0, 50), lang === 'ko-KR' ? 'Korean' : 'English', false);
        resolve();
      });
      
    } catch (err) {
      console.error('playAudioWithMediaSession error:', err);
      resolve();
    }
  });
}

// Main TTS function using HTML5 Audio (works with MediaSession)
async function speakToAudio(text, lang = 'ko-KR', rate = 0.9) {
  try {
    if (!text || window.__APP_MUTED__ === true) return Promise.resolve();
    
    // Ensure audio context is active
    await ensureAudioContextActive();
    await requestWakeLock();
    
    const globalSpeed = window.__APP_SPEECH_SPEED__ || 1.0;
    const finalRate = rate * globalSpeed;
    
    // Get audio URL from TTS API
    const audioUrl = await getTTSAudioUrl(text, lang, finalRate);
    
    // Play using HTML5 Audio (works with MediaSession)
    return await playAudioWithMediaSession(audioUrl, text, lang);
    
  } catch (err) {
    console.error('speakToAudio error:', err);
    // Fallback to direct SpeechSynthesis if TTS API fails
    return speakDirect(text, lang, rate);
  }
}

// Fallback: Direct SpeechSynthesis (for when TTS API isn't available)
async function speakDirect(text, lang = 'ko-KR', rate = 0.9) {
  try {
    if (!text || window.__APP_MUTED__ === true) return Promise.resolve();
    const synth = window.speechSynthesis;
    if (!synth) return Promise.resolve();
    
    await ensureAudioContextActive();
    await requestWakeLock();
    
    synth.cancel();
    const globalSpeed = window.__APP_SPEECH_SPEED__ || 1.0;
    
    updateMediaSession(text.substring(0, 50), lang === 'ko-KR' ? 'Korean' : 'English', true);
    
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.rate = rate * globalSpeed;
      u.onstart = async () => {
        await requestWakeLock();
        await ensureAudioContextActive();
      };
      u.onend = () => resolve();
      u.onerror = () => resolve();
      synth.speak(u);
    });
  } catch (_) {
    return Promise.resolve();
  }
}

// Cleanup function
function cleanupAudioCache() {
  audioCache.forEach((url) => {
    try {
      URL.revokeObjectURL(url);
    } catch (_) {}
  });
  audioCache.clear();
  
  if (currentAudioElement) {
    try {
      currentAudioElement.pause();
      currentAudioElement.src = '';
      currentAudioElement.load();
    } catch (_) {}
    currentAudioElement = null;
  }
}

export { speakToAudio, speakDirect, cleanupAudioCache };
