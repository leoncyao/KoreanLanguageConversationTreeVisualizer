import React from 'react';

const BlankInput = ({
  index,
  value,
  onChange,
  onKeyDown,
  placeholder,
  autoFocus,
  inputRef,
  blankWord,
  showAnswerBelow,
  correctAnswer,
  textSize,
  isCurrentBlank,
  hasValue
}) => {
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', verticalAlign: 'baseline', margin: '0 2px' }}>
      <input
        ref={inputRef}
        type="text"
        className="fill-in-blank-input"
        value={value || ''}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder || ''}
        autoFocus={autoFocus}
        style={{ 
          width: `${Math.max((blankWord?.length || 3) * 1.2, 2)}ch`,
          borderColor: hasValue && isCurrentBlank ? '#3498db' : undefined,
          fontSize: `${2.5 * textSize}rem`,
          lineHeight: '1.5',
          fontFamily: 'inherit',
          letterSpacing: 'normal'
        }}
      />
      {showAnswerBelow && (
        <div style={{ 
          fontSize: `${0.9 * textSize}rem`, 
          color: '#28a745', 
          fontWeight: 600,
          marginTop: '2px',
          textAlign: 'center',
          lineHeight: 1.2
        }}>
          {correctAnswer || blankWord || ''}
        </div>
      )}
    </span>
  );
};

export default BlankInput;

