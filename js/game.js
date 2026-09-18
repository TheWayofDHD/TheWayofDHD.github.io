/* ============================================
   The Way of DHD — game.js
   DHD Pixel Runner (Chrome-Dino style):
   horizontal canvas runner, pixel sprites
   defined in code, hearts, TON counter,
   localStorage best, share button.
   ============================================ */

(function () {
  'use strict';

  var W = 320;          // logical canvas width (1px = 1 sprite px)
  var H = 100;
  var GROUND_Y = 88;    // top of the ground line
  var PLAYER_X = 26;
  var PLAYER_W = 14;
  var PLAYER_H = 18;
  var GRAVITY = 560;    // px / s^2
  var JUMP_VY = -200;   // px / s
  var SPEED_START = 92; // px / s
  var SPEED_MAX = 250;
  var BEST_KEY = 'dhd-runner-best';

  var canvas = document.getElementById('game-canvas');
  var scoreEl = document.getElementById('game-score');
  var tonEl = document.getElementById('game-ton');
  var heartsEl = document.getElementById('game-hearts');
  var statusEl = document.getElementById('game-status');
  var shareBtn = document.getElementById('game-share');

  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');

  function t(key, fallback) {
    return typeof window.dhdT === 'function' ? window.dhdT(key) : fallback;
  }

  /* ---------- palette ---------- */
  var P = {
    k: '#1b1d22',
    r: '#e04848',
    y: '#f2dfb4',
    w: '#ffffff',
    b: '#3aa9e0',
    g: '#b9bec4',
    d: '#55595f'
  };

  /* ---------- sprites (pixel maps, '.' = transparent) ---------- */
  var SPRITES = {
    // DHD runner, two stride frames
    dhdA: {
      c: 16,
      rows: [
        '.....kkkkkk.....',
        '....kkkkkkkk....',
        '....kkkkkkkk....',
        '...yyyyyyyy.....',
        '...ykkyykky.....',
        '...yyyyyyyy.....',
        '....yyyyyy......',
        '..kkkkkkkkkk....',
        '..kkywwwwykk....',
        '..kkywkkwykk....',
        '..kkkkkkkkkk....',
        '..krrrrrrrrk....',
        '..kkkkkkkkkk....',
        '...kkkk.kkkk....',
        '...kkk...kkk....',
        '...kkk...kkk....',
        '..rrrr...rrrr...',
        '..rrrr...rrrr...'
      ]
    },
    dhdB: {
      c: 16,
      rows: [
        '.....kkkkkk.....',
        '....kkkkkkkk....',
        '....kkkkkkkk....',
        '...yyyyyyyy.....',
        '...ykkyykky.....',
        '...yyyyyyyy.....',
        '....yyyyyy......',
        '..kkkkkkkkkk....',
        '..kkywwwwykk....',
        '..kkywkkwykk....',
        '..kkkkkkkkkk....',
        '..krrrrrrrrk....',
        '..kkkkkkkkkk....',
        '....kkkkkk......',
        '....kkkk........',
        '.....kkk........',
        '....rrrr........',
        '...rrrr.........'
      ]
    },
    ton: {
      c: 10,
      rows: [
        '..kkkkkk..',
        '.kbbbbbbk.',
        'kbbbwwbbbk',
        'kbwwwwwwbk',
        'kbwwwwwwbk',
        'kbbbwwbbbk',
        '.kbbbbbbk.',
        '..kkkkkk..'
      ]
    },
    cactus: {
      c: 8,
      rows: [
        '...kk...',
        '...kk...',
        '...kk.k.',
        'k..kk.k.',
        'k..kk.k.',
        'k..kkkkk',
        'kkkkk...',
        '...kk...',
        '...kk...',
        '...kk...',
        '...kk...',
        '...kk...',
        '...kk...',
        '...kk...'
      ]
    },
    cloud: {
      c: 16,
      rows: [
        '.....ggggg......',
        '...ggggggggg....',
        '..gggggggggggg..',
        'gggggggggggggggg',
        '.gggggggggggggg.'
      ]
    },
    heart: {
      c: 7,
      rows: [
        '.kk.kk.',
        'kkkkkkk',
        'kkkkkkk',
        '.kkkkk.',
        '..kkk..',
        '...k...'
      ]
    },
    ghost: {
      c: 12,
      rows: [
        '...kkkkkk...',
        '..kkkkkkkk..',
        '.kkkkkkkkkk.',
        '.kkwkkkkwkk.',
        '.kkkkkkkkkk.',
        '.kkkkkkkkkk.',
        '.kkkkkkkkkk.',
        '.kkkkkkkkkk.',
        '.kk.kkkk.kk.',
        '..k..kk..k..'
      ]
    }
  };

  function bakeSprite(def) {
    var w = def.c;
    var h = def.rows.length;
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    var g = c.getContext('2d');
    for (var r = 0; r < h; r++) {
      var row = def.rows[r];
      for (var x = 0; x < w; x++) {
        var ch = row[x];
        if (ch && ch !== '.' && P[ch]) {
          g.fillStyle = P[ch];
          g.fillRect(x, r, 1, 1);
        }
      }
    }
    return c;
  }

  var BAKED = {};
  Object.keys(SPRITES).forEach(function (name) {
    BAKED[name] = bakeSprite(SPRITES[name]);
  });

  /* ---------- state ---------- */
  var state = 'menu'; // menu | run | over
  var playerY = 0;    // 0 = on ground, negative = in the air
  var vy = 0;
  var speed = SPEED_START;
  var dist = 0;
  var score = 0;
  var tons = 0;
  var hearts = 3;
  var invulnUntil = 0;
  var obstacles = [];
  var clouds = [];
  var nextSpawnDist = 200;
  var best = 0;
  var lastTs = 0;
  var raf = null;
  var running = false;

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
    hearts = 3; invulnUntil = 0; obstacles = []; nextSpawnDist = 240;
    clouds = [
      { x: 90, y: 22 }, { x: 190, y: 38 }, { x: 280, y: 16 }
    ];
  }

  /* ---------- spawning ---------- */
  function spawn() {
    var types = ['scam', 'cactus', 'fomo', 'airdrop', 'pit', 'ton', 'ton'];
    var type = types[Math.floor(Math.random() * types.length)];
    var ob = { type: type, x: W + 12 };
    if (type === 'scam') { ob.w = 26; ob.h = 20; ob.y = GROUND_Y - 20; }
    if (type === 'cactus') { ob.w = 10; ob.h = 15; ob.y = GROUND_Y - 15; }
    if (type === 'fomo') { ob.w = 15; ob.h = 17; ob.y = GROUND_Y - 17; }
    if (type === 'airdrop') { ob.w = 13; ob.h = 11; ob.y = GROUND_Y - 42; }
    if (type === 'pit') { ob.w = 42; ob.h = 8; ob.y = GROUND_Y; }
    if (type === 'ton') { ob.w = 10; ob.h = 8; ob.y = GROUND_Y - (Math.random() < 0.5 ? 12 : 34); }
    obstacles.push(ob);
  }

  function maybeSpawn() {
    if (dist >= nextSpawnDist) {
      spawn();
      // fair gap: enough room to land and jump again at the current speed
      nextSpawnDist = dist + speed * 0.8 + 60 + Math.random() * 140;
    }
  }

  /* ---------- collisions ---------- */
  function playerBox() {
    return { x: PLAYER_X + 2, y: GROUND_Y - PLAYER_H - playerY, w: PLAYER_W - 3, h: PLAYER_H };
  }

  function hitTest(ob) {
    var p = playerBox();
    if (ob.type === 'pit') {
      // a pit hurts only when you are on the ground above it
      if (playerY > 1) return false;
      return p.x + p.w > ob.x + 4 && p.x < ob.x + ob.w - 4;
    }
    return p.x < ob.x + ob.w && p.x + p.w > ob.x &&
      p.y < ob.y + ob.h && p.y + p.h > ob.y;
  }

  /* ---------- drawing ---------- */
  function drawSprite(name, x, y) {
    ctx.drawImage(BAKED[name], Math.round(x), Math.round(y));
  }

  function drawLabel(text, x, y) {
    ctx.fillStyle = P.k;
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y);
  }

  function drawBoard(x, y, w, h, text) {
    ctx.fillStyle = P.w;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = P.k;
    ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
    ctx.font = '5px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(text, x + w / 2, y + h / 2 + 2);
  }

  function render(now) {
    ctx.fillStyle = '#f4f4f2';
    ctx.fillRect(0, 0, W, H);

    // clouds
    clouds.forEach(function (c) {
      ctx.globalAlpha = 0.55;
      ctx.drawImage(BAKED.cloud, Math.round(c.x), c.y);
      ctx.globalAlpha = 1;
    });

    // ground with pits carved out
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
    ctx.fillStyle = P.k;
    segs.forEach(function (s) { ctx.fillRect(s[0], GROUND_Y, s[1] - s[0], 2); });

    // obstacles
    obstacles.forEach(function (o) {
      if (o.type === 'scam') {
        ctx.fillStyle = P.k;
        ctx.fillRect(Math.round(o.x) + 12, o.y + 10, 2, 10); // post
        drawBoard(Math.round(o.x), o.y - 4, 26, 10, 'SCAM');
      } else if (o.type === 'fomo') {
        ctx.fillStyle = P.w;
        ctx.fillRect(Math.round(o.x), o.y, o.w, o.h);
        ctx.fillStyle = P.k;
        ctx.fillRect(Math.round(o.x), o.y, o.w, 1);
        ctx.fillRect(Math.round(o.x), o.y + o.h - 1, o.w, 1);
        for (var i = 1; i <= 4; i++) ctx.fillRect(Math.round(o.x) + 2, o.y + 4 + i * 2, o.w - 4, 1);
        drawLabel('FOMO', Math.round(o.x) + o.w / 2, o.y + 3);
      } else if (o.type === 'airdrop') {
        drawSprite('ghost', o.x, o.y);
        drawLabel('FAKE', Math.round(o.x) + o.w / 2, o.y - 4);
      } else if (o.type === 'pit') {
        ctx.fillStyle = P.k;
        ctx.fillRect(Math.round(o.x), GROUND_Y, o.w, H - GROUND_Y);
        // spikes
        for (var sx = 0; sx < o.w - 3; sx += 5) {
          ctx.fillRect(Math.round(o.x) + sx, GROUND_Y + 6, 2, 3);
          ctx.fillRect(Math.round(o.x) + sx + 2, GROUND_Y + 9, 2, 3);
        }
        drawBoard(Math.round(o.x) - 4, GROUND_Y - 12, o.w + 8, 9, 'RUG PULL');
      } else if (o.type === 'ton') {
        drawSprite('ton', o.x, o.y);
      } else if (o.type === 'cactus') {
        drawSprite('cactus', o.x, o.y);
      }
    });

    // player (blink while invulnerable)
    var blink = now < invulnUntil && Math.floor(now / 90) % 2 === 0;
    if (!blink) {
      var frame = (Math.floor(now / 110) % 2 === 0) ? 'dhdA' : 'dhdB';
      if (state !== 'run') frame = 'dhdA';
      drawSprite(frame, PLAYER_X, GROUND_Y - PLAYER_H - playerY);
    }
  }

  /* ---------- loop ---------- */
  function loop(ts) {
    if (state !== 'run') return;
    var dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
    lastTs = ts;

    // physics
    if (playerY > 0 || vy < 0) {
      vy += GRAVITY * dt;
      playerY -= vy * dt;
      if (playerY <= 0) { playerY = 0; vy = 0; }
    }

    speed = Math.min(SPEED_MAX, SPEED_START + dist * 0.04);
    var dx = speed * dt;
    dist += dx;
    score = Math.floor(dist / 8);

    clouds.forEach(function (c) {
      c.x -= dx * 0.25;
      if (c.x < -18) { c.x = W + 10; c.y = 12 + Math.floor(Math.random() * 30); }
    });

    obstacles.forEach(function (o) { o.x -= dx; });
    obstacles = obstacles.filter(function (o) { return o.x + o.w > -10; });
    maybeSpawn();

    // collisions & pickups
    var now = ts;
    for (var i = obstacles.length - 1; i >= 0; i--) {
      var ob = obstacles[i];
      if (ob.type === 'ton' && hitTest(ob)) {
        tons += 1;
        score += 15;
        obstacles.splice(i, 1);
        continue;
      }
      if (ob.type !== 'ton' && now > invulnUntil && hitTest(ob)) {
        hearts -= 1;
        invulnUntil = now + 1300;
        if (ob.type === 'pit') {
          // keep the pit under the player but let them jump out: nudge it left
          ob.x -= ob.w + 30;
        }
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
    running = false;
    if (raf) cancelAnimationFrame(raf);
    render(now);
    if (score > best) {
      best = score;
      try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {}
    }
    renderHud();
    if (statusEl) statusEl.textContent = t('game-status-over', 'Game over — press Space or tap to run again.');
    if (shareBtn) {
      var text = t('game-share-text', 'My DHD Runner score: {s}, {t} TON collected — beat me!')
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
  // static menu frame
  ctx.fillStyle = '#f4f4f2';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = P.k;
  ctx.fillRect(0, GROUND_Y, W, 2);
  drawSprite('dhdA', PLAYER_X, GROUND_Y - PLAYER_H);
  drawLabel(t('game-menu', 'TAP / SPACE TO START'), W / 2, 34);
  if (statusEl) statusEl.textContent = t('game-menu', 'TAP / SPACE TO START');

  window.addEventListener('dhd-langchange', function () {
    if (state === 'menu' && statusEl) statusEl.textContent = t('game-menu', 'TAP / SPACE TO START');
  });
})();
