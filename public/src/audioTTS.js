// Text-to-Speech using HTML5 Audio (works with MediaSession for background playback)
// Uses backend TTS API to generate audio, then plays with HTML5 Audio element

import { updateMediaSession, requestWakeLock, ensureAudioContextActive } from './backgroundAudio';

// API base URL (same pattern as api.js)
const API_BASE_URL = process.env.API_BASE_URL || '';

// Global persistent audio element for MediaSession integration
let currentAudioElement = null;
let visibilityChangeHandler = null;
let audioResumeInterval = null;

// Cache for audio URLs (memoization)
const audioCache = new Map();
const MAX_CACHE_SIZE = 100;

// Prefetch queue: Preload next audio files while current plays
const prefetchQueue = new Map(); // Map of audioUrl -> Audio element
const MAX_PREFETCH_QUEUE_SIZE = 100; // Default prefetch queue size
let prefetchQueueSize = MAX_PREFETCH_QUEUE_SIZE;

// Initialize persistent audio element
function initAudioElement() {
  if (!currentAudioElement) {
    currentAudioElement = new Audio();
    currentAudioElement.setAttribute('playsinline', 'true');
    currentAudioElement.setAttribute('preload', 'auto');
    // Remove crossorigin - not needed for blob URLs and can cause issues
    // currentAudioElement.setAttribute('crossorigin', 'anonymous');
    // Ensure audio can play in background (important for minimized apps)
    currentAudioElement.setAttribute('webkit-playsinline', 'true');
    // Set volume to ensure it plays
    currentAudioElement.volume = 1.0;
    // Don't add to DOM - Audio elements work fine without being in DOM
    // HTTP URLs (MP3 files) work better for background playback than blob URLs
  }
  return currentAudioElement;
}

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
// Returns HTTP URL to saved MP3 file (better for background playback)
async function getTTSAudioUrl(text, lang = 'ko-KR', rate = 0.9) {
  try {
    // Check cache first
    const cacheKey = `${text}_${lang}_${rate}`;
    if (audioCache.has(cacheKey)) {
      try { console.log('[AudioTTS] cache hit', { text: String(text).slice(0, 60), lang, rate }); } catch (_) {}
      return audioCache.get(cacheKey);
    }
    
    // Call backend TTS API - returns URL to saved MP3 file
    try { console.log('[AudioTTS] fetch TTS', { text: String(text).slice(0, 60), lang, rate }); } catch (_) {}
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
    
    // Get JSON response with URL to saved MP3 file
    const data = await response.json();
    // Construct full URL (handle empty API_BASE_URL for relative URLs)
    const audioUrl = data.url.startsWith('http') ? data.url : `${API_BASE_URL}${data.url}`;
    try { console.log('[AudioTTS] TTS url', { url: audioUrl }); } catch (_) {}
    
    // Cache the URL (HTTP URL, not blob URL - better for background)
    audioCache.set(cacheKey, audioUrl);
    cleanupCache();
    
    // Prefetch this audio in background (don't wait for it)
    prefetchAudio(audioUrl).catch(() => {});
    
    return audioUrl;
  } catch (err) {
    console.error('TTS API error:', err);
    throw err;
  }
}

// Prefetch audio: Preload audio in background so it's ready when needed
async function prefetchAudio(audioUrl) {
  try {
    // Check if already prefetched
    if (prefetchQueue.has(audioUrl)) {
      return;
    }
    
    // Limit queue size
    if (prefetchQueue.size >= prefetchQueueSize) {
      // Remove oldest entry
      const firstKey = prefetchQueue.keys().next().value;
      if (firstKey) {
        const oldAudio = prefetchQueue.get(firstKey);
        try {
          oldAudio.src = '';
          oldAudio.load();
        } catch (_) {}
        prefetchQueue.delete(firstKey);
      }
    }
    
    // Create new Audio element for prefetching
    const prefetchAudioElement = new Audio();
    prefetchAudioElement.setAttribute('preload', 'auto');
    prefetchAudioElement.src = audioUrl;
    try { console.log('[AudioTTS] prefetch start', { url: audioUrl }); } catch (_) {}
    
    // Start loading (don't play)
    prefetchAudioElement.load();
    
    // Store in prefetch queue
    prefetchQueue.set(audioUrl, prefetchAudioElement);
    
    // Clean up when audio is ready or fails
    prefetchAudioElement.addEventListener('canplaythrough', () => {
      // Audio is ready, keep it in queue
      try { console.log('[AudioTTS] prefetch ready', { url: audioUrl }); } catch (_) {}
    }, { once: true });
    
    prefetchAudioElement.addEventListener('error', () => {
      // Remove from queue on error
      try { console.warn('[AudioTTS] prefetch error', { url: audioUrl }); } catch (_) {}
      prefetchQueue.delete(audioUrl);
    }, { once: true });
    
  } catch (err) {
    // Silently fail prefetching
    console.warn('Prefetch error:', err);
  }
}

// Get prefetched audio element (if available)
function getPrefetchedAudio(audioUrl) {
  const prefetched = prefetchQueue.get(audioUrl);
  if (prefetched && prefetched.readyState >= 2) { // HAVE_CURRENT_DATA
    return prefetched;
  }
  return null;
}

// Set prefetch queue size
function setPrefetchQueueSize(size) {
  prefetchQueueSize = Math.max(1, Math.min(500, size)); // Limit between 1-500
  // Clean up if needed
  while (prefetchQueue.size > prefetchQueueSize) {
    const firstKey = prefetchQueue.keys().next().value;
    if (firstKey) {
      const audio = prefetchQueue.get(firstKey);
      try {
        audio.src = '';
        audio.load();
      } catch (_) {}
      prefetchQueue.delete(firstKey);
    }
  }
}

// Play audio using persistent HTML5 Audio element (works with MediaSession)
async function playAudioWithMediaSession(audioUrl, text, lang) {
  return new Promise((resolve, reject) => {
    try {
      // Check if we have a prefetched audio element ready
      const prefetched = getPrefetchedAudio(audioUrl);
      let audio;
      
      if (prefetched) {
        // Use prefetched audio (already loaded, ready to play)
        audio = prefetched;
        prefetchQueue.delete(audioUrl);
        // Set as current audio element
        currentAudioElement = audio;
        try { console.log('[AudioTTS] play with prefetched', { url: audioUrl, text: text.substring(0, 50), lang }); } catch (_) {}
      } else {
        // Use persistent audio element
        audio = initAudioElement();
        try { console.log('[AudioTTS] play with persistent element', { url: audioUrl, text: text.substring(0, 50), lang }); } catch (_) {}
      }
      
      // Remove old event listeners (if any)
      const oldOnEnded = audio.onended;
      const oldOnError = audio.onerror;
      const oldOnPause = audio.onpause;
      const oldOnPlay = audio.onplay;
      const oldOnCanPlay = audio.oncanplay;
      const oldOnLoadedData = audio.onloadeddata;
      
      // Clear old handlers
      audio.onended = null;
      audio.onerror = null;
      audio.onpause = null;
      audio.onplay = null;
      audio.oncanplay = null;
      audio.onloadeddata = null;
      
      // Apply global playback speed from navbar
      try {
        const initialSpeed = Math.max(0.5, Math.min(2.0, Number(window.__APP_SPEECH_SPEED__) || 1.0));
        audio.playbackRate = initialSpeed;
      } catch (_) {}

      // Set up MediaSession metadata FIRST (before loading audio)
      updateMediaSession(
        text.substring(0, 50),
        lang === 'ko-KR' ? 'Korean' : 'English',
        false, // Start as paused, will set to playing when ready
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
      
      // Ensure audio context and wake lock are active BEFORE loading
      ensureAudioContextActive();
      requestWakeLock();
      
      // Set up event handlers
      let resolved = false;
      const cleanup = () => {
        if (resolved) return;
        resolved = true;
        audio.onended = oldOnEnded;
        audio.onerror = oldOnError;
        audio.onpause = oldOnPause;
        audio.onplay = oldOnPlay;
        audio.oncanplay = oldOnCanPlay;
        audio.onloadeddata = oldOnLoadedData;
      };
      
      audio.onended = () => {
        try { console.log('[AudioTTS] onended', { url: audioUrl }); } catch (_) {}
        updateMediaSession(text.substring(0, 50), lang === 'ko-KR' ? 'Korean' : 'English', false);
        // Clear resume interval when audio ends
        if (audioResumeInterval) {
          clearInterval(audioResumeInterval);
          audioResumeInterval = null;
        }
        cleanup();
        resolve();
      };
      
      audio.onerror = (err) => {
        console.error('Audio playback error:', err);
        try { console.warn('[AudioTTS] onerror', { url: audioUrl, err: String(err && err.message || err) }); } catch (_) {}
        updateMediaSession(text.substring(0, 50), lang === 'ko-KR' ? 'Korean' : 'English', false);
        cleanup();
        reject(err);
      };
      
      audio.onpause = () => {
        // Only update if not at the end
        if (audio.currentTime < audio.duration - 0.1) {
          updateMediaSession(text.substring(0, 50), lang === 'ko-KR' ? 'Korean' : 'English', false);
          
          // If page is hidden and audio was paused, try to resume (Brave bug workaround)
          if (document.hidden && !audio.ended) {
            console.log('Audio paused while page hidden - attempting to resume');
            setTimeout(() => {
              if (!audio.ended && audio.paused && document.hidden) {
                audio.play().catch((err) => {
                  console.warn('Failed to resume audio when hidden:', err);
                });
              }
            }, 100);
          }
        }
      };
      
      audio.onplay = () => {
        try { console.log('[AudioTTS] onplay', { url: audioUrl }); } catch (_) {}
        updateMediaSession(text.substring(0, 50), lang === 'ko-KR' ? 'Korean' : 'English', true);
        ensureAudioContextActive();
        requestWakeLock();
        // Re-apply (or update) playback rate on play in case slider changed
        try {
          const currentSpeed = Math.max(0.5, Math.min(2.0, Number(window.__APP_SPEECH_SPEED__) || 1.0));
          audio.playbackRate = currentSpeed;
        } catch (_) {}
      };
      
      // Removed hidden-page auto-resume to avoid unwanted restarts on Android
      
      // Wait for audio to be ready before playing
      const playWhenReady = () => {
        audio.play().then(() => {
          // Audio started playing
          try { console.log('[AudioTTS] play started', { url: audioUrl }); } catch (_) {}
          updateMediaSession(text.substring(0, 50), lang === 'ko-KR' ? 'Korean' : 'English', true);
          // Guard: ensure playbackRate stays in sync shortly after start
          try {
            const currentSpeed = Math.max(0.5, Math.min(2.0, Number(window.__APP_SPEECH_SPEED__) || 1.0));
            audio.playbackRate = currentSpeed;
          } catch (_) {}
          
          // Double-check it's still playing after a short delay (Brave workaround)
          setTimeout(() => {
            if (audio && !audio.ended && audio.paused && document.hidden) {
              console.log('Audio stopped after play - resuming');
              audio.play().catch(() => {});
            }
          }, 300);
        }).catch((err) => {
          console.error('Audio play failed:', err);
          try { console.warn('[AudioTTS] play failed', { url: audioUrl, err: String(err && err.message || err) }); } catch (_) {}
          updateMediaSession(text.substring(0, 50), lang === 'ko-KR' ? 'Korean' : 'English', false);
          cleanup();
          reject(err);
        });
      };
      
      // Set source and load
      try { console.log('[AudioTTS] set src', { url: audioUrl }); } catch (_) {}
      audio.src = audioUrl;
      audio.load();
      
      // Wait for audio to be ready
      if (audio.readyState >= 2) { // HAVE_CURRENT_DATA
        // Already loaded, play immediately
        playWhenReady();
      } else {
        // Wait for canplay or loadeddata
        audio.oncanplay = () => {
          playWhenReady();
        };
        audio.onloadeddata = () => {
          playWhenReady();
        };
        
        // Fallback timeout
        setTimeout(() => {
          if (!resolved && audio.readyState >= 1) { // HAVE_METADATA
            playWhenReady();
          } else if (!resolved) {
            console.warn('Audio load timeout, attempting to play anyway');
            playWhenReady();
          }
        }, 5000);
      }
      
      // Ensure audio continues when page becomes hidden (start monitoring before play)
      // This is critical for Brave browser
      if (document.hidden) {
        // Page is already hidden, ensure we can still play
        ensureAudioContextActive();
        requestWakeLock();
      }
      
    } catch (err) {
      console.error('playAudioWithMediaSession error:', err);
      reject(err);
    }
  });
}

// Main TTS function using HTML5 Audio (works with MediaSession)
async function speakToAudio(text, lang = 'ko-KR', rate = 0.9) {
  try {
    try { console.log('[AudioTTS] speakToAudio', { text: String(text).slice(0, 60), lang, rate }); } catch (_) {}
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
    try { console.warn('[AudioTTS] falling back to SpeechSynthesis'); } catch (_) {}
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
  // No need to revoke URLs - they're HTTP URLs, not blob URLs
  audioCache.clear();
  
  // Clean up prefetch queue
  prefetchQueue.forEach((audio) => {
    try {
      audio.src = '';
      audio.load();
    } catch (_) {}
  });
  prefetchQueue.clear();
  
  // Clear resume interval
  if (audioResumeInterval) {
    clearInterval(audioResumeInterval);
    audioResumeInterval = null;
  }
  
  // Remove visibility change handler
  if (visibilityChangeHandler) {
    document.removeEventListener('visibilitychange', visibilityChangeHandler);
    visibilityChangeHandler = null;
  }
  
  if (currentAudioElement) {
    try {
      currentAudioElement.pause();
      currentAudioElement.src = '';
      currentAudioElement.load();
      // Remove all event listeners
      currentAudioElement.onended = null;
      currentAudioElement.onerror = null;
      currentAudioElement.onpause = null;
      currentAudioElement.onplay = null;
    } catch (_) {}
    currentAudioElement = null;
  }
}

export { speakToAudio, speakDirect, cleanupAudioCache, setPrefetchQueueSize };
