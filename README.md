# Tiger AR — Admitted-Student Welcome Prototype

A mobile WebAR prototype: point a phone camera at the printed tiger card and a
charming little blocky tiger pops up on it and does a ~11-second looping dance.

The character is **100 % procedural** — built from plain box geometry at
runtime (`js/voxel-tiger.js`), so there is no dependence on any external 3D
model, and no official mascot artwork is used or imitated.

```
camera → image recognition → tiger appears (POP) → tiger dances → loops
```

---

## 1. Run it

Any static file server works. MindAR requires **HTTPS (or localhost)**
and a mobile browser (iOS Safari / Android Chrome).

```bash
# from this folder — pick one:
python -m http.server 8000          # then open http://localhost:8000
npx serve .
```

For on-device testing use a tunnel with HTTPS, e.g. `npx localtunnel` or
`ngrok http 8000`, or serve from your LAN with a self-signed cert.

## 2. The image target

`targets/tiger-card.png` is a print-ready ~5 in @ 300 dpi sample card. The
app loads a **compiled** target from `targets/tiger-card.mind`, which you
create once:

1. Open the MindAR image-target compiler:
   <https://hiukim.github.io/mind-ar-js-doc/tools/compile>
2. Drop `targets/tiger-card.png` in, compile, download.
3. Save the result as `targets/tiger-card.mind` in this repo.

Want a different card? Edit `tools/generate_target.py` (a Pillow script —
`python -m venv .venv && .venv/Scripts/pip install pillow numpy`), rerun it,
recompile. Keep rich asymmetric detail; trackers love texture, hate whitespace.

Other tuning knobs live in `index.html` on the `<a-scene>` `mindar-image`
attribute: `filterMinCF` / `filterBeta` (jitter vs. lag trade-off),
`missTolerance`, `warmupTolerance`.

## 3. How the tiger works

`js/voxel-tiger.js` registers the A-Frame component `voxel-tiger`. It builds
this hierarchy from `THREE.BoxGeometry` (shared Lambert material, per-face
vertex shading for the voxel look):

```
rig (anchor) └ root └ body
                ├ torso ─ chest, belly, stripes
                ├ head  ─ skull, muzzle, eyes, nose, stripes + earL/earR
                ├ armL / armR   (shoulder pivots)
                ├ legL / legR   (hip pivots)
                └ tailBase → tailMid → tailTip (chained pivots)
```

- **Entrance (1.15 s):** rises from below the target while scaling 0 → 1.12
  with an ease-out-back overshoot, then settles to scale 1. Plays **once**
  (`targetFound` is gated by a `foundOnce` flag, and `playEntrance()` only
  runs from the `hidden` state), so tracking flicker never retriggers it.
- **Dance (10.8 s):** data-driven keyframes — `CHOREO.keys` maps
  `"<part>.<pos|rot|scale>" → [[t, [x,y,z]], …]`, linearly interpolated by
  `sampleTigerPose()`. Bounce + alternating arm swings → hip twist →
  alternating kicks + head shake → full spin → victory pose → loops after a
  0.9 s breather. Retune it by editing keyframes; nothing else to change.
- **Events:** `tiger-entrance-started`, `tiger-dance-started`,
  `tiger-dance-finished`. `js/app.js` uses these to reveal the
  **Dance again** control, which calls `replayDance()`.

Prediction gate: `if (typeof window.AFRAME === 'undefined') return;` keeps the
file also loadable in Node for unit tests (`node -e "require('./js/voxel-tiger.js')"`
exports `sampleTigerPose` for testing without a browser).

## 4. Sound (optional, off by default)

The experience is complete in silence. To add a dance track:

1. Drop a file at `assets/audio/dance.mp3`.
2. In `index.html`: `<a-entity id="tiger" voxel-tiger="autoDance: true; audioSrc: assets/audio/dance.mp3">`

Nothing autoplays: the audio element is only ever `play()`-ed while a dance
starts **and** the user has flipped the **Sound: Off → On** pill (explicit
gesture → browser autoplay-safe). Toggling back off or losing the target
stops and resets the file.

## 5. Replacing the tiger with a GLB later

The tracking layer (`index.html` + `js/app.js` + `imageTargetSrc`) never
changes. Swap one entity inside the anchor:

```html
<!-- before (current MVP) -->
<a-entity id="tiger" voxel-tiger="autoDance: true"></a-entity>

<!-- after (production asset) -->
<a-entity id="tiger" glb-tiger="src: assets/models/tiger.glb; clip: Dance"></a-entity>
```

Then implement `glb-tiger` with the **same public surface** as `voxel-tiger`:

- `playEntrance()` — drive the OneShot scale/rise; on finish call…
- `replayDance()` / dance loop — `model.mixer.clipAction(gltf.animations[i]).play()`
- emit `tiger-dance-started` / `tiger-dance-finished` so the existing
  "Dance again" button keeps working untouched
- `setSoundOn(on)` if you keep the sound hook

Scale/position/rotation: put a wrapper entity between anchor and GLB
(`<a-entity glb-tiger … scale="0.6 0.6 0.6" position="0 0 0">` — MindAR's
target lies in its local XY plane, so feet-on-card usually means a -90°
X-rotation if the GLB was authored Z-up; most GLTFs are Y-up and need
nothing).

`assets/models/` and `assets/audio/` directories are already in place.

## 6. Project layout

```
index.html            page + scene + UI markup
css/style.css         understated cream/gold interface
js/app.js             UI ↔ MindAR ↔ tiger glue
js/voxel-tiger.js     procedural character + entrance + choreography
vendor/               aframe.min.js, mindar-image-aframe.prod.js (offline)
targets/tiger-card.png  sample card (compile → tiger-card.mind)
tools/generate_target.py  card generator (Pillow)
AGENTS.md             project conventions for agent contributors
```

## 7. Status / next steps

- [ ] Compile `targets/tiger-card.mind` (one-off web step, see §2)
- [ ] On-device smoke test (iOS Safari + Android Chrome)
- [ ] Optional: record an 11 s music loop → `assets/audio/dance.mp3`
- [ ] Optional: iterate `CHOREO.keys` after seeing it move in AR
