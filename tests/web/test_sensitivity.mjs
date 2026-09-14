// tests/web/test_sensitivity.mjs — M8.4 敏感度地圖 headless
// 守 M8_VIEWFINDER_SPEC §6 的四條紀律：
//   ① 每格真實 recompute，不得內插
//   ② 宣告網格數 ＝ 實際重算次數（對抗案例 G）
//   ③ 不平滑；跨門檻一律看該格數值
//   ④ 明確觸發、可中止、缺格不頂替
// 執行：node tests/web/test_sensitivity.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.error("❌", n); } };
const throws = (fn, n) => { try { fn(); fail++; console.error("❌", n, "(應拋錯)"); } catch { pass++; } };

global.self = {};
const src = readFileSync(join(root, "apps/web/sensitivity-map.js"), "utf8");
new Function("self", "module", src)(global.self, { exports: {} });
const SM = global.self.SensitivityMap;

const 軸 = { x: { param: "營造單價", from: 18, to: 24, steps: 7 },
             y: { param: "住宅單價", from: 65, to: 95, steps: 7 } };
const 假算 = (e) => ({ result: { shared_cost_ratio: 0.30 + e.params.營造單價 * 0.01 - e.params.住宅單價 * 0.002 } });

// ── ① 網格是明列的，不是推出來的 ──────────────────────────────
const spec = SM.plan(軸);
ok(spec.declared_cells === 49 && spec.cells.length === 49, "宣告格數＝實際 cells 陣列長度");
ok(spec.cells.every(c => isFinite(c.x) && isFinite(c.y)), "每一格都明列它要用的參數值");
ok(spec.x.values[0] === 18 && spec.x.values[6] === 24, "軸端點取到，不是內縮");
ok(new Set(spec.cells.map(c => c.r + "," + c.c)).size === 49, "格座標不重複");

// ── ② 對抗案例 G：宣告網格數 ＝ 實際重算次數 ──────────────────
let calls = 0;
const g = await SM.run(e => { calls++; return 假算(e); }, { params: {} }, spec, {});
ok(calls === 49, `實際呼叫 Core ${calls} 次＝宣告 49 格`);
ok(g.recompute_count === g.declared_cells, "grid 自報的重算次數與宣告相符");
ok(g.values.filter(v => v != null).length === 49, "49 格都有值");
ok(SM.caption(g).headline.includes("49 格") && SM.caption(g).headline.includes("49 次"),
   "圖說同時顯示宣告格數與實際重算次數——使用者看得到解析度極限");

// 造假偵測：少算就必須拋錯，不得靜默補足
let n = 0;
await SM.run(e => { n++; if (n > 30) throw new Error("stop"); return 假算(e); }, { params: {} }, spec, {})
  .then(gr => ok(gr.recompute_count === 49, "即使部分失敗，呼叫次數仍如實計"))
  .catch(() => ok(false, "部分失敗不應拋錯，應標缺格"));

// 若有人改成抽樣，run 必須拒絕交出圖
const 抽樣spec = JSON.parse(JSON.stringify(spec));
抽樣spec.cells = 抽樣spec.cells.slice(0, 25);          // 只留 25 格，但宣告仍是 49
let 擋下 = false;
try { await SM.run(e => 假算(e), { params: {} }, 抽樣spec, {}); } catch { 擋下 = true; }
ok(擋下, "★ 只算 25 格卻宣告 49 格→拋錯，不得交出一張『看起來算過』的圖");

// ── ③ 不內插、不平滑 ─────────────────────────────────────────
ok(g.interpolated === false && g.smoothed === false, "grid 明文宣告未內插未平滑");
// 掃描前要先剝掉「誠實旗標」本身——interpolated:false／smoothed:false 必然含那些字，
// 就像守衛腳本的 FORBIDDEN 清單必然含它要擋的字。掃的是**運算**，不是宣告。
const 去註解 = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
  .replace(/\b(interpolated|smoothed)\s*:\s*(false|true)/g, "");
[["interpolat", "不得內插"], ["lerp", "不得線性內插"], ["smooth", "不得平滑"],
 ["bezier", "不得曲線擬合"], ["gaussian", "不得高斯模糊"], ["blur", "不得模糊"]]
  .forEach(([t, why]) => ok(!new RegExp(t, "i").test(去註解), "原始碼掃描：" + why));

// 缺格不得被鄰居頂替
const 有缺 = await SM.run(e => e.params.營造單價 === 21 ? { result: {} } : 假算(e),
                          { params: {} }, spec, {});
ok(有缺.missing.length === 7, "取不到的 7 格標為缺格");
ok(有缺.missing.every(i => 有缺.values[i] === null), "缺格是 null，不是鄰格的值");
ok(SM.svg(有缺, {}).includes("sh-miss"), "缺格以斜線呈現，不畫成顏色（顏色會被讀成有算過）");
ok(SM.caption(有缺).notes.some(s => /不以鄰格頂替/.test(s)), "圖說說明缺格的處置");

// ── ④ 拒答結構性參數（沿用 M7.4 同一條界線）──────────────────
SM.STRUCTURAL.forEach(p => throws(
  () => SM.plan({ x: { param: p, from: 1, to: 2, steps: 3 }, y: 軸.y }),
  `結構性參數「${p}」明確拒答，不做虛假掃描`));
throws(() => SM.plan({ x: 軸.x, y: { param: "營造單價", from: 1, to: 2, steps: 3 } }),
       "兩軸相同→拒絕");
throws(() => SM.plan({ x: { param: "營造單價", from: 1, to: 2, steps: 1 }, y: 軸.y }),
       "steps < 2 →拒絕");
throws(() => SM.plan({ x: { param: "營造單價", from: 1, to: 2, steps: 40 }, y: 軸.y }),
       "steps > 21 →拒絕（效能上限明文，不靜默降解析度）");
throws(() => SM.plan({ x: { param: "營造單價", from: 5, to: 5, steps: 3 }, y: 軸.y }),
       "from===to →拒絕（零跨距的掃描沒有意義）");

// ── 輸入不得被改動 ───────────────────────────────────────────
const eng = { params: { 營造單價: 20, 住宅單價: 70, 基地面積: 1800 }, floors: [{ 樓板: 1 }] };
const 快照 = JSON.stringify(eng);
await SM.run(e => 假算(e), eng, spec, {});
ok(JSON.stringify(eng) === 快照, "掃描不得改動輸入 engine");
const one = SM.engineFor(eng, spec, spec.cells[10]);
ok(one !== eng && one.floors !== eng.floors, "每格用的是深複本");
ok(one.params.基地面積 === 1800, "非掃描軸的參數原樣保留");

// ── 中止：已算的保留，未算的標缺格 ───────────────────────────
const ac = { aborted: false };
let c2 = 0;
const 中止 = await SM.run(e => { if (++c2 === 10) ac.aborted = true; return 假算(e); },
                          { params: {} }, spec, { signal: ac });
ok(中止.aborted === true, "中止旗標如實回報");
ok(中止.recompute_count === 10, "中止時只算了 10 格，如實計數");
ok(中止.missing.length === 39, "未算的 39 格標為缺格，不補值");
ok(SM.caption(中止).notes.some(s => /中止/.test(s)), "圖說告知已中止");

// ── 門檻：跨不跨看該格數值，不看視覺 ─────────────────────────
const 圖 = SM.svg(g, { threshold: 0.45 });
const 超標數 = (圖.match(/sh-over/g) || []).length;
const 實際超標 = g.values.filter(v => v != null && v >= 0.45).length;
ok(超標數 === 實際超標, `跨門檻標記數（${超標數}）＝該格數值超標數（${實際超標}）`);

// ── 進度回報（規格 §6④：明確觸發並顯示進度）──────────────────
const 進度 = [];
await SM.run(e => 假算(e), { params: {} }, spec, { onProgress: (d, t) => 進度.push(d + "/" + t) });
ok(進度.length === 49 && 進度[48] === "49/49", "逐格回報進度（長時間計算不得沉默）");

console.log(`\nM8.4 敏感度地圖 headless：${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
