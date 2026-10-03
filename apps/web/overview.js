(function(root){
  "use strict";
  function mount(){
    var $=function(id){return document.getElementById(id);},bus=root.CaseBus,helper=root.PMWorkflow,rec;
    try{rec=bus.activeRecord();}catch(e){rec=null;}
    $("overview-empty").hidden=!!rec;$("overview-case").hidden=!rec;
    var store;
    try{store=bus.readStore();}catch(e){store={order:[],projects:{}};}
    if(rec){
      var last="site";try{last=localStorage.getItem("uros.last_step."+rec.pid)||"site";}catch(e){}
      var m=helper.model(rec,bus.consentFacts(rec),bus.provenance(rec),last);
      $("overview-name").textContent=m.name;$("overview-stage").textContent=m.stage+" · 上次開啟："+m.step+(m.computedAt?" · 最近計算："+m.computedAt.slice(0,10):"");
      $("overview-consent").textContent=m.metrics.agreed==null||m.metrics.total==null?"—":m.metrics.agreed+" / "+m.metrics.total+" 戶";
      $("overview-consent-source").textContent=m.consentSource==="recorded-events"?"逐戶紀錄":"案件快照；請核對最新紀錄";
      $("overview-return").textContent=helper.percent(m.metrics.return_rate);$("overview-cost").textContent=helper.percent(m.metrics.shared_cost_ratio);
      $("overview-next").textContent=m.next.text;$("overview-go").href=m.next.href;
      $("overview-issues").replaceChildren();
      if(!m.issues.length){var li=document.createElement("li");li.textContent="目前沒有可由已存欄位辨識的提醒；仍須人工核對資料。";$("overview-issues").appendChild(li);}
      m.issues.forEach(function(issue){var li=document.createElement("li"),a=document.createElement("a");a.href=issue.href;a.textContent=issue.text+" →";li.appendChild(a);$("overview-issues").appendChild(li);});
      $("overview-source").textContent="Core "+(m.coreVersion||"—")+" · input_hash "+(m.inputHash||"—")+(m.computedAt?" · 最近計算 "+m.computedAt:"");
      mountPulse(rec);
    }
    $("overview-projects").replaceChildren();
    (store.order||[]).filter(function(pid){return store.projects&&store.projects[pid]&&(!rec||pid!==rec.pid);}).forEach(function(pid){
      var item=store.projects[pid],a=document.createElement("a"),name=document.createElement("strong"),stage=document.createElement("span");
      name.textContent=(item.snap&&item.snap.code_name)||pid;stage.textContent=(item.wf&&item.wf.project&&item.wf.project.stage)||"階段未設定";
      a.href="overview.html";a.addEventListener("click",function(event){event.preventDefault();bus.setActive(pid);location.reload();});a.append(name,stage);$("overview-projects").appendChild(a);
    });
  }
  function mountPulse(rec){
    var pid=rec.pid,key="uros.pulse_reviewed."+pid,activity=null,readable=true,loading=true,$=function(id){return document.getElementById(id);};
    function item(list,title,detail,href){
      var li=document.createElement("li"),body=document.createElement(href?"a":"span"),strong=document.createElement("strong");
      strong.textContent=title;body.appendChild(strong);
      if(detail){var small=document.createElement("small");small.textContent=detail;body.appendChild(small);}
      if(href)body.href=href;li.appendChild(body);list.appendChild(li);
    }
    function date(ts){var d=new Date(ts);return Number.isFinite(d.getTime())?d.toLocaleString("zh-TW",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}):"時間未記錄";}
    function reviewed(){try{return localStorage.getItem(key);}catch(e){return null;}}
    function render(){
      var pulse=root.ProjectPulse.model(rec,activity,reviewed()),feed=$("pulse-feed"),blocks=$("pulse-blockers"),actions=$("pulse-actions");
      $("pulse-changes").textContent=loading||!readable||pulse.changeCount===null?"—":String(pulse.changeCount);
      $("pulse-blocked").textContent=String(pulse.blockedCount);$("pulse-open").textContent=String(pulse.openCount);
      $("pulse-review").disabled=loading||!readable;
      $("pulse-baseline").textContent=pulse.reviewedAt?"上次確認："+date(pulse.reviewedAt):"尚未設定比較基準；先顯示最近紀錄。";
      if(loading)$("pulse-baseline").textContent+=" 正在讀取 Activity…";
      if(!readable)$("pulse-baseline").textContent+=" Activity 暫時無法讀取，不能確認完整變更。";
      feed.replaceChildren();blocks.replaceChildren();actions.replaceChildren();
      var shown=(pulse.reviewedAt?pulse.changes:pulse.recent).slice(0,6);
      shown.forEach(function(ev){item(feed,ev.text,date(ev.ts)+" · "+ev.source);});
      if(!shown.length)item(feed,pulse.reviewedAt?"自上次確認後沒有已登錄的變更。":"尚無有時間戳記的變更紀錄。","");
      pulse.blocked.forEach(function(t){item(blocks,t.title||"未命名任務",(t.owner_role||"未指定負責人")+" · "+(t.due||"未設定期限"),"os-simulator.html#workflow-task");});
      if(!pulse.blocked.length)item(blocks,"目前沒有標記為卡住的任務。","此處只反映人工登錄的任務狀態。");
      var active=(rec.wf&&Array.isArray(rec.wf.tasks)?rec.wf.tasks:[]).filter(function(t){return t&&t.status!=="done";});
      active.sort(function(a,b){return (a.due||"9999").localeCompare(b.due||"9999");});
      active.slice(0,5).forEach(function(t){item(actions,t.title||"未命名任務",(root.ProjectPulse.status[t.status]||"狀態未設定")+" · "+(t.owner_role||"未指定負責人")+" · "+(t.due||"未設定期限"),"os-simulator.html#workflow-task");});
      if(!active.length)item(actions,"尚無待處理任務。","請在地主整合的時程任務中新增或帶入範本。");
    }
    $("pulse-review").addEventListener("click",function(){
      try{localStorage.setItem(key,new Date().toISOString());render();}
      catch(e){$("pulse-baseline").textContent="無法儲存已查看時間；此瀏覽器可能限制本機儲存。";}
    });
    render();
    if(root.CaseStore&&root.CaseStore.listActivity){
      root.CaseStore.listActivity(pid).then(function(rows){activity=rows;loading=false;render();}).catch(function(){readable=false;loading=false;render();});
    }else{readable=false;loading=false;render();}
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount);else mount();
})(window);
