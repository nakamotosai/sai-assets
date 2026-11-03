/* dual-theme-toggle · theme-toggle.js
   两件工具,一个文件,互不干扰:
     ① 两态主题切换:无边框纯图标按钮、44px 热区、aria-label、选择写 localStorage、"无 JS 跟系统"
     ② 定长丝滑滚动:原生 smooth 的时长由浏览器定(约 300ms),要"2 秒"这种能看清的过程只能自己算

   防闪那条**不在**这里:应用存过的主题必须放在 <head> 里提前贴(见 docs/usage.md 第一行),
   放到 </body> 前会让选过浅色的用户每次刷新先闪一帧深色。

   页面只需要引这个文件;按钮若不存在,JS 会自己造一个(见 mountButton)。*/

(function () {
  'use strict';

  var R = document.documentElement;
  var DEFAULT_KEY = 'theme';
  var SKIP = 'skip'; // set(..., {persist:false}) 的内部标记
  var mq = window.matchMedia('(prefers-color-scheme: light)');
  var btn = null;

  /* ---------- 读写选择 ---------- */

  function storageKey() {
    var host = document.querySelector('[data-theme-toggle]');
    var v = (host && host.getAttribute('data-theme-toggle')) || R.getAttribute('data-theme-key');
    return (v && v.trim()) || DEFAULT_KEY;
  }

  function read() {
    try {
      var v = localStorage.getItem(storageKey());
      return (v === 'light' || v === 'dark') ? v : null;
    } catch (e) { // 隐私模式 / 禁用存储:当作"没选过",继续跟随系统
      return null;
    }
  }

  function write(v) {
    try {
      if (v) localStorage.setItem(storageKey(), v);
      else localStorage.removeItem(storageKey());
    } catch (e) {}
  }

  /* 当前实际生效的深浅:用户的显式选择优先,否则跟系统 */
  function resolvedValue() {
    return read() || (mq.matches ? 'light' : 'dark');
  }

  /* ---------- 落笔 ---------- */

  function commit(v, persist) {
    var choice = (v === 'light' || v === 'dark') ? v : null;

    function paint() {
      // data-theme 只在"用户选过"时存在;没有它就由 CSS 的 @media 跟随系统
      if (choice) R.setAttribute('data-theme', choice);
      else R.removeAttribute('data-theme');
      // data-resolved 永远反映实际生效值,给图标与页面脚本用
      R.setAttribute('data-resolved', resolvedValue());
      if (persist !== false) write(choice);
      label();
    }

    if (document.startViewTransition &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      try { document.startViewTransition(paint); } catch (e) { paint(); }
    } else {
      paint();
    }
    R.dispatchEvent(new CustomEvent('themechange', {
      detail: { theme: resolvedValue(), explicit: !!choice }
    }));
  }

  function label() {
    if (!btn) return;
    var next = resolvedValue() === 'dark' ? '浅色' : '深色';
    btn.setAttribute('aria-label', '切换到' + next + '主题');
    btn.setAttribute('title', '切换到' + next + '主题');
  }

  /* ---------- 按钮 ---------- */

  var ICONS =
    '<svg class="i-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
    ' stroke-linecap="round" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="4.2"/>' +
    '<path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2' +
    'M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6"/></svg>' +
    '<svg class="i-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
    ' stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M20.4 14.6A8.6 8.6 0 0 1 9.4 3.6a8.6 8.6 0 1 0 11 11Z"/></svg>';

  function mountButton() {
    btn = document.querySelector('.tt[data-tt-mounted]') || document.querySelector('[data-theme-toggle]');
    if (!btn) {
      // 页面没给宿主:造一个,优先塞进 header / .topbar / [data-tt-mount],都没有就浮在右上角
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tt';
      btn.setAttribute('data-theme-toggle', storageKey());
      var slot = document.querySelector('header, .topbar, [data-tt-mount]');
      if (slot) slot.appendChild(btn);
      else { btn.classList.add('tt--float'); document.body.appendChild(btn); }
    }
    if (!btn.classList.contains('tt')) btn.classList.add('tt');
    if (!btn.querySelector('.i-sun')) btn.innerHTML = ICONS;
    if (btn.getAttribute('aria-label') === null) label();
    btn.setAttribute('data-tt-mounted', '');
    btn.addEventListener('click', function () {
      commit(resolvedValue() === 'dark' ? 'light' : 'dark', true);
    });
  }

  /* ---------- 跟随系统(用户没选过时才跟) ---------- */

  function followSystem() {
    if (read()) return;
    R.setAttribute('data-resolved', resolvedValue());
    label();
  }

  if (mq.addEventListener) mq.addEventListener('change', followSystem);
  else if (mq.addListener) mq.addListener(followSystem);

  // 另一个标签页改了选择:同步过来(不改自己的存储,只重画)
  window.addEventListener('storage', function (e) {
    if (e.key === storageKey()) {
      R.setAttribute('data-resolved', resolvedValue());
      commit(read(), false);
    }
  });

  /* ---------- 开机 ---------- */

  function boot() {
    mountButton();
    // 存过的选择在 <head> 已贴标;这里把实际生效值补进 data-resolved 并修正 aria-label
    var stored = read();
    if (stored) R.setAttribute('data-theme', stored);
    else R.removeAttribute('data-theme');
    R.setAttribute('data-resolved', resolvedValue());
    label();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* ---------- 对外接口 ---------- */

  window.themeToggle = {
    /** 当前生效值:'light' | 'dark' */
    get: resolvedValue,
    /** 是否用户显式选过 */
    get explicit() { return !!read(); },
    /** 写入选择并落笔;set(null) = 清掉选择、回到跟随系统 */
    set: function (v) { commit(v, true); },
    /** 清掉选择,回到跟随系统(并立即按系统重画) */
    follow: function () { commit(null, true); },
    /** 切换 */
    toggle: function () { commit(resolvedValue() === 'dark' ? 'light' : 'dark', true); },
    /** 改存储键(改完要重挂一次才生效,默认 'theme') */
    key: storageKey,
    smoothScrollTo: smoothScrollTo
  };

  /* ============================================================
     ② 定长丝滑滚动(与主题无关的独立工具)
     原生 scrollIntoView({behavior:'smooth'}) 时长不可控;要"2 秒左右"必须 rAF 自算。
     用户一操作(滚轮/触摸/方向键)立刻交还控制权;prefers-reduced-motion 直接瞬移。
     ============================================================ */

  function smoothScrollTo(targetY, ms) {
    var startY = window.scrollY;
    var delta = targetY - startY;
    var t0 = performance.now();
    var stop = false;

    function cleanup() {
      window.removeEventListener('wheel', cancel);
      window.removeEventListener('touchstart', cancel);
      window.removeEventListener('keydown', onKey);
    }
    function cancel() { stop = true; cleanup(); }
    function onKey(e) {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'PageUp' ||
          e.key === 'PageDown' || e.key === 'Home' || e.key === 'End' || e.key === ' ') cancel();
    }
    if (!(ms > 0) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      window.scrollTo(0, targetY);
      return;
    }
    window.addEventListener('wheel', cancel, { passive: true });
    window.addEventListener('touchstart', cancel, { passive: true });
    window.addEventListener('keydown', onKey);

    (function step(now) {
      if (stop) return;
      var p = Math.min(1, (now - t0) / ms);
      var e = p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; // easeInOutCubic
      window.scrollTo(0, Math.round(startY + delta * e));
      if (p < 1) requestAnimationFrame(step);
      else cleanup();
    })(t0);
  }

  // 声明式用法:任何 [data-scroll-to="<选择器>"] 点一下就定长滚过去
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest && ev.target.closest('[data-scroll-to]');
    if (!el) return;
    var target = document.querySelector(el.getAttribute('data-scroll-to'));
    if (!target) return;
    // 目标位置要在触发它的同步重排之后再量
    smoothScrollTo(target.getBoundingClientRect().top + window.scrollY, Number(el.getAttribute('data-scroll-ms')) || 2000);
  });
})();
