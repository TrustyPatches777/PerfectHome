import { useEffect, useRef, useState } from 'react';
import { useUi } from '../store/ui';
import { exportJson, exportPng, exportSvg, hasBackup, importJsonFile, newDesign, restoreBackup } from '../session';

export function FileMenu() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

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

  const item = (label: string, fn: () => void, testId: string, disabled = false) => (
    <button
      role="menuitem"
      disabled={disabled}
      data-testid={testId}
      onClick={() => {
        setOpen(false);
        fn();
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="menu" ref={wrap}>
      <button onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} data-testid="file-menu">
        File ▾
      </button>
      {open && (
        <div className="menu-list" role="menu">
          {item('New design', newDesign, 'menu-new')}
          {item('Import JSON…', () => fileInput.current?.click(), 'menu-import')}
          {item('Area table…', () => useUi.getState().setDialog({ type: 'areas' }), 'menu-areas')}
          {item('Snapshots…', () => useUi.getState().setDialog({ type: 'snapshots' }), 'menu-snapshots')}
          {item('Export JSON', exportJson, 'menu-export-json')}
          {item('Export PNG', exportPng, 'menu-export-png')}
          {item('Export SVG', exportSvg, 'menu-export-svg')}
          {item('Print / save as PDF…', () => useUi.getState().setDialog({ type: 'print' }), 'menu-print')}
          {item('Elevations and sections…', () => useUi.getState().setDialog({ type: 'drawing' }), 'menu-drawing')}
          {item('Restore previous design', restoreBackup, 'menu-restore', !hasBackup())}
        </div>
      )}
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        hidden
        data-testid="import-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void importJsonFile(f);
        }}
      />
    </div>
  );
}
