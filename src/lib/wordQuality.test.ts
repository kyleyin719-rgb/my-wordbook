import { describe, expect, it } from 'vitest';
import type { Word } from '../types';
import { getWordCompleteness, matchesQualityFilter } from './wordQuality';

function word(overrides: Partial<Word> = {}): Word {
  return {
    id: 'word-1', groupId: 'group-1', word: 'example', english: 'example',
    ipaUK: '/ɪɡˈzɑːm.pəl/', ipaUS: '/ɪɡˈzæm.pəl/', partOfSpeech: 'n.',
    meaning: '例子', turkish: '例子', examples: [{ id: 'example-1', en: 'An example.', zh: '一个例子。' }],
    note: 'note', starred: false, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    correctCount: 0, wrongCount: 0, ...overrides
  };
}

describe('word completeness', () => {
  it('returns the expected dynamic status', () => {
    expect(getWordCompleteness(word())).toBe('complete');
    expect(getWordCompleteness(word({ ipaUK: '' }))).toBe('missing-ipa');
    expect(getWordCompleteness(word({ partOfSpeech: '' }))).toBe('missing-pos');
    expect(getWordCompleteness(word({ examples: [] }))).toBe('missing-example');
    expect(getWordCompleteness(word({ ipaUK: '', examples: [] }))).toBe('multiple-missing');
  });

  it('filters every reported missing field', () => {
    expect(matchesQualityFilter(word({ ipaUK: '' }), 'missing-ipa-uk')).toBe(true);
    expect(matchesQualityFilter(word({ ipaUS: '' }), 'missing-ipa-us')).toBe(true);
    expect(matchesQualityFilter(word({ meaning: '' }), 'missing-meaning')).toBe(true);
    expect(matchesQualityFilter(word({ examples: [{ id: 'e', en: 'Sentence.', zh: '' }] }), 'missing-example-translation')).toBe(true);
    expect(matchesQualityFilter(word({ note: '' }), 'missing-note')).toBe(true);
  });
});
