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
    var errorMessage = document.getElementById('error-message');
    var arUi = document.getElementById('ar-ui');
    var hint = document.getElementById('hint');
    var danceAgain = document.getElementById('dance-again');
    var soundToggle = document.getElementById('sound-toggle');
    var anchorEl = document.getElementById('tiger-anchor');
    var tigerEl = document.getElementById('tiger');

    var foundOnce = false;   // entrance plays exactly once per page load

    function tiger() { return tigerEl && tigerEl.components['voxel-tiger']; }

    function showError(text) {
      if (text) errorMessage.textContent = text;
      startScreen.hidden = true;
      arUi.hidden = true;
      errorScreen.hidden = false;
    }

    /* ------------------------- start button ----------------------- */
    startButton.addEventListener('click', function () {
      startButton.disabled = true;
      startButton.textContent = 'Starting camera…';

      var system = sceneEl.systems['mindar-image-system'];
      if (!system) {
        showError('The AR engine failed to load. Check your connection and refresh.');
        return;
      }
      system.start(); // MindAR asks the browser for camera permission here.
    });

    /* ------------------------- MindAR lifecycle ------------------- */
    sceneEl.addEventListener('arReady', function () {
      startScreen.hidden = true;
      arUi.hidden = false;
    });

    sceneEl.addEventListener('arError', function (event) {
      var detail = (event && event.detail) || {};
      var msg = 'This experience needs a camera and a modern browser ' +
                '(Safari on iPhone, Chrome on Android).';
      if (detail.error && /denied|NotAllowed/i.test(String(detail.error))) {
        msg = 'Camera access was declined. Allow camera access in your browser ' +
              'settings, then reload this page.';
      }
      showError(msg);
    });

    /* ------------------------- image target tracking -------------- */
    anchorEl.addEventListener('targetFound', function () {
      if (foundOnce) return;  // flicker/re-acquire must NOT replay the entrance
      foundOnce = true;
      hint.classList.add('fade');
      if (tiger()) tiger().playEntrance();
    });

    // targetLost is deliberately ignored: MindAR hides the anchor, the dance
    // keeps its place in time, and the tiger simply continues when the card
    // comes back into view — no jarring restart.

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
