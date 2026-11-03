/**
     * 整块位移过场（非原地淡入）
     * 下一屏：旧 is-leave-up（上移离开）+ 新从 below 推到 is-active
     * 上一屏：旧 is-leave-down + 新从 above 推到 is-active
     * 字粒等只是叠在位移上的细节
     */
    const FX_LIST = [
      { id: 'chars',   name: '9 · 整块上推 + 字粒', d: '你选的方向：整屏位移 + 逐字站稳（推荐）' },
      { id: 'travel',  name: '纯整块上推',         d: '只有 panel 从底推到中，无字内动画' },
      { id: 'stagger', name: '整块 + 行阶梯',       d: '位移中行错峰跟上' },
      { id: 'blur',    name: '整块 + 解模糊',       d: '从底推上来同时 blur→清' },
      { id: 'stroke',  name: '整块 + 描边填色',     d: '标题空心→实心' },
      { id: 'shine',   name: '整块 + 金线扫',       d: '到位后标题扫光' },
    ];

    const STORE = 'ptfx_section_travel_v1';
    const SPEED_KEY = 'ptfx_section_travel_speed_ms';
    const stages = [...document.querySelectorAll('.stage')];
    const picker = document.getElementById('picker');
    const rail = document.getElementById('rail');
    const prog = document.getElementById('prog');
    let sec = 0;
    let locked = false;
    let fx = 'chars'; // 默认你选的 9
    let durMs = 2600; // 默认慢

    try {
      const saved = localStorage.getItem(STORE);
      // 旧版 12 套 id 映射到新合同
      const map = {
        fade: 'travel', rise: 'stagger', wipe: 'travel', curtain: 'travel',
        scale: 'travel', skew: 'stagger', flip: 'stagger', pop: 'stagger',
        chars: 'chars', blur: 'blur', stroke: 'stroke', shine: 'shine', travel: 'travel', stagger: 'stagger',
      };
      if (saved) fx = map[saved] || (FX_LIST.some((f) => f.id === saved) ? saved : 'chars');
      const sp = Number(localStorage.getItem(SPEED_KEY));
      if (sp >= 1200 && sp <= 8000) durMs = sp;
    } catch { /* ignore */ }

    function applyDuration() {
      document.documentElement.style.setProperty('--dur', `${(durMs / 1000).toFixed(2)}s`);
      [...document.querySelectorAll('#speedBox button')].forEach((b) => {
        b.classList.toggle('on', Number(b.dataset.ms) === durMs);
      });
      // 字粒 delay 随速度拉长，才跟得上慢位移
      if (fx === 'chars') resplitDelays();
    }

    function resplitDelays() {
      const step = Math.max(0.035, (durMs / 1000) * 0.028);
      const base = (durMs / 1000) * 0.18;
      stages.forEach((stage) => {
        stage.querySelectorAll('.fx-item .char').forEach((span, i) => {
          span.style.transitionDelay = `${base + i * step}s`;
        });
      });
    }

    document.getElementById('speedBox')?.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-ms]');
      if (!btn) return;
      durMs = Number(btn.dataset.ms) || 2600;
      try { localStorage.setItem(SPEED_KEY, String(durMs)); } catch { /* ignore */ }
      applyDuration();
      replayCurrent();
    });

    FX_LIST.forEach((f, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pick' + (f.id === fx ? ' on' : '');
      b.dataset.fx = f.id;
      b.innerHTML = `<div class="n">OPT ${String(i + 1).padStart(2, '0')}</div><div class="t">${f.name}</div><div class="d">${f.d}</div>`;
      b.addEventListener('click', () => selectFx(f.id, true));
      picker.appendChild(b);
    });

    ['Who', 'Projects', 'About'].forEach((lab, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = i === 0 ? 'on' : '';
      b.innerHTML = `<span class="lbl">${lab}</span><span class="bar"></span>`;
      b.addEventListener('click', () => go(i));
      rail.appendChild(b);
    });

    function clearMotionClasses(el) {
      el.classList.remove(
        'is-active', 'is-leave-up', 'is-leave-down',
        'is-prep-below', 'is-enter-from-above'
      );
    }

    function applyFxAttr() {
      stages.forEach((s) => s.setAttribute('data-fx', fx));
      if (fx === 'chars') splitAll();
      else unsplitAll();
    }

    function splitAll() {
      stages.forEach((stage) => {
        stage.querySelectorAll('.fx-item').forEach((el) => {
          if (el.dataset.split === '1') return;
          if (el.classList.contains('list')) return;
          const text = el.textContent;
          el.dataset.raw = text;
          el.dataset.split = '1';
          el.textContent = '';
          let i = 0;
          for (const ch of text) {
            if (ch === ' ' || ch === '·') {
              el.appendChild(document.createTextNode(ch === '·' ? ' · ' : ' '));
              continue;
            }
            const span = document.createElement('span');
            span.className = 'char';
            span.textContent = ch;
            // delay 在 applyDuration/resplitDelays 里按 --dur 重算
            el.appendChild(span);
            i++;
          }
        });
      });
      resplitDelays();
    }

    function unsplitAll() {
      stages.forEach((stage) => {
        stage.querySelectorAll('.fx-item[data-split="1"]').forEach((el) => {
          el.textContent = el.dataset.raw || '';
          delete el.dataset.split;
          delete el.dataset.raw;
        });
      });
    }

    function selectFx(id, replay) {
      fx = id;
      [...picker.querySelectorAll('.pick')].forEach((p) => {
        p.classList.toggle('on', p.dataset.fx === id);
      });
      applyFxAttr();
      if (replay) replayCurrent();
    }

    /** 调参板回调:时长(s)/位移(vh)/变体 直接落到 CSS 变量与内部锁表时长上。 */
    export function applyTravelParams(values = {}) {
      if (values.dur != null) {
        const ms = Math.round(Number(values.dur) * 1000);
        if (Number.isFinite(ms) && ms >= 200) {
          durMs = ms;
          applyDuration();
        }
      }
      if (values.travel != null) {
        document.documentElement.style.setProperty('--travel', Number(values.travel) + 'vh');
      }
      if (values.variant && values.variant !== fx) selectFx(values.variant, true);
    }

    function syncChrome(n) {
      [...rail.children].forEach((b, i) => b.classList.toggle('on', i === n));
      prog.style.width = ((n + 1) / 3 * 100) + '%';
    }

    /**
     * 完整过场（双向对称、同速）：
     * dir > 0：旧 leave-up，新从底 prep-below → active
     * dir < 0：旧 leave-down，新从顶 enter-from-above → active
     */
    function go(n) {
      if (n === sec || locked) return;
      if (n < 0 || n > 2) return;
      locked = true;
      const prev = sec;
      const dir = n > prev ? 1 : -1;
      const out = stages[prev];
      const inn = stages[n];

      // 1) 准备进场位：无 transition 放到起点
      clearMotionClasses(inn);
      if (dir > 0) {
        inn.classList.add('is-prep-below'); // 在底部
      } else {
        inn.classList.add('is-enter-from-above'); // 在上方
      }
      void inn.offsetWidth; // reflow

      // 2) 同一帧：旧离开 + 新进 active（时长 = --dur）
      requestAnimationFrame(() => {
        clearMotionClasses(out);
        if (dir > 0) out.classList.add('is-leave-up');
        else out.classList.add('is-leave-down');

        inn.classList.remove('is-prep-below', 'is-enter-from-above');
        inn.classList.add('is-active');

        sec = n;
        syncChrome(n);

        // 锁满整段慢动画，禁止中途打断
        setTimeout(() => {
          stages.forEach((s, i) => {
            if (i !== sec) clearMotionClasses(s);
          });
          locked = false;
        }, durMs + 80);
      });
    }

    function replayCurrent() {
      if (locked) return;
      locked = true;
      const s = stages[sec];
      // 当前先沉到底，再推上来 = 完整「从底部移上来」过程
      clearMotionClasses(s);
      s.classList.add('is-prep-below');
      void s.offsetWidth;
      requestAnimationFrame(() => {
        s.classList.remove('is-prep-below');
        s.classList.add('is-active');
        setTimeout(() => { locked = false; }, durMs + 80);
      });
    }

    // 滚轮：阈值略高；动画锁定期内忽略
    let wheelAcc = 0;
    let wheelT = 0;
    window.addEventListener('wheel', (e) => {
      if (e.target.closest('.picker')) return;
      e.preventDefault();
      if (locked) return;
      const now = performance.now();
      if (now - wheelT > Math.max(500, durMs * 0.2)) wheelAcc = 0;
      wheelT = now;
      wheelAcc += e.deltaY;
      if (Math.abs(wheelAcc) < 48) return;
      const dir = wheelAcc > 0 ? 1 : -1;
      wheelAcc = 0;
      go(sec + dir);
    }, { passive: false });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); go(sec + 1); }
      if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); go(sec - 1); }
      if (e.key === '1') go(0);
      if (e.key === '2') go(1);
      if (e.key === '3') go(2);
      if (e.key === 'r' || e.key === 'R') replayCurrent();
    });

    document.getElementById('btnReplay').addEventListener('click', replayCurrent);
    document.getElementById('btnSave').addEventListener('click', () => {
      try { localStorage.setItem(STORE, fx); } catch { /* ignore */ }
      const btn = document.getElementById('btnSave');
      btn.textContent = '已保存 · ' + fx;
      setTimeout(() => { btn.textContent = '选定保存'; }, 1600);
    });

    // 星空
    (function stars() {
      const cv = document.getElementById('stars');
      const ctx = cv.getContext('2d');
      let pts;
      function resize() {
        cv.width = innerWidth * devicePixelRatio;
        cv.height = innerHeight * devicePixelRatio;
        ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
        pts = Array.from({ length: 180 }, () => ({
          x: Math.random() * innerWidth,
          y: Math.random() * innerHeight,
          r: Math.random() * 1.2 + 0.2,
          a: Math.random() * 0.7 + 0.15,
          s: Math.random() * 0.15 + 0.02,
        }));
      }
      resize();
      addEventListener('resize', resize);
      let t0 = performance.now();
      function tick(t) {
        const dt = Math.min(40, t - t0); t0 = t;
        ctx.clearRect(0, 0, innerWidth, innerHeight);
        for (const p of pts) {
          p.y += p.s * dt * 0.02;
          if (p.y > innerHeight) p.y = 0;
          ctx.beginPath();
          ctx.fillStyle = `rgba(255,255,255,${p.a})`;
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    })();

    applyFxAttr();
    applyDuration();
    syncChrome(0);
    // 首屏：从底部慢推入，看到完整过程
    requestAnimationFrame(() => {
      const s0 = stages[0];
      clearMotionClasses(s0);
      s0.classList.add('is-prep-below');
      void s0.offsetWidth;
      requestAnimationFrame(() => {
        s0.classList.remove('is-prep-below');
        s0.classList.add('is-active');
      });
    });
