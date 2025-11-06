// Text-to-Speech endpoint
// Generates MP3 files and saves them to disk for better background playback support
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Create TTS cache directory
const ttsCacheDir = path.join(__dirname, '..', 'public', 'tts-cache');
if (!fs.existsSync(ttsCacheDir)) {
  fs.mkdirSync(ttsCacheDir, { recursive: true });
}

// Generate hash for filename (based on text, lang, rate)
function generateHash(text, lang, rate) {
  const str = `${text}_${lang}_${rate}`;
  return crypto.createHash('md5').update(str).digest('hex');
}

// Get file path for cached audio
function getAudioFilePath(text, lang, rate) {
  const hash = generateHash(text, lang, rate);
  return path.join(ttsCacheDir, `${hash}.mp3`);
}

async function handleTTS(req, res) {
  try {
    const { text, lang = 'ko-KR', rate = 1.0 } = req.body;
    try { console.log('[TTS] request', { text: String(text || '').slice(0, 80), lang, rate }); } catch (_) {}
    
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
    
    // Check if file already exists on disk
    const filePath = getAudioFilePath(text, lang, rate);
    const fileName = path.basename(filePath);
    
    if (fs.existsSync(filePath)) {
      // File exists, return URL to it
      try { console.log('[TTS] cache hit', { file: fileName }); } catch (_) {}
      return res.json({ 
        url: `/tts-cache/${fileName}`,
        cached: true
      });
    }
    
    // File doesn't exist, generate it
    try {
      // Use Google Translate TTS (free, no API key)
      // Note: This is a public endpoint, rate limits may apply
      const encodedText = encodeURIComponent(text);
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${ttsLang}&client=tw-ob&q=${encodedText}`;
      try { console.log('[TTS] fetch', { url: ttsUrl.slice(0, 120) + '...' }); } catch (_) {}
      
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
      
      // Save to disk
      fs.writeFileSync(filePath, Buffer.from(audioBuffer));
      try { console.log('[TTS] saved', { file: fileName, bytes: Buffer.byteLength(Buffer.from(audioBuffer)) }); } catch (_) {}
      
      // Return URL to saved file
      res.json({ 
        url: `/tts-cache/${fileName}`,
        cached: false
      });
      
    } catch (err) {
      console.error('TTS fetch error:', err);
      return res.status(500).json({ error: 'Failed to generate TTS audio', details: err.message });
    }
    
  } catch (err) {
    console.error('TTS endpoint error:', err);
    res.status(500).json({ error: 'TTS generation failed', details: err.message });
  }
}

// Generate one long MP3 file with multiple words (for looping)
async function handleTTSBatch(req, res) {
  try {
    const { words, lang = 'ko-KR', delaySeconds = 2.0 } = req.body;
    try { console.log('[TTS-BATCH] request', { count: Array.isArray(words) ? words.length : 0, delaySeconds }); } catch (_) {}
    
    if (!words || !Array.isArray(words) || words.length === 0) {
      return res.status(400).json({ error: 'words array is required' });
    }
    
    // Limit to 20 words
    const limitedWords = words.slice(0, 20);
    
    // Generate hash for filename (include delaySeconds in hash)
    const hashInput = JSON.stringify({ words: limitedWords, delaySeconds });
    const wordsHash = crypto.createHash('md5').update(hashInput).digest('hex');
    const filePath = path.join(ttsCacheDir, `batch_${wordsHash}.mp3`);
    const fileName = path.basename(filePath);
    
    // Check if file already exists
    if (fs.existsSync(filePath)) {
      try { console.log('[TTS-BATCH] cache hit', { file: fileName }); } catch (_) {}
      return res.json({ 
        url: `/tts-cache/${fileName}`,
        cached: true,
        wordCount: limitedWords.length
      });
    }
    
    // Helper: ensure we have a cached 1-second silent MP3 to compose pauses
    async function getSilenceBufferOneSecond() {
      try {
        const silencePath = path.join(ttsCacheDir, 'silence_1s.mp3');
        if (!fs.existsSync(silencePath)) {
          const silenceUrl = 'https://raw.githubusercontent.com/anars/blank-audio/master/1sec/mp3/1sec.mp3';
          const silenceResp = await fetch(silenceUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          if (!silenceResp.ok) throw new Error(`Failed to download silence: ${silenceResp.status}`);
          const silenceArrayBuf = await silenceResp.arrayBuffer();
          fs.writeFileSync(silencePath, Buffer.from(silenceArrayBuf));
        }
        return fs.readFileSync(silencePath);
      } catch (e) {
        console.error('Silence fetch/cache error:', e);
        return null;
      }
    }

    // Generate the audio file following the format:
    // "How do you say [english]?" -> pause -> [korean]
    const audioBuffers = [];
    
    for (const word of limitedWords) {
      const korean = String(word.korean || '').trim();
      const english = String(word.english || '').trim();
      
      if (!korean && !english) continue;
      try { console.log('[TTS-BATCH] item', { en: english || null, koLen: korean.length }); } catch (_) {}
      
      // Generate "How do you say [english]?" in English (matching recording mode format)
      if (english) {
        try {
          const promptText = `How do you say "${english}"?`;
          const encodedText = encodeURIComponent(promptText);
          const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=${encodedText}`;
          
          const audioResponse = await fetch(ttsUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          
          if (audioResponse.ok) {
            const buffer = await audioResponse.arrayBuffer();
            audioBuffers.push(Buffer.from(buffer));
          }
          
          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (err) {
          console.error('TTS prompt error:', err);
        }
      }
      
      // Generate silent pause (use cached 1s silent MP3 chunks; allow 0 sec)
      if (Number(delaySeconds) > 0) {
        const silenceBuf = await getSilenceBufferOneSecond();
        if (silenceBuf) {
          // Use whole seconds; 0.0 -> 0 chunks (no forced 1s)
          const pauseCount = Math.max(0, Math.floor(Number(delaySeconds) || 0));
          try { console.log('[TTS-BATCH] pause', { seconds: delaySeconds, chunks: pauseCount }); } catch (_) {}
          for (let i = 0; i < pauseCount; i++) {
            audioBuffers.push(Buffer.from(silenceBuf));
          }
        }
      }
      
      // Generate Korean audio
      if (korean) {
        try {
          const encodedText = encodeURIComponent(korean);
          const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=ko&client=tw-ob&q=${encodedText}`;
          
          const audioResponse = await fetch(ttsUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          
          if (audioResponse.ok) {
            const buffer = await audioResponse.arrayBuffer();
            audioBuffers.push(Buffer.from(buffer));
          }
          
          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (err) {
          console.error('TTS Korean error:', err);
        }
      }
    }
    
    if (audioBuffers.length === 0) {
      return res.status(500).json({ error: 'Failed to generate any audio chunks' });
    }
    
    // Concatenate all buffers (simple concatenation - MP3 headers should work)
    const combinedBuffer = Buffer.concat(audioBuffers);
    
    // Save to disk
    fs.writeFileSync(filePath, combinedBuffer);
    try { console.log('[TTS-BATCH] saved', { file: fileName, bytes: combinedBuffer.length }); } catch (_) {}
    
    // Return URL to saved file
    res.json({ 
      url: `/tts-cache/${fileName}`,
      cached: false,
      wordCount: limitedWords.length
    });
    
  } catch (err) {
    console.error('TTS batch error:', err);
    res.status(500).json({ error: 'TTS batch generation failed', details: err.message });
  }
}

module.exports = { handleTTS, handleTTSBatch };

