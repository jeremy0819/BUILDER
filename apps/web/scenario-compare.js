/* Product scenario comparison: every displayed result is replayed by the current Core. */
(function(root){
  "use strict";
  var METRICS=[
    {key:"total_sales",label:"總銷",unit:"萬"},
    {key:"shared_cost",label:"共同負擔",unit:"萬"},
    {key:"return_rate",label:"全案投報率",unit:"百分點",ratio:true},
    {key:"shared_cost_ratio",label:"共同負擔比",unit:"百分點",ratio:true},
    {key:"owner_return_value",label:"地主分回價值",unit:"萬"},
    {key:"owner_return_ratio",label:"地主分回比",unit:"百分點",ratio:true},
    {key:"saleable_area",label:"銷售坪數",unit:"坪"}
  ];
  function valid(n){return typeof n==="number"&&Number.isFinite(n);}
  function display(n,metric){return valid(n)?(metric.ratio?n*100:n).toLocaleString("zh-TW",{maximumFractionDigits:metric.ratio?2:1,minimumFractionDigits:metric.ratio?2:0})+(metric.ratio?"%":""):"—";}
  function difference(base,other,metric){
    if(!valid(base)||!valid(other))return "—";
    var n=(other-base)*(metric.ratio?100:1);
    return (n>0?"+":"")+n.toLocaleString("zh-TW",{maximumFractionDigits:metric.ratio?2:1,minimumFractionDigits:metric.ratio?2:0})+" "+metric.unit;
  }
  function sameCase(a,b){
    return !!a&&!!b&&a.pid===b.pid&&JSON.stringify(a.engine)===JSON.stringify(b.engine)&&
      (a.snap&&a.snap.input_hash)===(b.snap&&b.snap.input_hash)&&
      (a.snap&&a.snap.core_version)===(b.snap&&b.snap.core_version);
  }
  function mount(host,rec,getRuntime,getDraft,onAdopt){
    var $=function(s){return host.querySelector(s);},esc=root.UROSSecurity.esc,store=root.CaseStore;
    var scenarios=[],answers=Object.create(null),selected=[],busy=false,epoch=0,disposed=false;
    host.innerHTML='<section class="sc-compare" aria-label="已存方案比較">'
      +'<div class="sc-head"><div><span class="sm-source">CORE</span><h2>方案比較</h2></div><button type="button" data-sc="refresh">更新方案</button></div>'
      +'<p>方案只保存完整輸入；比較時由目前 Core 重算。差額為兩個 Core 結果相減，並非影響因素歸因。</p>'
      +'<div class="sc-save"><label>方案名稱<input data-sc="name" maxlength="60" placeholder="自行命名，例如：基準方案"></label><button type="button" data-sc="save" disabled>儲存本次試算為方案</button></div>'
      +'<div class="sc-status" role="status" aria-live="polite"></div><div class="sc-controls"></div><div class="sc-output"></div>'
      +'</section>';
    function status(message){$(".sc-status").textContent=message;}
    function updateDraft(state){$("[data-sc=save]").disabled=busy||!state||state.phase!=="ready"||!state.response;}
    function readyRuntime(){var rt=getRuntime();if(!rt||rt.failed)throw Error("Core 無法啟動，請重新開啟頁面。");if(!rt.ready)throw Error("Core 還在啟動，請稍後重試。");return rt;}
    function chooseOptions(exclude,chosen){return '<option value="">不加入</option>'+scenarios.filter(function(s){return s.scenario_id!==exclude;}).map(function(s){return '<option value="'+esc(s.scenario_id)+'"'+(s.scenario_id===chosen?' selected':'')+'>'+esc(s.name)+'</option>';}).join('');}
    function controls(){
      var base=scenarios.find(function(s){return s.authoritative;});
      if(scenarios.length<2){$(".sc-controls").innerHTML='<p class="sc-empty">至少儲存兩個已重算的方案才能比較；目前 '+scenarios.length+' 個。</p>';$(".sc-output").replaceChildren();return;}
      if(!base){$(".sc-controls").innerHTML='<p class="sc-empty">方案缺少作準標記，請核對備份後再比較。</p>';$(".sc-output").replaceChildren();return;}
      var others=scenarios.filter(function(s){return s.scenario_id!==base.scenario_id;});
      var a=selected[0]&&others.some(function(s){return s.scenario_id===selected[0];})?selected[0]:others[0].scenario_id;
      var b=selected[1]&&others.some(function(s){return s.scenario_id===selected[1]&&s.scenario_id!==a;})?selected[1]:(others.find(function(s){return s.scenario_id!==a;})||{}).scenario_id||"";
      selected=[a,b];
      $(".sc-controls").innerHTML='<div class="sc-picks"><span>作準基準：<b>'+esc(base.name)+'</b></span>'
        +'<label>對照 A<select data-sc="a">'+chooseOptions(base.scenario_id,a)+'</select></label>'
        +'<label>對照 B<select data-sc="b">'+chooseOptions(base.scenario_id,b)+'</select></label>'
        +'<button type="button" data-sc="compare">以 Core 比較</button></div>';
      $("[data-sc=a]").onchange=function(){epoch++;selected[0]=this.value;answers=Object.create(null);$(".sc-output").replaceChildren();status("選取已變更，請重新比較。");};
      $("[data-sc=b]").onchange=function(){epoch++;selected[1]=this.value;answers=Object.create(null);$(".sc-output").replaceChildren();status("選取已變更，請重新比較。");};
      $("[data-sc=compare]").onclick=compare;
    }
    async function refresh(){
      var ticket=++epoch;answers=Object.create(null);$(".sc-output").replaceChildren();status("讀取已存方案…");
      try{var list=await store.listScenarios(rec.pid);if(disposed||ticket!==epoch)return;scenarios=list||[];controls();status("已存 "+scenarios.length+" 個方案；數字需按「以 Core 比較」即時重算。");}
      catch(e){if(!disposed&&ticket===epoch)status("無法讀取方案："+(e.message||e));}
    }
    async function save(){
      var name=$("[data-sc=name]").value.trim(),state=getDraft();
      if(!name){status("請先填寫方案名稱。");return;}
      if(!state||state.phase!=="ready"||!state.response){status("本次試算尚未取得 Core 結果，不能儲存方案。");return;}
      if(!sameCase(root.CaseBus.activeRecord(),rec)){status("案件已變更，請重新載入後再儲存方案。");return;}
      if(scenarios.some(function(s){return s.name===name})){status("已有同名方案，請使用不同名稱。");return;}
      busy=true;updateDraft(state);status("儲存完整方案輸入…");
      try{
        await store.addScenario(rec.pid,{scenario_id:"sc-"+crypto.randomUUID(),name:name,engine:state.engine,input_hash:state.response.input_hash});
        if(disposed)return;$("[data-sc=name]").value="";await refresh();
      }catch(e){if(!disposed)status("方案未儲存："+(e.message||e));}
      finally{busy=false;if(!disposed)updateDraft(getDraft());}
    }
    function table(base,compared){
      var current=root.CaseBus.activeRecord(),head=[base].concat(compared);
      var html='<div class="sc-table-wrap"><table><thead><tr><th scope="col">Core 指標</th>';
      head.forEach(function(s){html+='<th scope="col">'+esc(s.name)+(s.authoritative?' <span class="sc-badge">作準</span>':'')+'<small>'+esc((answers[s.scenario_id].input_hash||"").slice(0,19))+'… · Core '+esc(answers[s.scenario_id].result.core_version)+'</small></th>';});
      html+='</tr></thead><tbody>';
      METRICS.forEach(function(m){html+='<tr><th scope="row">'+m.label+'</th>';head.forEach(function(s){var n=answers[s.scenario_id].result[m.key];html+='<td>'+display(n,m)+(s===base?'':'<small>相較作準：'+difference(answers[base.scenario_id].result[m.key],n,m)+'</small>')+'</td>';});html+='</tr>';});
      html+='</tbody></table></div><div class="sc-adopt">';
      compared.forEach(function(s){html+='<button type="button" data-sc-adopt="'+esc(s.scenario_id)+'">設為目前工作方案：'+esc(s.name)+'</button>';});
      if(!sameCase(current,rec))html+='<p>案件在比較期間已變更；請重新載入後再採用。</p>';
      html+='</div><p class="sc-foot">此表沒有「最佳方案」判定。若要看因素歸因，請到④策略決策；所有比較數字只存在此畫面。</p>';
      $(".sc-output").innerHTML=html;
      host.querySelectorAll("[data-sc-adopt]").forEach(function(b){b.onclick=function(){adopt(b.dataset.scAdopt);};});
    }
    async function compare(){
      if(busy)return;
      if(!sameCase(root.CaseBus.activeRecord(),rec)){status("案件已變更，請重新載入後再比較。");return;}
      var base=scenarios.find(function(s){return s.authoritative;}),ids=selected.filter(Boolean);
      if(!base||!ids.length||new Set(ids).size!==ids.length){status("請選擇一或兩個不同的對照方案。");return;}
      var compared=ids.map(function(id){return scenarios.find(function(s){return s.scenario_id===id;});});
      if(compared.some(function(s){return !s||!s.engine})){status("對照方案缺完整輸入，無法重算。");return;}
      var rt;try{rt=readyRuntime();}catch(e){status(e.message);return;}
      var ticket=++epoch;busy=true;updateDraft(getDraft());$(".sc-output").replaceChildren();answers=Object.create(null);status("Core 正在重算 "+(compared.length+1)+" 個方案…");
      try{
        for(var s of [base].concat(compared)){
          var answer=await rt.recompute(s.engine);if(disposed||ticket!==epoch)return;
          if(!answer||!answer.result||!answer.result.core_version||answer.input_hash!==s.input_hash)throw Error(s.name+" 的輸入指紋不符；請重新建立方案。");
          answers[s.scenario_id]=answer;
        }
        table(base,compared);status("已用 Core "+answers[base.scenario_id].result.core_version+" 重算；差額不代表因果或推薦。");
      }catch(e){if(!disposed&&ticket===epoch){answers=Object.create(null);status("比較未完成："+(e.message||e));}}
      finally{busy=false;if(!disposed)updateDraft(getDraft());}
    }
    async function adopt(id){
      if(busy)return;
      var s=scenarios.find(function(x){return x.scenario_id===id;}),answer=answers[id];
      if(!s||!answer||answer.input_hash!==s.input_hash){status("請先以 Core 重新比較後再採用。");return;}
      var current=root.CaseBus.activeRecord();if(!sameCase(current,rec)){status("案件已變更，請重新載入後再採用。");return;}
      if(!root.confirm("將「"+s.name+"」設為目前工作方案？目前未採用的產品草案會捨棄。"))return;
      busy=true;updateDraft(getDraft());status("正在更新作準方案與案件快照…");
      var old=scenarios.map(function(x){return Object.assign({},x);});
      try{
        var next=root.CaseBus.applyResult(current,{engine:s.engine,result:answer.result,input_hash:answer.input_hash,cashflow:answer.cashflow||null});
        root.CaseBus.replace(rec.pid,next);
        await store.setAuthoritative(rec.pid,id);
        if(disposed)return;status("已設為目前工作方案；重新載入以同步四步資料。");onAdopt(next);
      }catch(e){
        try{root.CaseBus.replace(rec.pid,current);await store.meta(store._scenarioKey(rec.pid),{scenarios:old});}
        catch(rollback){status("採用未完成且回復失敗；請匯出備份並重新載入核對作準方案。");busy=false;updateDraft(getDraft());return;}
        status("採用未完成，原案件與作準方案已保留："+(e.message||e));
      }
      busy=false;updateDraft(getDraft());
    }
    $("[data-sc=save]").onclick=save;$("[data-sc=refresh]").onclick=refresh;
    refresh();
    return {updateDraft:updateDraft,dispose:function(){disposed=true;epoch++;}};
  }
  root.ScenarioCompare={mount:mount,metrics:METRICS,display:display,difference:difference,sameCase:sameCase};
  if(typeof module!=="undefined"&&module.exports)module.exports=root.ScenarioCompare;
})(typeof self!=="undefined"?self:this);
