import React from 'react';

const TranslationDisplay = ({ translation, highlightEnglishWords, englishWordIndices, textSize, practiceMode, currentPhrase }) => {
  return (
    <p className="translation" style={{ 
      marginTop: 8, 
      textAlign: 'center',
      fontSize: `${1.5 * textSize}rem`
    }}>
      {(() => {
        // Highlight English words that correspond to blank Korean words in all modes
        // Use the same red color as the input text (#e74c3c)
        if (highlightEnglishWords && englishWordIndices && englishWordIndices.length > 0) {
          console.log('[EnglishWordIndices] Rendering translation:', { 
            translation, 
            englishWordIndices, 
            practiceMode,
            hasMapping: !!currentPhrase?.englishWordMapping 
          });
          const words = translation.split(/(\s+)/);
          const highlightIndices = new Set(englishWordIndices || []);
          let wordIndex = 0;
          return words.map((word, idx) => {
            // Skip whitespace-only segments
            if (/^\s+$/.test(word)) {
              return <React.Fragment key={idx}>{word}</React.Fragment>;
            }
            const shouldHighlight = highlightIndices.has(wordIndex);
            wordIndex++;
            if (shouldHighlight) {
              return (
                <span key={idx} style={{ color: '#e74c3c', fontWeight: 600 }}>
                  {word}
                </span>
              );
            }
            return <React.Fragment key={idx}>{word}</React.Fragment>;
          });
        }
        // Fallback: show translation as-is if no indices available
        return translation;
      })()}
    </p>
  );
};

export default TranslationDisplay;

