import '~/cryptoart/shell.css';

import React from 'react';
import ReactDOM from 'react-dom/client';

import { Shell } from '~/cryptoart/Shell';

const root = document.getElementById('root');

if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <Shell />
    </React.StrictMode>,
  );
}
