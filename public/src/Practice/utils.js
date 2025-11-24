export const removePunctuation = (str) => {
  if (!str) return '';
  return String(str).replace(/[.,!?;:()\[\]{}'"`~@#$%^&*+=|\\<>\/\-_]/g, '');
};

export const escapeHtml = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

export const mdToHtml = (md) => {
  if (!md) return '';
  let txt = md;
  
  // Process markdown tables first (before escaping HTML)
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
  const tableParts = txt.split(/(<table[\s\S]*?<\/table>)/g);
  const processedParts = tableParts.map(part => {
    if (part.startsWith('<table')) {
      return part; // Already processed
    }
    return escapeHtml(part);
  });
  txt = processedParts.join('');
  
  // Code blocks
  txt = txt.replace(/```([\s\S]*?)```/g, (m, p1) => `<pre style="background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto;"><code>${p1}</code></pre>`);
  // Bold **text**
  txt = txt.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italics *text*
  txt = txt.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
  // Headings (process from most specific to least specific)
  txt = txt.replace(/^#####\s+(.+)$/gm, '<h5 style="margin: 10px 0 4px 0; font-size: 1em; font-weight: 600; color: #4b5563;">$1</h5>')
           .replace(/^####\s+(.+)$/gm, '<h4 style="margin: 12px 0 6px 0; font-size: 1.1em; font-weight: 600; color: #374151;">$1</h4>')
           .replace(/^###\s+(.+)$/gm, '<h3 style="margin: 16px 0 8px 0; font-size: 1.2em; font-weight: 600; color: #1f2937;">$1</h3>')
           .replace(/^##\s+(.+)$/gm, '<h2 style="margin: 20px 0 10px 0; font-size: 1.3em; font-weight: 600; color: #111827;">$1</h2>')
           .replace(/^#\s+(.+)$/gm, '<h1 style="margin: 24px 0 12px 0; font-size: 1.5em; font-weight: 700; color: #000;">$1</h1>');
  // Lists
  txt = txt.replace(/^(?:[-*])\s+(.+)$/gm, '<li style="margin: 4px 0;">$1</li>');
  txt = txt.replace(/(<li[\s\S]*?<\/li>)/g, (m) => `<ul style="margin: 8px 0; padding-left: 24px;">${m}</ul>`);
  
  // Paragraphs (split by tables, code blocks, and headings)
  const finalParts = txt.split(/(<table[\s\S]*?<\/table>|<pre[\s\S]*?<\/pre>|<h[1-5]>[\s\S]*?<\/h[1-5]>)/g);
  const htmlParts = [];
  for (let i = 0; i < finalParts.length; i++) {
    const part = finalParts[i];
    // If it's already a table, code block, or heading, keep it as is
    if (part.match(/^<(table|pre|h[1-5])/)) {
      htmlParts.push(part);
    } else {
      // Otherwise, convert to paragraphs
      const p = part
        .split(/\n{2,}/)
        .map(seg => seg.trim() ? `<p style="margin: 8px 0; line-height: 1.6;">${seg.replace(/\n/g, '<br>')}</p>` : '')
        .join('');
      htmlParts.push(p);
    }
  }
  return htmlParts.join('');
};

