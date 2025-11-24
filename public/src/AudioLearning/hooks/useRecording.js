import React from 'react';

export const useRecording = () => {
  const [isMicRecording, setIsMicRecording] = React.useState(false);
  const [recordedUrl, setRecordedUrl] = React.useState('');
  const [recordingError, setRecordingError] = React.useState('');
  const recorderRef = React.useRef(null);
  const mediaStreamRef = React.useRef(null);
  const recordedChunksRef = React.useRef([]);
  const recognitionRef = React.useRef(null);
  const recognizedRef = React.useRef('');
  const [recognizedText, setRecognizedText] = React.useState('');

  const checkRecordingSupport = React.useCallback(() => {
    const isSecureContext = window.isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    
    if (!isSecureContext) {
      return 'Recording requires HTTPS on Android. Your connection is HTTP. Please access via HTTPS or localhost.';
    }
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return 'getUserMedia not available. Try Chrome or Firefox on HTTPS.';
    }
    
    if (!MediaRecorder) {
      return 'MediaRecorder not supported in this browser. Try Chrome or Firefox.';
    }
    
    return '';
  }, []);

  const startMicRecording = React.useCallback(async () => {
    try {
      if (isMicRecording) return;
      
      // Request audio permissions
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      mediaStreamRef.current = stream;
      
      let mr;
      let mimeType = '';
      
      // Better Android codec detection
      const codecs = [
        'audio/webm;codecs=opus',
        'audio/webm;codecs=pcm',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/mpeg',
        ''
      ];
      
      for (const codec of codecs) {
        try {
          if (!codec || MediaRecorder.isTypeSupported(codec)) {
            mimeType = codec;
            mr = codec ? new MediaRecorder(stream, { mimeType: codec }) : new MediaRecorder(stream);
            break;
          }
        } catch (e) {
          continue;
        }
      }
      
      if (!mr) {
        // Fallback: try without specifying mimeType
        try {
          mr = new MediaRecorder(stream);
        } catch (err) {
          console.error('MediaRecorder not supported:', err);
          setIsMicRecording(false);
          stream.getTracks().forEach(t => t.stop());
          return;
        }
      }
      
      recordedChunksRef.current = [];
      const recordingPromise = new Promise((resolve) => {
        mr.onerror = (e) => {
          console.error('MediaRecorder error:', e);
          resolve(null);
        };
        mr.ondataavailable = (e) => { 
          if (e && e.data && e.data.size > 0) {
            recordedChunksRef.current.push(e.data);
          }
        };
        mr.onstop = () => {
          try {
            const finalMimeType = mimeType || 'audio/webm';
            const blob = new Blob(recordedChunksRef.current, { type: finalMimeType });
            if (blob.size === 0) {
              console.warn('Empty recording blob');
              resolve(null);
              return;
            }
            const url = URL.createObjectURL(blob);
            setRecordedUrl((prev) => { if (prev) { try { URL.revokeObjectURL(prev); } catch (_) {} } return url; });
            resolve(url);
          } catch (err) {
            console.error('Error creating blob:', err);
            resolve(null);
          }
        };
      });
      recorderRef.current = mr;
      recorderRef.current._recordingPromise = recordingPromise;
      
      // Android often needs timeslice for continuous data
      const timeslice = 1000;
      mr.start(timeslice);
      setIsMicRecording(true);
      setRecordingError(''); // Clear any previous errors
    } catch (err) {
      console.error('Failed to start recording:', err);
      setIsMicRecording(false);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
      }
      let errorMsg = 'Recording failed. ';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg += 'Microphone permission denied. Please allow access.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMsg += 'No microphone found.';
      } else if (err.name === 'NotSupportedError' || err.name === 'TypeError') {
        errorMsg += 'MediaRecorder not supported. Try using Chrome/Firefox on HTTPS.';
      } else {
        errorMsg += err.message || String(err);
      }
      setRecordingError(errorMsg);
    }
  }, [isMicRecording]);

  const stopMicRecording = React.useCallback(async () => {
    let url = null;
    try {
      const r = recorderRef.current;
      if (r && r.state !== 'inactive' && r.state !== 'stopped') {
        try {
          r.stop();
        } catch (err) {
          console.warn('Error stopping recorder:', err);
        }
        if (r._recordingPromise) {
          // Android may need more time to finalize
          try {
            url = await Promise.race([
              r._recordingPromise,
              new Promise((resolve) => setTimeout(() => resolve(null), 3000))
            ]);
          } catch (err) {
            console.error('Error waiting for recording promise:', err);
          }
        }
      }
    } catch (err) {
      console.error('Error in stopMicRecording:', err);
    }
    setIsMicRecording(false);
    try { 
      const ms = mediaStreamRef.current; 
      if (ms) { 
        ms.getTracks().forEach(t => {
          try { t.stop(); } catch (_) {}
        }); 
        mediaStreamRef.current = null; 
      } 
    } catch (_) {}
    // Android may need more time to finalize blob
    await new Promise(r => setTimeout(r, 300));
    return url;
  }, []);

  const playRecorded = React.useCallback((url) => {
    return new Promise((resolve) => {
      try {
        const audioUrl = url || recordedUrl;
        if (!audioUrl) return resolve();
        
        try { console.log('[RecordedAudio] create', { url: audioUrl }); } catch (_) {}
        const audio = new Audio(audioUrl);
        let resolved = false;
        
        const cleanup = () => {
          if (resolved) return;
          resolved = true;
          try {
            audio.removeEventListener('ended', onEnded);
            audio.removeEventListener('error', onError);
            audio.removeEventListener('canplaythrough', onCanPlay);
            audio.pause();
            audio.src = '';
            audio.load();
          } catch (_) {}
          resolve();
        };
        
        const onError = (e) => {
          console.error('Audio playback error:', e);
          cleanup();
        };
        
        const onEnded = () => {
          try { console.log('[RecordedAudio] ended'); } catch (_) {}
          cleanup();
        };
        
        const onCanPlay = () => {
          try { console.log('[RecordedAudio] canplaythrough'); } catch (_) {}
          audio.play().then(() => {
            // Wait for ended event
            try { console.log('[RecordedAudio] playing'); } catch (_) {}
          }).catch((err) => {
            console.error('Audio play failed:', err);
            cleanup();
          });
        };
        
        audio.addEventListener('error', onError);
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('canplaythrough', onCanPlay);
        
        // Android may need explicit load
        audio.load();
        
        // Fallback timeout
        setTimeout(() => {
          if (!resolved) {
            console.warn('Audio playback timeout');
            cleanup();
          }
        }, 10000);
      } catch (err) {
        console.error('Audio creation error:', err);
        resolve();
      }
    });
  }, [recordedUrl]);

  const startSpeechRecognition = React.useCallback(() => {
    try {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) return false;
      const rec = new SR();
      recognitionRef.current = rec;
      rec.lang = 'ko-KR';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      recognizedRef.current = '';
      setRecognizedText('');
      rec.onresult = (e) => {
        const t = (e && e.results && e.results[0] && e.results[0][0] && e.results[0][0].transcript) || '';
        recognizedRef.current = String(t);
        setRecognizedText(String(t));
      };
      rec.onerror = () => {};
      rec.onend = () => {};
      rec.start();
      return true;
    } catch (_) {
      return false;
    }
  }, []);

  const stopSpeechRecognition = React.useCallback(() => {
    try { const r = recognitionRef.current; if (r) { try { r.stop(); } catch (_) {}; try { r.abort && r.abort(); } catch (_) {} } } catch (_) {}
  }, []);

  return {
    isMicRecording,
    recordedUrl,
    recordingError,
    recognizedText,
    recognizedRef,
    checkRecordingSupport,
    startMicRecording,
    stopMicRecording,
    playRecorded,
    startSpeechRecognition,
    stopSpeechRecognition,
    recorderRef,
    mediaStreamRef,
  };
};

