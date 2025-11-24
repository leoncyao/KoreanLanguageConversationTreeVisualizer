import React from 'react';
import { api } from '../api';
import '../Home/HomePage.css';

function KpopLyricsPage() {
  const [songs, setSongs] = React.useState(() => {
    try {
      const raw = localStorage.getItem('kpop_songs_v1');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  });
  const [selectedId, setSelectedId] = React.useState(() => {
    // Load first song by default if available
    try {
      const raw = localStorage.getItem('kpop_songs_v1');
      const parsed = raw ? JSON.parse(raw) : [];
      const arr = Array.isArray(parsed) ? parsed : [];
      return arr.length > 0 ? arr[0].id : null;
    } catch (_) {
      return null;
    }
  });
  const [showEditor, setShowEditor] = React.useState(false);
  const [editorTitle, setEditorTitle] = React.useState('');
  const [editorArtist, setEditorArtist] = React.useState('');
  const [editorLyrics, setEditorLyrics] = React.useState('');
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [showEnglish, setShowEnglish] = React.useState(() => {
    try {
      const saved = localStorage.getItem('kpop_showEnglish');
      return saved !== null ? saved === 'true' : true;
    } catch (_) {
      return true;
    }
  });
  const [translatingAll, setTranslatingAll] = React.useState(false);
  const cancelAllRef = React.useRef(false);

  const persistSongs = React.useCallback((list) => {
    try { localStorage.setItem('kpop_songs_v1', JSON.stringify(list)); } catch (_) {}
  }, []);

  const selectedSong = React.useMemo(() => songs.find(s => s.id === selectedId) || null, [songs, selectedId]);

  const parsedLines = React.useMemo(() => {
    const text = String(selectedSong?.lyrics || '');
    return text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  }, [selectedSong]);

  const translations = React.useMemo(() => selectedSong?.translations || {}, [selectedSong]);

  // If selected song no longer exists, select first available or null
  React.useEffect(() => {
    if (selectedId && !songs.find(s => s.id === selectedId)) {
      const nextId = songs.length > 0 ? songs[0].id : null;
      setSelectedId(nextId);
    }
  }, [selectedId, songs]);

  const handleSelect = React.useCallback((id) => {
    setSelectedId(id || null);
    setCurrentIndex(0);
  }, []);

  const openNewEditor = React.useCallback(() => {
    setEditorTitle('');
    setEditorArtist('');
    setEditorLyrics('');
    setShowEditor(true);
  }, []);

  const openEditEditor = React.useCallback(() => {
    if (!selectedSong) return;
    setEditorTitle(selectedSong.title || '');
    setEditorArtist(selectedSong.artist || '');
    setEditorLyrics(selectedSong.lyrics || '');
    setShowEditor(true);
  }, [selectedSong]);

  const saveEditor = React.useCallback(async () => {
    const id = selectedSong ? selectedSong.id : `song-${Date.now()}`;
    const isNew = !selectedSong;
    const next = {
      id,
      title: editorTitle || 'Untitled',
      artist: editorArtist || '',
      lyrics: editorLyrics || '',
      translations: selectedSong?.translations || {}
    };
    const list = songs.some(s => s.id === id)
      ? songs.map(s => s.id === id ? next : s)
      : [...songs, next];
    setSongs(list);
    persistSongs(list);
    setSelectedId(id);
    setShowEditor(false);
    
    // Auto-translate line by line for new songs
    if (isNew && editorLyrics.trim()) {
      const lines = editorLyrics.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length > 0) {
        setTranslatingAll(true);
        cancelAllRef.current = false;
        for (let i = 0; i < lines.length; i++) {
          if (cancelAllRef.current) break;
          try {
            const res = await api.translate(lines[i], 'en');
            if (res && res.ok) {
              const data = await res.json().catch(() => ({}));
              const t = data.corrected || data.translation || '';
              if (t) {
                const updated = list.map(s => {
                  if (s.id !== id) return s;
                  const tr = { ...(s.translations || {}) };
                  tr[i] = t;
                  return { ...s, translations: tr };
                });
                setSongs(updated);
                persistSongs(updated);
              }
            }
          } catch (_) {}
        }
        setTranslatingAll(false);
      }
    }
  }, [editorTitle, editorArtist, editorLyrics, songs, selectedSong, persistSongs]);

  const deleteSong = React.useCallback(() => {
    if (!selectedSong) return;
    if (!confirm('Delete this song?')) return;
    const list = songs.filter(s => s.id !== selectedSong.id);
    setSongs(list);
    persistSongs(list);
    // Select next available song, or first, or null
    const nextId = list.length > 0 ? list[0].id : null;
    setSelectedId(nextId);
    setCurrentIndex(0);
  }, [songs, selectedSong, persistSongs]);

  const translateLine = React.useCallback(async (index) => {
    if (index < 0 || index >= parsedLines.length) return null;
    const line = parsedLines[index];
    try {
      const res = await api.translate(line, 'en');
      if (res && res.ok) {
        const data = await res.json().catch(() => ({}));
        const t = data.corrected || data.translation || '';
        if (selectedSong) {
          const updated = songs.map(s => {
            if (s.id !== selectedSong.id) return s;
            const tr = { ...(s.translations || {}) };
            tr[index] = t;
            return { ...s, translations: tr };
          });
          setSongs(updated);
          persistSongs(updated);
        }
        return t;
      }
    } catch (_) {}
    return null;
  }, [parsedLines, selectedSong, songs, persistSongs]);

  const translateAll = React.useCallback(async () => {
    if (!selectedSong || parsedLines.length === 0) return;
    setTranslatingAll(true);
    cancelAllRef.current = false;
    for (let i = 0; i < parsedLines.length; i++) {
      if (cancelAllRef.current) break;
      if (!translations[i]) {
        // eslint-disable-next-line no-await-in-loop
        await translateLine(i);
      }
    }
    setTranslatingAll(false);
  }, [selectedSong, parsedLines, translations, translateLine]);

  const currentKo = parsedLines[currentIndex] || '';
  const currentEn = translations[currentIndex] || '';

  return (
    <div className="translation-page">
      <div className="translation-container">
        <header className="translation-header">
          <h1 className="translation-title">K-pop Lyrics</h1>
          <p className="translation-subtitle">Select a song, paste lyrics, then step through lines with translations.</p>
        </header>

        <div className="translation-card">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={selectedId || ''}
              onChange={(e) => handleSelect(e.target.value || null)}
              style={{ padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8 }}
            >
              <option value="">Select song…</option>
              {songs.map(s => (
                <option key={s.id} value={s.id}>
                  {(s.artist ? `${s.artist} — ` : '') + (s.title || 'Untitled')}
                </option>
              ))}
            </select>
            <button type="button" className="translate-button" onClick={openNewEditor}>Add Song</button>
            <button type="button" className="translate-button" onClick={openEditEditor} disabled={!selectedSong}>Edit</button>
            <button type="button" className="clear-button" onClick={deleteSong} disabled={!selectedSong}>Delete</button>
            <button
              type="button"
              className="translate-button"
              onClick={translateAll}
              disabled={!selectedSong || parsedLines.length === 0 || translatingAll}
            >
              {translatingAll ? 'Translating…' : 'Translate All'}
            </button>
            <button type="button" className="translate-button" onClick={() => {
              const newVal = !showEnglish;
              setShowEnglish(newVal);
              try { localStorage.setItem('kpop_showEnglish', String(newVal)); } catch (_) {}
            }}>
              {showEnglish ? 'Hide EN' : 'Show EN'}
            </button>
          </div>
        </div>

        {showEditor && (
          <div className="translation-card" style={{ marginTop: 12 }}>
            <h2 style={{ marginTop: 0 }}>{selectedSong ? 'Edit Song' : 'Add Song'}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                type="text"
                placeholder="Title"
                value={editorTitle}
                onChange={(e) => setEditorTitle(e.target.value)}
                style={{ padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8 }}
              />
              <input
                type="text"
                placeholder="Artist"
                value={editorArtist}
                onChange={(e) => setEditorArtist(e.target.value)}
                style={{ padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8 }}
              />
              <textarea
                placeholder="Paste Korean lyrics (one line per row)"
                value={editorLyrics}
                onChange={(e) => setEditorLyrics(e.target.value)}
                rows={10}
                style={{ padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontFamily: 'inherit' }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="translate-button" onClick={saveEditor}>Save</button>
                <button type="button" className="clear-button" onClick={() => setShowEditor(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {selectedSong && (
          <div className="translation-card" style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h2 style={{ margin: 0 }}>
                {(selectedSong.artist ? `${selectedSong.artist} — ` : '') + (selectedSong.title || 'Untitled')}
              </h2>
              <small style={{ color: '#6b7280' }}>
                {parsedLines.length} lines
              </small>
            </div>

            {parsedLines.length === 0 ? (
              <p style={{ color: '#6b7280', margin: 0 }}>No lyrics.</p>
            ) : (
              <div
                style={{
                  width: '100%',
                  minHeight: '400px',
                  padding: '12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  fontFamily: 'inherit',
                  fontSize: '14px',
                  lineHeight: '1.6',
                  backgroundColor: '#fafafa',
                  whiteSpace: 'pre-wrap',
                  overflowY: 'auto',
                  maxHeight: '600px'
                }}
              >
                {parsedLines.map((line, i) => {
                  const en = showEnglish ? (translations[i] || '') : '';
                  return (
                    <div key={i} style={{ marginBottom: showEnglish && en ? '0.5rem' : '1rem' }}>
                      <div style={{ textDecoration: 'underline', textUnderlineOffset: '2px', marginBottom: showEnglish && en ? '0.25rem' : 0 }}>
                        {line}
                      </div>
                      {showEnglish && en && (
                        <div style={{ color: '#6b7280', fontStyle: 'italic', paddingLeft: '8px' }}>
                          {en}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default KpopLyricsPage;


