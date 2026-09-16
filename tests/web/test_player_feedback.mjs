import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = file => readFileSync(new URL("../../" + file, import.meta.url), "utf8");
const values = new Map(), storage = { getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,String(v)), removeItem: k => values.delete(k), key: i => [...values.keys()][i], get length(){return values.size;} };
const root = {}, doc = { readyState: "loading", addEventListener(){} };
new Function("self", read("apps/web/security.js"))(root);
new Function("self","localStorage", read("apps/web/case-drafts.js"))(root,storage);
new Function("self","document","localStorage",read("apps/web/browser-backup.js"))(root,doc,storage);
let count=0;
function test(name,fn){fn();count++;console.log("PASS",name);}
const D=root.CaseDrafts, B=root.BrowserBackup;
test("intent isolated by project",()=>{D.set("A","intent","alpha");D.set("B","intent","beta");assert.equal(D.get("A","intent"),"alpha");assert.equal(D.get("B","intent"),"beta");});
test("visited flags isolated",()=>{D.set("A","site_visited",true);assert.equal(D.get("B","site_visited"),undefined);});
test("global intent retained, never silently adopted",()=>{storage.setItem("uros.intent","legacy");assert.equal(D.legacyIntent(),"legacy");assert.equal(D.get("C","intent"),undefined);});
test("draft version enforced",()=>{storage.setItem("uros.case-drafts.v1.X",JSON.stringify({version:2,project_id:"X",values:{}}));assert.throws(()=>D.read("X"));});
test("draft project binding enforced",()=>{storage.setItem("uros.case-drafts.v1.X",JSON.stringify({version:1,project_id:"Y",values:{}}));assert.throws(()=>D.read("X"));});
test("inference fields cannot be saved as drafts",()=>{D.set("A","verdict","GO");assert.equal(D.get("A","verdict"),undefined);});
const now=Date.parse("2026-09-10T00:00:00Z");
for(const value of [null,"invalid","2027-01-01"]){test("invalid backup timestamp remains due: "+value,()=>assert.equal(B.statusText(value,now).due,true));}
test("seven-day threshold inclusive",()=>assert.equal(B.statusText("2026-09-03T00:00:00Z",now).due,true));
test("recent backup not overdue",()=>assert.equal(B.statusText("2026-09-09T00:00:00Z",now).due,false));
const envelope={format:"uros-browser-backup",version:1,local_storage:{"uros.theme":"light"},idb:{format:"uros-backup",version:1,cases:[],activity:[],meta:[]}};
test("versioned empty backup valid",()=>assert.equal(B.validate(envelope),envelope));
test("unknown backup version refused",()=>assert.throws(()=>B.validate({...envelope,version:2})));
test("non-app storage keys refused",()=>assert.throws(()=>B.validate({...envelope,local_storage:{token:"secret"}})));
test("duplicate event keys refused",()=>assert.throws(()=>B.validate({...envelope,idb:{...envelope.idb,activity:[{key:1},{key:1}]}})));
test("missing case index refused",()=>assert.throws(()=>B.validate({...envelope,local_storage:{"uros.workflow.v1":JSON.stringify({order:["missing"],projects:{}})}})));
test("all six entry surfaces expose backup and calibration",()=>{for(const file of ["index","dashboard","evaluator","os-simulator","report","workspace"]){const s=read("apps/web/"+file+".html");assert.ok(s.includes('src="browser-backup.js"'));assert.ok(s.includes('src="calibration-data.js"'));}});
new Function("self","module",read("apps/web/case-bus.js"))(root,{exports:{}});
test("owner cap explicitly reported and original roster retained",()=>{const rec={wf:{project:{project_id:"A"},stakeholders:Array.from({length:81},(_,i)=>({role:"owner",stakeholder_id:"O"+i}))},snap:{total:81}};const bridge=root.CaseBus.buildSandboxBridge(rec);assert.equal(bridge.owners,null);assert.equal(bridge.owners_count,81);assert.match(bridge.owners_notice,/81.*80/);assert.equal(rec.wf.stakeholders.length,81);});
test("runtime same-origin first and only 404 falls back",()=>{const s=read("apps/web/core-runtime.worker.js");assert.match(s,/let base = LOCAL/);assert.match(s,/probe.status === 404/);assert.match(s,/indexURL: base/);});
test("no premature backup stamp",()=>{const s=read("apps/web/browser-backup.js");assert.match(s,/await stream.close\(\); await confirmed\(\)/);assert.ok(!read("apps/web/dashboard.html").includes("CS.markBackedUp()"));});
test("single manual creation surface",()=>assert.ok(!read("apps/web/dashboard.html").includes("function submitNewCase")));
root.addEventListener=()=>{};
new Function("self","localStorage",read("apps/web/local-diagnostics.js"))(root,storage);
test("diagnostics bounded to fifty events",()=>{for(let i=0;i<60;i++)root.UROSDiagnostics.record('core-unavailable');assert.equal(root.UROSDiagnostics.read().length,50);});
test("diagnostics reject arbitrary messages",()=>{root.UROSDiagnostics.record('private case input');assert.ok(root.UROSDiagnostics.read().every(e=>Object.keys(e).sort().join(',')==='at,code'));});
test("diagnostics never call a remote service",()=>assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|WebSocket/.test(read('apps/web/local-diagnostics.js'))));

/* ── 介面語言的收斂規則（2026-09 遊玩回饋）─────────────────────────────
   下面六條不是在複述程式碼，而是把幾個「已經踩過」的決定釘住：
     · 提醒不准偷首屏（自動展開＝換一種方式吃掉結論的位置）
     · 免責聲明不准掛進量不到高度的容器（看不見的但書比放錯位置更糟）
     · 同一個意思只准一個顏色、一個名字、一個單位
   任何一條被改回去，這裡就會紅。 */

test("backup banner never auto-expands", () => {
  const s = read("apps/web/browser-backup.js");
  assert.ok(!/\.open\s*=\s*true/.test(s), "備份列不得自行展開——提醒的位置不能比結論前面");
});

test("calibration notice verifies it landed somewhere visible", () => {
  const s = read("apps/web/calibration-notice.js");
  assert.match(s, /getBoundingClientRect\(\)\.height < 1/);
  assert.match(s, /document\.body\.prepend\(notice\)/);
});

test("actionable strip precedes the caveat strip", () => {
  assert.match(read("apps/web/browser-backup.js"), /calib\.before\(host\)/);
});

test("one semantic palette across every surface", () => {
  const unified = read("apps/web/os-unified.css");
  const allowed = {};
  for (const name of ["ok", "warn", "err", "info"]) {
    const found = [...unified.matchAll(new RegExp("--uros-" + name + ":(#[0-9a-f]{6})", "gi"))]
      .map(m => m[1].toLowerCase());
    assert.ok(found.length >= 2, "os-unified 應同時定義 " + name + " 的明暗兩值");
    allowed[name] = new Set(found);
  }
  for (const file of ["index", "dashboard", "evaluator", "os-simulator", "report", "workspace"]) {
    const s = read("apps/web/" + file + ".html");
    for (const name of ["ok", "warn", "err", "info"]) {
      for (const m of s.matchAll(new RegExp("--" + name + ": *(#[0-9a-f]{3,8})", "gi"))) {
        assert.ok(allowed[name].has(m[1].toLowerCase()),
          file + ".html \u7684 --" + name + " \u7528\u4e86 " + m[1] +
          "\uff0c\u8207 os-unified \u7684 " + [...allowed[name]].join("/") + " \u4e0d\u540c\u2014\u2014\u540c\u4e00\u500b\u610f\u601d\u53ea\u80fd\u6709\u4e00\u500b\u984f\u8272");
      }
    }
  }
});

test("no fourth source vocabulary", () => {
  const nav = read("apps/web/stepnav.js");
  const decl = /var SOURCE_NAME = \{([^}]*)\}/.exec(nav);
  assert.ok(decl, "stepnav 必須宣告 SOURCE_NAME");
  const names = new Set([...decl[1].matchAll(/"([^"]+)"/g)].map(m => m[1]));
  assert.equal(names.size, 3);
  for (const m of read("apps/web/decision-view.js").matchAll(/source: "([^"]+)"/g))
    assert.ok(names.has(m[1]),
      "decision-view \u7684\u4f86\u6e90\u540d\u7a31 " + m[1] + " \u4e0d\u5728\u5716\u4f8b\u7684\u4e09\u7a2e\u88e1\uff1a" + [...names].join("\u3001"));
  // 圖例本身也必須是從 SOURCE_NAME 讀，不得另寫一套簡稱
  assert.match(nav, /SOURCE_NAME\.core/);
  assert.ok(!/<\/i>Core</.test(nav), "圖例不得硬寫 \"Core\"");
});

test("floor area ratio shown as a percentage everywhere", () => {
  const s = read("apps/web/dashboard.html");
  assert.match(s, /\{k:"\u5bb9\u7a4d\u7387"[^}]*pct:1/, "儀表板滑桿的容積率必須與其他頁一樣顯示百分比");
  assert.ok(!/<span>\u5bb9\u7a4d\u7387<\/span><b>\$\{st\.far/.test(s), "案件資訊卡的容積率不得直接輸出比值");
});

console.log(`PLAYER FEEDBACK: ${count} passed`);
