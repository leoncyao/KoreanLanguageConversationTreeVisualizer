import React from 'react';
import { Link } from 'react-router-dom';
import { api } from './api';
import './Navbar.css';

function Navbar() {
  const [muted, setMuted] = React.useState(() => {
    try { return localStorage.getItem('app_muted') === '1'; } catch (_) { return false; }
  });
  const [isOffline, setIsOffline] = React.useState(() => typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [backendDown, setBackendDown] = React.useState(false);
  const failuresRef = React.useRef(0);
  const [speechSpeed, setSpeechSpeed] = React.useState(() => {
    try { 
      const saved = localStorage.getItem('app_speech_speed');
      return saved ? parseFloat(saved) : 0.8;
    } catch (_) { 
      return 0.8; 
    }
  });
  const [showMoreMenu, setShowMoreMenu] = React.useState(false);

  React.useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Lightweight heartbeat to backend
  const pingBackend = React.useCallback(async () => {
    try {
      // Abort after 3 seconds
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3000);
      const res = await api.health({ signal: ctrl.signal });
      clearTimeout(t);
      if (res && res.ok) {
        failuresRef.current = 0;
        setBackendDown(false);
        return true;
      }
      throw new Error('health not ok');
    } catch (_) {
      failuresRef.current += 1;
      if (failuresRef.current >= 2) setBackendDown(true);
      return false;
    }
  }, []);

  React.useEffect(() => {
    let mounted = true;
    // initial ping after mount
    pingBackend();
    // ping every 15s
    const id = setInterval(() => {
      if (!mounted) return;
      pingBackend();
    }, 15000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [pingBackend]);

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
            <Link to="/chat" className="nav-link">Chat</Link>
          </li>
          <li className="nav-item">
            <Link to="/curriculum-practice" className="nav-link">Practice</Link>
          </li>
          <li className="nav-item">
            <Link to="/curriculum" className="nav-link">Curriculum</Link>
          </li>
          <li className="nav-item">
            <Link to="/quiz-mode" className="nav-link">Audio Learning</Link>
          </li>
          <li className="nav-item nav-item-desktop">
            <Link to="/journal" className="nav-link">Journal</Link>
          </li>
          <li className="nav-item nav-item-desktop">
            <Link to="/journal-entries" className="nav-link">Journal Entries</Link>
          </li>
          <li className="nav-item nav-item-desktop">
            <Link to="/stats" className="nav-link">Stats</Link>
          </li>
          <li className="nav-item nav-item-desktop">
            <Link to="/pronunciation" className="nav-link">Pronunciation</Link>
          </li>
          
          <li className="nav-item nav-item-dropdown">
            <button type="button" className="nav-link" onClick={() => setShowMoreMenu(!showMoreMenu)}>
              ...
            </button>
            {showMoreMenu && (
              <div className="dropdown-menu">
                <Link to="/journal" className="dropdown-item" onClick={() => setShowMoreMenu(false)}>Journal</Link>
                <Link to="/journal-entries" className="dropdown-item" onClick={() => setShowMoreMenu(false)}>Journal Entries</Link>
                <Link to="/stats" className="dropdown-item" onClick={() => setShowMoreMenu(false)}>Stats</Link>
                <Link to="/pronunciation" className="dropdown-item" onClick={() => setShowMoreMenu(false)}>Pronunciation</Link>
                <Link to="/chat" className="dropdown-item" onClick={() => setShowMoreMenu(false)}>Chat</Link>
                <Link to="/lexicon-add" className="dropdown-item" onClick={() => setShowMoreMenu(false)}>Add to Lexicon</Link>
                
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
      {isOffline && (
        <div style={{ position: 'sticky', top: 0, zIndex: 1000, background: '#fff3cd', borderBottom: '1px solid #ffeeba', color: '#856404', padding: '8px 12px', textAlign: 'center' }}>
          You are offline. Some features may not work. We’ll reconnect automatically when network is back.
        </div>
      )}
      {(!isOffline && backendDown) && (
        <div style={{ position: 'sticky', top: 0, zIndex: 999, background: '#f8d7da', borderBottom: '1px solid #f5c2c7', color: '#842029', padding: '8px 12px', textAlign: 'center', display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center' }}>
          Disconnected from server. Retrying…
          <button type="button" className="mute-button" onClick={() => pingBackend()} style={{ background: '#fff', color: '#842029', border: '1px solid #f5c2c7' }}>
            Retry now
          </button>
        </div>
      )}
      <div className="bottom-bar">
        <span className="bottom-bar-text">Korean Learning App</span>
      </div>
    </>
  );
}

export default Navbar;

