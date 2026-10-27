import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { CanvasView } from './canvas/CanvasView';
import { TopBar } from './components/TopBar';
import { StatusBar } from './components/StatusBar';
import { ToolBar } from './components/ToolBar';
import { PalettePanel } from './components/PalettePanel';
import { Properties } from './components/Properties';
import { LayersPanel } from './components/LayersPanel';
import { FloorsPanel } from './components/FloorsPanel';
import { NotesPanel } from './components/NotesPanel';
import { SunPanel } from './components/SunPanel';
import { ChecksPanel } from './components/ChecksPanel';
import { HelpDialog } from './components/HelpDialog';
import { Dialogs } from './components/Dialogs';
import { useShortcuts } from './hooks/useShortcuts';
import { bootstrap } from './session';
import { HSplitter, Splitter } from './components/Splitter';
import { useUi } from './store/ui';

// three.js is only downloaded when the 3D view is opened
const View3D = lazy(() => import('./view3d/View3D'));

export function App() {
  const [help, setHelp] = useState(false);
  const toggleHelp = useCallback(() => setHelp((h) => !h), []);
  useShortcuts(toggleHelp);
  const view = useUi((s) => s.view);
  const leftWidth = useUi((s) => s.leftWidth);
  const rightWidth = useUi((s) => s.rightWidth);
  const toolsHeight = useUi((s) => s.toolsHeight);
  // Child effects (the canvas measuring itself) run first, so the loaded design is framed correctly.
  useEffect(() => bootstrap(), []);

  return (
    <div className="app">
      <TopBar onHelp={toggleHelp} />
      <div className="main">
        {view === '2d' && (
          <>
            <aside className="sidebar left" style={{ width: leftWidth }}>
              <div className="tools-box" style={{ height: toolsHeight }} data-testid="tools-box">
                <ToolBar />
              </div>
              <HSplitter />
              <PalettePanel />
            </aside>
            <Splitter side="left" />
          </>
        )}
        <div className="stage-area">
          {view === '2d' ? (
            <CanvasView />
          ) : (
            <Suspense fallback={<div className="canvas-wrap view3d-loading">Loading the 3D view…</div>}>
              <View3D />
            </Suspense>
          )}
          <StatusBar />
        </div>
        <Splitter side="right" />
        <aside className="sidebar right" style={{ width: rightWidth }}>
          <FloorsPanel />
          {view === '2d' && <SunPanel />}
          {view === '2d' && <ChecksPanel />}
          {view === '2d' && <Properties />}
          {view === '2d' && <NotesPanel />}
          <LayersPanel />
        </aside>
      </div>
      {help && <HelpDialog onClose={toggleHelp} />}
      <Dialogs />
    </div>
  );
}
