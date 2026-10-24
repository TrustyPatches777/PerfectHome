/**
 * Everything that moves a whole design in or out of the app: startup, share links, autosave, files.
 * Rule of thumb: never throw away someone's work silently. Whenever a design is replaced, the old one is
 * stashed under BACKUP_KEY ("File → Restore previous design").
 */
import { contentBounds, fitView } from './canvas/camera';
import { getStage } from './canvas/stage';
import { niceLength } from './geometry';
import { isLive, joinLive, parseLiveHash, restoreLiveHash } from './live/live';
import { createDesign, serializeDesign, type Design } from './model';
import { buildPrintLayout, type PrintOptions } from './printLayout';
import { buildSvg } from './svgExport';
import {
  AUTOSAVE_KEY,
  BACKUP_KEY,
  LONG_LINK_WARNING,
  designFromHash,
  fileNameFor,
  isEmptyDesign,
  parseDesignJson,
  readSaved,
  sameContent,
  shareUrl,
  writeSaved,
} from './share';
import { useDesign } from './store/design';
import { floorId } from './store/floor';
import { useUi } from './store/ui';

const toast = (m: string) => useUi.getState().showToast(m);

/** True (with a hint) while a live session is open: whole-design replacements would change it for everybody. */
function blockedByLive(): boolean {
  if (!isLive()) return false;
  toast('You are in a live session. Leave it first (Live button), then open or replace a design.');
  restoreLiveHash();
  return true;
}

/** Replace the whole design (history is cleared) and show it. */
export function loadDesign(d: Design) {
  useDesign.getState().load(d);
  const ui = useUi.getState();
  ui.setActiveFloor(d.floors[0].id);
  ui.setTool('select');
  fitView(d);
}

/** Keep the current design as the backup before it gets replaced (unless it is empty). */
function stashCurrent(current: Design) {
  if (!isEmptyDesign(current)) writeSaved(BACKUP_KEY, current);
}

function clearHash() {
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
}

// ---- autosave -------------------------------------------------------------

let autosaving = false;

export function saveNow() {
  const ok = writeSaved(AUTOSAVE_KEY, useDesign.getState().design);
  useUi.getState().setSaveState({ at: ok ? Date.now() : useUi.getState().saveState.at, failed: !ok });
}

/** Debounced save of every change to localStorage. Started only once startup has decided what to show. */
function startAutosave() {
  if (autosaving) return;
  autosaving = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  useDesign.subscribe((s, prev) => {
    if (s.design === prev.design) return;
    clearTimeout(timer);
    timer = setTimeout(saveNow, 400);
  });
  const flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
      saveNow();
    }
  };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
}

// ---- opening a shared link --------------------------------------------------

/**
 * A design arrived through a link. If it would replace someone's own work, ask first.
 * `done` runs once the question is settled (immediately when no question was needed).
 */
function receiveLink(incoming: Design, current: Design | null, done: () => void) {
  if (blockedByLive()) return done();
  if (!current || isEmptyDesign(current)) {
    loadDesign(incoming);
    toast('Opened the shared design.');
    return done();
  }
  if (sameContent(current, incoming)) {
    toast('You already have this exact design.');
    return done();
  }
  useUi.getState().setDialog({
    type: 'link-conflict',
    incoming,
    current,
    sameDesign: current.id === incoming.id,
    choose: (useShared) => {
      useUi.getState().setDialog(null);
      if (useShared) {
        stashCurrent(current);
        loadDesign(incoming);
        toast('Opened the shared design. Your previous one is under File → Restore previous design.');
      }
      done();
    },
  });
}

let booted = false;

/** Run once at startup: restore the autosave and/or open a design from the URL hash. */
export function bootstrap() {
  if (booted) return;
  booted = true;

  const saved = readSaved(AUTOSAVE_KEY)?.design ?? null;
  if (saved) loadDesign(saved);

  // a live-session link: join it (asks first when it would replace work)
  const liveId = parseLiveHash(location.hash);
  if (liveId) {
    startAutosave();
    void joinLive(liveId);
    return watchHash();
  }

  let incoming: Design | null = null;
  try {
    incoming = designFromHash(location.hash);
  } catch (e) {
    toast((e as Error).message);
    clearHash();
  }

  const finish = () => {
    clearHash();
    startAutosave();
    saveNow();
  };
  if (incoming) receiveLink(incoming, saved, finish);
  else startAutosave();
  watchHash();
}

/** Pasting another link into the same tab only changes the hash. */
function watchHash() {
  window.addEventListener('hashchange', () => {
    const liveId = parseLiveHash(location.hash);
    if (liveId) return void joinLive(liveId);
    try {
      const next = designFromHash(location.hash);
      if (next) receiveLink(next, useDesign.getState().design, clearHash);
    } catch (e) {
      toast((e as Error).message);
      clearHash();
    }
  });
}

// ---- share ------------------------------------------------------------------

export async function shareLink() {
  const url = shareUrl(useDesign.getState().design, location.href);
  let copied = false;
  try {
    await navigator.clipboard.writeText(url);
    copied = true;
  } catch {
    /* clipboard blocked: the dialog shows the link to copy by hand */
  }
  useUi.getState().setDialog({ type: 'share', url, copied, long: url.length > LONG_LINK_WARNING });
}

export async function copyShareLink(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}

// ---- files --------------------------------------------------------------------

function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function exportJson() {
  const d = useDesign.getState().design;
  const text = JSON.stringify(JSON.parse(serializeDesign(d)), null, 2);
  download(new Blob([text], { type: 'application/json' }), fileNameFor(d, 'json'));
}

export async function importJsonFile(file: File) {
  if (blockedByLive()) return;
  try {
    const incoming = parseDesignJson(await file.text());
    stashCurrent(useDesign.getState().design);
    loadDesign(incoming);
    toast(`Imported “${incoming.name}”. Your previous design is under File → Restore previous design.`);
  } catch (e) {
    toast((e as Error).message);
  }
}

export function exportPng() {
  const stage = getStage();
  const d = useDesign.getState().design;
  const floor = floorId();
  const b = contentBounds(d, floor);
  if (!stage || !b) return toast('Nothing to export on this floor yet.');

  const margin = 0.8;
  const x0 = b.minX - margin;
  const y0 = b.minY - margin;
  const w = b.maxX - b.minX + margin * 2;
  const h = b.maxY - b.minY + margin * 2;
  const pxPerM = Math.min(120, 9000 / Math.max(w, h));
  const zoom = stage.scaleX();

  // Render the plan without the grid and the selection/tool overlay.
  const layers = stage.getLayers();
  const hide = [layers[0], layers[layers.length - 1]];
  hide.forEach((l) => l.visible(false));
  const underlay = [...stage.find('.underlay'), ...stage.find('.stickies')]; // not part of the picture
  underlay.forEach((n) => n.visible(false));
  const plan = stage.toCanvas({ x: stage.x() + x0 * zoom, y: stage.y() + y0 * zoom, width: w * zoom, height: h * zoom, pixelRatio: pxPerM / zoom });
  hide.forEach((l) => l.visible(true));
  underlay.forEach((n) => n.visible(true));
  stage.batchDraw();

  // White background, title and a scale bar.
  const out = document.createElement('canvas');
  out.width = plan.width;
  out.height = plan.height;
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(plan, 0, 0);
  const pad = Math.round(pxPerM * 0.25);
  ctx.fillStyle = '#1f2937';
  ctx.font = `600 ${Math.round(pxPerM * 0.28)}px system-ui, sans-serif`;
  ctx.textBaseline = 'top';
  const floorName = d.floors.find((f) => f.id === floor)?.name;
  ctx.fillText(d.floors.length > 1 && floorName ? `${d.name} – ${floorName}` : d.name, pad, pad);
  // north arrow in the top-right corner
  const r = pxPerM * 0.42;
  const cx = out.width - pad - r;
  const cy = pad + r;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((d.site.north * Math.PI) / 180);
  ctx.fillStyle = '#1f2937';
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(r * 0.3, r * 0.5);
  ctx.lineTo(0, r * 0.2);
  ctx.lineTo(-r * 0.3, r * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.font = `700 ${Math.round(r * 0.5)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('N', 0, -r - r * 0.18 - r * 0.2);
  ctx.restore();
  ctx.textAlign = 'left';
  const len = niceLength(pxPerM, pxPerM * 1.2);
  const barY = out.height - pad - Math.round(pxPerM * 0.3);
  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = Math.max(2, pxPerM * 0.03);
  ctx.beginPath();
  ctx.moveTo(pad, barY - pxPerM * 0.1);
  ctx.lineTo(pad, barY);
  ctx.lineTo(pad + len * pxPerM, barY);
  ctx.lineTo(pad + len * pxPerM, barY - pxPerM * 0.1);
  ctx.stroke();
  ctx.font = `${Math.round(pxPerM * 0.2)}px system-ui, sans-serif`;
  ctx.fillText(len < 1 ? `${Math.round(len * 100)} cm` : `${len} m`, pad, barY + pxPerM * 0.05);

  out.toBlob((blob) => (blob ? download(blob, fileNameFor(d, 'png')) : toast('Could not create the image.')), 'image/png');
}

// ---- new / restore -----------------------------------------------------------------

export function newDesign() {
  if (blockedByLive()) return;
  const current = useDesign.getState().design;
  stashCurrent(current);
  loadDesign(createDesign());
  toast('Started a new design. The previous one is under File → Restore previous design.');
}

export const hasBackup = () => readSaved(BACKUP_KEY) !== null;

export function restoreBackup() {
  if (blockedByLive()) return;
  const backup = readSaved(BACKUP_KEY);
  if (!backup) return toast('There is no previous design to restore.');
  const current = useDesign.getState().design;
  stashCurrent(current); // swap, so restoring twice gets you back
  loadDesign(backup.design);
  toast('Restored the previous design.');
}

// ---- SVG and printing -----------------------------------------------------------------

/** Download the current floor as an SVG drawing (vector; 1 m = 100 px). */
export function exportSvg() {
  const d = useDesign.getState().design;
  const floor = floorId();
  const plan = buildSvg(d, floor, { decorations: true });
  if (!plan) return toast('Nothing to export on this floor yet.');
  const floorName = d.floors.find((f) => f.id === floor)?.name ?? '';
  const slug = (t: string) => fileNameFor({ ...d, name: t }, 'x').slice(0, -2);
  const name = `${slug(d.name)}${d.floors.length > 1 ? `-${slug(floorName)}` : ''}.svg`;
  download(new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${plan.svg}`], { type: 'image/svg+xml' }), name);
}

/**
 * Print at true scale: the pages are built as HTML in a hidden frame and sent to the browser's print dialog,
 * where "Save as PDF" makes a PDF. The frame is kept for a while so the dialog can finish.
 */
export function printPlan(opts: PrintOptions) {
  const layout = buildPrintLayout(useDesign.getState().design, floorId(), opts);
  if (!layout.html) return toast('Nothing to print on this floor yet.');
  document.querySelectorAll('iframe.print-frame').forEach((f) => f.remove());
  const frame = document.createElement('iframe');
  frame.className = 'print-frame';
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  frame.srcdoc = layout.html;
  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      toast('Could not open the print window.');
    }
  };
  document.body.appendChild(frame);
  setTimeout(() => frame.remove(), 120_000);
}
