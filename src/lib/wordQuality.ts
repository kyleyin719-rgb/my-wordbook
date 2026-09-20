import type { Word } from '../types';

export type WordCompleteness = 'complete' | 'missing-ipa' | 'missing-pos' | 'missing-example' | 'multiple-missing';
export type QualityFilter = 'complete' | 'missing-ipa-uk' | 'missing-ipa-us' | 'missing-pos' | 'missing-meaning' | 'missing-example' | 'missing-example-translation' | 'missing-note';

export function getWordCompleteness(word: Word): WordCompleteness {
  const missingIpa = !word.ipaUK.trim() || !word.ipaUS.trim();
  const missingPos = !word.partOfSpeech.trim();
  const missingExample = word.examples.length === 0;
  const count = Number(missingIpa) + Number(missingPos) + Number(missingExample);
  if (count === 0) return 'complete';
  if (count > 1) return 'multiple-missing';
  if (missingIpa) return 'missing-ipa';
  if (missingPos) return 'missing-pos';
  return 'missing-example';
}

export function matchesQualityFilter(word: Word, filter: QualityFilter): boolean {
  switch (filter) {
    case 'complete': return getWordCompleteness(word) === 'complete';
    case 'missing-ipa-uk': return !word.ipaUK.trim();
    case 'missing-ipa-us': return !word.ipaUS.trim();
    case 'missing-pos': return !word.partOfSpeech.trim();
    case 'missing-meaning': return !word.meaning.trim();
    case 'missing-example': return word.examples.length === 0;
    case 'missing-example-translation': return word.examples.some(example => example.en.trim() && !example.zh.trim());
    case 'missing-note': return !word.note.trim();
  }
}
