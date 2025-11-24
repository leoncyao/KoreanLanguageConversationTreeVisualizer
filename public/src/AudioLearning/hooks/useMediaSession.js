import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { requestWakeLock, releaseWakeLock, startKeepAlive, stopKeepAlive, updateMediaSession, ensureAudioContextActive } from '../backgroundAudio';

export const useMediaSession = (playingRef, quizLoopRef) => {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Initialize MediaSession on mount
    if ('mediaSession' in navigator) {
      updateMediaSession('Audio Learning', 'Korean Learning', false);
    }
    
    // IMMEDIATELY unlock audio context on mount if autoplay is requested
    // This must happen as early as possible, before Brave blocks it
    const autoplay = searchParams.get('autoplay');
    if (autoplay) {
      console.log('[Autoplay] Early unlock: Starting audio context immediately on mount');
      // Start keep-alive immediately
      startKeepAlive();
      // Try to unlock audio context by playing a silent sound
      (async () => {
        try {
          await ensureAudioContextActive();
          // Try to play a silent test sound to unlock audio (if possible)
          try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext && window.__AUDIO_CONTEXT_KEEPALIVE__ && window.__AUDIO_CONTEXT_KEEPALIVE__.context) {
              const ctx = window.__AUDIO_CONTEXT_KEEPALIVE__.context;
              if (ctx.state === 'suspended') {
                await ctx.resume().catch(() => {});
              }
              // Create a very short silent buffer to "unlock" audio
              const buffer = ctx.createBuffer(1, 1, 22050);
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(ctx.destination);
              source.start(0);
              source.stop(0.001);
            }
          } catch (silentErr) {
            // Silent unlock failed, but continue anyway
            console.log('[Autoplay] Silent unlock attempt:', silentErr.message);
          }
        } catch (err) {
          console.warn('[Autoplay] Early unlock failed:', err);
        }
      })();
    }
    
    // Handle visibility changes to maintain wake lock and audio context
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && (playingRef.current || quizLoopRef.current)) {
        await requestWakeLock();
        // Resume audio context if suspended
        try {
          if (window.__AUDIO_CONTEXT_KEEPALIVE__ && window.__AUDIO_CONTEXT_KEEPALIVE__.context) {
            if (window.__AUDIO_CONTEXT_KEEPALIVE__.context.state === 'suspended') {
              await window.__AUDIO_CONTEXT_KEEPALIVE__.context.resume();
            }
          }
        } catch (_) {}
      }
    };
    
    // Handle page focus/blur to keep audio active
    const handlePageFocus = () => {
      try {
        if (window.__AUDIO_CONTEXT_KEEPALIVE__ && window.__AUDIO_CONTEXT_KEEPALIVE__.context) {
          if (window.__AUDIO_CONTEXT_KEEPALIVE__.context.state === 'suspended') {
            window.__AUDIO_CONTEXT_KEEPALIVE__.context.resume();
          }
        }
      } catch (_) {}
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handlePageFocus);
    window.addEventListener('blur', handlePageFocus);
    
    // Cleanup on unmount
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handlePageFocus);
      window.removeEventListener('blur', handlePageFocus);
      releaseWakeLock();
      stopKeepAlive();
    };
  }, [searchParams, playingRef, quizLoopRef]);
};

