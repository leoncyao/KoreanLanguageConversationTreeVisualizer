// Korean number converter - converts Arabic numerals to Korean words
// Uses Sino-Korean (일, 이, 삼...) for counting, dates, money
// Uses Native Korean (하나, 둘, 셋...) for time, age, counting objects

const SINO_KOREAN = {
  0: '영', 1: '일', 2: '이', 3: '삼', 4: '사', 5: '오',
  6: '육', 7: '칠', 8: '팔', 9: '구', 10: '십',
  11: '십일', 12: '십이', 13: '십삼', 14: '십사', 15: '십오',
  16: '십육', 17: '십칠', 18: '십팔', 19: '십구', 20: '이십',
  30: '삼십', 40: '사십', 50: '오십', 60: '육십', 70: '칠십', 80: '팔십', 90: '구십', 100: '백'
};

const NATIVE_KOREAN = {
  1: '하나', 2: '둘', 3: '셋', 4: '넷', 5: '다섯',
  6: '여섯', 7: '일곱', 8: '여덟', 9: '아홉', 10: '열',
  11: '열하나', 12: '열둘', 13: '열셋', 14: '열넷', 15: '열다섯',
  16: '열여섯', 17: '열일곱', 18: '열여덟', 19: '열아홉', 20: '스무',
  21: '스물하나', 22: '스물둘', 23: '스물셋', 24: '스물넷', 25: '스물다섯',
  26: '스물여섯', 27: '스물일곱', 28: '스물여덟', 29: '스물아홉', 30: '서른'
};

// Convert number to Sino-Korean (for counting, dates, money)
function toSinoKorean(num) {
  if (typeof num !== 'number' || isNaN(num)) return String(num);
  if (num < 0) return '마이너스 ' + toSinoKorean(-num);
  if (num === 0) return '영';
  if (SINO_KOREAN[num]) return SINO_KOREAN[num];
  
  // For larger numbers, build from components
  if (num < 100) {
    const tens = Math.floor(num / 10);
    const ones = num % 10;
    if (tens === 0) return SINO_KOREAN[ones];
    if (ones === 0) return SINO_KOREAN[tens * 10];
    return SINO_KOREAN[tens * 10] + SINO_KOREAN[ones];
  }
  
  // For 100+
  if (num < 1000) {
    const hundreds = Math.floor(num / 100);
    const remainder = num % 100;
    if (remainder === 0) return SINO_KOREAN[hundreds] + '백';
    return SINO_KOREAN[hundreds] + '백' + toSinoKorean(remainder);
  }
  
  // For very large numbers, return as-is (rare in conversational Korean)
  return String(num);
}

// Convert number to Native Korean (for time, age, counting objects)
function toNativeKorean(num) {
  if (typeof num !== 'number' || isNaN(num)) return String(num);
  if (num < 1) return String(num);
  if (NATIVE_KOREAN[num]) return NATIVE_KOREAN[num];
  
  // For larger numbers, use Sino-Korean (native Korean is typically only 1-30)
  if (num > 30) return toSinoKorean(num);
  
  // Build from components for 21-29
  if (num > 20 && num < 30) {
    const ones = num % 10;
    if (ones === 0) return '스무';
    return '스물' + NATIVE_KOREAN[ones];
  }
  
  return String(num);
}

// Determine which number system to use based on context
function convertNumberToKorean(num, context = '') {
  const numStr = String(num);
  const contextLower = context.toLowerCase();
  
  // Time (시, 시간) - use Native Korean
  if (contextLower.includes('시') || contextLower.includes('시간') || contextLower.includes('time') || contextLower.includes('o\'clock')) {
    return toNativeKorean(num);
  }
  
  // Age (살, 세) - use Native Korean
  if (contextLower.includes('살') || contextLower.includes('세') || contextLower.includes('age') || contextLower.includes('years old')) {
    return toNativeKorean(num);
  }
  
  // Counting objects (개, 명, 마리, etc.) - use Native Korean
  if (contextLower.includes('개') || contextLower.includes('명') || contextLower.includes('마리') || 
      contextLower.includes('things') || contextLower.includes('people') || contextLower.includes('animals')) {
    return toNativeKorean(num);
  }
  
  // Dates, money, phone numbers, addresses - use Sino-Korean
  if (contextLower.includes('월') || contextLower.includes('일') || contextLower.includes('원') || 
      contextLower.includes('date') || contextLower.includes('money') || contextLower.includes('won')) {
    return toSinoKorean(num);
  }
  
  // Default: use Sino-Korean for general counting
  return toSinoKorean(num);
}

// Replace numbers in Korean text with Korean words
function convertNumbersInKoreanText(text, context = '') {
  if (!text || typeof text !== 'string') return text;
  
  // Match Arabic numerals (including decimals and negative)
  const numberRegex = /(-?\d+\.?\d*)/g;
  
  return text.replace(numberRegex, (match) => {
    const num = parseFloat(match);
    if (isNaN(num)) return match;
    
    // Check if it's a decimal (keep as-is for now, or convert integer part)
    if (match.includes('.')) {
      const parts = match.split('.');
      const intPart = parseInt(parts[0]);
      const decPart = parts[1];
      if (!isNaN(intPart)) {
        return convertNumberToKorean(intPart, context) + '.' + decPart;
      }
      return match;
    }
    
    return convertNumberToKorean(num, context);
  });
}

module.exports = {
  toSinoKorean,
  toNativeKorean,
  convertNumberToKorean,
  convertNumbersInKoreanText
};

