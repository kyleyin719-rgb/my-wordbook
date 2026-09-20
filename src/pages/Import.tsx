import { useState } from 'react';
import { db } from '../db/db';
import { Import as ImportIcon, Sparkles, Copy, CheckCircle2, AlertCircle, Info, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/Modal';
import { normalizeWordRecord } from '../lib/wordData';

type ParsedWord = {
  english: string;
  turkish: string;
  original: string;
  status: 'valid' | 'duplicate' | 'invalid';
};

export default function ImportPage() {
  const [input, setInput] = useState('');
  const [preview, setPreview] = useState<ParsedWord[] | null>(null);
  const [groupName, setGroupName] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [importSuccess, setImportSuccess] = useState<{ count: number, duplicates: number, groupName: string, groupId: string } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const navigate = useNavigate();

  const handlePreview = async () => {
    if (!input.trim()) return;

    const rawLines = input.split('\n').map(l => l.trim()).filter(l => l);
    const headerLine = rawLines.find(l => l.startsWith('#'));
    
    let parsedGroupName = `导入词汇 - ${new Date().toLocaleDateString('zh-CN')}`;
    if (headerLine) {
      const cleanHeader = headerLine.replace(/^#+/, '').trim();
      if (cleanHeader) parsedGroupName = cleanHeader;
    }
    setGroupName(parsedGroupName);

    const lines = rawLines.filter(l => !l.startsWith('#'));
    const existingWords = await db.words.toArray();
    const existingSet = new Set(existingWords.map(w => w.english.toLowerCase()));

    const parsed: ParsedWord[] = [];
    const newWordsSet = new Set<string>();

    for (const line of lines) {
      let separator = '';
      if (line.includes('=')) separator = '=';
      else if (line.includes(':')) separator = ':';
      else if (line.includes('-')) separator = '-';

      if (!separator) {
        parsed.push({ english: '', turkish: '', original: line, status: 'invalid' });
        continue;
      }

      const parts = line.split(separator);
      const en = parts[0].trim();
      const tr = parts.slice(1).join(separator).trim();

      if (!en || !tr) {
        parsed.push({ english: en, turkish: tr, original: line, status: 'invalid' });
        continue;
      }

      const enLower = en.toLowerCase();
      if (existingSet.has(enLower) || newWordsSet.has(enLower)) {
        parsed.push({ english: en, turkish: tr, original: line, status: 'duplicate' });
      } else {
        newWordsSet.add(enLower);
        parsed.push({ english: en, turkish: tr, original: line, status: 'valid' });
      }
    }

    setPreview(parsed);
  };

  const handleImport = async () => {
    if (!preview || isImporting) return;
    const validWords = preview.filter(p => p.status === 'valid');
    if (validWords.length === 0) return;

    const groupId = crypto.randomUUID();
    const safeGroupName = groupName.trim() || '导入词汇';
    setIsImporting(true);
    setImportError(null);

    try {
      const createdAt = new Date().toISOString();
      const newEntries = validWords.map(w => normalizeWordRecord({ word: w.english, meaning: w.turkish, createdAt }, groupId));

      await db.transaction('rw', db.groups, db.words, async () => {
        await db.groups.add({ id: groupId, name: safeGroupName, createdAt });
        await db.words.bulkAdd(newEntries);
      });

      const result = {
        count: validWords.length,
        duplicates: preview.filter(p => p.status === 'duplicate').length,
        groupName: safeGroupName,
        groupId
      };

      setInput('');
      setPreview(null);
      setImportSuccess(result);
    } catch {
      setImportSuccess(null);
      setImportError('导入失败，已有词汇未被修改，请重试。');
    } finally {
      setIsImporting(false);
    }
  };

  const closeImportSuccess = () => setImportSuccess(null);

  const viewImportedGroup = () => {
    const groupId = importSuccess?.groupId;
    setImportSuccess(null);
    navigate(groupId ? `/words?groupId=${encodeURIComponent(groupId)}` : '/words');
  };

  const copyPrompt = () => {
    const prompt = `请从提供的图片或文本中提取值得学习的英语词汇，并给出自然、简洁的中文释义。

只按以下格式输出：

# 词单名称

english word = 中文释义
english word = 中文释义
english word = 中文释义

规则：
* 每行一个英语单词或常用短语。
* 英文与中文之间使用 = 分隔。
* 不要编号、项目符号、解释或 Markdown 代码块。
* 中文释义保持简短自然，多个常见释义用 / 分隔。
* 避免重复。`;
    
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const validCount = preview?.filter(p => p.status === 'valid').length || 0;
  const duplicateCount = preview?.filter(p => p.status === 'duplicate').length || 0;
  const invalidCount = preview?.filter(p => p.status === 'invalid').length || 0;

  return (
    <div className="page-shell page-enter">
      <header className="page-header flex items-start gap-3">
        <button 
          onClick={() => navigate('/words')}
          className="icon-button -ml-2"
          aria-label="返回词库"
        >
          <ChevronLeft size={24} />
        </button>
        <div>
          <span className="eyebrow">添加到词库</span>
          <h1>导入词汇</h1>
          <p>粘贴词表，预览后导入。</p>
        </div>
      </header>

      <section className="import-workspace">
        <div className="import-label">
          <label htmlFor="vocabulary-import">词汇列表</label>
          <code>英文 = 中文</code>
        </div>
        <textarea
          id="vocabulary-import"
          value={input}
          onChange={e => {
            setInput(e.target.value);
            if (preview) setPreview(null);
          }}
          placeholder={"# 第一单元\n\nreliable = 可靠的\ndeploy = 部署\nretrieve = 取回"}
          className="field import-textarea"
        ></textarea>
        
        <button
          onClick={handlePreview}
          disabled={!input.trim()}
          className="button import-preview-button"
        >
          <ImportIcon size={20} />
          <span>预览导入</span>
        </button>
      </section>

      {preview && (
        <section className="import-preview">
          <h3>导入预览</h3>
          <p>分组：<strong>{groupName}</strong></p>
          
          <div className="preview-stats">
            <div className="text-success-tx">
              <strong>{validCount}</strong><span>新增</span>
            </div>
            <div className="text-warning-tx">
              <strong>{duplicateCount}</strong><span>重复</span>
            </div>
            <div className="text-danger-tx">
              <strong>{invalidCount}</strong><span>格式错误</span>
            </div>
          </div>

          <div className="preview-list">
            {preview.map((p, i) => (
              <div key={i} className="preview-row">
                {p.status === 'valid' && <CheckCircle2 className="text-emerald-500 shrink-0" size={16} />}
                {p.status === 'duplicate' && <Info className="text-warning-tx shrink-0" size={16} />}
                {p.status === 'invalid' && <AlertCircle className="text-rose-500 shrink-0" size={16} />}
                
                <span className="truncate flex-1">
                  {p.status === 'invalid' ? p.original : (
                    <>
                      <span className="font-bold">{p.english}</span>
                      <span className="text-tx-muted mx-2">→</span>
                      <span>{p.turkish}</span>
                    </>
                  )}
                </span>
                
                {p.status === 'duplicate' && <span className="text-xs text-warning-tx font-medium">已存在</span>}
                {p.status === 'invalid' && <span className="text-xs text-danger-tx font-medium">格式错误</span>}
              </div>
            ))}
          </div>

          {validCount > 0 && (
            <button
              onClick={handleImport}
              disabled={isImporting}
              className="button button-primary button-large w-full"
            >
              {isImporting ? '正在导入…' : `导入 ${validCount} 个词`}
            </button>
          )}
        </section>
      )}

      <section className="import-helper">
        <div>
          <Sparkles size={18} aria-hidden="true" />
          <h2>AI 导入助手</h2>
        </div>
        <p>
          用你常用的 AI 工具，把截图或文本整理成上面的导入格式。
        </p>
        <button onClick={copyPrompt} className="button button-secondary">
          {copied ? <CheckCircle2 size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
          <span>{copied ? '提示词已复制' : '复制 AI 提示词'}</span>
        </button>
      </section>

      <Modal 
        isOpen={!!importSuccess} 
        onClose={closeImportSuccess}
        title="导入完成"
        footer={
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={viewImportedGroup}
              className="button button-secondary"
            >
              查看分组
            </button>
            <button
              type="button"
              onClick={closeImportSuccess}
              className="button button-primary"
            >
              完成
            </button>
          </div>
        }
      >
        <div className="py-2 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-success-bg text-success-tx">
            <CheckCircle2 size={32} aria-hidden="true" />
          </div>
          <h3 className="mb-2 text-2xl font-bold text-tx">
            已添加 {importSuccess?.count ?? 0} 个词
          </h3>
          {importSuccess?.groupName ? (
            <p className="mb-1 break-words font-medium text-tx-secondary">{importSuccess.groupName}</p>
          ) : null}
          {(importSuccess?.duplicates ?? 0) > 0 ? (
            <p className="mt-2 text-sm text-tx-muted">已跳过 {importSuccess?.duplicates} 个重复词</p>
          ) : null}
        </div>
      </Modal>

      <Modal
        isOpen={!!importError}
        onClose={() => setImportError(null)}
        title="导入失败"
        footer={
          <button
            type="button"
            onClick={() => setImportError(null)}
            className="button button-primary button-block"
          >
            重试
          </button>
        }
      >
        <div className="dialog-message">
          <div className="dialog-message-icon dialog-message-icon-danger">
            <AlertCircle size={22} aria-hidden="true" />
          </div>
          <p>{importError}</p>
        </div>
      </Modal>
    </div>
  );
}
