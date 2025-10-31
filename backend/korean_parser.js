// Korean word parser - breaks down Korean sentences into words with part of speech

async function parseKoreanSentence(koreanText, englishText) {
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  const prompt = `Analyze this Korean sentence and break it down into individual words with their parts of speech.

Korean: ${koreanText}
English: ${englishText}

For each word, provide:
- korean: the Korean word
- english: English meaning
- romanization: romanization (like "annyeonghaseyo")
- pos: part of speech (noun, verb, adjective, adverb, pronoun, conjunction, particle)
- base_form: (for verbs/adjectives only) the dictionary/base form
- type: (for pronouns: personal/demonstrative/interrogative, particles: subject/object/topic)

IMPORTANT: 
- Particles (조사) like 은/는, 이/가, 을/를, 에, 에서, 으로, etc. should be separate words
- Break compound words if they have clear parts of speech
- Conjugated verbs/adjectives: show both current form and base form

Respond with ONLY a JSON array in this format:
[
  {
    "korean": "나",
    "english": "I",
    "romanization": "na",
    "pos": "pronoun",
    "type": "personal"
  },
  {
    "korean": "는",
    "english": "topic marker",
    "romanization": "neun",
    "pos": "particle",
    "type": "topic"
  },
  {
    "korean": "학생",
    "english": "student",
    "romanization": "haksaeng",
    "pos": "noun"
  }
]

Now analyze: ${koreanText}`;

  const groqUrl = 'https://api.groq.com/openai/v1/chat/completions';
  const groqPayload = {
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [
      { role: 'user', content: prompt }
    ],
    temperature: 0.3 // Lower temperature for more consistent parsing
  };

  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), 20000);
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
      throw new Error(`Groq API error: ${errorText || response.statusText}`);
    }

    const result = await response.json();
    const content = result?.choices?.[0]?.message?.content?.trim() || '';

    console.log('Parser response:', content);

    // Extract JSON array from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array found in response');
    }
    
    const words = JSON.parse(jsonMatch[0]);
    
    if (!Array.isArray(words) || words.length === 0) {
      throw new Error('Invalid words format');
    }

    // Validate and normalize each word
    return words.map((word, index) => ({
      korean: word.korean || '',
      english: word.english || '',
      romanization: word.romanization || '',
      pos: word.pos || 'noun',
      base_form: word.base_form || null,
      type: word.type || null,
      position: index
    }));
  } catch (err) {
    clearTimeout(timer);
    console.error('Error parsing Korean sentence:', err);
    throw err;
  }
}

module.exports = { parseKoreanSentence };

