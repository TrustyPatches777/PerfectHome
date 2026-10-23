# Perfect Home — 2D home designer

Desktop-browser top-down floor-plan designer for two people. No backend, no 3D, no touch/mobile support.
A design is shared as a link: the whole design is one JSON object, lz-string-compressed into the URL hash.

Stack: Vite + React + TypeScript (strict), react-konva (canvas), Zustand (state), immer (edits), lz-string (links).

## Commands
Node is in `C:\Program Files\nodejs`; shells opened before it was installed may not have it on PATH
(prefix with `$env:Path = "C:\Program Files\nodejs;" + $env:Path`).

- `npm run dev` — dev server on http://localhost:5173 (port is fixed; Playwright reuses a running one)
- `npm run typecheck` — `tsc --noEmit`; `npm run build` runs it, then Vite into `dist/`
- `npm test` — Vitest unit tests (`src/**/*.test.ts`): geometry, room detection, model validation, share links
- `npm run e2e` — Playwright (Chromium) specs in `e2e/`, one per milestone; they start the dev server themselves.
  Screenshots land in `e2e/.results/` (git-ignored) — look at them when changing visuals.
- CI (`.github/workflows/deploy.yml`) runs `npm test` + `npm run build` and deploys `dist/` to GitHub Pages on push to `main`.
  `vite.config.ts` uses `base: './'`, so it works under any repo name.

## Architecture
```
src/model.ts          THE data model: every type of the shared JSON, defaults, parseDesign (validation), serializeDesign
src/geometry.ts       pure math: snapping, wall frames, door arcs, polygon area, room detection. No React/Konva.
src/catalog.ts        furniture catalog: real-world sizes + each symbol as simple normalized shapes (also palette icons)
src/share.ts          pure: encode/decode links (lz-string), JSON parsing, localStorage read/write
src/session.ts        effectful whole-design flows: bootstrap, link opening, autosave, export/import, new/restore backup
src/actions.ts        commands on the selection (delete, duplicate, nudge, rotate) + layer lock/hide guards
src/shortcuts.ts      key table (drives the handler in hooks/useShortcuts.ts AND the in-app help)
src/store/design.ts   Zustand store: `design` + undo/redo history (immer). The ONLY place the design is mutated.
src/store/ui.ts       Zustand store for non-shared UI state: tool, selection, viewport, snap, cursor, toast, dialog, save status
src/canvas/           react-konva scene
  CanvasView.tsx        Stage, camera (wheel zoom, pan), mounts the layers
  GridLayer.tsx         adaptive grid; layers/*  one component per design layer; tools/*  one component per drawing tool
  input.ts              snapping (snapWorld), drag sessions, stage-event hook for tools, double-click detection
  editing.ts            mouse edits of existing items (move wall, drag corner, slide door...)
  SelectionTransformer  resize/rotate handles for furniture/labels (Konva Transformer)
src/components/       HTML UI: TopBar, ToolBar, FurniturePalette, Properties, LayersPanel, Dialogs, FileMenu, StatusBar, ScaleBar
e2e/                  Playwright specs + helpers (at(), clickAt(), dragWorld() take WORLD meters)
```

## Rules of the road
- **Units**: the model is in METERS (angles in degrees, y axis points down). Only UI text converts (cm in inputs).
  The Konva stage is scaled by `viewport.zoom` (px per meter), so shapes are drawn directly in meters. Keep hairlines
  1px with `strokeScaleEnabled={false}` or by dividing by zoom; give thin things a transparent wide stroke to make them clickable.
- **Design vs UI state**: anything that must travel in a shared link lives in `Design` (model.ts). Selection, viewport,
  tool and history never do.
- **Editing**: `useDesign.getState().update(d => { ... })` (immer draft). One call = one undo step. For drags/draws
  wrap in `beginTx()`…`endTx()` (see `dragSession` in input.ts) so a whole gesture is a single undo step.
- **Changing the model**: edit `model.ts` (type + `createDesign` + `parseDesign`). Keep old shared links loading
  (lenient parse with defaults); bump `SCHEMA_VERSION` only for breaking changes. Everything coming from outside
  (links, files, localStorage) goes through `parseDesign` — never trust it.
- **Layers** (`structure`, `rooms`, `furniture`, `notes`) can be hidden/locked via `design.layers`; this travels in
  the link, so locked walls arrive locked. Locked/hidden layers are non-listening in Konva (clicks fall through to
  panning) and tools refuse to add to them (`layerBlocksEditing`).
- **Never lose work silently**: whenever a design is replaced (new, import, opening a link) the old one goes to
  `perfect-home:backup`; opening a link over non-empty work asks first. Autosave only starts after boot has decided what to show.
- **Konva**: all design layers are `Group`s inside ONE Konva `Layer` (Konva warns above ~5 layers). Grid is its own
  layer below, overlay (handles, tool previews, transformer) its own layer above. PNG export hides first and last layer.
- **Konva gotchas found the hard way**: Konva's `dblclick` ignores pointer distance (two quick clicks on different
  corners count) — use `isDoubleClick`. While dragging a corner, its own previous position must not be a snap target.
- **Rooms** are polygons. Auto mode flood-fills from the click on a raster of the walls (door gaps count as closed), so
  area is measured to the inner wall faces. Rooms do not follow walls when walls move; "Refit to walls" re-runs detection from the stored seed.
- **Debug hook**: `window.__ph = { design, ui }` exposes both stores; Playwright tests read state through it.
- Keep the UI clean and simple. Desktop only: do not add touch/mobile handling.

## Milestones (one commit each)
1 canvas · 2 walls/openings/rooms/undo · 3 furniture · 4 labels/measure/layers · 5 share/export/autosave · 6 GitHub Pages deploy
