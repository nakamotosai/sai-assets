/* spectral-glass-prism · spectral-glass.js  (普通脚本,不是 ES module)
   宿主 / 引导层。上游引擎(upstream/spectral-glass/engine.js,构建产物原样 vendored)
   是一段自启动的 IIFE bundle(无 import/export/import.meta),所以**可以用普通 <script> 加载**:
   双击打开本地文件也能跑,不必先起本地服务器。

     1. 能力探测(navigator.gpu + requestAdapter),不满足就**不加载引擎**,直接出兜底面板
        —— 宁可给一块静态渐变,也不要在控制台里堆一个起不来的引擎的错误。
     2. 契约节点自检(#gpu / #html-bg-root / #html-bg-photo / #html-bg-foreground / #fallback),
        缺哪个就明确报出来,别让引擎静默拿到 null。
     3. 注入 <script> 起引擎;加载/启动失败只写进兜底面板。
        (动态 import() 在 在本地文件页面会被 CORS 拦,所以这里用 script 标签而不是 import。)

   引擎的硬契约与参数面见 docs/usage.md;参数面板由引擎自带(右上角 Tweakpane)。
*/

(function () {
  'use strict';

  var HERE = document.currentScript && document.currentScript.src;
  /** 上游引擎(构建产物)地址:相对本文件解析,永远落在同一个包内 */
  var ENGINE_URL = new URL('../upstream/spectral-glass/engine.js', HERE || location.href).href;

  /** 引擎按 id 取的节点,少一个都会让取景/拖拽/兜底失效 */
  var REQUIRED_IDS = ['gpu', 'html-bg-root', 'html-bg-photo', 'html-bg-foreground', 'fallback'];

  var FALLBACK_TEXT = {
    'no-dom': '页面缺少引擎需要的节点(#gpu / #html-bg-root / #html-bg-photo / #html-bg-foreground / #fallback)。',
    'no-webgpu': '这个浏览器没有 WebGPU。本演示需要 Chrome / Edge 120+ 或 Safari 18+。',
    'no-adapter': '拿不到 GPU 适配器(可能驱动过旧或被策略禁用)。可以重载页面或更新显卡驱动再试。',
    'engine-load': '引擎脚本加载失败(文件缺失或被拦),详情见控制台。',
    'engine-error': '引擎启动失败,详情见控制台。'
  };

  var mounted = null;

  function esc(s) {
    return String(s).replace(/[<>&]/g, function (c) { return c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&amp;'; });
  }

  function setState(state) {
    document.documentElement.setAttribute('data-sg-state', state);
  }

  function missingIds() {
    return REQUIRED_IDS.filter(function (id) { return !document.getElementById(id); });
  }

  function showFallback(kind, detail) {
    var box = document.getElementById('fallback');
    if (box) {
      box.innerHTML =
        '<div class="fb-in">' +
        '<h1>Spectral Glass 无法启动</h1>' +
        '<p>' + (FALLBACK_TEXT[kind] || FALLBACK_TEXT['engine-error']) + '</p>' +
        (detail ? '<p><code>' + esc(detail) + '</code></p>' : '') +
        '<p>上游演示:Spectral-Glass(MIT)。本页为资产库活预览。</p>' +
        '</div>';
      box.classList.add('visible');
    }
    var canvas = document.getElementById('gpu');
    if (canvas) canvas.style.display = 'none';
    var root = document.getElementById('html-bg-root');
    if (root) root.classList.add('html-bg--gradient-fallback');
    setState('fallback');
    document.dispatchEvent(new CustomEvent('spectral-glass:fallback', { detail: { kind: kind, detail: detail || null } }));
  }

  /** 只探测,不加载引擎:给"先问一句再决定要不要占 GPU"的调用方用 */
  function probe() {
    var missing = missingIds();
    if (missing.length) return Promise.resolve({ ok: false, kind: 'no-dom', missing: missing });
    if (!('gpu' in navigator) || !navigator.gpu) return Promise.resolve({ ok: false, kind: 'no-webgpu' });
    return navigator.gpu.requestAdapter({ powerPreference: 'high-performance' })
      .then(function (a) { return a || navigator.gpu.requestAdapter(); })
      .then(function (adapter) {
        if (!adapter) return { ok: false, kind: 'no-adapter' };
        return { ok: true, kind: 'webgpu', adapter: adapter };
      })
      .catch(function (err) {
        return { ok: false, kind: 'no-adapter', detail: err && err.message ? err.message : String(err) };
      });
  }

  function injectEngine() {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = ENGINE_URL;
      s.async = false;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('无法加载 ' + ENGINE_URL)); };
      document.body.appendChild(s);
    });
  }

  /**
   * 起引擎。同一页面只允许起一次(引擎是自启动单例,重复注入不会重来一遍)。
   * @param {{autoStart?: boolean}} [opts]
   * @returns {Promise<{mode: 'live'|'fallback', kind: string, reason?: string}>}
   */
  function mountSpectralGlass(opts) {
    opts = opts || {};
    if (mounted) return mounted;

    mounted = probe().then(function (probeResult) {
      var missing = missingIds();
      if (missing.length) {
        showFallback('no-dom', missing.join(', '));
        return { mode: 'fallback', kind: 'no-dom', reason: missing.join(', ') };
      }
      if (!probeResult.ok) {
        showFallback(probeResult.kind, probeResult.detail);
        return { mode: 'fallback', kind: probeResult.kind, reason: probeResult.detail || '' };
      }

      setState('live');
      if (opts.autoStart === false) return { mode: 'live', kind: 'webgpu' };

      return injectEngine().then(function () {
        document.dispatchEvent(new CustomEvent('spectral-glass:ready', { detail: { engine: ENGINE_URL } }));
        return { mode: 'live', kind: 'webgpu' };
      }, function (err) {
        showFallback('engine-load', err && err.message ? err.message : String(err));
        return { mode: 'fallback', kind: 'engine-load', reason: String(err) };
      });
    });

    return mounted;
  }

  /** 对外小接口:页面脚本可以读状态,不用自己猜 */
  window.spectralGlass = {
    get state() { return document.documentElement.getAttribute('data-sg-state') || 'idle'; },
    probe: probe,
    mount: mountSpectralGlass,
    engineUrl: ENGINE_URL,
    requiredIds: REQUIRED_IDS
  };

  function boot() {
    setState('probing');
    mountSpectralGlass();
  }

  if (document.getElementById('gpu')) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();
  } else {
    setState('idle');
  }
})();
