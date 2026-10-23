import { Ellipse, Line } from 'react-konva';
import type { StairShape } from '../../stairs';

const OUTLINE = '#475569';

/** Draws stair instructions (see stairs.ts) in the local box of a stair. */
export function StairShapes({ shapes, ghost }: { shapes: StairShape[]; ghost?: boolean }) {
  return (
    <>
      {shapes.map((s, i) => {
        if (s.t === 'poly')
          return <Line key={i} points={s.pts} closed fill={ghost ? 'rgba(148,163,184,0.12)' : '#f8fafc'} stroke={OUTLINE} strokeWidth={1.5} strokeScaleEnabled={false} dash={ghost ? [6, 4] : undefined} listening={false} />;
        if (ghost) return null;
        if (s.t === 'ellipse')
          return <Ellipse key={i} x={s.cx} y={s.cy} radiusX={s.rx} radiusY={s.ry} fill={s.fill ? '#f8fafc' : undefined} stroke={OUTLINE} strokeWidth={1.5} strokeScaleEnabled={false} listening={false} />;
        return <Line key={i} points={s.pts} stroke={OUTLINE} strokeWidth={1} strokeScaleEnabled={false} lineJoin="round" listening={false} />;
      })}
    </>
  );
}
