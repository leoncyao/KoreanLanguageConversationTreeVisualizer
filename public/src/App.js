import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Navbar from './Navbar/Navbar';
import HomePage from './Home/HomePage';
import TranslationPage from './Translation/TranslationPage';
import ChatPage from './Chat/ChatPage';
import StatsPage from './Stats/StatsPage';
import GrammarPage from './Grammar/GrammarPage';
import PronunciationPage from './Pronunciation/PronunciationPage';
import AudioLearningPage from './AudioLearning/AudioLearningPage';
import CurriculumPage from './Curriculum/CurriculumPage';
import PracticePage from './Practice/PracticePage';
import MixPage from './Mix/MixPage';
import ScorePage from './Score/ScorePage';
import JournalPage from './Journal/JournalPage';
import JournalArchivePage from './Journal/JournalArchivePage';
import LexiconAddPage from './LexiconAdd/LexiconAddPage';
import KpopLyricsPage from './KpopLyrics/KpopLyricsPage';
import './styles/App.css';

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
        <Route path="/audio-learning" element={<AudioLearningPage />} />
        <Route path="/curriculum" element={<CurriculumPage />} />
        <Route path="/practice" element={<PracticePage />} />
        <Route path="/mix" element={<MixPage />} />
        <Route path="/scores" element={<ScorePage />} />
        <Route path="/journal" element={<JournalPage />} />
        <Route path="/journal-entries" element={<JournalArchivePage />} />
        <Route path="/lexicon-add" element={<LexiconAddPage />} />
        <Route path="/kpop-lyrics" element={<KpopLyricsPage />} />
      </Routes>
    </Router>
  );
}

export default App;
