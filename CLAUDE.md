# Perfect Home — 2D home designer

Desktop-browser top-down floor-plan designer. No backend, no 3D, no touch/mobile support.
A design is shared as a link: the whole design is one JSON object, compressed into the URL hash.

Stack: Vite + React + TypeScript (strict), react-konva (canvas), Zustand (state), immer (edits), lz-string (links).

## Commands
Node lives in `C:\Program Files\nodejs` (may be missing from PATH in older shells).

- `npm run dev` — dev server on http://localhost:5173 (port is fixed; Playwright reuses it)
- `npm run typecheck` / `npm run build` — `tsc --noEmit`, then Vite build into `dist/`
- `npm test` — Vitest unit tests (`src/**/*.test.ts`): geometry, model, share
- `npm run e2e` — Playwright tests in `e2e/` (starts the dev server itself). One spec per milestone.

## Architecture
```
src/model.ts          THE data model: every type of the shared JSON, defaults, parseDesign (validation), serializeDesign
src/geometry.ts       pure math (snapping, wall/opening geometry, polygon area, room detection). No React/Konva.
src/catalog.ts        furniture catalog: default sizes + how each symbol is drawn (simple shapes)
src/share.ts          link encode/decode (lz-string), JSON export/import, localStorage autosave
src/store/design.ts   Zustand store holding `design` + undo/redo history (immer). The ONLY place the design is mutated.
src/store/ui.ts       Zustand store for non-shared UI state: tool, selection, viewport, snap, cursor, toast
src/canvas/           react-konva scene (one component per layer/tool) + camera helpers
src/components/       HTML UI: top bar, tool bar, palette, properties panel, layers panel, status bar, scale bar
e2e/                  Playwright specs
```

### Rules of the road
- **Units**: everything in the model is METERS (angles in degrees). Only UI text converts (cm for furniture sizes).
  The Konva stage is scaled by `viewport.zoom` (px per meter), so shapes are drawn directly in meters.
  Use `strokeScaleEnabled={false}` / divide by zoom for hairlines that must stay 1px.
- **Design vs UI state**: anything that must travel in a shared link lives in `Design` (model.ts). Selection,
  viewport, active tool and history never do.
- **Editing**: call `useDesign.getState().update(d => { ... })` (immer draft). One call = one undo step.
  For drags/draws wrap in `beginTx()` ... `endTx()` so the whole gesture is a single undo step.
- **Adding a field to the model**: edit `model.ts` (type + `createDesign` + `parseDesign`), keep old shared links
  loading (lenient parse with defaults); bump `SCHEMA_VERSION` only for breaking changes.
- **Layers**: `structure` (walls/doors/windows), `rooms`, `furniture`, `notes` (labels/dimensions). Each can be
  hidden/locked (`design.layers`). Locked layers are non-listening in Konva, so clicks fall through to panning.
- **Debug hook**: `window.__ph = { design, ui }` exposes both stores; Playwright tests read state through it.
- Keep UI clean and simple; keyboard shortcuts are listed in `src/shortcuts.ts` and the in-app help.

## Milestones (each is one commit)
1. Canvas: pan/zoom/grid/scale bar  2. Walls, openings, rooms, undo/redo  3. Furniture
4. Text labels, measure tool, layers/locks  5. Share link, JSON/PNG export, autosave  6. GitHub Pages deploy
