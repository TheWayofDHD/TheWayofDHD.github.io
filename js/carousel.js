/* ============================================
   The Way of DHD — carousel.js
   Exclusive 21 strip on the home page.
   Mouse drag / touch / arrows / keyboard.
   ============================================ */

(function () {
  'use strict';

  var DATA_URL = 'data/exclusive21.json';
  var GETGEMS_ITEM = 'https://getgems.io/nft/';

  var track = document.getElementById('exq-track');
  var prevBtn = document.getElementById('exq-prev');
  var nextBtn = document.getElementById('exq-next');

  if (!track) return;

  function escapeHtml(str) {
    return String(str === null || str === undefined ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function render(items) {
    var html = items.map(function (item) {
      var alt = escapeHtml(item.name + ' — Exclusive NFT of The Way of DHD collection on TON');
      return '<a class="exq-card" href="' + GETGEMS_ITEM + escapeHtml(item.address) + '" target="_blank" rel="noopener noreferrer">' +
        '<span class="exq-media"><img src="' + escapeHtml(item.image) + '" alt="' + alt + '" loading="lazy" decoding="async" width="200" height="200"></span>' +
        '<span class="exq-name">' + escapeHtml(item.name) + '</span>' +
        '<span class="exq-type">Exclusive</span>' +
      '</a>';
    }).join('');
    track.innerHTML = html;

    track.querySelectorAll('img').forEach(function (img) {
      img.addEventListener('error', function () {
        var card = img.closest('.exq-card');
        if (card) card.classList.add('is-broken');
      });
    });
  }

  function updateArrows() {
    if (!prevBtn || !nextBtn) return;
    var max = track.scrollWidth - track.clientWidth;
    prevBtn.disabled = track.scrollLeft <= 4;
    nextBtn.disabled = track.scrollLeft >= max - 4;
  }

  function scrollByCard(direction) {
    var card = track.querySelector('.exq-card');
    var step = card ? card.getBoundingClientRect().width + 14 : 240;
    track.scrollBy({ left: direction * step * 2, behavior: 'smooth' });
  }

  if (prevBtn) prevBtn.addEventListener('click', function () { scrollByCard(-1); });
  if (nextBtn) nextBtn.addEventListener('click', function () { scrollByCard(1); });
  track.addEventListener('scroll', updateArrows, { passive: true });
  window.addEventListener('resize', updateArrows);

  track.addEventListener('keydown', function (event) {
    if (event.key === 'ArrowLeft') { event.preventDefault(); scrollByCard(-1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); scrollByCard(1); }
  });

  // --- Drag to scroll (mouse + touch via pointer events) ---
  var dragging = false;
  var moved = false;
  var startX = 0;
  var startScroll = 0;

  track.addEventListener('pointerdown', function (event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    dragging = true;
    moved = false;
    startX = event.clientX;
    startScroll = track.scrollLeft;
  });

  track.addEventListener('pointermove', function (event) {
    if (!dragging) return;
    var dx = event.clientX - startX;
    if (Math.abs(dx) > 5) {
      moved = true;
      track.classList.add('is-dragging');
    }
    if (moved) track.scrollLeft = startScroll - dx;
  });

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    track.classList.remove('is-dragging');
  }

  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);
  track.addEventListener('pointerleave', endDrag);

  // A drag should not trigger the card link underneath.
  track.addEventListener('click', function (event) {
    if (moved) {
      event.preventDefault();
      moved = false;
    }
  }, true);

  fetch(DATA_URL, { cache: 'no-store' })
    .then(function (resp) {
      if (!resp.ok) throw new Error('carousel ' + resp.status);
      return resp.json();
    })
    .then(function (data) {
      render(data.items || []);
      requestAnimationFrame(updateArrows);
    })
    .catch(function (err) {
      console.warn('Exclusive carousel unavailable:', err.message);
      var before = typeof window.dhdT === 'function' ? window.dhdT('exq-fallback-a') : 'Exclusive 21 — see the full';
      var after = typeof window.dhdT === 'function' ? window.dhdT('exq-fallback-b') : 'collection';
      track.innerHTML = '<p class="exq-fallback">' + before +
        ' <a href="collection.html?filter=exclusive">' + after + '</a>.</p>';
    });
})();
