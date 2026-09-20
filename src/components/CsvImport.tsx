import { useRef, useState } from 'react';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db/db';
import { buildCsvWords, createCsvTemplate, parseCsvText, type CsvPreview } from '../lib/csvImport';
import { useToast } from '../lib/toastContext';
import { wordKey } from '../lib/wordData';

type ImportResult = { added: number; duplicates: number; invalid: number; importedAt: string; groupId: string; groupName: string };

const STATUS_LABELS = {
  ready: '可导入',
  duplicate: '重复，已跳过',
  invalid: '无效',
  incomplete: '数据不完整'
} as const;

function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([createCsvTemplate()], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'my-wordbook-template.csv';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export default function CsvImport() {
  const navigate = useNavigate();
  const showToast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [groupName, setGroupName] = useState('我的词汇');

  const chooseFile = async (file?: File) => {
    if (!file) return;
    setError('');
    setPreview(null);
    setResult(null);
    try {
      const existing = new Set((await db.words.toArray()).map(word => wordKey(word.word)));
      setPreview(parseCsvText(await file.text(), file.name, existing));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'CSV 文件无法读取。');
    }
  };

  const confirmImport = async () => {
    if (!preview || busy || preview.importableCount === 0) return;
    setBusy(true);
    setError('');
    const importedAt = new Date().toISOString();
    const targetGroupName = groupName.trim() || '我的词汇';
    let added = 0;
    let runtimeDuplicates = 0;
    let targetGroupId = '';
    try {
      await db.transaction('rw', db.words, db.groups, async () => {
        const existingKeys = new Set((await db.words.toArray()).map(word => wordKey(word.word)));
        const rows = preview.rows.filter(row => {
          if (row.status !== 'ready' && row.status !== 'incomplete') return false;
          const key = wordKey(row.word);
          if (existingKeys.has(key)) { runtimeDuplicates += 1; return false; }
          existingKeys.add(key);
          return true;
        });
        if (rows.length === 0) return;

        const groups = await db.groups.toArray();
        let group = groups.find(item => item.name.trim() === targetGroupName);
        if (!group) {
          group = { id: crypto.randomUUID(), name: targetGroupName, createdAt: importedAt };
          await db.groups.add(group);
        }
        targetGroupId = group.id;
        const words = buildCsvWords(rows, group.id, importedAt);
        await db.words.bulkAdd(words);
        added = words.length;
      });

      const completed = {
        added,
        duplicates: preview.duplicateCount + runtimeDuplicates,
        invalid: preview.invalidCount,
        importedAt,
        groupId: targetGroupId,
        groupName: targetGroupName
      };
      setPreview(null);
      setResult(completed);
      if (fileInput.current) fileInput.current.value = '';
      showToast(`成功导入 ${added} 个单词，跳过 ${completed.duplicates} 个重复词，忽略 ${completed.invalid} 个无效词条`);
    } catch {
      setError('CSV 导入失败，事务已回滚，现有词书没有被部分修改。');
      showToast('CSV 导入失败，已有数据未被修改。', 'error');
    } finally {
      setBusy(false);
    }
  };

  return <section className="csv-import-section" aria-labelledby="csv-import-title">
    <div className="csv-import-heading">
      <div><span className="eyebrow">Excel / CSV</span><h2 id="csv-import-title">CSV 批量添加词汇</h2><p>在 Excel 中按模板整理后，另存为 CSV UTF-8。选择文件后先预览，不会立即写入词书。</p></div>
      <FileSpreadsheet size={28} aria-hidden="true" />
    </div>
    <div className="csv-import-actions">
      <button type="button" className="book-button book-button-subtle" onClick={() => { downloadTemplate(); showToast('CSV 模板已生成'); }}><Download size={18} />下载 CSV 模板</button>
      <button type="button" className="book-button book-button-primary" onClick={() => fileInput.current?.click()}><Upload size={18} />选择 CSV 文件</button>
      <input ref={fileInput} type="file" accept=".csv,text/csv" hidden onChange={event => { void chooseFile(event.target.files?.[0]); }} />
    </div>
    <p className="csv-import-note">CSV 用于批量新增，重复词默认跳过。JSON 仍用于完整备份、迁移和恢复。</p>

    {error ? <p className="book-form-error csv-import-error" role="alert">{error}</p> : null}

    {preview ? <div className="csv-preview">
      <div className="csv-preview-head"><div><h3>{preview.fileName}</h3><p>仅展示前 20 条，确认前不会修改 IndexedDB。</p></div><button type="button" className="book-text-button" onClick={() => setPreview(null)}>清除预览</button></div>
      <div className="csv-metrics">
        <Metric label="总行数" value={preview.totalRows} />
        <Metric label="有效词条" value={preview.validCount} />
        <Metric label="准备新增" value={preview.importableCount} />
        <Metric label="重复词" value={preview.duplicateCount} />
        <Metric label="无效词条" value={preview.invalidCount} />
        <Metric label="缺英式音标" value={preview.missingIpaUK} />
        <Metric label="缺美式音标" value={preview.missingIpaUS} />
        <Metric label="缺词性" value={preview.missingPos} />
        <Metric label="缺例句" value={preview.missingExample} />
      </div>
      {preview.parserWarnings.length ? <div className="csv-parser-warnings"><strong>CSV 解析提示</strong>{preview.parserWarnings.map(warning => <p key={warning}>{warning}</p>)}</div> : null}
      <div className="csv-table-wrap"><table className="csv-table"><thead><tr><th>单词</th><th>音标</th><th>词性</th><th>释义</th><th>例句</th><th>状态</th></tr></thead><tbody>
        {preview.rows.slice(0, 20).map(row => <tr key={row.rowNumber}><td><strong>{row.word || `第 ${row.rowNumber} 行`}</strong></td><td>{row.ipaUK || row.ipaUS || '—'}</td><td>{row.partOfSpeech || '—'}</td><td>{row.meaning || '—'}</td><td>{row.examples.length}</td><td><span className={`csv-status csv-status-${row.status}`}>{STATUS_LABELS[row.status]}</span>{row.issues.length ? <small>{row.issues.join('、')}</small> : null}</td></tr>)}
      </tbody></table></div>
      <div className="csv-group-field"><label htmlFor="csv-group-name">导入到分组</label><input id="csv-group-name" value={groupName} onChange={event => setGroupName(event.target.value)} maxLength={80} placeholder="例如：矿业专业" /><small>填写已有分组名称会复用该分组；填写新名称会在导入时创建。</small></div>
      <div className="csv-confirm"><p>将新增 <strong>{preview.importableCount}</strong> 个单词到“{groupName.trim() || '我的词汇'}”。整个批次在一个 Dexie transaction 中写入。</p><button type="button" className="book-button book-button-primary" disabled={busy || preview.importableCount === 0} onClick={() => void confirmImport()}>{busy ? '正在导入…' : '确认导入'}</button></div>
    </div> : null}

    {result ? <div className="csv-result" role="status"><div><strong>CSV 导入完成</strong><p>已加入“{result.groupName}”：成功导入 {result.added} 个单词 · 跳过 {result.duplicates} 个重复词 · 忽略 {result.invalid} 个无效词条</p></div><button type="button" className="book-button book-button-primary" onClick={() => navigate(`/words?groupId=${encodeURIComponent(result.groupId)}&importedAt=${encodeURIComponent(result.importedAt)}`)}>查看刚导入的单词</button></div> : null}
  </section>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div><strong>{value}</strong><span>{label}</span></div>;
}
