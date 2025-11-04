import React, { useEffect, useState } from 'react';
import { api } from './api';
import './GrammarPage.css';

function Rule({ id, title, description, example_korean, example_english, model_korean, model_english, onUseModel, onDelete }) {
  return (
    <div className="rule-card">
      <h3 className="rule-title">{title}</h3>
      <p className="rule-desc">{description}</p>
      {(example_korean || example_english) && (
        <ul className="rule-examples">
          <li>
            {example_korean && <span className="ko">{example_korean}</span>}
            {example_english && <span className="en">{example_english}</span>}
          </li>
        </ul>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        {(model_korean && model_english) && (
          <button className="regenerate-button" onClick={() => onUseModel(model_english, model_korean)}>Use as Model</button>
        )}
        {onDelete && (
          <button
            className="regenerate-button"
            onClick={() => {
              if (window.confirm(`Delete “${title}”?`)) onDelete(id);
            }}
            style={{ padding: '6px 10px', fontSize: 12 }}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

function GrammarPage() {
  const [rules, setRules] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: '', description: '', example_korean: '', example_english: '', model_korean: '', model_english: '' });
  const [saving, setSaving] = useState(false);
  const [prompt, setPrompt] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const res = await api.getGrammarRules(300);
        const data = await res.json();
        if (!mounted) return;
        setRules(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!mounted) return;
        setError(String(e && e.message || e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const handleUseModel = async (english, korean) => {
    try {
      await api.saveModelSentence(english, korean);
      // Optional: show a quick hint
      // eslint-disable-next-line no-alert
      alert('Model sentence updated.');
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert('Failed to set model sentence');
    }
  };

  const handleAddRule = async () => {
    if (!form.title.trim()) { alert('Title is required'); return; }
    try {
      setSaving(true);
      const res = await api.addGrammarRule({
        title: form.title.trim(),
        description: form.description.trim(),
        example_korean: form.example_korean.trim(),
        example_english: form.example_english.trim(),
        model_korean: form.model_korean.trim(),
        model_english: form.model_english.trim()
      });
      if (!res.ok) throw new Error('Failed to add');
      // Reload rules
      const r = await api.getGrammarRules(300);
      const data = await r.json();
      setRules(Array.isArray(data) ? data : []);
      setForm({ title: '', description: '', example_korean: '', example_english: '', model_korean: '', model_english: '' });
    } catch (e) {
      alert('Failed to add rule');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateFromPrompt = async () => {
    const text = prompt.trim();
    if (!text) { alert('Enter a prompt first'); return; }
    try {
      setSaving(true);
      const instruction = `Extract a Korean grammar rule from the following user text. Return ONLY a compact JSON object with keys: title, description, example_korean, example_english, model_korean, model_english. If some fields are unknown, use empty strings.\n\nUser text:\n${text}`;
      const res = await api.chat(instruction);
      const data = await res.json();
      const content = data.response || '';
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No JSON in response');
      const obj = JSON.parse(match[0]);
      const toSave = {
        title: String(obj.title || '').trim(),
        description: String(obj.description || '').trim(),
        example_korean: String(obj.example_korean || '').trim(),
        example_english: String(obj.example_english || '').trim(),
        model_korean: String(obj.model_korean || '').trim(),
        model_english: String(obj.model_english || '').trim()
      };
      if (!toSave.title) throw new Error('Missing title');
      const addRes = await api.addGrammarRule(toSave);
      if (!addRes.ok) throw new Error('Save failed');
      const r = await api.getGrammarRules(300);
      const list = await r.json();
      setRules(Array.isArray(list) ? list : []);
      setPrompt('');
    } catch (e) {
      alert('Failed to generate from prompt');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this rule?')) return;
    try {
      const res = await api.deleteGrammarRule(id);
      if (!res.ok) throw new Error('Delete failed');
      const r = await api.getGrammarRules(300);
      const list = await r.json();
      setRules(Array.isArray(list) ? list : []);
    } catch (e) {
      alert('Failed to delete rule');
    }
  };

  if (loading) {
    return <div className="grammar-page"><div className="stats-card">Loading rules…</div></div>;
  }

  if (error) {
    return <div className="grammar-page"><div className="stats-card error">{error}</div></div>;
  }

  return (
    <div className="grammar-page">
      <header className="grammar-header">
        <h1 className="grammar-title">Korean Grammar Quick Rules</h1>
        <p className="grammar-subtitle">Core consonant/vowel based attachments and common patterns. Loaded from database.</p>
      </header>

      <div className="stats-card" style={{ marginBottom: 12 }}>
        <h2 style={{ marginTop: 0 }}>Add Grammar Rule</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <input value={form.title} onChange={(e)=>setForm({ ...form, title: e.target.value })} placeholder="Title (required)" />
          <input value={form.description} onChange={(e)=>setForm({ ...form, description: e.target.value })} placeholder="Description" />
          <input value={form.example_korean} onChange={(e)=>setForm({ ...form, example_korean: e.target.value })} placeholder="Example Korean" />
          <input value={form.example_english} onChange={(e)=>setForm({ ...form, example_english: e.target.value })} placeholder="Example English" />
          <input value={form.model_korean} onChange={(e)=>setForm({ ...form, model_korean: e.target.value })} placeholder="Model Korean (optional)" />
          <input value={form.model_english} onChange={(e)=>setForm({ ...form, model_english: e.target.value })} placeholder="Model English (optional)" />
        </div>
        <div style={{ marginTop: 8 }}>
          <button className="regenerate-button" onClick={handleAddRule} disabled={saving || !form.title.trim()}>Add Rule</button>
        </div>
        <div style={{ marginTop: 12 }}>
          <h3 style={{ margin: 0 }}>Or generate from text prompt</h3>
          <textarea rows={4} value={prompt} onChange={(e)=>setPrompt(e.target.value)} placeholder={'Describe a rule and examples...\nE.g. 은/는 topic particle with examples and a model sentence'} style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', marginTop: 6 }} />
          <div style={{ marginTop: 8 }}>
            <button className="regenerate-button" onClick={handleGenerateFromPrompt} disabled={saving || !prompt.trim()}>Generate from Prompt</button>
          </div>
        </div>
      </div>

      <div className="rules-grid">
        {rules.map((r) => (
          <Rule
            key={r.id}
            id={r.id}
            title={r.title}
            description={r.description}
            example_korean={r.example_korean}
            example_english={r.example_english}
            model_korean={r.model_korean}
            model_english={r.model_english}
            onUseModel={handleUseModel}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
}

export default GrammarPage;


