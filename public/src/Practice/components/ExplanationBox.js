import React from 'react';
import { Link } from 'react-router-dom';

const ExplanationBox = ({
  showExplanation,
  isLoadingExplanation,
  explanationText,
  currentPhrase,
  blankPhrase,
  getFullKoreanSentence,
  mdToHtml
}) => {
  if (!showExplanation) return null;

  return (
    <div className="sentence-box" style={{ textAlign: 'left', marginTop: 16, padding: '16px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8 }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '1.2em', fontWeight: 600, color: '#1f2937' }}>Explanation</h3>
      <div style={{ marginTop: 8 }}>
        {isLoadingExplanation ? (
          <p style={{ margin: '8px 0', color: '#6b7280', fontStyle: 'italic' }}>Loading explanation...</p>
        ) : explanationText ? (
          <>
            <div 
              style={{ 
                lineHeight: '1.7',
                color: '#374151',
                fontSize: '0.95em'
              }}
              dangerouslySetInnerHTML={{ __html: mdToHtml(explanationText) }}
            />
            {currentPhrase && blankPhrase && (() => {
              const fullKorean = getFullKoreanSentence();
              const english = blankPhrase.translation || currentPhrase.english_text || '';
              return fullKorean && english ? (
                <div style={{ marginTop: 16, textAlign: 'center', paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
                  <Link
                    to={`/chat?input=${encodeURIComponent(english)}&translation=${encodeURIComponent(fullKorean)}`}
                    className="regenerate-button"
                    style={{ textDecoration: 'none', display: 'inline-block' }}
                    title="Open in chat to ask follow-up questions about this explanation"
                  >
                    Ask Questions
                  </Link>
                </div>
              ) : null;
            })()}
          </>
        ) : (
          <p style={{ margin: '8px 0', color: '#6b7280', fontStyle: 'italic' }}>No explanation yet.</p>
        )}
      </div>
    </div>
  );
};

export default ExplanationBox;

