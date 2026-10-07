/* Product inputs use the same ephemeral planning session as Site. No finance formulas. */
(function (root) {
  "use strict";
  var FIELDS = [
    {key:"住宅單價",label:"住宅單價（萬／坪）",min:0,max:1000,step:1},
    {key:"營造單價",label:"營造單價（萬／坪）",min:0,max:1000,step:0.5},
    {key:"公設比",label:"公設比（倍數）",min:0,max:0.95,step:0.005},
    {key:"車位數",label:"車位數",min:0,max:10000,step:1}
  ];
  var MORE_FIELDS = [
    {key:"店舖坪數",label:"店舖坪數（坪）",min:0,max:100000,step:1},
    {key:"店舖單價",label:"店舖單價（萬／坪）",min:0,max:10000,step:1},
    {key:"車位單價",label:"車位單價（萬）",min:0,max:10000,step:1},
    {key:"土融土地成本",label:"土地取得成本（萬）",min:0,max:100000000,step:1}
  ];
  var OUTPUTS = [["saleable_area","銷售坪數（坪）"],["total_sales","總銷（萬）"],["shared_cost","共同負擔（萬）"],["shared_cost_ratio","共同負擔比",true],["owner_return_value","地主分回（萬）"],["return_rate","全案投報率",true]];
  function inputTarget(engine,key) {
    var override=engine.params.財務覆寫;
    return key!=="公設比" && override && Object.prototype.hasOwnProperty.call(override,inputKey(engine,key)) ? override : engine.params;
  }
  function inputKey(engine,key){return key==="土融土地成本"&&engine.params.財務覆寫&&Object.prototype.hasOwnProperty.call(engine.params.財務覆寫,"土地成本")?"土地成本":key;}
  function format(value, ratio) {
    if (typeof value !== "number" || !Number.isFinite(value)) return "—";
    return ratio ? (value*100).toFixed(1)+"%" : value.toLocaleString("zh-TW",{maximumFractionDigits:2});
  }
  function cashflowHTML(c) {
    if(!c)return '<p class="pp-note">尚無與本次試算綁定的成本分期；請完成 Core 重算。</p>';
    var esc=root.UROSSecurity.esc;
    return '<p class="pp-note">Core 成本科目（萬） · '+esc(c.core_version)+' · '+esc(c.input_hash.slice(7,19))+'</p>'
      +'<table><thead><tr><th>共同負擔科目</th><th>金額（萬）</th></tr></thead><tbody>'
      +Object.entries(c.科目||{}).map(function(p){return '<tr><th>'+esc(p[0])+'</th><td>'+format(p[1])+'</td></tr>';}).join('')+'</tbody></table>'
      +'<table><thead><tr><th>期別</th><th>支出（萬）</th><th>累積支出（萬）</th></tr></thead><tbody>'
      +(c.期別出資||[]).map(function(v,i){return '<tr><th>'+(i+1)+'</th><td>'+format(v)+'</td><td>'+format(c.累積[i])+'</td></tr>';}).join('')+'</tbody></table>'
      +'<p class="pp-note">均勻分期示意，未校準工程時程。未含銷售回款、借款撥還及自有資金；累積支出不是淨資金缺口。IRR／NPV 尚未計算。</p>';
  }
  function mount(host, rec) {
    var runtime, session, draft = rec && rec.engine && JSON.parse(JSON.stringify(rec.engine));
    if (!draft) {
      host.innerHTML='<div class="product-planning"><h2>尚無可重算的產品方案</h2><p>請先建立案件，或匯入含樓層輸入的案件資料。</p><a href="index.html?new=1#entry">建立案件</a> · <a href="workspace.html">匯入案件</a></div>';
      return {dispose:function () {}};
    }
    host.innerHTML='<section class="product-planning" aria-label="產品與財務試算"><div class="pp-title"><h2>產品條件</h2><button type="button" data-pp="reset">還原案件</button></div>'
      +'<p>沿用①樓層方案 · 本次試算尚未採用</p><div class="pp-grid"><form class="pp-inputs"></form><div><h2>財務比較 <span class="sm-source">CORE</span></h2>'
      +'<div class="pp-results"></div><div class="pp-status" role="status" aria-live="polite"></div><div class="pp-warnings"></div></div></div>'
      +'<details class="pp-finance-detail"><summary>銷售組成與土地成本</summary><div class="pp-more-fields"></div></details>'
      +'<details class="pp-finance-detail"><summary>成本科目與分期支出</summary><div class="pp-cashflow"></div></details>'
      +'<div class="pp-actions"><button type="button" data-pp="run">Core 重算</button><button type="button" data-pp="apply" disabled>採用產品，前往③人心</button><a href="os-simulator.html" data-pp="skip">沿用案件快照，前往③</a></div>'
      +'<div id="scenario-comparison" class="pp-scenario-host"></div></section>';
    var q=function (s) { return host.querySelector(s); };
    var compare;
    function show(state) {
      q(".pp-status").textContent=state.message;
      q('[data-pp="apply"]').disabled=state.phase!=="ready";
      q('[data-pp="run"]').disabled=state.phase==="running"||state.phase==="invalid";
      var result=state.response && state.response.result;
      q('.pp-cashflow').innerHTML=cashflowHTML(state.response && root.CaseBus.boundCashflow(state.response.cashflow,state.response.input_hash,result.core_version));
      q(".pp-results").innerHTML='<table><thead><tr><th>指標</th><th>案件快照</th><th>本次試算</th></tr></thead><tbody>'+OUTPUTS.map(function (o) {
        return '<tr><th>'+o[1]+'</th><td>'+format(rec.view && rec.view[o[0]],o[2])+'</td><td>'+format(result && result[o[0]],o[2])+'</td></tr>';
      }).join("")+'</tbody></table>';
      q(".pp-warnings").textContent=result?(result.warnings||[]).map(function (w) {return typeof w==="string"?w:w.message||w.msg||w.code||"";}).join("；"):"";
      if(compare)compare.updateDraft(state);
    }
    function getRuntime() {
      if (!runtime || runtime.failed) runtime=root.createCoreRuntime({});
      return runtime;
    }
    session=root.PlanningSession.create(rec,getRuntime,show);
    if(root.ScenarioCompare&&root.CaseStore)compare=root.ScenarioCompare.mount(q(".pp-scenario-host"),rec,getRuntime,function(){return session.state();},function(){session.dispose();root.location.reload();});
    FIELDS.concat(MORE_FIELDS).forEach(function (field) {
      var label=document.createElement("label");label.textContent=field.label;
      var number=document.createElement("input"), range=document.createElement("input");
      number.type="number";range.type="range";
      var value=inputTarget(draft,field.key)[inputKey(draft,field.key)];
      [number,range].forEach(function (input) {input.min=field.min;input.max=Math.max(field.max,Number(value)||0);input.step=input===number&&field.key!=="車位數"?"any":field.step;input.value=value==null?"":value;input.dataset.param=field.key;});
      number.required=true;range.setAttribute("aria-label",field.label+"滑桿");
      function edit(input,other) {
        if(input.validity.valid){inputTarget(draft,field.key)[inputKey(draft,field.key)]=input.valueAsNumber;other.value=input.value;}
        var valid=Array.from(host.querySelectorAll('input[type="number"]')).every(function (i) {return i.validity.valid;});
        session.update(draft,valid);if(valid)session.schedule();
      }
      number.addEventListener("input",function () {edit(number,range);});range.addEventListener("input",function () {edit(range,number);});
      label.appendChild(number);if(FIELDS.includes(field))label.appendChild(range);q(FIELDS.includes(field)?".pp-inputs":".pp-more-fields").appendChild(label);
    });
    q(".pp-inputs").addEventListener("submit",function (e) {e.preventDefault();session.run();});
    q('[data-pp="run"]').addEventListener("click",function () {session.retry();});
    q('[data-pp="reset"]').addEventListener("click",function () {draft=JSON.parse(JSON.stringify(rec.engine));host.querySelectorAll("[data-param]").forEach(function (i) {i.value=inputTarget(draft,i.dataset.param)[inputKey(draft,i.dataset.param)];});session.reset();});
    q('[data-pp="apply"]').addEventListener("click",function () {try {session.accept();root.location.href="os-simulator.html";} catch(err){q(".pp-status").textContent=root.PlanningSession.saveError(err);}});
    q('[data-pp="skip"]').addEventListener("click",function (e) {if(session.state().dirty&&!root.confirm("本次產品尚未採用。捨棄試算，沿用案件快照？"))e.preventDefault();else session.dispose();});
    show(session.state());session.schedule(0);
    return {dispose:function () {session.dispose();if(compare)compare.dispose();if(runtime)runtime.terminate();}};
  }
  root.ProductPlanning={mount:mount,inputTarget:inputTarget,inputKey:inputKey,cashflowHTML:cashflowHTML};
})(typeof self!=="undefined"?self:this);
