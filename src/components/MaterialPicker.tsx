import { FLOOR_MATERIALS, type FloorMaterial } from '../model';
import { patternFor, type PatternKind } from '../patterns';

export const MATERIAL_LABELS: Record<FloorMaterial, string> = {
  plain: 'Plain color',
  wood: 'Wood planks',
  parquet: 'Parquet',
  tile: 'Tiles',
  carpet: 'Carpet',
  stone: 'Stone slabs',
  concrete: 'Concrete',
  marble: 'Marble',
  herringbone: 'Herringbone wood',
  checker: 'Checkerboard',
  subway: 'Brick-bond tiles',
  custom: 'Your own picture',
};

/** A good starting color for each material (used when the room still has one of the default pastel colors). */
export const MATERIAL_COLORS: Record<Exclude<FloorMaterial, 'plain'>, string> = {
  wood: '#c9a27a',
  parquet: '#b88a5a',
  tile: '#d6dde2',
  carpet: '#b9a7c9',
  stone: '#b8b3a7',
  concrete: '#c9ccd1',
  marble: '#e9e6e1',
  herringbone: '#b58a5c',
  checker: '#f1efe9',
  subway: '#e4e8ea',
  custom: '#d8d3c8',
};

/** Buttons that show what each floor material looks like in the room's color. */
export function MaterialPicker({ value, color, onChange }: { value: FloorMaterial; color: string; onChange: (m: FloorMaterial) => void }) {
  return (
    <div className="field">
      <span>Floor material</span>
      <div className="materials" role="group" aria-label="Floor material">
        {FLOOR_MATERIALS.map((m) => {
          const p = m === 'plain' ? null : patternFor(m as PatternKind, color);
          return (
            <button
              key={m}
              className={`material ${m === value ? 'on' : ''}`}
              title={MATERIAL_LABELS[m]}
              aria-label={MATERIAL_LABELS[m]}
              aria-pressed={m === value}
              data-testid={`material-${m}`}
              onClick={() => onChange(m)}
              style={p ? { backgroundImage: `url(${p.image.toDataURL()})`, backgroundSize: `${38}px` } : { background: color }}
            />
          );
        })}
      </div>
      <span className="muted">{MATERIAL_LABELS[value]}</span>
    </div>
  );
}
