import { useCallback, useEffect, useState } from 'react';
import { CanvasView } from './canvas/CanvasView';
import { TopBar } from './components/TopBar';
import { StatusBar } from './components/StatusBar';
import { ToolBar } from './components/ToolBar';
import { PalettePanel } from './components/PalettePanel';
import { Properties } from './components/Properties';
import { LayersPanel } from './components/LayersPanel';
import { FloorsPanel } from './components/FloorsPanel';
import { HelpDialog } from './components/HelpDialog';
import { Dialogs } from './components/Dialogs';
import { useShortcuts } from './hooks/useShortcuts';
import { bootstrap } from './session';

export function App() {
  const [help, setHelp] = useState(false);
  const toggleHelp = useCallback(() => setHelp((h) => !h), []);
  useShortcuts(toggleHelp);
  // Child effects (the canvas measuring itself) run first, so the loaded design is framed correctly.
  useEffect(() => bootstrap(), []);

  return (
    <div className="app">
      <TopBar onHelp={toggleHelp} />
      <div className="main">
        <aside className="sidebar left">
          <ToolBar />
          <PalettePanel />
        </aside>
        <div className="stage-area">
          <CanvasView />
          <StatusBar />
        </div>
        <aside className="sidebar right">
          <FloorsPanel />
          <Properties />
          <LayersPanel />
        </aside>
      </div>
      {help && <HelpDialog onClose={toggleHelp} />}
      <Dialogs />
    </div>
  );
}
