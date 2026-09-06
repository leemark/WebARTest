/* Contract checks for a grounded, repeatable three-dance medley. */
'use strict';
var assert = require('node:assert/strict');
var tiger = require('../js/voxel-tiger.js');
var keys = tiger.CHOREO.keys;
assert.equal(tiger.CHOREO.duration, 18, 'performance is approximately 18 seconds');
assert.deepEqual(tiger.CHOREO.sections.map(function (section) {
  return [section.name, section.start, section.end];
}), [
  ['welcoming-acknowledgment', 0, 2],
  ['robot-freezes', 2, 6],
  ['running-man', 6, 11],
  ['floss', 11, 16],
  ['friendly-finish', 16, 18]
]);
Object.keys(keys).forEach(function (channel) {
  var track = keys[channel];
  assert.equal(track[0][0], 0, channel + ' starts at zero');
  assert.equal(track[track.length - 1][0], tiger.CHOREO.duration);
  track.forEach(function (key, index) {
    if (index) assert.ok(key[0] > track[index - 1][0], channel + ' sorted unique times');
    assert.ok(key[1].every(Number.isFinite), channel + ' finite coordinates');
  });
  assert.deepEqual(track[0][1], track[track.length - 1][1], channel + ' settles for replay');
});
for (var t = 0; t <= tiger.CHOREO.duration; t += 0.05) {
  var pose = tiger.sampleTigerPose(t);
  assert.deepEqual(pose.root.pos, [0, 0, 0], 'No whole-rig hopping or sliding');
  Object.keys(pose).forEach(function (part) {
    Object.keys(pose[part]).forEach(function (property) {
      assert.ok(pose[part][property].every(Number.isFinite));
    });
  });
}
var greeting = tiger.sampleTigerPose(0.35), neutral = tiger.sampleTigerPose(1.4);
assert.notDeepEqual(greeting.armL, neutral.armL, 'Greeting acknowledges with a wave');
assert.notDeepEqual(greeting.head, neutral.head, 'Greeting acknowledges with a head gesture');
var a = tiger.sampleTigerPose(2.25), b = tiger.sampleTigerPose(2.60);
['body', 'head', 'armL', 'armR', 'elbowL', 'elbowR'].forEach(function (part) {
  assert.deepEqual(a[part], b[part], part + ' holds a robot freeze');
});
a = tiger.sampleTigerPose(8.7);
assert.notEqual(a.kneeL.rot[0], a.kneeR.rot[0], 'Running man articulates alternate knees');
a = tiger.sampleTigerPose(11.35); b = tiger.sampleTigerPose(11.85);
assert.ok(a.armL.rot[2] * a.armR.rot[2] > 0, 'Floss arms swing together');
assert.ok(a.armL.rot[2] * b.armL.rot[2] < 0, 'Floss changes sides');
assert.ok(a.body.pos[0] * a.armL.rot[2] < 0, 'Floss hips oppose arms');
a = tiger.sampleTigerPose(16.3);
assert.notDeepEqual(a.armL, neutral.armL, 'Friendly finish has a distinct goodbye gesture');
assert.deepEqual(tiger.sampleTigerPose(tiger.CHOREO.duration), tiger.sampleTigerPose(0), 'Performance ends at the neutral pose');
console.log('PASS: finite sorted 18-second medley, grounded root, greeting, robot holds, alternate knees, floss coordination and resting finish');
