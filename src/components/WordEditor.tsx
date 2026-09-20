import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Modal from './Modal';
import type { Word, WordGroup } from '../types';

export type WordDraft = Pick<Word, 'word' | 'ipaUK' | 'ipaUS' | 'partOfSpeech' | 'meaning' | 'examples' | 'note' | 'starred' | 'groupId'>;

type Props = {
  word?: Word;
  groups: WordGroup[];
  preferredGroupId?: string;
  initialWord?: string;
  onClose: () => void;
  onSave: (draft: WordDraft) => Promise<Word | void>;
  onOpenExisting: (word: Word) => void;
};

export default function WordEditor({ word, groups, preferredGroupId, initialWord = '', onClose, onSave, onOpenExisting }: Props) {
  const [draft, setDraft] = useState<WordDraft>({
    word: word?.word ?? initialWord,
    ipaUK: word?.ipaUK ?? '',
    ipaUS: word?.ipaUS ?? '',
    partOfSpeech: word?.partOfSpeech ?? '',
    meaning: word?.meaning ?? '',
    examples: word?.examples.map(example => ({ ...example })) ?? [],
    note: word?.note ?? '',
    starred: word?.starred ?? false,
    groupId: word?.groupId ?? preferredGroupId ?? groups[0]?.id ?? ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [duplicate, setDuplicate] = useState<Word | null>(null);

  const update = <K extends keyof WordDraft>(key: K, value: WordDraft[K]) => {
    if (key === 'word') setDuplicate(null);
    setDraft(previous => ({ ...previous, [key]: value }));
  };
  const updateExample = (index: number, key: 'en' | 'zh', value: string) => {
    setDraft(previous => ({ ...previous, examples: previous.examples.map((example, itemIndex) => itemIndex === index ? { ...example, [key]: value } : example) }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    if (!draft.word.trim() || !draft.meaning.trim()) {
      setError('请填写英文单词和中文释义，不能只输入空格。');
      return;
    }
    setSaving(true);
    setError('');
    setDuplicate(null);
    try {
      const existing = await onSave({ ...draft, word: draft.word.trim(), meaning: draft.meaning.trim(), examples: draft.examples.filter(example => example.en.trim() || example.zh.trim()) });
      if (existing) {
        setDuplicate(existing);
        setSaving(false);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存失败，请重试。');
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={word ? '编辑单词' : '添加单词'} dismissible={!saving} closeLabel="关闭编辑窗口" dialogClassName="book-editor-modal" footer={
      <div className="book-modal-actions">
        <button type="button" className="book-button book-button-subtle" onClick={onClose} disabled={saving}>取消</button>
        <button type="submit" form="book-word-form" className="book-button book-button-primary" disabled={saving}>{saving ? '保存中…' : '保存单词'}</button>
      </div>
    }>
      <form id="book-word-form" className="book-editor" onSubmit={submit}>
        <div className="book-form-grid">
          <label className="book-field book-field-wide">英文单词或短语 * <input required autoFocus maxLength={160} value={draft.word} onChange={event => update('word', event.target.value)} placeholder="例如 serendipity" /></label>
          <label className="book-field">英式音标 <input value={draft.ipaUK} onChange={event => update('ipaUK', event.target.value)} placeholder="/ˌser.ənˈdɪp.ɪ.ti/" /></label>
          <label className="book-field">美式音标 <input value={draft.ipaUS} onChange={event => update('ipaUS', event.target.value)} placeholder="/ˌser.ənˈdɪp.ə.t̬i/" /></label>
          <label className="book-field">词性 <input value={draft.partOfSpeech} onChange={event => update('partOfSpeech', event.target.value)} placeholder="n. / v. / adj." /></label>
          <label className="book-field">所属分组
            <select value={draft.groupId} onChange={event => update('groupId', event.target.value)}>
              {groups.length === 0 ? <option value="">我的词汇（自动创建）</option> : null}
              {groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
          </label>
          <label className="book-field book-field-wide">中文释义 * <textarea required rows={2} value={draft.meaning} onChange={event => update('meaning', event.target.value)} placeholder="输入简洁的中文释义" /></label>
        </div>
        <div className="book-editor-section">
          <div className="book-editor-section-head"><h3>例句</h3><button type="button" className="book-text-button" onClick={() => update('examples', [...draft.examples, { id: crypto.randomUUID(), en: '', zh: '' }])}><Plus size={16} />添加另一条例句</button></div>
          {draft.examples.map((example, index) => (
            <div className="book-example-editor" key={example.id}>
              <label className="book-field">英文例句 <textarea rows={2} value={example.en} onChange={event => updateExample(index, 'en', event.target.value)} /></label>
              <label className="book-field">中文翻译 <textarea rows={2} value={example.zh} onChange={event => updateExample(index, 'zh', event.target.value)} /></label>
              <button type="button" className="book-text-button book-danger-text" onClick={() => update('examples', draft.examples.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={16} />删除例句</button>
            </div>
          ))}
        </div>
        <label className="book-field">我的笔记 <textarea rows={4} value={draft.note} onChange={event => update('note', event.target.value)} placeholder="记录用法、联想或其他备注" /></label>
        <label className="book-check"><input type="checkbox" checked={draft.starred} onChange={event => update('starred', event.target.checked)} />标为重点单词</label>
        {duplicate ? <div className="book-duplicate" role="status"><p>该单词已经存在，是否打开已有词条？</p><button type="button" className="book-button book-button-subtle" onClick={() => onOpenExisting(duplicate)}>打开“{duplicate.word}”</button></div> : null}
        {error ? <p className="book-form-error" role="alert">{error}</p> : null}
      </form>
    </Modal>
  );
}
