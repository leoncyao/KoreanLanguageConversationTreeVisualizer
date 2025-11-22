import React, { useCallback } from 'react';
import './styles/PronunciationPage.css';

const CONSONANTS = [
  { ch: 'ㄱ', name: 'g/k', sample: '가' },
  { ch: 'ㄴ', name: 'n', sample: '나' },
  { ch: 'ㄷ', name: 'd/t', sample: '다' },
  { ch: 'ㄹ', name: 'r/l', sample: '라' },
  { ch: 'ㅁ', name: 'm', sample: '마' },
  { ch: 'ㅂ', name: 'b/p (final: [p])', sample: '바' },
  { ch: 'ㅅ', name: 's (before ㅣ: “sh”)', sample: '사' },
  { ch: 'ㅇ', name: '(ng)', sample: '아' },
  { ch: 'ㅈ', name: 'j', sample: '자' },
  { ch: 'ㅊ', name: 'ch', sample: '차' },
  { ch: 'ㅋ', name: 'k', sample: '카' },
  { ch: 'ㅌ', name: 't', sample: '타' },
  { ch: 'ㅍ', name: 'p', sample: '파' },
  { ch: 'ㅎ', name: 'h', sample: '하' }
];

const VOWELS_SIMPLE = [
  { ch: 'ㅏ', name: 'a', sample: '아' },
  { ch: 'ㅑ', name: 'ya', sample: '야' },
  { ch: 'ㅓ', name: 'eo', sample: '어' },
  { ch: 'ㅕ', name: 'yeo', sample: '여' },
  { ch: 'ㅗ', name: 'o', sample: '오' },
  { ch: 'ㅛ', name: 'yo', sample: '요' },
  { ch: 'ㅜ', name: 'u', sample: '우' },
  { ch: 'ㅠ', name: 'yu', sample: '유' },
  { ch: 'ㅡ', name: 'eu', sample: '으' },
  { ch: 'ㅣ', name: 'i', sample: '이' }
];

const VOWELS_COMBINED = [
  { ch: 'ㅐ', name: 'ae', sample: '애' },
  { ch: 'ㅒ', name: 'yae', sample: '얘' },
  { ch: 'ㅔ', name: 'e', sample: '에' },
  { ch: 'ㅖ', name: 'ye', sample: '예' },
  { ch: 'ㅘ', name: 'wa', sample: '와' },
  { ch: 'ㅙ', name: 'wae', sample: '왜' },
  { ch: 'ㅚ', name: 'oe', sample: '외' },
  { ch: 'ㅝ', name: 'wo', sample: '워' },
  { ch: 'ㅞ', name: 'we', sample: '웨' },
  { ch: 'ㅟ', name: 'wi', sample: '위' },
  { ch: 'ㅢ', name: 'ui', sample: '의' }
];

function Cell({ ch, name, sample }) {
  const speak = useCallback(() => {
    try {
      if (window.__APP_MUTED__ === true) return;
      const synth = window.speechSynthesis;
      if (!synth) return;
      const globalSpeed = window.__APP_SPEECH_SPEED__ || 1.0;
      const u = new SpeechSynthesisUtterance(sample || ch);
      u.lang = 'ko-KR';
      u.rate = 0.85 * globalSpeed;
      synth.cancel();
      synth.speak(u);
    } catch (_) {}
  }, [ch, sample]);

  return (
    <button className="pron-cell" type="button" onClick={speak} title={`Sample: ${sample || ch}`}>
      <div className="pron-ch">{ch}</div>
      <div className="pron-name">{name}</div>
    </button>
  );
}

function Section({ title, items }) {
  return (
    <div className="pron-section">
      <h2 className="pron-section-title">{title}</h2>
      <div className="pron-grid">
        {items.map((it) => (
          <Cell key={it.ch} ch={it.ch} name={it.name} sample={it.sample} />
        ))}
      </div>
    </div>
  );
}

function SpeakButton({ text, label }) {
  const onClick = React.useCallback(() => {
    try {
      if (!text) return;
      if (window.__APP_MUTED__ === true) return;
      const synth = window.speechSynthesis;
      if (!synth) return;
      const globalSpeed = window.__APP_SPEECH_SPEED__ || 1.0;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ko-KR';
      u.rate = 0.9 * globalSpeed;
      synth.cancel();
      synth.speak(u);
    } catch (_) {}
  }, [text]);
  return (
    <button type="button" className="pron-ex-btn" onClick={onClick} title={text}>
      {label || text}
    </button>
  );
}

const BATCHIM_RULES = [
  { ch: 'ㄱ', onset: 'g/k', coda: 'final [k̚]', onsetEx: '가방', codaEx: '책' },
  { ch: 'ㄲ', onset: 'tense g (kk)', coda: 'final [k̚]', onsetEx: '까치', codaEx: '밖' },
  { ch: 'ㅋ', onset: 'k', coda: 'final [k̚]', onsetEx: '코', codaEx: '부엌' },
  { ch: 'ㄴ', onset: 'n', coda: 'final [n]', onsetEx: '나무', codaEx: '산' },
  { ch: 'ㄷ', onset: 'd/t', coda: 'final [t̚]', onsetEx: '다리', codaEx: '곧' },
  { ch: 'ㄸ', onset: 'tense d (tt)', coda: '— (not used in final)', onsetEx: '떡' },
  { ch: 'ㅌ', onset: 't', coda: 'final [t̚]', onsetEx: '토마토', codaEx: '뱉' },
  { ch: 'ㄹ', onset: 'r/l', coda: 'final [l]', onsetEx: '라면', codaEx: '별' },
  { ch: 'ㅁ', onset: 'm', coda: 'final [m]', onsetEx: '마음', codaEx: '밤' },
  { ch: 'ㅂ', onset: 'b/p', coda: 'final [p̚]', onsetEx: '바다', codaEx: '밥' },
  { ch: 'ㅃ', onset: 'tense b (pp)', coda: '— (not used in final)', onsetEx: '빵' },
  { ch: 'ㅍ', onset: 'p', coda: 'final [p̚]', onsetEx: '피자', codaEx: '앞' },
  { ch: 'ㅅ', onset: 's ("sh" before ㅣ/ㅑ/ㅕ/ㅠ/ㅛ)', coda: 'final [t̚]', onsetEx: '사과', codaEx: '옷' },
  { ch: 'ㅆ', onset: 'tense s (ss)', coda: 'final [t̚]', onsetEx: '쓰다', codaEx: '있다' },
  { ch: 'ㅈ', onset: 'j', coda: 'final [t̚]', onsetEx: '자전거', codaEx: '낮' },
  { ch: 'ㅉ', onset: 'tense j (jj)', coda: '— (not used in final)', onsetEx: '짜다' },
  { ch: 'ㅊ', onset: 'ch', coda: 'final [t̚]', onsetEx: '차', codaEx: '꽃' },
  { ch: 'ㅇ', onset: 'silent (onset) / ng', coda: 'final [ŋ]', onsetEx: '아이', codaEx: '방' },
  { ch: 'ㅎ', onset: 'h', coda: 'final [t̚] (often breathy/assimilated)', onsetEx: '하나', codaEx: '좋다' }
];

function BatchimTable() {
  return (
    <div className="pron-section">
      <h2 className="pron-section-title">Final vs Initial (Batchim) Pronunciation</h2>
      <div className="pron-table-wrapper">
        <table className="pron-table">
          <thead>
            <tr>
              <th>Hangul</th>
              <th>Initial (Onset)</th>
              <th>Final (Batchim)</th>
            </tr>
          </thead>
          <tbody>
            {BATCHIM_RULES.map((r) => (
              <tr key={r.ch}>
                <td className="korean-cell">{r.ch}</td>
                <td>
                  {r.onset}
                  {r.onsetEx && <SpeakButton text={r.onsetEx} />}
                </td>
                <td>
                  {r.coda}
                  {r.codaEx && <SpeakButton text={r.codaEx} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pron-notes" style={{ marginTop: 8 }}>
        <div className="pron-note">
          <div className="pron-note-title">ㅆ in final position</div>
          <ul className="pron-note-list">
            <li>As batchim, ㅆ is an unreleased t-like sound [t̚], not "nn".</li>
            <li>Examples: 있다 → [it-ta], 없어 → [eop-sseo]</li>
          </ul>
        </div>
        <div className="pron-note">
          <div className="pron-note-title">Seven final base sounds</div>
          <ul className="pron-note-list">
            <li>Finals reduce to: [k̚, n, t̚, l, m, p̚, ŋ]. Many jamo map to these.</li>
            <li>Context rules (liaison, assimilation) can further change sounds across syllables.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function PronunciationPage() {
  return (
    <div className="pron-page">
      <header className="pron-header">
        <h1 className="pron-title">Korean Pronunciation</h1>
        <p className="pron-subtitle">Click any character to hear a sample syllable. Uses your browser voice (ko-KR).</p>
      </header>

      <Section title="Consonants (자음)" items={CONSONANTS} />
      <Section title="Vowels (모음)" items={VOWELS_SIMPLE} />
      <Section title="Combined Vowels (이중 모음)" items={VOWELS_COMBINED} />

      <div className="pron-section">
        <h2 className="pron-section-title">Pronunciation Notes</h2>
        <div className="pron-notes">
          <div className="pron-note">
            <div className="pron-note-title">ㅅ / ㅆ</div>
            <ul className="pron-note-list">
              <li>Before ㅣ/ㅕ/ㅑ/ㅠ/ㅛ (y/“ee” sounds), ㅅ is heard like “sh”.</li>
              <li>At syllable-final (받침), ㅅ and ㅆ are realized as a plain unreleased [t].</li>
              <li>ㅆ is a tenser “ss” sound before vowels; final still [t].</li>
            </ul>
          </div>
          <div className="pron-note">
            <div className="pron-note-title">ㅂ</div>
            <ul className="pron-note-list">
              <li>Before vowels, ㅂ is between English “b” and “p”.</li>
              <li>At syllable-final (받침), ㅂ is realized as an unreleased [p].</li>
              <li>Before ㅁ/ㄴ, ㅂ often nasalizes to [m] (assimilation).</li>
            </ul>
          </div>
        </div>
      </div>

      <BatchimTable />
    </div>
  );
}

export default PronunciationPage;


