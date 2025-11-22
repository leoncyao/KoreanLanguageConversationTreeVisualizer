const Database = require('./database');

// Get all curriculum phrases
async function handleGetCurriculumPhrases(req, res) {
  try {
    const db = new Database();
    await db.init();
    const phrases = await db.getAllCurriculumPhrases();
    await db.close();
    res.json(phrases);
  } catch (error) {
    console.error('Error fetching curriculum phrases:', error);
    res.status(500).json({ error: 'Failed to fetch curriculum phrases' });
  }
}

// Get random curriculum phrase
async function handleGetRandomCurriculumPhrase(req, res) {
  let db = null;
  try {
    db = new Database();
    await db.init();
    const phrase = await db.getRandomCurriculumPhrase();
    if (!phrase) {
      await db.close();
      return res.status(404).json({ error: 'No curriculum phrases found' });
    }
    await db.close();
    res.json(phrase);
  } catch (error) {
    console.error('Error fetching random curriculum phrase:', error);
    if (db) {
      try {
        await db.close();
      } catch (closeError) {
        console.error('Error closing database:', closeError);
      }
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to fetch random curriculum phrase',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    });
  }
}

// Add curriculum phrase
async function handleAddCurriculumPhrase(req, res) {
  try {
    const { korean_text, english_text, blank_word_index, blank_word_indices, correct_answers, grammar_breakdown, blank_word_types, word_types } = req.body || {};
    if (!korean_text || !english_text) {
      return res.status(400).json({ error: 'korean_text and english_text are required' });
    }
    // Support both old format (blank_word_index) and new format (blank_word_indices)
    let blankWordIndices = blank_word_indices || [];
    if (blankWordIndices.length === 0 && blank_word_index !== undefined && blank_word_index !== null) {
      blankWordIndices = [blank_word_index];
    }
    const db = new Database();
    await db.init();
    const id = await db.addCurriculumPhrase(
      korean_text,
      english_text,
      blankWordIndices,
      correct_answers || [],
      grammar_breakdown || null,
      blank_word_types || [],
      Array.isArray(word_types) ? word_types : null
    );
    await db.close();
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error adding curriculum phrase:', error);
    res.status(500).json({ error: 'Failed to add curriculum phrase' });
  }
}

// Update curriculum phrase
async function handleUpdateCurriculumPhrase(req, res) {
  try {
    const id = parseInt(req.params.id);
    const { korean_text, english_text, blank_word_index, blank_word_indices, correct_answers, grammar_breakdown, blank_word_types, word_types } = req.body || {};
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    if (!korean_text || !english_text) {
      return res.status(400).json({ error: 'korean_text and english_text are required' });
    }
    // Support both old format (blank_word_index) and new format (blank_word_indices)
    let blankWordIndices = blank_word_indices || [];
    if (blankWordIndices.length === 0 && blank_word_index !== undefined && blank_word_index !== null) {
      blankWordIndices = [blank_word_index];
    }
    const db = new Database();
    await db.init();
    const changes = await db.updateCurriculumPhrase(
      id,
      korean_text,
      english_text,
      blankWordIndices,
      correct_answers || [],
      grammar_breakdown || null,
      blank_word_types || [],
      Array.isArray(word_types) ? word_types : null
    );
    await db.close();
    if (changes === 0) {
      return res.status(404).json({ error: 'Curriculum phrase not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating curriculum phrase:', error);
    res.status(500).json({ error: 'Failed to update curriculum phrase' });
  }
}

// Delete curriculum phrase
async function handleDeleteCurriculumPhrase(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const db = new Database();
    await db.init();
    const changes = await db.deleteCurriculumPhrase(id);
    await db.close();
    if (changes === 0) {
      return res.status(404).json({ error: 'Curriculum phrase not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting curriculum phrase:', error);
    res.status(500).json({ error: 'Failed to delete curriculum phrase' });
  }
}

// Update curriculum phrase stats
async function handleUpdateCurriculumPhraseStats(req, res) {
  try {
    const phraseId = req.params.id;
    const isCorrect = req.body.correct !== false;
    const db = new Database();
    await db.init();
    await db.updateCurriculumPhraseStats(phraseId, isCorrect);
    await db.close();
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating curriculum phrase stats:', error);
    res.status(500).json({ error: 'Failed to update curriculum phrase stats' });
  }
}

// Archive/unarchive curriculum phrase
async function handleArchiveCurriculumPhrase(req, res) {
  try {
    const id = parseInt(req.params.id);
    const isArchived = req.body.is_archived !== false;
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const db = new Database();
    await db.init();
    const changes = await db.archiveCurriculumPhrase(id, isArchived);
    await db.close();
    if (changes === 0) {
      return res.status(404).json({ error: 'Curriculum phrase not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error archiving curriculum phrase:', error);
    res.status(500).json({ error: 'Failed to archive curriculum phrase' });
  }
}

module.exports = {
  handleGetCurriculumPhrases,
  handleGetRandomCurriculumPhrase,
  handleAddCurriculumPhrase,
  handleUpdateCurriculumPhrase,
  handleDeleteCurriculumPhrase,
  handleUpdateCurriculumPhraseStats,
  handleArchiveCurriculumPhrase
};

