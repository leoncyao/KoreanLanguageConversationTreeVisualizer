import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import ModelSentence from './ModelSentence';
import PhrasePractice from './PhrasePractice';
import { api } from './api';
import './HomePage.css';

function HomePage() {
  const [modelSentence, setModelSentence] = useState(null);

  // Load model sentence from database on mount
  useEffect(() => {
    const loadModelSentence = async () => {
      try {
        const response = await api.getModelSentence();
        if (response.ok) {
          const data = await response.json();
          setModelSentence(data);
        }
      } catch (err) {
        console.log('No model sentence found:', err);
      }
    };
    loadModelSentence();
  }, []);

  const handleModelUpdate = useCallback((sentence) => {
    setModelSentence(sentence);
  }, []);

  return (
    <div className="homepage">
      <ModelSentence onModelUpdate={handleModelUpdate} />
      <PhrasePractice modelSentence={modelSentence} />
    </div>
  );
}

export default HomePage;
