import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Navbar from './Navbar';
import HomePage from './HomePage';
import LearningPage from './LearningPage';
import TranslationPage from './TranslationPage';
import './App.css';

function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/learn" element={<LearningPage />} />
        <Route path="/translate" element={<TranslationPage />} />
      </Routes>
    </Router>
  );
}

export default App;
