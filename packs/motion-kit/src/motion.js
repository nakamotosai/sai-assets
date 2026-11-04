/* motion-kit — 动效层
   Vanilla, dependency-free, progressive: no JS -> static site.
   Everything is gated behind prefers-reduced-motion in the boot script. */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  var fine = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
  var hasFinePointer = !!fine;

  var raf = window.requestAnimationFrame
    ? window.requestAnimationFrame.bind(window)
    : function (fn) { return window.setTimeout(fn, 16); };

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  root.classList.add('motion-ready');

  /* ── Shared scroll frame ───────────────────────────────────────────── */
  var scrollFns = [];
  function onScrollFrame(fn) { scrollFns.push(fn); }

  var ticking = false;
  function requestScroll() {
    if (ticking) return;
    ticking = true;
    raf(function () {
      ticking = false;
      for (var i = 0; i < scrollFns.length; i++) scrollFns[i]();
    });
  }
  window.addEventListener('scroll', requestScroll, { passive: true });
  window.addEventListener('resize', requestScroll, { passive: true });

  /* ── Split text ────────────────────────────────────────────────────── */
  var NO_LINE_START = '、。,,.;:!?)]}」』】》〉·…—-';
  function splitWords(el) {
    if (el.getAttribute('data-split-done')) return;
    var text = el.textContent || '';
    if (!text.trim()) return;
    /* 本包增补:空白切词对中文/日文标题无效(整句就是一个 token),那时用 data-split="chars" 逐字切。
       按码位切,不拆代理对。 */
    var perChar = el.getAttribute('data-split') === 'chars';
    var tokens = text.split(/(\s+)/);
    if (perChar) {
      /* 逐字切时把「不能出现在行首」的标点粘回前一个字,否则换行会以「、」「。」开头(禁则)。 */
      var chars = Array.from(text);
      tokens = [];
      for (var ci = 0; ci < chars.length; ci++) {
        var ch = chars[ci];
        if (NO_LINE_START.indexOf(ch) >= 0 && tokens.length) { tokens[tokens.length - 1] += ch; continue; }
        tokens.push(ch);
      }
    }
    var frag = doc.createDocumentFragment();
    var index = 0;
    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i];
      if (!token) continue;
      if (/^\s+$/.test(token)) { frag.appendChild(doc.createTextNode(token)); continue; }
      var outer = doc.createElement('span');
      outer.className = 'split-word';
      var inner = doc.createElement('span');
      inner.textContent = token;
      inner.style.setProperty('--i', index++);
      outer.appendChild(inner);
      frag.appendChild(outer);
    }
    el.textContent = '';
    el.appendChild(frag);
    el.setAttribute('data-split-done', '1');
  }

  /* ── Stagger groups ────────────────────────────────────────────────── */
  function prepareStagger() {
    var groups = doc.querySelectorAll('[data-reveal-stagger]');
    for (var g = 0; g < groups.length; g++) {
      var children = groups[g].children;
      for (var i = 0; i < children.length; i++) {
        var child = children[i];
        if (!child.hasAttribute('data-reveal')) child.setAttribute('data-reveal', '');
        if (!child.style.getPropertyValue('--reveal-delay')) {
          child.style.setProperty('--reveal-delay', String(i));
        }
      }
    }
  }

  /* ── Counters ──────────────────────────────────────────────────────── */
  function animateCount(el) {
    if (el.getAttribute('data-count-done')) return;
    var target = parseFloat(el.getAttribute('data-count'));
    if (isNaN(target)) return;
    el.setAttribute('data-count-done', '1');
    var start = null;
    var duration = 900;
    function tick(t) {
      if (start === null) start = t;
      var p = clamp((t - start) / duration, 0, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(target * eased));
      if (p < 1) raf(tick); else el.textContent = String(target);
    }
    raf(tick);
  }

  function triggerCounts(scope) {
    if (scope.hasAttribute && scope.hasAttribute('data-count')) animateCount(scope);
    var found = scope.querySelectorAll ? scope.querySelectorAll('[data-count]') : [];
    for (var i = 0; i < found.length; i++) animateCount(found[i]);
  }

  /* ── Reveal + split observer ───────────────────────────────────────── */
  function initReveal() {
    var splitEls = [].slice.call(doc.querySelectorAll('[data-split]'));
    for (var s = 0; s < splitEls.length; s++) splitWords(splitEls[s]);

    var revealEls = [].slice.call(doc.querySelectorAll('[data-reveal]'));
    var all = revealEls.concat(splitEls).filter(function (el, i, arr) {
      return arr.indexOf(el) === i;
    });

    var pending = all.slice();

    function revealNode(node) {
      if (node.classList.contains('is-inview')) return;
      node.classList.add('is-inview');
      triggerCounts(node);
      var idx = pending.indexOf(node);
      if (idx >= 0) pending.splice(idx, 1);
    }

    function sweep() {
      if (!pending.length) return;
      var innerHeight = window.innerHeight || 800;
      for (var i = pending.length - 1; i >= 0; i--) {
        var node = pending[i];
        var rect = node.getBoundingClientRect();
        if (rect.top < innerHeight * 0.96) revealNode(node);
      }
    }

    if (!('IntersectionObserver' in window)) {
      for (var k = 0; k < all.length; k++) revealNode(all[k]);
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        if (!entry.isIntersecting) continue;
        revealNode(entry.target);
        io.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.06 });

    var vh = window.innerHeight || 800;
    for (var j = 0; j < all.length; j++) {
      var el = all[j];
      var rect = el.getBoundingClientRect();
      if (rect.top < vh * 0.94) {
        (function (node) {
          raf(function () {
            raf(function () { revealNode(node); });
          });
        })(el);
      } else {
        io.observe(el);
      }
    }

    onScrollFrame(sweep);
  }

  /* ── Tilt ──────────────────────────────────────────────────────────── */
  function initTilt() {
    if (!hasFinePointer) return;
    var els = doc.querySelectorAll('[data-tilt]');
    for (var i = 0; i < els.length; i++) {
      (function (el) {
        var rect = null;
        el.addEventListener('pointerenter', function () {
          rect = el.getBoundingClientRect();
          el.classList.add('is-tilting');
        }, { passive: true });
        el.addEventListener('pointermove', function (e) {
          if (!rect) rect = el.getBoundingClientRect();
          var px = (e.clientX - rect.left) / rect.width;
          var py = (e.clientY - rect.top) / rect.height;
          el.style.setProperty('--rx', ((0.5 - py) * 6).toFixed(2) + 'deg');
          el.style.setProperty('--ry', ((px - 0.5) * 8).toFixed(2) + 'deg');
          el.style.setProperty('--mx', (px * 100).toFixed(2) + '%');
          el.style.setProperty('--my', (py * 100).toFixed(2) + '%');
        }, { passive: true });
        el.addEventListener('pointerleave', function () {
          el.classList.remove('is-tilting');
          el.style.removeProperty('--rx');
          el.style.removeProperty('--ry');
          el.style.removeProperty('--mx');
          el.style.removeProperty('--my');
          rect = null;
        });
      })(els[i]);
    }
  }

  /* ── Magnetic controls ─────────────────────────────────────────────── */
  function initMagnetic() {
    if (!hasFinePointer) return;
    var els = doc.querySelectorAll('[data-magnetic]');
    for (var i = 0; i < els.length; i++) {
      (function (el) {
        var rect = null;
        var strength = 7;
        el.addEventListener('pointerenter', function () {
          rect = el.getBoundingClientRect();
        }, { passive: true });
        el.addEventListener('pointermove', function (e) {
          if (!rect) rect = el.getBoundingClientRect();
          var x = clamp((e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2), -1, 1);
          var y = clamp((e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2), -1, 1);
          el.style.setProperty('--mx', (x * strength).toFixed(2) + 'px');
          el.style.setProperty('--my', (y * strength).toFixed(2) + 'px');
        }, { passive: true });
        el.addEventListener('pointerleave', function () {
          el.style.removeProperty('--mx');
          el.style.removeProperty('--my');
          rect = null;
        });
      })(els[i]);
    }
  }

  /* ── Cursor + contextual label ─────────────────────────────────────── */
  function initCursor() {
    if (!hasFinePointer) return;
    root.classList.add('has-cursor');

    var ring = doc.createElement('div');
    ring.className = 'cursor';
    ring.setAttribute('aria-hidden', 'true');
    ring.innerHTML = '<span class="cursor-ring"></span><span class="cursor-dot"></span>';
    doc.body.appendChild(ring);

    var label = doc.createElement('div');
    label.className = 'cursor-label';
    label.setAttribute('aria-hidden', 'true');
    doc.body.appendChild(label);

    var pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    var ringPos = { x: pointer.x, y: pointer.y };
    var labelPos = { x: pointer.x, y: pointer.y };
    var labelHost = null;

    window.addEventListener('pointermove', function (e) {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      ring.classList.add('is-visible');
    }, { passive: true });

    window.addEventListener('pointerdown', function () { ring.classList.add('is-down'); }, { passive: true });
    window.addEventListener('pointerup', function () { ring.classList.remove('is-down'); }, { passive: true });

    doc.addEventListener('mouseleave', function () {
      ring.classList.remove('is-visible');
      label.classList.remove('is-visible');
    });

    doc.addEventListener('mouseover', function (e) {
      var target = e.target;
      if (!target || !target.closest) return;
      if (target.closest('a,button,input,textarea,select,summary,[data-tilt]')) {
        ring.classList.add('is-hover');
      } else {
        ring.classList.remove('is-hover');
      }
      var host = target.closest('[data-cursor-label]');
      if (host) {
        if (host !== labelHost) {
          labelHost = host;
          label.textContent = host.getAttribute('data-cursor-label') || '';
        }
        label.classList.add('is-visible');
      } else {
        labelHost = null;
        label.classList.remove('is-visible');
      }
    });

    function loop() {
      ringPos.x = lerp(ringPos.x, pointer.x, 0.2);
      ringPos.y = lerp(ringPos.y, pointer.y, 0.2);
      labelPos.x = lerp(labelPos.x, pointer.x, 0.14);
      labelPos.y = lerp(labelPos.y, pointer.y, 0.14);
      ring.style.setProperty('--cx', ringPos.x.toFixed(2) + 'px');
      ring.style.setProperty('--cy', ringPos.y.toFixed(2) + 'px');
      label.style.setProperty('--cx', (labelPos.x + 18).toFixed(2) + 'px');
      label.style.setProperty('--cy', (labelPos.y + 22).toFixed(2) + 'px');
      raf(loop);
    }
    raf(loop);
  }

  /* ── Hero canvas field + pointer light ─────────────────────────────── */
  function initHero() {
    var hero = doc.querySelector('[data-hero]');
    var canvas = doc.querySelector('[data-hero-canvas]');
    if (!hero || !canvas || !canvas.getContext) return;

    var ctx = canvas.getContext('2d');
    var heroGlow = doc.querySelector('[data-hero-glow]');
    var w = 1, h = 1, dpr = 1;
    var points = [];
    var pointer = { x: -10000, y: -10000, active: false };
    var visible = true;
    var glow = { x: 0, y: 0 };

    function themeRgb() {
      return root.getAttribute('data-theme') === 'light' ? '23,23,15' : '232,230,225';
    }

    function resize() {
      var rect = hero.getBoundingClientRect();
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var count = clamp(Math.round((w * h) / 21000), 26, 88);
      if (window.innerWidth < 768) count = Math.round(count * 0.62);
      points = [];
      for (var i = 0; i < count; i++) {
        points.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.18,
          vy: (Math.random() - 0.5) * 0.18
        });
      }
      glow.x = w / 2;
      glow.y = h / 2;
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      var rgb = themeRgb();
      var i, j, a, b, dx, dy, d;
      for (i = 0; i < points.length; i++) {
        a = points[i];
        a.x += a.vx;
        a.y += a.vy;
        if (a.x < -24) a.x = w + 24; else if (a.x > w + 24) a.x = -24;
        if (a.y < -24) a.y = h + 24; else if (a.y > h + 24) a.y = -24;
      }
      ctx.lineWidth = 1;
      for (i = 0; i < points.length; i++) {
        a = points[i];
        for (j = i + 1; j < points.length; j++) {
          b = points[j];
          dx = a.x - b.x;
          dy = a.y - b.y;
          d = Math.sqrt(dx * dx + dy * dy);
          if (d < 132) {
            ctx.strokeStyle = 'rgba(' + rgb + ',' + ((1 - d / 132) * 0.16).toFixed(3) + ')';
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
        if (pointer.active) {
          dx = a.x - pointer.x;
          dy = a.y - pointer.y;
          d = Math.sqrt(dx * dx + dy * dy);
          if (d < 176) {
            ctx.strokeStyle = 'rgba(' + rgb + ',' + ((1 - d / 176) * 0.3).toFixed(3) + ')';
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(pointer.x, pointer.y);
            ctx.stroke();
          }
        }
      }
      ctx.fillStyle = 'rgba(' + rgb + ',0.42)';
      for (i = 0; i < points.length; i++) {
        a = points[i];
        ctx.beginPath();
        ctx.arc(a.x, a.y, 1.15, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function frame() {
      if (visible && !doc.hidden) {
        draw();
        if (heroGlow) {
          var tx = pointer.active ? pointer.x : w / 2;
          var ty = pointer.active ? pointer.y : h / 2;
          glow.x = lerp(glow.x, tx, 0.06);
          glow.y = lerp(glow.y, ty, 0.06);
          heroGlow.style.transform = 'translate3d(' + glow.x.toFixed(1) + 'px,' + glow.y.toFixed(1) + 'px,0)';
        }
      }
      raf(frame);
    }

    hero.addEventListener('pointermove', function (e) {
      var rect = hero.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.active = true;
    }, { passive: true });

    hero.addEventListener('pointerleave', function () {
      pointer.active = false;
      pointer.x = -10000;
      pointer.y = -10000;
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
      }, { threshold: 0.01 }).observe(hero);
    }

    window.addEventListener('resize', resize);
    resize();
    raf(frame);
  }

  /* ── Process rail ──────────────────────────────────────────────────── */
  function initProcess() {
    var wrap = doc.querySelector('[data-process]');
    if (!wrap) return;
    var fill = wrap.querySelector('.process-track span');
    var steps = [].slice.call(wrap.querySelectorAll('.process-step'));
    if (!steps.length) return;

    function update() {
      var rect = wrap.getBoundingClientRect();
      var vh = window.innerHeight || 800;
      var travel = rect.height + vh * 0.7;
      var progress = clamp((vh * 0.85 - rect.top) / travel, 0, 1);
      if (fill) fill.style.transform = 'scaleX(' + progress.toFixed(4) + ')';
      for (var i = 0; i < steps.length; i++) {
        steps[i].classList.toggle('is-active', progress >= (i + 0.2) / steps.length);
      }
    }

    onScrollFrame(update);
    update();
  }

  /* ── Scroll-linked image drift ─────────────────────────────────────── */
  function initParallax() {
    var cards = [].slice.call(doc.querySelectorAll('.work-card'));
    if (!cards.length) return;

    function update() {
      var vh = window.innerHeight || 800;
      for (var i = 0; i < cards.length; i++) {
        var card = cards[i];
        var rect = card.getBoundingClientRect();
        if (rect.bottom < -80 || rect.top > vh + 80) continue;
        var img = card.querySelector('.work-media img');
        if (!img) continue;
        var p = (rect.top + rect.height / 2 - vh / 2) / vh;
        img.style.setProperty('--py', (clamp(p, -1, 1) * 14).toFixed(2) + 'px');
      }
    }

    onScrollFrame(update);
    update();
  }

  /* ── Header state, progress bar, active nav ────────────────────────── */
  function initHeaderAndNav() {
    var header = doc.querySelector('.site-header');
    var bar = doc.querySelector('.scroll-progress span');
    var links = [].slice.call(doc.querySelectorAll('.nav > a[href^="#"]:not(.nav-cta)'));
    var sections = [];
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href');
      var section = href && href.length > 1 ? doc.querySelector(href) : null;
      if (section) sections.push(section);
    }

    function update() {
      var top = window.pageYOffset || root.scrollTop || doc.body.scrollTop || 0;
      var max = Math.max(1, doc.documentElement.scrollHeight - window.innerHeight);
      if (bar) bar.style.transform = 'scaleX(' + clamp(top / max, 0, 1).toFixed(4) + ')';
      if (header) header.classList.toggle('is-scrolled', top > 6);
      if (sections.length) {
        var probe = top + window.innerHeight * 0.32;
        var active = null;
        for (var s = 0; s < sections.length; s++) {
          if (sections[s].offsetTop <= probe) active = sections[s].id;
        }
        for (var l = 0; l < links.length; l++) {
          links[l].classList.toggle('is-active', links[l].getAttribute('href') === '#' + active);
        }
      }
    }

    onScrollFrame(update);
    update();
  }

  /* ── FAQ height animation ──────────────────────────────────────────── */
  function initFaq() {
    var items = doc.querySelectorAll('.faq-item');
    for (var i = 0; i < items.length; i++) {
      (function (item) {
        var summary = item.querySelector('summary');
        var answer = item.querySelector('.faq-answer');
        if (!summary || !answer) return;
        var animating = false;

        summary.addEventListener('click', function (event) {
          event.preventDefault();
          if (animating) return;
          animating = true;

          if (!item.hasAttribute('open')) {
            item.setAttribute('open', '');
            var openHeight = answer.scrollHeight;
            answer.style.height = '0px';
            answer.style.opacity = '0';
            raf(function () {
              raf(function () {
                answer.style.transition = 'height 0.38s cubic-bezier(0.22,1,0.36,1), opacity 0.3s ease';
                answer.style.height = openHeight + 'px';
                answer.style.opacity = '1';
              });
            });
            window.setTimeout(function () {
              answer.style.height = '';
              answer.style.opacity = '';
              answer.style.transition = '';
              animating = false;
            }, 430);
          } else {
            var closeHeight = answer.scrollHeight;
            answer.style.height = closeHeight + 'px';
            raf(function () {
              raf(function () {
                answer.style.transition = 'height 0.32s cubic-bezier(0.22,1,0.36,1), opacity 0.25s ease';
                answer.style.height = '0px';
                answer.style.opacity = '0';
              });
            });
            window.setTimeout(function () {
              item.removeAttribute('open');
              answer.style.height = '';
              answer.style.opacity = '';
              answer.style.transition = '';
              animating = false;
            }, 370);
          }
        });
      })(items[i]);
    }
  }

  /* ── Theme transition (circular reveal) ────────────────────────────── */
  function initThemeTransition() {
    if (typeof doc.startViewTransition !== 'function') return;
    if (typeof window.motionKit.applyTheme !== 'function') return;

    window.motionKit.viewTheme = function (next) {
      var button = doc.getElementById('theme-toggle');
      var x = '50%';
      var y = '50%';
      if (button) {
        var rect = button.getBoundingClientRect();
        x = (rect.left + rect.width / 2) + 'px';
        y = (rect.top + rect.height / 2) + 'px';
      }
      root.style.setProperty('--vt-x', x);
      root.style.setProperty('--vt-y', y);
      root.classList.add('vt-theme');
      var transition = doc.startViewTransition(function () {
        window.motionKit.applyTheme(next, true);
      });
      if (transition && transition.finished && transition.finished.finally) {
        transition.finished.finally(function () { root.classList.remove('vt-theme'); });
      } else {
        root.classList.remove('vt-theme');
      }
    };
  }

  /* ── Boot ──────────────────────────────────────────────────────────── */
  function boot() {
    prepareStagger();
    initReveal();
    initTilt();
    initMagnetic();
    initCursor();
    initHero();
    initProcess();
    initParallax();
    initHeaderAndNav();
    initFaq();
    initThemeTransition();
    requestScroll();
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
