// tests/web/test_case_bus.mjs — 起始介面／四步連動 headless 測試
// 守的紀律（非像素外觀）：
//   · 零輸出公式：stepValues 的每個 core／decision 值都必須逐欄等於紀錄裡的原值
//   · 取不到就是 null（呈現層顯示「—」），**不得由 UI 補算**
//   · buildEngine 只組輸入；不得偷抄 Core 的允建容積公式（面積表計入容積 必須缺席）
//   · 四步讀同一份紀錄——同一個 input_hash、同一個 core_version
//   · 輸入一改，input_hash 就變；舊 decision 必須卸下（N1 二元組規則）
// 執行：node tests/web/test_case_bus.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
let pass = 0, fail = 0;
const ok = (c, n) => { if (c) { pass++; } else { fail++; console.error("❌", n); } };
const throws = (fn, n) => { try { fn(); fail++; console.error("❌", n, "(應拋錯)"); } catch { pass++; } };

global.self = {};
const src = readFileSync(join(root, "apps/web/case-bus.js"), "utf8");
new Function("self", "module", src)(global.self, { exports: {} });
const B = global.self.CaseBus;

// ── 1. 入口欄位：問的是使用者知道的事，不是範本編號 ──────────────
ok(B.BASIC.length === 4, "開場只問四個問題");
ok(B.BASIC.map(f => f.k).join(",") === "基地面積,容積率,住宅單價,戶數",
   "四問＝基地面積／容積率／住宅單價／戶數");
ok(B.BASIC.every(f => f.ask && f.ask.length > 3), "每個問題都附白話說明");
ok(B.FIELDS.every(f => f.def !== undefined), "所有欄位都有預設，使用者不必從空白開始");
ok(!JSON.stringify(B.FIELDS).match(/案例[A-D]/), "欄位定義不含任何 A~D 範本殘留");

// ── 2. buildEngine 只組輸入 ───────────────────────────────────
const eng = B.buildEngine(B.defaults());
ok(!("面積表計入容積" in eng.params),
   "不得設 面積表計入容積——那是把 Core 的允建容積公式抄進 UI，且會讓容積餘量恆為 0");
ok(eng.floors.length === 8, "預設 1 層地下＋7 層地上");
ok(eng.floors[0].樓層 === "B1F" && eng.floors[0].計容積 === 0, "B1F 不計容積（§117）");
ok(eng.floors.slice(1).every(f => f.計容積 === f.樓板), "地上層計容積＝樓板，由 Core 加總");
ok(eng.floors.slice(1).every(f => Math.abs(f.梯廳 - f.樓板 * 0.05) < 1e-6),
   "梯廳預設落在免計基準上——預設量體不製造 §162 超出");
ok(eng.params.權變戶數 === eng.params.戶數, "權變戶數跟隨戶數");
ok(eng.case_type === "都更" && eng.mode === "全案管理", "預設案件類型／模式");

// 覆寫優先於推得的預設（推得的預設必須是可覆寫欄位）
const eng2 = B.buildEngine(Object.assign(B.defaults(), { 標準樓板: 400 }));
ok(eng2.floors[1].樓板 === 400, "填了標準樓板就以填的為準，不再用建蔽率推");
const eng3 = B.buildEngine(Object.assign(B.defaults(), { 基地面積: 2000 }));
ok(eng3.floors[1].樓板 > eng.floors[1].樓板, "沒填就由建蔽率×可建面積推預設");

// 單位換算：百分比欄位進 Core 前一律轉成比率
ok(eng.params.容積率 === 3 && eng.params.獎勵率 === 0.3 && eng.params.公設比 === 0.33,
   "%欄位轉為比率後才交給 Core");

// ── 3. 紀錄組裝：整個 OS 只有這一個地方決定紀錄長什麼樣 ───────────
const R = {
  allow_floor_area: 3900, used_floor_area: 3850, remaining_floor_area: 50,
  saleable_area: 1953.98, efficiency_ratio: 1.656, shared_cost_ratio: 0.3868,
  return_rate: 1.5855, owner_return_ratio: 0.61, total_sales: 123456,
  core_version: "0.6.0", computed_at: "2026-08-22T00:00:00Z", warnings: []
};
const IH = "sha256:" + "c".repeat(64);
const rec = B.buildRecord({ engine: eng, result: R, input_hash: IH });
ok(rec.pid === "prj-" + "c".repeat(8), "pid 派生自 input_hash");
ok(rec.snap.core_version === "0.6.0" && rec.wf.project.snapshots[0].core_version === "0.6.0",
   "snap 與 wf 快照都帶 core_version（N1 二元組的另一半）");
ok(rec.snap.input_hash === IH && rec.wf.project.snapshots[0].input_hash === IH,
   "snap 與 wf 快照 input_hash 一致");
ok(rec.view.return_rate === 1.5855, "view 逐欄搬 Core result");
ok(rec.view.value_multiple === null, "Core 沒給的欄位是 null，不是 0（0 會被當成一個答案）");
ok(rec.demo === false, "使用者自建的案件不是示範案");

// ── 4. stepValues：四步連動的讀模型 ────────────────────────────
const sv = B.stepValues(rec);
ok(B.STEP_ORDER.join(",") === "site,product,people,decision", "四步順序固定");
ok(B.STEP_ORDER.every(k => sv[k] && sv[k].items.length === 4), "每步四格");
const 全部 = B.STEP_ORDER.flatMap(k => sv[k].items);
ok(全部.every(it => ["core", "input", "decision"].includes(it.source)),
   "來源只有 core／input／decision 三種——沒有第四種");
ok(B.assertNoDerivedOutput(rec), "stepValues 的每個權威值逐欄 verbatim，未經任何換算");

const 取 = (g, l) => sv[g].items.find(x => x.label === l).value;
ok(取("site", "允建容積") === R.allow_floor_area, "① 基地：允建容積 verbatim");
ok(取("site", "容積餘量") === R.remaining_floor_area, "① 基地：容積餘量 verbatim（不是自己減出來的）");
ok(取("product", "全案投報率") === R.return_rate, "② 產品：全案投報率 verbatim");
ok(取("product", "銷售坪數") === R.saleable_area, "② 產品：銷售坪數 verbatim");
ok(取("people", "權變戶數") === eng.params.戶數, "③ 人心：戶數來自輸入事實");
ok(取("people", "地主分回比") === R.owner_return_ratio, "③ 人心：地主分回比 verbatim");
ok(取("decision", "判定") === null, "④ 決策：還沒跑 Decision Engine → null，不臆造 GO/CAUTION");
ok(sv.product.items.find(x => x.label === "全案投報率").unit === "ratio",
   "投報率標為比率單位；標籤是「全案投報率」不是 IRR");
ok(!JSON.stringify(sv).includes("IRR"), "四步讀模型不得出現 IRR 字樣");

// 缺 result 時全部 null（不得補 0）
const 空rec = B.buildRecord({ engine: eng, result: {}, input_hash: IH });
const 空sv = B.stepValues(空rec);
ok(B.STEP_ORDER.flatMap(k => 空sv[k].items).filter(it => it.source === "core")
   .every(it => it.value === null), "Core 沒算就是 null，介面顯示「—」");

// 掛上 decision 後，第四步才有值
const rec2 = JSON.parse(JSON.stringify(rec));
rec2.decision = { verdict: "CAUTION", completion_probability: 0.2963,
                  breakpoint_stakeholder: "地主", decision_urgency: 0.5272,
                  input_hash: IH, core_version: "0.6.0" };
const sv2 = B.stepValues(rec2);
ok(sv2.decision.items.find(x => x.label === "判定").value === "CAUTION", "④ 決策：verdict verbatim");
ok(B.assertNoDerivedOutput(rec2), "掛上 decision 後仍逐欄 verbatim");

// ── 5. 溯源：四步看到的是同一份輸入算出來的 ─────────────────────
const pv = B.provenance(rec);
ok(pv.input_hash === IH && pv.core_version === "0.6.0", "provenance 給出二元組");
ok(rec.snap.input_hash === rec.wf.project.snapshots[0].input_hash,
   "同一份紀錄裡的溯源鍵一致——四步不可能讀到不同版本");

// ── 6. 改參數後重算：舊 decision 必須卸下（N1 二元組規則）────────
const IH2 = "sha256:" + "d".repeat(64);
const eng4 = B.buildEngine(Object.assign(B.defaults(), { 住宅單價: 90 }));
const R2 = Object.assign({}, R, { return_rate: 2.1 });
const rec3 = B.applyResult(rec2, { engine: eng4, result: R2, input_hash: IH2 });
ok(rec3.snap.input_hash === IH2, "重算後換上新的 input_hash");
ok(rec3.decision === null, "輸入變了→舊 decision 卸下（不留下一個對不上的判定）");
ok(rec3.detached_decision && rec3.detached_decision.verdict === "CAUTION",
   "卸下的 decision 留存可稽核，不是靜默丟棄");
ok(rec3.view.return_rate === 2.1, "view 換成新結果");
ok(rec3.wf.project.snapshots[0].input_hash === IH2, "wf 快照同步更新");

// input_hash 沒變時 decision 保留
const rec4 = B.applyResult(rec2, { engine: eng, result: R, input_hash: IH });
ok(rec4.decision && rec4.decision.verdict === "CAUTION", "input_hash 不變→decision 保留");

// applyResult 不得就地改動輸入紀錄
const 快照 = JSON.stringify(rec2);
B.applyResult(rec2, { engine: eng4, result: R2, input_hash: IH2 });
ok(JSON.stringify(rec2) === 快照, "applyResult 回傳新結構，不改動輸入");

// ── 7. stepnav 的即時數字也只是搬運 ────────────────────────────
global.self.CaseBus = B;
const nav = { exports: {} };
const 假document = {
  readyState: "complete", getElementById: () => null,
  createElement: () => ({ style: {}, set textContent(v) {}, set innerHTML(v) {} }),
  head: { appendChild() {} }, body: { insertBefore() {}, firstChild: null },
  addEventListener() {}
};
new Function("self", "module", "window", "document", "location",
  readFileSync(join(root, "apps/web/stepnav.js"), "utf8"))(
  global.self, nav,
  { addEventListener() {} }, 假document, { pathname: "/dashboard.html" });
const NAV = nav.exports;
ok(NAV.STEPS.length === 4 && NAV.STEPS.map(s => s.key).join(",") === "site,product,people,decision",
   "stepnav 四步對齊 case-bus 的 STEP_ORDER");
global.self.CaseBus = Object.assign({}, B, { activeRecord: () => rec2 });
ok(NAV.liveOf(NAV.STEPS[0]).text === "3,900 ㎡", "① 導覽列顯示 Core 的允建容積");
ok(NAV.liveOf(NAV.STEPS[1]).text === "158.5%", "② 導覽列顯示 Core 的投報率（只格式化，不換算）");
ok(NAV.liveOf(NAV.STEPS[3]).text === "CAUTION", "④ 導覽列顯示 Decision Engine 的判定");
global.self.CaseBus = Object.assign({}, B, { activeRecord: () => 空rec });
ok(NAV.liveOf(NAV.STEPS[0]).na === true, "取不到就標 na（顯示「—」），不猜一個數字");
global.self.CaseBus = undefined;
ok(NAV.liveOf(NAV.STEPS[0]) === null, "case-bus 未載入→退回純導覽，不擋頁");

// ── 8. 原始碼紀律掃描：本層不得出現輸出公式 ─────────────────────
const 去註解 = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const 禁用 = [
  [/總銷\s*[*/]/, "不得計算總銷"],
  [/共同?負擔\s*[*/]/, "不得計算共同負擔"],
  [/報酬率\s*=/, "不得計算報酬率"],
  [/允建容積\s*=/, "不得計算允建容積"],
  [/容積餘量\s*=/, "不得計算容積餘量"],
  [/\bIRR\b/i, "不得出現 IRR"]
];
禁用.forEach(([re, msg]) => ok(!re.test(去註解), "紀律掃描：" + msg));
// 唯一允許的算術＝組輸入（樓板／車位數等），且必須可被使用者覆寫
ok(/標準樓板/.test(src) && B.ADVANCED.some(f => f.k === "標準樓板"),
   "推得的預設樓板必須是可覆寫欄位——否則就從『預設輸入』變成『替使用者決定』");

console.log(`\n起始介面／四步連動 headless：${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
