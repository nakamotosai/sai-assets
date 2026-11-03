/*! slide-master-senior · src/deck.js
 *  1920×1080 分页母版的装配:键盘 ← / →(含 ↑↓ PgUp/PgDn 空格 Home/End)、滚轮翻页、
 *  页码同步、窄视口等比缩放;prefers-reduced-motion: reduce 时不做平滑滚动,直接跳页。
 *  无依赖,可作为普通 <script defer> 引入(不写 import/export),也可手动调用 window.initDeck()。
 *
 *  关闭自动装配(自己控制时机):<html data-deck-autorun="off">
 */
(function () {
  "use strict";

  var DEFAULTS = {
    pages: ".page",              // 页卡选择器
    pageno: "[data-deck-pageno], .pageno", // 页码槽位(页内)
    fit: true,                   // 窄视口等比缩放
    wheelStep: 24,               // 触发也翻页的最小 |deltaY|
    wheelLock: 600,              // 滚轮翻页锁(ms)
    autorun: true                // DOM 就绪后自动装配
  };

  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)");

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function isTyping(el) {
    return !!el && (el.isContentEditable === true ||
      /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName || ""));
  }

  /**
   * @param {object} [options] 覆盖 DEFAULTS
   * @returns {{pages: Element[], index: () => number, go: (i: number) => void,
   *            next: () => void, prev: () => void, fit: () => void, destroy: () => void}}
   */
  function initDeck(options) {
    var o = {};
    var key;
    for (key in DEFAULTS) { if (Object.prototype.hasOwnProperty.call(DEFAULTS, key)) { o[key] = DEFAULTS[key]; } }
    for (key in options || {}) { if (Object.prototype.hasOwnProperty.call(options, key)) { o[key] = options[key]; } }

    var pages = Array.prototype.slice.call(document.querySelectorAll(o.pages));
    if (!pages.length) { return null; }

    var cur = 0;
    var wheelLocked = false;

    // ── 页码同步:每页槽位写成 "NN / TT"(JS 关闭时页面里的静态文案仍然正确) ──
    function syncNumbers() {
      var total = pages.length;
      pages.forEach(function (page, i) {
        var slot = page.querySelector(o.pageno);
        if (slot) { slot.textContent = pad(i + 1) + " / " + pad(total); }
      });
    }

    // ── 当前页标记:根元素 data-deck-current + 页卡 aria-current ──
    function syncCurrent() {
      pages.forEach(function (page, i) {
        if (i === cur) { page.setAttribute("aria-current", "page"); } else { page.removeAttribute("aria-current"); }
      });
      document.documentElement.dataset.deckCurrent = String(cur + 1);
    }

    function go(i) {
      cur = Math.max(0, Math.min(pages.length - 1, i));
      // reduced-motion:用 instant 直接跳页(auto 会回退到 CSS 的 scroll-behavior)
      pages[cur].scrollIntoView({
        behavior: REDUCED.matches ? "instant" : "smooth",
        block: "nearest"
      });
      syncCurrent();
    }

    // ── 键盘:← / → 为主,兼容上下、PgUp/PgDn、空格、Home/End ──
    function onKeydown(e) {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) { return; }
      var k = e.key;
      if (k === "ArrowRight" || k === "ArrowDown" || k === "PageDown" || (k === " " && !e.shiftKey)) {
        e.preventDefault(); go(cur + 1); return;
      }
      if (k === "ArrowLeft" || k === "ArrowUp" || k === "PageUp" || (k === " " && e.shiftKey)) {
        e.preventDefault(); go(cur - 1); return;
      }
      if (k === "Home") { e.preventDefault(); go(0); return; }
      if (k === "End") { e.preventDefault(); go(pages.length - 1); }
    }

    // ── 滚轮:一滚一页,锁 600ms 防止惯性连翻 ──
    function onWheel(e) {
      if (wheelLocked || Math.abs(e.deltaY) < o.wheelStep) { return; }
      wheelLocked = true;
      go(cur + (e.deltaY > 0 ? 1 : -1));
      setTimeout(function () { wheelLocked = false; }, o.wheelLock);
    }

    // ── 缩放:1920 设计稿按视口宽等比缩到 ≤1,并写进 --deck-fit 让 CSS 复用 ──
    function fit() {
      if (!o.fit) { return; }
      var avail = document.documentElement.clientWidth - 32;
      var s = Math.min(1, avail / 1920);
      document.documentElement.style.setProperty("--deck-fit", String(s));
      pages.forEach(function (page) { page.style.zoom = String(s); });
    }

    function onResize() { fit(); }

    window.addEventListener("keydown", onKeydown);
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("resize", onResize);

    syncNumbers();
    fit();
    syncCurrent();

    return {
      pages: pages,
      index: function () { return cur; },
      go: go,
      next: function () { go(cur + 1); },
      prev: function () { go(cur - 1); },
      fit: fit,
      destroy: function () {
        window.removeEventListener("keydown", onKeydown);
        window.removeEventListener("wheel", onWheel);
        window.removeEventListener("resize", onResize);
      }
    };
  }

  function autorun() {
    if (document.documentElement.dataset.deckAutorun === "off") { return; }
    if (!document.querySelector(DEFAULTS.pages)) { return; }
    window.deck = initDeck();
  }

  window.initDeck = initDeck;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autorun, { once: true });
  } else {
    autorun();
  }
}());
