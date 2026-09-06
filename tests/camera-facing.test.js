'use strict';
var assert = require('assert');
var fs = require('fs');
var vm = require('vm');
var aim = require('../js/camera-facing.js').aim;
var rad = Math.PI / 180;
function state() { return { yaw: 0, pitch: 0, overhead: false }; }
var s = state();
aim(s, { x: 0, y: 1, z: 1 }, 0, 30, true);
assert(Math.abs(s.pitch) < 1e-10, '45-degree view stays upright');
aim(s, { x: 0, y: 1, z: 0 }, 0, 30, true);
assert(Math.abs(s.pitch + 30 * rad) < 1e-10, 'overhead tilt is capped');
assert.strictEqual(s.yaw, 0, 'initial overhead lock uses card heading');
aim(s, { x: 1, y: 1, z: 0 }, 0, 30, true);
assert(Math.abs(s.yaw - Math.PI / 2) < 1e-10);
aim(s, { x: -0.01, y: 1, z: -0.01 }, 0, 30, true);
assert(Math.abs(s.yaw - Math.PI / 2) < 1e-10, 'overhead retains last heading');
s = { yaw: 179 * rad, pitch: 0, overhead: false };
aim(s, { x: Math.sin(-178 * rad), y: 0, z: Math.cos(-178 * rad) }, 1 / 60, 30, false);
assert(s.yaw > 179 * rad, 'turn crosses angle wrap by shortest route');
s = state();
aim(s, { x: 1, y: 0, z: 0 }, 1 / 60, 30, false);
assert(s.yaw > 0 && s.yaw <= 2 * rad, 'turn speed is bounded');
var saved = s.yaw;
assert.strictEqual(aim(s, { x: NaN, y: 0, z: 0 }, 0.1, 30, false), false);
assert.strictEqual(s.yaw, saved);

// Exercise the actual component's visibility gate and reacquisition behavior.
var component;
var anchor = { object3D: { visible: true }, addEventListener: function (n, f) { this[n] = f; }, removeEventListener: function () {} };
var cameraPosition = { x: 0, y: 1, z: 1 };
var rotations = [];
var context = { window: { location: { search: '' }, AFRAME: {
  THREE: { Vector3: function () {} },
  registerComponent: function (n, c) { component = c; }
} } };
vm.runInNewContext(fs.readFileSync('js/camera-facing.js', 'utf8'), context);
var instance = Object.create(component);
instance.data = { maxTilt: 30 };
instance.el = { sceneEl: { querySelector: function () { return anchor; }, camera: {
  getWorldPosition: function (v) { Object.assign(v, cameraPosition); }
} }, object3D: { parent: { worldToLocal: function () {} },
  rotation: { set: function (x, y, z, order) { rotations.push([x, y, z, order]); } } } };
instance.init(); instance.tick(0, 16);
anchor.object3D.visible = false; anchor.targetLost();
cameraPosition = { x: 1, y: 1, z: 0 };
instance.tick(16, 16); assert.strictEqual(rotations.length, 1);
anchor.object3D.visible = true; instance.tick(32, 16);
assert(Math.abs(rotations[1][1] - Math.PI / 2) < 1e-10, 'fresh lock initializes before rendering');
assert.strictEqual(rotations[1][3], 'YXZ');
context.window.location.search = '?tracking-test=1'; instance.init(); instance.tick(48, 16);
assert.strictEqual(rotations.length, 2, 'diagnostic tiger stays marker-relative');
console.log('PASS: bounded tilt/turn, overhead heading, angle wrap, hidden poses, fresh lock and diagnostic bypass');

