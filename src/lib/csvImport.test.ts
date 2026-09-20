import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { buildCsvWords, createCsvTemplate, CSV_HEADERS, parseCsvText } from './csvImport';

const COMPLEX_CSV = `${CSV_HEADERS.join(',')}\r\n` +
  'abandon,/əˈbæn.dən/,/əˈbæn.dən/,v.,放弃,He abandoned the plan.,他放弃了计划。,Second example.,第二条例句。,Third example.,第三条例句。,常用词,true\r\n' +
  'ABANDON,/a/,/a/,v.,大小写重复,,,,,,,,FALSE\r\n' +
  'existing,,,,数据库重复,,,,,,,,1\r\n' +
  'comma-word,,,n.,"中文，逗号","Hello, world.","你好，世界。",,,,,"He said ""hello"".",false\r\n' +
  'minimal,,,,最小词条,,,,,,,,否\r\n' +
  ',/x/,/x/,n.,缺单词,,,,,,,,true\r\n' +
  'missing-meaning,/x/,/x/,n.,,,,,,,,,0\r\n';

describe('CSV import', () => {
  it('creates an Excel-friendly UTF-8 template with the fixed header', () => {
    const template = createCsvTemplate();
    expect(template.startsWith('\uFEFF')).toBe(true);
    expect(template.slice(1).startsWith(CSV_HEADERS.join(','))).toBe(true);
    expect(template).toContain('放弃；抛弃');
    expect(template).toContain('\r\n');
  });

  it('parses quotes, commas, Chinese, duplicates, invalid rows and boolean variants', () => {
    const preview = parseCsvText(COMPLEX_CSV, 'complex.csv', new Set(['existing']));
    expect(preview.totalRows).toBe(7);
    expect(preview.importableCount).toBe(3);
    expect(preview.duplicateCount).toBe(2);
    expect(preview.invalidCount).toBe(2);
    expect(preview.rows[0].examples).toHaveLength(3);
    expect(preview.rows[0].starred).toBe(true);
    expect(preview.rows[1].starred).toBe(false);
    expect(preview.rows[3].meaning).toBe('中文，逗号');
    expect(preview.rows[3].examples[0].en).toBe('Hello, world.');
    expect(preview.rows[3].note).toBe('He said "hello".');
    expect(preview.rows[4].status).toBe('incomplete');
  });

  it('parses and transactionally inserts 1000 words', async () => {
    const lines = Array.from({ length: 1000 }, (_, index) =>
      `performance-${index},,,,性能词条 ${index},,,,,,,,${index % 2 ? 'true' : 'false'}`
    );
    const csv = `${CSV_HEADERS.join(',')}\n${lines.join('\n')}`;
    const started = performance.now();
    const preview = parseCsvText(csv, '1000.csv', new Set());
    const words = buildCsvWords(preview.rows, 'test-group', new Date().toISOString());
    const parseDuration = performance.now() - started;

    expect(preview.totalRows).toBe(1000);
    expect(preview.importableCount).toBe(1000);
    expect(words).toHaveLength(1000);
    expect(parseDuration).toBeLessThan(2000);

    const database = new Dexie(`LexuniCsvTest-${crypto.randomUUID()}`);
    database.version(1).stores({ words: 'id, word, createdAt' });
    try {
      await database.transaction('rw', database.table('words'), async () => {
        await database.table('words').bulkAdd(words);
      });
      expect(await database.table('words').count()).toBe(1000);
    } finally {
      database.close();
      await database.delete();
    }
  });
});
