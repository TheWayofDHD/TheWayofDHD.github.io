/* ============================================
   The Way of DHD — game.js
   DHD ASCII Runner: 5-lane dodge & collect.
   Pure DOM/pre, localStorage best score,
   keyboard + tap-zone controls.
   ============================================ */

(function () {
  'use strict';

  var COLS = 5;            // playfield lanes
  var ROWS = 16;           // scrolling rows above the player line
  var TICK_MS_START = 170;
  var TICK_MS_MIN = 85;
  var SCORE_PER_TON = 25;

  var screen = document.getElementById('game-screen');
  var scoreEl = document.getElementById('game-score');
  var bestEl = document.getElementById('game-best');
  var statusEl = document.getElementById('game-status');
  var shareBtn = document.getElementById('game-share');

  if (!screen) return;

  var BEST_KEY = 'dhd-runner-best';

  function t(key, fallback) {
    return typeof window.dhdT === 'function' ? window.dhdT(key) : fallback;
  }

  var state = 'menu'; // menu | run | over
  var playerCol = 2;
  var lane = [];      // lane[row][col]: '.' empty, 'X' scam, 'O' ton
  var score = 0;
  var tickTimer = null;
  var tickMs = TICK_MS_START;
  var ticks = 0;
  var spawnEvery = 3;
  var best = 0;

  try { best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch (e) {}

  function pad(n) {
    return String(Math.max(0, Math.min(999999, n))).padStart(6, '0');
  }

  function renderHud() {
    if (scoreEl) scoreEl.textContent = 'SCORE ' + pad(score);
    if (bestEl) bestEl.textContent = 'BEST ' + pad(best);
  }

  function emptyLane() {
    var rows = [];
    for (var r = 0; r < ROWS; r++) {
      var row = [];
      for (var c = 0; c < COLS; c++) row.push('.');
      rows.push(row);
    }
    return rows;
  }

  function reset() {
    lane = emptyLane();
    playerCol = Math.floor(COLS / 2);
    score = 0;
    ticks = 0;
    tickMs = TICK_MS_START;
    spawnEvery = 3;
  }

  function draw(frameText) {
    var out = [];
    out.push('+' + new Array(COLS * 2 + 2).join('-') + '+');
    for (var r = 0; r < ROWS; r++) {
      var line = '';
      for (var c = 0; c < COLS; c++) line += lane[r][c] === '.' ? ' .' : lane[r][c] + ' ';
      out.push('| ' + line + '|');
    }
    var playerLine = '';
    for (var c2 = 0; c2 < COLS; c2++) playerLine += (c2 === playerCol ? 'D ' : ' .');
    out.push('| ' + playerLine + '|');
    out.push('+' + new Array(COLS * 2 + 2).join('-') + '+');
    screen.textContent = out.join('\n') + (frameText ? '\n' + frameText : '');
  }

  function spawnRow() {
    var row = [];
    for (var c = 0; c < COLS; c++) row.push('.');
    // at most one obstacle and at most one ton per spawned row
    var scamCol = Math.random() < 0.75 ? Math.floor(Math.random() * COLS) : -1;
    var tonCol = -1;
    if (scamCol === -1 || Math.random() < 0.45) {
      do { tonCol = Math.floor(Math.random() * COLS); } while (tonCol === scamCol);
    }
    if (scamCol >= 0) row[scamCol] = 'X';
    if (tonCol >= 0) row[tonCol] = 'O';
    return row;
  }

  function tick() {
    ticks += 1;
    // move everything down; check the player line
    for (var r = ROWS - 1; r >= 0; r--) {
      for (var c = 0; c < COLS; c++) {
        var cell = lane[r][c];
        if (cell === '.') continue;
        if (r + 1 >= ROWS) {
          // reached the player line
          if (cell === 'X' && c === playerCol) return gameOver();
          if (cell === 'O' && c === playerCol) score += SCORE_PER_TON;
          lane[r][c] = '.';
        } else {
          lane[r + 1][c] = cell;
          lane[r][c] = '.';
        }
      }
    }
    if (ticks % spawnEvery === 0) {
      lane[0] = spawnRow();
    }
    // ramp difficulty every 12 ticks
    if (ticks % 12 === 0 && tickMs > TICK_MS_MIN) {
      tickMs = Math.max(TICK_MS_MIN, tickMs - 6);
      if (spawnEvery > 2 && ticks % 48 === 0) spawnEvery = 2;
    }
    score += 1; // survival points
    renderHud();
    draw('');
    schedule();
  }

  function schedule() {
    tickTimer = setTimeout(tick, tickMs);
  }

  function start() {
    if (tickTimer) clearTimeout(tickTimer);
    reset();
    state = 'run';
    if (shareBtn) shareBtn.style.display = 'none';
    if (statusEl) statusEl.textContent = t('game-status-run', 'RUN! ◈ = TON, X = scam');
    renderHud();
    draw('');
    schedule();
  }

  function gameOver() {
    state = 'over';
    if (tickTimer) clearTimeout(tickTimer);
    tickTimer = null;
    if (score > best) {
      best = score;
      try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {}
    }
    renderHud();
    draw(t('game-over', 'GAME OVER'));
    if (statusEl) statusEl.textContent = t('game-status-over', 'Game over — press Space or tap here to run again.');
    if (shareBtn) {
      var text = t('game-share-text', 'I scored {s} in the DHD ASCII Runner — beat me!').replace('{s}', String(score));
      shareBtn.href = 'https://t.me/share/url?url=' + encodeURIComponent('https://thewayofdhd.github.io/game.html') +
        '&text=' + encodeURIComponent(text);
      shareBtn.style.display = '';
    }
  }

  function moveLeft() {
    if (state !== 'run') return;
    playerCol = Math.max(0, playerCol - 1);
    draw('');
  }

  function moveRight() {
    if (state !== 'run') return;
    playerCol = Math.min(COLS - 1, playerCol + 1);
    draw('');
  }

  function primaryAction() {
    if (state === 'run') return;
    start();
  }

  document.addEventListener('keydown', function (event) {
    if (!screen || !screen.getBoundingClientRect) return;
    // only react when the game section is on screen to avoid hijacking the page
    var rect = screen.getBoundingClientRect();
    var visible = rect.top < window.innerHeight * 0.8 && rect.bottom > 80;
    if (!visible) return;
    switch (event.key) {
      case 'ArrowLeft': case 'a': case 'A': moveLeft(); event.preventDefault(); break;
      case 'ArrowRight': case 'd': case 'D': moveRight(); event.preventDefault(); break;
      case ' ': case 'Enter': primaryAction(); event.preventDefault(); break;
    }
  });

  screen.addEventListener('pointerdown', function (event) {
    var rect = screen.getBoundingClientRect();
    var x = event.clientX - rect.left;
    if (state !== 'run') { primaryAction(); return; }
    if (x < rect.width / 2) moveLeft(); else moveRight();
  });

  if (statusEl) {
    statusEl.addEventListener('click', primaryAction);
    statusEl.style.cursor = 'pointer';
  }

  // menu screen
  renderHud();
  draw(t('game-menu', 'PRESS SPACE / TAP TO RUN'));

  // refresh localized overlays when the language changes
  window.addEventListener('dhd-langchange', function () {
    if (state === 'menu') draw(t('game-menu', 'PRESS SPACE / TAP TO RUN'));
    if (state === 'over') draw(t('game-over', 'GAME OVER'));
  });
})();
