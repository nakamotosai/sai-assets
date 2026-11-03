/* bg-boot.js — 背景层「尽早起步」引导器（普通脚本，不是 module）
 *
 * 为什么要它：module 天然 defer，页尾的 <script type="module"> 要等 DCL 才跑。
 * 首页 HTML 一大（实测 2.7MB / DCL 3520ms），背景动画就要 4 秒后才出现，
 * 而跨页过渡只有 330ms —— 中间整段是"没有背景"的空窗，观感等于背景重新加载。
 *
 * 用法（放在 <canvas id="bg"> 正后方，普通 <script>，不要 type=module）：
 *   <canvas id="bg" aria-hidden="true"></canvas>
 *   <script src="./bg-boot.js"
 *           data-module="./bg.js" data-mount="mountBg" data-opacity="0.85"></script>
 *
 * 分流：站内翻页（同源 referrer 或本会话挂过）立刻挂，不留空窗；
 *       首访让位给主线程先解析内容，走 idle + 250ms 上限。
 */
(function () {
  var self = document.currentScript;
  var modulePath = (self && self.dataset.module) || './bg.js';
  var mountName = (self && self.dataset.mount) || 'mountBg';
  var canvasId = (self && self.dataset.canvas) || 'bg';
  var opacity = parseFloat((self && self.dataset.opacity) || '0.85');
  var key = (self && self.dataset.sessionKey) || 'bg-mounted';

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  function go() {
    import(modulePath).then(function (m) {
      var canvas = document.getElementById(canvasId);
      if (canvas && typeof m[mountName] === 'function') m[mountName](canvas, { opacity: opacity });
    }).catch(function () { /* 背景是装饰，失败静默 */ });
  }

  var sameSite = false;
  try { var r = document.referrer; sameSite = !!(r && new URL(r).origin === location.origin); } catch (e) {}
  try { if (!sameSite) sameSite = sessionStorage.getItem(key) === '1'; } catch (e) {}

  if (sameSite) { go(); return; }
  var ric = window.requestIdleCallback || function (f) { setTimeout(f, 250); };
  ric(go, { timeout: 250 });
})();
