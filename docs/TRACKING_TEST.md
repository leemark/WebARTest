# Printed-card tracking check

Use the existing artwork, so the target and tracker settings stay comparable.
Print `targets/tiger-card.png` about 5 inches square, or use the local combined
card in `print-card.html` at actual size. Lay it flat on a table or box in
ordinary room light. Matte paper is a useful starting point; keep glare off it.

1. Open <https://leemark.github.io/WebARTest/?tracking-test=1> on the phone.
2. Tap **Start AR**, find the card, and let the entrance settle. The tiger stands
   still in this mode. A cyan outline shows the tracked square and its center.
3. Choose **Printed card** (or **Monitor** for a comparison), then tap
   **Capture 20 seconds**. Follow the prompts: hold still for 5 seconds, move in
   a slow arc for 10 seconds, and hold still for 5 seconds. Keep the full target
   visible, roughly half the screen width, without using camera zoom.
4. Tap **Save report** and share the downloaded JSON with the developer.
   A short screen recording of the same movements is useful if the tiger or
   outline slips or flips. Video is optional and recorded separately by you.
5. Open the ordinary demo URL to compare the dancing experience.

No USB connection is needed. Start with one printed-card run. A second monitor
run at a similar distance and angle helps isolate the surface/lighting change.
Tell us the phone model, whether the outline stayed on the border, and whether
the issue was small shaking, delayed following, or sudden flips/jumps.

## What the report means

Capture is opt-in and limited to 20 seconds or 1,200 processing updates.
Nothing is uploaded automatically. It stores numeric poses, target/filter
configuration, browser user-agent, viewport size, and basic camera settings in
memory until you download the report or leave the page. It excludes camera
images, audio, location, device IDs and camera labels. Backgrounding the page
ends an active capture early. Starting another capture replaces the old one.

Each sample is taken after MindAR's `processDone`, after its anchor update:

- `fresh`: MindAR has a current tracked pose (`isTracking`).
- `visible`: the tracker is still showing the anchor (`showing`).
- `missedFrames`: consecutive tracking misses (`trackMiss`).
- `rawMatrix`: unfiltered camera-space pose in target-pixel units, or null
  without a fresh result.
- `renderedMatrix`: the current filtered, centered and scaled anchor matrix,
  or null while hidden. Multiply a point in card units by this matrix; one unit
  is one target width. It contains no tiger animation transforms.

The current MindAR configuration can retain the old pose for eight missed
processing cycles, then hide on the ninth. Reacquisition during that grace
period can replace the pose without another warmup. This is a plausible source
of slipping then snapping; these reports let us distinguish it from pose jumps
while tracking remains fresh. Pose changes during intentional phone movement
are expected, so the report is **not** a measurement of tracking accuracy by
itself. Use the hold-still portions and video/observations together.

The test mode does not tune the tracker. The ordinary entry keeps the existing
one-shot entrance, dance loop and tracking settings. Validate on a physical
phone and printed card before claiming an improvement.

References: [MindAR tracking controls](https://hiukim.github.io/mind-ar-js-doc/quick-start/tracking-config/)
and [target-image guidance](https://www.mindar.org/how-to-choose-a-good-target-image-for-tracking-in-ar-part-3/).
