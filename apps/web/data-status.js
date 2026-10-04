/* Itemized evidence coverage. A value or Core timestamp is not a source verification. */
(function(root){
  "use strict";
  function filled(value){return value!==null&&value!==undefined&&value!==""&&typeof value!=="boolean"&&(typeof value!=="number"||Number.isFinite(value));}
  function date(value){return typeof value==="string"&&/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)?value.slice(0,10):"未記錄";}
  function model(rec,provenance){
    var eng=(rec&&rec.engine)||{}, params=eng.params||{}, snap=(rec&&rec.snap)||{}, wf=(rec&&rec.wf)||{};
    var land=((rec&&rec.site_intake)||{}).land||{}, owners=(Array.isArray(wf.stakeholders)?wf.stakeholders:[]).filter(function(s){return s&&s.role==="owner";});
    var ownerIds=new Set(owners.map(function(s){return s.stakeholder_id;}));
    var events=(Array.isArray(wf.consent_events)?wf.consent_events:[]).filter(function(e){return e&&ownerIds.has(e.stakeholder_id);});
    var contacted=new Set(events.map(function(e){return e.stakeholder_id;})).size;
    var ownership=owners.filter(function(s){return filled(s.ownership_complexity)||filled(s.signability);}).length;
    var expected=Number.isInteger(snap.total)&&snap.total>=0?snap.total:null;
    var rows=[];
    function input(label,value,href){rows.push({label:label,value:filled(value)?String(value):"—",status:filled(value)?"已輸入，待查核":"未填",source:filled(value)?"Core 輸入；原始來源未記錄":"未記錄",checked:"未記錄",href:href});}
    input("基地面積",params.基地面積,"dashboard.html");
    input("法定容積率",params.容積率,"dashboard.html");
    input("容積獎勵率",params.獎勵率,"dashboard.html");
    input("營造單價",params.營造單價,"evaluator.html");
    rows.push({label:"基地查核紀錄",value:filled(land.reference)?land.reference:"—",status:filled(land.reference)&&date(land.checked_on)!=="未記錄"?"已登錄來源與日期":"來源或日期未齊",source:filled(land.reference)?land.reference:"未記錄",checked:date(land.checked_on),href:"dashboard.html",note:"此紀錄只屬於基地資料，不自動驗證上列 Core 輸入。"});
    rows.push({label:"地主清冊",value:owners.length+" / "+(expected===null?"預期戶數未記錄":expected),status:expected>0&&owners.length===expected?"代號數量相符，待查核":"未能核對完整",source:"案件地主紀錄；名冊來源未記錄",checked:"未記錄",href:"os-simulator.html#workflow-board"});
    rows.push({label:"接觸事件涵蓋",value:contacted+" / "+owners.length,status:owners.length&&contacted===owners.length?"每戶有事件紀錄":"尚有戶別無事件",source:"逐戶同意事件",checked:date(events.reduce(function(latest,e){return String(e.ts||"")>latest?String(e.ts):latest;},"")),href:"os-simulator.html#workflow-board",note:"日期為最新登錄事件時間，並非清冊查核日。"});
    rows.push({label:"產權欄位涵蓋",value:ownership+" / "+owners.length,status:owners.length&&ownership===owners.length?"每戶有欄位紀錄":"尚有戶別未登錄",source:"案件地主紀錄；產權文件未核驗",checked:"未記錄",href:"os-simulator.html#workflow-board"});
    var hash=String(snap.input_hash||""),core=String(snap.core_version||"");
    rows.push({label:"Core 計算快照",value:core||"—",status:hash&&core?(provenance&&provenance.stale?"舊 Core 版本，需重算":"可核對輸入與版本"):"缺少完整溯源",source:hash?"input_hash "+hash:"input_hash 未記錄",checked:date(snap.computed_at),href:"evaluator.html",note:"計算時間不等於外部資料查核日期。"});
    return rows;
  }
  root.DataStatus={model:model};
  if(typeof module!=="undefined"&&module.exports)module.exports=root.DataStatus;
})(typeof self!=="undefined"?self:this);
