// void-audio.js — 音频反应 entry(可选档):把「能量」喂给 void-fx.js 的黑洞盘。
//
// 音源三档,自动降级 —— 这决定了本 entry 对权限/网络的依赖:
//   1) 直播流:URL 里给 ?stream=https://…(音频流必须放行 CORS,否则分析不到频谱)
//   2) 麦克风:navigator.mediaDevices.getUserMedia({audio:true})(需用户手势 + 授权;https 或本机才可用)
//   3) 假频谱:合成 ambient(默认档,零权限、零网络,任何环境都能跑)
// 授权被拒 / 流失败 / 无 getUserMedia → 一律回落到假频谱,并把这句写进 HUD。
//
// 与源件(demos/fm-void-audio/main.js)的差异:①电台固定 URL 改为 ?stream= 可选参数,默认假频谱;
// ②新增麦克风档(源件没有);③面板换成本包的标准版(mountParamPanel v2),参数键同名同义。

import * as THREE from "../../upstream/three.module.js";
import { createVoidFx } from "./void-fx.js";
import { mountParamPanel } from "../param-panel.js";
import { reducedMotion } from "../util.js";

const VIEW_KEYS = ["yaw", "pitch", "dist", "zoom"];

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

/** 只接受 https 的流地址;其它一律当没给。 */
function streamFromQuery() {
  try {
    const raw = new URLSearchParams(location.search).get("stream");
    if (!raw) return "";
    return /^https:\/\//i.test(raw) ? raw : "";
  } catch (_) {
    return "";
  }
}

export function mount(host, params) {
  const streamUrl = streamFromQuery();

  // ── 壳:canvas 容器 + HUD + 频谱条 + 底部按钮 ──
  const stage = el("div", "void-stage");
  const hud = el("div", "void-hud");
  const bars = el("div", "void-bars");
  for (let i = 0; i < 8; i++) bars.appendChild(el("i"));
  const dock = el("div", "void-dock");
  const btnFake = el("button", "on", "假频谱");
  const btnMic = el("button", null, "接麦克风");
  const btnStream = el("button", null, "听直播流");
  const btnMute = el("button", null, "静音");
  const meta = el("span", "void-meta", "零权限 · 合成频谱");
  for (const b of [btnFake, btnMic, btnStream, btnMute]) {
    b.type = "button";
    dock.appendChild(b);
  }
  dock.appendChild(meta);
  host.append(stage, hud, bars, dock);
  if (!streamUrl) {
    btnStream.disabled = true;
    btnStream.title = "给页面加 ?stream=https://… 才会启用(音频流需放行 CORS)";
  }

  // ── 音频图(懒建:浏览器要求用户手势后才允许出声) ──
  let audioCtx = null;
  let analyser = null;
  let gainNode = null;
  let freqData = null;
  let audioEl = null;
  let mediaSrc = null;
  let micStream = null;
  let mode = "fake";
  let muted = false;
  let prevLow = 0;
  let t0 = performance.now();

  function ensureGraph() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    if (!analyser) {
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.45;
      freqData = new Uint8Array(analyser.frequencyBinCount);
      gainNode = audioCtx.createGain();
      gainNode.gain.value = muted ? 0 : 1;
      analyser.connect(gainNode);
    }
  }

  /** 只有直播流档才把声音接到扬声器;麦克风档必须断开,否则直接啸叫。 */
  function setAudible(on) {
    if (!gainNode || !audioCtx) return;
    try {
      gainNode.disconnect();
    } catch (_) {}
    if (on) gainNode.connect(audioCtx.destination);
  }

  function stopSources() {
    if (audioEl) {
      try {
        audioEl.pause();
      } catch (_) {}
    }
    if (micStream) {
      for (const track of micStream.getTracks()) track.stop();
      micStream = null;
    }
  }

  function ambientEnergy(t) {
    const amb = 0.22 + 0.1 * Math.sin(t * 0.7) + 0.06 * Math.sin(t * 1.9);
    const kick = Math.pow(Math.max(0, Math.sin(t * Math.PI * 1.55)), 10);
    const subBass = Math.min(1, amb * 0.55 + kick * 0.4);
    const bass = Math.min(1, amb * 0.7 + kick * 0.28);
    const mid = Math.min(1, amb * 0.5 + 0.12 + 0.08 * Math.sin(t * 0.9));
    const high = Math.min(1, amb * 0.28 + 0.1 + 0.05 * Math.sin(t * 2.1));
    const level = subBass * 0.35 + bass * 0.35 + mid * 0.2 + high * 0.1;
    const low = subBass * 0.65 + bass * 0.35;
    const flux = Math.max(0, low - prevLow);
    prevLow = prevLow * 0.55 + low * 0.45;
    const hit = flux > 0.04 && low > 0.12;
    return { bass, subBass, mid, high, level, hit, hitStrength: hit ? Math.min(1, flux * 6 + subBass * 0.5) : 0 };
  }

  function readEnergy() {
    const t = (performance.now() - t0) / 1000;
    if (mode === "fake" || !analyser || !freqData) return ambientEnergy(t);
    analyser.getByteFrequencyData(freqData);
    const n = freqData.length;
    const band = (a, b) => {
      const lo = Math.max(0, Math.floor(a));
      const hi = Math.min(n - 1, Math.ceil(b));
      let s = 0;
      let c = 0;
      for (let i = lo; i <= hi; i++) {
        s += freqData[i];
        c++;
      }
      return c ? s / c / 255 : 0;
    };
    const subBass = band(0, n * 0.04);
    const bass = band(n * 0.02, n * 0.12);
    const mid = band(n * 0.12, n * 0.4);
    const high = band(n * 0.4, n * 0.85);
    const level = subBass * 0.35 + bass * 0.35 + mid * 0.2 + high * 0.1;
    if (level < 0.01) return ambientEnergy(t); // 静谱兜底(直播流常见)
    const low = subBass * 0.65 + bass * 0.35;
    const flux = Math.max(0, low - prevLow);
    prevLow = prevLow * 0.55 + low * 0.45;
    const hit = flux > 0.045 && low > 0.12;
    return { bass, subBass, mid, high, level, hit, hitStrength: hit ? Math.min(1, flux * 6.5 + subBass * 0.55) : 0 };
  }

  function setMode(next, note) {
    mode = next;
    btnFake.classList.toggle("on", next === "fake");
    btnMic.classList.toggle("on", next === "mic");
    btnStream.classList.toggle("on", next === "stream");
    meta.textContent = note || (next === "fake" ? "零权限 · 合成频谱" : next === "mic" ? "麦克风" : "直播流");
  }

  async function useMic() {
    stopSources();
    if (!navigator.mediaDevices?.getUserMedia) {
      setMode("fake", "本环境无 getUserMedia → 假频谱");
      return;
    }
    try {
      ensureGraph();
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const src = audioCtx.createMediaStreamSource(micStream);
      src.connect(analyser);
      setAudible(false); // 只分析,不播回,避免啸叫
      setMode("mic", "麦克风 · 已授权(不播放,只驱动画面)");
    } catch (err) {
      const why = err && err.name ? err.name : "error";
      setMode("fake", why === "NotAllowedError" ? "麦克风被拒 → 假频谱" : `麦克风失败(${why})→ 假频谱`);
    }
  }

  async function useStream() {
    if (!streamUrl) return;
    stopSources();
    try {
      ensureGraph();
      if (!audioEl) {
        audioEl = new Audio();
        audioEl.crossOrigin = "anonymous";
        audioEl.preload = "none";
        audioEl.playsInline = true;
      }
      if (audioEl.src !== streamUrl) {
        audioEl.src = streamUrl;
        audioEl.load();
      }
      if (!mediaSrc) {
        mediaSrc = audioCtx.createMediaElementSource(audioEl);
        mediaSrc.connect(analyser);
      }
      await audioEl.play();
      setAudible(!muted);
      setMode("stream", "直播流");
    } catch (err) {
      setMode("fake", "流失败 → 假频谱");
    }
  }

  btnFake.addEventListener("click", () => {
    stopSources();
    setAudible(false);
    setMode("fake");
  });
  btnMic.addEventListener("click", useMic);
  btnStream.addEventListener("click", useStream);
  btnMute.addEventListener("click", () => {
    if (mode !== "stream") {
      meta.textContent = "当前档没有声音可静(麦克风档只分析画面)";
      return;
    }
    muted = !muted;
    btnMute.classList.toggle("on", muted);
    btnMute.textContent = muted ? "已静音" : "静音";
    if (gainNode) gainNode.gain.value = muted ? 0 : 1;
  });

  // ── 渲染器 + 面板 ──
  let view = { ...params };
  let prevPanel = null;
  let fx = null;
  let raf = 0;
  let alive = true;
  let last = performance.now();

  function buildFx() {
    if (fx) fx.dispose();
    fx = createVoidFx(stage, THREE, {
      quality: Number(view.quality ?? 0.8),
      steps: Math.round(Number(view.steps ?? 39)),
      onViewChange: (v) => {
        const rounded = {
          yaw: Math.round(v.yaw * 1000) / 1000,
          pitch: Math.round(v.pitch * 1000) / 1000,
          dist: Math.round(v.dist * 100) / 100,
          zoom: Math.round(v.zoom * 1000) / 1000,
        };
        Object.assign(view, rounded);
        if (panelApi) panelApi.syncParams({ ...panelApi.getParams(), ...rounded });
        if (prevPanel) Object.assign(prevPanel, rounded);
      },
    });
    applyToFx(view, true);
  }

  const PATCH_KEYS = [
    "temp", "gain", "expo", "contr", "opac", "dopp", "beam", "wind", "speed", "wave", "waveFreq",
    "thick", "inner", "outer", "tilt", "star", "starDensity", "starSize", "starTwinkle", "starSpin",
    "starAudio", "starPop",
  ];

  function applyToFx(values, force) {
    if (!fx) return;
    const patch = {};
    for (const key of PATCH_KEYS) {
      if (values[key] != null) patch[key] = Number(values[key]);
    }
    for (const key of VIEW_KEYS) {
      const next = Number(values[key]);
      const prev = prevPanel && prevPanel[key] != null ? Number(prevPanel[key]) : NaN;
      if (value_ok(next) && (force || !Number.isFinite(prev) || next !== prev)) patch[key] = next;
    }
    if (force) {
      fx.setEntryView({ yaw: Number(values.yaw), pitch: Number(values.pitch), dist: Number(values.dist), zoom: Number(values.zoom) });
    }
    fx.setBase(patch);
    prevPanel = { ...values };
  }

  function value_ok(v) {
    return Number.isFinite(v);
  }

  const panelApi = mountParamPanel({
    params: structuredClone(params),
    corner: "tr",
    title: "void-audio · 参数",
    storageKey: "themelab.void-audio.v1.params",
    onChange: (values) => {
      const structural = Math.round(Number(values.steps)) !== Math.round(Number(view.steps))
        || Number(values.quality) !== Number(view.quality);
      view = { ...view, ...values };
      if (structural) buildFx();
      else applyToFx(values, false);
    },
  });

  view = { ...view, ...panelApi.getParams() };
  buildFx();

  // ── 主循环 ──
  function frame(now) {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const e = readEnergy();
    const r = Number(view.react ?? 1);
    fx.setEnergy({
      bass: e.bass * r,
      subBass: e.subBass * r,
      mid: e.mid * r,
      high: e.high * r * Number(view.highStar ?? 1),
      level: e.level * r,
      hit: e.hit,
      hitStrength: (e.hitStrength ?? 0) * Number(view.hitKick ?? 1) * r,
    });
    fx.render(dt);

    const vals = [e.subBass, e.bass, e.mid, e.high, e.level, e.hitStrength || 0, e.bass * 0.7, e.mid * 0.8];
    [...bars.children].forEach((node, i) => {
      node.style.height = `${4 + Math.round((vals[i] || 0) * 24)}px`;
    });
    if ((Math.floor(now / 240) & 1) === 0) {
      hud.textContent = `VOID · ${mode === "fake" ? "假谱" : mode === "mic" ? "麦克风" : "直播流"} · bass ${(e.bass * 100) | 0} · hit ${e.hit ? "●" : "○"}`;
    }
  }
  const reduced = reducedMotion();
  if (reduced) {
    // 减少动态:只渲染一帧静止黑洞,不跑 rAF
    fx.render(1 / 60);
    hud.textContent = "VOID · 已开启「减少动态」· 只渲染一帧";
  } else {
    requestAnimationFrame(frame);
  }

  return {
    /** 面板/程序化改参(与面板 onChange 同语义)。 */
    update(next) {
      const structural = Math.round(Number(next.steps)) !== Math.round(Number(view.steps))
        || Number(next.quality) !== Number(view.quality);
      view = { ...view, ...next };
      if (structural) buildFx();
      else applyToFx(view, false);
    },
    setSource: (name) => (name === "mic" ? useMic() : name === "stream" ? useStream() : btnFake.click()),
    get mode() {
      return mode;
    },
    destroy() {
      alive = false;
      cancelAnimationFrame(raf);
      stopSources();
      if (fx) fx.dispose();
      if (audioCtx) audioCtx.close();
      panelApi.destroy();
      host.textContent = "";
    },
  };
}
