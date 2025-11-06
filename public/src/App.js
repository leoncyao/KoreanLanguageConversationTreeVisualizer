import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Navbar from './Navbar';
import HomePage from './HomePage';
import TranslationPage from './TranslationPage';
import ChatPage from './ChatPage';
import StatsPage from './StatsPage';
import GrammarPage from './GrammarPage';
import PronunciationPage from './PronunciationPage';
import LearningModesPage from './LearningModesPage';
import CurriculumPage from './CurriculumPage';
import CurriculumPracticePage from './CurriculumPracticePage';
import JournalPage from './JournalPage';
import JournalArchivePage from './JournalArchivePage';
import LexiconAddPage from './LexiconAddPage';
import './App.css';

function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/translate" element={<TranslationPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/grammar" element={<GrammarPage />} />
        <Route path="/pronunciation" element={<PronunciationPage />} />
        <Route path="/quiz-mode" element={<LearningModesPage />} />
        <Route path="/curriculum" element={<CurriculumPage />} />
        <Route path="/curriculum-practice" element={<CurriculumPracticePage />} />
        <Route path="/journal" element={<JournalPage />} />
        <Route path="/journal-entries" element={<JournalArchivePage />} />
        <Route path="/lexicon-add" element={<LexiconAddPage />} />
      </Routes>
    </Router>
  );
}

export default App;
