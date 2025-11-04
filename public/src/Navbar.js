import React from 'react';
import { Link } from 'react-router-dom';
import './Navbar.css';

function Navbar() {
  const [muted, setMuted] = React.useState(() => {
    try { return localStorage.getItem('app_muted') === '1'; } catch (_) { return false; }
  });
  const [speechSpeed, setSpeechSpeed] = React.useState(() => {
    try { 
      const saved = localStorage.getItem('app_speech_speed');
      return saved ? parseFloat(saved) : 1.0;
    } catch (_) { 
      return 1.0; 
    }
  });
  const [showMoreMenu, setShowMoreMenu] = React.useState(false);

  React.useEffect(() => {
    try { localStorage.setItem('app_muted', muted ? '1' : '0'); } catch (_) {}
    window.__APP_MUTED__ = muted === true;
  }, [muted]);

  React.useEffect(() => {
    try { localStorage.setItem('app_speech_speed', String(speechSpeed)); } catch (_) {}
    window.__APP_SPEECH_SPEED__ = speechSpeed;
  }, [speechSpeed]);

  React.useEffect(() => {
    if (!showMoreMenu) return;
    const handleClickOutside = (e) => {
      if (!e.target.closest('.nav-item-dropdown')) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMoreMenu]);

  return (
    <>
      <nav className="navbar">
        <ul className="navbar-nav">
          <li className="nav-item">
            <Link to="/" className="nav-link">Home</Link>
          </li>
          <li className="nav-item">
            <Link to="/translate" className="nav-link">Translate</Link>
          </li>
          <li className="nav-item">
            <Link to="/curriculum-practice" className="nav-link">Practice</Link>
          </li>
          <li className="nav-item">
            <Link to="/curriculum" className="nav-link">Curriculum</Link>
          </li>
          <li className="nav-item">
            <Link to="/quiz-mode" className="nav-link">Quiz Mode</Link>
          </li>
          <li className="nav-item nav-item-desktop">
            <Link to="/stats" className="nav-link">Stats</Link>
          </li>
          <li className="nav-item nav-item-desktop">
            <Link to="/pronunciation" className="nav-link">Pronunciation</Link>
          </li>
          <li className="nav-item nav-item-desktop">
            <Link to="/audio" className="nav-link">Audio</Link>
          </li>
          <li className="nav-item nav-item-dropdown">
            <button type="button" className="nav-link" onClick={() => setShowMoreMenu(!showMoreMenu)}>
              ...
            </button>
            {showMoreMenu && (
              <div className="dropdown-menu">
                <Link to="/stats" className="dropdown-item" onClick={() => setShowMoreMenu(false)}>Stats</Link>
                <Link to="/pronunciation" className="dropdown-item" onClick={() => setShowMoreMenu(false)}>Pronunciation</Link>
                <Link to="/audio" className="dropdown-item" onClick={() => setShowMoreMenu(false)}>Audio</Link>
              </div>
            )}
          </li>
        </ul>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', border: '1px solid #ddd', borderRadius: '5px', background: 'white' }}>
            <span style={{ fontSize: '0.75rem', color: '#666', whiteSpace: 'nowrap' }}>Speed:</span>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={speechSpeed}
              onChange={(e) => setSpeechSpeed(parseFloat(e.target.value))}
              style={{ width: '80px', cursor: 'pointer' }}
              title={`Speech speed: ${speechSpeed.toFixed(1)}x`}
            />
            <span style={{ fontSize: '0.75rem', color: '#666', minWidth: '32px', textAlign: 'right' }}>{speechSpeed.toFixed(1)}x</span>
          </div>
          <button type="button" className="mute-button" onClick={() => setMuted(m => !m)}>
            {muted ? '🔇 Unmute' : '🔊 Mute'}
          </button>
        </div>
      </nav>
      <div className="bottom-bar">
        <span className="bottom-bar-text">Korean Learning App</span>
      </div>
    </>
  );
}

export default Navbar;

