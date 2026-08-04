// tests/web/test_activity_wiring.mjs — M7.1 接 UI（Gate 12）
// ============================================================================
// 抽 dashboard.html 的 /*ACTLOGIC-BEGIN*/../*ACTLOGIC-END*/ 在 node eval（零 DOM），
// 驗證「編輯自動留下紀錄」這條線上的**紀律**——不是驗 UI 長相，是驗寫進去的東西：
//
//   §1 只記事實與意圖，不記推論  ← 任何 builder 都不得吐出 EV/verdict/投報率/坪效
//   §3 合約：kind / target.type 必須落在 activity.schema.v0.1 的 enum 內
//   §5 匯出文件必須能通過 activity.schema.v0.1（含 additionalProperties:false）
//   ＋ 三個接點（改清冊／拉滑桿／建案件）各自的 before/after 語意
//
// 為什麼要有這一關：assertNoInference 擋的是「欄位名叫 verdict」，
// 擋不住「有人把投報率塞進 after」。本關從產生端斷言，兩層一起才守得住。
// 執行：node tests/web/test_activity_wiring.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const html = readFileSync(join(root, "apps/web/dashboard.html"), "utf8");
const m = html.match(/\/\*ACTLOGIC-BEGIN\*\/([\s\S]*?)\/\*ACTLOGIC-END\*\//);
if (!m) { console.error("❌ 找不到 ACTLOGIC 區塊"); process.exit(1); }
const AL = new Function(m[1] + "; return ACTLOGIC;")();
const schema = JSON.parse(readFileSync(join(root, "schemas/activity.schema.v0.1.json"), "utf8"));
const EV = schema.$defs.event;

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.error("❌", n); } };

// ── 0. 前端黑名單必須涵蓋 case-store.js 的黑名單（兩層不得漂移）──
const csSrc = readFileSync(join(root, "apps/web/case-store.js"), "utf8");
const csKeys = (csSrc.match(/var INFERENCE_KEYS = \[([\s\S]*?)\];/)[1].match(/"([^"]+)"/g) || [])
  .map(s => s.replace(/"/g, ""));
ok(csKeys.length > 0, "讀得到 case-store 的推論黑名單");
ok(csKeys.every(k => AL.INFERENCE.includes(k)),
   "ACTLOGIC 黑名單涵蓋 case-store 黑名單（不得漂移出破口）");

// ── 1. 合約：kind / target.type 落在 schema enum 內 ──
const kindEnum = EV.properties.kind.enum;
const targetEnum = EV.properties.target.properties.type.enum;
ok(AL.KINDS.every(k => kindEnum.includes(k)) && AL.KINDS.length === kindEnum.length,
   "ACTLOGIC.KINDS 與 schema 的 kind enum 一致");
ok(AL.TARGETS.every(t => targetEnum.includes(t)) && AL.TARGETS.length === targetEnum.length,
   "ACTLOGIC.TARGETS 與 schema 的 target.type enum 一致");

// ── 2. 三個接點各產生一筆事件 ──
const evRoster = AL.rosterEvent("W12", "限制登記", "無", "繼承未辦");
const evAdd    = AL.rosterAddEvent("W41", 40, 41);
const evSlider = AL.productEvent("住宅單價", 92, 96, "drivetrain");
const IH = "sha256:" + "ab".repeat(32);
const evCreate = AL.createEvent("prj-abc12345", {
  案件名稱: "案例E", 基地面積: 1632.04, 人行廣場: 120, 容積率: 3.0, 獎勵率: 0.3,
  容積移轉: 0, 公設比: 0.33, 戶數: 42, 住宅單價: 70, 營造單價: 20,
  // 以下為 engine.params 裡本來就有、但**不該進歷程**的雜項
  梯廳免計基準: 5, 陽台免計基準: 10, 車位單價: 230
}, IH);
const ALL = [evRoster, evAdd, evSlider, evCreate];

ok(evRoster.kind === "roster" && evRoster.target.type === "stakeholder" &&
   evRoster.target.id === "W12", "改清冊 → kind=roster，標的為該地主");
ok(evRoster.before === "無" && evRoster.after === "繼承未辦",
   "改清冊記下 before→after（沒有 before 就無法回答『為什麼變成現在這樣』）");
ok(AL.rosterEvent("W12", "同意與否", undefined, "同意").before === null,
   "缺 before 時明確寫 null（不留 undefined 讓它在 JSON 裡消失）");
ok(evAdd.kind === "roster" && evAdd.before === 40 && evAdd.after === 41, "新增一筆 → 筆數 40→41");
ok(evSlider.kind === "edit" && evSlider.target.type === "product" &&
   evSlider.target.id === "drivetrain", "拉滑桿 → kind=edit，標的標示為傳動軸試算");
ok(evSlider.field === "住宅單價" && evSlider.before === 92 && evSlider.after === 96,
   "拉滑桿記的是**輸入**（單價），不是結果");
ok(evCreate.kind === "create" && evCreate.target.type === "case" &&
   evCreate.after.基地面積 === 1632.04 && evCreate.after.戶數 === 42,
   "建案件 → 整組建案輸入入帳");
ok(evCreate.input_hash === IH, "建案件附 input_hash（可重現）");
ok(!("車位單價" in evCreate.after) && !("梯廳免計基準" in evCreate.after),
   "建案件只收白名單欄位（engine.params 的內部雜項不外洩進歷程）");
ok(!("input_hash" in AL.createEvent("p", {}, "不是雜湊")),
   "input_hash 格式不合就不附（寧缺勿假）");

// ── 3. ★ 鐵律：任何 builder 都不得吐出推論結果 ──
const banned = AL.INFERENCE.map(s => s.toLowerCase());
function scanInference(ev, name) {
  const f = String(ev.field || "").toLowerCase();
  ok(!banned.includes(f), `${name}：field 不是推論欄位`);
  const blob = JSON.stringify(ev).toLowerCase();
  const hit = banned.filter(b => blob.includes('"' + b + '"'));
  ok(hit.length === 0, `${name}：整筆事件不含推論欄位${hit.length ? "（發現 " + hit + "）" : ""}`);
}
ALL.forEach((e, i) => scanInference(e, ["改清冊", "新增清冊列", "拉滑桿", "建案件"][i]));

// 中文推論欄位也要擋在產生端（黑名單是英文 key，中文得靠白名單）
["投報率", "共同負擔比", "允建容積", "銷售坪", "完工機率"].forEach(k => {
  ok(!(k in evCreate.after), `建案件事件不含推論欄位「${k}」`);
});

// ── 4. 匯出文件通過 activity.schema.v0.1（含 additionalProperties:false）──
const rows = ALL.map((e, i) => Object.assign({ key: i + 1, case_id: "prj-abc12345",
  ts: "2026-08-01T09:0" + i + ":00" }, e));
const doc = AL.toDocument("prj-abc12345", rows);
ok(doc.schema_version === "activity-0.1" && doc.activity.length === 4, "匯出 4 筆");
ok(doc.activity.every(e => !("case_id" in e) && !("key" in e)),
   "匯出剝掉 IndexedDB 內部欄位（case_id/key 不在 schema 允許清單內）");
ok(doc.activity[0].event_id === "ev-000001", "key → event_id（單調遞增識別碼）");

let jsonschema = null;
try { jsonschema = (await import("ajv")).default; } catch { }
if (jsonschema) {
  const ajv = new jsonschema({ strict: false });
  const validate = ajv.compile(schema);
  ok(validate(doc), "匯出文件通過 activity.schema.v0.1" +
     (validate.errors ? "：" + JSON.stringify(validate.errors) : ""));
} else {
  // 無 ajv 時退化為手動檢查 schema 最關鍵的三條（不跳過、不假綠）
  const allowed = Object.keys(EV.properties);
  ok(doc.activity.every(e => Object.keys(e).every(k => allowed.includes(k))),
     "（無 ajv）匯出欄位皆在 event 允許清單內");
  ok(doc.activity.every(e => EV.required.every(r => r in e)), "（無 ajv）必填欄位齊全");
  ok(doc.activity.every(e => kindEnum.includes(e.kind)), "（無 ajv）kind 皆合法");
}

// ── 5. 顯示層：物件值攤平，不出現 [object Object] ──
ok(AL.vstr(evCreate.after).includes("基地面積 1632.04"), "整組輸入攤成可讀字串");
ok(!AL.vstr(evCreate.after).includes("[object"), "不出現 [object Object]");
ok(AL.vstr(null) === "—" && AL.vstr(undefined) === "—", "空值顯示為破折號（不臆造）");
ok(AL.vstr(0) === "0", "0 不被當成空值吞掉");

console.log(`\nM7.1 ACTIVITY WIRING headless：${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
