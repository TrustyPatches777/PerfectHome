import { useEffect, useRef } from 'react';
import { Transformer } from 'react-konva';
import type Konva from 'konva';
import { layerOfRef } from '../selection';
import { useDesign } from '../store/design';
import { useUi } from '../store/ui';
import { SELECT_COLOR } from './style';

const norm = (deg: number) => (((Math.round(deg * 10) / 10) % 360) + 360) % 360;
const cm = (m: number) => Math.round(m * 100) / 100;

/** Resize/rotate handles for the selected furniture (and rotate handle for text labels). */
export function SelectionTransformer() {
  const ref = useRef<Konva.Transformer>(null);
  const sel = useUi((s) => s.selection);
  const tool = useUi((s) => s.tool);
  const design = useDesign((s) => s.design);
  const zoom = useUi((s) => s.viewport.zoom);

  const kind = sel?.kind === 'furniture' || sel?.kind === 'label' || sel?.kind === 'stair' || sel?.kind === 'roof' ? sel.kind : null;
  const layer = sel && kind ? design.layers[layerOfRef(design, sel)] : null;
  const locked = layer ? layer.locked : false;
  const visible = layer ? layer.visible : false;
  const active = !!sel && !!kind && tool === 'select' && !locked && visible;

  // Re-attach after every design change: the node may have been re-created or resized.
  useEffect(() => {
    const tr = ref.current;
    if (!tr) return;
    const node = active ? tr.getStage()?.findOne<Konva.Node>(`#${sel!.id}`) : null;
    tr.nodes(node ? [node] : []);
    tr.forceUpdate();
    tr.getLayer()?.batchDraw();
  });

  const onEnd = () => {
    const tr = ref.current;
    const node = tr?.nodes()[0];
    if (!node || !sel) return;
    const sx = node.scaleX();
    const sy = node.scaleY();
    const rotation = norm(node.rotation());
    const x = node.x();
    const y = node.y();
    node.scale({ x: 1, y: 1 });
    useDesign.getState().update((d) => {
      if (sel.kind === 'furniture') {
        const f = d.furniture.find((i) => i.id === sel.id);
        if (!f) return;
        f.w = cm(f.w * sx);
        f.d = cm(f.d * sy);
        f.x = x;
        f.y = y;
        f.rotation = rotation;
      } else if (sel.kind === 'stair') {
        const st = d.stairs.find((i) => i.id === sel.id);
        if (!st) return;
        st.w = cm(Math.max(0.4, st.w * sx));
        st.d = cm(Math.max(0.4, st.d * sy));
        st.x = x;
        st.y = y;
        st.rotation = rotation;
      } else if (sel.kind === 'roof') {
        const r = d.roofs.find((i) => i.id === sel.id);
        if (!r) return;
        r.w = cm(Math.max(0.5, r.w * sx));
        r.d = cm(Math.max(0.5, r.d * sy));
        r.x = x;
        r.y = y;
        r.rotation = rotation;
      } else if (sel.kind === 'label') {
        const l = d.labels.find((i) => i.id === sel.id);
        if (!l) return;
        l.rotation = rotation;
        l.x = x;
        l.y = y;
      }
    });
  };

  // A thin item (a radiator, a socket) is narrower on the screen than the handles: the handles on its long sides would sit on top of it and
  // turn every attempt to move it into a resize. It keeps only the two at the ends of its long side.
  const item = sel?.kind === 'furniture' ? design.furniture.find((f) => f.id === sel.id) : undefined;
  const thin = item && Math.min(item.w, item.d) * zoom < 40;
  const anchors =
    sel?.kind === 'furniture' || sel?.kind === 'stair' || sel?.kind === 'roof'
      ? thin
        ? item.w >= item.d
          ? ['middle-left', 'middle-right']
          : ['top-center', 'bottom-center']
        : ['top-left', 'top-center', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right']
      : [];

  return (
    <Transformer
      ref={ref}
      rotateEnabled
      keepRatio={false}
      ignoreStroke
      enabledAnchors={anchors}
      rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
      rotationSnapTolerance={5}
      borderStroke={SELECT_COLOR}
      anchorStroke={SELECT_COLOR}
      anchorFill="#ffffff"
      anchorSize={9}
      anchorCornerRadius={2}
      rotateAnchorOffset={26}
      boundBoxFunc={(oldBox, newBox) => (newBox.width < 8 || newBox.height < 8 ? oldBox : newBox)}
      onTransformEnd={onEnd}
    />
  );
}
