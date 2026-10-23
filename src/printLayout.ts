/**
 * Print layout: turns a design into HTML pages that print at a true scale (1 m on the plan = 1000 / scale mm on paper).
 * Pure (returns an HTML string), so it can be tested without a printer; `session.ts` puts it in a hidden frame and prints.
 */
import { contentBounds } from './bounds';
import type { Design } from './model';
import { buildSvg } from './svgExport';

export const PAPERS = {
  A4: { label: 'A4', w: 210, h: 297 },
  A3: { label: 'A3', w: 297, h: 420 },
  A2: { label: 'A2', w: 420, h: 594 },
  Letter: { label: 'Letter', w: 215.9, h: 279.4 },
  Tabloid: { label: 'Tabloid (11 × 17 in)', w: 279.4, h: 431.8 },
} as const;
export type PaperKey = keyof typeof PAPERS;

/** Usual drawing scales, as the number after "1:". */
export const SCALES = [20, 25, 50, 75, 100, 125, 150, 200, 250, 500, 1000];

export interface PrintOptions {
  paper: PaperKey;
  landscape: boolean;
  /** The number after "1:" or 'fit' for the largest standard scale that fits the page. */
  scale: number | 'fit';
  floors: 'current' | 'all';
  dimensions: boolean;
}

export const DEFAULT_PRINT: PrintOptions = { paper: 'A4', landscape: true, scale: 'fit', floors: 'current', dimensions: false };

const MARGIN_MM = 10;
const TITLE_MM = 24;

export interface PrintPage {
  floorId: string;
  floorName: string;
  /** Size of the plan on paper in mm at the chosen scale. */
  widthMm: number;
  heightMm: number;
  fits: boolean;
}

export interface PrintLayout {
  /** The full HTML document, or null when there is nothing to print. */
  html: string | null;
  /** The scale used (the number after "1:"). */
  scale: number;
  pages: PrintPage[];
  paperMm: { w: number; h: number };
  /** Space for the plan inside the margins and the title block. */
  availableMm: { w: number; h: number };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const mm = (v: number) => `${Math.round(v * 100) / 100}mm`;

export function paperSize(opts: Pick<PrintOptions, 'paper' | 'landscape'>) {
  const p = PAPERS[opts.paper];
  return opts.landscape ? { w: p.h, h: p.w } : { w: p.w, h: p.h };
}

/** Which floors would be printed: the current one, or every floor that has something on it. */
export function floorsToPrint(d: Design, current: string, which: PrintOptions['floors']): { id: string; name: string }[] {
  const list = which === 'all' ? [...d.floors].reverse() : d.floors.filter((f) => f.id === current);
  return list.filter((f) => contentBounds(d, f.id)).map((f) => ({ id: f.id, name: f.name }));
}

/** The smallest standard scale at which every page's plan fits. */
export function fitScale(sizesM: { w: number; h: number }[], avail: { w: number; h: number }): number {
  const needed = Math.max(...sizesM.map((s) => Math.max((s.w * 1000) / avail.w, (s.h * 1000) / avail.h)));
  return SCALES.find((s) => s >= needed - 1e-9) ?? Math.ceil(needed);
}

const BAR_STEPS = [0.5, 1, 2, 5, 10, 20, 50];

export function buildPrintLayout(d: Design, current: string, opts: PrintOptions, now = new Date()): PrintLayout {
  const paperMm = paperSize(opts);
  const availableMm = { w: paperMm.w - 2 * MARGIN_MM, h: paperMm.h - 2 * MARGIN_MM - TITLE_MM };
  const floors = floorsToPrint(d, current, opts.floors);
  const plans = floors.map((f) => ({ f, plan: buildSvg(d, f.id, { decorations: false, dimensions: opts.dimensions, margin: 0.6 })! }));
  if (!plans.length) return { html: null, scale: typeof opts.scale === 'number' ? opts.scale : 100, pages: [], paperMm, availableMm };

  const scale = opts.scale === 'fit' ? fitScale(plans.map((p) => ({ w: p.plan.width, h: p.plan.height })), availableMm) : opts.scale;
  // keep text readable on small scales: roughly 2 mm tall labels at 1:100, bigger below that
  const textScale = Math.max(1, Math.min(4, scale / 60));
  const pages: PrintPage[] = [];
  const sheets: string[] = [];
  const date = now.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
  const bar = BAR_STEPS.find((m) => (m * 1000) / scale >= 20) ?? 50;

  for (const { f, plan } of plans) {
    const widthMm = (plan.width * 1000) / scale;
    const heightMm = (plan.height * 1000) / scale;
    pages.push({ floorId: f.id, floorName: f.name, widthMm, heightMm, fits: widthMm <= availableMm.w + 0.5 && heightMm <= availableMm.h + 0.5 });
    const svg = buildSvg(d, f.id, { decorations: false, dimensions: opts.dimensions, margin: 0.6, textScale })!.svg;
    const title = d.floors.length > 1 ? `${d.name} – ${f.name}` : d.name;
    sheets.push(`<section class="page">
  <div class="plan"><div class="frame" style="width:${mm(widthMm)};height:${mm(heightMm)}">${svg.replace(/ width="[^"]*" height="[^"]*"/, ' width="100%" height="100%"')}</div></div>
  <footer class="title">
    <div><strong>${esc(title)}</strong><br><span>${esc(date)}</span></div>
    <div class="scale"><div class="bar" style="width:${mm((bar * 1000) / scale)}"></div><span>${bar < 1 ? `${bar * 100} cm` : `${bar} m`}</span></div>
    <div class="info">Scale 1:${scale}<br><span>${PAPERS[opts.paper].label} ${opts.landscape ? 'landscape' : 'portrait'}</span></div>
    <svg class="north" viewBox="-12 -12 24 24" style="transform:rotate(${d.site.north}deg)"><polygon points="0,-10 3,5 0,2 -3,5" fill="#1f2937"/></svg>
  </footer>
</section>`);
  }

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(d.name)}</title>
<style>
@page { size: ${mm(paperMm.w)} ${mm(paperMm.h)}; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: system-ui, "Segoe UI", Arial, sans-serif; color: #1f2937; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { width: ${mm(paperMm.w)}; height: ${mm(paperMm.h)}; padding: ${mm(MARGIN_MM)}; display: flex; flex-direction: column; page-break-after: always; break-after: page; overflow: hidden; }
.page:last-child { page-break-after: auto; break-after: auto; }
.plan { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.frame { flex: none; }
.frame svg { display: block; }
.title { height: ${mm(TITLE_MM)}; border-top: 0.3mm solid #1f2937; padding-top: 3mm; display: flex; justify-content: space-between; align-items: flex-end; gap: 8mm; font-size: 3.6mm; line-height: 1.35; }
.title span { color: #6b7280; }
.title strong { font-size: 4.6mm; }
.scale { display: flex; flex-direction: column; gap: 1mm; }
.bar { height: 2.2mm; border: 0.35mm solid #1f2937; border-top: none; }
.info { text-align: right; }
.north { width: 12mm; height: 12mm; flex: none; }
</style></head>
<body>
${sheets.join('\n')}
</body></html>`;
  return { html, scale, pages, paperMm, availableMm };
}
