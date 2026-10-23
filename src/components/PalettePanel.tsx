import { useState } from 'react';
import { FurniturePalette } from './FurniturePalette';
import { OutdoorPalette } from './OutdoorPalette';

/** The left sidebar below the tools: furniture & vehicles, or outdoor areas & lines. */
export function PalettePanel() {
  const [tab, setTab] = useState<'furniture' | 'outdoor'>('furniture');
  return (
    <>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'furniture'} className={tab === 'furniture' ? 'active' : ''} onClick={() => setTab('furniture')} data-testid="tab-furniture">
          Furniture
        </button>
        <button role="tab" aria-selected={tab === 'outdoor'} className={tab === 'outdoor' ? 'active' : ''} onClick={() => setTab('outdoor')} data-testid="tab-outdoor">
          Outdoor
        </button>
      </div>
      {tab === 'furniture' ? <FurniturePalette /> : <OutdoorPalette />}
    </>
  );
}
