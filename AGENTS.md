# AGENTS.md

## What this project is

Mobile **image-target WebAR** prototype ("point phone at printed card →
blocky tiger pops up and dances") for a Colorado College admitted-student
package demo. Original procedural character — never use official mascot
artwork or download external character models.

## Stack & commands

- No build step. Plain HTML/CSS/JS + A-Frame 1.4.2 + MindAR 1.2.5, both
  vendored in `vendor/` (keep them vendored; do not switch to CDN links).
- Serve statically: `python -m http.server` / `npx serve`.
- Target card generator: `tools/generate_target.py` (Pillow; isolated env is
  `.venv` — create with `python -m venv .venv`, install `pillow numpy`).
- Syntax check JS: `node --check js/<file>.js`.
- `js/voxel-tiger.js` is dual-loadable in Node (it exports
  `sampleTigerPose`); keep that guard at the bottom intact.

## Conventions

- ES5-style JavaScript (`var`, function expressions, no modules/imports) to
  match A-Frame examples; two-space indent, single quotes, semicolons.
- All tiger visuals are procedural (JS/THREE). Do not add model files unless
  the GLB migration path in README §5 is being deliberately exercised.
- The dance is data-driven: edit `CHOREO.keys` in `js/voxel-tiger.js`
  (part.property → `[[t, xyz], …]`), don't add imperative animation code.
- UI stays understated (cream/gold, see `css/style.css` `:root` palette).
  Sound is optional and must never autoplay — gate on the explicit toggle
  like `voxel-tiger.playAudio()` does.
- Keep `README.md` in sync when changing layout, target compilation, the GLB
  swap path, or the sound architecture.

## Gotchas

- MindAR anchors hide children until the target is found — the component's
  `visible` handling is load-bearing, don't "simplify" it away.
- The entrance must stay one-shot (`foundOnce` in `js/app.js` + `hidden`
  state gate in the component).
- `BoxGeometry` face order is px, nx, py, ny, pz, nz — the fake per-face
  shading depends on it.
- The `assets/audio/` and `assets/models/` folders are intentionally empty
  placeholders (gitkeep'd); they document future drop-in locations.
