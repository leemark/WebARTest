# Tiger AR — Image-Target WebAR Prototype

A mobile WebAR prototype: point a phone camera at the printed tiger card and a
charming little blocky tiger pops up on it and greets you, performs an approximately 18-second dance, and waits for a replay.

The character is **100 % procedural** — built from plain box geometry at
runtime (`js/voxel-tiger.js`), so there is no dependence on any external 3D
model or pre-existing artwork.

```
camera → image recognition → tiger appears (POP) → tiger dances → rests → replay
```

---

## 1. Run it

**Live demo (GitHub Pages — HTTPS, ready for mobile):**
<https://leemark.github.io/WebARTest/>

**Test it:** scan `qr-code.png` (in this repo) with a phone camera →
the URL opens → tap **Start AR** → point at `targets/tiger-card.png`
(printed ~5 in) → a blocky tiger pops out and dances.

Regenerate the QR anytime with `python -m venv .venv && .venv/Scripts/pip
install "qrcode[pil]"` then `python tools/generate_qr.py`.

To test locally, any static file server works. MindAR requires **HTTPS
(or localhost)** and a mobile browser (iOS Safari / Android Chrome):

```bash
# from this folder — pick one:
python -m http.server 8000          # then open http://localhost:8000
npx serve .
```

The Pages site serves from the public `main` branch's root with HTTPS enforced.
Pushes to `main` rebuild Pages; verify the Pages build and live URL afterward.
Changing repository visibility can affect hosting availability. The original
QR URL is unchanged.

Startup failures show camera/settings or connection guidance and a **Reload
and try again** button. Startup is limited to 30 seconds. Reload creates a fresh
camera/tracker session; leaving the page stops the camera, and returning through
browser history reloads a fresh landing screen.


### Print the combined card

Open `print-card.html` for a single-sided 6 x 8 inch card containing both the
QR and the tiger artwork. Use **100% / actual size**, with browser headers and
footers off. It fits US Letter paper; the tiger target prints at 5 x 5 inches.
`output/pdf/tiger-experience-card-letter.pdf` is a US Letter print file with
the card at actual size. `targets/tiger-experience-card.svg` is the matching
self-contained graphic. The print page provides both downloads.
Regenerate the package with `python tools/generate_demo_card.py` using a Python
environment with ReportLab and Pillow.

The original QR is unchanged and sits outside the tracked square. The print
package now embeds the mascot-face artwork, paired with its newly compiled
`tiger-card.mind`. Reprint the updated card for this release; the previous
printed face is no longer the intended tracking target.

## 2. The image target

`targets/tiger-card.png` is a print-ready ~5 in @ 300 dpi sample card. The
app loads a **compiled** target from `targets/tiger-card.mind`, currently in
the repo. If you regenerate the card, re-compile it:

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

### Mascot-face target (mascot-1)

`targets/tiger-card.png` is an original faceted portrait based on the procedural
character's gold palette, teal eyes, cream muzzle and square ears. Generate it
with `.venv/Scripts/python.exe tools/generate_target.py` (Pillow and NumPy).
The 1600 x 1600 image retains the surrounding asymmetric frame and caption.
`--face pixel` writes the older design to a separate `tiger-card-pixel.png`.

The official browser compiler produced the paired version-2 `.mind` target:
one 1600 x 1600 image, 13 matching scales and two tracking scales. Its embedded
tracking image was visually checked against this face. Compile only the square
PNG, not the complete QR/welcome card. On future artwork changes, replace PNG
and `.mind` together, update the target SHA-256 in `tools/generate_demo_card.py`,
regenerate the SVG/PDF, and change the target URL cache version in `index.html`
and the target identifier in `js/tracking-test.js`.

The QR destination stays unchanged. Printed-phone testing of this new artwork
is pending; earlier tracking captures describe the previous artwork.

Tracking uses MindAR 1.2.5's default adaptive response (`filterBeta: 1000`),
with `filterMinCF: 0.001`. The earlier beta of `0.01` made the pose filter
slow to follow camera movement. The current response and the recovery policy below have since been exercised
on printed cards using Android Chrome and iPhone Safari, with positive user
feedback. That evidence supports this prototype, not universal device reliability.
Miss/warmup tolerances affect losing/reacquiring the target, not continuous pose
smoothing. For the comparison, hold still, then move slowly in an arc around a
flat card; watch the feet relative to the printed border.

Recovery now uses `missTolerance: 0`: the first reported tracking miss hides
the anchor instead of retaining a stale pose for eight processing cycles.
`warmupTolerance: 3` requires four consecutive successful updates to show it
again. `js/app.js` resets MindAR 1.2.5's warmup counter on misses, including
while hidden; MindAR resets its pose filter when the new lock becomes visible.
The entrance remains one-shot and the dance clock continues during loss.
This can replace sliding/snapping with a brief disappearance; it does not
improve image recognition or impose a wall-clock limit on delayed tracker results.

For a stationary-tiger comparison and an opt-in 20-second numeric tracking
capture, open `?tracking-test=1`. Follow [the printed-card test steps](docs/TRACKING_TEST.md).
The report separates fresh poses from stale poses retained during brief tracking
loss. It stays on the phone unless the tester chooses to download and share it;
no camera images or audio are captured. This mode does not change tracker tuning.


## 3. How the tiger works

`js/voxel-tiger.js` registers the A-Frame component `voxel-tiger`. It builds
this hierarchy from `THREE.BoxGeometry` (shared Lambert material, per-face
vertex shading for the voxel look). Its gold uses Colorado College's
[Tiger Gold #EAB337](https://www.coloradocollege.edu/offices/ocm/guides-and-best-practices/visual-style/colors.html).
The face takes visual cues from RoCCy's broad white cheeks and expressive eyes;
the model remains original procedural geometry, with no mascot photos or logo
artwork embedded.

Hierarchy:

```
rig (anchor) └ root └ body
                ├ torso ─ chest, belly, stripes
                ├ head  ─ skull, muzzle, eyes, nose, stripes + earL/earR
                ├ armL / armR   (shoulder + elbow pivots)
                ├ legL / legR   (hip + knee pivots)
                └ tailBase → tailMid → tailTip (chained pivots)
```

- **Entrance (1.15 s):** rises from below the target while scaling 0 → 1.12
  with an ease-out-back overshoot, then settles to scale 1. Plays **once**
  (`targetFound` is gated by a `foundOnce` flag, and `playEntrance()` only
  runs from the `hidden` state), so tracking flicker never retriggers it.
- **Performance (~18 s):** data-driven keyframes in `CHOREO.keys`: greeting,
  robot, running man, floss and a friendly finish. Bent elbow and knee pivots,
  held poses and coordinated movement make the routines distinct. The root
  stays fixed on the marker. The default ends at rest until **Dance again**;
  `autoDance` controls the initial performance and a separate `loop` option
  controls automatic repetition (off on the demo page).
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

The sound toggle is hidden unless `audioSrc` is configured. Audio defaults off
and is attempted only after the user enables it. The current hook attempts
playback at the next dance start; toggling off mutes it. Track loss preserves
dance timing and does not stop audio. Mobile browser playback-policy behavior
must be tested before adding a track; an earlier toggle alone does not guarantee
that later playback is allowed.


## 5. Replacing the tiger with a GLB later

The image target stays the same. Swap one entity inside the anchor, then
update the `tiger()` accessor in `js/app.js` to retrieve `glb-tiger`:

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

Scale/position/rotation: MindAR's target lies in its local XY plane; +Z points
out of the printed surface. The procedural tiger is Y-up, so its parent uses
`rotation="90 0 0"` to put its feet toward the card and its head outward from it.
This fixed orientation stays outside the animated root, so dance spins and
entrance motion follow the same standing-on-card frame. Its front faces the
bottom edge of the printed artwork before the presentation adjustment below.
For testing as a dance mat, lay the card
flat and view it from that edge; a vertical screen makes the tiger project
outward from the screen. Apply the same +90-degree X rotation to a Y-up GLB,
or choose the equivalent transform for that model's authored up axis.

### Camera-facing presentation

`js/camera-facing.js` turns the tiger toward the camera within the upright
marker frame. Above a 45-degree viewing elevation it adds a backward tilt,
capped at 30 degrees. The pivot remains at the marker origin between the feet;
the soles are not constrained to stay flush while leaning. This is a visual
presentation adjustment, not a change to MindAR tracking or marker placement.

The hierarchy is anchor → fixed upright rotation → camera-facing pivot →
animated tiger. Heading and tilt use deadbands, 0.20-second exponential smoothing
and a 120-degree/second speed limit. Heading holds near overhead with hysteresis
to avoid an ambiguous direction causing spins. Hidden anchors are not sampled;
the first visible pose initializes the adjustment without interpolating from a
stale lock. Dance timing and the one-shot entrance remain independent.

The default is `camera-facing="maxTilt: 30"` in `index.html`. A browser comparison
of 0, 30 and 45 degrees supported starting at 30; real-phone comfort and apparent
foot contact still need testing. `?tracking-test=1` bypasses presentation rotation
so the diagnostic tiger and cyan outline remain strictly marker-relative.

`assets/models/` and `assets/audio/` directories are already in place.

## 6. Project layout

```
index.html            page + scene + UI markup
css/style.css         understated cream/gold interface
js/ar-config.js       disables optional remote A-Frame inspector
js/app.js             UI ↔ MindAR ↔ tiger glue
js/voxel-tiger.js     procedural character + entrance + choreography
vendor/               aframe.min.js, mindar-image-aframe.prod.js (offline)
targets/tiger-card.png  sample card (compile → tiger-card.mind)
tools/generate_target.py  card generator (Pillow)
AGENTS.md             project conventions for agent contributors
```

## 7. Status / next steps

- [x] GitHub Pages live (HTTPS): <https://leemark.github.io/WebARTest/>
- [x] Compiled target: `targets/tiger-card.mind`
- [ ] On-device smoke test (open the Pages URL on iOS Safari / Android Chrome,
      print the card at ~5 in, point camera → tiger pops + dances)
- [ ] Optional: record a music loop matching the medley → `assets/audio/dance.mp3`
- [ ] Optional: iterate `CHOREO.keys` after seeing it move in AR

## 8. Reliability checks

```bash
node --check js/app.js
node --check js/ar-config.js
node --check js/voxel-tiger.js
node tests/app-lifecycle.test.js
node tests/tracking-test.test.js
node tests/dance-baseline.test.js
node tests/choreography.test.js
node tests/performance-lifecycle.test.js
node tests/camera-facing.test.js
```

The tiger's body and leg position keys are offsets from their resting pivots. Root-position
keys remain absolute. Tracking loss restores the pointing hint; reacquisition
hides it without replaying the one-shot entrance or resetting choreography.

`js/ar-config.js` disables the optional inspector before the scene initializes,
covering its query, shortcut, and message activation paths without modifying
vendor files. The configured AR flow uses local scripts and the local target;
unused A-Frame features still contain conditional external asset loaders.

Final demo rehearsal remains pending: print the final combined card at actual
size and complete three scan-to-dance runs each on iOS Safari and Android Chrome.
Check permission recovery, indoor lighting, card angles, full dance and replay,
loss/reacquisition, rotation, background/resume, and camera shutdown on exit.
Record device/browser versions and startup/recognition times. Desktop simulation
does not prove image recognition or physical card registration.
