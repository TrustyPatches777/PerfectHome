import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { useDesign } from './store/design';
import { useUi } from './store/ui';
import './styles.css';

// Handy for debugging and used by the Playwright tests.
(window as unknown as { __ph: unknown }).__ph = { design: useDesign, ui: useUi };

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
