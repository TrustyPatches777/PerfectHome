/**
 * The area table: room sizes per floor, outdoor areas, and the figures that matter for the plot: how much of it the
 * house covers and how far the house is from the boundary. Pure, so it is easy to test.
 */
import { polygonOutlineDistance } from './distance';
import { formatArea, pointInPolygon, polygonArea, wallOutlinePoints } from './geometry';
import type { Design, Point, ZoneKind } from './model';
import { ZONE_STYLES } from './outdoor';
import { groundIndex } from './shadows';

export interface RoomArea {
  id: string;
  name: string;
  area: number;
  living: boolean;
}

export interface FloorArea {
  floorId: string;
  name: string;
  rooms: RoomArea[];
  total: number;
  living: number;
}

export interface EdgeDistance {
  /** 1-based number of the plot's side, in the order the corners were drawn. */
  index: number;
  length: number;
  distance: number;
  /** The closest points on the building and on that side, to draw a line between. */
  from: Point;
  to: Point;
}

export interface PlotFigures {
  plotArea: number;
  /** Area of the building on the ground floor (walls and rooms together). */
  footprint: number;
  /** Footprint as a share of the plot, 0..1. */
  coverage: number;
  /** All rooms on all floors as a share of the plot (an approximation of the floor area ratio). */
  floorAreaRatio: number;
  /** Footprint plus terraces and driveways as a share of the plot (what is built or paved). */
  sealed: number;
  /** Smallest distance from the building to the plot boundary, or null when there is no building. */
  nearest: EdgeDistance | null;
  edges: EdgeDistance[];
  /** True when part of the building lies outside the plot. */
  outside: boolean;
}

export interface AreaReport {
  floors: FloorArea[];
  totalRooms: number;
  totalLiving: number;
  outdoor: { kind: ZoneKind; label: string; area: number }[];
  plot: PlotFigures | null;
}

/** Outlines of the ground-floor building: every room and every wall. */
export function footprintPolygons(d: Design): Point[][] {
  const ground = d.floors[groundIndex(d)].id;
  return [...d.rooms.filter((r) => r.floor === ground).map((r) => r.points), ...d.walls.filter((w) => w.floor === ground).map((w) => wallOutlinePoints(w))];
}

/** Area of the union of some polygons (counted on a fine grid, so overlaps are not counted twice). */
export function unionArea(polys: Point[][]): number {
  if (!polys.length) return 0;
  const all = polys.flat();
  const minX = Math.min(...all.map((p) => p.x));
  const maxX = Math.max(...all.map((p) => p.x));
  const minY = Math.min(...all.map((p) => p.y));
  const maxY = Math.max(...all.map((p) => p.y));
  const c = Math.max(0.025, Math.sqrt(((maxX - minX) * (maxY - minY)) / 2e6));
  const nx = Math.ceil((maxX - minX) / c) + 1;
  const ny = Math.ceil((maxY - minY) / c) + 1;
  const cells = new Uint8Array(nx * ny);
  for (const poly of polys) {
    const x0 = Math.max(0, Math.floor((Math.min(...poly.map((p) => p.x)) - minX) / c));
    const x1 = Math.min(nx - 1, Math.ceil((Math.max(...poly.map((p) => p.x)) - minX) / c));
    const y0 = Math.max(0, Math.floor((Math.min(...poly.map((p) => p.y)) - minY) / c));
    const y1 = Math.min(ny - 1, Math.ceil((Math.max(...poly.map((p) => p.y)) - minY) / c));
    for (let j = y0; j <= y1; j++)
      for (let i = x0; i <= x1; i++) {
        if (!cells[j * nx + i] && pointInPolygon({ x: minX + (i + 0.5) * c, y: minY + (j + 0.5) * c }, poly)) cells[j * nx + i] = 1;
      }
  }
  let n = 0;
  for (const v of cells) n += v;
  return n * c * c;
}

export function areaReport(d: Design): AreaReport {
  const floors: FloorArea[] = [...d.floors].reverse().map((f) => {
    const rooms = d.rooms.filter((r) => r.floor === f.id).map((r) => ({ id: r.id, name: r.name, area: polygonArea(r.points), living: r.living }));
    return { floorId: f.id, name: f.name, rooms, total: rooms.reduce((s, r) => s + r.area, 0), living: rooms.filter((r) => r.living).reduce((s, r) => s + r.area, 0) };
  });
  const totalRooms = floors.reduce((s, f) => s + f.total, 0);
  const totalLiving = floors.reduce((s, f) => s + f.living, 0);

  const byKind = new Map<ZoneKind, number>();
  for (const z of d.zones) byKind.set(z.kind, (byKind.get(z.kind) ?? 0) + polygonArea(z.points));
  const outdoor = [...byKind].filter(([k]) => k !== 'plot').map(([kind, area]) => ({ kind, label: ZONE_STYLES[kind].label, area }));

  // the plot: the largest plot boundary
  const plots = d.zones.filter((z) => z.kind === 'plot').sort((a, b) => polygonArea(b.points) - polygonArea(a.points));
  let plot: PlotFigures | null = null;
  if (plots.length) {
    const boundary = plots[0].points;
    const plotArea = polygonArea(boundary);
    const building = footprintPolygons(d);
    const footprint = unionArea(building);
    const paved = (byKind.get('terrace') ?? 0) + (byKind.get('driveway') ?? 0);
    const edges: EdgeDistance[] = [];
    if (building.length) {
      for (let i = 0; i < boundary.length; i++) {
        const a = boundary[i];
        const b = boundary[(i + 1) % boundary.length];
        const near = building
          .map((poly) => polygonOutlineDistance(poly, [a, b]))
          .filter((r): r is NonNullable<typeof r> => !!r)
          .sort((p, q) => p.d - q.d)[0];
        if (near) edges.push({ index: i + 1, length: Math.hypot(b.x - a.x, b.y - a.y), distance: near.d, from: near.p, to: near.q });
      }
    }
    plot = {
      plotArea,
      footprint,
      coverage: plotArea ? footprint / plotArea : 0,
      floorAreaRatio: plotArea ? totalRooms / plotArea : 0,
      sealed: plotArea ? (footprint + paved) / plotArea : 0,
      nearest: edges.length ? edges.reduce((best, e) => (e.distance < best.distance ? e : best)) : null,
      edges,
      outside: building.some((poly) => poly.some((p) => !pointInPolygon(p, boundary))),
    };
  }
  return { floors, totalRooms, totalLiving, outdoor, plot };
}

const pct = (v: number) => `${(Math.round(v * 1000) / 10).toFixed(1)} %`;
const meters = (v: number) => `${(Math.round(v * 100) / 100).toFixed(2)} m`;

/** The report as plain text, for pasting into a message. */
export function reportToText(r: AreaReport, designName: string): string {
  const lines = [`${designName}: areas`, ''];
  for (const f of r.floors) {
    if (!f.rooms.length) continue;
    lines.push(f.name);
    for (const room of f.rooms) lines.push(`  ${room.name}: ${formatArea(room.area)}${room.living ? '' : ' (not counted as living area)'}`);
    lines.push(`  Total: ${formatArea(f.total)} · living area ${formatArea(f.living)}`, '');
  }
  lines.push(`All rooms: ${formatArea(r.totalRooms)}`, `Living area: ${formatArea(r.totalLiving)}`);
  if (r.outdoor.length) {
    lines.push('', 'Outdoor');
    for (const o of r.outdoor) lines.push(`  ${o.label}: ${formatArea(o.area)}`);
  }
  if (r.plot) {
    const p = r.plot;
    lines.push('', 'Plot', `  Plot area: ${formatArea(p.plotArea)}`, `  Building footprint: ${formatArea(p.footprint)} (${pct(p.coverage)} of the plot)`, `  Floor area / plot area: ${(Math.round(p.floorAreaRatio * 100) / 100).toFixed(2)}`, `  Built and paved: ${pct(p.sealed)}`);
    if (p.nearest) lines.push(`  Closest to the boundary: ${meters(p.nearest.distance)}`);
    for (const e of p.edges) lines.push(`  Side ${e.index} (${meters(e.length)} long): house is ${meters(e.distance)} away`);
    if (p.outside) lines.push('  Warning: part of the building lies outside the plot.');
  }
  return lines.join('\n');
}

const csvCell = (v: string | number) => (/[",\n;]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

/** Rooms as CSV (floor, room, area in m², living area). */
export function reportToCsv(r: AreaReport): string {
  const rows = [['Floor', 'Room', 'Area (m2)', 'Living area']];
  for (const f of r.floors) for (const room of f.rooms) rows.push([f.name, room.name, (Math.round(room.area * 100) / 100).toFixed(2), room.living ? 'yes' : 'no']);
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}
