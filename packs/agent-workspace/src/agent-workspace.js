/*!
 * agent-workspace.js — 对话工作台的三个行为:输入框自成长 / 流式回放 / 审批回执
 * MIT License · sai-assets pack agent-workspace v1.0.0
 * 零依赖、无构建。只找 [data-aw-*] 标记,页面里没有就什么也不做。
 */
(function () {
  "use strict";

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── 1 · 输入框自成长 + 回车发送 ─────────────────────── */
  function initComposer(root) {
    var ta = root.querySelector("[data-aw-input]");
    if (!ta) return;
    var grow = function () {
      ta.style.height = "auto";
      ta.style.height = Math.min(168, Math.max(46, ta.scrollHeight)) + "px";
    };
    ta.addEventListener("input", grow);
    grow();

    var stream = root.querySelector("[data-aw-stream]");
    var body = root.querySelector("[data-aw-stream-body]");
    if (!stream || !body) return;
    var source = body.getAttribute("data-aw-source") || "";
    var timer = null;

    var run = function () {
      window.clearInterval(timer);
      if (!source) return;
      stream.setAttribute("data-state", "streaming");
      body.textContent = "";
      if (reduce) {
        body.textContent = source;
        stream.setAttribute("data-state", "done");
        return;
      }
      var i = 0;
      timer = window.setInterval(function () {
        i += 2;
        body.textContent = source.slice(0, i);
        if (i >= source.length) {
          window.clearInterval(timer);
          stream.setAttribute("data-state", "done");
        }
      }, 16);
    };

    ta.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        run();
      }
    });
    stream.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-aw-replay]");
      if (btn) run();
    });
  }

  /* ── 2 · 审批卡:选一项 + 提交/拒绝 ──────────────────── */
  function initApproval(root) {
    root.querySelectorAll("[data-aw-approve]").forEach(function (card) {
      var verdict = card.querySelector("[data-aw-verdict]");
      var submit = card.querySelector("[data-aw-submit]");
      var reject = card.querySelector("[data-aw-reject]");
      var opts = card.querySelectorAll('input[type="radio"]');

      var pick = function () {
        var any = Array.prototype.some.call(opts, function (o) { return o.checked; });
        if (submit) submit.disabled = !any;
      };
      opts.forEach(function (o) { o.addEventListener("change", pick); });
      pick();

      var finish = function (tone, text) {
        card.setAttribute("data-state", tone);
        if (verdict) {
          verdict.setAttribute("data-tone", tone === "approved" ? "ok" : "no");
          verdict.textContent = text;
        }
        if (submit) submit.disabled = true;
        if (reject) reject.disabled = true;
        opts.forEach(function (o) { o.disabled = true; });
      };

      if (submit) submit.addEventListener("click", function () {
        var chosen = card.querySelector('input[type="radio"]:checked');
        var label = chosen && chosen.closest(".aw-opt") ? chosen.closest(".aw-opt").querySelector("b").textContent : "";
        finish("approved", "已同意 · " + label);
      });
      if (reject) reject.addEventListener("click", function () {
        finish("rejected", "已拒绝 · 代理不会写入");
      });
    });
  }

  /* ── 3 · 任务进度:进视口把 --aw-progress 推到目标值 ── */
  function initProgress(root) {
    var bars = root.querySelectorAll("[data-aw-progress-to]");
    if (!bars.length) return;
    var apply = function (el) {
      el.style.setProperty("--aw-progress", el.getAttribute("data-aw-progress-to"));
    };
    if (reduce || !("IntersectionObserver" in window)) {
      bars.forEach(apply);
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        apply(en.target);
        io.unobserve(en.target);
      });
    }, { threshold: 0.35 });
    bars.forEach(function (b) { io.observe(b); });
  }

  function boot() {
    document.querySelectorAll("[data-aw-root]").forEach(function (root) {
      initComposer(root);
      initApproval(root);
      initProgress(root);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
