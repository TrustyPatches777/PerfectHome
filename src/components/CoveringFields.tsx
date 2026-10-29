import { useRef } from 'react';
import { newId, type Room, type WallSkin } from '../model';
import { WALL_PATTERNS, SECOND_COLOR_LABEL, forgetTexture, hasTexture, saveTexture } from '../paintSpec';
import { PAINT_COLORS } from '../walls';
import { pictureToDataUrl } from '../trace';
import { useUi } from '../store/ui';
import { ColorField } from './fields';
import { t } from '../i18n';

/** Choose a picture from the computer to cover a wall or a floor with. It is kept in this browser (not in a shared link). */
export function PictureField({ texture, onChange, testId }: { texture?: string; onChange: (id: string | undefined) => void; testId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const have = !!texture && hasTexture(texture);
  const choose = async (file: File) => {
    try {
      const { url } = await pictureToDataUrl(file, 512);
      const id = newId();
      if (!saveTexture(id, url)) return useUi.getState().showToast(t('The picture is too big to keep in this browser. Try a smaller one.'));
      forgetTexture(id);
      onChange(id);
      useUi.getState().bumpTextures();
    } catch (err) {
      useUi.getState().showToast((err as Error).message);
    }
  };
  return (
    <div className="field">
      <span>{t('Your picture')}</span>
      <div className="row">
        <button onClick={() => input.current?.click()} data-testid={`${testId}-choose`}>
          {have ? t('Choose another…') : t('Choose a picture…')}
        </button>
        {texture && (
          <button onClick={() => onChange(undefined)} data-testid={`${testId}-remove`}>
            {t('Remove')}
          </button>
        )}
      </div>
      {texture && !have && <p className="notice">{t('This picture is not on this computer (pictures stay in the browser they were added in), so the plain color shows.')}</p>}
      <p className="muted">{t('The picture repeats over about a meter. It stays in this browser: someone you share the design with sees the plain color.')}</p>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        data-testid={`${testId}-file`}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void choose(f);
        }}
      />
    </div>
  );
}

const WALL_SECOND = ['#ffffff', '#f5f0e6', '#9ca3af', '#6b7280', '#374151', '#1f2937', '#b5603f', '#c9a24a'];

/** What else a wall covering has: its pattern, its second color (grout, wallpaper ink) and, for 'Your own picture', the picture. */
export function SkinExtras({ skin, edit, side }: { skin: WallSkin; edit: (fn: (s: WallSkin) => void) => void; side: string }) {
  const patterns = WALL_PATTERNS[skin.finish];
  const second = SECOND_COLOR_LABEL[skin.finish];
  return (
    <>
      {patterns && (
        <label className="field">
          <span>{skin.finish === 'wallpaper' ? t('Pattern') : t('Layout')}</span>
          <select value={skin.pattern ?? patterns[0].id} data-testid={`wall-pattern-${side}`} onChange={(e) => edit((s) => void (s.pattern = e.target.value))}>
            {patterns.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {second && <ColorField label={second} value={skin.grout ?? '#9ca3af'} swatches={skin.finish === 'wallpaper' ? PAINT_COLORS : WALL_SECOND} onChange={(c) => edit((s) => void (s.grout = c))} />}
      {second && skin.grout && (
        <button onClick={() => edit((s) => void delete s.grout)} data-testid={`wall-grout-reset-${side}`}>
          {t('Use the usual {value}', { value: second.toLowerCase() })}
        </button>
      )}
      {skin.finish === 'custom' && <PictureField texture={skin.texture} testId={`wall-picture-${side}`} onChange={(id) => edit((s) => (id ? void (s.texture = id) : void delete s.texture))} />}
    </>
  );
}

const GROUT_MATERIALS: Partial<Record<Room['material'], string>> = { tile: 'Grout', subway: 'Grout', marble: 'Joints between slabs', herringbone: 'Joints', checker: 'Second color' };

/** The grout (second color) of a tiled floor and the picture of a floor of 'Your own picture'. */
export function FloorExtras({ room, edit }: { room: Room; edit: (fn: (r: Room) => void) => void }) {
  const label = GROUT_MATERIALS[room.material];
  return (
    <>
      {label && <ColorField label={label} value={room.grout ?? '#9ca3af'} swatches={WALL_SECOND} onChange={(c) => edit((r) => void (r.grout = c))} />}
      {label && room.grout && (
        <button onClick={() => edit((r) => void delete r.grout)} data-testid="floor-grout-reset">
          {t('Use the usual {value}', { value: label.toLowerCase() })}
        </button>
      )}
      {room.material === 'custom' && <PictureField texture={room.texture} testId="floor-picture" onChange={(id) => edit((r) => (id ? void (r.texture = id) : void delete r.texture))} />}
    </>
  );
}
