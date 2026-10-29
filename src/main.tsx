import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initLang } from './i18n';
import { useDesign } from './store/design';
import { useLive } from './store/live';
import { CATALOG } from './catalog';
import { useUi } from './store/ui';
import { liveDoc } from './live/live';
import { getStage } from './canvas/stage';
import './styles.css';

// Handy for debugging and used by the Playwright tests.
(window as unknown as { __ph: unknown }).__ph = { design: useDesign, ui: useUi, stage: getStage, live: useLive, liveDoc, catalog: CATALOG };

// the language the browser remembers is loaded first, so nothing flashes in English
void initLang().then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
);
