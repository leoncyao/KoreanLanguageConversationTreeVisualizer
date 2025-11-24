import React from 'react';
import BlankInput from './BlankInput';

const KoreanSentence = ({
  blankPhrase,
  inputValues,
  currentBlankIndex,
  inputPlaceholder,
  inputRefs,
  handleInputChange,
  handleKeyDown,
  showAnswerBelow,
  textSize,
  handleSpeakFullThreeTimes
}) => {
  const koreanParts = blankPhrase.korean.split('[BLANK]');
  const blankCount = blankPhrase.blanks?.length || 0;

  return (
    <p className="korean-sentence" style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      gap: 8, 
      flexWrap: 'wrap',
      fontSize: `${2.5 * textSize}rem`
    }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {koreanParts.map((part, idx) => (
          <React.Fragment key={idx}>
            {part}
            {idx < blankCount && (
              <BlankInput
                index={idx}
                value={inputValues[idx] || ''}
                onChange={(e) => handleInputChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, idx)}
                placeholder={idx === currentBlankIndex ? inputPlaceholder || '' : ''}
                autoFocus={idx === currentBlankIndex}
                inputRef={(el) => { inputRefs.current[idx] = el; }}
                blankWord={blankPhrase.blanks[idx]}
                showAnswerBelow={showAnswerBelow}
                correctAnswer={blankPhrase.correct_answers?.[idx] || blankPhrase.blanks[idx]}
                textSize={textSize}
                isCurrentBlank={idx === currentBlankIndex}
                hasValue={!!inputValues[idx]}
              />
            )}
          </React.Fragment>
        ))}
      </span>
      <button
        type="button"
        onClick={handleSpeakFullThreeTimes}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px 8px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#6b7280',
          fontSize: '1.2em'
        }}
        title="Speak full Korean sentence three times"
      >
        🔊
      </button>
    </p>
  );
};

export default KoreanSentence;

