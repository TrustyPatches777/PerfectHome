import { useMemo } from 'react';
import { printPlan } from '../session';
import { PAPERS, SCALES, buildPrintLayout, type PaperKey } from '../printLayout';
import { buildSvg } from '../svgExport';
import { useDesign } from '../store/design';
import { useFloorId } from '../store/floor';
import { useUi } from '../store/ui';
import { t, useLang } from '../i18n';

/** Choose paper and scale, see how the plan sits on the page, then print (or save as PDF from the print window). */
export function PrintDialog() {
  const design = useDesign((s) => s.design);
  const floor = useFloorId();
  const opts = useUi((s) => s.printOptions);
  const set = useUi.getState().setPrintOptions;
  const close = () => useUi.getState().setDialog(null);
  const lang = useLang(); // texts worked out here follow the language
  const layout = useMemo(() => buildPrintLayout(design, floor, opts), [design, floor, opts, lang]);
  const page = layout.pages[0];
  const preview = useMemo(() => (page ? buildSvg(design, page.floorId, { decorations: false, dimensions: opts.dimensions, margin: 0.6, pixelsPerMeter: 1 })?.svg : null), [design, page, opts.dimensions, lang]);
  const allFit = layout.pages.every((p) => p.fits);
  const fitScale = useMemo(() => buildPrintLayout(design, floor, { ...opts, scale: 'fit' }).scale, [design, floor, opts]);

  // the miniature page: the plan's size relative to the paper, centered above the title block
  const { w: pw, h: ph } = layout.paperMm;
  const planBox = page && { w: (page.widthMm / pw) * 100, h: (page.heightMm / ph) * 100 };

  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div className="modal wide" role="dialog" aria-label={t('Print')} onMouseDown={(e) => e.stopPropagation()} data-testid="print-dialog">
        <h2>{t('Print or save as PDF')}</h2>
        <div className="print-grid">
          <div className="print-fields">
            <label className="field">
              <span>{t('Paper')}</span>
              <select value={opts.paper} data-testid="print-paper" onChange={(e) => set({ paper: e.target.value as PaperKey })}>
                {Object.entries(PAPERS).map(([k, p]) => (
                  <option key={k} value={k}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="segmented" role="group" aria-label={t('Orientation')}>
              <button className={opts.landscape ? 'active' : ''} onClick={() => set({ landscape: true })} data-testid="print-landscape">
                {t('Landscape')}
              </button>
              <button className={!opts.landscape ? 'active' : ''} onClick={() => set({ landscape: false })} data-testid="print-portrait">
                {t('Portrait')}
              </button>
            </div>
            <label className="field">
              <span>{t('Scale')}</span>
              <select value={String(opts.scale)} data-testid="print-scale" onChange={(e) => set({ scale: e.target.value === 'fit' ? 'fit' : Number(e.target.value) })}>
                <option value="fit">{t('Fit to the page (1:{fitScale})', { fitScale })}</option>
                {SCALES.map((s) => (
                  <option key={s} value={s}>
                    1:{s}
                  </option>
                ))}
              </select>
            </label>
            {design.floors.length > 1 && (
              <div className="segmented" role="group" aria-label={t('Floors')}>
                <button className={opts.floors === 'current' ? 'active' : ''} onClick={() => set({ floors: 'current' })} data-testid="print-this-floor">
                  {t('This floor')}
                </button>
                <button className={opts.floors === 'all' ? 'active' : ''} onClick={() => set({ floors: 'all' })} data-testid="print-all-floors">
                  {t('All floors')}
                </button>
              </div>
            )}
            <label className="check">
              <input type="checkbox" checked={opts.dimensions} onChange={(e) => set({ dimensions: e.target.checked })} data-testid="print-dims" />
              {t('Include dimensions')}
            </label>
            {page ? (
              <p className={allFit ? 'ok' : 'notice'} data-testid="print-info">
                {t('{value}At 1:{scale} the plan is {value2} × {value3} mm on the paper. {value4}', { value: layout.pages.length > 1 ? t('{length} pages. ', { length: layout.pages.length }) : '', scale: layout.scale, value2: Math.round(page.widthMm), value3: Math.round(page.heightMm), value4: allFit ? t('It fits.') : t('It is too big for the page: choose a smaller scale or a larger paper.') })}
              </p>
            ) : (
              <p className="notice">{t('There is nothing on this floor to print yet.')}</p>
            )}
            <p className="muted">{t('In the print window choose “Save as PDF” instead of a printer to get a file. Print at 100% / “actual size” so the scale stays true.')}</p>
          </div>
          <div className="print-preview" style={{ aspectRatio: `${pw} / ${ph}` }} data-testid="print-preview">
            {planBox && preview && (
              <div className="print-plan" style={{ width: `${planBox.w}%`, height: `${planBox.h}%`, outline: allFit ? 'none' : '2px solid #ef4444' }} dangerouslySetInnerHTML={{ __html: preview.replace(/ width="[^"]*" height="[^"]*"/, ' width="100%" height="100%"') }} />
            )}
            <div className="print-title" />
          </div>
        </div>
        <div className="row end">
          <button onClick={close}>{t('Cancel')}</button>
          <button
            className="primary"
            disabled={!page}
            onClick={() => {
              close();
              printPlan(opts);
            }}
            data-testid="print-go"
          >
            {t('Print…')}
          </button>
        </div>
      </div>
    </div>
  );
}
