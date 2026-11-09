/*!
 * footer-shapes.js — 订阅表单的提交回执(唯一需要的脚本行为)
 * MIT License · sai-assets pack footer-shapes v1.0.0
 * 五形态里只有「栅格式」带表单;其余四形态是纯 CSS,不引本文件也能用。
 */
(function () {
  "use strict";

  // 注意:HTML 属性里写邮箱正则要双重转义,容易写错。这里用不依赖正则的检查:
  // 有且仅有一个 @、两侧非空、域名里有点、没有空白。
  function looksLikeEmail(s) {
    if (/\s/.test(s)) return false;
    var parts = s.split("@");
    if (parts.length !== 2) return false;
    var local = parts[0];
    var domain = parts[1];
    if (!local || !domain) return false;
    if (domain.indexOf(".") < 1) return false;
    if (domain.slice(-1) === "." || domain.slice(0, 1) === ".") return false;
    return true;
  }

  function boot() {
    document.querySelectorAll("[data-fs-form]").forEach(function (form) {
      var input = form.querySelector("input[type=email], input[type=text]");
      var msg = form.parentElement.querySelector("[data-fs-msg]");
      if (!input || !msg) return;

      var show = function (text, ok) {
        msg.textContent = text;
        if (ok) msg.setAttribute("data-tone", "ok");
        else msg.removeAttribute("data-tone");
      };

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var v = (input.value || "").trim();
        if (!v) {
          show("先填一个邮箱", false);
          input.focus();
          return;
        }
        if (!looksLikeEmail(v)) {
          show("这个地址看起来不完整,再对一下", false);
          input.focus();
          return;
        }
        show("已记下 " + v + " · 只发月刊,一周最多一封", true);
        input.value = "";
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
