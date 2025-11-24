import React from 'react';

const SentenceDisplay = ({
  generatedSentences,
  currentConversationId,
  showAudioPatternDetails,
  setShowAudioPatternDetails,
  saveConversationSet,
  savedConversations,
  defaultConversationId,
  setDefaultConversation,
  fetchServerConversations,
  persistConversations,
  api,
  setGeneratedSentences,
  setCurrentConversationId,
  setConversationAudioUrl,
  setCurrentConversationTitle,
  isQuizLooping,
  stopAll,
  conversationAudioRef,
}) => {
  if (!generatedSentences || generatedSentences.length === 0) return null;

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span>Generated Sentences (Level >= 2)</span>
        {currentConversationId && (
          <span style={{ fontSize: 11, color: '#666', fontWeight: 400 }}>
            ID: {currentConversationId}
          </span>
        )}
        <button
          className="audio-mini-btn"
          onClick={() => setShowAudioPatternDetails(!showAudioPatternDetails)}
          style={{ marginLeft: 'auto', fontSize: 11 }}
          title={showAudioPatternDetails ? 'Hide audio pattern details' : 'Show audio pattern details'}
        >
          {showAudioPatternDetails ? 'Hide Pattern' : 'Show Pattern'}
        </button>
      </div>
      <div style={{ display: 'grid', gap: 12 }}>
        {generatedSentences.map((s, i) => (
          <div key={i} style={{ 
            padding: '16px', 
            border: '2px solid #d1d5db', 
            borderRadius: 10, 
            background: '#ffffff',
            display: 'grid',
            gap: 12
          }}>
            {/* Sentence number */}
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', letterSpacing: '0.5px' }}>
              Sentence {i + 1}
            </div>
            
            {/* Full sentences - larger and more prominent */}
            <div style={{ display: 'grid', gap: 8 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Korean</div>
                <div className="audio-ko" style={{ 
                  padding: '14px 16px', 
                  border: '2px solid #3b82f6', 
                  borderRadius: 8,
                  background: '#eff6ff',
                  fontSize: 'clamp(18px, 4.5vw, 20px)',
                  lineHeight: 1.8,
                  wordBreak: 'keep-all',
                  fontWeight: 600,
                  color: '#1e40af'
                }}>{s.korean}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>English</div>
                <div className="audio-en" style={{ 
                  padding: '14px 16px', 
                  border: '2px solid #10b981', 
                  borderRadius: 8,
                  background: '#f0fdf4',
                  fontSize: 'clamp(16px, 4vw, 18px)',
                  lineHeight: 1.8,
                  wordBreak: 'break-word',
                  fontWeight: 500,
                  color: '#065f46'
                }}>{s.english}</div>
              </div>
            </div>
            
            {/* Word-by-word breakdown - clear table-like structure - toggled by showAudioPatternDetails */}
            {showAudioPatternDetails && Array.isArray(s.wordPairs) && s.wordPairs.length > 0 && (
              <div style={{ 
                padding: '12px 16px', 
                background: '#f9fafb', 
                border: '2px solid #e5e7eb', 
                borderRadius: 8
              }}>
                <div style={{ fontWeight: 700, marginBottom: 12, color: '#111827', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Word-by-Word Breakdown
                </div>
                <div style={{ 
                  display: 'grid', 
                  gap: 8
                }}>
                  {s.wordPairs.map((pair, idx) => (
                    <div key={idx} style={{ 
                      display: 'grid',
                      gridTemplateColumns: 'auto 1fr',
                      gap: 12,
                      alignItems: 'center',
                      padding: '10px 12px',
                      background: '#ffffff',
                      border: '1px solid #d1d5db',
                      borderRadius: 6,
                      transition: 'all 0.2s'
                    }}>
                      <div style={{ 
                        minWidth: '40px',
                        textAlign: 'center',
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#6b7280',
                        background: '#f3f4f6',
                        padding: '4px 8px',
                        borderRadius: 4
                      }}>
                        {idx + 1}
                      </div>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 12,
                        flexWrap: 'wrap'
                      }}>
                        <span className="audio-ko" style={{ 
                          fontWeight: 700, 
                          fontSize: 'clamp(16px, 4vw, 18px)',
                          color: '#1e40af',
                          padding: '6px 10px',
                          background: '#eff6ff',
                          borderRadius: 5,
                          border: '1px solid #93c5fd'
                        }}>{pair.ko || pair.korean || ''}</span>
                        <span style={{ 
                          color: '#9ca3af', 
                          fontSize: 14,
                          fontWeight: 600
                        }}>→</span>
                        <span className="audio-en" style={{ 
                          color: '#065f46', 
                          fontSize: 'clamp(14px, 3.5vw, 16px)',
                          fontWeight: 500,
                          padding: '6px 10px',
                          background: '#f0fdf4',
                          borderRadius: 5,
                          border: '1px solid #86efac'
                        }}>{pair.en || pair.english || ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {/* Conversation save/export controls (Level 3) */}
      <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="audio-btn" onClick={saveConversationSet} title="Save this 5-sentence conversation">
            Save Conversation
          </button>
          {currentConversationId && (
            <button 
              className="audio-btn" 
              onClick={async () => {
                if (!confirm('Delete the currently loaded conversation? This will clear it from the screen.')) return;
                
                // Find the conversation by ID
                const currentConv = savedConversations.find(c => c.id === currentConversationId);
                
                if (currentConv) {
                  // Delete from saved conversations
                  try {
                    // Try to delete from server if it has a numeric ID (server-saved)
                    const serverId = typeof currentConv.id === 'number' || /^\d+$/.test(String(currentConv.id)) ? parseInt(currentConv.id, 10) : null;
                    const audioUrl = currentConv.audioUrl || conversationAudioUrl || null;
                    if (serverId && Number.isFinite(serverId)) {
                      try {
                        await api.deleteConversation(serverId, audioUrl);
                      } catch (err) {
                        console.warn('Failed to delete from server:', err);
                      }
                    }
                    // Delete from local storage
                    const next = savedConversations.filter(x => x.id !== currentConversationId);
                    persistConversations(next);
                    // Clear default if this was the default conversation
                    if (currentConversationId === defaultConversationId) {
                      setDefaultConversation(null);
                    }
                    // Refresh from server to sync
                    try {
                      await fetchServerConversations();
                    } catch (_) {}
                  } catch (err) {
                    console.error('Error deleting conversation:', err);
                  }
                }
                
                // Clear the loaded conversation
                setGeneratedSentences([]);
                setCurrentConversationId(null);
                setConversationAudioUrl('');
                setCurrentConversationTitle('');
                
                // Stop any playing audio
                try {
                  const audio = conversationAudioRef.current;
                  if (audio) {
                    audio.pause();
                    audio.currentTime = 0;
                  }
                } catch (_) {}
                
                // Stop quiz loop if running
                if (isQuizLooping) {
                  stopAll();
                }
              }}
              title={`Delete conversation ID: ${currentConversationId}`}
              style={{ background: '#f44336', color: 'white' }}
            >
              Delete Current Conversation
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SentenceDisplay;

