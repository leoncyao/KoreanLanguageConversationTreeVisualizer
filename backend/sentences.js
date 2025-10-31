const Database = require('./database');

// API to get random sentences from database
async function handleGetSentences(req, res) {
  console.log('GET /api/sentences request received.');
  
  try {
    const db = new Database();
    await db.init();
    
    // Get 5 random phrases from the database
    const phrases = await new Promise((resolve, reject) => {
      db.db.all(
        'SELECT id, korean_text, english_text, times_correct, times_incorrect FROM phrases ORDER BY RANDOM() LIMIT 5',
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
    
    await db.close();
    
    // Transform to match expected format
    const sentences = phrases.map(phrase => ({
      id: phrase.id,
      korean: phrase.korean_text,
      english: phrase.english_text,
      correctCount: phrase.times_correct,
      incorrectCount: phrase.times_incorrect
    }));
    
    console.log(`GET /api/sentences successful. Sending ${sentences.length} sentences.`);
    res.json(sentences);
    
  } catch (error) {
    console.error('Failed to get sentences from database:', error);
    res.status(500).json({ error: 'Failed to load sentences' });
  }
}

// API to update correct/incorrect count for a sentence
async function handleCorrectSentence(req, res) {
  const sentenceId = parseInt(req.params.id, 10);
  const { correct } = req.body;
  
  console.log(`POST /api/sentences/${sentenceId}/correct request received. Correct: ${correct}`);

  try {
    const db = new Database();
    await db.init();
    
    // Update the phrase stats
    const column = correct ? 'times_correct' : 'times_incorrect';
    await new Promise((resolve, reject) => {
      db.db.run(
        `UPDATE phrases SET ${column} = ${column} + 1 WHERE id = ?`,
        [sentenceId],
        function(err) {
          if (err) reject(err);
          else if (this.changes === 0) reject(new Error('Phrase not found'));
          else resolve();
        }
      );
    });
    
    // Get updated phrase
    const phrase = await new Promise((resolve, reject) => {
      db.db.get(
        'SELECT id, korean_text, english_text, times_correct, times_incorrect FROM phrases WHERE id = ?',
        [sentenceId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    await db.close();
    
    const sentence = {
      id: phrase.id,
      korean: phrase.korean_text,
      english: phrase.english_text,
      correctCount: phrase.times_correct,
      incorrectCount: phrase.times_incorrect
    };
    
    console.log(`Stats updated for sentence ID ${sentenceId}. Correct: ${sentence.correctCount}, Incorrect: ${sentence.incorrectCount}`);
    res.json({ message: 'Stats updated', sentence });
    
  } catch (error) {
    console.error('Failed to update sentence stats:', error);
    if (error.message === 'Phrase not found') {
      res.status(404).json({ error: 'Sentence not found' });
    } else {
      res.status(500).json({ error: 'Failed to update sentence stats' });
    }
  }
}

module.exports = { handleGetSentences, handleCorrectSentence };
