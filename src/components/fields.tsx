import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n';

/** A numeric input that commits on Enter/blur, so typing "250" is one undo step, not three. */
export function NumberField({
  label,
  value,
  onCommit,
  scale = 1,
  unit,
  min = -1e9,
  max = 1e9,
  testId,
}: {
  label: string;
  /** Value in model units (e.g. meters). */
  value: number;
  onCommit: (v: number) => void;
  /** Multiplier from model units to displayed units (100 for m→cm). */
  scale?: number;
  unit?: string;
  min?: number;
  max?: number;
  testId?: string;
}) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? String(Math.round(value * scale * 10) / 10);
  const commit = () => {
    if (text === null) return;
    const v = Number(text);
    setText(null);
    if (Number.isFinite(v) && text.trim() !== '') onCommit(Math.min(max, Math.max(min, v)) / scale);
  };
  return (
    <label className="field">
      <span>{label}</span>
      <span className="field-input">
        <input
          type="number"
          value={shown}
          data-testid={testId}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
        {unit && <em>{unit}</em>}
      </span>
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
  testId,
  multiline,
  placeholder,
  focusSignal,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  testId?: string;
  multiline?: boolean;
  placeholder?: string;
  /** When this number changes (and is > 0) the field takes focus and selects its text. */
  focusSignal?: number;
}) {
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!focusSignal) return;
    // Deferred: the mouse press that created the item would otherwise take focus back.
    const t = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 30);
    return () => clearTimeout(t);
  }, [focusSignal]);
  return (
    <label className="field">
      <span>{label}</span>
      {multiline ? (
        <textarea ref={inputRef} value={value} rows={2} placeholder={placeholder} data-testid={testId} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input ref={inputRef} type="text" value={value} placeholder={placeholder} data-testid={testId} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

export function ColorField({
  label,
  value,
  swatches,
  onChange,
}: {
  label: string;
  value: string;
  swatches: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="swatches">
        {swatches.map((c) => (
          <button
            key={c}
            className={`swatch ${c.toLowerCase() === value.toLowerCase() ? 'on' : ''}`}
            style={{ background: c }}
            title={c}
            aria-label={t('Color {c}', { c })}
            onClick={() => onChange(c)}
          />
        ))}
        <input
          type="color"
          className="color-input"
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#cccccc'}
          aria-label={t('Custom color')}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}
