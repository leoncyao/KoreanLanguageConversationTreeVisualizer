import React from 'react';
import { api } from '../api';
import '../styles/App.css';

function LexiconAddPage() {
  const [text, setText] = React.useState('');
  const [isRunning, setIsRunning] = React.useState(false);
  const [progress, setProgress] = React.useState({ total: 0, done: 0 });
  const [log, setLog] = React.useState([]);

  const runImport = React.useCallback(async () => {
    const lines = String(text).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (lines.length === 0) return;
    setIsRunning(true);
    setProgress({ total: lines.length, done: 0 });
    setLog([]);
    for (let i = 0; i < lines.length; i++) {
      const en = lines[i];
      try {
        const res = await api.translate(en, 'ko');
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          setLog((prev) => [...prev, `✔️ ${en} -> ${data.corrected || ''}`]);
        } else {
          setLog((prev) => [...prev, `❌ ${en} (HTTP ${res.status})`]);
        }
      } catch (err) {
        setLog((prev) => [...prev, `❌ ${en} (${err.message || 'error'})`]);
      } finally {
        setProgress((p) => ({ total: p.total, done: p.done + 1 }));
        await new Promise(r => setTimeout(r, 100));
      }
    }
    setIsRunning(false);
  }, [text]);

  return (
    <div className="translation-page">
      <div className="translation-container">
        <header className="translation-header">
          <h1 className="translation-title">Add English Phrases to Lexicon</h1>
          <p className="translation-subtitle">Paste one phrase per line. We’ll translate each to Korean and save words.</p>
        </header>
        <div className="translation-card">
          <textarea
            rows={10}
            value={text}
            onChange={(e)=>setText(e.target.value)}
            placeholder="One English phrase per line…"
            style={{ width: '100%', padding: 10, border: '1px solid #e5e7eb', borderRadius: 8 }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
            <button className="translation-link" onClick={runImport} disabled={isRunning || !text.trim()}>Add to Lexicon</button>
            {isRunning && (
              <div style={{ fontSize: 12, color: '#6b7280' }}>
                {progress.done}/{progress.total}
              </div>
            )}
          </div>
        </div>
        {log.length > 0 && (
          <div className="translation-card" style={{ marginTop: 12 }}>
            <h2 style={{ marginTop: 0 }}>Import Log</h2>
            <div style={{ maxHeight: 220, overflow: 'auto', fontSize: 12, color: '#374151', lineHeight: 1.5 }}>
              {log.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default LexiconAddPage;


