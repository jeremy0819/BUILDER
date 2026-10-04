/* Mount shared panels once, inside their owning step. */
(function(root){
function init(){
  const file=location.pathname.split("/").pop(),groups={"dashboard.html":["mass"],"evaluator.html":["fin"],"os-simulator.html":["bench","board","task"],"report.html":["dec","time","attr"]};
  if(!groups[file] || !root.CaseBus || !root.WorkflowPanels)return;
  const host=document.createElement("section");host.id="workflow-tools";host.setAttribute("aria-label","本步案件紀錄");
  let disclosure=null;
  if(file==="os-simulator.html"){
    const play=document.getElementById("integration-play"),nav=document.createElement("nav");nav.className="people-mode";nav.setAttribute("aria-label","地主工作模式");
    nav.innerHTML='<div class="people-mode-context"><b>地主整合 · 案件紀錄</b><span>逐戶事實、同意事件與任務留在正式工作區；沙盤使用獨立的合成案例。</span></div><button type="button" data-mode="records" aria-pressed="true">返回案件紀錄</button><button type="button" data-mode="play" aria-pressed="false">開啟策略沙盤（示意） ↗</button>';
    play.before(nav,host);
    function mode(key,updateUrl){
      play.hidden=key!=="play";host.hidden=key==="play";nav.dataset.mode=key;
      nav.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.mode===key)));
      if(updateUrl){const url=new URL(location.href);if(key==="play")url.searchParams.set("tool","simulation");else url.searchParams.delete("tool");history.replaceState(null,"",url);}
    }
    nav.querySelectorAll("button").forEach(b=>b.onclick=()=>mode(b.dataset.mode,true));
    mode(new URLSearchParams(location.search).get("tool")==="simulation"&&!location.hash.startsWith("#workflow-")?"play":"records",false);
    root.addEventListener("hashchange",()=>{if(location.hash.startsWith("#workflow-"))mode("records",true);});
    root.addEventListener("uros:workflow-open",()=>mode("records",true));
  }else if(file==="dashboard.html"){
    disclosure=document.createElement("details");disclosure.id="site-workflow-records";disclosure.className="uros-site-extra site-workflow-records";
    const summary=document.createElement("summary");summary.textContent="案件紀錄與樓層明細";disclosure.append(summary,host);
    const casews=document.getElementById("casews");if(casews)casews.after(disclosure);else document.body.appendChild(disclosure);
  }else document.body.appendChild(host);
  const panel=root.WorkflowPanels.mount(host,groups[file]);
  if(location.hash.startsWith("#workflow-")){if(disclosure)disclosure.open=true;host.scrollIntoView();}
  root.addEventListener("uros:workflow-open",event=>{if(groups[file].includes(event.detail)){if(disclosure)disclosure.open=true;panel.show(event.detail);host.scrollIntoView();}});
  root.addEventListener("pagehide",event=>{if(!event.persisted)panel.destroy();});

}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})(window);
