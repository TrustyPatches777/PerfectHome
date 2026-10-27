/** Faces of walls as tile images (one square meter): brick, stone, wood cladding, ceramic tiles, concrete, plaster. */
import { shade } from '../catalog';

export function paintWall(g: CanvasRenderingContext2D, S: number, finish: string, color: string, rand: () => number) {
  const dark = shade(color, -0.28);
  const light = shade(color, 0.18);
  g.fillStyle = color;
  g.fillRect(0, 0, S, S);
  const noise = (n: number, alpha: number, size: number) => {
    for (let i = 0; i < n; i++) {
      g.fillStyle = rand() > 0.5 ? dark : light;
      g.globalAlpha = alpha;
      g.fillRect(rand() * S, rand() * S, 1 + rand() * size, 1 + rand() * size);
    }
    g.globalAlpha = 1;
  };
  if (finish === 'brick') {
    g.fillStyle = shade(color, 0.5); // mortar
    g.fillRect(0, 0, S, S);
    const rowH = S / 16;
    const bw = S / 4;
    for (let r = 0; r < 16; r++) {
      for (let x = -bw; x < S + bw; x += bw) {
        g.fillStyle = shade(color, (rand() - 0.5) * 0.22);
        g.fillRect(x + (r % 2 ? bw / 2 : 0) + 1.5, r * rowH + 1.5, bw - 3, rowH - 3);
      }
    }
  } else if (finish === 'stone') {
    g.fillStyle = dark;
    g.fillRect(0, 0, S, S);
    let y = 0;
    while (y < S) {
      const h = S / 7 + rand() * 12;
      let x = -rand() * 40;
      while (x < S) {
        const w = S / 4 + rand() * 40;
        g.fillStyle = shade(color, (rand() - 0.5) * 0.3);
        g.fillRect(x + 2, y + 2, w - 4, h - 4);
        x += w;
      }
      y += h;
    }
  } else if (finish === 'wood') {
    const plank = S / 8;
    for (let x = 0; x < S; x += plank) {
      g.fillStyle = shade(color, (rand() - 0.5) * 0.2);
      g.fillRect(x, 0, plank - 1.5, S);
      g.strokeStyle = dark;
      g.globalAlpha = 0.25;
      for (let k = 0; k < 6; k++) {
        g.beginPath();
        g.moveTo(x + rand() * plank, 0);
        g.lineTo(x + rand() * plank, S);
        g.stroke();
      }
      g.globalAlpha = 1;
      g.fillStyle = dark;
      g.fillRect(x + plank - 1.5, 0, 1.5, S);
    }
  } else if (finish === 'tiles') {
    const n = 4;
    g.fillStyle = shade(color, -0.2);
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        g.fillStyle = shade(color, (rand() - 0.5) * 0.08);
        g.fillRect((i * S) / n + 2, (j * S) / n + 2, S / n - 4, S / n - 4);
      }
    }
  } else if (finish === 'concrete') noise(1800, 0.35, 3);
  else noise(900, 0.18, 4); // plaster
}
