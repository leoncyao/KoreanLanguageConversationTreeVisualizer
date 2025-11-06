import React, { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import './StatsPage.css';

const WORD_TYPES = ['noun', 'proper-noun', 'verb', 'adjective', 'adverb', 'pronoun', 'conjunction', 'particle'];
const TABS = [
  { key: 'all', label: 'All' },
  { key: 'noun', label: 'Noun' },
  { key: 'proper-noun', label: 'Proper Noun' },
  { key: 'verb', label: 'Verb' },
  { key: 'adjective', label: 'Adjective' },
  { key: 'adverb', label: 'Adverb' },
  { key: 'pronoun', label: 'Pronoun' },
  { key: 'conjunction', label: 'Conjunction' },
  { key: 'particle', label: 'Particle' }
];

function StatsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [wordsByType, setWordsByType] = useState({});
  const [activeTab, setActiveTab] = useState('all');
  const [sortField, setSortField] = useState('date'); // 'correct' | 'seen' | 'date'
  const [tagFilter, setTagFilter] = useState('all'); // 'all' | 'favorite' | 'learning' | 'learned'
  const [saving, setSaving] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const updateTagLocal = (type, korean, next) => {
    setWordsByType((prev) => {
      const clone = { ...prev };
      const list = (clone[type] || []).map((w) => {
        if ((type === 'verb' ? (w.base_form || w.korean) : w.korean) === korean) {
          return { ...w, ...next };
        }
        return w;
      });
      clone[type] = list;
      return clone;
    });
  };

  const handleToggleTag = async (type, korean, field, value) => {
    try {
      setSaving(true);
      updateTagLocal(type, korean, { [field]: value });
      await api.updateWordTags(type, korean, { [field]: value });
    } catch (e) {
      // Revert on error: refetch minimal for that type
      try {
        const res = await api.getWordsByType(type, 200);
        const data = await res.json();
        setWordsByType((prev) => ({ ...prev, [type]: Array.isArray(data) ? data : [] }));
      } catch (_) {}
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const wordRes = await Promise.all(WORD_TYPES.map((t) => api.getWordsByType(t, 200)));
        const wordsJson = await Promise.all(wordRes.map((r) => r.json()))

        if (!isMounted) return;

        const byType = {};
        WORD_TYPES.forEach((t, idx) => {
          const list = Array.isArray(wordsJson[idx]) ? wordsJson[idx] : [];
          byType[t] = list.slice();
        });
        setWordsByType(byType);
      } catch (e) {
        setError(String(e && e.message || e));
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (!showMoreMenu) return;
    const handleClickOutside = (e) => {
      if (!e.target.closest('.stats-dropdown')) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMoreMenu]);

  const passesTag = (w) => {
    if (tagFilter === 'favorite') return !!w.is_favorite;
    if (tagFilter === 'learning') return !!w.is_learning;
    if (tagFilter === 'learned') return !!w.is_learned;
    return true;
  };

  const sortCompare = (a, b) => {
    if (sortField === 'date') {
      const ad = Date.parse(a.created_at || a.createdAt || 0);
      const bd = Date.parse(b.created_at || b.createdAt || 0);
      return (bd || 0) - (ad || 0);
    }
    if (sortField === 'seen') {
      const diff = (b.times_seen || 0) - (a.times_seen || 0);
      if (diff !== 0) return diff;
      return (b.times_correct || 0) - (a.times_correct || 0);
    }
    // default 'correct'
    const diff = (b.times_correct || 0) - (a.times_correct || 0);
    if (diff !== 0) return diff;
    return (b.times_seen || 0) - (a.times_seen || 0);
  };

  const topOverall = useMemo(() => {
    const all = WORD_TYPES.flatMap((t) => (wordsByType[t] || []).map((w) => ({ ...w, __type: t })));
    return all.filter(passesTag).sort(sortCompare).slice(0, 25);
  }, [wordsByType, sortField, tagFilter]);

  const renderTypeTable = (typeKey) => {
    // proper-noun uses the same columns as most types
    const list = (wordsByType[typeKey] || []).filter(passesTag).sort(sortCompare).slice(0, 25);
    const title = typeKey.charAt(0).toUpperCase() + typeKey.slice(1);
    // Specialized table for verbs: include present/past/future forms
    if (typeKey === 'verb') {
      return (
        <div className="stats-section">
          <h2 className="section-title">{title}</h2>
          <div className="table-card verb-table-wrapper">
            <table className="stats-table verb-table">
              <thead>
                <tr>
                  <th>Base</th>
                  <th>English</th>
                  <th className="verb-conjugation-header">Present</th>
                  <th className="verb-conjugation-header">Past</th>
                  <th className="verb-conjugation-header">Future</th>
                  <th>Fav</th>
                  <th>Learning</th>
                  <th>Learned</th>
                  <th>Correct</th>
                  <th>First Try</th>
                  <th>Seen</th>
                </tr>
              </thead>
              <tbody>
                {list.map((w, idx) => {
                  const base = w.base_form || w.korean || '';
                  const present = w.present_informal || w.present_formal || w.present_honorific || '-';
                  const past = w.past_informal || w.past_formal || w.past_honorific || '-';
                  const future = w.future_informal || w.future_formal || w.future_honorific || '-';
                  const rowKey = `${typeKey}-${base}-${idx}`;
                  return (
                    <tr key={rowKey}>
                      <td className="korean-cell">{base}</td>
                      <td>{w.english}</td>
                      <td className="verb-conjugation-cell">{present}</td>
                      <td className="verb-conjugation-cell">{past}</td>
                      <td className="verb-conjugation-cell">{future}</td>
                      <td><input type="checkbox" checked={!!w.is_favorite} onChange={(e) => handleToggleTag('verb', base, 'is_favorite', e.target.checked)} /></td>
                      <td><input type="checkbox" checked={!!w.is_learning} onChange={(e) => handleToggleTag('verb', base, 'is_learning', e.target.checked)} /></td>
                      <td><input type="checkbox" checked={!!w.is_learned} onChange={(e) => handleToggleTag('verb', base, 'is_learned', e.target.checked)} /></td>
                      <td className="metric">{w.times_correct || 0}</td>
                      <td className="metric">{w.first_try_correct || 0}</td>
                      <td className="metric">{w.times_seen || 0}</td>
                    </tr>
                  );
                })}
                {list.length === 0 && (
                  <tr><td colSpan="10" className="empty">No {title.toLowerCase()}s yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    }
    return (
      <div className="stats-section">
        <h2 className="section-title">{title}</h2>
        <div className="table-card">
          <table className="stats-table">
            <thead>
              <tr>
                <th>Korean</th>
                <th>English</th>
                <th>Fav</th>
                <th>Learning</th>
                <th>Learned</th>
                <th>Correct</th>
                <th>First Try</th>
                <th>Seen</th>
              </tr>
            </thead>
            <tbody>
              {list.map((w, idx) => {
                const koreanValue = typeKey === 'verb' ? (w.base_form || w.korean || '') : (w.korean || '');
                const rowKey = `${typeKey}-${koreanValue}-${idx}`;
                return (
                  <tr key={rowKey}>
                    <td className="korean-cell">{koreanValue}</td>
                    <td>{w.english}</td>
                    <td><input type="checkbox" checked={!!w.is_favorite} onChange={(e) => handleToggleTag(typeKey, koreanValue, 'is_favorite', e.target.checked)} /></td>
                    <td><input type="checkbox" checked={!!w.is_learning} onChange={(e) => handleToggleTag(typeKey, koreanValue, 'is_learning', e.target.checked)} /></td>
                    <td><input type="checkbox" checked={!!w.is_learned} onChange={(e) => handleToggleTag(typeKey, koreanValue, 'is_learned', e.target.checked)} /></td>
                    <td className="metric">{w.times_correct || 0}</td>
                    <td className="metric">{w.first_try_correct || 0}</td>
                    <td className="metric">{w.times_seen || 0}</td>
                  </tr>
                );
              })}
              {list.length === 0 && (
                <tr><td colSpan="7" className="empty">No {title.toLowerCase()}s yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="stats-page"><div className="stats-card">Loading stats…</div></div>;
  }

  if (error) {
    return <div className="stats-page"><div className="stats-card error">{error}</div></div>;
  }

  return (
    <div className="stats-page">
      <div className="stats-header">
        <h1 className="stats-title">Word Statistics</h1>
        <p className="stats-subtitle">Tracking how often you correctly fill words in Phrase Practice.</p>
      </div>



      <div className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`tab${activeTab === tab.key ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
        <div className="stats-filters-desktop">
          <label className="en" style={{ color: '#6b7280' }}>Sort</label>
          <select value={sortField} onChange={(e) => setSortField(e.target.value)}>
            <option value="correct">Correct</option>
            <option value="seen">Seen</option>
            <option value="date">Date Added</option>
          </select>
          <label className="en" style={{ color: '#6b7280' }}>Tag</label>
          <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="favorite">Favorites</option>
            <option value="learning">Learning</option>
            <option value="learned">Learned</option>
          </select>
        </div>
        <div className="stats-dropdown" style={{ position: 'relative' }}>
          <button 
            type="button" 
            className="tab stats-more-menu" 
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            style={{ minWidth: '40px' }}
          >
            ...
          </button>
          {showMoreMenu && (
            <div className="dropdown-menu" style={{ position: 'absolute', top: '100%', right: 0, zIndex: 1000 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label className="en" style={{ color: '#6b7280', padding: '8px 12px', fontSize: '12px' }}>Sort</label>
                <select 
                  value={sortField} 
                  onChange={(e) => setSortField(e.target.value)}
                  style={{ margin: '0 12px 8px 12px', padding: '4px 8px', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                  <option value="correct">Correct</option>
                  <option value="seen">Seen</option>
                  <option value="date">Date Added</option>
                </select>
                <label className="en" style={{ color: '#6b7280', padding: '8px 12px', fontSize: '12px' }}>Tag</label>
                <select 
                  value={tagFilter} 
                  onChange={(e) => setTagFilter(e.target.value)}
                  style={{ margin: '0 12px 8px 12px', padding: '4px 8px', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                  <option value="all">All</option>
                  <option value="favorite">Favorites</option>
                  <option value="learning">Learning</option>
                  <option value="learned">Learned</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {activeTab === 'all' ? (
        <>
          <div className="stats-section">
            <h2 className="section-title">Top Correct Words (All)</h2>
            <div className="table-card">
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Korean</th>
                    <th>English</th>
                    <th>Fav</th>
                    <th>Learning</th>
                    <th>Learned</th>
                    <th>Correct</th>
                    <th>First Try</th>
                    <th>Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {topOverall.map((w, idx) => {
                    const koreanValue = w.__type === 'verb' ? (w.base_form || w.korean || '') : (w.korean || '');
                    const rowKey = `${w.__type}-${koreanValue}-${idx}`;
                    return (
                      <tr key={rowKey}>
                        <td>{w.__type}</td>
                        <td className="korean-cell">{koreanValue}</td>
                        <td>{w.english}</td>
                        <td><input type="checkbox" checked={!!w.is_favorite} onChange={(e) => handleToggleTag(w.__type, koreanValue, 'is_favorite', e.target.checked)} /></td>
                        <td><input type="checkbox" checked={!!w.is_learning} onChange={(e) => handleToggleTag(w.__type, koreanValue, 'is_learning', e.target.checked)} /></td>
                        <td><input type="checkbox" checked={!!w.is_learned} onChange={(e) => handleToggleTag(w.__type, koreanValue, 'is_learned', e.target.checked)} /></td>
                        <td className="metric">{w.times_correct || 0}</td>
                        <td className="metric">{w.first_try_correct || 0}</td>
                        <td className="metric">{w.times_seen || 0}</td>
                      </tr>
                    );
                  })}
                  {topOverall.length === 0 && (
                    <tr><td colSpan="8" className="empty">No words yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {['noun','verb','adjective','adverb','pronoun','conjunction','particle'].map((t) => (
            <div key={`type-${t}`}>{renderTypeTable(t)}</div>
          ))}
        </>
      ) : (
        <>
          {renderTypeTable(activeTab)}
        </>
      )}
    </div>
  );
}

export default StatsPage;


