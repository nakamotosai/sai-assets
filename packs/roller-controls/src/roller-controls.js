/*!
 * roller-controls.js — 滚筒当前值同步 / 波形柱高 / dock 锥形缩放
 * MIT License · sai-assets pack roller-controls v1.0.0
 * 零依赖。滚筒用原生滚动(惯性、触控、键盘都由浏览器给),这里只负责「把当前项标出来」;
 * 滑杆底层是原生 range,柱高只是它的可视化,键盘与屏幕阅读器不受影响。
 */
(function () {
  "use strict";

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── 1 · 滚筒:滚到哪个,哪个就是当前项 ───────────────── */
  function initWheel(wheel) {
    var items = Array.prototype.slice.call(wheel.querySelectorAll(".rc-wheel-item"));
    if (!items.length) return;
    // 读数用显式引用(选择器字符串),不做"往上找一个"的猜测:两枚并排时那种猜测必然抢。
    var ref = wheel.getAttribute("data-rc-readout");
    var readout = ref ? document.querySelector(ref) : null;
    var onChange = wheel.getAttribute("data-rc-onchange");
    var raf = null;

    var nearestIndex = function () {
      var mid = wheel.scrollTop + wheel.clientHeight / 2;
      var best = 0;
      var bestDist = Infinity;
      for (var i = 0; i < items.length; i++) {
        var center = items[i].offsetTop + items[i].offsetHeight / 2;
        var d = Math.abs(center - mid);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      return best;
    };

    var sync = function () {
      var best = nearestIndex();
      items.forEach(function (el, i) {
        var on = i === best;
        if (on) el.setAttribute("aria-selected", "true");
        else el.removeAttribute("aria-selected");
      });
      if (readout) readout.textContent = items[best].textContent.trim();
      if (onChange) {
        wheel.dispatchEvent(new CustomEvent(onChange, {
          bubbles: true,
          detail: { value: items[best].textContent.trim(), index: best },
        }));
      }
    };

    var schedule = function () {
      if (raf) return;
      raf = window.requestAnimationFrame(function () {
        raf = null;
        sync();
      });
    };

    wheel.addEventListener("scroll", schedule, { passive: true });
    // 点某一项直接滚到它(原生 smooth;减速时用 auto)
    items.forEach(function (el, i) {
      el.addEventListener("click", function () { goTo(i); });
    });
    // 方向键:一档一档走(原生滚动不会吸附到相邻项)
    var goTo = function (i) {
      i = Math.max(0, Math.min(items.length - 1, i));
      wheel.scrollTo({
        top: items[i].offsetTop - (wheel.clientHeight - items[i].offsetHeight) / 2,
        behavior: reduce ? "auto" : "smooth",
      });
      // 立刻落标:连按两下时若只等 scroll 事件,第二次会读到上一档的位置,只走一步。
      items.forEach(function (el, j) {
        if (j === i) el.setAttribute("aria-selected", "true");
        else el.removeAttribute("aria-selected");
      });
      if (readout) readout.textContent = items[i].textContent.trim();
      return i;
    };

    wheel.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "PageDown" && e.key !== "PageUp") return;
      e.preventDefault();
      var step = (e.key === "ArrowDown" || e.key === "PageDown") ? 1 : -1;
      // 当前位置以滚动量为准(不读 aria-selected,那是渲染结果、有延迟)
      goTo(nearestIndex() + step);
    });

    // 初始定位到 aria-selected 的那项(无则第一个)
    var start = items.findIndex(function (el) { return el.getAttribute("aria-selected") === "true"; });
    if (start > 0) {
      wheel.scrollTop = items[start].offsetTop - (wheel.clientHeight - items[start].offsetHeight) / 2;
    }
    sync();
  }

  /* ── 2 · 波形滑杆:柱高与点亮跟随 value ────────────────── */
  function initWave(field) {
    var range = field.querySelector(".rc-range");
    var bars = Array.prototype.slice.call(field.querySelectorAll(".rc-bars i"));
    var out = field.parentElement.querySelector(".rc-value");
    if (!range || !bars.length) return;

    var update = function () {
      var min = Number(range.min || 0);
      var max = Number(range.max || 100);
      var v = Number(range.value);
      var t = (v - min) / (max - min || 1);
      var n = bars.length;
      // 每根柱的高度:离拇指越近越高,形成一条跟随指针起伏的弧
      for (var i = 0; i < n; i++) {
        var d = Math.abs(i / (n - 1) - t);
        var h = Math.max(0.12, 1 - d * 1.9);
        bars[i].style.setProperty("--rc-bar", h.toFixed(3));
        if (i / (n - 1) <= t) bars[i].setAttribute("data-on", "");
        else bars[i].removeAttribute("data-on");
      }
      if (out) out.textContent = String(v);
      range.setAttribute("aria-valuetext", String(v));
    };

    range.addEventListener("input", update);
    update();
  }

  /* ── 3 · dock:按指针到各按钮中心的距离做锥形缩放 ───────── */
  function initDock(dock) {
    if (reduce) return; // 减速模式不做形变,底部对齐已在 CSS 里退回
    var btns = Array.prototype.slice.call(dock.querySelectorAll(".rc-dock-btn"));
    var MAX = 1.42;      // 中心按钮最大放大
    var REACH = 118;     // 影响半径(px)

    var frame = null;
    var pointer = { x: null };

    var apply = function () {
      frame = null;
      for (var i = 0; i < btns.length; i++) {
        var r = btns[i].getBoundingClientRect();
        var cx = r.left + r.width / 2;
        var s = 1;
        if (pointer.x !== null) {
          var d = Math.abs(cx - pointer.x);
          if (d < REACH) s = 1 + (MAX - 1) * Math.pow(1 - d / REACH, 2);
        }
        btns[i].style.setProperty("--rc-s", s.toFixed(3));
      }
    };
    var schedule = function () {
      if (!frame) frame = window.requestAnimationFrame(apply);
    };

    dock.addEventListener("pointermove", function (e) {
      pointer.x = e.clientX;
      schedule();
    }, { passive: true });
    dock.addEventListener("pointerleave", function () {
      pointer.x = null;
      schedule();
    });
    dock.addEventListener("focusin", function (e) {
      var btn = e.target.closest(".rc-dock-btn");
      if (!btn) return;
      var r = btn.getBoundingClientRect();
      pointer.x = r.left + r.width / 2;
      schedule();
    });
    dock.addEventListener("focusout", function () {
      pointer.x = null;
      schedule();
    });
    apply();
  }

  function boot() {
    document.querySelectorAll("[data-rc-root]").forEach(function (root) {
      root.querySelectorAll("[data-rc-wheel]").forEach(initWheel);
      root.querySelectorAll("[data-rc-wave]").forEach(initWave);
      root.querySelectorAll("[data-rc-dock]").forEach(initDock);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
