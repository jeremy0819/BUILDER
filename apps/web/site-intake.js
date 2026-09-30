/* Versioned, local-only site facts. Sketch coordinates are not cadastral geometry. */
(function (root) {
  "use strict";
  var VERSION="site-intake-0.1", MAX_PARCELS=8, MAX_POINTS=64;
  var FIELDS=[
    ["city","縣市","select",["臺北市","新北市","桃園市","其他"]],
    ["zoning","使用分區","text",80],
    ["coverage_percent","法定建蔽率（%）","number",100],
    ["road_width_m","臨路寬度（m）","number",200],
    ["reference","資料出處／文件版本","text",160],
    ["checked_on","查核日期","date"]
  ];
  function empty(pid) {return {schema_version:VERSION,project_id:pid,coordinate_space:"normalized-unlocated",parcels:[],land:{}};}
  function validate(value,pid) {
    if(!value||value.schema_version!==VERSION||value.project_id!==pid||value.coordinate_space!=="normalized-unlocated"||!Array.isArray(value.parcels)||value.parcels.length>MAX_PARCELS||!value.land||typeof value.land!=="object"||Array.isArray(value.land))throw new Error("基地草圖格式或案件不符");
    if(Object.keys(value).some(function(k){return !["schema_version","project_id","coordinate_space","parcels","land"].includes(k);})||Object.keys(value.land).some(function(k){return !FIELDS.some(function(f){return f[0]===k;});}))throw new Error("不支援的基地欄位");
    var ids=new Set();
    value.parcels.forEach(function(p){
      if(!p||typeof p.id!=="string"||!/^[a-z0-9-]{1,48}$/.test(p.id)||ids.has(p.id)||typeof p.label!=="string"||p.label.length>40||!Array.isArray(p.points)||p.points.length>MAX_POINTS)throw new Error("地塊資料無效");
      if(Object.keys(p).some(function(k){return !["id","label","points"].includes(k);}))throw new Error("不支援的地塊欄位");
      ids.add(p.id);p.points.forEach(function(point){if(!Array.isArray(point)||point.length!==2||point.some(function(n){return typeof n!=="number"||!Number.isFinite(n)||n<0||n>1;}))throw new Error("草圖座標無效");});
    });
    FIELDS.forEach(function(f){var v=value.land[f[0]];if(v==null||v==="")return;
      if(f[2]==="number" ? typeof v!=="number"||!Number.isFinite(v)||v<0||v>f[3] : typeof v!=="string"||v.length>(f[3] instanceof Array?10:f[3]||10))throw new Error("土地欄位無效");
      if(f[2]==="select"&&!f[3].includes(v))throw new Error("縣市無效");
      if(f[2]==="date"&&!/^\d{4}-\d{2}-\d{2}$/.test(v))throw new Error("日期無效");
    });
    return JSON.parse(JSON.stringify(value));
  }
  function mount(host,rec,onCoverage) {
    var pid=rec.pid||rec.wf.project.project_id, data=empty(pid), selected=0, undo=[], cursor=[0.5,0.5], disposed=false;
    var lastStored=JSON.stringify(rec.site_intake||null);
    var background=root.UROSSecurity&&root.UROSSecurity.imageData((rec.assets||{}).cadastral), showBackground=!!background;
    var initialError="";
    try{if(rec.site_intake)data=validate(rec.site_intake,pid);}catch(e){initialError="既有基地資料版本不支援；原資料未覆蓋。";}
    host.innerHTML='<section class="site-intake" aria-label="基地地塊與查核"><div class="si-heading"><h2>基地地塊</h2><span>手繪草圖 · 未定位</span></div>'
      +'<div class="si-grid"><div><div class="si-tools"><label>地塊<select data-si="parcel" aria-label="選取地塊"></select></label><button type="button" data-si="add">新增地塊</button><button type="button" data-si="undo" title="復原上一個草圖動作" aria-label="復原上一個草圖動作">↶</button><button type="button" data-si="clear">清除此地塊</button></div>'
      +'<label class="si-background"'+(background?'':' hidden')+'><input type="checkbox" checked>地籍底圖 · 僅供描繪，未測量定位</label><svg class="si-canvas" viewBox="0 0 640 360" tabindex="0" role="application" aria-label="基地草圖輸入，點選新增頂點；方向鍵移動游標，Enter 新增，Backspace 復原"></svg>'
      +'<div class="si-caption"><span data-si="summary"></span><span>無測量尺度；面積以右側登記輸入為準</span></div></div>'
      +'<div class="si-fields"><div class="si-core-fields"></div><details><summary>土地與資料來源</summary><form class="si-land-fields"></form><button type="button" data-si="coverage">以建蔽率建立樓板草案</button><p class="si-limit">樓板預設輸入，非建築輪廓或建蔽合規判定。</p></details>'
      +'<details><summary>開發資料查核</summary><div class="si-research"></div><p class="si-limit">官方查詢不附帶案件資料。尚未串接跨站擷取，不會自動填入法定容積、獎勵或成交單價。</p></details></div></div>'
      +'<div class="si-status" role="status" aria-live="polite"></div></section>';
    var q=function(s){return host.querySelector(s);},svg=q("svg"), status=q(".si-status");
    function persist(){
      if(disposed)return false;
      if(initialError){status.textContent=initialError;return false;}
      try{
        var current=root.CaseBus.activeRecord();
        if(!current||(current.pid||current.wf.project.project_id)!==pid)throw new Error("案件已切換");
        if(JSON.stringify(current.site_intake||null)!==lastStored){status.textContent="基地草圖已在其他頁面變更，請重新載入；本次未覆蓋原資料。";return false;}
        var next=JSON.parse(JSON.stringify(current));next.site_intake=validate(data,pid);
        root.CaseBus.replace(pid,next);lastStored=JSON.stringify(next.site_intake);status.textContent="地塊與土地資料已存本機；容積試算須採用草案後同步。";return true;
      }catch(e){status.textContent="基地資料尚未儲存，請檢查案件或儲存空間。";return false;}
    }
    function remember(){undo.push(JSON.parse(JSON.stringify(data.parcels)));if(undo.length>30)undo.shift();}
    function draw(){
      var ns="http://www.w3.org/2000/svg";svg.replaceChildren();
      function shape(tag,attrs){var node=document.createElementNS(ns,tag);Object.keys(attrs).forEach(function(k){node.setAttribute(k,attrs[k]);});svg.appendChild(node);return node;}
      if(background&&showBackground)shape("image",{href:background,x:0,y:0,width:640,height:360,preserveAspectRatio:"xMidYMid meet",opacity:"0.55"});
      for(var x=0;x<=640;x+=40)shape("line",{x1:x,y1:0,x2:x,y2:360,class:"si-gridline"});
      for(var y=0;y<=360;y+=40)shape("line",{x1:0,y1:y,x2:640,y2:y,class:"si-gridline"});
      data.parcels.forEach(function(p,i){
        shape(p.points.length>=3?"polygon":"polyline",{points:p.points.map(function(v){return v[0]*640+","+v[1]*360;}).join(" "),class:"si-parcel"+(i===selected?" selected":"")});
        p.points.forEach(function(v,n){shape("circle",{cx:v[0]*640,cy:v[1]*360,r:5,class:"si-vertex"});var t=shape("text",{x:v[0]*640+8,y:v[1]*360-8,class:"si-point-label"});t.textContent=n+1;});
      });
      shape("circle",{cx:cursor[0]*640,cy:cursor[1]*360,r:7,class:"si-cursor"});
      var select=q('[data-si="parcel"]');select.replaceChildren();
      data.parcels.forEach(function(p,i){var o=document.createElement("option");o.value=i;o.textContent=p.label;select.appendChild(o);});select.value=selected;
      var active=data.parcels[selected];q('[data-si="summary"]').textContent=active?active.label+" · "+active.points.length+" 個頂點"+(active.points.length<3?" · 尚未成面":" · 使用者草圖"):"尚無地塊";
      q('[data-si="add"]').disabled=data.parcels.length>=MAX_PARCELS;
      q('[data-si="undo"]').disabled=!undo.length;q('[data-si="clear"]').disabled=!active;
    }
    function addParcel(){if(data.parcels.length>=MAX_PARCELS)return;remember();data.parcels.push({id:"p-"+root.crypto.randomUUID(),label:"地塊 "+(data.parcels.length+1),points:[]});selected=data.parcels.length-1;draw();persist();}
    function addPoint(point){if(!data.parcels.length)addParcel();var p=data.parcels[selected];if(p.points.length>=MAX_POINTS){status.textContent="每個地塊最多 64 個頂點。";return;}remember();p.points.push(point.map(function(n){return Math.max(0,Math.min(1,Number(n.toFixed(5))));}));draw();persist();}
    q('[data-si="add"]').onclick=addParcel;
    q('[data-si="parcel"]').onchange=function(e){selected=Number(e.target.value);draw();};
    q('.si-background input').onchange=function(e){showBackground=e.target.checked;draw();};
    function restore(){if(undo.length){data.parcels=undo.pop();selected=Math.max(0,Math.min(selected,data.parcels.length-1));draw();persist();}}
    q('[data-si="undo"]').onclick=restore;
    q('[data-si="clear"]').onclick=function(){if(!data.parcels[selected]||!root.confirm("清除此地塊？可用復原還原。"))return;remember();data.parcels.splice(selected,1);selected=0;draw();persist();};
    svg.addEventListener("click",function(e){var box=svg.getBoundingClientRect();cursor=[(e.clientX-box.left)/box.width,(e.clientY-box.top)/box.height];addPoint(cursor);});
    svg.addEventListener("keydown",function(e){if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Enter","Backspace"].includes(e.key))return;e.preventDefault();if(e.key==="Enter")addPoint(cursor);else if(e.key==="Backspace")restore();else{var axis=/Left|Right/.test(e.key)?0:1;cursor[axis]=Math.max(0,Math.min(1,cursor[axis]+(/Left|Up/.test(e.key)?-0.02:0.02)));draw();}});
    FIELDS.forEach(function(f){var label=document.createElement("label");label.textContent=f[1];var input=document.createElement(f[2]==="select"?"select":"input");input.dataset.land=f[0];
      if(f[2]==="select"){[""].concat(f[3]).forEach(function(v){var o=document.createElement("option");o.value=v;o.textContent=v||"未指定";input.appendChild(o);});}
      else{input.type=f[2];if(f[2]==="number"){input.min=0;input.max=f[3];input.step="any";}else if(f[3])input.maxLength=f[3];}
      input.value=data.land[f[0]]==null?"":data.land[f[0]];
      input.addEventListener("change",function(){if(!input.checkValidity()){input.reportValidity();return;}data.land[f[0]]=input.value===""?null:f[2]==="number"?input.valueAsNumber:input.value;persist();});label.appendChild(input);q(".si-land-fields").appendChild(label);
    });
    q(".si-land-fields").onsubmit=function(e){e.preventDefault();};
    q('[data-si="coverage"]').onclick=function(){var input=q('[data-land="coverage_percent"]');if(!input.value||!input.checkValidity()||input.valueAsNumber<=0){status.textContent="請先填入有效建蔽率。";return;}if(onCoverage)onCoverage(input.valueAsNumber);};
    var refs=[
      ["土地使用分區／細部計畫","https://pip.moi.gov.tw/Publicize/Info/Z2060"],
      ["地籍與測繪圖資","https://maps.nlsc.gov.tw/"],
      ["成交、租賃與預售價格","https://lvr.land.moi.gov.tw/"],
      ["中央與地方都更法規","https://uract.nlma.gov.tw/"]
    ];
    refs.forEach(function(r){var a=document.createElement("a");a.href=r[1];a.textContent=r[0];a.target="_blank";a.rel="noopener noreferrer";q(".si-research").appendChild(a);});
    if(initialError)status.textContent=initialError;draw();
    return {fields:q(".si-core-fields"),dispose:function(){disposed=true;},data:function(){return validate(data,pid);}};
  }
  root.SiteIntake={VERSION:VERSION,validate:validate,empty:empty,mount:mount};
})(typeof self!=="undefined"?self:this);
