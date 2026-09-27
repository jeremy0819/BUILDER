/* Mount shared panels once, inside their owning step. */
(function(root){
function init(){
  const file=location.pathname.split("/").pop(),groups={"dashboard.html":["mass"],"evaluator.html":["fin"],"os-simulator.html":["bench","board","task"],"report.html":["dec","time","attr"]};
  if(!groups[file] || !root.CaseBus || !root.WorkflowPanels)return;
  const host=document.createElement("section");host.id="workflow-tools";host.setAttribute("aria-label","本步案件紀錄");
  if(file==="os-simulator.html"){
    const play=document.getElementById("integration-play"),nav=document.createElement("nav");nav.className="people-mode";nav.setAttribute("aria-label","地主工作模式");
    nav.innerHTML='<button type="button" data-mode="records" aria-pressed="true">案件紀錄</button><button type="button" data-mode="play" aria-pressed="false">整合推演（示意）</button>';
    play.before(nav,host);
    function mode(key){play.hidden=key!=="play";host.hidden=key==="play";nav.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.mode===key)));}
    nav.querySelectorAll("button").forEach(b=>b.onclick=()=>mode(b.dataset.mode));
    root.addEventListener("hashchange",()=>{if(location.hash.startsWith("#workflow-"))mode("records");});
    root.addEventListener("uros:workflow-open",()=>mode("records"));
  }else document.body.appendChild(host);
  const panel=root.WorkflowPanels.mount(host,groups[file]);
  if(location.hash.startsWith("#workflow-"))host.scrollIntoView();
  root.addEventListener("uros:workflow-open",event=>{if(groups[file].includes(event.detail)){panel.show(event.detail);host.scrollIntoView();}});
  root.addEventListener("pagehide",event=>{if(!event.persisted)panel.destroy();});
  if(file==="dashboard.html"){
    const entry=document.createElement("div");entry.className="spatial-entry";
    entry.innerHTML='<strong>空間檢視 · 資料成熟度</strong><p>本案可檢視樓層面積；正式基地邊界、建築輪廓與高度尚無契約。3D 展示使用獨立合成資料。</p><a href="spatial-prototype.html">開啟 3D 操作展示 ↗</a>';
    host.prepend(entry);
  }
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})(window);
