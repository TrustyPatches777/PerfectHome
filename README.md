# Perfect Home

A simple top-down home designer that runs in the browser. Draw walls, doors and windows, name rooms and see their
area, then furnish them. Share the design as a link: everything is inside the link, there is no server.

## What it can do

- **Drawing:** walls (four types, straight or curved; a whole rectangle with its room in one drag; drag a wall sideways and the walls and room follow; drag the side of a room, lawn or pond), wall paint and coverings (brick, stone, wood, tiles...), doors (single, double, French, sliding, garage), windows (plain, casement, sash, picture, bay, high strip, floor-to-ceiling), open passages, stairs (straight, L, U, spiral; solid, open or floating; oak, stone, steel, glass... in any color) with wooden, metal, bar, glass, cable or solid railings of any height and color that cut a stairwell into the floor above (visible and editable from the floor above too), interior, main and garden doors, rooms that detect themselves from the walls, with floor materials and area. Type exact lengths while drawing.
- **Furniture** (it cannot be put or dragged into walls): ~200 symbols in real sizes (rooms, kitchen runs with units, appliances that stand on the worktop, wardrobes, sectional sofas, baths and showers, columns and beams, pergolas and trees, heat pumps, people and pets, curtains and blinds, cars, lamps, electrical and plumbing symbols that snap to walls) and your own custom pieces. Multi-select, copy/paste, align and distribute.
- **Editing a house:** mirror a selection or a whole floor, group things and keep an arrangement as a template, split/join/trim walls, move or thicken a wall keeping one face, chamfer or round a corner, scale a floor, stretch a wing, find anything by name, edit every room in a table (type, ceiling, floor, color), split and merge rooms, set sill/lintel heights, arches and frame colors, winder/landing stairs and ladders, trace a picture of a plan, keep named snapshots and see what changed.
- **Whole property:** several floors (the one below shows faintly), garden, driveway, street, fence with gates (single, double, sliding), hedge, garden paths (slabs, gravel, stepping stones, brick, boards), plot boundary.
- **Light:** sun and shadows for any time of day and date, evening light with glowing lamps, a compass (it shows north; set it in the Sun panel).
- **Checks and numbers:** a plan check (doors that cannot open, furniture in walls, narrow passages), an area table with living area and plot coverage and distances to the boundary, rulers, guides, and "show all dimensions".
- **Working together:** a **live session** (Live button): send the link and you both edit the same design at the same time, seeing each other's mouse pointer, with undo that only takes back your own changes. No server: the browsers connect directly. Also sticky notes with a color per person on their own layer, layers you can hide or lock, share links (a snapshot), autosave.
- **Sky and surroundings:** weather in the 3D view (clear, cloudy, rain, snow, fog) with clouds and falling rain or snow, seasons (leaves in spring and summer, autumn colors, bare trees and snow in winter, following the date or chosen), a horizon (hills, mountains, city skyline, forest edge, sea) and neighbouring buildings (houses, a terrace, blocks, a tower, a garage, a wall, a fence).
- **Terrain:** ground areas with a height and a slope (hills, terraces, a sunken garden), retaining walls where levels meet, light wells for cellar windows, a raised ground floor over a semi-basement with entrance steps measured to reach the door, and raised or sunken parts of a room (a dais).
- **Winter gardens and partitions:** a one-click winter garden (glass walls, tiled floor, French door, glass roof), glass walls, wooden slat partitions, glass roofs with glazing bars; furniture and plants for it, and Korean furniture (low tables, floor seating, chests, screens, hanji doors, kimchi refrigerator, ondol). One storey-height setting moves all floors, walls and stairs together.
- **Roofs:** gable, hip, flat (with an edge wall), shed, gambrel and mansard roofs on any floor, with slope, overhang, covering, color, a chimney (brick, pots, stone, render, steel flue), gutters with downpipes, a fascia board, skylights that cut through the roof, solar panels and dormers. Attics under the roof. "Fit to walls" makes one that covers the house; "Roof each wing" gives an L, T or U shaped house one roof per wing, meeting in valleys.
- **Looks:** wall coverings with patterns (wallpaper, tile layouts with a grout color, marble) and floors in herringbone, subway, checker or marble, all with a second color, or a picture from your computer (kept in your browser, not in the link); a frame color for furniture; ceilings at any height (flat, coffered, timber beams) in the 3D view; balconies and terraces with railings, porches, entrance steps; shutters, door and window trim and handles; clad the whole house in one finish ("Facade").
- **3D:** switch to 3D (key 3) to orbit around the house or walk through it, clicking doors to open and close them, walking with collisions (walls, furniture, shut doors) and up and down the stairs, switching floors on and off, with furniture models, sun and shadows for any time of day, lamps at night, a cut-away that hides the upper floors, and a button to save the picture.
- **Output:** PNG, SVG, JSON, and printing at true scale (or save as PDF) on A4/A3/A2/Letter.

## Using it

1. Build a (half-finished) design, lock the **Walls, doors & windows** layer in the Layers panel so it can't be moved by accident.
2. Click **Share**: the link is copied. Send it.
3. Whoever opens it gets their own copy to continue; their changes are saved in their own browser (autosave).
   To hand a new version back, they click **Share** and send their link.

If a link is too long for a chat app, use **File → Export JSON** and send the file; **File → Import JSON** opens it.
Press **?** in the app for all keyboard shortcuts.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests
npm run e2e        # browser tests (first time: npx playwright install chromium)
npm run build
```

See [CLAUDE.md](CLAUDE.md) for the architecture and conventions.

## Deploy to GitHub Pages

1. Create an empty repository on GitHub and push this project to its `main` branch:
   ```bash
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```
2. In the repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The workflow in `.github/workflows/deploy.yml` runs on every push to `main`, tests and builds the app, and publishes it at
   `https://<you>.github.io/<repo>/`. Share links use that address.

The build uses relative paths, so the repository name does not matter.
