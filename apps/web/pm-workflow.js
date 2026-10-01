/* A factual, local-only summary for the PM home and daily case overview. */
(function(root){
  "use strict";
  var ROUTES={site:["基地與法規","dashboard.html"],product:["產品與財務","evaluator.html"],people:["地主整合","os-simulator.html"],decision:["策略決策","report.html"]};
  function model(rec,facts,provenance,lastStep){
    if(!rec)return null;
    var snap=rec.snap||{}, view=rec.view||{}, wf=rec.wf||{}, project=wf.project||{};
    var step=Object.prototype.hasOwnProperty.call(ROUTES,lastStep)?lastStep:"site";
    var issues=[];
    if(!rec.engine)issues.push({text:"缺少可重算的案件輸入；請匯入完整案件資料",href:"workspace.html#cases"});
    if(provenance&&provenance.stale)issues.push({text:"Core 快照使用舊版本，需重新計算",href:"dashboard.html#site-massing-host"});
    if(rec.engine&&!snap.input_hash)issues.push({text:"尚無可核對的 Core 計算快照",href:"dashboard.html#site-massing-host"});
    var warningCount=Array.isArray(view.warnings)?view.warnings.length:(Number.isInteger(snap.warnings_n)?snap.warnings_n:0);
    if(warningCount>0)issues.push({text:"Core 健檢有 "+warningCount+" 項提醒",href:"dashboard.html#workflow-mass"});
    if(facts&&facts.source==="snapshot"&&facts.total>0)issues.push({text:"同意數目前僅有快照彙總，請核對逐戶紀錄",href:"os-simulator.html#workflow-board"});
    var next=issues[0]||{text:"繼續上次開啟的工作",href:ROUTES[step][1]};
    return {name:String(snap.code_name||project.code_name||"未命名案件"),stage:String(project.stage||"階段未設定"),
      step:ROUTES[step][0],resume:ROUTES[step][1],next:next,issues:issues,
      metrics:{return_rate:view.return_rate??snap.return_rate??null,shared_cost_ratio:view.shared_cost_ratio??snap.shared_cost_ratio??null,
        agreed:facts&&facts.agreed!=null?facts.agreed:null,total:facts&&facts.total!=null?facts.total:null},
      consentSource:facts&&facts.source||"unknown",computedAt:snap.computed_at||null,
      coreVersion:snap.core_version||null,inputHash:snap.input_hash||null};
  }
  function percent(value){return typeof value==="number"&&Number.isFinite(value)?(value*100).toFixed(1)+"%":"—";}
  root.PMWorkflow={model:model,percent:percent,routes:ROUTES};
  if(typeof module!=="undefined"&&module.exports)module.exports=root.PMWorkflow;
})(typeof self!=="undefined"?self:this);
