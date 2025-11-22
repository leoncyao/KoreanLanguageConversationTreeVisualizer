import React from 'react';
import { Link } from 'react-router-dom';
import { api } from './api';
import TranslationBox from './TranslationBox';
import './styles/TranslationPage.css';

function TranslationPage() {
  const [lastContext, setLastContext] = React.useState(null); // {input, translation}
  const [explanation, setExplanation] = React.useState('');
  const [loadingExplanation, setLoadingExplanation] = React.useState(false);
  const [addStatus, setAddStatus] = React.useState('');

  const handleTranslated = React.useCallback(({ input, translation }) => {
    setLastContext({ input, translation });
  }, []);

  // Minimal Markdown renderer (safe subset)
  const escapeHtml = (s) => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const mdToHtml = (md) => {
    if (!md) return '';
    let txt = escapeHtml(md);
    // code blocks ```...```
    txt = txt.replace(/```([\s\S]*?)```/g, (m, p1) => `<pre><code>${p1}</code></pre>`);
    // bold **text**
    txt = txt.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // italics *text*
    txt = txt.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
    // headings
    txt = txt.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
             .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
             .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
    // unordered lists
    txt = txt.replace(/^(?:[-*])\s+(.+)$/gm, '<li>$1</li>');
    // wrap list items with <ul>
    txt = txt.replace(/(<li>[\s\S]*?<\/li>)/g, (m) => `<ul>${m}</ul>`);
    // new lines to <br> inside paragraphs (avoid inside pre/code)
    const parts = txt.split(/<pre>[\s\S]*?<\/pre>/g);
    const preMatches = txt.match(/<pre>[\s\S]*?<\/pre>/g) || [];
    const htmlParts = [];
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]
        .split(/\n{2,}/)
        .map(seg => seg.trim() ? `<p>${seg.replace(/\n/g, '<br>')}</p>` : '')
        .join('');
      htmlParts.push(p);
      if (preMatches[i]) htmlParts.push(preMatches[i]);
    }
    return htmlParts.join('');
  };

  // Fetch explanation when we have context
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setAddStatus('');
        if (!lastContext || !lastContext.input || !lastContext.translation) {
          if (!cancelled) setExplanation('');
          return;
        }
        if (!cancelled) setLoadingExplanation(true);
        const prompt = `Explain the Korean translation in detail.
Original (user): ${lastContext.input}
Translation (ko): ${lastContext.translation}
Please include a clear breakdown of grammar (particles, tense, politeness), vocabulary with brief glosses, and any pronunciation notes.
Keep it concise and structured for a learner.`;
        const res = await api.chat(prompt);
        if (!cancelled) {
          if (res.ok) {
            const data = await res.json().catch(() => ({}));
            setExplanation(String((data && data.response) || ''));
          } else {
            setExplanation('');
          }
        }
      } catch (_) {
        if (!cancelled) setExplanation('');
      } finally {
        if (!cancelled) setLoadingExplanation(false);
      }
    })();
    return () => { cancelled = true; };
  }, [lastContext]);

  const handleAddToCurriculum = React.useCallback(async () => {
    try {
      if (!lastContext || !lastContext.input || !lastContext.translation) return;
      setAddStatus('Adding…');
      const res = await api.addCurriculumPhrase({
        korean_text: lastContext.translation,
        english_text: lastContext.input
      });
      if (res.ok) {
        setAddStatus('Added to curriculum ✓');
      } else {
        const t = await res.text().catch(() => '');
        setAddStatus('Failed to add' + (t ? `: ${t}` : ''));
      }
    } catch (_) {
      setAddStatus('Failed to add');
    }
  }, [lastContext]);

  return (
    <div className="translation-page">
      <div className="translation-container">
        <header className="translation-header">
          <h1 className="translation-title">Translator</h1>
          <p className="translation-subtitle">Type and press Enter to translate to Korean.</p>
        </header>

        <div className="translation-card">
          <TranslationBox onTranslated={handleTranslated} />
        </div>

        <div className="translation-card" style={{ marginTop: 12 }}>
          <h2 style={{ marginTop: 0 }}>Explanation & Questions</h2>
          {!lastContext && (
            <p style={{ color: '#6b7280', margin: 0 }}>
              Open the dedicated chat to get explanations and ask questions about your latest translation.
            </p>
          )}
          {lastContext && (
            <div style={{ marginTop: 8 }}>
              {loadingExplanation ? (
                <p style={{ margin: '4px 0', color: '#6b7280' }}>Loading explanation…</p>
              ) : explanation ? (
                <div
                  style={{ lineHeight: '1.6' }}
                  dangerouslySetInnerHTML={{ __html: mdToHtml(explanation) }}
                />
              ) : (
                <p style={{ margin: '4px 0', color: '#6b7280' }}>No explanation available.</p>
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <Link
              className="translation-link"
              to={lastContext ? `/chat?input=${encodeURIComponent(lastContext.input)}&translation=${encodeURIComponent(lastContext.translation)}` : '/chat'}
            >
              Open Chat
            </Link>
            <button
              type="button"
              className="translation-link"
              onClick={handleAddToCurriculum}
              disabled={!lastContext}
            >
              Add to Curriculum
            </button>
            {addStatus && (
              <span style={{ alignSelf: 'center', color: '#6b7280' }}>{addStatus}</span>
            )}
            {!lastContext && (
              <span style={{ alignSelf: 'center', color: '#6b7280' }}>Translate something first to pass context.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TranslationPage;


