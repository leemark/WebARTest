# Tiny tiger: demo runbook

## What to bring

- The final card printed from `output/pdf/tiger-experience-card-letter.pdf` at
  **100% / actual size**, without fit-to-page scaling. The target is five inches
  square. Matte paper on a flat, sturdy backing is a useful demo starting point.
- A representative admitted-student box, with the card flat on top and the QR
  edge facing the person holding the phone.
- A charged Android phone and an iPhone, with the normal demo URL available:
  <https://leemark.github.io/WebARTest/>. Use Chrome on Android or Safari on iPhone.
- A reviewed real-phone backup recording, available locally before the meeting.
  Its capture/review remains pending until a tester supplies it.

Set up in ordinary room light with no bright reflection over the artwork.
Check the network in the room. Keep a second printed copy nearby so someone
else can try the experience without interrupting the presenter's setup.

## Thirty-second introduction

“Imagine this tucked into an admitted student's welcome package. You scan the
QR code, open the camera, and this little tiger comes to life on the card.
There's no app to install. We're testing whether one small, playful moment can
make that welcome feel more personal. The artwork and character are an MVP
interpretation; today I'd love your reaction to the experience.”

Then stop explaining and let the tiger do the work.

## Two-minute walkthrough

1. Hand over the card or point to it on the box. Scan its QR in the phone's
   ordinary camera, then open the webpage. Use the **ordinary demo**, not the
   tracking-check URL with diagnostic controls.
2. Let the participant read the welcome and tap **Start AR**. Allow camera
   access. Keep the card flat and view from its QR edge.
3. Point at the complete tiger artwork, initially filling roughly half the
   phone screen's width. Give it a moment to recognize the image. Let the
   greeting and full performance finish before talking over it.
4. Tap **Dance again**. The performance restarts; the entrance should not.
5. Invite another person to try. Ask for the reaction before explaining the
   technology or discussing future additions.

If the tiger briefly disappears, bring the whole artwork back into view and
hold still. It waits for a fresh lock before returning. If startup fails, use
the on-screen reload guidance and check camera permission. If the room/network
prevents a useful live demonstration, play the real-phone backup and offer a
hands-on try afterward.

For a video call, introduce the physical card on camera, play the backup clip,
then show the QR/print page so colleagues can try it later. Don't rely on the
computer webcam reproducing the phone's AR view for the audience.

## Feedback to ask for

- “What was your first reaction when the tiger appeared?”
- “Was there any point where you weren't sure what to do?”
- “Would this add something to an admitted-student welcome package?”
- “What would you change before we tried it with a small group of students?”

## Final-release rehearsal record — not yet completed

Earlier Android and iPhone captures support the tracking-recovery behavior.
The revised welcome, final printed layout and new performance still need the
following end-to-end checks. Record the actual release and observations here;
do not mark a run successful based on a desktop simulation.

Release: **demo-1** (the commit publishing this runbook; record the deployed
commit with the rehearsal results).

| Check | Device/browser | Result | Observation |
|---|---|---|---|
| Android run 1: fresh QR launch, full performance, replay | Pending | Pending | |
| Android run 2: brief loss, recovery, replay | Pending | Pending | |
| Android run 3: leave/reopen, complete experience | Pending | Pending | |
| iPhone run 1: fresh QR launch, full performance, replay | Pending | Pending | |
| iPhone run 2: brief loss, recovery, replay | Pending | Pending | |
| iPhone run 3: leave/reopen, complete experience | Pending | Pending | |
| New participant completes the journey without coaching | Pending | Pending | |
| Backup phone recording reviewed and available locally | Pending | Pending | |

A successful run reaches the camera or gives useful recovery guidance, finds
the card in ordinary conditions, completes the performance, and replays without
another entrance. Note visible drifting, repeated disappearances, confusing
copy, or a cut-off character. Check that leaving the page stops the camera.
Record phone model, browser version, lighting and rough startup time. Three
successful ordinary-use runs per platform are a demo rehearsal, not a claim of
universal device support.

## Backup recording instructions

Use the phone's screen recorder with microphone recording off. Frame the final
card/box cleanly, with the whole tiger comfortably inside the camera view.
Capture 20–30 seconds covering recognition, the greeting, all three dances and
the finish. Leave a short beat before and after the performance; avoid app
switching or notifications during the take. Review it once at normal speed.

Share the clip with the project owner for review, along with which phone was
used. Keep the original and final recording outside the public repository;
publishing the demo site does not publish this recording. The presenter should
keep a local copy available for the meeting.
