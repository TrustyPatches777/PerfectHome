/**
 * Draws a floor of the design as an SVG (vector, in meters). Used for "Export SVG" and for printing at scale.
 * This is a second renderer of the plan, next to the Konva canvas: when a drawing changes on the canvas
 * (a new opening type, a new symbol kind...), update it here too. The svgExport tests help catch drift.
 */
import { isSingleDoor } from './model';
import { catalogItem, catalogLayer, fillColor, shade } from './catalog';
import { contentBounds } from './bounds';
import { autoDimensions } from './dims';
import { doorGeometry, formatArea, labelPoint, sectionDirection, niceLength, polygonArea, wallArc, wallCorners, wallPointAt, wallSegmentOutline, type WallCorners, faceSpan, wallSolidSegments } from './geometry';
import type { Design, FloorMaterial, Furniture, Gate, Opening, Point, Strip, Wall } from './model';
import { doorwayPatches } from './doorways';
import { gateGeometry, gateSpans, pathMarks, plotFirst, samplePolyline, solidSpans, stripColor } from './outdoor';
import { roofPlan } from './roofs';
import { lookOf, type Look } from './planStyle';
import { guardAvoid, guardRuns, reachesNextFloor, railPaths, railPlanColor, stairOutline, stairPlanFill, stairShapes } from './stairs';
import { WALL_STYLE, wallFaceLine } from './walls';
import { isWindowKind, windowMarks } from './windows';
import { t } from './i18n';

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
function materialPattern(material: Exclude<FloorMaterial, 'plain'>, color: string, grout?: string): { id: string; def: string } {
  const id = `mat-${material}-${color.replace('#', '')}${grout ? `-${grout.replace('#', '')}` : ''}`;
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
    body = line(0, 0, 0.6, 0, grout ?? shade(color, -0.3), 0.02) + line(0, 0, 0, 0.6, grout ?? shade(color, -0.3), 0.02);
  } else if (material === 'subway') {
    size = 0.6;
    const g = grout ?? shade(color, -0.3);
    for (let r = 0; r < 4; r++) body += line(0, r * 0.15, 0.6, r * 0.15, g, 0.012) + line(r % 2 ? 0.15 : 0.45, r * 0.15, r % 2 ? 0.15 : 0.45, (r + 1) * 0.15, g, 0.012) + (r % 2 ? line(0.45, r * 0.15, 0.45, (r + 1) * 0.15, g, 0.012) : line(0.15, r * 0.15, 0.15, (r + 1) * 0.15, g, 0.012));
  } else if (material === 'checker') {
    size = 0.6;
    const second = grout ?? shade(color, -0.78);
    body = `<rect x="0" y="0" width="0.3" height="0.3" fill="${second}"/><rect x="0.3" y="0.3" width="0.3" height="0.3" fill="${second}"/>`;
  } else if (material === 'herringbone') {
    const g = grout ?? shade(color, -0.4);
    for (let k = -8; k < 16; k++) body += line(k * 0.15, 0, k * 0.15 + 1.2, 1.2, g, 0.01);
    for (let k = 0; k < 8; k++) body += line(k * 0.15, 0, k * 0.15, 1.2, g, 0.006);
  } else if (material === 'marble') {
    const v = shade(color, -0.4);
    body = `<path d="M0.1 0 C 0.3 0.3, 0.2 0.5, 0.5 0.7 S 0.8 1.0, 0.9 1.2" fill="none" stroke="${v}" stroke-width="0.012" opacity="0.5"/><path d="M0.7 0 C 0.6 0.2, 0.9 0.5, 0.8 0.8" fill="none" stroke="${v}" stroke-width="0.008" opacity="0.4"/>` + line(0.6, 0, 0.6, 1.2, grout ?? shade(color, -0.2), 0.01) + line(0, 0.6, 1.2, 0.6, grout ?? shade(color, -0.2), 0.01);
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

function wallSegmentPolygon(w: Wall, s0: number, s1: number, corners: WallCorners = {}): Point[] {
  const arc = wallArc(w);
  if (!arc) return wallSegmentOutline(w, s0, s1, corners);
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

function openingSvg(wall: Wall, o: Opening, look: Look): string {
  const wp = wallPointAt(wall, o.pos);
  const t = wall.thickness;
  const w = o.width;
  const x0 = -w / 2;
  const x1 = w / 2;
  const stroke = look.ink;
  const GLASS = look.tone('#dbeafe');
  const lw = look.lw;
  const side = o.swing;
  const line = (a: number, b: number, c: number, d: number, extra = '') => `<line x1="${n(a)}" y1="${n(b)}" x2="${n(c)}" y2="${n(d)}" stroke="${stroke}" stroke-width="${n(lw)}" ${hairline} ${extra}/>`;
  let local = '';
  let world = '';
  const leaves = isSingleDoor(o.kind) ? [o] : o.kind === 'double' || o.kind === 'french' ? [{ ...o, pos: o.pos - w / 4, width: w / 2, hinge: 'a' as const }, { ...o, pos: o.pos + w / 4, width: w / 2, hinge: 'b' as const }] : [];
  for (const leaf of leaves) {
    const g = doorGeometry(wall, leaf, 12);
    world += `<polyline points="${pts(g.arc)}" fill="none" stroke="${stroke}" stroke-width="${n(lw)}" stroke-dasharray="4 3" ${hairline}/>`;
    world += `<line x1="${n(g.hinge.x)}" y1="${n(g.hinge.y)}" x2="${n(g.leafEnd.x)}" y2="${n(g.leafEnd.y)}" stroke="${stroke}" stroke-width="${o.kind === 'french' ? 0.07 : 0.045}"/>`;
  }
  const jambs = line(x0, -t / 2, x0, t / 2) + line(x1, -t / 2, x1, t / 2);
  if (isWindowKind(o.kind) && o.kind !== 'bay') {
    const m = windowMarks(o.kind, w, t);
    local = `<rect x="${n(x0)}" y="${n(-t / 2)}" width="${n(w)}" height="${n(t)}" fill="${look.tone(m.fill)}" stroke="${stroke}" stroke-width="${n(1.25 * lw)}" ${m.dash ? 'stroke-dasharray="6 4"' : ''} ${hairline}/>${m.lines.map((l) => line(l[0], l[1], l[2], l[3])).join('')}`;
  }
  else if (o.kind === 'bay') {
    const bay = Math.min(0.6, w * 0.35);
    const inset = bay * 0.7;
    local = `<rect x="${n(x0)}" y="${n(-t / 2)}" width="${n(w)}" height="${n(t)}" fill="${GLASS}" stroke="${stroke}" stroke-width="${n(lw)}" ${hairline}/><polygon points="${pts([
      { x: x0, y: (side * t) / 2 },
      { x: x0 + inset, y: side * (t / 2 + bay) },
      { x: x1 - inset, y: side * (t / 2 + bay) },
      { x: x1, y: (side * t) / 2 },
    ])}" fill="${GLASS}" stroke="${stroke}" stroke-width="${n(1.25 * lw)}" stroke-linejoin="round" ${hairline}/>`;
  } else if (o.kind === 'sliding') {
    local = `<rect x="${n(x0)}" y="${n(-t / 2)}" width="${n(w)}" height="${n(t)}" fill="${look.tone('#ffffff')}" stroke="${stroke}" stroke-width="${n(lw)}" ${hairline}/><rect x="${n(x0 + w * 0.02)}" y="${n(-t / 2 + t * 0.12)}" width="${n(w * 0.55)}" height="${n(t * 0.3)}" fill="${GLASS}" stroke="${stroke}" stroke-width="${n(lw)}" ${hairline}/><rect x="${n(x1 - w * 0.57)}" y="${n(t / 2 - t * 0.42)}" width="${n(w * 0.55)}" height="${n(t * 0.3)}" fill="${GLASS}" stroke="${stroke}" stroke-width="${n(lw)}" ${hairline}/>`;
  } else if (o.kind === 'garage') {
    local = `<rect x="${n(x0)}" y="${n(-t / 2)}" width="${n(w)}" height="${n(t)}" fill="${look.tone('#e5e7eb')}"/>${line(x0, 0, x1, 0, 'stroke-dasharray="10 5"')}${jambs}`;
  } else local = jambs;
  return `${world}<g transform="translate(${n(wp.p.x)} ${n(wp.p.y)}) rotate(${n(wp.angle)})">${local}</g>`;
}

/** A gate in a fence or hedge: two posts, the leaf shut and where it goes when it is open. */
function gateSvg(strip: Pick<Strip, 'points' | 'width' | 'kind'>, gate: Gate, col: string, look: Look): string {
  const g = gateGeometry(strip, gate);
  const post = Math.max(strip.width * 1.6, 0.16);
  let out = [g.a, g.b].map((p) => `<rect x="${n(p.x - post / 2)}" y="${n(p.y - post / 2)}" width="${n(post)}" height="${n(post)}" fill="${shade(col, -0.35)}"/>`).join('');
  for (const l of g.leaves) {
    if (gate.kind === 'sliding') out += `<polyline points="${pts([l.shut, l.open])}" fill="none" stroke="${look.ink}" stroke-width="${n(look.lw)}" stroke-dasharray="4 3" ${hairline}/>`;
    else {
      const a0 = Math.atan2(l.shut.y - l.hinge.y, l.shut.x - l.hinge.x);
      let sweep = Math.atan2(l.open.y - l.hinge.y, l.open.x - l.hinge.x) - a0;
      while (sweep > Math.PI) sweep -= 2 * Math.PI;
      while (sweep <= -Math.PI) sweep += 2 * Math.PI;
      const r = Math.hypot(l.shut.x - l.hinge.x, l.shut.y - l.hinge.y);
      const arc = Array.from({ length: 13 }, (_, k) => ({ x: l.hinge.x + Math.cos(a0 + (sweep * k) / 12) * r, y: l.hinge.y + Math.sin(a0 + (sweep * k) / 12) * r }));
      out += `<polyline points="${pts(arc)}" fill="none" stroke="${look.ink}" stroke-width="${n(look.lw)}" stroke-dasharray="4 3" ${hairline}/>`;
    }
    out += `<line x1="${n(l.hinge.x)}" y1="${n(l.hinge.y)}" x2="${n(l.shut.x)}" y2="${n(l.shut.y)}" stroke="${look.ink}" stroke-width="${n(Math.max(strip.width * 0.6, 0.05))}"/>`;
  }
  return out;
}

function furnitureSvg(f: Furniture, look: Look): string {
  const item = catalogItem(f.type);
  const m = Math.min(f.w, f.d);
  const common = `stroke="${look.ink2}" stroke-width="${n(look.lw)}" ${hairline}`;
  const shapes = item.shapes
    .map((p) => {
      if (p.t === 'rect') return `<rect x="${n(p.x * f.w)}" y="${n(p.y * f.d)}" width="${n(p.w * f.w)}" height="${n(p.h * f.d)}" rx="${n((p.r ?? 0) * m)}" fill="${look.furnFill(fillColor(p.fill, f.color, f.color2))}" ${common}/>`;
      if (p.t === 'ellipse') return `<ellipse cx="${n((p.x + p.w / 2) * f.w)}" cy="${n((p.y + p.h / 2) * f.d)}" rx="${n((p.w / 2) * f.w)}" ry="${n((p.h / 2) * f.d)}" fill="${look.furnFill(fillColor(p.fill, f.color, f.color2))}" ${common}/>`;
      return `<polyline points="${flat(p.pts, f.w, f.d)}" fill="none" ${common}/>`;
    })
    .join('');
  return `<g transform="translate(${n(f.x)} ${n(f.y)}) rotate(${n(f.rotation)}) translate(${n(-f.w / 2)} ${n(-f.d / 2)})">${shapes}</g>`;
}

const label = (text: string, x: number, y: number, size: number, extra: string, look: Look) =>
  `<text x="${n(x)}" y="${n(y)}" font-size="${n(size)}" text-anchor="middle" font-family="${look.font.svg}" paint-order="stroke" stroke="${look.halo}" stroke-width="${n(size * 0.18)}" stroke-linejoin="round" ${extra}>${esc(text)}</text>`;

/** Draw one floor. Returns null when the floor has nothing on it. */
export function buildSvg(d: Design, floor: string, opts: Partial<SvgOptions> = {}): SvgPlan | null {
  const o = { ...DEFAULT_SVG_OPTIONS, ...opts };
  const look = lookOf(d.style);
  const FONTL = `font-family="${look.font.svg}"`;
  const b = contentBounds(d, floor);
  if (!b) return null;
  const margin = o.margin;
  const x0 = b.minX - margin;
  const y0 = b.minY - margin - (o.decorations ? 1.2 : 0);
  const W = b.maxX - b.minX + margin * 2;
  const H = b.maxY - b.minY + margin * 2 + (o.decorations ? 2.2 : 0);
  const vis = (id: keyof Design['layers']) => d.layers[id].visible;
  const L = (text: string, x: number, y: number, size: number, extra = '') => label(text, x, y, size * o.textScale, extra, look);
  const defs: string[] = [];
  const hatchIds = new Set<string>();
  /** The hatch of a wall in this plan style: diagonal lines over a ground, one pattern per pair of colors. */
  const hatchFor = (color: string): string => {
    const h = look.wallHatch(color);
    const id = `hatch-${(h.base + h.line).replace(/[^0-9a-z]/gi, '')}`;
    if (!hatchIds.has(id)) {
      hatchIds.add(id);
      defs.push(`<pattern id="${id}" width="0.16" height="0.16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="0.16" height="0.16" fill="${h.base}"/><line x1="0" y1="0" x2="0" y2="0.16" stroke="${h.line}" stroke-width="0.05"/></pattern>`);
    }
    return id;
  };
  const body: string[] = [];
  const onFloor = <T extends { floor: string }>(list: T[]) => list.filter((i) => i.floor === floor);

  if (vis('outdoor')) {
    for (const z of plotFirst(onFloor(d.zones))) {
      const plot = z.kind === 'plot';
      body.push(`<polygon points="${pts(z.points)}" fill="${plot ? 'none' : look.tone(z.color)}" stroke="${plot ? (look.preset === 'colour' ? '#6b7280' : look.ink2) : look.zoneEdge(z.color)}" stroke-width="1" ${plot ? 'stroke-dasharray="10 6"' : ''} ${hairline}/>`);
      const c = labelPoint(z.points);
      body.push(L(`${z.name ? t(z.name) + ' · ' : ''}${formatArea(polygonArea(z.points))}`, c.x, c.y, 0.2, `fill="${look.text}" opacity="0.8"`));
    }
    const order = (k: string) => (k === 'road' ? 0 : k === 'path' ? 1 : 2);
    for (const s of [...onFloor(d.strips)].sort((a, c) => order(a.kind) - order(c.kind))) {
      const line = `points="${pts(s.points)}" fill="none" stroke-linejoin="round" stroke-linecap="round"`;
      const col = look.tone(stripColor(s));
      const joint = shade(col, -0.25);
      if (s.kind === 'road') body.push(`<polyline ${line} stroke="${col}" stroke-width="${n(s.width)}" stroke-linecap="butt"/><polyline points="${pts(s.points)}" fill="none" stroke="#fff" stroke-width="${n(Math.min(0.15, s.width * 0.03))}" stroke-dasharray="0.9 0.7"/>`);
      else if (s.kind === 'path') {
        if (s.surface !== 'stepping') body.push(`<polyline ${line} stroke="${col}" stroke-width="${n(s.width)}" stroke-linecap="butt"/>`);
        for (const m of pathMarks(s)) {
          if (m.t === 'line') body.push(`<polyline points="${pts(m.pts)}" fill="none" stroke="${joint}" stroke-width="1" ${hairline}/>`);
          else body.push(`<ellipse cx="${n(m.x)}" cy="${n(m.y)}" rx="${n(m.rx)}" ry="${n(m.ry)}" transform="rotate(${n(m.rot)} ${n(m.x)} ${n(m.y)})" fill="${s.surface === 'stepping' ? col : joint}" ${s.surface === 'stepping' ? `stroke="${shade(col, -0.3)}" stroke-width="1" ${hairline}` : ''}/>`);
        }
      } else {
        for (const run of solidSpans(s)) {
          const rl = `points="${pts(run)}" fill="none" stroke-linejoin="round" stroke-linecap="round"`;
          if (s.kind === 'hedge') body.push(`<polyline ${rl} stroke="${shade(col, -0.3)}" stroke-width="${n(s.width + 0.04)}"/><polyline ${rl} stroke="${col}" stroke-width="${n(s.width)}"/>`);
          else {
            body.push(`<polyline ${rl} stroke="${col}" stroke-width="${n(Math.max(s.width * 0.5, 0.04))}" stroke-linecap="butt"/>`);
            for (const p of samplePolyline(run, 1.5)) body.push(`<rect x="${n(p.x - s.width)}" y="${n(p.y - s.width)}" width="${n(s.width * 2)}" height="${n(s.width * 2)}" fill="${shade(col, -0.25)}"/>`);
          }
        }
        for (const { gate } of gateSpans(s)) body.push(gateSvg(s, gate, col, look));
      }
    }
  }

  if (vis('rooms')) {
    const floorFill = (r: { material: FloorMaterial; color: string; grout?: string }): string => {
      if (look.rooms !== 'material') return look.roomFlat(r.color);
      if (r.material === 'plain') return r.color;
      const p = materialPattern(r.material, r.color, r.grout);
      defs.push(p.def);
      return `url(#${p.id})`;
    };
    for (const r of onFloor(d.rooms)) body.push(`<polygon points="${pts(r.points)}" fill="${floorFill(r)}" opacity="0.95"/>`);
    // the floor goes on through the doorways
    const here = new Set(onFloor(d.rooms).map((r) => r.id));
    for (const patch of doorwayPatches(d)) {
      if (!here.has(patch.room.id)) continue;
      body.push(`<polygon points="${pts(patch.pts)}" fill="${floorFill(patch.room)}" opacity="0.95"/>`);
    }
  }

  if (vis('structure')) {
    const wallsHere = onFloor(d.walls);
    if (look.walls !== 'solid') {
      // the edge of every wall first (thick, in ink); the fills that follow cover the inner half, and every edge inside a joint
      for (const w of wallsHere) {
        const gaps = d.openings.filter((x) => x.wallId === w.id);
        const corners = wallCorners(w, wallsHere);
        for (const [s0, s1] of wallSolidSegments(w, gaps)) body.push(`<polygon points="${pts(wallSegmentPolygon(w, s0, s1, corners))}" fill="${look.wallLine}" stroke="${look.wallLine}" stroke-width="${n(3.2 * look.lw)}" ${hairline}/>`);
      }
    }
    for (const w of wallsHere) {
      const style = WALL_STYLE[w.type] ?? WALL_STYLE.interior;
      const gaps = d.openings.filter((x) => x.wallId === w.id);
      const corners = wallCorners(w, wallsHere);
      for (const [s0, s1] of wallSolidSegments(w, gaps)) {
        const fill = look.walls === 'hatch' || style.hatch ? `url(#${hatchFor(style.fill)})` : look.walls === 'outline' ? look.wallOutlineFill(style.fill) : look.wallFill(style.fill);
        // two filled walls that meet leave a hair-thin seam where the edge drawn under them shows: a fill-colored 1 px stroke closes it
        body.push(`<polygon points="${pts(wallSegmentPolygon(w, s0, s1, corners))}" fill="${fill}"${look.walls === 'solid' ? '' : ` stroke="${fill}" stroke-width="1" ${hairline}`}/>`);
        const stripe = Math.min(0.05, w.thickness * 0.22);
        for (const side of ['l', 'r'] as const) {
          const skin = w.paint?.[side];
          const [t0, t1] = faceSpan(w, side, s0, s1, corners);
          if (skin) body.push(`<polyline points="${pts(wallFaceLine(w, t0, t1, side, stripe / 2))}" fill="none" stroke="${skin.color}" stroke-width="${n(stripe)}"/>`);
        }
      }
    }
    for (const op of d.openings) {
      const w = wallsHere.find((x) => x.id === op.wallId);
      if (w) body.push(openingSvg(w, op, look));
    }
    for (const s of onFloor(d.stairs)) {
      const inner = stairShapes(s)
        .map((sh) => {
          if (sh.t === 'poly') return `<polygon points="${flat(sh.pts)}" fill="${look.tone(stairPlanFill(s))}" stroke="${look.ink2}" stroke-width="${n(1.5 * look.lw)}" ${hairline}/>`;
          if (sh.t === 'ellipse') return `<ellipse cx="${n(sh.cx)}" cy="${n(sh.cy)}" rx="${n(sh.rx)}" ry="${n(sh.ry)}" fill="${sh.fill ? look.tone(stairPlanFill(s)) : 'none'}" stroke="${look.ink2}" stroke-width="${n(1.5 * look.lw)}" ${hairline}/>`;
          return `<polyline points="${flat(sh.pts)}" fill="none" stroke="${look.ink2}" stroke-width="${n(look.lw)}" stroke-linejoin="round" ${hairline}/>`;
        })
        .join('');
      const rails = s.railing ? (['a', 'b'] as const).filter((k) => s.railing![k]).map((k) => `<polyline points="${railPaths(s)[k].map((p) => `${n(p.x)},${n(p.y)}`).join(' ')}" fill="none" stroke="${railPlanColor(s.railing!)}" stroke-width="0.05" stroke-linecap="round"/>`).join('') : '';
      body.push(`<g transform="translate(${n(s.x)} ${n(s.y)}) rotate(${n(s.rotation)}) translate(${n(-s.w / 2)} ${n(-s.d / 2)})">${inner}${rails}</g>`);
    }
    // the stairwell of the stair coming up from the floor below, with its guard rail
    const at = d.floors.findIndex((f) => f.id === floor);
    for (const s of at > 0 ? d.stairs.filter((x) => x.floor === d.floors[at - 1].id && reachesNextFloor(x, d.settings.storeyHeight)) : []) {
      const hole = stairOutline(s).map((p) => `${n(p.x)},${n(p.y)}`).join(' ');
      const guard = s.railing && s.railing.guard !== false ? guardRuns(s, guardAvoid(d, s)).map((run) => `<polyline points="${run.map((p) => `${n(p.x)},${n(p.y)}`).join(' ')}" fill="none" stroke="${railPlanColor(s.railing!)}" stroke-width="0.06" stroke-linecap="round" stroke-linejoin="round"/>`).join('') : '';
      body.push(`<g transform="translate(${n(s.x)} ${n(s.y)}) rotate(${n(s.rotation)}) translate(${n(-s.w / 2)} ${n(-s.d / 2)})"><polygon points="${hole}" fill="rgba(71,85,105,0.16)" stroke="${look.ink2}" stroke-width="${n(1.5 * look.lw)}" stroke-dasharray="6 4" ${hairline}/>${guard}</g>`);
    }
  }
  // room names after the walls so they stay readable
  if (vis('rooms')) {
    for (const r of onFloor(d.rooms)) {
      if (polygonArea(r.points) < 2) continue;
      const c = labelPoint(r.points);
      const lines = look.roomLabel(t(r.name), formatArea(polygonArea(r.points)), r.level ? `${r.level > 0 ? '+' : '−'}${Math.abs(Math.round(r.level * 100))} cm` : '');
      lines.forEach((text, i) => body.push(L(text, c.x, c.y + (lines.length > 1 ? -0.05 + i * 0.27 : 0.07), (i ? 0.2 : 0.22) * look.labelScale, `font-weight="700" fill="${look.text}"`)));
    }
  }

  for (const layerId of ['furniture', 'tech'] as const) {
    if (!vis(layerId)) continue;
    for (const f of onFloor(d.furniture).filter((x) => catalogLayer(x.type) === layerId)) {
      body.push(furnitureSvg(f, look));
      const size = Math.min(0.2, Math.min(f.w, f.d) * 0.28);
      if (layerId === 'furniture' && Math.min(f.w, f.d) >= 0.5) body.push(L(f.label || catalogItem(f.type).label, f.x, f.y + size * 0.35, size, `fill="${look.ink}" opacity="0.85"`));
    }
  }

  if (vis('roofs')) {
    for (const r of onFloor(d.roofs)) {
      const plan = roofPlan(r);
      const col = look.roofLine(r.color);
      const xy = (list: { x: number; y: number }[]) => list.map((p) => `${n(p.x)},${n(p.y)}`).join(' ');
      const inner = [
        `<polygon points="${xy(plan.outline)}" fill="none" stroke="${col}" stroke-width="1.5" stroke-dasharray="8 5" ${hairline}/>`,
        `<polygon points="${xy(plan.footprint)}" fill="none" stroke="${col}" stroke-width="1" stroke-dasharray="2 4" opacity="0.4" ${hairline}/>`,
        ...plan.lines.map((l) => `<polyline points="${xy(l)}" fill="none" stroke="${col}" stroke-width="1.25" ${hairline}/>`),
        ...(plan.fall ? [`<polyline points="${xy(plan.fall)}" fill="none" stroke="${col}" stroke-width="1.25" ${hairline}/>`] : []),
      ].join('');
      body.push(`<g transform="translate(${n(r.x)} ${n(r.y)}) rotate(${n(r.rotation)})">${inner}</g>`);
    }
  }

  if (vis('notes')) {
    for (const l of onFloor(d.labels)) {
      const lines = l.text.split('\n');
      body.push(
        `<text transform="translate(${n(l.x)} ${n(l.y)}) rotate(${n(l.rotation)})" font-size="${n(l.size)}" text-anchor="middle" fill="${l.color}" ${FONTL}>${lines
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
      const c = look.dim;
      const tick = 0.1;
      const mid = { x: (m.a.x + m.b.x) / 2 + nx * 0.18, y: (m.a.y + m.b.y) / 2 + ny * 0.18 };
      body.push(
        `<g stroke="${c}" stroke-width="1.5" ${hairline}><line x1="${n(m.a.x)}" y1="${n(m.a.y)}" x2="${n(m.b.x)}" y2="${n(m.b.y)}"/><line x1="${n(m.a.x - nx * tick)}" y1="${n(m.a.y - ny * tick)}" x2="${n(m.a.x + nx * tick)}" y2="${n(m.a.y + ny * tick)}"/><line x1="${n(m.b.x - nx * tick)}" y1="${n(m.b.y - ny * tick)}" x2="${n(m.b.x + nx * tick)}" y2="${n(m.b.y + ny * tick)}"/></g>`,
        `<g transform="translate(${n(mid.x)} ${n(mid.y)}) rotate(${n(ang)})">${L(`${(Math.round(len * 100) / 100).toFixed(2)} m`, 0, 0.07, 0.2, `font-weight="700" fill="${c}"`)}</g>`,
      );
    }
  }

  if (vis('notes')) {
    // section lines cut the whole house, so they are on every floor
    for (const s of d.sections) {
      const v = sectionDirection(s);
      const len = Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y) || 1;
      const t = { x: (s.b.x - s.a.x) / len, y: (s.b.y - s.a.y) / len };
      const c = '#b91c1c';
      const ends = [s.a, s.b].map((p) => {
        const tip = { x: p.x + v.x * 0.45, y: p.y + v.y * 0.45 };
        const head = `<polyline points="${n(tip.x - v.x * 0.12 - t.x * 0.09)},${n(tip.y - v.y * 0.12 - t.y * 0.09)} ${n(tip.x)},${n(tip.y)} ${n(tip.x - v.x * 0.12 + t.x * 0.09)},${n(tip.y - v.y * 0.12 + t.y * 0.09)}" fill="none"/>`;
        const ring = { x: tip.x + v.x * 0.2, y: tip.y + v.y * 0.2 };
        return `<line x1="${n(p.x)}" y1="${n(p.y)}" x2="${n(tip.x)}" y2="${n(tip.y)}" stroke-width="3"/>${head}<circle cx="${n(ring.x)}" cy="${n(ring.y)}" r="0.17" fill="#fff"/><text x="${n(ring.x)}" y="${n(ring.y + 0.06)}" text-anchor="middle" font-size="0.2" font-weight="700" stroke="none" fill="${c}" ${FONT}>${esc(s.name.slice(0, 3))}</text>`;
      });
      body.push(`<g stroke="${c}" stroke-width="1.5" ${hairline}><line x1="${n(s.a.x)}" y1="${n(s.a.y)}" x2="${n(s.b.x)}" y2="${n(s.b.y)}" stroke-dasharray="0.3 0.08 0.06 0.08"/>${ends.join('')}</g>`);
    }
  }

  if (o.dimensions) {
    for (const l of autoDimensions(d, floor, 60)) body.push(`<g transform="translate(${n(l.x)} ${n(l.y)}) rotate(${n(l.angle)})">${L(l.text, 0, 0.06, 0.18, `font-weight="700" fill="${look.preset === 'colour' ? '#475569' : look.dim}"`)}</g>`);
  }

  // title, scale bar and north arrow inside the picture
  if (o.decorations) {
    const u = Math.max(W, H) / 40;
    const floorName = t(d.floors.find((f) => f.id === floor)?.name ?? '');
    body.push(`<text x="${n(x0 + margin * 0.6)}" y="${n(y0 + u * 1.5)}" font-size="${n(u * 1.2)}" font-weight="600" fill="${look.ink}" ${FONTL}>${esc(d.floors.length > 1 ? `${d.name} – ${floorName}` : d.name)}</text>`);
    const len = niceLength(1, Math.max(2, W * 0.15));
    const bx = x0 + margin * 0.6;
    const by = y0 + H - u * 1.2;
    body.push(`<g stroke="${look.ink}" stroke-width="${n(u * 0.12)}" fill="none"><polyline points="${n(bx)},${n(by - u * 0.6)} ${n(bx)},${n(by)} ${n(bx + len)},${n(by)} ${n(bx + len)},${n(by - u * 0.6)}"/></g><text x="${n(bx)}" y="${n(by + u * 0.95)}" font-size="${n(u * 0.9)}" ${FONTL} fill="${look.ink}">${len < 1 ? `${Math.round(len * 100)} cm` : `${len} m`}</text>`);
    const r = u * 1.6;
    body.push(`<g transform="translate(${n(x0 + W - margin * 0.6 - r)} ${n(y0 + r + u * 0.4)}) rotate(${n(d.site.north)})"><polygon points="0,${n(-r)} ${n(r * 0.3)},${n(r * 0.5)} 0,${n(r * 0.2)} ${n(-r * 0.3)},${n(r * 0.5)}" fill="${look.ink}"/><text y="${n(-r - u * 0.3)}" text-anchor="middle" font-size="${n(u * 1.1)}" font-weight="700" ${FONTL} fill="${look.ink}">${t('N')}</text></g>`);
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(x0)} ${n(y0)} ${n(W)} ${n(H)}" width="${n(W * o.pixelsPerMeter)}" height="${n(H * o.pixelsPerMeter)}">` +
    `<defs>${defs.join('')}</defs><rect x="${n(x0)}" y="${n(y0)}" width="${n(W)}" height="${n(H)}" fill="${look.paper}"/>${body.join('')}</svg>`;
  return { svg, width: W, height: H };
}
