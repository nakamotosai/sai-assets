/* sai-assets 外壳脚本 · 两个页面各一套:
   首页 = 探索器(挑 / 看 / 拿 同屏,状态进 URL,键盘可全程操作);
   详情页 = 舞台 + 取用片段 + 代码页签。
   零依赖。无 JS 时:首页仍是一份完整可点的索引(每行链到详情页),详情页仍有静态兜底。 */
(() => {
  'use strict';

  /* ------------------------------------------------ 深浅主题 */
  const THEME_KEY = 'sai-assets-theme';
  const themeBtn = document.getElementById('theme-btn');
  const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;
  const current = () => document.documentElement.dataset.theme || (systemDark() ? 'charcoal' : 'paper');
  const applyTheme = (name, persist) => {
    document.documentElement.dataset.theme = name;
    if (themeBtn) themeBtn.setAttribute('aria-pressed', name === 'charcoal' ? 'true' : 'false');
    /* localStorage 在隐私模式/禁用存储时会抛错:主题仍生效,只是不记住 —— 预期内失败,故空 catch */
    if (persist) { try { localStorage.setItem(THEME_KEY, name); } catch (e) { /* 预期:存储不可用 */ } }
  };
  applyTheme(current(), false);
  if (themeBtn) themeBtn.addEventListener('click', () => applyTheme(current() === 'charcoal' ? 'paper' : 'charcoal', true));

  /* ------------------------------------------------ 滚动入场(详情页/长文用) */
  const reveals = [...document.querySelectorAll('.reveal')];
  if (reveals.length && 'IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      }
    }, { rootMargin: '0px 0px -8% 0px' });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('in'));
  }

  /* ================================================ 探索器(首页) */
  const listEl = document.getElementById('pk-list');
  if (listEl) {
    const items = [...listEl.querySelectorAll('.pk')];
    const byId = new Map(items.map((el) => [el.dataset.id, el]));
    const frame = document.getElementById('frame');
    const fit = document.getElementById('fit');
    const scaler = document.getElementById('scaler');
    const viewport = document.getElementById('viewport');
    const pv = document.getElementById('pv');
    const urlEl = document.getElementById('url');
    const openNew = document.getElementById('open-new');
    const sectSel = document.getElementById('sect');
    const emptyEl = document.getElementById('pk-empty');
    const resetBtn = document.getElementById('pk-reset');
    const input = document.getElementById('q');
    const h = {
      no: document.getElementById('h-no'), name: document.getElementById('h-name'),
      when: document.getElementById('h-when'), cat: document.getElementById('h-cat'),
      mode: document.getElementById('h-mode'), detail: document.getElementById('h-detail'),
    };
    const dlg = document.getElementById('use');
    const dlgName = document.getElementById('use-name');
    const dlgSnips = document.getElementById('use-snips');
    const dlgDetail = document.getElementById('use-detail');
    let packData = {};
    try { packData = JSON.parse(document.getElementById('pack-json')?.textContent || '{}'); }
    catch (e) { packData = {}; }

    /* <dialog> 三件套:showModal/close 在个别环境(如无头 DOM 或老浏览器)缺失,
       统一走 helper,退回 open 属性 —— 界面照常,测试也能验。 */
    const useOpen = () => Boolean(dlg) && (dlg.hasAttribute('open') || Boolean(dlg.open));
    const useShow = () => {
      if (!dlg) return;
      if (typeof dlg.showModal === 'function') {
        try { dlg.showModal(); return; } catch (e) { /* 退回属性 */ }
      }
      dlg.setAttribute('open', '');
    };
    const useClose = () => {
      if (!dlg) return;
      if (typeof dlg.close === 'function') { try { dlg.close(); } catch (e) { /* 退回属性 */ } }
      dlg.removeAttribute('open');
    };

    const WIDTHS = { desktop: [1280, 800], tablet: [834, 1112], phone: [390, 844] };
    const catFilters = [...document.querySelectorAll('.chip[data-cat]')];
    const modeFilters = [...document.querySelectorAll('.chip[data-mode]')];
    const widthBtns = [...document.querySelectorAll('.widthseg [data-w]')];
    const narrow = () => window.matchMedia('(max-width: 1100px)').matches;
    const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
    const state = { pack: null, w: 'desktop', s: '', cat: 'all', mode: 'all', q: '' };

    /* ---------- 预览框尺寸:iframe 用真实宽度渲染,transform 缩到框内 ---------- */
    const sizeStage = () => {
      const [vw, vh] = WIDTHS[state.w] || WIDTHS.desktop;
      const avail = viewport.clientWidth || 1000;
      const s = Math.min(1, avail / vw);
      scaler.style.width = vw + 'px';
      scaler.style.height = vh + 'px';
      scaler.style.transform = 'scale(' + s.toFixed(4) + ')';
      fit.style.width = Math.round(vw * s) + 'px';
      fit.style.height = Math.round(vh * s) + 'px';
      frame.dataset.w = state.w;
    };

    /* ---------- 段:来自构建期抽取的 <section id="…"> ---------- */
    const fillSections = (el) => {
      let secs = [];
      try { secs = JSON.parse(el.dataset.sections || '[]'); } catch (e) { secs = []; }
      sectSel.innerHTML = '<option value="">整页</option>'
        + secs.map((s) => '<option value="' + s.id + '">' + escapeHtml(s.label) + '</option>').join('');
      sectSel.disabled = secs.length === 0;
      state.s = secs.some((s) => s.id === state.s) ? state.s : '';
      sectSel.value = state.s;
    };
    const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    const previewSrc = (el) => (el.dataset.preview ? 'packs/' + el.dataset.id + '/' + el.dataset.preview : '');

    /* ---------- 选中:改标题 / 段 / iframe / URL,不动导航 ---------- */
    const select = (id, opts = {}) => {
      const el = byId.get(id) || items.find((x) => !x.hidden);
      if (!el) return;
      state.pack = el.dataset.id;
      for (const it of items) it.setAttribute('aria-current', it === el ? 'true' : 'false');
      h.no.textContent = el.querySelector('.pk-no')?.textContent || '';
      h.name.textContent = el.dataset.name || el.dataset.id;
      h.when.textContent = el.dataset.when || '';
      h.cat.textContent = el.dataset.catLabel || '';
      const mode = el.dataset.modeLabel || '';
      h.mode.textContent = mode;
      h.mode.hidden = !mode;
      h.detail.href = 'p/' + el.dataset.id + '/';
      fillSections(el);
      const src = previewSrc(el);
      urlEl.textContent = src || '（无预览页）';
      if (src) {
        openNew.href = src;
        openNew.hidden = false;
        pv.hidden = false;
        document.getElementById('pv-empty').hidden = true;
        pv.src = src + (state.s ? '#' + state.s : '');
      } else {
        openNew.hidden = true;
        pv.removeAttribute('src');
        pv.hidden = true;
        document.getElementById('pv-empty').hidden = false;
      }
      sizeStage();
      if (opts.url !== false) syncUrl();
      if (opts.scroll && narrow()) frame.scrollIntoView({ block: 'start', behavior: calm() ? 'auto' : 'smooth' });
    };

    const syncUrl = () => {
      const q = new URLSearchParams();
      q.set('pack', state.pack || '');
      q.set('w', state.w);
      if (state.s) q.set('s', state.s);
      history.replaceState(history.state, '', location.pathname + '?' + q.toString());
    };

    /* ---------- 筛选 + 搜索 ---------- */
    const render = () => {
      const q = state.q.trim().toLowerCase();
      let shown = 0;
      for (const el of items) {
        const okCat = state.cat === 'all' || el.dataset.cat === state.cat;
        const okMode = state.mode === 'all' || el.dataset.mode === state.mode;
        const okQ = !q || (el.dataset.search || '').includes(q);
        const vis = okCat && okMode && okQ;
        el.hidden = !vis;
        if (vis) shown++;
      }
      emptyEl.hidden = shown !== 0;
      const cur = byId.get(state.pack);
      if (!cur || cur.hidden) select(visibleItems()[0]?.dataset.id, { url: false });
    };
    const visibleItems = () => items.filter((el) => !el.hidden);

    const setChip = (btns, active) => {
      for (const b of btns) {
        const on = b === active;
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      }
    };
    catFilters.forEach((b) => b.addEventListener('click', () => { setChip(catFilters, b); state.cat = b.dataset.cat; render(); }));
    modeFilters.forEach((b) => b.addEventListener('click', () => { setChip(modeFilters, b); state.mode = b.dataset.mode; render(); }));
    input?.addEventListener('input', () => { state.q = input.value || ''; render(); });
    resetBtn?.addEventListener('click', () => {
      state.cat = 'all'; state.mode = 'all'; state.q = '';
      if (input) input.value = '';
      setChip(catFilters, catFilters[0]);
      setChip(modeFilters, modeFilters[0]);
      render();
    });

    /* ---------- 宽度 / 段 / 重新加载 / 隐藏 ---------- */
    widthBtns.forEach((b) => b.addEventListener('click', () => {
      state.w = b.dataset.w;
      widthBtns.forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      sizeStage();
      syncUrl();
    }));
    sectSel?.addEventListener('change', () => {
      state.s = sectSel.value;
      const el = byId.get(state.pack);
      if (el && el.dataset.preview) pv.src = previewSrc(el) + (state.s ? '#' + state.s : '');
      syncUrl();
    });
    document.getElementById('reload')?.addEventListener('click', () => { pv.src = pv.src; });
    const hideBtn = document.getElementById('hide');
    hideBtn?.addEventListener('click', () => {
      const hidden = frame.dataset.hidden === '1';
      frame.dataset.hidden = hidden ? '0' : '1';
      hideBtn.textContent = hidden ? '隐藏预览' : '显示预览';
      hideBtn.setAttribute('aria-pressed', hidden ? 'false' : 'true');
      if (hidden) sizeStage();
    });
    widthBtns[0]?.classList.add('on');
    window.addEventListener('resize', sizeStage, { passive: true });

    /* ---------- 行:点/键盘都走 select ---------- */
    for (const el of items) {
      el.querySelector('.pk-a')?.addEventListener('click', (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;   // 让新标签页正常打开
        e.preventDefault();
        select(el.dataset.id, { scroll: true });
      });
    }

    /* ---------- 取用对话框 ---------- */
    const openUse = () => {
      const el = byId.get(state.pack);
      if (!el || !dlg) return;
      const data = packData[state.pack] || { name: el.dataset.name, snips: [] };
      dlgName.textContent = data.name || el.dataset.name;
      dlgSnips.innerHTML = (data.snips || []).map(([label, code]) =>
        '<div class="snip"><div class="snip-head"><span>' + escapeHtml(label) + '</span>'
        + '<button class="copy" type="button" data-copy="' + escapeHtml(code) + '">复制</button></div>'
        + '<pre><code>' + escapeHtml(code) + '</code></pre></div>').join('');
      dlgDetail.href = 'p/' + state.pack + '/';
      useShow();
    };
    document.getElementById('btn-use')?.addEventListener('click', openUse);
    document.getElementById('use-close')?.addEventListener('click', useClose);
    dlg?.addEventListener('click', (e) => { if (e.target === dlg) useClose(); });

    /* ---------- 键盘:↑↓ / j k 切换 · ↵ 取用 · o 详情 · / 搜索 · esc 关 ---------- */
    document.addEventListener('keydown', (e) => {
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select';
      if (e.key === '/' && !typing) { e.preventDefault(); input?.focus(); return; }
      if (e.key === 'Escape') {
        if (useOpen()) { useClose(); return; }
        if (document.activeElement === input) { input.value = ''; state.q = ''; render(); input.blur(); return; }
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      const vs = visibleItems();
      if (!vs.length) return;
      const i = Math.max(0, vs.findIndex((el) => el.dataset.id === state.pack));
      if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); select(vs[(i + 1) % vs.length].dataset.id); }
      else if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); select(vs[(i - 1 + vs.length) % vs.length].dataset.id); }
      else if (e.key === 'Enter') { e.preventDefault(); openUse(); }
      else if (e.key === 'o') { const el = byId.get(state.pack); if (el) location.href = 'p/' + el.dataset.id + '/'; }
    });
    document.getElementById('prev')?.addEventListener('click', () => {
      const vs = visibleItems(); const i = Math.max(0, vs.findIndex((el) => el.dataset.id === state.pack));
      select(vs[(i - 1 + vs.length) % vs.length].dataset.id);
    });
    document.getElementById('next')?.addEventListener('click', () => {
      const vs = visibleItems(); const i = Math.max(0, vs.findIndex((el) => el.dataset.id === state.pack));
      select(vs[(i + 1) % vs.length].dataset.id);
    });

    /* ---------- 初始化:URL > 种子 ---------- */
    const q = new URLSearchParams(location.search);
    state.w = WIDTHS[q.get('w')] ? q.get('w') : 'desktop';
    state.s = q.get('s') || '';
    widthBtns.forEach((x) => { const on = x.dataset.w === state.w; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    const wantPack = q.get('pack');
    const seed = listEl.dataset.seed;
    render();
    /* 首次进来也把三维状态写进 URL:刷新/分享/回退都不丢当前选择 */
    select((wantPack && byId.has(wantPack) ? wantPack : seed) || items[0]?.dataset.id);
    sizeStage();
  }

  /* ================================================ 详情页舞台 */
  const VP = { 1280: [1280, 800], 834: [834, 1112], 390: [390, 844] };
  const stage = document.getElementById('stage');
  let stageW = 1280;
  let stageFrame = null;

  const stageSize = () => {
    if (!stage || !stageFrame) return;
    const [vw, vh] = VP[stageW] || VP[1280];
    const w = stage.clientWidth || 1200;
    const h = stage.clientHeight || 660;          // 高度由 CSS 定(min(74vh,760px))
    const s = Math.min(w / vw, h / vh);           // 宽高都装得下:窄视口居中成「设备画框」
    const left = Math.max(0, (w - vw * s) / 2);
    stageFrame.style.width = vw + 'px';
    stageFrame.style.height = vh + 'px';
    stageFrame.style.marginLeft = left + 'px';
    stageFrame.style.transform = 'scale(' + s.toFixed(4) + ')';
    stageFrame.style.transformOrigin = '0 0';
  };
  const stageMount = () => {
    if (!stage || stageFrame) return;
    const holder = stage.querySelector('.stage-inner');
    if (!holder) return;
    const src = holder.dataset.src;
    if (!src) return;
    const fr = document.createElement('iframe');
    fr.src = src;
    fr.title = document.title;
    fr.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');
    fr.setAttribute('referrerpolicy', 'no-referrer');
    fr.addEventListener('load', stageSize);
    holder.querySelector('.poster')?.remove();
    holder.appendChild(fr);
    stageFrame = fr;
    stageSize();
  };
  if (stage) {
    stageMount();                     // 详情页只有一个舞台:直接跑,不要求点按
    stage.querySelector('.run')?.addEventListener('click', (e) => { e.preventDefault(); stageMount(); });
    const heads = [...document.querySelectorAll('.stage-head [data-w]')];
    heads.forEach((b) => b.addEventListener('click', () => {
      heads.forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      stageW = Number(b.dataset.w) || 1280;
      stageSize();
    }));
    document.querySelector('.stage-head #reload')?.addEventListener('click', () => {
      if (stageFrame) stageFrame.src = stageFrame.src;
    });
    window.addEventListener('resize', stageSize, { passive: true });
  }

  /* ================================================ 代码区:页签 + 复制 + 轻高亮 */
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
      out += '<span class="' + (m[1] ? 'tk-c' : m[2] ? 'tk-s' : 'tk-n') + '">' + esc(m[0]) + '</span>';
      i = re.lastIndex;
    }
    out += esc(text.slice(i));
    if (['js', 'json', 'py', 'ts'].includes(lang)) out = out.replace(KEYWORDS, '<span class="tk-k">$1</span>');
    return out;
  };
  const box = document.querySelector('.code-box');
  if (box) {
    box.querySelectorAll('pre code').forEach((c) => {
      const rel = c.closest('.pane')?.querySelector('.pane-head code')?.textContent || '';
      c.dataset.raw = c.textContent;
      c.innerHTML = tokenize(c.dataset.raw, rel.trim());   // tokenize 内部先转义 &<> 再套高亮 span,内容不含未转义输入
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
    try { await navigator.clipboard.writeText(text); } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:absolute;left:-9999px';   // 兜底复制用的离屏 textarea
      document.body.appendChild(ta); ta.select();
      /* execCommand 在老浏览器可能失败:复制失败不改 UI 文案之外的任何状态 —— 预期内失败 */
      try { document.execCommand('copy'); } catch (e2) { /* 预期:剪贴板不可用 */ }
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
