import React, { useEffect, useState } from 'react';
import { api } from '../api';
import './GrammarPage.css';

const escapeHtml = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const mdToHtml = (md) => {
  if (!md) return '';
  let txt = md;
  
  // Process markdown tables first (before escaping HTML)
  // Match markdown table pattern: lines starting with | and containing |
  // Look for consecutive lines that look like table rows
  const lines = txt.split('\n');
  const tableBlocks = [];
  let currentTable = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Check if this line looks like a table row (starts and ends with |)
    if (line.startsWith('|') && line.endsWith('|') && line.length > 2) {
      if (!currentTable) {
        currentTable = { start: i, lines: [] };
      }
      currentTable.lines.push(line);
    } else {
      // Not a table row - close current table if exists
      if (currentTable && currentTable.lines.length >= 2) {
        tableBlocks.push(currentTable);
      }
      currentTable = null;
    }
  }
  // Don't forget the last table if file ends with table
  if (currentTable && currentTable.lines.length >= 2) {
    tableBlocks.push(currentTable);
  }
  
  // Process tables from end to start to preserve indices when replacing
  for (let i = tableBlocks.length - 1; i >= 0; i--) {
    const block = tableBlocks[i];
    const tableLines = block.lines;
    
    // Check if second line is a separator
    let headerLineIndex = 0;
    let dataStartIndex = 1;
    if (tableLines.length > 1 && /^[\s|:\-]+$/.test(tableLines[1])) {
      // Second line is separator
      headerLineIndex = 0;
      dataStartIndex = 2;
    }
    
    if (dataStartIndex >= tableLines.length) continue;
    
    // Parse header
    const headerCells = tableLines[headerLineIndex].split('|').map(c => c.trim()).filter(c => c);
    if (headerCells.length === 0) continue;
    
    // Parse data rows
    const dataRows = tableLines.slice(dataStartIndex).map(row => {
      const cells = row.split('|').map(c => c.trim()).filter(c => c);
      if (cells.length === 0) return '';
      // Ensure we have the same number of cells as headers
      while (cells.length < headerCells.length) cells.push('');
      if (cells.length > headerCells.length) {
        const trimmed = cells.slice(0, headerCells.length);
        cells.length = 0;
        cells.push(...trimmed);
      }
      return '<tr>' + cells.map(c => `<td style="padding: 6px 8px; border: 1px solid #ddd;">${escapeHtml(c)}</td>`).join('') + '</tr>';
    }).filter(r => r);
    
    const headerRow = '<tr>' + headerCells.map(c => `<th style="padding: 6px 8px; border: 1px solid #ddd; background: #f3f4f6; font-weight: 600; text-align: left;">${escapeHtml(c)}</th>`).join('') + '</tr>';
    
    const tableHtml = '<table style="border-collapse: collapse; width: 100%; margin: 12px 0; border: 1px solid #ddd;"><thead>' + headerRow + '</thead><tbody>' + dataRows.join('') + '</tbody></table>';
    
    // Replace the table lines in the lines array
    lines.splice(block.start, tableLines.length, tableHtml);
  }
  
  // Rebuild txt from modified lines array
  txt = lines.join('\n');
  
  // Now escape HTML for the rest of the content (but not tables which are already HTML)
  // Split by tables to preserve them
  const tableParts = txt.split(/(<table[\s\S]*?<\/table>)/g);
  const processedParts = tableParts.map(part => {
    if (part.startsWith('<table')) {
      return part; // Already processed
    }
    return escapeHtml(part);
  });
  txt = processedParts.join('');
  
  // Bold **text**
  txt = txt.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italics *text*
  txt = txt.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
  // Headings
  txt = txt.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
           .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
           .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
  // Lists
  txt = txt.replace(/^(?:[-*])\s+(.+)$/gm, '<li>$1</li>');
  txt = txt.replace(/(<li>[\s\S]*?<\/li>)/g, (m) => `<ul>${m}</ul>`);
  // Paragraphs (split by tables and other block elements)
  const finalParts = txt.split(/(<table[\s\S]*?<\/table>|<h[1-3]>[\s\S]*?<\/h[1-3]>)/g);
  const htmlParts = [];
  for (let i = 0; i < finalParts.length; i++) {
    const part = finalParts[i];
    // If it's already a table or heading, keep it as is
    if (part.match(/^<(table|h[1-3])/)) {
      htmlParts.push(part);
    } else {
      // Otherwise, convert to paragraphs
      const p = part
        .split(/\n{2,}/)
        .map(seg => seg.trim() ? `<p>${seg.replace(/\n/g, '<br>')}</p>` : '')
        .join('');
      htmlParts.push(p);
    }
  }
  return htmlParts.join('');
};

function Rule({ id, title, description, example_korean, example_english, model_korean, model_english, onUseModel, onDelete }) {
  return (
    <div className="rule-card">
      <h3 className="rule-title">{title}</h3>
      <div className="rule-desc" dangerouslySetInnerHTML={{ __html: mdToHtml(description) }} />
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

  const handleGenerateFromPrompt = async () => {
    const text = prompt.trim();
    if (!text) { alert('Enter a prompt first'); return; }
    try {
      setSaving(true);
      const instruction = `Extract a Korean grammar rule from the following user text. Return ONLY a compact JSON object with keys: title, description, example_korean, example_english, model_korean, model_english.

IMPORTANT: 
- The description should contain ONLY:
  1. A comparison table (if comparing multiple patterns)
  2. Usage guidelines (brief bullet points)
- Do NOT include an "Explanation" section or any other text.
- If comparing multiple patterns (like 어디에서 vs 어디에), USE A TABLE to show the differences clearly.
- Format tables using markdown table syntax with headers:
  | Pattern | Usage | Example Korean | Example English |
  |---------|-------|----------------|-----------------|
  | Pattern 1 | Brief usage note | Example KO | Example EN |
  | Pattern 2 | Brief usage note | Example KO | Example EN |
- CRITICAL: In the "Example Korean" column, the example sentence MUST include the actual pattern being described. For example, if the pattern is "어디에서", the example should be "어디에서 왔어요?" (Where did you come from?), NOT just "집에서 왔어요." (I came from home.). The pattern itself must appear in the example sentence.
- After the table, add a "Usage Guidelines" section with 2-3 brief bullet points about when to use each pattern.

User text:\n${text}`;
      const res = await api.chat(instruction);
      if (!res.ok) {
        const errorText = await res.text().catch(() => 'Unknown error');
        console.error('[Grammar] API call failed:', res.status, errorText);
        throw new Error(`API call failed: ${res.status}${errorText ? ` - ${errorText}` : ''}`);
      }
      const data = await res.json();
      const content = data.response || '';
      console.log('[Grammar] AI response:', content);
      
      // Try to find JSON object - look for first { and matching }
      let jsonStart = content.indexOf('{');
      if (jsonStart === -1) {
        console.error('[Grammar] No JSON found in response:', content);
        throw new Error('No JSON object found in AI response. Please try again with a clearer prompt.');
      }
      
      // Find the matching closing brace by counting braces
      let braceCount = 0;
      let jsonEnd = -1;
      for (let i = jsonStart; i < content.length; i++) {
        if (content[i] === '{') {
          braceCount++;
        } else if (content[i] === '}') {
          braceCount--;
          if (braceCount === 0) {
            jsonEnd = i + 1;
            break;
          }
        }
      }
      
      if (jsonEnd === -1) {
        console.error('[Grammar] Incomplete JSON in response:', content);
        throw new Error('Incomplete JSON object in AI response. Please try again.');
      }
      
      let jsonString = content.substring(jsonStart, jsonEnd);
      
      // Clean up JSON: escape control characters inside string values
      // Walk through the string and escape control chars that appear between quotes
      let cleaned = '';
      let inString = false;
      let escapeNext = false;
      for (let i = 0; i < jsonString.length; i++) {
        const char = jsonString[i];
        const prevChar = i > 0 ? jsonString[i - 1] : '';
        
        if (escapeNext) {
          cleaned += char;
          escapeNext = false;
          continue;
        }
        
        if (char === '\\') {
          cleaned += char;
          escapeNext = true;
          continue;
        }
        
        if (char === '"' && prevChar !== '\\') {
          inString = !inString;
          cleaned += char;
          continue;
        }
        
        if (inString) {
          // Inside a string, escape control characters
          if (char === '\n') {
            cleaned += '\\n';
          } else if (char === '\r') {
            cleaned += '\\r';
          } else if (char === '\t') {
            cleaned += '\\t';
          } else if (char === '\f') {
            cleaned += '\\f';
          } else if (char === '\b') {
            cleaned += '\\b';
          } else if (char.charCodeAt(0) < 32) {
            // Other control characters
            cleaned += '\\u' + ('0000' + char.charCodeAt(0).toString(16)).slice(-4);
          } else {
            cleaned += char;
          }
        } else {
          cleaned += char;
        }
      }
      
      let obj;
      try {
        obj = JSON.parse(cleaned);
      } catch (parseErr) {
        console.error('[Grammar] JSON parse error:', parseErr, 'Attempted to parse:', cleaned.substring(0, 200));
        throw new Error(`Failed to parse JSON: ${parseErr.message}. The AI response may contain invalid characters.`);
      }
      const toSave = {
        title: String(obj.title || '').trim(),
        description: String(obj.description || '').trim(),
        example_korean: String(obj.example_korean || '').trim(),
        example_english: String(obj.example_english || '').trim(),
        model_korean: String(obj.model_korean || '').trim(),
        model_english: String(obj.model_english || '').trim()
      };
      if (!toSave.title) {
        console.error('[Grammar] Missing title in parsed object:', obj);
        throw new Error('AI response is missing a title. Please try again with a clearer prompt.');
      }
      console.log('[Grammar] Saving rule:', toSave);
      const addRes = await api.addGrammarRule(toSave);
      if (!addRes.ok) {
        const errorText = await addRes.text().catch(() => 'Unknown error');
        console.error('[Grammar] Save failed:', addRes.status, errorText);
        throw new Error(`Failed to save rule: ${addRes.status}${errorText ? ` - ${errorText}` : ''}`);
      }
      const r = await api.getGrammarRules(300);
      const list = await r.json();
      setRules(Array.isArray(list) ? list : []);
      setPrompt('');
      alert('Grammar rule generated and saved successfully!');
    } catch (e) {
      console.error('[Grammar] Error generating from prompt:', e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      alert(`Failed to generate from prompt: ${errorMessage}`);
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
        <h2 style={{ marginTop: 0 }}>Generate Grammar Rule from Prompt</h2>
        <textarea rows={4} value={prompt} onChange={(e)=>setPrompt(e.target.value)} placeholder={'Describe a rule and examples...\nE.g. 은/는 topic particle with examples and a model sentence'} style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', marginTop: 6 }} />
        <div style={{ marginTop: 8 }}>
          <button className="regenerate-button" onClick={handleGenerateFromPrompt} disabled={saving || !prompt.trim()}>Generate from Prompt</button>
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


