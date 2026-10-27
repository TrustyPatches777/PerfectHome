/**
 * A picture to trace a plan from (a scan of a drawing, a photo of a sketch). The picture itself is kept in this browser only: it
 * would make a shared link far too long. Where it lies on the plan (`Floor.trace`) travels with the design, the pixels do not.
 */
import type { Point } from './model';

const key = (designId: string, floorId: string) => `perfect-home:trace:${designId}:${floorId}`;

export function loadTraceImage(designId: string, floorId: string): string | null {
  try {
    return localStorage.getItem(key(designId, floorId));
  } catch {
    return null;
  }
}

export function saveTraceImage(designId: string, floorId: string, dataUrl: string): boolean {
  try {
    localStorage.setItem(key(designId, floorId), dataUrl);
    return true;
  } catch {
    return false;
  }
}

export function removeTraceImage(designId: string, floorId: string) {
  try {
    localStorage.removeItem(key(designId, floorId));
  } catch {
    /* nothing stored */
  }
}

/** Read a picture file and shrink it (longest side `maxPx`) to a JPEG data URL small enough to keep in the browser. */
export function pictureToDataUrl(file: File, maxPx = 1800): Promise<{ url: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That does not look like a picture (use a PNG or JPEG).'));
      img.onload = () => {
        const k = Math.min(1, maxPx / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * k));
        canvas.height = Math.max(1, Math.round(img.height * k));
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Could not process the picture.'));
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve({ url: canvas.toDataURL('image/jpeg', 0.85), width: canvas.width, height: canvas.height });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Make the picture the right size: `from` and `to` are two points on the plan that should be `target` meters apart (a measurement drawn
 * over something of known length in the picture). The picture grows or shrinks about `from`.
 */
export function calibrateTrace(trace: { x: number; y: number; w: number }, from: Point, to: Point, target: number): { x: number; y: number; w: number } | null {
  const len = Math.hypot(to.x - from.x, to.y - from.y);
  if (len < 1e-6 || !(target > 0)) return null;
  const k = target / len;
  return { x: from.x + (trace.x - from.x) * k, y: from.y + (trace.y - from.y) * k, w: trace.w * k };
}
