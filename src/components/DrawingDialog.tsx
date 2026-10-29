import { useMemo, useState } from 'react';
import { buildDrawingLayout, specFor } from '../drawingPrint';
import { PAPERS, SCALES, type PaperKey } from '../printLayout';
import { drawingTitle, lookingAt, prepareDrawing, renderDrawing, SIDE_NAME, type Side } from '../section';
import { download, printHtml } from '../session';
import { fileNameFor } from '../share';
import { useDesign } from '../store/design';
import { useUi } from '../store/ui';
import { t, useLang } from '../i18n';

/** An SVG as a picture: drawn on a canvas of the given size. */
async function svgToPng(svg: string, w: number, h: number): Promise<Blob | null> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    await new Promise<void>((ok, fail) => {
      img.onload = () => ok();
      img.onerror = () => fail(new Error('image'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise((done) => canvas.toBlob(done, 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Elevations (the house seen from a side) and sections (the house cut open along a line): see them, print them at a scale, save them. */
export function DrawingDialog() {
  const design = useDesign((s) => s.design);
  const opts = useUi((s) => s.drawingOptions);
  const set = useUi.getState().setDrawingOptions;
  const close = () => useUi.getState().setDialog(null);
  const [busy, setBusy] = useState(false);

  const lang = useLang(); // texts worked out here follow the language
  const spec = useMemo(() => specFor(design, opts), [design, opts, lang]);
  const prepared = useMemo(() => prepareDrawing(design, spec), [design, spec, lang]);
  const layout = useMemo(() => buildDrawingLayout(design, spec, opts, new Date(), prepared), [design, spec, opts, prepared, lang]);
  const preview = useMemo(() => (prepared ? renderDrawing(prepared, layout.scale, 1).svg : null), [prepared, layout.scale]);
  const fitScale = useMemo(() => (prepared ? buildDrawingLayout(design, spec, { ...opts, scale: 'fit' }, new Date(), prepared).scale : 100), [design, spec, opts, prepared]);

  const section = spec.kind === 'section' ? spec.line : undefined;
  const { w: pw, h: ph } = layout.paperMm;
  const box = prepared && { w: (layout.widthMm / pw) * 100, h: (layout.heightMm / ph) * 100 };
  const title = drawingTitle(spec);
  const edit = (fn: (s: NonNullable<typeof section>) => void) => section && useDesign.getState().update((d) => void fn(d.sections.find((s) => s.id === section.id)!));

  const saveSvg = () => {
    if (!prepared) return;
    const svg = renderDrawing(prepared, layout.scale).svg;
    download(new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${svg}`], { type: 'image/svg+xml' }), fileNameFor({ ...design, name: `${design.name} ${title}` }, 'svg'));
  };
  const savePng = async () => {
    if (!prepared || busy) return;
    setBusy(true);
    try {
      const ppm = 12000 / layout.scale; // about 120 pixels to the meter at 1:100
      const r = renderDrawing(prepared, layout.scale, ppm);
      const blob = await svgToPng(r.svg, Math.round(r.width * ppm), Math.round(r.height * ppm));
      if (blob) download(blob, fileNameFor({ ...design, name: `${design.name} ${title}` }, 'png'));
      else useUi.getState().showToast(t('Could not create the picture.'));
    } catch {
      useUi.getState().showToast(t('Could not create the picture.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div className="modal wide" role="dialog" aria-label={t('Elevation and section drawings')} onMouseDown={(e) => e.stopPropagation()} data-testid="drawing-dialog">
        <h2>{t('Elevations and sections')}</h2>
        <div className="print-grid">
          <div className="print-fields">
            <label className="field">
              <span>{t('Drawing')}</span>
              <select value={section ? section.id : opts.view} data-testid="drawing-view" onChange={(e) => set({ view: e.target.value })}>
                <optgroup label={t('Elevations (the house from outside)')}>
                  {(['S', 'N', 'E', 'W'] as Side[]).map((s) => (
                    <option key={s} value={s}>
                      {t('{value} elevation', { value: SIDE_NAME[s] })}
                    </option>
                  ))}
                </optgroup>
                {design.sections.length > 0 && (
                  <optgroup label={t('Sections (the house cut open)')}>
                    {design.sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {t('Section {name}–{name} (looking {lookingAt})', { name: s.name, lookingAt: lookingAt(design, s) })}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </label>
            {section && (
              <div className="row">
                <label className="field" style={{ flex: 1 }}>
                  <span>{t('Letter')}</span>
                  <input value={section.name} maxLength={3} data-testid="section-name" onChange={(e) => edit((s) => void (s.name = e.target.value.trim().toUpperCase() || 'A'))} />
                </label>
                <button onClick={() => edit((s) => void (s.flip ? delete s.flip : (s.flip = true)))} title={t('Look at the other side of the line')} data-testid="section-flip">
                  {t('Look the other way')}
                </button>
                <button
                  onClick={() => {
                    useDesign.getState().update((d) => void (d.sections = d.sections.filter((s) => s.id !== section.id)));
                    set({ view: 'S' });
                  }}
                  data-testid="section-delete"
                >
                  {t('Delete')}
                </button>
              </div>
            )}
            <button
              onClick={() => {
                const ui = useUi.getState();
                ui.setDialog(null);
                ui.setTool('section');
              }}
              data-testid="section-new"
            >
              {t('Draw a section line on the plan…')}
            </button>
            <div className="segmented" role="group" aria-label={t('Style')}>
              <button className={!opts.colour ? 'active' : ''} onClick={() => set({ colour: false })} data-testid="drawing-lines">
                {t('Line drawing')}
              </button>
              <button className={opts.colour ? 'active' : ''} onClick={() => set({ colour: true })} data-testid="drawing-colour">
                {t('Colour')}
              </button>
            </div>
            <label className="check">
              <input type="checkbox" checked={opts.furniture} onChange={(e) => set({ furniture: e.target.checked })} data-testid="drawing-furniture" />
              {t('Furniture, trees and the like')}
            </label>
            <label className="field">
              <span>{t('Paper')}</span>
              <select value={opts.paper} data-testid="drawing-paper" onChange={(e) => set({ paper: e.target.value as PaperKey })}>
                {Object.entries(PAPERS).map(([k, p]) => (
                  <option key={k} value={k}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="segmented" role="group" aria-label={t('Orientation')}>
              <button className={opts.landscape ? 'active' : ''} onClick={() => set({ landscape: true })}>
                {t('Landscape')}
              </button>
              <button className={!opts.landscape ? 'active' : ''} onClick={() => set({ landscape: false })}>
                {t('Portrait')}
              </button>
            </div>
            <label className="field">
              <span>{t('Scale')}</span>
              <select value={String(opts.scale)} data-testid="drawing-scale" onChange={(e) => set({ scale: e.target.value === 'fit' ? 'fit' : Number(e.target.value) })}>
                <option value="fit">{t('Fit to the page (1:{fitScale})', { fitScale })}</option>
                {SCALES.map((s) => (
                  <option key={s} value={s}>
                    1:{s}
                  </option>
                ))}
              </select>
            </label>
            {prepared ? (
              <p className={layout.fits ? 'ok' : 'notice'} data-testid="drawing-info">
                {t('At 1:{scale} the drawing is {value} × {value2} mm on the paper. {value3}', { scale: layout.scale, value: Math.round(layout.widthMm), value2: Math.round(layout.heightMm), value3: layout.fits ? t('It fits.') : t('It is too big for the page: choose a smaller scale or a larger paper.') })}
              </p>
            ) : (
              <p className="notice" data-testid="drawing-empty">
                {section ? t('The line does not cut through anything yet.') : t('There is nothing to draw yet.')}
              </p>
            )}
            <p className="muted">{t('It is drawn from the same model as the 3D view, so roofs, windows and heights match. In the print window choose “Save as PDF” to get a file, and print at 100% so the scale stays true.')}</p>
          </div>
          <div className="print-preview" style={{ aspectRatio: `${pw} / ${ph}` }} data-testid="drawing-preview">
            {box && preview && <div className="print-plan" style={{ width: `${box.w}%`, height: `${box.h}%`, outline: layout.fits ? 'none' : '2px solid #ef4444' }} dangerouslySetInnerHTML={{ __html: preview.replace(/ width="[^"]*" height="[^"]*"/, ' width="100%" height="100%"') }} />}
            <div className="print-title" />
          </div>
        </div>
        <div className="row end">
          <button onClick={close}>{t('Close')}</button>
          <button disabled={!prepared} onClick={saveSvg} data-testid="drawing-svg">
            {t('Save SVG')}
          </button>
          <button disabled={!prepared || busy} onClick={() => void savePng()} data-testid="drawing-png">
            {t('Save picture')}
          </button>
          <button
            className="primary"
            disabled={!layout.html}
            onClick={() => {
              close();
              if (layout.html) printHtml(layout.html);
            }}
            data-testid="drawing-print"
          >
            {t('Print…')}
          </button>
        </div>
      </div>
    </div>
  );
}
