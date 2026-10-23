/** What happens when the mouse is pressed on an item in the select tool. One path for every kind of item. */
import type { ItemRef } from '../model';
import { anchorOf, isRefLocked, moveFromBase, sameRef } from '../selection';
import { useDesign } from '../store/design';
import { useUi } from '../store/ui';
import { startPan } from './camera';
import { startOpeningDrag, startPolyMove, startWallMove } from './editing';
import { dragSession, input, snapWorld } from './input';

/** Drag everything that is selected, snapping the clicked item's center to the grid. */
export function startGroupMove(evt: MouseEvent, primary: ItemRef, narrowOnClick = false) {
  const base = useDesign.getState().design;
  const refs = useUi.getState().selected.filter((r) => r.kind !== 'opening' && !isRefLocked(base, r));
  const anchor = anchorOf(base, primary);
  if (!refs.length || !anchor) return;
  dragSession(evt, (world, start) => {
    const raw = { x: anchor.x + world.x - start.x, y: anchor.y + world.y - start.y };
    const snapped = snapWorld(raw, { ignore: () => true }).p; // grid only
    const dx = snapped.x - anchor.x;
    const dy = snapped.y - anchor.y;
    useDesign.getState().update((d) => {
      for (const r of refs) moveFromBase(d, base, r, dx, dy);
    });
  }, (moved) => {
    // a plain click on a member of a multi-selection narrows the selection to that item
    if (!moved && narrowOnClick) useUi.getState().select(primary);
  });
}

/**
 * - Shift/Ctrl+press toggles the item in the selection.
 * - 'move' items (walls, furniture, labels...): the press selects the item (unless it is already part of the
 *   selection) and a drag moves it, or all selected items together.
 * - 'area' items (rooms, outdoor areas, streets): they are big and fill the screen, so a drag on an unselected one
 *   pans the plan and a plain click selects it; only an already-selected zone/street is moved by dragging.
 */
export function pressItem(evt: MouseEvent, ref: ItemRef, mode: 'move' | 'area' = 'move') {
  if (evt.button !== 0 || input.space) return;
  const ui = useUi.getState();
  if (evt.shiftKey || evt.ctrlKey || evt.metaKey) {
    ui.toggleSelected(ref);
    return;
  }
  const isSelected = ui.selected.some((r) => sameRef(r, ref));

  if (mode === 'area') {
    if (!isSelected) return startPan(evt.clientX, evt.clientY, () => ui.select(ref));
    if (ui.selected.length > 1) return startGroupMove(evt, ref, true);
    if (ref.kind === 'zone' || ref.kind === 'strip') return startPolyMove(evt, ref.kind, ref.id);
    return startPan(evt.clientX, evt.clientY); // a selected room: dragging still pans
  }

  if (!isSelected) ui.select(ref);
  if (useUi.getState().selected.length > 1) return startGroupMove(evt, ref, isSelected);
  if (ref.kind === 'wall') return startWallMove(evt, ref.id);
  if (ref.kind === 'opening') return startOpeningDrag(evt, ref.id);
  startGroupMove(evt, ref);
}
