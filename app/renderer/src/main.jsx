import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

const mount = () => {
  try {
    const rootEl = document.getElementById('root');
    if (!rootEl) {
      console.error('[renderer] root element not found');
      return;
    }

    const root = createRoot(rootEl);
    root.render(<App />);
    console.info('[renderer] react mounted');
  } catch (err) {
    console.error('[renderer] react mount failed', err);
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
