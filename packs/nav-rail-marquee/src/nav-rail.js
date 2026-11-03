/*!
 * nav-rail-marquee — 导航三件套联动(顶部导航 / 右侧段轨 / 底部进度线)
 * MIT License · sai-assets pack nav-rail-marquee v1.0.0
 * 无依赖、经典脚本(不是 ES module),本地直开的页面里也能跑。
 *
 * 标记契约(index.html 里的必须项):
 *   [data-nav-rail]              包裹根(变量作用域 + 查找边界)
 *   [data-nr-top]                顶部导航容器,内含 [data-nr-target]
 *   [data-nr-rail]               右侧段轨容器,内含 [data-nr-target]
 *   [data-nr-target="<id>"]      任一可点项,值 = 目标段 id
 *   [data-nr-stage]              滚动容器(可省,省了就退回页面滚动)
 *   [data-nr-section="<id>"]     段落
 *   [data-nr-progress]           进度线容器(内层建议再给 [data-nr-bar])
 */
(function (global, doc) {
  'use strict';

  var VERSION = '1.0.0';

  function toArray(list) {
    return Array.prototype.slice.call(list || []);
  }

  function prefersReduced() {
    return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function closestButton(node, root) {
    while (node && node !== root) {
      if (node.hasAttribute && node.hasAttribute('data-nr-target')) return node;
      node = node.parentNode;
    }
    return null;
  }

  /* ── 构造 ─────────────────────────────────────────────── */

  function NavRail(root, options) {
    options = options || {};
    this.root = root;
    this.opts = {
      scroll: options.scroll !== false,
      spy: options.spy !== false,
      keyboard: options.keyboard !== false
    };
    this.top = root.querySelector('[data-nr-top]');
    this.rail = root.querySelector('[data-nr-rail]');
    this.stage = root.querySelector('[data-nr-stage]');
    this.progressHost = root.querySelector('[data-nr-progress]');
    this.progressBar = this.progressHost
      ? (this.progressHost.querySelector('[data-nr-bar]') || this.progressHost)
      : null;
    this.buttons = toArray(root.querySelectorAll('[data-nr-target]'));
    this.sections = toArray(root.querySelectorAll('[data-nr-section]'));
    this.ids = this.sections.map(function (sec) {
      return sec.getAttribute('data-nr-section');
    });
    this.activeId = null;
    this._io = null;
    this._onScroll = null;
    this._click = this._onClick.bind(this);
    this._key = this._onKeydown.bind(this);
    this.mount();
  }

  NavRail.prototype.section = function (id) {
    for (var i = 0; i < this.sections.length; i++) {
      if (this.sections[i].getAttribute('data-nr-section') === id) return this.sections[i];
    }
    return null;
  };

  NavRail.prototype.mount = function () {
    var i;
    for (i = 0; i < this.buttons.length; i++) {
      this.buttons[i].addEventListener('click', this._click);
    }
    if (this.opts.keyboard) {
      if (this.rail) this.rail.addEventListener('keydown', this._key);
      if (this.top) this.top.addEventListener('keydown', this._key);
    }
    var initial = null;
    for (i = 0; i < this.buttons.length; i++) {
      if (this.buttons[i].getAttribute('aria-current') === 'page') {
        initial = this.buttons[i].getAttribute('data-nr-target');
        break;
      }
    }
    this.sync(initial || this.ids[0] || null);
    if (this.opts.spy) this.mountSpy();
    return this;
  };

  /* ── 状态同步:两处导航的 aria-current + 底部进度线宽度 ── */

  NavRail.prototype.sync = function (id) {
    var i;
    for (i = 0; i < this.buttons.length; i++) {
      var btn = this.buttons[i];
      if (btn.getAttribute('data-nr-target') === id) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    }
    this.activeId = id;
    this.root.setAttribute('data-nr-active', id || '');

    var idx = this.ids.indexOf(id);
    if (idx < 0 || !this.progressBar) return this;
    var pct = (idx + 1) / this.ids.length * 100;
    this.progressBar.style.width = pct + '%';
    if (this.progressHost && this.progressHost !== this.progressBar) {
      this.progressHost.style.setProperty('--nr-progress', pct + '%');
    }
    if (this.progressHost && this.progressHost.getAttribute('role') === 'progressbar') {
      this.progressHost.setAttribute('aria-valuemax', String(this.ids.length));
      this.progressHost.setAttribute('aria-valuenow', String(idx + 1));
    }
    return this;
  };

  /* ── 跳转:同步两处导航,并把目标段滚进视野 ── */

  NavRail.prototype.go = function (id, options) {
    options = options || {};
    if (this.ids.indexOf(id) === -1) return this;
    this.sync(id);
    if (options.scroll === false || !this.opts.scroll) return this;
    var sec = this.section(id);
    if (!sec) return this;
    var behavior = prefersReduced() ? 'auto' : 'smooth';
    if (sec.scrollIntoView) {
      try {
        sec.scrollIntoView({ behavior: behavior, block: 'start' });
      } catch (err) {
        sec.scrollIntoView();
      }
    }
    return this;
  };

  NavRail.prototype._onClick = function (event) {
    var btn = closestButton(event.target, this.root);
    if (!btn) return;
    this.go(btn.getAttribute('data-nr-target'));
  };

  /* ── 键盘:左右键走顶导航、上下键走段轨,Home/End 到首尾 ── */

  NavRail.prototype._onKeydown = function (event) {
    var nav = event.currentTarget;
    var list = toArray(nav.querySelectorAll('[data-nr-target]'));
    var idx = list.indexOf(doc.activeElement);
    if (idx === -1) return;
    var horizontal = nav === this.top;
    var next;
    switch (event.key) {
      case 'ArrowUp': if (horizontal) return; next = idx - 1; break;
      case 'ArrowDown': if (horizontal) return; next = idx + 1; break;
      case 'ArrowLeft': if (!horizontal) return; next = idx - 1; break;
      case 'ArrowRight': if (!horizontal) return; next = idx + 1; break;
      case 'Home': next = 0; break;
      case 'End': next = list.length - 1; break;
      default: return;
    }
    event.preventDefault();
    if (next < 0) next = list.length - 1;
    if (next >= list.length) next = 0;
    list[next].focus();
  };

  /* ── 滚动联动:中间带命中的那一段成为当前段 ── */

  NavRail.prototype.mountSpy = function () {
    var self = this;
    if (!this.sections.length) return this;
    if (global.IntersectionObserver) {
      this._io = new global.IntersectionObserver(function (entries) {
        var hit = null;
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) hit = entries[i].target.getAttribute('data-nr-section');
        }
        if (hit) self.sync(hit);
      }, { root: this.stage || null, rootMargin: '-45% 0px -48% 0px', threshold: 0 });
      this.sections.forEach(function (sec) { self._io.observe(sec); });
    } else {
      this._onScroll = this._spyByRect.bind(this);
      (this.stage || global).addEventListener('scroll', this._onScroll, { passive: true });
    }
    return this;
  };

  NavRail.prototype._spyByRect = function () {
    var host = this.stage;
    var mid = host ? host.getBoundingClientRect().top + host.clientHeight / 2 : global.innerHeight / 2;
    var best = null;
    var bestDist = Infinity;
    for (var i = 0; i < this.sections.length; i++) {
      var box = this.sections[i].getBoundingClientRect();
      var dist = Math.abs(box.top - mid);
      if (dist < bestDist) {
        bestDist = dist;
        best = this.sections[i].getAttribute('data-nr-section');
      }
    }
    if (best) this.sync(best);
  };

  NavRail.prototype.destroy = function () {
    var i;
    for (i = 0; i < this.buttons.length; i++) {
      this.buttons[i].removeEventListener('click', this._click);
    }
    if (this.rail) this.rail.removeEventListener('keydown', this._key);
    if (this.top) this.top.removeEventListener('keydown', this._key);
    if (this._io) {
      this._io.disconnect();
      this._io = null;
    }
    if (this._onScroll) {
      (this.stage || global).removeEventListener('scroll', this._onScroll);
      this._onScroll = null;
    }
    if (this.root.__nr === this) this.root.__nr = null;
    return this;
  };

  /* ── 入口 ─────────────────────────────────────────────── */

  function init(root, options) {
    root = typeof root === 'string' ? doc.querySelector(root) : root;
    if (!root) return null;
    if (root.__nr && root.__nr instanceof NavRail) return root.__nr;
    var inst = new NavRail(root, options);
    root.__nr = inst;
    return inst;
  }

  function boot() {
    toArray(doc.querySelectorAll('[data-nav-rail]')).forEach(function (el) {
      if (!el.__nr) init(el);
    });
  }

  global.NavRail = { version: VERSION, init: init, boot: boot, NavRail: NavRail };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window, document);
