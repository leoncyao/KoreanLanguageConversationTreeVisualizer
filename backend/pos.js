// Coarse POS mapping shared in backend
// Codes:
// 0: other, 1: pronoun, 2: noun, 3: proper_noun, 4: verb, 5: adjective,
// 6: adverb, 7: particle, 8: numeral, 9: determiner, 10: interjection
const POS_CODE = {
  other: 0,
  pronoun: 1,
  noun: 2,
  proper_noun: 3,
  verb: 4,
  adjective: 5,
  adverb: 6,
  particle: 7,
  numeral: 8,
  determiner: 9,
  interjection: 10,
};

const POS_LABEL_BY_CODE = Object.fromEntries(Object.entries(POS_CODE).map(([k, v]) => [v, k]));

function normalizeTypeToCode(input) {
  if (!input) return POS_CODE.other;
  const s = String(input).toLowerCase().trim();
  if (s.includes('proper')) return POS_CODE.proper_noun;
  if (s.includes('pronoun')) return POS_CODE.pronoun;
  if (s.includes('verb')) return POS_CODE.verb;
  if (s.includes('adjective')) return POS_CODE.adjective;
  if (s.includes('adverb')) return POS_CODE.adverb;
  if (s.includes('particle') || s.includes('postposition')) return POS_CODE.particle;
  if (s.includes('numeral') || s.includes('number')) return POS_CODE.numeral;
  if (s.includes('determiner') || s.includes('det')) return POS_CODE.determiner;
  if (s.includes('interjection')) return POS_CODE.interjection;
  if (s.includes('noun')) return POS_CODE.noun;
  return POS_CODE.other;
}

function codeToType(code) {
  const n = Number(code);
  const label = POS_LABEL_BY_CODE[n];
  return label || 'other';
}

module.exports = {
  POS_CODE,
  POS_LABEL_BY_CODE,
  normalizeTypeToCode,
  codeToType,
};


