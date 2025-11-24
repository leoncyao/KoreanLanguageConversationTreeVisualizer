import React from 'react';
import { api } from '../api';
import { speakToAudio, cleanupAudioCache } from '../AudioLearning/audioTTS';

function JournalArchivePage() {
  const [days, setDays] = React.useState([]);
  const [selectedDate, setSelectedDate] = React.useState('');
  const [entries, setEntries] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [addingId, setAddingId] = React.useState(null);
  const [addMsg, setAddMsg] = React.useState('');

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const resp = await api.getJournalDays(120);
        if (!resp.ok) throw new Error('Failed to load days');
        const data = await resp.json();
        if (!mounted) return;
        setDays(data || []);
        if (data && data.length > 0) {
          setSelectedDate(data[0].date);
        } else {
          setSelectedDate('');
        }
      } catch (e) {
        if (mounted) setError(String(e && e.message || e));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!selectedDate) { setEntries([]); return; }
      try {
        const resp = await api.getJournalEntriesByDate(selectedDate);
        if (!resp.ok) throw new Error('Failed to load entries');
        const data = await resp.json();
        if (mounted) setEntries(Array.isArray(data) ? data : []);
      } catch (e) {
        if (mounted) setError(String(e && e.message || e));
      }
    };
    load();
    return () => { mounted = false; };
  }, [selectedDate]);

  return (
    <div style={{ display: 'flex', gap: '1rem', padding: '1rem' }}>
      <div style={{ width: 220, flexShrink: 0 }}>
        <h3 style={{ marginTop: 0 }}>Days</h3>
        <div style={{ border: '1px solid #ddd', borderRadius: 6, maxHeight: 480, overflow: 'auto' }}>
          {days.length === 0 && (
            <div style={{ padding: '0.75rem', color: '#666' }}>{loading ? 'Loading…' : 'No entries yet'}</div>
          )}
          {days.map((d) => (
            <button
              key={d.date}
              type="button"
              onClick={() => setSelectedDate(d.date)}
              style={{
                display: 'flex', justifyContent: 'space-between', gap: '0.5rem',
                width: '100%', padding: '0.5rem 0.75rem',
                background: selectedDate === d.date ? '#eef5ff' : 'white',
                border: 'none', borderBottom: '1px solid #eee', cursor: 'pointer'
              }}
            >
              <span>{d.date}</span>
              <span style={{ color: '#666' }}>{d.count}</span>
            </button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 style={{ marginTop: 0 }}>Entries {selectedDate ? `(${selectedDate})` : ''}</h3>
        {error && <div style={{ color: '#b00', marginBottom: '0.5rem' }}>{error}</div>}
        {entries.length === 0 && (
          <div style={{ color: '#666' }}>{selectedDate ? 'No entries for this day' : 'Select a day'}</div>
        )}
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {entries.map((e) => (
            <div key={e.id} style={{ border: '1px solid #ddd', borderRadius: 6, padding: '0.75rem' }}>
              <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.25rem' }}>{(() => {
                try {
                  const raw = String(e.created_at || '').trim();
                  // If it's already ISO with timezone, Date can parse directly
                  // Otherwise, coerce SQLite 'YYYY-MM-DD HH:MM:SS' to UTC by appending 'Z'
                  const isoLike = raw.includes('T') ? raw : raw.replace(' ', 'T');
                  const d = new Date(/Z$/.test(isoLike) ? isoLike : isoLike + 'Z');
                  return isNaN(d.getTime()) ? raw : d.toLocaleString();
                } catch (_) {
                  return String(e.created_at || '');
                }
              })()}</div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '0.5rem' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={async () => {
                    try {
                      const ko = String(e.korean_text || '').trim();
                      const en = String(e.english_text || '').trim();
                      if (ko) await speakToAudio(ko, 'ko-KR', 0.95);
                      if (en) await speakToAudio(en, 'en-US', 1.0);
                    } catch (_) {}
                  }}
                >
                  Speak
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    try { const s = window.speechSynthesis; if (s) s.cancel(); } catch (_) {}
                    try { cleanupAudioCache(); } catch (_) {}
                  }}
                >
                  Stop
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={addingId === e.id}
                  onClick={async () => {
                    try {
                      setAddMsg('');
                      setAddingId(e.id);
                      const splitSentences = (text) => {
                        if (!text) return [];
                        return String(text)
                          .split(/(?<=[.!?。！？])\s+|\n+/)
                          .map(s => s.trim())
                          .filter(s => s.length > 0);
                      };
                      const enSentences = splitSentences(e.english_text || '');
                      const koSentences = splitSentences(e.korean_text || '');
                      const n = Math.min(enSentences.length, koSentences.length, 50);
                      let added = 0;
                      for (let i = 0; i < n; i++) {
                        const en = enSentences[i];
                        const ko = koSentences[i];
                        if (!en || !ko) continue;
                        try {
                          const res = await api.addCurriculumPhrase({ korean_text: ko, english_text: en });
                          if (res.ok) added++;
                        } catch (_) {}
                        await new Promise(r => setTimeout(r, 40));
                      }
                      setAddMsg(`Added ${added}/${n} sentences from ${e.id}.`);
                    } catch (err) {
                      setAddMsg(`Error adding from ${e.id}: ${String(err && err.message || err)}`);
                    } finally {
                      setAddingId(null);
                    }
                  }}
                >
                  {addingId === e.id ? 'Adding…' : 'Split & Add to Curriculum'}
                </button>
              </div>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: '1rem' }}>{e.korean_text}</div>
              {e.english_text && (
                <div style={{ marginTop: '0.5rem', color: '#555', whiteSpace: 'pre-wrap' }}>
                  <span style={{ fontSize: '0.85rem', color: '#777' }}>EN: </span>{e.english_text}
                </div>
              )}
              {addMsg && <div style={{ marginTop: '0.5rem', fontSize: 12, color: addMsg.startsWith('Error') ? '#b00' : '#0a0' }}>{addMsg}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default JournalArchivePage;


