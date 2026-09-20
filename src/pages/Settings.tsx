import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Download, FileJson2, Moon, Sun, Upload } from 'lucide-react';
import { db } from '../db/db';
import { applyTheme, normalizeThemeId } from '../lib/theme';
import { normalizeWordRecord } from '../lib/wordData';
import type { SessionAnswer, StudySession, Word, WordGroup } from '../types';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../lib/toastContext';
import { wordKey } from '../lib/wordData';
import DataQuality from '../components/DataQuality';

type WordbookImport = { total: number; words: Word[]; groups: WordGroup[]; duplicates: number; invalid: number };
type FullBackup = {
  format: 'lexuni-backup';
  version: number;
  exportedAt: string;
  data: { words: unknown[]; groups?: WordGroup[]; sessions?: StudySession[]; sessionAnswers?: SessionAnswer[]; preferences?: { theme?: string } };
};

function downloadJson(data: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function isGroup(value: unknown): value is WordGroup {
  return Boolean(value) && typeof value === 'object' && typeof (value as WordGroup).id === 'string' && typeof (value as WordGroup).name === 'string';
}

function sourceGroupId(value: unknown): string {
  if (!value || typeof value !== 'object') return '__ungrouped__';
  const groupId = (value as { groupId?: unknown }).groupId;
  return typeof groupId === 'string' && groupId ? groupId : '__ungrouped__';
}

export default function Settings() {
  const showToast = useToast();
  const counts = useLiveQuery(async () => ({ words: await db.words.count(), groups: await db.groups.count() }));
  const [theme, setTheme] = useState(() => normalizeThemeId(localStorage.getItem('lexuni-theme')));
  const [wordbookImport, setWordbookImport] = useState<WordbookImport | null>(null);
  const [backupRestore, setBackupRestore] = useState<FullBackup | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const wordbookFile = useRef<HTMLInputElement>(null);
  const backupFile = useRef<HTMLInputElement>(null);

  const exportWordbook = async () => {
    try {
      const [words, groups] = await Promise.all([db.words.toArray(), db.groups.toArray()]);
      downloadJson({
        format: 'my-wordbook', version: 1, exportedAt: new Date().toISOString(), groups,
        words: words.map(({ id, groupId, word, ipaUK, ipaUS, partOfSpeech, meaning, examples, note, starred, createdAt, updatedAt }) =>
          ({ id, groupId, word, ipaUK, ipaUS, partOfSpeech, meaning, examples, note, starred, createdAt, updatedAt }))
      }, `my-wordbook-backup-${new Date().toISOString().slice(0, 10)}.json`);
      showToast('备份已生成');
    } catch { showToast('导出失败，请重试。', 'error'); }
  };

  const readWordbook = async (file?: File) => {
    if (!file) return;
    setMessage('');
    setWordbookImport(null);
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('JSON 根节点格式无效。');
      const json = parsed as Record<string, unknown>;
      if ((json.format === 'my-wordbook' || json.format === 'lexuni-wordbook' || json.format === 'lexuni-backup') && json.version !== 1) throw new Error('不支持这个 JSON 版本。');
      const payload = json.format === 'my-wordbook' || json.format === 'lexuni-wordbook' ? json : json.format === 'lexuni-backup' && json.data && typeof json.data === 'object' ? json.data as Record<string, unknown> : null;
      if (!payload || !Array.isArray(payload.words)) throw new Error('请选择词书 JSON 或 Lexuni 备份文件。');
      const rawGroups = Array.isArray(payload.groups) ? payload.groups.filter(isGroup) : [];
      const existing = new Set((await db.words.toArray()).map(word => wordKey(word.word)));
      const incoming = new Set<string>();
      const entries: Word[] = [];
      let duplicates = 0;
      let invalid = 0;
      for (const raw of payload.words) {
        try {
          const word = normalizeWordRecord(raw, sourceGroupId(raw));
          const key = wordKey(word.word);
          if (existing.has(key) || incoming.has(key)) { duplicates += 1; continue; }
          incoming.add(key);
          entries.push(word);
        } catch { invalid += 1; }
      }
      setWordbookImport({ total: payload.words.length, words: entries, groups: rawGroups, duplicates, invalid });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'JSON 文件无法读取。');
    }
  };

  const confirmWordbookImport = async () => {
    if (!wordbookImport || busy) return;
    setBusy(true);
    try {
      const currentGroups = await db.groups.toArray();
      const groupNames = new Map(wordbookImport.groups.map(group => [group.id, group.name]));
      const destinations = new Map<string, string>();
      const newGroups: WordGroup[] = [];
      for (const word of wordbookImport.words) {
        if (destinations.has(word.groupId)) continue;
        const name = groupNames.get(word.groupId) || 'JSON 导入';
        const existing = [...currentGroups, ...newGroups].find(group => group.name === name);
        if (existing) destinations.set(word.groupId, existing.id);
        else {
          const group = { id: crypto.randomUUID(), name, createdAt: new Date().toISOString() };
          newGroups.push(group);
          destinations.set(word.groupId, group.id);
        }
      }
      let added = 0;
      let skipped = wordbookImport.duplicates;
      await db.transaction('rw', db.groups, db.words, async () => {
        const existingWords = new Set((await db.words.toArray()).map(word => wordKey(word.word)));
        const entries = wordbookImport.words.filter(word => {
          if (existingWords.has(wordKey(word.word))) { skipped += 1; return false; }
          existingWords.add(wordKey(word.word));
          return true;
        }).map(word => ({ ...word, groupId: destinations.get(word.groupId)! }));
        const usedGroupIds = new Set(entries.map(word => word.groupId));
        if (newGroups.length) await db.groups.bulkAdd(newGroups.filter(group => usedGroupIds.has(group.id)));
        if (entries.length) await db.words.bulkAdd(entries);
        added = entries.length;
      });
      setWordbookImport(null);
      showToast(`成功新增 ${added} 个单词，跳过 ${skipped} 个重复词，忽略 ${wordbookImport.invalid} 个无效词条`);
    } catch {
      showToast('导入失败，已有数据未被修改。', 'error');
    } finally {
      setBusy(false);
    }
  };

  const exportFullBackup = async () => {
    try {
      const [groups, words, sessions, sessionAnswers] = await Promise.all([
        db.groups.toArray(), db.words.toArray(), db.sessions.toArray(), db.sessionAnswers.toArray()
      ]);
      downloadJson({ format: 'lexuni-backup', version: 1, appVersion: '1.0.0', exportedAt: new Date().toISOString(), data: {
        groups, words, sessions, sessionAnswers, preferences: { theme: normalizeThemeId(localStorage.getItem('lexuni-theme')) }
      } }, `lexuni-backup-${new Date().toISOString().slice(0, 10)}.json`);
      showToast('完整备份已生成');
    } catch { showToast('导出失败，请重试。', 'error'); }
  };

  const readBackup = async (file?: File) => {
    if (!file) return;
    setMessage('');
    setBackupRestore(null);
    try {
      const parsed = JSON.parse(await file.text()) as FullBackup;
      if (parsed.format !== 'lexuni-backup' || parsed.version !== 1 || !parsed.data || !Array.isArray(parsed.data.words)) throw new Error('不是受支持的 Lexuni 完整备份。');
      const groups = (parsed.data.groups ?? []).filter(isGroup);
      const fallbackId = groups[0]?.id || '__restored__';
      const groupIds = new Set(groups.map(group => group.id));
      parsed.data.words.forEach(raw => normalizeWordRecord(raw, groupIds.has(sourceGroupId(raw)) ? sourceGroupId(raw) : fallbackId, true));
      setBackupRestore(parsed);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '备份文件无法读取。');
    }
  };

  const confirmRestore = async () => {
    if (!backupRestore || busy) return;
    setBusy(true);
    try {
      const groups = (backupRestore.data.groups ?? []).filter(isGroup);
      const fallbackGroup = { id: crypto.randomUUID(), name: '恢复的词汇', createdAt: new Date().toISOString() };
      const groupIds = new Set(groups.map(group => group.id));
      const words = backupRestore.data.words.map(raw => normalizeWordRecord(raw, groupIds.has(sourceGroupId(raw)) ? sourceGroupId(raw) : fallbackGroup.id, true));
      if (words.some(word => word.groupId === fallbackGroup.id)) groups.push(fallbackGroup);
      const sessions = (backupRestore.data.sessions ?? []).map(session => ({
        ...session, status: session.status || 'finished' as const,
        activeDurationSeconds: session.activeDurationSeconds || 0,
        questionQueue: session.questionQueue || [], reinforcementQueue: session.reinforcementQueue || []
      }));
      await db.transaction('rw', db.words, db.groups, db.sessions, db.sessionAnswers, async () => {
        await db.words.clear(); await db.groups.clear(); await db.sessions.clear(); await db.sessionAnswers.clear();
        if (groups.length) await db.groups.bulkAdd(groups);
        if (words.length) await db.words.bulkAdd(words);
        if (sessions.length) await db.sessions.bulkAdd(sessions);
        if (backupRestore.data.sessionAnswers?.length) await db.sessionAnswers.bulkAdd(backupRestore.data.sessionAnswers);
      });
      if (backupRestore.data.preferences?.theme) setTheme(applyTheme(backupRestore.data.preferences.theme));
      setBackupRestore(null);
      showToast('完整备份已恢复');
    } catch {
      showToast('恢复失败，原有数据未被修改。', 'error');
    } finally { setBusy(false); }
  };

  return <div className="page-shell page-enter book-settings">
    <header className="page-header"><h1>设置与数据</h1><p>{counts?.words ?? 0} 个单词 · {counts?.groups ?? 0} 个分组，保存在此浏览器的 IndexedDB 中。</p></header>
    <section className="settings-section"><h2 className="settings-title">外观</h2><div className="book-theme-options">
      <button type="button" className={`book-theme-choice ${theme === 'arctic' ? 'active' : ''}`} onClick={() => setTheme(applyTheme('arctic'))}><Sun size={19} />浅色 · Arctic</button>
      <button type="button" className={`book-theme-choice ${theme === 'midnight' ? 'active' : ''}`} onClick={() => setTheme(applyTheme('midnight'))}><Moon size={19} />深色 · Midnight</button>
    </div></section>
    <section className="settings-section"><h2 className="settings-title">词书 JSON</h2><p className="book-settings-copy">导出单词、释义、例句、笔记、重点标记和分组。导入时合并词条，重复英文单词会跳过。</p><div className="book-settings-actions">
      <button type="button" className="book-button book-button-subtle" onClick={() => void exportWordbook()}><Download size={18} />导出词书 JSON</button>
      <button type="button" className="book-button book-button-primary" onClick={() => wordbookFile.current?.click()}><Upload size={18} />导入词书 JSON</button>
      <input ref={wordbookFile} type="file" accept=".json,application/json" hidden onChange={event => { void readWordbook(event.target.files?.[0]); event.target.value = ''; }} />
    </div>{wordbookImport ? <div className="book-import-preview"><FileJson2 size={20} /><div><strong>文件中的单词：{wordbookImport.total}</strong><p>新增：{wordbookImport.words.length} · 重复：{wordbookImport.duplicates} · 无效：{wordbookImport.invalid}</p><p>确认后合并到当前词书，不覆盖已有词条。</p></div><button type="button" className="book-button book-button-primary" onClick={() => void confirmWordbookImport()} disabled={busy || wordbookImport.words.length === 0}>{busy ? '导入中…' : '确认导入'}</button><button type="button" className="book-text-button" onClick={() => setWordbookImport(null)}>取消</button></div> : null}</section>
    <DataQuality />
    <section className="settings-section"><h2 className="settings-title">完整备份</h2><p className="book-settings-copy">兼容原版 Lexuni 备份，包含旧练习记录。恢复完整备份会替换此浏览器中现有的数据。</p><div className="book-settings-actions">
      <button type="button" className="book-button book-button-subtle" onClick={() => void exportFullBackup()}><Download size={18} />导出完整备份</button>
      <button type="button" className="book-button book-button-subtle" onClick={() => backupFile.current?.click()}><Upload size={18} />恢复完整备份</button>
      <input ref={backupFile} type="file" accept=".json,application/json" hidden onChange={event => { void readBackup(event.target.files?.[0]); event.target.value = ''; }} />
    </div></section>
    {message ? <p className="book-settings-message" role="status">{message}</p> : null}
    <p className="book-settings-footnote">Lexuni 基于 MIT License。词汇数据保存在当前设备；请定期导出 JSON 备份。</p>
    <ConfirmDialog isOpen={Boolean(backupRestore)} onClose={() => setBackupRestore(null)} onConfirm={confirmRestore} title="恢复完整备份？" description={`备份包含 ${backupRestore?.data.words.length ?? 0} 个单词。恢复会替换当前所有单词、分组和旧练习记录。`} confirmLabel="确认恢复" cancelLabel="取消" isPending={busy} danger />
  </div>;
}
