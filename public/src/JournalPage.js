import React from 'react';
import { api } from './api';

function JournalPage() {
  const [inputText, setInputText] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState('');
  const [koreanPreview, setKoreanPreview] = React.useState('');
  const [lastSavedEn, setLastSavedEn] = React.useState('');
  const [lastSavedKo, setLastSavedKo] = React.useState('');
  const [isAdding, setIsAdding] = React.useState(false);
  const [addProgress, setAddProgress] = React.useState({ total: 0, done: 0 });
  const [addResult, setAddResult] = React.useState('');

  const containsHangul = (s) => /[\u3131-\u318E\uAC00-\uD7A3]/.test(s);

  const getLocalDateString = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const handleSave = async () => {
    const text = String(inputText || '').trim();
    if (!text) {
      setStatus('Please enter some text.');
      return;
    }
    setSaving(true);
    setStatus('');
    try {
      const isKorean = containsHangul(text);
      let englishText = null;
      let koreanText = null;

      if (isKorean) {
        koreanText = text;
        // Optional: get English translation for reference
        try {
          const resp = await api.translate(text, 'en');
          if (resp.ok) {
            const data = await resp.json().catch(() => null);
            const translated = data && (data.corrected || data.translation || '').trim();
            if (translated) englishText = translated;
          }
        } catch (_) {}
      } else {
        englishText = text;
        // Translate to Korean
        const resp = await api.translate(text, 'ko');
        if (!resp.ok) throw new Error('Translation failed');
        const data = await resp.json();
        koreanText = String(data && (data.corrected || data.translation) || '').trim();
        setKoreanPreview(koreanText);
        if (!koreanText) throw new Error('Empty translation');
      }

      const date = getLocalDateString();
      const saveResp = await api.saveJournalEntry(englishText, koreanText, date);
      if (!saveResp.ok) {
        const err = await saveResp.text().catch(() => '');
        throw new Error(err || 'Save failed');
      }

      // Store for optional sentence-splitting add
      setLastSavedEn(englishText || '');
      setLastSavedKo(koreanText || '');
      setStatus('Saved!');
      setInputText('');
      setKoreanPreview('');
    } catch (e) {
      setStatus(`Error: ${String(e && e.message || e)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSplitAndAdd = async () => {
    try {
      setIsAdding(true);
      setAddResult('');
      const splitSentences = (text) => {
        if (!text) return [];
        return String(text)
          .split(/(?<=[.!?。！？])\s+|\n+/)
          .map(s => s.trim())
          .filter(s => s.length > 0);
      };
      const enSentences = splitSentences(lastSavedEn || '');
      const koSentences = splitSentences(lastSavedKo || '');
      const items = Math.min(enSentences.length, koSentences.length, 50);
      setAddProgress({ total: items, done: 0 });
      let added = 0;
      for (let i = 0; i < items; i++) {
        const en = enSentences[i];
        const ko = koSentences[i];
        if (!en || !ko) continue;
        try {
          const res = await api.addCurriculumPhrase({ korean_text: ko, english_text: en });
          if (res.ok) added++;
        } catch (_) {}
        setAddProgress((p) => ({ total: items, done: Math.min(items, p.done + 1) }));
        await new Promise(r => setTimeout(r, 50));
      }
      setAddResult(`Added ${added}/${items} sentences to curriculum.`);
    } catch (e) {
      setAddResult(`Error adding to curriculum: ${String(e && e.message || e)}`);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div style={{ padding: '1rem' }}>
      <h2>Journal (Today)</h2>
      <p style={{ color: '#666', marginTop: 0 }}>Type in English or Korean. English will be translated to Korean and saved for today.</p>
      <textarea
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        rows={6}
        placeholder="Write your thoughts..."
        style={{ width: '100%', maxWidth: 800, padding: '0.75rem', fontSize: '1rem' }}
      />
      {koreanPreview && (
        <div style={{ marginTop: '0.75rem' }}>
          <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.25rem' }}>Korean (preview):</div>
          <div style={{ whiteSpace: 'pre-wrap', padding: '0.75rem', border: '1px solid #ddd', borderRadius: 6, background: '#fafafa', maxWidth: 800 }}>{koreanPreview}</div>
        </div>
      )}
      <div style={{ marginTop: '0.75rem' }}>
        <button type="button" className="btn" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Translate & Save Today'}
        </button>
      </div>
      {(lastSavedKo || lastSavedEn) && (
        <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            className="btn"
            onClick={handleSplitAndAdd}
            disabled={isAdding}
          >
            {isAdding ? `Adding (${addProgress.done}/${addProgress.total})…` : 'Split sentences and add to curriculum'}
          </button>
          {addResult && <span style={{ color: addResult.startsWith('Error') ? '#b00' : '#090' }}>{addResult}</span>}
        </div>
      )}
      {status && (
        <div style={{ marginTop: '0.5rem', color: status.startsWith('Error') ? '#b00' : '#090' }}>{status}</div>
      )}
    </div>
  );
}

export default JournalPage;


