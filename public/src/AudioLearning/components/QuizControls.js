import React from 'react';

const QuizControls = ({
  quizMode,
  setQuizMode,
  quizDifficulty,
  setQuizDifficulty,
  setIndex,
  setSetIndex,
  totalSetsHF,
  recordingError,
  quizDelaySec,
  setQuizDelaySec,
  quizRecordDurationSec,
  setQuizRecordDurationSec,
  isQuizLooping,
  stopAll,
  isLoadingLearningWords,
  isPlaylistMode,
  savedConversations,
  setPlaylist,
  setPlaylistIndex,
  setIsPlaylistMode,
  savePlaylist,
  conversationAudioUrl,
  quizMode: quizModeProp,
  playConversationAudio,
  waitWhilePaused,
  savedConversations: savedConversationsProp,
  playlistIndex,
  playlist,
  currentConversationTitle,
  setCurrentConversationTitle,
  handlePlayCurrentConversation,
  handleStartQuizLoop,
  isPaused,
  setIsPaused,
  pauseLoop,
  resumeLoop,
  conversationAudioRef,
  playPreviousConversation,
  playNextConversation,
  loopGenerating,
  loopProgress,
  isGeneratingLevel3Audio,
  level3AudioProgress,
  currentQuizWord,
  currentQuizSentence,
  level2Words,
  selectedSetWords,
  currentSetWords,
  generatedSentences,
  quizDifficulty: quizDifficultyProp,
}) => {
  return (
    <div className="audio-card">
      <h2 className="audio-section-title">Audio Learning Mode</h2>
      <p className="audio-help">
        {quizMode === 'hands-free' 
          ? 'Hands-free mode: Listen to prompts and answers. Perfect for background learning while doing other tasks.'
          : 'Recording mode: Record and play back your answer, then hear the correct Korean. Includes speech recognition.'}
      </p>
      <div className="audio-actions" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>Mode</span>
          <select className="audio-select" value={quizMode} onChange={(e) => {
            const val = e.target.value;
            setQuizMode(val);
            try { localStorage.setItem('audio_quizMode', val); } catch (_) {}
          }} style={{ width: '100%' }}>
            <option value="hands-free">Hands-Free Mode (No Recording)</option>
            <option value="recording">Recording & Playback Mode</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>Difficulty Level</span>
          <select className="audio-select" value={quizDifficulty} onChange={(e) => {
            const val = parseInt(e.target.value||'1', 10);
            setQuizDifficulty(val);
            try { localStorage.setItem('audio_quizDifficulty', String(val)); } catch (_) {}
          }} style={{ width: '100%' }}>
            <option value={1}>Level 1: Single Words</option>
            <option value={2}>Level 2: Small Sentences (3-6 words)</option>
            <option value={3}>Level 3: Longer Sentences (7-12 words)</option>
          </select>
        </div>
        {quizMode === 'hands-free' && quizDifficulty === 1 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Set (20/each)</span>
              <input
                type="number"
                min={1}
                step={1}
                value={setIndex}
                onChange={(e) => {
                  const val = Math.max(1, parseInt(e.target.value||'1', 10));
                  setSetIndex(val);
                  try { localStorage.setItem('audio_setIndex', String(val)); } catch (_) {}
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <button
                  type="button"
                  className="audio-mini-btn"
                  onClick={() => {
                    const newVal = Math.max(1, (Number(setIndex)||1) - 1);
                    setSetIndex(newVal);
                    try { localStorage.setItem('audio_setIndex', String(newVal)); } catch (_) {}
                  }}
                  disabled={(Number(setIndex)||1) <= 1}
                  title="Previous 20"
                >
                  Prev 20
                </button>
                <span style={{ fontSize: 12, color: '#666' }}>
                  Set {Math.min(Number(setIndex)||1, totalSetsHF)} / {totalSetsHF}
                </span>
                <button
                  type="button"
                  className="audio-mini-btn"
                  onClick={() => {
                    const newVal = Math.min(totalSetsHF, (Number(setIndex)||1) + 1);
                    setSetIndex(newVal);
                    try { localStorage.setItem('audio_setIndex', String(newVal)); } catch (_) {}
                  }}
                  disabled={(Number(setIndex)||1) >= totalSetsHF}
                  title="Next 20"
                >
                  Next 20
                </button>
              </div>
            </label>
          </div>
        )}
        {quizMode === 'recording' && recordingError && (
          <div style={{ padding: '10px', background: '#fee', border: '1px solid #fcc', borderRadius: 6, fontSize: 11, color: '#c33' }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>⚠️ {recordingError}</div>
            {!window.isSecureContext && location.protocol === 'http:' && (
              <div style={{ marginTop: 8, fontSize: 10 }}>
                <strong>Solution:</strong> Recording on Android requires HTTPS due to browser security policies.<br/>
                Options: (1) Access via <strong>https://</strong> instead of http://<br/>
                (2) Use <strong>localhost</strong> or <strong>127.0.0.1</strong> (works over HTTP)<br/>
                (3) Enable HTTPS on your server. Ask your admin or check server config.
              </div>
            )}
          </div>
        )}
        {quizMode === 'recording' && !recordingError && !window.isSecureContext && location.protocol === 'http:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1' && (
          <div style={{ padding: '10px', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 6, fontSize: 11, color: '#856404' }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>ℹ️ HTTPS Required for Recording</div>
            <div style={{ fontSize: 10 }}>
              Recording on Android requires HTTPS or localhost. You're on HTTP. 
              Try accessing via <strong>https://</strong> or use <strong>localhost</strong>.
            </div>
          </div>
        )}
        <div className="audio-actions" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Delay between steps (sec)</span>
            <input type="number" min={0} step={0.1} value={quizDelaySec} onChange={(e) => {
              const val = parseFloat(e.target.value||'0');
              setQuizDelaySec(val);
              try { localStorage.setItem('audio_quizDelaySec', String(val)); } catch (_) {}
            }} />
          </label>
          {quizMode === 'recording' && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Recording duration (sec)</span>
              <input type="number" min={0} step={0.1} value={quizRecordDurationSec} onChange={(e) => {
                const val = parseFloat(e.target.value||'0');
                setQuizRecordDurationSec(val);
                try { localStorage.setItem('audio_quizRecordDurationSec', String(val)); } catch (_) {}
              }} />
            </label>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            className="audio-btn"
            onClick={async () => {
              const level = Number(quizDifficulty) || 1;
              if (isQuizLooping) {
                // Pause instead of stop
                if (isPaused) {
                  resumeLoop();
                  setIsPaused(false);
                } else {
                  pauseLoop();
                  setIsPaused(true);
                }
              } else {
                if (!isLoadingLearningWords) {
                  // Auto-create playlist if it doesn't exist and we have conversations
                  if (!isPlaylistMode && savedConversations && savedConversations.length > 0) {
                    const conversationIds = savedConversations.map(c => c.id).filter(Boolean);
                    if (conversationIds.length > 0) {
                      setPlaylist(savedConversations);
                      setPlaylistIndex(0);
                      setIsPlaylistMode(true);
                      await savePlaylist(conversationIds, 0);
                    }
                  }
                  
                  // If audio is already generated, just play it
                  if (conversationAudioUrl && quizMode === 'hands-free' && level === 3) {
                    // ... play existing audio logic
                    handlePlayCurrentConversation();
                  } else if (quizMode === 'hands-free' && level === 3) {
                    handlePlayCurrentConversation();
                  } else {
                    handleStartQuizLoop();
                  }
                }
              }
            }}
            title={isQuizLooping ? (isPaused ? 'Resume' : 'Pause') : (conversationAudioUrl && (Number(quizDifficulty) || 1) === 3 ? 'Start/Play Audio' : 'Start')}
            aria-label={isQuizLooping ? (isPaused ? 'Resume' : 'Pause') : 'Start'}
          >
            {isQuizLooping ? (isPaused ? '▶️' : '⏸') : 'Start'}
          </button>
          <button
            className="audio-btn"
            onClick={() => {
              const level = Number(quizDifficulty) || 1;
              const audio = conversationAudioRef.current;
              if (quizMode === 'hands-free' && level === 3 && audio) {
                if (isPaused) {
                  try { 
                    audio.play().catch(_ => {});
                  } catch (_) {}
                  setIsPaused(false);
                } else {
                  try { 
                    audio.pause(); 
                  } catch (_) {}
                  setIsPaused(true);
                }
              } else {
                if (isPaused) {
                  resumeLoop();
                  setIsPaused(false);
                } else {
                  pauseLoop();
                  setIsPaused(true);
                }
              }
            }}
            title={isPaused ? 'Resume' : 'Pause'}
            aria-label={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? '▶️' : '⏸'}
          </button>
          {isPlaylistMode && playlist.length > 1 && (
            <>
              <button
                className="audio-btn"
                onClick={playPreviousConversation}
                title="Previous Conversation"
                aria-label="Previous Conversation"
              >
                ⏮
              </button>
              <button
                className="audio-btn"
                onClick={playNextConversation}
                title="Next Conversation"
                aria-label="Next Conversation"
              >
                ⏭
              </button>
            </>
          )}
        </div>
        {loopGenerating && (
          <div style={{ marginTop: 8 }}>
            <div style={{ height: 8, background: '#eee', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ width: `${loopProgress}%`, height: 8, background: '#1976d2', transition: 'width 0.2s' }} />
            </div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>Generating audio…</div>
          </div>
        )}
        {isGeneratingLevel3Audio && (
          <div style={{ marginTop: 8 }}>
            <div style={{ height: 8, background: '#eee', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ width: `${level3AudioProgress}%`, height: 8, background: '#4caf50', transition: 'width 0.2s' }} />
            </div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
              Generating Level 3 audio: {Math.round(level3AudioProgress)}%
            </div>
          </div>
        )}
        <div style={{ display: 'grid', gap: 6 }}>
          {(Number(quizDifficulty) || 1) === 1 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 600 }}>Current words</div>
              <div className="audio-en" style={{ padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6, minHeight: 20 }}>
                {currentQuizWord ? `How do you say "${currentQuizWord.english}"?` : (currentQuizSentence ? `How do you say "${currentQuizSentence.english}"?` : '—')}
              </div>
            </>
          )}
          {quizMode === 'hands-free' && quizDifficulty === 2 && level2Words && level2Words.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Selected words (Level 2, up to 5):</div>
              <div style={{ display: 'grid', gap: 4 }}>
                {level2Words.map((w, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13 }}>
                    <span style={{ color: '#999' }}>{i + 1}.</span>
                    <span className="audio-ko" style={{ minWidth: 120 }}>{w.korean}</span>
                    <span className="audio-en" style={{ opacity: 0.8 }}>{w.english}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {quizMode === 'hands-free' && quizDifficulty === 1 && selectedSetWords && selectedSetWords.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Selected set (up to 20):</div>
              <div style={{ display: 'grid', gap: 4 }}>
                {selectedSetWords.map((w, i) => (
                  <div key={i} style={{ display: 'grid', gap: 2 }}>
                    <div style={{ display: 'flex', gap: 8, fontSize: 13 }}>
                      <span style={{ color: '#999' }}>{i + 1}.</span>
                      <span className="audio-ko" style={{ minWidth: 120 }}>{w.korean}</span>
                      <span className="audio-en" style={{ opacity: 0.8 }}>{w.english}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {currentSetWords && currentSetWords.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Now playing (up to 20):</div>
              <div style={{ display: 'grid', gap: 4 }}>
                {currentSetWords.map((w, i) => (
                  <div key={i} style={{ display: 'grid', gap: 2 }}>
                    <div style={{ display: 'flex', gap: 8, fontSize: 13 }}>
                      <span style={{ color: '#999' }}>{i + 1}.</span>
                      <span className="audio-ko" style={{ minWidth: 120 }}>{w.korean}</span>
                      <span className="audio-en" style={{ opacity: 0.8 }}>{w.english}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuizControls;

