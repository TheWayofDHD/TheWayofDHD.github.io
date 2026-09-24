/* ============================================
   The Way of DHD — collection.js
   Items from TON API (100/pages), type filters,
   ask prices from the sale field, pagination
   ============================================ */

(function () {
  'use strict';

  var COLLECTION = 'EQDzvSAKspPnYIhuqZe0_dMfrEEUlwKVzb4dJo0sRoxZwRZe';
  var API_BASE = 'https://tonapi.io/v2';
  var SNAPSHOT_URL = 'data/collection-stats.json';
  var GETGEMS_ITEM = 'https://getgems.io/nft/';
  var PAGE_SIZE = 50;
  var TOKEN_DECIMALS = 9;

  var state = { page: 0, filter: 'all', saleOnly: false, items: [], total: 1022 };

  var grid = document.getElementById('nft-grid');
  var filterBar = document.getElementById('filter-bar');
  var saleCheckbox = document.getElementById('filter-sale');
  var prevBtn = document.getElementById('prev-btn');
  var nextBtn = document.getElementById('next-btn');
  var pageInfo = document.getElementById('page-info');
  var loadingEl = document.getElementById('loading');
  var metaEl = document.getElementById('collection-meta');

  // --- Helpers ---
  function t(key, fallback) {
    return typeof window.dhdT === 'function' ? window.dhdT(key) : fallback;
  }

  function getType(item) {
    var meta = item.metadata || {};
    var attrs = meta.attributes || item.attributes || [];
    for (var i = 0; i < attrs.length; i++) {
      var name = String(attrs[i].trait_type || '').toLowerCase();
      if (name === 'type') {
        var value = String(attrs[i].value || '').trim();
        if (value) return value;
      }
    }
    var itemName = String(meta.name || item.name || '').toLowerCase();
    if (itemName.indexOf('dickpaper') !== -1) return 'Diamond';
    return 'Epic';
  }

  function getPrice(item) {
    var sale = item.sale;
    if (!sale || !sale.price) return null;
    var value = parseFloat(sale.price.value);
    if (!isFinite(value) || value <= 0) return null;
    var decimals = parseInt(sale.price.decimals, 10);
    if (!isFinite(decimals)) decimals = TOKEN_DECIMALS;
    return value / Math.pow(10, decimals);
  }

  function formatTon(price) {
    if (price === null) return '';
    if (price >= 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 0 });
    if (price >= 1) return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
    return price.toFixed(3);
  }

  function getImageUrl(item) {
    // The Diamond item (Dickpaper): TON API previews and IPFS gateways fail
    // or stall on the full-resolution source, so we serve a local JPEG.
    if (getType(item) === 'Diamond') return 'assets/dickpaper.jpg';
    var previews = item.previews || [];
    if (previews.length) return previews[previews.length - 1].url || '';
    var image = item.metadata && item.metadata.image;
    if (image && image.indexOf('ipfs://') === 0) {
      return 'https://ipfs.io/ipfs/' + image.slice(7);
    }
    return image || (item.image && item.image.url) || '';
  }

  function getTraits(item) {
    var meta = item.metadata || {};
    var attrs = meta.attributes || item.attributes || [];
    var out = [];
    for (var i = 0; i < attrs.length && out.length < 3; i++) {
      var type = attrs[i].trait_type;
      var value = attrs[i].value;
      if (type && value) out.push(type + ': ' + value);
    }
    return out;
  }

  function escapeHtml(str) {
    return String(str === null || str === undefined ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // --- Address helpers: TON API returns "workchain:hex", links need base64url ---
  var B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

  function crc16(bytes) {
    var crc = 0;
    for (var i = 0; i < bytes.length; i++) {
      crc ^= bytes[i] << 8;
      for (var bit = 0; bit < 8; bit++) {
        crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
      }
    }
    return crc;
  }

  function base64url(bytes) {
    var out = '';
    for (var i = 0; i < bytes.length; i += 3) {
      var b0 = bytes[i];
      var b1 = bytes[i + 1];
      var b2 = bytes[i + 2];
      out += B64_CHARS[b0 >> 2];
      out += B64_CHARS[((b0 & 3) << 4) | ((b1 === undefined ? 0 : b1) >> 4)];
      if (b1 === undefined) break;
      out += B64_CHARS[((b1 & 15) << 2) | ((b2 === undefined ? 0 : b2) >> 6)];
      if (b2 === undefined) break;
      out += B64_CHARS[b2 & 63];
    }
    return out;
  }

  function toFriendlyAddress(raw) {
    if (!raw || raw.indexOf(':') === -1) return raw || '';
    var parts = raw.split(':');
    var workchain = parseInt(parts[0], 10);
    var hashHex = parts[1] || '';
    if (!isFinite(workchain) || hashHex.length !== 64) return raw;
    var bytes = [0x11, workchain & 0xff];
    for (var i = 0; i < 32; i++) {
      bytes.push(parseInt(hashHex.substr(i * 2, 2), 16));
    }
    var crc = crc16(bytes);
    bytes.push((crc >> 8) & 0xff, crc & 0xff);
    return base64url(bytes);
  }

  // --- Card ---
  function renderCard(item) {
    var type = getType(item);
    var typeKey = type.toLowerCase();
    var meta = item.metadata || {};
    var name = meta.name || item.name || ('DHD #' + (item.index === undefined ? '' : item.index));
    var imageUrl = getImageUrl(item);
    var price = getPrice(item);
    var address = toFriendlyAddress(item.address);
    var traits = getTraits(item);

    var priceHtml = price === null
      ? '<p class="nft-price is-off" data-i18n="card-not-listed">' + escapeHtml(t('card-not-listed', 'Not listed')) + '</p>'
      : '<p class="nft-price">' + escapeHtml(formatTon(price)) + ' TON</p>';

    var traitsHtml = traits.map(function (trait) {
      return '<span class="nft-trait">' + escapeHtml(trait) + '</span>';
    }).join('');

    var alt = escapeHtml(name + ' — ' + type + ' NFT of The Way of DHD collection on TON');

    return '<article class="nft-card" data-type="' + escapeHtml(typeKey) + '">' +
      '<div class="nft-image-wrap">' +
        '<img class="nft-image" src="' + escapeHtml(imageUrl) + '" alt="' + alt + '" loading="lazy" width="400" height="400" data-fallback="assets/dickpaper-thumb.jpg">' +
        '<span class="nft-rarity ' + escapeHtml(typeKey) + '">' + escapeHtml(type) + '</span>' +
      '</div>' +
      '<div class="nft-info">' +
        '<h3 class="nft-name">' + escapeHtml(name) + '</h3>' +
        priceHtml +
        '<div class="nft-traits">' + traitsHtml + '</div>' +
        '<a class="nft-link" href="' + GETGEMS_ITEM + escapeHtml(address) + '" target="_blank" rel="noopener noreferrer">' +
          escapeHtml(t('view-getgems', 'View on Getgems \u2192')) +
        '</a>' +
      '</div>' +
    '</article>';
  }

  function visibleItems() {
    return state.items.filter(function (item) {
      var typeMatch = state.filter === 'all' || getType(item).toLowerCase() === state.filter;
      var saleMatch = !state.saleOnly || getPrice(item) !== null;
      return typeMatch && saleMatch;
    });
  }

  function renderGrid() {
    if (!grid) return;
    var items = visibleItems();

    if (!items.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;">' +
        '<h3>' + escapeHtml(t('empty-title', 'No NFTs found')) + '</h3>' +
        '<p>' + escapeHtml(t('empty-text', 'Try a different filter or check back later.')) + '</p>' +
        '</div>';
      return;
    }

    grid.innerHTML = items.map(renderCard).join('');

    // If a remote preview dies, swap in a tiny local placeholder.
    grid.querySelectorAll('img[data-fallback]').forEach(function (img) {
      img.addEventListener('error', function () {
        if (img.dataset.fallback) {
          img.src = img.dataset.fallback;
          delete img.dataset.fallback;
        }
      });
    });
  }

  // --- Pagination ---
  function updatePagination() {
    var total = state.total || 0;
    if (pageInfo) {
      var from = state.page * PAGE_SIZE + 1;
      var to = Math.min((state.page + 1) * PAGE_SIZE, total);
      pageInfo.textContent = from + '-' + to + ' / ' + total;
    }
    if (prevBtn) prevBtn.disabled = state.page === 0;
    if (nextBtn) nextBtn.disabled = (state.page + 1) * PAGE_SIZE >= total;
  }

  // --- Fetch ---
  async function fetchNFTs(offset, limit) {
    var url = API_BASE + '/nfts/collections/' + COLLECTION + '/items?limit=' + limit + '&offset=' + offset;
    try {
      var resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!resp.ok) throw new Error('API ' + resp.status);
      var data = await resp.json();
      return data.nft_items || [];
    } catch (err) {
      console.error('Failed to fetch NFTs:', err);
      return [];
    }
  }

  async function goToPage(page) {
    state.page = Math.max(0, page);
    if (loadingEl) loadingEl.style.display = 'block';
    if (grid) grid.innerHTML = '';

    var items = await fetchNFTs(state.page * PAGE_SIZE, PAGE_SIZE);
    state.items = items;
    if (items.length) state.total = Math.max(state.total, state.page * PAGE_SIZE + items.length);

    // A type filter can hide every item of the current window (e.g. the 21
    // Exclusive items live at the very end of the collection). Keep fetching
    // forward — with large strides to respect the API rate limit — until at
    // least one matching item shows up.
    var nextOffset = state.page * PAGE_SIZE + state.items.length;
    var guard = 0;
    while (state.filter !== 'all' && visibleItems().length === 0 &&
           nextOffset < state.total && guard < 3) {
      guard++;
      var more = await fetchNFTs(nextOffset, 1000);
      if (!more.length) {
        // one soft retry: the anonymous API tier occasionally throttles
        await new Promise(function (resolve) { setTimeout(resolve, 900); });
        more = await fetchNFTs(nextOffset, 1000);
      }
      if (!more.length) break;
      nextOffset += more.length;
      state.items = state.items.concat(more);
      state.total = Math.max(state.total, nextOffset);
    }

    if (loadingEl) loadingEl.style.display = 'none';
    renderGrid();
    updatePagination();
  }

  // --- Filters ---
  function initFilters() {
    if (filterBar) {
      // Deep link from the Exclusive carousel: collection.html?filter=exclusive
      var fromQuery = /[?&]filter=([a-z]+)/.exec(window.location.search || '');
      var wanted = fromQuery ? fromQuery[1] : '';
      filterBar.querySelectorAll('.filter-btn').forEach(function (btn) {
        var isTarget = btn.getAttribute('data-filter') === wanted;
        btn.classList.toggle('active', isTarget || (btn.classList.contains('active') && !wanted));
        if (isTarget) state.filter = wanted;
        btn.addEventListener('click', function () {
          filterBar.querySelectorAll('.filter-btn').forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
          state.filter = btn.getAttribute('data-filter') || 'all';
          goToPage(state.page);
        });
      });
    }
    if (saleCheckbox) {
      saleCheckbox.addEventListener('change', function () {
        state.saleOnly = saleCheckbox.checked;
        goToPage(state.page);
      });
    }
  }

  // --- Snapshot: stable totals + per-type counters ---
  async function loadSnapshot() {
    try {
      var resp = await fetch(SNAPSHOT_URL, { cache: 'no-store' });
      if (!resp.ok) throw new Error('snapshot ' + resp.status);
      var data = await resp.json();
      if (data.totalSupply) state.total = data.totalSupply;
      updatePagination();
    } catch (err) {
      console.warn('Snapshot unavailable:', err.message);
    }
  }

  // --- Re-render on language change ---
  window.addEventListener('dhd-langchange', function () {
    renderGrid();
    updatePagination();
  });

  // --- init ---
  initFilters();
  loadSnapshot().then(function () { return goToPage(0); });

  if (prevBtn) {
    prevBtn.addEventListener('click', function () {
      if (state.page > 0) goToPage(state.page - 1);
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', function () {
      goToPage(state.page + 1);
    });
  }

})();