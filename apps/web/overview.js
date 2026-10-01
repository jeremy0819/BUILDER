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
    }
    $("overview-projects").replaceChildren();
    (store.order||[]).filter(function(pid){return store.projects&&store.projects[pid]&&(!rec||pid!==rec.pid);}).forEach(function(pid){
      var item=store.projects[pid],a=document.createElement("a"),name=document.createElement("strong"),stage=document.createElement("span");
      name.textContent=(item.snap&&item.snap.code_name)||pid;stage.textContent=(item.wf&&item.wf.project&&item.wf.project.stage)||"階段未設定";
      a.href="overview.html";a.addEventListener("click",function(event){event.preventDefault();bus.setActive(pid);location.reload();});a.append(name,stage);$("overview-projects").appendChild(a);
    });
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount);else mount();
})(window);
