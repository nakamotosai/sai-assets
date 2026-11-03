/* ============================================================================
 * swiss-style · src/swiss-motion.js
 * 入场配方:计数入位(count-up) · 卡片归格(fly-and-settle) · 网格显影(grid reveal)
 * ----------------------------------------------------------------------------
 * ⚠️ 重要声明:不存在官方「瑞士风格动效系统」。瑞士风格是静态印刷方法;
 *    下面是**从实践中派生的、与瑞士原则一致的**动效语言,按「派生规则」
 *    而非「历史规范」使用。derived, not canon —— 别当史实引用。
 * 口径:短促 ease-out、只动 transform/opacity(不动 layout)、禁弹跳/旋转/过冲、
 *      单帧 ≤600ms;prefers-reduced-motion 时直接落终态。
 * 用法(在 preview 及消费页):
 *   <div data-swiss-count="1240">0</div>              → 视口内从 0 滚到 1240
 *   <article data-swiss-settle data-swiss-index="0">  → 归格入场(错峰 70ms)
 *   <div data-swiss-grid-reveal>…</div>               → 触发同容器的 .grid-lines 显影再隐
 *   <button data-swiss-grid-toggle>                   → 切换 body.show-grid(教学网格线)
 * ========================================================================== */
(function () {
  "use strict";

  var doc = document;
  var mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  var reduce = !!(mq && mq.matches);
  if (mq && mq.addEventListener) {
    mq.addEventListener("change", function (e) { reduce = e.matches; });
  }

  var DUR = { fast: 160, base: 280, slow: 480 };
  var STAGGER = 70; /* ms */

  /* ------------------------------------------------------ 计数入位 */
  var counting = [];
  var rafId = null;

  function tick(now) {
    var w = 0;
    for (var i = 0; i < counting.length; i++) {
      var c = counting[i];
      var t = (now - c.start) / c.dur;
      if (t > 1) t = 1;
      var e = 1 - (1 - t) * (1 - t) * (1 - t); /* ease-out cubic */
      c.el.textContent = String(Math.round(c.from + (c.to - c.from) * e));
      if (t < 1) { counting[w++] = c; }
    }
    counting.length = w;
    rafId = w ? window.requestAnimationFrame(tick) : null;
  }

  function countUp(el) {
    if (el.getAttribute("data-swiss-done") === "1") return;
    el.setAttribute("data-swiss-done", "1");
    var to = parseFloat(el.getAttribute("data-swiss-count")) || 0;
    if (reduce) { el.textContent = String(to); return; }
    counting.push({ el: el, from: 0, to: to, start: window.performance.now(), dur: DUR.slow });
    if (rafId === null) rafId = window.requestAnimationFrame(tick);
  }

  /* ------------------------------------------------------ 卡片归格 */
  function settle(el, index) {
    if (el.getAttribute("data-swiss-done") === "1") return;
    el.setAttribute("data-swiss-done", "1");
    if (reduce) { el.classList.add("is-settled"); return; }
    el.style.transitionDelay = index * STAGGER + "ms";
    window.requestAnimationFrame(function () { el.classList.add("is-settled"); });
  }

  /* ------------------------------------------------------ 网格显影 */
  function revealGrid(el) {
    var host = el.closest ? el.closest(".swiss-grid-demo") : null;
    var lines = (host || el.parentNode).querySelector(".grid-lines");
    if (!lines) return;
    if (reduce) return; /* 直接终态 = 不显影 */
    lines.classList.add("is-on");
    window.setTimeout(function () { lines.classList.remove("is-on"); }, 700 + DUR.base);
  }

  /* -------------------------------------------------- 观察器(单个) */
  function dispatch(el) {
    if (el.hasAttribute("data-swiss-count")) { countUp(el); return; }
    if (el.hasAttribute("data-swiss-settle")) {
      settle(el, parseInt(el.getAttribute("data-swiss-index"), 10) || 0);
      return;
    }
    if (el.hasAttribute("data-swiss-grid-reveal")) { revealGrid(el); }
  }

  function finalState(el) {
    if (el.hasAttribute("data-swiss-count")) { el.textContent = String(parseFloat(el.getAttribute("data-swiss-count")) || 0); }
    if (el.hasAttribute("data-swiss-settle")) { el.classList.add("is-settled"); }
  }

  function start() {
    var nodes = doc.querySelectorAll("[data-swiss-count],[data-swiss-settle],[data-swiss-grid-reveal]");
    Array.prototype.forEach.call(nodes, function (el) {
      if (reduce || !("IntersectionObserver" in window)) { finalState(el); dispatch(el); }
    });
    if (reduce || !("IntersectionObserver" in window)) return;

    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var en = entries[i];
        if (!en.isIntersecting) continue;
        io.unobserve(en.target);
        dispatch(en.target);
      }
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.2 });

    Array.prototype.forEach.call(nodes, function (el) { io.observe(el); });
  }

  /* -------------------------------------------------- 教学网格线开关 */
  function bindGridToggles() {
    var btns = doc.querySelectorAll("[data-swiss-grid-toggle]");
    Array.prototype.forEach.call(btns, function (btn) {
      btn.setAttribute("aria-pressed", "false");
      btn.addEventListener("click", function () {
        var on = doc.body.classList.toggle("show-grid");
        btn.setAttribute("aria-pressed", String(on));
        btn.textContent = on
          ? (btn.getAttribute("data-label-on") || "隐藏网格 Hide grid")
          : (btn.getAttribute("data-label-off") || "显示网格 Show grid");
      });
    });
  }

  function boot() { bindGridToggles(); start(); }

  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  /* 供消费页/框架手动触发 */
  window.SwissMotion = {
    play: start,
    revealGrid: revealGrid,
    durations: DUR,
    reducedMotion: function () { return reduce; }
  };
})();
