import { updateMediaSession, ensureAudioContextActive } from '../backgroundAudio';

export const createPlayConversationAudio = ({
  conversationAudioUrl,
  conversationAudioRef,
  searchParams,
  isPlaylistMode,
  playlist,
  playlistIndex,
  currentConversationTitle,
  setCurrentConversationTitle,
  setAutoplayBlocked,
  autoStartedRef,
  playNextConversationRef,
  playPreviousConversationRef,
  pausedRef,
  setIsPaused,
  playingRef,
  quizLoopRef,
}) => {
  return (shouldLoop = false, audioUrl = null, title = null) => {
    return new Promise((resolve) => {
      try {
        const urlToPlay = audioUrl || conversationAudioUrl;
        if (!urlToPlay) return resolve();
        // Stop previous if exists
        try {
          const prev = conversationAudioRef.current;
          if (prev) {
            if (prev._speedCheckInterval) { try { clearInterval(prev._speedCheckInterval); } catch (_) {} }
            prev.onended = null;
            prev.onerror = null;
            prev.loop = false;
            prev.pause();
            prev.src = '';
            prev.load();
          }
        } catch (_) {}
        const audio = new Audio(urlToPlay);
        conversationAudioRef.current = audio;
        audio.setAttribute('playsinline', 'true');
        // Set loop only if requested (for Level 3)
        audio.loop = shouldLoop;
        // Apply master speed and keep it synced
        try {
          const currentSpeed = window.__APP_SPEECH_SPEED__ || 1.0;
          audio.playbackRate = currentSpeed;
        } catch (_) {}
        const speedCheckInterval = setInterval(() => {
          try {
            const desired = window.__APP_SPEECH_SPEED__ || 1.0;
            if (audio.playbackRate !== desired) {
              audio.playbackRate = desired;
            }
          } catch (_) {}
        }, 500);
        audio._speedCheckInterval = speedCheckInterval;
        
        // Get current conversation title for MediaSession
        // Priority: passed title > playlist current > saved title state > default
        const currentConv = isPlaylistMode && playlistIndex >= 0 && playlistIndex < playlist.length
          ? playlist[playlistIndex]
          : null;
        const sessionTitle = title || (currentConv ? currentConv.title : null) || currentConversationTitle || 'Conversation Audio';
        if (title || currentConv) {
          setCurrentConversationTitle(sessionTitle);
        }
        
        // Set up MediaSession callbacks for Android notification controls
        // Update MediaSession metadata with conversation title for Android audio controls
        updateMediaSession(sessionTitle, 'Korean Learning', true, {
          play: () => {
            try {
              if (audio && audio.paused) {
                audio.play().catch(() => {});
                pausedRef.current = false;
                setIsPaused(false);
                updateMediaSession(sessionTitle, 'Korean Learning', true, {
                  play: () => {},
                  pause: () => {},
                  stop: () => {},
                  nexttrack: isPlaylistMode && playlist.length > 1 ? (() => {
                    console.log('[MediaSession] Next track triggered (play)');
                    if (playNextConversationRef.current) {
                      playNextConversationRef.current();
                    }
                  }) : undefined,
                  previoustrack: isPlaylistMode && playlist.length > 1 ? (() => {
                    console.log('[MediaSession] Previous track triggered (play)');
                    if (playPreviousConversationRef.current) {
                      playPreviousConversationRef.current();
                    }
                  }) : undefined,
                });
              }
            } catch (_) {}
          },
          pause: () => {
            try {
              if (audio && !audio.paused) {
                audio.pause();
                pausedRef.current = true;
                setIsPaused(true);
                updateMediaSession(sessionTitle, 'Korean Learning', false, {
                  play: () => {},
                  pause: () => {},
                  stop: () => {},
                  nexttrack: isPlaylistMode && playlist.length > 1 ? (() => {
                    console.log('[MediaSession] Next track triggered (play)');
                    if (playNextConversationRef.current) {
                      playNextConversationRef.current();
                    }
                  }) : undefined,
                  previoustrack: isPlaylistMode && playlist.length > 1 ? (() => {
                    console.log('[MediaSession] Previous track triggered (play)');
                    if (playPreviousConversationRef.current) {
                      playPreviousConversationRef.current();
                    }
                  }) : undefined,
                });
              }
            } catch (_) {}
          },
          stop: () => {
            try {
              if (audio) {
                audio.pause();
                audio.currentTime = 0;
                pausedRef.current = false;
                setIsPaused(false);
                playingRef.current = false;
                quizLoopRef.current = false;
                updateMediaSession('Audio Learning', '', false);
              }
            } catch (_) {}
          },
          nexttrack: isPlaylistMode && playlist.length > 1 ? (() => {
            console.log('[MediaSession] Next track triggered');
            if (playNextConversationRef.current) {
              playNextConversationRef.current();
            }
          }) : undefined,
          previoustrack: isPlaylistMode && playlist.length > 1 ? (() => {
            console.log('[MediaSession] Previous track triggered');
            if (playPreviousConversationRef.current) {
              playPreviousConversationRef.current();
            }
          }) : undefined,
        });
        const cleanup = () => {
          try {
            if (audio._speedCheckInterval) { try { clearInterval(audio._speedCheckInterval); } catch (_) {} }
            audio.onended = null;
            audio.onerror = null;
            audio.loop = false;
            audio.pause();
            audio.src = '';
            audio.load();
          } catch (_) {}
          if (conversationAudioRef.current === audio) {
            conversationAudioRef.current = null;
          }
          resolve();
        };
        if (shouldLoop) {
          // For looping audio, onended won't fire, so we only cleanup on error or manual stop
          audio.onerror = cleanup;
          audio.play().catch((err) => {
            console.warn('Failed to play audio (autoplay may be blocked):', err);
            // Check if this is an autoplay blocking error
            if (err.name === 'NotAllowedError' || err.name === 'NotAllowedError' || err.message?.includes('play') || err.message?.includes('user gesture')) {
              console.warn('[Autoplay] Autoplay blocked by browser - user gesture required');
              // Set autoplay blocked state if we're in autoplay mode
              if (searchParams.get('autoplay')) {
                setAutoplayBlocked(true);
                autoStartedRef.current = false;
              }
              cleanup();
              return;
            }
            // Try to resume audio context and retry once
            (async () => {
              try {
                await ensureAudioContextActive();
                if (window.__AUDIO_CONTEXT_KEEPALIVE__ && window.__AUDIO_CONTEXT_KEEPALIVE__.context) {
                  const ctx = window.__AUDIO_CONTEXT_KEEPALIVE__.context;
                  if (ctx.state === 'suspended') {
                    await ctx.resume();
                  }
                }
                // Retry play after a short delay
                await new Promise(r => setTimeout(r, 100));
                await audio.play().catch(() => cleanup());
              } catch (retryErr) {
                console.error('Retry play failed:', retryErr);
                cleanup();
              }
            })();
          });
          // Don't resolve immediately - let it play in loop
        } else {
          // For non-looping, resolve when ended
          audio.onended = cleanup;
          audio.onerror = cleanup;
          audio.play().catch((err) => {
            console.warn('Failed to play audio (autoplay may be blocked):', err);
            // Check if this is an autoplay blocking error
            if (err.name === 'NotAllowedError' || err.name === 'NotAllowedError' || err.message?.includes('play') || err.message?.includes('user gesture')) {
              console.warn('[Autoplay] Autoplay blocked by browser - user gesture required');
              // Set autoplay blocked state if we're in autoplay mode
              if (searchParams.get('autoplay')) {
                setAutoplayBlocked(true);
                autoStartedRef.current = false;
              }
              cleanup();
              return;
            }
            // Try to resume audio context and retry once
            (async () => {
              try {
                await ensureAudioContextActive();
                if (window.__AUDIO_CONTEXT_KEEPALIVE__ && window.__AUDIO_CONTEXT_KEEPALIVE__.context) {
                  const ctx = window.__AUDIO_CONTEXT_KEEPALIVE__.context;
                  if (ctx.state === 'suspended') {
                    await ctx.resume();
                  }
                }
                // Retry play after a short delay
                await new Promise(r => setTimeout(r, 100));
                await audio.play().catch(() => cleanup());
              } catch (retryErr) {
                console.error('Retry play failed:', retryErr);
                cleanup();
              }
            })();
          });
        }
      } catch (_) { resolve(); }
    });
  };
};

