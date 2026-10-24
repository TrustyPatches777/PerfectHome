import { readableOn } from '../identity';
import { useFloorId } from '../store/floor';
import { useLive } from '../store/live';
import { useUi } from '../store/ui';

/** The other people's mouse pointers (live sessions), on the floor you are looking at. */
export function RemoteCursors() {
  const peers = useLive((s) => s.peers);
  const viewport = useUi((s) => s.viewport);
  const floor = useFloorId();
  return (
    <div className="remote-cursors" aria-hidden="true">
      {peers
        .filter((p) => p.cursor && p.floor === floor)
        .map((p) => (
          <div key={p.id} className="remote-cursor" data-testid="remote-cursor" style={{ transform: `translate(${p.cursor!.x * viewport.zoom + viewport.x}px, ${p.cursor!.y * viewport.zoom + viewport.y}px)` }}>
            <svg width="16" height="20" viewBox="0 0 16 20">
              <path d="M1 1 L1 15 L5 11.5 L8 18 L10.5 17 L7.5 10.5 L13 10.5 Z" fill={p.color} stroke="#fff" strokeWidth="1.2" strokeLinejoin="round" />
            </svg>
            <span style={{ background: p.color, color: readableOn(p.color) }}>{p.name}</span>
          </div>
        ))}
    </div>
  );
}
