import type { ReactNode } from 'react';
import { FURNITURE_DRAWINGS, LABEL_FONTS, LABEL_SIZES, LINE_WEIGHTS, PLAN_PRESETS, ROOM_FILLS, ROOM_LABELS, WALL_DRAWINGS, type PlanStyle } from '../model';
import { PRESET_HINT, PRESET_LABEL, normalizeStyle, presetDefault } from '../planStyle';
import { useDesign } from '../store/design';
import { t, localize } from '../i18n';

type Key = Exclude<keyof PlanStyle, 'preset'>;

const CHOICES: { key: Key; label: string; values: readonly string[]; names: Record<string, string> }[] = [
  { key: 'walls', label: 'Walls', values: WALL_DRAWINGS, names: { solid: 'Solid', hatch: 'Hatched', outline: 'Outline only' } },
  { key: 'rooms', label: 'Floors', values: ROOM_FILLS, names: { material: 'Their material', tint: 'Pale tint', none: 'Empty' } },
  { key: 'furniture', label: 'Furniture', values: FURNITURE_DRAWINGS, names: { colour: 'In colour', plain: 'Plain grey', outline: 'Outline only' } },
  { key: 'lines', label: 'Line weight', values: LINE_WEIGHTS, names: { fine: 'Fine', normal: 'Normal', heavy: 'Heavy' } },
  { key: 'labels', label: 'Room labels', values: ROOM_LABELS, names: { full: 'Name and area', name: 'Name only', none: 'None' } },
  { key: 'font', label: 'Lettering', values: LABEL_FONTS, names: { sans: 'Sans-serif', serif: 'Serif', mono: 'Typewriter' } },
  { key: 'labelSize', label: 'Label size', values: LABEL_SIZES, names: { small: 'Small', normal: 'Normal', large: 'Large' } },
];
localize(CHOICES, ['label']);
CHOICES.forEach((c) => localize(c.names, '*'));

const SWATCH: Record<string, [string, string]> = { colour: ['#e9d8b8', '#3b4252'], architectural: ['#ffffff', '#111111'], blueprint: ['#1b4b8f', '#ffffff'] };

/** How the plan is drawn: a preset (colour, architectural black and white, blueprint) and the choices that go with it. It travels in the link and shows in exports and prints. */
export function PlanStylePanel(): ReactNode {
  const style = useDesign((s) => s.design.style);
  const preset = style?.preset ?? 'colour';
  const edit = (next: PlanStyle) =>
    useDesign.getState().update((d) => {
      const n = normalizeStyle(next);
      if (n) d.style = n;
      else delete d.style;
    });
  return (
    <details className="panel style-panel" data-testid="style-panel">
      <summary>
        <h3 style={{ display: 'inline' }}>{t('Plan style')}</h3>
      </summary>
      <div className="style-presets" role="group" aria-label={t('Plan style')}>
        {PLAN_PRESETS.map((p) => (
          <button key={p} className={preset === p ? 'active' : ''} title={PRESET_HINT[p]} onClick={() => edit({ preset: p })} data-testid={`style-${p}`}>
            <span className="swatch" style={{ background: SWATCH[p][0], color: SWATCH[p][1] }} />
            {PRESET_LABEL[p]}
          </button>
        ))}
      </div>
      <p className="muted">{PRESET_HINT[preset]}</p>
      {CHOICES.map((c) => (
        <label key={c.key} className="field">
          <span>{c.label}</span>
          <select value={style?.[c.key] ?? presetDefault(preset, c.key)} data-testid={`style-${c.key}`} onChange={(e) => edit({ preset, ...style, [c.key]: e.target.value })}>
            {c.values.map((v) => (
              <option key={v} value={v}>
                {c.names[v]}
              </option>
            ))}
          </select>
        </label>
      ))}
      {style && Object.keys(style).length > 1 && (
        <button onClick={() => edit({ preset })} data-testid="style-reset">
          {t('Back to what {value} does', { value: PRESET_LABEL[preset] })}
        </button>
      )}
    </details>
  );
}
