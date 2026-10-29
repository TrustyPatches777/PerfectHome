/** Finding things in a design by name and by kind (the Find dialog). Pure, so it can be tested. */
import { catalogItem } from './catalog';
import { wallPointAt } from './geometry';
import { ROOM_TYPE_LABEL, type Design, type ItemRef, type Point } from './model';
import { STAIR_DEFAULTS } from './stairs';
import { ROOF_STYLES } from './roofs';
import { WALL_STYLE } from './walls';
import { itemBounds } from './selection';
import { isWindowKind } from './windows';
import { localize, t } from './i18n';

export interface FoundItem {
  ref: ItemRef;
  /** What to show in the list: its name or what it is. */
  label: string;
  /** "Room", "Window" ... */
  what: string;
  floor: string;
  floorName: string;
  at: Point;
}

/** The kinds of things you can look for. */
export type FindKind = 'all' | 'wall' | 'opening' | 'room' | 'furniture' | 'stair' | 'outdoor' | 'roof' | 'text';
export const FIND_KINDS: { id: FindKind; label: string }[] = [
  { id: 'all', label: 'Everything' },
  { id: 'wall', label: 'Walls' },
  { id: 'opening', label: 'Doors & windows' },
  { id: 'room', label: 'Rooms' },
  { id: 'furniture', label: 'Furniture, lamps, sockets...' },
  { id: 'stair', label: 'Stairs' },
  { id: 'outdoor', label: 'Garden, fences, paths' },
  { id: 'roof', label: 'Roofs & skylights' },
  { id: 'text', label: 'Labels & sticky notes' },
];
localize(FIND_KINDS, ['label']);

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const OPENING_WORD: Record<string, string> = { door: 'Interior door', main: 'Main door', garden: 'Garden door', double: 'Double door', french: 'French door', sliding: 'Sliding door', window: 'Window', casement: 'Casement window', sash: 'Sash window', picture: 'Picture window', bay: 'Bay window', highwin: 'High window', floorwin: 'Floor-to-ceiling window', garage: 'Garage door', gap: 'Open passage' };
localize(OPENING_WORD, '*');
const STRIP_WORD: Record<string, string> = { road: 'Road', path: 'Path', fence: 'Fence', hedge: 'Hedge' };
localize(STRIP_WORD, '*');

/** Every item that matches `query` (all of the words, in its name or its kind) among the kinds asked for, on one floor or on all of them. */
export function findItems(d: Design, query: string, kind: FindKind = 'all', floor: string | null = null): FoundItem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const floorName = (id: string) => d.floors.find((f) => f.id === id)?.name ?? '';
  const out: FoundItem[] = [];
  const want = (k: FindKind) => kind === 'all' || kind === k;
  const add = (ref: ItemRef, label: string, what: string, floorId: string, at: Point | null, haystack: string) => {
    if (floor && floorId !== floor) return;
    const text = `${label} ${what} ${haystack}`.toLowerCase();
    if (!words.every((w) => text.includes(w))) return;
    out.push({ ref, label, what, floor: floorId, floorName: t(floorName(floorId)), at: at ?? { x: 0, y: 0 } });
  };
  const centre = (ref: ItemRef): Point | null => {
    const b = itemBounds(d, ref);
    return b && { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  };

  if (want('wall')) for (const w of d.walls) add({ kind: 'wall', id: w.id }, cap(WALL_STYLE[w.type]?.label ?? w.type), t('Wall'), w.floor, centre({ kind: 'wall', id: w.id }), `${w.type} wall ${w.paint ? 'painted covered' : ''}`);
  if (want('opening'))
    for (const o of d.openings) {
      const w = d.walls.find((x) => x.id === o.wallId);
      if (w) add({ kind: 'opening', id: o.id }, OPENING_WORD[o.kind] ?? o.kind, t('Opening'), w.floor, wallPointAt(w, o.pos).p, `${o.kind} ${isWindowKind(o.kind) ? 'window' : o.kind === 'gap' ? 'passage opening' : 'door'}`);
    }
  if (want('room'))
    for (const r of d.rooms) add({ kind: 'room', id: r.id }, t(r.name), r.type ? ROOM_TYPE_LABEL[r.type] : t('Room'), r.floor, centre({ kind: 'room', id: r.id }), `room ${r.type ?? ''}`);
  if (want('furniture'))
    for (const f of d.furniture) {
      const item = catalogItem(f.type);
      add({ kind: 'furniture', id: f.id }, f.label || item.label, t(item.category), f.floor, { x: f.x, y: f.y }, `${item.label} ${f.type} ${item.category}`);
    }
  if (want('stair')) for (const s of d.stairs) add({ kind: 'stair', id: s.id }, t('{kind} stairs', { kind: STAIR_DEFAULTS[s.kind].label }), t('Stairs'), s.floor, { x: s.x, y: s.y }, `stairs staircase ${s.kind}`);
  if (want('outdoor')) {
    for (const z of d.zones) add({ kind: 'zone', id: z.id }, t(z.name || cap(z.kind)), t('Outdoor area'), z.floor, centre({ kind: 'zone', id: z.id }), `${z.kind} garden area`);
    for (const s of d.strips) add({ kind: 'strip', id: s.id }, STRIP_WORD[s.kind] ?? cap(s.kind), t('Line'), s.floor, centre({ kind: 'strip', id: s.id }), `${s.kind} ${s.gates?.length ? 'gate' : ''} ${s.surface ?? ''}`);
  }
  if (want('roof')) {
    for (const r of d.roofs) add({ kind: 'roof', id: r.id }, t('{kind} roof', { kind: ROOF_STYLES[r.kind]?.label ?? cap(r.kind) }), t('Roof'), r.floor, { x: r.x, y: r.y }, `roof ${r.kind} ${r.material}`);
    for (const s of d.skylights) add({ kind: 'skylight', id: s.id }, t('Skylight'), t('Roof window'), s.floor, { x: s.x, y: s.y }, 'skylight roof window');
  }
  if (want('text')) {
    for (const l of d.labels) add({ kind: 'label', id: l.id }, l.text.split('\n')[0], t('Label'), l.floor, { x: l.x, y: l.y }, l.text);
    for (const n of d.notes) add({ kind: 'note', id: n.id }, n.text.split('\n')[0] || t('Sticky note'), t('Sticky note'), n.floor, { x: n.x, y: n.y }, `${n.text} ${n.author}`);
  }
  return out.slice(0, 300);
}
