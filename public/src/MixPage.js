import React, { useState, useEffect, useCallback } from 'react';
import { api } from './api';
import { generateVerbPracticeSentence } from './verbPractice';
import './styles/HomePage.css';

function MixPage() {
  const [mixState, setMixState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);

  // Helper function to generate explanation for a sentence
  const generateExplanation = useCallback(async (korean, english) => {
    try {
      const prompt = `Explain this Korean sentence in detail.
Korean: ${korean}
English: ${english}
Please include a clear breakdown of grammar (particles, tense, politeness), vocabulary with brief glosses, and any important notes for a learner.
Break down particles such as 은/는, 이/가, 을/를, 에, 에서, etc, verbs and their root forms, and pronouns
Keep it concise and structured, focusing on helping someone understand how the sentence works.`;
      const res = await api.chat(prompt);
      if (res.ok) {
        const data = await res.json();
        return data.response || '';
      }
    } catch (err) {
      console.warn('Failed to generate explanation:', err);
    }
    return null;
  }, []);

  // Function to fill missing explanations in mix items
  const fillMissingExplanations = useCallback(async (mixItems) => {
    if (!Array.isArray(mixItems)) return;
    
    let hasUpdates = false;
    const updatedItems = [...mixItems];
    
    // Check each item for missing explanations
    for (let i = 0; i < updatedItems.length; i++) {
      const item = updatedItems[i];
      if (!item || !item.data) continue;
      
      // Check if explanation is missing
      const hasExplanation = item.data.explanation && item.data.explanation.trim().length > 0;
      
      if (!hasExplanation) {
        let korean = '';
        let english = '';
        
        // Extract Korean and English based on item type
        if (item.type === 'curriculum') {
          korean = item.data.korean_text || '';
          english = item.data.english_text || '';
        } else if (item.type === 'conversation') {
          korean = item.data.korean || '';
          english = item.data.english || '';
        } else if (item.type === 'verb_practice') {
          korean = item.data.korean_text || '';
          english = item.data.english_text || '';
        }
        
        // Generate explanation if we have both Korean and English
        if (korean && english) {
          console.log(`Generating explanation for mix item ${i + 1}/${updatedItems.length} (${item.type})`);
          const explanation = await generateExplanation(korean, english);
          if (explanation) {
            updatedItems[i] = {
              ...item,
              data: {
                ...item.data,
                explanation: explanation
              }
            };
            hasUpdates = true;
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
      }
    }
    
    // Update mix state if we generated any explanations
    if (hasUpdates) {
      console.log(`Updating mix with ${updatedItems.length} items (added missing explanations)`);
      try {
        const updateRes = await api.updateMixItems(updatedItems);
        if (updateRes.ok) {
          console.log('Mix updated successfully with new explanations');
          // Reload mix state to reflect updates
          const res = await api.getMixState();
          if (res.ok) {
            const updatedState = await res.json();
            setMixState(updatedState);
          }
        } else {
          console.error('Failed to update mix items:', updateRes.status);
        }
      } catch (err) {
        console.error('Error updating mix items:', err);
      }
    } else {
      console.log('All mix items already have explanations');
    }
  }, [generateExplanation]);

  const generateNewMix = useCallback(async () => {
    try {
      setGenerating(true);
      setError('');

      // Get 5 random curriculum phrases, each repeated twice
      let curriculumRes;
      try {
        curriculumRes = await api.getCurriculumPhrases();
      } catch (fetchError) {
        // Network error or connection refused
        if (fetchError instanceof TypeError && (fetchError.message.includes('fetch') || fetchError.message.includes('Failed to fetch'))) {
          throw new Error('Network error: Unable to connect to server. Please check if the backend is running and accessible.');
        }
        throw fetchError;
      }
      if (!curriculumRes.ok) {
        const errorText = await curriculumRes.text().catch(() => '');
        throw new Error(`Failed to fetch curriculum phrases: ${curriculumRes.status} ${curriculumRes.statusText}${errorText ? ` - ${errorText}` : ''}`);
      }
      const allPhrases = await curriculumRes.json();
      const curriculumPhrases = Array.isArray(allPhrases) ? allPhrases : [];
      const selectedCurriculum = [];
      const curriculumPool = [...curriculumPhrases];
      for (let i = 0; i < 5 && curriculumPool.length > 0; i++) {
        const idx = Math.floor(Math.random() * curriculumPool.length);
        selectedCurriculum.push(curriculumPool[idx]);
        curriculumPool.splice(idx, 1);
      }
      
      // Each curriculum sentence appears twice - generate explanations
      const curriculumItems = [];
      for (let idx = 0; idx < selectedCurriculum.length; idx++) {
        const phrase = selectedCurriculum[idx];
        // Generate explanation once per phrase (will be reused for both repeats)
        const explanation = await generateExplanation(phrase.korean_text, phrase.english_text);
        await new Promise(resolve => setTimeout(resolve, 200)); // Small delay between API calls
        
        for (let repeat = 0; repeat < 2; repeat++) {
          curriculumItems.push({
            type: 'curriculum',
            data: {
              ...phrase,
              explanation: explanation // Store explanation in data
            },
            id: `curriculum-${phrase.id}-${repeat}`,
            groupId: `curriculum-group-${idx}`
          });
        }
      }

      // Get 1 conversation set, repeated once (all sentences in order, then repeated)
      let conversations = [];
      try {
        const raw = localStorage.getItem('conversation_sets_v1');
        const arr = raw ? JSON.parse(raw) : [];
        conversations = Array.isArray(arr) ? arr : [];
      } catch (_) {}
      
      // Also try server API
      try {
        const apiBaseUrl = process.env.API_BASE_URL || '';
        const conversationsRes = await fetch(`${apiBaseUrl}/api/conversations?limit=100`);
        if (conversationsRes.ok) {
          const serverConvs = await conversationsRes.json();
          if (Array.isArray(serverConvs) && serverConvs.length > 0) {
            conversations = serverConvs;
          }
        }
      } catch (fetchError) {
        console.warn('Failed to fetch conversations from server:', fetchError);
        // Continue with local conversations only
      }
      
      const conversationItems = [];
      if (conversations.length > 0) {
        // Pick 1 random conversation
        const conv = conversations[Math.floor(Math.random() * conversations.length)];
        const items = Array.isArray(conv.items) ? conv.items : [];
        
        // Generate explanations for all conversation sentences
        const conversationExplanations = [];
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const explanation = await generateExplanation(item.korean, item.english);
          conversationExplanations.push(explanation);
          await new Promise(resolve => setTimeout(resolve, 200)); // Small delay between API calls
        }
        
        // Add all sentences in order, then repeat the entire conversation once
        for (let repeat = 0; repeat < 2; repeat++) {
          for (let i = 0; i < items.length; i++) {
            conversationItems.push({
              type: 'conversation',
              data: {
                ...items[i],
                explanation: conversationExplanations[i] // Store explanation
              },
              conversationId: conv.id,
              sentenceIndex: i,
              repeatIndex: repeat,
              id: `conversation-${conv.id}-${i}-${repeat}`,
              groupId: `conversation-group-${repeat}` // Keep sentences together by repeat
            });
          }
        }
      }

      // Generate 5 verb practice sentences, each repeated twice
      const verbPracticeItems = [];
      const generatedVerbs = [];
      const usedSentences = new Set(); // Track used sentences to avoid duplicates
      
      // Vary date modifiers and pronouns for diversity
      const dateModifiers = ['오늘', '어제', '내일'];
      const pronouns = ['나', '너', '우리', '그', '그녀', '그들'];
      
      for (let i = 0; i < 5 && generatedVerbs.length < 5; i++) {
        try {
          // Vary the date modifier and pronoun for each sentence
          const dateMod = dateModifiers[i % dateModifiers.length];
          const pronoun = pronouns[i % pronouns.length];
          
          const result = await generateVerbPracticeSentence({
            dateModifier: dateMod,
            pronoun: pronoun
          });
          
          if (result && result.korean && result.english) {
            const koreanText = result.korean.trim();
            const englishText = result.english.trim();
            const sentenceKey = `${koreanText}|${englishText}`;
            
            // Check if we already have this exact sentence
            if (!usedSentences.has(sentenceKey) && koreanText && englishText) {
              usedSentences.add(sentenceKey);
              generatedVerbs.push({
                korean_text: koreanText,
                english_text: englishText
              });
            }
          }
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (err) {
          console.warn('Failed to generate verb practice sentence:', err);
        }
      }
      
      // Generate explanations for verb practice sentences
      const verbExplanations = [];
      for (let idx = 0; idx < generatedVerbs.length; idx++) {
        const verb = generatedVerbs[idx];
        const explanation = await generateExplanation(verb.korean_text, verb.english_text);
        verbExplanations.push(explanation);
        await new Promise(resolve => setTimeout(resolve, 200)); // Small delay between API calls
      }
      
      // Each verb practice sentence appears twice
      generatedVerbs.forEach((verb, idx) => {
        for (let repeat = 0; repeat < 2; repeat++) {
          verbPracticeItems.push({
            type: 'verb_practice',
            data: {
              ...verb,
              explanation: verbExplanations[idx] // Store explanation
            },
            id: `verb-${idx}-${repeat}-${Date.now()}-${Math.random()}`,
            groupId: `verb-group-${idx}`
          });
        }
      });

      // Create groups for shuffling: curriculum items, verb practice items, and conversation groups
      // Conversation needs to stay together as groups (all sentences in order)
      const groups = [];
      
      // Add curriculum items as individual groups (can be shuffled)
      curriculumItems.forEach(item => {
        groups.push({ type: 'curriculum', items: [item] });
      });
      
      // Add verb practice items as individual groups (can be shuffled)
      verbPracticeItems.forEach(item => {
        groups.push({ type: 'verb_practice', items: [item] });
      });
      
      // Add conversation as groups - keep sentences together by repeat
      const conversationGroups = {};
      conversationItems.forEach(item => {
        const groupKey = `conv-${item.repeatIndex}`;
        if (!conversationGroups[groupKey]) {
          conversationGroups[groupKey] = [];
        }
        conversationGroups[groupKey].push(item);
      });
      Object.values(conversationGroups).forEach(group => {
        groups.push({ type: 'conversation', items: group });
      });
      
      // Shuffle the groups
      for (let i = groups.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [groups[i], groups[j]] = [groups[j], groups[i]];
      }
      
      // Flatten groups into final mix items
      const mixItems = [];
      groups.forEach(group => {
        mixItems.push(...group.items);
      });

      // Save to database
      console.log(`Saving ${mixItems.length} mix items to database...`);
      const generateRes = await api.generateMix(mixItems);
      if (!generateRes.ok) {
        const errorData = await generateRes.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Failed to save mix: ${errorData.error || 'Unknown error'}`);
      }
      const result = await generateRes.json().catch(() => ({}));
      console.log(`Mix saved successfully: ${result.itemCount || mixItems.length} items`);

      // Reload mix state
      await loadMixState();
    } catch (e) {
      console.error('Error generating mix:', e);
      setError(e instanceof Error ? e.message : 'Failed to generate mix');
    } finally {
      setGenerating(false);
    }
  }, [loadMixState]);

  const renderMixItem = (item, index) => {
    let displayText = '';
    let typeLabel = '';
    
    if (item.type === 'curriculum') {
      typeLabel = 'Curriculum';
      displayText = `${item.data.korean_text || ''} - ${item.data.english_text || ''}`;
    } else if (item.type === 'conversation') {
      typeLabel = 'Conversation';
      displayText = `${item.data.korean || ''} - ${item.data.english || ''}`;
    } else if (item.type === 'verb_practice') {
      typeLabel = 'Verb Practice';
      displayText = `${item.data.korean_text || ''} - ${item.data.english_text || ''}`;
    }

    return (
      <div key={item.id || index} className="sentence-box" style={{ 
        textAlign: 'left', 
        opacity: mixState && index < mixState.current_index ? 0.6 : 1,
        borderLeft: mixState && index === mixState.current_index ? '4px solid #4caf50' : '1px solid #ddd'
      }}>
        <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>
          {typeLabel} • Item {index + 1}
          {mixState && index === mixState.current_index && (
            <span style={{ color: '#4caf50', fontWeight: 600, marginLeft: 8 }}>← Current</span>
          )}
        </div>
        <div style={{ fontSize: 16, fontWeight: 500 }}>
          <span className="ko-text">{displayText.split(' - ')[0]}</span>
        </div>
        <div style={{ color: '#666', marginTop: 4 }}>
          {displayText.split(' - ')[1]}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="container">
        <h1>Mix</h1>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Mix</h1>
      
      {error && (
        <div style={{ padding: 12, background: '#ffebee', color: '#c62828', borderRadius: 4, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: 24, display: 'flex', gap: 12, alignItems: 'center' }}>
        <button 
          className="btn-primary" 
          onClick={generateNewMix}
          disabled={generating}
        >
          {generating ? 'Generating...' : 'Generate New Mix'}
        </button>
        {mixState && (
          <div style={{ fontSize: 14, color: '#666' }}>
            Progress: {mixState.current_index} / {mixState.mix_items ? mixState.mix_items.length : 0}
          </div>
        )}
      </div>

      {/* Mix Algorithm Description */}
      <div className="sentence-box" style={{ marginBottom: 24, background: '#f8f9fa', border: '1px solid #dee2e6' }}>
        <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 18, color: '#333' }}>Mix Algorithm</h3>
        <div style={{ fontSize: 14, color: '#555', lineHeight: 1.6 }}>
          <p style={{ marginTop: 0, marginBottom: 12 }}>
            <strong>Current Mix Generation Algorithm:</strong>
          </p>
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            <li style={{ marginBottom: 8 }}>
              <strong>5 Curriculum Sentences</strong> - Randomly selected from curriculum phrases, each sentence appears <strong>twice</strong> (10 items total)
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong>1 Conversation Set</strong> - One random conversation is selected. All sentences from that conversation appear in their original order, then the entire conversation is <strong>repeated once</strong> (maintains sentence order within each repeat)
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong>5 Verb Practice Sentences</strong> - Generated using the Level 2 verb practice algorithm with varied date modifiers (오늘, 어제, 내일) and pronouns (나, 너, 우리, 그, 그녀, 그들). Each sentence appears <strong>twice</strong> (10 items total)
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong>Shuffling</strong> - All items are grouped by type, then groups are shuffled randomly. Conversation sentences stay together as groups (all sentences from one repeat appear consecutively)
            </li>
            <li style={{ marginBottom: 0 }}>
              <strong>Total Items</strong> - Typically 20-30 items depending on conversation length (10 curriculum + 2×conversation length + 10 verb practice)
            </li>
          </ol>
        </div>
      </div>

      {!mixState ? (
        <div className="sentence-box">
          <p>No mix generated yet. Click "Generate New Mix" to create one.</p>
        </div>
      ) : !mixState.mix_items || mixState.mix_items.length === 0 ? (
        <div className="sentence-box">
          <p>Mix is empty. Generate a new mix to get started.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {mixState.mix_items.map((item, index) => renderMixItem(item, index))}
        </div>
      )}
    </div>
  );
}

export default MixPage;

