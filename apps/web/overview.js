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
      $("overview-consent-source").textContent=(m.consentSource==="recorded-events"?"逐戶紀錄":"案件快照；請核對最新紀錄")+" · 不代表法定面積門檻";
      $("overview-return").textContent=helper.percent(m.metrics.return_rate);$("overview-cost").textContent=helper.percent(m.metrics.shared_cost_ratio);
      $("overview-model-status").textContent=root.UROSCalibration&&root.UROSCalibration.label?root.UROSCalibration.label+" · 判定僅供方向性比較":"模型校準狀態未取得；請勿把判定視為已校準";
      $("overview-next").textContent=m.next.text;$("overview-go").href=m.next.href;
      $("overview-issues").replaceChildren();
      if(!m.issues.length){var li=document.createElement("li");li.textContent="目前沒有可由已存欄位辨識的提醒；仍須人工核對資料。";$("overview-issues").appendChild(li);}
      m.issues.forEach(function(issue){var li=document.createElement("li"),a=document.createElement("a");a.href=issue.href;a.textContent=issue.text+" →";li.appendChild(a);$("overview-issues").appendChild(li);});
      $("overview-source").textContent="Core "+(m.coreVersion||"—")+" · input_hash "+(m.inputHash||"—")+(m.computedAt?" · 最近計算 "+m.computedAt:"");
      mountPulse(rec);
      mountDataStatus(rec,bus.provenance(rec));
      mountEvidence(rec);
    }
    $("overview-projects").replaceChildren();
    (store.order||[]).filter(function(pid){return store.projects&&store.projects[pid]&&(!rec||pid!==rec.pid);}).forEach(function(pid){
      var item=store.projects[pid],a=document.createElement("a"),name=document.createElement("strong"),stage=document.createElement("span");
      name.textContent=(item.snap&&item.snap.code_name)||pid;stage.textContent=(item.wf&&item.wf.project&&item.wf.project.stage)||"階段未設定";
      a.href="overview.html";a.addEventListener("click",function(event){event.preventDefault();bus.setActive(pid);location.reload();});a.append(name,stage);$("overview-projects").appendChild(a);
    });
  }
  function mountDataStatus(rec,provenance){
    var body=document.getElementById("data-status-rows");body.replaceChildren();
    root.DataStatus.model(rec,provenance).forEach(function(row){
      var tr=document.createElement("tr"),title=document.createElement("th"),link=document.createElement("a");
      title.scope="row";link.href=row.href;link.textContent=row.label;title.appendChild(link);tr.appendChild(title);
      [row.value,row.status,row.source,row.checked].forEach(function(value){var td=document.createElement("td");td.textContent=value;tr.appendChild(td);});
      if(row.note){var small=document.createElement("small");small.textContent=row.note;tr.lastChild.appendChild(small);}
      body.appendChild(tr);
    });
  }
  function mountEvidence(initial){
    var rec=initial, ledger=root.EvidenceLedger, bus=root.CaseBus;
    var $=function(id){return document.getElementById(id);};
    var names={observed:"觀察紀錄 · 未核驗",inferred:"推論 · 未核驗",assumed:"分析假設",calibrated:"校準紀錄 · 未核驗"};
    var lastStored=JSON.stringify(rec.evidence_facts===undefined?[]:rec.evidence_facts),canWrite=true;
    function render(){
      var list=$("evidence-list");list.replaceChildren();
      try{
        var facts=ledger.list(rec),counts={observed:0,inferred:0,assumed:0,calibrated:0};
        facts.forEach(function(f){counts[f.evidence_type]++;});
        $("evidence-count").textContent=facts.length+" 筆"+(facts.length?" · 觀察 "+counts.observed+"／假設 "+counts.assumed+"／推論 "+counts.inferred+"／校準 "+counts.calibrated:"");
        if(!facts.length){var empty=document.createElement("p");empty.className="pm-mini";empty.textContent="尚無候選證據。已輸入的 Core 數值不會因此被標為已查核。";list.appendChild(empty);}
        facts.slice(-20).reverse().forEach(function(f){
          var item=document.createElement("article"),title=document.createElement("strong"),value=document.createElement("p"),meta=document.createElement("small");
          item.className="evidence-item";title.textContent=f.field+" · "+names[f.evidence_type];
          value.textContent=String(f.value)+(f.unit?" "+f.unit:"");
          meta.textContent="來源／依據："+f.source.label+" · "+(f.observed_at?"觀察 "+f.observed_at+" · ":"")+"登錄 "+f.recorded_at.slice(0,10)+" · 信心 "+({unknown:"未評估",low:"低",medium:"中",high:"高"}[f.confidence])+" · 未核驗";
          item.append(title,value,meta);list.appendChild(item);
        });
        if(facts.length>20){var more=document.createElement("p");more.className="pm-mini";more.textContent="畫面顯示最新 20 筆；完整紀錄保留於本機案件備份。";list.appendChild(more);}
        canWrite=true;$("evidence-add").disabled=facts.length>=ledger.MAX_FACTS;
      }catch(e){canWrite=false;$("evidence-add").disabled=true;$("evidence-count").textContent="紀錄需檢查";var warning=document.createElement("p");warning.className="pm-mini";warning.textContent="既有證據格式不支援；原資料保留。請先匯出案件備份，再檢查資料版本。";list.appendChild(warning);}
    }
    function updateDate(){var observed=$("evidence-type").value==="observed";$("evidence-date-label").hidden=!observed;$("evidence-date").required=observed;}
    $("evidence-type").addEventListener("change",updateDate);updateDate();render();
    $("evidence-add").addEventListener("click",function(){
      var status=$("evidence-status");status.textContent="";
      if(!canWrite)return;
      var fields=["evidence-field","evidence-value","evidence-source"].map($);
      if(fields.some(function(el){return !el.value.trim()||!el.checkValidity();})||$("evidence-type").value==="observed"&&!$("evidence-date").checkValidity()){
        status.textContent="請填寫資料項目、記錄值、來源；觀察紀錄還需觀察日期。";return;
      }
      try{
        var current=bus.activeRecord();
        if(!current||current.pid!==rec.pid||JSON.stringify(current.evidence_facts===undefined?[]:current.evidence_facts)!==lastStored)throw Error("案件或證據已在其他頁面變更，請重新載入後再登錄。");
        var fact=ledger.caseFact(current,{field:$("evidence-field").value.trim(),value:$("evidence-value").value.trim(),source:$("evidence-source").value.trim(),evidence_type:$("evidence-type").value,observed_at:$("evidence-date").value,confidence:$("evidence-confidence").value},"f-"+root.crypto.randomUUID(),new Date().toISOString());
        var next=ledger.append(current,fact);bus.replace(current.pid,next);rec=next;lastStored=JSON.stringify(next.evidence_facts);render();
        $("evidence-field").value="";$("evidence-value").value="";$("evidence-source").value="";$("evidence-date").value="";
        status.textContent="候選證據已存本機；未改動 Core 輸入或資料核驗狀態。";
      }catch(e){status.textContent=e&&e.message?e.message:"證據未儲存，請檢查案件與本機儲存空間。";}
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
