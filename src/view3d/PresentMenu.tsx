import { useEffect, useRef, useState } from 'react';
import { newId, type Design } from '../model';
import { download } from '../session';
import { fileNameFor } from '../share';
import { useDesign } from '../store/design';
import { floorIdOf } from '../store/floor';
import { useUi } from '../store/ui';
import { floorBall, floorSheet } from './sheet';
import { sceneOptions } from './options';
import type { Scene3D } from './scene';
import { t } from '../i18n';

/** Ways of showing the house: a dollhouse of each floor, the floors pulled apart, camera positions you can come back to, a picture of every floor. */
export function PresentMenu({ scene, design }: { scene: Scene3D | null; design: Design }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const dollhouse = useUi((s) => s.dollhouse);
  const explode = useUi((s) => s.explode3d);
  const ui = useUi.getState();
  const multi = design.floors.length > 1;

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  const showDollhouse = (floor: string) => {
    const ball = floorBall(design, floor);
    ui.setDollhouse(floor);
    if (ball) scene?.frameBall(ball.c, ball.radius);
  };

  const setExplode = (v: number) => {
    // the first pull: step back so that the whole stack is in the picture
    if (explode === 0 && v > 0) scene?.frameStack((design.floors.length - 1) * (design.settings.storeyHeight + 3));
    ui.setExplode3d(v);
  };

  const saveView = () => {
    if (!scene) return;
    const v = scene.getView();
    useDesign.getState().update((d) => void d.views.push({ id: newId(), name: t('View {value}', { value: d.views.length + 1 }), pos: v.pos, target: v.target }));
  };
  const rename = (id: string, name: string) => useDesign.getState().update((d) => void (d.views.find((x) => x.id === id)!.name = name.trim() || 'View'));
  const remove = (id: string) => useDesign.getState().update((d) => void (d.views = d.views.filter((x) => x.id !== id)));
  const goTo = (id: string) => {
    const v = design.views.find((x) => x.id === id);
    if (!v || !scene) return;
    ui.setWalking(false);
    scene.setView(v.pos, v.target);
  };

  const saveSheet = async () => {
    if (!scene || busy) return;
    setBusy(true);
    try {
      const now = () => useUi.getState();
      const active = () => floorIdOf(design, now().activeFloor);
      const blob = await floorSheet(
        scene,
        design,
        (floor) => sceneOptions(design, active(), { ...now(), dollhouse: floor, explode3d: 0, walking: false }),
        () => scene.setDesign(design, sceneOptions(design, active(), now())),
      );
      if (blob) download(blob, fileNameFor({ ...design, name: t('{name} floors', { name: design.name }) }, 'png'));
      else useUi.getState().showToast(t('There is nothing to take a picture of yet.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="present" ref={box}>
      <button className={open || dollhouse || explode > 0 ? 'active' : ''} onClick={() => setOpen(!open)} aria-expanded={open} title={t('Dollhouse, exploded floors and saved views')} data-testid="present-button">
        {t('Present ▾')}
      </button>
      {open && (
        <div className="present-pop" data-testid="present-menu">
          <h4>{t('Dollhouse')}</h4>
          <p className="muted">{t('One floor seen from above with its walls cut low, so you look into the rooms.')}</p>
          <div className="present-row">
            {[...design.floors].reverse().map((f) => (
              <button key={f.id} className={dollhouse === f.id ? 'active' : ''} onClick={() => showDollhouse(f.id)} data-testid={`dollhouse-${f.name}`}>
                {t(f.name)}
              </button>
            ))}
            {dollhouse && (
              <button onClick={() => ui.setDollhouse(null)} data-testid="dollhouse-off">
                {t('Whole house')}
              </button>
            )}
          </div>
          <button disabled={busy} onClick={() => void saveSheet()} title={t('One picture with every floor as a dollhouse')} data-testid="floor-sheet">
            {busy ? t('Taking pictures…') : t('Save a picture of every floor')}
          </button>
          {multi && (
            <>
              <h4>{t('Exploded')}</h4>
              <label className="present-slider">
                <input type="range" min={0} max={6} step={0.25} value={explode} onChange={(e) => setExplode(Number(e.target.value))} aria-label={t('Pull the floors apart')} data-testid="explode-slider" />
                <span data-testid="explode-value">{explode === 0 ? t('Together') : t('{value} m apart', { value: explode.toFixed(2).replace(/\.?0+$/, '') })}</span>
              </label>
            </>
          )}
          <h4>{t('Saved views')}</h4>
          {design.views.length === 0 && <p className="muted">{t('Turn the house the way you like and save the camera here. The views travel with the link.')}</p>}
          <ul className="present-views">
            {design.views.map((v) => (
              <li key={v.id}>
                <button onClick={() => goTo(v.id)} title={t('Go to this view')} data-testid={`view-go-${v.name}`}>
                  ➜
                </button>
                <input defaultValue={v.name} key={v.name} aria-label={t('Name of the view')} data-testid="view-name" onBlur={(e) => e.target.value !== v.name && rename(v.id, e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
                <button onClick={() => remove(v.id)} title={t('Delete this view')} aria-label={t('Delete {name}', { name: v.name })} data-testid={`view-delete-${v.name}`}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <button onClick={saveView} data-testid="view-save-camera">
            {t('Save this view')}
          </button>
        </div>
      )}
    </div>
  );
}
