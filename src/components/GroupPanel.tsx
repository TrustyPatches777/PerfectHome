import { useState } from 'react';
import {
  alignSelectedWalls,
  alignSelection,
  copySelection,
  cutSelectedCorner,
  deleteSelection,
  distributeSelection,
  duplicateSelection,
  editSelectedWalls,
  groupSelection,
  joinSelectedWalls,
  meetSelectedWalls,
  mergeSelectedRooms,
  mirrorSelection,
  rotateSelection,
  saveTemplate,
  selectAllLike,
  selectionInGroup,
  spaceWallOpenings,
  ungroupSelection,
} from '../actions';
import { WALL_TYPES, WALL_TYPE_HEIGHT, WALL_TYPE_THICKNESS, type ItemKind, type WallType } from '../model';
import type { AlignMode } from '../selection';
import { useDesign } from '../store/design';
import { useUi } from '../store/ui';
import { WALL_STYLE } from '../walls';
import { NumberField } from './fields';
import { t, localize } from '../i18n';

const NAMES: Record<ItemKind, [string, string]> = {
  wall: ['wall', 'walls'],
  opening: ['opening', 'openings'],
  room: ['room', 'rooms'],
  furniture: ['piece of furniture', 'pieces of furniture'],
  label: ['label', 'labels'],
  dimension: ['measurement', 'measurements'],
  zone: ['outdoor area', 'outdoor areas'],
  strip: ['street / fence / path', 'streets, fences & paths'],
  stair: ['staircase', 'staircases'],
  roof: ['roof', 'roofs'],
  skylight: ['skylight', 'skylights'],
  note: ['sticky note', 'sticky notes'],
  guide: ['guide', 'guides'],
};
localize(NAMES, ['0', '1']);

const ALIGN: { mode: AlignMode; label: string; title: string; icon: string }[] = [
  { mode: 'left', label: 'Left', title: 'Align left edges', icon: 'M3 2v16M6 5h11v4H6zM6 11h7v4H6z' },
  { mode: 'center', label: 'Center', title: 'Center horizontally', icon: 'M10 2v16M4 5h12v4H4zM6 11h8v4H6z' },
  { mode: 'right', label: 'Right', title: 'Align right edges', icon: 'M17 2v16M3 5h11v4H3zM7 11h7v4H7z' },
  { mode: 'top', label: 'Top', title: 'Align top edges', icon: 'M2 3h16M5 6h4v11H5zM11 6h4v7h-4z' },
  { mode: 'middle', label: 'Middle', title: 'Center vertically', icon: 'M2 10h16M5 4h4v12H5zM11 6h4v8h-4z' },
  { mode: 'bottom', label: 'Bottom', title: 'Align bottom edges', icon: 'M2 17h16M5 3h4v11H5zM11 7h4v7h-4z' },
];
localize(ALIGN, ['label', 'title']);

/** Shown instead of the single-item properties when several things are selected. */
export function GroupPanel() {
  const selected = useUi((s) => s.selected);
  const design = useDesign((s) => s.design);
  const [template, setTemplate] = useState('');
  const [corner, setCorner] = useState(0.5);
  const counts = new Map<ItemKind, number>();
  for (const r of selected) counts.set(r.kind, (counts.get(r.kind) ?? 0) + 1);
  const summary = [...counts].map(([k, n]) => t('{n} {name}', { n, name: NAMES[k][n > 1 ? 1 : 0] })).join(', ');
  const movable = selected.filter((r) => r.kind !== 'opening').length;
  const walls = selected.filter((r) => r.kind === 'wall');
  const rooms = selected.filter((r) => r.kind === 'room');
  const openings = selected.filter((r) => r.kind === 'opening');
  const oneWallOfOpenings = openings.length > 1 && new Set(openings.map((o) => design.openings.find((x) => x.id === o.id)?.wallId)).size === 1;
  const sameKind = counts.size === 1 && selected.length > 1;
  const grouped = selectionInGroup();

  return (
    <div className="panel" data-testid="group-panel">
      <h3>{t('{length} selected', { length: selected.length })}</h3>
      <p className="muted">{summary}</p>
      <div className="field">
        <span>{t('Align')}</span>
        <div className="icon-row">
          {ALIGN.map((a) => (
            <button key={a.mode} className="icon" title={a.title} aria-label={a.title} onClick={() => alignSelection(a.mode)} data-testid={`align-${a.mode}`} disabled={movable < 2}>
              <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={a.icon} />
              </svg>
            </button>
          ))}
        </div>
      </div>
      <div className="row">
        <button onClick={() => distributeSelection('x')} disabled={movable < 3} title={t('Equal gaps from left to right')} data-testid="distribute-x">
          {t('Distribute ↔')}
        </button>
        <button onClick={() => distributeSelection('y')} disabled={movable < 3} title={t('Equal gaps from top to bottom')} data-testid="distribute-y">
          {t('Distribute ↕')}
        </button>
      </div>
      <div className="row">
        <button onClick={() => rotateSelection(90)} title={t('Rotate the whole selection 90° (R)')} data-testid="group-rotate">
          {t('Rotate 90°')}
        </button>
        <button onClick={() => mirrorSelection('x')} disabled={!movable} title={t('Turn the selection over left-right (H)')} data-testid="mirror-x">
          {t('Mirror ⇆')}
        </button>
        <button onClick={() => mirrorSelection('y')} disabled={!movable} title={t('Turn the selection over top-bottom (Shift+H)')} data-testid="mirror-y">
          {t('Mirror ⇅')}
        </button>
      </div>
      <div className="row">
        <button onClick={groupSelection} disabled={movable < 2} title={t('Keep these together: they are selected and moved as one (Ctrl+G)')} data-testid="group-make">
          {t('Group')}
        </button>
        <button onClick={ungroupSelection} disabled={!grouped} title={t('Let them move separately again (Ctrl+Shift+G)')} data-testid="group-break">
          {t('Ungroup')}
        </button>
        {sameKind && (
          <button onClick={() => selectAllLike(selected[0])} title={t('Select everything of this kind on this floor')} data-testid="select-like">
            {t('Select all like these')}
          </button>
        )}
      </div>
      <div className="row">
        <input type="text" placeholder={t('Name for a template')} value={template} onChange={(e) => setTemplate(e.target.value)} aria-label={t('Template name')} data-testid="template-name" style={{ flex: 1, minWidth: 0 }} />
        <button
          onClick={() => {
            if (saveTemplate(template || 'My group')) setTemplate('');
          }}
          disabled={!movable}
          title={t('Keep this arrangement (a bed with its bedside tables...) to place again from the furniture list')}
          data-testid="template-save"
        >
          {t('Save as template')}
        </button>
      </div>

      {walls.length > 0 && (
        <>
          <h4>
            {t('{length} wall{value}', { length: walls.length, value: walls.length > 1 ? 's' : '' })}
          </h4>
          <div className="row two">
            <NumberField label={t('Thickness')} value={design.walls.find((w) => w.id === walls[0].id)?.thickness ?? 0.15} scale={100} unit="cm" min={2} max={100} testId="bulk-thickness" onCommit={(v) => editSelectedWalls((w) => void (w.thickness = v))} />
            <NumberField label={t('Height')} value={design.walls.find((w) => w.id === walls[0].id)?.height ?? 2.5} scale={100} unit="cm" min={10} max={3000} testId="bulk-height" onCommit={(v) => editSelectedWalls((w) => void (w.height = v))} />
          </div>
          <label className="field">
            <span>{t('Type of all of them')}</span>
            <select
              value=""
              data-testid="bulk-wall-type"
              onChange={(e) => {
                const next = e.target.value as WallType;
                if (next)
                  editSelectedWalls((w) => {
                    w.type = next;
                    w.thickness = WALL_TYPE_THICKNESS[next];
                    w.height = WALL_TYPE_HEIGHT[next];
                  });
              }}
            >
              <option value="">{t('Change…')}</option>
              {WALL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {WALL_STYLE[t].label}
                </option>
              ))}
            </select>
          </label>
          {walls.length === 2 && (
            <>
              <div className="row">
                <button onClick={joinSelectedWalls} title={t('Make one wall of two that meet in a straight line')} data-testid="walls-join">
                  {t('Join')}
                </button>
                <button onClick={meetSelectedWalls} title={t('Trim or extend both walls so that they meet in a corner')} data-testid="walls-meet">
                  {t('Meet at a corner')}
                </button>
              </div>
              <div className="row">
                <button onClick={() => alignSelectedWalls(false)} title={t('Turn the second wall to run parallel to the first')} data-testid="walls-parallel">
                  {t('Make parallel')}
                </button>
                <button onClick={() => alignSelectedWalls(true)} title={t('Turn the second wall to stand square to the first')} data-testid="walls-square">
                  {t('Make square')}
                </button>
              </div>
              <div className="row">
                <NumberField label={t('Cut the corner by')} value={corner} scale={100} unit="cm" min={5} max={500} testId="corner-size" onCommit={setCorner} />
              </div>
              <div className="row">
                <button onClick={() => cutSelectedCorner(corner, false)} title={t('Cut the corner off with a straight wall')} data-testid="corner-chamfer">
                  {t('Chamfer')}
                </button>
                <button onClick={() => cutSelectedCorner(corner, true)} title={t('Round the corner with a curved wall of this radius')} data-testid="corner-round">
                  {t('Round')}
                </button>
              </div>
            </>
          )}
        </>
      )}
      {rooms.length === 2 && (
        <button onClick={mergeSelectedRooms} title={t('Make one room of two that share a stretch of wall')} data-testid="rooms-merge">
          {t('Merge the two rooms')}
        </button>
      )}
      {oneWallOfOpenings && (
        <button
          onClick={() => {
            const wallId = design.openings.find((x) => x.id === openings[0].id)!.wallId;
            spaceWallOpenings(wallId, openings.map((o) => o.id));
          }}
          title={t('Equal gaps between the selected doors and windows and to the ends of the wall')}
          data-testid="openings-space"
        >
          {t('Space them evenly')}
        </button>
      )}
      <div className="row">
        <button onClick={copySelection} title={t('Ctrl+C')}>
          {t('Copy')}
        </button>
        <button onClick={duplicateSelection} title={t('Ctrl+D')} data-testid="group-duplicate">
          {t('Duplicate')}
        </button>
        <button className="danger" onClick={deleteSelection} title={t('Delete')} data-testid="group-delete">
          {t('Delete')}
        </button>
      </div>
      <p className="muted">{t('Shift+click adds or removes items · Shift+drag on empty space selects a box · Ctrl+A selects all.')}</p>
    </div>
  );
}
