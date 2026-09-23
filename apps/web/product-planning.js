/* Product inputs use the same ephemeral planning session as Site. No finance formulas. */
(function (root) {
  "use strict";
  var FIELDS = [
    {key:"住宅單價",label:"住宅單價（萬／坪）",min:0,max:1000,step:1},
    {key:"營造單價",label:"營造單價（萬／坪）",min:0,max:1000,step:0.5},
    {key:"公設比",label:"公設比（倍數）",min:0,max:0.95,step:0.005},
    {key:"車位數",label:"車位數",min:0,max:10000,step:1}
  ];
  var OUTPUTS = [["saleable_area","銷售坪數（坪）"],["efficiency_ratio","銷售坪效（倍）"],["shared_cost_ratio","共同負擔比",true],["return_rate","全案投報率",true]];
  function inputTarget(engine,key) {
    var override=engine.params.財務覆寫;
    return key!=="公設比" && override && Object.prototype.hasOwnProperty.call(override,key) ? override : engine.params;
  }
  function format(value, ratio) {
    if (typeof value !== "number" || !Number.isFinite(value)) return "—";
    return ratio ? (value*100).toFixed(1)+"%" : value.toLocaleString("zh-TW",{maximumFractionDigits:2});
  }
  function mount(host, rec) {
    var runtime, session, draft = rec && rec.engine && JSON.parse(JSON.stringify(rec.engine));
    if (!draft) {
      host.innerHTML='<div class="product-planning"><h2>尚無可重算的產品方案</h2><p>請先建立案件，或匯入含樓層輸入的案件資料。</p><a href="index.html#entry">建立案件</a> · <a href="workspace.html">匯入案件</a></div>';
      return {dispose:function () {}};
    }
    host.innerHTML='<section class="product-planning" aria-label="產品與財務試算"><div class="pp-title"><h2>產品條件</h2><button type="button" data-pp="reset">還原案件</button></div>'
      +'<p>沿用①樓層方案 · 本次試算尚未採用</p><div class="pp-grid"><form class="pp-inputs"></form><div><h2>財務比較 <span class="sm-source">CORE</span></h2>'
      +'<div class="pp-results"></div><div class="pp-status" role="status" aria-live="polite"></div><div class="pp-warnings"></div></div></div>'
      +'<div class="pp-actions"><button type="button" data-pp="run">Core 重算</button><button type="button" data-pp="apply" disabled>採用產品，前往③人心</button><a href="os-simulator.html" data-pp="skip">沿用案件快照，前往③</a></div></section>';
    var q=function (s) { return host.querySelector(s); };
    function show(state) {
      q(".pp-status").textContent=state.message;
      q('[data-pp="apply"]').disabled=state.phase!=="ready";
      q('[data-pp="run"]').disabled=state.phase==="running"||state.phase==="invalid";
      var result=state.response && state.response.result;
      q(".pp-results").innerHTML='<table><thead><tr><th>指標</th><th>案件快照</th><th>本次試算</th></tr></thead><tbody>'+OUTPUTS.map(function (o) {
        return '<tr><th>'+o[1]+'</th><td>'+format(rec.view && rec.view[o[0]],o[2])+'</td><td>'+format(result && result[o[0]],o[2])+'</td></tr>';
      }).join("")+'</tbody></table>';
      q(".pp-warnings").textContent=result?(result.warnings||[]).map(function (w) {return typeof w==="string"?w:w.message||w.msg||w.code||"";}).join("；"):"";
    }
    function getRuntime() {
      if (!runtime || runtime.failed) runtime=root.createCoreRuntime({});
      return runtime;
    }
    session=root.PlanningSession.create(rec,getRuntime,show);
    FIELDS.forEach(function (field) {
      var label=document.createElement("label");label.textContent=field.label;
      var number=document.createElement("input"), range=document.createElement("input");
      number.type="number";range.type="range";
      var value=inputTarget(draft,field.key)[field.key];
      [number,range].forEach(function (input) {input.min=field.min;input.max=Math.max(field.max,Number(value)||0);input.step=input===number&&field.key!=="車位數"?"any":field.step;input.value=value==null?"":value;input.dataset.param=field.key;});
      number.required=true;range.setAttribute("aria-label",field.label+"滑桿");
      function edit(input,other) {
        if(input.validity.valid){inputTarget(draft,field.key)[field.key]=input.valueAsNumber;other.value=input.value;}
        var valid=Array.from(host.querySelectorAll('input[type="number"]')).every(function (i) {return i.validity.valid;});
        session.update(draft,valid);if(valid)session.schedule();
      }
      number.addEventListener("input",function () {edit(number,range);});range.addEventListener("input",function () {edit(range,number);});
      label.appendChild(number);label.appendChild(range);q(".pp-inputs").appendChild(label);
    });
    q(".pp-inputs").addEventListener("submit",function (e) {e.preventDefault();session.run();});
    q('[data-pp="run"]').addEventListener("click",function () {session.retry();});
    q('[data-pp="reset"]').addEventListener("click",function () {draft=JSON.parse(JSON.stringify(rec.engine));host.querySelectorAll("[data-param]").forEach(function (i) {i.value=inputTarget(draft,i.dataset.param)[i.dataset.param];});session.reset();});
    q('[data-pp="apply"]').addEventListener("click",function () {try {session.accept();root.location.href="os-simulator.html";} catch(err){q(".pp-status").textContent=root.PlanningSession.saveError(err);}});
    q('[data-pp="skip"]').addEventListener("click",function (e) {if(session.state().dirty&&!root.confirm("本次產品尚未採用。捨棄試算，沿用案件快照？"))e.preventDefault();else session.dispose();});
    show(session.state());session.schedule(0);
    return {dispose:function () {session.dispose();if(runtime)runtime.terminate();}};
  }
  root.ProductPlanning={mount:mount,inputTarget:inputTarget};
})(typeof self!=="undefined"?self:this);
