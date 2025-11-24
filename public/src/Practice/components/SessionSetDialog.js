import React from 'react';

const SessionSetDialog = ({ showSetDialog, activePhrases }) => {
  if (!showSetDialog) return null;

  return (
    <div style={{ marginTop: 6, padding: '10px', background: '#ffffff', border: '1px solid #ddd', borderRadius: 8 }}>
      <h3 style={{ marginTop: 0, marginBottom: 8 }}>Sentences in this set</h3>
      {Array.isArray(activePhrases) && activePhrases.length > 0 ? (
        <div style={{ display: 'grid', gap: 8 }}>
          {activePhrases.map((p, i) => (
            <div key={p.id || i} style={{ border: '1px solid #eee', borderRadius: 6, padding: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ color: '#999', fontSize: 12 }}>{i + 1}.</span>
                <div className="ko-text" style={{ fontWeight: 700 }}>{p.korean_text}</div>
              </div>
              <div style={{ color: '#374151', marginTop: 4 }}>{p.english_text}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ color: '#6b7280', fontSize: 12 }}>No sentences in this set.</div>
      )}
    </div>
  );
};

export default SessionSetDialog;

