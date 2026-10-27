import { useDesign } from '../store/design';
import { catalogItem } from '../catalog';
import { useUi } from '../store/ui';
import { WALL_TYPES, WALL_TYPE_THICKNESS, type OpeningKind } from '../model';
import { WALL_STYLE } from '../walls';
import { STAIR_DEFAULTS } from '../stairs';
import { STAIR_KINDS, ROOF_KINDS, type RoofKind } from '../model';
import { ROOF_STYLES } from '../roofs';
import { WALL_FINISHES, type WallFinish } from '../model';
import { FINISH_STYLES, PAINT_COLORS } from '../walls';
import { SKYLIGHT_SIZES, addRoofFromWalls } from '../roofActions';
import { STRIP_STYLES, ZONE_STYLES } from '../outdoor';
import { NumberField } from './fields';

const DOOR_KINDS: { kind: Exclude<OpeningKind, 'window' | 'bay'>; label: string }[] = [
  { kind: 'door', label: 'Interior' },
  { kind: 'main', label: 'Main door' },
  { kind: 'garden', label: 'Garden door' },
  { kind: 'double', label: 'Double' },
  { kind: 'french', label: 'French' },
  { kind: 'sliding', label: 'Sliding' },
  { kind: 'garage', label: 'Garage' },
  { kind: 'gap', label: 'Open passage' },
];

/** Small options strip floating at the top of the canvas for the active tool. */
export function ToolOptions() {
  const tool = useUi((s) => s.tool);
  const roomMode = useUi((s) => s.roomMode);
  const width = useUi((s) => s.openingWidth);
  const placing = useUi((s) => s.placing);
  const doorKind = useUi((s) => s.doorKind);
  const windowKind = useUi((s) => s.windowKind);
  const wallType = useUi((s) => s.wallType);
  const wallMode = useUi((s) => s.wallMode);
  const wallRoom = useUi((s) => s.wallRoom);
  const stairKind = useUi((s) => s.stairKind);
  const roofKind = useUi((s) => s.roofKind);
  const paintFinish = useUi((s) => s.paintFinish);
  const skylightSize = useUi((s) => s.skylightSize);
  const paintColor = useUi((s) => s.paintColor);
  const zoneKind = useUi((s) => s.zoneKind);
  const zoneShape = useUi((s) => s.zoneShape);
  const stripKind = useUi((s) => s.stripKind);
  const stripWidth = useUi((s) => s.stripWidth);
  const thickness = useDesign((s) => s.design.settings.wallThickness);

  let body = null;
  if (tool === 'wall') {
    body = (
      <>
        <div className="segmented" role="group" aria-label="Wall mode">
          <button className={wallMode === 'line' ? 'active' : ''} onClick={() => useUi.getState().setWallMode('line')} title="Click each corner" data-testid="wall-mode-line">
            One by one
          </button>
          <button className={wallMode === 'rect' ? 'active' : ''} onClick={() => useUi.getState().setWallMode('rect')} title="Drag from one corner to the opposite one: four walls at once" data-testid="wall-mode-rect">
            Rectangle
          </button>
        </div>
        {wallMode === 'rect' && (
          <label className="check" title="Also create the room inside the walls">
            <input type="checkbox" checked={wallRoom} onChange={(e) => useUi.getState().setWallRoom(e.target.checked)} data-testid="wall-rect-room" />
            with room
          </label>
        )}
        <div className="segmented" role="group" aria-label="Wall type">
          {WALL_TYPES.map((t) => (
            <button
              key={t}
              className={wallType === t ? 'active' : ''}
              data-testid={`wall-type-${t}`}
              title={WALL_STYLE[t].hint}
              onClick={() => {
                useUi.getState().setWallType(t);
                useDesign.getState().update((d) => void (d.settings.wallThickness = WALL_TYPE_THICKNESS[t])); // each type has its usual thickness
              }}
            >
              {WALL_STYLE[t].label}
            </button>
          ))}
        </div>
        <NumberField
          label="Wall thickness"
          value={thickness}
          scale={100}
          unit="cm"
          min={2}
          max={100}
          testId="opt-thickness"
          onCommit={(v) => useDesign.getState().update((d) => void (d.settings.wallThickness = v))}
        />
      </>
    );
  } else if (tool === 'door' || tool === 'window') {
    const kind: OpeningKind = tool === 'door' ? doorKind : windowKind;
    body = (
      <>
        {tool === 'door' && (
          <div className="segmented" role="group" aria-label="Door type">
            {DOOR_KINDS.map((k) => (
              <button key={k.kind} className={doorKind === k.kind ? 'active' : ''} onClick={() => useUi.getState().setDoorKind(k.kind)} data-testid={`door-kind-${k.kind}`}>
                {k.label}
              </button>
            ))}
          </div>
        )}
        {tool === 'window' && (
          <div className="segmented" role="group" aria-label="Window type">
            <button className={windowKind === 'window' ? 'active' : ''} onClick={() => useUi.getState().setWindowKind('window')} data-testid="window-kind-window">
              Window
            </button>
            <button className={windowKind === 'bay' ? 'active' : ''} onClick={() => useUi.getState().setWindowKind('bay')} data-testid="window-kind-bay">
              Bay window
            </button>
          </div>
        )}
        <NumberField
          label="Width"
          value={width[kind]}
          scale={100}
          unit="cm"
          min={30}
          max={800}
          testId="opt-opening-width"
          onCommit={(v) => useUi.getState().setOpeningWidth(kind, v)}
        />
      </>
    );
  } else if (tool === 'room') {
    body = (
      <>
        <div className="segmented" role="group" aria-label="Room mode">
          <button className={roomMode === 'auto' ? 'active' : ''} onClick={() => useUi.getState().setRoomMode('auto')} data-testid="room-auto">
            Click inside walls
          </button>
          <button className={roomMode === 'box' ? 'active' : ''} onClick={() => useUi.getState().setRoomMode('box')} title="Drag a box: a room without walls" data-testid="room-box">
            Drag a box
          </button>
          <button className={roomMode === 'draw' ? 'active' : ''} onClick={() => useUi.getState().setRoomMode('draw')} data-testid="room-draw">
            Draw corners
          </button>
        </div>
      </>
    );
  }
  else if (tool === 'stairs') {
    body = (
      <div className="segmented" role="group" aria-label="Stair type">
        {STAIR_KINDS.map((k) => (
          <button key={k} className={stairKind === k ? 'active' : ''} onClick={() => useUi.getState().setStairKind(k)} data-testid={`stair-kind-${k}`}>
            {STAIR_DEFAULTS[k].label}
          </button>
        ))}
      </div>
    );
  } else if (tool === 'skylight') {
    body = (
      <div className="segmented" role="group" aria-label="Skylight size">
        {SKYLIGHT_SIZES.map((s, i) => (
          <button key={s.label} className={skylightSize === i ? 'active' : ''} onClick={() => useUi.getState().setSkylightSize(i)} title={`${Math.round(s.w * 100)} × ${Math.round(s.d * 100)} cm`} data-testid={`skylight-size-${i}`}>
            {s.label}
          </button>
        ))}
      </div>
    );
  } else if (tool === 'paint') {
    body = (
      <>
        <select value={paintFinish} aria-label="Covering" data-testid="paint-finish" onChange={(e) => useUi.getState().setPaint(e.target.value as WallFinish | 'clear', FINISH_STYLES[e.target.value as WallFinish]?.color)}>
          {WALL_FINISHES.map((f) => (
            <option key={f} value={f}>
              {FINISH_STYLES[f].label}
            </option>
          ))}
          <option value="clear">Remove covering</option>
        </select>
        {paintFinish !== 'clear' && (
          <div className="swatches" role="group" aria-label="Color">
            {PAINT_COLORS.map((c) => (
              <button key={c} className={`swatch ${c === paintColor ? 'on' : ''}`} style={{ background: c }} aria-label={`Color ${c}`} data-testid={`paint-color-${c}`} onClick={() => useUi.getState().setPaint(paintFinish, c)} />
            ))}
          </div>
        )}
      </>
    );
  } else if (tool === 'roof') {
    body = (
      <>
        <select value={roofKind} aria-label="Roof type" data-testid="roof-tool-kind" onChange={(e) => useUi.getState().setRoofKind(e.target.value as RoofKind)}>
          {ROOF_KINDS.map((k) => (
            <option key={k} value={k} title={ROOF_STYLES[k].hint}>
              {ROOF_STYLES[k].label}
            </option>
          ))}
        </select>
        <button onClick={() => addRoofFromWalls(roofKind)} title="A roof that covers the walls of this floor" data-testid="roof-fit-walls">
          Fit to walls
        </button>
      </>
    );
  } else if (tool === 'zone') {
    body = (
      <>
        <strong>{ZONE_STYLES[zoneKind].label}</strong>
        <div className="segmented" role="group" aria-label="Area shape">
          <button className={zoneShape === 'rect' ? 'active' : ''} onClick={() => useUi.getState().setZoneShape('rect')} data-testid="zone-rect">
            Rectangle
          </button>
          <button className={zoneShape === 'poly' ? 'active' : ''} onClick={() => useUi.getState().setZoneShape('poly')} data-testid="zone-poly">
            Polygon
          </button>
        </div>
      </>
    );
  } else if (tool === 'strip') {
    body = (
      <>
        <strong>{STRIP_STYLES[stripKind].label}</strong>
        <NumberField
          label="Width"
          value={stripWidth[stripKind]}
          scale={100}
          unit="cm"
          min={2}
          max={5000}
          testId="opt-strip-width"
          onCommit={(v) => useUi.getState().setStripWidth(stripKind, v)}
        />
      </>
    );
  } else if (tool === 'furniture' && placing) {
    body = (
      <span className="muted">
        Placing <strong>{catalogItem(placing).label}</strong> · click to drop · R rotates · Shift+click for several · Esc to stop
      </span>
    );
  }
  if (!body) return null;
  return <div className="tool-options">{body}</div>;
}
