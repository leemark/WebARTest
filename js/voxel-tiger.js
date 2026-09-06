/* =============================================================================
 * voxel-tiger.js
 *
 * A-Frame component that builds and animates an original, procedural,
 * blocky / voxel-style tiger mascot. No external 3D model is required:
 * the character is assembled from plain THREE.BoxGeometry at runtime.
 *
 * Hierarchy (all animatable parts are registered by name):
 *
 *   rig (this.el, placed on the MindAR anchor)
 *   └─ root            entrance scale/position + dance spin/lean/bounce
 *      └─ body         hip-height pivot: dance bounce & torso twist
 *         ├─ torso     chest counter-twist (meshes: chest, belly, stripes)
 *         ├─ head      head pivot group (meshes: skull, ears, muzzle, eyes…)
 *         │  ├─ earL / earR
 *         ├─ armL / armR      shoulder pivots → elbowL / elbowR
 *         ├─ legL / legR      hip pivots → kneeL / kneeR (thigh + shin + foot)
 *         └─ tailBase → tailMid → tailTip   chained tail pivots
 *
 * Animation is data-driven: CHOREO.keys maps "<part>.<pos|rot|scale>" to a
 * sorted list of [time, value] keyframes which are linearly interpolated.
 * Edit the keyframes to retune the dance — no other code changes needed.
 *
 * Events emitted on this.el:
 *   tiger-entrance-started / tiger-dance-started / tiger-dance-finished / tiger-hidden
 *
 * Public methods (via el.components['voxel-tiger']):
 *   playEntrance()  – pop-in animation, then the dance (runs once per show)
 *   replayDance()   – restart the greeting and medley from t=0 (for the UI)
 *   loop           – optional repeat mode; defaults to one performance
 *   setSoundOn(on)  – enable/disable the optional dance audio
 *   getState()      – 'hidden' | 'entering' | 'dancing' | 'paused'
 *
 * FUTURE GLB REPLACEMENT: see README.md § "Replacing the tiger with a GLB".
 * ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   *  Palette — warm tiger gold, soft black, cream white.                *
   * ------------------------------------------------------------------ */
  var PALETTE = {
    // Colorado College Tiger Gold, kept as a named orange for the existing API.
    orange: 0xeab337,
    black:  0x2a2118,
    white:  0xf7f1e3,
    nose:   0x1c1410,
    eye:    0x2d8b78
  };

  /* ------------------------------------------------------------------ *
   *  Small math helpers                                                 *
   * ------------------------------------------------------------------ */
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // t^3 - 2t^2 + 2t style overshoot used for the entrance "POP".
  function easeOutBack(t, s) {
    t = clamp01(t);
    s = (s === undefined) ? 1.70158 : s;
    var u = t - 1;
    return 1 + u * u * ((s + 1) * u + s);
  }
  function easeOutCubic(t) { t = clamp01(t); var u = t - 1; return 1 + u * u * u; }

  /* ------------------------------------------------------------------ *
   *  Voxel box builder.                                                 *
   *                                                                     *
   *  BoxGeometry position order is: px, nx, py, ny, pz, nz — each face  *
   *  gets a slightly different shade of the base colour so the flat-lit *
   *  model still reads as chunky voxel art (fake per-face shading).     *
   * ------------------------------------------------------------------ */
  function shade(hex, factor) {
    var c = new THREE.Color(hex);
    // THREE r147 defaults to legacy color handling, where setHex leaves
    // components in sRGB. Convert once for vertex colors in that mode.
    if (!THREE.ColorManagement || THREE.ColorManagement.legacyMode) {
      c.convertSRGBToLinear();
    }
    c.multiplyScalar(factor);
    return c;
  }

  function buildBox(w, h, d, colorHex, pivot) {
    var geo = new THREE.BoxGeometry(w, h, d).toNonIndexed();

    // Optional pivot offset (e.g. swing an arm from the shoulder, not centre).
    if (pivot) geo.translate(pivot.x || 0, pivot.y || 0, pivot.z || 0);

    var faces = [
      shade(colorHex, 0.96), // +x
      shade(colorHex, 0.88), // -x
      shade(colorHex, 1.10), // +y (top, catches the light)
      shade(colorHex, 0.60), // -y (bottom, in shadow)
      shade(colorHex, 1.00), // +z (front)
      shade(colorHex, 0.80)  // -z (back)
    ];

    var pos = geo.getAttribute('position');
    var colors = new Float32Array(pos.count * 3);
    for (var f = 0; f < 6; f++) {
      for (var v = 0; v < 6; v++) {
        var i = f * 6 + v;
        colors[i * 3]     = faces[f].r;
        colors[i * 3 + 1] = faces[f].g;
        colors[i * 3 + 2] = faces[f].b;
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    return new THREE.Mesh(geo, getVoxelMaterial());
  }

  // One shared material keeps draw-call state cheap on mobile GPUs.
  var voxelMaterial = null;
  function getVoxelMaterial() {
    if (!voxelMaterial) {
      voxelMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
    }
    return voxelMaterial;
  }

  /* ------------------------------------------------------------------ *
   *  Choreography data                                                  *
   *                                                                     *
   *  Every motion lives in CHOREO.keys.  The five explicit sections are *
   *  a welcoming acknowledgment, robot freezes, a running-man, a floss, *
   *  and a short friendly finish.  The root never leaves the mat: all    *
   *  bounce and travel cues are small body or joint motions.             *
   * ------------------------------------------------------------------ */
  var CHOREO = {
    duration: 18,
    sections: [
      { name: 'welcoming-acknowledgment', start: 0, end: 2 },
      { name: 'robot-freezes', start: 2, end: 6 },
      { name: 'running-man', start: 6, end: 11 },
      { name: 'floss', start: 11, end: 16 },
      { name: 'friendly-finish', start: 16, end: 18 }
    ],
    keys: {
      'root.pos': [
        [0,[0,0,0]], [1.35,[0,0,0]], [2,[0,0,0]], [18,[0,0,0]]
      ],
      'root.rot': [
        [0,[0,0,0]], [1.35,[0,0,0]], [2,[0,0,0]], [18,[0,0,0]]
      ],
      'body.pos': [
        [0,[0,0,0]], [0.35,[0,0.025,0]], [0.7,[0,-0.018,0]], [1.05,[0,0.022,0]],
        [1.35,[0,0,0]], [2,[0,0,0]], [2.18,[0,0,0]], [2.7,[0,0,0]],
        [2.86,[0,0,0]], [3.35,[0,0,0]], [3.51,[0,0,0]], [4,[0,0,0]],
        [4.16,[0,0,0]], [4.65,[0,0,0]], [4.81,[0,0,0]], [5.35,[0,0,0]],
        [5.6,[0,0,0]], [5.85,[0,0,0]], [6,[0,0,0]], [6.45,[-0.07,-0.02,0.02]],
        [6.8,[0.07,0.018,-0.02]], [7.15,[-0.07,-0.018,0.02]], [7.5,[0.07,0.018,-0.02]], [7.85,[-0.07,-0.018,0.02]],
        [8.2,[0.07,0.018,-0.02]], [8.55,[-0.07,-0.018,0.02]], [8.9,[0.07,0.018,-0.02]], [9.25,[-0.07,-0.018,0.02]],
        [9.6,[0.07,0.018,-0.02]], [9.95,[-0.07,-0.018,0.02]], [10.3,[0.07,0.018,-0.02]], [10.65,[-0.05,-0.01,0.01]],
        [11,[0,0,0]], [11.35,[-0.075,0,0]], [11.85,[0.075,0,0]], [12.35,[-0.075,0,0]],
        [12.85,[0.075,0,0]], [13.35,[-0.075,0,0]], [13.85,[0.075,0,0]], [14.35,[-0.075,0,0]],
        [14.85,[0.075,0,0]], [15.35,[-0.075,0,0]], [16,[0,0,0]], [16.3125,[0,0.04,0]],
        [16.6875,[0,0.03,0]], [17.125,[0,0.015,0]], [18,[0,0,0]]
      ],
      'body.rot': [
        [0,[0,0,0]], [0.35,[0,-0.14,0]], [0.7,[0,0.14,0]], [1.05,[0,-0.1,0]],
        [1.35,[0,0,0]], [2,[0,0,0]], [2.18,[0,0.16,0]], [2.7,[0,0.16,0]],
        [2.86,[0,-0.16,0]], [3.35,[0,-0.16,0]], [3.51,[0,0.16,0]], [4,[0,0.16,0]],
        [4.16,[0,-0.16,0]], [4.65,[0,-0.16,0]], [4.81,[0,0.16,0]], [5.35,[0,0.16,0]],
        [5.6,[0,-0.16,0]], [5.85,[0,-0.16,0]], [6,[0,0,0]], [6.45,[0.08,-0.12,0.04]],
        [6.8,[-0.08,0.12,-0.04]], [7.15,[0.08,-0.12,0.04]], [7.5,[-0.08,0.12,-0.04]], [7.85,[0.08,-0.12,0.04]],
        [8.2,[-0.08,0.12,-0.04]], [8.55,[0.08,-0.12,0.04]], [8.9,[-0.08,0.12,-0.04]], [9.25,[0.08,-0.12,0.04]],
        [9.6,[-0.08,0.12,-0.04]], [9.95,[0.08,-0.12,0.04]], [10.3,[-0.08,0.12,-0.04]], [10.65,[0.04,-0.05,0.02]],
        [11,[0,0,0]], [11.35,[0,-0.12,0]], [11.85,[0,0.12,0]], [12.35,[0,-0.12,0]],
        [12.85,[0,0.12,0]], [13.35,[0,-0.12,0]], [13.85,[0,0.12,0]], [14.35,[0,-0.12,0]],
        [14.85,[0,0.12,0]], [15.35,[0,-0.12,0]], [16,[0,0,0]], [16.3125,[-0.05,0.08,-0.02]],
        [16.6875,[0.03,-0.06,0.01]], [17.125,[0.01,-0.02,0]], [18,[0,0,0]]
      ],
      'torso.rot': [
        [0,[0,0,0]], [0.35,[0,0.08,0]], [0.7,[0,-0.08,0]], [1.05,[0,0.06,0]],
        [1.35,[0,0,0]], [2,[0,0,0]], [2.18,[0,0,0]], [2.7,[0,0,0]],
        [2.86,[0,0,0]], [3.35,[0,0,0]], [3.51,[0,0,0]], [4,[0,0,0]],
        [4.16,[0,0,0]], [4.65,[0,0,0]], [4.81,[0,0,0]], [5.35,[0,0,0]],
        [5.6,[0,0,0]], [5.85,[0,0,0]], [6,[0,0,0]], [6.45,[0,0.1,-0.03]],
        [6.8,[0,-0.1,0.03]], [7.15,[0,0.1,-0.03]], [7.5,[0,-0.1,0.03]], [7.85,[0,0.1,-0.03]],
        [8.2,[0,-0.1,0.03]], [8.55,[0,0.1,-0.03]], [8.9,[0,-0.1,0.03]], [9.25,[0,0.1,-0.03]],
        [9.6,[0,-0.1,0.03]], [9.95,[0,0.1,-0.03]], [10.3,[0,-0.1,0.03]], [10.65,[0,0.05,-0.01]],
        [11,[0,0,0]], [11.35,[0,-0.1,-0.02]], [11.85,[0,0.1,0.02]], [12.35,[0,-0.1,-0.02]],
        [12.85,[0,0.1,0.02]], [13.35,[0,-0.1,-0.02]], [13.85,[0,0.1,0.02]], [14.35,[0,-0.1,-0.02]],
        [14.85,[0,0.1,0.02]], [15.35,[0,-0.1,-0.02]], [15.75,[0,0.04,0]], [16,[0,0,0]],
        [16.3125,[0,0.06,0]], [16.6875,[0,-0.04,0]], [17.125,[0,0,0]], [18,[0,0,0]]
      ],
      'head.rot': [
        [0,[0,0,0]], [0.35,[0.1,-0.2,0.04]], [0.7,[-0.03,0.18,-0.03]], [1.05,[0.07,-0.1,0.02]],
        [1.35,[0,0,0]], [2,[0,0,0]], [2.18,[0,-0.4,0]], [2.7,[0,-0.4,0]],
        [2.86,[0,0.4,0]], [3.35,[0,0.4,0]], [3.51,[0.14,0,0]], [4,[0.14,0,0]],
        [4.16,[0,-0.4,0]], [4.65,[0,-0.4,0]], [4.81,[0,-0.4,0]], [5.35,[0,-0.4,0]],
        [5.6,[0,0.4,0]], [5.85,[0,0.4,0]], [6,[0,0,0]], [6.45,[0.04,-0.12,0.02]],
        [6.8,[-0.04,0.12,-0.02]], [7.15,[0.04,-0.12,0.02]], [7.5,[-0.04,0.12,-0.02]], [7.85,[0.04,-0.12,0.02]],
        [8.2,[-0.04,0.12,-0.02]], [8.55,[0.04,-0.12,0.02]], [8.9,[-0.04,0.12,-0.02]], [9.25,[0.04,-0.12,0.02]],
        [9.6,[-0.04,0.12,-0.02]], [9.95,[0.04,-0.12,0.02]], [10.3,[-0.04,0.12,-0.02]], [10.65,[0.03,-0.05,0]],
        [11,[0,0,0]], [11.35,[0.03,0.13,0.05]], [11.85,[-0.03,-0.13,-0.05]], [12.35,[0.03,0.13,0.05]],
        [12.85,[-0.03,-0.13,-0.05]], [13.35,[0.03,0.13,0.05]], [13.85,[-0.03,-0.13,-0.05]], [14.35,[0.03,0.13,0.05]],
        [14.85,[-0.03,-0.13,-0.05]], [15.35,[0.03,0.13,0.05]], [15.75,[0.02,-0.04,0]], [16,[0,0,0]],
        [16.3125,[-0.1,0.12,-0.05]], [16.6875,[0.05,-0.08,0.03]], [17.125,[0.02,0,0]], [18,[0,0,0]]
      ],
      'earL.rot': [
        [0,[0,0,0]], [0.35,[-0.24,0,0.12]], [0.7,[-0.24,0,0.12]], [1.05,[0,0,0]],
        [1.35,[0,0,0]], [2,[0,0,0]], [2.7,[-0.16,0,0.1]], [3.4,[0,0,0]],
        [4.1,[-0.16,0,0.1]], [4.8,[0,0,0]], [5.5,[-0.16,0,0.1]], [6,[0,0,0]],
        [6.7,[-0.18,0,0.12]], [7.4,[0,0,0]], [8.1,[-0.18,0,0.12]], [8.8,[0,0,0]],
        [9.5,[-0.18,0,0.12]], [10.2,[0,0,0]], [11,[0,0,0]], [11.35,[-0.14,0,0.08]],
        [11.85,[0,0,0]], [12.35,[-0.14,0,0.08]], [12.85,[0,0,0]], [13.35,[-0.14,0,0.08]],
        [13.85,[0,0,0]], [14.35,[-0.14,0,0.08]], [14.85,[0,0,0]], [15.35,[-0.14,0,0.08]],
        [16,[0,0,0]], [16.3125,[-0.2,0,0.12]], [16.6875,[0,0,0]], [18,[0,0,0]]
      ],
      'earR.rot': [
        [0,[0,0,0]], [0.35,[-0.24,0,-0.12]], [0.7,[-0.24,0,-0.12]], [1.05,[0,0,0]],
        [1.35,[0,0,0]], [2,[0,0,0]], [2.7,[-0.16,0,-0.1]], [3.4,[0,0,0]],
        [4.1,[-0.16,0,-0.1]], [4.8,[0,0,0]], [5.5,[-0.16,0,-0.1]], [6,[0,0,0]],
        [6.7,[-0.18,0,-0.12]], [7.4,[0,0,0]], [8.1,[-0.18,0,-0.12]], [8.8,[0,0,0]],
        [9.5,[-0.18,0,-0.12]], [10.2,[0,0,0]], [11,[0,0,0]], [11.35,[-0.14,0,-0.08]],
        [11.85,[0,0,0]], [12.35,[-0.14,0,-0.08]], [12.85,[0,0,0]], [13.35,[-0.14,0,-0.08]],
        [13.85,[0,0,0]], [14.35,[-0.14,0,-0.08]], [14.85,[0,0,0]], [15.35,[-0.14,0,-0.08]],
        [16,[0,0,0]], [16.3125,[-0.2,0,-0.12]], [16.6875,[0,0,0]], [18,[0,0,0]]
      ],
      'armL.rot': [
        [0,[0,0,0]], [0.35,[0,0,-0.8]], [0.7,[0,0,-1.05]], [1.05,[0,0,-0.35]],
        [1.35,[0,0,0]], [2,[0,0,0]], [2.18,[0,0,-1.2]], [2.7,[0,0,-1.2]],
        [2.86,[-0.6,0,-0.45]], [3.35,[-0.6,0,-0.45]], [3.51,[0,0,-1.2]], [4,[0,0,-1.2]],
        [4.16,[-0.6,0,-0.45]], [4.65,[-0.6,0,-0.45]], [4.81,[0,0,-1.2]], [5.35,[0,0,-1.2]],
        [5.6,[-0.6,0,-0.45]], [5.85,[-0.6,0,-0.45]], [6,[0,0,0]], [6.45,[-0.95,0,0.25]],
        [6.8,[-0.35,0,0.1]], [7.15,[0.65,0,0.02]], [7.5,[0.15,0,0.08]], [7.85,[-0.95,0,0.25]],
        [8.2,[-0.35,0,0.1]], [8.55,[0.65,0,0.02]], [8.9,[0.15,0,0.08]], [9.25,[-0.95,0,0.25]],
        [9.6,[-0.35,0,0.1]], [9.95,[0.65,0,0.02]], [10.3,[0.15,0,0.08]], [10.65,[-0.45,0,0.12]],
        [11,[0,0,0]], [11.35,[-0.55,0,0.85]], [11.85,[0.55,0,-0.85]], [12.35,[-0.55,0,0.85]],
        [12.85,[0.55,0,-0.85]], [13.35,[-0.55,0,0.85]], [13.85,[0.55,0,-0.85]], [14.35,[-0.55,0,0.85]],
        [14.85,[0.55,0,-0.85]], [15.35,[-0.55,0,0.85]], [16,[0,0,0]], [16.3125,[-1.1,0,0.55]],
        [16.6875,[-1.1,0,0.25]], [17.0625,[-0.7,0,0.2]], [17.4375,[-0.35,0,0.12]], [18,[0,0,0]]
      ],
      'armR.rot': [
        [0,[0,0,0]], [0.35,[-0.3,0,0.45]], [0.7,[-0.45,0,0.7]], [1.05,[-0.15,0,0.25]],
        [1.35,[0,0,0]], [2,[0,0,0]], [2.18,[-0.6,0,0.45]], [2.7,[-0.6,0,0.45]],
        [2.86,[0,0,1.2]], [3.35,[0,0,1.2]], [3.51,[-0.6,0,0.45]], [4,[-0.6,0,0.45]],
        [4.16,[0,0,1.2]], [4.65,[0,0,1.2]], [4.81,[-0.6,0,0.45]], [5.35,[-0.6,0,0.45]],
        [5.6,[0,0,1.2]], [5.85,[0,0,1.2]], [6,[0,0,0]], [6.45,[0.65,0,-0.02]],
        [6.8,[0.15,0,-0.08]], [7.15,[-0.95,0,-0.25]], [7.5,[-0.35,0,-0.1]], [7.85,[0.65,0,-0.02]],
        [8.2,[0.15,0,-0.08]], [8.55,[-0.95,0,-0.25]], [8.9,[-0.35,0,-0.1]], [9.25,[0.65,0,-0.02]],
        [9.6,[0.15,0,-0.08]], [9.95,[-0.95,0,-0.25]], [10.3,[-0.35,0,-0.1]], [10.65,[0.15,0,-0.08]],
        [11,[0,0,0]], [11.35,[0.55,0,0.85]], [11.85,[-0.55,0,-0.85]], [12.35,[0.55,0,0.85]],
        [12.85,[-0.55,0,-0.85]], [13.35,[0.55,0,0.85]], [13.85,[-0.55,0,-0.85]], [14.35,[0.55,0,0.85]],
        [14.85,[-0.55,0,-0.85]], [15.35,[0.55,0,0.85]], [16,[0,0,0]], [16.3125,[-1.1,0,-0.55]],
        [16.6875,[-1.1,0,-0.25]], [17.0625,[-0.7,0,-0.2]], [17.4375,[-0.35,0,-0.12]], [18,[0,0,0]]
      ],
      'elbowL.rot': [
        [0,[0,0,0]], [0.35,[-0.9,0,0]], [0.7,[-1.15,0,0]], [1.05,[-0.45,0,0]],
        [1.35,[0,0,0]], [2,[0,0,0]], [2.18,[-1.55,0,0]], [2.7,[-1.55,0,0]],
        [2.86,[-1.55,0,0]], [3.35,[-1.55,0,0]], [3.51,[-0.2,0,0]], [4,[-0.2,0,0]],
        [4.16,[-1.55,0,0]], [4.65,[-1.55,0,0]], [4.81,[-1.55,0,0]], [5.35,[-1.55,0,0]],
        [5.6,[-1.55,0,0]], [5.85,[-1.55,0,0]], [6,[0,0,0]], [6.45,[0.9,0,0]],
        [6.8,[0.2,0,0]], [7.15,[-0.15,0,0]], [7.5,[0.55,0,0]], [7.85,[0.9,0,0]],
        [8.2,[0.2,0,0]], [8.55,[-0.15,0,0]], [8.9,[0.55,0,0]], [9.25,[0.9,0,0]],
        [9.6,[0.2,0,0]], [9.95,[-0.15,0,0]], [10.3,[0.55,0,0]], [10.65,[0.25,0,0]],
        [11,[0,0,0]], [11.35,[-0.12,0,0]], [11.85,[-0.12,0,0]], [12.35,[-0.12,0,0]],
        [12.85,[-0.12,0,0]], [13.35,[-0.12,0,0]], [13.85,[-0.12,0,0]], [14.35,[-0.12,0,0]],
        [14.85,[-0.12,0,0]], [15.35,[-0.12,0,0]], [16,[0,0,0]], [16.3125,[0.65,0,0]],
        [16.6875,[-0.35,0,0]], [17.0625,[0.25,0,0]], [17.4375,[0.1,0,0]], [18,[0,0,0]]
      ],
      'elbowR.rot': [
        [0,[0,0,0]], [0.35,[-0.5,0,0]], [0.7,[-0.65,0,0]], [1.05,[-0.3,0,0]],
        [1.35,[0,0,0]], [2,[0,0,0]], [2.18,[-1.55,0,0]], [2.7,[-1.55,0,0]],
        [2.86,[-1.55,0,0]], [3.35,[-1.55,0,0]], [3.51,[-1.55,0,0]], [4,[-1.55,0,0]],
        [4.16,[-0.2,0,0]], [4.65,[-0.2,0,0]], [4.81,[-1.55,0,0]], [5.35,[-1.55,0,0]],
        [5.6,[-1.55,0,0]], [5.85,[-1.55,0,0]], [6,[0,0,0]], [6.45,[-0.15,0,0]],
        [6.8,[0.55,0,0]], [7.15,[0.9,0,0]], [7.5,[0.2,0,0]], [7.85,[-0.15,0,0]],
        [8.2,[0.55,0,0]], [8.55,[0.9,0,0]], [8.9,[0.2,0,0]], [9.25,[-0.15,0,0]],
        [9.6,[0.55,0,0]], [9.95,[0.9,0,0]], [10.3,[0.2,0,0]], [10.65,[0.25,0,0]],
        [11,[0,0,0]], [11.35,[-0.12,0,0]], [11.85,[-0.12,0,0]], [12.35,[-0.12,0,0]],
        [12.85,[-0.12,0,0]], [13.35,[-0.12,0,0]], [13.85,[-0.12,0,0]], [14.35,[-0.12,0,0]],
        [14.85,[-0.12,0,0]], [15.35,[-0.12,0,0]], [16,[0,0,0]], [16.3125,[0.65,0,0]],
        [16.6875,[-0.35,0,0]], [17.0625,[0.25,0,0]], [17.4375,[0.1,0,0]], [18,[0,0,0]]
      ],
      'legL.rot': [
        [0,[0,0,0]], [1.35,[0,0,0]], [2,[0,0,0]], [6,[0,0,0]],
        [6.35,[-0.15,0,0.05]], [6.7,[-0.68,0,0.03]], [7.05,[-0.18,0,0]], [7.4,[0.05,0,-0.05]],
        [7.75,[0.05,0,-0.05]], [8.1,[-0.68,0,0.03]], [8.45,[-0.18,0,0]], [8.8,[0.05,0,-0.05]],
        [9.15,[0.05,0,-0.05]], [9.5,[-0.68,0,0.03]], [9.85,[-0.18,0,0]], [10.2,[0.05,0,-0.05]],
        [10.55,[0.05,0,-0.05]], [10.8,[0,0,0]], [11,[0,0,0]], [16,[0,0,0]],
        [18,[0,0,0]]
      ],
      'legR.rot': [
        [0,[0,0,0]], [1.35,[0,0,0]], [2,[0,0,0]], [6,[0,0,0]],
        [6.35,[0.05,0,-0.05]], [6.7,[0.05,0,-0.05]], [7.05,[-0.68,0,-0.03]], [7.4,[-0.18,0,0]],
        [7.75,[0.05,0,-0.05]], [8.1,[0.05,0,-0.05]], [8.45,[-0.68,0,-0.03]], [8.8,[-0.18,0,0]],
        [9.15,[0.05,0,-0.05]], [9.5,[0.05,0,-0.05]], [9.85,[-0.68,0,-0.03]], [10.2,[-0.18,0,0]],
        [10.55,[0.05,0,-0.05]], [10.8,[0,0,0]], [11,[0,0,0]], [16,[0,0,0]],
        [18,[0,0,0]]
      ],
      'legL.pos': [
        [0,[0,0,0]], [1.35,[0,0,0]], [2,[0,0,0]], [6,[0,0,0]],
        [6.35,[0,0,-0.06]], [6.7,[0,0,-0.14]], [7.05,[0,0,-0.04]], [7.4,[0,0,0.09]],
        [7.75,[0,0,0.12]], [8.1,[0,0,-0.14]], [8.45,[0,0,-0.04]], [8.8,[0,0,0.09]],
        [9.15,[0,0,0.12]], [9.5,[0,0,-0.14]], [9.85,[0,0,-0.04]], [10.2,[0,0,0.09]],
        [10.55,[0,0,0.12]], [10.8,[0,0,0]], [11,[0,0,0]], [16,[0,0,0]],
        [18,[0,0,0]]
      ],
      'legR.pos': [
        [0,[0,0,0]], [1.35,[0,0,0]], [2,[0,0,0]], [6,[0,0,0]],
        [6.35,[0,0,0.12]], [6.7,[0,0,0.12]], [7.05,[0,0,-0.14]], [7.4,[0,0,-0.04]],
        [7.75,[0,0,0.09]], [8.1,[0,0,0.12]], [8.45,[0,0,-0.14]], [8.8,[0,0,-0.04]],
        [9.15,[0,0,0.09]], [9.5,[0,0,0.12]], [9.85,[0,0,-0.14]], [10.2,[0,0,-0.04]],
        [10.55,[0,0,0.09]], [10.8,[0,0,0]], [11,[0,0,0]], [16,[0,0,0]],
        [18,[0,0,0]]
      ],
      'kneeL.rot': [
        [0,[0,0,0]], [1.35,[0,0,0]], [2,[0,0,0]], [6,[0,0,0]],
        [6.35,[0.25,0,0]], [6.7,[1.25,0,0]], [7.05,[0.3,0,0]], [7.4,[0,0,0]],
        [7.75,[0,0,0]], [8.1,[1.25,0,0]], [8.45,[0.3,0,0]], [8.8,[0,0,0]],
        [9.15,[0,0,0]], [9.5,[1.25,0,0]], [9.85,[0.3,0,0]], [10.2,[0,0,0]],
        [10.55,[0,0,0]], [10.8,[0,0,0]], [11,[0,0,0]], [16,[0,0,0]],
        [18,[0,0,0]]
      ],
      'kneeR.rot': [
        [0,[0,0,0]], [1.35,[0,0,0]], [2,[0,0,0]], [6,[0,0,0]],
        [6.35,[0,0,0]], [6.7,[0,0,0]], [7.05,[1.25,0,0]], [7.4,[0.3,0,0]],
        [7.75,[0,0,0]], [8.1,[0,0,0]], [8.45,[1.25,0,0]], [8.8,[0.3,0,0]],
        [9.15,[0,0,0]], [9.5,[0,0,0]], [9.85,[1.25,0,0]], [10.2,[0.3,0,0]],
        [10.55,[0,0,0]], [10.8,[0,0,0]], [11,[0,0,0]], [16,[0,0,0]],
        [18,[0,0,0]]
      ],
      'tailBase.rot': [
        [0,[-0.45,0,0]], [0.35,[-0.45,0.28,0]], [0.7,[-0.45,-0.28,0]], [1.05,[-0.45,0.16,0]],
        [1.35,[-0.45,0,0]], [2,[-0.45,0,0]], [2.5,[-0.45,0.3,0]], [3,[-0.45,-0.3,0]],
        [3.5,[-0.45,0.3,0]], [4,[-0.45,-0.3,0]], [4.5,[-0.45,0.3,0]], [5,[-0.45,-0.3,0]],
        [5.5,[-0.45,0,0]], [6,[-0.45,0,0]], [6.7,[-0.55,0.35,0]], [7.4,[-0.55,-0.35,0]],
        [8.1,[-0.55,0.35,0]], [8.8,[-0.55,-0.35,0]], [9.5,[-0.55,0.35,0]], [10.2,[-0.55,-0.35,0]],
        [10.8,[-0.45,0,0]], [11,[-0.45,0,0]], [11.35,[-0.6,0.35,0]], [11.85,[-0.6,-0.35,0]],
        [12.35,[-0.6,0.35,0]], [12.85,[-0.6,-0.35,0]], [13.35,[-0.6,0.35,0]], [13.85,[-0.6,-0.35,0]],
        [14.35,[-0.6,0.35,0]], [14.85,[-0.6,-0.35,0]], [15.35,[-0.6,0.35,0]], [15.75,[-0.45,0,0]],
        [16,[-0.45,0,0]], [16.3125,[-0.55,0.2,0]], [16.6875,[-0.45,-0.15,0]], [17.125,[-0.45,0,0]],
        [18,[-0.45,0,0]]
      ],
      'tailMid.rot': [
        [0,[-0.22,0,0]], [0.35,[-0.22,0.22,0]], [0.7,[-0.22,-0.22,0]], [1.05,[-0.22,0.12,0]],
        [1.35,[-0.22,0,0]], [2,[-0.22,0,0]], [2.5,[-0.22,0.25,0]], [3,[-0.22,-0.25,0]],
        [3.5,[-0.22,0.25,0]], [4,[-0.22,-0.25,0]], [4.5,[-0.22,0.25,0]], [5,[-0.22,-0.25,0]],
        [5.5,[-0.22,0,0]], [6,[-0.22,0,0]], [6.7,[-0.28,0.3,0]], [7.4,[-0.28,-0.3,0]],
        [8.1,[-0.28,0.3,0]], [8.8,[-0.28,-0.3,0]], [9.5,[-0.28,0.3,0]], [10.2,[-0.28,-0.3,0]],
        [10.8,[-0.22,0,0]], [11,[-0.22,0,0]], [11.35,[-0.32,0.3,0]], [11.85,[-0.32,-0.3,0]],
        [12.35,[-0.32,0.3,0]], [12.85,[-0.32,-0.3,0]], [13.35,[-0.32,0.3,0]], [13.85,[-0.32,-0.3,0]],
        [14.35,[-0.32,0.3,0]], [14.85,[-0.32,-0.3,0]], [15.35,[-0.32,0.3,0]], [15.75,[-0.22,0,0]],
        [16,[-0.22,0,0]], [16.3125,[-0.28,0.18,0]], [16.6875,[-0.22,-0.12,0]], [17.125,[-0.22,0,0]],
        [18,[-0.22,0,0]]
      ],
      'tailTip.rot': [
        [0,[-0.18,0,0]], [0.35,[-0.18,0.3,0]], [0.7,[-0.18,-0.3,0]], [1.05,[-0.18,0.18,0]],
        [1.35,[-0.18,0,0]], [2,[-0.18,0,0]], [2.5,[-0.18,0.35,0]], [3,[-0.18,-0.35,0]],
        [3.5,[-0.18,0.35,0]], [4,[-0.18,-0.35,0]], [4.5,[-0.18,0.35,0]], [5,[-0.18,-0.35,0]],
        [5.5,[-0.18,0,0]], [6,[-0.18,0,0]], [6.7,[-0.22,0.4,0]], [7.4,[-0.22,-0.4,0]],
        [8.1,[-0.22,0.4,0]], [8.8,[-0.22,-0.4,0]], [9.5,[-0.22,0.4,0]], [10.2,[-0.22,-0.4,0]],
        [10.8,[-0.18,0,0]], [11,[-0.18,0,0]], [11.35,[-0.28,0.45,0]], [11.85,[-0.28,-0.45,0]],
        [12.35,[-0.28,0.45,0]], [12.85,[-0.28,-0.45,0]], [13.35,[-0.28,0.45,0]], [13.85,[-0.28,-0.45,0]],
        [14.35,[-0.28,0.45,0]], [14.85,[-0.28,-0.45,0]], [15.35,[-0.28,0.45,0]], [15.75,[-0.18,0,0]],
        [16,[-0.18,0,0]], [16.3125,[-0.24,0.25,0]], [16.6875,[-0.18,-0.15,0]], [17.125,[-0.18,0,0]],
        [18,[-0.18,0,0]]
      ]
    }
  };

  // Body and leg position tracks are authored relative to their fixed pivots.
  // This keeps the hip baseline and foot placement intact while dancing.
  var POSITION_BASELINES = {
    body: [0, 0.62, 0],
    legL: [-0.17, 0.02, 0],
    legR: [0.17, 0.02, 0]
  };

  /* ------------------------------------------------------------------ *
   *  Keyframe sampler (pure function — unit-testable in Node).          *
   *  Fills `out` with {partName: {pos:[..], rot:[..], scale:[..]}}.     *
   * ------------------------------------------------------------------ */
  function sampleTigerPose(t, out) {
    out = out || {};
    var keys = CHOREO.keys;
    for (var channel in keys) {
      if (!keys.hasOwnProperty(channel)) continue;
      var dot = channel.lastIndexOf('.');
      var part = channel.substring(0, dot);
      var prop = channel.substring(dot + 1);
      var list = keys[channel];

      var value;
      if (t <= list[0][0]) {
        value = list[0][1];
      } else if (t >= list[list.length - 1][0]) {
        value = list[list.length - 1][1];
      } else {
        // Find the surrounding keyframe pair (lists are short: linear scan).
        for (var i = 0; i < list.length - 1; i++) {
          var t0 = list[i][0], t1 = list[i + 1][0];
          if (t >= t0 && t <= t1) {
            var f = (t - t0) / (t1 - t0);
            var a = list[i][1], b = list[i + 1][1];
            value = [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)];
            break;
          }
        }
      }

      if (!out[part]) out[part] = {};
      out[part][prop] = value;
    }
    return out;
  }

  // Export for Node-based unit tests without disturbing the browser build.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { sampleTigerPose: sampleTigerPose, CHOREO: CHOREO };
  }

  /* ================================================================== *
   *  A-Frame component (browser only — skipped when loaded under Node)  *
   * ================================================================== */
  if (typeof window === 'undefined' || !window.AFRAME) return;

  var THREE = window.AFRAME.THREE;

  window.AFRAME.registerComponent('voxel-tiger', {
    schema: {
      autoDance:     { type: 'boolean', default: true },   // dance right after the entrance
      loop:          { type: 'boolean', default: false },  // repeat only when explicitly enabled
      danceDuration: { type: 'number',  default: CHOREO.duration },
      audioSrc:      { type: 'string',  default: '' }      // optional dance audio (see README §Sound)
    },

    init: function () {
      this.state = 'hidden';           // hidden | entering | dancing | paused
      this.enterT = 0;
      this.danceT = 0;
      this.loopPause = 0.9;            // breather between dance loops (s)
      this.pauseTimer = null;
      this.audio = null;
      this.soundOn = false;
      this.pose = {};                  // scratch object reused every frame

      this.parts = {};
      this.buildModel();

      // Parked below the target until the entrance plays.
      this.parts.root.position.set(0, -0.35, 0);
      this.parts.root.scale.setScalar(0.001);
      this.el.object3D.visible = false;
    },

    /* ------------------------- model building ---------------------- */
    addPart: function (name, obj, parent) {
      obj.name = name;
      parent.add(obj);
      this.parts[name] = obj;
      return obj;
    },

    buildModel: function () {
      getVoxelMaterial();
      var P = PALETTE;
      var parts = this.parts;

      var rig = this.el.object3D;
      var root = this.addPart('root', new THREE.Group(), rig);
      var body = this.addPart('body', new THREE.Group(), root);
      body.position.set(0, POSITION_BASELINES.body[1], 0); // hip height

      /* ---- torso ------------------------------------------------ */
      var torso = this.addPart('torso', new THREE.Group(), body);
      // Short, broad chest leaves room for the oversized toy-like head.
      torso.add(buildBox(0.66, 0.52, 0.44, P.orange, { y: 0.26 }));       // chest
      torso.add(place(buildBox(0.38, 0.37, 0.02, P.white), 0, 0.23, 0.24)); // belly
      // side + back stripes
      torso.add(place(buildBox(0.02, 0.16, 0.32, P.black),  0.34, 0.25, 0, 0, 0,  0.10));
      torso.add(place(buildBox(0.02, 0.16, 0.32, P.black), -0.34, 0.25, 0, 0, 0, -0.10));
      torso.add(place(buildBox(0.02, 0.13, 0.28, P.black),  0.34, 0.43, 0, 0, 0, -0.12));
      torso.add(place(buildBox(0.02, 0.13, 0.28, P.black), -0.34, 0.43, 0, 0, 0,  0.12));
      torso.add(place(buildBox(0.42, 0.12, 0.02, P.black), 0, 0.30, -0.23));
      torso.add(place(buildBox(0.38, 0.10, 0.02, P.black), 0, 0.44, -0.23));

      /* ---- head -------------------------------------------------- */
      var head = this.addPart('head', new THREE.Group(), body);
      head.position.set(0, 0.48, 0.03);
      // The broad skull and short torso make a compact, stout toy silhouette.
      head.add(place(buildBox(0.68, 0.56, 0.50, P.orange), 0, 0.28, 0.04));
      // Broad white cheek ruff and muzzle, with a friendly little mouth.
      head.add(place(buildBox(0.42, 0.22, 0.16, P.white), 0, 0.17, 0.34));
      head.add(place(buildBox(0.16, 0.14, 0.14, P.white),  0.24, 0.13, 0.32));
      head.add(place(buildBox(0.16, 0.14, 0.14, P.white), -0.24, 0.13, 0.32));
      head.add(place(buildBox(0.12, 0.07, 0.045, P.nose), 0, 0.23, 0.45));
      head.add(place(buildBox(0.14, 0.025, 0.025, P.nose), 0, 0.10, 0.44));
      // Large teal eyes sit just in front of black socket outlines.
      head.add(place(buildBox(0.19, 0.18, 0.025, P.black),  0.16, 0.34, 0.305));
      head.add(place(buildBox(0.19, 0.18, 0.025, P.black), -0.16, 0.34, 0.305));
      head.add(place(buildBox(0.12, 0.13, 0.025, P.eye),    0.16, 0.34, 0.332));
      head.add(place(buildBox(0.12, 0.13, 0.025, P.eye),   -0.16, 0.34, 0.332));
      head.add(place(buildBox(0.06, 0.08, 0.025, P.nose),   0.16, 0.32, 0.359));
      head.add(place(buildBox(0.06, 0.08, 0.025, P.nose),  -0.16, 0.32, 0.359));
      // Tiny square highlights give the eyes a lively, welcoming expression.
      head.add(place(buildBox(0.025, 0.032, 0.008, P.white),  0.14, 0.36, 0.377));
      head.add(place(buildBox(0.025, 0.032, 0.008, P.white), -0.18, 0.36, 0.377));
      // Soft angled brows and cheek tufts frame the eyes.
      head.add(place(buildBox(0.14, 0.035, 0.025, P.black),  0.16, 0.47, 0.31, 0, 0, -0.16));
      head.add(place(buildBox(0.14, 0.035, 0.025, P.black), -0.16, 0.47, 0.31, 0, 0,  0.16));
      head.add(place(buildBox(0.10, 0.07, 0.025, P.white),  0.27, 0.20, 0.305));
      head.add(place(buildBox(0.10, 0.07, 0.025, P.white), -0.27, 0.20, 0.305));
      // forehead stripes
      head.add(place(buildBox(0.05, 0.10, 0.025, P.black), 0,    0.49, 0.31));
      head.add(place(buildBox(0.05, 0.10, 0.025, P.black),  0.12, 0.50, 0.31, 0, 0, -0.30));
      head.add(place(buildBox(0.05, 0.10, 0.025, P.black), -0.12, 0.50, 0.31, 0, 0,  0.30));
      // ears (pivot at the base so they can flop)
      var earL = this.addPart('earL', buildBox(0.18, 0.18, 0.12, P.orange, { y: 0.09 }), head);
      earL.position.set(-0.22, 0.50, 0.04);
      earL.add(place(buildBox(0.09, 0.10, 0.025, P.white), 0, 0.05, 0.061));
      var earR = this.addPart('earR', buildBox(0.18, 0.18, 0.12, P.orange, { y: 0.09 }), head);
      earR.position.set(0.22, 0.50, 0.04);
      earR.add(place(buildBox(0.09, 0.10, 0.025, P.white), 0, 0.05, 0.061));

      /* ---- arms (shoulder pivots) -------------------------------- */
      parts.armL = this.buildArm(-1, body);
      parts.armR = this.buildArm( 1, body);

      /* ---- legs (hip pivots) ------------------------------------- */
      parts.legL = this.buildLeg(-1, body);
      parts.legR = this.buildLeg( 1, body);

      /* ---- tail (chained pivots) --------------------------------- */
      var tailBase = this.addPart('tailBase', new THREE.Group(), body);
      tailBase.position.set(0, 0.18, -0.22);
      tailBase.add(buildBox(0.10, 0.10, 0.34, P.orange, { z: -0.17 }));
      var tailMid = this.addPart('tailMid', new THREE.Group(), tailBase);
      tailMid.position.set(0, 0.02, -0.34);
      tailMid.add(buildBox(0.09, 0.09, 0.30, P.orange, { z: -0.15 }));
      var tailTip = this.addPart('tailTip', new THREE.Group(), tailMid);
      tailTip.position.set(0, 0.03, -0.30);
      tailTip.add(buildBox(0.12, 0.12, 0.16, P.black, { z: -0.08 }));

      function place(mesh, x, y, z, rx, ry, rz) {
        mesh.position.set(x, y, z);
        if (rx) mesh.rotation.x = rx;
        if (ry) mesh.rotation.y = ry;
        if (rz) mesh.rotation.z = rz;
        return mesh;
      }
    },

    buildArm: function (side, body) {
      var arm = new THREE.Group();
      arm.name = side < 0 ? 'armL' : 'armR';
      arm.position.set(0.40 * side, 0.47, 0);
      arm.add(buildBox(0.16, 0.30, 0.18, PALETTE.orange, { y: -0.15 }));  // upper arm
      arm.add(placeLocal(buildBox(0.17, 0.045, 0.19, PALETTE.black), 0, -0.12, 0)); // stripe band
      // The elbow pivot makes bent-arm freezes and the floss read as joints.
      var elbow = this.addPart(side < 0 ? 'elbowL' : 'elbowR', new THREE.Group(), arm);
      elbow.position.set(0, -0.30, 0);
      elbow.add(placeLocal(buildBox(0.14, 0.24, 0.16, PALETTE.orange), 0, -0.12, 0.01)); // forearm
      elbow.add(placeLocal(buildBox(0.16, 0.12, 0.18, PALETTE.white),  0, -0.27, 0.02)); // paw
      body.add(arm);
      return arm;

      function placeLocal(mesh, x, y, z) { mesh.position.set(x, y, z); return mesh; }
    },

    buildLeg: function (side, body) {
      var leg = new THREE.Group();
      leg.name = side < 0 ? 'legL' : 'legR';
      leg.position.set(0.17 * side, 0.02, 0);
      leg.add(buildBox(0.20, 0.28, 0.24, PALETTE.orange, { y: -0.14 }));  // thigh
      leg.add(placeLocal(buildBox(0.21, 0.045, 0.25, PALETTE.black), 0, -0.10, 0)); // stripe band
      // The knee pivot lets the running-man lift one compact leg at a time.
      var knee = this.addPart(side < 0 ? 'kneeL' : 'kneeR', new THREE.Group(), leg);
      knee.position.set(0, -0.28, 0);
      knee.add(placeLocal(buildBox(0.16, 0.24, 0.20, PALETTE.orange), 0, -0.12, 0)); // shin
      knee.add(placeLocal(buildBox(0.22, 0.14, 0.30, PALETTE.white),  0, -0.27, 0.05)); // foot
      body.add(leg);
      return leg;

      function placeLocal(mesh, x, y, z) { mesh.position.set(x, y, z); return mesh; }
    },

    /* ------------------------- public API -------------------------- */

    // Called once when the image target is first found.
    playEntrance: function () {
      if (this.state !== 'hidden') return;
      this.state = 'entering';
      this.enterT = 0;
      this.el.object3D.visible = true;
      this.el.emit('tiger-entrance-started');
    },

    // "Dance again" button: restart the choreography from the top.
    replayDance: function () {
      if (this.state === 'hidden' || this.state === 'entering') return;
      this.startDance(false);
    },

    setSoundOn: function (on) {
      this.soundOn = !!on;
      if (this.audio) this.audio.muted = !this.soundOn;
    },

    getState: function () { return this.state; },

    // Called by the AR page when the target is lost.
    hide: function () {
      this.state = 'hidden';
      this.el.object3D.visible = false;
      this.parts.root.scale.setScalar(0.001);
      this.parts.root.position.set(0, -0.35, 0);
      this.clearPauseTimer();
      this.stopAudio();
      this.el.emit('tiger-hidden');
    },

    /* ------------------------- state machine ----------------------- */
    startDance: function (isFirst) {
      this.clearPauseTimer();
      this.state = 'dancing';
      this.danceT = 0;
      this.playAudio();
      this.el.emit('tiger-dance-started', { first: !!isFirst });
    },

    clearPauseTimer: function () {
      if (this.pauseTimer) { clearTimeout(this.pauseTimer); this.pauseTimer = null; }
    },

    tick: function (time, dtMs) {
      if (!this.parts || !this.parts.root) return;
      var dt = Math.min(dtMs || 16.7, 100) / 1000; // clamp huge frames (tab switch)

      if (this.state === 'entering') {
        this.enterT += dt;
        var DURATION = 1.15, RISE_END = 0.75, SETTLE_END = 1.0;
        var root = this.parts.root;

        // Rise from below the target up to its surface.
        var rp = easeOutCubic(this.enterT / RISE_END);
        root.position.y = lerp(-0.35, 0, rp);

        // Scale pops in with an overshoot, then settles to 1.
        var s;
        if (this.enterT <= RISE_END) {
          s = easeOutBack(this.enterT / RISE_END, 1.9) * 1.12;
        } else if (this.enterT <= SETTLE_END) {
          s = lerp(1.12, 1.0, easeOutCubic((this.enterT - RISE_END) / (SETTLE_END - RISE_END)));
        } else {
          s = 1.0;
        }
        root.scale.setScalar(Math.max(s, 0.001));

        if (this.enterT >= DURATION) {
          root.position.y = 0;
          root.scale.setScalar(1);
          if (this.data.autoDance) this.startDance(true);
          else this.state = 'paused';
        }
        return;
      }

      if (this.state === 'dancing') {
        this.danceT += dt;
        var dur = this.data.danceDuration;
        if (this.danceT >= dur) {
          this.danceT = dur;
          this.state = 'paused';
          this.stopAudio();
          this.el.emit('tiger-dance-finished');
          if (this.data.loop) {
            var self = this;
            this.clearPauseTimer();
            this.pauseTimer = setTimeout(function () {
              if (self.state === 'paused') self.startDance(false);
            }, this.loopPause * 1000);
          }
        }
        this.applyPose(sampleTigerPose(this.danceT, this.pose));
      }
    },

    applyPose: function (pose) {
      var parts = this.parts;
      for (var name in pose) {
        if (!pose.hasOwnProperty(name)) continue;
        var obj = parts[name];
        if (!obj) continue;
        var p = pose[name];
        if (p.pos) {
          var baseline = POSITION_BASELINES[name];
          obj.position.set(
            p.pos[0] + (baseline ? baseline[0] : 0),
            p.pos[1] + (baseline ? baseline[1] : 0),
            p.pos[2] + (baseline ? baseline[2] : 0)
          );
        }
        if (p.rot)   obj.rotation.set(p.rot[0], p.rot[1], p.rot[2]);
        if (p.scale) obj.scale.set(p.scale[0], p.scale[1], p.scale[2]);
      }
    },

    /* ------------------------- sound (optional) -------------------- */
    // Audio is entirely optional and OFF by default. A file is only ever
    // played after an explicit user toggle (see js/app.js + README §Sound).
    playAudio: function () {
      if (!this.soundOn || !this.data.audioSrc) return;
      if (!this.audio) {
        this.audio = new Audio(this.data.audioSrc);
        this.audio.loop = false;
      }
      this.audio.muted = false;
      this.audio.currentTime = 0;
      var p = this.audio.play();
      if (p && p.catch) p.catch(function () { /* autoplay blocked — stay silent */ });
    },

    stopAudio: function () {
      if (this.audio) { this.audio.pause(); this.audio.currentTime = 0; }
    },

    remove: function () {
      this.clearPauseTimer();
      this.stopAudio();
    }
  });
})();
