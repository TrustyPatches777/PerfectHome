import { Circle, Layer } from 'react-konva';
import { useDesign } from '../../store/design';
import { useUi } from '../../store/ui';
import { input } from '../input';
import { startCurveDrag, startDimensionEndpointDrag, startEndpointDrag, startPointDrag } from '../editing';
import { wallLength, wallPointAt } from '../../geometry';
import { SELECT_COLOR } from '../style';
import { WallTool } from '../tools/WallTool';
import { OpeningTool } from '../tools/OpeningTool';
import { RoomTool } from '../tools/RoomTool';
import { FurnitureTool } from '../tools/FurnitureTool';
import { MeasureTool } from '../tools/MeasureTool';
import { TextTool } from '../tools/TextTool';
import { ZoneTool } from '../tools/ZoneTool';
import { StripTool } from '../tools/StripTool';
import { StairTool } from '../tools/StairTool';
import { SelectionTransformer } from '../SelectionTransformer';

/** Always on top: drag handles for the selection and the active drawing tool's preview. */
export function OverlayLayer() {
  const tool = useUi((s) => s.tool);
  const doorKind = useUi((s) => s.doorKind);
  const windowKind = useUi((s) => s.windowKind);
  const sel = useUi((s) => s.selection);
  const zoom = useUi((s) => s.viewport.zoom);
  const design = useDesign((s) => s.design);
  const r = 6 / zoom;

  const handle = (key: string, x: number, y: number, onDown: (e: MouseEvent) => void, variant: 'corner' | 'curve' = 'corner') => (
    <Circle
      key={key}
      x={x}
      y={y}
      radius={variant === 'curve' ? r * 0.8 : r}
      fill={variant === 'curve' ? SELECT_COLOR : '#ffffff'}
      stroke={SELECT_COLOR}
      strokeWidth={2}
      strokeScaleEnabled={false}
      onMouseDown={(e) => {
        if (e.evt.button !== 0 || input.space) return;
        e.cancelBubble = true;
        onDown(e.evt);
      }}
      onMouseEnter={(e) => (e.target.getStage()!.container().style.cursor = 'move')}
      onMouseLeave={(e) => (e.target.getStage()!.container().style.cursor = '')}
    />
  );

  const handles = [];
  if (tool === 'select' && sel) {
    if (sel.kind === 'wall' && !design.layers.structure.locked) {
      const w = design.walls.find((x) => x.id === sel.id);
      if (w) {
        handles.push(handle('a', w.a.x, w.a.y, (e) => startEndpointDrag(e, w.id, 'a')));
        handles.push(handle('b', w.b.x, w.b.y, (e) => startEndpointDrag(e, w.id, 'b')));
        const mid = wallPointAt(w, wallLength(w) / 2).p;
        handles.push(handle('curve', mid.x, mid.y, (e) => startCurveDrag(e, w.id), 'curve'));
      }
    }
    if (sel.kind === 'dimension' && !design.layers.notes.locked) {
      const m = design.dimensions.find((x) => x.id === sel.id);
      if (m) {
        handles.push(handle('da', m.a.x, m.a.y, (e) => startDimensionEndpointDrag(e, m.id, 'a')));
        handles.push(handle('db', m.b.x, m.b.y, (e) => startDimensionEndpointDrag(e, m.id, 'b')));
      }
    }
    if ((sel.kind === 'zone' || sel.kind === 'strip') && !design.layers.outdoor.locked) {
      const item = (sel.kind === 'zone' ? design.zones : design.strips).find((x) => x.id === sel.id);
      item?.points.forEach((p, i) => handles.push(handle(`o${i}`, p.x, p.y, (e) => startPointDrag(e, sel.kind as 'zone' | 'strip', item.id, i))));
    }
    if (sel.kind === 'room' && !design.layers.rooms.locked) {
      const room = design.rooms.find((x) => x.id === sel.id);
      room?.points.forEach((p, i) => handles.push(handle(`v${i}`, p.x, p.y, (e) => startPointDrag(e, 'room', room.id, i))));
    }
  }

  return (
    <Layer>
      {handles}
      {tool === 'wall' && <WallTool />}
      {tool === 'door' && <OpeningTool kind={doorKind} />}
      {tool === 'window' && <OpeningTool kind={windowKind} />}
      {tool === 'room' && <RoomTool />}
      {tool === 'furniture' && <FurnitureTool />}
      {tool === 'measure' && <MeasureTool />}
      {tool === 'text' && <TextTool />}
      {tool === 'zone' && <ZoneTool />}
      {tool === 'strip' && <StripTool />}
      {tool === 'stairs' && <StairTool />}
      <SelectionTransformer />
    </Layer>
  );
}
