# Tiger Experience: team-demo readiness

Plan established September 6, 2026. Target: the coming week's internal team demo;
the exact meeting date and format are not yet supplied. Support an in-person
demonstration and prepare a real-phone recording usable on a video call.

## Outcome

A person picks up a polished Colorado College welcome card, scans its QR code,
opens the camera, and discovers a tiny tiger standing on the artwork. The tiger
greets them, performs its dance medley, and finishes ready for another dance.
The presenter has a rehearsed short demonstration and a usable backup recording.

This remains a silent, static-site MVP. Keep the original procedural character,
vendored A-Frame/MindAR, existing QR destination, and compiled image target.
Music, imported models, new AR engines, analytics and further tracking tuning
are outside this release unless a regression makes a scoped repair necessary.

## Baseline and constraints

- The current recovery policy hides on the first reported miss and requires
  four consecutive successes before returning. Preserve it, the transparent
  camera background, marker-relative orientation, and grounded animation root.
- User-provided printed-card captures and visual feedback support the current
  recovery behavior on Android and iPhone. They do not replace a first-time,
  end-to-end rehearsal of the final presentation and revised animation.
- The combined card currently exists as uncommitted local work. Finish that
  draft; do not substitute a new tracked image. Preserve the embedded target
  PNG and its aspect ratio, the QR content, and the five-inch target size.
- Use the established cream, Tiger Gold, dark ink and white palette. Keep all
  character visuals procedural. Personal reference photos and raw test reports
  stay out of the public repository and demo assets.

## 1. Finish the physical card and welcome flow

- [x] Refine the existing six-by-eight-inch combined card into a cohesive
  welcome piece. Use “Meet your tiny tiger” as the main invitation, with a small
  Colorado College welcome line outside the tracked square.
- [x] Keep the QR outside the tracked artwork. Make the sequence explicit:
  scan the QR, place the card flat, tap Start AR, then point at the tiger artwork.
  Identify the viewing edge so the character faces the participant naturally.
- [x] Deliver the self-contained SVG, the print webpage, and a US Letter PDF
  with the six-by-eight-inch card at actual size. Verify the target is five
  inches square and both embedded images remain unchanged.
- [x] Match the landing page invitation, typography, colors and instructions
  to the card. Use short loading/scanning/recovery messages and retain the
  explicit camera permission tap and truthful privacy copy.
- [ ] Publish the finished print page and downloads with the demo release.

Acceptance: the card reads clearly at its printed size, the QR opens the
ordinary demo URL, and a first-time participant can follow the instructions.
No diagnostic controls appear on the ordinary demo entry.

## 2. Polish the performance

- [x] Preserve the approved cute silhouette and colors. Improve expression
  through existing head, ear and articulated limb movement rather than a
  character replacement.
- [x] After the existing one-shot entrance, give the tiger a short acknowledgment
  gesture, then the robot, running man and floss, followed by a friendly finish.
  Target an approximately 18-second performance, including greeting and finish.
- [x] Keep the root planted on the marker. Refine holds, anticipation and
  transitions in the existing data-driven keyframes; avoid spins or translations
  that can be confused with tracking movement.
- [x] End in a friendly resting pose and wait for replay instead of automatically
  looping. Replay restarts the greeting/medley without repeating the entrance.
  Keep initial automatic dancing separate from optional looping in the component
  configuration; the normal demo uses initial dancing on and looping off.
- [x] Keep Dance Again usable after the performance starts, with clear pressed
  feedback. Preserve the diagnostic mode's stationary tiger and pose capture.
- [x] Keep choreography time continuous through tracking loss. Returning to
  the target must not restart the greeting or entrance.

Acceptance: front and oblique previews clearly distinguish all three dances;
there is no baseline drop or root drift; entrance-to-performance and replay
transitions are smooth; the performance settles rather than endlessly looping.

## 3. Integrate, verify and publish

- [x] Run relevant syntax and regression checks. Update coverage for the
  greeting/finish timeline, one-shot default performance, replay, interrupted
  tracking, and stationary diagnostics. Keep finite-keyframe and grounded-root
  checks meaningful.
- [x] Inspect the actual component and welcome flow in a browser at phone sizes,
  including a short viewport. Verify controls remain readable and reachable.
- [x] Check permission denial/retry, startup timeout, background/resume and camera
  shutdown using the existing recovery paths. Repair only reproduced regressions.
- [x] Update README status to distinguish completed phone tracking evidence
  from the final first-time-user rehearsal still pending.
- [ ] Commit only the demo scope, publish to the existing GitHub Pages URL,
  verify the provider build, and compare live asset bytes with the commit.
  Freeze that release for rehearsal; reopen it only for a demo-blocking defect.

## 4. Prepare and rehearse the delivery

- [x] Write a short demo runbook with setup, a 30-second introduction, a
  two-minute walkthrough, and the specific feedback to request from the team.
  Explain the admitted-student/package use case and that the character/artwork
  are an MVP interpretation, without technical detail in the participant flow.
- [ ] Print the final card and place it flat on a representative box or sturdy
  surface. Rehearse with normal room lighting and the network to be used.
- [ ] Have a person unfamiliar with the experience complete scan → permission
  → recognize → full performance → replay without coaching. Observe confusing
  steps and whether the surprise lands; address blocking confusion.
- [ ] Verify three consecutive complete ordinary-use runs on Android Chrome
  and three on iPhone Safari with the final release. Include a brief loss and
  reacquisition and confirm replay does not rerun the entrance. Record actual
  results and device/browser details; do not treat earlier diagnostic captures
  as proof of this revised performance.
- [ ] Capture and review one clean 20–30-second real-phone recording showing
  the printed card and full performance for backup/video-call use. Provide a
  local handoff link; do not publish the recording automatically.

The physical runs, novice observation and real-phone recording require the
user or a tester. Prepare precise instructions and all artifacts first; keep
these checklist items pending until the evidence or observations are supplied.
Do not claim that a simulated browser test is a physical rehearsal.

## Execution order and completion

1. Card/welcome and keyframe polish can proceed independently after this plan.
   Assign separate ownership of visual/print assets and animation code; integrate
   component/UI behavior and validation centrally to avoid overlapping edits.
2. Integrate, visually review, test, and publish the candidate release.
3. Supply the print package and runbook, then coordinate the final phone runs,
   novice rehearsal and backup recording. Fix only findings needed for the demo.
4. Complete the goal only when the scope is published and verified, the print
   package/runbook are delivered, and the physical rehearsal and recording are
   confirmed. Until then, report completed work and remaining human-dependent
   checks separately.

If the meeting is earlier than expected, prioritize the finished card, clear
welcome and validated existing dances. Report any deferred performance work
explicitly and obtain a scope adjustment rather than silently dropping a goal
requirement. Optional music does not delay this release.

## Candidate validation — September 6, 2026

All five Node regression suites and JavaScript syntax checks passed. Browser
review used the actual component with simulated marker inputs: greeting, dance
poses, settling at 18 seconds, replay with one entrance, and loss/recovery.
The welcome and camera-error/reload flow fit a 320 x 568 viewport; the print
page was reviewed at phone width. Existing lifecycle tests cover startup timeout,
late initialization, background/resume and camera cleanup. This is desktop
validation, not the final physical rehearsal. The Letter PDF was rendered and
reviewed; source target/QR bytes and embedded PDF image pixels are preserved.
