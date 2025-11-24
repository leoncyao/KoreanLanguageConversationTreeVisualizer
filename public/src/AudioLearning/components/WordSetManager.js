import React from 'react';

const WordSetManager = ({
  showGenerator,
  setShowGenerator,
  generatorPrompt,
  setGeneratorPrompt,
  generatorLoading,
  setGeneratorLoading,
  generatedSetTitle,
  setGeneratedSetTitle,
  generatedWords,
  setGeneratedWords,
  handleGenerateSet,
  saveGeneratedSet,
  playSet,
  showManageSets,
  setShowManageSets,
  wordSets,
  persistSets,
}) => {
  return (
    <>
      <div className="audio-card" style={{ marginTop: 12 }}>
        <h2 className="audio-section-title">Word Sets</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <button className="audio-btn" onClick={() => setShowGenerator(true)}>Generate Set (Chat)</button>
          <button className="audio-btn" onClick={() => setShowManageSets((v)=>!v)}>{showManageSets ? 'Hide Sets' : 'Show Sets'}</button>
        </div>
        {showManageSets && (
          <div style={{ display: 'grid', gap: 8 }}>
            {(!wordSets || wordSets.length === 0) && (
              <div className="audio-empty">No saved sets yet.</div>
            )}
            {wordSets.map((s) => (
              <div key={s.id} className="audio-row" style={{ alignItems: 'center' }}>
                <div style={{ flex: 2, fontWeight: 600 }}>{s.title}</div>
                <div style={{ flex: 1, fontSize: 12, color: '#666' }}>{(s.words||[]).length} words</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="audio-mini-btn" onClick={() => playSet(s)}>Play</button>
                  <button className="audio-mini-btn" onClick={() => {
                    const t = prompt('Rename set', s.title);
                    if (t && t.trim()) {
                      const next = wordSets.map(x => x.id===s.id ? { ...x, title: t.trim() } : x);
                      persistSets(next);
                    }
                  }}>Rename</button>
                  <button className="audio-mini-btn" onClick={() => {
                    if (!confirm('Delete this set?')) return;
                    const next = wordSets.filter(x => x.id !== s.id);
                    persistSets(next);
                  }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {showGenerator && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={() => setShowGenerator(false)}>
          <div style={{ background: 'white', padding: 16, borderRadius: 8, width: 'min(800px, 95vw)' }} onClick={(e)=>e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Generate Word Set (Chat)</h3>
            <div style={{ display: 'grid', gap: 8 }}>
              <textarea rows={6} value={generatorPrompt} onChange={(e)=>setGeneratorPrompt(e.target.value)} style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6 }} />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="audio-btn" onClick={handleGenerateSet} disabled={generatorLoading}>Generate</button>
                <input value={generatedSetTitle} onChange={(e)=>setGeneratedSetTitle(e.target.value)} placeholder="Set title" style={{ flex: 1, padding: 8, border: '1px solid #ddd', borderRadius: 6 }} />
                <button className="audio-btn" onClick={saveGeneratedSet} disabled={!generatedWords || generatedWords.length === 0}>Save Set</button>
                <button className="audio-btn" onClick={() => playSet({ id: 'tmp', title: generatedSetTitle, words: generatedWords })} disabled={!generatedWords || generatedWords.length === 0}>Play</button>
              </div>
              {generatorLoading && (
                <div style={{ height: 8, background: '#eee', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ width: '60%', height: 8, background: '#1976d2', animation: 'pulse 1s infinite alternate' }} />
                </div>
              )}
              {generatedWords && generatedWords.length > 0 && (
                <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid #eee', borderRadius: 6, padding: 8 }}>
                  {generatedWords.map((w, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13 }}>
                      <span style={{ color: '#999' }}>{i + 1}.</span>
                      <span className="audio-ko" style={{ minWidth: 120 }}>{w.korean}</span>
                      <span className="audio-en" style={{ opacity: 0.8 }}>{w.english}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button className="audio-btn" onClick={() => setShowGenerator(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default WordSetManager;

