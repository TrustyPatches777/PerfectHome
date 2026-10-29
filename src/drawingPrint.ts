/**
 * An elevation or a section on a sheet of paper at a true scale: the same paper sizes, margins and title block as the plan printout
 * (printLayout.ts). Pure, so it can be tested without a printer.
 */
import type { Design } from './model';
import { PAPERS, SCALES, MARGIN_MM, TITLE_MM, esc, mm, pageCss, paperSize, titleBlock, type DrawingOptions } from './printLayout';
import { prepareDrawing, renderDrawing, type DrawingSpec, type Prepared, type Side } from './section';
import { localeOf } from './i18n';

const SIDES = new Set(['N', 'E', 'S', 'W']);

/** What to draw for the chosen view: an elevation for a side, a section for a section line (the first one if the id is gone), else the south elevation. */
export function specFor(d: Design, o: Pick<DrawingOptions, 'view' | 'furniture' | 'colour'>): DrawingSpec {
  const base = { furniture: o.furniture, colour: o.colour };
  if (SIDES.has(o.view)) return { kind: 'elevation', side: o.view as Side, ...base };
  const line = d.sections.find((s) => s.id === o.view);
  return line ? { kind: 'section', line, ...base } : { kind: 'elevation', side: 'S', ...base };
}

export interface DrawingLayout {
  /** The HTML document, or null when there is nothing to draw. */
  html: string | null;
  /** The scale used (the number after "1:"). */
  scale: number;
  /** Size of the drawing on the paper in mm at that scale. */
  widthMm: number;
  heightMm: number;
  fits: boolean;
  paperMm: { w: number; h: number };
  availableMm: { w: number; h: number };
}

/** The smallest standard scale at which the drawing fits the space on the page. */
export function fitDrawingScale(p: Prepared, avail: { w: number; h: number }): number {
  for (const s of SCALES) {
    const r = renderDrawing(p, s);
    if ((r.width * 1000) / s <= avail.w + 0.01 && (r.height * 1000) / s <= avail.h + 0.01) return s;
  }
  return SCALES[SCALES.length - 1];
}

export function buildDrawingLayout(d: Design, spec: DrawingSpec, opts: Pick<DrawingOptions, 'paper' | 'landscape' | 'scale'>, now = new Date(), prepared?: Prepared | null): DrawingLayout {
  const paperMm = paperSize(opts);
  const availableMm = { w: paperMm.w - 2 * MARGIN_MM, h: paperMm.h - 2 * MARGIN_MM - TITLE_MM };
  const p = prepared === undefined ? prepareDrawing(d, spec) : prepared;
  if (!p) return { html: null, scale: typeof opts.scale === 'number' ? opts.scale : 100, widthMm: 0, heightMm: 0, fits: true, paperMm, availableMm };
  const scale = opts.scale === 'fit' ? fitDrawingScale(p, availableMm) : opts.scale;
  const r = renderDrawing(p, scale);
  const widthMm = (r.width * 1000) / scale;
  const heightMm = (r.height * 1000) / scale;
  const date = now.toLocaleDateString(localeOf(), { year: 'numeric', month: 'long', day: 'numeric' });
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(d.name)}</title>
<style>
${pageCss(paperMm)}
</style></head>
<body>
<section class="page">
  <div class="plan"><div class="frame" style="width:${mm(widthMm)};height:${mm(heightMm)}">${r.svg.replace(/ width="[^"]*" height="[^"]*"/, ' width="100%" height="100%"')}</div></div>
  ${titleBlock({ title: `${d.name} – ${p.title}`, date, scale, paper: `${PAPERS[opts.paper].label} ${opts.landscape ? 'landscape' : 'portrait'}`, north: null })}
</section>
</body></html>`;
  return { html, scale, widthMm, heightMm, fits: widthMm <= availableMm.w + 0.5 && heightMm <= availableMm.h + 0.5, paperMm, availableMm };
}
