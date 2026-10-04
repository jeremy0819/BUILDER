/* Printable meeting projection of recorded facts and an explicitly entered agenda. */
(function(root){
  "use strict";
  function model(rec,activity,baseline,agenda,facts,provenance){
    if(!rec)return null;
    var wf=rec.wf||{},snap=rec.snap||{},view=rec.view||{},pulse=root.ProjectPulse.model(rec,activity,baseline);
    var tasks=Array.isArray(wf.tasks)?wf.tasks:[];
    var actions=tasks.filter(function(t){return t&&t.status!=="done";}).slice().sort(function(a,b){return String(a.due||"9999").localeCompare(String(b.due||"9999"));});
    var topics=String(agenda||"").split(/\r?\n/).map(function(s){return s.trim();}).filter(Boolean).slice(0,8);
    return {name:String(snap.code_name||(wf.project||{}).code_name||"未命名案件"),stage:String((wf.project||{}).stage||"未設定"),
      consent:facts&&facts.agreed!=null&&facts.total!=null?facts.agreed+" / "+facts.total+" 戶":"未記錄",
      consentSource:facts&&facts.source==="recorded-events"?"逐戶事件":"案件快照，需核對",
      returnRate:root.PMWorkflow.percent(view.return_rate??snap.return_rate),costRatio:root.PMWorkflow.percent(view.shared_cost_ratio??snap.shared_cost_ratio),
      coreNote:(provenance&&provenance.stale?"Core 快照版本已過期；需重算。":"Core 快照")+" · "+(snap.core_version||"版本未記錄")+" · "+(snap.input_hash||"input_hash 未記錄"),
      baseline:pulse.reviewedAt,changes:pulse.reviewedAt?pulse.changes:pulse.recent,changeCount:pulse.changeCount,
      activityAvailable:pulse.activityAvailable,blocked:pulse.blocked,actions:actions,topics:topics};
  }
  function mount(){
    var $=function(id){return document.getElementById(id);},bus=root.CaseBus,rec;
    try{rec=bus.activeRecord();}catch(e){rec=null;}
    $("meeting-empty").hidden=!!rec;$("meeting-case").hidden=!rec;if(!rec)return;
    var pid=rec.pid,baseKey="uros.meeting_baseline."+pid,agendaKey="uros.meeting_agenda."+pid,activity=null,activityReady=false,activityAvailable=true;
    function stored(key){try{return localStorage.getItem(key)||"";}catch(e){return "";}}
    $("meeting-agenda-input").value=stored(agendaKey);
    function list(id,rows,empty,format){var ul=$(id);ul.replaceChildren();if(!rows.length){var li=document.createElement("li");li.textContent=empty;ul.appendChild(li);return;}
      rows.forEach(function(row){var li=document.createElement("li");format(li,row);ul.appendChild(li);});}
    function when(ts){var d=new Date(ts);return Number.isFinite(d.getTime())?d.toLocaleString("zh-TW",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}):"時間未記錄";}
    function render(){
      var m=model(rec,activityAvailable?activity:null,stored(baseKey),$("meeting-agenda-input").value,bus.consentFacts(rec),bus.provenance(rec));
      $("meeting-name").textContent=m.name;$("meeting-generated").textContent="檢視時間："+when(new Date().toISOString());
      $("meeting-stage").textContent=m.stage;$("meeting-consent").textContent=m.consent+" · "+m.consentSource;
      $("meeting-return").textContent=m.returnRate;$("meeting-cost").textContent=m.costRatio;$("meeting-core-note").textContent=m.coreNote;
      $("meeting-baseline").textContent=!activityReady?"正在讀取 Activity…":!activityAvailable?"Activity 無法讀取；變更清單可能不完整。":m.baseline?"上次會議基準："+when(m.baseline)+" · 其後 "+m.changeCount+" 項已登錄變更":"尚未設定上次會議基準；以下是最近六筆已登錄紀錄。";
      $("meeting-mark").disabled=!activityReady||!activityAvailable;
      list("meeting-changes",m.changes.slice(0,12),m.baseline?"基準之後沒有已登錄的變更。":"尚無可顯示的變更紀錄。",function(li,row){li.textContent=row.text+" · "+when(row.ts)+" · "+row.source;});
      list("meeting-blockers",m.blocked,"目前沒有人工標記為卡住的任務。",function(li,t){li.textContent=(t.title||"未命名任務")+" · "+(t.owner_role||"未指定負責人")+" · "+(t.due||"未設定期限");});
      list("meeting-topics",m.topics,"尚未填寫本次待決策議題。",function(li,s){li.textContent=s;});
      list("meeting-actions",m.actions.slice(0,12),"尚無未完成任務。",function(li,t){li.textContent=(t.title||"未命名任務")+" · "+(root.ProjectPulse.status[t.status]||"狀態未設定")+" · "+(t.owner_role||"未指定負責人")+" · "+(t.due||"未設定期限");});
    }
    $("meeting-mark").onclick=function(){try{localStorage.setItem(baseKey,new Date().toISOString());render();}catch(e){$("meeting-baseline").textContent="無法儲存會議基準；請檢查瀏覽器本機儲存。";}};
    $("meeting-agenda-input").addEventListener("input",function(){try{localStorage.setItem(agendaKey,this.value);}catch(e){$("meeting-agenda-status").textContent="本機草稿未能儲存。";}render();});
    $("meeting-print").onclick=function(){root.print();};
    render();
    if(root.CaseStore&&root.CaseStore.listActivity)root.CaseStore.listActivity(pid).then(function(rows){activity=rows;activityReady=true;render();}).catch(function(){activityAvailable=false;activityReady=true;render();});
    else{activityAvailable=false;activityReady=true;render();}
  }
  root.MeetingBrief={model:model};
  if(typeof module!=="undefined"&&module.exports)module.exports=root.MeetingBrief;
  if(typeof document!=="undefined"){if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount);else mount();}
})(typeof self!=="undefined"?self:this);
