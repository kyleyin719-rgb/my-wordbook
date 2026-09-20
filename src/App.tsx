import { BrowserRouter, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { BookOpen, Clock3, Download, Settings, Star } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db/db';
import Navigation from './components/Navigation';
import Words from './pages/Words';
import ImportPage from './pages/Import';
import SettingsPage from './pages/Settings';
import { ToastProvider } from './components/ToastProvider';

function Sidebar() {
  const groups = useLiveQuery(() => db.groups.toArray());
  const starredCount = useLiveQuery(() => db.words.filter(word => word.starred).count());
  const location = useLocation();
  const links = [
    { to: '/words', icon: BookOpen, label: '全部单词' },
    { to: '/starred', icon: Star, label: '重点单词' },
    { to: '/recent', icon: Clock3, label: '最近添加' }
  ];

  return (
    <aside className="book-sidebar" aria-label="词书导航">
      <div className="book-brand"><strong>我的词书</strong><span>Lexuni · 个人电子词书</span></div>
      <nav className="book-side-links" aria-label="词汇视图">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `book-side-link ${isActive || (to === '/words' && location.pathname.startsWith('/words/')) ? 'active' : ''}`}>
            <Icon size={20} strokeWidth={2} aria-hidden="true" /><span>{label}</span>{to === '/starred' ? <span className="book-nav-count">{starredCount ?? 0}</span> : null}
          </NavLink>
        ))}
      </nav>
      <div className="book-side-groups">
        <h2>我的分组</h2>
        {(groups ?? []).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(group => (
          <NavLink key={group.id} to={`/words?groupId=${encodeURIComponent(group.id)}`} className="book-group-link" title={group.name}>
            <span className="book-group-dot" /><span>{group.name}</span>
          </NavLink>
        ))}
        {groups?.length === 0 ? <p>导入词汇后会显示分组</p> : null}
      </div>
      <div className="book-side-bottom">
        <NavLink to="/words/import" className="book-side-link"><Download size={19} aria-hidden="true" /><span>导入词汇</span></NavLink>
        <NavLink to="/settings" className="book-side-link"><Settings size={19} aria-hidden="true" /><span>设置与备份</span></NavLink>
      </div>
    </aside>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider><div className="book-app">
        <a className="skip-link" href="#main-content">跳到内容</a>
        <Sidebar />
        <main id="main-content" className="book-content" tabIndex={-1}>
          <Routes>
            <Route path="/" element={<Navigate to="/words" replace />} />
            <Route path="/words" element={<Words key="all" view="all" />} />
            <Route path="/words/import" element={<ImportPage />} />
            <Route path="/words/:id" element={<Words key="detail" view="all" />} />
            <Route path="/starred" element={<Words key="starred" view="starred" />} />
            <Route path="/recent" element={<Words key="recent" view="recent" />} />
            <Route path="/add" element={<Words key="add" view="all" initialAdd />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/words" replace />} />
          </Routes>
        </main>
        <Navigation />
      </div></ToastProvider>
    </BrowserRouter>
  );
}
