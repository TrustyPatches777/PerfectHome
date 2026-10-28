import { Ellipse, Line } from 'react-konva';
import type { StairShape } from '../../stairs';
import { useLook } from '../look';

/**
 * Draws stair instructions (see stairs.ts) in the local box of a stair. `ghost` is the stairwell seen from the floor above: the
 * treads dashed and a darker void instead of the solid fill.
 */
export function StairShapes({ shapes, ghost, fill }: { shapes: StairShape[]; ghost?: boolean; fill?: string }) {
  const look = useLook();
  const OUTLINE = look.ink2;
  const lw = look.lw;
  fill = fill ?? look.tone('#f8fafc');
  return (
    <>
      {shapes.map((s, i) => {
        if (s.t === 'poly')
          return <Line key={i} points={s.pts} closed fill={ghost ? 'rgba(71,85,105,0.16)' : fill} stroke={OUTLINE} strokeWidth={(ghost ? 2 : 1.5) * lw} strokeScaleEnabled={false} dash={ghost ? [7, 4] : undefined} listening={false} />;
        if (s.t === 'ellipse')
          return <Ellipse key={i} x={s.cx} y={s.cy} radiusX={s.rx} radiusY={s.ry} fill={s.fill ? (ghost ? 'rgba(71,85,105,0.16)' : fill) : undefined} stroke={OUTLINE} strokeWidth={(ghost ? 2 : 1.5) * lw} strokeScaleEnabled={false} dash={ghost ? [7, 4] : undefined} listening={false} />;
        return <Line key={i} points={s.pts} stroke={OUTLINE} strokeWidth={lw} strokeScaleEnabled={false} lineJoin="round" dash={ghost ? [3, 3] : undefined} opacity={ghost ? 0.7 : 1} listening={false} />;
      })}
    </>
  );
}
