import React, { useState, useEffect } from 'react';
import './App.css';
import ConversationTree from './components/ConversationTree';
import GamePanel from './components/GamePanel';
import conversationData from './conversation_tree.json';

function App() {
  const [conversationTree, setConversationTree] = useState(null);
  const [currentPath, setCurrentPath] = useState(['A']);
  const [score, setScore] = useState(0);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      // Load conversation data from JSON
      if (conversationData && conversationData.root) {
        setConversationTree(conversationData.root);
        setLoading(false);
      } else {
        setError('Invalid conversation data format');
        setLoading(false);
      }
    } catch (err) {
      console.error('Error loading conversation data:', err);
      setError('Failed to load conversation data');
      setLoading(false);
    }
  }, []);

  const addToConversation = (question, answer, isCorrect) => {
    setConversationHistory(prev => [...prev, {
      question,
      answer,
      isCorrect,
      timestamp: new Date().toLocaleTimeString()
    }]);
  };

  const updateScore = (points) => {
    setScore(prev => prev + points);
  };

  const nextQuestion = () => {
    setCurrentPath(['A']);
    setConversationHistory([]);
  };

  if (loading) {
    return (
      <div className="App">
        <div className="container">
          <div className="loading">Loading conversation tree...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="App">
        <div className="container">
          <div className="error">
            <h2>Error</h2>
            <p>{error}</p>
            <button onClick={() => window.location.reload()}>Reload Page</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <div className="container">
        <h1>Korean Conversation Tree Game</h1>
        <div className="game-container">
          <ConversationTree 
            conversationTree={conversationTree}
            currentPath={currentPath}
            setCurrentPath={setCurrentPath}
          />
          <GamePanel
            conversationTree={conversationTree}
            currentPath={currentPath}
            setCurrentPath={setCurrentPath}
            score={score}
            updateScore={updateScore}
            conversationHistory={conversationHistory}
            addToConversation={addToConversation}
            nextQuestion={nextQuestion}
          />
        </div>
      </div>
    </div>
  );
}

export default App; 