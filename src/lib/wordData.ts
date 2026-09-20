import type { Example, Word } from '../types';

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function dateOrNow(value: unknown): string {
  const date = text(value);
  return date && !Number.isNaN(Date.parse(date)) ? date : new Date().toISOString();
}

export function wordKey(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeExamples(value: unknown): Example[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((example): example is Record<string, unknown> => Boolean(example) && typeof example === 'object' && !Array.isArray(example))
    .map(example => ({ id: text(example.id) || crypto.randomUUID(), en: text(example.en), zh: text(example.zh) }))
    .filter(example => example.en || example.zh);
}

export function normalizeWordRecord(value: unknown, groupId: string, preserveId = false): Word {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('词条格式无效');
  const input = value as Record<string, unknown>;
  const word = text(input.word) || text(input.english);
  const meaning = text(input.meaning) || text(input.turkish);
  if (!word || !meaning) throw new Error('词条缺少英文单词或中文释义');
  const createdAt = dateOrNow(input.createdAt);
  const examples = normalizeExamples(input.examples);

  return {
    id: preserveId && text(input.id) ? text(input.id) : crypto.randomUUID(),
    groupId,
    word,
    english: word,
    meaning,
    turkish: meaning,
    ipaUK: text(input.ipaUK),
    ipaUS: text(input.ipaUS),
    partOfSpeech: text(input.partOfSpeech),
    examples,
    note: text(input.note),
    starred: input.starred === true,
    createdAt,
    updatedAt: dateOrNow(input.updatedAt || createdAt),
    correctCount: typeof input.correctCount === 'number' && Number.isFinite(input.correctCount) ? input.correctCount : 0,
    wrongCount: typeof input.wrongCount === 'number' && Number.isFinite(input.wrongCount) ? input.wrongCount : 0
  };
}
