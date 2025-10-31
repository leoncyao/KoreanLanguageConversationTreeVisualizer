// Route to handle prompts and return Groq responses
async function handleChat(req, res) {
  console.log('POST /api/chat request received.'); // Log request
  try {
    const { prompt } = req.body;
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
    const outputText = data.choices?.[0]?.message?.content || '';

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
