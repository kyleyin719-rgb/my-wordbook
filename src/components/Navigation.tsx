import { NavLink } from 'react-router-dom';
import { BookOpen, PlusCircle, Settings, Star } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';

export default function Navigation() {
  const starredCount = useLiveQuery(() => db.words.filter(word => word.starred).count());
  const items = [
    { to: '/words', label: '全部', icon: BookOpen },
    { to: '/starred', label: '重点', icon: Star },
    { to: '/add', label: '添加', icon: PlusCircle },
    { to: '/settings', label: '设置', icon: Settings }
  ];
  return (
    <nav className="book-mobile-nav" aria-label="主导航">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} className={({ isActive }) => `book-mobile-link ${isActive ? 'active' : ''}`}>
          <Icon size={23} strokeWidth={1.9} aria-hidden="true" />
          <span>{label}{to === '/starred' && starredCount ? <span className="book-mobile-count">{starredCount}</span> : null}</span>
        </NavLink>
      ))}
    </nav>
  );
}
