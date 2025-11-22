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

// Remove punctuation from text before sending to TTS
function removePunctuation(text) {
  if (!text || typeof text !== 'string') return text;
  // Remove common punctuation marks while preserving spaces
  // This regex removes: . , ! ? : ; " ' - ( ) [ ] { } and similar marks
  return text.replace(/[.,!?;:"'\-()\[\]{}…。，！？：；""''—–]/g, '').trim();
}

// Shared function to get/create silence buffer with fallbacks
async function getSilenceBufferOneSecond() {
  const silencePath = path.join(ttsCacheDir, 'silence_1s.mp3');
  
  // If file exists, return it
  if (fs.existsSync(silencePath)) {
    try {
      return fs.readFileSync(silencePath);
    } catch (e) {
      console.warn('Failed to read cached silence file:', e.message);
    }
  }
  
  // Try multiple sources for silence file
  const silenceUrls = [
    'https://raw.githubusercontent.com/anars/blank-audio/master/1sec/mp3/1sec.mp3',
    // Alternative: try a different path in the same repo
    'https://github.com/anars/blank-audio/raw/master/1sec/mp3/1sec.mp3',
  ];
  
  for (const silenceUrl of silenceUrls) {
    try {
      const silenceResp = await fetch(silenceUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      if (silenceResp.ok) {
        const silenceArrayBuf = await silenceResp.arrayBuffer();
        const buf = Buffer.from(silenceArrayBuf);
        // Only save if it's a reasonable size (MP3 files should be at least a few KB)
        if (buf.length > 100) {
          fs.writeFileSync(silencePath, buf);
          return buf;
        }
      }
    } catch (e) {
      // Try next URL
      continue;
    }
  }
  
  // If all else fails, return null (code will continue without pauses)
  // This is not a critical error - audio will just play without pauses between segments
  console.warn('Could not download silence buffer - audio will play without pauses between segments');
  return null;
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
      // Keep punctuation for single TTS requests (likely full sentences)
      const cleanText = text.trim();
      const encodedText = encodeURIComponent(cleanText);
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
    
    // Use shared silence buffer function
    const silenceBuf = await getSilenceBufferOneSecond();

    // Generate the audio file following the format:
    // "How do you say [english]?" -> pause -> [korean]
    const audioBuffers = [];
    
    for (const word of limitedWords) {
      const korean = String(word.korean || '').trim();
      const english = String(word.english || '').trim();
      
      if (!korean && !english) continue;
      try { console.log('[TTS-BATCH] item', { en: english || null, koLen: korean.length }); } catch (_) {}
      
      // Generate "How do you say [english]?" in English (matching recording mode format)
      // Remove punctuation from individual words in the prompt
      if (english) {
        try {
          const cleanEnglish = removePunctuation(english);
          const promptText = `How do you say ${cleanEnglish}`;
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
      
      // Generate Korean audio (remove punctuation for individual words)
      if (korean) {
        try {
          const cleanKorean = removePunctuation(korean);
          const encodedText = encodeURIComponent(cleanKorean);
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

// Generate one long MP3 for a conversation set with configurable order (ko-en or en-ko)
async function handleTTSConversation(req, res) {
  try {
    const { items, order = 'ko-en', delaySeconds = 1.0 } = req.body || {};
    try { console.log('[TTS-CONV] request', { count: Array.isArray(items) ? items.length : 0, order, delaySeconds }); } catch (_) {}
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array is required' });
    }
    const normalized = items
      .map((x) => ({
        korean: String((x && x.korean) || '').trim(),
        english: String((x && x.english) || '').trim(),
      }))
      .filter((x) => x.korean && x.english)
      .slice(0, 20);
    if (normalized.length === 0) {
      return res.status(400).json({ error: 'items must include korean and english fields' });
    }
    // Hash includes content, order and delay
    const hashInput = JSON.stringify({ items: normalized, order, delaySeconds });
    const convHash = crypto.createHash('md5').update(hashInput).digest('hex');
    const filePath = path.join(ttsCacheDir, `conversation_${convHash}.mp3`);
    const fileName = path.basename(filePath);
    if (fs.existsSync(filePath)) {
      try { console.log('[TTS-CONV] cache hit', { file: fileName }); } catch (_) {}
      return res.json({ url: `/tts-cache/${fileName}`, cached: true, itemCount: normalized.length });
    }
    // Use shared silence buffer function
    const audioBuffers = [];
    const silenceBuf = await getSilenceBufferOneSecond();
    const pauseCount = Math.max(0, Math.floor(Number(delaySeconds) || 0));
    const pushPause = () => {
      if (silenceBuf && pauseCount > 0) {
        for (let i = 0; i < pauseCount; i++) audioBuffers.push(Buffer.from(silenceBuf));
      }
    };
    // Helpers to fetch TTS (keep punctuation for full sentences)
    async function fetchTts(text, langCode) {
      if (!text) return null;
      // Keep punctuation for full sentences - only trim whitespace
      const cleanText = text.trim();
      if (!cleanText) return null;
      const encoded = encodeURIComponent(cleanText);
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${langCode}&client=tw-ob&q=${encoded}`;
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
      if (!r.ok) return null;
      const buf = await r.arrayBuffer();
      return Buffer.from(buf);
    }
    for (const it of normalized) {
      const ko = it.korean;
      const en = it.english;
      if (order === 'en-ko') {
        // English then Korean (keep punctuation for full sentences)
        const enBuf = await fetchTts(en, 'en');
        if (enBuf) audioBuffers.push(enBuf);
        pushPause();
        const koBuf = await fetchTts(ko, 'ko');
        if (koBuf) audioBuffers.push(koBuf);
      } else {
        // Default: Korean then English (keep punctuation for full sentences)
        const koBuf = await fetchTts(ko, 'ko');
        if (koBuf) audioBuffers.push(koBuf);
        pushPause();
        const enBuf = await fetchTts(en, 'en');
        if (enBuf) audioBuffers.push(enBuf);
      }
      // Small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    if (audioBuffers.length === 0) {
      return res.status(500).json({ error: 'Failed to generate any audio chunks' });
    }
    const combinedBuffer = Buffer.concat(audioBuffers);
    fs.writeFileSync(filePath, combinedBuffer);
    try { console.log('[TTS-CONV] saved', { file: fileName, bytes: combinedBuffer.length }); } catch (_) {}
    res.json({ url: `/tts-cache/${fileName}`, cached: false, itemCount: normalized.length });
  } catch (err) {
    console.error('TTS conversation error:', err);
    res.status(500).json({ error: 'TTS conversation generation failed', details: err.message });
  }
}

module.exports.handleTTSConversation = handleTTSConversation;

// Generate Level 3 audio: EN sentence → full KO sentence → (word1 KO, word1 EN, word2 KO, word2 EN, ...) → full KO sentence again, for all sentences
async function handleTTSLevel3(req, res) {
  try {
    const { sentences, delaySeconds = 0.5 } = req.body || {};
    try { console.log('[TTS-LEVEL3] request', { count: Array.isArray(sentences) ? sentences.length : 0, delaySeconds }); } catch (_) {}
    if (!sentences || !Array.isArray(sentences) || sentences.length === 0) {
      return res.status(400).json({ error: 'sentences array is required' });
    }
    const normalized = sentences
      .map((x) => ({
        english: String((x && x.english) || '').trim(),
        korean: String((x && x.korean) || '').trim(),
        wordPairs: Array.isArray(x.wordPairs) ? x.wordPairs.map(p => ({
          en: String((p && p.en) || (p && p.english) || '').trim(),
          ko: String((p && p.ko) || (p && p.korean) || '').trim()
        })).filter(p => p.en && p.ko) : []
      }))
      .filter((x) => x.korean && x.english)
      .slice(0, 10);
    if (normalized.length === 0) {
      return res.status(400).json({ error: 'sentences must include korean and english fields' });
    }
    // Hash includes content and delay
    const hashInput = JSON.stringify({ sentences: normalized, delaySeconds });
    const level3Hash = crypto.createHash('md5').update(hashInput).digest('hex');
    const filePath = path.join(ttsCacheDir, `level3_${level3Hash}.mp3`);
    const fileName = path.basename(filePath);
    if (fs.existsSync(filePath)) {
      try { console.log('[TTS-LEVEL3] cache hit', { file: fileName }); } catch (_) {}
      return res.json({ url: `/tts-cache/${fileName}`, cached: true, sentenceCount: normalized.length });
    }
    // Use shared silence buffer function
    const audioBuffers = [];
    const silenceBuf = await getSilenceBufferOneSecond();
    const pauseCount = Math.max(0, Math.floor(Number(delaySeconds) * 10) / 10); // Support decimals
    const pushPause = () => {
      if (silenceBuf && pauseCount > 0) {
        const chunks = Math.floor(pauseCount);
        const remainder = pauseCount - chunks;
        for (let i = 0; i < chunks; i++) audioBuffers.push(Buffer.from(silenceBuf));
        // For remainder, we'd need fractional silence, but for simplicity just use whole seconds
      }
    };
    // Helper to fetch TTS
    async function fetchTts(text, langCode, removePunct = false) {
      if (!text) return null;
      const cleanText = removePunct ? removePunctuation(text) : text.trim();
      if (!cleanText) return null;
      const encoded = encodeURIComponent(cleanText);
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${langCode}&client=tw-ob&q=${encoded}`;
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
      if (!r.ok) return null;
      const buf = await r.arrayBuffer();
      return Buffer.from(buf);
    }
    // Process each sentence
    for (const sent of normalized) {
      // 1. English sentence (keep punctuation for natural intonation)
      const enSentBuf = await fetchTts(sent.english, 'en', false);
      if (enSentBuf) audioBuffers.push(enSentBuf);
      pushPause();
      await new Promise((resolve) => setTimeout(resolve, 200));
      
      // 2. Full Korean sentence (keep punctuation for natural intonation)
      const koSentBuf = await fetchTts(sent.korean, 'ko', false);
      if (koSentBuf) audioBuffers.push(koSentBuf);
      pushPause();
      await new Promise((resolve) => setTimeout(resolve, 200));
      
      // 3. Word pairs: KO word then EN word for each word (remove punctuation - individual words)
      if (sent.wordPairs && sent.wordPairs.length > 0) {
        for (const pair of sent.wordPairs) {
          const koWordBuf = await fetchTts(pair.ko, 'ko', true); // Remove punctuation for individual words
          if (koWordBuf) audioBuffers.push(koWordBuf);
          // Small pause between KO and EN word
          await new Promise((resolve) => setTimeout(resolve, 150));
          const enWordBuf = await fetchTts(pair.en, 'en', true); // Remove punctuation for individual words
          if (enWordBuf) audioBuffers.push(enWordBuf);
          // Pause after each word pair (before next pair)
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
        // Longer pause after all word pairs before final sentence
        pushPause();
      }
      
      // 4. Full Korean sentence again (keep punctuation for natural intonation)
      const koSentBuf2 = await fetchTts(sent.korean, 'ko', false);
      if (koSentBuf2) audioBuffers.push(koSentBuf2);
      pushPause();
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    if (audioBuffers.length === 0) {
      return res.status(500).json({ error: 'Failed to generate any audio chunks' });
    }
    const combinedBuffer = Buffer.concat(audioBuffers);
    fs.writeFileSync(filePath, combinedBuffer);
    try { console.log('[TTS-LEVEL3] saved', { file: fileName, bytes: combinedBuffer.length }); } catch (_) {}
    res.json({ url: `/tts-cache/${fileName}`, cached: false, sentenceCount: normalized.length });
  } catch (err) {
    console.error('TTS Level 3 error:', err);
    res.status(500).json({ error: 'TTS Level 3 generation failed', details: err.message });
  }
}

module.exports.handleTTSLevel3 = handleTTSLevel3;
