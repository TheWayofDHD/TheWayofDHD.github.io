/* ============================================
   The Way of DHD — roulette.js
   "ХЧК roulette": weights are the real on-chain
   supply shares — Epic 1000, Exclusive 21, Diamond 1.
   Entertainment demo: nothing is minted.
   ============================================ */

(function () {
  'use strict';

  var DATA_URL = 'data/exclusive21.json';
  var GETGEMS_ITEM = 'https://getgems.io/nft/';
  // Real shares, exact counts out of 1022 total supply.
  var WEIGHTS = [
    { type: 'Epic', weight: 1000 },
    { type: 'Exclusive', weight: 21 },
    { type: 'Diamond', weight: 1 }
  ];
  var TILE = 132;            // tile width + gap, must match CSS
  var VISIBLE = 4;           // tiles visible in the window
  var SPIN_TILES = 26;       // total tiles in the strip
  var SPIN_MS = 3200;

  var strip = document.getElementById('rlt-strip');
  var spinBtn = document.getElementById('rlt-spin');
  var resultEl = document.getElementById('rlt-result');
  var statsEl = document.getElementById('rlt-stats');
  var windowEl = document.getElementById('rlt-window');

  if (!strip || !spinBtn) return;

  var pool = { Epic: [], Exclusive: [], Diamond: [] };
  var counts = { Epic: 0, Exclusive: 0, Diamond: 0 };
  var total = 0;
  var spinning = false;

  function t(key, fallback) {
    return typeof window.dhdT === 'function' ? window.dhdT(key) : fallback;
  }

  function escapeHtml(str) {
    return String(str === null || str === undefined ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function pickWeighted() {
    // 1022 supply: Diamond 1/1022, Exclusive 21/1022, Epic 1000/1022.
    var roll = Math.floor(Math.random() * 1022) + 1; // 1..1022
    if (roll === 1) return 'Diamond';
    if (roll <= 22) return 'Exclusive';
    return 'Epic';
  }

  function pickItem(type) {
    var list = pool[type];
    if (!list || !list.length) return null;
    return list[Math.floor(Math.random() * list.length)];
  }

  function tileHtml(item, type) {
    var img = item && item.image
      ? '<img src="' + escapeHtml(item.image) + '" alt="" loading="lazy" decoding="async" width="120" height="120">'
      : '';
    return '<div class="rlt-tile rlt-tile-' + type.toLowerCase() + '">' +
      '<span class="rlt-tile-media">' + img + '</span>' +
      '<span class="rlt-tile-label">' + escapeHtml(type) + '</span>' +
    '</div>';
  }

  function buildStrip() {
    var html = '';
    for (var i = 0; i < SPIN_TILES; i++) {
      var type = WEIGHTS[i % WEIGHTS.length].type;
      html += tileHtml(pickItem(type), type);
    }
    strip.innerHTML = html;
    // Reset instantly (no transition): otherwise the next spin would start
    // from the previous target position and look like it never spins again.
    strip.style.transition = 'none';
    strip.style.transform = 'translate3d(0,0,0)';
    void strip.offsetWidth; // commit the reset before the next transition starts
  }

  function setStripOffset(offsetPx, animate) {
    strip.style.transition = animate ? ('transform ' + SPIN_MS + 'ms cubic-bezier(0.12, 0.8, 0.15, 1)') : 'none';
    strip.style.transform = 'translate3d(' + (-offsetPx) + 'px,0,0)';
  }

  function renderStats() {
    if (!statsEl) return;
    if (!total) {
      statsEl.textContent = '';
      return;
    }
    statsEl.textContent = t('rlt-stats', 'Spins') + ': ' + total +
      ' \u00b7 Epic ' + counts.Epic +
      ' \u00b7 Exclusive ' + counts.Exclusive +
      ' \u00b7 Diamond ' + counts.Diamond;
  }

  function renderResult(type, item) {
    if (!resultEl) return;
    var label;
    if (type === 'Diamond') {
      label = t('rlt-hit-diamond', 'Jackpot: Diamond — the Dickpaper itself!');
      resultEl.innerHTML = label + ' <a href="dickpaper.html">' + escapeHtml(t('nav-dickpaper', 'Dickpaper')) + ' \u2192</a>';
      resultEl.className = 'rlt-result is-diamond';
      return;
    }
    if (!item) {
      resultEl.textContent = type;
      resultEl.className = 'rlt-result';
      return;
    }
    label = type === 'Exclusive'
      ? t('rlt-hit-exclusive', 'Rare hit')
      : t('rlt-hit-epic', 'Epic');
    resultEl.className = 'rlt-result is-' + type.toLowerCase();
    resultEl.innerHTML = label + ': ' + escapeHtml(item.name) +
      ' \u00b7 <a href="' + GETGEMS_ITEM + escapeHtml(item.address) + '" target="_blank" rel="noopener noreferrer">Getgems \u2192</a>';
  }

  function spin() {
    if (spinning) return;
    spinning = true;
    spinBtn.disabled = true;
    if (resultEl) { resultEl.textContent = '…'; resultEl.className = 'rlt-result'; }

    var outcome = pickWeighted();
    var winner = pickItem(outcome);

    buildStrip();
    // Place the winning type on the tile the pointer will stop at.
    var landingIndex = SPIN_TILES - VISIBLE - 1;
    var tiles = strip.querySelectorAll('.rlt-tile');
    var tile = tiles[landingIndex];
    if (tile) {
      tile.outerHTML = tileHtml(winner, outcome);
    }

    var offset = landingIndex * TILE + TILE / 2 - windowEl.clientWidth / 2;
    // Small random jitter so identical outcomes do not look identical,
    // but keep the pointer clearly inside the winning tile.
    offset += (Math.random() * 0.36 - 0.18) * TILE;
    requestAnimationFrame(function () {
      setStripOffset(offset, true);
    });

    setTimeout(function () {
      counts[outcome] += 1;
      total += 1;
      renderResult(outcome, winner);
      renderStats();
      spinning = false;
      spinBtn.disabled = false;
    }, SPIN_MS + 120);
  }

  spinBtn.addEventListener('click', spin);

  fetch(DATA_URL, { cache: 'no-store' })
    .then(function (resp) {
      if (!resp.ok) throw new Error('roulette ' + resp.status);
      return resp.json();
    })
    .then(function (data) {
      pool.Exclusive = data.items || [];
      pool.Epic = data.epicSample || [];
      pool.Diamond = data.diamond ? [data.diamond] : [];
      buildStrip();
    })
    .catch(function (err) {
      console.warn('Roulette pool unavailable:', err.message);
      strip.innerHTML = '';
    });
})();
