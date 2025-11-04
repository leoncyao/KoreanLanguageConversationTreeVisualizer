// Text-to-Speech endpoint
// Uses Google Translate TTS (free, no API key required) or other TTS service

async function handleTTS(req, res) {
  try {
    const { text, lang = 'ko-KR', rate = 1.0 } = req.body;
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text is required' });
    }
    
    // Map language codes to Google TTS language codes
    const langMap = {
      'ko-KR': 'ko',
      'en-US': 'en',
      'en': 'en',
      'ko': 'ko'
    };
    
    const ttsLang = langMap[lang] || lang.split('-')[0] || 'en';
    
    // Use Google Translate TTS (free, no API key)
    // Note: This is a public endpoint, rate limits may apply
    const encodedText = encodeURIComponent(text);
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${ttsLang}&client=tw-ob&q=${encodedText}`;
    
    try {
      // Fetch the audio from Google TTS
      const audioResponse = await fetch(ttsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (!audioResponse.ok) {
        throw new Error(`TTS API returned ${audioResponse.status}`);
      }
      
      const audioBuffer = await audioResponse.arrayBuffer();
      
      // Set appropriate headers
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', audioBuffer.byteLength);
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
      
      // Send audio data
      res.send(Buffer.from(audioBuffer));
      
    } catch (err) {
      console.error('TTS fetch error:', err);
      return res.status(500).json({ error: 'Failed to generate TTS audio', details: err.message });
    }
    
  } catch (err) {
    console.error('TTS endpoint error:', err);
    res.status(500).json({ error: 'TTS generation failed', details: err.message });
  }
}

module.exports = { handleTTS };

