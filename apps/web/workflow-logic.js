/*WORKLOGIC-BEGIN*/
/* WORKLOGIC — 純轉換邏輯（零 DOM、零 localStorage、零財務運算；node headless 可測）。
   把 v2.1 計算檔轉成 wf-1.0 Project 文件（import-to-create），並抽出唯讀顯示子集。
   紅線：不對 result 做任何四則運算——只搬欄位、計數、逐欄複製既有值。 */
const WORKLOGIC = (() => {
  const 門檻 = ct => ct === "danger_building" ? 1.0 : 0.75;   // 危老 100% / 都更 3/4（法規常數）

  function stakeholdersFromOwners(owners){
    return (owners || []).map(o => {
      const s = {stakeholder_id: o.owner_id, role: "owner"};
      if (o.land_share != null) s.land_share = o.land_share;
      if (o.pre_value != null) s.pre_value = o.pre_value;
      if (o.min_unit_eligible != null) s.min_unit_eligible = o.min_unit_eligible;
      if (o.consent) s.tags = ["consent:" + o.consent];   // 匯入時點的同意事實（schema tags 合法欄）
      return s;
    });
  }
  function snapshotRef(v21){
    const p = v21.provenance || {};
    return {id:"snap-01", label:"匯入版", schema_version: v21.schema_version,
            input_hash: p.input_hash, core_version: p.core_version,
            computed_at: p.computed_at, file_ref: "local:import"};
  }
  function projectId(v21){
    const h = (v21.provenance && v21.provenance.input_hash || "").replace(/^sha256:/,"");
    return "prj-" + (h.slice(0,8) || "unknown");
  }
  function importV21ToWorkflow(v21){
    if(!v21 || v21.schema_version !== "2.1") throw new Error("需要 schema v2.1 的案件 JSON（本檔非 v2.1）");
    if(!v21.provenance || !v21.provenance.input_hash) throw new Error("缺 provenance.input_hash，無法建立快照引用");
    const proj = v21.project || {};
    const snap = snapshotRef(v21);
    return {
      schema_version: "wf-1.0",
      project: {
        project_id: projectId(v21),
        code_name: proj.name || proj.id || "未命名案件",
        case_type: proj.case_type || "urban_renewal",
        ...(v21.engine && v21.engine.mode ? {mode: v21.engine.mode} : {}),
        stage: "S1",
        active_snapshot: snap.id,
        snapshots: [snap],
      },
      stakeholders: stakeholdersFromOwners(v21.input && v21.input.owners),
      consent_events: [], tasks: [], decisions: [],
    };
  }
  // 唯讀顯示子集：逐欄複製既有 result 值＋計數（零計算）
  function displaySnapshot(v21){
    const r = v21.result || {}, owners = (v21.input && v21.input.owners) || [];
    const agreed = owners.filter(o => o.consent === "agreed").length;
    return {
      code_name: (v21.project||{}).name || "未命名",
      case_type: (v21.project||{}).case_type || "urban_renewal",
      stakeholders_n: (owners.length) + 0,
      input_hash: (v21.provenance||{}).input_hash || "",
      core_version: (v21.provenance||{}).core_version || "",
      computed_at: (v21.provenance||{}).computed_at || "",
      shared_cost_ratio: r.shared_cost_ratio ?? null,   // 逐欄複製，不運算
      return_rate: r.return_rate ?? null,
      warnings_n: (r.warnings || []).length,
      agreed, total: owners.length, threshold: 門檻((v21.project||{}).case_type),
      allocations: (r.owner_allocations || []).map(a => ({...a})),   // §56 權變表 verbatim（零運算）
      site: {...((v21.input||{}).site||{})},                          // M5-P1 Site facts verbatim（零運算）
      public_ratio: ((v21.input||{}).building||{}).public_ratio ?? null,
    };
  }
  // ── C3 同意狀態機（純邏輯，鏡像 core/redcf/workflow.py::derive_consent_state）──
  // 事實層：由 append-only 事件流「重放」推導目前狀態；不推論、不判斷、不臆造。
  const CONSENT_STATES = ["untouched","contacted","negotiating","agreed_unselected","agreed_selected","declined"];
  const _ORDER = {untouched:0, contacted:1, negotiating:2, agreed_unselected:3, agreed_selected:4, declined:1};
  const _KIND2STATE = {contacted:"contacted", visited:"negotiating", briefed:"contacted",
    verbal_ok:"agreed_unselected", signed:"agreed_unselected", selected_unit:"agreed_selected",
    declined:"declined", withdrawn:"negotiating"};
  function deriveConsentState(events){
    let state = "untouched";
    const evs = [...(events || [])].sort((a,b) => String(a.ts||"").localeCompare(String(b.ts||"")));
    for(const ev of evs){
      const nxt = _KIND2STATE[ev.kind]; if(nxt == null) continue;
      // 前進為主；withdrawn/declined 例外可覆寫（與 Python 版一致）
      if(ev.kind === "withdrawn" || ev.kind === "declined" || (_ORDER[nxt]||0) >= (_ORDER[state]||0)) state = nxt;
    }
    return state;
  }
  function consentBoard(wf){
    const byId = {};
    for(const ev of (wf.consent_events || [])){ (byId[ev.stakeholder_id] = byId[ev.stakeholder_id] || []).push(ev); }
    const rows = (wf.stakeholders || []).filter(s => s.role === "owner").map(s => ({
      stakeholder_id: s.stakeholder_id, family_group: s.family_group || null,
      state: deriveConsentState(byId[s.stakeholder_id] || []),
      events_n: (byId[s.stakeholder_id] || []).length,
      willingness_source: "recorded",   // A1.4：實戰意願＝事件記錄的事實，非模擬值
    }));
    const tally = {}; CONSENT_STATES.forEach(k => tally[k] = 0);
    rows.forEach(r => tally[r.state] = (tally[r.state]||0) + 1);
    return {rows, tally, total: rows.length};
  }
  // ── C4 時程任務（事實層）──
  const STAGE_TITLES = {S1:"基地權屬調查",S2:"法規容積試算",S3:"坪效量體規劃",S4:"投報財務評估",
    S5:"說明會與意願整合",S6:"簽約",S7:"事業／權變送審",S8:"審議・公展・核定",
    S9:"設計與發包",S10:"施工",S11:"銷售・交屋・管委會"};
  function stageTemplate(){   // S1–S11 標準里程碑骨架（流程事實，非案件資料）
    return Object.keys(STAGE_TITLES).map(s => ({stage:s, title:STAGE_TITLES[s], status:"todo"}));
  }
  function taskTally(tasks){
    const t = {todo:0, doing:0, done:0, blocked:0};
    (tasks||[]).forEach(x => { if(t[x.status]!=null) t[x.status]++; });
    return t;
  }
  // ── C4 決策日誌：evidence 釘住當時「作準快照」的指紋（稽核鏈；不複製數字）──
  function decisionEvidence(wf){
    const p = wf.project || {}, snaps = p.snapshots || [];
    const s = snaps.find(x => x.id === p.active_snapshot) || snaps[0];
    if(!s) return null;
    return {input_hash: s.input_hash, core_version: s.core_version};
  }
  // ── C5 時間軸：把階段沿革＋事件＋決策併成一條時間序（事實重放，零推論）──
  function caseTimeline(wf){
    const items = [];
    (wf.project && wf.project.stage_history || []).forEach(h => items.push({ts:h.ts, type:"stage", label:"階段 "+h.stage}));
    (wf.consent_events || []).forEach(e => items.push({ts:e.ts, type:"consent", label:e.stakeholder_id+" · "+e.kind}));
    (wf.decisions || []).forEach(dc => items.push({ts:dc.ts, type:"decision", label:dc.title}));
    return items.sort((a,b) => String(a.ts||"").localeCompare(String(b.ts||"")));
  }
  // ── M5-P2 Developer Board（整合人工作台）＝純組合：戶別/接觸(事實)＋風險(引擎 verbatim)＋下一步(任務事實)──
  function developerBoard(wf, decision){
    const bd = consentBoard(wf);
    const by = {};
    (wf.consent_events || []).forEach(e => { (by[e.stakeholder_id] = by[e.stakeholder_id] || []).push(e); });
    const rows = bd.rows.map(r => {
      const evs = (by[r.stakeholder_id] || []).slice().sort((a,b) => String(a.ts||"").localeCompare(String(b.ts||"")));
      const last = evs[evs.length - 1] || null;
      return {...r, last_kind: last ? last.kind : null, last_ts: last ? last.ts : null};
    });
    const risk = decision ? {verdict: decision.verdict, breakpoint: decision.breakpoint_stakeholder,
      exit_signal: decision.exit_signal, urgency: decision.decision_urgency,
      p: decision.completion_probability, engine: decision.decision_engine_version} : null;  // 逐欄 verbatim
    const next = (wf.tasks || []).filter(t => t.status === "todo" || t.status === "doing")
      .sort((a,b) => a.stage.localeCompare(b.stage, undefined, {numeric:true})).slice(0, 8);
    return {rows, tally: bd.tally, total: bd.total, risk, next};
  }
  // ── M4：decision JSON 呈現（引擎產出即權威；本層只配對＋逐欄顯示，零推導）──
  /* N1（Decision v0.2）：身分鍵＝input_hash × core_version **二元組**。
     v0.1 只比 input_hash，於是「同一份輸入、不同 Core 版本算出的 verdict」會被判定相符，
     畫面只顯示「已綁定」而不報錯——靜默的錯誤綁定。三條規則一律**從嚴**（使用者裁決），
     規則本體由 Core `decision.snapshot_matches()` 定義，本處是同規則的瀏覽器側鏡像，
     以 tests/web/test_decision_binding.mjs 與 tests/test_decision.py 雙向釘住。 */
  const UNKNOWN_CORE = "unknown";
  const MISMATCH_REASONS = {
    ok: "相符",
    hash_mismatch: "輸入不同（input_hash 不符）",
    core_version_unknown: "decision 未記錄 Core 版本（v0.1 舊檔）——請以現行 Core 重算",
    core_version_mismatch: "跨 Core 版本（公式可能已變）——請以現行 Core 重算",
    snapshot_core_version_missing: "快照未記錄 Core 版本——無法構成二元組身分"
  };
  function snapshotMatches(decision, snapshot){
    const dh=(decision&&decision.input_hash)||"", dc=(decision&&decision.core_version)||UNKNOWN_CORE;
    const sh=(snapshot&&snapshot.input_hash)||"",  sc=(snapshot&&snapshot.core_version)||"";
    if(!dh || dh!==sh) return {matched:false, reason:"hash_mismatch"};
    if(dc===UNKNOWN_CORE) return {matched:false, reason:"core_version_unknown"};
    if(!sc) return {matched:false, reason:"snapshot_core_version_missing"};
    /* 整串比對——不拆 semver。公式相容與否不該由版號字面推定（patch 也可能改係數）。 */
    if(dc!==sc) return {matched:false, reason:"core_version_mismatch"};
    return {matched:true, reason:"ok"};
  }
  function matchDecisionDetail(wf, decision){
    if(!decision || !decision.decision_engine_version || !decision.input_hash)
      return {matched:false, reason:"hash_mismatch", snapshot:null};
    const 優先=["hash_mismatch","snapshot_core_version_missing","core_version_unknown","core_version_mismatch"];
    let 最佳="hash_mismatch";
    const snaps=(wf.project && wf.project.snapshots) || [];
    for(const sn of snaps){
      const r=snapshotMatches(decision, sn);
      if(r.matched) return {matched:true, reason:"ok", snapshot:sn};
      if(優先.indexOf(r.reason) > 優先.indexOf(最佳)) 最佳=r.reason;
    }
    return {matched:false, reason:最佳, snapshot:null};
  }
  function matchDecision(wf, decision){ return matchDecisionDetail(wf, decision).matched; }
  function mismatchMessage(reason){ return MISMATCH_REASONS[reason] || reason; }
  return {importV21ToWorkflow, stakeholdersFromOwners, snapshotRef, projectId, displaySnapshot, 門檻,
          deriveConsentState, consentBoard, CONSENT_STATES,
          stageTemplate, taskTally, STAGE_TITLES, decisionEvidence, caseTimeline, matchDecision,
          matchDecisionDetail, snapshotMatches, mismatchMessage, MISMATCH_REASONS, UNKNOWN_CORE,
          developerBoard};
})();
/*WORKLOGIC-END*/
