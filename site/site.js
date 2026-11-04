/* sai-assets 外壳脚本:主题、索引悬停预览、筛选搜索、详情舞台、代码区。
   零依赖;无 JS 时索引行仍是普通链接,详情页仍有静态兜底。 */
(() => {
  'use strict';

  /* ------------------------------------------------ 深浅主题 */
  const THEME_KEY = 'sai-assets-theme';
  const btn = document.getElementById('theme-btn');
  const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;
  const current = () => document.documentElement.dataset.theme || (systemDark() ? 'charcoal' : 'paper');
  const apply = (name, persist) => {
    document.documentElement.dataset.theme = name;
    if (btn) btn.setAttribute('aria-pressed', name === 'charcoal' ? 'true' : 'false');
    /* localStorage 在隐私模式/禁用存储时会抛错:主题仍生效,只是不记住 —— 预期内失败,故空 catch */
    if (persist) { try { localStorage.setItem(THEME_KEY, name); } catch (e) { /* 预期:存储不可用 */ } }
  };
  apply(current(), false);
  if (btn) btn.addEventListener('click', () => apply(current() === 'charcoal' ? 'paper' : 'charcoal', true));

  /* ------------------------------------------------ 索引:滚动入场 */
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

  /* ------------------------------------------------ 索引:悬停预览 */
  const peek = document.getElementById('peek');
  const wide = () => window.matchMedia('(min-width: 1101px)').matches;
  const PEEK_W = 1280, PEEK_H = 800;
  let peekFrame = null, peekSrc = '', hideTimer = 0;

  const peekSize = () => {
    if (!peek || !peekFrame) return;
    const w = peek.clientWidth || 480;
    const s = w / PEEK_W;
    peekFrame.style.width = PEEK_W + 'px';
    peekFrame.style.height = PEEK_H + 'px';
    peekFrame.style.transform = 'scale(' + s.toFixed(4) + ')';
  };
  const peekShow = (row) => {
    if (!peek || !wide()) return;
    const src = row.dataset.src;
    if (!src) {
      const safe = String(row.dataset.title || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      peek.innerHTML = '<div class="peek-empty"><b>' + safe + '</b>'
        + '<span>外部索引 · 内容在其本家仓库</span></div>';
      peek.classList.add('on');
      return;
    }
    if (src !== peekSrc) {
      peek.innerHTML = '';
      const fr = document.createElement('iframe');
      fr.src = src;
      fr.title = row.dataset.title || '预览';
      fr.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');
      fr.setAttribute('referrerpolicy', 'no-referrer');
      fr.addEventListener('load', peekSize);
      peek.appendChild(fr);
      peekFrame = fr;
      peekSrc = src;
      peekSize();
    }
    peek.classList.add('on');
  };
  const peekHide = () => { if (peek) peek.classList.remove('on'); };

  if (peek) {
    document.querySelectorAll('.row').forEach((row) => {
      row.addEventListener('mouseenter', () => { clearTimeout(hideTimer); peekShow(row); });
      row.addEventListener('mouseleave', () => { hideTimer = setTimeout(peekHide, 140); });
      row.addEventListener('focusin', () => { clearTimeout(hideTimer); peekShow(row); });
      row.addEventListener('focusout', () => { hideTimer = setTimeout(peekHide, 140); });
    });
    window.addEventListener('resize', peekSize, { passive: true });
    let scrollQueued = false;
    window.addEventListener('scroll', () => {
      if (scrollQueued) return;
      scrollQueued = true;
      requestAnimationFrame(() => { scrollQueued = false; peekHide(); });
    }, { passive: true });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') peekHide(); });
  }

  /* ------------------------------------------------ 索引:类目 + 搜索 */
  const list = document.getElementById('rows');
  if (list) {
    const all = [...list.querySelectorAll('.row')];
    const filters = [...document.querySelectorAll('.filter[data-cat]')];
    const input = document.getElementById('q');
    const hint = document.getElementById('q-hint');
    const empty = document.getElementById('empty');
    let cat = 'all';
    const render = () => {
      const q = (input?.value || '').trim().toLowerCase();
      let shown = 0;
      for (const row of all) {
        const okCat = cat === 'all' || row.dataset.cat === cat;
        const okQ = !q || row.dataset.search.includes(q);
        const vis = okCat && okQ;
        row.hidden = !vis;
        if (vis) shown++;
      }
      if (hint) hint.textContent = (q || cat !== 'all') ? shown + ' / ' + all.length : '';
      if (empty) empty.hidden = shown !== 0;
      peekHide();
    };
    filters.forEach((f) => f.addEventListener('click', () => {
      filters.forEach((x) => x.classList.remove('on'));
      f.classList.add('on');
      cat = f.dataset.cat;
      render();
    }));
    input?.addEventListener('input', render);
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== input) { e.preventDefault(); input?.focus(); }
      if (e.key === 'Escape' && document.activeElement === input) { input.value = ''; render(); input.blur(); }
    });
    const hash = (location.hash || '').slice(1);
    const hit = filters.find((f) => f.dataset.cat === hash);
    if (hit) hit.click();
    render();
  }

  /* ------------------------------------------------ 详情页舞台 */
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
  const stageMount = (force) => {
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
    const runBtn = stage.querySelector('.run');
    stageMount();                     // 详情页只有一个舞台:直接跑,不要求点按
    runBtn?.addEventListener('click', (e) => { e.preventDefault(); stageMount(); });
    document.querySelectorAll('.stage-head [data-w]').forEach((b) => b.addEventListener('click', () => {
      document.querySelectorAll('.stage-head [data-w]').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      stageW = Number(b.dataset.w) || 1280;
      stageSize();
    }));
    document.getElementById('reload')?.addEventListener('click', () => {
      if (stageFrame) stageFrame.src = stageFrame.src; else stageMount();
    });
    window.addEventListener('resize', stageSize, { passive: true });
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
