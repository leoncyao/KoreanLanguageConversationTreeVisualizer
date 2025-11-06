// Audio Loop Player - Plays one long MP3 file in a loop for background playback
import { updateMediaSession, requestWakeLock, ensureAudioContextActive } from './backgroundAudio';

// API base URL
const API_BASE_URL = process.env.API_BASE_URL || '';

// Global audio element for looping
let loopAudioElement = null;
let isLooping = false;
let isPaused = false;

// Generate batch MP3 file and play it in a loop
async function generateAndPlayLoop(words, lang = 'ko-KR', rate = 1.0, delaySeconds = 2.0) {
  try {
    if (!words || !Array.isArray(words) || words.length === 0) {
      throw new Error('Words array is required');
    }
    
    // Get master speed from global slider (will be applied via playbackRate)
    const globalSpeed = window.__APP_SPEECH_SPEED__ || 1.0;
    
    // Limit to 20 words
    const limitedWords = words.slice(0, 20);
    
    // Call batch TTS API (rate is not used in TTS generation, we use HTML5 Audio playbackRate instead)
    const response = await fetch(`${API_BASE_URL}/api/tts/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ words: limitedWords, lang, delaySeconds }),
    });
    
    if (!response.ok) {
      throw new Error(`TTS batch API returned ${response.status}`);
    }
    
    const data = await response.json();
    const audioUrl = data.url.startsWith('http') ? data.url : `${API_BASE_URL}${data.url}`;
    try { console.log('[AudioLoop] batch url', { url: audioUrl, words: limitedWords.length, delaySeconds }); } catch (_) {}
    
    // Stop any existing loop
    stopLoop();
    
    // Create audio element
    loopAudioElement = new Audio(audioUrl);
    try { console.log('[AudioLoop] create Audio', { url: audioUrl }); } catch (_) {}
    loopAudioElement.setAttribute('playsinline', 'true');
    loopAudioElement.setAttribute('preload', 'auto');
    loopAudioElement.setAttribute('loop', 'true'); // Enable looping
    loopAudioElement.volume = 1.0;
    // Set playback rate (speed) - this respects the master speed slider
    loopAudioElement.playbackRate = globalSpeed;
    
    // Listen for changes to global speed and update playbackRate
    const updatePlaybackRate = () => {
      if (loopAudioElement) {
        const currentSpeed = window.__APP_SPEECH_SPEED__ || 1.0;
        loopAudioElement.playbackRate = currentSpeed;
      }
    };
    
    // Check for speed changes periodically (since window.__APP_SPEECH_SPEED__ is updated by Navbar)
    const speedCheckInterval = setInterval(updatePlaybackRate, 500);
    loopAudioElement._speedCheckInterval = speedCheckInterval;
    
    // Set up MediaSession
    updateMediaSession(
      `${limitedWords.length} Words - Loop`,
      'Korean Learning',
      true,
      {
        play: () => {
          if (loopAudioElement) {
            loopAudioElement.play().catch(() => {});
          }
        },
        pause: () => {
          if (loopAudioElement) {
            loopAudioElement.pause();
          }
        },
        stop: () => {
          stopLoop();
        }
      }
    );
    
    // Ensure audio context and wake lock
    await ensureAudioContextActive();
    await requestWakeLock();
    
    // Set up event handlers
    loopAudioElement.onplay = () => {
      try { console.log('[AudioLoop] onplay'); } catch (_) {}
      updateMediaSession(`${limitedWords.length} Words - Loop`, 'Korean Learning', true);
      ensureAudioContextActive();
      requestWakeLock();
    };
    
    loopAudioElement.onpause = () => {
      try { console.log('[AudioLoop] onpause'); } catch (_) {}
      updateMediaSession(`${limitedWords.length} Words - Loop`, 'Korean Learning', false);
    };
    
    loopAudioElement.onended = () => {
      try { console.log('[AudioLoop] onended'); } catch (_) {}
      // Shouldn't happen with loop=true, but handle it
      if (isLooping) {
        loopAudioElement.currentTime = 0;
        loopAudioElement.play().catch(() => {});
      }
    };
    
    // Monitor and resume if paused when hidden (Brave workaround)
    const resumeInterval = setInterval(() => {
      if (isLooping && document.hidden && loopAudioElement && loopAudioElement.paused && !loopAudioElement.ended) {
        console.log('Loop audio paused while hidden - resuming');
        loopAudioElement.play().catch(() => {});
      }
    }, 500);
    
    // Store interval for cleanup
    loopAudioElement._resumeInterval = resumeInterval;
    
    // Start playing
    isLooping = true;
    isPaused = false;
    await loopAudioElement.play();
    try { console.log('[AudioLoop] playing', { url: audioUrl }); } catch (_) {}
    
    return audioUrl;
  } catch (err) {
    console.error('generateAndPlayLoop error:', err);
    throw err;
  }
}

// Stop the loop
function stopLoop() {
  isLooping = false;
  isPaused = false;
  
  if (loopAudioElement) {
    try {
      if (loopAudioElement._resumeInterval) {
        clearInterval(loopAudioElement._resumeInterval);
      }
      if (loopAudioElement._speedCheckInterval) {
        clearInterval(loopAudioElement._speedCheckInterval);
      }
      loopAudioElement.pause();
      loopAudioElement.src = '';
      loopAudioElement.load();
      loopAudioElement.onended = null;
      loopAudioElement.onpause = null;
      loopAudioElement.onplay = null;
    } catch (_) {}
    loopAudioElement = null;
  }
  
  updateMediaSession('', '', false);
}

// Check if loop is playing
function isLoopPlaying() {
  return isLooping && loopAudioElement && !loopAudioElement.paused && !loopAudioElement.ended;
}

function pauseLoop() {
  if (loopAudioElement && isLooping) {
    try { loopAudioElement.pause(); } catch (_) {}
    isPaused = true;
    updateMediaSession('Paused', 'Korean Learning', false);
  }
}

function resumeLoop() {
  if (loopAudioElement && isLooping) {
    try { loopAudioElement.play().catch(() => {}); } catch (_) {}
    isPaused = false;
    updateMediaSession('Resumed', 'Korean Learning', true);
  }
}

export { generateAndPlayLoop, stopLoop, isLoopPlaying, pauseLoop, resumeLoop };

