/* Optional ?tracking-test=1: a still tiger and a local numeric pose capture.
 * No camera frames, audio, storage, or network requests are used here.
 * Sample after processDone: MindAR's targetUpdate event precedes its matrix write.
 */
(function () {
  'use strict';

  var DURATION_MS = 20000;
  var MAX_SAMPLES = 1200;

  function phaseAt(ms) {
    return ms < 5000 ? 'hold-still' : (ms < 15000 ? 'slow-arc' : 'hold-still');
  }

  function createCapture(metadata, startMs) {
    var report = { schemaVersion: 1, build: 'tracking-check-1', metadata: metadata,
      durationMs: 0, stopReason: null, samples: [] };
    return {
      report: report,
      add: function (now, state, rawMatrix, renderedMatrix) {
        if (report.stopReason || now - startMs >= DURATION_MS ||
            report.samples.length >= MAX_SAMPLES) return false;
        var ms = Math.max(0, Math.round(now - startMs));
        report.samples.push({ tMs: ms, phase: phaseAt(ms),
          fresh: !!(state && state.isTracking),
          visible: !!(state && state.showing),
          missedFrames: state ? state.trackMiss : 0,
          // Raw camera-space matrix uses target pixels. Rendered matrix includes
          // MindAR's centering and target-width scale (one card width = 1 unit).
          rawMatrix: rawMatrix ? rawMatrix.slice() : null,
          renderedMatrix: renderedMatrix ? renderedMatrix.slice() : null });
        return true;
      },
      finish: function (now, reason) {
        if (report.stopReason) return;
        report.durationMs = Math.max(0, Math.round(now - startMs));
        report.stopReason = reason;
      }
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createCapture: createCapture, phaseAt: phaseAt };
  }
  if (typeof window === 'undefined' ||
      new URLSearchParams(window.location.search).get('tracking-test') !== '1') return;

  document.addEventListener('DOMContentLoaded', function () {
    var scene = document.querySelector('a-scene');
    var anchor = document.getElementById('tiger-anchor');
    var tiger = document.getElementById('tiger');
    var capture = null, timer = null, startedAt = 0, active = false;
    var panel = document.createElement('section');
    panel.id = 'tracking-test-panel';
    panel.hidden = true;
    panel.setAttribute('aria-label', 'Tracking check');
    panel.innerHTML = '<strong>Tracking check · still tiger</strong>' +
      '<p>The cyan outline should follow the target border.</p>' +
      '<label>Target surface <select id="tracking-surface">' +
      '<option value="print">Printed card</option><option value="monitor">Monitor</option>' +
      '</select></label>' +
      '<p id="tracking-status" role="status">Find the card, let the tiger settle, then capture.</p>' +
      '<div class="tracking-actions"><button id="tracking-record" type="button">Capture 20 seconds</button>' +
      '<button id="tracking-save" type="button" disabled>Save report</button></div>' +
      '<small>Captures numeric poses, camera settings and browser version on this phone. ' +
      'No pictures, sound or uploads.</small>';
    document.getElementById('ar-ui').appendChild(panel);
    var recordButton = panel.querySelector('#tracking-record');
    var saveButton = panel.querySelector('#tracking-save');
    var status = panel.querySelector('#tracking-status');
    var surface = panel.querySelector('#tracking-surface');
    document.querySelector('#start-screen .sub').textContent =
      'Tracking check: the tiger will stand still. Lay the card flat in good light.';
    document.querySelector('#start-screen .fineprint').textContent =
      'Camera images stay on your phone. An optional capture saves numeric tracking data only.';

    function finish(reason) {
      if (!active) return;
      active = false;
      clearInterval(timer);
      capture.finish(performance.now(), reason);
      recordButton.disabled = false;
      recordButton.textContent = 'Capture again';
      surface.disabled = false;
      saveButton.disabled = false;
      status.textContent = 'Captured ' + capture.report.samples.length +
        ' updates. Save the report to share it.';
    }

    function updatePrompt() {
      var elapsed = performance.now() - startedAt;
      if (elapsed >= DURATION_MS) { finish('complete'); return; }
      var next = elapsed < 5000 ? 5000 : (elapsed < 15000 ? 15000 : DURATION_MS);
      var seconds = Math.ceil((next - elapsed) / 1000);
      status.textContent = (phaseAt(elapsed) === 'slow-arc' ?
        'Move slowly around the card' : 'Hold the phone still') + ' · ' + seconds + 's';
    }

    scene.addEventListener('arReady', function () {
      var system = scene.systems['mindar-image-system'];
      var controller = system && system.controller;
      if (!controller) return;
      // Configure before processVideo begins; preserve the normal one-shot entrance.
      tiger.setAttribute('voxel-tiger', 'autoDance', false);
      document.getElementById('controls').hidden = true;
      panel.hidden = false;
      var THREE = window.AFRAME.THREE;
      var points = [-0.5, -0.5, 0.003, 0.5, -0.5, 0.003,
        0.5, -0.5, 0.003, 0.5, 0.5, 0.003,
        0.5, 0.5, 0.003, -0.5, 0.5, 0.003,
        -0.5, 0.5, 0.003, -0.5, -0.5, 0.003,
        -0.06, 0, 0.003, 0.06, 0, 0.003,
        0, -0.06, 0.003, 0, 0.06, 0.003];
      var geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
      anchor.setObject3D('tracking-guide', new THREE.LineSegments(geometry,
        new THREE.LineBasicMaterial({ color: 0x00ffff, depthTest: false })));

      var originalUpdate = controller.onUpdate;
      controller.onUpdate = function (event) {
        if (originalUpdate) originalUpdate.call(controller, event);
        if (!active || event.type !== 'processDone') return;
        var state = controller.trackingStates[0];
        var raw = state && state.isTracking && state.currentModelViewTransform ?
          controller.getWorldMatrix(state.currentModelViewTransform, 0) : null;
        var rendered = anchor.object3D.visible ? anchor.object3D.matrix.elements : null;
        if (!capture.add(performance.now(), state, raw, rendered)) {
          finish(performance.now() - startedAt >= DURATION_MS ? 'complete' : 'sample-limit');
        }
      };
    });

    recordButton.addEventListener('click', function () {
      if (active) return;
      var system = scene.systems['mindar-image-system'];
      var video = system.video;
      var tracks = video.srcObject ? video.srcObject.getVideoTracks() : [];
      var settings = tracks[0] && tracks[0].getSettings ? tracks[0].getSettings() : {};
      startedAt = performance.now();
      capture = createCapture({ surface: surface.value, browser: navigator.userAgent,
        target: 'targets/tiger-card.mind',
        targetDimensions: system.controller.markerDimensions[0].slice(),
        camera: { width: video.videoWidth, height: video.videoHeight,
          frameRate: settings.frameRate || null, facingMode: settings.facingMode || null },
        viewport: { width: window.innerWidth, height: window.innerHeight },
        tracking: { filterMinCF: system.filterMinCF, filterBeta: system.filterBeta,
          missTolerance: system.missTolerance, warmupTolerance: system.warmupTolerance }
      }, startedAt);
      active = true;
      surface.disabled = true;
      recordButton.disabled = true;
      saveButton.disabled = true;
      updatePrompt();
      timer = setInterval(updatePrompt, 250);
    });

    saveButton.addEventListener('click', function () {
      if (!capture || active) return;
      var blob = new Blob([JSON.stringify(capture.report)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = 'tiger-tracking-' + capture.report.metadata.surface + '-' + Date.now() + '.json';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    });

    scene.addEventListener('arError', function () { finish('ar-error'); panel.hidden = true; });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) finish('page-hidden');
    });
    window.addEventListener('pagehide', function () { finish('page-hidden'); });
  });
})();
