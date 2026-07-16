// tests/web/test_workspace.mjs — WORKSPACE C2 headless（Gate 7）
// 抽 /*WORKLOGIC-BEGIN*/../*WORKLOGIC-END*/ 在 node eval（零 DOM）。import-to-create 轉換不變式＋SSOT 稽核。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const html = readFileSync(join(root, "apps/web/workspace.html"), "utf8");
const m = html.match(/\/\*WORKLOGIC-BEGIN\*\/([\s\S]*?)\/\*WORKLOGIC-END\*\//);
if (!m) { console.error("❌ 找不到 WORKLOGIC 區塊"); process.exit(1); }
const src = m[1];
const WL = new Function(src + "; return WORKLOGIC;")();
const v21 = JSON.parse(readFileSync(join(root, "schemas/examples/v2/v2_1_案例D_權變示範.json"), "utf8"));

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.error("❌", n); } };

// ── 1. import-to-create 轉換不變式 ──
const wf = WL.importV21ToWorkflow(v21);
ok(wf.schema_version === "wf-1.0", "產出 wf-1.0");
ok(wf.project.project_id.startsWith("prj-") && wf.project.project_id.length >= 8, "project_id 前綴＋派生自 input_hash");
ok(wf.project.stage === "S1", "新案件 stage=S1");
ok(wf.stakeholders.length === v21.input.owners.length, "stakeholders 數＝owners 數");
ok(wf.stakeholders.every(s => s.role === "owner" && s.stakeholder_id), "stakeholder 皆 owner 角色＋有代號");
ok(wf.project.snapshots.length === 1 && wf.project.snapshots[0].input_hash === v21.provenance.input_hash, "snapshot 保留 input_hash 引用");
ok(wf.project.active_snapshot === "snap-01", "active_snapshot 指向 snap-01");
ok(wf.consent_events.length === 0 && wf.tasks.length === 0 && wf.decisions.length === 0, "C2：事件/任務/決策為空（C3–C4）");

// ── 2. 決定性：同輸入→同 project_id ──
ok(WL.importV21ToWorkflow(v21).project.project_id === wf.project.project_id, "轉換決定性（同輸入同 project_id）");

// ── 3. displaySnapshot 逐欄複製既有 result（零計算）──
const snap = WL.displaySnapshot(v21);
ok(snap.shared_cost_ratio === v21.result.shared_cost_ratio, "共負比＝逐欄複製 result（未運算）");
ok(snap.return_rate === v21.result.return_rate, "投報率＝逐欄複製 result（未運算）");
ok(snap.agreed === v21.input.owners.filter(o => o.consent === "agreed").length, "同意數＝計數（非公式）");
ok(snap.threshold === (v21.project.case_type === "danger_building" ? 1.0 : 0.75), "門檻＝法規常數");

// ── 4. 壞輸入不臆造 ──
let threw = false; try { WL.importV21ToWorkflow({schema_version:"2.0"}); } catch(e){ threw = true; }
ok(threw, "非 v2.1 輸入→拋錯不臆造");
threw = false; try { WL.importV21ToWorkflow({schema_version:"2.1", project:{}}); } catch(e){ threw = true; }
ok(threw, "缺 provenance.input_hash→拋錯");

// ── 5. SSOT 稽核：WORKLOGIC 原始碼對 result 欄位零四則運算 ──
// 允許：屬性存取、逐欄複製、計數(filter/length)、比較。禁止：對 result 數值做 + - * / 運算後輸出。
const 財務欄 = ["shared_cost_ratio","return_rate","owner_return_value","total_sales","shared_cost","owner_return_ratio"];
const 違規 = 財務欄.some(f => new RegExp("\\b" + f + "\\b\\s*[*/+\\-]").test(src) ||
                            new RegExp("[*/+\\-]\\s*[a-zA-Z0-9_.]*\\b" + f + "\\b").test(src));
ok(!違規, "WORKLOGIC 對 result 財務欄位零四則運算（SSOT）");

console.log(`\nWORKSPACE C2 headless：${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
