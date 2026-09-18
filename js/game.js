/* ============================================
   The Way of DHD — game.js
   DHD Pixel Runner (Chrome-Dino style):
   horizontal canvas runner. Player sprite =
   the ХЧК 32x71 matrix, menu screens use the
   detailed 64x142 version. Sprites: sprites.js.
   ============================================ */

(function () {
  'use strict';

  var W = 480;
  var H = 150;
  var GROUND_Y = 132;
  var PLAYER_X = 44;
  var PLAYER_W = 32;
  var PLAYER_H = 71;
  var GRAVITY = 880;
  var JUMP_VY = -300;
  var SPEED_START = 130;
  var SPEED_MAX = 300;
  var BEST_KEY = 'dhd-runner-best';

  var canvas = document.getElementById('game-canvas');
  var scoreEl = document.getElementById('game-score');
  var tonEl = document.getElementById('game-ton');
  var heartsEl = document.getElementById('game-hearts');
  var statusEl = document.getElementById('game-status');
  var shareBtn = document.getElementById('game-share');

  if (!canvas || !canvas.getContext || !window.DHDSprites) return;
  var ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  var S = window.DHDSprites.baked;

  function t(key, fallback) {
    return typeof window.dhdT === 'function' ? window.dhdT(key) : fallback;
  }

  var state = 'menu'; // menu | run | over
  var playerY = 0;
  var vy = 0;
  var speed = SPEED_START;
  var dist = 0;
  var score = 0;
  var tons = 0;
  var hearts = 3;
  var invulnUntil = 0;
  var obstacles = [];
  var clouds = [];
  var nextSpawnDist = 300;
  var best = 0;
  var lastTs = 0;
  var raf = null;
  var frames = 0;

  try { best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch (e) {}

  function pad(n) { return String(Math.max(0, Math.min(999999, Math.floor(n)))).padStart(6, '0'); }
  function pad4(n) { return String(Math.max(0, Math.min(9999, Math.floor(n)))).padStart(4, '0'); }

  function renderHud() {
    if (scoreEl) scoreEl.textContent = 'SCORE ' + pad(score);
    if (tonEl) tonEl.textContent = 'TON ' + pad4(tons);
    if (heartsEl) {
      var h = '';
      for (var i = 0; i < 3; i++) h += i < hearts ? '\u2665' : '\u2661';
      heartsEl.textContent = h;
    }
  }

  function reset() {
    playerY = 0; vy = 0; speed = SPEED_START; dist = 0; score = 0; tons = 0;
    hearts = 3; invulnUntil = 0; obstacles = []; nextSpawnDist = 360;
    clouds = [{ x: 130, y: 30 }, { x: 270, y: 52 }, { x: 400, y: 22 }];
  }

  /* ---------- obstacles ---------- */
  function spawn() {
    var types = ['scam', 'cactus', 'fomo', 'airdrop', 'pit', 'ton', 'ton'];
    var type = types[Math.floor(Math.random() * types.length)];
    var ob = { type: type, x: W + 20 };
    if (type === 'scam') { ob.w = 46; ob.h = 46; ob.y = GROUND_Y - 46; }
    if (type === 'cactus') { ob.w = 16; ob.h = 28; ob.y = GROUND_Y - 28; }
    if (type === 'fomo') { ob.w = 24; ob.h = 28; ob.y = GROUND_Y - 28; }
    if (type === 'airdrop') { ob.w = 24; ob.h = 20; ob.y = GROUND_Y - 112; }
    if (type === 'pit') { ob.w = 64; ob.h = 10; ob.y = GROUND_Y; }
    if (type === 'ton') { ob.w = 20; ob.h = 16; ob.y = GROUND_Y - (Math.random() < 0.5 ? 22 : 104); }
    obstacles.push(ob);
  }

  function maybeSpawn() {
    if (dist >= nextSpawnDist) {
      spawn();
      nextSpawnDist = dist + speed * 0.85 + 90 + Math.random() * 200;
    }
  }

  function playerBox() {
    return { x: PLAYER_X + 7, y: GROUND_Y - PLAYER_H + 6 - playerY, w: 18, h: PLAYER_H - 6 };
  }

  function hitTest(ob) {
    var p = playerBox();
    if (ob.type === 'pit') {
      if (playerY > 1) return false;
      return p.x + p.w > ob.x + 6 && p.x < ob.x + ob.w - 6;
    }
    return p.x < ob.x + ob.w && p.x + p.w > ob.x &&
      p.y < ob.y + ob.h && p.y + p.h > ob.y;
  }

  /* ---------- drawing ---------- */
  function drawBoard(x, y, w, h, text) {
    ctx.fillStyle = S ? '#ffffff' : '#fff';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#1b1d22';
    ctx.fillRect(x, y, w, 2); ctx.fillRect(x, y + h - 2, w, 2);
    ctx.fillRect(x, y, 2, h); ctx.fillRect(x + w - 2, y, 2, h);
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(text, x + w / 2, y + h / 2 + 4);
  }

  function render(now) {
    ctx.fillStyle = '#f4f4f2';
    ctx.fillRect(0, 0, W, H);

    clouds.forEach(function (c) {
      ctx.globalAlpha = 0.5;
      ctx.drawImage(S.cloud, Math.round(c.x), c.y, 32, 10);
      ctx.globalAlpha = 1;
    });

    // ground, carving out pits
    var pits = obstacles.filter(function (o) { return o.type === 'pit'; });
    var segs = [[0, W]];
    pits.forEach(function (p) {
      segs = segs.map(function (s) {
        if (p.x + p.w < s[0] || p.x > s[1]) return [s];
        var out = [];
        if (p.x > s[0]) out.push([s[0], p.x]);
        if (p.x + p.w < s[1]) out.push([p.x + p.w, s[1]]);
        return out;
      }).reduce(function (a, b) { return a.concat(b); }, []);
    });
    ctx.fillStyle = '#1b1d22';
    segs.forEach(function (s) { ctx.fillRect(s[0], GROUND_Y, s[1] - s[0], 3); });

    obstacles.forEach(function (o) {
      if (o.type === 'scam') {
        // one post from the board all the way down to the ground
        ctx.fillStyle = '#1b1d22';
        ctx.fillRect(Math.round(o.x) + o.w / 2 - 3, o.y + 14, 6, GROUND_Y - (o.y + 14));
        drawBoard(Math.round(o.x), o.y, o.w, 14, 'SCAM');
      } else if (o.type === 'cactus') {
        ctx.drawImage(S.cactus, Math.round(o.x), o.y, o.w, o.h);
      } else if (o.type === 'fomo') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.round(o.x), o.y, o.w, o.h);
        ctx.fillStyle = '#1b1d22';
        ctx.fillRect(Math.round(o.x), o.y, o.w, 2);
        ctx.fillRect(Math.round(o.x), o.y + o.h - 2, o.w, 2);
        ctx.fillRect(Math.round(o.x) + o.w - 2, o.y, 2, o.h);
        for (var i = 1; i <= 6; i++) ctx.fillRect(Math.round(o.x) + 3, o.y + 8 + i * 3, o.w - 6, 2);
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('FOMO', Math.round(o.x) + o.w / 2, o.y + 7);
      } else if (o.type === 'airdrop') {
        ctx.drawImage(S.ghost, Math.round(o.x), o.y, o.w, o.h);
      } else if (o.type === 'pit') {
        ctx.fillStyle = '#1b1d22';
        ctx.fillRect(Math.round(o.x), GROUND_Y, o.w, H - GROUND_Y);
        for (var sx = 0; sx < o.w - 4; sx += 8) {
          ctx.fillRect(Math.round(o.x) + sx, GROUND_Y + 10, 3, 5);
          ctx.fillRect(Math.round(o.x) + sx + 3, GROUND_Y + 15, 3, 5);
        }
        drawBoard(Math.round(o.x) - 8, GROUND_Y - 20, o.w + 16, 14, 'RUG PULL');
      } else if (o.type === 'ton') {
        ctx.drawImage(S.ton, Math.round(o.x), o.y, o.w, o.h);
      }
    });

    // player with a light run bob
    var bob = (Math.floor(frames / 6) % 2 === 0) ? 0 : 1;
    var blink = now < invulnUntil && Math.floor(now / 90) % 2 === 0;
    if (!blink) {
      ctx.drawImage(S.hchkGame, PLAYER_X, GROUND_Y - PLAYER_H - playerY + bob);
    }
  }

  /* ---------- menu / game-over screens ---------- */
  function drawOverlay(kind) {
    ctx.fillStyle = '#f4f4f2';
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(S.hchkDetailed, 48, 4);
    ctx.fillStyle = '#1b1d22';
    ctx.font = '14px "Press Start 2P", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(kind === 'over' ? 'GAME OVER' : 'DHD PIXEL RUNNER', 150, 60);
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillStyle = '#55595f';
    if (kind === 'over') {
      ctx.fillText('SCORE ' + pad(score) + '   TON ' + pad4(tons), 150, 88);
      ctx.fillText('BEST  ' + pad(best), 150, 104);
    }
    ctx.fillText(t('game-menu', 'TAP / SPACE TO START'), 150, kind === 'over' ? 128 : 96);
  }

  /* ---------- loop ---------- */
  function loop(ts) {
    if (state !== 'run') return;
    var dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
    lastTs = ts;
    frames += 1;

    if (playerY > 0 || vy < 0) {
      vy += GRAVITY * dt;
      playerY -= vy * dt;
      if (playerY <= 0) { playerY = 0; vy = 0; }
    }

    speed = Math.min(SPEED_MAX, SPEED_START + dist * 0.03);
    var dx = speed * dt;
    dist += dx;
    score = Math.floor(dist / 10);

    clouds.forEach(function (c) {
      c.x -= dx * 0.25;
      if (c.x < -36) { c.x = W + 20; c.y = 18 + Math.floor(Math.random() * 45); }
    });

    obstacles.forEach(function (o) { o.x -= dx; });
    obstacles = obstacles.filter(function (o) { return o.x + o.w > -20; });
    maybeSpawn();

    var now = ts;
    for (var i = obstacles.length - 1; i >= 0; i--) {
      var ob = obstacles[i];
      if (ob.type === 'ton' && hitTest(ob)) {
        tons += 1;
        score += 25;
        obstacles.splice(i, 1);
        continue;
      }
      if (ob.type !== 'ton' && now > invulnUntil && hitTest(ob)) {
        hearts -= 1;
        invulnUntil = now + 1400;
        if (ob.type === 'pit') ob.x -= ob.w + 60;
        renderHud();
        if (hearts <= 0) { gameOver(now); return; }
      }
    }

    render(now);
    renderHud();
    raf = requestAnimationFrame(loop);
  }

  function start() {
    state = 'run';
    reset();
    if (shareBtn) shareBtn.style.display = 'none';
    if (statusEl) statusEl.textContent = t('game-status-run', 'SPACE / TAP = jump \u00b7 \u25c7 = TON \u00b7 X = scam');
    renderHud();
    lastTs = 0;
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function gameOver(now) {
    state = 'over';
    if (raf) cancelAnimationFrame(raf);
    if (score > best) {
      best = score;
      try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {}
    }
    drawOverlay('over');
    renderHud();
    if (statusEl) statusEl.textContent = t('game-status-over', 'Game over — press Space or tap to run again.');
    if (shareBtn) {
      var text = t('game-share-text', 'My DHD Pixel Runner score: {s}, {t} TON collected — beat me!')
        .replace('{s}', String(score)).replace('{t}', String(tons));
      shareBtn.href = 'https://t.me/share/url?url=' + encodeURIComponent('https://thewayofdhd.github.io/game.html') +
        '&text=' + encodeURIComponent(text);
      shareBtn.style.display = '';
    }
  }

  function jump() {
    if (state !== 'run') { start(); return; }
    if (playerY === 0) { vy = JUMP_VY; playerY = 0.01; }
  }

  /* ---------- controls ---------- */
  document.addEventListener('keydown', function (event) {
    if (!canvas) return;
    var rect = canvas.getBoundingClientRect();
    var visible = rect.top < window.innerHeight * 0.8 && rect.bottom > 80;
    if (!visible) return;
    if (event.key === ' ' || event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') {
      event.preventDefault();
      jump();
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') event.preventDefault();
  });

  canvas.addEventListener('pointerdown', function (event) {
    event.preventDefault();
    jump();
  });

  if (statusEl) {
    statusEl.addEventListener('click', function () { if (state !== 'run') start(); });
    statusEl.style.cursor = 'pointer';
  }

  /* ---------- boot ---------- */
  renderHud();
  reset();
  drawOverlay('menu');
  if (statusEl) statusEl.textContent = t('game-menu', 'TAP / SPACE TO START');

  window.addEventListener('dhd-langchange', function () {
    if (state === 'menu') drawOverlay('menu');
    if (state === 'over') drawOverlay('over');
    if (statusEl && state === 'menu') statusEl.textContent = t('game-menu', 'TAP / SPACE TO START');
  });
})();
