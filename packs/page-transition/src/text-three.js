import * as THREE from '../upstream/three.module.js';

    /**
     * Three.js 切屏文字选稿
     * 合同：慢 · 整路径 · 双向对称（非原地淡入）
     * T0 plane  — canvas 字贴平面，整板从底/顶推入
     * T1 glyph  — 采样字形为粒子，从屏外飞入组字（最贴 C）
     * T2 scatter— 旧字粒子炸散，新字从对侧重组
     * T3 depth  — 多层字面沿 Z 漂移 + Y 位移
     * T4 ribbon — 粒子沿对数螺线/流线汇入字形
     */

    const SECTIONS = [
      {
        k: 'Intro',
        h1: 'ASSETS',
        lines: ['Three 粒子字过场', '慢 · 整路径 · 双向对称'],
      },
      {
        k: 'Works',
        h1: '作品',
        lines: ['公开产品与内容入口', '示例项目甲 · 示例项目乙'],
      },
      {
        k: 'About',
        h1: '联系',
        lines: ['邮件 · 社交 · 站内', 'hello@example.com'],
      },
    ];

    const FX_LIST = [
      { id: 'plane',   name: 'T0 · 3D 字板位移',   d: 'canvas 字贴平面，整板从底/顶慢推（CSS 位移的 3D 版）' },
      { id: 'glyph',   name: 'T1 · 粒子组字',     d: '字形采样成粒子，从屏外飞入站位（最贴 C 星池）' },
      { id: 'scatter', name: 'T2 · 散射重组',     d: '旧字炸散，新字从对侧聚拢（双向完整）' },
      { id: 'depth',   name: 'T3 · 景深层叠',     d: '多层面沿 Z 分层，Y 位移 + 透视' },
      { id: 'ribbon',  name: 'T4 · 流线汇字',     d: '粒子沿弧线汇入字形，像被吸进字里' },
    ];

    const STORE = 'ptfx_text_three_v1';
    const SPEED_KEY = 'ptfx_text_three_speed_ms';

    let fx = 'glyph';
    let durMs = 2600;
    let sec = 0;
    let locked = false;
    let anim = null; // { t0, dur, from, to, dir, mode }

    /** 预览调参板驱动的两项(源件里这两个参数没接上,本包把它接进采样密度与点材质)。 */
    export const textParams = { density: 0.8, glow: 0.6 };
    const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

    try {
      const s = localStorage.getItem(STORE);
      if (s && FX_LIST.some((f) => f.id === s)) fx = s;
      const sp = Number(localStorage.getItem(SPEED_KEY));
      if (sp >= 1200 && sp <= 8000) durMs = sp;
    } catch { /* ignore */ }

    // ── UI ──
    const picker = document.getElementById('picker');
    const rail = document.getElementById('rail');
    const prog = document.getElementById('prog');

    FX_LIST.forEach((f, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pick' + (f.id === fx ? ' on' : '');
      b.dataset.fx = f.id;
      b.innerHTML = `<div class="n">T${i}</div><div class="t">${f.name}</div><div class="d">${f.d}</div>`;
      b.addEventListener('click', () => {
        fx = f.id;
        [...picker.querySelectorAll('.pick')].forEach((p) => p.classList.toggle('on', p.dataset.fx === fx));
        rebuildSectionMeshes();
        replay();
      });
      picker.appendChild(b);
    });

    SECTIONS.forEach((s, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = i === 0 ? 'on' : '';
      b.innerHTML = `<span class="lbl">${s.k}</span><span class="bar"></span>`;
      b.addEventListener('click', () => go(i));
      rail.appendChild(b);
    });

    function syncChrome() {
      [...rail.children].forEach((b, i) => b.classList.toggle('on', i === sec));
      prog.style.width = ((sec + 1) / 3 * 100) + '%';
      [...document.querySelectorAll('#speedRow button')].forEach((b) => {
        b.classList.toggle('on', Number(b.dataset.ms) === durMs);
      });
    }

    document.getElementById('speedRow').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-ms]');
      if (!btn) return;
      durMs = Number(btn.dataset.ms) || 2600;
      try { localStorage.setItem(SPEED_KEY, String(durMs)); } catch { /* ignore */ }
      syncChrome();
      replay();
    });

    document.getElementById('btnReplay').addEventListener('click', replay);
    document.getElementById('btnSave').addEventListener('click', () => {
      try { localStorage.setItem(STORE, fx); } catch { /* ignore */ }
      const b = document.getElementById('btnSave');
      b.textContent = '已保存 · ' + fx;
      setTimeout(() => { b.textContent = '选定保存'; }, 1600);
    });

    // ── Three ──
    const canvas = document.getElementById('c');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 1);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
    camera.position.set(0, 0, 28);

    // 背景星
    const starGeo = new THREE.BufferGeometry();
    const starN = 900;
    const starPos = new Float32Array(starN * 3);
    for (let i = 0; i < starN; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 80;
      starPos[i * 3 + 1] = (Math.random() - 0.5) * 50;
      starPos[i * 3 + 2] = -8 - Math.random() * 30;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.06, transparent: true, opacity: 0.55, depthAttenuation: true })
    );
    scene.add(stars);

    // 每屏一个 group
    const sectionGroups = SECTIONS.map(() => {
      const g = new THREE.Group();
      g.visible = false;
      scene.add(g);
      return g;
    });

    const GOLD = 0xc4a574;
    const WHITE = 0xf2efe8;

    function easeInOut(t) {
      // 前段不抢、中段可跟（慢读）
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }

    function makeTextCanvas(secData, opts = {}) {
      const scale = opts.scale || 2;
      const w = 1024 * scale;
      const h = 640 * scale;
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, w, h);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = `500 ${22 * scale}px "JetBrains Mono", Consolas, monospace`;
      ctx.letterSpacing = `${6 * scale}px`;
      ctx.fillText(secData.k.toUpperCase(), w / 2, h * 0.28);
      ctx.fillStyle = '#f6f4ef';
      ctx.font = `900 ${96 * scale}px "Noto Serif SC", "Source Han Serif SC", serif`;
      ctx.letterSpacing = '0px';
      ctx.fillText(secData.h1, w / 2, h * 0.48);
      ctx.fillStyle = 'rgba(255,255,255,0.48)';
      ctx.font = `400 ${26 * scale}px "Noto Sans SC", sans-serif`;
      secData.lines.forEach((line, i) => {
        ctx.fillText(line, w / 2, h * 0.62 + i * 36 * scale);
      });
      return cv;
    }

    /** 采样 canvas 非透明像素 → 粒子位置（本地坐标） */
    function sampleCanvas(cv, maxPts = 2800) {
      const ctx = cv.getContext('2d');
      const { width: w, height: h } = cv;
      const data = ctx.getImageData(0, 0, w, h).data;
      const step = Math.max(2, Math.floor(Math.sqrt((w * h) / (maxPts * 4))));
      const pts = [];
      for (let y = 0; y < h; y += step) {
        for (let x = 0; x < w; x += step) {
          const a = data[(y * w + x) * 4 + 3];
          if (a < 40) continue;
          // 归一化到世界：宽约 16，高按比例
          const nx = (x / w - 0.5) * 16;
          const ny = -(y / h - 0.5) * 10;
          pts.push(nx, ny, 0);
        }
      }
      return new Float32Array(pts);
    }

    function disposeGroup(g) {
      while (g.children.length) {
        const o = g.children.pop();
        o.geometry?.dispose?.();
        if (o.material) {
          if (o.material.map) o.material.map.dispose();
          o.material.dispose();
        }
      }
    }

    function buildPlane(secData) {
      const g = new THREE.Group();
      const cv = makeTextCanvas(secData, { scale: 1 });
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(16, 10), mat);
      g.add(mesh);
      g.userData.kind = 'plane';
      return g;
    }

    function buildPoints(secData, kind) {
      const g = new THREE.Group();
      const cv = makeTextCanvas(secData, { scale: 1 });
      const target = sampleCanvas(cv, Math.round((kind === 'ribbon' ? 2200 : 3200) * textParams.density));
      const n = target.length / 3;
      const pos = new Float32Array(n * 3);
      const home = target.slice();
      const seed = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        seed[i] = Math.random();
        // 初始在目标（进场前由 anim 覆盖）
        pos[i * 3] = home[i * 3];
        pos[i * 3 + 1] = home[i * 3 + 1];
        pos[i * 3 + 2] = home[i * 3 + 2];
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({
        color: kind === 'ribbon' ? GOLD : WHITE,
        size: (kind === 'scatter' ? 0.09 : 0.07) * (0.5 + textParams.glow * 1.2),
        transparent: true,
        opacity: Math.min(1, 0.5 + textParams.glow * 0.7),
        depthWrite: false,
        sizeAttenuation: true,
      });
      const pts = new THREE.Points(geo, mat);
      g.add(pts);
      g.userData = { kind, home, seed, n, pts };
      return g;
    }

    function buildDepth(secData) {
      const g = new THREE.Group();
      // 三层：k / h1 / lines 略错 Z
      const layers = [
        { text: secData.k.toUpperCase(), y: 2.4, z: -1.2, size: 0.55, color: 0x888888 },
        { text: secData.h1, y: 0.2, z: 0, size: 1.6, color: WHITE },
        { text: secData.lines.join('  ·  '), y: -2.0, z: 0.8, size: 0.42, color: 0x999999 },
      ];
      layers.forEach((L) => {
        const cv = document.createElement('canvas');
        cv.width = 1024; cv.height = 256;
        const ctx = cv.getContext('2d');
        ctx.clearRect(0, 0, 1024, 256);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = L.size > 1 ? '900 120px "Noto Serif SC", serif' : '500 48px "Noto Sans SC", sans-serif';
        ctx.fillText(L.text, 512, 128);
        const tex = new THREE.CanvasTexture(cv);
        tex.colorSpace = THREE.SRGBColorSpace;
        const mat = new THREE.MeshBasicMaterial({
          map: tex, transparent: true, depthWrite: false, color: L.color,
        });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.5), mat);
        mesh.position.set(0, L.y, L.z);
        g.add(mesh);
      });
      g.userData = { kind: 'depth' };
      return g;
    }

    function buildForSection(secData, mode) {
      if (mode === 'plane') return buildPlane(secData);
      if (mode === 'depth') return buildDepth(secData);
      return buildPoints(secData, mode); // glyph | scatter | ribbon
    }

    function rebuildSectionMeshes() {
      SECTIONS.forEach((data, i) => {
        const host = sectionGroups[i];
        disposeGroup(host);
        const built = buildForSection(data, fx);
        // 把 built 的 children 挪进 host，保留 userData
        host.userData = built.userData;
        while (built.children.length) host.add(built.children[0]);
        host.visible = i === sec;
        host.position.set(0, 0, 0);
        host.scale.set(1, 1, 1);
        if (host.userData.pts) {
          // 重置到 home
          const { home, n, pts } = host.userData;
          const arr = pts.geometry.attributes.position.array;
          for (let k = 0; k < n * 3; k++) arr[k] = home[k];
          pts.geometry.attributes.position.needsUpdate = true;
          pts.material.opacity = 1;
        }
      });
    }

    // ── 动画：双向慢位移 / 调参板回调 ──
    /** 预览调参板回调:改密度/辉光后重建当前形态(重采样一次字形,成本低)。 */
    export function applyTextParams(values = {}) {
      if (values.density != null) textParams.density = Number(values.density);
      if (values.glow != null) textParams.glow = Number(values.glow);
      rebuildSectionMeshes();
    }

    const TRAVEL_Y = 14; // 世界单位，约大半屏

    function particleStartPos(i, home, seed, dir, mode) {
      // dir>0 从下方来；dir<0 从上方来
      const hx = home[i * 3];
      const hy = home[i * 3 + 1];
      const s = seed[i];
      if (mode === 'scatter') {
        // 散射起点：对侧散开
        const ang = s * Math.PI * 2;
        const r = 6 + s * 10;
        return {
          x: hx + Math.cos(ang) * r,
          y: hy + (dir > 0 ? -TRAVEL_Y : TRAVEL_Y) * (0.6 + s * 0.5) + Math.sin(ang) * 3,
          z: (s - 0.5) * 8,
        };
      }
      if (mode === 'ribbon') {
        const ang = s * Math.PI * 4;
        const r = 3 + s * 5;
        return {
          x: Math.cos(ang) * r,
          y: (dir > 0 ? -1 : 1) * TRAVEL_Y * (0.7 + s * 0.4),
          z: Math.sin(ang) * r - 2,
        };
      }
      // glyph：从屏外带状进入
      return {
        x: hx + (s - 0.5) * 4,
        y: hy + (dir > 0 ? -TRAVEL_Y : TRAVEL_Y) * (0.85 + s * 0.3),
        z: (s - 0.5) * 3,
      };
    }

    function applyGroupAt(g, p, dir, mode, role /* 'enter'|'leave'|'idle' */) {
      // p: 0..1 进度
      const e = easeInOut(Math.min(1, Math.max(0, p)));
      const ud = g.userData;

      if (ud.kind === 'plane' || ud.kind === 'depth') {
        let y = 0;
        let op = 1;
        if (role === 'enter') {
          y = (dir > 0 ? -TRAVEL_Y : TRAVEL_Y) * (1 - e);
          op = 0.15 + 0.85 * e;
        } else if (role === 'leave') {
          y = (dir > 0 ? TRAVEL_Y : -TRAVEL_Y) * e;
          op = 1 - e * 0.95;
        }
        g.position.y = y;
        g.traverse((o) => {
          if (o.material && o.material.opacity != null) {
            o.material.opacity = op * (ud.kind === 'depth' ? 0.95 : 1);
            o.material.transparent = true;
          }
        });
        if (ud.kind === 'depth') {
          g.rotation.x = (role === 'enter' ? (1 - e) : e) * (dir > 0 ? 0.12 : -0.12);
        }
        return;
      }

      // points
      const { home, seed, n, pts } = ud;
      if (!pts) return;
      const arr = pts.geometry.attributes.position.array;
      for (let i = 0; i < n; i++) {
        const hx = home[i * 3];
        const hy = home[i * 3 + 1];
        const hz = home[i * 3 + 2];
        let x, y, z;
        if (role === 'idle') {
          x = hx; y = hy; z = hz;
        } else if (role === 'enter') {
          const st = particleStartPos(i, home, seed, dir, mode);
          x = st.x + (hx - st.x) * e;
          y = st.y + (hy - st.y) * e;
          z = st.z + (hz - st.z) * e;
        } else {
          // leave：飞向对侧
          const leaveDir = dir; // 与进场同 dir 时旧块往「前进方向」离开
          const st = particleStartPos(i, home, seed, -leaveDir, mode === 'scatter' ? 'scatter' : mode);
          // 离开时目标是「前进方向外侧」
          const outY = hy + (leaveDir > 0 ? TRAVEL_Y : -TRAVEL_Y) * (0.9 + seed[i] * 0.4);
          const outX = hx + (seed[i] - 0.5) * (mode === 'scatter' ? 14 : 3);
          const outZ = (seed[i] - 0.5) * (mode === 'scatter' ? 10 : 2);
          x = hx + (outX - hx) * e;
          y = hy + (outY - hy) * e;
          z = hz + (outZ - hz) * e;
        }
        arr[i * 3] = x;
        arr[i * 3 + 1] = y;
        arr[i * 3 + 2] = z;
      }
      pts.geometry.attributes.position.needsUpdate = true;
      if (role === 'enter') pts.material.opacity = 0.2 + 0.75 * e;
      else if (role === 'leave') pts.material.opacity = 0.95 * (1 - e * 0.85);
      else pts.material.opacity = 0.92;
    }

    function startAnim(from, to, dir) {
      locked = true;
      anim = {
        t0: performance.now(),
        dur: durMs,
        from, to, dir, mode: fx,
      };
      // 准备可见性
      sectionGroups.forEach((g, i) => {
        g.visible = i === from || i === to;
      });
      // 进场初始态
      applyGroupAt(sectionGroups[to], 0, dir, fx, 'enter');
      applyGroupAt(sectionGroups[from], 0, dir, fx, 'leave');
    }

    function go(n) {
      if (n === sec || locked) return;
      if (n < 0 || n > 2) return;
      const dir = n > sec ? 1 : -1;
      startAnim(sec, n, dir);
      sec = n;
      syncChrome();
    }

    function replay() {
      if (locked) return;
      // 当前沉到底再推上
      const cur = sec;
      // 假 from：不可见空；用自身 leave 到 enter
      locked = true;
      anim = {
        t0: performance.now(),
        dur: durMs,
        from: -1,
        to: cur,
        dir: 1,
        mode: fx,
        solo: true,
      };
      sectionGroups.forEach((g, i) => { g.visible = i === cur; });
      applyGroupAt(sectionGroups[cur], 0, 1, fx, 'enter');
    }

    // 滚轮 / 键
    let wheelAcc = 0;
    let wheelT = 0;
    window.addEventListener('wheel', (e) => {
      if (e.target.closest('.picker')) return;
      e.preventDefault();
      if (locked) return;
      const now = performance.now();
      if (now - wheelT > 500) wheelAcc = 0;
      wheelT = now;
      wheelAcc += e.deltaY;
      if (Math.abs(wheelAcc) < 48) return;
      const dir = wheelAcc > 0 ? 1 : -1;
      wheelAcc = 0;
      go(sec + dir);
    }, { passive: false });

    window.addEventListener('keydown', (e) => {
      if (locked && (e.key.startsWith('Arrow') || e.key === 'PageDown' || e.key === 'PageUp')) return;
      if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); go(sec + 1); }
      if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); go(sec - 1); }
      if (e.key === '1') go(0);
      if (e.key === '2') go(1);
      if (e.key === '3') go(2);
      if (e.key === 'r' || e.key === 'R') replay();
    });

    function resize() {
      const w = innerWidth;
      const h = innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    addEventListener('resize', resize);
    resize();

    function tick(now) {
      if (!REDUCED) {
        // 星空微漂(减少动态时不动)
        stars.rotation.y = now * 0.00002;
        stars.rotation.x = Math.sin(now * 0.00005) * 0.02;
      }

      if (anim) {
        const p = (now - anim.t0) / anim.dur;
        const { from, to, dir, mode, solo } = anim;
        if (solo) {
          applyGroupAt(sectionGroups[to], p, dir, mode, 'enter');
        } else {
          applyGroupAt(sectionGroups[from], p, dir, mode, 'leave');
          applyGroupAt(sectionGroups[to], p, dir, mode, 'enter');
        }
        if (p >= 1) {
          // 收口
          sectionGroups.forEach((g, i) => {
            g.visible = i === to;
            if (i === to) applyGroupAt(g, 1, dir, mode, 'idle');
          });
          anim = null;
          locked = false;
        }
      } else {
        // idle 微呼吸
        const g = sectionGroups[sec];
        if (!REDUCED && g?.userData?.kind === 'depth') {
          g.position.y = Math.sin(now * 0.0006) * 0.08;
        }
      }

      renderer.render(scene, camera);
      requestAnimationFrame(tick);
    }

    rebuildSectionMeshes();
    syncChrome();
    // 首屏慢推入
    replay();
    requestAnimationFrame(tick);
