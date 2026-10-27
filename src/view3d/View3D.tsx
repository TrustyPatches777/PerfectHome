import { useEffect, useRef, useState } from 'react';
import { labelPoint } from '../geometry';
import { fileNameFor } from '../share';
import { useDesign } from '../store/design';
import { floorIdOf, useFloorId } from '../store/floor';
import { useUi } from '../store/ui';
import { compassPoint, darkness, formatHour, sunPosition } from '../sun';
import { floorElevations } from './build';
import { Scene3D } from './scene';

/** The house in 3D: orbit around it, or walk through it. It only shows the design; editing happens in the plan. */
export default function View3D() {
  const host = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState<Scene3D | null>(null);
  const design = useDesign((s) => s.design);
  const floor = useFloorId();
  const cutaway = useUi((s) => s.cutaway);
  const walking = useUi((s) => s.walking);
  const shadows = useUi((s) => s.shadows3d);
  const showRoof = useUi((s) => s.showRoof3d);
  const ceilingsOn = useUi((s) => s.showCeilings3d);
  const hiddenFloors = useUi((s) => s.hiddenFloors);
  const texturesVersion = useUi((s) => s.texturesVersion);
  const invertLook = useUi((s) => s.invertLook);
  const hour = useUi((s) => s.timeOfDay);
  const playing = useUi((s) => s.sunPlaying);
  const { lat, month, day, north } = design.site;
  const elevation = floorElevations(design).get(floorIdOf(design, floor)) ?? 0;

  // create the renderer once
  useEffect(() => {
    const el = host.current!;
    const s = new Scene3D(el);
    const ro = new ResizeObserver(() => s.resize());
    ro.observe(el);
    const d = useDesign.getState().design;
    const ui = useUi.getState();
    const f = floorIdOf(d, ui.activeFloor);
    s.setDesign(d, { hideAbove: ui.cutaway ? f : null, showRoof: ui.showRoof3d, showCeilings: ui.showCeilings3d || ui.walking, hiddenFloors: ui.hiddenFloors, texVersion: ui.texturesVersion, floorElevation: floorElevations(d).get(f) ?? 0 });
    s.setSun({ sun: sunPosition(d.site.lat, d.site.month, d.site.day, ui.timeOfDay), north: d.site.north, shadows: ui.shadows3d });
    s.resetView();
    s.onFar = () => useUi.getState().showToast('Walk closer to open that door.');
    (window as unknown as { __ph3d: unknown }).__ph3d = { stats: () => s.stats(), scene: s };
    setScene(s);
    return () => {
      ro.disconnect();
      s.dispose();
      setScene(null);
    };
  }, []);

  // the design (or which floors to show) changed
  useEffect(() => {
    scene?.setDesign(design, { hideAbove: cutaway ? floor : null, showRoof, showCeilings: ceilingsOn || walking, hiddenFloors, texVersion: texturesVersion, floorElevation: elevation });
  }, [scene, design, floor, cutaway, showRoof, ceilingsOn, walking, hiddenFloors, texturesVersion, elevation]);

  // sun and time of day
  useEffect(() => {
    scene?.setSun({ sun: sunPosition(lat, month, day, hour), north, shadows });
  }, [scene, lat, month, day, hour, north, shadows]);

  // walking: start in the first room of this floor (or the middle of the plan)
  useEffect(() => {
    if (!scene) return;
    if (!walking) return scene.setMode('orbit');
    const d = useDesign.getState().design;
    const room = d.rooms.find((r) => r.floor === floor);
    const p = room ? labelPoint(room.points) : null;
    scene.setMode('walk', p ? { x: p.x, z: p.y } : undefined);
    scene.renderer.domElement.focus();
  }, [scene, walking, floor]);

  useEffect(() => {
    if (scene) scene.invertY = invertLook;
  }, [scene, invertLook]);

  // play a whole day
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const ui = useUi.getState();
      ui.setTimeOfDay((ui.timeOfDay + (now - last) / 1000) % 24);
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const ui = useUi.getState();
  const sun = sunPosition(lat, month, day, hour);
  const phase = sun.elevation > 6 ? `Sun ${Math.round(sun.elevation)}° high, from ${compassPoint(sun.azimuth)}` : sun.elevation > -6 ? (hour < 12 ? 'Sunrise' : 'Sunset') : darkness(sun.elevation) > 0.9 ? 'Night' : 'Dusk';

  const saveImage = async () => {
    const blob = await scene?.toBlob();
    if (!blob) return ui.showToast('Could not create the image.');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileNameFor({ ...design, name: `${design.name} 3d` }, 'png');
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div className="canvas-wrap view3d" data-testid="view3d">
      <div ref={host} className="view3d-host" />
      <div className="view3d-bar" data-testid="view3d-bar">
        <div className="segmented" role="group" aria-label="Camera">
          <button className={!walking ? 'active' : ''} onClick={() => ui.setWalking(false)} title="Orbit around the house" data-testid="mode-orbit">
            Orbit
          </button>
          <button className={walking ? 'active' : ''} onClick={() => ui.setWalking(true)} title="Walk through the house" data-testid="mode-walk">
            Walk
          </button>
        </div>
        <button onClick={() => (ui.setWalking(false), scene?.resetView())} title="Back to the overview" data-testid="view3d-reset">
          Overview
        </button>
        <button onClick={() => (ui.setWalking(false), scene?.topView())} title="Straight down, like the plan" data-testid="view3d-top">
          From above
        </button>
        {walking && (
          <label className="check" title="Dragging up looks down">
            <input type="checkbox" checked={invertLook} onChange={(e) => ui.setInvertLook(e.target.checked)} data-testid="view3d-invert" />
            Invert up/down
          </label>
        )}
        {design.floors.length > 1 && (
          <div className="floor-toggles" role="group" aria-label="Floors shown" data-testid="floor-toggles">
            <span className="muted">Floors</span>
            {[...design.floors].reverse().map((f) => (
              <label key={f.id} className="check" title={`Show or hide ${f.name}`}>
                <input type="checkbox" checked={!hiddenFloors.includes(f.id)} onChange={(e) => ui.setFloorShown(f.id, e.target.checked)} data-testid={`floor-shown-${f.name}`} />
                {f.name}
              </label>
            ))}
          </div>
        )}
        {design.floors.length > 1 && (
          <label className="check" title="Hide the floors above the one you are on, to see inside">
            <input type="checkbox" checked={cutaway} onChange={(e) => ui.setCutaway(e.target.checked)} data-testid="view3d-cutaway" />
            Hide upper floors
          </label>
        )}
        {design.roofs.length > 0 && (
          <label className="check">
            <input type="checkbox" checked={showRoof} onChange={(e) => ui.setShowRoof3d(e.target.checked)} data-testid="view3d-roof" />
            Roof
          </label>
        )}
        <label className="check" title="Draw the ceilings (from above they hide the rooms; while walking they are always there)">
          <input type="checkbox" checked={ceilingsOn || walking} disabled={walking} onChange={(e) => ui.setShowCeilings3d(e.target.checked)} data-testid="view3d-ceilings" />
          Ceilings
        </label>
        <label className="check">
          <input type="checkbox" checked={shadows} onChange={(e) => ui.setShadows3d(e.target.checked)} data-testid="view3d-shadows" />
          Shadows
        </label>
        <button onClick={() => void saveImage()} title="Save what you see as a picture" data-testid="view3d-save">
          Save image
        </button>
      </div>
      <div className="view3d-time" data-testid="view3d-time">
        <button onClick={() => ui.setSunPlaying(!playing)} title={playing ? 'Pause' : 'Play a whole day'} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? '❚❚' : '▶'}
        </button>
        <strong data-testid="view3d-clock">{formatHour(hour)}</strong>
        <input type="range" min={0} max={24} step={0.05} value={hour} onChange={(e) => ui.setTimeOfDay(Number(e.target.value))} aria-label="Time of day" data-testid="view3d-slider" />
        <span className="muted">{phase}</span>
      </div>
      <div className="view3d-hint">{walking ? 'Drag to look around · W A S D to walk, arrow keys to walk and turn · click a door to open or close it · Shift = faster · Esc to stop' : 'Drag to turn · right-drag to move · wheel to zoom · click a door to open it · 2 = back to the plan'}</div>
    </div>
  );
}
