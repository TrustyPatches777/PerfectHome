import { useEffect, useState } from 'react';
import { Group, Image as KImage } from 'react-konva';
import { loadTraceImage } from '../../trace';
import { useDesign } from '../../store/design';
import { useFloorId } from '../../store/floor';
import { useUi } from '../../store/ui';

/** The picture being traced on this floor, under everything else (and left out of the exported picture). */
export function TraceLayer() {
  const floorId = useFloorId();
  const designId = useDesign((s) => s.design.id);
  const trace = useDesign((s) => s.design.floors.find((f) => f.id === floorId)?.trace);
  const version = useUi((s) => s.traceVersion);
  const moving = useUi((s) => s.traceMove);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const has = !!trace;

  useEffect(() => {
    const url = has ? loadTraceImage(designId, floorId) : null;
    if (!url) {
      setImg(null);
      return;
    }
    const i = new window.Image();
    i.onload = () => setImg(i);
    i.src = url;
  }, [designId, floorId, has, version]);

  if (!trace || !trace.visible || !img) return null;
  const h = (trace.w * img.height) / img.width;
  return (
    <Group
      name="underlay"
      x={trace.x}
      y={trace.y}
      rotation={trace.rotation}
      listening={moving}
      draggable={moving}
      onDragEnd={(e) => {
        const { x, y } = e.target.position();
        useDesign.getState().update((d) => {
          const f = d.floors.find((i) => i.id === floorId);
          if (f?.trace) {
            f.trace.x = x;
            f.trace.y = y;
          }
        });
      }}
    >
      <KImage image={img} x={-trace.w / 2} y={-h / 2} width={trace.w} height={h} opacity={trace.opacity} />
    </Group>
  );
}
