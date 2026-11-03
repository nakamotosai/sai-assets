/**
 * Theme Lab · particle motion previews
 * Source: F:\saaaai-homepage demos/C-gold-flow + shared/fx.js
 * Wall 用 2D canvas 轻量示意，非生产 Three 池（生产见 saaaai-homepage）。
 */
export function startParticleMotion(canvas, variant, opts = {}) {
  const reduced = !!opts.reduced;
  const ctx = canvas.getContext("2d");
  let raf = 0;
  let alive = true;
  let w = 0;
  let h = 0;
  let t0 = performance.now();
  let mouse = { x: 0.5, y: 0.5, active: false };
  let state = null;

  // opts: density, spin, text, dotScale, goldRgb, whiteRgb
  const density = Math.max(0.35, Math.min(2.5, Number(opts.density) || 1));
  const spinOpt = Number(opts.spin);
  const demoText = String(opts.text || "nakamotosai").slice(0, 32) || "nakamotosai";
  const dotScale = Math.max(0.4, Math.min(3, Number(opts.dotScale) || 1));
  const GOLD = Array.isArray(opts.goldRgb) ? opts.goldRgb : [232, 197, 120];
  const WHITE = Array.isArray(opts.whiteRgb) ? opts.whiteRgb : [240, 242, 248];

  const onMove = (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) / Math.max(1, r.width);
    mouse.y = (e.clientY - r.top) / Math.max(1, r.height);
    mouse.active = true;
  };
  const onLeave = () => {
    mouse.active = false;
  };
  // all variants accept pointer (text-push needs it; others mild parallax)
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.style.touchAction = "none";

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    w = Math.max(160, rect.width);
    h = Math.max(140, rect.height);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state = build(variant, w, h);
  }

  function hash(i) {
    const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  function sampleText(text, targetN, bw, bh) {
    const cv = document.createElement("canvas");
    const c = cv.getContext("2d", { willReadFrequently: true });
    const fs = Math.floor(Math.min(bw * 0.22, bh * 0.42));
    cv.width = Math.ceil(bw);
    cv.height = Math.ceil(bh);
    c.fillStyle = "#000";
    c.fillRect(0, 0, cv.width, cv.height);
    c.fillStyle = "#fff";
    c.font = `700 ${fs}px "JetBrains Mono", ui-monospace, monospace`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(text, cv.width / 2, cv.height / 2);
    const img = c.getImageData(0, 0, cv.width, cv.height).data;
    const pts = [];
    const step = Math.max(2, Math.floor(fs / 14));
    for (let y = 0; y < cv.height; y += step) {
      for (let x = 0; x < cv.width; x += step) {
        if (img[(y * cv.width + x) * 4 + 3] > 140) {
          pts.push({
            ox: x,
            oy: y,
            x: x,
            y: y,
            vx: 0,
            vy: 0,
          });
        }
      }
    }
    if (!pts.length) {
      for (let i = 0; i < targetN; i++) {
        pts.push({
          ox: bw * 0.2 + (i / targetN) * bw * 0.6,
          oy: bh * 0.5,
          x: bw * 0.2 + (i / targetN) * bw * 0.6,
          y: bh * 0.5,
          vx: 0,
          vy: 0,
        });
      }
    }
    // downsample if dense
    if (pts.length > targetN) {
      const keep = [];
      const stride = pts.length / targetN;
      for (let i = 0; i < targetN; i++) keep.push(pts[Math.floor(i * stride)]);
      return keep;
    }
    return pts;
  }

  function build(v, bw, bh) {
    if (v === "text-push") {
      const n = Math.floor(900 * density);
      const pts = sampleText(demoText, n, bw, bh);
      return { pts };
    }
    if (v === "starfield") {
      const n = Math.floor(220 * density);
      const pts = [];
      for (let i = 0; i < n; i++) {
        pts.push({
          x: hash(i) * bw,
          y: hash(i + 3) * bh,
          z: 0.2 + hash(i + 7) * 0.8,
          a: 0.25 + hash(i + 11) * 0.65,
          vx: (hash(i + 13) - 0.5) * 0.12,
          vy: (hash(i + 17) - 0.5) * 0.08,
        });
      }
      return { pts };
    }
    if (v === "galaxy") {
      const n = Math.floor(1400 * density);
      const pts = [];
      for (let i = 0; i < n; i++) {
        const u = hash(i);
        const kind = u < 0.08 ? 0 : u < 0.7 ? 1 : 2; // bulge / arm / haze
        pts.push({
          kind,
          u,
          r0:
            kind === 0
              ? Math.pow(hash(i + 2), 0.85) * 0.22
              : kind === 1
                ? 0.12 + (-Math.log(1 - hash(i + 2) * 0.92)) * 0.28
                : 0.15 + Math.pow(hash(i + 2), 0.7) * 0.9,
          arm: (hash(i + 5) * 2) | 0,
          sc: (hash(i + 9) - 0.5) * 2,
          z0: (hash(i + 13) - 0.5) * 2,
          glow: 1,
        });
      }
      return { pts, spin: Number.isFinite(spinOpt) ? spinOpt : 0.14 };
    }
    if (v === "curl") {
      // 7 团云絮 + 流场
      const n = Math.floor(1100 * density);
      const pts = [];
      const blobs = 7;
      for (let i = 0; i < n; i++) {
        const b = (i * 7) % blobs;
        const bx = Math.cos((b / blobs) * Math.PI * 2) * bw * 0.22;
        const by = Math.sin((b / blobs) * Math.PI * 2.3) * bh * 0.2;
        const jr = 8 + hash(i) * 22;
        const ja = hash(i + 2) * Math.PI * 2;
        pts.push({
          x: bw * 0.5 + bx + Math.cos(ja) * jr,
          y: bh * 0.5 + by + Math.sin(ja) * jr * 0.7,
          vx: (hash(i + 3) - 0.5) * 12,
          vy: (hash(i + 4) - 0.5) * 12,
          seed: hash(i + 91),
        });
      }
      return { pts };
    }
    return { pts: [] };
  }

  function drawDot(x, y, r, a, rgb) {
    ctx.beginPath();
    ctx.arc(x, y, r * dotScale, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
    ctx.fill();
  }

  function tickText(dt) {
    const { pts } = state;
    const mx = mouse.x * w;
    const my = mouse.y * h;
    const area = Math.min(w, h) * 0.11;
    const area2 = area * area;
    // ambient breathe when idle so card never looks frozen
    const breath = Math.sin(performance.now() * 0.0012) * 0.35;
    for (const p of pts) {
      // spring home
      p.vx += (p.ox - p.x) * 0.08;
      p.vy += (p.oy - p.y) * 0.08;
      if (mouse.active) {
        const dx = p.x - mx;
        const dy = p.y - my;
        const d2 = dx * dx + dy * dy + 0.01;
        if (d2 < area2 * 4) {
          // Sanprieto-style push: f = -area/d 方向为离开鼠标
          const d = Math.sqrt(d2);
          const f = (-area / d) * 0.55;
          p.vx += (dx / d) * -f * 0.35;
          p.vy += (dy / d) * -f * 0.35;
        }
      } else {
        p.vx += Math.sin(p.ox * 0.04 + performance.now() * 0.001) * 0.015 * breath;
        p.vy += Math.cos(p.oy * 0.04 + performance.now() * 0.0011) * 0.012 * breath;
      }
      p.vx *= 0.86;
      p.vy *= 0.86;
      p.x += p.vx;
      p.y += p.vy;
      drawDot(p.x, p.y, 1.15, 0.92, GOLD);
    }
  }

  function tickStars() {
    const { pts } = state;
    // pointer mild boost
    const boost = mouse.active ? 2.1 : 1;
    const mx = (mouse.x - 0.5) * 0.08;
    const my = (mouse.y - 0.5) * 0.06;
    for (const p of pts) {
      p.x += (p.vx * p.z * 1.4 + mx) * boost;
      p.y += (p.vy * p.z * 1.4 + my) * boost;
      if (p.x < 0) p.x = w;
      if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h;
      if (p.y > h) p.y = 0;
      const tw = 0.75 + 0.25 * Math.sin(performance.now() * 0.002 + p.x);
      drawDot(p.x, p.y, 0.7 + p.z * 1.1, p.a * tw, WHITE);
    }
  }

  function tickGalaxy(t) {
    const { pts, spin } = state;
    const R = Math.min(w, h) * 0.42;
    const cx = w * 0.5;
    const cy = h * 0.52;
    const pitch = Math.tan((32.5 * Math.PI) / 180);
    const a0 = R * 0.12;
    const armHalf = 0.14 + 0.3 * 0.85;
    const armStep = Math.PI;
    const tilt = (75 * Math.PI) / 180;
    const yaw = (-60 * Math.PI) / 180;
    const ct = Math.cos(tilt);
    const st = Math.sin(tilt);
    const cyaw = Math.cos(yaw);
    const syaw = Math.sin(yaw);
    const armPattern = t * spin * 0.9;
    const coreBright = 1.0;

    for (const p of pts) {
      let lx = 0;
      let ly = 0;
      let lz = 0;
      let glow = 0.5;
      if (p.kind === 0) {
        const rr = p.r0 * R * 0.7;
        const th = p.sc * 1.2 + t * spin * 0.55;
        const elev = p.z0 * 0.3;
        const ce = Math.cos(elev);
        const se = Math.sin(elev);
        lx = Math.cos(th) * rr * ce * 1.2;
        ly = Math.sin(th) * rr * ce * 0.8;
        lz = se * rr * 0.4;
        const core = 1 - p.r0 / 0.22;
        glow = (0.75 + core * 1.1) * coreBright;
      } else if (p.kind === 1) {
        let r = Math.max(a0, Math.min(R, p.r0 * R));
        const armOff = p.arm * armStep;
        const ridge = Math.log(Math.max(r, a0) / a0) / pitch + armOff + armPattern;
        const th = ridge + p.sc * armHalf;
        r += p.sc * armHalf * R * 0.06;
        lx = Math.cos(th) * r;
        ly = Math.sin(th) * r;
        lz = p.z0 * 2.2 * Math.exp(-(r / R) * (r / R));
        glow = 0.5 + (1 - r / R) * 0.4;
      } else {
        let r = p.r0 * R;
        const th = p.sc * Math.PI * 2 + armPattern * 0.15;
        lx = Math.cos(th) * r;
        ly = Math.sin(th) * r;
        lz = p.z0 * 1.6;
        glow = 0.28 + (1 - r / R) * 0.18;
      }
      // tilt + yaw → project xy
      const y1 = ly * ct - lz * st;
      const z1 = ly * st + lz * ct;
      const x2 = lx * cyaw + z1 * syaw;
      const sx = cx + x2;
      const sy = cy + y1 * 0.55; // compress for card
      const a = Math.min(1, 0.2 + glow * 0.55);
      const rr = p.kind === 0 ? 1.35 : p.kind === 1 ? 1.05 : 0.75;
      drawDot(sx, sy, rr, a, GOLD);
    }
  }

  function tickCurl(t, dt) {
    const { pts } = state;
    const sc = 0.035;
    const damp = 0.9;
    const speed = 1.35;
    const bx = w * 0.48;
    const by = h * 0.42;
    const cx = w * 0.5;
    const cy = h * 0.5;
    // moving attract / repel hubs
    const hubs = [];
    for (let i = 0; i < 5; i++) {
      const ang = t * (0.22 + i * 0.05) + i * 1.35;
      const rad = Math.min(w, h) * (0.12 + i * 0.04);
      hubs.push({
        x: cx + Math.cos(ang) * rad,
        y: cy + Math.sin(ang * 0.85) * rad * 0.72,
        m: (i & 1) === 0 ? 1800 : -1600,
      });
    }
    const t1 = t * 0.48;
    const t2 = t * 0.37;
    for (const p of pts) {
      const fx =
        (Math.sin(p.y * sc + t1) - Math.cos(p.x * sc * 0.9 - t2)) * 0.8 +
        (Math.sin(p.y * sc * 2.2 + t2) - Math.cos(p.x * sc * 2.2 - t1)) * 0.35;
      const fy =
        (Math.sin(p.x * sc * 0.9 + t2) - Math.cos(p.y * sc - t1)) * 0.8 +
        (Math.sin(p.x * sc * 2.2 + t1) - Math.cos(p.y * sc * 2.2 + t2)) * 0.35;
      let ax = 0;
      let ay = 0;
      for (const hb of hubs) {
        const dx = hb.x - p.x;
        const dy = hb.y - p.y;
        const d2 = dx * dx + dy * dy + 40;
        const f = hb.m / d2;
        ax += dx * f * 0.002;
        ay += dy * f * 0.002;
      }
      p.vx = p.vx * damp + (fx * 40 + ax) * speed * dt * 60;
      p.vy = p.vy * damp + (fy * 40 + ay) * speed * dt * 60;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x > cx + bx) {
        p.x = cx + bx;
        p.vx *= -0.45;
      } else if (p.x < cx - bx) {
        p.x = cx - bx;
        p.vx *= -0.45;
      }
      if (p.y > cy + by) {
        p.y = cy + by;
        p.vy *= -0.45;
      } else if (p.y < cy - by) {
        p.y = cy - by;
        p.vy *= -0.45;
      }
      const a = 0.35 + p.seed * 0.55;
      drawDot(p.x, p.y, 1.05, a, GOLD);
    }
  }

  function frame(now) {
    if (!alive) return;
    const t = (now - t0) / 1000;
    const dt = Math.min(0.033, (frame._last ? now - frame._last : 16) / 1000);
    frame._last = now;
    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, w, h);
    if (!reduced && state) {
      if (variant === "text-push") tickText(dt);
      else if (variant === "starfield") tickStars();
      else if (variant === "galaxy") tickGalaxy(t);
      else if (variant === "curl") tickCurl(t, dt);
    } else if (state) {
      // static freeze
      if (variant === "galaxy") tickGalaxy(0);
      else if (variant === "text-push") {
        for (const p of state.pts) drawDot(p.ox, p.oy, 1.1, 0.9, GOLD);
      } else if (variant === "starfield") {
        for (const p of state.pts) drawDot(p.x, p.y, 1, p.a, WHITE);
      } else if (variant === "curl") {
        for (const p of state.pts) drawDot(p.x, p.y, 1, 0.7, GOLD);
      }
    }
    if (!reduced) raf = requestAnimationFrame(frame);
  }

  const ro = new ResizeObserver(() => {
    resize();
  });
  ro.observe(canvas);
  resize();
  if (reduced) {
    frame(performance.now());
  } else {
    raf = requestAnimationFrame(frame);
  }

  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    ro.disconnect();
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerleave", onLeave);
  };
}
