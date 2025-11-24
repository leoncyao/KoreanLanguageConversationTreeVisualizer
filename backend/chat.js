const { convertNumbersInKoreanText } = require('./number_converter');

// Route to handle prompts and return Groq responses
async function handleChat(req, res) {
  console.log('POST /api/chat request received.'); // Log request
  try {
    // Log the first 5 lines of the POST body prompt
    const { prompt } = req.body;
    if (prompt && typeof prompt === 'string') {
      const promptLines = prompt.split('\n').slice(0, 5);
      console.log('POST /api/chat body (first 5 lines):');
      promptLines.forEach((line, i) => {
        console.log(`  ${i + 1}: ${line.substring(0, 200)}${line.length > 200 ? '...' : ''}`);
      });
    }
    if (!prompt) {
      console.warn('POST /api/chat: Prompt is required.'); // Log warning
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const groqApiKey = process.env.GROQ_API_KEY; // Store your key in .env
    const groqUrl = 'https://api.groq.com/openai/v1/chat/completions';

    const groqPayload = {
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    };

    console.log('Sending request to Groq API...'); // Log sending request
    const groqResponse = await fetch(groqUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqApiKey}`
      },
      body: JSON.stringify(groqPayload)
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      console.error('Groq API returned an error status:', groqResponse.status, errorText); // Log API error
      throw new Error(`Groq API error: ${errorText}`);
    }

    const data = await groqResponse.json();
    let outputText = data.choices?.[0]?.message?.content || '';

    // Skip number conversion for word-by-word translation prompts
    // These prompts ask for JSON with "ko" and "en" fields, and we don't want to convert numbers in English translations
    const isWordByWordTranslation = /word\s+by\s+word|word-by-word|"ko".*"en"|"en".*"ko"/i.test(prompt);
    
    // Convert numbers to Korean words if the response contains Korean characters
    // BUT skip for word-by-word translations to preserve English translations
    if (outputText && /[가-힣]/.test(outputText) && !isWordByWordTranslation) {
      outputText = convertNumbersInKoreanText(outputText, prompt);
    }

    console.log('POST /api/chat successful. Sending Groq response.'); // Log success
    res.json({
      response: outputText,
      model: data.model,
      usage: data.usage
    });

  } catch (error) {
    console.error('Groq API Error in /api/chat:', error); // Log catch error
    res.status(500).json({
      error: 'Failed to get response from Groq',
      details: error.message
    });
  }
}

module.exports = { handleChat };
