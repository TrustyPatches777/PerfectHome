import { useEffect, useRef, useState } from 'react';
import { useUi } from '../store/ui';

/** Switches for what is shown on the plan (rulers, guides, automatic dimensions). */
export function ViewMenu() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const showRulers = useUi((s) => s.showRulers);
  const showGuides = useUi((s) => s.showGuides);
  const showAllDims = useUi((s) => s.showAllDims);
  const ui = useUi.getState();

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('mousedown', away);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('mousedown', away);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);

  const item = (label: string, checked: boolean, toggle: () => void, testId: string) => (
    <label className="menu-check" data-testid={testId}>
      <input type="checkbox" checked={checked} onChange={toggle} />
      {label}
    </label>
  );

  return (
    <div className="menu" ref={wrap}>
      <button onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} data-testid="view-menu">
        View ▾
      </button>
      {open && (
        <div className="menu-list" role="menu">
          {item('Rulers', showRulers, () => ui.setShowRulers(!showRulers), 'view-rulers')}
          {item('Guides', showGuides, () => ui.setShowGuides(!showGuides), 'view-guides')}
          {item('All dimensions', showAllDims, () => ui.setShowAllDims(!showAllDims), 'view-dims')}
          <button role="menuitem" data-testid="menu-find" onClick={() => { setOpen(false); ui.setDialog({ type: 'find' }); }}>
            Find…
          </button>
          <button role="menuitem" data-testid="menu-rooms" onClick={() => { setOpen(false); ui.setDialog({ type: 'rooms' }); }}>
            Rooms table…
          </button>
        </div>
      )}
    </div>
  );
}
