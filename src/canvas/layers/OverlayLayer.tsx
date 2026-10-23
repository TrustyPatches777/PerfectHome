import { Circle, Layer } from 'react-konva';
import { useDesign } from '../../store/design';
import { useUi } from '../../store/ui';
import { input } from '../input';
import { startDimensionEndpointDrag, startEndpointDrag, startRoomVertexDrag } from '../editing';
import { SELECT_COLOR } from '../style';
import { WallTool } from '../tools/WallTool';
import { OpeningTool } from '../tools/OpeningTool';
import { RoomTool } from '../tools/RoomTool';
import { FurnitureTool } from '../tools/FurnitureTool';
import { MeasureTool } from '../tools/MeasureTool';
import { TextTool } from '../tools/TextTool';
import { SelectionTransformer } from '../SelectionTransformer';

/** Always on top: drag handles for the selection and the active drawing tool's preview. */
export function OverlayLayer() {
  const tool = useUi((s) => s.tool);
  const doorKind = useUi((s) => s.doorKind);
  const sel = useUi((s) => s.selection);
  const zoom = useUi((s) => s.viewport.zoom);
  const design = useDesign((s) => s.design);
  const r = 6 / zoom;

  const handle = (key: string, x: number, y: number, onDown: (e: MouseEvent) => void) => (
    <Circle
      key={key}
      x={x}
      y={y}
      radius={r}
      fill="#ffffff"
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
      }
    }
    if (sel.kind === 'dimension' && !design.layers.notes.locked) {
      const m = design.dimensions.find((x) => x.id === sel.id);
      if (m) {
        handles.push(handle('da', m.a.x, m.a.y, (e) => startDimensionEndpointDrag(e, m.id, 'a')));
        handles.push(handle('db', m.b.x, m.b.y, (e) => startDimensionEndpointDrag(e, m.id, 'b')));
      }
    }
    if (sel.kind === 'room' && !design.layers.rooms.locked) {
      const room = design.rooms.find((x) => x.id === sel.id);
      room?.points.forEach((p, i) => handles.push(handle(`v${i}`, p.x, p.y, (e) => startRoomVertexDrag(e, room.id, i))));
    }
  }

  return (
    <Layer>
      {handles}
      {tool === 'wall' && <WallTool />}
      {tool === 'door' && <OpeningTool kind={doorKind} />}
      {tool === 'window' && <OpeningTool kind="window" />}
      {tool === 'room' && <RoomTool />}
      {tool === 'furniture' && <FurnitureTool />}
      {tool === 'measure' && <MeasureTool />}
      {tool === 'text' && <TextTool />}
      <SelectionTransformer />
    </Layer>
  );
}
