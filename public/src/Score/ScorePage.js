import React, { useState, useEffect } from 'react';
import { api } from '../api';
import '../Home/HomePage.css';

function ScorePage() {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadScores = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await api.getMixScores(30);
        if (!res.ok) {
          throw new Error(`Failed to fetch scores: ${res.status}`);
        }
        const data = await res.json();
        setScores(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('Error loading scores:', e);
        setError(e instanceof Error ? e.message : 'Failed to load scores');
      } finally {
        setLoading(false);
      }
    };

    loadScores();
  }, []);

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch (e) {
      return dateString;
    }
  };

  const calculatePercentage = (firstTryCorrect, totalQuestions) => {
    if (!totalQuestions || totalQuestions === 0) return 0;
    return Math.round((firstTryCorrect / totalQuestions) * 100);
  };

  if (loading) {
    return (
      <div className="container">
        <h1>Mix Scores</h1>
        <p>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <h1>Mix Scores</h1>
        <div style={{ padding: 12, background: '#ffebee', color: '#c62828', borderRadius: 4 }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Mix Scores</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>
        Your daily mix practice scores. Shows how many questions you answered correctly on the first try (without using "Show Answer").
      </p>

      {scores.length === 0 ? (
        <div className="sentence-box" style={{ textAlign: 'center', padding: 24 }}>
          <p style={{ color: '#666', margin: 0 }}>No scores yet. Complete a mix in Practice mode to see your scores here.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {scores.map((score, index) => {
            const percentage = calculatePercentage(score.first_try_correct, score.total_questions);
            return (
              <div 
                key={score.id || index}
                className="sentence-box"
                style={{ 
                  padding: 16,
                  border: '1px solid #dee2e6',
                  borderRadius: 8,
                  background: index === 0 ? '#f8f9fa' : '#fff'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 18, color: '#333' }}>
                    {formatDate(score.score_date)}
                  </h3>
                  {index === 0 && (
                    <span style={{ 
                      fontSize: 12, 
                      color: '#4caf50', 
                      fontWeight: 600,
                      background: '#e8f5e9',
                      padding: '4px 8px',
                      borderRadius: 4
                    }}>
                      Latest
                    </span>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Total Questions</div>
                    <div style={{ fontSize: 24, fontWeight: 600, color: '#333' }}>
                      {score.total_questions || 0}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>First Try Correct</div>
                    <div style={{ fontSize: 24, fontWeight: 600, color: '#4caf50' }}>
                      {score.first_try_correct || 0}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Accuracy</div>
                    <div style={{ fontSize: 24, fontWeight: 600, color: '#2196f3' }}>
                      {percentage}%
                    </div>
                  </div>
                </div>
                {score.completed_at && (
                  <div style={{ fontSize: 11, color: '#999', marginTop: 8 }}>
                    Completed: {new Date(score.completed_at).toLocaleString()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ScorePage;

