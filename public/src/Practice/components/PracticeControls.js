import React from 'react';

const PracticeControls = ({
  showAnswer,
  setShowAnswer,
  setShowAnswerBelow,
  showExplanation,
  handleToggleExplanation,
  isLoadingExplanation,
  handleSkip
}) => {
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'center', alignItems: 'center' }}>
      <button 
        type="button"
        onClick={() => {
          setShowAnswer(!showAnswer);
          setShowAnswerBelow(!showAnswerBelow);
        }}
        className="regenerate-button"
      >
        {showAnswer ? 'Hide Answer' : 'Show Answer'}
      </button>
      <button 
        type="button"
        onClick={handleToggleExplanation}
        className="regenerate-button"
        disabled={isLoadingExplanation}
      >
        {isLoadingExplanation ? 'Loading...' : (showExplanation ? 'Hide Explanation' : 'Explain Sentence')}
      </button>
      <button 
        onClick={handleSkip}
        className="regenerate-button"
      >
        Skip
      </button>
    </div>
  );
};

export default PracticeControls;

