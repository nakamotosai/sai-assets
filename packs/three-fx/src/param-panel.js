/**
 * Sai Theme Lab · floating param panel
 * Usage:
 *   import { mountParamPanel } from "./param-panel.js";
 *   const api = mountParamPanel({
 *     params,            // { slug, defaults, schema, current? }
 *     onChange(next),    // live update
 *     corner: "bl",      // bl|br|tl|tr
 *     storageKey,        // optional; default themelab.{slug}.params
 *     title,
 *     embed: true,       // wall iframe: start collapsed + compact
 *   });
 *   // api.getParams() / api.setParams(obj) / api.destroy()
 *
 * Auto-embed when: opts.embed | ?embed=1 | window in iframe | viewport < 520px
 */
export function mountParamPanel(opts = {}) {
  const params = structuredClone(opts.params || {});
  if (!params.defaults) params.defaults = {};
  if (!params.schema) params.schema = [];
  if (!params.current) params.current = { ...params.defaults };

  const slug = params.slug || opts.slug || "demo";
  const storageKey = opts.storageKey || `themelab.${slug}.params`;
  const corner = opts.corner || "bl";
  const title = opts.title || slug;
  const onChange = typeof opts.onChange === "function" ? opts.onChange : () => {};

  let isEmbed = !!opts.embed;
  try {
    const q = new URLSearchParams(location.search);
    if (q.has("embed") || q.get("panel") === "mini") isEmbed = true;
  } catch (_) {}
  try {
    if (window.self !== window.top) isEmbed = true;
  } catch (_) {
    isEmbed = true; // cross-origin parent ⇒ treat as embed
  }
  if (!isEmbed && typeof window !== "undefined") {
    const w = window.innerWidth || 0;
    const h = window.innerHeight || 0;
    if ((w > 0 && w < 520) || (h > 0 && h < 420)) isEmbed = true;
  }
  // wall cards: start collapsed so the effect is visible (user can expand)
  const startCollapsed =
    opts.collapsed === true || (opts.collapsed !== false && isEmbed);

  // hydrate from localStorage
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved && typeof saved === "object") {
        params.current = { ...params.defaults, ...saved };
      }
    }
  } catch (_) {}

  const root = document.createElement("div");
  root.className = "tl-param-panel";
  root.dataset.corner = isEmbed ? "tr" : corner; // embed: top-right, less center cover
  if (isEmbed) root.classList.add("is-embed");
  if (startCollapsed) root.classList.add("is-collapsed");
  root.innerHTML = `
    <div class="tl-param-panel__head" data-drag>
      <span class="tl-param-panel__title"></span>
      <button type="button" class="tl-param-panel__btn" data-act="collapse" title="折叠/展开">${
        startCollapsed ? "+" : "–"
      }</button>
    </div>
    <div class="tl-param-panel__body"></div>
    <div class="tl-param-panel__foot">
      <button type="button" class="tl-param-panel__btn" data-act="reset">恢复默认</button>
      <button type="button" class="tl-param-panel__btn" data-act="copy">复制 JSON</button>
      <button type="button" class="tl-param-panel__btn" data-act="export">导出 params</button>
    </div>
  `;
  root.querySelector(".tl-param-panel__title").textContent = title;
  document.body.appendChild(root);

  const body = root.querySelector(".tl-param-panel__body");

  function persist() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(params.current));
    } catch (_) {}
  }

  function emit() {
    persist();
    onChange({ ...params.current });
  }

  function render() {
    body.innerHTML = "";
    for (const field of params.schema) {
      const row = document.createElement("div");
      row.className = "tl-param-row";
      const key = field.key;
      const val = params.current[key] ?? params.defaults[key];
      const lab = document.createElement("label");
      lab.textContent = field.label || key;
      row.appendChild(lab);

      const type = field.type || "text";
      if (type === "range" || type === "number") {
        const input = document.createElement("input");
        input.type = type === "range" ? "range" : "number";
        if (field.min != null) input.min = field.min;
        if (field.max != null) input.max = field.max;
        if (field.step != null) input.step = field.step;
        input.value = val ?? 0;
        const show = document.createElement("span");
        show.className = "tl-param-val";
        show.textContent = String(input.value);
        input.addEventListener("input", () => {
          const n = type === "number" || type === "range" ? Number(input.value) : input.value;
          params.current[key] = n;
          show.textContent = String(n);
          emit();
        });
        row.appendChild(input);
        row.appendChild(show);
      } else if (type === "checkbox") {
        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = !!val;
        input.addEventListener("change", () => {
          params.current[key] = input.checked;
          emit();
        });
        row.appendChild(input);
      } else if (type === "color") {
        const input = document.createElement("input");
        input.type = "color";
        input.value = String(val || "#ffffff");
        input.addEventListener("input", () => {
          params.current[key] = input.value;
          emit();
        });
        row.appendChild(input);
      } else if (type === "select") {
        const sel = document.createElement("select");
        for (const opt of field.options || []) {
          const o = document.createElement("option");
          o.value = opt;
          o.textContent = opt;
          if (opt === val) o.selected = true;
          sel.appendChild(o);
        }
        sel.addEventListener("change", () => {
          params.current[key] = sel.value;
          emit();
        });
        row.appendChild(sel);
      } else {
        const input = document.createElement("input");
        input.type = "text";
        input.value = val ?? "";
        input.addEventListener("input", () => {
          params.current[key] = input.value;
          emit();
        });
        row.appendChild(input);
      }
      body.appendChild(row);
    }
  }

  root.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === "collapse") {
      root.classList.toggle("is-collapsed");
      btn.textContent = root.classList.contains("is-collapsed") ? "+" : "–";
    } else if (act === "reset") {
      params.current = { ...params.defaults };
      render();
      emit();
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
        btn.textContent = "已复制";
        setTimeout(() => (btn.textContent = "复制 JSON"), 1200);
      } catch (_) {
        btn.textContent = "失败";
        setTimeout(() => (btn.textContent = "复制 JSON"), 1200);
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

  // drag
  const head = root.querySelector("[data-drag]");
  let dragging = false;
  let ox = 0;
  let oy = 0;
  head.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return;
    dragging = true;
    const r = root.getBoundingClientRect();
    ox = e.clientX - r.left;
    oy = e.clientY - r.top;
    root.style.left = r.left + "px";
    root.style.top = r.top + "px";
    root.style.right = "auto";
    root.style.bottom = "auto";
    head.setPointerCapture(e.pointerId);
  });
  head.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    root.style.left = Math.max(0, e.clientX - ox) + "px";
    root.style.top = Math.max(0, e.clientY - oy) + "px";
  });
  head.addEventListener("pointerup", () => {
    dragging = false;
  });

  render();
  // initial notify
  onChange({ ...params.current });

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
      params.current = { ...params.defaults, ...obj };
      render();
      emit();
    },
    destroy: () => root.remove(),
    el: root,
  };
}
