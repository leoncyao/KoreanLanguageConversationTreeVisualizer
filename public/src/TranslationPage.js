import React from 'react';
import { Link } from 'react-router-dom';
import TranslationBox from './TranslationBox';
import './TranslationPage.css';

function TranslationPage() {
  const [chatMessages, setChatMessages] = React.useState([]); // {role: 'assistant'|'user', text}
  const [chatInput, setChatInput] = React.useState('');
  const [lastContext, setLastContext] = React.useState(null); // {input, translation}

  const requestExplanation = React.useCallback(async (input, translation) => {
    try {
      const prompt = `Explain the Korean translation in detail.
Original (user): ${input}
Translation (ko): ${translation}
Please include a clear breakdown of grammar (particles, tense, politeness), vocabulary with brief glosses, and any pronunciation notes.
Keep it concise and structured for a learner.`;
      const res = await fetch((process.env.API_BASE_URL || '') + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      if (!res.ok) return;
      const data = await res.json();
      const text = data.response || '';
      setChatMessages([{ role: 'assistant', text }]);
    } catch (_) {}
  }, []);

  const handleTranslated = React.useCallback(({ input, translation }) => {
    setLastContext({ input, translation });
    requestExplanation(input, translation);
  }, [requestExplanation]);

  const handleSend = React.useCallback(async () => {
    const q = chatInput.trim();
    if (!q || !lastContext) return;
    setChatMessages((msgs) => [...msgs, { role: 'user', text: q }]);
    setChatInput('');
    try {
      const prompt = `You are helping a learner understand a prior translation.
Original: ${lastContext.input}
Translation (ko): ${lastContext.translation}
User question: ${q}
Answer clearly and concisely.`;
      const res = await fetch((process.env.API_BASE_URL || '') + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      if (!res.ok) return;
      const data = await res.json();
      const text = data.response || '';
      setChatMessages((msgs) => [...msgs, { role: 'assistant', text }]);
    } catch (_) {}
  }, [chatInput, lastContext]);

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
          {chatMessages.length === 0 ? (
            <p style={{ color: '#6b7280', margin: 0 }}>Translate something above to see an explanation here.</p>
          ) : (
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {chatMessages.map((m, idx) => (
                  <div key={idx} style={{
                    alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                    background: m.role === 'user' ? '#eef2ff' : '#f8fafc',
                    border: '1px solid #e5e7eb',
                    borderRadius: 10,
                    padding: '8px 10px',
                    maxWidth: '100%'
                  }}>
                    {m.role === 'assistant' ? (
                      <div dangerouslySetInnerHTML={{ __html: mdToHtml(m.text) }} />
                    ) : (
                      <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={lastContext ? 'Ask about the explanation…' : 'Translate first to enable chat'}
                  disabled={!lastContext}
                  style={{ flex: 1, padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 10 }}
                />
                <button className="translation-link" onClick={handleSend} disabled={!lastContext || !chatInput.trim()}>
                  Send
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TranslationPage;


