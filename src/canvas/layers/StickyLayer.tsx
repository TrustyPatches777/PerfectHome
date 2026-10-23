import { useState } from 'react';
import { Group, Label, Rect, Tag, Text } from 'react-konva';
import { readableOn } from '../../identity';
import { useDesign } from '../../store/design';
import { useOnFloor } from '../../store/floor';
import { useIsMulti, useSelectedIds, useUi } from '../../store/ui';
import { input } from '../input';
import { pressItem } from '../press';
import { SELECT_COLOR } from '../style';

/** Sticky notes: small pins in their author's color that always stay the same size on screen. The text shows on hover or when selected. */
export function StickyLayer() {
  const notes = useOnFloor((d) => d.notes);
  const layer = useDesign((s) => s.design.layers.comments);
  const tool = useUi((s) => s.tool);
  const zoom = useUi((s) => s.viewport.zoom);
  const selectedIds = useSelectedIds('note');
  const multi = useIsMulti();
  const [hover, setHover] = useState<string | null>(null);
  if (!layer.visible) return null;
  const interactive = tool === 'select' && !layer.locked;
  const px = 1 / zoom;
  const SIZE = 26;

  return (
    <Group name="stickies" listening={interactive}>
      {notes.map((n) => {
        const selected = selectedIds.has(n.id);
        const showCard = (selected && !multi) || hover === n.id;
        return (
          <Group
            key={n.id}
            id={n.id}
            x={n.x}
            y={n.y}
            scaleX={px}
            scaleY={px}
            opacity={n.done ? 0.5 : 1}
            onMouseEnter={(e) => {
              setHover(n.id);
              e.target.getStage()!.container().style.cursor = 'pointer';
            }}
            onMouseLeave={(e) => {
              setHover(null);
              e.target.getStage()!.container().style.cursor = '';
            }}
            onMouseDown={(e) => {
              if (e.evt.button !== 0 || input.space) return;
              e.cancelBubble = true;
              pressItem(e.evt, { kind: 'note', id: n.id }, 'move');
            }}
            onDblClick={() => useUi.getState().requestTextFocus()}
          >
            {/* the pin: a square post-it, its corner at the spot it points to */}
            <Rect x={-SIZE / 2} y={-SIZE / 2} width={SIZE} height={SIZE} fill={n.color} stroke={selected ? SELECT_COLOR : 'rgba(0,0,0,0.35)'} strokeWidth={selected ? 3 : 1} cornerRadius={3} shadowColor="#000" shadowOpacity={0.25} shadowBlur={4} shadowOffset={{ x: 1, y: 2 }} />
            <Text x={-SIZE / 2} y={-SIZE / 2 + 5} width={SIZE} align="center" text={n.done ? '✓' : (n.author[0] ?? '?').toUpperCase()} fontSize={15} fontStyle="bold" fill={readableOn(n.color)} listening={false} />
            {showCard && (
              <Label x={SIZE / 2 + 6} y={-SIZE / 2} listening={false}>
                <Tag fill="#ffffff" stroke={n.color} strokeWidth={2} cornerRadius={4} shadowColor="#000" shadowOpacity={0.2} shadowBlur={8} shadowOffset={{ x: 2, y: 3 }} />
                <Text text={`${n.text || '(empty note)'}\n— ${n.author || 'someone'}`} width={200} padding={8} fontSize={13} lineHeight={1.3} fill="#1f2937" />
              </Label>
            )}
          </Group>
        );
      })}
    </Group>
  );
}
