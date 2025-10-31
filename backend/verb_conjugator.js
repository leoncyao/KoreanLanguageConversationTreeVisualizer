// Korean Verb Conjugation Generator
// Uses AI to generate all tenses from a base form

async function generateVerbTenses(koreanVerb, englishMeaning, currentForm = null) {
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  const prompt = `You are a Korean language expert. Given a Korean verb, generate all its conjugated forms.

Input verb: ${koreanVerb}
English meaning: ${englishMeaning}
${currentForm ? `Current form in sentence: ${currentForm}` : ''}

Generate all conjugations in JSON format with these exact keys:

{
  "base_form": "dictionary form ending in 다",
  "base_form_romanization": "romanization",
  "english": "english meaning",
  
  "present_informal": "informal/casual present (해요 style)",
  "present_formal": "formal present (합니다 style)", 
  "present_honorific": "honorific present (으십니다 style)",
  
  "past_informal": "informal past (했어요 style)",
  "past_formal": "formal past (했습니다 style)",
  "past_honorific": "honorific past (하셨습니다 style)",
  
  "future_informal": "informal future (할 거예요 style)",
  "future_formal": "formal future (할 것입니다 style)",
  "future_honorific": "honorific future (하실 거예요 style)",
  
  "progressive_informal": "progressive informal (하고 있어요 style)",
  "progressive_formal": "progressive formal (하고 있습니다 style)",
  
  "negative_present_informal": "negative present informal (안 해요 or 하지 않아요)",
  "negative_present_formal": "negative present formal (하지 않습니다)",
  "negative_past_informal": "negative past informal (안 했어요)",
  "negative_past_formal": "negative past formal (하지 않았습니다)",
  
  "verb_type": "regular|irregular|하다-verb|descriptive",
  "conjugation_pattern": "description of pattern"
}

IMPORTANT:
- If the input is already conjugated, identify the base form first
- All forms should be natural Korean
- Use proper formality levels
- Return ONLY the JSON object, no other text

Example for 가다 (to go):
{
  "base_form": "가다",
  "base_form_romanization": "gada",
  "english": "to go",
  "present_informal": "가요",
  "present_formal": "갑니다",
  "present_honorific": "가십니다",
  "past_informal": "갔어요",
  "past_formal": "갔습니다",
  "past_honorific": "가셨습니다",
  "future_informal": "갈 거예요",
  "future_formal": "갈 것입니다",
  "future_honorific": "가실 거예요",
  "progressive_informal": "가고 있어요",
  "progressive_formal": "가고 있습니다",
  "negative_present_informal": "안 가요",
  "negative_present_formal": "가지 않습니다",
  "negative_past_informal": "안 갔어요",
  "negative_past_formal": "가지 않았습니다",
  "verb_type": "irregular",
  "conjugation_pattern": "ㄷ irregular"
}

Now generate for: ${koreanVerb} (${englishMeaning})`;

  const groqUrl = 'https://api.groq.com/openai/v1/chat/completions';
  const groqPayload = {
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [
      { role: 'user', content: prompt }
    ],
    temperature: 0.2, // Low temperature for consistency
  };

  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), 30000); // 30s timeout
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

    console.log('Verb conjugation response:', content);

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    
    const conjugations = JSON.parse(jsonMatch[0]);
    
    // Validate required fields
    if (!conjugations.base_form || !conjugations.english) {
      throw new Error('Invalid conjugation format');
    }

    return conjugations;
  } catch (err) {
    clearTimeout(timer);
    console.error('Error generating verb tenses:', err);
    throw err;
  }
}

module.exports = { generateVerbTenses };

