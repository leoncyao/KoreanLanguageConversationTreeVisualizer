// Background Audio Controller for Android Brave/Chrome
// This module manages background audio playback when the app is minimized

// Global audio state
let globalAudioState = {
  isPlaying: false,
  playCallback: null,
  pauseCallback: null,
  stopCallback: null,
  currentTitle: '',
  currentArtist: '',
  speechMonitoringInterval: null,
};

// Wake lock for background playback
let wakeLock = null;

const requestWakeLock = async () => {
  try {
    if ('wakeLock' in navigator) {
      if (wakeLock) {
        try {
          await wakeLock.release();
        } catch (_) {}
      }
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        wakeLock = null;
      });
    }
  } catch (err) {
    console.warn('Wake lock not supported or failed:', err);
  }
};

const releaseWakeLock = async () => {
  try {
    if (wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch (err) {
    console.warn('Wake lock release failed:', err);
  }
};

// Keep audio context active to prevent suspension
let keepAliveInterval = null;
let audioContextKeepAlive = null;
let aggressiveResumeInterval = null;

const startKeepAlive = () => {
  if (keepAliveInterval) return;
  
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    
    const audioContext = new AudioContext({ 
      latencyHint: 'interactive',
      sampleRate: 44100 
    });
    
    // Create silent oscillator to keep context active
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    gainNode.gain.value = 0; // Silent
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start();
    
    // Periodically check if context is suspended and resume it
    keepAliveInterval = setInterval(() => {
      try {
        if (audioContext.state === 'suspended') {
          audioContext.resume().catch(() => {});
        }
      } catch (_) {}
    }, 500); // Check more frequently
    
    // Aggressive resume when page is hidden (for Brave/Android)
    aggressiveResumeInterval = setInterval(() => {
      try {
        if (document.hidden && audioContext.state === 'suspended') {
          // Force resume when hidden
          audioContext.resume().catch(() => {});
        }
        // Monitor SpeechSynthesis state when hidden
        if (document.hidden && globalAudioState.isPlaying) {
          try {
            const synth = window.speechSynthesis;
            // If speech synthesis stopped unexpectedly while we're supposed to be playing
            // This is a limitation - we can't force it to continue, but we can log it
            if (synth && !synth.speaking && !synth.pending) {
              // Speech stopped but we're still supposed to be playing
              // This might indicate the browser paused it
              console.warn('SpeechSynthesis stopped unexpectedly while page is hidden');
            }
          } catch (_) {}
        }
      } catch (_) {}
    }, 200); // Very frequent when hidden
    
    audioContextKeepAlive = { context: audioContext, oscillator, gainNode };
    window.__AUDIO_CONTEXT_KEEPALIVE__ = audioContextKeepAlive;
    
    // Immediately resume if suspended
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }
  } catch (err) {
    console.warn('Could not create keep-alive audio context:', err);
  }
};

const stopKeepAlive = () => {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
  
  if (aggressiveResumeInterval) {
    clearInterval(aggressiveResumeInterval);
    aggressiveResumeInterval = null;
  }
  
  try {
    if (audioContextKeepAlive) {
      const { context, oscillator, gainNode } = audioContextKeepAlive;
      try {
        oscillator.stop();
        gainNode.disconnect();
        oscillator.disconnect();
        context.close();
      } catch (_) {}
      audioContextKeepAlive = null;
      window.__AUDIO_CONTEXT_KEEPALIVE__ = null;
    }
  } catch (_) {}
};

// Initialize MediaSession API handlers
const initMediaSession = () => {
  if (!('mediaSession' in navigator)) {
    return;
  }

  // Set up action handlers
  navigator.mediaSession.setActionHandler('play', () => {
    console.log('MediaSession: Play action triggered');
    if (globalAudioState.playCallback) {
      globalAudioState.playCallback();
    }
    globalAudioState.isPlaying = true;
    navigator.mediaSession.playbackState = 'playing';
  });

  navigator.mediaSession.setActionHandler('pause', () => {
    console.log('MediaSession: Pause action triggered');
    if (globalAudioState.pauseCallback) {
      globalAudioState.pauseCallback();
    }
    globalAudioState.isPlaying = false;
    navigator.mediaSession.playbackState = 'paused';
  });

  navigator.mediaSession.setActionHandler('stop', () => {
    console.log('MediaSession: Stop action triggered');
    if (globalAudioState.stopCallback) {
      globalAudioState.stopCallback();
    }
    globalAudioState.isPlaying = false;
    navigator.mediaSession.playbackState = 'none';
    // Cancel speech synthesis
    try {
      const synth = window.speechSynthesis;
      if (synth) {
        synth.cancel();
      }
    } catch (_) {}
  });

  // Optional: Seek handlers (if you add seek functionality later)
  try {
    navigator.mediaSession.setActionHandler('seekbackward', () => {
      console.log('MediaSession: Seek backward');
    });
    navigator.mediaSession.setActionHandler('seekforward', () => {
      console.log('MediaSession: Seek forward');
    });
  } catch (_) {
    // Some browsers don't support these
  }
};

// Update MediaSession metadata and state
const updateMediaSession = (title, artist, playing = false, callbacks = {}) => {
  try {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title || 'Audio Learning',
        artist: artist || 'Korean Learning',
      });
      
      // Update callbacks if provided
      if (callbacks.play) globalAudioState.playCallback = callbacks.play;
      if (callbacks.pause) globalAudioState.pauseCallback = callbacks.pause;
      if (callbacks.stop) globalAudioState.stopCallback = callbacks.stop;
      
      // Update playback state
      globalAudioState.isPlaying = playing;
      globalAudioState.currentTitle = title || '';
      globalAudioState.currentArtist = artist || '';
      
      navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
      
      // When starting playback, ensure everything is active
      if (playing) {
        // Ensure wake lock is active
        requestWakeLock().catch(() => {});
        // Ensure audio context is active
        ensureAudioContextActive().catch(() => {});
      }
    }
  } catch (err) {
    console.warn('MediaSession API error:', err);
  }
};

// Handle page visibility changes
const handleVisibilityChange = async () => {
  if (document.hidden) {
    // Page is hidden (minimized)
    console.log('Page hidden - ensuring audio continues');
    // Wake lock and keep-alive should already be active
    // Aggressively resume audio context if suspended
    try {
      if (audioContextKeepAlive && audioContextKeepAlive.context) {
        const ctx = audioContextKeepAlive.context;
        if (ctx.state === 'suspended') {
          await ctx.resume().catch(() => {});
        }
        // Keep trying to resume periodically
        const retryInterval = setInterval(() => {
          try {
            if (ctx.state === 'suspended') {
              ctx.resume().catch(() => {});
            } else {
              clearInterval(retryInterval);
            }
          } catch (_) {
            clearInterval(retryInterval);
          }
        }, 100);
        // Clear after 5 seconds
        setTimeout(() => clearInterval(retryInterval), 5000);
      }
      // Also try to maintain wake lock
      await requestWakeLock();
    } catch (_) {}
  } else {
    // Page is visible again
    console.log('Page visible');
    // Ensure audio context is still active
    try {
      if (audioContextKeepAlive && audioContextKeepAlive.context) {
        await audioContextKeepAlive.context.resume().catch(() => {});
      }
    } catch (_) {}
  }
};

// Initialize background audio system
const initBackgroundAudio = () => {
  // Initialize MediaSession
  initMediaSession();
  
  // Set up visibility change handler
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  // Set up page focus/blur handlers as backup
  window.addEventListener('blur', async () => {
    console.log('Window blurred - maintaining audio');
    // Aggressively maintain wake lock and audio context
    await requestWakeLock();
    try {
      if (audioContextKeepAlive && audioContextKeepAlive.context) {
        await audioContextKeepAlive.context.resume().catch(() => {});
      }
    } catch (_) {}
  });
  
  window.addEventListener('focus', async () => {
    console.log('Window focused - resuming audio context');
    try {
      if (audioContextKeepAlive && audioContextKeepAlive.context) {
        await audioContextKeepAlive.context.resume().catch(() => {});
      }
    } catch (_) {}
  });
  
  // Also handle pagehide/pageshow events (important for mobile)
  window.addEventListener('pagehide', async () => {
    console.log('Page hiding - maintaining audio');
    await requestWakeLock();
    try {
      if (audioContextKeepAlive && audioContextKeepAlive.context) {
        await audioContextKeepAlive.context.resume().catch(() => {});
      }
    } catch (_) {}
  });
  
  window.addEventListener('pageshow', async () => {
    console.log('Page showing - resuming audio context');
    try {
      if (audioContextKeepAlive && audioContextKeepAlive.context) {
        await audioContextKeepAlive.context.resume().catch(() => {});
      }
    } catch (_) {}
  });
  
  console.log('Background audio system initialized');
};

// Cleanup function
const cleanupBackgroundAudio = () => {
  stopKeepAlive();
  releaseWakeLock();
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  globalAudioState.isPlaying = false;
  globalAudioState.playCallback = null;
  globalAudioState.pauseCallback = null;
  globalAudioState.stopCallback = null;
};

// Ensure audio context is active before speaking
const ensureAudioContextActive = async () => {
  try {
    if (audioContextKeepAlive && audioContextKeepAlive.context) {
      const ctx = audioContextKeepAlive.context;
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }
      // Also ensure wake lock is active
      await requestWakeLock();
    } else {
      // If keep-alive doesn't exist, start it
      startKeepAlive();
      await requestWakeLock();
    }
  } catch (_) {}
};

export {
  initBackgroundAudio,
  cleanupBackgroundAudio,
  updateMediaSession,
  requestWakeLock,
  releaseWakeLock,
  startKeepAlive,
  stopKeepAlive,
  ensureAudioContextActive,
  globalAudioState,
};

