'use strict';

var assert = require('assert');

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

assert.strictEqual(typeof tiger.sampleTigerPose, 'function');
assert.strictEqual(typeof registeredComponent.applyPose, 'function');

function makeVector() {
  return {
    x: 0,
    y: 0,
    z: 0,
    set: function (x, y, z) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
  };
}

function makePart() {
  return { position: makeVector(), rotation: makeVector(), scale: makeVector() };
}

function assertNear(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-9, message + ': ' + actual + ' !== ' + expected);
}

var instance = {
  parts: {
    body: makePart(),
    root: makePart(),
    legL: makePart(),
    legR: makePart()
  }
};
var frameCount = 108;
for (var frame = 0; frame <= frameCount; frame++) {
  var t = tiger.CHOREO.duration * frame / frameCount;
  var pose = tiger.sampleTigerPose(t);
  registeredComponent.applyPose.call(instance, pose);

  // body.pos is an offset from the fixed hip-height pivot.
  assertNear(instance.parts.body.position.x, pose.body.pos[0], 'body x at t=' + t);
  assertNear(instance.parts.body.position.y, 0.62 + pose.body.pos[1], 'body y at t=' + t);
  assertNear(instance.parts.body.position.z, pose.body.pos[2], 'body z at t=' + t);

  ['legL', 'legR'].forEach(function (name) {
    var sign = name === 'legL' ? -1 : 1;
    assertNear(instance.parts[name].position.x, sign * 0.17 + pose[name].pos[0], name + ' hip x');
    assertNear(instance.parts[name].position.y, 0.02 + pose[name].pos[1], name + ' hip y');
    assertNear(instance.parts[name].position.z, pose[name].pos[2], name + ' slide');
  });

  // Root position remains an absolute choreography channel.
  assertNear(instance.parts.root.position.x, pose.root.pos[0], 'root x at t=' + t);
  assertNear(instance.parts.root.position.y, pose.root.pos[1], 'root y at t=' + t);
  assertNear(instance.parts.root.position.z, pose.root.pos[2], 'root z at t=' + t);
}

console.log('dance baseline: applyPose preserves the body hip baseline and root position semantics across the full dance');
