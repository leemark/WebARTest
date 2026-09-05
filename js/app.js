/* =============================================================================
 * app.js — page glue between the UI and the MindAR + voxel-tiger components.
 *
 * Flow:  Start AR → camera + tracker spin up (arReady) → point at card
 *        (targetFound, once) → tiger pops in → dances → loops.
 *        "Dance again" restarts the choreography. Sound stays off unless the
 *        user explicitly enables it (and only plays if a file is configured —
 *        see README.md §Sound).
 * ========================================================================== */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var sceneEl = document.querySelector('a-scene');
    var startScreen = document.getElementById('start-screen');
    var startButton = document.getElementById('start-button');
    var errorScreen = document.getElementById('error-screen');
    var retryButton = document.getElementById('retry-button');
    var errorMessage = document.getElementById('error-message');
    var arUi = document.getElementById('ar-ui');
    var hint = document.getElementById('hint');
    var danceAgain = document.getElementById('dance-again');
    var soundToggle = document.getElementById('sound-toggle');
    var anchorEl = document.getElementById('tiger-anchor');
    var tigerEl = document.getElementById('tiger');

    var starting = false;
    var failed = false;
    var startupTimer = null;
    var foundOnce = false;   // entrance plays exactly once per page load

    function tiger() { return tigerEl && tigerEl.components['voxel-tiger']; }

    function stopCamera() {
      var system = sceneEl.systems['mindar-image-system'];
      if (!system) return;
      if (system.controller) system.controller.stopProcessVideo();
      if (system.video && system.video.srcObject) {
        system.video.srcObject.getTracks().forEach(function (track) { track.stop(); });
      }
    }

    function showError(text) {
      failed = true;
      starting = false;
      clearTimeout(startupTimer);
      stopCamera();
      if (text) errorMessage.textContent = text;
      startScreen.hidden = true;
      arUi.hidden = true;
      errorScreen.hidden = false;
      retryButton.focus();
    }

    /* ------------------------- start button ----------------------- */
    startButton.addEventListener('click', function () {
      if (starting || failed) return;
      starting = true;
      startButton.disabled = true;
      startButton.textContent = 'Starting camera…';

      var system = sceneEl.systems['mindar-image-system'];
      if (!system) {
        showError('The AR engine failed to load. Check your connection and refresh.');
        return;
      }
      // MindAR 1.2.5 does not forward every initialization rejection to arError.
      // Bound startup, including a permission prompt left unanswered.
      startupTimer = setTimeout(function () {
        showError('The camera or tiger tracker took too long to start. Allow camera ' +
          'access if prompted, check your connection, then reload to try again.');
      }, 30000);

      // Guard late camera permission results after timeout/page exit, and catch
      // _startAR failures without editing the vendored library.
      var startAR = system._startAR;
      system._startAR = function () {
        if (failed) { stopCamera(); return Promise.resolve(); }
        return Promise.resolve().then(function () {
          return startAR.call(system);
        }).then(function () {
          if (failed) stopCamera();
        }).catch(function () {
          showError('The tiger tracker could not load. Check your connection, ' +
            'then reload to try again.');
        });
      };
      try {
        system.start(); // Explicit tap triggers the camera request.
      } catch (error) {
        showError('The camera could not start. Open this page in Safari on iPhone ' +
          'or Chrome on Android, allow camera access, then reload.');
      }
    });

    /* ------------------------- MindAR lifecycle ------------------- */
    sceneEl.addEventListener('arReady', function () {
      if (failed) { stopCamera(); return; }
      starting = false;
      clearTimeout(startupTimer);
      soundToggle.hidden = !(tiger() && tiger().data.audioSrc);
      startScreen.hidden = true;
      arUi.hidden = false;
    });

    sceneEl.addEventListener('arError', function (event) {
      var detail = (event && event.detail) || {};
      var msg = 'This experience needs a camera and a modern browser ' +
                '(Safari on iPhone, Chrome on Android).';
      if (detail.error === 'VIDEO_FAIL') {
        msg = 'Camera access is unavailable. Allow camera access in your browser ' +
          'settings and close other apps using the camera, then reload. ' +
          'Use Safari on iPhone or Chrome on Android.';
      } else if (detail.error && /denied|NotAllowed/i.test(String(detail.error))) {
        msg = 'Camera access was declined. Allow camera access in your browser ' +
              'settings, then reload this page.';
      }
      showError(msg);
    });

    /* ------------------------- image target tracking -------------- */
    anchorEl.addEventListener('targetFound', function () {
      hint.classList.add('fade');
      if (foundOnce) return;  // flicker/re-acquire must NOT replay the entrance
      foundOnce = true;
      if (tiger()) tiger().playEntrance();
    });

    // Restore guidance without resetting the tiger or replaying its entrance.
    anchorEl.addEventListener('targetLost', function () {
      hint.classList.remove('fade');
    });

    retryButton.addEventListener('click', function () { window.location.reload(); });
    window.addEventListener('pagehide', function () {
      failed = true;
      clearTimeout(startupTimer);
      stopCamera();
    });
    window.addEventListener('pageshow', function (event) {
      if (event.persisted) window.location.reload();
    });

    /* ------------------------- tiger events ----------------------- */
    tigerEl.addEventListener('tiger-dance-started', function () {
      danceAgain.hidden = false;
    });

    /* ------------------------- overlay controls ------------------- */
    danceAgain.addEventListener('click', function () {
      if (tiger()) tiger().replayDance();
    });

    soundToggle.addEventListener('click', function () {
      var on = soundToggle.getAttribute('aria-pressed') !== 'true';
      soundToggle.setAttribute('aria-pressed', String(on));
      soundToggle.textContent = on ? 'Sound: On' : 'Sound: Off';
      if (tiger()) tiger().setSoundOn(on);
    });
  });
})();
