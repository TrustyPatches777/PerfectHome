import { useState } from 'react';
import { deleteTemplate, loadTemplates, placeTemplate } from '../actions';
import { CATEGORIES, allCatalog, fillColor, type CatalogItem } from '../catalog';
import { useDesign } from '../store/design';
import { useUi } from '../store/ui';
import { t } from '../i18n';

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
  const custom = useDesign((s) => s.design.custom); // re-render when custom items change
  const catalog = allCatalog();
  const tool = useUi((s) => s.tool);
  const templatesVersion = useUi((s) => s.templatesVersion);
  const templates = loadTemplates();
  void templatesVersion;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set(['My items', 'Bedroom', 'Living']));
  const q = query.trim().toLowerCase();
  void custom;

  const pick = (type: string) => {
    const ui = useUi.getState();
    ui.setTool('furniture');
    ui.setPlacing(type);
  };

  return (
    <div className="palette" data-testid="palette">
      <div className="row">
        <input type="text" placeholder={t('Search…')} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t('Search furniture')} style={{ flex: 1, minWidth: 0 }} />
        <button onClick={() => useUi.getState().setDialog({ type: 'custom-item', editId: null })} title={t('Create your own piece of furniture')} data-testid="new-custom">
          {t('+ New')}
        </button>
      </div>
      {templates.length > 0 && !q && (
        <section data-testid="templates">
          <h5>{t('Templates')}</h5>
          <div className="templates">
            {templates.map((tpl) => (
              <span className="template" key={tpl.id}>
                <button onClick={() => placeTemplate(tpl.id)} title={t('Place this arrangement (click, it appears at the cursor)')} data-testid="template-place">
                  {tpl.name}
                </button>
                <button className="x" onClick={() => deleteTemplate(tpl.id)} aria-label={t('Delete the template {name}', { name: tpl.name })} title={t('Delete this template')}>
                  ✕
                </button>
              </span>
            ))}
          </div>
        </section>
      )}
      {CATEGORIES.map((cat) => {
        const items = catalog.filter((c) => c.category === cat && (!q || c.label.toLowerCase().includes(q)));
        if (!items.length) return null;
        return (
          <section key={cat}>
            <button
              className="cat-head"
              aria-expanded={!!q || open.has(cat)}
              data-testid={`cat-${cat}`}
              onClick={() => setOpen((o) => (o.has(cat) ? new Set([...o].filter((c) => c !== cat)) : new Set([...o, cat])))}
            >
              <span>{q || open.has(cat) ? '▾' : '▸'}</span> {t(cat)} <em>{items.length}</em>
            </button>
            {(q || open.has(cat)) && <div className="tiles">
              {items.map((c) => (
                <button
                  key={c.type}
                  className={`tile ${tool === 'furniture' && placing === c.type ? 'active' : ''}`}
                  onClick={() => pick(c.type)}
                  title={t('{label} · {value} × {value2} cm', { label: c.label, value: Math.round(c.w * 100), value2: Math.round(c.d * 100) })}
                  data-testid={`furn-${c.type}`}
                >
                  <span className="tile-icon">
                    <SymbolIcon item={c} />
                  </span>
                  <span className="tile-label">{c.label}</span>
                  {c.category === 'My items' && (
                    <span
                      className="tile-edit"
                      role="button"
                      aria-label={t('Edit {label}', { label: c.label })}
                      title={t('Edit this item')}
                      data-testid={`edit-${c.type}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        useUi.getState().setDialog({ type: 'custom-item', editId: c.type.slice(7) });
                      }}
                    >
                      ✎
                    </span>
                  )}
                </button>
              ))}
            </div>}
          </section>
        );
      })}
    </div>
  );
}
