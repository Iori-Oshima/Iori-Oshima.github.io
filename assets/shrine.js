/* ═══════════════════════════════════════════════
   和合神社 — 参拝の実装
   ═══════════════════════════════════════════════ */
(function () {
  'use strict';

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ── 記録（端末内のみ） ─────────────────── */

  var Store = (function () {
    var KEY = 'wagou-jinja/v1';
    var data = { visits: 0, first: '', last: '', lights: 0, worships: 0, sound: false, michi: '' };

    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        for (var k in data) if (Object.prototype.hasOwnProperty.call(parsed, k)) data[k] = parsed[k];
      }
    } catch (e) { /* 記録できぬ端末もある */ }

    function save() {
      try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* 黙して祀る */ }
    }

    return {
      get: function (k) { return data[k]; },
      set: function (k, v) { data[k] = v; save(); return v; },
      bump: function (k) { data[k] = (data[k] || 0) + 1; save(); return data[k]; }
    };
  })();

  /* ── 和暦 ───────────────────────────────── */

  function kanjiNum(n) {
    var d = '〇一二三四五六七八九';
    if (n < 0 || !isFinite(n)) return String(n);
    if (n < 10) return d.charAt(n);
    if (n === 10) return '十';
    if (n < 20) return '十' + d.charAt(n - 10);
    if (n < 100) {
      var t = Math.floor(n / 10), r = n % 10;
      return d.charAt(t) + '十' + (r ? d.charAt(r) : '');
    }
    return String(n);
  }

  function wareki(date) {
    if (!date || isNaN(date.getTime())) return '—';
    var y = date.getFullYear(), m = date.getMonth() + 1, day = date.getDate();
    var era = '令和', ey = y - 2018;
    if (y < 2019 || (y === 2019 && m < 5)) { era = '平成'; ey = y - 1988; }
    return era + (ey === 1 ? '元' : kanjiNum(ey)) + '年' + kanjiNum(m) + '月' + kanjiNum(day) + '日';
  }

  function isoDate(date) {
    return date.getFullYear() + '-' +
      ('0' + (date.getMonth() + 1)).slice(-2) + '-' +
      ('0' + date.getDate()).slice(-2);
  }

  /* ── 音 ─────────────────────────────────── */

  var Sound = (function () {
    var ctx = null, enabled = false, noise = null;

    function ac() {
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      }
      if (ctx.state === 'suspended' && ctx.resume) {
        var p = ctx.resume();
        if (p && p.catch) p.catch(function () { /* 仕草がまだ足りぬ */ });
      }
      return ctx;
    }

    function noiseBuffer(c) {
      if (noise) return noise;
      var len = Math.floor(c.sampleRate * 0.25);
      noise = c.createBuffer(1, len, c.sampleRate);
      var ch = noise.getChannelData(0);
      for (var i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
      return noise;
    }

    function tone(freq, dur, vol, type) {
      var c = ac(); if (!c || !enabled) return;
      var o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.exponentialRampToValueAtTime(vol, c.currentTime + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
      o.connect(g); g.connect(c.destination);
      o.start(); o.stop(c.currentTime + dur + 0.05);
    }

    return {
      isOn: function () { return enabled; },
      set: function (v) { enabled = !!v; if (enabled) ac(); },

      /* 鈴 */
      bell: function () {
        tone(784, 2.8, 0.10);
        tone(784 * 2.76, 1.9, 0.035);
        tone(784 * 5.4, 1.1, 0.015);
      },

      /* 柏手 */
      clap: function () {
        var c = ac(); if (!c || !enabled) return;
        var src = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
        src.buffer = noiseBuffer(c);
        bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = 1.1;
        g.gain.setValueAtTime(0.24, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.12);
        src.connect(bp); bp.connect(g); g.connect(c.destination);
        src.start(); src.stop(c.currentTime + 0.2);
      },

      /* 水 */
      drop: function () { tone(430, 0.35, 0.05, 'sine'); },

      /* 五円玉 */
      coin: function () {
        tone(2150, 0.5, 0.05);
        tone(3180, 0.35, 0.03);
        setTimeout(function () { tone(1720, 0.4, 0.035); }, 110);
      },

      /* 献灯 */
      light: function () { tone(1180, 1.2, 0.028); }
    };
  })();

  (function soundToggle() {
    var btn = $('#sound-toggle');
    if (!btn) return;
    var label = $('.sound-toggle__text', btn);

    function paint() {
      var on = Sound.isOn();
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      label.textContent = on ? '音 あり' : '音 なし';
    }

    btn.addEventListener('click', function () {
      Sound.set(!Sound.isOn());
      Store.set('sound', Sound.isOn());
      paint();
      if (Sound.isOn()) Sound.bell();
    });

    /* 自動再生はしない。前回の意思だけ憶えておき、最初の操作で息を吹き返す */
    if (Store.get('sound')) {
      Sound.set(true);
      paint();
      var wake = function () {
        Sound.set(true);
        document.removeEventListener('pointerdown', wake);
        document.removeEventListener('keydown', wake);
      };
      document.addEventListener('pointerdown', wake, { once: true });
      document.addEventListener('keydown', wake, { once: true });
    } else {
      paint();
    }
  })();

  /* ── 灯 ─────────────────────────────────── */

  var Lights = (function () {
    var canvas = $('#lights-canvas');
    if (!canvas) return { offer: function () {} };

    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0;
    var motes = [];
    var flames = [];   /* 献じられた灯。文書座標で持つ */
    var sprite = null;
    var running = false;

    function makeSprite() {
      var size = 128, c = document.createElement('canvas');
      c.width = c.height = size;
      var x = c.getContext('2d');
      var g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      g.addColorStop(0.00, 'rgba(255, 226, 176, 1)');
      g.addColorStop(0.12, 'rgba(255, 188, 108, 0.62)');
      g.addColorStop(0.34, 'rgba(255, 150, 70, 0.16)');
      g.addColorStop(1.00, 'rgba(255, 140, 60, 0)');
      x.fillStyle = g;
      x.fillRect(0, 0, size, size);
      return c;
    }

    function resize() {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function seedMotes() {
      motes.length = 0;
      var n = Math.round(Math.min(56, Math.max(18, W * H / 26000)));
      for (var i = 0; i < n; i++) {
        motes.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: 1.4 + Math.random() * 3.6,
          a: 0.05 + Math.random() * 0.16,
          vy: 0.06 + Math.random() * 0.20,
          sway: 0.2 + Math.random() * 0.7,
          ph: Math.random() * Math.PI * 2
        });
      }
    }

    function draw(t) {
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';

      var i, m, s;

      for (i = 0; i < motes.length; i++) {
        m = motes[i];
        m.y -= m.vy;
        m.ph += 0.006;
        if (m.y < -20) { m.y = H + 20; m.x = Math.random() * W; }
        s = m.r * 9;
        ctx.globalAlpha = m.a * (0.65 + 0.35 * Math.sin(m.ph * 2.1));
        ctx.drawImage(sprite,
          m.x + Math.sin(m.ph) * m.sway * 14 - s / 2, m.y - s / 2, s, s);
      }

      var scroll = window.pageYOffset || document.documentElement.scrollTop || 0;

      for (i = flames.length - 1; i >= 0; i--) {
        var f = flames[i];
        var age = (t - f.born) / 1000;
        if (age > f.life) { flames.splice(i, 1); continue; }

        f.docY -= 0.10;

        var y = f.docY - scroll;
        if (y < -160 || y > H + 160) continue;

        var fadeIn  = Math.min(1, age / 1.6);
        var fadeOut = Math.min(1, (f.life - age) / 9);
        var flick   = 0.78 + 0.22 * Math.sin(t / 190 + f.ph) * Math.sin(t / 77 + f.ph * 2);

        s = 46 + Math.sin(t / 620 + f.ph) * 5;
        ctx.globalAlpha = 0.62 * fadeIn * fadeOut * flick;
        ctx.drawImage(sprite, f.x - s / 2, y - s / 2, s, s);

        ctx.globalAlpha = 0.9 * fadeIn * fadeOut * flick;
        ctx.drawImage(sprite, f.x - 5, y - 6, 10, 12);
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    function loop(t) {
      if (!running) return;
      draw(t);
      requestAnimationFrame(loop);
    }

    function start() {
      if (running || reduceMotion.matches) return;
      running = true;
      requestAnimationFrame(loop);
    }

    function stop() { running = false; }

    sprite = makeSprite();
    resize();
    seedMotes();

    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { resize(); seedMotes(); if (reduceMotion.matches) draw(performance.now()); }, 180);
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop(); else start();
    });

    if (reduceMotion.matches) draw(performance.now()); else start();

    var onPrefChange = function () {
      if (reduceMotion.matches) { stop(); draw(performance.now()); } else start();
    };
    if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', onPrefChange);
    else if (reduceMotion.addListener) reduceMotion.addListener(onPrefChange);

    return {
      offer: function (clientX, clientY) {
        var scroll = window.pageYOffset || document.documentElement.scrollTop || 0;
        flames.push({
          x: clientX,
          docY: clientY + scroll,
          born: performance.now(),
          life: 46 + Math.random() * 22,
          ph: Math.random() * Math.PI * 2
        });
        if (flames.length > 90) flames.shift();
        if (reduceMotion.matches) draw(performance.now());
      }
    };
  })();

  /* ── 現れ ───────────────────────────────── */

  (function reveal() {
    var items = $$('.reveal');
    if (!('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });

    items.forEach(function (el) { io.observe(el); });
  })();

  /* ── 参道の灯籠 ─────────────────────────── */

  (function sando() {
    var lanterns = $$('[data-lantern]');
    if (!lanterns.length) return;

    if (!('IntersectionObserver' in window)) {
      lanterns.forEach(function (el) { el.classList.add('is-lit'); });
      return;
    }

    /* 画面の下寄りに引いた線を越えた灯籠から順に灯す。
       見える端から一斉に点くのではなく、歩みに追いついてくるように見せる */
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-lit');
        io.unobserve(en.target);
      });
    }, { threshold: 0, rootMargin: '-45% 0px -25% 0px' });

    lanterns.forEach(function (el) { io.observe(el); });
  })();

  /* ── 手水舎 ─────────────────────────────── */

  (function temizu() {
    var section = $('#temizu');
    var basin   = $('#temizu-basin');
    var ring    = $('#temizu-ring');
    var done    = $('#temizu-done');
    var note    = $('#temizu-note');
    if (!section || !basin) return;

    var NEED = 1600;
    var CIRC = 239;   /* 水縁の楕円の周長。style.css の stroke-dasharray と揃える */
    var held = 0, t0 = 0, raf = 0, cleansed = false;

    function paint(p) {
      if (ring) ring.style.strokeDashoffset = String(CIRC * (1 - p));
    }

    function tick(now) {
      held = now - t0;
      var p = Math.min(1, held / NEED);
      paint(p);
      if (p >= 1) { finish(); return; }
      raf = requestAnimationFrame(tick);
    }

    function begin() {
      if (cleansed) return;
      t0 = performance.now();
      section.classList.add('is-pouring');
      Sound.drop();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    }

    function cancel() {
      if (cleansed) return;
      cancelAnimationFrame(raf);
      section.classList.remove('is-pouring');
      paint(0);
    }

    function finish() {
      cleansed = true;
      cancelAnimationFrame(raf);
      section.classList.remove('is-pouring');
      section.classList.add('is-cleansed');
      paint(1);
      if (note) note.hidden = true;
      if (done) done.hidden = false;
      Sound.bell();
    }

    basin.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      if (basin.setPointerCapture) { try { basin.setPointerCapture(e.pointerId); } catch (err) {} }
      begin();
    });
    basin.addEventListener('pointerup', cancel);
    basin.addEventListener('pointercancel', cancel);

    basin.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      if (!e.repeat) begin();
    });
    basin.addEventListener('keyup', function (e) {
      if (e.key === 'Enter' || e.key === ' ') cancel();
    });

    /* 動きを控える設定では、一度の操作で清める */
    if (reduceMotion.matches) NEED = 1;
  })();

  /* ── 拝殿：帳と献灯 ─────────────────────── */

  (function haiden() {
    var section = $('#haiden');
    var miya    = $('.miya', section);
    var tobari  = $('#tobari');
    var note    = $('#haiden-note');
    var kento   = $('#kento');
    var count   = $('#kento-count');
    if (!section || !miya || !tobari) return;

    var opened = false;

    function paintCount() {
      if (count) count.textContent = String(Store.get('lights') || 0);
    }
    paintCount();

    tobari.addEventListener('click', function () {
      if (opened) return;
      opened = true;
      miya.classList.add('is-open');
      Sound.bell();
      setTimeout(function () {
        if (note) note.hidden = true;
        if (kento) kento.hidden = false;
      }, 1800);
    });

    section.addEventListener('click', function (e) {
      if (!opened) return;
      if (e.target.closest('button, a')) return;
      Lights.offer(e.clientX, e.clientY);
      Store.bump('lights');
      paintCount();
      Sound.light();
    });
  })();

  /* ── 参拝：二振二拍一垂 ─────────────────── */

  var Ritual = (function () {
    var stage  = $('.ritual__stage');
    var jingi  = $('#jingi');
    var guide  = $('#ritual-guide');
    var sara   = $('#sara');
    var drop   = $('#drop');
    var pool   = $('#pool');
    var steps  = {
      furi: $('[data-step="furi"]'),
      haku: $('[data-step="haku"]'),
      tare: $('[data-step="tare"]')
    };
    if (!stage || !jingi) return { reset: function () {} };

    var GUIDE = {
      furi: '神器を左右に振ってください。',
      haku: '二たび拍ってください。',
      tare: '押したまま、一たび垂らしてください。',
      done: '——'
    };

    var step = 'furi';
    var furiCount = 0, hakuCount = 0;
    var complete = false;

    function dots(name) { return $$('.sahou__dots i', steps[name]); }

    function setStep(next) {
      step = next;
      ['furi', 'haku', 'tare'].forEach(function (k) {
        if (!steps[k]) return;
        steps[k].classList.toggle('is-active', k === step);
      });
      if (guide) guide.textContent = GUIDE[step] || '';
      jingi.setAttribute('aria-label',
        step === 'furi' ? '神器を振る' :
        step === 'haku' ? '拍つ' :
        step === 'tare' ? '長押しして垂らす' : '参拝を終える');
    }

    function markDone(name) {
      if (steps[name]) { steps[name].classList.remove('is-active'); steps[name].classList.add('is-done'); }
    }

    /* 一、振る */
    function furi() {
      if (step !== 'furi' || furiCount >= 2) return;
      furiCount++;
      var d = dots('furi')[furiCount - 1];
      if (d) d.classList.add('on');
      jingi.classList.remove('is-shaking');
      void jingi.offsetWidth;
      jingi.classList.add('is-shaking');
      Sound.drop();
      if (furiCount >= 2) { markDone('furi'); setStep('haku'); }
    }

    /* 二、拍つ */
    function haku(x, y) {
      if (step !== 'haku' || hakuCount >= 2) return;
      hakuCount++;
      var d = dots('haku')[hakuCount - 1];
      if (d) d.classList.add('on');

      var r = document.createElement('span');
      r.className = 'ripple';
      if (typeof x === 'number') {
        var box = stage.getBoundingClientRect();
        r.style.left = (x - box.left) + 'px';
        r.style.top  = (y - box.top) + 'px';
      }
      stage.appendChild(r);
      setTimeout(function () { r.remove(); }, 1600);

      Sound.clap();
      if (hakuCount >= 2) { markDone('haku'); setStep('tare'); }
    }

    /* 三、垂らす */
    var NEED = 1300;
    var t0 = 0, raf = 0, holding = false;

    function tareTick(now) {
      if (!holding) return;
      var p = Math.min(1, (now - t0) / NEED);
      var s = 3 + p * 15;
      if (drop) {
        drop.style.opacity = String(Math.min(1, p * 2.4));
        drop.style.width  = s + 'px';
        drop.style.height = (s * 1.18) + 'px';
      }
      if (p >= 1) { tareFinish(); return; }
      raf = requestAnimationFrame(tareTick);
    }

    function tareBegin() {
      if (step !== 'tare' || holding || complete) return;
      holding = true;
      t0 = performance.now();
      jingi.classList.add('is-tilting');
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tareTick);
    }

    function tareCancel() {
      if (!holding) return;
      holding = false;
      cancelAnimationFrame(raf);
      jingi.classList.remove('is-tilting');
      if (drop) { drop.style.opacity = '0'; drop.style.width = '0'; drop.style.height = '0'; }
    }

    function tareFinish() {
      holding = false;
      cancelAnimationFrame(raf);
      jingi.classList.remove('is-tilting');

      if (drop) {
        drop.classList.add('is-falling');
        setTimeout(function () {
          drop.style.opacity = '0';
          drop.classList.remove('is-falling');
          if (pool) pool.classList.add('is-spread');
          Sound.drop();
        }, 520);
      }

      var d = dots('tare')[0];
      if (d) d.classList.add('on');
      markDone('tare');
      setStep('done');
      complete = true;

      setTimeout(finish, 1400);
    }

    function finish() {
      Store.bump('worships');
      Oracle.reveal();
    }

    /* 操作 —— 引く・押す・叩く */
    var dragging = false, didDrag = false, dir = 0, travel = 0, lastX = 0;

    jingi.addEventListener('pointerdown', function (e) {
      if (step === 'tare') { e.preventDefault(); tareBegin(); return; }
      if (step !== 'furi') return;
      dragging = true; didDrag = false; dir = 0; travel = 0; lastX = e.clientX;
      if (jingi.setPointerCapture) { try { jingi.setPointerCapture(e.pointerId); } catch (err) {} }
    });

    jingi.addEventListener('pointermove', function (e) {
      if (!dragging || step !== 'furi') return;
      var dx = e.clientX - lastX;
      if (Math.abs(dx) < 2) return;
      lastX = e.clientX;
      var nd = dx > 0 ? 1 : -1;
      if (dir === 0) { dir = nd; travel = Math.abs(dx); return; }
      if (nd === dir) { travel += Math.abs(dx); return; }
      if (travel >= 24) { didDrag = true; furi(); }
      dir = nd; travel = Math.abs(dx);
    });

    function endDrag() { dragging = false; }
    jingi.addEventListener('pointerup', function (e) {
      if (step === 'tare') { tareCancel(); return; }
      endDrag();
    });
    jingi.addEventListener('pointercancel', function () { tareCancel(); endDrag(); });

    /* 引かずに押しただけの時、および鍵盤からの操作 */
    jingi.addEventListener('click', function () {
      if (step === 'tare') return;
      if (didDrag) { didDrag = false; return; }
      if (step === 'furi') furi();
    });

    jingi.addEventListener('keydown', function (e) {
      if (step !== 'tare') return;
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      if (!e.repeat) tareBegin();
    });
    jingi.addEventListener('keyup', function (e) {
      if (step !== 'tare') return;
      if (e.key === 'Enter' || e.key === ' ') tareCancel();
    });

    /* 拍手は舞台のどこでも受ける */
    stage.addEventListener('click', function (e) {
      if (step !== 'haku') return;
      /* 鍵盤からの起動では座標を持たない。その時は舞台の中央に響かせる */
      if (e.detail > 0) haku(e.clientX, e.clientY); else haku();
    });

    setStep('furi');

    return {
      reset: function () {
        furiCount = 0; hakuCount = 0; complete = false;
        $$('.sahou__dots i').forEach(function (d) { d.classList.remove('on'); });
        ['furi', 'haku', 'tare'].forEach(function (k) {
          if (steps[k]) steps[k].classList.remove('is-done');
        });
        if (pool) pool.classList.remove('is-spread');
        if (drop) { drop.style.opacity = '0'; drop.style.width = '0'; drop.style.height = '0'; }
        setStep('furi');
      }
    };
  })();

  /* ── 神託 ───────────────────────────────── */

  var Oracle = (function () {
    var section = $('#shintaku');
    var elKe    = $('#oracle-ke');
    var elKoto  = $('#oracle-kotoba');
    var elChu   = $('#oracle-chu');
    var elFig   = $('#oracle-fig');
    var box     = $('.oracle');
    var again   = $('#reworship');

    /* 絵の説明。読み上げにも使う */
    var ALT = {
      '01-meet':         '手を上げる白油之命',
      '02-happy':        '跳ねてよろこぶ赤實之命',
      '03-sorry':        'うつむいて白を垂らす白油之命',
      '04-love':         'LOVE の文字を掲げる赤實之命',
      '05-ok':           'OK の文字を白で描く白油之命',
      '06-no':           'NO の文字を赤で描く赤實之命',
      '07-confused':     '汗を浮かべて困る白油之命',
      '08-waiting':      '卓の上でひとり待つ白油之命',
      '09-tired':        '自らの赤の中に倒れ伏す赤實之命',
      '12-fighting':     'ポテトを手に斬り結ぶ二柱',
      '13-greeting':     '手を取り合う二柱',
      '14-handstand':    '逆さに並び立つ二柱',
      '15-mayo-dish':    '皿の揚げ芋へ白を掛ける',
      '16-ketchup-dish': '皿の揚げ芋へ赤を掛ける',
      '17-hin':          '涙を散らして震える白油之命'
    };

    /* 卦・言・註・絵 */
    var TAKU = [
      ['大和合', '境は、混ざるために引かれている。', '分けておいたものを、一度ひとつの皿に落としてみよ。', '13-greeting'],
      ['大和合', '白と赤のあいだに、名前のない色がある。', 'それを見た者は、もう戻れない。よい意味で。', '04-love'],
      ['大和合', '傾けよ。ためらう手からは、何も落ちない。', '今日に限り、量を気にしなくてよい。', '15-mayo-dish'],
      ['大和合', '名前のない味を、名付けずにおけ。', '説明できないものを、そのまま持っていてよい。', '02-happy'],
      ['大和合', '二柱は、手を離していない。', '見えているとおりである。', '13-greeting'],
      ['和合',   '白は白のままでよい。隣に赤があれば足りる。', '急いで混ざる必要はない。', '14-handstand'],
      ['和合',   '冷蔵庫の扉は、一日に何度でも開けてよい。', '迷いは、確かめれば済むことが多い。', '01-meet'],
      ['和合',   'よく振られたものほど、まっすぐ出る。', '揺さぶられた日々を、無駄だと思うな。', '05-ok'],
      ['和合',   '皿の上には、まだ余白がある。', '足すことを恐れるな。', '16-ketchup-dish'],
      ['和合',   '誰かの手が、二つの瓶を同時に傾ける。', 'その手は、たぶん自分の手である。', '02-happy'],
      ['和合',   'よく出る日と、出ない日がある。', '今日出ないのは、瓶のせいではない。', '01-meet'],
      ['小和合', '振らねば出ぬ。', '待っていても、落ちてこないものがある。', '17-hin'],
      ['小和合', '最初のひと垂れは、いつも少し薄い。', '始めたばかりのものを、それで判断するな。', '03-sorry'],
      ['小和合', '蓋の縁に固まったものを、拭え。', '小さな滞りが、次を詰まらせる。', '07-confused'],
      ['小和合', '逆さに立てておけ。', '今日できるのは、明日のための準備だけかもしれない。', '14-handstand'],
      ['小和合', '皿の端に寄せておいたものを、忘れるな。', '後で使うつもりだったものが、ある。', '15-mayo-dish'],
      ['小和合', '少しだけ、と思ったほうがうまくいく。', '控えめが吉。', '05-ok'],
      ['半和合', '出しすぎた分は、戻らない。', '惜しむな。次は少し手前で止めよ。', '09-tired'],
      ['半和合', '混ざりきらぬまま、皿は運ばれる。', '中途半端でも、出す時が来ている。', '16-ketchup-dish'],
      ['半和合', '白が多いか、赤が多いか、まだ決まらぬ。', '決めなくてよい。今日は。', '07-confused'],
      ['半和合', '空気が混じった音がした。', '中身より先に、勢いだけが出ることがある。', '17-hin'],
      ['半和合', '同じ皿に落ちたからといって、すぐには混ざらぬ。', '隣り合う時間が、まだ要る。', '12-fighting'],
      ['半和合', '迷ったら、皿を替えよ。', '中身ではなく、器のほうを疑え。', '03-sorry'],
      ['未和合', 'まだ蓋が開いていない。', '今日は開けなくてよい。', '08-waiting'],
      ['未和合', '新しい瓶の口には、封がある。', '手間を惜しめば、封ごと落ちる。', '06-no'],
      ['未和合', '残量は、外からは見えぬ。', '相手のことも、自分のことも。', '08-waiting'],
      ['未和合', '温度が足りぬ。', '冷えたままでは、なめらかに出ない。少し待て。', '03-sorry'],
      ['未和合', '冷えたものは、まず手のひらで温めよ。', '順番がある。', '08-waiting'],
      ['離',     '分離は、腐敗ではない。', '混ざらぬまま在ることを、失敗と呼ぶな。', '09-tired'],
      ['離',     '油と水は、長く置けば必ず別れる。', '別れた後にも、瓶は瓶のままである。', '09-tired'],
      ['離',     '二柱もまた、もとは別の瓶であった。', '今日離れていることを、恥じなくてよい。', '12-fighting'],
      ['離',     '白は赤に、赤は白に、なりきれぬ。', 'なりきらぬことを、和合という。', '06-no']
    ];

    var lastIndex = -1;

    function pick() {
      var i = Math.floor(Math.random() * TAKU.length);
      if (i === lastIndex) i = (i + 1) % TAKU.length;
      lastIndex = i;
      return TAKU[i];
    }

    if (again) {
      again.addEventListener('click', function () {
        Ritual.reset();
        var sanpai = $('#sanpai');
        if (sanpai) sanpai.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'center' });
      });
    }

    return {
      reveal: function () {
        if (!section) return;
        var t = pick();
        if (elKe)   elKe.textContent = t[0];
        if (elKoto) elKoto.textContent = t[1];
        if (elChu)  elChu.textContent = t[2];
        if (elFig && t[3]) {
          elFig.src = 'images/mayo/' + t[3] + '.png';
          elFig.alt = ALT[t[3]] || '';
          elFig.hidden = false;
        }

        section.hidden = false;

        if (box) {
          box.classList.remove('is-fresh');
          void box.offsetWidth;
          box.classList.add('is-fresh');
        }

        Sound.bell();
        Record.paint();

        setTimeout(function () {
          section.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'center' });
        }, 120);
      }
    };
  })();

  /* ── 二つの道 ───────────────────────────── */

  (function michi() {
    var prompt = $('#michi-prompt');
    var after  = $('#michi-after');
    var elRes  = $('#michi-result');
    var elKoto = $('#michi-kotoba');
    var sides  = $$('.michi__side');
    if (!sides.length) return;

    var WAY = {
      white: { name: '白の道', kotoba: '掛けよ。惜しむな。足りぬより、余るほうがよい。' },
      red:   { name: '赤の道', kotoba: '浸せ。ただし、底まで沈めるな。戻れなくなる。' }
    };

    function apply(key, fresh) {
      var w = WAY[key];
      if (!w) return;

      sides.forEach(function (b) {
        var mine = b.getAttribute('data-michi') === key;
        b.classList.toggle('is-chosen', mine);
        b.classList.toggle('is-faded', !mine);
        b.setAttribute('aria-pressed', mine ? 'true' : 'false');
      });

      if (prompt) prompt.hidden = true;
      if (elRes)  elRes.textContent = w.name + 'に入りました。';
      if (elKoto) elKoto.textContent = w.kotoba;

      if (after) {
        after.hidden = false;
        if (fresh) {
          after.classList.remove('is-fresh');
          void after.offsetWidth;
        }
        after.classList.add('is-fresh');
      }
    }

    sides.forEach(function (b) {
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () {
        var key = b.getAttribute('data-michi');
        if (!WAY[key]) return;
        Store.set('michi', key);
        apply(key, true);
        Sound.bell();
        Record.paint();
      });
    });

    /* 前に選んだ道があれば、黙って戻しておく */
    if (Store.get('michi')) apply(Store.get('michi'), false);
  })();

  /* ── 賽銭 ───────────────────────────────── */

  (function saisen() {
    var box   = $('#saisenbako');
    var coin  = $('#coin');
    var after = $('#saisen-after');
    if (!box) return;

    var busy = false;

    box.addEventListener('click', function () {
      if (busy) return;
      busy = true;

      if (coin) {
        coin.classList.remove('is-tossed');
        void coin.offsetWidth;
        coin.classList.add('is-tossed');
      }
      Sound.coin();

      setTimeout(function () {
        if (after) after.hidden = false;
        busy = false;
      }, 900);
    });
  })();

  /* ── 御朱印 ─────────────────────────────── */

  var Record = (function () {
    var elDate  = $('#shuin-date');
    var elVisit = $('#rec-visit');
    var elWor   = $('#rec-worship');
    var elLight = $('#rec-light');
    var elMichi = $('#rec-michi');
    var elFirst = $('#rec-first');

    function paint() {
      var now = new Date();
      if (elDate)  elDate.textContent  = '来社 ' + wareki(now);
      if (elVisit) elVisit.textContent = String(Store.get('visits') || 1);
      if (elWor)   elWor.textContent   = String(Store.get('worships') || 0);
      if (elLight) elLight.textContent = String(Store.get('lights') || 0);
      if (elMichi) {
        var m = Store.get('michi');
        elMichi.textContent = m === 'white' ? '白の道' : m === 'red' ? '赤の道' : '未定';
      }
      if (elFirst) {
        var f = Store.get('first');
        elFirst.textContent = f ? wareki(new Date(f + 'T00:00:00')) : wareki(now);
      }
    }

    return { paint: paint };
  })();

  /* ── 参着 ───────────────────────────────── */

  (function arrive() {
    var today = isoDate(new Date());
    if (!Store.get('first')) Store.set('first', today);
    if (Store.get('last') !== today) {
      Store.bump('visits');
      Store.set('last', today);
    } else if (!Store.get('visits')) {
      Store.set('visits', 1);
    }
    Record.paint();
  })();

})();
