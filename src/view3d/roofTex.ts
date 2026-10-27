/** Tile images for roof coverings (clay tiles, slate, metal ribs...), one square meter each, tinted by the roof's color. */
import { shade } from '../catalog';
import { paintWall } from './wallTex';

const cache = new Map<string, HTMLCanvasElement>();

function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** A canvas covering 1 m x 1 m of roof, or null where there are no canvases (tests). */
export function roofImage(material: string, color: string): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const key = `${material}|${color}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  if (!g) return null;
  const rand = rng(material.length * 9973 + color.length * 31);
  if (material.startsWith('wall-')) {
    // the covering of a wall face: brick, stone, wood...
    paintWall(g, S, material.slice(5), color, rand);
    cache.set(key, c);
    return c;
  }
  g.fillStyle = color;
  g.fillRect(0, 0, S, S);
  const dark = shade(color, -0.28);
  const light = shade(color, 0.18);
  const rows = (rowH: number, tileW: number, round: boolean, vary: number) => {
    for (let r = 0; r * rowH < S + rowH; r++) {
      const off = r % 2 ? tileW / 2 : 0;
      for (let x = -tileW; x < S + tileW; x += tileW) {
        g.fillStyle = shade(color, (rand() - 0.5) * vary);
        g.fillRect(x + off, r * rowH, tileW - 1, rowH - 1);
        if (round) {
          g.fillStyle = dark;
          g.fillRect(x + off, r * rowH + rowH - 4, tileW - 1, 3);
        }
      }
      g.fillStyle = dark;
      g.fillRect(0, r * rowH + rowH - 2, S, 2);
    }
  };
  switch (material) {
    case 'tiles':
      rows(S / 6, S / 7, true, 0.16);
      break;
    case 'slate':
      rows(S / 8, S / 6, false, 0.14);
      break;
    case 'shingle':
      rows(S / 9, S / 8, true, 0.2);
      break;
    case 'metal':
      for (let x = 0; x < S; x += S / 4) {
        g.fillStyle = light;
        g.fillRect(x, 0, 5, S);
        g.fillStyle = dark;
        g.fillRect(x + 5, 0, 3, S);
      }
      break;
    case 'thatch':
      for (let i = 0; i < 700; i++) {
        g.strokeStyle = rand() > 0.5 ? dark : light;
        g.globalAlpha = 0.5;
        g.lineWidth = 1.5;
        const x = rand() * S;
        const y = rand() * S;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + (rand() - 0.5) * 6, y + 18 + rand() * 20);
        g.stroke();
      }
      g.globalAlpha = 1;
      break;
    case 'green':
    case 'gravel':
      for (let i = 0; i < 1600; i++) {
        g.fillStyle = rand() > 0.5 ? dark : light;
        g.globalAlpha = 0.6;
        g.fillRect(rand() * S, rand() * S, 2 + rand() * 3, 2 + rand() * 3);
      }
      g.globalAlpha = 1;
      break;
  }
  cache.set(key, c);
  return c;
}
