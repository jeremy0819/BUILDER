/* Workspace viewport. The child receives no project inputs or result bindings. */
(function(root){
  "use strict";
  const frameURL="spatial-prototype.html?embed=1";
  function fill(host,rec){
    const snap=rec&&rec.snap||{},site=snap.site||{};
    host.querySelector('[data-stage="name"]').textContent=snap.code_name||"尚未選擇案件";
    host.querySelector('[data-stage="kind"]').textContent=rec?(rec.demo?"合成示範案":"本機案件"):"開始一個新計畫";
    host.querySelector('[data-stage="area"]').textContent=typeof site.site_area_sqm==="number"?site.site_area_sqm.toLocaleString("zh-TW")+" ㎡":"—";
    host.querySelector('[data-stage="version"]').textContent=snap.core_version||"—";
    host.querySelector('[data-stage="hash"]').textContent=snap.input_hash||"尚無計算快照";
    const resume=host.querySelector('[data-stage="resume"]');
    resume.href=rec?(rec.engine?"dashboard.html#site-massing-host":"dashboard.html"):"index.html#entry";
    resume.textContent=rec?(rec.engine?"查看本案樓層 →":"查看本案資料 →"):"建立案件 →";
  }
  function mount(host,rec){
    if(!host)return;
    host.classList.add("spatial-stage");
    host.setAttribute("aria-label","專案空間工作台");
    host.innerHTML=`<div class="stage-context">
      <div><span class="stage-eyebrow" data-stage="kind"></span><h2 data-stage="name"></h2></div>
      <a class="stage-switch" href="workspace.html#cases">切換案件 ↗</a>
    </div><div class="stage-layout">
      <div class="stage-viewport"><div class="stage-view-title"><span class="stage-live-dot" aria-hidden="true"></span><b>3D 操作展示</b><span>合成場景 · 非本案量體</span></div>
        <iframe src="${frameURL}" title="可互動的合成 3D 量體，未綁定本案" loading="eager" referrerpolicy="no-referrer"></iframe>
        <div class="stage-caption"><span>拖曳旋轉，選取量體查看來源。</span><a href="spatial-prototype.html" target="_blank" rel="noopener">獨立開啟與來源資料 ↗</a></div>
      </div>
      <aside class="stage-console" aria-label="本案資料與工具">
        <span class="stage-eyebrow">本案資料</span><div class="stage-metric"><span>基地面積</span><strong data-stage="area"></strong></div>
        <div class="stage-readiness"><span class="stage-missing" aria-hidden="true">◇</span><div><b>空間資料待補</b><p>本案尚無具來源的輪廓與高度。左側為獨立合成展示，切換案件不會改變該模型。</p></div></div>
        <a class="stage-primary" data-stage="resume" href="dashboard.html#site-massing-host">查看本案樓層 →</a>
        <nav class="stage-dock" aria-label="專案工具"><a href="dashboard.html"><span>01</span>基地與樓層<i>↗</i></a><a href="evaluator.html"><span>02</span>產品與財務<i>↗</i></a><a href="os-simulator.html"><span>03</span>地主與任務<i>↗</i></a><a href="report.html"><span>04</span>比較與決策<i>↗</i></a></nav>
        <details class="stage-provenance"><summary>本案快照來源</summary><span>Core <b data-stage="version"></b></span><code data-stage="hash"></code></details>
      </aside></div>`;
    fill(host,rec);
  }
  function current(){try{return root.CaseBus&&root.CaseBus.activeRecord();}catch(e){return null;}}
  function refresh(){document.querySelectorAll(".spatial-stage").forEach(host=>fill(host,current()));}
  function init(){
    document.querySelectorAll("[data-spatial-stage]").forEach(host=>mount(host,current()));
    root.addEventListener("uros:case-changed",refresh);
    root.addEventListener("storage",event=>{if(!event.key||["uros.workflow.v1","uros.active_case"].includes(event.key))refresh();});
  }
  root.SpatialStage={mount};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})(window);
