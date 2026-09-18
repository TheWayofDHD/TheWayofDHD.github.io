/* ============================================
   The Way of DHD — postcard.js
   Postcard of the day: deterministic pick by
   day of year, prev/next browsing.
   ============================================ */

(function () {
  'use strict';

  var DATA_URL = 'data/postcards.json';

  var image = document.getElementById('pc-image');
  var numEl = document.getElementById('pc-num');
  var prevBtn = document.getElementById('pc-prev');
  var nextBtn = document.getElementById('pc-next');

  if (!image) return;

  var files = [];
  var dayIndex = 0;   // index of "today" within the card list
  var offset = 0;     // user browsing offset (-1 = yesterday, +1 = tomorrow)

  function t(key, fallback) {
    return typeof window.dhdT === 'function' ? window.dhdT(key) : fallback;
  }

  function show() {
    if (!files.length) return;
    var n = files.length;
    var idx = ((dayIndex + offset) % n + n) % n;
    image.src = 'assets/advent/cards/' + files[idx];
    var label = (idx + 1) + ' / ' + n;
    if (offset === 0) label += ' \u00b7 ' + t('pc-today', "today's");
    if (offset === -1) label += ' \u00b7 ' + t('pc-yesterday', 'yesterday');
    if (offset === 1) label += ' \u00b7 ' + t('pc-tomorrow', 'tomorrow');
    numEl.textContent = label;
    image.alt = 'The Way of DHD postcard ' + (idx + 1) + ' of ' + n;
  }

  function dayOfYear() {
    var now = new Date();
    var start = new Date(now.getFullYear(), 0, 0);
    return Math.floor((now - start) / 86400000) - 1; // 0-based
  }

  if (prevBtn) prevBtn.addEventListener('click', function () { offset -= 1; show(); });
  if (nextBtn) nextBtn.addEventListener('click', function () { offset += 1; show(); });
  window.addEventListener('dhd-langchange', show);

  fetch(DATA_URL, { cache: 'no-store' })
    .then(function (resp) {
      if (!resp.ok) throw new Error('postcards ' + resp.status);
      return resp.json();
    })
    .then(function (data) {
      files = data.files || [];
      dayIndex = dayOfYear() % Math.max(1, files.length);
      show();
    })
    .catch(function (err) {
      console.warn('Postcard unavailable:', err.message);
      if (numEl) numEl.textContent = '\u2014';
    });
})();
