import Papa from 'papaparse';
import type { Example, Word } from '../types';
import { normalizeWordRecord, wordKey } from './wordData';

export const CSV_HEADERS = [
  'word', 'ipaUK', 'ipaUS', 'partOfSpeech', 'meaning',
  'example1En', 'example1Zh', 'example2En', 'example2Zh',
  'example3En', 'example3Zh', 'note', 'starred'
] as const;

type CsvStatus = 'ready' | 'duplicate' | 'invalid' | 'incomplete';
type CsvObject = Record<string, string | undefined>;

export type CsvPreviewRow = {
  rowNumber: number;
  word: string;
  ipaUK: string;
  ipaUS: string;
  partOfSpeech: string;
  meaning: string;
  examples: Omit<Example, 'id'>[];
  note: string;
  starred: boolean;
  status: CsvStatus;
  issues: string[];
};

export type CsvPreview = {
  fileName: string;
  totalRows: number;
  validCount: number;
  importableCount: number;
  duplicateCount: number;
  invalidCount: number;
  missingIpaUK: number;
  missingIpaUS: number;
  missingPos: number;
  missingExample: number;
  parserWarnings: string[];
  rows: CsvPreviewRow[];
};

function clean(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function booleanValue(value: string | undefined): boolean {
  const normalized = clean(value).toLowerCase();
  if (['true', '1', '是'].includes(normalized)) return true;
  if (['false', '0', '否'].includes(normalized)) return false;
  return false;
}

function canonicalHeader(value: string): string {
  return value.replace(/^\uFEFF/, '').trim().toLowerCase();
}

export function parseCsvText(text: string, fileName: string, existingWordKeys: ReadonlySet<string>): CsvPreview {
  const result = Papa.parse<CsvObject>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: canonicalHeader
  });

  const fields = new Set(result.meta.fields ?? []);
  const missingHeaders = ['word', 'meaning'].filter(header => !fields.has(header));
  if (missingHeaders.length) throw new Error(`CSV 缺少必填表头：${missingHeaders.join(', ')}`);

  const parserErrorRows = new Set(result.errors.filter(error => typeof error.row === 'number').map(error => error.row));
  const parserWarnings = result.errors.slice(0, 10).map(error => `第 ${(error.row ?? 0) + 2} 行：${error.message}`);
  const incomingKeys = new Set<string>();

  const rows = result.data.map((source, index): CsvPreviewRow => {
    const value = (name: string) => clean(source[name.toLowerCase()]);
    const word = value('word');
    const meaning = value('meaning');
    const examples = [1, 2, 3].map(number => ({
      en: value(`example${number}en`),
      zh: value(`example${number}zh`)
    })).filter(example => example.en || example.zh);
    const incomplete: string[] = [];
    if (!value('ipauk')) incomplete.push('缺英式音标');
    if (!value('ipaus')) incomplete.push('缺美式音标');
    if (!value('partofspeech')) incomplete.push('缺词性');
    if (examples.length === 0) incomplete.push('缺例句');

    let status: CsvStatus;
    const issues: string[] = [];
    if (!word || !meaning || parserErrorRows.has(index)) {
      status = 'invalid';
      if (!word) issues.push('缺英文单词');
      if (!meaning) issues.push('缺中文释义');
      if (parserErrorRows.has(index)) issues.push('CSV 格式错误');
    } else {
      const key = wordKey(word);
      if (existingWordKeys.has(key) || incomingKeys.has(key)) {
        status = 'duplicate';
        issues.push('重复，已跳过');
      } else {
        incomingKeys.add(key);
        status = incomplete.length ? 'incomplete' : 'ready';
        issues.push(...incomplete);
      }
    }

    return {
      rowNumber: index + 2,
      word,
      ipaUK: value('ipauk'),
      ipaUS: value('ipaus'),
      partOfSpeech: value('partofspeech'),
      meaning,
      examples,
      note: value('note'),
      starred: booleanValue(source.starred),
      status,
      issues
    };
  });

  const validRows = rows.filter(row => row.status !== 'invalid');
  return {
    fileName,
    totalRows: rows.length,
    validCount: validRows.length,
    importableCount: rows.filter(row => row.status === 'ready' || row.status === 'incomplete').length,
    duplicateCount: rows.filter(row => row.status === 'duplicate').length,
    invalidCount: rows.filter(row => row.status === 'invalid').length,
    missingIpaUK: validRows.filter(row => !row.ipaUK).length,
    missingIpaUS: validRows.filter(row => !row.ipaUS).length,
    missingPos: validRows.filter(row => !row.partOfSpeech).length,
    missingExample: validRows.filter(row => row.examples.length === 0).length,
    parserWarnings,
    rows
  };
}

export function buildCsvWords(rows: CsvPreviewRow[], groupId: string, importedAt: string): Word[] {
  return rows
    .filter(row => row.status === 'ready' || row.status === 'incomplete')
    .map(row => normalizeWordRecord({
      word: row.word,
      ipaUK: row.ipaUK,
      ipaUS: row.ipaUS,
      partOfSpeech: row.partOfSpeech,
      meaning: row.meaning,
      examples: row.examples,
      note: row.note,
      starred: row.starred,
      createdAt: importedAt,
      updatedAt: importedAt
    }, groupId));
}

export function createCsvTemplate(): string {
  const sample = {
    word: 'abandon',
    ipaUK: '/əˈbæn.dən/',
    ipaUS: '/əˈbæn.dən/',
    partOfSpeech: 'v.',
    meaning: '放弃；抛弃',
    example1En: 'He abandoned the plan.',
    example1Zh: '他放弃了这个计划。',
    example2En: '',
    example2Zh: '',
    example3En: '',
    example3Zh: '',
    note: '常用词',
    starred: 'true'
  };
  return `\uFEFF${Papa.unparse([sample], { columns: [...CSV_HEADERS], newline: '\r\n' })}`;
}
