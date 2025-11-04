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

Generate 5 similar sentence variations in Korean that are CLOSELY RELATED to the model sentence:

Requirements:
1. Use Similar grammar structure and sentence pattern, can vary tense. 
2. Vary Subject, Object, Adjectives, Adverbs, etc. Only care about grammatical structure, can vary order and grammar if not too much
3. Keep the SAME level of formality always prefer casual
4. Keep SIMILAR sentence length and complexity
5. Make sentences that feel like natural practice variations of the model
6. If the model uses specific verb tenses or particles, use the same ones
7. Prefer to incorporate 1-2 of the target learning words when it sounds natural and stays close to the model
8. Try to vary cosonant and vowel endings on words

Examples of good variations:
Model: "나는 학생이에요" (I am a student)
Good variations:
- "나는 선생님이에요" (I am a teacher)
- "저는 의사예요" (I am a doctor) 
- "나는 간호사예요" (I am a nurse)

Model: "저는 커피를 좋아해요" (I like coffee)
Good variations:
- "저는 차를 좋아해요" (I like tea)
- "저는 음악을 좋아해요" (I like music)
- "저는 영화를 좋아해요" (I like movies)

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
      temperature: 0.8, // Higher temperature for more creative variations
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

