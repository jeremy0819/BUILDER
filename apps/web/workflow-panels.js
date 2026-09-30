/* Shared factual panels for the four-step workspace. No new calculation authority. */
(function(root){
"use strict";
const ROUTES={bench:"os-simulator.html",board:"os-simulator.html",task:"os-simulator.html",dec:"report.html",time:"report.html",attr:"report.html",mass:"dashboard.html",fin:"evaluator.html"};
const LABELS={bench:"整合概況",board:"同意看板",task:"時程任務",dec:"決策紀錄",time:"時間軸",attr:"歸因比較",mass:"樓層面積示意",fin:"財務快照"};
function route(view){return ROUTES[view] ? ROUTES[view]+"#workflow-"+view : "dashboard.html";}
function mount(host, views){
  let activePid=root.CaseBus.activePid(),view=views[0],epoch=0,disposed=false,writing=false,changed=false;
  host.classList.add("workflow-panels");
  host.innerHTML='<h2>案件紀錄</h2><p class="workflow-context"></p><nav class="workflow-tabs" aria-label="案件紀錄"></nav><p class="workflow-status" role="status"></p><button type="button" class="workflow-refresh" hidden>重新讀取紀錄</button><div class="workflow-pane"></div>';
  const pane=host.querySelector(".workflow-pane"), status=host.querySelector(".workflow-status");
  const $=id=>id==="pane"?pane:host.querySelector("#"+id);
  const shortHash=h=>(h||"").replace(/^sha256:/,"").slice(0,10);
  function loadStore(){return root.CaseBus.readStore();}
  function saveStore(store){
    if(changed || activePid!==root.CaseBus.activePid()) throw Error("案件紀錄已變更，請先重新讀取再儲存。");
    writing=true;
    try{root.CaseBus.writeStore(store);status.textContent="已儲存於此瀏覽器";}
    finally{writing=false;}
  }
  function safe(action){
    const handler=function(event){try{action(event);bindActions();}catch(e){status.textContent="未儲存："+(e.message||e);}};
    handler.workflowSafe=true;return handler;
  }
  function bindActions(){
    pane.querySelectorAll("button").forEach(b=>{if(b.onclick && !b.onclick.workflowSafe)b.onclick=safe(b.onclick);});
    pane.querySelectorAll("input,select").forEach(el=>{if(!el.getAttribute("aria-label"))el.setAttribute("aria-label",el.placeholder||({tstage:"任務階段",atBase:"基準方案",atCmp:"對照方案"}[el.id])||"接觸事件");});
  }
var ATTR = { rt:null, pid:"", coreReady:false, scenarios:[], base:"", cmp:"", report:null, stale:false, busy:false, err:null };

function attrRuntime(){
  if(!ATTR.rt && window.createCoreRuntime){
    ATTR.rt = window.createCoreRuntime({
      onReady:function(){ ATTR.coreReady=true; ATTR.err=null; if(ATTR.pid) paintAttr(ATTR.pid); },
      onError:function(){ ATTR.coreReady=false; ATTR.err="core-unavailable"; if(ATTR.pid) paintAttr(ATTR.pid); }
    });
  }
  return ATTR.rt;
}
function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){
  return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }

function renderAttribution(pid){
  ATTR.pid=pid;
  const ticket=epoch;
  const pane=$("pane");
  pane.innerHTML=`<div class="at-wrap"><div class="wip">讀取方案中…</div></div>`;
  if(!window.CaseStore){ pane.innerHTML=`<div class="wip">方案儲存層未載入。</div>`; return; }
  CaseStore.listScenarios(pid).then(function(list){
    if(ticket!==epoch || view!=="attr" || pid!==activePid) return;
    ATTR.scenarios = list||[];
    if(ATTR.scenarios.length<2){
      pane.innerHTML=`<div class="at-wrap"><h4>歸因比較</h4>
        <div class="wip">此案目前有 <b>${ATTR.scenarios.length}</b> 個方案——
        歸因需要<b>兩個完整方案</b>才能比較。請先在多方案管理建立對照方案。<br>
        <span class="at-note">只有攜帶完整 input set 的方案可被選取；僅有 input_hash 的歷史快照無法重播。</span></div></div>`;
      return;
    }
    if(!ATTR.base) ATTR.base = (ATTR.scenarios.find(s=>s.authoritative)||ATTR.scenarios[0]).scenario_id;
    if(!ATTR.cmp)  ATTR.cmp  = (ATTR.scenarios.find(s=>s.scenario_id!==ATTR.base)||{}).scenario_id||"";
    attrRuntime();
    paintAttr(pid);
  }).catch(function(e){ if(ticket!==epoch || view!=="attr") return; pane.innerHTML=`<div class="wip">讀取方案失敗：${esc(e.message||e)}</div>`; });
}

function scOpt(sel){
  return ATTR.scenarios.map(s=>`<option value="${esc(s.scenario_id)}"${s.scenario_id===sel?" selected":""}>`
    + `${esc(s.name)}${s.authoritative?"（作準）":""}</option>`).join("");
}
function scMeta(id){
  const s=ATTR.scenarios.find(x=>x.scenario_id===id); if(!s) return "";
  return `<div class="at-meta mono">${s.authoritative?"作準":"試算中"} · ${esc(s.scenario_id)} · ${esc((s.input_hash||"").slice(0,17))}…</div>`;
}

function paintAttr(pid){
  if(disposed || view!=="attr" || pid!==activePid) return;
  const pane=$("pane");
  const same = ATTR.base===ATTR.cmp;
  pane.innerHTML=`<div class="at-wrap">
    <div class="at-head"><h4>歸因比較</h4>
      <span class="at-note">以同一版 Core 重播兩個完整方案；<b>不修改案件資料</b></span></div>
    <div class="at-pick">
      <div><label class="at-lbl">基準</label><select id="atBase">${scOpt(ATTR.base)}</select>${scMeta(ATTR.base)}</div>
      <div class="at-arrow">→</div>
      <div><label class="at-lbl">對照</label><select id="atCmp">${scOpt(ATTR.cmp)}</select>${scMeta(ATTR.cmp)}</div>
      <button id="atRun" class="at-run"${same||ATTR.busy||!ATTR.coreReady?" disabled":""}>${ATTR.coreReady?"計算歸因":"載入 Core…"}</button>
    </div>
    ${same?`<div class="wip">基準與對照不能是同一個方案。</div>`:""}
    <div id="atBody">${attrBodyHTML()}</div></div>`;

  $("atBase").onchange=e=>{ epoch++; ATTR.busy=false; ATTR.unsupported=null; ATTR.base=e.target.value; ATTR.report=null; ATTR.stale=true; ATTR.err=null; paintAttr(pid); };
  $("atCmp").onchange =e=>{ epoch++; ATTR.busy=false; ATTR.unsupported=null; ATTR.cmp =e.target.value; ATTR.report=null; ATTR.stale=true; ATTR.err=null; paintAttr(pid); };
  const btn=$("atRun"); if(btn) btn.onclick=()=>runAttr(pid);
  if(ATTR.report && window.AttributionWaterfall && window.ChartContracts){
    const contract=ChartContracts.get("attribution-waterfall");
    if(contract) AttributionWaterfall.bind($("atBody"), ATTR.report, contract);
  }
  bindActions();
}

function attrBodyHTML(){
  if(!ATTR.coreReady && !ATTR.err) return `<div class="at-busy"><div class="at-prog"><i></i></div>
    正在載入計算核心…<span class="at-note">完成後才可執行，避免送出過早請求。</span></div>`;
  if(ATTR.busy) return `<div class="at-busy"><div class="at-prog"><i></i></div>
    Core 正在執行反事實重算…<span class="at-note">重算次數由 Core 回報，完成後才顯示</span></div>`;
  if(ATTR.err==="core-unavailable")
    return `<div class="at-err">計算核心無法載入。<b>不會退回瀏覽器自算</b>——請重新整理後再試。</div>`;
  if(ATTR.err) return `<div class="at-err">${esc(ATTR.err)}</div>`;
  if(ATTR.unsupported){
    const u=ATTR.unsupported;
    return `<div class="at-unsup"><b>這組比較不在首版歸因範圍</b>
      <div class="at-paths mono">${u.paths.map(p=>`<span>${esc(p)}</span>`).join("")}</div>
      <p>${esc(u.message)}</p>
      <span class="at-note">原因代碼：${esc(u.reason_code)}。本版<b>不以「其他」項吸收差額</b>——
      說不清楚的因果，不如明確拒答。</span></div>`;
  }
  if(ATTR.stale && !ATTR.report) return `<div class="wip">方案已變更，請按「計算歸因」重新執行。</div>`;
  if(!ATTR.report) return `<div class="wip">選好兩個方案後按「計算歸因」。
    <span class="at-note">精確 Shapley 可能執行上千次 Core 重算，故採<b>明確按鈕</b>而非自動執行。</span></div>`;
  return reportHTML(ATTR.report);
}

/* 逐欄 verbatim 呈現 Core 報告；本函式不做任何算術。 */
function reportHTML(r){
  const p=r.presentation, t=r.target, m=r.method;
  const contract = window.ChartContracts && ChartContracts.get("attribution-waterfall");
  const show = n => window.AttributionWaterfall ? AttributionWaterfall.presentationNumber(n,p.precision) : String(n);
  const signed = n => (n>0?"+":"") + show(n);
  const deltaUnit = contract ? contract.unit_label : "ppt";
  const endpointUnit = contract ? contract.endpoint_unit_label : "%";
  const reportOk = r.conservation.raw_ok && p.display_ok;
  const badge = m.exact
    ? `<span class="at-badge ok">Shapley 精確</span>`
    : `<span class="at-badge warn">OAT 近似</span>`;
  const dirCls = p.delta>0 ? (t.higher_is_better?"up":"down") : (p.delta<0 ? (t.higher_is_better?"down":"up") : "flat");
  const chart = contract && window.AttributionWaterfall
    ? AttributionWaterfall.render(r, contract)
    : `<div class="at-err">歸因圖表契約未載入；不會退回未受治理的圖表。</div>`;
  const hasReconciliation = p.rounding_reconciliation!==0;
  return `<div class="at-sum">
      <div class="at-t">${esc(t.label)} ${badge}</div>
      <div class="at-nums"><span>基準 <b>${show(p.before)}${endpointUnit}</b></span>
        <span class="at-delta ${dirCls}">${signed(p.delta)} ${deltaUnit}</span>
        <span>對照 <b>${show(p.after)}${endpointUnit}</b></span></div>
      <div class="at-note">差異由下列輸入的<b>反事實重算</b>分配；
        排序依 Core 回傳順序，<b>不是變更時序</b>（Shapley 與順序無關）。
        圖中「交互作用（殘差）」與「顯示進位對帳」維持獨立；${hasReconciliation?"本次有非零對帳列。":"本次對帳值為零。"}</div>
    </div>
    ${chart}
    <div class="at-cons ${reportOk?"ok":"bad"}">
      ${reportOk?"守恆與顯示對帳 ✓":"守恆或顯示對帳 ✗"} · Core delta ${signed(p.delta)} ${deltaUnit}</div>
    <div class="src">以 Core ${esc(r.core_version)} 重播（<b>非原始日期所見數字</b>）·
      ${esc(m.resolved)} · ${m.feature_count} 項變更 / ${m.runs} 次重算 ·
      ${esc(r.before.input_hash.slice(0,17))}… → ${esc(r.after.input_hash.slice(0,17))}…<br>
      全案投報率為「利潤÷成本」靜態比率，<b>非 IRR</b>；差異單位為百分點（ppt）。</div>`;
}

function runAttr(pid){
  const ticket=++epoch;
  const rt=attrRuntime();
  if(!rt){ ATTR.err="core-unavailable"; paintAttr(pid); return; }
  if(!rt.ready){ ATTR.err=null; ATTR.coreReady=false; paintAttr(pid); return; }
  const b=ATTR.scenarios.find(s=>s.scenario_id===ATTR.base);
  const c=ATTR.scenarios.find(s=>s.scenario_id===ATTR.cmp);
  if(!b||!c||!b.engine||!c.engine){ ATTR.err="選定方案缺完整 input set，無法重播。"; paintAttr(pid); return; }
  ATTR.busy=true; ATTR.err=null; ATTR.unsupported=null; ATTR.report=null; ATTR.stale=false; paintAttr(pid);
  // 送出**完整 engine**；本層不預先算任何 delta 或貢獻。
  rt.attribute(b.engine, c.engine, "return_rate", "auto").then(function(res){
    if(ticket!==epoch || pid!==activePid || view!=="attr") return;
    ATTR.busy=false;
    if(res.error) ATTR.err=res.error;
    else if(res.unsupported) ATTR.unsupported=res.unsupported;
    else ATTR.report=res.attribution;
    paintAttr(pid);
  }).catch(function(e){ if(ticket!==epoch || view!=="attr") return; ATTR.busy=false; ATTR.err=String(e.message||e); paintAttr(pid); });
}

/* ── M7.5 樓層面積示意：把既有 engine.floors[] 換一種畫法（純呈現、零計算）──
   權威合計只從 Core 取；本頁不加總、不回推容積。 */
function renderMassing(pid){
  const rec=loadStore().projects[pid]; if(!rec) return;
  const floors = rec.engine && Array.isArray(rec.engine.floors) ? rec.engine.floors : null;
  const pane=$("pane");
  if(!floors || !floors.length){
    pane.innerHTML=`<div class="wip">此案未攜帶逐層樓板表（<code>engine.floors</code>）——
      樓層面積示意只畫既有資料，<b>不由其他欄位反推</b>。<br>
      wf bundle 還原的案件請重新匯入對應的 v2.1 檔即可補回。</div>`;
    return;
  }
  const m=MassingView.buildModel(floors);
  const totals=MassingView.totalsFrom(rec.snap && rec.snap.result ? rec.snap.result : null);
  const totalHTML = totals && typeof totals.total_floor_area_sqm==="number"
    ? `<div class="row"><span>總樓地板面積（Core）</span><b>${totals.total_floor_area_sqm.toLocaleString()} m²</b></div>`
    : `<div class="row"><span>總樓地板面積</span><b class="mv-na">—</b></div>`;
  pane.innerHTML=`<div class="mv-wrap">
    <div class="mv-col">
      <h4>樓層面積示意</h4>
      ${MassingView.svg(m)}
      <div class="mv-legend"><span><i class="sw"></i>地上</span><span><i class="sw below"></i>地下</span><span><i class="sw off"></i>停用</span></div>
    </div>
    <div class="mv-col">
      <h4>樓層組成</h4>
      <div class="fin">
        <div class="row"><span>地上／地下／屋突</span><b>${m.aboveGround} / ${m.belowGround} / ${m.rooftop} 層</b></div>
        ${m.disabled?`<div class="row"><span>停用層</span><b>${m.disabled} 層</b></div>`:""}
        ${totalHTML}
      </div>
      <div class="src">長條寬度為<b>樓板面積比例</b>（版面幾何），非容積。
        ${m.counted_far_all_zero?`<br><b style="color:var(--warn)">⚠ 本案逐層「計容積」皆為 0</b>——Core 以面積表彙總值為準（圖說為真），<b>不代表各層不計容積</b>。`:""}
        <br>合計數字只取自 Core result；取不到即顯示「—」，<b>本頁不自行加總</b>。</div>
    </div>
    <div class="mv-col mv-full">
      <h4>逐層明細（原始輸入 verbatim）</h4>
      ${MassingView.table(m)}
    </div></div>`;
}

// ── M5-P2 Developer Board（整合人工作台）：整合率＋風險＋下一步＋戶別接觸——全 verbatim ──
function renderBench(pid){
  const rec=loadStore().projects[pid]; if(!rec) return;
  const {wf,snap}=rec;
  const binding=root.CaseBus.decisionBinds(rec);
  const db=WORKLOGIC.developerBoard(wf, binding.bound?rec.decision:null);
  const 已=db.tally.agreed_unselected+db.tally.agreed_selected;
  const riskHTML=db.risk
    ? `<div class="cw2"><h4>風險 · Decision Engine（verbatim）</h4>
        <div class="fin"><div class="row"><span>判讀</span><b style="color:${{GO:"var(--ok)",CAUTION:"var(--warn)",STOP:"var(--err)"}[db.risk.verdict]}">${esc(db.risk.verdict)}</b></div>
        ${db.risk.breakpoint?`<div class="row"><span>破局引爆點</span><b style="color:var(--err)">${esc(db.risk.breakpoint)}</b></div>`:""}
        <div class="row"><span>完工機率</span><b>${(db.risk.p*100).toFixed(0)}%</b></div>
        <div class="row"><span>急迫度</span><b>${esc(db.risk.urgency)}</b></div>
        ${db.risk.exit_signal?`<div class="row"><span>退場訊號</span><b style="color:var(--err)">EXIT</b></div>`:""}
        <div class="row"><span>健檢 warnings（Core）</span><b>${esc(snap.warnings_n)} 項</b></div></div>
        <div class="src">DE ${esc(db.risk.engine)} · 本頁只呈現 · <b style="color:var(--warn)">⚠ 方向性判斷（stage_tree 存活率未校準）· 非投資結論</b></div></div>`
    : `<div class="cw2"><h4>風險</h4><div class="wip">${esc(root.CaseBus.BIND_NOTE[binding.reason]||"待 Decision Engine 判讀")}。Core 健檢 warnings：${esc(snap.warnings_n)} 項。</div></div>`;
  const nextHTML=db.next.length
    ? db.next.map(t=>`<div class="cw-t"><span class="bid mono">${esc(t.stage)}</span><span style="flex:1">${esc(t.title)}</span><span class="cpill" style="color:${t.status==="doing"?"var(--info)":"var(--mute)"};border-color:currentColor">${t.status==="doing"?"進行":"待辦"}</span></div>`).join("")
    : `<div class="wip">無待辦——到「時程任務」帶入 S1–S11 範本或新增。</div>`;
  const rowsHTML=db.rows.map(r=>`<div class="brow">
      <span class="bid mono">${esc(r.stakeholder_id)}${r.family_group?` <span class="fam">${esc(r.family_group)}</span>`:""}</span>
      <span class="cpill" style="color:${CS_COLOR[r.state]};border-color:${CS_COLOR[r.state]}">${CS_LABEL[r.state]}</span>
      <span class="bev">${r.events_n} 次接觸${r.last_kind?` · 最後 ${esc(EV_LABEL[r.last_kind]||r.last_kind)} ${esc((r.last_ts||"").slice(0,10))}`:""}</span>
      <select class="evk" data-sid="${esc(r.stakeholder_id)}">${EV_KINDS.map(([v,l])=>`<option value="${v}">${l}</option>`).join("")}</select>
      <button class="btn sm" data-sid="${esc(r.stakeholder_id)}">記錄</button>
    </div>`).join("");
  $("pane").innerHTML=`<div class="board">
    <div class="btally">
      <span class="cstat">整合率（重放計數）<b>${已}/${db.total}</b> · 門檻 ${(snap.threshold*100)|0}%</span>
      <span class="cstat">未接觸 <b>${db.tally.untouched}</b></span><span class="cstat">協商中 <b>${db.tally.negotiating}</b></span>
      <span class="cstat">反對 <b>${db.tally.declined}</b></span>
      <span class="cstat" style="margin-left:auto"><a href="report.html">✓ 決策報告</a></span></div>
    <div class="cw2-grid">
      ${riskHTML}
      <div class="cw2"><h4>下一步 · 時程任務（Workflow 事實）</h4>${nextHTML}
        <div class="src">「先談誰」逐型建議＝M6 Strategy Engine，本頁不代為建議。</div></div>
    </div>
    <div class="sgrp" style="margin-top:14px">戶別 · 接觸紀錄（事件重放；記錄即更新）</div>
    <div class="brows">${rowsHTML}</div>
  </div>`;
  $("pane").querySelectorAll(".brow .btn").forEach(btn=>btn.onclick=()=>{
    const sid=btn.dataset.sid, sel=btn.closest(".brow").querySelector(".evk");
    addConsentEvent(pid,sid,sel.value); renderBench(pid);
  });
}
// ── C4 時程任務（事實層：S1–S11 里程碑；狀態＝事實，不推論）──
const TASK_ST=[["todo","待辦"],["doing","進行"],["done","完成"],["blocked","卡住"]];
const TASK_LABEL=Object.fromEntries(TASK_ST); const TASK_COLOR={todo:"var(--mute)",doing:"var(--info)",done:"var(--ok)",blocked:"var(--err)"};
function renderTasks(pid){
  const rec=loadStore().projects[pid]; if(!rec) return; const wf=rec.wf;
  const tasks=wf.tasks||[], tl=WORKLOGIC.taskTally(tasks);
  const tallyHTML=TASK_ST.map(([k,l])=>`<span class="cstat"><i style="background:${TASK_COLOR[k]}"></i>${l} <b>${tl[k]}</b></span>`).join("");
  const rowsHTML=tasks.length?tasks.slice().sort((a,b)=>a.stage.localeCompare(b.stage,undefined,{numeric:true})).map(t=>`<div class="brow">
      <span class="bid mono">${esc(t.stage)}</span><span style="flex:1;font-size:12.5px">${esc(t.title)}</span>
      <button class="cpill tglt" data-tid="${esc(t.task_id)}" style="color:${TASK_COLOR[t.status]};border-color:${TASK_COLOR[t.status]};cursor:pointer">${TASK_LABEL[t.status]}</button>
    </div>`).join(""):`<div class="wip">尚無任務——可帶入 S1–S11 里程碑範本，或手動新增。</div>`;
  $("pane").innerHTML=`<div class="board">
    <div class="btally">${tallyHTML}<span class="cstat" style="margin-left:auto">共 <b>${tasks.length}</b> 項</span></div>
    <div class="tadd">
      <select id="tstage">${Object.keys(WORKLOGIC.STAGE_TITLES).map(s=>`<option value="${s}">${s} ${WORKLOGIC.STAGE_TITLES[s]}</option>`).join("")}</select>
      <input id="ttitle" placeholder="任務標題（事實，不含真實資料）" maxlength="60">
      <button class="btn sm" id="taddbtn">新增</button>
      ${tasks.length?"":'<button class="btn sm ghost" id="tseed">帶入 S1–S11 範本</button>'}
    </div>
    <div class="brows" style="margin-top:12px">${rowsHTML}</div>
    <div class="fin src">狀態＝人工登錄的事實（待辦/進行/完成/卡住），非系統推論。點狀態徽章循環切換。</div>
  </div>`;
  $("taddbtn").onclick=()=>{const t=$("ttitle").value.trim(); if(!t)return; addTask(pid,$("tstage").value,t); renderTasks(pid);};
  const seed=$("tseed"); if(seed) seed.onclick=()=>{seedTasks(pid); renderTasks(pid);};
  $("pane").querySelectorAll(".tglt").forEach(b=>b.onclick=()=>{cycleTask(pid,b.dataset.tid); renderTasks(pid);});
}
function addTask(pid,stage,title){const s=loadStore(),rec=s.projects[pid];if(!rec)return;
  rec.wf.tasks=rec.wf.tasks||[]; rec.wf.tasks.push({task_id:"tk-"+crypto.randomUUID(),stage,title,status:"todo"}); saveStore(s);}
function seedTasks(pid){const s=loadStore(),rec=s.projects[pid];if(!rec)return;
  if((rec.wf.tasks||[]).length) return;
  rec.wf.tasks=WORKLOGIC.stageTemplate().map((t,i)=>({task_id:"tk-seed-"+(i+1),...t})); saveStore(s);}
function cycleTask(pid,tid){const s=loadStore(),rec=s.projects[pid];if(!rec)return;
  const order=["todo","doing","done","blocked"]; const t=(rec.wf.tasks||[]).find(x=>x.task_id===tid); if(!t)return;
  t.status=order[(order.indexOf(t.status)+1)%order.length]; saveStore(s);}
// ── C4 決策日誌（append-only ADR；evidence 釘作準快照指紋，非 GO/CAUTION/STOP）──
function renderDecisions(pid){
  const rec=loadStore().projects[pid]; if(!rec) return; const wf=rec.wf;
  const ds=(wf.decisions||[]).slice().reverse(); const ev=WORKLOGIC.decisionEvidence(wf);
  const listHTML=ds.length?ds.map(d=>`<div class="dcard">
      <div class="dhd"><b>${esc(d.title)}</b><span class="mono">${esc((d.ts||"").slice(0,10))}</span></div>
      ${d.chosen?`<div class="drow"><span>採取</span>${esc(d.chosen)}</div>`:""}
      ${d.rationale?`<div class="drow"><span>理由</span>${esc(d.rationale)}</div>`:""}
      <div class="dev mono">evidence · ${esc(shortHash(d.evidence&&d.evidence.input_hash))}…@${esc(d.evidence&&d.evidence.core_version||"—")}</div>
    </div>`).join(""):`<div class="wip">尚無決策紀錄。這裡記錄 ADR 式決策日誌，自動釘住作準計算快照指紋供回放稽核——<b>非</b> GO/CAUTION/STOP 判斷（判斷屬 Decision Engine · M4）。</div>`;
  $("pane").innerHTML=`<div class="board">
    <div class="dadd">
      <input id="dttl" placeholder="決策標題（如：採限時簽約窗口）" maxlength="60">
      <input id="dchosen" placeholder="採取的方案" maxlength="60">
      <input id="drat" placeholder="理由（可選）" maxlength="120">
      <button class="btn sm" id="daddbtn">記錄決策</button>
    </div>
    <div class="dev mono" style="margin:8px 2px 0">將釘住作準快照：${ev?esc(shortHash(ev.input_hash))+"…@"+esc(ev.core_version):"（無快照）"}</div>
    <div class="dlist">${listHTML}</div>
  </div>`;
  $("daddbtn").onclick=()=>{const t=$("dttl").value.trim(); if(!t)return;
    addDecision(pid,t,$("dchosen").value.trim(),$("drat").value.trim()); renderDecisions(pid);};
}
function addDecision(pid,title,chosen,rationale){const s=loadStore(),rec=s.projects[pid];if(!rec)return;
  rec.wf.decisions=rec.wf.decisions||[];
  const ev=WORKLOGIC.decisionEvidence(rec.wf);
  rec.wf.decisions.push({decision_id:"dc-"+crypto.randomUUID(),ts:new Date().toISOString(),
    title,chosen:chosen||"（未填）",...(rationale?{rationale}:{}),...(ev?{evidence:ev}:{})}); saveStore(s);}
// ── C5 時間軸＋階段推進＋多快照（案件時間序＝事實重放）──
const TL_ICON={stage:"🚩",consent:"🤝",decision:"⚖️"};
function renderTimeline(pid){
  const rec=loadStore().projects[pid]; if(!rec) return; const wf=rec.wf, p=wf.project;
  const tl=WORKLOGIC.caseTimeline(wf), snaps=p.snapshots||[];
  const cur=parseInt((p.stage||"S1").slice(1))||1, canAdv=cur<11;
  const snapHTML=snaps.map(sn=>`<div class="brow"><span class="bid mono">${esc(sn.id)}</span>
      <span style="flex:1;font-size:11.5px" class="mono">${esc(shortHash(sn.input_hash))}…@${esc(sn.core_version)}${sn.id===p.active_snapshot?' <b style="color:var(--accent)">· 作準</b>':''}</span>
      <span class="bev">${esc((sn.computed_at||"").slice(0,10))}</span></div>`).join("");
  const tlHTML=tl.length?tl.slice().reverse().map(it=>`<div class="tlrow"><span class="tlic">${TL_ICON[it.type]||"•"}</span>
      <span class="tlts mono">${esc((it.ts||"").slice(0,10))}</span><span class="tllb">${esc(it.label)}</span></div>`).join(""):`<div class="wip">尚無時間軸事件——推進階段、記錄同意事件或決策後即出現。</div>`;
  $("pane").innerHTML=`<div class="board">
    <div class="btally"><span class="cstat">目前階段 <b>${esc(p.stage)} ${WORKLOGIC.STAGE_TITLES[p.stage]||""}</b></span>
      <button class="btn sm ${canAdv?'':'ghost'}" id="advbtn" ${canAdv?'':'disabled'} style="margin-left:auto">${canAdv?'推進到 S'+(cur+1):'已達 S11'}</button></div>
    <div class="sgrp" style="margin-top:14px">計算快照（多版重評；只存指紋，不複製數字）</div>
    <div class="brows">${snapHTML}</div>
    <div class="sgrp" style="margin-top:14px">案件時間軸（階段／同意／決策，依時序重放）</div>
    <div class="tllist">${tlHTML}</div>
    <div class="fin src">時間軸＝三源事實（stage_history／consent_events／decisions）依 ts 合併——零推論。多份 v2.1 重覆匯入同案＝新增快照版本。</div>
  </div>`;
  const adv=$("advbtn"); if(adv&&canAdv) adv.onclick=()=>{advanceStage(pid); renderTimeline(pid);};
}
function advanceStage(pid){const s=loadStore(),rec=s.projects[pid];if(!rec)return; const p=rec.wf.project;
  const cur=parseInt((p.stage||"S1").slice(1))||1; if(cur>=11)return;
  p.stage="S"+(cur+1); p.stage_history=p.stage_history||[]; p.stage_history.push({stage:p.stage,ts:new Date().toISOString()}); saveStore(s);
  // 同步 detail 頁 spine
  const now=cur; const sts=host.querySelectorAll(".spine .st"); sts.forEach((el,i)=>el.classList.toggle("now",i===Math.min(now,sts.length-1)));}
// ── C3 同意看板（事實層：事件重放推導狀態；不推論、不判斷）──
const CS_LABEL={untouched:"未接觸",contacted:"已接觸",negotiating:"協商中",agreed_unselected:"同意·未選屋",agreed_selected:"同意·已選屋",declined:"反對"};
const CS_COLOR={untouched:"var(--mute)",contacted:"var(--info)",negotiating:"var(--warn)",agreed_unselected:"var(--ok)",agreed_selected:"var(--ok)",declined:"var(--err)"};
const EV_KINDS=[["contacted","接觸"],["visited","拜訪"],["briefed","說明"],["verbal_ok","口頭同意"],["signed","簽署"],["selected_unit","選屋"],["withdrawn","撤回"],["declined","反對"]];
const EV_LABEL=Object.fromEntries(EV_KINDS);
function renderBoard(pid){
  const rec=loadStore().projects[pid]; if(!rec) return;
  const {wf,snap}=rec, bd=WORKLOGIC.consentBoard(wf);
  const tallyHTML=WORKLOGIC.CONSENT_STATES.map(k=>`<span class="cstat"><i style="background:${CS_COLOR[k]}"></i>${CS_LABEL[k]} <b>${bd.tally[k]}</b></span>`).join("");
  const rowsHTML=bd.rows.map(r=>`<div class="brow">
      <span class="bid mono">${esc(r.stakeholder_id)}${r.family_group?` <span class="fam">${esc(r.family_group)}</span>`:""}</span>
      <span class="cpill" style="color:${CS_COLOR[r.state]};border-color:${CS_COLOR[r.state]}">${CS_LABEL[r.state]}</span>
      <span class="bev">${r.events_n} 事件</span>
      <select class="evk" data-sid="${esc(r.stakeholder_id)}">${EV_KINDS.map(([v,l])=>`<option value="${v}">${l}</option>`).join("")}</select>
      <button class="btn sm" data-sid="${esc(r.stakeholder_id)}">記錄</button>
    </div>`).join("");
  $("pane").innerHTML=`<div class="board">
    <div class="btally">${tallyHTML}<span class="cstat" style="margin-left:auto">共 <b>${bd.total}</b> 位地主</span></div>
    <div class="bnote">狀態由 append-only <b>事件重放</b>推導（純邏輯，鏡像 core workflow.py）。此為<b>現場整合事實</b>——與卡片上匯入計算快照的同意計數 ${esc(snap.agreed)}/${esc(snap.total)} 分屬不同層。選屋事件是人工紀錄，不代表已取得可定位的戶別幾何。</div>
    <div class="brows">${rowsHTML||'<div class="wip">此案無 owner 關係人。</div>'}</div>
  </div>`;
  $("pane").querySelectorAll(".brow .btn").forEach(btn=>btn.onclick=()=>{
    const sid=btn.dataset.sid, sel=btn.closest(".brow").querySelector(".evk");
    addConsentEvent(pid,sid,sel.value); renderBoard(pid);
  });
}
function addConsentEvent(pid,sid,kind,note){
  const s=loadStore(), rec=s.projects[pid]; if(!rec) return;
  rec.wf.consent_events=rec.wf.consent_events||[];
  rec.wf.consent_events.push({event_id:"ev-"+crypto.randomUUID(),stakeholder_id:sid,
    ts:new Date().toISOString(),kind,...(note?{note}:{}),by:"local"});
  if(rec.decision){rec.detached_decision=rec.decision;rec.decision=null;}
  saveStore(s);
}

function renderFin(pid){
  const rec=loadStore().projects[pid],snap=rec.snap||{},fmt=v=>v==null?"—":(v*100).toFixed(1)+"%";
  pane.innerHTML='<div class="fin"><div class="row"><span>共同負擔比</span><b>'+fmt(snap.shared_cost_ratio)+'</b></div><div class="row"><span>投報率</span><b>'+fmt(snap.return_rate)+'</b></div></div><p>匯入 Core 快照 · '+esc(shortHash(snap.input_hash))+'…@'+esc(snap.core_version)+'；未重算的輸入變更不代表新結果。</p>';
  if(snap.detached)pane.insertAdjacentHTML("beforeend",'<p class="wip">此案由 workflow 檔還原；財務數字保留在原始 v2.1 檔。重新匯入對應 v2.1 即可補回。</p>');
}
const renderers={bench:renderBench,board:renderBoard,task:renderTasks,dec:renderDecisions,time:renderTimeline,mass:renderMassing,attr:renderAttribution,fin:renderFin};
function show(next){
  if(disposed)return;
  activePid=root.CaseBus.activePid();
  epoch++; view=views.includes(next)?next:views[0]; ATTR.pid=""; ATTR.base="";ATTR.cmp="";ATTR.report=null;ATTR.unsupported=null;ATTR.busy=false;
  ATTR.stale=false;ATTR.err=!ATTR.coreReady && ATTR.err==="core-unavailable"?"core-unavailable":null;
  changed=false;status.textContent="";host.querySelector(".workflow-refresh").hidden=true;
  host.querySelectorAll("[data-workflow-view]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.workflowView===view)));
  try{
    const rec=loadStore().projects[activePid];
    host.querySelector(".workflow-context").textContent=rec?(rec.wf.project.code_name||activePid)+" · 人工紀錄與匯入快照":"尚未選擇案件";
    if(!rec){pane.innerHTML='<p>請先<a href="workspace.html">選擇或匯入案件</a>。</p>';return;}
    renderers[view](activePid);bindActions();
  }catch(e){status.textContent="無法讀取紀錄："+(e.message||e);}
}
views.forEach(key=>{const b=document.createElement("button");b.type="button";b.dataset.workflowView=key;b.textContent=LABELS[key];b.onclick=()=>{history.replaceState(null,"","#workflow-"+key);show(key);};host.querySelector("nav").appendChild(b);});
host.querySelector(".workflow-refresh").onclick=()=>show(view);
function external(event){
  if(disposed || writing || (event.type==="storage" && event.key && ![root.CaseBus.KEY,root.CaseBus.ACTIVE_KEY].includes(event.key)))return;
  const next=root.CaseBus.activePid();
  changed=true;epoch++;ATTR.pid="";status.textContent=next!==activePid
    ?"作用中案件已切換。此處保留原案件的未儲存文字；重新讀取後才切換案件。"
    :"案件紀錄已更新。重新讀取後可繼續編輯；尚未儲存的文字將被取代。";
  host.querySelector(".workflow-refresh").hidden=false;
}
function hash(){const key=location.hash.replace("#workflow-","");if(views.includes(key))show(key);}
root.addEventListener(root.CaseBus.EVENT,external);root.addEventListener("storage",external);root.addEventListener("hashchange",hash);
show(location.hash.replace("#workflow-",""));
return {show,destroy(){disposed=true;epoch++;ATTR.pid="";ATTR.rt?.terminate();root.removeEventListener(root.CaseBus.EVENT,external);root.removeEventListener("storage",external);root.removeEventListener("hashchange",hash);host.replaceChildren();}};
}
root.WorkflowPanels={mount,route};
})(window);
