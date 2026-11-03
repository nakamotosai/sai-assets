/* sai-assets 站点外壳脚本:主题、iframes 池、筛选、代码页签与复制。
   零依赖;所有可交互件在无 JS 时都有可用的静态兜底(卡片链接、pre 文本、下载链接)。 */
(() => {
  'use strict';

  /* ------------------------------------------------ 深浅主题(默认交付物) */
  const THEME_KEY = 'sai-assets-theme';
  const btn = document.getElementById('theme-btn');
  const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;
  const current = () => document.documentElement.dataset.theme || (systemDark() ? 'charcoal' : 'paper');
  const apply = (name, persist) => {
    document.documentElement.dataset.theme = name;
    if (btn) btn.setAttribute('aria-pressed', name === 'charcoal' ? 'true' : 'false');
    if (persist) { try { localStorage.setItem(THEME_KEY, name); } catch (e) { /* 隐私模式忽略 */ } }
  };
  apply(current(), false);
  if (btn) btn.addEventListener('click', () => apply(current() === 'charcoal' ? 'paper' : 'charcoal', true));

  /* ------------------------------------------------ iframe 池(滚动对账式,不依赖 IntersectionObserver 的边沿事件) */
  const CARD_W = 1280, CARD_H = 800, MAX_LIVE = 14;
  const live = new Map();               // thumb 元素 → iframe
  window.__pool = { mount: 0, unmount: 0, evict: 0 };   // 诊断计数(探针读;不影响行为)

  const makePoster = (heavy) => {
    const p = document.createElement('div');
    p.className = 'poster';
    const label = document.createElement('span');
    label.className = 'poster-label';
    label.textContent = heavy ? 'WebGL 实时预览' : '载入预览…';
    p.appendChild(label);
    if (heavy) {
      const b = document.createElement('button');
      b.className = 'run';
      b.type = 'button';
      b.textContent = '运行预览';
      p.appendChild(b);
    }
    return p;
  };
  const sizeThumb = (thumb, fr) => {
    const w = thumb.clientWidth || 320;
    const s = w / CARD_W;
    fr.style.width = CARD_W + 'px';
    fr.style.height = CARD_H + 'px';
    fr.style.transform = 'scale(' + s.toFixed(4) + ')';
    fr.style.transformOrigin = '0 0';
  };
  const mount = (thumb) => {
    if (live.has(thumb)) return;
    const src = thumb.dataset.src;
    if (!src) return;
    const fr = document.createElement('iframe');
    fr.src = src;
    fr.loading = 'lazy';
    fr.title = thumb.closest('article')?.querySelector('h3')?.textContent?.trim() || '预览';
    fr.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');
    fr.setAttribute('referrerpolicy', 'no-referrer');
    fr.addEventListener('load', () => sizeThumb(thumb, fr));
    thumb.querySelector('.poster')?.remove();
    thumb.appendChild(fr);
    live.set(thumb, fr);
    window.__pool.mount++;
    sizeThumb(thumb, fr);
  };
  const unmount = (thumb) => {
    const fr = live.get(thumb);
    if (!fr) return;
    fr.remove();
    live.delete(thumb);
    window.__pool.unmount++;
    if (!thumb.querySelector('.poster')) thumb.appendChild(makePoster(thumb.dataset.heavy === '1'));
  };

  const cards = [...document.querySelectorAll('.thumb[data-src]')];
  const near = (el, pad) => {
    const r = el.getBoundingClientRect();
    return r.bottom > -pad && r.top < window.innerHeight + pad;
  };
  let queued = false;
  function reconcile() {
    queued = false;
    if (!cards.length) return;
    /* 1 先回收已经跑远的(留 2 屏缓冲,避免来回滚动时反复挂卸) */
    for (const [thumb] of live) {
      if (!near(thumb, 1400)) unmount(thumb);
    }
    /* 2 把视口附近还没挂的挂上,受并发上限保护 */
    for (const thumb of cards) {
      if (live.size >= MAX_LIVE) break;
      if (live.has(thumb)) continue;
      if (!near(thumb, thumb.dataset.heavy === '1' ? 150 : 400)) continue;  // WebGL 类等它真正进视口再起上下文
      mount(thumb);
    }
  }
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(reconcile); } };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', () => { live.forEach((fr, thumb) => sizeThumb(thumb, fr)); schedule(); }, { passive: true });
  /* WebGL 类:点按才建立渲染上下文(避免上下文数量上限把后面的预览顶掉) */
  document.querySelectorAll('.thumb .run').forEach((b) => {
    b.addEventListener('click', (ev) => {
      ev.preventDefault();
      const thumb = b.closest('.thumb');
      thumb.dataset.armed = '1';
      mount(thumb);
    });
  });
  schedule();

  /* ------------------------------------------------ 详情页舞台(视口切换) */
  const VP = { 1280: [1280, 800], 834: [834, 1112], 390: [390, 844] };
  const stage = document.getElementById('stage');
  let stageW = 1280;
  function sizeStage() {
    if (!stage) return;
    const thumb = stage.querySelector('.thumb');
    const fr = stage.querySelector('iframe');
    const [vw, vh] = VP[stageW] || VP[1280];
    const w = (thumb || stage).clientWidth || 1200;
    const s = w / vw;
    if (thumb) thumb.style.height = Math.round(vh * s) + 'px';
    if (fr) {
      fr.style.width = vw + 'px';
      fr.style.height = vh + 'px';
      fr.style.transform = 'scale(' + s.toFixed(4) + ')';
      fr.style.transformOrigin = '0 0';
    }
  }
  if (stage) {
    stage.querySelectorAll('.run').forEach((b) => b.addEventListener('click', (ev) => {
      ev.preventDefault();
      mount(b.closest('.thumb'));
      sizeStage();
    }));
    document.querySelectorAll('.vp').forEach((b) => b.addEventListener('click', () => {
      document.querySelectorAll('.vp').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      stageW = Number(b.dataset.w) || 1280;
      sizeStage();
    }));
    const rl = document.getElementById('reload');
    if (rl) rl.addEventListener('click', () => { const fr = stage.querySelector('iframe'); if (fr) fr.src = fr.src; });
    sizeStage();
    const io2 = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) { const t = stage.querySelector('.thumb'); if (t && !stage.querySelector('iframe')) mount(t); sizeStage(); }
    }, { rootMargin: '200px' });
    io2.observe(stage);
  }

  /* ------------------------------------------------ 目录:类目 + 搜索 */
  const grid = document.getElementById('grid');
  if (grid) {
    const all = [...grid.querySelectorAll('.card')];
    const chips = [...document.querySelectorAll('.chip[data-cat]')];
    const input = document.getElementById('q');
    const hint = document.getElementById('q-hint');
    const empty = document.getElementById('empty');
    let cat = 'all';
    const render = () => {
      const q = (input?.value || '').trim().toLowerCase();
      let shown = 0;
      for (const card of all) {
        const okCat = cat === 'all' || card.dataset.cat === cat;
        const okQ = !q || card.dataset.search.includes(q);
        const vis = okCat && okQ;
        card.hidden = !vis;
        if (vis) shown++;
      }
      if (hint) hint.textContent = (q || cat !== 'all') ? shown + ' / ' + all.length : '';
      if (empty) empty.hidden = shown !== 0;
    };
    chips.forEach((c) => c.addEventListener('click', () => {
      chips.forEach((x) => x.classList.remove('on'));
      c.classList.add('on');
      cat = c.dataset.cat;
      render();
    }));
    input?.addEventListener('input', render);
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== input) { e.preventDefault(); input?.focus(); }
      if (e.key === 'Escape' && document.activeElement === input) { input.value = ''; render(); input.blur(); }
    });
    const hash = (location.hash || '').slice(1);
    const hit = chips.find((c) => c.dataset.cat === hash);
    if (hit) { hit.click(); hit.scrollIntoView({ block: 'nearest' }); }
    render();
  }

  /* ------------------------------------------------ 代码区:页签 + 复制 + 轻高亮 */
  const KEYWORDS = /\b(const|let|var|function|return|if|else|for|while|await|async|import|export|from|new|class|try|catch|true|false|null|undefined|type|interface|def|self|None|True|False)\b/g;
  const tokenize = (text, rel) => {
    const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const lang = (rel.split('.').pop() || '').toLowerCase();
    if (lang === 'md' || lang === 'html') return esc(text);
    let out = '', i = 0;
    const re = /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b\d+(?:\.\d+)?(?:px|rem|em|%|s|ms|hz)?\b)/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      out += esc(text.slice(i, m.index));
      const cls = m[1] ? 'tk-c' : m[2] ? 'tk-s' : 'tk-n';
      out += '<span class="' + cls + '">' + esc(m[0]) + '</span>';
      i = re.lastIndex;
    }
    out += esc(text.slice(i));
    if (lang === 'js' || lang === 'json' || lang === 'py' || lang === 'ts') {
      out = out.replace(KEYWORDS, '<span class="tk-k">$1</span>');
    }
    return out;
  };
  const box = document.querySelector('.code-box');
  if (box) {
    box.querySelectorAll('pre code').forEach((c) => {
      const rel = c.closest('.pane')?.querySelector('.pane-head code')?.textContent || '';
      c.dataset.raw = c.textContent;
      c.innerHTML = tokenize(c.dataset.raw, rel.trim());
    });
    box.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
      box.querySelectorAll('.tab').forEach((x) => { x.classList.remove('selected'); x.setAttribute('aria-selected', 'false'); });
      box.querySelectorAll('.pane').forEach((p) => p.classList.remove('selected'));
      t.classList.add('selected');
      t.setAttribute('aria-selected', 'true');
      box.querySelector('#' + t.dataset.tab)?.classList.add('selected');
    }));
  }
  const copyText = async (text, el) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:absolute;left:-9999px';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e2) { /* 放弃 */ }
      ta.remove();
    }
    if (el) {
      const old = el.textContent;
      el.dataset.done = '1'; el.textContent = '已复制';
      setTimeout(() => { el.dataset.done = '0'; el.textContent = old; }, 1400);
    }
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.copy');
    if (!b) return;
    e.preventDefault();
    if (b.dataset.copy) return void copyText(b.dataset.copy, b);
    const rel = b.dataset.copyFile;
    if (rel) {
      const head = [...document.querySelectorAll('.pane-head code')].find((c) => c.textContent.trim() === rel);
      const raw = head?.closest('.pane')?.querySelector('pre code')?.dataset.raw;
      return void copyText(raw || '', b);
    }
    copyText(b.closest('.snip, .pane')?.querySelector('pre code')?.textContent || '', b);
  });
})();
