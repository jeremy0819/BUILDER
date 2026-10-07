/* Read-only query projection. Math below maps chart geometry, never financial outputs. */
(function(root){
  'use strict';
  var LABELS={total_sales:'全案總銷',shared_cost:'共同負擔',owner_return_value:'地主分回價值',return_rate:'全案投報率',saleable_area:'銷售坪數',agreed:'同意戶數',funding_gap:'資金缺口'};
  function sources(rec,scenarios,activity,mode){
    var snap=rec.snap||{},project=(rec.wf||{}).project||{},points=[],seen=new Set();
    function add(p){var key=String(p.ts||'')+'|'+p.input_hash;if(seen.has(key))return;seen.add(key);points.push(p);}
    function fromScenario(sc,id,ts,source){return {point_id:id,ts:ts||null,label:sc.name,source:source,source_id:sc.scenario_id,input_hash:sc.input_hash,engine:sc.engine,core_version:''};}
    if(mode==='scenarios')scenarios.forEach(function(sc){add(fromScenario(sc,'scenario:'+sc.scenario_id,sc.created_at,'scenario'));});
    else{
      (project.snapshots||[]).forEach(function(sn){
        if(sn.input_hash===snap.input_hash&&sn.computed_at===snap.computed_at)return;
        var sc=scenarios.find(function(s){return s.input_hash===sn.input_hash;});
        add({point_id:'snapshot:'+sn.id,ts:sn.computed_at||null,label:sn.label||sn.id,source:'snapshot',source_id:sn.id,input_hash:sn.input_hash,core_version:sn.core_version||'',engine:sc?sc.engine:null});
      });
      activity.filter(function(ev){return ev.kind==='scenario'&&ev.field==='authoritative'&&ev.after===true;}).forEach(function(ev){
        var sc=scenarios.find(function(s){return s.scenario_id===(ev.target||{}).id;});
        if(sc)add(fromScenario(sc,'adoption:'+ev.key,ev.ts,'adoption'));
        else add({point_id:'adoption:'+ev.key,ts:ev.ts||null,label:'已採用方案已不在方案庫',source:'adoption',source_id:(ev.target||{}).id||'',input_hash:'',engine:null,core_version:''});
      });
      add({point_id:'current',ts:snap.computed_at||null,label:'目前案件快照',source:'snapshot',source_id:project.active_snapshot||'current',input_hash:snap.input_hash||'',core_version:snap.core_version||'',engine:rec.engine||null});
    }
    return points;
  }
  root.ExecutiveDashboard={sources:sources,labels:LABELS};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.ExecutiveDashboard;
  if(typeof document==='undefined')return;
  var $=function(id){return document.getElementById(id);},bus=root.CaseBus,records,selected,series='adopted',epoch=0,rt,report,events=[],day=null,historyError='';
  var esc=root.UROSSecurity.esc;
  function text(id,value){$(id).textContent=value;}
  function status(value,error){text('executive-status',value);$('executive-status').toggleAttribute('data-error',!!error);}
  function date(value){if(!value)return '日期未記錄';var d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'}):'日期未記錄';}
  function detail(html){$('executive-evidence-body').innerHTML=html;$('executive-evidence').showModal();}
  function evidence(point,key){
    day=point.ts?date(point.ts):null;renderEvents();
    detail('<p><b>'+esc(point.label)+'</b> · '+esc(date(point.ts))+'</p><p>'+esc(LABELS[key]||key||'資料')+'：'+esc(point.display[key]||point.cost_display[key]||'—')+'</p>'
      +'<p>來源：'+esc(point.source)+' · '+esc(point.source_id)+'</p><p>記錄版本：'+esc(point.recorded_core_version||'未記錄')+'；重播版本：'+esc(point.core_version)+'</p><p><code>'+esc(point.input_hash)+'</code></p>'
      +(point.error?'<p>'+esc(point.error)+'</p>':'')+'<p>以下為同日已登錄事件；時間相近不代表因果。</p><ul>'+events.filter(function(e){return date(e.ts)===day;}).map(function(e){return '<li>'+esc(e.text)+'</li>';}).join('')+'</ul><a href="'+(point.source==='scenario'||point.source==='adoption'?'evaluator.html#scenario-comparison':'dashboard.html')+'">查看 Workspace 來源 →</a>');
  }
  function renderKpis(rec){
    var current=report.points.find(function(p){return p.point_id===report.current_id;}),previous=report.points.find(function(p){return p.point_id===report.previous_id;});
    var facts=bus.consentFacts(rec),consentLabel=typeof facts.agreed==='number'&&Number.isFinite(facts.agreed)?facts.agreed+' / '+facts.total:'—',keys=['total_sales','shared_cost','owner_return_value','return_rate','agreed','funding_gap'];
    $('executive-kpis').innerHTML=keys.map(function(key){var value=current?current.display[key]:'—',note='較上一筆：'+report.deltas[key].display;
      if(key==='agreed'){value=consentLabel;note='現場最新 · '+(facts.source==='recorded-events'?'逐戶事件':'快照彙總');}
      if(key==='funding_gap')note='尚無淨現金流契約';
      if(key==='owner_return_value')note='地主分回口徑 · '+note;
      return '<button type="button" data-kpi="'+key+'"><span>'+LABELS[key]+'</span><strong>'+esc(value)+'</strong><small>'+esc(note)+'</small></button>';
    }).join('');
    $('executive-kpis').querySelectorAll('button').forEach(function(button){button.onclick=function(){var key=button.dataset.kpi;
      if(key==='agreed'){detail('<p>'+esc(consentLabel)+' 戶 · 現場最新紀錄</p><p>期間查詢不會將目前同意數回填到過去日期；目前未保存完整同意數歷史。</p><a href="os-simulator.html#workflow-board">查看同意與接觸紀錄 →</a>');return;}
      if(key==='funding_gap'){detail('<p>尚無可追溯的淨現金流與融資缺口資料。八期成本出資不是資金缺口。</p><a href="evaluator.html">查看財務 Workspace →</a>');return;}
      if(current)evidence(current,key);
    };});
    var costs=Array.from(new Set(Object.keys(current?current.costs:{}).concat(Object.keys(previous?previous.costs:{}))));
    function costCell(p,k){return p&&p.cost_display[k]?'<a href="#executive-evidence" data-cost="'+esc(k)+'" data-cost-point="'+esc(p.point_id)+'" title="查看成本來源">'+esc(p.cost_display[k])+'</a>':'—';}
    $('executive-costs').innerHTML=costs.length?'<table><thead><tr><th>Core 科目</th><th>'+esc(previous?date(previous.ts):'上一筆未記錄')+'</th><th>'+esc(current?date(current.ts):'本筆')+'</th></tr></thead><tbody>'+costs.map(function(k){return '<tr><th>'+esc(k)+'</th><td>'+costCell(previous,k)+'</td><td>'+costCell(current,k)+'</td></tr>';}).join('')+'</tbody></table>':'<p class="executive-caption">目前沒有可重播的成本科目；不以總額拆分推估。</p>';
    $('executive-costs').querySelectorAll('[data-cost]').forEach(function(a){a.onclick=function(e){e.preventDefault();evidence(report.points.find(function(p){return p.point_id===a.dataset.costPoint;}),a.dataset.cost);};});
  }
  function renderChart(){
    var key=$('executive-metric').value,points=report.points,valid=points.filter(function(p){return Number.isFinite(p.values[key])&&p.ts;}),host=$('executive-chart');
    text('executive-trend-title',LABELS[key]+'歷史');
    var runtimeLabel=root.UROS_RUNTIME_SOURCE==='same-origin'?'同源':root.UROS_RUNTIME_SOURCE==='cdn-fallback'?'CDN 備援':'來源未回報';
    text('executive-basis',report.basis==='stored-snapshot'?'查詢未完成 · 僅顯示已存快照，不重播或比較':(series==='adopted'?'案件快照／已採用事件':'方案建立時間，未必採用')+' · 依現行 Core '+report.core_version+' 重播 · '+runtimeLabel);
    text('executive-chart-note',valid.length+' 個有值時間點 · 相鄰點連線僅供閱讀');
    var missing=points.filter(function(p){return p.error;});
    $('executive-missing').hidden=!points.length;
    $('executive-missing-summary').textContent='歷史明細（'+points.length+'）'+(missing.length?' · '+missing.length+' 筆缺漏':'');
    $('executive-missing-list').innerHTML=points.map(function(p,i){return '<button type="button" data-history="'+i+'"'+(p.error?' data-missing="true"':'')+'>'+esc(date(p.ts)+' · '+p.label+' · '+(p.error||p.display[key]))+'</button>';}).join('');
    $('executive-missing-list').querySelectorAll('button').forEach(function(b){b.onclick=function(){evidence(points[Number(b.dataset.history)],key);};});
    if(report.basis==='stored-snapshot'){host.innerHTML='<div class="trend-empty">僅查閱已存快照；期間與歷史比較尚未執行。</div>';return;}
    if(!valid.length){host.innerHTML='<div class="trend-empty">'+(key==='funding_gap'?'尚無資金缺口歷史':key==='agreed'?'未保存完整同意數歷史':'此期間沒有可重播的數值')+'</div>';return;}
    var dated=points.filter(function(p){return p.ts&&Number.isFinite(Date.parse(p.ts));});
    var W=Math.max(280,host.clientWidth),H=240,L=90,R=24,T=20,B=38,times=dated.map(function(p){return Date.parse(p.ts);}),values=valid.map(function(p){return p.values[key];});
    var minT=Math.min.apply(null,times),maxT=Math.max.apply(null,times),minV=Math.min.apply(null,values),maxV=Math.max.apply(null,values);
    var x=function(p){return maxT===minT?(W+L-R)/2:L+(Date.parse(p.ts)-minT)/(maxT-minT)*(W-L-R);};
    var y=function(p){return maxV===minV?(H+T-B)/2:H-B-(p.values[key]-minV)/(maxV-minV)*(H-T-B);};
    var path='',wasValid=false;points.forEach(function(p){if(!Number.isFinite(p.values[key])||!p.ts){wasValid=false;return;}path+=(wasValid?' L ':' M ')+x(p)+' '+y(p);wasValid=true;});
    host.innerHTML='<svg viewBox="0 0 '+W+' '+H+'" role="group" aria-label="'+LABELS[key]+'時間序列"><path class="trend-grid" d="M'+L+' '+T+'V'+(H-B)+'H'+(W-R)+'"/><path class="trend-line" d="'+path+'"/>'
      +valid.map(function(p){return '<g><circle tabindex="0" role="button" aria-label="'+esc(date(p.ts)+' '+p.display[key]+' '+p.label)+'" class="trend-point" data-point="'+esc(p.point_id)+'" cx="'+x(p)+'" cy="'+y(p)+'" r="5"/><title>'+esc(p.label+' · '+date(p.ts)+' · '+p.display[key])+'</title></g>';}).join('')
      +'<text x="'+x(dated[0])+'" y="'+(H-12)+'" text-anchor="'+(dated.length===1?'middle':'start')+'">'+esc(date(dated[0].ts))+'</text>'
      +(dated.length>1?'<text x="'+x(dated[dated.length-1])+'" y="'+(H-12)+'" text-anchor="end">'+esc(date(dated[dated.length-1].ts))+'</text>':'')
      +'<text x="'+(L-8)+'" y="'+(y(valid[values.indexOf(maxV)])+3)+'" text-anchor="end">'+esc(valid[values.indexOf(maxV)].display[key])+'</text>'
      +(minV!==maxV?'<text x="'+(L-8)+'" y="'+(y(valid[values.indexOf(minV)])+3)+'" text-anchor="end">'+esc(valid[values.indexOf(minV)].display[key])+'</text>':'')+'</svg>';
    host.querySelectorAll('[data-point]').forEach(function(node){var open=function(){evidence(points.find(function(p){return p.point_id===node.dataset.point;}),key);};node.onclick=open;node.onkeydown=function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}};});
  }
  function renderEvents(){
    $('executive-clear-day').hidden=!day;
    var rows=events.filter(function(e){var d=date(e.ts);return d>=report.range.start&&d<=report.range.end&&(!day||d===day);});
    text('executive-events-title',day?day+' 事件':'期間事件');
    $('executive-events').innerHTML=historyError?'<p class="executive-caption">'+esc(historyError)+'</p>':rows.length?rows.map(function(e,i){return '<button type="button" data-event="'+i+'"><small>'+esc(date(e.ts)+' · '+e.source)+'</small><span>'+esc(e.text)+'</span></button>';}).join(''):'<p class="executive-caption">此期間沒有已登錄事件。</p>';
    $('executive-events').querySelectorAll('[data-event]').forEach(function(b){b.onclick=function(){var e=rows[Number(b.dataset.event)];detail('<p>'+esc(e.text)+'</p><p>'+esc(e.ts)+' · '+esc(e.source)+' · '+esc(e.id)+'</p><a href="report.html#workflow-time">查看案件時間軸 →</a>');};});
  }
  function ready(){if(rt&&rt.failed){rt.terminate();rt=null;}if(rt)return rt.promise;var resolveReady,rejectReady;var promise=new Promise(function(resolve,reject){resolveReady=resolve;rejectReady=reject;});rt=root.createCoreRuntime({onReady:function(){resolveReady(rt);},onError:function(m){rejectReady(Error(root.corePlainError(m.msg)));}});rt.promise=promise;return promise;}
  function storedSnapshot(rec){
    var snap=rec.snap||{},view=rec.view||{},values={},display={},deltas={},identified=/^sha256:[0-9a-f]{64}$/.test(snap.input_hash||'')&&!!snap.core_version;
    Object.keys(LABELS).forEach(function(key){var v=view[key];values[key]=!identified||key==='funding_gap'||key==='agreed'?null:(typeof v==='number'&&Number.isFinite(v)?v:null);
      display[key]=values[key]===null?'—':key==='return_rate'?v.toLocaleString('zh-TW',{style:'percent',maximumFractionDigits:1}):v.toLocaleString('zh-TW',{maximumFractionDigits:1})+(key==='saleable_area'?' 坪':' 萬');deltas[key]={value:null,display:'—'};});
    var point={point_id:'stored',ts:snap.computed_at||null,label:'已存案件快照',source:'snapshot',source_id:((rec.wf||{}).project||{}).active_snapshot||'current',input_hash:snap.input_hash||'',recorded_core_version:snap.core_version||'',core_version:snap.core_version||'',values:values,display:display,costs:{},cost_display:{},error:'未重播；數值直接來自已存 Core 快照，無歷史比較'};
    var start=$('executive-start').value||'1900-01-01',end=$('executive-end').value||date(new Date().toISOString());
    return {basis:'stored-snapshot',core_version:snap.core_version||'',range:{start:start,end:end},points:series==='adopted'?[point]:[],current_id:series==='adopted'?'stored':null,previous_id:null,deltas:deltas};
  }
  async function load(){
    var ticket=++epoch;selected=$('executive-case').value;var rec=records.projects[selected];
    report=null;day=null;$('executive-content').hidden=true;$('executive-empty').hidden=!!rec;if(!rec){status('尚無案件');return;}
    $('executive-query').querySelector('button').disabled=true;status('讀取案件歷史…');
    try{
      historyError='';var data;
      try{data=await Promise.all([root.CaseStore.listScenarios(selected),root.CaseStore.listActivity(selected)]);}catch(storageError){data=[[],[]];historyError='方案／Activity 儲存無法讀取；不視為沒有歷史。';}
      if(ticket!==epoch)return;
      events=root.ProjectPulse.model(rec,data[1],null).changes;
      var points=sources(rec,data[0],data[1],series);
      var runtime=await ready();if(ticket!==epoch)return;
      var answer=await runtime.dashboard({points:points,metric:$('executive-metric').value,period:$('executive-period').value,start:$('executive-period').value==='custom'?$('executive-start').value||null:null,end:$('executive-end').value||null});
      if(ticket!==epoch)return;report=answer.dashboard;
      if(!report||report.schema_version!=='dashboard-0.1'||!report.chart||report.chart.editable!==false||report.chart.draggable!==false||report.chart.interpolation!=='none'||report.chart.x_field!=='ts')throw Error('歷史查詢契約不符');
      $('executive-start').value=report.range.start==='1900-01-01'?'':report.range.start;$('executive-end').value=report.range.end;
      $('executive-content').hidden=false;renderKpis(rec);renderChart();renderEvents();
      status(((rec.snap||{}).code_name||selected)+(rec.demo?' · 合成示範':'')+' · '+(series==='scenarios'?'最新方案，非已採用現況 · ':'')+report.points.length+' 筆歷史 · 較上期＝期間內上一筆，非月平均'+(historyError?' · '+historyError:''),!!historyError);
    }catch(e){if(ticket===epoch){status(root.corePlainError(e.message)+' · 可按查詢重試',true);report=storedSnapshot(rec);$('executive-content').hidden=false;renderKpis(rec);renderChart();renderEvents();}}
    finally{if(ticket===epoch)$('executive-query').querySelector('button').disabled=false;}
  }
  function init(){
    try{records=bus.readStore();}catch(e){status('案件儲存無法讀取',true);return;}
    $('executive-case').innerHTML=records.order.filter(function(pid){return records.projects[pid];}).map(function(pid){var r=records.projects[pid];return '<option value="'+esc(pid)+'">'+esc((r.snap||{}).code_name||pid)+(r.demo?'（示範）':'')+'</option>';}).join('');
    $('executive-case').value=selected&&records.projects[selected]?selected:bus.activePid()||'';
    load();
  }
  $('executive-query').onsubmit=function(e){e.preventDefault();if(this.reportValidity())load();};
  ['executive-case','executive-period','executive-metric'].forEach(function(id){$(id).onchange=load;});
  ['executive-start','executive-end'].forEach(function(id){$(id).onchange=function(){$('executive-period').value='custom';load();};});
  document.querySelectorAll('[data-series]').forEach(function(b){b.onclick=function(){series=b.dataset.series;document.querySelectorAll('[data-series]').forEach(function(n){n.setAttribute('aria-pressed',String(n===b));});load();};});
  $('executive-clear-day').onclick=function(){day=null;renderEvents();};$('executive-close').onclick=function(){$('executive-evidence').close();};
  ['executive-workspace','executive-meeting'].forEach(function(id){$(id).onclick=function(){if(selected)bus.setActive(selected);};});
  $('executive-evidence-body').onclick=function(e){if(e.target.closest('a')&&selected)bus.setActive(selected);};
  var resizeTimer;root.addEventListener('resize',function(){clearTimeout(resizeTimer);resizeTimer=setTimeout(function(){if(report)renderChart();},100);});
  root.addEventListener('storage',function(e){if(!e.key||e.key===bus.KEY)init();});root.addEventListener(bus.EVENT,init);
  root.addEventListener('pagehide',function(e){if(!e.persisted){epoch++;if(rt)rt.terminate();}});
  init();
})(typeof self!=='undefined'?self:this);
