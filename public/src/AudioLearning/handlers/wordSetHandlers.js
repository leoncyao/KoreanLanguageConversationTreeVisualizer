import { generateAndPlayLoop } from '../audioLoop';
import { parseJsonArraySafe } from '../utils/sentenceGenerators';

export const createHandleGenerateSet = (api, generatorPrompt, generatedSetTitle, setGeneratorLoading, setGeneratedWords, setGeneratedSetTitle) => {
  return async () => {
    try {
      setGeneratorLoading(true);
      setGeneratedWords([]);
      const resp = await api.chat(generatorPrompt);
      const data = await resp.json().catch(() => null);
      const arr = parseJsonArraySafe(data && (data.response || ''));
      const norm = arr
        .map((x) => ({ korean: String((x.ko || x.korean || '')).trim(), english: String((x.en || x.english || '')).trim() }))
        .filter((x) => x.korean && x.english)
        .slice(0, 20);
      setGeneratedWords(norm);
      if (!generatedSetTitle || generatedSetTitle === 'My Word Set') {
        const ts = new Date();
        const t = `${ts.getFullYear()}-${String(ts.getMonth()+1).padStart(2,'0')}-${String(ts.getDate()).padStart(2,'0')} ${String(ts.getHours()).padStart(2,'0')}:${String(ts.getMinutes()).padStart(2,'0')}`;
        setGeneratedSetTitle(`Set ${t}`);
      }
    } catch (_) {
      setGeneratedWords([]);
    } finally {
      setGeneratorLoading(false);
    }
  };
};

export const createSaveGeneratedSet = (generatedWords, generatedSetTitle, wordSets, persistSets, setShowGenerator, setGeneratedWords) => {
  return () => {
    if (!generatedWords || generatedWords.length === 0) return;
    const id = Date.now().toString(36);
    const set = { id, title: generatedSetTitle || 'Untitled', words: generatedWords, createdAt: Date.now() };
    persistSets([set, ...wordSets]);
    setShowGenerator(false);
    setGeneratedWords([]);
  };
};

export const createPlaySet = (quizDelaySec, setIsQuizLooping, playingRef, pausedRef, quizLoopRef, setCurrentSetWords, setLoopGenerating, setLoopProgress) => {
  return async (set) => {
    if (!set || !Array.isArray(set.words) || set.words.length === 0) return;
    setIsQuizLooping(true);
    playingRef.current = true;
    pausedRef.current = false;
    quizLoopRef.current = true;
    try {
      setCurrentSetWords(set.words.slice(0, 20));
      setLoopGenerating(true);
      setLoopProgress(10);
      const timer = setInterval(() => setLoopProgress((p) => Math.min(90, p + 5)), 300);
      await generateAndPlayLoop(set.words, 'ko-KR', 1.0, quizDelaySec);
      clearInterval(timer);
      setLoopProgress(100);
    } catch (_) {
    } finally {
      setLoopGenerating(false);
      setLoopProgress(0);
    }
  };
};

