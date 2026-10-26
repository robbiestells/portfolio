# robbiestells — portfolio

A single-page portfolio for the apps and tools I've been building. Every project tile is a small animated preview of the real thing.

## Projects

| # | Project | Status | Link |
|---|---------|--------|------|
| 01 | Blunder Lab | In beta | https://robbiestells.github.io/blunder-lab/ |
| 02 | Dividend Buy Planner | In beta | https://robbiestells.github.io/dividend-buy-planner/ |
| 03 | Mise en Place | In beta | https://robbiestells.github.io/recipe-book/ |
| 04 | compareme | In beta | _link TBD_ |
| 05 | Spending Tracker | In beta | _link TBD_ |

## Editing

Everything lives in `index.html` — no build step.

- **Status:** each tile's tag uses `<span class="dot beta">` (orange, "in beta") or `<span class="dot live">` (green, "live"). Swap the class and the label text together.
- **Links:** tiles marked `data-todo` still point at the GitHub profile; replace their `href` once those apps have a URL.
- Animations respect `prefers-reduced-motion`.

## Hosting

GitHub Pages: Settings → Pages → Deploy from a branch → `main` / root.
