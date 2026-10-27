import { useRef, useState } from 'react';
import { mirrorFloor, scaleActiveFloor } from '../actions';
import { calibrateTrace, pictureToDataUrl, removeTraceImage, saveTraceImage } from '../trace';
import { useDesign } from '../store/design';
import { useFloorId } from '../store/floor';
import { useUi } from '../store/ui';
import { NumberField } from './fields';

/** What you can do to a whole floor: turn it over, change its size, trace a picture on it. */
export function FloorTools() {
  const floor = useFloorId();
  const designId = useDesign((s) => s.design.id);
  const trace = useDesign((s) => s.design.floors.find((f) => f.id === floor)?.trace);
  const moving = useUi((s) => s.traceMove);
  const selection = useUi((s) => s.selection);
  const dimension = useDesign((s) => (selection?.kind === 'dimension' ? s.design.dimensions.find((m) => m.id === selection.id) : undefined));
  const [percent, setPercent] = useState(100);
  const [known, setKnown] = useState(1);
  const file = useRef<HTMLInputElement>(null);
  const editTrace = (fn: (t: NonNullable<typeof trace>) => void) =>
    useDesign.getState().update((d) => {
      const f = d.floors.find((x) => x.id === floor);
      if (f?.trace) fn(f.trace);
    });

  const choose = async (picked: File) => {
    try {
      const { url } = await pictureToDataUrl(picked);
      if (!saveTraceImage(designId, floor, url)) return useUi.getState().showToast('The picture is too big to keep in this browser. Try a smaller one.');
      const ui = useUi.getState();
      const v = ui.viewport;
      const cx = (ui.canvasSize.w / 2 - v.x) / v.zoom;
      const cy = (ui.canvasSize.h / 2 - v.y) / v.zoom;
      useDesign.getState().update((d) => {
        const f = d.floors.find((x) => x.id === floor);
        if (f) f.trace = { x: cx, y: cy, w: Math.max(2, (ui.canvasSize.w / v.zoom) * 0.8), rotation: 0, opacity: 0.5, visible: true };
      });
      ui.bumpTrace();
      ui.showToast('Now give the picture its real size: draw a measurement over something of known length, select it, and use "Make it ... long" below.');
    } catch (err) {
      useUi.getState().showToast((err as Error).message);
    }
  };

  return (
    <div className="floor-tools" data-testid="floor-tools">
      <div className="row">
        <button onClick={() => mirrorFloor('x')} title="Turn everything on this floor over, left to right" data-testid="mirror-floor-x">
          Mirror floor ⇆
        </button>
        <button onClick={() => mirrorFloor('y')} title="Turn everything on this floor over, top to bottom" data-testid="mirror-floor-y">
          Mirror floor ⇅
        </button>
      </div>
      <div className="row">
        <NumberField label="Scale this floor" value={percent} unit="%" min={10} max={1000} testId="scale-percent" onCommit={setPercent} />
        <button
          onClick={() => {
            if (!scaleActiveFloor(percent / 100)) useUi.getState().showToast('Choose a size other than 100 %.');
            else setPercent(100);
          }}
          title="Move everything on this floor apart (or together) by this much; furniture and wall thickness keep their size"
          data-testid="scale-floor"
        >
          Scale
        </button>
      </div>
      {!trace ? (
        <button onClick={() => file.current?.click()} title="Put a scan or photo of a plan under the drawing and trace it" data-testid="trace-add">
          Trace a picture…
        </button>
      ) : (
        <div className="trace-box" data-testid="trace-box">
          <label className="check">
            <input type="checkbox" checked={trace.visible} onChange={(e) => editTrace((t) => void (t.visible = e.target.checked))} data-testid="trace-visible" />
            Show the traced picture
          </label>
          <label className="field">
            <span>See-through: {Math.round(trace.opacity * 100)} %</span>
            <input type="range" min={10} max={100} value={Math.round(trace.opacity * 100)} onChange={(e) => editTrace((t) => void (t.opacity = Number(e.target.value) / 100))} data-testid="trace-opacity" />
          </label>
          <div className="row two">
            <NumberField label="Width" value={trace.w} scale={100} unit="cm" min={10} max={50000} testId="trace-width" onCommit={(v) => editTrace((t) => void (t.w = v))} />
            <NumberField label="Turn" value={trace.rotation} unit="°" testId="trace-rotation" onCommit={(v) => editTrace((t) => void (t.rotation = v))} />
          </div>
          <div className="row">
            <button className={moving ? 'active' : ''} onClick={() => useUi.getState().setTraceMove(!moving)} aria-pressed={moving} title="Drag the picture to where it belongs" data-testid="trace-move">
              {moving ? 'Done moving' : 'Move the picture'}
            </button>
            <button
              onClick={() => {
                removeTraceImage(designId, floor);
                useDesign.getState().update((d) => {
                  const f = d.floors.find((x) => x.id === floor);
                  if (f) delete f.trace;
                });
                useUi.getState().setTraceMove(false);
                useUi.getState().bumpTrace();
              }}
              data-testid="trace-remove"
            >
              Remove
            </button>
          </div>
          <div className="row">
            <NumberField label="Make the selected measurement" value={known} unit="m" min={0.1} max={1000} testId="trace-known" onCommit={setKnown} />
            <button
              disabled={!dimension}
              onClick={() => {
                if (!dimension) return;
                const next = calibrateTrace(trace, dimension.a, dimension.b, known);
                if (next) editTrace((t) => void Object.assign(t, next));
              }}
              title={dimension ? 'Scale the picture so that the selected measurement is this long' : 'First draw a measurement over something of known length in the picture and select it'}
              data-testid="trace-calibrate"
            >
              This long
            </button>
          </div>
        </div>
      )}
      <input
        ref={file}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        data-testid="trace-file"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void choose(f);
        }}
      />
    </div>
  );
}
