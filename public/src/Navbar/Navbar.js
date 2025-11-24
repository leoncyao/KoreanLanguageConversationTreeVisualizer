import React from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
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
  const isOpeningRef = React.useRef(false);
  const touchHandledRef = React.useRef(false);
  const [navExpanded, setNavExpanded] = React.useState(false);
  const [theme, setTheme] = React.useState(() => {
    try {
      const saved = localStorage.getItem('app_theme');
      if (saved) return saved;
      const prefersMobile = (typeof window !== 'undefined' && (
        (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
        /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '')
      ));
      return prefersMobile ? 'dark' : 'light';
    } catch (_) {
      return 'light';
    }
  });
  const [navOrder, setNavOrder] = React.useState(() => {
    // Default order if config not loaded
    return ['practice','mix','scores','translate','audio','journal','curriculum','grammar','kpop','stats','pronunciation','chat','journal-entries','home'];
  });
  const [lastUpdated, setLastUpdated] = React.useState('');
  // Sidebar hidden by default on all devices
  const [sidebarVisible, setSidebarVisible] = React.useState(false);
  
  // Default modes for Practice and Audio pages
  const [defaultPracticeMode, setDefaultPracticeMode] = React.useState(() => {
    try {
      const saved = localStorage.getItem('default_practice_mode');
      return saved ? parseInt(saved, 10) : 4; // 1: Curriculum, 2: Verb Practice, 3: Conversations, 4: Mix
    } catch (_) {
      return 4;
    }
  });
  const [defaultAudioMode, setDefaultAudioMode] = React.useState(() => {
    try {
      const saved = localStorage.getItem('default_audio_mode');
      return saved || 'hands-free'; // 'hands-free' or 'recording'
    } catch (_) {
      return 'hands-free';
    }
  });
  const [defaultAudioDifficulty, setDefaultAudioDifficulty] = React.useState(() => {
    try {
      const saved = localStorage.getItem('default_audio_difficulty');
      return saved ? parseInt(saved, 10) : 3; // 1, 2, or 3
    } catch (_) {
      return 3;
    }
  });
  const [practiceTextSize, setPracticeTextSize] = React.useState(() => {
    try {
      const saved = localStorage.getItem('practice_textSize');
      return saved ? parseFloat(saved) : 1.0; // Default to 1.0 (100%)
    } catch (_) {
      return 1.0;
    }
  });

  // Load optional navigation order from public/nav-order.json
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/nav-order.json', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        const arr = (data && Array.isArray(data.order)) ? data.order.filter(k => typeof k === 'string') : null;
        if (!cancelled && arr && arr.length > 0) {
          setNavOrder(arr);
        }
      } catch (_) {
        // ignore, keep defaults
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Compute "last updated" from document metadata
  React.useEffect(() => {
    try {
      const ts = typeof document !== 'undefined' ? document.lastModified : '';
      if (ts) {
        const d = new Date(ts);
        if (!isNaN(d.getTime())) {
          setLastUpdated(d.toLocaleString());
          return;
        }
      }
    } catch (_) {}
    setLastUpdated('');
  }, []);

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

  // Apply theme (default dark)
  React.useEffect(() => {
    try { localStorage.setItem('app_theme', theme); } catch (_) {}
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  React.useEffect(() => {
    if (!showMoreMenu) return;
    const handleClickOutside = (e) => {
      // Don't close if we're in the process of opening or clicking inside the dropdown
      if (isOpeningRef.current) return;
      const dropdown = e.target.closest('.nav-item-dropdown');
      if (!dropdown) {
        setShowMoreMenu(false);
      }
    };
    // Use a delay to avoid immediate closure when opening
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside, true);
      document.addEventListener('touchstart', handleClickOutside, true);
    }, 300);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('touchstart', handleClickOutside, true);
    };
  }, [showMoreMenu]);

  // Define nav items (desktop + general)
  const items = {
    home: { to: '/', label: 'Home', className: 'nav-item nav-item-desktop' },
    practice: { to: '/practice', label: 'Practice', className: 'nav-item nav-item-desktop' },
    mix: { to: '/mix', label: 'Mix', className: 'nav-item nav-item-desktop' },
    scores: { to: '/scores', label: 'Scores', className: 'nav-item nav-item-desktop' },
    translate: { to: '/translate', label: 'Translate', className: 'nav-item nav-item-desktop' },
    audio: { to: '/audio-learning', label: 'Audio Learning', className: 'nav-item' },
    journal: { to: '/journal', label: 'Journal', className: 'nav-item nav-item-desktop' },
    curriculum: { to: '/curriculum', label: 'Curriculum', className: 'nav-item nav-item-desktop' },
    kpop: { to: '/kpop-lyrics', label: 'K‑pop Lyrics', className: 'nav-item nav-item-desktop' },
    stats: { to: '/stats', label: 'Stats', className: 'nav-item nav-item-desktop' },
    pronunciation: { to: '/pronunciation', label: 'Pronunciation', className: 'nav-item nav-item-desktop' },
    grammar: { to: '/grammar', label: 'Grammar', className: 'nav-item nav-item-desktop' },
    chat: { to: '/chat', label: 'Chat', className: 'nav-item nav-item-desktop' },
    'journal-entries': { to: '/journal-entries', label: 'Journal Entries', className: 'nav-item nav-item-desktop' },
  };

  // Mobile-only quick links
  const mobileQuick = [
    { to: '/practice', label: 'Practice' },
    { to: '/translate', label: 'Translate' },
    { to: '/chat', label: 'Chat' },
  ];

  return (
    <>
      <nav className="navbar">
        <ul className={`navbar-nav${navExpanded ? ' nav-expanded' : ''}`}>
          {/* Mobile quick links in desired order */}
          {mobileQuick.map((m) => (
            <li key={`m-${m.to}`} className="nav-item nav-item-mobile">
              <Link to={m.to} className="nav-link">{m.label}</Link>
          </li>
          ))}
          {/* Ordered desktop/general links from config */}
          {navOrder.map((key) => {
            const it = items[key];
            if (!it) return null;
            return (
              <li key={key} className={it.className}>
                <Link to={it.to} className="nav-link">{it.label}</Link>
          </li>
            );
          })}
          
          <li className="nav-item nav-item-dropdown">
            <button
              type="button"
              className="nav-link"
              onClick={() => setNavExpanded(v => !v)}
              aria-expanded={navExpanded ? 'true' : 'false'}
              aria-label={navExpanded ? 'Show fewer navigation items' : 'Show all navigation items'}
            >
              {navExpanded ? 'Less' : '...'}
            </button>
          </li>
        </ul>
      </nav>
      {isOffline && (
        <div className="status-banner" style={{ position: 'sticky', top: 0, zIndex: 1000, background: '#fff3cd', borderBottom: '1px solid #ffeeba', color: '#856404', padding: '8px 12px', textAlign: 'center', marginLeft: '300px' }}>
          You are offline. Some features may not work. We'll reconnect automatically when network is back.
        </div>
      )}
      {(!isOffline && backendDown) && (
        <div className="status-banner" style={{ position: 'sticky', top: 0, zIndex: 999, background: '#f8d7da', borderBottom: '1px solid #f5c2c7', color: '#842029', padding: '8px 12px', textAlign: 'center', display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center', marginLeft: '300px' }}>
          Disconnected from server. Retrying…
          <button type="button" className="mute-button" onClick={() => pingBackend()} style={{ background: '#fff', color: '#842029', border: '1px solid #f5c2c7' }}>
            Retry now
          </button>
        </div>
      )}
      {/* Toggle button - always visible, changes icon based on state */}
      <button
        type="button"
        className="sidebar-toggle"
        onClick={() => setSidebarVisible(!sidebarVisible)}
        aria-label={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
        title={sidebarVisible ? 'Hide sidebar' : 'Show sidebar & Settings'}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          left: sidebarVisible ? '300px' : '0'
        }}
      >
        {sidebarVisible ? '×' : '☰'}
      </button>
      <div className={`bottom-bar ${sidebarVisible ? 'sidebar-visible' : 'sidebar-hidden'}`}>
        <div className="bottom-bar-inner" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'flex-start', padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start', flex: 1 }}>
              <span className="bottom-bar-text" style={{ fontWeight: 600 }}>Korean Learning App</span>
              {lastUpdated && (
                <span className="bottom-bar-text" style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                  Last updated: {lastUpdated}
                </span>
              )}
            </div>
          </div>
          
          {/* Settings Section */}
          <div style={{ width: '100%', borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 600 }}>Settings</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Theme</span>
                <button type="button" className="mute-button" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
                  {theme === 'dark' ? '🌙 Dark' : '☀️ Light'}
                </button>
              </div>
              <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Speech Speed</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={speechSpeed}
                    onChange={(e) => setSpeechSpeed(parseFloat(e.target.value))}
                    style={{ width: '100%', maxWidth: '200px', cursor: 'pointer' }}
                    title={`Speech speed: ${speechSpeed.toFixed(1)}x`}
                  />
                  <span style={{ fontSize: '0.9rem', color: '#666', minWidth: '36px', textAlign: 'right' }}>{speechSpeed.toFixed(1)}x</span>
                </div>
              </div>
              <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Audio</span>
                <button type="button" className="mute-button" onClick={() => setMuted(m => !m)}>
                  {muted ? '🔇 Unmute' : '🔊 Mute'}
                </button>
              </div>
              <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Default Practice Mode</span>
                <select 
                  value={defaultPracticeMode} 
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setDefaultPracticeMode(val);
                    try { localStorage.setItem('default_practice_mode', String(val)); } catch (_) {}
                    // Also update the current practice mode if user is on that page
                    try { localStorage.setItem('practice_mode', String(val)); } catch (_) {}
                  }}
                  style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: 4, fontSize: '0.9rem', width: '100%', maxWidth: '200px' }}
                >
                  <option value={1}>Curriculum</option>
                  <option value={2}>Verb Practice</option>
                  <option value={3}>Conversations</option>
                  <option value={4}>Mix</option>
                </select>
              </div>
              <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Default Audio Mode</span>
                <select 
                  value={defaultAudioMode} 
                  onChange={(e) => {
                    const val = e.target.value;
                    setDefaultAudioMode(val);
                    try { localStorage.setItem('default_audio_mode', val); } catch (_) {}
                    // Also update the current audio mode if user is on that page
                    try { localStorage.setItem('audio_quizMode', val); } catch (_) {}
                  }}
                  style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: 4, fontSize: '0.9rem', width: '100%', maxWidth: '200px' }}
                >
                  <option value="hands-free">Hands-Free</option>
                  <option value="recording">Recording</option>
                </select>
              </div>
              <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Default Audio Difficulty</span>
                <select 
                  value={defaultAudioDifficulty} 
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setDefaultAudioDifficulty(val);
                    try { localStorage.setItem('default_audio_difficulty', String(val)); } catch (_) {}
                    // Also update the current audio difficulty if user is on that page
                    try { localStorage.setItem('audio_quizDifficulty', String(val)); } catch (_) {}
                  }}
                  style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: 4, fontSize: '0.9rem', width: '100%', maxWidth: '200px' }}
                >
                  <option value={1}>Level 1: Single Words</option>
                  <option value={2}>Level 2: Small Sentences</option>
                  <option value={3}>Level 3: Longer Sentences</option>
                </select>
              </div>
              <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Practice Text Size</span>
                <select 
                  value={practiceTextSize} 
                  onChange={(e) => {
                    const val = parseFloat(e.target.value || '1.0');
                    setPracticeTextSize(val);
                    try { localStorage.setItem('practice_textSize', String(val)); } catch (_) {}
                    // Trigger a re-render by updating a state that PracticePage can read
                    window.dispatchEvent(new Event('practice_textSize_changed'));
                  }}
                  style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: 4, fontSize: '0.9rem', width: '100%', maxWidth: '200px' }}
                >
                  <option value={0.5}>50%</option>
                  <option value={0.6}>60%</option>
                  <option value={0.7}>70%</option>
                  <option value={0.8}>80%</option>
                  <option value={0.9}>90%</option>
                  <option value={1.0}>100%</option>
                </select>
              </div>
              <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Highlight English Words</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={(() => {
                      try {
                        const saved = localStorage.getItem('practice_highlight_english');
                        return saved !== null ? saved === 'true' : false;
                      } catch (_) {
                        return false;
                      }
                    })()}
                    onChange={(e) => {
                      const val = e.target.checked;
                      try { localStorage.setItem('practice_highlight_english', String(val)); } catch (_) {}
                      // Trigger a re-render by updating a state that PracticePage can read
                      window.dispatchEvent(new Event('practice_highlight_english_changed'));
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '0.9rem' }}>Highlight English words corresponding to blanks in red</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

    </>
  );
}

export default Navbar;

