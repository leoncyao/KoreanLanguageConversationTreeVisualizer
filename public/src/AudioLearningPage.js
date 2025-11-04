import React from 'react';
import './AudioLearningPage.css';
import {
  requestWakeLock,
  releaseWakeLock,
  startKeepAlive,
  stopKeepAlive,
  updateMediaSession,
  ensureAudioContextActive,
} from './backgroundAudio';

function buildSinoNumbers(start = 0, end = 100) {
  const digit = ['영','일','이','삼','사','오','육','칠','팔','구'];
  const list = [];
  for (let n = start; n <= end; n++) {
    let ko;
    if (n === 100) {
      ko = '백';
    } else if (n < 10) {
      ko = digit[n];
    } else {
      const tens = Math.floor(n / 10);
      const ones = n % 10;
      let t = '';
      if (tens > 0) t = (tens === 1 ? '' : digit[tens]) + '십';
      ko = t + (ones > 0 ? digit[ones] : '');
      if (!ko) ko = '영';
    }
    list.push({ ko, en: String(n) });
  }
  return list;
}

function buildNativeNumbers(end = 50) {
  const units = [null,'하나','둘','셋','넷','다섯','여섯','일곱','여덟','아홉'];
  const tensWord = { 10: '열', 20: '스물', 30: '서른', 40: '마흔', 50: '쉰' };
  const list = [];
  for (let n = 0; n <= end; n++) {
    let ko;
    if (n === 0) {
      ko = '영';
    } else if (n < 10) {
      ko = units[n];
    } else if (n === 10) {
      ko = '열';
    } else if (n > 10 && n < 20) {
      ko = '열' + units[n - 10];
    } else if (n % 10 === 0) {
      ko = tensWord[n];
    } else {
      const tens = Math.floor(n / 10) * 10;
      const ones = n % 10;
      ko = tensWord[tens] + units[ones];
    }
    list.push({ ko, en: String(n) });
  }
  return list;
}

const SINO_0_100 = buildSinoNumbers(0, 100);
const NATIVE_0_50 = buildNativeNumbers(50);

const PRESETS = {
  'Days of week': [
    { ko: '월요일', en: 'Monday' },
    { ko: '화요일', en: 'Tuesday' },
    { ko: '수요일', en: 'Wednesday' },
    { ko: '목요일', en: 'Thursday' },
    { ko: '금요일', en: 'Friday' },
    { ko: '토요일', en: 'Saturday' },
    { ko: '일요일', en: 'Sunday' },
  ],
  'Counting animals (마리)': [
    { ko: '한 마리', en: 'one (animal)' },
    { ko: '두 마리', en: 'two (animals)' },
    { ko: '세 마리', en: 'three (animals)' },
    { ko: '네 마리', en: 'four (animals)' },
    { ko: '다섯 마리', en: 'five (animals)' },
  ],
  'Numbers (Sino-Korean 0-100)': SINO_0_100,
  'Numbers (Native 0-50)': NATIVE_0_50,
};

// (custom list and generator features removed)

async function speak(text, lang = 'ko-KR', rate = 0.9) {
  try {
    if (!text || window.__APP_MUTED__ === true) return Promise.resolve();
    const synth = window.speechSynthesis;
    if (!synth) return Promise.resolve();
    
    // Ensure audio context and wake lock are active BEFORE speaking
    await ensureAudioContextActive();
    await requestWakeLock();
    
    synth.cancel();
    const globalSpeed = window.__APP_SPEECH_SPEED__ || 1.0;
    
    // Update MediaSession for background playback
    updateMediaSession(text.substring(0, 50), lang === 'ko-KR' ? 'Korean' : 'English', true);
    
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.rate = rate * globalSpeed;
      u.onstart = async () => {
        // Ensure wake lock is active during playback
        await requestWakeLock();
        // Keep audio context active
        await ensureAudioContextActive();
      };
      u.onend = () => resolve();
      u.onerror = () => resolve();
      synth.speak(u);
    });
  } catch (_) {
    return Promise.resolve();
  }
}

function AudioLearningPage() {
  const [presetKey, setPresetKey] = React.useState(Object.keys(PRESETS)[0]);
  const [items, setItems] = React.useState(PRESETS[presetKey]);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const playingRef = React.useRef(false);
  const [koRate, setKoRate] = React.useState(0.9);

  React.useEffect(() => {
    setItems(PRESETS[presetKey]);
  }, [presetKey]);

  // custom list and generator removed

  const handlePlayOne = React.useCallback(async (pair) => {
    if (!pair) return;
    await speak(pair.ko, 'ko-KR', koRate);
    await speak(pair.en, 'en-US', 1.0);
  }, [koRate]);

  const handlePlayAll = React.useCallback(async () => {
    if (!items || items.length === 0) return;
    setIsPlaying(true);
    playingRef.current = true;
    // Request wake lock for background playback
    await requestWakeLock();
    // Start keep-alive to prevent audio suspension
    startKeepAlive();
    // Wire up MediaSession callbacks for background control
    updateMediaSession('Audio Learning', 'Korean Learning', true, {
      play: () => {
        // Resume playback (if paused)
        playingRef.current = true;
        setIsPlaying(true);
      },
      pause: () => {
        // Pause playback
        playingRef.current = false;
        try { const s = window.speechSynthesis; if (s) s.cancel(); } catch (_) {}
      },
      stop: () => {
        // Stop playback completely
        playingRef.current = false;
        setIsPlaying(false);
        try { const s = window.speechSynthesis; if (s) s.cancel(); } catch (_) {}
      }
    });
    try {
      for (const pair of items) {
        if (!playingRef.current) break;
        await handlePlayOne(pair);
        await new Promise(r => setTimeout(r, 250));
      }
    } finally {
      setIsPlaying(false);
      playingRef.current = false;
      updateMediaSession('Audio Learning', '', false);
      // Release wake lock when done
      await releaseWakeLock();
      // Stop keep-alive
      stopKeepAlive();
    }
  }, [items, handlePlayOne]);

  const handleStop = React.useCallback(async () => {
    playingRef.current = false;
    setIsPlaying(false);
    updateMediaSession('Audio Learning', '', false);
    try { const s = window.speechSynthesis; if (s) s.cancel(); } catch (_) {}
    // Release wake lock when stopping
    await releaseWakeLock();
    // Stop keep-alive
    stopKeepAlive();
  }, []);

  
  

  return (
    <div className="audio-page">
      <header className="audio-header">
        <h1 className="audio-title">Audio Learning</h1>
        <p className="audio-subtitle">Choose a preset or create your own list. Click play to hear Korean then English.</p>
      </header>

      <div className="audio-grid">
        <div className="audio-column">
          <div className="audio-card">
            <h2 className="audio-section-title">Presets</h2>
            <select className="audio-select" value={presetKey} onChange={(e) => setPresetKey(e.target.value)}>
              {Object.keys(PRESETS).map(k => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
            <div className="audio-actions">
              <button className="audio-btn" onClick={handlePlayAll} disabled={isPlaying || !items?.length}>Play All</button>
              <button className="audio-btn" onClick={handleStop}>Stop</button>
            </div>
            <div className="audio-actions">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Korean speed</span>
                <input type="range" min={0.6} max={1.2} step={0.05} value={koRate} onChange={(e)=>setKoRate(parseFloat(e.target.value||'0.9'))} />
                <span style={{ fontSize: 12 }}>{koRate.toFixed(2)}x</span>
              </label>
            </div>
            <div className="audio-list">
              {items && items.map((p, idx) => (
                <div key={idx} className="audio-row">
                  <div className="audio-ko">{p.ko}</div>
                  <div className="audio-en">{p.en}</div>
                  <button className="audio-mini-btn" onClick={() => handlePlayOne(p)}>Play</button>
                </div>
              ))}
              {(!items || items.length === 0) && (
                <div className="audio-empty">No items.</div>
              )}
            </div>
          </div>
        </div>

        

      </div>
    </div>
  );
}

export default AudioLearningPage;


