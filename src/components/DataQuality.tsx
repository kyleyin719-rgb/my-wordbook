import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronRight, ClipboardCheck } from 'lucide-react';
import { db } from '../db/db';
import { getWordCompleteness, matchesQualityFilter, type QualityFilter } from '../lib/wordQuality';

type QualityItem = { label: string; filter: QualityFilter; count: number; hint: string };

export default function DataQuality() {
  const words = useLiveQuery(() => db.words.toArray());
  const report = useMemo(() => {
    const list = words ?? [];
    const count = (filter: QualityFilter) => list.filter(word => matchesQualityFilter(word, filter)).length;
    return {
      total: list.length,
      complete: list.filter(word => getWordCompleteness(word) === 'complete').length,
      items: [
        { label: '缺英式音标', filter: 'missing-ipa-uk', count: count('missing-ipa-uk'), hint: 'ipaUK 为空' },
        { label: '缺美式音标', filter: 'missing-ipa-us', count: count('missing-ipa-us'), hint: 'ipaUS 为空' },
        { label: '缺词性', filter: 'missing-pos', count: count('missing-pos'), hint: 'partOfSpeech 为空' },
        { label: '缺中文释义', filter: 'missing-meaning', count: count('missing-meaning'), hint: 'meaning 为空' },
        { label: '缺例句', filter: 'missing-example', count: count('missing-example'), hint: '没有任何例句' },
        { label: '缺例句翻译', filter: 'missing-example-translation', count: count('missing-example-translation'), hint: '英文例句没有中文翻译' },
        { label: '缺笔记', filter: 'missing-note', count: count('missing-note'), hint: '仅统计，不属于错误' }
      ] satisfies QualityItem[]
    };
  }, [words]);

  return <section className="settings-section data-quality-section" aria-labelledby="data-quality-title">
    <div className="data-quality-heading"><div><h2 id="data-quality-title" className="settings-title">词库数据检查</h2><p className="book-settings-copy">状态由当前词条动态计算，不写入数据库。点击项目可筛选对应单词。</p></div><ClipboardCheck size={24} aria-hidden="true" /></div>
    <div className="data-quality-summary">
      <div><strong>{report.total}</strong><span>总单词数</span></div>
      <Link to="/words?quality=complete"><strong>{report.complete}</strong><span><CheckCircle2 size={15} />完整词条</span></Link>
    </div>
    <div className="data-quality-list">
      {report.items.map(item => <Link key={item.filter} to={`/words?quality=${item.filter}`}><div><strong>{item.label}</strong><small>{item.hint}</small></div><span>{item.count}<ChevronRight size={17} /></span></Link>)}
    </div>
  </section>;
}
