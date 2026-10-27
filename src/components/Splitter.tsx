import { useUi, SIDEBAR_WIDTH } from '../store/ui';

/**
 * A draggable bar between a sidebar and the editing window. Drag to make the sidebar wider or narrower (the window takes the
 * rest); double-click to put it back. The width is remembered.
 */
export function Splitter({ side }: { side: 'left' | 'right' }) {
  const start = (e: React.MouseEvent) => {
    e.preventDefault();
    const x0 = e.clientX;
    const w0 = side === 'left' ? useUi.getState().leftWidth : useUi.getState().rightWidth;
    const move = (m: MouseEvent) => {
      const dx = m.clientX - x0;
      useUi.getState().setSidebarWidth(side, side === 'left' ? w0 + dx : w0 - dx);
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      document.body.classList.remove('resizing');
    };
    document.body.classList.add('resizing');
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  return (
    <div
      className={`splitter ${side}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={side === 'left' ? 'Resize the left sidebar' : 'Resize the right sidebar'}
      title="Drag to resize · double-click to reset"
      onMouseDown={start}
      onDoubleClick={() => useUi.getState().setSidebarWidth(side, SIDEBAR_WIDTH[side].def)}
      data-testid={`splitter-${side}`}
    />
  );
}
