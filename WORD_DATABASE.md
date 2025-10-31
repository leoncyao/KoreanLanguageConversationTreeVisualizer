# Korean Word Database System

## Overview
The system now automatically breaks down Korean sentences into individual words and categorizes them by part of speech.

## Database Tables

### 1. **Nouns** (`nouns` table)
- Korean word
- English meaning
- Romanization
- Usage statistics (times_seen, times_correct, times_incorrect)

### 2. **Verbs** (`verbs` table)
- Korean word
- English meaning
- Romanization
- Base form (dictionary form)
- Conjugation type
- Usage statistics

### 3. **Adjectives** (`adjectives` table)
- Korean word
- English meaning
- Romanization
- Base form
- Usage statistics

### 4. **Adverbs** (`adverbs` table)
- Korean word
- English meaning
- Romanization
- Usage statistics

### 5. **Pronouns** (`pronouns` table)
- Korean word
- English meaning
- Romanization
- Pronoun type (personal/demonstrative/interrogative)
- Usage statistics

### 6. **Conjunctions** (`conjunctions` table)
- Korean word
- English meaning
- Romanization
- Usage statistics

### 7. **Particles** (`particles` table)
Korean particles (조사) like 은/는, 이/가, 을/를, 에, 에서, 으로
- Korean word
- English meaning
- Romanization
- Particle type (subject/object/topic/etc.)
- Usage statistics

## How It Works

### 1. When you translate text:
```
You type: "I am a student"
API translates to: "나는 학생이에요"
```

### 2. Automatic parsing:
The system automatically breaks down the Korean sentence:
- **나** (na) - pronoun - "I"
- **는** (neun) - particle (topic marker) - "topic marker"
- **학생** (haksaeng) - noun - "student"
- **이** (i) - particle (copula) - "to be"
- **에요** (eyo) - verb ending - "polite form"

### 3. Database storage:
Each word is saved to its appropriate table and linked to the phrase.

## API Endpoints

### Get words by type:
```
GET /api/words/noun?limit=50
GET /api/words/verb?limit=50
GET /api/words/adjective?limit=50
GET /api/words/adverb?limit=50
GET /api/words/pronoun?limit=50
GET /api/words/conjunction?limit=50
GET /api/words/particle?limit=50
```

### Get summary statistics:
```
GET /api/words/stats/summary
```

Response:
```json
{
  "noun": { "count": 45, "totalSeen": 123 },
  "verb": { "count": 32, "totalSeen": 89 },
  "adjective": { "count": 15, "totalSeen": 34 },
  ...
}
```

## Frontend Usage

```javascript
import { api } from './api';

// Get all nouns
const response = await api.getWordsByType('noun', 50);
const nouns = await response.json();

// Get word statistics
const statsResponse = await api.getWordsSummary();
const stats = await statsResponse.json();
```

## Benefits

1. **Automatic word extraction** - No manual entry needed
2. **Part of speech tracking** - Know which words are verbs, nouns, etc.
3. **Usage statistics** - Track which words you see most often
4. **Vocabulary building** - Review words by category
5. **Base form tracking** - For verbs/adjectives, see dictionary form

## Future Enhancements

- Create a vocabulary review page showing words by category
- Add spaced repetition for individual words
- Create word quizzes by part of speech
- Track conjugation patterns for verbs
- Add example sentences for each word

