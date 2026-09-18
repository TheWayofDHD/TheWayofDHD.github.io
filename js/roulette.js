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
  // Real odds for the outcome, exact counts out of the 1022 total supply
  // (Diamond 1, Exclusive 21, Epic 1000) — see pickWeighted().
  var TILE = 132;            // tile width + gap, must match CSS
  var VISIBLE = 4;           // tiles visible in the window
  var SPIN_TILES = 30;       // total tiles in the strip
  var MIN_SPIN_MS = 2600;
  var MAX_SPIN_MS = 3800;

  var strip = document.getElementById('rlt-strip');
  var spinBtn = document.getElementById('rlt-spin');
  var resultEl = document.getElementById('rlt-result');
  var statsEl = document.getElementById('rlt-stats');
  var windowEl = document.getElementById('rlt-window');
  var shareBtn = document.getElementById('rlt-share');

  if (!strip || !spinBtn) return;

  var pool = { Epic: [], Exclusive: [], Diamond: [] };
  var lastWinner = { Epic: null, Exclusive: null, Diamond: null };
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

  function pickWinner(type) {
    var list = pool[type];
    if (!list || !list.length) return null;
    // never show the same item twice in a row when the pool allows
    var candidates = list;
    if (list.length > 1 && lastWinner[type]) {
      candidates = list.filter(function (it) { return it.address !== lastWinner[type].address; });
    }
    var item = candidates[Math.floor(Math.random() * candidates.length)];
    lastWinner[type] = item;
    return item;
  }

  function pickItem(type) {
    var list = pool[type];
    if (!list || !list.length) return null;
    return list[Math.floor(Math.random() * list.length)];
  }

  // Decorative tiles only — the outcome itself always uses the real odds.
  function decorType() {
    var r = Math.random();
    if (r < 0.55) return 'Epic';
    if (r < 0.9) return 'Exclusive';
    return 'Diamond';
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

  function buildStrip(landingIndex, winnerType, winner) {
    var html = '';
    for (var i = 0; i < SPIN_TILES; i++) {
      if (i === landingIndex) {
        html += tileHtml(winner, winnerType);
        continue;
      }
      var type = decorType();
      html += tileHtml(pickItem(type), type);
    }
    strip.innerHTML = html;
    // Reset instantly (no transition): otherwise the next spin would start
    // from the previous target position and look like it never spins again.
    strip.style.transition = 'none';
    strip.style.transform = 'translate3d(0,0,0)';
    void strip.offsetWidth; // commit the reset before the next transition starts
  }

  function setStripOffset(offsetPx, durationMs) {
    strip.style.transition = 'transform ' + durationMs + 'ms cubic-bezier(0.12, 0.8, 0.15, 1)';
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

  function updateShare(type, item) {
    if (!shareBtn) return;
    var r = type === 'Diamond' ? 'Diamond — the Dickpaper' : (item ? item.name : type);
    var text = t('rlt-share-text', 'I spun the ХЧК roulette: {r} — try your luck!').replace('{r}', r);
    shareBtn.href = 'https://t.me/share/url?url=' + encodeURIComponent('https://thewayofdhd.github.io/') +
      '&text=' + encodeURIComponent(text);
    shareBtn.style.display = '';
  }

  function renderResult(type, item) {
    if (!resultEl) return;
    var label;
    if (type === 'Diamond') {
      label = t('rlt-hit-diamond', 'Jackpot: Diamond — the Dickpaper itself!');
      resultEl.innerHTML = label + ' <a href="dickpaper.html">' + escapeHtml(t('nav-dickpaper', 'Dickpaper')) + ' \u2192</a>';
      resultEl.className = 'rlt-result is-diamond';
      updateShare(type, null);
      return;
    }
    if (!item) {
      resultEl.textContent = type;
      resultEl.className = 'rlt-result';
      updateShare(type, null);
      return;
    }
    label = type === 'Exclusive'
      ? t('rlt-hit-exclusive', 'Rare hit')
      : t('rlt-hit-epic', 'Epic');
    resultEl.className = 'rlt-result is-' + type.toLowerCase();
    resultEl.innerHTML = label + ': ' + escapeHtml(item.name) +
      ' \u00b7 <a href="' + GETGEMS_ITEM + escapeHtml(item.address) + '" target="_blank" rel="noopener noreferrer">Getgems \u2192</a>';
    updateShare(type, item);
  }

  function spin() {
    if (spinning) return;
    spinning = true;
    spinBtn.disabled = true;
    if (resultEl) { resultEl.textContent = '…'; resultEl.className = 'rlt-result'; }

    var outcome = pickWeighted();
    var winner = pickWinner(outcome);

    // Vary the stop position so consecutive spins do not look identical.
    var landingIndex = SPIN_TILES - VISIBLE - 1 - Math.floor(Math.random() * 6);
    buildStrip(landingIndex, outcome, winner);

    var spinMs = Math.floor(MIN_SPIN_MS + Math.random() * (MAX_SPIN_MS - MIN_SPIN_MS));
    var offset = landingIndex * TILE + TILE / 2 - windowEl.clientWidth / 2;
    // Small random jitter so identical outcomes do not look identical,
    // but keep the pointer clearly inside the winning tile.
    offset += (Math.random() * 0.36 - 0.18) * TILE;
    requestAnimationFrame(function () {
      setStripOffset(offset, spinMs);
    });

    setTimeout(function () {
      counts[outcome] += 1;
      total += 1;
      renderResult(outcome, winner);
      renderStats();
      spinning = false;
      spinBtn.disabled = false;
    }, spinMs + 120);
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
