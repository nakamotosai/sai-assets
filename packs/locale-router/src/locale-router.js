/* locale-router · src/locale-router.js
   静态多语言站的语言路由:决定「第一次来的人进哪一版」。
   纯前端、零依赖、同步执行,可直接内联在 <head>(不留闪白);接入顺序见 docs/usage.md。

   四条规则(逐条保留自源脚本的语言路由):
   1 参数优先 ?lang=<code> 在任意页面永远优先,并写入记忆;
   2 深链保留 非根路径(如 /zh/)不被夺回;只在还没有记忆、且不是爬虫时补写一次;
   3 根路径决定 记忆 -> navigator.languages 探测 -> defaultLocale,只重定向一次;
   4 爬虫放行 爬虫 / headless 一概不动(UA 名单见 ROBOT_RE)。

   配置写在 <script> 顶部的 window.LOCALE_ROUTER_CONFIG(字段与语义见 docs/usage.md);
   干跑(只算不跳、不写记忆)用 dryRun: true —— 预览页与自检靠它。
   决策函数是纯函数:LocaleRouter.decide(input) 不碰 DOM / location / 存储,
   因此可以脱离浏览器(含 Node)单独跑,见 scripts/assert_tokens.py 的决策层断言。
*/
(function (global) {
  'use strict';

  /* ---- 默认配置:站点只覆盖自己关心的字段 ---------------------------------- */
  var DEFAULTS = {
    locales: { en: '/', zh: '/zh/', ja: '/ja/' }, // 语言代码 -> 该语言的入口路径
    defaultLocale: 'en',                          // 兜底语言,必须是 locales 的键
    storageKey: 'locale',                         // 记忆用的存储键
    param: 'lang',                                // 参数名:?lang=
    rootPath: '/',                                // 触发自动决定的路径;其余路径算深链
    auto: true,                                   // false = 不自动执行,自己调 LocaleRouter.run()
    dryRun: false                                 // true = 只算不跳、不写记忆(预览 / 自检)
  };

  /* 爬虫 / headless 名单:命中即一概不动(规则 4)。逐条保留自源脚本,不要随手精简。 */
  var ROBOT_RE = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora|pinterest|headless|phantom|prerender|lighthouse|pagespeed|monitoring|curl|wget|python-requests/i;

  function has(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  /* 只认 DEFAULTS 里列出的字段:配置写错名字会被忽略,不会静默改变行为。 */
  function merge(base, over) {
    var out = {}, k;
    for (k in base) {
      if (!has(base, k)) continue;
      out[k] = (over && has(over, k) && over[k] !== undefined && over[k] !== null) ? over[k] : base[k];
    }
    return out;
  }

  /* 配置来源:window.LOCALE_ROUTER_CONFIG 优先,其次 window.LocaleRouter 本身(第二种写法
     就是「把命名空间对象当配置写」)。两种写法都见 docs/usage.md。 */
  var NS = (global.LocaleRouter && typeof global.LocaleRouter === 'object') ? global.LocaleRouter : {};
  var RAW = (global.LOCALE_ROUTER_CONFIG && typeof global.LOCALE_ROUTER_CONFIG === 'object')
    ? global.LOCALE_ROUTER_CONFIG
    : (NS.locales ? NS : null);
  var CFG = merge(DEFAULTS, RAW);

  var KEYS = {}; // 小写代码 -> locales 里的原始键,大小写不敏感

  (function normalizeConfig() {
    var raw = (CFG.locales && typeof CFG.locales === 'object') ? CFG.locales : DEFAULTS.locales;
    var clean = {}, k;
    for (k in raw) {
      if (!has(raw, k)) continue;
      var code = String(k).trim();
      var entry = String(raw[k] == null ? '' : raw[k]).trim();
      if (code && entry) clean[code] = entry;
    }
    if (!Object.keys(clean).length) clean = DEFAULTS.locales;
    CFG.locales = clean;
    for (k in clean) if (has(clean, k)) KEYS[k.toLowerCase()] = k;
    var want = String(CFG.defaultLocale == null ? '' : CFG.defaultLocale).trim().toLowerCase();
    CFG.defaultLocale = has(KEYS, want) ? KEYS[want] : Object.keys(clean)[0];
  })();

  function normPath(p) {
    var s = String(p == null ? '' : p);
    if (!s) return '/';
    if (s.charAt(0) !== '/') s = '/' + s;
    s = s.replace(/\/+$/, '');
    return s || '/';
  }

  function rootPath() {
    return normPath(CFG.rootPath);
  }

  /* 入口路径原样返回(跳转目标就是配置里写的字面量,不补也不删斜杠)。 */
  function entryOf(code) {
    return has(CFG.locales, code) ? String(CFG.locales[code]) : '';
  }

  function samePath(a, b) {
    return normPath(a) === normPath(b);
  }

  /* 语言代码 -> locales 的键:先小写精确匹配,再退到主语言,最后退到同主语言的第一个键
     (例如配置只有 pt-BR 时,pt 也认)。 */
  function codeOf(value) {
    var t = String(value == null ? '' : value).trim().toLowerCase();
    if (!t) return null;
    if (has(KEYS, t)) return KEYS[t];
    var base = t.split('-')[0];
    if (has(KEYS, base)) return KEYS[base];
    var k;
    for (k in KEYS) if (has(KEYS, k) && k.split('-')[0] === base) return KEYS[k];
    return null;
  }

  function fromLangTag(tag) {
    return codeOf(tag);
  }

  /* ?lang= 的取值;URLSearchParams 不可用时自己按 & 与 = 切(不拼正则,避免名字里的元字符)。 */
  function forcedFrom(search) {
    var q = String(search == null ? '' : search);
    if (!q) return null;
    var name = String(CFG.param);
    try {
      return new URLSearchParams(q).get(name);
    } catch (e) {
      var parts = q.replace(/^[?]/, '').split('&');
      for (var i = 0; i < parts.length; i++) {
        var eq = parts[i].indexOf('=');
        var key = eq < 0 ? parts[i] : parts[i].slice(0, eq);
        if (key !== name) continue;
        var val = eq < 0 ? '' : parts[i].slice(eq + 1);
        try { return decodeURIComponent(val.split('+').join(' ')); } catch (e2) { return val; }
      }
      return null;
    }
  }

  /* navigator.languages 为空时退到 navigator.language(与源脚本一致)。 */
  function languagesOf(nav) {
    if (nav && nav.languages && nav.languages.length) return nav.languages;
    if (typeof navigator === 'undefined') return [];
    return (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || ''];
  }

  function robot(ua) {
    var s = (ua == null) ? ((typeof navigator !== 'undefined' && navigator.userAgent) || '') : String(ua);
    return ROBOT_RE.test(s);
  }

  /* 探测:navigator.languages 里第一个认得的语言;都不认得就是默认语言。 */
  function detect(list) {
    var arr = (list && list.length) ? list : [];
    for (var i = 0; i < arr.length; i++) {
      var hit = fromLangTag(arr[i]);
      if (hit) return { code: hit, matched: true };
    }
    return { code: CFG.defaultLocale, matched: false };
  }

  function store() {
    try {
      // 无存储环境(含 Node)/ 隐私模式下取值抛异常,一律当作「没有记忆」
      if (typeof localStorage === 'undefined' || !localStorage) return null;
      return localStorage;
    } catch (e) {
      return null;
    }
  }

  function read() {
    var s = store();
    if (!s) return null;
    try {
      var v = s.getItem(String(CFG.storageKey));
      return v == null ? null : String(v);
    } catch (e) {
      return null;
    }
  }

  function remember(code) {
    var s = store();
    if (!s) return false;
    try {
      s.setItem(String(CFG.storageKey), String(code));
      return true;
    } catch (e) {
      return false; // 写满 / 被禁:静默放弃,不影响本次跳转
    }
  }

  function currentLocale() {
    if (typeof document === 'undefined' || !document.documentElement) return CFG.defaultLocale;
    return fromLangTag(document.documentElement.getAttribute('lang')) || CFG.defaultLocale;
  }

  function out(reason, action, from, target, to, rememberCode, isRobot) {
    return {
      reason: reason,            // param | deep-link | memory | detect | default | robot
      action: action,            // redirect | stay
      from: from,                // 当前语言(来自 <html lang>)
      target: target,            // 决定出的语言
      to: to,                    // 会跳到的路径(null = 不跳)
      remember: rememberCode,    // 会写进记忆的代码(null = 不写)
      robot: !!isRobot
    };
  }

  /* 决策:纯函数。input 缺省字段全部按「浏览器当前状态」的语义取值。
     字段:pathname / search / hash / current / htmlLang / stored / languages / forced / robot
     规则顺序与源脚本一致:参数 -> 深链 -> 爬虫 -> 根路径决定。 */
  function decide(input) {
    var o = input || {};
    var pathname = normPath(o.pathname === undefined ? (typeof location !== 'undefined' ? location.pathname : '/') : o.pathname);
    var hash = String(o.hash == null ? '' : o.hash);
    var cur = codeOf(o.current !== undefined && o.current !== null ? o.current : o.htmlLang) || currentLocale();
    var isRobot = (o.robot === undefined || o.robot === null) ? robot() : !!o.robot;

    var stored = (o.stored === undefined)
      ? read()
      : o.stored;
    stored = codeOf(stored);

    var forced = (o.forced === undefined || o.forced === null)
      ? forcedFrom(o.search)
      : o.forced;
    forced = codeOf(forced);

    /* 规则 1:参数永远优先,任意页面、任意 UA;并写入记忆。
       是否跳转看「参数语言 vs 当前语言」(与源脚本一致):已经在这一版就只写记忆。 */
    if (forced) {
      var jump = forced !== cur;
      return out('param', jump ? 'redirect' : 'stay', cur, forced, jump ? entryOf(forced) + hash : null, forced, isRobot);
    }

    /* 规则 2:深链不被夺回。没有记忆且不是爬虫时,把落地语言补记一次。 */
    if (pathname !== rootPath()) {
      return out('deep-link', 'stay', cur, cur, null, (!stored && !isRobot) ? cur : null, isRobot);
    }

    /* 规则 4:根路径上的爬虫 / headless 一概不动(也不写记忆)。 */
    if (isRobot) {
      return out('robot', 'stay', cur, cur, null, null, true);
    }

    /* 规则 3:记忆 -> 探测 -> 默认;只有目标入口与当前路径不同才动,因此最多跳一次。 */
    var langs = (o.languages === undefined) ? languagesOf() : o.languages;
    var probed = detect(langs);
    var target = stored || probed.code;
    var reason = stored ? 'memory' : (probed.matched ? 'detect' : 'default');
    var go = !samePath(entryOf(target), pathname);
    return out(reason, go ? 'redirect' : 'stay', cur, target, go ? entryOf(target) + hash : null, target, isRobot);
  }

  /* 把当前语言同步到开关上:命中项写 aria-current="page",其余清掉。
     当前态只有这一个来源,禁止再用 class 手搓第二套高亮。 */
  function mark(root) {
    var scope = root || (typeof document !== 'undefined' ? document : null);
    if (!scope || typeof scope.querySelectorAll !== 'function') return 0;
    var cur = currentLocale();
    var items = scope.querySelectorAll('[data-lr-locale]');
    var hit = 0, i;
    for (i = 0; i < items.length; i++) {
      var on = codeOf(items[i].getAttribute('data-lr-locale')) === cur;
      if (on) {
        items[i].setAttribute('aria-current', 'page');
        hit++;
      } else {
        items[i].removeAttribute('aria-current');
      }
    }
    return hit;
  }

  /* 真入口:算一次,按结果写记忆 / replace 跳转。
     同步执行即可内联在 <head>:这里只有字符串比较,没有网络、没有异步、没有等待。 */
  function run() {
    if (typeof location === 'undefined' || typeof document === 'undefined') return null;
    var d = decide({
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
      current: currentLocale(),
      stored: read(),
      languages: languagesOf(),
      robot: robot()
    });
    if (!CFG.dryRun) {
      if (d.remember) remember(d.remember);
      if (d.action === 'redirect' && d.to) location.replace(d.to);
    }
    mark();
    if (typeof CustomEvent === 'function' && document.dispatchEvent) {
      document.dispatchEvent(new CustomEvent('localerouter:decide', { detail: d }));
    }
    return d;
  }

  NS.config = CFG;
  NS.decide = decide;
  NS.run = run;
  NS.mark = mark;
  NS.read = read;
  NS.remember = remember;
  NS.detect = function (list) { return detect(list).code; };
  NS.isRobot = robot;
  NS.paths = function () { return CFG.locales; };
  global.LocaleRouter = NS;

  if (CFG.auto !== false && !NS.__ran) {
    NS.__ran = true;
    run();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
