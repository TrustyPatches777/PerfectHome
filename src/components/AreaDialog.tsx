import { useMemo } from 'react';
import { areaReport, reportToCsv, reportToText } from '../areas';
import { formatArea } from '../geometry';
import { fileNameFor } from '../share';
import { copyShareLink } from '../session';
import { useDesign } from '../store/design';
import { useUi } from '../store/ui';

const pct = (v: number) => `${(Math.round(v * 1000) / 10).toFixed(1)} %`;
const meters = (v: number) => `${(Math.round(v * 100) / 100).toFixed(2)} m`;

function download(text: string, name: string, type: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Room areas per floor, outdoor areas and the plot figures. */
export function AreaDialog() {
  const design = useDesign((s) => s.design);
  const showSetbacks = useUi((s) => s.showSetbacks);
  const r = useMemo(() => areaReport(design), [design]);
  const close = () => useUi.getState().setDialog(null);
  const empty = r.floors.every((f) => !f.rooms.length) && !r.outdoor.length && !r.plot;

  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div className="modal wide" role="dialog" aria-label="Area table" onMouseDown={(e) => e.stopPropagation()} data-testid="area-dialog">
        <h2>Areas &amp; plot</h2>
        {empty && <p className="muted">Nothing to add up yet. Draw some rooms (and a plot boundary in the Outdoor tab) and the numbers appear here.</p>}

        {r.floors.map((f) =>
          f.rooms.length ? (
            <table className="area-table" key={f.floorId} data-testid={`area-floor-${f.name}`}>
              <caption>{f.name}</caption>
              <tbody>
                {f.rooms.map((room) => (
                  <tr key={room.id} className={room.living ? '' : 'minor'}>
                    <td>{room.name}</td>
                    <td className="num">{formatArea(room.area)}</td>
                    <td className="note">{room.living ? '' : 'not living area'}</td>
                  </tr>
                ))}
                <tr className="sum">
                  <td>Total</td>
                  <td className="num">{formatArea(f.total)}</td>
                  <td className="note">living {formatArea(f.living)}</td>
                </tr>
              </tbody>
            </table>
          ) : null,
        )}
        {r.totalRooms > 0 && (
          <p className="stat" data-testid="area-totals">
            All rooms <strong>{formatArea(r.totalRooms)}</strong> · living area <strong data-testid="area-living">{formatArea(r.totalLiving)}</strong>
          </p>
        )}

        {r.outdoor.length > 0 && (
          <table className="area-table">
            <caption>Outdoor</caption>
            <tbody>
              {r.outdoor.map((o) => (
                <tr key={o.kind}>
                  <td>{o.label}</td>
                  <td className="num">{formatArea(o.area)}</td>
                  <td />
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {r.plot && (
          <table className="area-table" data-testid="plot-table">
            <caption>Plot</caption>
            <tbody>
              <tr>
                <td>Plot area</td>
                <td className="num" data-testid="plot-area">{formatArea(r.plot.plotArea)}</td>
                <td />
              </tr>
              <tr>
                <td>Building footprint</td>
                <td className="num" data-testid="plot-footprint">{formatArea(r.plot.footprint)}</td>
                <td className="note" data-testid="plot-coverage">{pct(r.plot.coverage)} of the plot</td>
              </tr>
              <tr>
                <td>Floor area ÷ plot area</td>
                <td className="num">{(Math.round(r.plot.floorAreaRatio * 100) / 100).toFixed(2)}</td>
                <td className="note">all rooms, all floors</td>
              </tr>
              <tr>
                <td>Built and paved</td>
                <td className="num">{pct(r.plot.sealed)}</td>
                <td className="note">house + terraces + driveways</td>
              </tr>
              {r.plot.edges.map((e) => (
                <tr key={e.index} className={r.plot!.nearest?.index === e.index ? 'sum' : ''} data-testid="plot-edge">
                  <td>
                    Side {e.index} <span className="muted">({meters(e.length)} long)</span>
                  </td>
                  <td className="num">{meters(e.distance)}</td>
                  <td className="note">{r.plot!.nearest?.index === e.index ? 'closest' : 'house is this far away'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {r.plot?.outside && <p className="notice">Part of the building lies outside the plot boundary.</p>}
        {r.plot && r.plot.edges.length > 0 && (
          <label className="check">
            <input type="checkbox" checked={showSetbacks} onChange={(e) => useUi.getState().setShowSetbacks(e.target.checked)} data-testid="show-setbacks" />
            Show these distances on the plan
          </label>
        )}

        <div className="row end">
          <button
            onClick={async () => useUi.getState().showToast((await copyShareLink(reportToText(r, design.name))) ? 'Copied the area table as text.' : 'Could not copy.')}
            data-testid="area-copy"
          >
            Copy as text
          </button>
          <button onClick={() => download(reportToCsv(r), fileNameFor(design, 'csv').replace('.csv', '-areas.csv'), 'text/csv')} data-testid="area-csv">
            Download CSV
          </button>
          <button className="primary" onClick={close}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
