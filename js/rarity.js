/* ============================================
   The Way of DHD — rarity.js
   Rarity explorer: trait groups from
   data/traits.json, rarest-first rows,
   live search filter.
   ============================================ */

(function () {
  'use strict';

  var DATA_URL = 'data/traits.json';

  var wrap = document.getElementById('rarity-sections');
  var search = document.getElementById('rarity-search');
  var countEl = document.getElementById('rarity-count');

  if (!wrap) return;

  var data = null;
  var query = '';

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

  function typeChipClass(value) {
    var key = String(value).toLowerCase();
    return key === 'epic' || key === 'exclusive' || key === 'diamond' ? ' type-' + key : '';
  }

  function render() {
    if (!data) return;
    var q = query.trim().toLowerCase();
    var shownValues = 0;
    var totalValues = 0;
    var html = '';

    data.traitOrder.forEach(function (traitName) {
      var group = data.traits[traitName];
      if (!group) return;
      var maxCount = 1;
      var rows = '';
      var shownInGroup = 0;

      // rarest first; ties sorted alphabetically
      var values = group.values.slice().sort(function (a, b) {
        return a.count - b.count || a.value.localeCompare(b.value);
      });
      values.forEach(function (v) { if (v.count > maxCount) maxCount = v.count; });

      values.forEach(function (v) {
        totalValues += 1;
        var match = !q || v.value.toLowerCase().indexOf(q) !== -1 || traitName.toLowerCase().indexOf(q) !== -1;
        if (!match) return;
        shownValues += 1;
        shownInGroup += 1;
        var width = Math.max(2, Math.round(v.count / maxCount * 100));
        var isRare = v.count <= 5;
        var valueHtml = traitName === 'Type'
          ? '<span class="type-chip' + typeChipClass(v.value) + '">' + escapeHtml(v.value) + '</span>'
          : escapeHtml(v.value);
        rows += '<div class="trait-row' + (isRare ? ' is-rare' : '') + '">' +
          '<span class="trait-value">' + valueHtml + '</span>' +
          '<span class="trait-bar"><span class="trait-bar-fill" style="width:' + width + '%"></span></span>' +
          '<span class="trait-num">' + v.count + ' \u00b7 ' + v.share.toFixed(2) + '%</span>' +
        '</div>';
      });

      if (shownInGroup === 0 && q) return;
      html += '<section class="trait-group" data-trait="' + escapeHtml(traitName) + '">' +
        '<h3 class="trait-group-title">' + escapeHtml(traitName) +
        ' <span class="trait-group-count">' + group.count + ' ' + escapeHtml(t('rarity-counted', 'counted')) + '</span></h3>' +
        '<div class="trait-rows">' + rows + '</div>' +
      '</section>';
    });

    wrap.innerHTML = html;
    if (countEl) {
      countEl.textContent = shownValues + ' / ' + totalValues + ' ' + t('rarity-values-shown', 'values shown');
    }
  }

  if (search) {
    search.addEventListener('input', function () {
      query = search.value;
      render();
    });
  }

  window.addEventListener('dhd-langchange', render);

  fetch(DATA_URL, { cache: 'no-store' })
    .then(function (resp) {
      if (!resp.ok) throw new Error('traits ' + resp.status);
      return resp.json();
    })
    .then(function (json) {
      data = json;
      render();
    })
    .catch(function (err) {
      console.warn('Rarity data unavailable:', err.message);
      wrap.innerHTML = '<p class="empty-state">' +
        escapeHtml(t('rarity-error', 'Rarity data could not be loaded. Refresh the page to retry.')) +
        '</p>';
    });
})();
