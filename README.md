# Perfect Home

A simple top-down home designer that runs in the browser. Draw walls, doors and windows, name rooms and see their
area, then furnish them. Share the design as a link: everything is inside the link, there is no server.

## What it can do

- **Rooms:** draw walls, add doors (single, double, garage door), windows and open passages, click inside walls to make a named room with its floor color and m² area. Rooms never overlap.
- **Multiple floors:** add floors above or a basement, duplicate a floor, switch with Page Up / Page Down. The floor below shows faintly so walls line up.
- **Outdoors:** lawn, terrace, driveway, flower bed, pond, plot boundary, plus a street, footpath, fence and hedge, all on their own lockable layer.
- **~85 furniture symbols** in real sizes: rooms, kitchen, bathroom, utility, cars, bikes, trees, garden items and more.
- **Labels, measurements, layers you can hide or lock, undo/redo, PNG and JSON export, share links, autosave.**

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
