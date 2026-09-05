# WebARTest audit and next-step plan

Audit date: 2026-09-04 (America/Denver). Reviewed main at e79b5049da351015514296706997edf6fb6d767e.

## Assessment

The small static architecture suits the product. Keep it. The next milestone should be a reliable silent scan-to-dance experience on actual phones, before character replacement or music.

## Verified status

- Clean initial worktree; local HEAD matched the remote HEAD. Six commits and one remote branch.
- GitHub Pages initially returned 404. GitHub API confirmed a private repo with has_pages=false. User authorized restoring public visibility and Pages after security review.
- Both application JavaScript files passed node --check.
- Local page rendered correctly at desktop and 390 x 844 phone viewport. Start AR reached the scanning interface with no captured warning/error console entries. This is desktop browser evidence, not physical-phone or image-tracking proof.
- Compiled target, original printable artwork, QR image, and vendored libraries exist. QR generator points at https://leemark.github.io/WebARTest/; physical QR scanning was not tested.

## Security review

Reviewed all first-party code and the complete tracked-file inventory; scanned all 22 historical Git blobs for common credentials/private-key patterns. No matches or first-party disclosure/injection paths found. Remote refs showed only main. Prior commits include earlier admitted-student wording; public history will expose that wording.

MindAR requests video with audio disabled and processes camera frames locally. No recording/upload path was found. Embedded workers were inspected for network calls. No first-party analytics, uploads, forms, credential storage, or unsafe HTML insertion were found.

MindAR 1.2.5 matches the official npm release exactly. A-Frame 1.4.2 executable bytes match its official npm release; only the source-map filename comment differs.

Caveat: A-Frame includes an optional inspector that loads a floating-version script from unpkg, activated by an inspector query parameter, shortcut, or an origin-unchecked message. Its script URL is fixed, not attacker supplied. Conditional VR/device-database and optional asset loaders also exist in the bundle. The current app's claim of absolutely no runtime CDN dependency is too broad. Disable the unused inspector and verify mobile requests in the next reliability pass. No exploit or camera exfiltration was observed. This review is not a guarantee of zero third-party vulnerabilities or a complete dependency advisory assessment.

## Findings and ordered plan

### 1. Restore demo access

Make repository public and enable HTTPS GitHub Pages from main/root, as authorized. Verify provider build completion and that deployed app/vendor/target assets match the checkout. Keep the current URL so existing QR codes remain useful.

### 2. Fix the core dance and recovery behavior

- Correct the dance baseline: voxel-tiger.js sets body.position.y to 0.62 at construction (line 325), but body.pos choreography begins at zero (line 145), and applyPose replaces the absolute position (line 532). A code-level reproduction confirmed a 0.62 to 0 drop on the first dance frame. Preserve the intended baseline throughout the dance; add a narrow regression check and visually inspect the entrance-to-dance transition.
- Handle camera/startup failures with useful recovery. app.js expects denied/NotAllowed, but this vendored MindAR reports VIDEO_FAIL for rejected camera requests. Target-loading/initialization failures can also leave the disabled Starting camera button indefinitely. Cover denial, absent camera, and unavailable/corrupt target; ensure each reaches a clear recoverable screen.
- Restore the pointing hint when tracking is lost, preserving the one-shot entrance and existing dance continuity. Currently the hint fades permanently after the first detection.
- Hide Sound until an audio source exists. Current Sound: On offers no audible result because no track is configured.
- Disable unused inspector/CDN injection and confirm ordinary camera use still works with locally vendored libraries.

Acceptance: no body jump; startup succeeds or gives actionable recovery; losing the card restores guidance; reacquisition does not replay the entrance; the silent demo has no nonfunctional sound control.

### 3. Prove the printed-card experience on phones

Use the actual QR and current target artwork printed at about 5 inches. Test iOS Safari and Android Chrome: cold QR launch, permission allow/deny/recovery, recognition under ordinary indoor lighting, several distances/angles, full dance, Dance Again, loss/reacquisition, rotation, and background/resume. Record phone/browser versions and time to camera-ready and first recognition. Check camera shutdown when leaving the page and whether framing/feet registration feel natural.

Proposed gate: five consecutive successful scan-to-dance runs on each platform, reliable reacquisition, no surprise audio, no stalled startup. This is a proposed acceptance criterion, not a measured result.

### 4. Polish only after the phone gate

Review tiger scale, silhouette, expression, entrance timing, and choreography in AR. Keep original procedural artwork. Decide whether one short dance followed by an idle pose/replay feels better than the current automatic looping dance. Iterate the existing data-driven keyframes first.

Optional sound comes later and needs real mobile gesture-policy validation. Current sound documentation overpromises: off mutes rather than stops/resets, loss is ignored, and enabling sound mid-dance does not immediately play. The future GLB instructions also need correction before use because app.js retrieves only the voxel-tiger component.

## Scope

No product code changed during this audit. Implementation items above remain a plan. Hosting restoration is separately authorized by the user. No new framework, backend, model pipeline, or generalized AR platform is needed.

## Hosting restoration result

Verified public repository with has_pages=true and HTTPS enforced. GitHub Pages build 1195337065 completed successfully for e79b5049da351015514296706997edf6fb6d767e. All nine checked deployed files (HTML, CSS, both application scripts, both vendor scripts, compiled target, target PNG, QR PNG) matched local bytes. Public landing page loaded successfully in the browser at https://leemark.github.io/WebARTest/.


## Reliability implementation

Implemented the body-position baseline correction, 30-second startup timeout,
initialization rejection handling, actionable camera guidance and reload button,
tracking-loss guidance, hidden unconfigured Sound control, page-exit camera
cleanup, and pre-scene inspector override. Vendor bundles remain unchanged.
README now documents the actual recovery, sound-hook limitations and phone gate.

Validation: Node syntax checks and both regression scripts passed. Browser
fault injection reproduced permission denial and absent camera; both reached
camera/settings guidance, and Reload returned to the landing screen. Missing
and corrupt target files reached the timeout/reload screen. The valid local
scene reached scanning without a Sound control. Inspector query and message
triggers did not inject an external inspector script. A separate local preview
rendered the procedural tiger dancing; baseline continuity is covered by the
full-dance regression, not a claimed physical-card observation.

Physical iPhone/Android recognition, alignment, lighting, timing and lifecycle
acceptance remain pending. Character/music polish is deliberately deferred until
that gate. Temporary browser fault-injection pages are not production files.

## Character, dance and tracking follow-up

Phone feedback confirmed the camera background and standing-on-marker orientation
fixes. A subsequent report described drift/puffing during camera movement.
Restored filterBeta from 0.01 to the vendored MindAR default 1000; this addresses
a source-confirmed excessive smoothing setting, but improvement and jitter on
physical phones remain unverified.

The procedural character now has an oversized head, broad white muzzle, larger
green eyes, compact chest, and articulated elbows/knees. Fur uses CC Tiger Gold
and corrected linear vertex colors. The 15.6-second medley includes robot holds,
running-man knee lifts/slides, coordinated floss swings, and a friendly finish.
Its root remains fixed on the mat throughout the dance.

Validated syntax, the lifecycle regression, body/leg pivot baselines over the
full dance, finite sorted keyframes, loop settlement, robot holds and opposing
hip/arm floss motion. Browser previews checked the face and each dance phase
from front and oblique views using the actual component. These do not establish
physical tracking performance. Next phone check: hold still, then make a slow
arc around a flat printed marker and compare the feet with the border.
