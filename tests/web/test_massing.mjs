// tests/web/test_massing.mjs — M7.5 Visualization headless 測試
// 守 M7_CASE_OS_SPEC §9 的紀律（非像素外觀）：
//   · 純呈現：不寫回任何案件資料
//   · 零領域公式：不回推容積、不自行加總要顯示的領域數值
//   · 權威合計只從 Core result 取，取不到回 null（顯示「—」）
//   · 忠實呈現：停用層不隱藏；計容積為 0 照實顯示、不詮釋
// 執行：node tests/web/test_massing.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
let pass = 0, fail = 0;
const ok = (c, n) => { if (c) { pass++; } else { fail++; console.error("❌", n); } };
const throws = (fn, n) => { try { fn(); fail++; console.error("❌", n, "(應拋錯)"); } catch { pass++; } };

global.self = {};
const src = readFileSync(join(root, "apps/web/massing-view.js"), "utf8");
new Function("self", "module", src)(global.self, { exports: {} });
const MV = global.self.MassingView;
ok(!!MV, "massing-view 載入");

// 取真實範例的 floors（合成案例D）
const engine = JSON.parse(
  readFileSync(join(root, "schemas/examples/v2/v2_1_案例D_權變示範.json"), "utf8")).engine;
const floors = engine.floors;

// ── 排序：屋突 > 地上 > 地下；B1 在 B2 之上 ──
const m = MV.buildModel(floors);
const labels = m.rows.map(r => r.label);
ok(labels[0] === "R1F", "屋突排最上");
ok(labels[labels.length - 1] === "B3F", "最深地下層排最下");
ok(labels.indexOf("B1F") < labels.indexOf("B2F"), "B1F 在 B2F 之上");
ok(labels.indexOf("15F") < labels.indexOf("1F"), "高樓層在低樓層之上");
ok(m.rows.length === floors.length, "不遺漏任何一層");

ok(MV.levelRank("B2F") === -2 && MV.levelRank("3F") === 3, "樓層權重解析");
ok(MV.levelRank("") === 0, "無法解析的樓層不臆造（歸基準列）");

// ── 分類計數 ──
ok(m.aboveGround === 15, "地上 15 層");
ok(m.belowGround === 3, "地下 3 層");
ok(m.rooftop === 1, "屋突 1 層");

// ── maxPlate 只作比例縮放，且等於啟用層的最大樓板 ──
const maxEnabled = Math.max(...floors.filter(f => f.啟用 !== false).map(f => f.樓板));
ok(m.maxPlate === maxEnabled, "maxPlate ＝ 啟用層最大樓板（僅供縮放）");

// ── 誠實：計容積全零要被標記出來，不得被詮釋掉 ──
ok(m.counted_far_all_zero === true, "本例計容積逐層皆 0 → 旗標為真（供 UI 據實說明）");

// ── 權威合計只能來自 Core result ──
ok(MV.totalsFrom(null) === null, "無 result → 回 null（顯示「—」）");
ok(MV.totalsFrom({}) === null, "result 無相關欄位 → 回 null");
const t = MV.totalsFrom({ total_floor_area_sqm: 12345.6, 其他: 1 });
ok(t && t.total_floor_area_sqm === 12345.6, "從 result 取總樓地板面積");
ok(t && !("其他" in t), "只取白名單欄位");

// 關鍵：totalsFrom 不得由 floors 自行加總湊出數字
const 樓板總和 = floors.reduce((s, f) => s + f.樓板, 0);
ok(MV.totalsFrom({ total_floor_area_sqm: 1 }).total_floor_area_sqm === 1,
   "verbatim 回傳 Core 值，不與 floors 自算值混用");
ok(MV.totalsFrom(null) === null && 樓板總和 > 0,
   "即使 floors 加總得出來，也不得在無 result 時自行湊出合計");

// ── 停用層：照實呈現，不隱藏 ──
const withOff = floors.map((f, i) => i === 5 ? { ...f, 啟用: false } : f);
const m2 = MV.buildModel(withOff);
ok(m2.rows.length === floors.length, "停用層仍在模型中（不隱藏）");
ok(m2.disabled === 1, "停用層被計數");
ok(m2.rows.some(r => r.enabled === false), "停用層帶 enabled=false 供樣式區隔");
ok(m2.maxPlate === Math.max(...withOff.filter(f => f.啟用 !== false).map(f => f.樓板)),
   "停用層不參與縮放基準");

// ── SVG 產出 ──
const s = MV.svg(m);
ok(s.startsWith("<svg") && s.endsWith("</svg>"), "產出合法 SVG 片段");
ok((s.match(/<rect/g) || []).length === floors.length, "每層一條");
ok(s.includes('role="img"') && s.includes("aria-label"), "SVG 具無障礙標示");
ok(s.includes("<title>"), "每條帶 title（鍵盤／讀屏可及）");
ok(s.includes("mv-below"), "地下層有區隔 class");
const sOff = MV.svg(m2);
ok(sOff.includes("mv-off"), "停用層有區隔 class");

// XSS：樓層名稱必須被跳脫
const evil = MV.buildModel([{ 樓層: '<img src=x onerror=alert(1)>', 樓板: 100, 啟用: true }]);
const sEvil = MV.svg(evil);
ok(!sEvil.includes("<img"), "樓層名稱經 HTML 跳脫");
ok(MV.table(evil).includes("&lt;img"), "表格同樣跳脫");

// ── 逐層表：只列原始欄位，不得出現合計列 ──
const tbl = MV.table(m);
MV.RAW_COLS.forEach(k => ok(tbl.includes(">" + k + "<"), `表頭含原始欄位 ${k}`));
ok(!/合計|總計|小計/.test(tbl), "表格不含任何自算合計列");

// ── 防呆 ──
throws(() => MV.buildModel(null), "floors 非陣列應拋錯");
throws(() => MV.buildModel({}), "floors 傳物件應拋錯");
const sparse = MV.buildModel([{ 樓層: "1F" }]);
ok(sparse.rows[0]["樓板"] === 0, "缺欄位補 0，不 NaN");
ok(MV.svg(sparse).includes("<rect"), "maxPlate=0 時仍可繪製不炸");

// ── 紅線：模組**程式碼**零領域公式（註解在講紀律，不算違規，故先剝除）──
const code = src
  .replace(/\/\*[\s\S]*?\*\//g, "")          // 區塊註解
  .replace(/^\s*\/\/.*$/gm, "");             // 行註解
// FORBIDDEN 黑名單宣告本身當然含這些詞，先剝除再驗
const codeNoDecl = code.replace(/var FORBIDDEN[\s\S]*?\];/, "");
ok(!/容積率|獎勵率|共同負擔|投報|坪效|銷坪比/.test(codeNoDecl),
   "程式碼不得出現領域計算詞彙（零公式）");
ok(!/CaseStore|putCase|IndexedDB|\.append\(/.test(codeNoDecl),
   "純呈現層不得有任何寫入路徑");
MV._FORBIDDEN.forEach(k => {
  ok(!new RegExp("[\"']" + k + "[\"']").test(codeNoDecl),
     `不得直接索引推論欄位 ${k}`);
});
// 確認剝註解後仍有實質程式碼（避免剝過頭讓斷言變空洞）
ok(code.includes("function buildModel") && code.length > 1200, "剝註解後仍涵蓋實際程式碼");

console.log(`\nM7.5 MASSING VIEW headless：${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
