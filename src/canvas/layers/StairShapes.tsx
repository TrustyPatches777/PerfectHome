import { Ellipse, Line } from 'react-konva';
import type { StairShape } from '../../stairs';

const OUTLINE = '#475569';

/**
 * Draws stair instructions (see stairs.ts) in the local box of a stair. `ghost` is the stairwell seen from the floor above: the
 * treads dashed and a darker void instead of the solid fill.
 */
export function StairShapes({ shapes, ghost, fill = '#f8fafc' }: { shapes: StairShape[]; ghost?: boolean; fill?: string }) {
  return (
    <>
      {shapes.map((s, i) => {
        if (s.t === 'poly')
          return <Line key={i} points={s.pts} closed fill={ghost ? 'rgba(71,85,105,0.16)' : fill} stroke={OUTLINE} strokeWidth={ghost ? 2 : 1.5} strokeScaleEnabled={false} dash={ghost ? [7, 4] : undefined} listening={false} />;
        if (s.t === 'ellipse')
          return <Ellipse key={i} x={s.cx} y={s.cy} radiusX={s.rx} radiusY={s.ry} fill={s.fill ? (ghost ? 'rgba(71,85,105,0.16)' : fill) : undefined} stroke={OUTLINE} strokeWidth={ghost ? 2 : 1.5} strokeScaleEnabled={false} dash={ghost ? [7, 4] : undefined} listening={false} />;
        return <Line key={i} points={s.pts} stroke={OUTLINE} strokeWidth={1} strokeScaleEnabled={false} lineJoin="round" dash={ghost ? [3, 3] : undefined} opacity={ghost ? 0.7 : 1} listening={false} />;
      })}
    </>
  );
}
