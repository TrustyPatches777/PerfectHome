import { useEffect, useRef, useState } from 'react';
import { useUi } from '../store/ui';
import { exportJson, exportPng, exportSvg, hasBackup, importJsonFile, newDesign, restoreBackup } from '../session';
import { t } from '../i18n';

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
        {t('File ▾')}
      </button>
      {open && (
        <div className="menu-list" role="menu">
          {item(t('New design'), newDesign, 'menu-new')}
          {item(t('Import JSON…'), () => fileInput.current?.click(), 'menu-import')}
          {item(t('Area table…'), () => useUi.getState().setDialog({ type: 'areas' }), 'menu-areas')}
          {item(t('Snapshots…'), () => useUi.getState().setDialog({ type: 'snapshots' }), 'menu-snapshots')}
          {item(t('Export JSON'), exportJson, 'menu-export-json')}
          {item(t('Export PNG'), exportPng, 'menu-export-png')}
          {item(t('Export SVG'), exportSvg, 'menu-export-svg')}
          {item(t('Print / save as PDF…'), () => useUi.getState().setDialog({ type: 'print' }), 'menu-print')}
          {item(t('Elevations and sections…'), () => useUi.getState().setDialog({ type: 'drawing' }), 'menu-drawing')}
          {item(t('Restore previous design'), restoreBackup, 'menu-restore', !hasBackup())}
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
