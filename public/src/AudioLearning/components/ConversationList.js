import React from 'react';

const ConversationList = ({
  savedConversations,
  defaultConversationId,
  setDefaultConversation,
  fetchServerConversations,
  setPlaylist,
  setPlaylistIndex,
  setIsPlaylistMode,
  isPlaylistMode,
  playlist,
  playlistIndex,
  savePlaylist,
  quizDifficulty,
  quizDelaySec,
  generateLevel3Audio,
  generateLevel3AudioForItems,
  setGeneratedSentences,
  setCurrentConversationId,
  setCurrentConversationTitle,
  setConversationAudioUrl,
  playConversationAudioRef,
  persistConversations,
  conversationAudioUrl,
  api,
  playPreviousConversation,
  playNextConversation,
}) => {
  return (
    <div className="audio-card" style={{ marginTop: 12 }}>
      <h2 className="audio-section-title">Saved Conversations</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <button className="audio-btn" onClick={fetchServerConversations}>Refresh from Server</button>
        <button 
          className="audio-btn" 
          onClick={async () => {
            if (!confirm(`Are you sure you want to delete ALL ${savedConversations.length} conversations? This cannot be undone.`)) {
              return;
            }
            if (!confirm('This will delete all conversations from both local storage and the server. Are you absolutely sure?')) {
              return;
            }
            
            try {
              // Delete all conversations from server
              const serverConversations = savedConversations.filter(c => {
                const serverId = typeof c.id === 'number' || /^\d+$/.test(String(c.id)) ? parseInt(c.id, 10) : null;
                return serverId && Number.isFinite(serverId);
              });
              
              // Delete each server conversation (with audio files)
              for (const conv of serverConversations) {
                try {
                  const serverId = parseInt(conv.id, 10);
                  const audioUrl = conv.audioUrl || null;
                  await api.deleteConversation(serverId, audioUrl);
                } catch (err) {
                  console.warn(`Failed to delete conversation ${conv.id} from server:`, err);
                }
              }
              
              // Clear local storage
              persistConversations([]);
              
              // Clear default conversation
              setDefaultConversation(null);
              
              // Clear playlist
              setPlaylist([]);
              setPlaylistIndex(-1);
              
              // Clear generated sentences
              setGeneratedSentences([]);
              setCurrentConversationId(null);
              setCurrentConversationTitle('');
              setConversationAudioUrl('');
              
              // Refresh from server to sync
              try {
                await fetchServerConversations();
              } catch (_) {}
            } catch (err) {
              console.error('Error deleting all conversations:', err);
              alert('Error deleting conversations. Some may still remain.');
            }
          }}
          style={{ background: '#f44336', color: 'white' }}
        >
          Delete All
        </button>
        <button className="audio-btn" onClick={async () => {
          // Manual playlist creation (auto-creation happens automatically, but this allows regeneration)
          if (savedConversations && savedConversations.length > 0) {
            setPlaylist(savedConversations);
            setPlaylistIndex(0);
            setIsPlaylistMode(true);
            
            // Pre-generate audio for all conversations that don't have it
            // Always generate Level 3 audio (never regular conversation audio)
            const conversationsToUpdate = [];
            for (const conv of savedConversations) {
              if (conv.items && conv.items.length > 0) {
                try {
                  let audioUrl = null;
                  
                  if (!conv.audioUrl) {
                    // Generate Level 3 audio (will generate wordPairs if needed)
                    audioUrl = await generateLevel3AudioForItems(conv.items);
                  } else {
                    // Use existing Level 3 audio
                    audioUrl = conv.audioUrl;
                  }
                  
                  if (audioUrl) {
                    conversationsToUpdate.push({ ...conv, audioUrl });
                  } else {
                    conversationsToUpdate.push(conv);
                  }
                } catch (_) {
                  conversationsToUpdate.push(conv);
                }
              } else {
                conversationsToUpdate.push(conv);
              }
            }
            
            // Update saved conversations with generated audio URLs
            if (conversationsToUpdate.some((c, i) => c.audioUrl !== savedConversations[i]?.audioUrl)) {
              persistConversations(conversationsToUpdate);
              setPlaylist(conversationsToUpdate);
            }
            
            // Load and play first conversation
            const first = conversationsToUpdate[0] || savedConversations[0];
            setGeneratedSentences(first.items || []);
            setCurrentConversationId(first.id || null);
            setCurrentConversationTitle(first.title);
            if (first.audioUrl) {
              setConversationAudioUrl(first.audioUrl);
              if (playConversationAudioRef.current) {
                await playConversationAudioRef.current(false, first.audioUrl, first.title);
              }
            } else {
              setConversationAudioUrl('');
              // Try to generate Level 3 audio one more time if still missing
              try {
                const audioUrl = await generateLevel3AudioForItems(first.items);
                if (audioUrl) {
                  setConversationAudioUrl(audioUrl);
                  const updated = conversationsToUpdate.map(x => 
                    x.id === first.id ? { ...x, audioUrl } : x
                  );
                  persistConversations(updated);
                  setPlaylist(updated);
                  if (playConversationAudioRef.current) {
                    await playConversationAudioRef.current(false, audioUrl, first.title);
                  }
                }
              } catch (_) {}
            }
            // Save playlist to database
            const conversationIds = conversationsToUpdate.map(c => c.id).filter(Boolean);
            if (conversationIds.length > 0) {
              await savePlaylist(conversationIds, 0);
            }
          }
        }}>Refresh Playlist</button>
        {isPlaylistMode && playlist.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#666' }}>
            <span>Playlist: {playlistIndex + 1} / {playlist.length}</span>
            <button className="audio-mini-btn" onClick={playPreviousConversation} disabled={playlist.length <= 1}>⏮</button>
            <button className="audio-mini-btn" onClick={playNextConversation} disabled={playlist.length <= 1}>⏭</button>
            <button className="audio-mini-btn" onClick={async () => {
              setIsPlaylistMode(false);
              setPlaylist([]);
              setPlaylistIndex(-1);
              // Clear playlist from database
              await savePlaylist([], -1);
            }}>Stop Playlist</button>
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {(!savedConversations || savedConversations.length === 0) && (
          <div className="audio-empty">No saved conversations yet.</div>
        )}
        {savedConversations.map((c) => (
          <ConversationItem
            key={c.id}
            conversation={c}
            defaultConversationId={defaultConversationId}
            setDefaultConversation={setDefaultConversation}
            setGeneratedSentences={setGeneratedSentences}
            setCurrentConversationId={setCurrentConversationId}
            setCurrentConversationTitle={setCurrentConversationTitle}
            isPlaylistMode={isPlaylistMode}
            savedConversations={savedConversations}
            setPlaylist={setPlaylist}
            playlist={playlist}
            setPlaylistIndex={setPlaylistIndex}
            quizDifficulty={quizDifficulty}
            quizDelaySec={quizDelaySec}
            generateLevel3Audio={generateLevel3Audio}
            generateLevel3AudioForItems={generateLevel3AudioForItems}
            setConversationAudioUrl={setConversationAudioUrl}
            persistConversations={persistConversations}
            conversationAudioUrl={conversationAudioUrl}
            api={api}
            fetchServerConversations={fetchServerConversations}
          />
        ))}
      </div>
    </div>
  );
};

const ConversationItem = ({
  conversation: c,
  defaultConversationId,
  setDefaultConversation,
  setGeneratedSentences,
  setCurrentConversationId,
  setCurrentConversationTitle,
  isPlaylistMode,
  savedConversations,
  setPlaylist,
  playlist,
  setPlaylistIndex,
  quizDifficulty,
  quizDelaySec,
  generateLevel3Audio,
  generateLevel3AudioForItems,
  setConversationAudioUrl,
  persistConversations,
  conversationAudioUrl,
  api,
  fetchServerConversations,
}) => {
  return (
    <div className="audio-row" style={{ alignItems: 'center' }}>
      <div style={{ flex: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
        {c.id === defaultConversationId && <span style={{ fontSize: '1.2em' }}>★</span>}
        {c.title}
      </div>
      <div style={{ flex: 1, fontSize: 11, color: '#666' }}>ID: {c.id || 'N/A'}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button className="audio-mini-btn" onClick={async () => {
          // Load the conversation items, preserving wordPairs if they exist
          const itemsToLoad = Array.isArray(c.items) ? c.items.map(item => ({
            korean: String(item.korean || ''),
            english: String(item.english || ''),
            wordPairs: Array.isArray(item.wordPairs) ? item.wordPairs.map(pair => ({
              ko: String(pair.ko || pair.korean || ''),
              en: String(pair.en || pair.english || '')
            })) : [],
            englishWordMapping: item.englishWordMapping || {}
          })) : [];
          
          setGeneratedSentences(itemsToLoad);
          setCurrentConversationId(c.id || null);
          setCurrentConversationTitle(c.title);
          // Auto-create playlist from all conversations if not already in playlist mode
          if (!isPlaylistMode && savedConversations && savedConversations.length > 1) {
            setPlaylist(savedConversations);
            const idx = savedConversations.findIndex(conv => conv.id === c.id);
            setPlaylistIndex(idx >= 0 ? idx : 0);
            setIsPlaylistMode(true);
          } else if (isPlaylistMode) {
            // Update playlist index if already in playlist mode
            const idx = playlist.findIndex(conv => conv.id === c.id);
            if (idx >= 0) {
              setPlaylistIndex(idx);
            }
          }
          // Auto-generate audio - always regenerate Level 3 if wordPairs exist to ensure word pairs are included
          const hasWordPairs = itemsToLoad.every(item => Array.isArray(item.wordPairs) && item.wordPairs.length > 0);
          const isLevel3 = (Number(quizDifficulty) || 1) === 3;
          
          if (hasWordPairs && isLevel3) {
            // Always regenerate Level 3 audio with word pairs to ensure they're included
            setConversationAudioUrl('');
            try {
              const sentencesWithPairs = itemsToLoad.map(item => ({
                english: String(item.english || ''),
                korean: String(item.korean || ''),
                wordPairs: Array.isArray(item.wordPairs) ? item.wordPairs.map(pair => ({
                  ko: String(pair.ko || pair.korean || ''),
                  en: String(pair.en || pair.english || '')
                })) : []
              }));
              const audioUrl = await generateLevel3Audio(sentencesWithPairs, Math.max(0, Number(quizDelaySec) || 0.5));
              if (audioUrl) {
                // Update the saved conversation with the new audio URL
                const next = savedConversations.map(x => 
                  x.id === c.id ? { ...x, audioUrl } : x
                );
                persistConversations(next);
                setConversationAudioUrl(audioUrl);
              }
            } catch (_) {}
          } else if (c.audioUrl) {
            // Use existing Level 3 audio
            setConversationAudioUrl(c.audioUrl);
          } else {
            // Generate Level 3 audio if no audioUrl exists
            setConversationAudioUrl('');
            try {
              const audioUrl = await generateLevel3AudioForItems(c.items);
              if (audioUrl) {
                // Update the saved conversation with the new audio URL
                const next = savedConversations.map(x => 
                  x.id === c.id ? { ...x, audioUrl } : x
                );
                persistConversations(next);
                setConversationAudioUrl(audioUrl);
              }
            } catch (_) {}
          }
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}>Load</button>
        <button className="audio-mini-btn" onClick={() => {
          setDefaultConversation(c.id === defaultConversationId ? null : c.id);
        }} style={{ 
          background: c.id === defaultConversationId ? '#4caf50' : undefined,
          color: c.id === defaultConversationId ? 'white' : undefined
        }} title={c.id === defaultConversationId ? 'Default (click to unset)' : 'Set as default'}>
          {c.id === defaultConversationId ? '★ Default' : 'Set Default'}
        </button>
        <button className="audio-mini-btn" onClick={() => {
          const urlToDownload = c.audioUrl || conversationAudioUrl;
          if (!urlToDownload) return;
          try {
            const a = document.createElement('a');
            a.href = urlToDownload;
            a.download = 'conversation.mp3';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { try { document.body.removeChild(a); } catch (_) {} }, 0);
          } catch (_) {}
        }} disabled={!c.audioUrl && !conversationAudioUrl}>Download</button>
        <button className="audio-mini-btn" onClick={() => {
          const t = prompt('Rename conversation', c.title);
          if (t && t.trim()) {
            const next = savedConversations.map(x => x.id===c.id ? { ...x, title: t.trim() } : x);
            persistConversations(next);
          }
        }}>Rename</button>
        <button className="audio-mini-btn" onClick={async () => {
          if (!confirm('Delete this conversation?')) return;
          try {
            // Try to delete from server if it has a numeric ID (server-saved)
            const serverId = typeof c.id === 'number' || /^\d+$/.test(String(c.id)) ? parseInt(c.id, 10) : null;
            const audioUrl = c.audioUrl || null;
            if (serverId && Number.isFinite(serverId)) {
              try {
                await api.deleteConversation(serverId, audioUrl);
              } catch (err) {
                console.warn('Failed to delete from server:', err);
                // Continue with local deletion even if server delete fails
              }
            }
            // Delete from local storage
            const next = savedConversations.filter(x => x.id !== c.id);
            persistConversations(next);
            // Clear default if this was the default conversation
            if (c.id === defaultConversationId) {
              setDefaultConversation(null);
            }
            // Refresh from server to sync
            try {
              await fetchServerConversations();
            } catch (_) {}
          } catch (err) {
            console.error('Error deleting conversation:', err);
          }
        }}>Delete</button>
      </div>
    </div>
  );
};

export default ConversationList;

