/* ============================================
   The Way of DHD — game-preview.js
   Static pixel scene on the homepage teaser.
   ============================================ */

(function () {
  'use strict';

  function draw() {
    var canvas = document.getElementById('game-preview');
    if (!canvas || !window.DHDSprites || !window.DHDSprites.day) return;
    var ctx = canvas.getContext('2d');
    var S = window.DHDSprites.day;

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#f4f4f2';
    ctx.fillRect(0, 0, 480, 150);

    // clouds
    ctx.globalAlpha = 0.5;
    ctx.drawImage(S.cloud, 110, 28, 32, 10);
    ctx.drawImage(S.cloud, 250, 52, 32, 10);
    ctx.drawImage(S.cloud, 380, 20, 32, 10);
    ctx.globalAlpha = 1;

    // ground
    ctx.fillStyle = '#1b1d22';
    ctx.fillRect(0, 132, 480, 3);
    ctx.fillRect(210, 135, 60, 12); // pit
    for (var sx = 0; sx < 50; sx += 8) {
      ctx.fillRect(214 + sx, 141, 3, 4);
      ctx.fillRect(217 + sx, 145, 3, 3);
    }

    // obstacles / pickups
    ctx.fillStyle = '#1b1d22';
    ctx.fillRect(280, 104, 3, 28); // post
    ctx.drawImage(S.cactus, 396, 104, 16, 28);
    ctx.drawImage(S.ton, 196, 96, 20, 16);

    // player
    ctx.drawImage(S.hchkGame, 44, 132 - 71);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', draw);
  } else {
    draw();
  }
  window.addEventListener('dhd-langchange', draw);
})();
