import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Navbar from './Navbar';
import HomePage from './HomePage';
import TranslationPage from './TranslationPage';
import StatsPage from './StatsPage';
import GrammarPage from './GrammarPage';
import PronunciationPage from './PronunciationPage';
import AudioLearningPage from './AudioLearningPage';
import LearningModesPage from './LearningModesPage';
import CurriculumPage from './CurriculumPage';
import CurriculumPracticePage from './CurriculumPracticePage';
import './App.css';

function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/translate" element={<TranslationPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/grammar" element={<GrammarPage />} />
        <Route path="/pronunciation" element={<PronunciationPage />} />
        <Route path="/audio" element={<AudioLearningPage />} />
        <Route path="/quiz-mode" element={<LearningModesPage />} />
        <Route path="/curriculum" element={<CurriculumPage />} />
        <Route path="/curriculum-practice" element={<CurriculumPracticePage />} />
      </Routes>
    </Router>
  );
}

export default App;
