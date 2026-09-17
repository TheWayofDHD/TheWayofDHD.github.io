/* ============================================
   The Way of DHD — dickpaper.js
   Progress loading + zoom / pan viewer
   ============================================ */

(function () {
  'use strict';

  var IMAGE_URL = 'assets/dickpaper.jpg';
  var MIN_SCALE = 0.5;
  var MAX_SCALE = 8;
  var STEP = 1.25;

  var viewer = document.getElementById('paper-viewer');
  var image = document.getElementById('paper-image');
  var placeholder = document.getElementById('paper-placeholder');
  var loader = document.getElementById('paper-loader');
  var bar = document.getElementById('paper-progress-bar');
  var pctEl = document.getElementById('paper-progress-text');
  var statusEl = document.getElementById('paper-status');
  var zoomEl = document.getElementById('zoom-value');

  if (!viewer || !image) return;

  var scale = 1;
  var tx = 0;
  var ty = 0;
  var actualScale = 1;
  var loaded = false;

  function t(key, fallback) {
    return typeof window.dhdT === 'function' ? window.dhdT(key) : fallback;
  }

  function status(message) {
    if (statusEl) statusEl.textContent = message || '';
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function applyTransform() {
    image.style.transform = 'translate3d(' + tx + 'px,' + ty + 'px,0) scale(' + scale + ')';
    if (zoomEl) zoomEl.textContent = Math.round(scale * 100) + '%';
  }

  function bounds() {
    var vw = viewer.clientWidth;
    var vh = viewer.clientHeight;
    var size = Math.min(vw, vh);
    return { size: size, limitX: Math.max(0, (size * scale - vw) / 2), limitY: Math.max(0, (size * scale - vh) / 2) };
  }

  function clampPan() {
    var b = bounds();
    tx = clamp(tx, -b.limitX, b.limitX);
    ty = clamp(ty, -b.limitY, b.limitY);
  }

  function setScale(next, anchorX, anchorY) {
    var prev = scale;
    scale = clamp(next, MIN_SCALE, Math.max(MAX_SCALE, actualScale));
    if (scale === prev) return;

    var rect = viewer.getBoundingClientRect();
    var ax = (anchorX === undefined) ? rect.width / 2 : anchorX;
    var ay = (anchorY === undefined) ? rect.height / 2 : anchorY;
    var offsetX = ax - rect.width / 2;
    var offsetY = ay - rect.height / 2;
    var factor = scale / prev;

    tx = (tx - offsetX) * factor + offsetX;
    ty = (ty - offsetY) * factor + offsetY;
    clampPan();
    applyTransform();
  }

  function reset() {
    scale = 1;
    tx = 0;
    ty = 0;
    applyTransform();
  }

  function zoomToActual() {
    setScale(actualScale);
  }

  // --- Loading with a real progress indicator ---
  function updateProgress(ratio) {
    var percent = Math.max(0, Math.min(100, Math.round(ratio * 100)));
    if (bar) bar.style.width = percent + '%';
    if (pctEl) pctEl.textContent = percent + '%';
  }

  function finishLoading(sizeLabel) {
    loaded = true;
    image.classList.add('is-visible');
    if (placeholder) placeholder.classList.add('is-hidden');
    if (loader) loader.classList.add('is-done');
    updateProgress(1);
    actualScale = image.naturalWidth ? image.naturalWidth / Math.min(viewer.clientWidth, viewer.clientHeight) : 1;
    applyTransform();
    status(sizeLabel || t('paper-loaded', 'Artwork loaded.'));
  }

  function showImageFromBlob(blob) {
    var url = URL.createObjectURL(blob);
    image.onload = function () {
      var kb = Math.round(blob.size / 1024);
      finishLoading(t('paper-loaded-detail', 'Loaded') + ' ' + image.naturalWidth + '\u00d7' + image.naturalHeight + ' \u00b7 ' + kb + ' KB');
      setTimeout(function () { URL.revokeObjectURL(url); }, 15000);
    };
    image.onerror = function () {
      if (loader) loader.classList.add('is-done');
      status(t('paper-error', 'The artwork could not be decoded.'));
    };
    image.src = url;
  }

  function loadWithProgress() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', IMAGE_URL, true);
    xhr.responseType = 'blob';

    xhr.onprogress = function (event) {
      if (event.lengthComputable) updateProgress(event.loaded / event.total);
      else updateProgress(0.35);
    };

    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300 && xhr.response) {
        showImageFromBlob(xhr.response);
        return;
      }
      fallbackLoad();
    };

    xhr.onerror = fallbackLoad;
    xhr.send();
  }

  function fallbackLoad() {
    image.onload = function () {
      finishLoading(t('paper-loaded-detail', 'Loaded') + ' ' + image.naturalWidth + '\u00d7' + image.naturalHeight);
    };
    image.onerror = function () {
      if (loader) loader.classList.add('is-done');
      status(t('paper-error', 'The artwork could not be loaded.'));
    };
    image.src = IMAGE_URL;
    updateProgress(0.5);
  }

  // --- Wheel zoom (anchored to the cursor) ---
  viewer.addEventListener('wheel', function (event) {
    if (!loaded) return;
    event.preventDefault();
    var rect = viewer.getBoundingClientRect();
    var anchorX = event.clientX - rect.left;
    var anchorY = event.clientY - rect.top;
    var factor = event.deltaY < 0 ? STEP : 1 / STEP;
    setScale(scale * factor, anchorX, anchorY);
  }, { passive: false });

  // --- Drag / pan + pinch ---
  var pointers = {};
  var lastX = 0;
  var lastY = 0;
  var pinchStart = 0;
  var pinchScale = 1;

  function pointerCount() {
    return Object.keys(pointers).length;
  }

  viewer.addEventListener('pointerdown', function (event) {
    if (!loaded) return;
    viewer.setPointerCapture(event.pointerId);
    pointers[event.pointerId] = { x: event.clientX, y: event.clientY };
    lastX = event.clientX;
    lastY = event.clientY;

    if (pointerCount() === 2) {
      var ids = Object.keys(pointers);
      var a = pointers[ids[0]];
      var b = pointers[ids[1]];
      pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
      pinchScale = scale;
    }
  });

  viewer.addEventListener('pointermove', function (event) {
    if (!loaded || !pointers[event.pointerId]) return;

    if (pointerCount() === 2) {
      pointers[event.pointerId] = { x: event.clientX, y: event.clientY };
      var ids = Object.keys(pointers);
      var a = pointers[ids[0]];
      var b = pointers[ids[1]];
      var distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchStart > 0) {
        setScale(pinchScale * (distance / pinchStart));
      }
      return;
    }

    var dx = event.clientX - lastX;
    var dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    pointers[event.pointerId] = { x: event.clientX, y: event.clientY };

    tx += dx;
    ty += dy;
    clampPan();
    applyTransform();
  });

  function releasePointer(event) {
    if (pointers[event.pointerId]) delete pointers[event.pointerId];
    if (pointerCount() < 2) pinchStart = 0;
  }

  viewer.addEventListener('pointerup', releasePointer);
  viewer.addEventListener('pointercancel', releasePointer);
  viewer.addEventListener('pointerleave', releasePointer);

  // --- Double click: toggle actual size / fit ---
  viewer.addEventListener('dblclick', function () {
    if (!loaded) return;
    if (Math.abs(scale - actualScale) < 0.05) reset();
    else zoomToActual();
  });

  // --- Toolbar ---
  function bind(id, handler) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', handler);
  }

  bind('zoom-in', function () { setScale(scale * STEP); });
  bind('zoom-out', function () { setScale(scale / STEP); });
  bind('zoom-reset', reset);
  bind('zoom-fit', reset);
  bind('zoom-actual', zoomToActual);

  // --- Keyboard ---
  viewer.addEventListener('keydown', function (event) {
    if (!loaded) return;
    var step = 60;
    switch (event.key) {
      case '+':
      case '=':
        setScale(scale * STEP);
        break;
      case '-':
      case '_':
        setScale(scale / STEP);
        break;
      case '0':
        reset();
        break;
      case 'ArrowUp':
        ty += step; clampPan(); applyTransform();
        break;
      case 'ArrowDown':
        ty -= step; clampPan(); applyTransform();
        break;
      case 'ArrowLeft':
        tx += step; clampPan(); applyTransform();
        break;
      case 'ArrowRight':
        tx -= step; clampPan(); applyTransform();
        break;
      default:
        return;
    }
    event.preventDefault();
  });

  window.addEventListener('resize', function () {
    if (loaded) actualScale = image.naturalWidth / Math.max(1, Math.min(viewer.clientWidth, viewer.clientHeight));
    clampPan();
    applyTransform();
  });

  window.addEventListener('dhd-langchange', function () {
    if (loaded) {
      status(t('paper-loaded-detail', 'Loaded') + ' ' + image.naturalWidth + '\u00d7' + image.naturalHeight);
    }
  });

  // --- init ---
  applyTransform();
  updateProgress(0.02);
  loadWithProgress();
})();
