const Database = require('./database');
const { parseKoreanSentence } = require('./korean_parser');
const { generateVerbTenses } = require('./verb_conjugator');

// API to correct/translate a user-provided Korean message
async function handleTranslate(req, res) {
  try {
    const inputText = (req.body && (req.body.text || req.body.message)) || '';
    if (!inputText || typeof inputText !== 'string') {
      return res.status(400).json({ error: 'text is required' });
    }

    console.log('Input message:', inputText);

    const correctionPrompt = (
      'Read the following user message. If the message is in english, return the translated version of the message, in korean polite casual form. ALWAYS CASUAL, TRY TO MAKE SHORT IF POSSIBLE'
      + 'If the message is in korean, return just the english translation of the message '
      + 'ONLY RETURN EITHER THE TRANSLATED KOREAN, OR THE TRANSLATED ENGLISH, WITH NO EXPLANATION OR FURTHER TEXT'
      + 'User message: ' + inputText
    );

    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      return res.status(500).json({ error: 'GROQ_API_KEY is not configured' });
    }

    const groqUrl = 'https://api.groq.com/openai/v1/chat/completions';
    const groqPayload = {
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [
        { role: 'user', content: correctionPrompt }
      ]
    };

    // 15s timeout without AbortController (Promise.race)
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('timeout')), 15000);
    });
    
    try {
      const response = await Promise.race([
        fetch(groqUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqApiKey}`
          },
          body: JSON.stringify(groqPayload)
        }),
        timeoutPromise
      ]);
      clearTimeout(timer);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        return res.status(502).json({ error: 'Groq API error', details: errorText || response.statusText });
      }

      const result = await response.json();
      const corrected = (result && result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content)
        ? String(result.choices[0].message.content).trim()
        : '';

      console.log('Corrected response:', corrected);

      // Save phrase to database and parse words
      try {
        const db = new Database();
        await db.init();
        
        // Save the phrase
        const phraseId = await db.savePhrase(corrected, inputText);
        console.log('Phrase saved to database with ID:', phraseId);
        
        // Parse the Korean sentence into words
        try {
          console.log('Parsing Korean sentence into words...');
          const words = await parseKoreanSentence(corrected, inputText);
          console.log('Parsed words:', words);
          
          const normalizePos = (pos, english) => {
            const p = String(pos || '').trim().toLowerCase();
            if (p === 'proper noun' || p === 'proper_noun' || p === 'propernoun') return 'proper-noun';
            if (p === 'postposition' || p === 'preposition' || p === 'adposition' || p === 'particle') return 'particle';
            if (p === 'adj' || p === 'adjective') return 'adjective';
            if (p === 'adv' || p === 'adverb') return 'adverb';
            if (p === 'pron' || p === 'pronoun') return 'pronoun';
            if (p === 'conj' || p === 'conjunction') return 'conjunction';
            if (p === 'v' || p === 'verb') return 'verb';
            if (p === 'n' || p === 'noun') {
              // Heuristic: capitalized English likely a proper noun (e.g., Vancouver)
              const e = String(english || '').trim();
              if (/^[A-Z][A-Za-z]*(?:[\-\s][A-Z][A-Za-z]*)*$/.test(e)) return 'proper-noun';
              return 'noun';
            }
            return p || 'noun';
          };

          // Extract a normalized set of POS tags when a token can be multiple (e.g., "noun, verb")
          const extractNormalizedPosSet = (rawPos, english) => {
            const set = new Set();
            if (!rawPos && rawPos !== 0) return set;
            if (Array.isArray(rawPos)) {
              for (const p of rawPos) {
                const n = normalizePos(p, english);
                if (n) set.add(n);
              }
              return set;
            }
            const raw = String(rawPos || '').toLowerCase();
            // Split on common separators or detect tokens in a space-separated string
            const parts = raw.split(/[\s,|/]+/).filter(Boolean);
            if (parts.length === 0) {
              const n = normalizePos(raw, english);
              if (n) set.add(n);
              return set;
            }
            for (const p of parts) {
              const n = normalizePos(p, english);
              if (n) set.add(n);
            }
            return set;
          };

          // Save each word to the appropriate table(s) — supports multi-POS (e.g., noun AND verb)
          for (const word of words) {
            try {
              const posSet = extractNormalizedPosSet(word.pos, word.english);
              const savedTables = new Set();

              // If word has a verb sense, save full verb tenses
              if (posSet.has('verb')) {
                try {
                  console.log(`Generating all tenses for verb: ${word.korean}`);
                  const verbTenses = await generateVerbTenses(
                    word.base_form || word.korean,
                    word.english,
                    word.korean
                  );
                  await db.saveVerbWithAllTenses(verbTenses);
                  savedTables.add('verb');
                  console.log(`Saved verb with all tenses: ${verbTenses.base_form}`);
                } catch (verbError) {
                  console.error(`Failed to generate verb tenses for ${word.korean}:`, verbError);
                  // Fallback: save basic verb info
                  const wordData = {
                    korean: word.korean,
                    english: word.english,
                    romanization: word.romanization,
                    base_form: word.base_form,
                    conjugation_type: word.type
                  };
                  try { await db.saveWord('verb', wordData); savedTables.add('verb'); } catch (_) {}
                }
              }

              // Save other POS senses (including noun) for the same token
              for (const pos of posSet) {
                if (pos === 'verb') continue; // already handled
                if (savedTables.has(pos)) continue;
                const wordData = {
                  korean: word.korean,
                  english: word.english,
                  romanization: word.romanization
                };
                if (pos === 'adjective') {
                  wordData.base_form = word.base_form;
                }
                if (pos === 'pronoun') {
                  wordData.pronoun_type = word.type;
                }
                if (pos === 'particle') {
                  wordData.particle_type = word.type;
                }
                try {
                  await db.saveWord(pos, wordData);
                  savedTables.add(pos);
                } catch (saveWordErr) {
                  console.error(`Failed to save POS=${pos} for ${word.korean}:`, saveWordErr);
                }
              }
              
              // Note: linking words to phrases requires getting the word ID
              // which is complex with UPSERT, so we'll skip for now
              
            } catch (wordError) {
              console.error(`Failed to save word ${word.korean}:`, wordError);
              // Continue with other words even if one fails
            }
          }
          
          console.log('Words saved successfully');
        } catch (parseError) {
          console.error('Failed to parse Korean sentence:', parseError);
          // Don't fail the whole request if parsing fails
        }
      } catch (saveError) {
        console.error('Failed to save phrase to database:', saveError);
        // Don't fail the request if saving fails
      }

      return res.json({ corrected });
    } catch (err) {
      clearTimeout(timer);
      const isTimeout = String(err && err.message || err).toLowerCase().includes('timeout');
      return res.status(504).json({ error: isTimeout ? 'Groq request timed out' : 'Groq request failed', details: String(err && err.message || err) });
    }
  } catch (e) {
    return res.status(500).json({ error: 'Unexpected error', details: String(e && e.message || e) });
  }
}

module.exports = { handleTranslate };