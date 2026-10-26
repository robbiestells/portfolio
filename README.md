# robbiestells — portfolio

A single-page portfolio for the apps and tools I've been building. Every project tile is a small animated preview of the real thing.

## Projects

| # | Project | Status | Link |
|---|---------|--------|------|
| 01 | Blunder Lab | In beta | https://robbiestells.github.io/blunder-lab/ |
| 02 | Dividend Buy Planner | In beta | https://robbiestells.github.io/dividend-buy-planner/ |
| 03 | Mise en Place | In beta | https://robbiestells.github.io/recipe-book/ |
| 04 | compareme | In beta | https://robbiestells.github.io/compareme/ |
| 05 | Spending Tracker | In beta | https://robbiestells.github.io/budgetrunway/ |

## Editing

Everything lives in `index.html` — no build step.

- **Status:** each tile's tag uses `<span class="dot beta">` (orange, "in beta") or `<span class="dot live">` (green, "live"). Swap the class and the label text together.
- Animations respect `prefers-reduced-motion`.

## Previews

Clicking an **in-beta** tile opens a preview popup instead of leaving the site: an auto-playing step-by-step demo plus a longer feature write-up and a link to the beta. Cmd/Ctrl-click still opens the app directly.

- Each preview is a `<template id="pv-NAME">` near the bottom of `index.html`, matched to its tile's `data-preview="NAME"`.
- Demo steps are the `.scene` blocks inside it; each one's `data-cap` is the caption under the demo. Add or remove scenes and the progress bar adjusts.
- Previews are shareable: `…/portfolio/#preview/blunder-lab` opens straight into one.
- When an app graduates to **live**, switch its tile dot to `dot live`; the tile then links straight to the app.

## Hosting

GitHub Pages: Settings → Pages → Deploy from a branch → `main` / root.
