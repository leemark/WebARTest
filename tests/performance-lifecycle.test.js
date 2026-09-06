/* Lifecycle checks for the one-shot performance and explicit replay loop. */
'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');
var vm = require('node:vm');
var source = fs.readFileSync('js/voxel-tiger.js', 'utf8');
var registeredComponent;
var previousWindow = global.window;
global.window = {
  AFRAME: {
    THREE: {},
    registerComponent: function (name, definition) {
      registeredComponent = definition;
    }
  }
};

var voxelTigerPath = require.resolve('../js/voxel-tiger.js');
delete require.cache[voxelTigerPath];
var tiger = require('../js/voxel-tiger.js');
if (previousWindow === undefined) delete global.window;
else global.window = previousWindow;

assert.equal(registeredComponent.schema.loop.default, false, 'loop is opt-in');
assert.equal(registeredComponent.schema.autoDance.default, true, 'initial dancing remains enabled');

function vector() {
  return {
    x: 0,
    y: 0,
    z: 0,
    set: function (x, y, z) {
      this.x = x;
      this.y = y;
      this.z = z;
    },
    setScalar: function (value) {
      this.x = value;
      this.y = value;
      this.z = value;
    }
  };
}

function makeInstance(options) {
  var parts = {};
  Object.keys(tiger.CHOREO.keys).forEach(function (channel) {
    parts[channel.substring(0, channel.lastIndexOf('.'))] = {
      position: vector(), rotation: vector(), scale: vector()
    };
  });
  var instance = Object.create(registeredComponent);
  instance.data = {
    autoDance: options.autoDance,
    loop: options.loop,
    danceDuration: tiger.CHOREO.duration,
    audioSrc: ''
  };
  instance.state = 'hidden';
  instance.enterT = 0;
  instance.danceT = 0;
  instance.loopPause = 0.9;
  instance.pauseTimer = null;
  instance.audio = null;
  instance.soundOn = false;
  instance.pose = {};
  instance.parts = parts;
  instance.el = {
    object3D: { visible: false },
    emitted: [],
    emit: function (name, detail) { this.emitted.push({ name: name, detail: detail }); }
  };
  instance.playAudio = function () {};
  instance.stopAudio = function () {};
  return instance;
}

function tick(instance, count, dtMs) {
  for (var i = 0; i < count; i++) registeredComponent.tick.call(instance, 0, dtMs || 100);
}

function eventCount(instance, name) {
  return instance.el.emitted.filter(function (event) { return event.name === name; }).length;
}

function finishEntrance(instance) {
  registeredComponent.playEntrance.call(instance);
  tick(instance, 12, 100);
}

var timers = {};
var nextTimer = 1;
var savedSetTimeout = global.setTimeout;
var savedClearTimeout = global.clearTimeout;
global.setTimeout = function (fn) {
  var id = nextTimer++;
  timers[id] = fn;
  return id;
};
global.clearTimeout = function (id) { delete timers[id]; };

try {
  var normal = makeInstance({ autoDance: true, loop: false });
  finishEntrance(normal);
  assert.equal(normal.state, 'dancing', 'autoDance starts after the entrance');
  assert.equal(eventCount(normal, 'tiger-dance-started'), 1);
  var beforeHidden = normal.danceT;
  normal.el.object3D.visible = false;
  tick(normal, 7, 100);
  assert.equal(normal.danceT, beforeHidden + 0.7, 'dance time continues under a hidden parent');
  normal.el.object3D.visible = true;
  tick(normal, Math.ceil((tiger.CHOREO.duration - normal.danceT) * 10) + 1, 100);
  assert.equal(normal.state, 'paused', 'default performance settles paused');
  assert.equal(eventCount(normal, 'tiger-dance-finished'), 1);
  assert.equal(Object.keys(timers).length, 0, 'default performance does not schedule a loop');
  var settledAt = normal.danceT;
  tick(normal, 10, 100);
  assert.equal(normal.danceT, settledAt, 'paused performance stays settled');

  registeredComponent.replayDance.call(normal);
  assert.equal(normal.state, 'dancing', 'replay starts from the resting state');
  assert.equal(normal.danceT, 0, 'replay starts at the greeting');
  assert.equal(eventCount(normal, 'tiger-entrance-started'), 1, 'replay does not repeat the entrance');
  assert.equal(eventCount(normal, 'tiger-dance-started'), 2);

  var looping = makeInstance({ autoDance: true, loop: true });
  finishEntrance(looping);
  tick(looping, Math.ceil(tiger.CHOREO.duration * 10) + 1, 100);
  assert.equal(looping.state, 'paused');
  assert.equal(Object.keys(timers).length, 1, 'loop mode schedules the explicit repeat');
  var timerId = Number(Object.keys(timers)[0]);
  timers[timerId]();
  assert.equal(looping.state, 'dancing', 'explicit loop restarts after the breather');
  assert.equal(looping.danceT, 0);
  assert.equal(eventCount(looping, 'tiger-dance-started'), 2);

  var diagnostic = makeInstance({ autoDance: false, loop: false });
  finishEntrance(diagnostic);
  assert.equal(diagnostic.state, 'paused', 'diagnostic mode stops after the entrance');
  assert.equal(eventCount(diagnostic, 'tiger-dance-started'), 0, 'diagnostic mode never dances');
  tick(diagnostic, 30, 100);
  assert.equal(diagnostic.state, 'paused');
  assert.equal(diagnostic.danceT, 0, 'diagnostic mode remains stationary');
} finally {
  global.setTimeout = savedSetTimeout;
  global.clearTimeout = savedClearTimeout;
}

console.log('PASS: one-shot performance settles, replay skips entrance, loop is opt-in, hidden parents preserve time and diagnostics stay still');
