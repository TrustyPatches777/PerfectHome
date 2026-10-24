# Perfect Home — 2D home designer

Desktop-browser top-down floor-plan designer for two people. No backend, no 3D, no touch/mobile support.
A design is shared as a link: the whole design is one JSON object, lz-string-compressed into the URL hash.

Stack: Vite + React + TypeScript (strict), react-konva (canvas), Zustand (state), immer (edits), lz-string (links),
Yjs + Trystero (live co-editing, no server of ours).

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
src/geometry.ts       pure math: snapping, walls (straight AND arcs: wallArc/wallPointAt/projectOnWall), door arcs, polygons, rooms
src/distance.ts       closest points/distances between segments and polygon outlines
src/selection.ts      pure group operations: item bounds, move/rotate/align/distribute, copy/paste clipboard, remove, layer of an item
src/catalog.ts        furniture catalog (~110 items incl. cars, garden, lamps, electrical, plumbing) + custom items registry,
                      heights for shadows, which layer an item lives on, wall-mounted and lamp flags
src/stairs.ts         stair drawings (straight/L/U/spiral) as pure instructions, walking length, comfort check
src/patterns.ts       procedural tile images (wall hatch, floor materials) for the canvas; svgExport has vector twins
src/walls.ts, outdoor.ts   look/defaults of wall types, outdoor zones and strips
src/typed.ts          parse typed lengths ("350", "2.4m", "3.5<45", "5x3")
src/mount.ts          snap wall-mounted symbols (sockets, taps) flat onto the wall face under the cursor
src/dims.ts           automatic dimension labels ("All dimensions")
src/sun.ts            solar position, sunrise/sunset, darkness; shadowOffset
src/shadows.ts        shadow polygons for walls/furniture/trees/fences/the house (sweepPolygon), building cut-outs
src/checks.ts         "Plan check": blocked doors, furniture in walls, narrow passages
src/areas.ts          area table and plot figures (coverage, distance to boundary), text/CSV
src/bounds.ts         bounding box of a floor's content
src/svgExport.ts      SECOND RENDERER: a floor as SVG (export + print). Keep in sync with the canvas drawing code.
src/printLayout.ts    print pages at true scale (HTML for a hidden frame), paper sizes, "fit" scale
src/share.ts          pure: link encode/decode (lz-string), JSON parsing, localStorage read/write
src/session.ts        whole-design flows: bootstrap, link opening, autosave, PNG/SVG/JSON export, print, new/restore backup
src/actions.ts        commands on the selection (delete, copy/cut/paste, duplicate, nudge, rotate, align) + layer lock guards
src/floors.ts         floors: add, basement, duplicate, rename, delete, step, jump to an item
src/identity.ts       who you are (name + color for sticky notes), kept in localStorage only
src/shortcuts.ts      key table (drives hooks/useShortcuts.ts AND the in-app help)
src/store/design.ts   Zustand: `design` + undo/redo history (immer). The ONLY place the design is mutated.
src/store/ui.ts       Zustand: tool, selection (selected[] + selection when exactly one), active floor, viewport, view switches, dialogs...
src/store/floor.ts    the active floor, validated against the design (floorId(), useFloorId(), useOnFloor(pick))
src/live/              working together live (see the "Live sessions" rule below)
  crdt.ts               PURE: design <-> Yjs document (writeChange / readDesign / reuse), field-level merge, list order keys
  transport.ts          Yjs updates + presence over BroadcastChannel (same browser) and Trystero/WebRTC (other computers)
  live.ts               start/join/leave a session, undo manager, presence, bridge into store/design.ts
src/store/live.ts     Zustand: is a session active, are we synced, who else is here
src/canvas/           react-konva scene
  CanvasView.tsx        Stage, camera, marquee select; layers/* one component per design layer; tools/* one per drawing tool
  press.ts              what happens when you press an item (select, shift-toggle, move one or many) - ONE path for every kind
  editing.ts            mouse edits of existing things (move wall, corners, curve handle, sliding doors, guides)
  input.ts              snapping (vertices, wall faces, guides, grid), drag sessions, tool event hooks, typed-length hook
src/components/       HTML UI: panels (floors, sun, checks, notes, layers, properties), dialogs, menus, palette, rulers, compass
e2e/                  Playwright specs (one per feature group) + helpers (at(), clickAt(), dragWorld() take WORLD meters)
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
- **Floors**: `design.floors` (lowest first, always >= 1). EVERY item except openings carries `floor: Floor.id`; openings
  follow their wall. Layer components filter with `useOnFloor`; tools stamp `floor: floorId()` on new items; snapping and
  room detection only consider the active floor (snapping also sees the floor below, so walls line up). Anything that
  walks all items (delete floor, duplicate floor, `contentBounds`, `isEmptyDesign`) must include zones/strips too.
  The active floor is UI state (`ui.activeFloor`) and falls back to the lowest floor when it no longer exists.
- **Outdoor**: `zones` (polygons: lawn, terrace, driveway, flower bed, pond, plot) and `strips` (polylines with a width:
  street, footpath, fence, hedge) on the `outdoor` layer, drawn under rooms. Big areas must not trap the mouse: press on
  an unselected zone/room pans on drag and selects on a plain click (`startPan(..., onClick)`); only an already-selected
  zone/strip is moved by dragging.
- **Rooms never overlap** (per floor): the room tool selects an existing room instead of creating a duplicate, and refuses
  any new room that `polygonsOverlap`s another.
- **Layers** (`structure`, `rooms`, `outdoor`, `furniture`, `notes`) can be hidden/locked via `design.layers`; this travels in
  the link, so locked walls arrive locked. Locked/hidden layers are non-listening in Konva (clicks fall through to
  panning) and tools refuse to add to them (`layerBlocksEditing`).
- **Never lose work silently**: whenever a design is replaced (new, import, opening a link) the old one goes to
  `perfect-home:backup`; opening a link over non-empty work asks first. Autosave only starts after boot has decided what to show.
- **Konva**: all design layers are `Group`s inside ONE Konva `Layer` (Konva warns above ~5 layers). Grid is its own
  layer below, overlay (handles, tool previews, transformer) its own layer above. PNG export hides first and last layer.
- **Old links must keep working**: `parseDesign` fills defaults (a design without `floors` gets one "Ground floor";
  unknown kinds/floor ids are repaired). Cover every model change with a test in `share.test.ts`.
- **Tool options bar** (`.tool-options`) floats over the plan: keep it one short line, or it swallows clicks (it did once).
- **Konva gotchas found the hard way**: Konva's `dblclick` ignores pointer distance (two quick clicks on different
  corners count) — use `isDoubleClick`. While dragging a corner, its own previous position must not be a snap target.
- **Selection**: `ui.selected` is the full set, `ui.selection` is the item only when exactly ONE thing is selected (properties
  panel, handles and the transformer work on that). Shift+click / Shift+drag add, Ctrl+A selects all editable items of the floor.
  Every group command goes through `selection.ts`/`actions.ts` and skips items on locked layers (`layerOfRef`).
- **Pressing items**: never add per-kind Konva dragging. Call `pressItem(evt, ref, 'move' | 'area')` (press.ts); moves use
  `moveFromBase` from an untouched snapshot so long drags do not drift.
- **Curved walls**: positions along a wall are ARC LENGTH. Use `wallLength`, `wallPointAt`, `projectOnWall` (never `b - a`) so doors,
  windows, snapping and room detection work on curves.
- **Layers**: `structure` (walls, openings, stairs), `rooms`, `outdoor`, `furniture`, `tech` (lamps, electrical, plumbing: chosen by the
  catalog item, not by the item kind), `notes` (labels, measurements, guides), `comments` (sticky notes), `shadows` (draws only).
- **Sun & shadows** live in one Konva layer (`LightingLayer`); heights come from `furnitureHeight`/`wall.height`; off by default.
  Time of day is UI state; date, latitude and north are in the design (`design.site`).
- **Two renderers**: the canvas (Konva) and `svgExport.ts`. When you change how something is drawn, change both.
- **Typed lengths**: drawing tools call `useTypedInput(active, onSubmit)` BEFORE their own key handler.
- **Windows file writes**: when scripting edits of source files from a shell, retry on `OSError` (rare transient EINVAL), and never
  chain `npm test; git commit` with `;` - use `&&`.
- **Live sessions** (`#live=room.key` in the URL): the Yjs document is the truth while a session is open. Local edits still go through
  `useDesign.update`, which also calls `bridge.push(prev, next)` (live.ts -> `writeChange`); anything from outside (other people, undo)
  comes back through `readDesign` (= `parseDesign`, so junk is repaired) and replaces `design`, reusing unchanged objects. History is
  `Y.UndoManager` (your own origin only; `boundary()` closes a step at gesture start/end). New code that mutates the design needs no
  change, but anything that REPLACES the whole design must refuse while `isLive()` (see `blockedByLive` in session.ts). Items are Y.Maps of
  fields; add a field to a type and it syncs (no list of keys to maintain). Rooms are keyed by random names; relays only see a hash.
  `localStorage['perfect-home:p2p'] = 'off'` limits transport to same-browser tabs (the e2e tests do; m21b tests the real network).
- **Rooms** are polygons. Auto mode flood-fills from the click on a raster of the walls (door gaps count as closed), so
  area is measured to the inner wall faces. Rooms do not follow walls when walls move; "Refit to walls" re-runs detection from the stored seed.
- **Debug hook**: `window.__ph = { design, ui }` exposes both stores; Playwright tests read state through it.
- Keep the UI clean and simple. Desktop only: do not add touch/mobile handling.

## Milestones (one commit each)
1 canvas · 2 walls/openings/rooms/undo · 3 furniture · 4 labels/measure/layers · 5 share/export/autosave · 6 GitHub Pages deploy
then: room overlap fix · floors + garage/double door/open passage · outdoor areas & lines · bigger furniture catalog
then: multi-select/copy/paste/align · typed lengths · wall types + curved walls · more openings · stairs · floor materials · custom
furniture · electrical/plumbing/lamps · guides + rulers + all dimensions · sticky notes · sun/shadows/day-night · plan check ·
area table · SVG export + print at scale
then: live co-editing (Yjs, peer-to-peer)
