/* Regression checks for recovery and tracking UI without camera hardware. */
'use strict';
var assert = require('node:assert/strict');
var fs = require('node:fs');
var vm = require('node:vm');
var source = fs.readFileSync('js/app.js', 'utf8');
function fixture(controllerOverride) {
  var elements = {}, windowEvents = {}, timers = {}, nextTimer = 0;
  var stopped = 0, reloads = 0, entrances = 0, starts = 0;
  function element() {
    var events = {}, classes = new Set();
    return { hidden: true, components: {}, systems: {}, textContent: '',
      addEventListener: function (name, fn) { events[name] = fn; },
      emit: function (name, detail) { if (events[name]) events[name]({ detail: detail }); },
      focus: function () {},
      classList: { add: function (c) { classes.add(c); }, remove: function (c) { classes.delete(c); }, contains: function (c) { return classes.has(c); } }
    };
  }
  ['scene', 'start-screen', 'start-button', 'retry-button', 'error-screen', 'error-message', 'ar-ui', 'hint', 'dance-again', 'sound-toggle', 'tiger-anchor', 'tiger'].forEach(function (id) { elements[id] = element(); });
  elements['start-screen'].hidden = false;
  elements.tiger.components['voxel-tiger'] = { data: { audioSrc: '' }, playEntrance: function () { entrances++; } };
  var system = { start: function () { starts++; }, _startAR: function () { return Promise.resolve(); },
    controller: controllerOverride || { trackingStates: [], stopProcessVideo: function () {} },
    video: { srcObject: { getTracks: function () { return [{ stop: function () { stopped++; } }]; } } }
  };
  elements.scene.systems['mindar-image-system'] = system;
  vm.runInNewContext(source, {
    document: { querySelector: function () { return elements.scene; }, getElementById: function (id) { return elements[id]; }, addEventListener: function (name, fn) { fn(); } },
    window: { addEventListener: function (name, fn) { windowEvents[name] = fn; }, location: { reload: function () { reloads++; } } },
    setTimeout: function (fn) { timers[++nextTimer] = fn; return nextTimer; }, clearTimeout: function (id) { delete timers[id]; }, Promise: Promise
  });
  return { e: elements, system: system, start: function () { elements['start-button'].emit('click'); },
    timeout: function () { Object.values(timers).forEach(function (fn) { fn(); }); },
    stats: function () { return { stopped: stopped, reloads: reloads, entrances: entrances, starts: starts }; }, events: windowEvents };
}
async function verifyTrackingRecovery() {
  // Run the shipped MindAR controller loop, not a replica of its warmup logic.
  // Only camera/TensorFlow inputs and the numeric pose filter are stubbed.
  var vendor = fs.readFileSync('vendor/mindar-image-aframe.prod.js', 'utf8');
  var start = vendor.indexOf('class _I{');
  var end = vendor.indexOf('const P_=', start);
  assert.ok(start >= 0 && end > start, 'MindAR controller boundary exists');
  var inputs = [true, true, false, true, true, true, true,
    false, true, false, true, true, true, true, true];
  var frame = 0, resets = 0, controller, f, visible = false;
  var snapshots = [], events = [], finish;
  var completed = new Promise(function (resolve) { finish = resolve; });
  var scope = {
    V_: function () {
      this.reset = function () { resets++; };
      this.filter = function (time, matrix) { return matrix.slice(); };
    },
    rf: { nextFrame: function () {
      frame++;
      if (frame === inputs.length) { controller.processingVideo = false; finish(); }
      return Promise.resolve();
    } }
  };
  vm.runInNewContext(vendor.slice(start, end) + '\nthis.Controller = _I;', scope);
  controller = Object.create(scope.Controller.prototype);
  var html = fs.readFileSync('index.html', 'utf8');
  controller.missTolerance = Number(html.match(/missTolerance:\s*(\d+)/)[1]);
  controller.warmupTolerance = Number(html.match(/warmupTolerance:\s*(\d+)/)[1]);
  assert.equal(controller.missTolerance, 0, 'First reported miss hides the old pose');
  controller.markerDimensions = [[1600, 1600]];
  controller.inputWidth = 480; controller.inputHeight = 640;
  controller.maxTrack = 1; controller.interestedTargetIndex = -1;
  controller.inputLoader = { loadInput: function () { return { dispose: function () {} }; } };
  function pose() { return [[1, 0, 0, frame], [0, 1, 0, 0], [0, 0, 1, 4000]]; }
  controller._detectAndMatch = function () {
    return Promise.resolve({ targetIndex: inputs[frame] ? 0 : -1, modelViewTransform: pose() });
  };
  controller._trackAndUpdate = function () { return Promise.resolve(inputs[frame] ? pose() : null); };
  controller.onUpdate = function (event) {
    if (event.type === 'updateMatrix') {
      var nextVisible = event.worldMatrix !== null;
      if (visible !== nextVisible) {
        events.push([frame, nextVisible ? 'found' : 'lost']);
        f.e['tiger-anchor'].emit(nextVisible ? 'targetFound' : 'targetLost');
      }
      visible = nextVisible;
      if (visible) assert.equal(event.worldMatrix[12], frame, 'Return with the current pose');
    }
    if (event.type === 'processDone') {
      snapshots.push({ visible: visible, count: controller.trackingStates[0].trackCount });
    }
  };
  f = fixture(controller); f.start(); f.e.scene.emit('arReady');
  controller.processVideo({ width: 480, height: 640 });
  await completed;
  assert.deepEqual(events, [[6, 'found'], [7, 'lost'], [13, 'found']]);
  assert.equal(snapshots[2].count, 0, 'Initial warmup resets on a miss');
  assert.equal(snapshots[9].count, 0, 'Reacquisition warmup resets on another miss');
  assert.equal(snapshots[7].visible, false, 'No grace frames with a known stale pose');
  assert.equal(snapshots[12].visible, false, 'Three fresh results still wait for the fourth');
  assert.equal(resets, 2, 'MindAR resets filtering for both fresh locks');
  assert.equal(f.stats().entrances, 1, 'Reacquisition never replays the entrance');
  assert.equal(f.e.hint.classList.contains('fade'), true);
  console.log('PASS: shipped MindAR loop hides on first miss, requires consecutive locks and preserves one-shot entrance');
}
(async function () {
  var f = fixture(); f.start(); f.start();
  assert.equal(f.stats().starts, 1);
  f.e.scene.emit('arReady'); f.timeout();
  assert.equal(f.e['ar-ui'].hidden, false);
  assert.equal(f.e['sound-toggle'].hidden, true);
  f.e['tiger-anchor'].emit('targetFound');
  f.e['tiger-anchor'].emit('targetLost');
  assert.equal(f.e.hint.classList.contains('fade'), false);
  f.e['tiger-anchor'].emit('targetFound');
  assert.equal(f.e.hint.classList.contains('fade'), true);
  assert.equal(f.stats().entrances, 1);
  f.events.pagehide(); assert.ok(f.stats().stopped > 0);

  ['VIDEO_FAIL', 'NotAllowedError'].forEach(function (error) {
    var g = fixture(); g.start(); g.e.scene.emit('arError', { error: error });
    assert.equal(g.e['error-screen'].hidden, false);
    assert.match(g.e['error-message'].textContent, /camera access/i);
    assert.ok(g.stats().stopped > 0);
    g.e['retry-button'].emit('click'); assert.equal(g.stats().reloads, 1);
  });
  f = fixture(); var called = 0;
  f.system._startAR = function () { called++; };
  f.start(); f.timeout(); await f.system._startAR();
  assert.equal(called, 0); assert.equal(f.e['error-screen'].hidden, false);
  f.e.scene.emit('arReady'); assert.equal(f.e['ar-ui'].hidden, true);

  f = fixture(); f.system._startAR = function () { return Promise.reject(new Error('bad target')); };
  f.start(); await f.system._startAR();
  assert.match(f.e['error-message'].textContent, /tracker could not load/);
  assert.ok(f.stats().stopped > 0);

  f = fixture(); var resolve;
  f.system._startAR = function () { return new Promise(function (r) { resolve = r; }); };
  f.start(); var pending = f.system._startAR(); await Promise.resolve();
  f.timeout(); var count = f.stats().stopped; resolve(); await pending;
  assert.ok(f.stats().stopped > count);

  f = fixture(); f.system.start = function () { throw new Error('no camera'); };
  f.start(); assert.equal(f.e['error-screen'].hidden, false);
  await verifyTrackingRecovery();
  console.log('PASS: startup, recovery, timeout, late permission/init, tracking guidance and camera cleanup');
})().catch(function (error) { console.error(error); process.exitCode = 1; });
