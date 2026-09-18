/* ============================================
   The Way of DHD — main.js
   Home page: baked on-chain snapshot + live refresh,
   rarity table, counters, nav, scroll animations
   ============================================ */

(function () {
  'use strict';

  var COLLECTION = 'EQDzvSAKspPnYIhuqZe0_dMfrEEUlwKVzb4dJo0sRoxZwRZe';
  var API_BASE = 'https://tonapi.io/v2';
  var SNAPSHOT_URL = 'data/collection-stats.json';
  var TYPE_ORDER = ['Epic', 'Exclusive', 'Diamond'];

  // --- Mobile menu ---
  var navToggle = document.querySelector('.nav-toggle');
  var navLinks = document.querySelector('.nav-links');

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function () {
      var open = navLinks.classList.toggle('active');
      navToggle.classList.toggle('active', open);
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    navLinks.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        navToggle.classList.remove('active');
        navLinks.classList.remove('active');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // --- Fade-in on scroll ---
  var fadeElements = document.querySelectorAll('.fade-in');
  if (fadeElements.length && 'IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    fadeElements.forEach(function (el) { observer.observe(el); });
  } else {
    fadeElements.forEach(function (el) { el.classList.add('visible'); });
  }

  // --- Helpers ---
  function formatTon(value) {
    if (value === null || value === undefined) return '\u2014';
    if (value >= 1000) return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
    if (value >= 1) return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
    return value.toFixed(3);
  }

  function animateCounter(element, target, duration) {
    if (!element || typeof target !== 'number' || !isFinite(target)) return;
    duration = duration || 1200;
    var startTime = null;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = Math.floor(eased * target).toLocaleString('en-US');
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        element.textContent = target.toLocaleString('en-US');
      }
    }
    requestAnimationFrame(step);
  }

  function renderTypes(types) {
    var tbody = document.getElementById('rarity-rows');
    if (!tbody || !types) return;

    var html = TYPE_ORDER.filter(function (key) { return types[key]; }).map(function (key) {
      var t = types[key];
      return '<tr>' +
        '<td><span class="type-chip type-' + key.toLowerCase() + '">' + key + '</span></td>' +
        '<td>' + t.count + '</td>' +
        '<td>' + (typeof t.share === 'number' ? t.share.toFixed(2) : '') + '%</td>' +
        '<td>' + (t.listed || 0) + '</td>' +
        '<td>' + (typeof t.floor === 'number' ? formatTon(t.floor) : '\u2014') + '</td>' +
        '</tr>';
    }).join('');

    if (html) tbody.innerHTML = html;
  }

  function stamp(text) {
    var el = document.getElementById('stats-stamp');
    if (el) el.textContent = text ? ' \u00b7 ' + text : '';
  }

  function applySnapshot(data) {
    if (!data) return;
    animateCounter(document.getElementById('stat-total'), data.totalSupply || 1022);
    animateCounter(document.getElementById('stat-owners'), data.ownersOnChain || 0);
    animateCounter(document.getElementById('stat-listed'), data.listedCount || 0);

    var floorEl = document.getElementById('stat-floor');
    if (floorEl && typeof data.floorPrice === 'number') {
      floorEl.textContent = formatTon(data.floorPrice);
    }
    renderTypes(data.types);

    if (data.generatedAt) {
      var d = new Date(data.generatedAt);
      stamp('snapshot ' + (isNaN(d.getTime()) ? data.generatedAt : d.toISOString().slice(0, 10)));
    }
  }

  async function loadSnapshot() {
    try {
      var resp = await fetch(SNAPSHOT_URL, { cache: 'no-store' });
      if (!resp.ok) throw new Error('snapshot ' + resp.status);
      applySnapshot(await resp.json());
    } catch (err) {
      console.warn('Snapshot unavailable:', err.message);
    }
  }

  // --- Live refresh: the collection endpoint is light and always current ---
  async function refreshLive() {
    try {
      var resp = await fetch(API_BASE + '/nfts/collections/' + COLLECTION, {
        headers: { 'Accept': 'application/json' }
      });
      if (!resp.ok) throw new Error('API ' + resp.status);
      var data = await resp.json();

      var totalEl = document.getElementById('stat-total');
      if (totalEl && data.items_count) animateCounter(totalEl, data.items_count, 600);

      var ownersEl = document.getElementById('stat-owners');
      if (ownersEl && data.owners_count) animateCounter(ownersEl, data.owners_count, 600);

      var collectionMeta = document.getElementById('collection-meta');
      if (collectionMeta && data.items_count) {
        collectionMeta.textContent = data.items_count + ' items on-chain \u00b7 ' +
          (data.owners_count || 0) + ' owners \u00b7 verified collection';
      }
    } catch (err) {
      console.warn('Live stats unavailable:', err.message);
    }
  }

  // --- $DHD token price (same public TON API, no keys) ---
  var JETTON = 'EQBCFwW8uFUh-amdRmNY9NyeDEaeDYXd9ggJGsicpqVcHq7B';

  function fmtPrice(value) {
    return Number(value.toPrecision(3)).toString();
  }

  function fmtChange(raw) {
    // tonapi returns e.g. "−3.38%" with a unicode minus — normalize it
    var n = parseFloat(String(raw).replace(/\u2212|\u2013/g, '-'));
    return isFinite(n) ? n : null;
  }

  async function refreshTokenPrice() {
    var priceEl = document.getElementById('token-price');
    var changeEl = document.getElementById('token-change');
    if (!priceEl && !changeEl) return;
    try {
      var resp = await fetch(API_BASE + '/rates?tokens=' + JETTON + '&currencies=ton,usd', {
        headers: { 'Accept': 'application/json' }
      });
      if (!resp.ok) throw new Error('rates ' + resp.status);
      var data = await resp.json();
      var rates = (data.rates || {})[JETTON] || {};
      var usd = (rates.prices || {}).USD;
      var ton = (rates.prices || {}).TON;
      if (priceEl) {
        if (typeof usd === 'number' && typeof ton === 'number') {
          priceEl.textContent = '$' + fmtPrice(usd) + ' \u00b7 ' + fmtPrice(ton) + ' TON';
        } else {
          priceEl.textContent = '\u2014';
        }
      }
      if (changeEl) {
        var ch = rates.diff_24h ? fmtChange(rates.diff_24h.USD || rates.diff_24h.TON) : null;
        if (ch === null) {
          changeEl.textContent = '\u2014';
        } else {
          changeEl.textContent = (ch >= 0 ? '+' : '\u2212') + Math.abs(ch).toFixed(2) + '%';
          changeEl.classList.add(ch >= 0 ? 'is-up' : 'is-down');
        }
      }
    } catch (err) {
      console.warn('Token price unavailable:', err.message);
    }
  }

  // --- init ---
  loadSnapshot().then(refreshLive);
  refreshTokenPrice();
})();
