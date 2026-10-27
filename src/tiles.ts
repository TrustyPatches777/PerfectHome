/**
 * Tile layouts drawn on a canvas, shared by the floors (patterns.ts) and the walls (view3d/wallTex.ts): square tiles, brick bond,
 * herringbone, diamonds, a checkerboard and slabs of marble. Every layout repeats seamlessly, so it can tile a floor or a wall.
 */
import { shade } from './catalog';

type Ctx = CanvasRenderingContext2D;
type Rand = () => number;

/** Square tiles with grout between them (n x n in the image). */
export function squareTiles(g: Ctx, S: number, n: number, color: string, grout: string, rand: Rand) {
  g.fillStyle = grout;
  g.fillRect(0, 0, S, S);
  const t = S / n;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      g.fillStyle = shade(color, (rand() - 0.5) * 0.08);
      g.fillRect(x * t + 2, y * t + 2, t - 4, t - 4);
    }
}

/** Rows of 2:1 tiles, every other row shifted by half a tile (also called subway tiles). */
export function subwayTiles(g: Ctx, S: number, rows: number, color: string, grout: string, rand: Rand) {
  g.fillStyle = grout;
  g.fillRect(0, 0, S, S);
  const h = S / rows;
  const w = h * 2;
  for (let r = 0; r < rows; r++) {
    for (let x = -w; x < S + w; x += w) {
      g.fillStyle = shade(color, (rand() - 0.5) * 0.1);
      g.fillRect(x + (r % 2 ? w / 2 : 0) + 1.5, r * h + 1.5, w - 3, h - 3);
    }
  }
}

/**
 * Herringbone: planks four times as long as wide, laid in a zig-zag. The image holds eight plank widths each way, which is exactly one
 * period, so it repeats without a seam. (A horizontal plank starts where x - y is 0 mod 8; a vertical one where it is 7 mod 8.)
 */
export function herringbone(g: Ctx, S: number, color: string, grout: string, rand: Rand) {
  const u = S / 8;
  g.fillStyle = grout;
  g.fillRect(0, 0, S, S);
  for (let y = -8; y < 16; y++) {
    for (let x = -8; x < 16; x++) {
      const d = (((x - y) % 8) + 8) % 8;
      if (d !== 0 && d !== 7) continue;
      const horizontal = d === 0;
      g.fillStyle = shade(color, (rand() - 0.5) * 0.16);
      g.fillRect(x * u + 1, y * u + 1, (horizontal ? 4 : 1) * u - 2, (horizontal ? 1 : 4) * u - 2);
    }
  }
}

/** Tiles turned 45 degrees (diamonds). */
export function diamondTiles(g: Ctx, S: number, n: number, color: string, grout: string, rand: Rand) {
  g.fillStyle = grout;
  g.fillRect(0, 0, S, S);
  const s = S / n;
  const diamond = (cx: number, cy: number) => {
    const h = s / 2 - 1.5;
    g.beginPath();
    g.moveTo(cx, cy - h);
    g.lineTo(cx + h, cy);
    g.lineTo(cx, cy + h);
    g.lineTo(cx - h, cy);
    g.closePath();
    g.fillStyle = shade(color, (rand() - 0.5) * 0.1);
    g.fill();
  };
  for (let i = -1; i <= n; i++)
    for (let j = -1; j <= n; j++) {
      diamond(i * s, j * s);
      diamond(i * s + s / 2, j * s + s / 2);
    }
}

/** A checkerboard of two colors. */
export function checkerboard(g: Ctx, S: number, n: number, a: string, b: string) {
  const t = S / n;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      g.fillStyle = (x + y) % 2 ? b : a;
      g.fillRect(x * t, y * t, t, t);
    }
}

/** Slabs of marble (n x n in the image), each with its own soft clouds and veins, with a thin joint between them. */
export function marbleSlabs(g: Ctx, S: number, n: number, color: string, joint: string, rand: Rand) {
  g.fillStyle = joint;
  g.fillRect(0, 0, S, S);
  const t = S / n;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      g.save();
      g.beginPath();
      g.rect(x * t + 1.5, y * t + 1.5, t - 3, t - 3);
      g.clip();
      g.fillStyle = shade(color, (rand() - 0.5) * 0.08);
      g.fillRect(x * t, y * t, t, t);
      // clouds
      for (let k = 0; k < 6; k++) {
        const cx = x * t + rand() * t;
        const cy = y * t + rand() * t;
        const r = t * (0.25 + rand() * 0.35);
        const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
        const tone = rand() < 0.5 ? shade(color, 0.25) : shade(color, -0.12);
        grad.addColorStop(0, tone);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        g.globalAlpha = 0.35;
        g.fillStyle = grad;
        g.fillRect(cx - r, cy - r, 2 * r, 2 * r);
      }
      g.globalAlpha = 1;
      // veins: wandering lines, each with a thin branch
      g.strokeStyle = shade(color, -0.42);
      g.lineCap = 'round';
      for (let v = 0; v < 3; v++) {
        let px = x * t + rand() * t;
        let py = y * t;
        const pts: [number, number][] = [[px, py]];
        for (let k = 0; k < 9; k++) {
          px += (rand() - 0.5) * t * 0.35;
          py += (t / 9) * (0.7 + rand() * 0.6);
          pts.push([px, py]);
        }
        g.globalAlpha = 0.28 + rand() * 0.2;
        g.lineWidth = 0.8 + rand() * 1.8;
        g.beginPath();
        pts.forEach(([a, b], i) => (i ? g.lineTo(a, b) : g.moveTo(a, b)));
        g.stroke();
        const [bx, by] = pts[3 + Math.floor(rand() * 3)];
        g.globalAlpha = 0.18;
        g.lineWidth = 0.7;
        g.beginPath();
        g.moveTo(bx, by);
        g.lineTo(bx + (rand() - 0.5) * t * 0.5, by + rand() * t * 0.3);
        g.stroke();
      }
      g.globalAlpha = 1;
      g.restore();
    }
}

/** A wallpaper: the base color with a repeating motif in the second color. */
export function wallpaper(g: Ctx, S: number, pattern: string, base: string, ink: string, rand: Rand) {
  g.fillStyle = base;
  g.fillRect(0, 0, S, S);
  g.fillStyle = ink;
  g.strokeStyle = ink;
  if (pattern === 'dots') {
    const n = 8;
    const s = S / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        g.beginPath();
        g.arc((i + ((j % 2) * 0.5) + 0.25) * s, (j + 0.5) * s, s * 0.14, 0, Math.PI * 2);
        g.fill();
      }
  } else if (pattern === 'check') {
    // gingham: translucent bands across both ways
    g.globalAlpha = 0.3;
    const n = 8;
    for (let i = 0; i < n; i += 2) {
      g.fillRect((i * S) / n, 0, S / n, S);
      g.fillRect(0, (i * S) / n, S, S / n);
    }
    g.globalAlpha = 1;
  } else if (pattern === 'floral') {
    const n = 4;
    const s = S / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const cx = (i + ((j % 2) * 0.5) + 0.25) * s;
        const cy = (j + 0.5) * s;
        for (let p = 0; p < 5; p++) {
          const a = (p * 2 * Math.PI) / 5 + rand() * 0.15;
          g.beginPath();
          g.ellipse(cx + Math.cos(a) * s * 0.12, cy + Math.sin(a) * s * 0.12, s * 0.09, s * 0.06, a, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = base;
        g.beginPath();
        g.arc(cx, cy, s * 0.04, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = ink;
        g.globalAlpha = 0.6;
        g.beginPath();
        g.ellipse(cx + s * 0.3, cy + s * 0.2, s * 0.1, s * 0.04, 0.6, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
      }
  } else if (pattern === 'damask') {
    // a lattice of ornamental lozenges with a small crown on top
    const n = 3;
    const s = S / n;
    for (let i = -1; i <= n; i++)
      for (let j = -1; j <= n; j++)
        for (const [ox, oy] of [[0, 0], [0.5, 0.5]]) {
          const cx = (i + ox) * s;
          const cy = (j + oy) * s;
          g.beginPath();
          g.moveTo(cx, cy - s * 0.4);
          g.quadraticCurveTo(cx + s * 0.28, cy - s * 0.1, cx, cy + s * 0.4);
          g.quadraticCurveTo(cx - s * 0.28, cy - s * 0.1, cx, cy - s * 0.4);
          g.globalAlpha = 0.55;
          g.fill();
          g.globalAlpha = 1;
          g.beginPath();
          g.arc(cx, cy - s * 0.02, s * 0.06, 0, Math.PI * 2);
          g.fillStyle = base;
          g.fill();
          g.fillStyle = ink;
        }
  } else {
    // stripes (the default)
    const n = 10;
    for (let i = 0; i < n; i += 2) g.fillRect((i * S) / n, 0, S / n, S);
    g.globalAlpha = 0.5;
    for (let i = 0; i < n; i++) g.fillRect((i * S) / n + S / n / 2 - 1, 0, 2, S);
    g.globalAlpha = 1;
  }
}
