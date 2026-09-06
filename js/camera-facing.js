/* Camera-aware presentation in the upright marker frame. Never moves the anchor. */
(function () {
  'use strict';
  var RAD = Math.PI / 180;

  function wrap(angle) {
    return Math.atan2(Math.sin(angle), Math.cos(angle));
  }

  function aim(state, camera, dt, maxTilt, fresh) {
    var horizontal = Math.sqrt(camera.x * camera.x + camera.z * camera.z);
    var distance = Math.sqrt(horizontal * horizontal + camera.y * camera.y);
    if (!isFinite(distance) || distance < 0.000001) return false;
    var ratio = horizontal / distance;
    // Hysteresis avoids heading chatter at the overhead singularity.
    state.overhead = state.overhead ? ratio < 0.25 : ratio < 0.18;
    var yaw = state.overhead ? state.yaw : Math.atan2(camera.x, camera.z);
    var elevation = Math.atan2(camera.y, horizontal);
    var pitch = -Math.min(Math.max(0, maxTilt) * RAD,
      Math.max(0, elevation - 45 * RAD));
    if (fresh) {
      state.yaw = yaw;
      state.pitch = pitch;
      return true;
    }
    var seconds = Math.min(Math.max(dt, 0), 0.05);
    var weight = 1 - Math.exp(-seconds / 0.20);
    var limit = 120 * RAD * seconds;
    function approach(value, delta, deadband) {
      if (Math.abs(delta) <= deadband) return value;
      return value + Math.max(-limit, Math.min(limit, delta * weight));
    }
    state.yaw = wrap(approach(state.yaw, wrap(yaw - state.yaw), 2 * RAD));
    state.pitch = approach(state.pitch, pitch - state.pitch, RAD);
    return true;
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { aim: aim };
  if (typeof window === 'undefined' || !window.AFRAME) return;
  var AFRAME = window.AFRAME;
  AFRAME.registerComponent('camera-facing', {
    schema: { maxTilt: { type: 'number', default: 30 } },
    init: function () {
      this.anchor = this.el.sceneEl.querySelector('#tiger-anchor');
      this.state = { yaw: 0, pitch: 0, overhead: false };
      this.cameraPosition = new AFRAME.THREE.Vector3();
      this.ready = false;
      this.diagnostic = /(?:\?|&)tracking-test=1(?:&|$)/.test(window.location.search);
      var self = this;
      this.onLost = function () { self.ready = false; };
      this.anchor.addEventListener('targetLost', this.onLost);
    },
    tick: function (time, dt) {
      if (this.diagnostic) return;
      if (!this.anchor.object3D.visible) { this.ready = false; return; }
      var camera = this.el.sceneEl.camera;
      if (!camera) return;
      // Parent carries the fixed +90-degree marker-to-upright transform.
      // Measuring here excludes our own presentation rotation and dance pose.
      camera.getWorldPosition(this.cameraPosition);
      this.el.object3D.parent.worldToLocal(this.cameraPosition);
      if (!aim(this.state, this.cameraPosition, (dt || 0) / 1000,
        this.data.maxTilt, !this.ready)) return;
      this.el.object3D.rotation.set(this.state.pitch, this.state.yaw, 0, 'YXZ');
      this.ready = true;
    },
    remove: function () {
      this.anchor.removeEventListener('targetLost', this.onLost);
    }
  });
})();
