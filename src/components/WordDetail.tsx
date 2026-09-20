import { ChevronLeft, Pencil, Star, Trash2, Volume2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Word } from '../types';
import { speakSentence, speakWord, speechSupported, stopSpeech } from '../services/speech';

type Props = { word?: Word; onBack: () => void; onStar: (word: Word) => void; onEdit: (word: Word) => void; onDelete: (word: Word) => void };

export default function WordDetail({ word, onBack, onStar, onEdit, onDelete }: Props) {
  const [playing, setPlaying] = useState<string | null>(null);
  const canSpeak = speechSupported();

  useEffect(() => () => stopSpeech(), [word?.id]);

  if (!word) return <div className="book-inspector-empty"><Star size={28} /><h2>选择一个单词查看详情</h2><p>添加你的第一个单词，或在列表中选择词条。</p></div>;

  const play = (key: string, text: string, accent?: 'en-GB' | 'en-US') => {
    setPlaying(key);
    const finish = () => setPlaying(current => current === key ? null : current);
    const started = accent ? speakWord(text, accent, finish) : speakSentence(text, finish);
    if (!started) setPlaying(null);
  };

  return <div className="book-detail">
    <button type="button" className="book-detail-back" onClick={onBack}><ChevronLeft size={19} />返回列表</button>
    <div className="book-detail-head">
      <h2>{word.word}</h2>
      <button type="button" className={`book-icon-button book-star-button ${word.starred ? 'active' : ''}`} onClick={() => onStar(word)} aria-label={word.starred ? '取消重点' : '标为重点'} title={word.starred ? '取消重点' : '标为重点'}><Star size={23} fill={word.starred ? 'currentColor' : 'none'} /></button>
    </div>
    <div className="book-pronunciations">
      <div><span className="book-locale">英</span><span>{word.ipaUK || '暂无音标'}</span>{canSpeak ? <button type="button" className={`book-sound-button ${playing === 'uk' ? 'playing' : ''}`} onClick={() => play('uk', word.word, 'en-GB')} aria-label="播放英式发音"><Volume2 size={19} /></button> : null}</div>
      <div><span className="book-locale">美</span><span>{word.ipaUS || '暂无音标'}</span>{canSpeak ? <button type="button" className={`book-sound-button ${playing === 'us' ? 'playing' : ''}`} onClick={() => play('us', word.word, 'en-US')} aria-label="播放美式发音"><Volume2 size={19} /></button> : null}</div>
    </div>
    <section className="book-detail-section"><h3>词性</h3><p>{word.partOfSpeech || '未填写'}</p></section>
    <section className="book-detail-section"><h3>中文释义</h3><p className="book-meaning-full">{word.meaning}</p></section>
    <section className="book-detail-section"><h3>例句</h3>{word.examples.length ? word.examples.map(example => <div className="book-example" key={example.id}><div><p>{example.en}</p>{canSpeak && example.en ? <button type="button" className={`book-sound-button ${playing === example.id ? 'playing' : ''}`} onClick={() => play(example.id, example.en)} aria-label={`朗读例句：${example.en}`}><Volume2 size={18} /></button> : null}</div><p className="book-example-zh">{example.zh}</p></div>) : <p className="book-muted">还没有例句</p>}</section>
    <section className="book-detail-section"><h3>我的笔记</h3><p className={word.note ? 'book-note' : 'book-muted'}>{word.note || '暂无笔记'}</p></section>
    <div className="book-detail-actions"><button type="button" className="book-button book-button-subtle" onClick={() => onEdit(word)}><Pencil size={17} />编辑</button><button type="button" className="book-button book-button-danger" onClick={() => onDelete(word)}><Trash2 size={17} />删除</button></div>
  </div>;
}
