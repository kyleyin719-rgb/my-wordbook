import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, Plus, Search, Star, Upload } from 'lucide-react';
import { db } from '../db/db';
import type { Word } from '../types';
import { normalizeWordRecord, wordKey } from '../lib/wordData';
import { useToast } from '../lib/toastContext';
import { matchesQualityFilter, type QualityFilter } from '../lib/wordQuality';
import WordDetail from '../components/WordDetail';
import WordEditor, { type WordDraft } from '../components/WordEditor';
import ConfirmDialog from '../components/ConfirmDialog';

type View = 'all' | 'starred' | 'recent';
type SortOrder = 'recent' | 'az' | 'za' | 'starred';
type Props = { view: View; initialAdd?: boolean };

const SORT_KEY = 'lexuni-word-sort-v1';
const SORT_OPTIONS: SortOrder[] = ['recent', 'az', 'za', 'starred'];
const QUALITY_FILTERS: QualityFilter[] = ['complete', 'missing-ipa-uk', 'missing-ipa-us', 'missing-pos', 'missing-meaning', 'missing-example', 'missing-example-translation', 'missing-note'];
const QUALITY_LABELS: Record<QualityFilter, string> = {
  complete: '完整词条',
  'missing-ipa-uk': '缺英式音标',
  'missing-ipa-us': '缺美式音标',
  'missing-pos': '缺词性',
  'missing-meaning': '缺中文释义',
  'missing-example': '缺例句',
  'missing-example-translation': '缺例句翻译',
  'missing-note': '缺笔记'
};

function savedSort(): SortOrder {
  const value = localStorage.getItem(SORT_KEY) as SortOrder;
  return SORT_OPTIONS.includes(value) ? value : 'recent';
}

function matchesSearch(word: Word, query: string): boolean {
  const fields = [word.word, word.ipaUK, word.ipaUS, word.partOfSpeech, word.meaning, word.note];
  return fields.some(value => value.toLowerCase().includes(query)) || word.examples.some(example => example.en.toLowerCase().includes(query) || example.zh.toLowerCase().includes(query));
}

function alphabetical(a: Word, b: Word): number {
  return a.word.localeCompare(b.word, 'en', { sensitivity: 'base' });
}

export default function Words({ view, initialAdd = false }: Props) {
  const navigate = useNavigate();
  const showToast = useToast();
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const groupId = searchParams.get('groupId') || '';
  const qualityValue = searchParams.get('quality');
  const quality = QUALITY_FILTERS.includes(qualityValue as QualityFilter) ? qualityValue as QualityFilter : null;
  const importedAt = searchParams.get('importedAt') || '';
  const words = useLiveQuery(() => db.words.toArray());
  const groups = useLiveQuery(() => db.groups.toArray());
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOrder>(savedSort);
  const [selection, setSelection] = useState<{ id: string; view: View; groupId: string; routeId?: string; mobileOpen: boolean } | null>(null);
  const [editor, setEditor] = useState<Word | 'new' | null>(initialAdd ? 'new' : null);
  const [addPrefill, setAddPrefill] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Word | null>(null);
  const [deleting, setDeleting] = useState(false);

  const selectionHere = selection?.view === view && selection.groupId === groupId && selection.routeId === id;
  const selectedId = selectionHere ? selection.id : id ?? null;
  const mobileDetailOpen = Boolean(id) || Boolean(selectionHere && selection.mobileOpen);

  const visibleWords = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = (words ?? []).filter(word => {
      if (view === 'starred' && !word.starred) return false;
      if (groupId && word.groupId !== groupId) return false;
      if (quality && !matchesQualityFilter(word, quality)) return false;
      if (importedAt && word.createdAt !== importedAt) return false;
      return !query || matchesSearch(word, query);
    });
    if (view === 'recent' || sort === 'recent') result.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || alphabetical(a, b));
    else if (sort === 'az') result.sort(alphabetical);
    else if (sort === 'za') result.sort((a, b) => alphabetical(b, a));
    else result.sort((a, b) => Number(b.starred) - Number(a.starred) || alphabetical(a, b));
    return result;
  }, [words, search, sort, view, groupId, quality, importedAt]);

  const selectedWord = visibleWords.find(word => word.id === selectedId) ?? (!search.trim() && view === 'all' && id ? words?.find(word => word.id === id) : undefined) ?? visibleWords[0];
  const title = importedAt ? '刚导入的单词' : quality ? `数据检查：${QUALITY_LABELS[quality]}` : view === 'starred' ? '重点单词' : view === 'recent' ? '最近添加' : '全部单词';
  const hasNoWords = words?.length === 0;
  const query = search.trim();
  const emptyTitle = query ? '没有找到相关单词' : importedAt ? '没有找到刚导入的单词' : quality ? `没有${QUALITY_LABELS[quality]}` : view === 'starred' ? '暂无重点单词' : groupId ? '这个分组还没有单词' : hasNoWords ? '你的词书还是空的' : '没有单词';
  const emptyDescription = query ? '试试其他关键词，或直接添加这个单词。' : view === 'starred' ? '点击单词旁的星标，就能在这里快速找到它。' : hasNoWords ? '添加遇到的单词，逐渐建立属于自己的词书。' : '添加自己的词汇，或导入已有词表。';

  const openAdd = (prefill = '') => { setAddPrefill(prefill); setEditor('new'); };
  const closeEditor = () => { setEditor(null); if (initialAdd) navigate('/words'); };
  const changeSort = (value: SortOrder) => { setSort(value); localStorage.setItem(SORT_KEY, value); };

  const saveWord = async (draft: WordDraft): Promise<Word | void> => {
    const wordText = draft.word.trim();
    const meaning = draft.meaning.trim();
    if (!wordText || !meaning) throw new Error('请填写英文单词和中文释义，不能只输入空格。');
    const cleanExamples = draft.examples.map(example => ({ id: example.id, en: example.en.trim(), zh: example.zh.trim() })).filter(example => example.en || example.zh);
    const editing = editor && editor !== 'new' ? editor : null;
    const now = new Date().toISOString();

    const duplicate = await db.transaction('rw', db.groups, db.words, async () => {
      const currentWords = await db.words.toArray();
      const existing = currentWords.find(word => wordKey(word.word) === wordKey(wordText) && word.id !== editing?.id);
      if (existing) return { kind: 'duplicate' as const, word: existing };

      if (editing) {
        const updated = await db.words.update(editing.id, {
          ...draft, word: wordText, english: wordText, meaning, turkish: meaning,
          examples: cleanExamples, updatedAt: now
        });
        if (!updated) throw new Error('词条已不存在，请刷新页面后重试。');
        return { kind: 'edited' as const };
      }

      const selectedGroup = draft.groupId ? await db.groups.get(draft.groupId) : undefined;
      const defaultGroup = selectedGroup ?? (await db.groups.toArray()).find(group => group.name === '我的词汇');
      const finalGroupId = defaultGroup?.id ?? crypto.randomUUID();
      if (!defaultGroup) await db.groups.add({ id: finalGroupId, name: '我的词汇', createdAt: now });
      const entry = normalizeWordRecord({ ...draft, word: wordText, meaning, examples: cleanExamples, createdAt: now, updatedAt: now }, finalGroupId);
      await db.words.add(entry);
      return { kind: 'added' as const, word: entry };
    });

    if (duplicate.kind === 'duplicate') return duplicate.word;
    if (duplicate.kind === 'edited' && editing) {
      setSelection({ id: editing.id, view, groupId, routeId: id, mobileOpen: true });
      setEditor(null);
      showToast('已保存修改');
    } else if (duplicate.kind === 'added') {
      setEditor(null);
      navigate(`/words/${duplicate.word.id}`);
      showToast(`已添加 ${wordText}`);
    }
  };

  const toggleStar = async (word: Word) => {
    try {
      await db.words.update(word.id, { starred: !word.starred, updatedAt: new Date().toISOString() });
      if (view === 'starred' && word.starred && selectedId === word.id) setSelection(null);
      showToast(word.starred ? '已取消重点标记' : '已加入重点词');
    } catch { showToast('重点状态未能保存，请重试。', 'error'); }
  };

  const deleteWord = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    const index = visibleWords.findIndex(word => word.id === deleteTarget.id);
    const neighbor = visibleWords[index + 1] ?? visibleWords[index - 1];
    try {
      await db.words.delete(deleteTarget.id);
      setDeleteTarget(null);
      if (id) {
        setSelection(null);
        navigate(neighbor ? `/words/${neighbor.id}` : '/words');
      } else {
        setSelection(neighbor ? { id: neighbor.id, view, groupId, routeId: id, mobileOpen: true } : null);
      }
      showToast(`已删除 ${deleteTarget.word}`);
    } catch { showToast('删除失败，请重试。', 'error'); }
    finally { setDeleting(false); }
  };

  const chooseGroup = (nextGroupId: string) => setSearchParams(nextGroupId ? { groupId: nextGroupId } : {});

  if (words === undefined || groups === undefined) return <div className="book-loading" role="status">正在读取词书…</div>;

  return <div className={`book-workspace ${mobileDetailOpen ? 'detail-open' : ''}`}>
    <section className="book-main" aria-label={title}>
      <header className="book-main-header"><div><h1>{title}</h1><p>共 {visibleWords.length} 个单词</p></div></header>
      <div className="book-toolbar">
        <label className="book-search"><Search size={20} aria-hidden="true" /><span className="sr-only">搜索词条内容</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索单词、释义、例句或笔记…" autoComplete="off" /></label>
        <div className="book-toolbar-actions">
          <label className="book-select-wrap"><span className="sr-only">排序方式</span><select value={view === 'recent' ? 'recent' : sort} onChange={event => changeSort(event.target.value as SortOrder)} disabled={view === 'recent'}><option value="recent">最近添加</option><option value="az">A–Z 排序</option><option value="za">Z–A 排序</option><option value="starred">重点优先</option></select><ChevronDown size={16} aria-hidden="true" /></label>
          <button type="button" className="book-button book-button-primary book-add-button" onClick={() => openAdd()}><Plus size={19} />添加单词</button>
        </div>
      </div>
      {groups.length > 0 || quality || importedAt ? <div className="book-filter-line"><label>分组 <select value={groupId} onChange={event => chooseGroup(event.target.value)}><option value="">全部分组</option>{groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label><div className="book-filter-actions">{quality || importedAt ? <button type="button" className="book-text-button" onClick={() => navigate('/words')}>清除当前筛选</button> : null}<button type="button" className="book-text-button" onClick={() => navigate('/words/import')}><Upload size={16} />导入词汇</button></div></div> : null}
      {visibleWords.length > 0 ? <div className="book-list" role="list">
        <div className="book-list-head"><span>★</span><span>单词</span><span>中文意思</span><span>添加时间</span></div>
        {visibleWords.map(word => <div className={`book-word-row ${selectedWord?.id === word.id ? 'selected' : ''}`} key={word.id} role="listitem">
          <button type="button" className={`book-row-star ${word.starred ? 'active' : ''}`} onClick={() => void toggleStar(word)} aria-label={word.starred ? `取消 ${word.word} 的重点标记` : `标记 ${word.word} 为重点`}><Star size={18} fill={word.starred ? 'currentColor' : 'none'} /></button>
          <button type="button" className="book-row-content" onClick={() => setSelection({ id: word.id, view, groupId, routeId: id, mobileOpen: true })} aria-label={`查看 ${word.word} 的详情`}><strong>{word.word}</strong><span>{word.meaning}</span><time dateTime={word.createdAt}>{new Date(word.createdAt).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}</time><ChevronRight className="book-row-chevron" size={18} aria-hidden="true" /></button>
        </div>)}
      </div> : <div className="book-empty"><Star size={34} strokeWidth={1.4} aria-hidden="true" /><h2>{emptyTitle}</h2><p>{emptyDescription}</p><div><button type="button" className="book-button book-button-primary" onClick={() => openAdd(query)}><Plus size={18} />{query ? `添加“${query}”` : hasNoWords ? '添加第一个单词' : '添加单词'}</button>{!query ? <button type="button" className="book-button book-button-subtle" onClick={() => navigate('/words/import')}><Upload size={18} />导入词汇</button> : null}</div></div>}
    </section>
    <aside className="book-inspector" aria-label="单词详情"><WordDetail word={selectedWord} onBack={() => { setSelection(null); if (id) navigate('/words'); }} onStar={word => void toggleStar(word)} onEdit={setEditor} onDelete={setDeleteTarget} /></aside>
    {editor ? <WordEditor key={editor === 'new' ? `new-${addPrefill}` : editor.id} word={editor === 'new' ? undefined : editor} groups={groups} initialWord={addPrefill} preferredGroupId={groupId} onClose={closeEditor} onSave={saveWord} onOpenExisting={existing => { setEditor(null); navigate(`/words/${existing.id}`); }} /> : null}
    <ConfirmDialog isOpen={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} onConfirm={deleteWord} title={`确定删除“${deleteTarget?.word ?? ''}”吗？`} description="此操作会从当前设备删除该词条。" confirmLabel="确认删除" cancelLabel="取消" isPending={deleting} danger />
  </div>;
}
