/* Disable A-Frame's optional remote inspector before any scene initializes.
 * Its query, keyboard and postMessage paths all call openInspector.
 * Keep the vendored release unchanged.
 */
(function () {
  'use strict';
  if (!window.AFRAME) return;
  var inspector = window.AFRAME.components.inspector;
  if (inspector) inspector.Component.prototype.openInspector = function () {};
})();
