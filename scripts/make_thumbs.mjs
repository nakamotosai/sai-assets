/* make_thumbs.mjs — 给每个带预览的包截一张原图(720×450 PNG,PNG 是 ego 唯一输出格式)。
 * 缩到 640×400 WebP 由 scripts/make_thumbs.py(PIL)完成。
 *
 * 为什么是「离线截 + 入库」而不是 CI 里截:构建机没有浏览器,而缩略图是
 * 展示站的**内容**(34 张 ~30KB),跟 zip 一样属于产物,提交进来最省事。
 *
 * 跑法(手动,换包/改预览后重跑):
 *   cd F:/projects/sai-assets
 *   python .private/make-thumbs-targets.py          # 生成 .private/thumbs-targets.json
 *   python -m http.server 8917 --bind 127.0.0.1 --directory dist &
 *   ego-browser nodejs < scripts/make_thumbs.mjs
 */
const fs = await import("node:fs/promises");

const TARGETS = "F:/projects/sai-assets/.private/thumbs-targets.json";
const OUT = "F:/projects/sai-assets/.private/thumbs-raw";
const BASE = process.env.THUMB_BASE || "http://127.0.0.1:8917/packs";
const VW = 720, VH = 450;

const targets = JSON.parse(await fs.readFile(TARGETS, "utf8"));
await fs.mkdir(OUT, { recursive: true });

const task = await taskSpace("sai-assets thumbnails");
const page = task.page("p1");
try {
  await page.cdp("Emulation.setDeviceMetricsOverride", {
    width: VW, height: VH, deviceScaleFactor: 1, mobile: false,
  });
} catch (e) {
  console.log("viewport override failed, fallback to window size:", String(e).slice(0, 80));
}

const report = [];
for (const t of targets) {
  const url = `${BASE}/${t.id}/${t.preview}`;
  try {
    await page.goto(url, { timeout: 30000 });
  } catch (e) {
    report.push({ id: t.id, state: "goto-fail", err: String(e).slice(0, 90) });
    continue;
  }
  await page.waitForTimeout(t.heavy ? 2600 : 1500);
  try {
    const p = await page.screenshot({ path: `${OUT}/${t.id}.png` });
    const st = await fs.stat(p);
    report.push({ id: t.id, state: "ok", kb: Math.round(st.size / 1024) });
  } catch (e) {
    report.push({ id: t.id, state: "shot-fail", err: String(e).slice(0, 90) });
  }
}
console.log(JSON.stringify(report));
const ok = report.filter((r) => r.state === "ok");
console.log(`OK ${ok.length}/${report.length} · 合计 ${ok.reduce((s, r) => s + r.kb, 0)} KB`);
await task.finish({ keep: [] });
