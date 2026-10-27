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
src/geometry.ts       pure math: snapping, walls (straight AND arcs: wallArc/wallPointAt/projectOnWall), door arcs, polygons, rooms,
                      wallCorners/faceSpan/wallSegmentOutline (mitred corners)
src/distance.ts       closest points/distances between segments and polygon outlines
src/selection.ts      pure group operations: item bounds, move/rotate/align/distribute, copy/paste clipboard, remove, layer of an item
src/catalog.ts        furniture catalog (~110 items incl. cars, garden, lamps, electrical, plumbing) + custom items registry,
                      heights for shadows, which layer an item lives on, wall-mounted and lamp flags
src/walk.ts            walking in 3D: what blocks you (walls, shut doors, windows, furniture, rails, fences), the height of the ground under your feet
                      (floors, stairs, pools, holes), attic headroom. Pure; scene.ts asks it every frame.
src/fit.ts             furniture cannot stand in walls: SAT push-out, sweep along a drag, settleFurniture (called by store/design.ts update)
src/mirror.ts         mirror items / a whole floor left-right or top-bottom (rotations, swings, paint faces, gates, stair flip all follow)
src/wallEdit.ts       split, join, meet-at-a-corner, offset/thicken keeping a face, chamfer/round a corner, parallel/square, even spacing of openings
src/resize.ts         scale a floor (positions only, things keep their size), stretch a box of the plan (stretchFromBase: from an untouched copy)
src/roomEdit.ts       merge two rooms that share boundary (polygon union by cancelling shared edges), split a room along a line
src/find.ts           find items by name/kind (Ctrl+F dialog); src/snapshots.ts named copies of the design in localStorage + diffDesigns (compare)
src/trace.ts          the picture to trace on a floor: pixels in localStorage ONLY (not in links), placement in Floor.trace
src/shapes.ts         rectangles of walls, addRoomTo, shiftEdge (drag a side of a room/lawn), refitRooms (rooms follow their walls)
src/roofs.ts          roofs: 3D shape (faces + blocks per kind), plan symbol, "fit to walls" (min-area rotated box), base height
src/roofActions.ts    make/refit/turn roofs, kind and covering changes that keep a sensible look; addSkylight (window/solar/dormer), addRoofWings
src/roofWings.ts      an L/T/U outline cut into rectangles, one roof per wing (wings that run into another reach its ridge: a valley)
src/paintSpec.ts      a covering as ONE string `base|second|pattern|texture` (floors and walls), wall pattern lists, picture storage (localStorage only)
src/tiles.ts          canvas layouts shared by floors and walls: square/subway/herringbone/diamond/checker/marble slabs/wallpaper
src/facade.ts         `outerSide` (which face of a wall looks outside) and `coverOutside` (clad the whole house in one go)
src/stairs.ts         stair drawings (straight/L/U/spiral) as pure instructions, walking length, comfort check; stairSteps (the solid
                      steps and their heights), stairOutline (the hole in the floor above), railPaths/railProfile/guardRuns (railings:
                      railProfile gives the nosing line the 3D view AND walking share), stair materials/colors, rail looks
src/windows.ts        the window kinds (sill, plan symbol, labels); a window kind is an OpeningKind in model.ts, listed in WINDOW_KINDS
src/patterns.ts       procedural tile images (wall hatch, floor materials) for the canvas; svgExport has vector twins
src/walls.ts, outdoor.ts   look/defaults of wall types (exterior/load-bearing is ONE type), wall coverings and paint colors, outdoor zones and strips;
                      outdoor.ts also has fence gates (gateSpans/solidSpans/gateGeometry) and garden path surfaces (pathMarks)
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
src/view3d/             the house in 3D (three.js, loaded only when the 3D view opens; view only, editing stays in 2D)
  parts.ts              the scene as plain data: boxes/cylinders/balls/rings/prisms/lights, `place()` (plan rotation -> three rotation)
  furniture3d.ts        a recipe per catalog type (item-local coords, back at -z); no recipe = plain block. A unit test keeps every
                        model inside its footprint, so a new recipe cannot wander off
  roofTex.ts            canvas textures for roof coverings (tiles, slate, metal ribs, thatch...)
  build.ts              design -> chunks (one per wall/room/item) with `deps`; walls get cut for doors/windows, floors stack by storey
  stairs3d.ts           steps (closed / open / floating, materials) and railings of staircases; build.ts re-exports stairParts/railParts
  scene.ts              Three.js: meshes from parts, sun + shadows + lamps, orbit and walk cameras, only rebuilds changed chunks
  View3D.tsx            the 3D view with its controls (orbit/walk, cut-away, shadows, time of day, save image)
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
- **Roofs** are items of their own (`design.roofs`, layer `roofs`), oriented boxes like furniture: x,y = middle of the footprint, `w` along the
  ridge, `d` across, `floor` = the floor whose walls carry it (its base height = the tallest wall of that floor). On the plan only the dashed
  outline reacts to the mouse, so a roof never covers what is under it. In 3D a cut-away removes the roof of the active floor and above.
  Every roof kind must keep all faces planar (roofs.test.ts checks), because 3D draws each face as one flat panel.
- **Layers**: `structure` (walls, openings, stairs), `rooms`, `roofs`, `outdoor`, `furniture`, `tech` (lamps, electrical, plumbing: chosen by the
  catalog item, not by the item kind), `notes` (labels, measurements, guides), `comments` (sticky notes), `shadows` (draws only).
- **Sun & shadows** live in one Konva layer (`LightingLayer`); heights come from `furnitureHeight`/`wall.height`; off by default.
  Time of day is UI state; date, latitude and north are in the design (`design.site`).
- **Three renderers**: the canvas (Konva), `svgExport.ts` and the 3D view (`view3d/`). When you change how something is drawn, check all
  three. 3D coordinates: plan x -> x, plan y -> z, up -> y; a plan rotation of +θ° (clockwise) is `ry = -θ` in three.js. Anything new on
  the plan that has a size and height (a new item kind, not just a catalog entry) needs a chunk in `view3d/build.ts`.
- **Wall corners** are mitred, not just extended: a wall is drawn half a thickness longer than its centerline, which only closes a
  90° corner. `wallCorners(w, walls)` gives, for a wall that meets exactly one other wall end to end, where the outer faces meet (`s`) and the
  inner faces (`si`); `wallSegmentOutline`/`faceSpan` use them, so the plan, the SVG, the 3D walls AND the paint stripes/skins all end exactly
  on the mitre (no notch outside, no unpainted spot). Gable ends of roofs take the paint of the wall under them (`gableWall` in build.ts).
- **Stairs**: `Stair.build` (closed/open/floating), `material`, `color`, `bodyColor` and `Stair.railing` (style, a/b sides, `guard` = the rail round the
  stairwell upstairs, `height`, `color`) are all optional with defaults, so old links load. Rails are built from `railProfile`: a node at every
  step edge on the nosing line, thick posts at ends and turns. Walking blocks at a rail only at the HEIGHT it is at (an obstacle has a feet-height
  range), so rails never close the way on or off a stair; a spiral's rail leaves its first and last tread free. Upstairs the stairwell is drawn
  with a dashed outline and guard rail and is clickable (it selects the stair of the floor below).
- **Fence gates and garden paths**: `Strip.gates` (fence/hedge only: position along the line, width, single/double/sliding, side, hinge) cut the
  line into `solidSpans`; every renderer and the walking code use those. A gate in 3D is a door (`anim.door` = the gate id), so clicking opens it.
  `Strip.surface` (footpaths only) is drawn with `pathMarks` (joints, boards, stepping stones, pebbles). Roads and paths must lie ABOVE a lawn (3 cm).
- **Left sidebar**: tools (a scrolling box) and the furniture list share the column; `ui.toolsHeight` is dragged with the bar between them (remembered).
  Thin items (radiators, sockets) only get the two handles at the ends of their long side, or a press on them would resize them.
- **Wall-mounted items** (`catalog.wallMounted`) snap flat onto the wall face under the cursor when PLACED (FurnitureTool) and when DRAGGED alone (press.ts).
- **Groups** are `design.groups` (`{id, name, refs}`, never openings): `pressItem` selects a whole group (`selectWithGroup`), `removeRefs` takes
  deleted items out of their groups, Ctrl+G / Ctrl+Shift+G. A template is a saved clipboard (`perfect-home:templates`, this browser only) that is
  pasted as a new group. **Mirroring** turns positions, rotations, swings and faces over, but not what is INSIDE an asymmetric piece of furniture.
- **Rooms** may have a `type` (drives plan-check "no window"/"too small") and a `ceiling`; the area table shows both and the volume.
  Openings may carry `sill`, `head` (lintel), `arch` (stepped half circle in 3D) and `frame` (color): `openingParts` in build.ts handles all four.
- **Stairs** also come as 'landing' (a deep step half way), 'winder' (three wedge steps in the corner) and 'ladder' (no steps to stand on; a hatch above),
  and `firstFlight` sets the steps in the first flight (`flightSplit` is the one place that works out the split).
- **Tracing picture and snapshots live in the browser, not in the design**: a link carries `Floor.trace` (where it lies) but not the pixels.
- **Zustand v5 gotcha**: a selector that returns a NEW array/object every time (`s.design.openings.filter(...)`) re-renders forever and the panel
  disappears; select the stable list and filter in the component.
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
  area is measured to the inner wall faces. Rooms found from walls remember a `seed` and follow the walls: when a wall drag, corner drag or
  typed length ends, `refitRooms` re-detects them (inside the same undo step). A wall that has others joined to it only moves sideways
  (Alt = free). Hand-drawn rooms (no seed) stay put; "Refit to walls" does it by hand. Sides of rooms and outdoor areas have middle handles.
- **Furniture and walls**: `store/design.ts update` runs `settleFurniture` after every edit: a furniture item whose place, size or turn
  changed is pushed out of the walls of its floor (walked from its old place in small steps, so a quick drag cannot jump a wall); when
  there is no room it goes back (a new one is dropped, with a toast). Exempt: tech-layer items, wall-mounted ones, rugs, parking, tree
  crowns. Edits that change walls never move furniture. Anything new that places furniture goes through `update` and gets this for free.
- **Wall coverings**: `Wall.paint = { l?, r? }` (left/right face looking a->b). Plan: a thin stripe in the wall (`wallFaceLine`); 3D: thin
  panels a hair outside the face (`skinPanels`, textures `wall-<finish>` in view3d/wallTex.ts). Doors in 3D: parts carry `anim`
  (swing about the hinge, slide, lift); the viewer keeps open/closed state per opening id in memory only (not in the design).
- **Floors above and below**: a stair on floor k comes up through floor k+1: its outline is cut out of that floor's rooms in 3D
  (`stairHoles`) and out of the walkable surface. A roof sits on top of the highest floor of its stack: adding a floor above a roof asks
  (attic under the roof / full floor, roof moves up), duplicating a floor moves the roof up. An **attic** (`Floor.attic`) is the space under
  the roof of the floor below: its clearance is `atticClearance` (roof underside minus the floor), the plan shades the low parts, the plan
  check flags furniture under them, and you cannot walk where the clearance is under 1.5 m. A basement's neighbour for the faint
  underlay and snapping is the floor ABOVE it (`floorBelow`). The 3D ground is always there, with holes over basement rooms, pools and ponds.
- **Walking** (`walk.ts`): the walker is a circle of 28 cm; closed doors and windows block, open doors and open passages do not; the
  height under your feet is the highest surface within 55 cm above them (that is how stairs and floors work), otherwise you fall.
  The world is rebuilt when the design or a door changes. Frame rate is low in tests: wait for the walker to stop instead of timing keys.
- **Layout**: sidebar widths are UI state saved in `perfect-home:prefs`; the editing window takes the rest (`Splitter`).
- **Skylights** (`design.skylights`, layer `roofs`) are placed by plan position and lie in whichever roof covers that point
  (`skylightPlacement` finds the slope face and its frame); not on a roof = not drawn in 3D. A skylight inside a roof face cuts a hole
  in it (the panel has `holes`), so the sun comes in; the glass does not cast a shadow.
- **Coverings** (floors and walls) travel through the renderers as one spec string (`paintSpec.ts`: `skinSpec`/`roomSpec`), so texture caches keyed
  by `kind|spec` carry pattern, second color (grout, wallpaper ink) and a picture without new signatures. Uploaded pictures (finish/material
  `custom`) are downscaled to 512 px and kept in `localStorage['perfect-home:tex:<id>']` ONLY: they are not in links, other computers show
  the base color. The ui store's `texturesVersion` is bumped when one loads; 3D chunks with a custom texture put it in their `deps`.
- **Detail parts** in 3D (`view3d/build.ts`): ceilings are chunks `ceil:<room>` that exist only when `showCeilings` (View3D checkbox, always on
  while walking); dormers, solar panels, gutters/fascia (`eaveParts`), chimney styles, shutters/trim/handles and balcony rails are plain parts
  from `roofParts`/`openingParts`/`zoneParts`. Dormers cut a hole in the slope; solar panels do not. `Furniture.color2` replaces the parts
  painted with `FRAME_COLORS` (the wood of the recipes).
- **Balconies and porches** are zones (`balcony`: slab at the floor's level; `porch`: raised by `zone.raise`). `freeEdges(zone, walls)` (the
  edges not against a wall) carry the railing on the plan, in 3D and in `walk.ts` (where balcony/porch tops are walkable). Entrance steps
  are a normal stair that does not `reachesNextFloor` (rise <= 0.7 storey): it leaves no stairwell hole and no guard rail, in 3D, walking,
  the plan ghost and SVG.
- **Plan symbol = 3D model**: `footprint.test.ts` compares the plan symbol of every catalog item with its 3D model from above (grid
  overlap > 60%); schematic exceptions are listed there. A new recipe must match the symbol, including which end is which.
- **Debug hook**: `window.__ph = { design, ui }` exposes both stores; Playwright tests read state through it.
- Keep the UI clean and simple. Desktop only: do not add touch/mobile handling.

## Milestones (one commit each)
1 canvas · 2 walls/openings/rooms/undo · 3 furniture · 4 labels/measure/layers · 5 share/export/autosave · 6 GitHub Pages deploy
then: room overlap fix · floors + garage/double door/open passage · outdoor areas & lines · bigger furniture catalog
then: multi-select/copy/paste/align · typed lengths · wall types + curved walls · more openings · stairs · floor materials · custom
furniture · electrical/plumbing/lamps · guides + rulers + all dimensions · sticky notes · sun/shadows/day-night · plan check ·
area table · SVG export + print at scale
then: live co-editing (Yjs, peer-to-peer) · 3D view (orbit, walk, sun, furniture models) · roofs (gable, hip, flat, shed, gambrel, mansard)
then: rectangles of walls · drag sides · wall paint · doors that open in 3D · walk-mode fix · deep pools · corner sofa fix · furniture kept out of walls · skylights
then: editing tools (mirror, groups, wall tools, scale, find, snapshots) · attic from the roof · plot boundary at the back
then: visual detail (wallpaper/tile layouts/pictures, furniture frame color, ceilings, dormers/solar/gutters/chimneys/roof wings, balconies/porches/entrance steps, shutters/trim/handles, facade)
