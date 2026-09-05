/* The capture must stay opt-in, bounded and independent of mutable AR arrays. */
'use strict';
var assert = require('node:assert/strict');
var fs = require('node:fs');
var vm = require('node:vm');
var helpers = require('../js/tracking-test.js');
var source = fs.readFileSync('js/tracking-test.js', 'utf8');

// Normal entry must not touch DOM, camera, storage or tracker APIs.
vm.runInNewContext(source, { window: { location: { search: '' } }, URLSearchParams: URLSearchParams });
vm.runInNewContext(source, { window: { location: { search: '?tracking-test=0' } }, URLSearchParams: URLSearchParams });

var c = helpers.createCapture({ surface: 'print' }, 1000);
var raw = [1, 2, 3], rendered = [4, 5, 6];
c.add(1033, { isTracking: true, showing: true, trackMiss: 0 }, raw, rendered);
raw[0] = 99; rendered[0] = 99;
assert.deepEqual(c.report.samples[0].rawMatrix, [1, 2, 3]);
assert.deepEqual(c.report.samples[0].renderedMatrix, [4, 5, 6]);
c.add(1066, { isTracking: false, showing: true, trackMiss: 1 }, null, rendered);
c.add(1100, { isTracking: false, showing: false, trackMiss: 9 }, null, null);
assert.equal(c.report.samples[1].fresh, false);
assert.equal(c.report.samples[1].visible, true, 'Brief stale visibility is distinguishable from fresh tracking');
assert.equal(c.report.samples[2].renderedMatrix, null);
assert.equal(c.add(21000, {}, raw, rendered), false, 'Capture stops accepting at 20 seconds');
c.finish(21000, 'complete');
assert.equal(c.add(22000, {}, raw, rendered), false);
c.finish(22000, 'page-hidden');
assert.equal(c.report.stopReason, 'complete');
assert.equal(c.report.durationMs, 20000);
assert.equal(helpers.phaseAt(4999), 'hold-still');
assert.equal(helpers.phaseAt(5000), 'slow-arc');
assert.equal(helpers.phaseAt(15000), 'hold-still');
c = helpers.createCapture({}, 0);
for (var i = 0; i < 1200; i++) assert.equal(c.add(i, null, null, null), true);
assert.equal(c.add(1200, null, null, null), false, 'Bound memory on fast devices');

// Exercise the actual opt-in hook: original callback runs first, sampling only
// completed processing cycles, including frames where no anchor update occurs.
var domReady, now = 0, elements = {}, savedBlob, settingsApplied = [];
function element() {
  return { hidden: true, disabled: false, value: 'print', events: {},
    addEventListener: function (name, fn) { this.events[name] = fn; },
    setAttribute: function () { settingsApplied.push(Array.from(arguments)); },
    appendChild: function () {}, querySelector: function (id) { return get(id); },
    setObject3D: function () {}, click: function () {}, remove: function () {} };
}
function get(id) { return elements[id] || (elements[id] = element()); }
var anchor = get('tiger-anchor');
anchor.object3D = { visible: true, matrix: { elements: [0] } };
var state = { isTracking: true, showing: true, trackMiss: 0, currentModelViewTransform: [[1]] };
var controller = { trackingStates: [state], markerDimensions: [[1600, 1600]],
  getWorldMatrix: function () { return [2]; },
  onUpdate: function () { anchor.object3D.matrix.elements = [7]; } };
var scene = get('scene');
scene.systems = { 'mindar-image-system': { controller: controller,
  video: { videoWidth: 640, videoHeight: 480, srcObject: { getVideoTracks: function () {
    return [{ getSettings: function () { return { deviceId: 'do-not-save', width: 640, frameRate: 30 }; } }];
  } } } } };
var FakeGeometry = function () { this.setAttribute = function () {}; };
vm.runInNewContext(source, { URLSearchParams: URLSearchParams,
  window: { location: { search: '?tracking-test=1' }, innerWidth: 390, innerHeight: 844,
    addEventListener: function () {}, AFRAME: { THREE: {
      BufferGeometry: FakeGeometry, Float32BufferAttribute: function () {},
      LineSegments: function () {}, LineBasicMaterial: function () {} } } },
  document: { addEventListener: function (name, fn) { if (name === 'DOMContentLoaded') domReady = fn; },
    querySelector: function (id) { return id === 'a-scene' ? scene : get(id); },
    getElementById: get, createElement: element, body: element() },
  performance: { now: function () { return now; } }, navigator: { userAgent: 'test-browser' },
  setInterval: function () {}, clearInterval: function () {}, setTimeout: function () {},
  Blob: function (parts) { savedBlob = JSON.parse(parts[0]); },
  URL: { createObjectURL: function () { return 'blob:test'; } }
});
domReady(); scene.events.arReady();
assert.ok(settingsApplied.some(function (args) { return args.join() === 'voxel-tiger,autoDance,false'; }));
get('#tracking-record').events.click();
controller.onUpdate({ type: 'updateMatrix' });
now = 33; controller.onUpdate({ type: 'processDone' });
state.isTracking = false; state.trackMiss = 1;
now = 66; controller.onUpdate({ type: 'processDone' });
now = 20000; controller.onUpdate({ type: 'processDone' });
get('#tracking-save').events.click();
assert.equal(savedBlob.samples.length, 2);
assert.deepEqual(savedBlob.samples[0].renderedMatrix, [7], 'Capture uses current matrix after original callback');
assert.equal(savedBlob.samples[1].rawMatrix, null, 'Stale transform is never mislabeled as fresh');
assert.equal(savedBlob.samples[1].visible, true);
assert.equal(savedBlob.metadata.camera.frameRate, 30);
assert.ok(!JSON.stringify(savedBlob).includes('do-not-save'), 'Device identifiers are omitted');
console.log('PASS: opt-in capture, current poses, stale frames, immutable snapshots, time/memory bounds, metadata allowlist');
