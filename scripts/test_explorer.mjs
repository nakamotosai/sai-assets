/* test_explorer.mjs — 探索器控制器行为测试(本地跑,不进 CI:CI 没有 bun/jsdom)
 *
 *   cd .private/explorer-test && bun add jsdom        # 只装一次(dev 依赖,不进仓)
 *   bun run ../../scripts/test_explorer.mjs
 *
 * 它在**真实构建产物**(dist/index.html + site/site.js)上断言:选中 / 筛选 / 搜索 / 键盘 /
 * 宽度 / 段 / 对话框 / URL 同步 / 无预览包的降级。跑之前先 python scripts/build_site.py。
 * 这个测试当场抓出过两个真 bug:iframe 没尺寸(默认 300×150)、<dialog> 缺 showModal 时整段交互挂掉。
 */
/* 探索器控制器行为测试(jsdom,不经浏览器):
   在真实构建产物上跑 site/site.js,断言选中/筛选/键盘/宽度/段/对话框/URL 这些**逻辑**行为。 */
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const ROOT = "F:/projects/sai-assets";
const html = readFileSync(`${ROOT}/dist/index.html`, "utf8");
const js = readFileSync(`${ROOT}/site/site.js`, "utf8");

const dom = new JSDOM(html, { url: "http://localhost/", runScripts: "outside-only", pretendToBeVisual: true });
const w = dom.window;
const errors = [];
w.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
w.HTMLElement.prototype.scrollIntoView = function () {};
/* Bun 下 jsdom 的 window 代理不支持 addEventListener:s 层只用来挂 resize,转给 document 即可 */
w.addEventListener = (t, fn, o) => w.document.addEventListener(t, fn, o);
Object.defineProperty(w.navigator, "clipboard", { value: { writeText: async () => {}, readText: async () => "" }, configurable: true });

let failures = 0;
const ok = (cond, label, extra = "") => {
  if (!cond) { failures++; console.log(`FAIL ${label} ${extra}`); }
  else console.log(`ok   ${label} ${extra}`);
};
const doc = w.document;
const q = (s) => doc.querySelector(s);
const qa = (s) => [...doc.querySelectorAll(s)];
const visible = () => qa(".pk").filter((el) => !el.hidden);
const cur = () => q('.pk[aria-current="true"]')?.dataset.id;
const search = () => new URLSearchParams(w.location.search);
const key = (k) => doc.dispatchEvent(new w.KeyboardEvent("keydown", { key: k, bubbles: true }));

try { w.eval(js); } catch (e) { failures++; console.log("FAIL 脚本抛异常", e); }

ok(qa(".pk").length === 34, "34 行", qa(".pk").length);
ok(qa(".pk-thumb img").length >= 28, "缩略图 ≥28", qa(".pk-thumb img").length);
ok(cur() !== undefined, "有选中行", cur());
ok(search().get("pack") === cur(), "URL 带 pack", w.location.search);
ok(search().get("w") === "desktop", "URL 带 w=desktop", w.location.search);
ok(q("#h-name").textContent.length > 2, "头部名称已填", q("#h-name").textContent.slice(0, 20));
ok(q("#pv").getAttribute("src")?.startsWith("packs/"), "iframe 指向包内预览", q("#pv").getAttribute("src"));

/* 键盘:↓ 切下一个可见行 */
const before = cur();
key("ArrowDown");
const after = cur();
ok(after !== before, "↓ 切换选中", `${before} -> ${after}`);
ok(search().get("pack") === after, "↓ 后 URL 同步", w.location.search);

/* 键盘:/ 聚焦搜索 */
key("/");
ok(doc.activeElement?.id === "q", "/ 聚焦搜索", doc.activeElement?.id);

/* 筛选:类目「主题」 */
const themeChip = qa('.chip[data-cat]').find((c) => c.dataset.cat === "themes");
themeChip.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
ok(visible().length === 15, "主题筛选 15 行", visible().length);
ok(visible().every((el) => el.dataset.cat === "themes"), "筛后全为主题");
ok(visible().some((el) => el.dataset.id === cur()), "选中项仍在筛选结果里", cur());

/* 深浅「暗」 */
const darkChip = qa('.chip[data-mode]').find((c) => c.dataset.mode === "dark");
darkChip.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
const darkN = visible().length;
ok(darkN > 0 && darkN < 15, "暗色筛选收窄", darkN);
ok(visible().every((el) => el.dataset.mode === "dark"), "筛后全为暗色");

/* 复位 facet 再搜(上面留着「主题 + 暗」,gruvbox-dark 是双模,会被暗筛选挡掉 —— 那是对的) */
q("#pk-reset").dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
const input = q("#q");
input.value = "gruvbox";
input.dispatchEvent(new w.Event("input", { bubbles: true }));
ok(visible().length === 1, "搜索 gruvbox → 1 行", visible().length);
ok(cur() === "gruvbox-dark", "选中自动落到 gruvbox-dark", cur());
input.value = "";
input.dispatchEvent(new w.Event("input", { bubbles: true }));

/* 重置 */
q("#pk-reset").dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
ok(visible().length === 34, "重置回 34 行", visible().length);

/* 宽度 */
qe: {
  const phone = qa('.widthseg [data-w]').find((b) => b.dataset.w === "phone");
  phone.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  ok(q("#frame").dataset.w === "phone", "宽度切到 phone", q("#frame").dataset.w);
  ok(q("#scaler").style.width === "390px" && q("#scaler").style.height === "844px",
     "缩放盒 390×844(iframe 填满它)", q("#scaler").style.width + "x" + q("#scaler").style.height);
  ok(q("#fit").style.width === "390px", "占位盒 390", q("#fit").style.width);
  ok(search().get("w") === "phone", "URL w=phone", w.location.search);
}

/* 段:选 token-harbor */
q('.pk[data-id="token-harbor"] .pk-a').dispatchEvent(new w.MouseEvent("click", { bubbles: true, cancelable: true }));
ok(cur() === "token-harbor", "点行选中 token-harbor", cur());
const opts = qa("#sect option").map((o) => o.value);
ok(opts.length >= 11, "段选项 = 整页 + 10", opts.length);
ok(q("#sect").disabled === false, "段控件可用");
const sel2 = q("#sect");
sel2.value = opts[2];
sel2.dispatchEvent(new w.Event("change", { bubbles: true }));
ok(q("#pv").getAttribute("src").endsWith("#" + opts[2]), "段驱动 iframe 锚点", q("#pv").getAttribute("src"));

/* 无预览的包:段禁用 + 空态 */
q('.pk[data-id="references"] .pk-a').dispatchEvent(new w.MouseEvent("click", { bubbles: true, cancelable: true }));
ok(q("#sect").disabled === true, "无预览包段控件禁用");
ok(q("#pv-empty").hidden === false, "显示「没有预览页」提示");

/* 对话框:先把焦点从搜索框挪开(打字时不抢键是对的),再 Enter 打开、Esc 关 */
key("Escape");            // 搜索框里按 Esc:清空 + 失焦
key("Enter");
ok(q("#use").open === true || q("#use").hasAttribute("open"), "Enter 打开取用对话框");
ok(qa("#use-snips .snip").length === 4, "对话框四段片段", qa("#use-snips .snip").length);
ok(q("#use-snips pre code").textContent.includes("cdn.jsdelivr.net"), "首段是 CDN", q("#use-snips pre code").textContent.slice(0, 40));
key("Escape");
ok(q("#use").open === false && !q("#use").hasAttribute("open"), "Esc 关闭对话框");

/* 隐藏预览 */
q("#hide").dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
ok(q("#frame").dataset.hidden === "1", "隐藏预览");
q("#hide").dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
ok(q("#frame").dataset.hidden === "0", "再点显示预览");

ok(errors.length === 0, "运行期无异常", errors.slice(0, 2).join(" | "));
console.log(failures ? `\nFAILED ${failures}` : "\nALL PASS");
process.exit(failures ? 1 : 0);
