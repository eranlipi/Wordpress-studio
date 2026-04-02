import React from 'react';
import { createRoot } from 'react-dom/client';
import { initClient } from './api/client';
import App from './App';
import './styles.css';

const rootEl = document.getElementById('wpab-root');

if (rootEl) {
  // Read WordPress-provided config from data attributes
  const nonce    = rootEl.dataset.nonce    ?? '';
  const restUrl  = rootEl.dataset.restUrl  ?? '/wp-json/wpab/v1';
  const siteUrl  = rootEl.dataset.siteUrl  ?? '/';

  initClient({ nonce, restUrl, siteUrl });

  createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
