import { useUi, type Tool } from '../store/ui';

const TOOLS: { tool: Tool; label: string; key: string; icon: string }[] = [
  { tool: 'select', label: 'Select', key: 'V', icon: 'M5 3l12 7-5.2 1.4L9.6 17z' },
  { tool: 'wall', label: 'Wall', key: 'W', icon: 'M3 14V8h14v6zM3 11h14M8 8v3M13 11v3' },
  { tool: 'door', label: 'Door', key: 'D', icon: 'M4 17V4h5M4 17h12M9 4a8 8 0 0 1 7 13' },
  { tool: 'window', label: 'Window', key: 'N', icon: 'M3 8h14v4H3zM10 8v4M3 10h14' },
  { tool: 'room', label: 'Room', key: 'A', icon: 'M4 4h12v12H4zM8 8h4v4H8z' },
  { tool: 'stairs', label: 'Stairs', key: 'S', icon: 'M3 16h4v-4h4V8h4V4h2M3 16v-2M7 12v-2M11 8V6' },
  { tool: 'measure', label: 'Measure', key: 'M', icon: 'M3 13l10-10 4 4L7 17zM6 10l2 2M9 7l2 2M12 4l2 2' },
  { tool: 'note', label: 'Sticky note', key: 'C', icon: 'M3 4h14v10H9l-4 3v-3H3zM6 8h8M6 11h5' },
  { tool: 'text', label: 'Text', key: 'T', icon: 'M5 5h10M10 5v11M8 16h4' },
];

export function ToolBar() {
  const tool = useUi((s) => s.tool);
  return (
    <div className="tools" role="toolbar" aria-label="Tools">
      {TOOLS.map((t) => (
        <button
          key={t.tool}
          className={`tool ${tool === t.tool ? 'active' : ''}`}
          onClick={() => useUi.getState().setTool(t.tool)}
          title={`${t.label} (${t.key})`}
          data-testid={`tool-${t.tool}`}
        >
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
            <path d={t.icon} />
          </svg>
          <span>{t.label}</span>
          <kbd>{t.key}</kbd>
        </button>
      ))}
    </div>
  );
}
