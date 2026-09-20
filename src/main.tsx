import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './wordbook.css';
import App from './App.tsx';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import { applyTheme } from './lib/theme.ts';

applyTheme(localStorage.getItem('lexuni-theme'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
