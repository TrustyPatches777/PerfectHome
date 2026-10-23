import { useState } from 'react';
import { CATALOG, CATEGORIES, fillColor, type CatalogItem } from '../catalog';
import { useUi } from '../store/ui';

/** SVG thumbnail of a catalog item, drawn from the same shapes the canvas uses. */
export function SymbolIcon({ item, size = 44 }: { item: CatalogItem; size?: number }) {
  const w = item.w;
  const d = item.d;
  const scale = size / Math.max(w, d);
  const m = Math.min(w, d);
  const common = { stroke: '#475569', strokeWidth: 1, vectorEffect: 'non-scaling-stroke' as const };
  return (
    <svg width={w * scale} height={d * scale} viewBox={`0 0 ${w} ${d}`} aria-hidden>
      {item.shapes.map((p, i) => {
        if (p.t === 'rect')
          return <rect key={i} x={p.x * w} y={p.y * d} width={p.w * w} height={p.h * d} rx={(p.r ?? 0) * m} fill={fillColor(p.fill, item.color)} {...common} />;
        if (p.t === 'ellipse')
          return <ellipse key={i} cx={(p.x + p.w / 2) * w} cy={(p.y + p.h / 2) * d} rx={(p.w / 2) * w} ry={(p.h / 2) * d} fill={fillColor(p.fill, item.color)} {...common} />;
        const pts = p.pts.map((v, j) => (j % 2 ? v * d : v * w));
        return <polyline key={i} points={pts.join(' ')} fill="none" {...common} />;
      })}
    </svg>
  );
}

export function FurniturePalette() {
  const placing = useUi((s) => s.placing);
  const tool = useUi((s) => s.tool);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const pick = (type: string) => {
    const ui = useUi.getState();
    ui.setTool('furniture');
    ui.setPlacing(type);
  };

  return (
    <div className="palette" data-testid="palette">
      <h4>Furniture</h4>
      <input type="text" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search furniture" />
      {CATEGORIES.map((cat) => {
        const items = CATALOG.filter((c) => c.category === cat && (!q || c.label.toLowerCase().includes(q)));
        if (!items.length) return null;
        return (
          <section key={cat}>
            <h5>{cat}</h5>
            <div className="tiles">
              {items.map((c) => (
                <button
                  key={c.type}
                  className={`tile ${tool === 'furniture' && placing === c.type ? 'active' : ''}`}
                  onClick={() => pick(c.type)}
                  title={`${c.label} · ${Math.round(c.w * 100)} × ${Math.round(c.d * 100)} cm`}
                  data-testid={`furn-${c.type}`}
                >
                  <span className="tile-icon">
                    <SymbolIcon item={c} />
                  </span>
                  <span className="tile-label">{c.label}</span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
