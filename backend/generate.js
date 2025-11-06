const Database = require('./database');

// API to generate sentence variations based on a model sentence
async function handleGenerateVariations(req, res) {
  try {
    const { english, korean } = req.body;
    
    if (!english || !korean) {
      return res.status(400).json({ error: 'Both english and korean sentences are required' });
    }

    console.log('Generating variations for:', { english, korean });

    // Load learning words to bias variations
    let learningWords = [];
    try {
      const db = new Database();
      await db.init();
      learningWords = await db.getLearningWords(50);
    } catch (e) {
      console.warn('Could not load learning words:', e && e.message ? e.message : e);
    }

    const learningLine = (learningWords && learningWords.length > 0)
      ? `\nTarget learning words to favor (include 1-2 when natural): ${learningWords.map(w => w.korean).join(', ')}`
      : '';

    const prompt = `Given this Korean model sentence: "${korean}" (English: "${english}")${learningLine}

Generate 5 diverse sentence variations in Korean that are NATURAL and CLEARLY DIFFERENT from the model:

Strong requirements for DIVERSITY:
1) Change the main verb in MOST variations (avoid repeating the model's verb). Use different actions (e.g., buy, lose, find, lend, borrow, carry, need, want, can, must, etc.).
2) Replace core nouns with DIFFERENT categories (not trivial synonyms). If the model mentions book/pen, use unrelated objects (e.g., ticket, backpack, umbrella, camera, invitation, homework, appointment, bus, dinner, gym).
3) Vary tense/aspect/polarity across the 5 outputs: include a mix of present, past, future, progressive (하고 있어요), and at least one negative. Keep polite casual endings (해요/했어요/할 거예요/하고 있어요/안/못 + V) throughout.
4) Keep sentence length and complexity roughly similar, but vary particles and word order naturally.
5) Avoid reusing the model's specific content words (beyond particles), and avoid near-synonyms that are too similar (e.g., 'notebook' vs 'book').
6) Prefer to incorporate 1-2 target learning words only when it stays natural; otherwise ignore them.
7) Try to vary consonant and vowel endings across words.

Examples of acceptable variation (conceptual):
Model: "나는 학생이에요" (I am a student)
Acceptable: 
- "저는 선생님이었어요" (I was a teacher)  // different noun + tense
- "저는 의사가 될 거예요" (I will become a doctor)  // different verb
- "저는 회사원은 아니에요" (I am not an office worker)  // negative

Model: "저는 커피를 좋아해요" (I like coffee)
Acceptable:
- "저는 차를 마셨어요" (I drank tea)  // different verb + past
- "저는 간식을 안 먹어요" (I don't eat snacks)  // negative
- "저는 운동을 하고 있어요" (I am working out)  // progressive

Now generate 5 variations for: "${korean}"

Format your response as a JSON array:
[
  {"korean": "...", "english": "..."},
  {"korean": "...", "english": "..."},
  {"korean": "...", "english": "..."},
  {"korean": "...", "english": "..."},
  {"korean": "...", "english": "..."}
]

Only respond with the JSON array, nothing else.`;

    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      return res.status(500).json({ error: 'GROQ_API_KEY is not configured' });
    }

    const groqUrl = 'https://api.groq.com/openai/v1/chat/completions';
    const groqPayload = {
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 1.1, // Encourage more diverse outputs
    };

    let timer;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('timeout')), 20000); // 20s timeout
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
      const content = result?.choices?.[0]?.message?.content?.trim() || '';

      console.log('Groq response:', content);

      // Try to parse the JSON response
      try {
        // Extract JSON array from response (in case there's extra text)
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          throw new Error('No JSON array found in response');
        }
        
        const variations = JSON.parse(jsonMatch[0]);
        
        if (!Array.isArray(variations) || variations.length === 0) {
          throw new Error('Invalid variations format');
        }

        return res.json({ variations });
      } catch (parseError) {
        console.error('Failed to parse variations:', parseError);
        return res.status(500).json({ 
          error: 'Failed to parse variations', 
          details: parseError.message,
          raw: content 
        });
      }
    } catch (err) {
      clearTimeout(timer);
      const isTimeout = String(err?.message || err).toLowerCase().includes('timeout');
      return res.status(504).json({ 
        error: isTimeout ? 'Request timed out' : 'Request failed', 
        details: String(err?.message || err) 
      });
    }
  } catch (e) {
    console.error('Unexpected error in handleGenerateVariations:', e);
    return res.status(500).json({ 
      error: 'Unexpected error', 
      details: String(e?.message || e) 
    });
  }
}

module.exports = { handleGenerateVariations };

