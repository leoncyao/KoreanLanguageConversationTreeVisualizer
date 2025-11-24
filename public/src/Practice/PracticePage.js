import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { generateVerbPracticeSentence } from '../AudioLearning/verbPractice';
import '../Home/HomePage.css';

const SPEAK_ADVANCE_DELAY_MS = 1200;

const removePunctuation = (str) => {
  if (!str) return '';
  return String(str).replace(/[.,!?;:()\[\]{}'"`~@#$%^&*+=|\\<>\/\-_]/g, '');
};

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

function PracticePage() {
  const [currentPhrase, setCurrentPhrase] = useState(null);
  const [inputValues, setInputValues] = useState([]); // Array of input values for multiple blanks
  const [currentBlankIndex, setCurrentBlankIndex] = useState(0); // Which blank we're currently filling
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false); // Start as false, will be set to true when fetching
  const [error, setError] = useState(null);
  const [inputPlaceholder, setInputPlaceholder] = useState('');
  const [showExplanation, setShowExplanation] = useState(false);
  const [explanationText, setExplanationText] = useState('');
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);
  const [explanationPhraseId, setExplanationPhraseId] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showAnswerBelow, setShowAnswerBelow] = useState(false); // Show answer below input field
  const [englishWordIndices, setEnglishWordIndices] = useState([]); // English word indices that correspond to blanks
  const [englishWordIndicesPhraseId, setEnglishWordIndicesPhraseId] = useState(null); // Track which phrase we have indices for
  const fetchingEnglishIndicesRef = React.useRef(false); // Prevent duplicate fetches
  const inputRefs = React.useRef({}); // Refs for input fields to enable auto-focus on tab switch
  const [usedPhraseIds, setUsedPhraseIds] = useState([]); // Track which phrases we've used
  const [allPhrases, setAllPhrases] = useState([]); // Store all curriculum phrases
  const [usingVariations, setUsingVariations] = useState(false); // Whether we're in variation mode
  const [sessionNoTrack, setSessionNoTrack] = useState(false); // Session flag: do not track stats for remixed/new sentences
  const SESSION_SIZE = 5;
  const [sessionPhrases, setSessionPhrases] = useState([]); // Fixed subset for this session (mode 1: curriculum)
  const [verbPracticeSession, setVerbPracticeSession] = useState([]); // Session phrases for mode 2 (verb practice)
  const [conversationSession, setConversationSession] = useState([]); // Session phrases for mode 3 (conversations)
  const [sessionPage, setSessionPage] = useState(0); // 0-based page of 5-phrase sets
  const [numBlanks, setNumBlanks] = useState(() => {
    try {
      const saved = localStorage.getItem('practice_numBlanks');
      return saved ? parseInt(saved, 10) : 1;
    } catch (_) {
      return 1;
    }
  }); // 1, 2, 3 -> number of blanks
  const [practiceMode, setPracticeMode] = useState(() => {
    try {
      const saved = localStorage.getItem('practice_mode');
      return saved ? parseInt(saved, 10) : 4;
    } catch (_) {
      return 4;
    }
  }); // 1: curriculum, 2: verb practice, 3: conversation sets, 4: mix
  const [highlightEnglishWords, setHighlightEnglishWords] = useState(() => {
    try {
      const saved = localStorage.getItem('practice_highlight_english');
      return saved !== null ? saved === 'true' : false; // Default to false
    } catch (_) {
      return false;
    }
  }); // Whether to highlight English words corresponding to blanks
  const [textSize, setTextSize] = useState(() => {
    try {
      const saved = localStorage.getItem('practice_textSize');
      return saved ? parseFloat(saved) : 1.0; // Default to 1.0 (100%)
    } catch (_) {
      return 1.0;
    }
  }); // Text size multiplier (0.5, 0.6, 0.7, 0.8, 0.9, 1.0)
  const [showSetDialog, setShowSetDialog] = useState(false); // Show/hide current set sentences
  const [randomBlankIndices, setRandomBlankIndices] = useState([]); // Random blank positions for current phrase
  const [wordTypesByPhraseId, setWordTypesByPhraseId] = useState({}); // POS tags per phrase id (tokens aligned to spaces)
  // Conversation sets state (for Mode 3)
  const [savedConversations, setSavedConversations] = useState(() => {
    try { const raw = localStorage.getItem('conversation_sets_v1'); const arr = raw ? JSON.parse(raw) : []; return Array.isArray(arr) ? arr : []; } catch (_) { return []; }
  });
  const [currentConversationIndex, setCurrentConversationIndex] = useState(0); // Which conversation set
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0); // Which sentence in current conversation
  // Mix mode state (Mode 4)
  const [mixState, setMixState] = useState(null);
  const [previousConversationSentences, setPreviousConversationSentences] = useState([]); // For random repeats
  
  // Listen for changes to highlight setting from Navbar
  useEffect(() => {
    const handleHighlightChange = () => {
      try {
        const saved = localStorage.getItem('practice_highlight_english');
        setHighlightEnglishWords(saved !== null ? saved === 'true' : false);
      } catch (_) {
        setHighlightEnglishWords(false);
      }
    };
    window.addEventListener('practice_highlight_english_changed', handleHighlightChange);
    return () => {
      window.removeEventListener('practice_highlight_english_changed', handleHighlightChange);
    };
  }, []);

  // Listen for changes to text size setting from Navbar
  useEffect(() => {
    const handleTextSizeChange = () => {
      try {
        const saved = localStorage.getItem('practice_textSize');
        setTextSize(saved ? parseFloat(saved) : 1.0);
      } catch (_) {
        setTextSize(1.0);
      }
    };
    window.addEventListener('practice_textSize_changed', handleTextSizeChange);
    return () => {
      window.removeEventListener('practice_textSize_changed', handleTextSizeChange);
    };
  }, []);

  // Auto-focus input when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && currentPhrase && inputRefs.current[currentBlankIndex]) {
        // Small delay to ensure the input is rendered
        setTimeout(() => {
          const input = inputRefs.current[currentBlankIndex];
          if (input) {
            input.focus();
          }
        }, 100);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentBlankIndex, currentPhrase]);

  // Build a list of candidate indices to blank, preferring to skip common particles and proper nouns
  const getCandidateBlankIndices = useCallback((words, types) => {
    if (!Array.isArray(words) || words.length === 0) return [];
    const particleSet = new Set([
      '은','는','이','가','을','를','에','에서','에게','께','한테','으로','로','과','와','도','만','까지','부터','보다','처럼','같이','하고'
    ]);
    const candidates = [];
    for (let i = 0; i < words.length; i++) {
      const w = String(words[i] || '').trim();
      if (!w) continue;
      // Skip tokens that are just particles
      if (particleSet.has(w)) continue;
      // Skip tokens tagged as proper nouns if types provided
      const t = Array.isArray(types) && types.length === words.length ? String(types[i] || '').toLowerCase() : '';
      if (t && (t.includes('proper') || t.includes('proper noun'))) continue;
      candidates.push(i);
    }
    return candidates;
  }, []);

  // Select blank indices with priority for verbs (for verb practice mode)
  const selectBlankIndicesWithVerbPriority = useCallback((words, types, desired, practiceMode) => {
    if (!Array.isArray(words) || words.length === 0) return [];
    
    // Get all candidates
    const candidates = getCandidateBlankIndices(words, types);
    if (candidates.length === 0) {
      // Fallback to all indices
      return words.map((_, i) => i).slice(0, desired);
    }
    
    // For verb practice mode, prioritize verbs
    if (practiceMode === 2) {
      const verbIndices = [];
      const nonVerbIndices = [];
      
      for (const idx of candidates) {
        const t = Array.isArray(types) && types.length === words.length ? String(types[idx] || '').toLowerCase() : '';
        const word = String(words[idx] || '').trim();
        
        // Check if it's a verb by POS tag or by common verb endings
        const isVerb = t && (t.includes('verb') || t.includes('v-'));
        const looksLikeVerb = !isVerb && word && (
          word.endsWith('다') || 
          word.endsWith('요') || 
          word.endsWith('어요') || 
          word.endsWith('아요') || 
          word.endsWith('해요') || 
          word.endsWith('있어요') || 
          word.endsWith('었어요') || 
          word.endsWith('았어요') ||
          word.endsWith('할') ||
          word.endsWith('할 거예요') ||
          word.includes('하고')
        );
        
        if (isVerb || looksLikeVerb) {
          verbIndices.push(idx);
        } else {
          nonVerbIndices.push(idx);
        }
      }
      
      // Prioritize verbs: try to fill at least half with verbs if available
      const verbCount = Math.min(verbIndices.length, Math.ceil(desired / 2));
      const nonVerbCount = desired - verbCount;
      
      const chosen = [];
      
      // Add verbs first
      const verbPool = [...verbIndices];
      for (let i = 0; i < verbCount && verbPool.length > 0; i++) {
        const idx = Math.floor(Math.random() * verbPool.length);
        chosen.push(verbPool[idx]);
        verbPool.splice(idx, 1);
      }
      
      // Add non-verbs to fill remaining slots
      const nonVerbPool = [...nonVerbIndices];
      for (let i = 0; i < nonVerbCount && nonVerbPool.length > 0; i++) {
        const idx = Math.floor(Math.random() * nonVerbPool.length);
        chosen.push(nonVerbPool[idx]);
        nonVerbPool.splice(idx, 1);
      }
      
      // If we still need more and have candidates left, fill from remaining
      const remaining = [...verbPool, ...nonVerbPool];
      while (chosen.length < desired && remaining.length > 0) {
        const idx = Math.floor(Math.random() * remaining.length);
        chosen.push(remaining[idx]);
        remaining.splice(idx, 1);
      }
      
      return chosen.sort((a, b) => a - b);
    }
    
    // For other modes, use random selection from candidates
    const pool = candidates.length >= desired ? [...candidates] : words.map((_, i) => i);
    const chosen = [];
    while (chosen.length < desired && pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length);
      chosen.push(pool[idx]);
      pool.splice(idx, 1);
    }
    return chosen.sort((a, b) => a - b);
  }, [getCandidateBlankIndices]);

  const createBlankPhrase = useCallback((phrase) => {
    if (!phrase) return { korean: '', blanks: [], translation: '', correct_answers: [] };
    
    const koreanWords = phrase.korean_text.trim().split(' ').filter(w => w);
    
    // Determine blank indices: prefer precomputed random indices; otherwise derive a fallback
    let blankIndices = Array.isArray(randomBlankIndices) ? randomBlankIndices : [];
    const desiredBlanks = Math.max(1, Math.min(3, Number(numBlanks) || 1));
    if (!blankIndices || blankIndices.length === 0) {
      // Fallback: evenly spaced indices if random wasn't set
      const n = Math.min(desiredBlanks, Math.max(1, Math.floor(koreanWords.length / 3)));
      const step = Math.max(1, Math.floor(koreanWords.length / (n + 1)));
      const derived = [];
      for (let i = 1; i <= n; i++) {
        const idx = Math.min(koreanWords.length - 1, i * step);
        if (!derived.includes(idx)) derived.push(idx);
      }
      blankIndices = derived;
    } else {
      // Cap to desired count just in case
      blankIndices = blankIndices.slice(0, desiredBlanks);
    }

    // Sort indices in descending order to replace from end to start
    const sortedIndices = [...blankIndices].sort((a, b) => b - a);
    const result = [...koreanWords];
    const blankWords = [];
    
    // Replace selected words with [BLANK] and collect the blank words (including punctuation)
    sortedIndices.forEach(idx => {
      if (idx >= 0 && idx < result.length) {
        // Store the full word including any punctuation attached to it
        blankWords.unshift(koreanWords[idx]); // unshift to maintain original order
        result[idx] = '[BLANK]';
      }
    });
    
    // Join with spaces - punctuation that's part of the word will be preserved
    const koreanWithBlanks = result.join(' ');
    
    // For random blanks, the correct answers are the words we blanked
    const correctAnswers = blankWords;
    
    return {
      korean: koreanWithBlanks,
      blanks: blankWords,
      blankIndices: blankIndices.sort((a, b) => a - b),
      translation: phrase.english_text,
      correct_answers: correctAnswers,
      id: phrase.id
    };
  }, [numBlanks, randomBlankIndices]);

  const blankPhrase = currentPhrase ? createBlankPhrase(currentPhrase) : null;
  
  // Create stable keys for useEffect dependencies
  const phraseIdKey = useMemo(() => {
    return String(blankPhrase?.id || currentPhrase?.id || '');
  }, [blankPhrase?.id, currentPhrase?.id]);
  
  const blankIndicesKey = useMemo(() => {
    return (blankPhrase?.blankIndices || []).join(',');
  }, [blankPhrase?.blankIndices]);
  
  const blanksKey = useMemo(() => {
    return (blankPhrase?.blanks || []).join(',');
  }, [blankPhrase?.blanks]);

  // Calculate progress over the active session subset based on mode (must be before early returns)
  const activeSessionData = useMemo(() => {
    if (practiceMode === 1) {
      // Curriculum mode
      const total = (sessionPhrases && sessionPhrases.length) ? sessionPhrases.length : allPhrases.length;
      const used = (sessionPhrases && sessionPhrases.length)
        ? usedPhraseIds.filter((id) => sessionPhrases.some((p) => p && p.id === id)).length
        : usedPhraseIds.length;
      return { total, used, phrases: sessionPhrases || [] };
    } else if (practiceMode === 2) {
      // Verb practice mode
      const total = verbPracticeSession.length;
      const used = usedPhraseIds.filter((id) => verbPracticeSession.some((p) => p && p.id === id)).length;
      return { total, used, phrases: verbPracticeSession };
    } else if (practiceMode === 3) {
      // Conversation mode
      const total = conversationSession.length;
      const used = usedPhraseIds.filter((id) => conversationSession.some((p) => p && p.id === id)).length;
      return { total, used, phrases: conversationSession };
    } else if (practiceMode === 4) {
      // Mix mode
      const total = mixState && mixState.mix_items ? mixState.mix_items.length : 0;
      // Ensure current_index is a valid number, default to 0
      const used = mixState && typeof mixState.current_index === 'number' ? mixState.current_index : 0;
      return { total, used, phrases: mixState && mixState.mix_items ? mixState.mix_items : [] };
    }
    return { total: 0, used: 0, phrases: [] };
  }, [practiceMode, sessionPhrases, allPhrases, verbPracticeSession, conversationSession, usedPhraseIds, mixState]);
  
  const activeTotal = activeSessionData.total;
  const activeUsed = activeSessionData.used;
  const activePhrases = activeSessionData.phrases;
  
  // Debug logging for mix mode index tracking
  React.useEffect(() => {
    if (practiceMode === 4 && mixState) {
      console.log('[Index Display] activeUsed:', activeUsed, 'mixState.current_index:', mixState.current_index, 'activeTotal:', activeTotal, 'display:', `Item ${Math.min(Math.max(0, activeUsed) + 1, activeTotal)} of ${activeTotal}`);
    }
  }, [practiceMode, mixState, activeUsed, activeTotal]);
  const progressPercentage = activeTotal > 0 ? (activeUsed / activeTotal) * 100 : 0;

  // When practiceMode changes, reset and initialize session for that mode
  useEffect(() => {
    try {
      if (practiceMode === 3) {
        // Reset conversation indices when switching to mode 3
        setCurrentConversationIndex(0);
        setCurrentSentenceIndex(0);
      }
      // Reset used phrases when mode changes
      setUsedPhraseIds([]);
      setSessionPage(0);
      // Initialize session for the new mode
      if (practiceMode === 1) {
        // Curriculum mode: session is already managed by sessionPhrases
        if (sessionPhrases.length > 0) {
          setCurrentPhrase(sessionPhrases[0]);
        } else if (allPhrases.length > 0) {
          const firstSubset = allPhrases.slice(0, Math.min(SESSION_SIZE, allPhrases.length));
          setSessionPhrases(firstSubset);
          if (firstSubset.length > 0) {
            setCurrentPhrase(firstSubset[0]);
          }
        } else {
          fetchRandomPhrase();
        }
      } else if (practiceMode === 2) {
        // Verb practice mode: generate initial session
        (async () => {
          try {
            const session = [];
            for (let i = 0; i < SESSION_SIZE; i++) {
              try {
                const result = await generateVerbPracticeSentence();
                if (result && result.korean && result.english) {
                  session.push({
                    korean_text: result.korean,
                    english_text: result.english,
                    id: `verb-${Date.now()}-${i}-${Math.random()}`
                  });
                }
              } catch (err) {
                console.warn('Error generating verb practice sentence:', err);
              }
            }
            if (session.length > 0) {
              setVerbPracticeSession(session);
              setCurrentPhrase(session[0]);
            } else {
              fetchRandomPhrase();
            }
          } catch (err) {
            console.error('Error initializing verb practice session:', err);
            fetchRandomPhrase();
          }
        })();
      } else if (practiceMode === 4) {
        // Mix mode: load mix state from database
        // reloadMixState will be called via useEffect after it's defined
        // No need to do anything here, the useEffect will handle it
      } else if (practiceMode === 3) {
        // Conversation mode: build session from conversations
        try {
          if (Array.isArray(savedConversations) && savedConversations.length > 0) {
            const session = [];
            let convIdx = 0;
            let sentIdx = 0;
            while (session.length < SESSION_SIZE && convIdx < savedConversations.length) {
              const conv = savedConversations[convIdx];
              if (conv && Array.isArray(conv.items) && conv.items.length > 0) {
                const sent = conv.items[sentIdx % conv.items.length];
                if (sent && (sent.korean || sent.english)) {
                  session.push({
                    korean_text: String(sent.korean || ''),
                    english_text: String(sent.english || ''),
                    id: `conv-${conv.id || convIdx}-${sentIdx % conv.items.length}`,
                    englishWordMapping: sent.englishWordMapping || null // Preserve pre-computed mapping
                  });
                }
                sentIdx++;
                if (sentIdx >= conv.items.length) {
                  convIdx++;
                  sentIdx = 0;
                }
              } else {
                convIdx++;
              }
            }
            if (session.length > 0) {
              setConversationSession(session);
              setCurrentPhrase(session[0]);
            } else {
              fetchRandomPhrase();
            }
          } else {
            fetchRandomPhrase();
          }
        } catch (err) {
          console.error('Error initializing conversation session:', err);
          fetchRandomPhrase();
        }
      }
    } catch (err) {
      console.error('Error in practiceMode useEffect:', err);
      setError(err.message || 'Failed to initialize practice mode');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceMode]); // Only trigger on mode change, not numBlanks (to avoid loops)

  // When numBlanks changes, reset inputs/placeholders to match new blanks count
  useEffect(() => {
    if (!currentPhrase) return;
    // Recompute random indices for the current phrase based on numBlanks
    const words = String(currentPhrase.korean_text || '').trim().split(' ').filter(w => w);
    const desired = Math.max(1, Math.min(3, Number(numBlanks) || 1));
    const types = (currentPhrase && wordTypesByPhraseId && wordTypesByPhraseId[currentPhrase.id]) || null;
    const candidates = getCandidateBlankIndices(words, types);
    let pool = candidates.length >= desired ? [...candidates] : words.map((_, i) => i);
    const chosen = [];
    while (chosen.length < desired && pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length);
      const [picked] = pool.splice(idx, 1);
      if (!chosen.includes(picked)) chosen.push(picked);
    }
    setRandomBlankIndices(chosen.sort((a, b) => a - b));
    const count = chosen.length;
    setInputValues(new Array(count).fill(''));
    setCurrentBlankIndex(0);
    setShowAnswer(false);
    setShowAnswerBelow(false);
    setFeedback('');
  }, [numBlanks, currentPhrase && currentPhrase.id, getCandidateBlankIndices, wordTypesByPhraseId]);

  // Fetch English word indices that correspond to Korean blanks (for all practice modes)
  const fetchEnglishWordIndices = useCallback(async () => {
    
    if (!currentPhrase || !blankPhrase || !blankPhrase.blanks || blankPhrase.blanks.length === 0) {
      setEnglishWordIndices([]);
      setEnglishWordIndicesPhraseId(null);
      return;
    }
    
    const phraseId = blankPhrase.id || currentPhrase.id;
    
    // Skip if already fetching
    if (fetchingEnglishIndicesRef.current) {
      return;
    }
    
    fetchingEnglishIndicesRef.current = true;
    
    try {
      // Check if we have a pre-computed mapping from AudioLearningPage
      if (currentPhrase && currentPhrase.englishWordMapping && typeof currentPhrase.englishWordMapping === 'object') {
        const mapping = currentPhrase.englishWordMapping;
        const indices = [];
        
        // Look up each blank word in the mapping
        for (const blankWord of blankPhrase.blanks) {
          // Try exact match first
          let index = mapping[blankWord];
          
          // If no exact match, try trimmed version
          if (typeof index !== 'number' || index < 0) {
            index = mapping[blankWord.trim()];
          }
          
          // If still no match, try to find a key that contains the blank word or vice versa
          if (typeof index !== 'number' || index < 0) {
            for (const [key, val] of Object.entries(mapping)) {
              if (key.includes(blankWord) || blankWord.includes(key)) {
                index = val;
                break;
              }
            }
          }
          
          if (typeof index === 'number' && index >= 0) {
            indices.push(index);
          }
        }
        
        if (indices.length > 0) {
          console.log('[EnglishWordIndices] Using pre-computed mapping:', { mapping, blanks: blankPhrase.blanks, indices });
          setEnglishWordIndices(indices);
          setEnglishWordIndicesPhraseId(phraseId);
          fetchingEnglishIndicesRef.current = false;
          return;
        } else {
          console.log('[EnglishWordIndices] Pre-computed mapping exists but no matches found, falling back to API:', { mapping, blanks: blankPhrase.blanks });
          // Don't return here - fall through to API call
        }
      }
      
      // Skip API call for mix mode to avoid unnecessary chat calls
      // English word highlighting is optional and not critical for mix mode
      if (practiceMode === 4) {
        console.log('[EnglishWordIndices] Skipping API call for mix mode');
        setEnglishWordIndices([]);
        setEnglishWordIndicesPhraseId(phraseId);
        fetchingEnglishIndicesRef.current = false;
        return;
      }
      
      // Fallback to API call if no pre-computed mapping available or if it didn't work
      // Reconstruct full Korean sentence
      const words = blankPhrase.korean.split(' ');
      let blankIdx = 0;
      const fullKorean = words.map(w => {
        if (w === '[BLANK]') {
          const word = blankPhrase.blanks[blankIdx] || '';
          blankIdx++;
          return word;
        }
        return w;
      }).join(' ');
      
      const english = blankPhrase.translation;
      const blankWords = blankPhrase.blanks.join(', ');
      
      const prompt = `Return ONLY a JSON object with this format: {"indices": [array of English word indices]}.
Given this Korean sentence and its English translation, identify which English words correspond to the Korean words that are blanked.

Korean: ${fullKorean}
English: ${english}
Korean blanked words: ${blankWords}

The English sentence is: "${english}"
Split the English sentence into words (by spaces), and return the 0-based indices of the English words that correspond to the blanked Korean words.

For example, if the English is "I am going to the store" and the blanked Korean word corresponds to "going", return {"indices": [2]}.

Return ONLY the JSON object, no other text.`;
      
      const res = await api.chat(prompt);
      if (res.ok) {
        const data = await res.json();
        const text = data.response || '';
        const m = String(text).match(/\{[\s\S]*\}/);
        if (m) {
          try {
            const obj = JSON.parse(m[0]);
            if (obj && Array.isArray(obj.indices)) {
              console.log('[EnglishWordIndices] API call succeeded:', { indices: obj.indices, blanks: blankPhrase.blanks });
              setEnglishWordIndices(obj.indices);
              setEnglishWordIndicesPhraseId(phraseId);
              fetchingEnglishIndicesRef.current = false;
              return;
            }
          } catch (e) {
            console.error('[EnglishWordIndices] Failed to parse API response:', e);
          }
        }
      } else {
        console.error('[EnglishWordIndices] API call failed:', res.status);
      }
    } catch (_) {}
    // Fallback: set empty array if we can't determine
    setEnglishWordIndices([]);
    setEnglishWordIndicesPhraseId(null);
    fetchingEnglishIndicesRef.current = false;
  }, [currentPhrase, blankPhrase, practiceMode]);

  // Fetch English word indices when blank phrase changes (skip for mix mode to avoid unnecessary API calls)
  useEffect(() => {
    // Skip entirely for mix mode to avoid unnecessary API calls
    if (practiceMode === 4) {
      setEnglishWordIndices([]);
      setEnglishWordIndicesPhraseId(null);
      return;
    }
    
    console.log('[EnglishWordIndices] useEffect triggered:', { 
      practiceMode, 
      hasBlankPhrase: !!blankPhrase, 
      hasCurrentPhrase: !!currentPhrase,
      blanks: blankPhrase?.blanks,
      phraseIdKey,
      englishWordIndicesPhraseId,
      isFetching: fetchingEnglishIndicesRef.current
    });
    
    if (!blankPhrase || !currentPhrase) {
      setEnglishWordIndices([]);
      setEnglishWordIndicesPhraseId(null);
      return;
    }
    
    if (blankPhrase.blanks && blankPhrase.blanks.length > 0) {
      // Only fetch if we don't already have indices for this phrase
      if (englishWordIndicesPhraseId !== phraseIdKey && !fetchingEnglishIndicesRef.current) {
        console.log('[EnglishWordIndices] Calling fetchEnglishWordIndices');
        fetchEnglishWordIndices();
      } else {
        console.log('[EnglishWordIndices] Skipping fetch - already have indices or currently fetching');
      }
    } else {
      setEnglishWordIndices([]);
      setEnglishWordIndicesPhraseId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phraseIdKey, blankIndicesKey, blanksKey, practiceMode]); // Use stable memoized dependencies

  // Choose next phrase from locally loaded curriculum, without refetching (Mode 1)
  const selectNextCurriculumPhrase = useCallback(() => {
    // Work from the fixed session subset; when exhausted, loop the same subset
    const pool = Array.isArray(sessionPhrases) && sessionPhrases.length > 0 ? sessionPhrases : allPhrases;
    if (!Array.isArray(pool) || pool.length === 0) return false;
    const used = new Set(usedPhraseIds);
    let next = pool.find((p) => !used.has(p.id));
    if (!next) {
      // Reset and start again from the same 5
      setUsedPhraseIds([]);
      next = pool[0];
    }
    setUsedPhraseIds((prev) => prev.includes(next.id) ? prev : [...prev, next.id]);
    setCurrentPhrase(next);
    setUsingVariations(false);
    return true;
  }, [sessionPhrases, allPhrases, usedPhraseIds]);

  // Choose next phrase from verb practice session (Mode 2)
  const selectNextVerbPracticePhrase = useCallback(() => {
    const pool = Array.isArray(verbPracticeSession) && verbPracticeSession.length > 0 ? verbPracticeSession : [];
    if (pool.length === 0) return false;
    const used = new Set(usedPhraseIds);
    let next = pool.find((p) => p && p.id && !used.has(p.id));
    if (!next) {
      // Reset and start again from the same session
      setUsedPhraseIds([]);
      next = pool[0];
    }
    if (!next || !next.id) return false;
    setUsedPhraseIds((prev) => prev.includes(next.id) ? prev : [...prev, next.id]);
    setCurrentPhrase(next);
    // Create blank indices for verb practice (prioritize verbs)
    const koreanText = String(next.korean_text || next.korean || '').trim();
    if (!koreanText) return false;
    const words = koreanText.split(' ').filter(w => w);
    if (words.length === 0) return false;
    const desired = Math.max(1, Math.min(3, Number(numBlanks) || 1));
    const chosen = selectBlankIndicesWithVerbPriority(words, null, desired, 2);
    setRandomBlankIndices(chosen);
    setInputValues(new Array(chosen.length).fill(''));
    setCurrentBlankIndex(0);
    setShowAnswer(false);
    setFeedback('');
    return true;
  }, [verbPracticeSession, usedPhraseIds, numBlanks, selectBlankIndicesWithVerbPriority]);

  // Choose next phrase from conversation session (Mode 3)
  const selectNextConversationPhrase = useCallback(() => {
    const pool = Array.isArray(conversationSession) && conversationSession.length > 0 ? conversationSession : [];
    if (pool.length === 0) return false;
    const used = new Set(usedPhraseIds);
    let next = pool.find((p) => p && p.id && !used.has(p.id));
    if (!next) {
      // Reset and start again from the same session
      setUsedPhraseIds([]);
      next = pool[0];
    }
    if (!next || !next.id) return false;
    setUsedPhraseIds((prev) => prev.includes(next.id) ? prev : [...prev, next.id]);
    setCurrentPhrase(next);
    // Create blank indices for conversation sentence
    const koreanText = String(next.korean_text || next.korean || '').trim();
    if (!koreanText) return false;
    const words = koreanText.split(' ').filter(w => w);
    if (words.length === 0) return false;
    const desired = Math.max(1, Math.min(3, Number(numBlanks) || 1));
    // Get word types to exclude proper nouns
    const types = (next && wordTypesByPhraseId && wordTypesByPhraseId[next.id]) || null;
    const candidates = getCandidateBlankIndices(words, types);
    let candidatePool = candidates.length >= desired ? [...candidates] : words.map((_, i) => i);
    const chosen = [];
    while (chosen.length < desired && candidatePool.length > 0) {
      const idx = Math.floor(Math.random() * candidatePool.length);
      chosen.push(candidatePool[idx]);
      candidatePool.splice(idx, 1);
    }
    setRandomBlankIndices(chosen.sort((a, b) => a - b));
    setInputValues(new Array(chosen.length).fill(''));
    setCurrentBlankIndex(0);
    setShowAnswer(false);
    setFeedback('');
    return true;
  }, [conversationSession, usedPhraseIds, numBlanks, getCandidateBlankIndices, wordTypesByPhraseId]);

  // Extract first JSON object from a chat response
  const parseJsonObject = useCallback((text) => {
    if (!text) return null;
    const m = String(text).match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { const obj = JSON.parse(m[0]); return obj && typeof obj === 'object' ? obj : null; } catch (_) { return null; }
  }, []);

  // Remix current sentence: keep POS order, replace words/grammar; enter no-track mode
  const handleRemixSentence = useCallback(async () => {
    try {
      const en = String(currentPhrase?.english_text || '').trim();
      const ko = String(currentPhrase?.korean_text || '').trim();
      if (!en || !ko) return;
      setSessionNoTrack(true);
      const prompt = `Create ONE new sentence pair (Korean + English) by REMIXING the content of the given sentence while preserving the sequence of parts of speech (POS) and clause order. Keep it natural and grammatical. Replace verbs, nouns, adjectives, tenses, and particles as needed, but mirror the original POS silhouette. Return ONLY JSON with these keys: {"korean":"…","english":"…"}.\nOriginal (EN): ${en}\nOriginal (KO): ${ko}`;
      const res = await api.chat(prompt);
      const data = await res.json().catch(() => null);
      const obj = parseJsonObject(data && (data.response || ''));
      if (obj && obj.korean && obj.english) {
        setCurrentPhrase({ id: `remix-${Date.now()}`, korean_text: String(obj.korean), english_text: String(obj.english), times_correct: 0 });
        setFeedback('');
        setInputPlaceholder('');
        setInputValues([]);
        setCurrentBlankIndex(0);
        setShowAnswer(false);
        setShowAnswerBelow(false);
      }
    } catch (_) {}
  }, [currentPhrase, parseJsonObject]);

  // Add the current sentence to curriculum (manual save)
  const handleAddCurrentToCurriculum = useCallback(async () => {
    try {
      const en = String(currentPhrase?.english_text || '').trim();
      const ko = String(currentPhrase?.korean_text || '').trim();
      if (!en || !ko) return;
      const res = await api.addCurriculumPhrase({ korean_text: ko, english_text: en });
      if (res.ok) {
        setFeedback('Added to curriculum ✓');
      } else {
        const t = await res.text().catch(() => '');
        setFeedback('Failed to add to curriculum' + (t ? `: ${t}` : ''));
      }
    } catch (e) {
      setFeedback('Failed to add to curriculum');
    }
  }, [currentPhrase]);

  const speakText = useCallback((text, onEnd, repeatCount = 3) => {
    try {
      const synth = window.speechSynthesis;
      if (!synth || window.__APP_MUTED__ === true) {
        setTimeout(() => { if (onEnd) onEnd(); }, SPEAK_ADVANCE_DELAY_MS);
        return;
      }
      
      synth.cancel();
      
      let currentRepeat = 0;
      const globalSpeed = window.__APP_SPEECH_SPEED__ || 1.0;
      const speakOnce = () => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ko-KR';
        utterance.rate = 0.6 * globalSpeed;
        utterance.onend = () => {
          currentRepeat++;
          if (currentRepeat < repeatCount) {
            setTimeout(() => speakOnce(), 500);
          } else {
            setTimeout(() => { if (onEnd) onEnd(); }, SPEAK_ADVANCE_DELAY_MS);
          }
        };
        synth.speak(utterance);
      };
      
      speakOnce();
    } catch (e) {
      setTimeout(() => { if (onEnd) onEnd(); }, SPEAK_ADVANCE_DELAY_MS);
    }
  }, []);

  // Build full Korean sentence by replacing [BLANK] with the original words
  const getFullKoreanSentence = useCallback(() => {
    if (!blankPhrase) return '';
    const words = String(blankPhrase.korean || '').split(' ');
    let bi = 0;
    return words.map(w => {
      if (w === '[BLANK]') {
        const word = blankPhrase.blanks[bi] || '';
        bi++;
        return word;
      }
      return w;
    }).join(' ');
  }, [blankPhrase]);

  // Speak the full Korean sentence (with blanks filled) three times
  const handleSpeakFullThreeTimes = useCallback(() => {
    // Unmute if currently muted
    if (window.__APP_MUTED__ === true) {
      try {
        localStorage.setItem('app_muted', '0');
        window.__APP_MUTED__ = false;
      } catch (_) {}
    }
    try { const synth = window.speechSynthesis; if (synth) synth.cancel(); } catch (_) {}
    const full = getFullKoreanSentence();
    if (!full) return;
    speakText(full, null, 3);
  }, [getFullKoreanSentence, speakText]);

  // Load conversation sets from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('conversation_sets_v1');
      const arr = raw ? JSON.parse(raw) : [];
      setSavedConversations(Array.isArray(arr) ? arr : []);
    } catch (_) {
      setSavedConversations([]);
    }
  }, []);

  // Verb practice helpers (from AudioLearningPage)
  const PRONOUNS = [
    { ko: '나는', en: 'I' },
    { ko: '너는', en: 'you' },
    { ko: '우리는', en: 'we' },
    { ko: '그는', en: 'he' },
    { ko: '그녀는', en: 'she' },
    { ko: '그들은', en: 'they' },
  ];

  const pickRandomPronoun = useCallback(() => {
    return PRONOUNS[Math.floor(Math.random() * PRONOUNS.length)];
  }, []);

  const endsWithBrightVowel = (stem) => /[ㅏㅗ]$/.test(stem);

  const conjugateVerbSimple = useCallback((baseForm, tense) => {
    if (!baseForm || typeof baseForm !== 'string') return baseForm;
    const stem = baseForm.endsWith('다') ? baseForm.slice(0, -1 * '다'.length) : baseForm;
    // 하다 special
    if (baseForm === '하다' || stem.endsWith('하')) {
      if (tense === 'present') return '해요';
      if (tense === 'past') return '했어요';
      return '할 거예요';
    }
    const bright = endsWithBrightVowel(stem);
    if (tense === 'present') return stem + (bright ? '아요' : '어요');
    if (tense === 'past') return stem + (bright ? '았어요' : '었어요');
    // future
    const needsEu = /[^aeiou가-힣]$/.test(stem) || /[ㄱ-ㅎ]$/.test(stem);
    return stem + (stem.endsWith('ㄹ') ? ' 거예요' : (needsEu ? '을 거예요' : 'ㄹ 거예요'));
  }, []);


  // Convert mix item to phrase format
  const convertMixItemToPhrase = useCallback((item) => {
    if (!item) return null;
    if (item.type === 'curriculum') {
      return {
        korean_text: item.data.korean_text || '',
        english_text: item.data.english_text || '',
        blank_word_indices: item.data.blank_word_indices || [],
        correct_answers: item.data.correct_answers || [],
        id: item.id || `curriculum-${item.data.id}`,
        db_id: item.data.id,
        grammar_breakdown: item.data.explanation || item.data.grammar_breakdown || null // Use stored explanation if available
      };
    } else if (item.type === 'conversation') {
      return {
        korean_text: item.data.korean || '',
        english_text: item.data.english || '',
        blank_word_indices: [],
        correct_answers: [],
        id: item.id || `conversation-${item.conversationId}-${item.sentenceIndex}`,
        grammar_breakdown: item.data.explanation || null // Use stored explanation if available
      };
    } else if (item.type === 'verb_practice') {
      return {
        korean_text: item.data.korean_text || '',
        english_text: item.data.english_text || '',
        blank_word_indices: [],
        correct_answers: [],
        id: item.id || `verb-${Date.now()}`,
        grammar_breakdown: item.data.explanation || null // Use stored explanation if available
      };
    }
    return null;
  }, []);

  // Function to reload mix state (can be called when needed)
  // Defined after getCandidateBlankIndices and convertMixItemToPhrase to avoid dependency issues
  const reloadMixStateRef = React.useRef(false); // Prevent multiple simultaneous calls
  const reloadMixState = useCallback(async () => {
    if (practiceMode !== 4) return;
    
    // Prevent multiple simultaneous calls
    if (reloadMixStateRef.current) {
      console.log('ReloadMixState already in progress, skipping...');
      return;
    }
    reloadMixStateRef.current = true;
    
    try {
      setLoading(true);
      setError(null);
      console.log('Reloading mix state from database...');
      const res = await api.getMixState();
      console.log('Mix API response status:', res.status, res.ok);
      
      if (res.ok) {
        const state = await res.json();
        console.log('Mix state loaded - current_index:', state.current_index, 'total items:', state.mix_items?.length);
        
        // Set mix state (similar to MixPage - don't validate here, just set it)
        if (state) {
          console.log('Setting mix state with', state.mix_items?.length || 0, 'items, current_index:', state.current_index);
          // Ensure current_index is a number
          if (typeof state.current_index !== 'number') {
            state.current_index = 0;
            console.warn('Fixed invalid current_index, setting to 0');
          }
          setMixState(state);
          
          // Validate and load items
          if (state.mix_items && Array.isArray(state.mix_items) && state.mix_items.length > 0) {
            // Load previous conversation sentences for random repeats
            const convItems = state.mix_items.filter(item => item.type === 'conversation');
            setPreviousConversationSentences(convItems);
            // Load current item at current_index directly (no skipping)
            // After reset, current_index should be 0, so we load the first item
            let currentIndex = typeof state.current_index === 'number' ? state.current_index : 0;
            // Ensure index is valid (0 to length-1)
            if (currentIndex < 0) currentIndex = 0;
            if (currentIndex >= state.mix_items.length) {
              console.warn('currentIndex out of bounds, resetting to 0. currentIndex:', currentIndex, 'length:', state.mix_items.length);
              currentIndex = 0;
              // Update the database to fix the invalid index
              api.updateMixIndex(0).catch(err => console.error('Failed to fix index:', err));
            }
            console.log('reloadMixState - currentIndex:', currentIndex, 'total items:', state.mix_items.length, 'state.current_index:', state.current_index);
            if (currentIndex < state.mix_items.length) {
              const currentItem = state.mix_items[currentIndex];
              console.log('Loading phrase at index', currentIndex, 'directly (no skipping)');
              console.log('Current item:', currentItem);
              const phrase = convertMixItemToPhrase(currentItem);
              console.log('Converted phrase:', phrase);
              if (phrase) {
                console.log('Setting current phrase:', phrase.korean_text, phrase.english_text);
                setCurrentPhrase(phrase);
                const words = phrase.korean_text.trim().split(' ').filter(w => w);
                const desired = Math.max(1, Math.min(3, Number(numBlanks) || 1));
                const candidates = getCandidateBlankIndices(words, null);
                let pool = candidates.length >= desired ? [...candidates] : words.map((_, i) => i);
                const chosen = [];
                while (chosen.length < desired && pool.length > 0) {
                  const idx = Math.floor(Math.random() * pool.length);
                  chosen.push(pool[idx]);
                  pool.splice(idx, 1);
                }
                setRandomBlankIndices(chosen.sort((a, b) => a - b));
                setInputValues(new Array(chosen.length).fill(''));
                setCurrentBlankIndex(0);
                // Keep explanation from previous question - don't clear it
              } else {
                console.warn('Failed to convert mix item to phrase:', currentItem);
                setError('Failed to load current mix item. Please try again.');
              }
            } else {
              setError('Mix completed! Generate a new mix to continue.');
            }
          } else {
            console.warn('Mix state has no items or empty array:', {
              hasMixItems: !!state.mix_items,
              isArray: Array.isArray(state.mix_items),
              length: state.mix_items?.length
            });
            setError('Mix found but has no items. Generate a new mix in the Mix page.');
          }
        } else {
          console.warn('Mix state is null or undefined');
          setError('No mix found. Generate a mix in the Mix page first.');
        }
      } else if (res.status === 404) {
        console.log('Mix state not found (404)');
        setError('No mix found. Generate a mix in the Mix page first.');
      } else {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Mix API error:', res.status, errorData);
        setError(`Failed to load mix: ${errorData.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error reloading mix state:', err);
      setError('Failed to load mix. Generate a mix in the Mix page first.');
    } finally {
      setLoading(false);
      reloadMixStateRef.current = false;
    }
  }, [practiceMode, numBlanks, getCandidateBlankIndices, convertMixItemToPhrase]);
  
  // Reload mix state when practiceMode changes to 4 or when page becomes visible
  // This MUST run BEFORE the useEffect that calls fetchRandomPhrase
  useEffect(() => {
    if (practiceMode === 4) {
      console.log('Practice mode is 4 (mix), calling reloadMixState immediately...');
      // Set loading to true immediately to prevent other effects from fetching a phrase
      setLoading(true);
      // Clear any existing phrase from a different mode
      if (currentPhrase && !mixState) {
        console.log('Clearing currentPhrase - waiting for mix state to load');
        setCurrentPhrase(null);
      }
      // Load mix state when switching to mix mode - call immediately on mount
      reloadMixState();
      
      // Also reload when page becomes visible (in case mix was generated in another tab)
      const handleVisibilityChange = () => {
        if (!document.hidden && practiceMode === 4) {
          reloadMixState();
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    } else {
      // If switching away from mix mode, clear mix state
      if (mixState) {
        setMixState(null);
      }
    }
  }, [practiceMode, reloadMixState]);
  
  // Also ensure mix state loads on initial mount if practiceMode is 4
  useEffect(() => {
    if (practiceMode === 4 && !mixState && !loading && !currentPhrase) {
      console.log('Initial mount with practiceMode 4, loading mix state...');
      setLoading(true);
      reloadMixState();
    }
  }, []); // Run only on mount

  // Get next sentence from conversation sets (Mode 3)
  const getNextConversationSentence = useCallback(() => {
    if (!Array.isArray(savedConversations) || savedConversations.length === 0) return null;
    
    // Get current conversation
    const conv = savedConversations[currentConversationIndex];
    if (!conv || !Array.isArray(conv.items) || conv.items.length === 0) {
      // Move to next conversation
      const nextConvIndex = (currentConversationIndex + 1) % savedConversations.length;
      setCurrentConversationIndex(nextConvIndex);
      setCurrentSentenceIndex(0);
      const nextConv = savedConversations[nextConvIndex];
      if (!nextConv || !Array.isArray(nextConv.items) || nextConv.items.length === 0) return null;
      const firstSent = nextConv.items[0];
      return { korean_text: String(firstSent.korean || ''), english_text: String(firstSent.english || ''), id: `conv-${nextConv.id}-0` };
    }

    // Get current sentence
    const sent = conv.items[currentSentenceIndex];
    if (!sent) {
      // Move to next conversation
      const nextConvIndex = (currentConversationIndex + 1) % savedConversations.length;
      setCurrentConversationIndex(nextConvIndex);
      setCurrentSentenceIndex(0);
      const nextConv = savedConversations[nextConvIndex];
      if (!nextConv || !Array.isArray(nextConv.items) || nextConv.items.length === 0) return null;
      const firstSent = nextConv.items[0];
      return { korean_text: String(firstSent.korean || ''), english_text: String(firstSent.english || ''), id: `conv-${nextConv.id}-0` };
    }

    // Move to next sentence
    const nextSentIndex = (currentSentenceIndex + 1) % conv.items.length;
    if (nextSentIndex === 0) {
      // Move to next conversation
      const nextConvIndex = (currentConversationIndex + 1) % savedConversations.length;
      setCurrentConversationIndex(nextConvIndex);
    } else {
      setCurrentSentenceIndex(nextSentIndex);
    }

    return { 
      korean_text: String(sent.korean || ''), 
      english_text: String(sent.english || ''), 
      id: `conv-${conv.id}-${currentSentenceIndex}`,
      englishWordMapping: sent.englishWordMapping || null // Preserve pre-computed mapping
    };
  }, [savedConversations, currentConversationIndex, currentSentenceIndex]);

  // Load all curriculum phrases on mount
  const loadAllPhrases = useCallback(async () => {
    // Skip loading curriculum phrases for mix mode - not needed
    if (practiceMode === 4) {
      console.log('Skipping loadAllPhrases - mix mode does not need curriculum phrases');
      return;
    }
    
    try {
      const response = await api.getCurriculumPhrases();
      if (!response.ok) {
        console.error('Failed to load phrases');
        return;
      }
      const phrases = await response.json();
      const listRaw = Array.isArray(phrases) ? phrases : [];
      // Sort by earliest added first (created_at/date_added ascending; fallback to numeric id)
      const normTs = (p) => {
        const ts = p && (p.created_at || p.date_added || p.createdAt || p.added_at);
        if (!ts) return null;
        const n = Number(ts);
        if (!Number.isNaN(n) && n > 0) return n;
        const d = Date.parse(String(ts));
        return Number.isNaN(d) ? null : d;
      };
      const list = [...listRaw].sort((a, b) => {
        const ta = normTs(a);
        const tb = normTs(b);
        if (ta !== null && tb !== null) return ta - tb;
        if (ta !== null) return -1;
        if (tb !== null) return 1;
        const ida = Number(a && a.id);
        const idb = Number(b && b.id);
        if (!Number.isNaN(ida) && !Number.isNaN(idb)) return ida - idb;
        return 0;
      });
      setAllPhrases(list);
      console.log('Loaded', list.length, 'curriculum phrases');
      // Initialize first session subset (first 5)
      const firstSubset = list.slice(0, Math.min(SESSION_SIZE, list.length));
      setSessionPage(0);
      setSessionPhrases(firstSubset);
      setUsedPhraseIds([]);
      if (firstSubset.length > 0) {
        setCurrentPhrase(firstSubset[0]);
      } else {
        setCurrentPhrase(null);
      }
    } catch (e) {
      console.error('Error loading phrases:', e);
    }
  }, [practiceMode]);

  // Lightweight POS tagging for current session phrases (cache per phrase id)
  const tagPhraseWordTypes = useCallback(async (phrase) => {
    try {
      const ko = String(phrase?.korean_text || '').trim();
      if (!ko) return null;
      const prompt = `Return ONLY JSON with this format: {"tokens":["..."],"types":["..."]}. 
Tokens must be the exact Korean tokens split by spaces from the given sentence, in order.
Types must be one of: pronoun, noun, proper noun, verb, adjective, adverb, particle, numeral, determiner, interjection, other.
Korean: ${ko}`;
      const res = await api.chat(prompt);
      if (!res || !res.ok) return null;
      const data = await res.json().catch(() => null);
      const text = data && (data.response || '');
      const m = String(text).match(/\{[\s\S]*\}/);
      if (!m) return null;
      let obj = null;
      try { obj = JSON.parse(m[0]); } catch (_) { return null; }
      const tokens = Array.isArray(obj && obj.tokens) ? obj.tokens : null;
      const types = Array.isArray(obj && obj.types) ? obj.types : null;
      if (!tokens || !types || tokens.length !== types.length) return null;
      return types;
    } catch (_) {
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const subset = Array.isArray(sessionPhrases) ? sessionPhrases.slice(0, SESSION_SIZE) : [];
      const updates = {};
      const toCodes = (t) => {
        const s = String(t || '').toLowerCase();
        if (s.includes('proper')) return 3;
        if (s.includes('pronoun')) return 1;
        if (s.includes('verb')) return 4;
        if (s.includes('adjective')) return 5;
        if (s.includes('adverb')) return 6;
        if (s.includes('particle') || s.includes('postposition')) return 7;
        if (s.includes('numeral') || s.includes('number')) return 8;
        if (s.includes('determiner') || s.includes('det')) return 9;
        if (s.includes('interjection')) return 10;
        if (s.includes('noun')) return 2;
        return 0;
      };
      await Promise.all(subset.map(async (p) => {
        const pid = p && p.id;
        if (!pid) return;
        if (wordTypesByPhraseId && wordTypesByPhraseId[pid]) return;
        const types = await tagPhraseWordTypes(p);
        if (!cancelled && types && Array.isArray(types)) {
          updates[pid] = types;
        }
      }));
      if (!cancelled && Object.keys(updates).length > 0) {
        setWordTypesByPhraseId(prev => ({ ...prev, ...updates }));
        // Persist to backend for each phrase with new tags
        try {
          await Promise.all(
            subset.map(async (p) => {
              const pid = p && p.id;
              if (!pid || !updates[pid]) return;
              try {
                await api.updateCurriculumPhrase(pid, {
                  korean_text: p.korean_text,
                  english_text: p.english_text,
                  // Preserve blanks and metadata if present
                  blank_word_indices: Array.isArray(p.blank_word_indices) ? p.blank_word_indices : [],
                  correct_answers: Array.isArray(p.correct_answers) ? p.correct_answers : [],
                  grammar_breakdown: p.grammar_breakdown || null,
                  blank_word_types: Array.isArray(p.blank_word_types) ? p.blank_word_types : [],
                  word_types: updates[pid],
                  word_type_codes: updates[pid].map(toCodes)
                });
              } catch (_) {}
            })
          );
        } catch (_) {}
      }
    })();
    return () => { cancelled = true; };
  }, [sessionPhrases, tagPhraseWordTypes]); 

  // Fetch word types for conversation sentences
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const subset = Array.isArray(conversationSession) ? conversationSession : [];
      const updates = {};
      await Promise.all(subset.map(async (p) => {
        const pid = p && p.id;
        if (!pid) return;
        if (wordTypesByPhraseId && wordTypesByPhraseId[pid]) return;
        const types = await tagPhraseWordTypes(p);
        if (!cancelled && types && Array.isArray(types)) {
          updates[pid] = types;
        }
      }));
      if (!cancelled && Object.keys(updates).length > 0) {
        setWordTypesByPhraseId(prev => ({ ...prev, ...updates }));
      }
    })();
    return () => { cancelled = true; };
  }, [conversationSession, tagPhraseWordTypes, wordTypesByPhraseId]);

  // Generate a variation of a phrase using AI
  const generateVariation = useCallback(async (basePhrase) => {
    try {
      console.log('Generating variation for phrase:', basePhrase.id);
      
      // Get words by type for each blank
      const blankIndices = basePhrase.blank_word_indices || [];
      const blankTypes = basePhrase.blank_word_types || [];
      
      // Fetch words for each blank type
      const wordOptions = {};
      for (let i = 0; i < blankTypes.length; i++) {
        const wordType = blankTypes[i];
        if (!wordType) continue;
        
        if (!wordOptions[wordType]) {
          try {
            const wordsRes = await api.getWordsByType(wordType, 50);
            if (wordsRes.ok) {
              const words = await wordsRes.json();
              wordOptions[wordType] = words.map(w => w.korean || w.korean_word).filter(Boolean);
            }
          } catch (e) {
            console.error(`Failed to fetch ${wordType} words:`, e);
          }
        }
      }
      
      // Build prompt for AI to generate variation
      const koreanWords = basePhrase.korean_text.trim().split(' ').filter(w => w);
      const blankInfo = blankIndices.map((idx, i) => {
        const word = koreanWords[idx];
        const type = blankTypes[i] || 'unknown';
        const options = wordOptions[type] || [];
        return {
          index: idx,
          word: word,
          type: type,
          options: options.slice(0, 10).join(', ') // Top 10 options
        };
      });
      
      const prompt = `Generate a Korean sentence variation by replacing some blank words in this sentence.

Original Korean: ${basePhrase.korean_text}
Original English: ${basePhrase.english_text}

Blank words to replace:
${blankInfo.map((b, i) => `Blank ${i + 1} (index ${b.index}): "${b.word}" (type: ${b.type}). Suggested replacements: ${b.options || 'any appropriate ' + b.type}`).join('\n')}

Generate a new Korean sentence with the same structure and meaning, but replace one or more of the blank words with other appropriate words of the same type. Keep the sentence grammatically correct and natural.

Respond with ONLY a JSON object in this format:
{
  "korean_text": "new sentence with replaced words",
  "english_text": "translation of new sentence",
  "replaced_blanks": [list of blank indices that were replaced]
}`;

      let chatRes;
      try {
        chatRes = await api.chat(prompt);
      } catch (fetchError) {
        console.error('Network error calling chat API:', fetchError);
        throw new Error('Failed to connect to AI service. Please make sure the backend server is running.');
      }
      
      if (!chatRes.ok) {
        const errorText = await chatRes.text().catch(() => '');
        throw new Error(`AI service returned error: ${chatRes.status}${errorText ? ` - ${errorText}` : ''}`);
      }
      
      const chatData = await chatRes.json();
      const responseText = chatData.response || '';
      
      // Extract JSON from response - try to find the first complete JSON object
      let variation = null;
      let jsonStart = responseText.indexOf('{');
      
      if (jsonStart === -1) {
        throw new Error('No JSON object found in response');
      }
      
      // Find the matching closing brace by counting braces
      let braceCount = 0;
      let jsonEnd = -1;
      for (let i = jsonStart; i < responseText.length; i++) {
        if (responseText[i] === '{') {
          braceCount++;
        } else if (responseText[i] === '}') {
          braceCount--;
          if (braceCount === 0) {
            jsonEnd = i + 1;
            break;
          }
        }
      }
      
      if (jsonEnd === -1) {
        throw new Error('Incomplete JSON object in response');
      }
      
      const jsonString = responseText.substring(jsonStart, jsonEnd);
      try {
        variation = JSON.parse(jsonString);
      } catch (parseError) {
        console.error('JSON parsing error:', parseError);
        console.error('Attempted to parse:', jsonString);
        throw new Error(`Failed to parse JSON: ${parseError.message}`);
      }
      
      // Create a new phrase object based on the variation
      const newPhrase = {
        ...basePhrase,
        korean_text: variation.korean_text,
        english_text: variation.english_text,
        id: `variation-${Date.now()}`, // Temporary ID for variations
        // Ensure blank_word_indices, correct_answers, and blank_word_types are preserved
        blank_word_indices: basePhrase.blank_word_indices || [],
        correct_answers: basePhrase.correct_answers || [],
        blank_word_types: basePhrase.blank_word_types || []
      };
      
      console.log('[VARIATION] Created variation phrase object:', {
        id: newPhrase.id,
        korean_text: newPhrase.korean_text,
        english_text: newPhrase.english_text,
        blank_word_indices: newPhrase.blank_word_indices,
        correct_answers: newPhrase.correct_answers,
        blank_word_types: newPhrase.blank_word_types,
        has_grammar_breakdown: !!newPhrase.grammar_breakdown
      });
      
      // Immediately add the variation to the curriculum
      console.log('[VARIATION] ===== Adding variation to curriculum immediately =====');
      try {
        const phraseData = {
          korean_text: newPhrase.korean_text,
          english_text: newPhrase.english_text,
          blank_word_indices: newPhrase.blank_word_indices || [],
          correct_answers: newPhrase.correct_answers || [],
          grammar_breakdown: newPhrase.grammar_breakdown || null,
          blank_word_types: newPhrase.blank_word_types || []
        };
        console.log('[VARIATION] Sending variation data to API:', JSON.stringify(phraseData, null, 2));
        
        const addRes = await api.addCurriculumPhrase(phraseData);
        console.log('[VARIATION] Add to curriculum API response status:', addRes.status, addRes.statusText);
        console.log('[VARIATION] Add to curriculum API response ok:', addRes.ok);
        
        if (addRes.ok) {
          const responseData = await addRes.json().catch(() => null);
          console.log('[VARIATION] Add to curriculum API response data:', responseData);
          
          // Update the variation object with the actual database ID
          if (responseData && responseData.id) {
            newPhrase.id = responseData.id;
            newPhrase.db_id = responseData.id;
            console.log('[VARIATION] ✓ Variation added to curriculum with ID:', responseData.id);
          } else {
            console.log('[VARIATION] ✓ Variation added to curriculum (response ID not found)');
          }
          
          // Reload phrases list to include the new one
          console.log('[VARIATION] Reloading phrases list...');
          const phrasesRes = await api.getCurriculumPhrases();
          if (phrasesRes.ok) {
          const phrases = await phrasesRes.json();
          const listRaw = Array.isArray(phrases) ? phrases : [];
          const normTs = (p) => {
            const ts = p && (p.created_at || p.date_added || p.createdAt || p.added_at);
            if (!ts) return null;
            const n = Number(ts);
            if (!Number.isNaN(n) && n > 0) return n;
            const d = Date.parse(String(ts));
            return Number.isNaN(d) ? null : d;
          };
          const listSorted = [...listRaw].sort((a, b) => {
            const ta = normTs(a);
            const tb = normTs(b);
            if (ta !== null && tb !== null) return ta - tb;
            if (ta !== null) return -1;
            if (tb !== null) return 1;
            const ida = Number(a && a.id);
            const idb = Number(b && b.id);
            if (!Number.isNaN(ida) && !Number.isNaN(idb)) return ida - idb;
            return 0;
          });
          console.log('[VARIATION] Loaded phrases count:', listSorted.length);
          setAllPhrases(listSorted);
          console.log('[VARIATION] ✓ Phrases list reloaded (sorted by created_at)');
          }
        } else {
          const errorText = await addRes.text().catch(() => '');
          console.error('[VARIATION] ✗ Failed to add variation to curriculum');
          console.error('[VARIATION] Error status:', addRes.status);
          console.error('[VARIATION] Error text:', errorText);
        }
      } catch (addError) {
        console.error('[VARIATION] ✗ Exception while adding variation to curriculum:', addError);
        console.error('[VARIATION] Error stack:', addError.stack);
      }
      console.log('[VARIATION] ===== Finished adding variation to curriculum =====');
      
      return newPhrase;
    } catch (e) {
      console.error('Error generating variation:', e);
      throw e;
    }
  }, [setAllPhrases]);

  const fetchRandomPhrase = useCallback(async () => {
    // Don't fetch if in mix mode - mix mode uses reloadMixState instead
    if (practiceMode === 4) {
      console.log('fetchRandomPhrase called but practiceMode is 4 (mix mode), skipping');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      
      let data;
      
      // Mode 2: Verb practice
      if (practiceMode === 2) {
        const result = await generateVerbPracticeSentence();
        if (result && result.korean && result.english) {
          data = {
            korean_text: result.korean,
            english_text: result.english,
            id: `verb-${Date.now()}-${Math.random()}`
          };
        }
        if (!data) {
          setError('Failed to generate verb practice sentence. Please try again.');
          setLoading(false);
          return;
        }
        setCurrentPhrase(data);
        // Create blank indices for verb practice (prioritize verbs)
        const words = data.korean_text.trim().split(' ').filter(w => w);
        const desired = Math.max(1, Math.min(3, Number(numBlanks) || 1));
        const chosen = selectBlankIndicesWithVerbPriority(words, null, desired, 2);
        setRandomBlankIndices(chosen);
        const blankIndices = chosen.sort((a, b) => a - b);
        setInputValues(new Array(blankIndices.length).fill(''));
        setCurrentBlankIndex(0);
        // Keep explanation from previous question - don't clear it
        setShowAnswer(false);
        setShowAnswerBelow(false);
        setLoading(false);
        return;
      }

      // Mode 4: Mix mode
      if (practiceMode === 4) {
        if (!mixState || !mixState.mix_items || mixState.mix_items.length === 0) {
          setError('No mix found. Generate a mix in the Mix page first!');
          setLoading(false);
          return;
        }

        // Randomly repeat from previous conversations (20% chance)
        if (previousConversationSentences.length > 0 && Math.random() < 0.2) {
          const randomPrev = previousConversationSentences[Math.floor(Math.random() * previousConversationSentences.length)];
          data = convertMixItemToPhrase(randomPrev);
          if (data) {
            setCurrentPhrase(data);
            const words = data.korean_text.trim().split(' ').filter(w => w);
            const desired = Math.max(1, Math.min(3, Number(numBlanks) || 1));
            const candidates = getCandidateBlankIndices(words, null);
            let pool = candidates.length >= desired ? [...candidates] : words.map((_, i) => i);
            const chosen = [];
            while (chosen.length < desired && pool.length > 0) {
              const idx = Math.floor(Math.random() * pool.length);
              chosen.push(pool[idx]);
              pool.splice(idx, 1);
            }
            setRandomBlankIndices(chosen.sort((a, b) => a - b));
            setInputValues(new Array(chosen.length).fill(''));
            setCurrentBlankIndex(0);
            // Keep explanation from previous question - don't clear it
            setShowAnswer(false);
            setLoading(false);
            return;
          }
        }

        // Otherwise, get current item from mix
        const currentIndex = mixState.current_index || 0;
        if (currentIndex >= mixState.mix_items.length) {
          setError('Mix completed! Generate a new mix to continue.');
          setLoading(false);
          return;
        }

        const currentItem = mixState.mix_items[currentIndex];
        data = convertMixItemToPhrase(currentItem);
        if (!data) {
          setError('Invalid mix item. Please generate a new mix.');
          setLoading(false);
          return;
        }
        setCurrentPhrase(data);
        // Create blank indices
        const words = data.korean_text.trim().split(' ').filter(w => w);
        const desired = Math.max(1, Math.min(3, Number(numBlanks) || 1));
        const candidates = getCandidateBlankIndices(words, null);
        let pool = candidates.length >= desired ? [...candidates] : words.map((_, i) => i);
        const chosen = [];
        while (chosen.length < desired && pool.length > 0) {
          const idx = Math.floor(Math.random() * pool.length);
          chosen.push(pool[idx]);
          pool.splice(idx, 1);
        }
        setRandomBlankIndices(chosen.sort((a, b) => a - b));
        setInputValues(new Array(chosen.length).fill(''));
        setCurrentBlankIndex(0);
        // Keep explanation from previous question - don't clear it
        setShowAnswer(false);
        setShowAnswerBelow(false);
        setLoading(false);
        return;
      }

      // Mode 3: Conversation sets
      if (practiceMode === 3) {
        data = getNextConversationSentence();
        if (!data) {
          setError('No conversation sets found. Create some in Audio Learning page first!');
          setLoading(false);
          return;
        }
        setCurrentPhrase(data);
        // Create blank indices for conversation sentence
        const words = data.korean_text.trim().split(' ').filter(w => w);
        const desired = Math.max(1, Math.min(3, Number(numBlanks) || 1));
        const candidates = getCandidateBlankIndices(words, null);
        let pool = candidates.length >= desired ? [...candidates] : words.map((_, i) => i);
        const chosen = [];
        while (chosen.length < desired && pool.length > 0) {
          const idx = Math.floor(Math.random() * pool.length);
          chosen.push(pool[idx]);
          pool.splice(idx, 1);
        }
        setRandomBlankIndices(chosen.sort((a, b) => a - b));
        const blankIndices = chosen.sort((a, b) => a - b);
        setInputValues(new Array(blankIndices.length).fill(''));
        setCurrentBlankIndex(0);
        // Keep explanation from previous question - don't clear it
        setShowAnswer(false);
        setShowAnswerBelow(false);
        setLoading(false);
        return;
      }

      // Mode 1: Normal curriculum practice
      // First, try to use an unused phrase from our list
      if (allPhrases.length > 0) {
        const unusedPhrases = allPhrases.filter(p => !usedPhraseIds.includes(p.id));
        
        if (unusedPhrases.length > 0) {
          // Pick a random unused phrase
          const randomIndex = Math.floor(Math.random() * unusedPhrases.length);
          const selectedPhrase = unusedPhrases[randomIndex];
          
          console.log('Using phrase from curriculum:', selectedPhrase.id);
          data = selectedPhrase;
          setUsedPhraseIds(prev => [...prev, selectedPhrase.id]);
          setUsingVariations(false);
        } else {
          // All phrases used, generate a variation
          console.log('All phrases used, generating variation...');
          setUsingVariations(true);
          
          // Pick a random base phrase to vary
          const randomBaseIndex = Math.floor(Math.random() * allPhrases.length);
          const basePhrase = allPhrases[randomBaseIndex];
          
          try {
            // Generate variation
            data = await generateVariation(basePhrase);
            console.log('Generated variation:', data);
          } catch (variationError) {
            console.error('Failed to generate variation:', variationError);
            // If AI generation fails, reset used phrases and cycle through again
            // This prevents getting stuck when AI is unavailable
            setUsedPhraseIds([]);
            setUsingVariations(false);
            
            // Pick a random phrase from the list
            const fallbackIndex = Math.floor(Math.random() * allPhrases.length);
            data = allPhrases[fallbackIndex];
            setUsedPhraseIds([data.id]);
            
            throw new Error(`Failed to generate AI variation: ${variationError.message}. Cycling through curriculum phrases again.`);
          }
        }
      } else {
        // Fallback to API if we haven't loaded phrases yet
        console.log('Fetching random curriculum phrase from API...');
        const response = await api.getRandomCurriculumPhrase();
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('No curriculum phrases found. Add some phrases to the curriculum first!');
            setLoading(false);
            return;
          }
          const errorText = await response.text().catch(() => '');
          throw new Error(`HTTP error! status: ${response.status}${errorText ? ` - ${errorText}` : ''}`);
        }
        
        data = await response.json();
      }
      
      setCurrentPhrase(data);
      // Initialize input values based on number of blanks
      const blankIndices = data.blank_word_indices || (data.blank_word_index !== null && data.blank_word_index !== undefined ? [data.blank_word_index] : []);
      setInputValues(new Array(blankIndices.length).fill(''));
      setCurrentBlankIndex(0);
      // Keep explanation from previous question - don't clear it
      setShowAnswer(false);
      setShowAnswerBelow(false);
      setLoading(false);
      console.log('Fetch completed successfully');
    } catch (e) {
      console.error('Error fetching random phrase:', e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(errorMessage || 'Failed to load phrase. Please try again.');
      setLoading(false);
      console.log('Error state set, loading set to false');
    }
  }, [allPhrases, usedPhraseIds, generateVariation, practiceMode, getNextConversationSentence, numBlanks, getCandidateBlankIndices, mixState, previousConversationSentences, convertMixItemToPhrase]);

  const fetchExplanation = useCallback(async () => {
    if (!currentPhrase || !blankPhrase) return;
    const currentId = blankPhrase.id || currentPhrase.id;
    if (explanationText && explanationPhraseId === currentId) {
      // Already have explanation for this phrase
      return;
    }
    setIsLoadingExplanation(true);
    try {
      // Use stored grammar breakdown/explanation if available (from mix or curriculum)
      if (currentPhrase.grammar_breakdown) {
        setExplanationText(currentPhrase.grammar_breakdown);
        setExplanationPhraseId(currentId);
        setIsLoadingExplanation(false);
        return;
      }
      
      // Reconstruct full Korean sentence (replace all [BLANK]s with actual words)
      const words = blankPhrase.korean.split(' ');
      let blankIdx = 0;
      const fullKorean = words.map(w => {
        if (w === '[BLANK]') {
          const word = blankPhrase.blanks[blankIdx] || '';
          blankIdx++;
          return word;
        }
        return w;
      }).join(' ');
      
      const english = blankPhrase.translation;
      
      // Determine phrase type and ID for database lookup
      let phraseType = 'curriculum';
      let phraseId = currentId;
      
      if (practiceMode === 4 && mixState && mixState.mix_items) {
        // Mix mode - determine type from mix item
        const currentItem = mixState.mix_items[mixState.current_index];
        if (currentItem) {
          phraseType = currentItem.type || 'mix';
          phraseId = currentItem.id || currentId;
        }
      } else if (practiceMode === 3) {
        phraseType = 'conversation';
      } else if (practiceMode === 2) {
        phraseType = 'verb_practice';
      } else if (practiceMode === 1) {
        phraseType = 'curriculum';
        // For curriculum, use db_id if available
        phraseId = currentPhrase.db_id || currentId;
      }
      
      // Try to get explanation from database first
      try {
        const explanationRes = await api.getExplanation(phraseId, phraseType);
        if (explanationRes.ok) {
          const explanationData = await explanationRes.json();
          if (explanationData.explanation) {
            setExplanationText(explanationData.explanation);
            setExplanationPhraseId(currentId);
            setIsLoadingExplanation(false);
            return;
          }
        }
      } catch (dbErr) {
        // If database lookup fails, try by text as fallback
        try {
          const textRes = await api.getExplanationByText(fullKorean, english);
          if (textRes.ok) {
            const textData = await textRes.json();
            if (textData.explanation) {
              setExplanationText(textData.explanation);
              setExplanationPhraseId(currentId);
              setIsLoadingExplanation(false);
              // Also save it with the current phrase ID for future lookups
              try {
                console.log('[Explanation] Attempting to save explanation from text lookup:', { phraseId, phraseType });
                const saveRes = await api.saveExplanation(phraseId, phraseType, fullKorean, english, textData.explanation);
                if (saveRes.ok) {
                  console.log('[Explanation] ✓ Successfully saved explanation from text lookup');
                } else {
                  const errorText = await saveRes.text().catch(() => 'Unknown error');
                  console.error('[Explanation] ✗ Failed to save explanation from text lookup:', saveRes.status, errorText);
                }
              } catch (saveErr) {
                console.error('[Explanation] ✗ Exception while saving explanation from text lookup:', saveErr);
              }
              return;
            }
          }
        } catch (_) {}
      }
      
      // If not in database, generate explanation via AI
      const prompt = `Explain this Korean sentence concisely (keep under 15 lines total).
Korean: ${fullKorean}
English: ${english}

Format your response as follows:

#### Grammar Rules Involving Endings Based on Consonant/Vowel (받침 Rules)
- State whether the verb/adjective stem ends with a consonant (받침) or vowel (no 받침)
- Explain how endings change based on 받침 presence (e.g., "The verb '일어나다' has a stem ending in a vowel ('일어'), and it takes '났어' for the past tense in an informal polite form.")
- If applicable, mention consonant assimilation rules (e.g., ㄷ irregular verbs, ㅂ irregular verbs, ㄹ irregular verbs)
- If applicable, mention vowel harmony rules
- If applicable, mention 받침-related sound changes or contractions
- If none apply, state "No specific [rule type] applies here."

#### Breakdown of the Sentence

##### Particles and Their Functions
List each particle with its function (e.g., "은 (은/는): Topic marker. '오늘은' indicates that '오늘' is the topic of the sentence.")

##### Tense and Politeness Levels
State the tense and politeness level with brief explanation.

##### Vocabulary with Brief Glosses
List key vocabulary words with brief English translations.

##### Verb/Adjective Root Forms and Conjugations
Format as a table to save space:
| Form | Value |
|------|-------|
| Root | [dictionary form ending in 다 of the verb/adjective that carries the tense and politeness markers in the sentence. Identify the word that is actually conjugated (has tense/politeness endings like -어요, -아요, -을 거예요, etc.), not other verbs/adjectives that appear as nouns or in other forms. For example, in "행복을 들 거예요", the root is "듣다" (the verb being conjugated), not "행복하다" (which appears as a noun "행복을")] |
| Conjugation | [the actual conjugated verb/adjective form as it appears in the sentence, e.g., "들 거예요" from "듣다"] |

Keep the entire explanation under 15 lines. Be concise and focus only on the essential grammar points.
IMPORTANT: Do NOT include romanizations (like "naeil" or "mollayo") in your explanation. Only use Korean characters and English translations.`;
      const res = await api.chat(prompt);
      if (res.ok) {
        const data = await res.json();
        const text = data.response || '';
        setExplanationText(text);
        setExplanationPhraseId(currentId);
        
        // Save explanation to database for future use
        try {
          console.log('[Explanation] Attempting to save explanation:', { phraseId, phraseType, koreanLength: fullKorean.length, englishLength: english.length, explanationLength: text.length });
          const saveRes = await api.saveExplanation(phraseId, phraseType, fullKorean, english, text);
          if (saveRes.ok) {
            console.log('[Explanation] ✓ Successfully saved explanation to database');
          } else {
            const errorText = await saveRes.text().catch(() => 'Unknown error');
            console.error('[Explanation] ✗ Failed to save explanation:', saveRes.status, errorText);
          }
        } catch (saveErr) {
          console.error('[Explanation] ✗ Exception while saving explanation to database:', saveErr);
          // Don't fail the request if saving fails
        }
      }
    } catch (_) {
      setExplanationText('Failed to load explanation.');
    } finally {
      setIsLoadingExplanation(false);
    }
  }, [currentPhrase, blankPhrase, explanationText, explanationPhraseId, practiceMode, mixState]);

  const handleToggleExplanation = useCallback(() => {
    setShowExplanation(v => {
      const currentId = blankPhrase?.id || currentPhrase?.id;
      if (!v && (!explanationText || explanationPhraseId !== currentId) && !isLoadingExplanation) {
        fetchExplanation();
      }
      return !v;
    });
  }, [showExplanation, explanationText, explanationPhraseId, isLoadingExplanation, fetchExplanation, blankPhrase, currentPhrase]);

  // Load all phrases on mount (loadAllPhrases now handles mix mode check internally)
  useEffect(() => {
    loadAllPhrases();
  }, [loadAllPhrases]);

  useEffect(() => {
    console.log('useEffect triggered - currentPhrase:', currentPhrase, 'loading:', loading, 'error:', error, 'practiceMode:', practiceMode);
    // Skip if in mix mode - reloadMixState will handle loading the phrase at current_index
    if (practiceMode === 4) {
      console.log('Skipping fetchRandomPhrase - mix mode, reloadMixState will handle it');
      // Don't do anything here - reloadMixState will load the phrase at current_index directly
      return;
    }
    // Fetch on mount if we don't have a phrase yet, or if we're not currently loading/errored
    if (!currentPhrase && !loading && !error) {
      console.log('Calling fetchRandomPhrase...');
      fetchRandomPhrase();
    } else {
      console.log('Skipping fetch - currentPhrase:', !!currentPhrase, 'loading:', loading, 'error:', !!error);
    }
    // If there's an error and no phrase, don't keep trying - let user manually retry
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceMode]); // Only run when practiceMode changes, not on every state change

  // Recompute session subset when page or full list changes (Mode 1: Curriculum only)
  useEffect(() => {
    if (practiceMode !== 1) return; // Only update session for curriculum mode
    
    const total = allPhrases.length;
    if (total === 0) {
      setSessionPhrases([]);
      setCurrentPhrase(null);
      setUsedPhraseIds([]);
      return;
    }
    const start = Math.max(0, Math.min(sessionPage * SESSION_SIZE, Math.max(0, total - 1)));
    const end = Math.min(start + SESSION_SIZE, total);
    const subset = allPhrases.slice(start, end);
    setSessionPhrases(subset);
    setUsedPhraseIds([]);
    if (subset.length > 0) {
      setCurrentPhrase(subset[0]);
      setInputValues([]);
      setCurrentBlankIndex(0);
      setShowAnswer(false);
      setShowAnswerBelow(false);
      setFeedback('');
    }
  }, [sessionPage, allPhrases, practiceMode]);

  const handleSkip = useCallback(async () => {
    try {
      try { const synth = window.speechSynthesis; if (synth) synth.cancel(); } catch (_) {}
      setFeedback('');
      setInputPlaceholder('');
      setInputValues([]);
      setCurrentBlankIndex(0);
      setShowAnswer(false);
      
      // Mode 1: Use curriculum phrase selection
      if (practiceMode === 1) {
        const advanced = selectNextCurriculumPhrase();
        if (!advanced) {
          setLoading(true);
          await fetchRandomPhrase();
        }
      } else if (practiceMode === 2) {
        // Mode 2: Use verb practice session
        const advanced = selectNextVerbPracticePhrase();
        if (!advanced) {
          // Regenerate session if exhausted
          setLoading(true);
          const session = [];
          for (let i = 0; i < SESSION_SIZE; i++) {
            const result = await generateVerbPracticeSentence();
            if (result && result.korean && result.english) {
              session.push({
                korean_text: result.korean,
                english_text: result.english,
                id: `verb-${Date.now()}-${i}-${Math.random()}`
              });
            }
          }
          if (session.length > 0) {
            setVerbPracticeSession(session);
            setUsedPhraseIds([]);
            setCurrentPhrase(session[0]);
            const words = session[0].korean_text.trim().split(' ').filter(w => w);
            const desired = Math.max(1, Math.min(3, Number(numBlanks) || 1));
            const chosen = selectBlankIndicesWithVerbPriority(words, null, desired, 2);
            setRandomBlankIndices(chosen);
            setInputValues(new Array(chosen.length).fill(''));
            setCurrentBlankIndex(0);
          }
          setLoading(false);
        }
      } else if (practiceMode === 4) {
        // Mode 4: Mix mode - update index and load next
        if (mixState && mixState.mix_items) {
          const nextIndex = (mixState.current_index || 0) + 1;
          if (nextIndex < mixState.mix_items.length) {
            (async () => {
              try {
                await api.updateMixIndex(nextIndex);
                // Reload mix state to get updated index
                const res = await api.getMixState();
                if (res.ok) {
                  const updatedState = await res.json();
                  // Ensure current_index is a number and matches nextIndex
                  if (typeof updatedState.current_index !== 'number' || updatedState.current_index !== nextIndex) {
                    console.warn('Index mismatch (skip) - expected:', nextIndex, 'got:', updatedState.current_index, 'fixing...');
                    updatedState.current_index = nextIndex;
                  }
                  console.log('Updated mix state (skip) - current_index:', updatedState.current_index, 'nextIndex:', nextIndex);
                  setMixState(updatedState);
                  const nextItem = updatedState.mix_items[nextIndex];
                  const phrase = convertMixItemToPhrase(nextItem);
                  if (phrase) {
                    setCurrentPhrase(phrase);
                    const words = phrase.korean_text.trim().split(' ').filter(w => w);
                    const desired = Math.max(1, Math.min(3, Number(numBlanks) || 1));
                    const candidates = getCandidateBlankIndices(words, null);
                    let pool = candidates.length >= desired ? [...candidates] : words.map((_, i) => i);
                    const chosen = [];
                    while (chosen.length < desired && pool.length > 0) {
                      const idx = Math.floor(Math.random() * pool.length);
                      chosen.push(pool[idx]);
                      pool.splice(idx, 1);
                    }
                    setRandomBlankIndices(chosen.sort((a, b) => a - b));
                    setInputValues(new Array(chosen.length).fill(''));
                    setCurrentBlankIndex(0);
                    // Reset show answer state for next question
                    setShowAnswer(false);
                    setShowAnswerBelow(false);
                    // Keep explanation from previous question - don't clear it
                  }
                }
              } catch (err) {
                console.error('Error updating mix index:', err);
              }
            })();
          } else {
            // Mix completed! Save score and reset mix
            (async () => {
              try {
                // Get final mix state to get first_try_correct_count
                const res = await api.getMixState();
                if (res.ok) {
                  const finalState = await res.json();
                  const totalQuestions = finalState.mix_items?.length || 0;
                  const firstTryCorrect = finalState.first_try_correct_count || 0;
                  
                  // Save score
                  if (totalQuestions > 0) {
                    await api.saveMixScore(totalQuestions, firstTryCorrect);
                    console.log(`Mix score saved: ${firstTryCorrect}/${totalQuestions}`);
                  }
                  
                          // Reset mix state (index to 0, first_try_correct_count to 0)
                          const resetRes = await api.resetMixState();
                          if (!resetRes.ok) {
                            const errorData = await resetRes.json().catch(() => ({ error: 'Unknown error' }));
                            console.error('Failed to reset mix state (skip):', resetRes.status, errorData);
                            throw new Error(`Failed to reset mix state: ${errorData.error || 'Unknown error'}`);
                          }
                          console.log('Mix state reset in database (skip)');
                          
                          // Small delay to ensure database update is complete
                          await new Promise(resolve => setTimeout(resolve, 200));
                          
                          // Reload mix state to reflect reset and load first question
                          console.log('Reloading mix state after reset (skip)...');
                          await reloadMixState();
                          console.log('Mix state reloaded (skip), should be at index 0 now');
                          
                          setError(`Mix completed! Score: ${firstTryCorrect}/${totalQuestions} (${Math.round((firstTryCorrect / totalQuestions) * 100)}%). Mix reset to question 1.`);
                }
              } catch (err) {
                console.error('Error saving score and resetting mix:', err);
                setError('Mix completed! (Error saving score)');
              }
            })();
          }
        } else {
          setError('No mix found. Generate a mix in the Mix page first.');
        }
      } else if (practiceMode === 3) {
        // Mode 3: Use conversation session
        const advanced = selectNextConversationPhrase();
        if (!advanced) {
          // Rebuild session if exhausted
          if (Array.isArray(savedConversations) && savedConversations.length > 0) {
            const session = [];
            let convIdx = 0;
            let sentIdx = 0;
            while (session.length < SESSION_SIZE && convIdx < savedConversations.length) {
              const conv = savedConversations[convIdx];
              if (Array.isArray(conv.items) && conv.items.length > 0) {
                const sent = conv.items[sentIdx % conv.items.length];
                if (sent) {
                  session.push({
                    korean_text: String(sent.korean || ''),
                    english_text: String(sent.english || ''),
                    id: `conv-${conv.id}-${sentIdx % conv.items.length}`,
                    englishWordMapping: sent.englishWordMapping || null // Preserve pre-computed mapping
                  });
                }
                sentIdx++;
                if (sentIdx >= conv.items.length) {
                  convIdx++;
                  sentIdx = 0;
                }
              } else {
                convIdx++;
              }
            }
            if (session.length > 0) {
              setConversationSession(session);
              setUsedPhraseIds([]);
              setCurrentPhrase(session[0]);
              const words = session[0].korean_text.trim().split(' ').filter(w => w);
              const desired = Math.max(1, Math.min(3, Number(numBlanks) || 1));
              const candidates = getCandidateBlankIndices(words, null);
              let pool = candidates.length >= desired ? [...candidates] : words.map((_, i) => i);
              const chosen = [];
              while (chosen.length < desired && pool.length > 0) {
                const idx = Math.floor(Math.random() * pool.length);
                chosen.push(pool[idx]);
                pool.splice(idx, 1);
              }
              setRandomBlankIndices(chosen.sort((a, b) => a - b));
              setInputValues(new Array(chosen.length).fill(''));
              setCurrentBlankIndex(0);
            } else {
              setLoading(true);
              await fetchRandomPhrase();
            }
          } else {
            setLoading(true);
            await fetchRandomPhrase();
          }
        }
      }
    } catch (_) {}
  }, [fetchRandomPhrase, selectNextCurriculumPhrase, selectNextVerbPracticePhrase, selectNextConversationPhrase, practiceMode, numBlanks, getCandidateBlankIndices, savedConversations, mixState, convertMixItemToPhrase]);

  const handleInputChange = useCallback((index, value) => {
    const newInputValues = [...inputValues];
    newInputValues[index] = value;
    setInputValues(newInputValues);
    if (inputPlaceholder) {
      setInputPlaceholder('');
    }
  }, [inputValues, inputPlaceholder]);

  const handleKeyDown = useCallback(async (event, blankIndex) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (!blankPhrase || !blankPhrase.blanks || blankPhrase.blanks.length === 0) return;
      
      const currentInput = inputValues[blankIndex] || '';
      const currentBlank = blankPhrase.blanks[blankIndex];
      // Handle correct_answers: could be array of arrays (one per blank) or flat array (one per blank in order)
      let correctAnswers = [currentBlank];
      if (Array.isArray(blankPhrase.correct_answers)) {
        if (blankPhrase.correct_answers.length > blankIndex) {
          const answer = blankPhrase.correct_answers[blankIndex];
          // If answer is itself an array (multiple correct answers for this blank), use it; otherwise wrap in array
          correctAnswers = Array.isArray(answer) ? answer : [answer];
        }
      }
      
      const isCorrect = correctAnswers.some(ans => {
        // Remove punctuation from comparison - user doesn't need to type punctuation
        const removePunctuation = (str) => String(str || '').trim().replace(/[.,!?;:]/g, '');
        const normalizedInput = removePunctuation(currentInput);
        const normalizedAns = removePunctuation(ans);
        return normalizedInput === normalizedAns;
      });
      
      if (isCorrect) {
        // Check if all blanks are filled (punctuation not required)
        const removePunctuation = (str) => String(str || '').trim().replace(/[.,!?;:]/g, '');
        const allBlanksFilled = inputValues.length === blankPhrase.blanks.length && 
                                inputValues.every((val, idx) => {
                                  const ans = blankPhrase.correct_answers[idx] || blankPhrase.blanks[idx];
                                  // Remove punctuation from comparison - user doesn't need to type punctuation
                                  const normalizedVal = removePunctuation(val);
                                  const normalizedAns = removePunctuation(ans);
                                  return normalizedVal === normalizedAns;
                                });
        
        if (allBlanksFilled) {
          // All blanks are correct!
          setFeedback('All correct! Great job!');
          
          // Track first-try correct for mix mode (only if user didn't click "Show Answer")
          if (practiceMode === 4 && !showAnswer && !showAnswerBelow) {
            try {
              await api.incrementMixFirstTryCorrect();
            } catch (err) {
              console.error('Failed to increment first try correct:', err);
            }
          }
          
          // Auto-activate explanation after correct answer (only if explanation is available)
          setTimeout(() => {
            if (!showExplanation) {
              setShowExplanation(true);
              // Fetch explanation if not already loaded
              // For mix mode, explanations should be pre-stored, so this should be fast
              const currentId = blankPhrase.id || currentPhrase.id;
              if (!explanationText || explanationPhraseId !== currentId) {
                // Only fetch if we don't have a stored explanation
                if (currentPhrase?.grammar_breakdown) {
                  // Use stored explanation (no API call needed)
                  setExplanationText(currentPhrase.grammar_breakdown);
                  setExplanationPhraseId(currentId);
                } else {
                  // No stored explanation, fetch via API
                  fetchExplanation();
                }
              }
            }
          }, 100);
          
          async function proceedToNext() {
            try {
              // Only update stats when not in no-track mode and not a generated/remix entry
              const isGenerated = currentPhrase && (String(currentPhrase.id).startsWith('variation-') || String(currentPhrase.id).startsWith('remix-'));
              if (sessionNoTrack || isGenerated) {
                // Skip tracking
              } else if (usingVariations && currentPhrase && String(currentPhrase.id).startsWith('variation-')) {
                // Check if variation was already added (has db_id)
                if (currentPhrase.db_id) {
                  console.log('[CURRICULUM] Variation already in curriculum with ID:', currentPhrase.db_id);
                  console.log('[CURRICULUM] Updating stats for variation:', currentPhrase.db_id);
                  try {
                    await api.updateCurriculumPhraseStats(currentPhrase.db_id, true);
                    console.log('[CURRICULUM] ✓ Stats updated for variation');
                    setFeedback('All correct! Variation already in curriculum - stats updated!');
                  } catch (e) {
                    console.error('[CURRICULUM] ✗ Failed to update stats:', e);
                    setFeedback('All correct! (Failed to update stats)');
                  }
                } else {
                  // Fallback: try to add if not already added
                  console.log('[CURRICULUM] Variation not found in curriculum, attempting to add...');
                  try {
                    const phraseData = {
                      korean_text: currentPhrase.korean_text,
                      english_text: currentPhrase.english_text,
                      blank_word_indices: currentPhrase.blank_word_indices || [],
                      correct_answers: currentPhrase.correct_answers || [],
                      grammar_breakdown: currentPhrase.grammar_breakdown || null,
                      blank_word_types: currentPhrase.blank_word_types || []
                    };
                    const res = await api.addCurriculumPhrase(phraseData);
                    if (res.ok) {
                      const phrasesRes = await api.getCurriculumPhrases();
                      if (phrasesRes.ok) {
                        const phrases = await phrasesRes.json();
                        setAllPhrases(Array.isArray(phrases) ? phrases : []);
                        setUsedPhraseIds([]);
                        setFeedback('All correct! Variation added to curriculum!');
                      }
                    }
                  } catch (e) {
                    console.error('[CURRICULUM] ✗ Failed to add variation:', e);
                    setFeedback('All correct!');
                  }
                }
              } else {
                // Only update stats for actual curriculum phrases, not variations
                if (blankPhrase.id && String(blankPhrase.id) && !String(blankPhrase.id).startsWith('variation-')) {
                  console.log('[CURRICULUM] Updating stats for curriculum phrase:', blankPhrase.id);
                  await api.updateCurriculumPhraseStats(blankPhrase.id, true);
                  console.log('[CURRICULUM] ✓ Stats updated for curriculum phrase');
                } else {
                  console.log('[CURRICULUM] Skipping stats update - not a curriculum phrase (ID:', blankPhrase.id, ')');
                }
              }
            } catch (error) {
              console.error('[CURRICULUM] ✗ Failed to update phrase stats:', error);
              console.error('[CURRICULUM] Error stack:', error.stack);
            }
            
            setInputPlaceholder('');
            setInputValues([]);
            setCurrentBlankIndex(0);
            setShowAnswer(false);
            setShowAnswerBelow(false);
            setLoading(false);
            // After a short delay to show feedback, advance locally without refetching
            setTimeout(() => {
              setFeedback('');
              if (practiceMode === 1) {
                const ok = selectNextCurriculumPhrase();
                if (!ok) {
                  // No more local phrases; stay in session without changing total
                  setUsingVariations(true);
                }
              } else if (practiceMode === 2) {
                const ok = selectNextVerbPracticePhrase();
                if (!ok) {
                  // Regenerate session
                  (async () => {
                    const session = [];
                    for (let i = 0; i < SESSION_SIZE; i++) {
                      const result = await generateVerbPracticeSentence();
                      if (result && result.korean && result.english) {
                        session.push({
                          korean_text: result.korean,
                          english_text: result.english,
                          id: `verb-${Date.now()}-${i}-${Math.random()}`
                        });
                      }
                    }
                    if (session.length > 0) {
                      setVerbPracticeSession(session);
                      setUsedPhraseIds([]);
                      setCurrentPhrase(session[0]);
                      const words = session[0].korean_text.trim().split(' ').filter(w => w);
                      const desired = Math.max(1, Math.min(3, Number(numBlanks) || 1));
                      const chosen = selectBlankIndicesWithVerbPriority(words, null, desired, 2);
                      setRandomBlankIndices(chosen);
                      setInputValues(new Array(chosen.length).fill(''));
                      setCurrentBlankIndex(0);
                    }
                  })();
                }
              } else if (practiceMode === 3) {
                const ok = selectNextConversationPhrase();
                if (!ok) {
                  // Rebuild session
                  if (Array.isArray(savedConversations) && savedConversations.length > 0) {
                    const session = [];
                    let convIdx = 0;
                    let sentIdx = 0;
                    while (session.length < SESSION_SIZE && convIdx < savedConversations.length) {
                      const conv = savedConversations[convIdx];
                      if (Array.isArray(conv.items) && conv.items.length > 0) {
                        const sent = conv.items[sentIdx % conv.items.length];
                        if (sent) {
                          session.push({
                            korean_text: String(sent.korean || ''),
                            english_text: String(sent.english || ''),
                            id: `conv-${conv.id}-${sentIdx % conv.items.length}`,
                            englishWordMapping: sent.englishWordMapping || null // Preserve pre-computed mapping
                          });
                        }
                        sentIdx++;
                        if (sentIdx >= conv.items.length) {
                          convIdx++;
                          sentIdx = 0;
                        }
                      } else {
                        convIdx++;
                      }
                    }
                    if (session.length > 0) {
                      setConversationSession(session);
                      setUsedPhraseIds([]);
                      setCurrentPhrase(session[0]);
                      const words = session[0].korean_text.trim().split(' ').filter(w => w);
                      const desired = Math.max(1, Math.min(3, Number(numBlanks) || 1));
                      const candidates = getCandidateBlankIndices(words, null);
                      let pool = candidates.length >= desired ? [...candidates] : words.map((_, i) => i);
                      const chosen = [];
                      while (chosen.length < desired && pool.length > 0) {
                        const idx = Math.floor(Math.random() * pool.length);
                        chosen.push(pool[idx]);
                        pool.splice(idx, 1);
                      }
                      setRandomBlankIndices(chosen.sort((a, b) => a - b));
                      setInputValues(new Array(chosen.length).fill(''));
                      setCurrentBlankIndex(0);
                    }
                  }
                }
              } else if (practiceMode === 4) {
                // Mix mode: update index and load next item
                if (mixState && mixState.mix_items) {
                  const nextIndex = (mixState.current_index || 0) + 1;
                  if (nextIndex < mixState.mix_items.length) {
                    // Update index in database
                    (async () => {
                      try {
                        await api.updateMixIndex(nextIndex);
                        // Reload mix state to get updated index
                        const res = await api.getMixState();
                        if (res.ok) {
                          const updatedState = await res.json();
                          // Ensure current_index is a number and matches nextIndex
                          if (typeof updatedState.current_index !== 'number' || updatedState.current_index !== nextIndex) {
                            console.warn('Index mismatch - expected:', nextIndex, 'got:', updatedState.current_index, 'fixing...');
                            updatedState.current_index = nextIndex;
                          }
                          console.log('Updated mix state - current_index:', updatedState.current_index, 'nextIndex:', nextIndex);
                          setMixState(updatedState);
                          // Load next item using the updated state
                          const nextItem = updatedState.mix_items[nextIndex];
                          const phrase = convertMixItemToPhrase(nextItem);
                          if (phrase) {
                            setCurrentPhrase(phrase);
                            const words = phrase.korean_text.trim().split(' ').filter(w => w);
                            const desired = Math.max(1, Math.min(3, Number(numBlanks) || 1));
                            const candidates = getCandidateBlankIndices(words, null);
                            let pool = candidates.length >= desired ? [...candidates] : words.map((_, i) => i);
                            const chosen = [];
                            while (chosen.length < desired && pool.length > 0) {
                              const idx = Math.floor(Math.random() * pool.length);
                              chosen.push(pool[idx]);
                              pool.splice(idx, 1);
                            }
                            setRandomBlankIndices(chosen.sort((a, b) => a - b));
                            setInputValues(new Array(chosen.length).fill(''));
                            setCurrentBlankIndex(0);
                            // Reset show answer state for next question
                            setShowAnswer(false);
                            setShowAnswerBelow(false);
                            // Keep explanation from previous question - don't clear it
                          }
                        }
                      } catch (err) {
                        console.error('Error updating mix index:', err);
                      }
                    })();
                  } else {
                    // Mix completed! Save score and reset mix
                    console.log('Mix completed! Saving score and resetting...');
                    (async () => {
                      try {
                        // Get final mix state to get first_try_correct_count
                        const res = await api.getMixState();
                        if (res.ok) {
                          const finalState = await res.json();
                          const totalQuestions = finalState.mix_items?.length || 0;
                          const firstTryCorrect = finalState.first_try_correct_count || 0;
                          
                          console.log(`Final state - totalQuestions: ${totalQuestions}, firstTryCorrect: ${firstTryCorrect}, current_index: ${finalState.current_index}`);
                          
                          // Save score
                          if (totalQuestions > 0) {
                            await api.saveMixScore(totalQuestions, firstTryCorrect);
                            console.log(`Mix score saved: ${firstTryCorrect}/${totalQuestions}`);
                          }
                          
                          // Reset mix state (index to 0, first_try_correct_count to 0)
                          const resetRes = await api.resetMixState();
                          if (!resetRes.ok) {
                            const errorData = await resetRes.json().catch(() => ({ error: 'Unknown error' }));
                            console.error('Failed to reset mix state:', resetRes.status, errorData);
                            throw new Error(`Failed to reset mix state: ${errorData.error || 'Unknown error'}`);
                          }
                          console.log('Mix state reset in database (correct answer)');
                          
                          // Small delay to ensure database update is complete
                          await new Promise(resolve => setTimeout(resolve, 200));
                          
                          // Reload mix state to reflect reset and load first question
                          console.log('Reloading mix state after reset (correct answer)...');
                          await reloadMixState();
                          console.log('Mix state reloaded (correct answer), should be at index 0 now');
                          
                          setFeedback(`Mix completed! Score: ${firstTryCorrect}/${totalQuestions} (${Math.round((firstTryCorrect / totalQuestions) * 100)}%). Mix reset to question 1.`);
                        }
                      } catch (err) {
                        console.error('Error saving score and resetting mix:', err);
                        setFeedback('Mix completed! (Error saving score)');
                      }
                    })();
                  }
                }
              }
            }, 800);
          };
          
          // Reconstruct full sentence for speaking
          const words = blankPhrase.korean.split(' ');
          let wordIdx = 0;
          const fullSentence = words.map(w => {
            if (w === '[BLANK]') {
              const answer = blankPhrase.blanks[wordIdx] || '';
              wordIdx++;
              return answer;
            }
            return w;
          }).join(' ');
          
          speakText(fullSentence, proceedToNext);
        } else {
          // Move to next blank
          if (blankIndex < blankPhrase.blanks.length - 1) {
            setCurrentBlankIndex(blankIndex + 1);
            setFeedback('Correct! Continue...');
          } else {
            setFeedback('All blanks filled! Check your answers.');
          }
        }
      } else {
        setFeedback('Incorrect. Try again.');
        const newInputValues = [...inputValues];
        newInputValues[blankIndex] = '';
        setInputValues(newInputValues);
        setInputPlaceholder(currentBlank);
        
        // Update stats on incorrect (only for actual curriculum phrases, not variations)
        try {
          const isGenerated = currentPhrase && (String(currentPhrase.id).startsWith('variation-') || String(currentPhrase.id).startsWith('remix-'));
          if (!sessionNoTrack && !isGenerated && blankPhrase.id && String(blankPhrase.id) && !String(blankPhrase.id).startsWith('variation-')) {
            await api.updateCurriculumPhraseStats(blankPhrase.id, false);
          }
        } catch (error) {
          console.error('Failed to update phrase stats:', error);
        }
      }
    }
  }, [inputValues, blankPhrase, speakText, fetchRandomPhrase]);

  if (loading) {
    return (
      <div className="sentence-box">
        <div>Loading phrases...</div>
        <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
          If this takes too long, the backend server may not be running. Check the console for errors.
        </div>
      </div>
    );
  }

  if (error) {
    const handleTryAgain = async () => {
      setError(null);
      setLoading(true);
      if (practiceMode === 4) {
        // For mix mode, reload the mix state
        await reloadMixState();
      } else {
        // For other modes, fetch a random phrase
        await fetchRandomPhrase();
      }
    };
    
    return (
      <div className="sentence-box">
        <div className="error-message" style={{ padding: '12px', background: '#fee', border: '1px solid #fcc', borderRadius: 4, color: '#c33', marginBottom: 12 }}>
          <strong>Error:</strong> {error}
          {(error.includes('Network error') || error.includes('CONNECTION_REFUSED') || error.includes('Unable to connect')) ? (
            <div style={{ marginTop: 8, fontSize: 12 }}>
              <strong>Tip:</strong> Make sure the backend server is running. Try running: <code style={{ background: '#fdd', padding: '2px 4px', borderRadius: 2 }}>npm run start-server-dev</code>
            </div>
          ) : null}
        </div>
        <button onClick={handleTryAgain} className="generate-button" style={{ marginTop: 12 }}>
          Try Again
        </button>
      </div>
    );
  }

  if (!currentPhrase || !blankPhrase) {
    return <div className="sentence-box">No phrases available.</div>;
  }

  // Split Korean sentence by [BLANK] and create input fields
  const koreanParts = blankPhrase.korean.split('[BLANK]');
  const blankCount = blankPhrase.blanks?.length || 0;

  return (
    <div className="sentence-box">
      {/* Progress box moved to bottom */}
      <p className="korean-sentence" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        gap: 8, 
        flexWrap: 'wrap',
        fontSize: `${2.5 * textSize}rem`
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {koreanParts.map((part, idx) => (
            <React.Fragment key={idx}>
              {part}
              {idx < blankCount && (
                <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', verticalAlign: 'baseline', margin: '0 2px' }}>
                  <input
                    ref={(el) => { inputRefs.current[idx] = el; }}
                    type="text"
                    className="fill-in-blank-input"
                    value={inputValues[idx] || ''}
                    onChange={(e) => {
                      handleInputChange(idx, e.target.value);
                    }}
                    onKeyDown={(e) => {
                      handleKeyDown(e, idx);
                    }}
                    placeholder={idx === currentBlankIndex ? inputPlaceholder || '' : ''}
                    autoFocus={idx === currentBlankIndex}
                    style={{ 
                      width: `${Math.max((blankPhrase.blanks[idx]?.length || 3) * 1.5, 3)}em`,
                      borderColor: inputValues[idx] && idx === currentBlankIndex ? '#3498db' : undefined,
                      fontSize: `${2.5 * textSize}rem`,
                      lineHeight: '1.5'
                    }}
                  />
                  {showAnswerBelow && (
                    <div style={{ 
                      fontSize: `${0.9 * textSize}rem`, 
                      color: '#28a745', 
                      fontWeight: 600,
                      marginTop: '2px',
                      textAlign: 'center',
                      lineHeight: 1.2
                    }}>
                      {blankPhrase.correct_answers[idx] || blankPhrase.blanks[idx] || ''}
                    </div>
                  )}
                </span>
              )}
            </React.Fragment>
          ))}
        </span>
        <button
          type="button"
          onClick={handleSpeakFullThreeTimes}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 8px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6b7280',
            fontSize: '1.2em'
          }}
          title="Speak full Korean sentence three times"
        >
          🔊
        </button>
      </p>
      <p className="translation" style={{ 
        marginTop: 8, 
        textAlign: 'center',
        fontSize: `${1.5 * textSize}rem`
      }}>
        {(() => {
          const translation = blankPhrase.translation || '';
          // Highlight English words that correspond to blank Korean words in all modes
          // Use the same red color as the input text (#e74c3c)
          if (highlightEnglishWords && englishWordIndices && englishWordIndices.length > 0) {
            console.log('[EnglishWordIndices] Rendering translation:', { 
              translation, 
              englishWordIndices, 
              practiceMode,
              hasMapping: !!currentPhrase?.englishWordMapping 
            });
            const words = translation.split(/(\s+)/);
            const highlightIndices = new Set(englishWordIndices || []);
            let wordIndex = 0;
            return words.map((word, idx) => {
              // Skip whitespace-only segments
              if (/^\s+$/.test(word)) {
                return <React.Fragment key={idx}>{word}</React.Fragment>;
              }
              const shouldHighlight = highlightIndices.has(wordIndex);
              wordIndex++;
              if (shouldHighlight) {
                return (
                  <span key={idx} style={{ color: '#e74c3c', fontWeight: 600 }}>
                    {word}
                  </span>
                );
              }
              return <React.Fragment key={idx}>{word}</React.Fragment>;
            });
          }
          // Fallback: show translation as-is if no indices available
          return translation;
        })()}
      </p>
      {feedback && <p className="feedback">{feedback}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'center', alignItems: 'center' }}>
        <button 
          type="button"
          onClick={() => {
            setShowAnswer(!showAnswer);
            setShowAnswerBelow(!showAnswerBelow);
          }}
          className="regenerate-button"
        >
          {showAnswer ? 'Hide Answer' : 'Show Answer'}
        </button>
        <button 
          type="button"
          onClick={handleToggleExplanation}
          className="regenerate-button"
          disabled={isLoadingExplanation}
        >
          {isLoadingExplanation ? 'Loading...' : (showExplanation ? 'Hide Explanation' : 'Explain Sentence')}
        </button>
        <button 
          onClick={handleSkip}
          className="regenerate-button"
        >
          Skip
        </button>
      </div>
      {showExplanation && (
        <div className="sentence-box" style={{ textAlign: 'left', marginTop: 16, padding: '16px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8 }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '1.2em', fontWeight: 600, color: '#1f2937' }}>Explanation</h3>
          <div style={{ marginTop: 8 }}>
            {isLoadingExplanation ? (
              <p style={{ margin: '8px 0', color: '#6b7280', fontStyle: 'italic' }}>Loading explanation...</p>
            ) : explanationText ? (
              <>
                <div 
                  style={{ 
                    lineHeight: '1.7',
                    color: '#374151',
                    fontSize: '0.95em'
                  }}
                  dangerouslySetInnerHTML={{ __html: mdToHtml(explanationText) }}
                />
                {currentPhrase && blankPhrase && (() => {
                  const fullKorean = getFullKoreanSentence();
                  const english = blankPhrase.translation || currentPhrase.english_text || '';
                  return fullKorean && english ? (
                    <div style={{ marginTop: 16, textAlign: 'center', paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
                      <Link
                        to={`/chat?input=${encodeURIComponent(english)}&translation=${encodeURIComponent(fullKorean)}`}
                        className="regenerate-button"
                        style={{ textDecoration: 'none', display: 'inline-block' }}
                        title="Open in chat to ask follow-up questions about this explanation"
                      >
                        Ask Questions
                      </Link>
                    </div>
                  ) : null;
                })()}
              </>
            ) : (
              <p style={{ margin: '8px 0', color: '#6b7280', fontStyle: 'italic' }}>No explanation yet.</p>
            )}
          </div>
        </div>
      )}
      {usingVariations && (
        <div style={{ marginTop: 8, padding: '12px', background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: 8 }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <p style={{ fontSize: 12, color: '#666', fontStyle: 'italic', margin: 0 }}>
                AI-generated variation (will be added to curriculum on completion)
              </p>
              <span style={{ fontSize: 12, color: '#1976d2', fontWeight: 600 }}>
                {allPhrases.length > 0 ? `${usedPhraseIds.length} / ${allPhrases.length} phrases completed` : '0 / 0 phrases completed'}
              </span>
            </div>
            {allPhrases.length > 0 && (
              <div style={{ width: '100%', height: 8, background: '#fff', borderRadius: 4, overflow: 'hidden', marginTop: 8 }}>
                <div 
                  style={{ 
                    width: `${(usedPhraseIds.length / allPhrases.length) * 100}%`, 
                    height: '100%', 
                    background: '#4caf50',
                    transition: 'width 0.3s ease'
                  }} 
                />
              </div>
            )}
          </div>
        </div>
      )}
      {sessionNoTrack && (
        <div style={{ marginTop: 8, textAlign: 'center' }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>New sentence mode active — progress not tracked</span>
        </div>
      )}
      {currentPhrase.times_correct > 0 && currentPhrase.id && String(currentPhrase.id) && !String(currentPhrase.id).startsWith('variation-') && (
        <p className="correct-count">Correct answers: {currentPhrase.times_correct}</p>
      )}

      {((practiceMode === 1 && (allPhrases.length > 0 || (sessionPhrases && sessionPhrases.length > 0))) ||
        (practiceMode === 2 && verbPracticeSession.length > 0) ||
        (practiceMode === 3 && conversationSession.length > 0) ||
        (practiceMode === 4 && mixState && mixState.mix_items && mixState.mix_items.length > 0)) && (
        <div style={{ marginTop: 16, padding: '10px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 6 }}>
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            {practiceMode === 1 && (
              <h2 style={{ margin: 0 }}>
                Set {Math.min(sessionPage + 1, Math.max(1, Math.ceil((allPhrases.length || 0) / SESSION_SIZE)))} / {Math.max(1, Math.ceil((allPhrases.length || 0) / SESSION_SIZE))}
              </h2>
            )}
            {(practiceMode === 2 || practiceMode === 3 || practiceMode === 4) && (
              <h2 style={{ margin: 0 }}>
                {practiceMode === 2 ? 'Verb Practice' : practiceMode === 3 ? 'Conversation' : 'Mix'} Session
              </h2>
            )}
            <h3 style={{ margin: '4px 0 0 0', color: '#6b7280', fontWeight: 600 }}>
              {practiceMode === 4 ? (
                activeTotal > 0 ? (
                  <>Item {Math.min(Math.max(0, activeUsed) + 1, activeTotal)} of {activeTotal}</>
                ) : (
                  <>Loading mix...</>
                )
              ) : (
                <>{activeUsed} / {activeTotal} phrases (session)</>
              )}
            </h3>
          </div>
          {practiceMode === 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, margin: '6px 0 10px' }}>
              <button
                type="button"
                className="regenerate-button"
                onClick={() => setSessionPage((p) => Math.max(0, p - 1))}
                disabled={sessionPage <= 0}
                title="Previous 5-phrase set"
                style={{ padding: '6px 14px' }}
              >
                Prev 5
              </button>
              <button
                  type="button"
                  className="regenerate-button"
                  onClick={() => setSessionPage((p) => {
                    const totalSets = Math.max(1, Math.ceil((allPhrases.length || 0) / SESSION_SIZE));
                    return Math.min(totalSets - 1, p + 1);
                  })}
                  disabled={sessionPage >= Math.max(1, Math.ceil((allPhrases.length || 0) / SESSION_SIZE)) - 1}
                  title="Next 5-phrase set"
                  style={{ padding: '6px 14px' }}
                >
                  Next 5
                </button>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
            <button
              type="button"
              className="regenerate-button"
              onClick={() => setShowSetDialog(v => !v)}
              title={showSetDialog ? 'Hide sentences in this set' : 'Show sentences in this set'}
              style={{ padding: '6px 14px' }}
            >
              {showSetDialog ? 'Hide Set' : 'Show Set'}
            </button>
          </div>
          {showSetDialog && (
            <div style={{ marginTop: 6, padding: '10px', background: '#ffffff', border: '1px solid #ddd', borderRadius: 8 }}>
              <h3 style={{ marginTop: 0, marginBottom: 8 }}>Sentences in this set</h3>
              {Array.isArray(activePhrases) && activePhrases.length > 0 ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  {activePhrases.map((p, i) => (
                    <div key={p.id || i} style={{ border: '1px solid #eee', borderRadius: 6, padding: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        <span style={{ color: '#999', fontSize: 12 }}>{i + 1}.</span>
                        <div className="ko-text" style={{ fontWeight: 700 }}>{p.korean_text}</div>
                      </div>
                      <div style={{ color: '#374151', marginTop: 4 }}>{p.english_text}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#6b7280', fontSize: 12 }}>No sentences in this set.</div>
              )}
            </div>
          )}
          <div style={{ width: '100%', height: 12, background: '#e0e0e0', borderRadius: 6, overflow: 'hidden' }}>
            <div 
              style={{ 
                width: `${progressPercentage}%`, 
                height: '100%', 
                background: progressPercentage === 100 ? '#4caf50' : '#2196f3',
                transition: 'width 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }} 
            >
              {progressPercentage > 15 && (
                <span style={{ fontSize: 10, color: '#fff', fontWeight: 600 }}>
                  {Math.round(progressPercentage)}%
                </span>
              )}
            </div>
          </div>
          {progressPercentage === 100 && practiceMode === 1 && (
            <p style={{ fontSize: 11, color: '#4caf50', marginTop: 6, marginBottom: 0, textAlign: 'center' }}>
              ✓ All curriculum phrases completed! Now practicing with AI variations.
            </p>
          )}
          {progressPercentage === 100 && practiceMode === 2 && (
            <p style={{ fontSize: 11, color: '#4caf50', marginTop: 6, marginBottom: 0, textAlign: 'center' }}>
              ✓ All verb practice phrases completed! Session will regenerate.
            </p>
          )}
          {progressPercentage === 100 && practiceMode === 3 && (
            <p style={{ fontSize: 11, color: '#4caf50', marginTop: 6, marginBottom: 0, textAlign: 'center' }}>
              ✓ All conversation phrases completed! Session will regenerate.
            </p>
          )}
          {practiceMode === 4 && mixState && mixState.current_index >= (mixState.mix_items?.length || 0) && (
            <p style={{ fontSize: 11, color: '#4caf50', marginTop: 6, marginBottom: 0, textAlign: 'center' }}>
              ✓ Mix completed! Generate a new mix to continue.
            </p>
          )}
          <div style={{ marginTop: 8, display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ fontSize: 12, color: '#666', fontWeight: 600 }}>Blanks:</label>
              <select value={numBlanks} onChange={(e) => {
                const val = parseInt(e.target.value || '1', 10);
                setNumBlanks(val);
                try { localStorage.setItem('practice_numBlanks', String(val)); } catch (_) {}
              }} style={{ padding: 4, border: '1px solid #ddd', borderRadius: 4 }}>
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ fontSize: 12, color: '#666', fontWeight: 600 }}>Mode:</label>
              <select value={practiceMode} onChange={(e) => {
                const val = parseInt(e.target.value || '4', 10);
                setPracticeMode(val);
                try { localStorage.setItem('practice_mode', String(val)); } catch (_) {}
              }} style={{ padding: 4, border: '1px solid #ddd', borderRadius: 4 }}>
                <option value={1}>Curriculum</option>
                <option value={2}>Verb Practice</option>
                <option value={3}>Conversations</option>
                <option value={4}>Mix</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ fontSize: 12, color: '#666', fontWeight: 600 }}>Text Size:</label>
              <select value={textSize} onChange={(e) => {
                const val = parseFloat(e.target.value || '1.0');
                setTextSize(val);
                try { localStorage.setItem('practice_textSize', String(val)); } catch (_) {}
              }} style={{ padding: 4, border: '1px solid #ddd', borderRadius: 4 }}>
                <option value={0.5}>50%</option>
                <option value={0.6}>60%</option>
                <option value={0.7}>70%</option>
                <option value={0.8}>80%</option>
                <option value={0.9}>90%</option>
                <option value={1.0}>100%</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PracticePage;

