import { useCallback, useState } from 'react';
import { CanvasView } from './canvas/CanvasView';
import { TopBar } from './components/TopBar';
import { StatusBar } from './components/StatusBar';
import { ToolBar } from './components/ToolBar';
import { FurniturePalette } from './components/FurniturePalette';
import { Properties } from './components/Properties';
import { LayersPanel } from './components/LayersPanel';
import { HelpDialog } from './components/HelpDialog';
import { useShortcuts } from './hooks/useShortcuts';

export function App() {
  const [help, setHelp] = useState(false);
  const toggleHelp = useCallback(() => setHelp((h) => !h), []);
  useShortcuts(toggleHelp);

  return (
    <div className="app">
      <TopBar onHelp={toggleHelp} />
      <div className="main">
        <aside className="sidebar left">
          <ToolBar />
          <FurniturePalette />
        </aside>
        <div className="stage-area">
          <CanvasView />
          <StatusBar />
        </div>
        <aside className="sidebar right">
          <Properties />
          <LayersPanel />
        </aside>
      </div>
      {help && <HelpDialog onClose={toggleHelp} />}
    </div>
  );
}
