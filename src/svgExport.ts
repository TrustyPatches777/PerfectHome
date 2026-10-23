/**
 * Draws a floor of the design as an SVG (vector, in meters). Used for "Export SVG" and for printing at scale.
 * This is a second renderer of the plan, next to the Konva canvas: when a drawing changes on the canvas
 * (a new opening type, a new symbol kind...), update it here too. The svgExport tests help catch drift.
 */
import { catalogItem, catalogLayer, fillColor, shade } from './catalog';
import { contentBounds } from './bounds';
import { autoDimensions } from './dims';
import { doorGeometry, formatArea, labelPoint, niceLength, polygonArea, wallArc, wallPointAt, wallSolidSegments } from './geometry';
import type { Design, FloorMaterial, Furniture, Opening, Point, Wall } from './model';
import { samplePolyline, STRIP_STYLES } from './outdoor';
import { stairShapes } from './stairs';
import { WALL_STYLE } from './walls';

export interface SvgOptions {
  /** Draw the title, scale bar and north arrow inside the picture (for the exported file). */
  decorations: boolean;
  /** Add the automatic dimension labels ("All dimensions"). */
  dimensions: boolean;
  /** Margin around the plan in meters. */
  margin: number;
  /** Pixels per meter for the width/height attributes (the viewBox itself is in meters). */
  pixelsPerMeter: number;
  /** Multiplier for the size of labels, so text stays readable when the plan is printed at a small scale. */
  textScale: number;
}

export const DEFAULT_SVG_OPTIONS: SvgOptions = { decorations: true, dimensions: false, margin: 1.2, pixelsPerMeter: 100, textScale: 1 };

export interface SvgPlan {
  svg: string;
  /** Size of the drawing in meters (including the margin). */
  width: number;
  height: number;
}

const n = (v: number) => String(Math.round(v * 1000) / 1000);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pts = (list: Point[]) => list.map((p) => `${n(p.x)},${n(p.y)}`).join(' ');
/** A flat [x, y, x, y, ...] list as SVG points, each coordinate scaled. */
const flat = (list: number[], sx = 1, sy = 1) => list.reduce<string[]>((acc, v, i) => (i % 2 ? ((acc[acc.length - 1] += `,${n(v * sy)}`), acc) : [...acc, n(v * sx)]), []).join(' ');
const hairline = 'vector-effect="non-scaling-stroke"';
const FONT = 'font-family="system-ui, Segoe UI, Arial, sans-serif"';

/** A little vector version of each floor material, in the room's color. */
function materialPattern(material: Exclude<FloorMaterial, 'plain'>, color: string): { id: string; def: string } {
  const id = `mat-${material}-${color.replace('#', '')}`;
  const line = (x1: number, y1: number, x2: number, y2: number, c: string, w = 0.012) => `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${c}" stroke-width="${w}"/>`;
  const dark = shade(color, -0.28);
  let body = '';
  let size = 1.2;
  if (material === 'wood') {
    for (let r = 0; r < 10; r++) body += line(0, r * 0.12, 1.2, r * 0.12, dark) + line(((r * 0.37) % 1.2) + 0.1, r * 0.12, ((r * 0.37) % 1.2) + 0.1, (r + 1) * 0.12, dark);
  } else if (material === 'parquet') {
    for (let by = 0; by < 4; by++)
      for (let bx = 0; bx < 4; bx++)
        for (let i = 1; i < 4; i++) body += (bx + by) % 2 ? line(bx * 0.3 + i * 0.075, by * 0.3, bx * 0.3 + i * 0.075, by * 0.3 + 0.3, dark, 0.008) : line(bx * 0.3, by * 0.3 + i * 0.075, bx * 0.3 + 0.3, by * 0.3 + i * 0.075, dark, 0.008);
    for (let k = 0; k <= 4; k++) body += line(k * 0.3, 0, k * 0.3, 1.2, dark) + line(0, k * 0.3, 1.2, k * 0.3, dark);
  } else if (material === 'tile') {
    size = 0.6;
    body = line(0, 0, 0.6, 0, shade(color, -0.3), 0.02) + line(0, 0, 0, 0.6, shade(color, -0.3), 0.02);
  } else if (material === 'carpet') {
    size = 0.4;
    for (let i = 0; i < 24; i++) body += `<circle cx="${((i * 0.137) % 0.4).toFixed(3)}" cy="${((i * 0.271) % 0.4).toFixed(3)}" r="0.008" fill="${i % 2 ? shade(color, 0.2) : shade(color, -0.15)}"/>`;
  } else if (material === 'stone') {
    body = line(0, 0.4, 1.2, 0.4, dark) + line(0, 0.85, 1.2, 0.85, dark) + line(0.5, 0, 0.5, 0.4, dark) + line(0.9, 0.4, 0.9, 0.85, dark) + line(0.3, 0.85, 0.3, 1.2, dark) + line(0.8, 0.85, 0.8, 1.2, dark);
  } else {
    body = `<circle cx="0.3" cy="0.4" r="0.012" fill="${dark}"/><circle cx="0.8" cy="0.2" r="0.01" fill="${dark}"/><circle cx="0.6" cy="0.9" r="0.012" fill="${dark}"/><circle cx="1.0" cy="1.0" r="0.01" fill="${dark}"/>`;
  }
  return { id, def: `<pattern id="${id}" width="${size}" height="${size}" patternUnits="userSpaceOnUse"><rect width="${size}" height="${size}" fill="${color}"/>${body}</pattern>` };
}

function wallSegmentPolygon(w: Wall, s0: number, s1: number): Point[] {
  const arc = wallArc(w);
  const steps = arc ? Math.max(3, Math.ceil(((s1 - s0) / arc.length) * Math.abs(arc.sweep) / (Math.PI / 24))) : 1;
  const h = w.thickness / 2;
  const outer: Point[] = [];
  const inner: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const wp = wallPointAt(w, s0 + ((s1 - s0) * i) / steps);
    outer.push({ x: wp.p.x + wp.n.x * h, y: wp.p.y + wp.n.y * h });
    inner.push({ x: wp.p.x - wp.n.x * h, y: wp.p.y - wp.n.y * h });
  }
  return [...outer, ...inner.reverse()];
}

function openingSvg(wall: Wall, o: Opening): string {
  const wp = wallPointAt(wall, o.pos);
  const t = wall.thickness;
  const w = o.width;
  const x0 = -w / 2;
  const x1 = w / 2;
  const stroke = '#1f2937';
  const GLASS = '#dbeafe';
  const side = o.swing;
  const line = (a: number, b: number, c: number, d: number, extra = '') => `<line x1="${n(a)}" y1="${n(b)}" x2="${n(c)}" y2="${n(d)}" stroke="${stroke}" stroke-width="1" ${hairline} ${extra}/>`;
  let local = '';
  let world = '';
  const leaves = o.kind === 'door' ? [o] : o.kind === 'double' || o.kind === 'french' ? [{ ...o, pos: o.pos - w / 4, width: w / 2, hinge: 'a' as const }, { ...o, pos: o.pos + w / 4, width: w / 2, hinge: 'b' as const }] : [];
  for (const leaf of leaves) {
    const g = doorGeometry(wall, leaf, 12);
    world += `<polyline points="${pts(g.arc)}" fill="none" stroke="${stroke}" stroke-width="1" stroke-dasharray="4 3" ${hairline}/>`;
    world += `<line x1="${n(g.hinge.x)}" y1="${n(g.hinge.y)}" x2="${n(g.leafEnd.x)}" y2="${n(g.leafEnd.y)}" stroke="${stroke}" stroke-width="${o.kind === 'french' ? 0.07 : 0.045}"/>`;
  }
  const jambs = line(x0, -t / 2, x0, t / 2) + line(x1, -t / 2, x1, t / 2);
  if (o.kind === 'window') local = `<rect x="${n(x0)}" y="${n(-t / 2)}" width="${n(w)}" height="${n(t)}" fill="${GLASS}" stroke="${stroke}" stroke-width="1.25" ${hairline}/>${line(x0, 0, x1, 0)}`;
  else if (o.kind === 'bay') {
    const bay = Math.min(0.6, w * 0.35);
    const inset = bay * 0.7;
    local = `<rect x="${n(x0)}" y="${n(-t / 2)}" width="${n(w)}" height="${n(t)}" fill="${GLASS}" stroke="${stroke}" stroke-width="1" ${hairline}/><polygon points="${pts([
      { x: x0, y: (side * t) / 2 },
      { x: x0 + inset, y: side * (t / 2 + bay) },
      { x: x1 - inset, y: side * (t / 2 + bay) },
      { x: x1, y: (side * t) / 2 },
    ])}" fill="${GLASS}" stroke="${stroke}" stroke-width="1.25" stroke-linejoin="round" ${hairline}/>`;
  } else if (o.kind === 'sliding') {
    local = `<rect x="${n(x0)}" y="${n(-t / 2)}" width="${n(w)}" height="${n(t)}" fill="#fff" stroke="${stroke}" stroke-width="1" ${hairline}/><rect x="${n(x0 + w * 0.02)}" y="${n(-t / 2 + t * 0.12)}" width="${n(w * 0.55)}" height="${n(t * 0.3)}" fill="${GLASS}" stroke="${stroke}" stroke-width="1" ${hairline}/><rect x="${n(x1 - w * 0.57)}" y="${n(t / 2 - t * 0.42)}" width="${n(w * 0.55)}" height="${n(t * 0.3)}" fill="${GLASS}" stroke="${stroke}" stroke-width="1" ${hairline}/>`;
  } else if (o.kind === 'garage') {
    local = `<rect x="${n(x0)}" y="${n(-t / 2)}" width="${n(w)}" height="${n(t)}" fill="#e5e7eb"/>${line(x0, 0, x1, 0, 'stroke-dasharray="10 5"')}${jambs}`;
  } else local = jambs;
  return `${world}<g transform="translate(${n(wp.p.x)} ${n(wp.p.y)}) rotate(${n(wp.angle)})">${local}</g>`;
}

function furnitureSvg(f: Furniture): string {
  const item = catalogItem(f.type);
  const m = Math.min(f.w, f.d);
  const common = `stroke="#475569" stroke-width="1" ${hairline}`;
  const shapes = item.shapes
    .map((p) => {
      if (p.t === 'rect') return `<rect x="${n(p.x * f.w)}" y="${n(p.y * f.d)}" width="${n(p.w * f.w)}" height="${n(p.h * f.d)}" rx="${n((p.r ?? 0) * m)}" fill="${fillColor(p.fill, f.color)}" ${common}/>`;
      if (p.t === 'ellipse') return `<ellipse cx="${n((p.x + p.w / 2) * f.w)}" cy="${n((p.y + p.h / 2) * f.d)}" rx="${n((p.w / 2) * f.w)}" ry="${n((p.h / 2) * f.d)}" fill="${fillColor(p.fill, f.color)}" ${common}/>`;
      return `<polyline points="${flat(p.pts, f.w, f.d)}" fill="none" ${common}/>`;
    })
    .join('');
  return `<g transform="translate(${n(f.x)} ${n(f.y)}) rotate(${n(f.rotation)}) translate(${n(-f.w / 2)} ${n(-f.d / 2)})">${shapes}</g>`;
}

const label = (text: string, x: number, y: number, size: number, extra = '') =>
  `<text x="${n(x)}" y="${n(y)}" font-size="${n(size)}" text-anchor="middle" ${FONT} paint-order="stroke" stroke="#ffffff" stroke-width="${n(size * 0.18)}" stroke-linejoin="round" ${extra}>${esc(text)}</text>`;

/** Draw one floor. Returns null when the floor has nothing on it. */
export function buildSvg(d: Design, floor: string, opts: Partial<SvgOptions> = {}): SvgPlan | null {
  const o = { ...DEFAULT_SVG_OPTIONS, ...opts };
  const b = contentBounds(d, floor);
  if (!b) return null;
  const margin = o.margin;
  const x0 = b.minX - margin;
  const y0 = b.minY - margin - (o.decorations ? 1.2 : 0);
  const W = b.maxX - b.minX + margin * 2;
  const H = b.maxY - b.minY + margin * 2 + (o.decorations ? 2.2 : 0);
  const vis = (id: keyof Design['layers']) => d.layers[id].visible;
  const L = (text: string, x: number, y: number, size: number, extra = '') => label(text, x, y, size * o.textScale, extra);
  const defs: string[] = ['<pattern id="hatch" width="0.16" height="0.16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="0.16" height="0.16" fill="#3b4252"/><line x1="0" y1="0" x2="0" y2="0.16" stroke="#ffffffaa" stroke-width="0.05"/></pattern>'];
  const body: string[] = [];
  const onFloor = <T extends { floor: string }>(list: T[]) => list.filter((i) => i.floor === floor);

  if (vis('outdoor')) {
    for (const z of onFloor(d.zones)) {
      const plot = z.kind === 'plot';
      body.push(`<polygon points="${pts(z.points)}" fill="${plot ? 'none' : z.color}" stroke="${plot ? '#6b7280' : shade(z.color, -0.18)}" stroke-width="1" ${plot ? 'stroke-dasharray="10 6"' : ''} ${hairline}/>`);
      const c = labelPoint(z.points);
      body.push(L(`${z.name ? z.name + ' · ' : ''}${formatArea(polygonArea(z.points))}`, c.x, c.y, 0.2, 'fill="#374151" opacity="0.8"'));
    }
    const order = (k: string) => (k === 'road' ? 0 : k === 'path' ? 1 : 2);
    for (const s of [...onFloor(d.strips)].sort((a, c) => order(a.kind) - order(c.kind))) {
      const line = `points="${pts(s.points)}" fill="none" stroke-linejoin="round" stroke-linecap="round"`;
      const col = STRIP_STYLES[s.kind].color;
      if (s.kind === 'road') body.push(`<polyline ${line} stroke="${col}" stroke-width="${n(s.width)}" stroke-linecap="butt"/><polyline points="${pts(s.points)}" fill="none" stroke="#fff" stroke-width="${n(Math.min(0.15, s.width * 0.03))}" stroke-dasharray="0.9 0.7"/>`);
      else if (s.kind === 'path') body.push(`<polyline ${line} stroke="${col}" stroke-width="${n(s.width)}" stroke-linecap="butt"/>`);
      else if (s.kind === 'hedge') body.push(`<polyline ${line} stroke="${shade(col, -0.3)}" stroke-width="${n(s.width + 0.04)}"/><polyline ${line} stroke="${col}" stroke-width="${n(s.width)}"/>`);
      else {
        body.push(`<polyline ${line} stroke="${col}" stroke-width="${n(Math.max(s.width * 0.5, 0.04))}" stroke-linecap="butt"/>`);
        for (const p of samplePolyline(s.points, 1.5)) body.push(`<rect x="${n(p.x - s.width)}" y="${n(p.y - s.width)}" width="${n(s.width * 2)}" height="${n(s.width * 2)}" fill="${shade(col, -0.25)}"/>`);
      }
    }
  }

  if (vis('rooms')) {
    for (const r of onFloor(d.rooms)) {
      let fill = r.color;
      if (r.material !== 'plain') {
        const p = materialPattern(r.material, r.color);
        defs.push(p.def);
        fill = `url(#${p.id})`;
      }
      body.push(`<polygon points="${pts(r.points)}" fill="${fill}" opacity="0.95"/>`);
    }
  }

  if (vis('structure')) {
    const wallsHere = onFloor(d.walls);
    for (const w of wallsHere) {
      const style = WALL_STYLE[w.type] ?? WALL_STYLE.interior;
      const gaps = d.openings.filter((x) => x.wallId === w.id);
      for (const [s0, s1] of wallSolidSegments(w, gaps)) body.push(`<polygon points="${pts(wallSegmentPolygon(w, s0, s1))}" fill="${style.hatch ? 'url(#hatch)' : style.fill}"/>`);
    }
    for (const op of d.openings) {
      const w = wallsHere.find((x) => x.id === op.wallId);
      if (w) body.push(openingSvg(w, op));
    }
    for (const s of onFloor(d.stairs)) {
      const inner = stairShapes(s)
        .map((sh) => {
          if (sh.t === 'poly') return `<polygon points="${flat(sh.pts)}" fill="#f8fafc" stroke="#475569" stroke-width="1.5" ${hairline}/>`;
          if (sh.t === 'ellipse') return `<ellipse cx="${n(sh.cx)}" cy="${n(sh.cy)}" rx="${n(sh.rx)}" ry="${n(sh.ry)}" fill="${sh.fill ? '#f8fafc' : 'none'}" stroke="#475569" stroke-width="1.5" ${hairline}/>`;
          return `<polyline points="${flat(sh.pts)}" fill="none" stroke="#475569" stroke-width="1" stroke-linejoin="round" ${hairline}/>`;
        })
        .join('');
      body.push(`<g transform="translate(${n(s.x)} ${n(s.y)}) rotate(${n(s.rotation)}) translate(${n(-s.w / 2)} ${n(-s.d / 2)})">${inner}</g>`);
    }
  }
  // room names after the walls so they stay readable
  if (vis('rooms')) {
    for (const r of onFloor(d.rooms)) {
      if (polygonArea(r.points) < 2) continue;
      const c = labelPoint(r.points);
      body.push(L(r.name, c.x, c.y - 0.05, 0.22, 'font-weight="700" fill="#374151"'));
      body.push(L(formatArea(polygonArea(r.points)), c.x, c.y + 0.22, 0.2, 'font-weight="700" fill="#374151"'));
    }
  }

  for (const layerId of ['furniture', 'tech'] as const) {
    if (!vis(layerId)) continue;
    for (const f of onFloor(d.furniture).filter((x) => catalogLayer(x.type) === layerId)) {
      body.push(furnitureSvg(f));
      const size = Math.min(0.2, Math.min(f.w, f.d) * 0.28);
      if (layerId === 'furniture' && Math.min(f.w, f.d) >= 0.5) body.push(L(f.label || catalogItem(f.type).label, f.x, f.y + size * 0.35, size, 'fill="#1f2937" opacity="0.85"'));
    }
  }

  if (vis('notes')) {
    for (const l of onFloor(d.labels)) {
      const lines = l.text.split('\n');
      body.push(
        `<text transform="translate(${n(l.x)} ${n(l.y)}) rotate(${n(l.rotation)})" font-size="${n(l.size)}" text-anchor="middle" fill="${l.color}" ${FONT}>${lines
          .map((t, i) => `<tspan x="0" y="${n((i - (lines.length - 1) / 2) * l.size * 1.25 + l.size * 0.35)}">${esc(t)}</tspan>`)
          .join('')}</text>`,
      );
    }
    for (const m of onFloor(d.dimensions)) {
      const len = Math.hypot(m.b.x - m.a.x, m.b.y - m.a.y);
      if (len < 1e-6) continue;
      const ux = (m.b.x - m.a.x) / len;
      const uy = (m.b.y - m.a.y) / len;
      let nx = -uy;
      let ny = ux;
      if (ny > 0) [nx, ny] = [-nx, -ny];
      let ang = (Math.atan2(uy, ux) * 180) / Math.PI;
      if (ang > 90 || ang < -90) ang += 180;
      const c = '#0f766e';
      const tick = 0.1;
      const mid = { x: (m.a.x + m.b.x) / 2 + nx * 0.18, y: (m.a.y + m.b.y) / 2 + ny * 0.18 };
      body.push(
        `<g stroke="${c}" stroke-width="1.5" ${hairline}><line x1="${n(m.a.x)}" y1="${n(m.a.y)}" x2="${n(m.b.x)}" y2="${n(m.b.y)}"/><line x1="${n(m.a.x - nx * tick)}" y1="${n(m.a.y - ny * tick)}" x2="${n(m.a.x + nx * tick)}" y2="${n(m.a.y + ny * tick)}"/><line x1="${n(m.b.x - nx * tick)}" y1="${n(m.b.y - ny * tick)}" x2="${n(m.b.x + nx * tick)}" y2="${n(m.b.y + ny * tick)}"/></g>`,
        `<g transform="translate(${n(mid.x)} ${n(mid.y)}) rotate(${n(ang)})">${L(`${(Math.round(len * 100) / 100).toFixed(2)} m`, 0, 0.07, 0.2, `font-weight="700" fill="${c}"`)}</g>`,
      );
    }
  }

  if (o.dimensions) {
    for (const l of autoDimensions(d, floor, 60)) body.push(`<g transform="translate(${n(l.x)} ${n(l.y)}) rotate(${n(l.angle)})">${L(l.text, 0, 0.06, 0.18, 'font-weight="700" fill="#475569"')}</g>`);
  }

  // title, scale bar and north arrow inside the picture
  if (o.decorations) {
    const u = Math.max(W, H) / 40;
    const floorName = d.floors.find((f) => f.id === floor)?.name ?? '';
    body.push(`<text x="${n(x0 + margin * 0.6)}" y="${n(y0 + u * 1.5)}" font-size="${n(u * 1.2)}" font-weight="600" fill="#1f2937" ${FONT}>${esc(d.floors.length > 1 ? `${d.name} – ${floorName}` : d.name)}</text>`);
    const len = niceLength(1, Math.max(2, W * 0.15));
    const bx = x0 + margin * 0.6;
    const by = y0 + H - u * 1.2;
    body.push(`<g stroke="#1f2937" stroke-width="${n(u * 0.12)}" fill="none"><polyline points="${n(bx)},${n(by - u * 0.6)} ${n(bx)},${n(by)} ${n(bx + len)},${n(by)} ${n(bx + len)},${n(by - u * 0.6)}"/></g><text x="${n(bx)}" y="${n(by + u * 0.95)}" font-size="${n(u * 0.9)}" ${FONT} fill="#1f2937">${len < 1 ? `${Math.round(len * 100)} cm` : `${len} m`}</text>`);
    const r = u * 1.6;
    body.push(`<g transform="translate(${n(x0 + W - margin * 0.6 - r)} ${n(y0 + r + u * 0.4)}) rotate(${n(d.site.north)})"><polygon points="0,${n(-r)} ${n(r * 0.3)},${n(r * 0.5)} 0,${n(r * 0.2)} ${n(-r * 0.3)},${n(r * 0.5)}" fill="#1f2937"/><text y="${n(-r - u * 0.3)}" text-anchor="middle" font-size="${n(u * 1.1)}" font-weight="700" ${FONT} fill="#1f2937">N</text></g>`);
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(x0)} ${n(y0)} ${n(W)} ${n(H)}" width="${n(W * o.pixelsPerMeter)}" height="${n(H * o.pixelsPerMeter)}">` +
    `<defs>${defs.join('')}</defs><rect x="${n(x0)}" y="${n(y0)}" width="${n(W)}" height="${n(H)}" fill="#ffffff"/>${body.join('')}</svg>`;
  return { svg, width: W, height: H };
}
