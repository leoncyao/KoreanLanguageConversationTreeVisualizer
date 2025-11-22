import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import './styles/TranslationPage.css';

function ChatPage() {
  const [searchParams] = useSearchParams();
  const initialInput = searchParams.get('input') || '';
  const initialTranslation = searchParams.get('translation') || '';

  const [lastContext, setLastContext] = React.useState(() => {
    if (initialInput && initialTranslation) {
      return { input: initialInput, translation: initialTranslation };
    }
    return null;
  });
  const [chatMessages, setChatMessages] = React.useState([]);
  const [chatInput, setChatInput] = React.useState('');
  const sendBtnRef = React.useRef(null);

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

  React.useEffect(() => {
    if (initialInput && initialTranslation) {
      requestExplanation(initialInput, initialTranslation);
    }
  }, [initialInput, initialTranslation, requestExplanation]);

  const handleSend = React.useCallback(async () => {
    const q = chatInput.trim();
    if (!q) return;
    setChatMessages((msgs) => [...msgs, { role: 'user', text: q }]);
    setChatInput('');
    try {
      const prompt = lastContext
        ? `You are helping a learner understand a prior translation.\nOriginal: ${lastContext.input}\nTranslation (ko): ${lastContext.translation}\nUser question: ${q}\nAnswer clearly and concisely.`
        : `User question: ${q}\nAnswer clearly and concisely for a Korean learner.`;
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

  // Keyboard support: Enter to send from input (Tab then Space on the button already works natively)
  const onChatKeyDown = React.useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

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
          <h1 className="translation-title">Chat & Explanations</h1>
          <p className="translation-subtitle">Ask questions about your last translation or any Korean topic.</p>
        </header>

        {!lastContext && (
          <div className="translation-card" style={{ marginBottom: 12 }}>
            <p style={{ margin: 0, color: '#6b7280' }}>
              Tip: Translate something on the <Link to="/translate">Translate</Link> page first to prefill context here.
            </p>
          </div>
        )}

        <div className="translation-card">
          <h2 style={{ marginTop: 0 }}>Explanation & Questions</h2>
          {chatMessages.length === 0 ? (
            <p style={{ color: '#6b7280', margin: 0 }}>Ask a question below{lastContext ? ' or wait for the explanation to load…' : '.'}</p>
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
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={onChatKeyDown}
              placeholder={lastContext ? 'Ask about the explanation…' : 'Optional: translate first to provide context'}
              style={{ flex: 1, padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 10, color: '#111827' }}
            />
            <button ref={sendBtnRef} className="translation-link" onClick={handleSend} disabled={!chatInput.trim()}>
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatPage;


