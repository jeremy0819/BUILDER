// Shared four-step UI, Decision relationship view and Local-first land information.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
let pass = 0, fail = 0;
const ok = (condition, name) => {
  if (condition) pass++;
  else { fail++; console.error("FAIL", name); }
};

global.self = {};
const decisionSrc = readFileSync(join(root, "apps/web/decision-view.js"), "utf8");
new Function("self", "module", decisionSrc)(global.self, { exports: {} });
const D = global.self.DecisionView;

const rec = {
  view: {
    allow_floor_area: 3900, used_floor_area: 3600, remaining_floor_area: 300,
    saleable_area: 1880.5, shared_cost_ratio: 0.41, owner_return_ratio: 0.59, return_rate: 0.72
  },
  snap: {
    agreed: 18, total: 30, threshold: 0.8,
    input_hash: "sha256:" + "a".repeat(64), core_version: "0.6.0"
  },
  decision: {
    verdict: "CAUTION", completion_probability: 0.42, decision_urgency: 0.61,
    breakpoint_stakeholder: "W07", decision_engine_version: "0.2.0"
  }
};
const model = D.buildModel(rec);
ok(model.nodes.map(n => n.id).join(",") === "site,product,people,decision", "四個節點順序固定");
ok(model.nodes[0].primary.value === rec.view.remaining_floor_area, "量體值逐欄取自 Core view");
ok(model.nodes[1].primary.value === rec.view.return_rate, "財務值逐欄取自 Core view");
ok(model.nodes[2].primary.value[0] === rec.snap.agreed && model.nodes[2].primary.value[1] === rec.snap.total,
   "人心節點保留 agreed/total 原值，不在 model 計算同意率");
ok(model.nodes[3].primary.value === rec.decision.verdict, "判定逐欄取自 Decision Engine");
ok(model.center.completion_probability === rec.decision.completion_probability, "完工機率 verbatim");
ok(model.provenance.input_hash === rec.snap.input_hash && model.provenance.core_version === rec.snap.core_version,
   "關聯圖攜帶 Core 溯源二元組");
ok(D.format({ value: null, unit: "ratio" }) === "—", "缺值顯示破折號，不補 0");
ok(D.format({ value: [18, 30], unit: "fraction" }) === "18/30 戶", "戶數只做文字格式化");

const empty = D.buildModel({ view: {}, snap: {} });
ok(empty.center.value === "待判讀" && empty.nodes[3].primary.value === null, "無 decision 時明示待判讀");
ok(!/dragstart|dragover|drop|draggable\s*=|contenteditable/i.test(decisionSrc), "Decision 圖不可拖曳或編輯");
ok(!/fetch\s*\(|XMLHttpRequest|WebSocket/.test(decisionSrc), "Decision 圖不向外傳送案件資料");

global.self = {};
const landSrc = readFileSync(join(root, "apps/web/land-information.js"), "utf8");
new Function("self", "module", landSrc)(global.self, { exports: {} });
const L = global.self.LandInformation;
const landRec = {
  roster: [{
    "土地編號": "L-A", "地段": "合成區", "地號": "X-A", "地上建物建號": "B-A",
    "土地面積_㎡": 123.4, "土地所有權人": "W-A"
  }],
  assets: { cadastral: "data:image/png;base64,x" }
};
const land = L.buildModel(landRec);
ok(land.rows.length === 1 && land.rows[0].land_area_sqm === 123.4, "地政模型逐欄搬運清冊資料");
ok(land.attachments.cadastral === true && land.attachments.zoning === false, "附件狀態只看存在事實");
ok(L.SERVICES.length === 4 && L.SERVICES.every(s => /^https:\/\//.test(s.url)), "官方服務均使用 HTTPS");
ok(L.SERVICES.every(s => !/[?&](parcel|lot|address|owner)=/i.test(s.url)), "官方入口不夾帶案件查詢參數");
ok(!/fetch\s*\(|XMLHttpRequest|WebSocket/.test(landSrc), "地政面板不傳送本機清冊");
ok(L.render({ roster: [{ "土地編號": "<x>" }] }).includes("&lt;x&gt;"), "地政欄位輸出經 HTML escape");

const pages = ["dashboard.html", "evaluator.html", "os-simulator.html", "report.html"];
pages.forEach(page => {
  const html = readFileSync(join(root, "apps/web", page), "utf8");
  ok(html.includes('href="os-unified.css"'), page + " 載入共用樣式");
  ok(html.includes('src="os-shell.js"'), page + " 載入共用案件列");
});
const dashboard = readFileSync(join(root, "apps/web/dashboard.html"), "utf8");
const report = readFileSync(join(root, "apps/web/report.html"), "utf8");
ok(dashboard.includes('src="land-information.js"') && dashboard.includes("LandInformation.render(rec)"),
   "基地頁接上地政資訊模組");
ok(report.includes('src="decision-view.js"') && report.includes("DecisionView.mount"),
   "決策頁接上互動關聯圖");
const shell = readFileSync(join(root, "apps/web/os-shell.js"), "utf8");
ok(shell.includes('aria-selected=') && !shell.includes('aria-pressed='),
   "產品視圖使用標準 tab 選中狀態");

console.log(`\nUNIFIED UI / DECISION / LAND：${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
