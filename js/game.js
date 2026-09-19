/* ============================================
   The Way of DHD — game.js
   DHD Pixel Runner (Chrome-Dino style):
   horizontal canvas runner with a day/night
   cycle, parallax hills, dust and sparkles.
   Sprites: sprites.js (day + night sets).
   ============================================ */

(function () {
  'use strict';

  var W = 480;
  var H = 150;
  var GROUND_Y = 132;
  var PLAYER_X = 44;
  var PLAYER_W = 32;
  var PLAYER_H = 71;
  var GRAVITY = 1180;
  var JUMP_VY = -375;
  var FREE_WALK_SPEED = 145;
  var FREE_WALK_LEFT = 72;
  var FREE_WALK_RIGHT = 260;
  var SPEED_START = 130;
  var SPEED_MAX = 300;
  var NIGHT_EVERY = 350; // score points per day/night flip
  var BEST_KEY = 'dhd-runner-best';
  var DENDY_CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight'];

  var canvas = document.getElementById('game-canvas');
  var scoreEl = document.getElementById('game-score');
  var tonEl = document.getElementById('game-ton');
  var heartsEl = document.getElementById('game-hearts');
  var statusEl = document.getElementById('game-status');
  var shareBtn = document.getElementById('game-share');

  if (!canvas || !canvas.getContext || !window.DHDSprites) return;
  var ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  function t(key, fallback) {
    return typeof window.dhdT === 'function' ? window.dhdT(key) : fallback;
  }

  var COLORS = {
    day: { bg: '#f4f4f2', fg: '#1b1d22', hill: '#c9cdd2', hillNear: '#a7adb4', cloud: '#b9bec4' },
    night: { bg: '#17181c', fg: '#e8eaee', hill: '#2c2f36', hillNear: '#3a3e46', cloud: '#3f434a' }
  };

  var state = 'menu';
  var playerX = PLAYER_X;
  var playerY = 0;
  var vy = 0;
  var speed = SPEED_START;
  var dist = 0;
  var score = 0;
  var tons = 0;
  var hearts = 3;
  var invulnUntil = 0;
  var flashUntil = 0;
  var obstacles = [];
  var clouds = [];
  var pebbles = [];
  var dust = [];
  var nextSpawnDist = 300;
  var best = 0;
  var lastTs = 0;
  var raf = null;
  var frames = 0;
  var freeMode = false;
  var dendyIndex = 0;
  var keys = {};

  try { best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch (e) {}

  function pad(n) { return String(Math.max(0, Math.min(999999, Math.floor(n)))).padStart(6, '0'); }
  function pad4(n) { return String(Math.max(0, Math.min(9999, Math.floor(n)))).padStart(4, '0'); }

  function isNight() { return Math.floor(score / NIGHT_EVERY) % 2 === 1; }

  function setColors() {
    var c = isNight() ? COLORS.night : COLORS.day;
    ctx.fillStyle = c.bg;
    ctx.fillRect(0, 0, W, H);
    return c;
  }

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
    playerX = PLAYER_X; playerY = 0; vy = 0; speed = SPEED_START; dist = 0; score = 0; tons = 0;
    hearts = 3; invulnUntil = 0; flashUntil = 0; obstacles = []; dust = [];
    freeMode = false; keys = {};
    nextSpawnDist = 360;
    clouds = [{ x: 130, y: 30 }, { x: 270, y: 52 }, { x: 400, y: 22 }];
    pebbles = [];
    for (var i = 0; i < 26; i++) {
      pebbles.push({ x: Math.random() * W, y: GROUND_Y + 6 + Math.random() * 10, s: Math.random() < 0.5 ? 2 : 3 });
    }
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
    return { x: playerX + 7, y: GROUND_Y - PLAYER_H + 6 - playerY, w: 18, h: PLAYER_H - 6 };
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

  /* ---------- particles ---------- */
  function spawnDust(x, y, n) {
    for (var i = 0; i < n; i++) {
      dust.push({
        x: x + (Math.random() * 10 - 5),
        y: y - Math.random() * 4,
        vx: -20 - Math.random() * 40,
        vy: -30 - Math.random() * 40,
        life: 0.45
      });
    }
  }

  function spawnSparkle(x, y) {
    for (var i = 0; i < 6; i++) {
      dust.push({
        x: x, y: y,
        vx: (Math.random() * 90 - 45),
        vy: -40 - Math.random() * 60,
        life: 0.4,
        sparkle: true
      });
    }
  }

  /* ---------- drawing ---------- */
  function drawBoard(x, y, w, h, text, fg, bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = fg;
    ctx.fillRect(x, y, w, 2); ctx.fillRect(x, y + h - 2, w, 2);
    ctx.fillRect(x, y, 2, h); ctx.fillRect(x + w - 2, y, 2, h);
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(text, x + w / 2, y + h / 2 + 4);
  }

  function drawRunnerLegs(x, y, C, night, isWalking) {
    var px = Math.round(x);
    var py = Math.round(y);
    var phase = isWalking ? (Math.floor(frames / 5) % 2 === 0 ? -1 : 1) : 0;
    var leftStep = phase * 3;
    var rightStep = -phase * 3;
    var hipY = py + PLAYER_H - 13;
    var footY = py + PLAYER_H - 4;

    ctx.fillStyle = C.bg;
    ctx.fillRect(px + 7, py + PLAYER_H - 12, 9, 12);
    ctx.fillRect(px + 20, py + PLAYER_H - 12, 9, 12);

    ctx.fillStyle = C.fg;
    ctx.fillRect(px + 11 + phase, hipY, 3, 10);
    ctx.fillRect(px + 21 - phase, hipY, 3, 10);

    ctx.fillStyle = night ? '#ff7b7b' : '#e04848';
    ctx.fillRect(px + 8 + leftStep, footY, 9, 3);
    ctx.fillRect(px + 18 + rightStep, footY, 9, 3);
  }

  function render(now) {
    var night = isNight();
    var C = night ? COLORS.night : COLORS.day;
    var S = night ? window.DHDSprites.night : window.DHDSprites.day;

    // sky
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    // sun / moon
    ctx.fillStyle = night ? '#e8eaee' : '#ffd66b';
    ctx.beginPath();
    ctx.arc(W - 42, 22, 9, 0, Math.PI * 2);
    ctx.fill();
    if (night) {
      ctx.fillStyle = C.bg;
      ctx.beginPath();
      ctx.arc(W - 47, 18, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // clouds
    ctx.globalAlpha = 0.6;
    clouds.forEach(function (c) {
      ctx.drawImage(S.cloud, Math.round(c.x), c.y, 32, 10);
    });
    ctx.globalAlpha = 1;

    // far hills (parallax)
    var hillX = -((dist * 0.25) % 240);
    ctx.globalAlpha = 0.5;
    for (var hx = hillX - 240; hx < W + 240; hx += 240) {
      ctx.drawImage(S.hillFar, Math.round(hx), GROUND_Y - 30, 240, 30);
    }
    ctx.globalAlpha = 1;

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
    ctx.fillStyle = C.fg;
    segs.forEach(function (s) { ctx.fillRect(s[0], GROUND_Y, s[1] - s[0], 3); });

    // pebbles under the ground line
    ctx.globalAlpha = 0.45;
    pebbles.forEach(function (pb) {
      ctx.fillRect(Math.round(pb.x), Math.round(pb.y), pb.s, 2);
    });
    ctx.globalAlpha = 1;

    // obstacles
    obstacles.forEach(function (o) {
      if (o.type === 'scam') {
        ctx.fillStyle = C.fg;
        ctx.fillRect(Math.round(o.x) + o.w / 2 - 3, o.y + 14, 6, GROUND_Y - (o.y + 14));
        drawBoard(Math.round(o.x), o.y, o.w, 14, 'SCAM', C.fg, C.bg);
      } else if (o.type === 'cactus') {
        ctx.drawImage(S.cactus, Math.round(o.x), o.y, o.w, o.h);
      } else if (o.type === 'fomo') {
        ctx.fillStyle = night ? '#26282e' : '#ffffff';
        ctx.fillRect(Math.round(o.x), o.y, o.w, o.h);
        ctx.fillStyle = C.fg;
        ctx.fillRect(Math.round(o.x), o.y, o.w, 2);
        ctx.fillRect(Math.round(o.x), o.y + o.h - 2, o.w, 2);
        ctx.fillRect(Math.round(o.x) + o.w - 2, o.y, 2, o.h);
        for (var i = 1; i <= 6; i++) ctx.fillRect(Math.round(o.x) + 3, o.y + 8 + i * 3, o.w - 6, 2);
      } else if (o.type === 'airdrop') {
        ctx.drawImage(S.ghost, Math.round(o.x), o.y, o.w, o.h);
      } else if (o.type === 'pit') {
        ctx.fillStyle = C.fg;
        ctx.fillRect(Math.round(o.x), GROUND_Y, o.w, H - GROUND_Y);
        for (var sx = 0; sx < o.w - 4; sx += 8) {
          ctx.fillRect(Math.round(o.x) + sx, GROUND_Y + 10, 3, 5);
          ctx.fillRect(Math.round(o.x) + sx + 3, GROUND_Y + 15, 3, 5);
        }
        drawBoard(Math.round(o.x) - 8, GROUND_Y - 20, o.w + 16, 14, 'RUG PULL', C.fg, C.bg);
      } else if (o.type === 'ton') {
        ctx.drawImage(S.ton, Math.round(o.x), o.y, o.w, o.h);
      }
    });

    // dust & sparkles
    dust.forEach(function (d) {
      ctx.fillStyle = d.sparkle ? (night ? '#7fd0ff' : '#3aa9e0') : C.fg;
      ctx.globalAlpha = Math.max(0, d.life / 0.45);
      ctx.fillRect(Math.round(d.x), Math.round(d.y), d.sparkle ? 2 : 2, d.sparkle ? 2 : 2);
    });
    ctx.globalAlpha = 1;

    // player with a light run bob (grounded only)
    var bob = (!freeMode && playerY === 0 && Math.floor(frames / 6) % 2 === 0) ? 1 : 0;
    var blink = now < invulnUntil && Math.floor(now / 90) % 2 === 0;
    if (!blink) {
      var playerDrawX = Math.round(playerX);
      var playerDrawY = Math.round(GROUND_Y - PLAYER_H - playerY + bob);
      var walking = playerY === 0 && (!freeMode || keys.ArrowLeft !== keys.ArrowRight);
      ctx.drawImage(S.hchkGame, playerDrawX, playerDrawY);
      drawRunnerLegs(playerDrawX, playerDrawY, C, night, walking);
    }

    if (freeMode) {
      ctx.font = '7px "Press Start 2P", monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = night ? '#7fd0ff' : '#007ea0';
      ctx.fillText('DENDY MODE', 8, 16);
    }

    // hit flash
    if (now < flashUntil) {
      ctx.fillStyle = 'rgba(224, 72, 72, 0.25)';
      ctx.fillRect(0, 0, W, H);
    }
  }

  /* ---------- menu / game-over screens ---------- */
  function drawOverlay(kind) {
    var night = isNight();
    var C = night ? COLORS.night : COLORS.day;
    var S = night ? window.DHDSprites.night : window.DHDSprites.day;

    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(S.hchkDetailed, 48, 4);
    ctx.fillStyle = C.fg;
    ctx.font = '14px "Press Start 2P", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(kind === 'over' ? 'GAME OVER' : 'DHD PIXEL RUNNER', 150, 60);
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillStyle = night ? '#8a9099' : '#55595f';
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

    var freeMove = 0;
    var freeWorldDx = 0;

    if (freeMode) {
      var move = 0;
      if (keys.ArrowLeft) move -= 1;
      if (keys.ArrowRight) move += 1;
      if (move) {
        freeMove = move * FREE_WALK_SPEED * dt;
        playerX += freeMove;
        if (playerX > FREE_WALK_RIGHT) {
          freeWorldDx += playerX - FREE_WALK_RIGHT;
          playerX = FREE_WALK_RIGHT;
        }
        if (playerX < FREE_WALK_LEFT) {
          freeWorldDx += playerX - FREE_WALK_LEFT;
          playerX = FREE_WALK_LEFT;
        }
        if (freeWorldDx < 0 && dist + freeWorldDx < 0) freeWorldDx = -dist;
        playerX = Math.max(8, Math.min(W - PLAYER_W - 8, playerX));
        if (playerY === 0 && frames % 8 === 0) spawnDust(playerX + PLAYER_W / 2, GROUND_Y, 1);
      }
      if (keys.ArrowDown && playerY > 0) vy = Math.max(vy, 260);
    }

    if (playerY > 0 || vy < 0) {
      vy += GRAVITY * dt;
      playerY -= vy * dt;
      if (playerY <= 0 && vy > 0) {
        playerY = 0; vy = 0;
        spawnDust(playerX + PLAYER_W / 2, GROUND_Y, 5);
      }
    }

    speed = freeMode ? FREE_WALK_SPEED : Math.min(SPEED_MAX, SPEED_START + dist * 0.03);
    var dx = freeMode ? freeWorldDx : speed * dt;
    if (freeMode) {
      if (dx !== 0) {
        dist = Math.max(0, dist + dx);
        score = Math.max(score, Math.floor(dist / 10));
      }
    } else {
      dist += dx;
      score = Math.floor(dist / 10);
    }

    clouds.forEach(function (c) {
      c.x -= dx * 0.25;
      if (c.x < -36) { c.x = W + 20; c.y = 18 + Math.floor(Math.random() * 45); }
      if (c.x > W + 40) { c.x = -36; c.y = 18 + Math.floor(Math.random() * 45); }
    });
    pebbles.forEach(function (pb) {
      pb.x -= dx;
      if (pb.x < -4) { pb.x = W + Math.random() * 20; pb.y = GROUND_Y + 6 + Math.random() * 10; }
      if (pb.x > W + 8) { pb.x = -Math.random() * 20; pb.y = GROUND_Y + 6 + Math.random() * 10; }
    });

    obstacles.forEach(function (o) { o.x -= dx; });
    obstacles = obstacles.filter(function (o) { return o.x + o.w > -20; });
    if (!freeMode || dx > 0) maybeSpawn();

    var now = ts;
    for (var i = obstacles.length - 1; i >= 0; i--) {
      var ob = obstacles[i];
      if (ob.type === 'ton' && hitTest(ob)) {
        tons += 1;
        score += 25;
        spawnSparkle(ob.x + ob.w / 2, ob.y + ob.h / 2);
        obstacles.splice(i, 1);
        continue;
      }
      if (ob.type !== 'ton' && now > invulnUntil && hitTest(ob)) {
        hearts -= 1;
        invulnUntil = now + 1400;
        flashUntil = now + 120;
        spawnDust(playerX + PLAYER_W / 2, GROUND_Y - 20, 8);
        if (ob.type === 'pit') ob.x -= ob.w + 60;
        renderHud();
        if (hearts <= 0) { gameOver(now); return; }
      }
    }

    // particles physics
    dust = dust.filter(function (d) { return d.life > 0; });
    dust.forEach(function (d) {
      d.life -= dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vy += 260 * dt;
    });

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
    if (playerY === 0) {
      vy = JUMP_VY; playerY = 0.01;
      spawnDust(playerX + PLAYER_W / 2, GROUND_Y, 4);
    }
  }

  function setRunnerStatus() {
    if (!statusEl) return;
    statusEl.textContent = freeMode
      ? 'DENDY MODE: \u2190 \u2192 = walk \u00b7 \u2191 / Space = jump \u00b7 enter the code again to run.'
      : t('game-status-run', 'SPACE / TAP = jump \u00b7 \u25c7 = TON \u00b7 X = scam');
  }

  function toggleDendyMode() {
    if (state !== 'run') start();
    freeMode = !freeMode;
    keys = {};
    if (freeMode) {
      speed = 0;
      playerX = Math.max(8, Math.min(W - PLAYER_W - 8, playerX));
    }
    setRunnerStatus();
  }

  function trackDendyCode(key) {
    if (key === DENDY_CODE[dendyIndex]) {
      dendyIndex += 1;
      if (dendyIndex === DENDY_CODE.length) {
        dendyIndex = 0;
        toggleDendyMode();
      }
      return;
    }
    dendyIndex = key === DENDY_CODE[0] ? 1 : 0;
  }

  /* ---------- controls ---------- */
  document.addEventListener('keydown', function (event) {
    if (!canvas) return;
    var rect = canvas.getBoundingClientRect();
    var visible = rect.top < window.innerHeight * 0.8 && rect.bottom > 80;
    if (!visible) return;
    trackDendyCode(event.key);
    if (event.key.indexOf('Arrow') === 0) keys[event.key] = true;
    if (event.key === ' ' || event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') {
      event.preventDefault();
      jump();
    }
    if (event.key.indexOf('Arrow') === 0) event.preventDefault();
  });

  document.addEventListener('keyup', function (event) {
    if (event.key.indexOf('Arrow') === 0) keys[event.key] = false;
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
