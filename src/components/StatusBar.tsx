import { useUi } from '../store/ui';

const HINTS: Record<string, string> = {
  select: 'Drag empty space to pan · scroll to zoom · click an item to select',
};

export function StatusBar() {
  const cursor = useUi((s) => s.cursor);
  const tool = useUi((s) => s.tool);
  const toast = useUi((s) => s.toast);
  return (
    <div className="statusbar">
      <span className="hint">{toast ?? HINTS[tool] ?? ''}</span>
      <span className="coords" data-testid="coords">
        {cursor ? `x ${cursor.x.toFixed(2)} m   y ${cursor.y.toFixed(2)} m` : ''}
      </span>
    </div>
  );
}
