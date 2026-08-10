// tests/web/test_attribution_wiring.mjs — M7.4 Slice C 接線紀律（Gate 15）
// 依 M7_4_ATTRIBUTION_VISUAL_PLAN §6「Web and worker tests」：
//   · workspace 逐欄 verbatim 呈現 Core 回應，不自行算 delta／貢獻／殘差
//   · 選擇器變更會使前次報告失效（stale），不得沿用
//   · 送出的是**完整 before/after engine**，不得送 diff 或 UI 自算值
//   · unsupported／error／OAT／零變更 狀態都有可見說明文字
//   · 歸因結果不得寫入 CaseStore（putCase／append／scenario 持久化）
//   · core 不可用時不得退回 JS 自算
// 執行：node tests/web/test_attribution_wiring.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
let pass = 0, fail = 0;
const ok = (c, n) => { if (c) { pass++; } else { fail++; console.error("❌", n); } };

const ws = readFileSync(join(root, "apps/web/workspace.html"), "utf8");
const rt = readFileSync(join(root, "apps/web/core-runtime.js"), "utf8");
const wk = readFileSync(join(root, "apps/web/core-runtime.worker.js"), "utf8");

// 只掃程式碼（註解在講紀律，不算違規）
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const wsCode = strip(ws);

// ── 接線存在 ────────────────────────────────────────────────
ok(/<script src="core-runtime\.js"><\/script>/.test(ws), "workspace 載入 core-runtime");
ok(/<script src="case-store\.js"><\/script>/.test(ws), "workspace 載入 case-store（方案來源）");
ok(/data-t="attr"/.test(ws), "有『歸因比較』分頁");
ok(/attr:renderAttribution/.test(ws), "分頁綁定 renderAttribution");
ok(/function renderAttribution/.test(ws), "renderAttribution 已定義");

// ── Worker／runtime 傳輸層 ──────────────────────────────────
ok(/attribute: function \(before, after/.test(rt), "runtime 暴露 attribute(before, after, …)");
ok(/type: "attribute"/.test(rt), "runtime 送出 attribute 訊息");
ok(/m\.type === "attribute"/.test(wk), "worker 有 attribute handler");
ok(/_redcf_attribute_safe/.test(wk), "worker 用拒答信封保住 reason_code/paths");
ok(/reason_code/.test(wk) && /'paths'/.test(wk), "拒答信封帶 reason_code 與 paths");
ok(/_redcf\.attribute\(/.test(wk), "worker 直接呼叫 Core attribute");

// ── 送出的是完整 engine，不是 diff／UI 自算值 ───────────────
ok(/rt\.attribute\(b\.engine, c\.engine/.test(wsCode), "送出兩份完整 engine");
ok(!/diff|delta\s*=|impact\s*=\s*[^=]/.test(
     wsCode.split("function runAttr")[1] || ""), "runAttr 不自行組 diff 或算 delta");

// ── UI 零計算：不得自行推導任何歸因數值 ─────────────────────
// 只掃**歸因區塊**——workspace 他處（進度條、完工機率）本來就有百分比換算，
// 那是既有呈現，不在本 Gate 管轄範圍。
const ATTR_START = wsCode.indexOf("var ATTR =");
const ATTR_END = wsCode.indexOf("function renderMassing");
ok(ATTR_START > 0 && ATTR_END > ATTR_START, "定位到歸因區塊");
const attrBlock = wsCode.slice(ATTR_START, ATTR_END);

const forbidden = [
  [/\.impact\s*[+\-*/]=/, "不得就地修改 impact"],
  [/residual\s*=\s*[^=;]*[-+]/, "不得自算 residual"],
  [/reduce\(\s*function[^)]*impact/, "不得自行加總 impact"],
  [/after\.value\s*-\s*before\.value/, "不得自算 delta"],
  [/\*\s*100/, "不得自行換算 ppt（presentation 由 Core 產出）"],
  [/Math\.(abs|round)\([^)]*impact/, "不得對 impact 再加工"],
];
forbidden.forEach(([re, msg]) => ok(!re.test(attrBlock), msg));
ok(/r\.presentation/.test(wsCode) || /const p=r\.presentation/.test(wsCode),
   "顯示值取自 Core 的 presentation 區塊");
ok(/p\.delta|p\.residual|p\.contributions/.test(wsCode), "逐欄讀 presentation 欄位");
ok(/r\.conservation\.raw_ok/.test(wsCode), "守恆旗標讀 Core，不自判");
ok(/m\.runs/.test(wsCode) && /m\.feature_count/.test(wsCode), "重算次數與特徵數由 Core 回報");
ok(/m\.exact/.test(wsCode), "精確／近似由 Core 的 method.exact 決定");

// ── 選擇器變更 → 前次報告失效 ───────────────────────────────
ok(/ATTR\.report=null;\s*ATTR\.stale=true/.test(wsCode.replace(/\s+/g, m => m.includes("\n") ? "\n" : " "))
   || /ATTR\.report=null; ATTR\.stale=true/.test(wsCode),
   "改選擇器即清空報告並標記 stale");
ok(/方案已變更，請按「計算歸因」重新執行/.test(ws), "stale 有可見說明");

// ── 必要狀態都有可見文字 ────────────────────────────────────
ok(/Core 正在執行反事實重算/.test(ws), "computing 狀態有文字");
ok(/OAT 近似/.test(ws), "OAT 近似有標示");
ok(/Shapley 精確/.test(ws), "Shapley 精確有標示");
ok(/這組比較不在首版歸因範圍/.test(ws), "unsupported 狀態有文字");
ok(/計算核心無法載入/.test(ws), "core 不可用有文字");
ok(/歸因需要.*兩個完整方案|至少|兩個完整方案/.test(ws), "方案不足有文字");
ok(/交互作用（殘差）/.test(ws), "殘差列有標籤且與貢獻同表（不藏）");
ok(/顯示進位對帳/.test(ws), "進位對帳獨立成列");
ok(/rounding_reconciliation/.test(wsCode), "進位對帳讀 Core 欄位");

// 殘差不得被合併進其他數值
ok(!/residual\s*\+\s*rounding_reconciliation/.test(wsCode),
   "進位對帳不得被加進殘差（不可偽裝成交互作用）");

// ── 誠實揭露 ────────────────────────────────────────────────
ok(/非 IRR|<b>非 IRR<\/b>/.test(ws), "明示非 IRR");
ok(/ppt/.test(ws), "差異單位標為 ppt");
ok(/不是變更時序/.test(ws), "說明排序非時序（Shapley 順序無關）");
ok(/以 Core \$\{esc\(r\.core_version\)\} 重播/.test(ws) || /重播/.test(ws),
   "標明是以現行 Core 重播，非原始日期所見數字");
ok(/不以「其他」項吸收差額/.test(ws), "明示不以『其他』吸收差額");

// ── 不得寫回 CaseStore ──────────────────────────────────────
ok(attrBlock.length > 500, "取到歸因區塊");
["putCase", "append(", "addScenario", "setAuthoritative", "importAll", "meta("]
  .forEach(w => ok(!attrBlock.includes(w), `歸因區塊不得呼叫 CaseStore.${w}`));
ok(/CaseStore\.listScenarios/.test(attrBlock), "只讀取方案清單（唯讀）");

// ── 不得退回 JS 自算 ────────────────────────────────────────
ok(/不會退回瀏覽器自算|不得退回|不會退回/.test(ws), "core 不可用時明示不退回自算");
ok(!/function\s+jsAttribute|fallbackAttribute/.test(wsCode), "無 JS 版歸因退路");

console.log(`\nM7.4 ATTRIBUTION WIRING headless：${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
