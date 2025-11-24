import React from 'react';

const VariationIndicator = ({ usingVariations, allPhrases, usedPhraseIds }) => {
  if (!usingVariations) return null;

  return (
    <div style={{ marginTop: 8, padding: '12px', background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: 8 }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <p style={{ fontSize: 12, color: '#666', fontStyle: 'italic', margin: 0 }}>
            AI-generated variation (will be added to curriculum on completion)
          </p>
          <span style={{ fontSize: 12, color: '#1976d2', fontWeight: 600 }}>
            {allPhrases.length > 0 ? `${usedPhraseIds.length} / ${allPhrases.length} phrases completed` : '0 / 0 phrases completed'}
          </span>
        </div>
        {allPhrases.length > 0 && (
          <div style={{ width: '100%', height: 8, background: '#fff', borderRadius: 4, overflow: 'hidden', marginTop: 8 }}>
            <div 
              style={{ 
                width: `${(usedPhraseIds.length / allPhrases.length) * 100}%`, 
                height: '100%', 
                background: '#4caf50',
                transition: 'width 0.3s ease'
              }} 
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default VariationIndicator;

