import { CanvasView } from './canvas/CanvasView';
import { TopBar } from './components/TopBar';
import { StatusBar } from './components/StatusBar';

export function App() {
  return (
    <div className="app">
      <TopBar />
      <div className="main">
        <div className="stage-area">
          <CanvasView />
          <StatusBar />
        </div>
      </div>
    </div>
  );
}
