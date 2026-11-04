/**
 * Sai Assets · floating param panel
 *
 * - 顶标签 / 中参数 / 底主次按钮
 * - type: swatch = 仅允许 field.swatches 内 hex（gruvbox 色板）
 * - 可拖位置 + 右下角缩放；无可见滚动条
 * - lab-only：shouldMountLabPanel() 控制是否挂载
 *
 * Usage:
 *   import { mountParamPanel, shouldMountLabPanel } from "./param-panel.js";
 *   if (!shouldMountLabPanel()) return;
 *   const api = mountParamPanel({ params, onChange, corner: "br", title });
 *
 * schema field:
 *   { key, label, type, tab?, options?, swatches?, min, max, step }
 * type: range|number|select|checkbox|swatch|text  （color 已废弃，降级为 text）
 */
export function shouldMountLabPanel(opts = {}) {
  try {
    const q = new URLSearchParams(location.search);
    if (q.get("lab") === "0" || q.get("panel") === "off") return false;
    if (q.get("lab") === "1" || q.get("panel") === "1") return true;
  } catch (_) {}
  if (opts.force === true) return true;
  if (opts.force === false) return false;
  try {
    const path = String(location.pathname || "").toLowerCase();
    if (path.endsWith("preview.html") || /\/preview(?:\/index\.html|\/|\.html)?$/.test(path)) {
      return true;
    }
  } catch (_) {}
  return false;
}

const TAB_ORDER = ["颜色", "字体", "版式", "组件", "其它"];

function normalizeHex(v) {
  if (typeof v !== "string") return "";
  let s = v.trim().toLowerCase();
  if (!s) return "";
  if (s[0] !== "#") s = "#" + s;
  if (/^#[0-9a-f]{3}$/.test(s)) {
    s =
      "#" +
      s[1] +
      s[1] +
      s[2] +
      s[2] +
      s[3] +
      s[3];
  }
  if (!/^#[0-9a-f]{6}$/.test(s)) return "";
  return s;
}

function nearestSwatch(hex, swatches) {
  const list = (swatches || []).map(normalizeHex).filter(Boolean);
  const t = normalizeHex(hex);
  if (!t || !list.length) return list[0] || "#282828";
  if (list.includes(t)) return t;
  const tr = parseInt(t.slice(1, 3), 16);
  const tg = parseInt(t.slice(3, 5), 16);
  const tb = parseInt(t.slice(5, 7), 16);
  let best = list[0];
  let bestD = Infinity;
  for (const s of list) {
    const r = parseInt(s.slice(1, 3), 16);
    const g = parseInt(s.slice(3, 5), 16);
    const b = parseInt(s.slice(5, 7), 16);
    const d = (r - tr) ** 2 + (g - tg) ** 2 + (b - tb) ** 2;
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

export function mountParamPanel(opts = {}) {
  const params = structuredClone(opts.params || {});
  if (!params.defaults) params.defaults = {};
  if (!params.schema) params.schema = [];
  if (!params.current) params.current = { ...params.defaults };

  // clamp swatch defaults/current to allowed palettes
  for (const field of params.schema) {
    if (field.type !== "swatch" || !field.swatches?.length) continue;
    const k = field.key;
    if (params.defaults[k] != null) {
      params.defaults[k] = nearestSwatch(params.defaults[k], field.swatches);
    }
    if (params.current[k] != null) {
      params.current[k] = nearestSwatch(params.current[k], field.swatches);
    }
  }

  const slug = params.slug || opts.slug || "demo";
  const ver = params.version || 1;
  const storageKey =
    opts.storageKey || `saiassets.param-panel.${slug}.v${ver}.params`;
  const defaultsKey =
    opts.defaultsKey || `saiassets.param-panel.${slug}.v${ver}.defaults`;
  const panelId = opts.panelId || opts.positionId || "default";
  const positionKey =
    opts.positionKey || `saiassets.param-panel.${slug}.panelPos.${panelId}`;
  const sizeKey = opts.sizeKey || `saiassets.param-panel.${slug}.panelSize.${panelId}`;
  const corner = opts.corner || "bl";
  const title = opts.title || slug;
  const onChange =
    typeof opts.onChange === "function" ? opts.onChange : () => {};

  const undoStack = [];
  const UNDO_MAX = 40;
  let suppressHistory = false;
  let activeTab = opts.defaultTab || null;

  let isEmbed = !!opts.embed;
  try {
    const q = new URLSearchParams(location.search);
    if (q.has("embed") || q.get("panel") === "mini") isEmbed = true;
  } catch (_) {}
  try {
    if (window.self !== window.top) isEmbed = true;
  } catch (_) {
    isEmbed = true;
  }
  if (!isEmbed && typeof window !== "undefined") {
    const w = window.innerWidth || 0;
    const h = window.innerHeight || 0;
    if ((w > 0 && w < 520) || (h > 0 && h < 420)) isEmbed = true;
  }
  const startCollapsed =
    opts.collapsed === true || (opts.collapsed !== false && isEmbed);

  // hydrate defaults override then current
  try {
    const rawDef = localStorage.getItem(defaultsKey);
    if (rawDef) {
      const savedDef = JSON.parse(rawDef);
      if (savedDef && typeof savedDef === "object") {
        params.defaults = { ...params.defaults, ...savedDef };
      }
    }
  } catch (_) {}
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved && typeof saved === "object") {
        params.current = { ...params.defaults, ...saved };
      }
    } else {
      params.current = { ...params.defaults, ...params.current };
    }
  } catch (_) {
    params.current = { ...params.defaults, ...params.current };
  }

  // re-clamp after hydrate
  for (const field of params.schema) {
    if (field.type !== "swatch" || !field.swatches?.length) continue;
    const k = field.key;
    if (params.defaults[k] != null) {
      params.defaults[k] = nearestSwatch(params.defaults[k], field.swatches);
    }
    if (params.current[k] != null) {
      params.current[k] = nearestSwatch(params.current[k], field.swatches);
    }
  }

  const root = document.createElement("div");
  root.className = "pp-param-panel";
  root.dataset.corner = isEmbed ? "tr" : corner;
  if (isEmbed) root.classList.add("is-embed");
  // expanded geometry snapshot for dock restore
  let expandedSnap = null;
  const collapseKey =
    opts.collapseKey || `saiassets.param-panel.${slug}.panelCollapsed.${panelId}`;

  root.innerHTML = `
    <div class="pp-param-panel__head" data-drag>
      <span class="pp-param-panel__title"></span>
      <button type="button" class="pp-param-panel__btn pp-param-panel__btn--icon" data-act="collapse" title="收起到右下角方块">${
        startCollapsed ? "▣" : "–"
      }</button>
    </div>
    <button type="button" class="pp-param-panel__fab" data-act="expand" title="展开调参板" aria-label="展开调参板">
      <span class="pp-param-panel__fab-mark">调</span>
    </button>
    <div class="pp-param-panel__tabs" data-tabs></div>
    <div class="pp-param-panel__body"></div>
    <div class="pp-param-panel__foot">
      <div class="pp-param-panel__foot-row pp-param-panel__foot-row--primary">
        <button type="button" class="pp-param-panel__btn pp-param-panel__btn--accent" data-act="save-default" title="把当前旋钮写成新的默认（刷新后仍在）">设为默认</button>
        <button type="button" class="pp-param-panel__btn" data-act="reset" title="回到当前默认">恢复默认</button>
      </div>
      <div class="pp-param-panel__foot-row">
        <button type="button" class="pp-param-panel__btn" data-act="undo" title="撤回上一次改动">撤回</button>
        <button type="button" class="pp-param-panel__btn" data-act="copy">复制 JSON</button>
        <button type="button" class="pp-param-panel__btn" data-act="export">导出 params</button>
      </div>
    </div>
    <div class="pp-param-panel__resize" data-resize title="拖拽调整大小"></div>
  `;
  root.querySelector(".pp-param-panel__title").textContent = title;
  document.body.appendChild(root);

  const tabsEl = root.querySelector("[data-tabs]");
  const body = root.querySelector(".pp-param-panel__body");
  const undoBtn = root.querySelector('[data-act="undo"]');
  const collapseBtn = root.querySelector('[data-act="collapse"]');

  function persistCollapsed(v) {
    try {
      localStorage.setItem(collapseKey, v ? "1" : "0");
    } catch (_) {}
  }

  function readCollapsedPref() {
    try {
      const raw = localStorage.getItem(collapseKey);
      if (raw === "1") return true;
      if (raw === "0") return false;
    } catch (_) {}
    return null;
  }

  function captureExpandedSnap() {
    if (root.classList.contains("is-collapsed")) return;
    const r = root.getBoundingClientRect();
    expandedSnap = {
      left: Math.round(r.left),
      top: Math.round(r.top),
      w: Math.round(r.width),
      h: Math.round(r.height),
      corner: root.dataset.corner || corner,
    };
  }

  function setCollapsed(on) {
    if (on) {
      if (!root.classList.contains("is-collapsed")) captureExpandedSnap();
      root.classList.add("is-collapsed");
      // dock as square FAB at bottom-right of viewport
      root.style.left = "auto";
      root.style.top = "auto";
      root.style.right = "14px";
      root.style.bottom = "14px";
      root.style.width = "";
      root.style.height = "";
      root.dataset.corner = "br";
      if (collapseBtn) {
        collapseBtn.textContent = "▣";
        collapseBtn.title = "已收起 · 点方块展开";
      }
      persistCollapsed(true);
    } else {
      root.classList.remove("is-collapsed");
      if (collapseBtn) {
        collapseBtn.textContent = "–";
        collapseBtn.title = "收起到右下角方块";
      }
      // restore geometry
      if (expandedSnap && expandedSnap.w && expandedSnap.h) {
        root.style.width = expandedSnap.w + "px";
        root.style.height = expandedSnap.h + "px";
        if (
          typeof expandedSnap.left === "number" &&
          typeof expandedSnap.top === "number" &&
          expandedSnap.corner === "custom"
        ) {
          applyPos(expandedSnap.left, expandedSnap.top);
        } else {
          root.style.left = "";
          root.style.top = "";
          root.style.right = "";
          root.style.bottom = "";
          root.dataset.corner = expandedSnap.corner || corner;
          if (isEmbed) root.dataset.corner = "tr";
        }
      } else if (!isEmbed) {
        // default expanded corner
        root.style.left = "";
        root.style.top = "";
        root.style.right = "";
        root.style.bottom = "";
        root.dataset.corner = isEmbed ? "tr" : corner;
      }
      persistCollapsed(false);
    }
  }

  function flashBtn(btn, okText, failText, restore) {
    const old = restore || btn.textContent;
    btn.textContent = okText;
    setTimeout(() => {
      btn.textContent = old;
    }, 1400);
  }

  function updateUndoBtn() {
    if (!undoBtn) return;
    undoBtn.disabled = undoStack.length === 0;
    undoBtn.title =
      undoStack.length === 0
        ? "没有可撤回的改动"
        : "撤回上一次改动（栈 " + undoStack.length + "）";
  }

  function pushHistory() {
    if (suppressHistory) return;
    try {
      undoStack.push(JSON.parse(JSON.stringify(params.current)));
      if (undoStack.length > UNDO_MAX) undoStack.shift();
    } catch (_) {}
    updateUndoBtn();
  }

  function persist() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(params.current));
    } catch (_) {}
  }

  function persistDefaults() {
    try {
      localStorage.setItem(defaultsKey, JSON.stringify(params.defaults));
    } catch (_) {}
  }

  function emit() {
    persist();
    onChange({ ...params.current });
  }

  function listTabs() {
    const set = new Set();
    for (const f of params.schema) {
      set.add(f.tab || "其它");
    }
    const ordered = TAB_ORDER.filter((t) => set.has(t));
    for (const t of set) {
      if (!ordered.includes(t)) ordered.push(t);
    }
    return ordered.length ? ordered : ["其它"];
  }

  function ensureActiveTab() {
    const tabs = listTabs();
    if (!activeTab || !tabs.includes(activeTab)) activeTab = tabs[0];
    return tabs;
  }

  function renderTabs() {
    const tabs = ensureActiveTab();
    tabsEl.innerHTML = "";
    if (tabs.length <= 1 && tabs[0] === "其它" && !params.schema.some((f) => f.tab)) {
      // single dump tab — still show for consistency if many fields
      if (params.schema.length < 8) {
        tabsEl.style.display = "none";
        return;
      }
    }
    tabsEl.style.display = "";
    for (const t of tabs) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "pp-param-panel__tab" + (t === activeTab ? " is-active" : "");
      btn.textContent = t;
      btn.dataset.tab = t;
      btn.addEventListener("click", () => {
        if (activeTab === t) return;
        activeTab = t;
        render();
      });
      tabsEl.appendChild(btn);
    }
  }

  function bindRange(input, show, key, type) {
    input.addEventListener("pointerdown", () => {
      if (!input._histPushed) {
        pushHistory();
        input._histPushed = true;
      }
    });
    input.addEventListener("pointerup", () => {
      input._histPushed = false;
    });
    input.addEventListener("change", () => {
      input._histPushed = false;
    });
    input.addEventListener("input", () => {
      if (!input._histPushed && type === "number") {
        pushHistory();
        input._histPushed = true;
      }
      const n =
        type === "number" || type === "range"
          ? Number(input.value)
          : input.value;
      params.current[key] = n;
      if (show) show.textContent = String(n);
      emit();
    });
  }

  function renderField(field) {
    const row = document.createElement("div");
    row.className = "pp-param-row";
    row.dataset.key = field.key;
    const key = field.key;
    const val =
      params.current[key] != null ? params.current[key] : params.defaults[key];
    const lab = document.createElement("label");
    lab.textContent = field.label || key;
    row.appendChild(lab);

    let type = field.type || "text";
    if (type === "color") type = "text"; // free color removed

    if (type === "range" || type === "number") {
      const input = document.createElement("input");
      input.type = type === "range" ? "range" : "number";
      if (field.min != null) input.min = field.min;
      if (field.max != null) input.max = field.max;
      if (field.step != null) input.step = field.step;
      input.value = val != null ? val : 0;
      const show = document.createElement("span");
      show.className = "pp-param-val";
      show.textContent = String(input.value);
      bindRange(input, show, key, type);
      row.appendChild(input);
      row.appendChild(show);
    } else if (type === "checkbox") {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = !!val;
      input.addEventListener("change", () => {
        pushHistory();
        params.current[key] = input.checked;
        emit();
      });
      row.appendChild(input);
    } else if (type === "swatch") {
      const swatches = (field.swatches || []).map(normalizeHex).filter(Boolean);
      const cur = nearestSwatch(val, swatches);
      params.current[key] = cur;
      const grid = document.createElement("div");
      grid.className = "pp-param-swatches";
      const meta = document.createElement("div");
      meta.className = "pp-param-swatch-meta";
      meta.textContent = cur;
      for (const hex of swatches) {
        const b = document.createElement("button");
        b.type = "button";
        b.className =
          "pp-param-swatch" + (hex === cur ? " is-active" : "");
        b.style.setProperty("--sw", hex);
        b.title = hex;
        b.setAttribute("aria-label", hex);
        b.addEventListener("click", () => {
          if (params.current[key] === hex) return;
          pushHistory();
          params.current[key] = hex;
          grid.querySelectorAll(".pp-param-swatch").forEach((el) => {
            el.classList.toggle("is-active", el.title === hex);
          });
          meta.textContent = hex;
          emit();
        });
        grid.appendChild(b);
      }
      row.appendChild(grid);
      row.appendChild(meta);
    } else if (type === "select") {
      const sel = document.createElement("select");
      for (const opt of field.options || []) {
        const o = document.createElement("option");
        if (opt && typeof opt === "object") {
          o.value = opt.value != null ? String(opt.value) : "";
          o.textContent = opt.label != null ? String(opt.label) : o.value;
        } else {
          o.value = opt;
          o.textContent = opt;
        }
        if (String(o.value) === String(val)) o.selected = true;
        sel.appendChild(o);
      }
      sel.addEventListener("change", () => {
        pushHistory();
        params.current[key] = sel.value;
        emit();
      });
      row.appendChild(sel);
    } else {
      const input = document.createElement("input");
      input.type = "text";
      input.value = val != null ? val : "";
      input.addEventListener("focus", () => {
        if (!input._histPushed) {
          pushHistory();
          input._histPushed = true;
        }
      });
      input.addEventListener("blur", () => {
        input._histPushed = false;
      });
      input.addEventListener("input", () => {
        params.current[key] = input.value;
        emit();
      });
      row.appendChild(input);
    }
    return row;
  }

  function render() {
    renderTabs();
    body.innerHTML = "";
    const tab = ensureActiveTab()[0] && activeTab;
    for (const field of params.schema) {
      const t = field.tab || "其它";
      if (t !== activeTab) continue;
      body.appendChild(renderField(field));
    }
    updateUndoBtn();
  }

  root.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === "collapse") {
      setCollapsed(true);
    } else if (act === "expand") {
      setCollapsed(false);
    } else if (act === "save-default") {
      pushHistory();
      try {
        params.defaults = JSON.parse(JSON.stringify(params.current));
      } catch (_) {
        params.defaults = { ...params.current };
      }
      persistDefaults();
      persist();
      flashBtn(btn, "已锁默认", "失败", "设为默认");
      if (typeof opts.onDefaultsChange === "function") {
        opts.onDefaultsChange({ ...params.defaults });
      }
    } else if (act === "undo") {
      if (undoStack.length === 0) {
        flashBtn(btn, "无历史", null, "撤回");
        return;
      }
      const prev = undoStack.pop();
      suppressHistory = true;
      params.current = { ...params.defaults, ...prev };
      for (const field of params.schema) {
        if (field.type === "swatch" && field.swatches?.length) {
          params.current[field.key] = nearestSwatch(
            params.current[field.key],
            field.swatches
          );
        }
      }
      render();
      emit();
      suppressHistory = false;
      updateUndoBtn();
      flashBtn(btn, "已撤回", null, "撤回");
    } else if (act === "reset") {
      pushHistory();
      suppressHistory = true;
      params.current = { ...params.defaults };
      for (const field of params.schema) {
        if (field.type === "swatch" && field.swatches?.length) {
          params.current[field.key] = nearestSwatch(
            params.current[field.key],
            field.swatches
          );
        }
      }
      render();
      emit();
      suppressHistory = false;
      flashBtn(btn, "已恢复", null, "恢复默认");
    } else if (act === "copy") {
      const payload = JSON.stringify(
        {
          slug,
          version: params.version || 1,
          defaults: params.defaults,
          current: params.current,
          schema: params.schema,
        },
        null,
        2
      );
      try {
        await navigator.clipboard.writeText(payload);
        flashBtn(btn, "已复制", null, "复制 JSON");
      } catch (_) {
        flashBtn(btn, "失败", null, "复制 JSON");
      }
    } else if (act === "export") {
      const payload = {
        slug,
        version: params.version || 1,
        defaults: params.defaults,
        current: params.current,
        schema: params.schema,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "params.json";
      a.click();
      URL.revokeObjectURL(a.href);
    }
  });

  // drag position
  const head = root.querySelector("[data-drag]");
  let dragging = false;
  let ox = 0;
  let oy = 0;

  function clampPos(left, top) {
    const w = root.offsetWidth || 300;
    const h = root.offsetHeight || 200;
    const maxL = Math.max(0, (window.innerWidth || 800) - Math.min(w, 120));
    const maxT = Math.max(0, (window.innerHeight || 600) - 48);
    return {
      left: Math.max(0, Math.min(maxL, left)),
      top: Math.max(0, Math.min(maxT, top)),
    };
  }

  function applyPos(left, top) {
    const p = clampPos(left, top);
    root.style.left = p.left + "px";
    root.style.top = p.top + "px";
    root.style.right = "auto";
    root.style.bottom = "auto";
    root.dataset.corner = "custom";
  }

  function savePos() {
    if (isEmbed) return;
    try {
      const r = root.getBoundingClientRect();
      localStorage.setItem(
        positionKey,
        JSON.stringify({ left: Math.round(r.left), top: Math.round(r.top) })
      );
    } catch (_) {}
  }

  function restorePos() {
    if (isEmbed) return false;
    try {
      const raw = localStorage.getItem(positionKey);
      if (!raw) return false;
      const pos = JSON.parse(raw);
      if (pos && typeof pos.left === "number" && typeof pos.top === "number") {
        applyPos(pos.left, pos.top);
        return true;
      }
    } catch (_) {}
    return false;
  }

  head.addEventListener("pointerdown", (e) => {
    if (root.classList.contains("is-collapsed")) return;
    if (e.target.closest("button")) return;
    dragging = true;
    const r = root.getBoundingClientRect();
    ox = e.clientX - r.left;
    oy = e.clientY - r.top;
    applyPos(r.left, r.top);
    head.setPointerCapture(e.pointerId);
  });
  head.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    applyPos(e.clientX - ox, e.clientY - oy);
  });
  head.addEventListener("pointerup", () => {
    if (dragging) savePos();
    dragging = false;
  });

  // resize
  const resizeEl = root.querySelector("[data-resize]");
  let resizing = false;
  let rsX = 0;
  let rsY = 0;
  let rsW = 0;
  let rsH = 0;

  function saveSize() {
    if (isEmbed) return;
    try {
      localStorage.setItem(
        sizeKey,
        JSON.stringify({
          w: Math.round(root.offsetWidth),
          h: Math.round(root.offsetHeight),
        })
      );
    } catch (_) {}
  }

  function restoreSize() {
    if (isEmbed) return false;
    try {
      const raw = localStorage.getItem(sizeKey);
      if (!raw) return false;
      const s = JSON.parse(raw);
      if (s && s.w && s.h) {
        root.style.width = s.w + "px";
        root.style.height = s.h + "px";
        return true;
      }
    } catch (_) {}
    return false;
  }

  if (resizeEl) {
    resizeEl.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      resizing = true;
      rsX = e.clientX;
      rsY = e.clientY;
      rsW = root.offsetWidth;
      rsH = root.offsetHeight;
      resizeEl.setPointerCapture(e.pointerId);
    });
    resizeEl.addEventListener("pointermove", (e) => {
      if (!resizing) return;
      const nw = Math.min(
        Math.max(340, rsW + (e.clientX - rsX)),
        Math.min(560, (window.innerWidth || 800) - 16)
      );
      const nh = Math.min(
        Math.max(320, rsH + (e.clientY - rsY)),
        Math.min(900, (window.innerHeight || 600) - 16)
      );
      root.style.width = nw + "px";
      root.style.height = nh + "px";
    });
    resizeEl.addEventListener("pointerup", () => {
      if (resizing) saveSize();
      resizing = false;
    });
  }

  function patchRowValue(row, field, val) {
    if (field.type === "swatch") {
      const hex = nearestSwatch(val, field.swatches || []);
      row.querySelectorAll(".pp-param-swatch").forEach((el) => {
        el.classList.toggle("is-active", el.title === hex);
      });
      const meta = row.querySelector(".pp-param-swatch-meta");
      if (meta) meta.textContent = hex;
      return;
    }
    const input = row.querySelector("input, select");
    if (!input) return false;
    const draggingSelf =
      document.activeElement === input &&
      (input.type === "range" || input.type === "number");
    if (draggingSelf) {
      const show = row.querySelector(".pp-param-val");
      if (show) show.textContent = String(input.value);
      return true;
    }
    if (input.type === "checkbox") {
      input.checked = !!val;
    } else if (input.tagName === "SELECT") {
      const s = val != null ? String(val) : "";
      if (input.value !== s) input.value = s;
    } else {
      const s = val != null ? String(val) : "";
      if (String(input.value) !== s) input.value = s;
      const show = row.querySelector(".pp-param-val");
      if (show) show.textContent = String(input.value);
    }
    return true;
  }

  render();
  restoreSize();
  restorePos();
  // dock preference: saved collapse > embed default startCollapsed
  const pref = readCollapsedPref();
  const wantCollapsed = pref == null ? !!startCollapsed : pref;
  if (wantCollapsed) {
    // capture after size/pos restore so expand returns here
    captureExpandedSnap();
    setCollapsed(true);
  } else {
    setCollapsed(false);
  }
  onChange({ ...params.current });
  updateUndoBtn();

  return {
    getParams: () => ({ ...params.current }),
    getFull: () =>
      structuredClone({
        slug,
        version: params.version || 1,
        defaults: params.defaults,
        current: params.current,
        schema: params.schema,
      }),
    setParams: (obj) => {
      pushHistory();
      params.current = { ...params.defaults, ...obj };
      for (const field of params.schema) {
        if (field.type === "swatch" && field.swatches?.length) {
          params.current[field.key] = nearestSwatch(
            params.current[field.key],
            field.swatches
          );
        }
      }
      render();
      emit();
    },
    syncParams: (obj) => {
      suppressHistory = true;
      params.current = { ...params.defaults, ...obj };
      for (const field of params.schema) {
        if (field.type === "swatch" && field.swatches?.length) {
          params.current[field.key] = nearestSwatch(
            params.current[field.key],
            field.swatches
          );
        }
      }
      const rows = body.querySelectorAll(".pp-param-row");
      const visible = params.schema.filter(
        (f) => (f.tab || "其它") === activeTab
      );
      let needFull = rows.length !== visible.length;
      if (!needFull) {
        for (let i = 0; i < visible.length; i++) {
          const field = visible[i];
          const key = field.key;
          const val =
            params.current[key] != null
              ? params.current[key]
              : params.defaults[key];
          const row = rows[i];
          if (!row || row.dataset.key !== key) {
            needFull = true;
            break;
          }
          if (field.type === "swatch") {
            patchRowValue(row, field, val);
            continue;
          }
          const input = row.querySelector("input, select");
          if (!input) {
            needFull = true;
            break;
          }
          patchRowValue(row, field, val);
        }
      }
      if (needFull) render();
      suppressHistory = false;
      updateUndoBtn();
    },
    show: () => {
      root.style.display = "";
    },
    hide: () => {
      root.style.display = "none";
    },
    destroy: () => root.remove(),
    el: root,
    positionKey,
    sizeKey,
  };
}

// classic non-module global
if (typeof window !== "undefined") {
  window.mountParamPanel = mountParamPanel;
  window.shouldMountLabPanel = shouldMountLabPanel;
}
