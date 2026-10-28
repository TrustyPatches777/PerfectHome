/**
 * Procedural tile images for wall hatching and floor materials (wood, tiles, carpet...). Each pattern is a small
 * canvas that repeats; `meters` says how much of the plan one tile covers, so the pattern keeps its real-world
 * scale. Deterministic (seeded), so a floor looks the same every time and on every screen.
 */
import { shade } from './catalog';
import type { FloorMaterial } from './model';
import { parseSpec, textureImage, type PaintSpec } from './paintSpec';
import { checkerboard, herringbone, marbleSlabs, squareTiles, subwayTiles } from './tiles';

export type PatternKind = 'hatch' | Exclude<FloorMaterial, 'plain'>;

export interface Pattern {
  image: HTMLCanvasElement;
  /** Width/height of the canvas in pixels and how many meters of plan it covers. */
  size: number;
  meters: number;
}

const cache = new Map<string, Pattern>();

function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

type Painter = (ctx: CanvasRenderingContext2D, size: number, base: string, rand: () => number, spec: PaintSpec) => void;

const PAINTERS: Record<PatternKind, { meters: number; size: number; paint: Painter }> = {
  // diagonal lines over the wall color (load-bearing walls)
  hatch: {
    meters: 0.16,
    size: 48,
    paint(ctx, size, base, _rand, spec) {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = spec.second ?? 'rgba(255,255,255,0.45)'; // the plan style may want dark lines on white
      ctx.lineWidth = 3;
      for (let k = -size; k <= size * 2; k += size / 2) {
        ctx.beginPath();
        ctx.moveTo(k, size);
        ctx.lineTo(k + size, 0);
        ctx.stroke();
      }
    },
  },
  // long planks with staggered joints
  wood: {
    meters: 1.2,
    size: 240,
    paint(ctx, size, base, rand) {
      const rows = 10;
      const h = size / rows;
      for (let r = 0; r < rows; r++) {
        const joint = rand() * size;
        for (const [x0, x1] of [
          [0, joint],
          [joint, size],
        ]) {
          ctx.fillStyle = shade(base, (rand() - 0.5) * 0.12);
          ctx.fillRect(x0, r * h, x1 - x0, h);
          // grain
          ctx.strokeStyle = shade(base, -0.12);
          ctx.globalAlpha = 0.25;
          ctx.lineWidth = 1;
          for (let g = 0; g < 2; g++) {
            const y = r * h + 4 + rand() * (h - 8);
            ctx.beginPath();
            ctx.moveTo(x0 + 3, y);
            ctx.lineTo(x1 - 3, y + (rand() - 0.5) * 2);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
        ctx.strokeStyle = shade(base, -0.28);
        ctx.lineWidth = 1.2;
        ctx.strokeRect(0, r * h, size, h);
        ctx.beginPath();
        ctx.moveTo(joint, r * h);
        ctx.lineTo(joint, (r + 1) * h);
        ctx.stroke();
      }
    },
  },
  // small blocks laid in alternating directions (basket weave)
  parquet: {
    meters: 1.2,
    size: 240,
    paint(ctx, size, base, rand) {
      const block = size / 4;
      const strip = block / 4;
      for (let by = 0; by < 4; by++)
        for (let bx = 0; bx < 4; bx++) {
          const horizontal = (bx + by) % 2 === 0;
          for (let i = 0; i < 4; i++) {
            ctx.fillStyle = shade(base, (rand() - 0.5) * 0.14);
            const x = bx * block + (horizontal ? 0 : i * strip);
            const y = by * block + (horizontal ? i * strip : 0);
            const w = horizontal ? block : strip;
            const h = horizontal ? strip : block;
            ctx.fillRect(x, y, w, h);
            ctx.strokeStyle = shade(base, -0.3);
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, w, h);
          }
        }
    },
  },
  // square tiles with grout
  tile: {
    meters: 1.2,
    size: 240,
    paint(ctx, size, base, rand, spec) {
      squareTiles(ctx, size, 4, base, spec.second ?? shade(base, -0.2), rand);
    },
  },
  // small rectangular tiles in brick bond
  subway: {
    meters: 1.2,
    size: 240,
    paint(ctx, size, base, rand, spec) {
      subwayTiles(ctx, size, 8, base, spec.second ?? shade(base, -0.2), rand);
    },
  },
  // planks laid in a zig-zag
  herringbone: {
    meters: 1.2,
    size: 240,
    paint(ctx, size, base, rand, spec) {
      herringbone(ctx, size, base, spec.second ?? shade(base, -0.38), rand);
    },
  },
  // two colors, like a chess board
  checker: {
    meters: 1.2,
    size: 240,
    paint(ctx, size, base, _rand, spec) {
      checkerboard(ctx, size, 4, base, spec.second ?? shade(base, -0.78));
    },
  },
  // big slabs with veins
  marble: {
    meters: 1.2,
    size: 240,
    paint(ctx, size, base, rand, spec) {
      marbleSlabs(ctx, size, 2, base, spec.second ?? shade(base, -0.22), rand);
    },
  },
  // a picture you uploaded, laid over 1.2 m (its plain color until it has loaded or when it is not on this device)
  custom: {
    meters: 1.2,
    size: 256,
    paint(ctx, size, base, _rand, spec) {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, size, size);
      const img = spec.texture ? textureImage(spec.texture) : null;
      if (img) ctx.drawImage(img, 0, 0, size, size);
    },
  },
  // soft speckle
  carpet: {
    meters: 0.6,
    size: 120,
    paint(ctx, size, base, rand) {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 1400; i++) {
        ctx.fillStyle = shade(base, rand() < 0.5 ? 0.18 : -0.14);
        ctx.globalAlpha = 0.35;
        ctx.fillRect(rand() * size, rand() * size, 1.5, 1.5);
      }
      ctx.globalAlpha = 1;
    },
  },
  // irregular flagstones
  stone: {
    meters: 1.2,
    size: 240,
    paint(ctx, size, base, rand) {
      ctx.fillStyle = shade(base, -0.3);
      ctx.fillRect(0, 0, size, size);
      let y = 0;
      while (y < size) {
        const h = 40 + rand() * 40;
        let x = 0;
        while (x < size) {
          const w = 50 + rand() * 70;
          ctx.fillStyle = shade(base, (rand() - 0.5) * 0.16);
          ctx.fillRect(x + 1.5, y + 1.5, Math.min(w, size - x) - 3, Math.min(h, size - y) - 3);
          x += w;
        }
        y += h;
      }
    },
  },
  // smooth with faint speckle and a few cracks
  concrete: {
    meters: 1.2,
    size: 240,
    paint(ctx, size, base, rand) {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 600; i++) {
        ctx.fillStyle = shade(base, rand() < 0.5 ? 0.1 : -0.1);
        ctx.globalAlpha = 0.3;
        ctx.fillRect(rand() * size, rand() * size, 2, 2);
      }
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = shade(base, -0.4);
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        let x = rand() * size;
        let y = rand() * size;
        ctx.moveTo(x, y);
        for (let k = 0; k < 6; k++) {
          x += (rand() - 0.5) * 40;
          y += (rand() - 0.5) * 40;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },
  },
};

/** A tile image for `kind` in `color`, or null when canvases are unavailable (tests, server). */
export function patternFor(kind: PatternKind, colorSpec: string): Pattern | null {
  if (typeof document === 'undefined') return null;
  const key = `${kind}:${colorSpec}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const def = PAINTERS[kind];
  const image = document.createElement('canvas');
  image.width = def.size;
  image.height = def.size;
  const ctx = image.getContext('2d');
  if (!ctx) return null;
  const spec = parseSpec(colorSpec);
  def.paint(ctx, def.size, spec.base, rng(kind.length * 7919 + spec.base.length * 31), spec);
  const pattern = { image, size: def.size, meters: def.meters };
  // a picture that has not loaded yet is drawn again when it has: do not keep the placeholder
  if (!(kind === 'custom' && spec.texture && !textureImage(spec.texture))) cache.set(key, pattern);
  return pattern;
}

/** Props that make a Konva shape use a pattern (in plan meters) instead of a flat fill. (Konva's types say HTMLImageElement; any canvas works.) */
export function patternFillProps(p: Pattern) {
  return { fillPatternImage: p.image as unknown as HTMLImageElement, fillPatternScale: { x: p.meters / p.size, y: p.meters / p.size }, fillPatternRepeat: 'repeat' as const };
}
