# Perfect Home

A simple top-down home designer that runs in the browser. Draw walls, doors and windows, name rooms and see their
area, then furnish them. Share the design as a link: everything is inside the link, there is no server.

## What it can do

- **Drawing:** walls (five types, straight or curved), doors (single, double, French, sliding, garage), windows and bay windows, open passages, stairs (straight, L, U, spiral), rooms that detect themselves from the walls, with floor materials and area. Type exact lengths while drawing.
- **Furniture:** ~110 symbols in real sizes (rooms, kitchen, bathroom, utility, cars, garden, lamps, electrical and plumbing symbols that snap to walls) and your own custom pieces. Multi-select, copy/paste, align and distribute.
- **Whole property:** several floors (the one below shows faintly), garden, driveway, street, fence, hedge, plot boundary.
- **Light:** sun and shadows for any time of day and date, evening light with glowing lamps, a compass.
- **Checks and numbers:** a plan check (doors that cannot open, furniture in walls, narrow passages), an area table with living area and plot coverage and distances to the boundary, rulers, guides, and "show all dimensions".
- **Working together:** a **live session** (Live button): send the link and you both edit the same design at the same time, seeing each other's mouse pointer, with undo that only takes back your own changes. No server: the browsers connect directly. Also sticky notes with a color per person on their own layer, layers you can hide or lock, share links (a snapshot), autosave.
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
