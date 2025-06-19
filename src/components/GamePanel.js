import React, { useState, useEffect } from 'react';
import './GamePanel.css';

const GamePanel = ({ 
  conversationTree, 
  currentPath, 
  setCurrentPath, 
  score, 
  updateScore, 
  conversationHistory, 
  addToConversation, 
  nextQuestion 
}) => {
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState('');
  const [currentNode, setCurrentNode] = useState(null);
  const [showHints, setShowHints] = useState(false);
  const [possibleResponses, setPossibleResponses] = useState([]);
  const [prompt, setPrompt] = useState('');

  useEffect(() => {
    if (conversationTree) {
      showQuestion();
    }
  }, [conversationTree, currentPath]);

  const findNodeById = (node, id) => {
    if (!node) return null;
    if (node.id === id) return node;
    if (node.responses) {
      for (const response of node.responses) {
        const found = findNodeById(response, id);
        if (found) return found;
      }
    }
    return null;
  };

  // Helper to get the prompt (Korean with blank)
  const getPrompt = (node) => {
    if (!node) return '';
    // Always use the text up to <br>
    return node.text.split('<br>')[0];
  };

  // Helper to get the full expected answer for a node
  const getFullAnswer = (node) => {
    if (!node) return '';
    if (node.type === 'fill_blank') {
      // Replace ___ in text with the answer
      const [before, after] = node.text.split('___');
      return (before || '') + node.answer + (after || '').split('<br>')[0];
    }
    // For response/question types, just use the text up to <br>
    return node.text.split('<br>')[0];
  };

  const showQuestion = () => {
    if (!conversationTree || !currentPath.length) {
      setPrompt("Loading...");
      setPossibleResponses([]);
      setCurrentNode(null);
      return;
    }

    const lastNode = currentPath[currentPath.length - 1];
    const lastNodeData = findNodeById(conversationTree, lastNode);
    
    if (lastNodeData && lastNodeData.responses && lastNodeData.responses.length > 0) {
      setPossibleResponses(lastNodeData.responses);
      setCurrentNode(lastNodeData);
      // Show the prompt for the next node (the Korean with blank)
      setPrompt(getPrompt(lastNodeData.responses[0]));
    } else {
      setPrompt("Conversation complete! Start a new path.");
      setPossibleResponses([]);
      setCurrentNode(null);
    }
    
    setUserAnswer('');
    setFeedback('');
    setFeedbackType('');
    setShowHints(false);
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      checkAnswer();
    }
  };

  const checkAnswer = () => {
    if (!conversationTree || !currentPath.length || !possibleResponses.length) return;

    // Try to match the user's answer to any possible next response (full sentence)
    let matchedNode = null;
    for (const resp of possibleResponses) {
      const fullAnswer = getFullAnswer(resp).replace(/<[^>]+>/g, '').trim();
      if (userAnswer.trim() === fullAnswer) {
        matchedNode = resp;
        break;
      }
    }

    if (matchedNode) {
      updateScore(10);
      setFeedback('Correct! 🎉');
      setFeedbackType('correct');
      addToConversation(getPrompt(matchedNode), userAnswer, true);
      setCurrentPath(prev => [...prev, matchedNode.id]);
    } else {
      // Show all possible correct answers as feedback
      const allAnswers = possibleResponses.map(getFullAnswer).join(' | ');
      setFeedback(`Incorrect. Possible answers: ${allAnswers}`);
      setFeedbackType('incorrect');
      addToConversation('Expected: ' + allAnswers, userAnswer, false);
    }
  };

  const selectHint = (hint) => {
    setUserAnswer(hint);
  };

  const goBack = () => {
    if (currentPath.length > 1) {
      setCurrentPath(prev => prev.slice(0, -1));
    }
  };

  const goToStart = () => {
    setCurrentPath(['A']);
    setConversationHistory([]);
  };

  const toggleHints = () => {
    setShowHints(!showHints);
  };

  const renderHints = () => {
    if (!possibleResponses.length) return null;
    return (
      <div className="hints-section">
        <button 
          className="hint-toggle" 
          onClick={toggleHints}
        >
          {showHints ? 'Hide Hints' : 'Show Hints'}
        </button>
        {showHints && (
          <div className="hint-buttons">
            <p className="hint-label">Possible next responses:</p>
            {possibleResponses.map((resp, idx) => {
              // Show the full sentence with the blank filled in
              const fullAnswer = getFullAnswer(resp).replace(/<[^>]+>/g, '');
              return (
                <button
                  key={resp.id || idx}
                  className="hint-button"
                  onClick={() => selectHint(fullAnswer)}
                >
                  {fullAnswer}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderNavigation = () => {
    return (
      <div className="navigation-controls">
        <button 
          className="nav-button back-button" 
          onClick={goBack}
          disabled={currentPath.length <= 1}
        >
          ← Go Back
        </button>
        <button 
          className="nav-button start-button" 
          onClick={goToStart}
        >
          🏠 Start Over
        </button>
      </div>
    );
  };

  if (!conversationTree) {
    return (
      <div className="game-panel">
        <div className="loading">Loading game...</div>
      </div>
    );
  }

  return (
    <div className="game-panel">
      {renderNavigation()}
      
      <div className="conversation-flow">
        <h3>Your Conversation:</h3>
        <div className="conversation-history">
          {conversationHistory.map((entry, index) => (
            <div key={index} className="conversation-line">
              <div className="conversation-bubble question-bubble">
                {entry.question}<br />
              </div>
              <div className={`conversation-bubble answer-bubble ${entry.isCorrect ? 'correct' : 'incorrect'}`}>
                {entry.answer}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="score">Score: {score}</div>
      
      <div className="current-dialogue">
        <h3>Current Dialogue:</h3>
        <p>{prompt}</p>
      </div>
      
      {renderHints()}
      
      <div className="input-group">
        <label htmlFor="answer">Type the full Korean sentence with the blank filled in:</label>
        <input
          type="text"
          id="answer"
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type here..."
        />
      </div>
      
      <button onClick={checkAnswer}>Submit</button>
      <button onClick={nextQuestion}>Next Question</button>
      
      {feedback && (
        <div className={`feedback ${feedbackType}`}>
          {feedback}
        </div>
      )}
    </div>
  );
};

export default GamePanel; 