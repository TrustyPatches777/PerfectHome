import { useEffect } from 'react';
import { deleteSelection, duplicateSelection, nudgeSelection, rotateSelection } from '../actions';
import { fitView, zoomByCenter } from '../canvas/camera';
import { TOOL_KEYS } from '../shortcuts';
import { useDesign } from '../store/design';
import { useUi } from '../store/ui';

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable);

export function useShortcuts(toggleHelp: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) {
        if (e.key === 'Escape' || (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT')) {
          (e.target as HTMLElement).blur();
        }
        return;
      }
      const design = useDesign.getState();
      const ui = useUi.getState();
      const key = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;

      if (mod) {
        if (key === 'z') {
          e.shiftKey ? design.redo() : design.undo();
        } else if (key === 'y') {
          design.redo();
        } else if (key === 'd') {
          duplicateSelection();
        } else return;
        e.preventDefault();
        return;
      }
      if (e.altKey) return;

      const step = design.design.settings.gridStep;
      const big = e.shiftKey ? 5 : 1;
      switch (e.key) {
        case 'Delete':
        case 'Backspace':
          deleteSelection();
          break;
        case 'Escape':
          if (ui.tool !== 'select') {
            ui.setTool('select');
            ui.setPlacing(null);
          } else ui.select(null);
          break;
        case 'ArrowLeft':
          nudgeSelection(-step * big, 0);
          break;
        case 'ArrowRight':
          nudgeSelection(step * big, 0);
          break;
        case 'ArrowUp':
          nudgeSelection(0, -step * big);
          break;
        case 'ArrowDown':
          nudgeSelection(0, step * big);
          break;
        case '[':
          rotateSelection(-15);
          break;
        case ']':
          rotateSelection(15);
          break;
        case '?':
          toggleHelp();
          break;
        case '+':
        case '=':
          zoomByCenter(1.25);
          break;
        case '-':
          zoomByCenter(1 / 1.25);
          break;
        default:
          if (key === 'r') rotateSelection(e.shiftKey ? -90 : 90);
          else if (key === 'g') ui.toggleSnap();
          else if (key === 'f') fitView(design.design);
          else if (TOOL_KEYS[key]) ui.setTool(TOOL_KEYS[key]);
          else return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleHelp]);
}
