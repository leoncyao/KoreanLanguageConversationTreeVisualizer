# API Test Scripts

Curl test scripts for all API endpoints.

## Usage

### Run Individual Tests (Development - Port 5001)

```bash
# Test translation endpoint (default port 5001)
./scripts/test-translate.sh

# Test model sentence endpoints
./scripts/test-model-sentence.sh

# Test phrase endpoints
./scripts/test-phrases.sh

# Test variation generation
./scripts/test-variations.sh

# Test word queries
./scripts/test-words.sh

# Test verb conjugation storage
./scripts/test-verbs.sh
```

### Run All Tests

```bash
# Test development server (port 5001)
./scripts/test-all.sh

# Test production server (port 5000)
./scripts/test-all-prod.sh
```

### Test Against Different Port

All scripts accept a port number as the first argument:

```bash
# Test against production port
./scripts/test-translate.sh 5000

# Test against custom port
./scripts/test-translate.sh 8080

# Test all endpoints on production
./scripts/test-all.sh 5000
```

## Prerequisites

- **jq**: JSON processor for pretty output
  ```bash
  sudo apt install jq  # Ubuntu/Debian
  brew install jq      # macOS
  ```

- **Server must be running**:
  ```bash
  # Development (port 5001)
  npm run start-server-dev
  
  # Production (port 5000)
  npm run start-server-prod
  ```

## Available Endpoints

### Translation
- `POST /api/translate` - Translate English to Korean and parse words

### Model Sentence
- `GET /api/model-sentence` - Get current model sentence
- `POST /api/model-sentence` - Save/update model sentence
- `DELETE /api/model-sentence` - Clear model sentence

### Phrases
- `GET /api/sentences` - Get random practice sentences
- `POST /api/sentences/:id/correct` - Mark sentence as correct/incorrect

### Variations
- `POST /api/generate-variations` - Generate sentence variations from model

### Words
- `GET /api/words/:type` - Get words by type (verb, noun, adjective, etc.)
- `GET /api/words/stats/summary` - Get word statistics summary

## Port Configuration

| Environment | Port | Command |
|-------------|------|---------|
| **Development** | 5001 | `npm run start-server-dev` |
| **Production** | 5000 | `npm run start-server-prod` |

**Default**: All test scripts default to port **5001** (development)

## Examples

### Quick Translation Test
```bash
# Development
curl -X POST http://localhost:5001/api/translate \
  -H "Content-Type: application/json" \
  -d '{"text": "I study Korean"}' | jq '.'

# Production
curl -X POST http://localhost:5000/api/translate \
  -H "Content-Type: application/json" \
  -d '{"text": "I study Korean"}' | jq '.'
```

### Check Verb Conjugations
```bash
# Development
curl http://localhost:5001/api/words/verb?limit=5 | jq '.'

# Production
curl http://localhost:5000/api/words/verb?limit=5 | jq '.'
```

### Using Test Scripts
```bash
# Test development server
./scripts/test-translate.sh          # uses port 5001
./scripts/test-all.sh                # uses port 5001

# Test production server
./scripts/test-translate.sh 5000     # override to port 5000
./scripts/test-all-prod.sh           # explicitly tests port 5000
```

