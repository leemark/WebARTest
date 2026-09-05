/* Regression checks for recovery and tracking UI without camera hardware. */
'use strict';
var assert = require('node:assert/strict');
var fs = require('node:fs');
var vm = require('node:vm');
var source = fs.readFileSync('js/app.js', 'utf8');
function fixture() {
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
    controller: { stopProcessVideo: function () {} },
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
  console.log('PASS: startup, recovery, timeout, late permission/init, tracking guidance and camera cleanup');
})().catch(function (error) { console.error(error); process.exitCode = 1; });
