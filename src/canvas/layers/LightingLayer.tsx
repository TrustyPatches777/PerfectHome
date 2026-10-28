import { useMemo } from 'react';
import { Layer, Shape } from 'react-konva';
import type { Context } from 'konva/lib/Context';
import { catalogItem } from '../../catalog';
import type { Point } from '../../model';
import { computeShadows, VEIL_STRENGTH } from '../../shadows';
import { darkness, goldenHour, sunPosition } from '../../sun';
import { useDesign } from '../../store/design';
import { useFloorId } from '../../store/floor';
import { useUi } from '../../store/ui';

function path(ctx: Context, polys: Point[][]) {
  ctx.beginPath();
  for (const poly of polys) {
    poly.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
  }
}

/**
 * The "Sun & shadows" layer: shadows of walls, furniture, trees and the house, a warm tint at sunrise/sunset, and a
 * dark evening overlay with glowing lamps. It only paints; nothing on it can be clicked. The Konva layer always
 * exists (so layer order is stable) and just draws nothing while the layer is hidden.
 */
export function LightingLayer() {
  const design = useDesign((s) => s.design);
  const floor = useFloorId();
  const hour = useUi((s) => s.timeOfDay);
  const visible = design.layers.shadows.visible;
  const { lat, month, day } = design.site;

  const sun = useMemo(() => sunPosition(lat, month, day, hour), [lat, month, day, hour]);
  const shadowSet = useMemo(() => (visible ? computeShadows(design, floor, sun) : { shadows: [], veils: [], cutouts: [] }), [visible, design, floor, sun]);
  const lamps = useMemo(
    () =>
      visible
        ? design.furniture
            .filter((f) => f.floor === floor && f.on !== false)
            .flatMap((f) => {
              const lamp = catalogItem(f.type).lamp;
              return lamp ? [{ x: f.x, y: f.y, radius: lamp.radius, color: lamp.color }] : [];
            })
        : [],
    [visible, design.furniture, floor],
  );

  const dark = darkness(sun.elevation);
  const golden = goldenHour(sun.elevation);

  return (
    <Layer listening={false}>
      {visible && (
        <Shape
          sceneFunc={(ctx) => {
            // 1. sun shadows, with the building's own footprint kept light
            if (shadowSet.shadows.length || shadowSet.veils.length) {
              if (shadowSet.shadows.length) {
                path(ctx, shadowSet.shadows);
                ctx.setAttr('fillStyle', `rgba(15,23,42,${0.34 * (1 - dark)})`);
                ctx.fill();
              }
              if (shadowSet.veils.length) {
                path(ctx, shadowSet.veils);
                ctx.setAttr('fillStyle', `rgba(15,23,42,${0.34 * (1 - dark) * VEIL_STRENGTH})`);
                ctx.fill();
              }
              if (shadowSet.cutouts.length) {
                ctx.setAttr('globalCompositeOperation', 'destination-out');
                path(ctx, shadowSet.cutouts);
                ctx.setAttr('fillStyle', '#000');
                ctx.fill();
                ctx.setAttr('globalCompositeOperation', 'source-over');
              }
            }
            // 2. warm light low in the sky
            if (golden > 0) {
              ctx.setAttr('fillStyle', `rgba(255,150,60,${golden * 0.12})`);
              ctx.fillRect(-BIG, -BIG, 2 * BIG, 2 * BIG);
            }
            // 3. night: a dark overlay with light pools around the lamps that are switched on
            if (dark > 0.01) {
              ctx.setAttr('fillStyle', `rgba(8,16,44,${dark * 0.66})`);
              ctx.fillRect(-BIG, -BIG, 2 * BIG, 2 * BIG);
              ctx.setAttr('globalCompositeOperation', 'destination-out');
              for (const l of lamps) {
                const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.radius);
                g.addColorStop(0, `rgba(0,0,0,${Math.min(1, dark * 1.4)})`);
                g.addColorStop(0.55, `rgba(0,0,0,${dark * 0.7})`);
                g.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.setAttr('fillStyle', g);
                ctx.beginPath();
                ctx.arc(l.x, l.y, l.radius, 0, Math.PI * 2);
                ctx.fill();
              }
              ctx.setAttr('globalCompositeOperation', 'source-over');
              for (const l of lamps) {
                const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.radius);
                g.addColorStop(0, l.color + toHexAlpha(dark * 0.55));
                g.addColorStop(1, l.color + '00');
                ctx.setAttr('fillStyle', g);
                ctx.beginPath();
                ctx.arc(l.x, l.y, l.radius, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          }}
        />
      )}
    </Layer>
  );
}

/** Half the side of the big square used for full-plan tints (so exports larger than the screen are covered too). */
const BIG = 5000;

const toHexAlpha = (a: number) =>
  Math.round(Math.min(1, Math.max(0, a)) * 255)
    .toString(16)
    .padStart(2, '0');
