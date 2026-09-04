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
 *         ├─ armL / armR      shoulder pivots (upper arm + forearm + paw)
 *         ├─ legL / legR      hip pivots (thigh + shin + foot)
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
 *   replayDance()   – restart the dance from t=0 (for the "Dance again" UI)
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
    orange: 0xe8961c,
    black:  0x2a2118,
    white:  0xf7f1e3,
    nose:   0x1c1410
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
   *  keys: { "<part>.<pos|rot|scale>": [[t, [x,y,z]], ...] }            *
   *  Times in seconds, rotations in radians. Channels that should loop  *
   *  smoothly have their last key at `duration` matching the first one. *
   *                                                                     *
   *  Beats: 0–2.8  bounce + arm swings                                  *
   *         2.8–5.2 hip twist / "charleston"                            *
   *         5.2–7.6 alternating high kicks + head shake                 *
   *         7.6–9.6 spin + squiggle                                     *
   *         9.6–10.8 victory pose, then loop                            *
   * ------------------------------------------------------------------ */
  var CHOREO = {
    duration: 10.8,
    keys: {
      'root.pos': [
        [0,[0,0,0]],[0.4,[0,-0.05,0]],[0.8,[0,0.06,0]],[1.2,[0,-0.05,0]],
        [1.6,[0,0.06,0]],[2.0,[0,-0.05,0]],[2.4,[0,0.06,0]],[2.8,[0,-0.03,0]],
        [3.2,[0,0,0]],[3.6,[0,-0.04,0]],[4.0,[0,0,0]],[4.4,[0,-0.06,0]],
        [4.8,[0,0.34,0]],[5.2,[0,-0.02,0]],[5.6,[0,0.30,0]],[6.0,[0,-0.02,0]],
        [6.4,[0,0.34,0]],[6.8,[0,-0.02,0]],[7.2,[0,0.30,0]],[7.6,[0,0,0]],
        [8.2,[0,-0.04,0]],[8.6,[0,0.10,0]],[9.0,[0,-0.02,0]],[9.6,[0,0.12,0]],
        [10.2,[0,0.12,0]],[10.8,[0,0,0]]
      ],
      'root.rot': [
        [0,[0,0,0]],[3.2,[0,0,0]],[4.4,[0,0,0.06]],[5.2,[0,0,-0.06]],
        [6.0,[0,0,0.06]],[6.8,[0,0,-0.06]],[7.2,[0,0,0]],[7.6,[0,0,0]],
        [8.6,[0,3.1416,0]],[9.0,[0,3.1416,0]],[9.6,[0,6.2832,0]],[10.8,[0,6.2832,0]]
      ],
      'body.pos': [
        [0,[0,0,0]],[3.6,[0.05,0,0]],[4.0,[-0.05,0,0]],[4.4,[0.05,0,0]],
        [4.8,[-0.04,0,0]],[5.2,[0,0,0]],[10.8,[0,0,0]]
      ],
      'body.rot': [
        [0,[0.04,0,0]],[0.4,[0.14,0,0]],[0.8,[-0.02,0,0]],[1.2,[0.14,0,0]],
        [1.6,[-0.02,0,0]],[2.0,[0.14,0,0]],[2.4,[-0.02,0,0]],[2.8,[0.06,0,0]],
        [3.2,[0,0,0]],[3.6,[0,0.26,0.10]],[4.0,[0,-0.26,-0.10]],[4.4,[0,0.26,0.10]],
        [4.8,[0,-0.20,-0.08]],[5.2,[0.10,0,0.04]],[5.6,[0.06,0,-0.04]],[6.0,[0.10,0,0.04]],
        [6.4,[0.06,0,-0.04]],[6.8,[0.10,0,0]],[7.2,[0.06,0,0]],[7.6,[0,0,0]],
        [8.6,[0.05,0,0]],[9.0,[0.02,0,0]],[9.6,[-0.10,0,0]],[10.2,[-0.10,0,0]],
        [10.8,[0.04,0,0]]
      ],
      'torso.rot': [
        [0,[0,0,0]],[3.2,[0,0,0]],[3.6,[0,-0.14,-0.05]],[4.0,[0,0.14,0.05]],
        [4.4,[0,-0.14,-0.05]],[4.8,[0,0.10,0.04]],[5.2,[0,0,0]],[10.8,[0,0,0]]
      ],
      'head.rot': [
        [0,[0,0,0]],[0.4,[0.10,0,0]],[0.8,[-0.06,0,0]],[1.2,[0.10,0,0]],
        [1.6,[-0.06,0,0]],[2.0,[0.10,0,0]],[2.4,[-0.06,0,0]],[2.8,[0.04,0,0]],
        [3.2,[0,0,0.12]],[3.6,[0,0,-0.12]],[4.0,[0,0,0.12]],[4.4,[0,0,-0.12]],
        [4.8,[0,0,0.10]],[5.2,[0,0.22,0]],[5.6,[0,-0.22,0]],[6.0,[0,0.22,0]],
        [6.4,[0,-0.22,0]],[6.8,[0,0.22,0]],[7.2,[0,-0.14,0]],[7.6,[0,0,0]],
        [8.6,[0.06,0,0]],[9.0,[0,0,0]],[9.6,[-0.18,0,0]],[10.2,[-0.18,0,0]],
        [10.8,[0,0,0]]
      ],
      'earL.rot': [
        [0,[0,0,0.06]],[0.8,[-0.14,0,0.10]],[1.6,[0,0,0.06]],[2.4,[-0.14,0,0.10]],
        [3.2,[0,0,0.06]],[4.8,[-0.16,0,0.12]],[5.6,[0,0,0.06]],[6.4,[-0.16,0,0.12]],
        [7.2,[0,0,0.06]],[9.6,[-0.12,0,0.08]],[10.2,[-0.12,0,0.08]],[10.8,[0,0,0.06]]
      ],
      'earR.rot': [
        [0,[0,0,-0.06]],[0.8,[-0.14,0,-0.10]],[1.6,[0,0,-0.06]],[2.4,[-0.14,0,-0.10]],
        [3.2,[0,0,-0.06]],[4.8,[-0.16,0,-0.12]],[5.6,[0,0,-0.06]],[6.4,[-0.16,0,-0.12]],
        [7.2,[0,0,-0.06]],[9.6,[-0.12,0,-0.08]],[10.2,[-0.12,0,-0.08]],[10.8,[0,0,-0.06]]
      ],
      'armL.rot': [
        [0,[0,0,0.08]],[0.4,[-0.90,0,0.10]],[0.8,[0.35,0,0.06]],[1.2,[-0.90,0,0.10]],
        [1.6,[0.35,0,0.06]],[2.0,[-0.90,0,0.10]],[2.4,[0.35,0,0.06]],[2.8,[-0.30,0,0.10]],
        [3.2,[0,0,0.14]],[3.6,[0,0,1.05]],[4.0,[0,0,0.92]],[4.4,[0,0,1.05]],
        [4.8,[0,0,0.90]],[5.2,[-1.50,0,0.10]],[5.6,[-0.35,0,0.08]],[6.0,[-1.50,0,0.10]],
        [6.4,[-0.35,0,0.08]],[6.8,[-1.50,0,0.10]],[7.2,[-0.35,0,0.08]],[7.6,[0,0,0.08]],
        [8.6,[-0.20,0,0.12]],[9.0,[0,0,0.08]],[9.6,[-2.40,0,0.20]],[10.2,[-2.40,0,0.20]],
        [10.8,[0,0,0.08]]
      ],
      'armR.rot': [
        [0,[0,0,-0.08]],[0.4,[0.35,0,-0.06]],[0.8,[-0.90,0,-0.10]],[1.2,[0.35,0,-0.06]],
        [1.6,[-0.90,0,-0.10]],[2.0,[0.35,0,-0.06]],[2.4,[-0.90,0,-0.10]],[2.8,[-0.30,0,-0.10]],
        [3.2,[0,0,-0.14]],[3.6,[0,0,-1.05]],[4.0,[0,0,-0.92]],[4.4,[0,0,-1.05]],
        [4.8,[0,0,-0.90]],[5.2,[-0.35,0,-0.08]],[5.6,[-1.50,0,-0.10]],[6.0,[-0.35,0,-0.08]],
        [6.4,[-1.50,0,-0.10]],[6.8,[-0.35,0,-0.08]],[7.2,[-1.50,0,-0.10]],[7.6,[0,0,-0.08]],
        [8.6,[-0.20,0,-0.12]],[9.0,[0,0,-0.08]],[9.6,[-2.40,0,-0.20]],[10.2,[-2.40,0,-0.20]],
        [10.8,[0,0,-0.08]]
      ],
      'legL.rot': [
        [0,[0,0,0]],[3.2,[0,0,0]],[3.6,[0,0,-0.14]],[4.0,[0,0,0.10]],
        [4.4,[0,0,-0.14]],[4.8,[0,0,0.08]],[5.2,[-0.95,0,0]],[5.6,[0.12,0,0]],
        [6.0,[0,0,0]],[6.4,[-0.95,0,0]],[6.8,[0.12,0,0]],[7.2,[0,0,0]],
        [10.8,[0,0,0]]
      ],
      'legR.rot': [
        [0,[0,0,0]],[3.2,[0,0,0]],[3.6,[0,0,0.14]],[4.0,[0,0,-0.10]],
        [4.4,[0,0,0.14]],[4.8,[0,0,-0.08]],[5.2,[0,0,0]],[6.0,[-0.95,0,0]],
        [6.4,[0.12,0,0]],[6.8,[0,0,0]],[7.2,[-0.95,0,0]],[7.6,[0.12,0,0]],
        [8.0,[0,0,0]],[10.8,[0,0,0]]
      ],
      'tailBase.rot': [
        [0,[-0.50,0,0]],[0.4,[-0.50,0.30,0]],[0.8,[-0.50,-0.30,0]],[1.2,[-0.50,0.30,0]],
        [1.6,[-0.50,-0.30,0]],[2.0,[-0.50,0.30,0]],[2.4,[-0.50,-0.30,0]],[2.8,[-0.50,0,0]],
        [3.6,[-0.55,0.35,0]],[4.4,[-0.55,-0.35,0]],[5.2,[-0.55,0.35,0]],[6.0,[-0.55,-0.35,0]],
        [6.8,[-0.55,0.35,0]],[7.6,[-0.50,0,0]],[8.6,[-0.60,0.40,0]],[9.0,[-0.60,-0.20,0]],
        [9.6,[-0.75,0,0]],[10.2,[-0.75,0,0]],[10.8,[-0.50,0,0]]
      ],
      'tailMid.rot': [
        [0,[-0.25,0,0]],[0.4,[-0.25,0.25,0]],[1.2,[-0.25,-0.25,0]],[2.0,[-0.25,0.25,0]],
        [2.8,[-0.25,0,0]],[3.6,[-0.30,0.30,0]],[4.4,[-0.30,-0.30,0]],[5.2,[-0.30,0.30,0]],
        [6.0,[-0.30,-0.30,0]],[6.8,[-0.30,0.30,0]],[7.6,[-0.25,0,0]],[9.6,[-0.40,0,0]],
        [10.2,[-0.40,0,0]],[10.8,[-0.25,0,0]]
      ],
      'tailTip.rot': [
        [0,[-0.20,0,0]],[0.8,[-0.20,0.35,0]],[1.6,[-0.20,-0.35,0]],[2.4,[-0.20,0.35,0]],
        [3.2,[-0.20,0,0]],[4.0,[-0.25,0.40,0]],[4.8,[-0.25,-0.40,0]],[5.6,[-0.25,0.40,0]],
        [6.4,[-0.25,-0.40,0]],[7.2,[-0.25,0.20,0]],[8.6,[-0.30,0.45,0]],[9.6,[-0.35,0,0]],
        [10.8,[-0.20,0,0]]
      ]
    }
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
      body.position.set(0, 0.62, 0); // hip height

      /* ---- torso ------------------------------------------------ */
      var torso = this.addPart('torso', new THREE.Group(), body);
      torso.add(buildBox(0.62, 0.60, 0.40, P.orange, { y: 0.30 }));       // chest
      torso.add(place(buildBox(0.34, 0.42, 0.02, P.white), 0, 0.26, 0.21)); // belly
      // side + back stripes
      torso.add(place(buildBox(0.02, 0.16, 0.30, P.black),  0.32, 0.30, 0, 0, 0,  0.10));
      torso.add(place(buildBox(0.02, 0.16, 0.30, P.black), -0.32, 0.30, 0, 0, 0, -0.10));
      torso.add(place(buildBox(0.02, 0.13, 0.26, P.black),  0.32, 0.48, 0, 0, 0, -0.12));
      torso.add(place(buildBox(0.02, 0.13, 0.26, P.black), -0.32, 0.48, 0, 0, 0,  0.12));
      torso.add(place(buildBox(0.40, 0.12, 0.02, P.black), 0, 0.34, -0.21));
      torso.add(place(buildBox(0.36, 0.10, 0.02, P.black), 0, 0.50, -0.21));

      /* ---- head -------------------------------------------------- */
      var head = this.addPart('head', new THREE.Group(), body);
      head.position.set(0, 0.58, 0.02);
      head.add(place(buildBox(0.50, 0.46, 0.44, P.orange), 0, 0.23, 0.03));
      // muzzle, nose, mouth
      head.add(place(buildBox(0.30, 0.18, 0.14, P.white), 0, 0.15, 0.30));
      head.add(place(buildBox(0.10, 0.06, 0.04, P.nose),  0, 0.21, 0.38));
      head.add(place(buildBox(0.12, 0.025, 0.02, P.nose), 0, 0.095, 0.375));
      // eyes + brows + cheeks
      head.add(place(buildBox(0.09, 0.10, 0.02, P.white),  0.12, 0.30, 0.256));
      head.add(place(buildBox(0.09, 0.10, 0.02, P.white), -0.12, 0.30, 0.256));
      head.add(place(buildBox(0.045, 0.055, 0.02, P.nose),  0.12, 0.295, 0.27));
      head.add(place(buildBox(0.045, 0.055, 0.02, P.nose), -0.12, 0.295, 0.27));
      head.add(place(buildBox(0.10, 0.025, 0.02, P.black),  0.12, 0.385, 0.256, 0, 0, -0.18));
      head.add(place(buildBox(0.10, 0.025, 0.02, P.black), -0.12, 0.385, 0.256, 0, 0,  0.18));
      head.add(place(buildBox(0.08, 0.06, 0.02, P.white),  0.20, 0.13, 0.256));
      head.add(place(buildBox(0.08, 0.06, 0.02, P.white), -0.20, 0.13, 0.256));
      // forehead stripes
      head.add(place(buildBox(0.05, 0.10, 0.02, P.black), 0,    0.42, 0.256));
      head.add(place(buildBox(0.05, 0.10, 0.02, P.black),  0.10, 0.43, 0.256, 0, 0, -0.30));
      head.add(place(buildBox(0.05, 0.10, 0.02, P.black), -0.10, 0.43, 0.256, 0, 0,  0.30));
      // ears (pivot at the base so they can flop)
      var earL = this.addPart('earL', buildBox(0.14, 0.16, 0.10, P.orange, { y: 0.08 }), head);
      earL.position.set(-0.16, 0.46, 0.03);
      earL.add(place(buildBox(0.07, 0.08, 0.02, P.white), 0, 0.05, 0.051));
      var earR = this.addPart('earR', buildBox(0.14, 0.16, 0.10, P.orange, { y: 0.08 }), head);
      earR.position.set(0.16, 0.46, 0.03);
      earR.add(place(buildBox(0.07, 0.08, 0.02, P.white), 0, 0.05, 0.051));

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
      arm.position.set(0.37 * side, 0.50, 0);
      arm.add(buildBox(0.16, 0.30, 0.18, PALETTE.orange, { y: -0.15 }));  // upper arm
      arm.add(placeLocal(buildBox(0.17, 0.045, 0.19, PALETTE.black), 0, -0.12, 0)); // stripe band
      arm.add(placeLocal(buildBox(0.14, 0.24, 0.16, PALETTE.orange), 0, -0.40, 0.01)); // forearm
      arm.add(placeLocal(buildBox(0.16, 0.12, 0.18, PALETTE.white),  0, -0.55, 0.02)); // paw
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
      leg.add(placeLocal(buildBox(0.16, 0.24, 0.20, PALETTE.orange), 0, -0.40, 0)); // shin
      leg.add(placeLocal(buildBox(0.22, 0.14, 0.30, PALETTE.white),  0, -0.55, 0.05)); // foot
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
          if (this.data.autoDance) {
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
        if (p.pos)   obj.position.set(p.pos[0], p.pos[1], p.pos[2]);
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
