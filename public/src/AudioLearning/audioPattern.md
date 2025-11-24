# Audio Pattern Specification

## Standard Conversation Audio Pattern

For each sentence in a conversation, the audio playback follows this exact sequence:

1. **English sentence** - Play the full English translation
2. **Korean sentence** - Play the full Korean sentence
3. **Word-by-word pairs** - For each Korean word in the sentence:
   - Play the Korean word
   - Play its English translation/gloss
   - (Repeat for all words in order)
4. **Korean sentence (repeat)** - Play the full Korean sentence again

### Example

For the sentence:
- Korean: "오늘 저녁에 시간 있으세요?"
- English: "Do you have time this evening?"

The audio sequence would be:
1. "Do you have time this evening?"
2. "오늘 저녁에 시간 있으세요?"
3. "오늘" → "today"
   "저녁에" → "in the evening"
   "시간" → "time"
   "있으세요?" → "do you have"
4. "오늘 저녁에 시간 있으세요?" (repeat)

### Implementation Notes

- This pattern ensures learners hear:
  - The meaning first (English)
  - The full Korean sentence
  - Word-level breakdown for vocabulary learning
  - The full Korean sentence again for reinforcement

- The pattern is implemented in the `/api/tts/conversation` endpoint
- Word pairs are generated using the `getWordByWordPairs` function
- Delays between segments are configurable via `delaySeconds` parameter

