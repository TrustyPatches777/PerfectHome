import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { useDesign } from './store/design';
import { useLive } from './store/live';
import { useUi } from './store/ui';
import { liveDoc } from './live/live';
import { getStage } from './canvas/stage';
import './styles.css';

// Handy for debugging and used by the Playwright tests.
(window as unknown as { __ph: unknown }).__ph = { design: useDesign, ui: useUi, stage: getStage, live: useLive, liveDoc };

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
