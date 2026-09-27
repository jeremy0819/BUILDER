import {fixture, geometryHash, validateDemo} from "./fixture.mjs";

const $ = id => document.getElementById(id);
$("runtime").hidden = !(["127.0.0.1","localhost"].includes(location.hostname) && !location.pathname.endsWith("spatial-prototype.html"));
let runtime, cleanup = () => {}, resume = () => {};
function select(id) {
  const building = fixture.buildings.find(b => b.id === id);
  $("selection").textContent = building ? "合成量體 A" : id === fixture.site.id ? "合成基地" : "尚未選取";
  $("object-id").textContent = id || "—";
  $("height").textContent = building ? building.height + " m" : "—";
  document.querySelectorAll("[data-object]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.object === id)));
}
function fallback(message) {
  $("fallback").hidden = false;
  $("fallback").textContent = message;
  $("viewer-status").textContent = "3D 不可用 · 原始資料可讀";
  document.querySelectorAll(".toolbar button, [data-visibility]").forEach(b => {b.disabled = true;});
  document.querySelectorAll("[data-object]").forEach(b => {b.onclick = () => select(b.dataset.object);});
  $("scene").hidden = true;
}
function showSourceData() {
  $("source-version").textContent = fixture.geometry_source_version;
  $("generated-at").textContent = fixture.generated_at;
  $("coordinate-system").textContent = fixture.coordinate_system;
  const rows = [{id:fixture.site.id, points:fixture.site.boundary, height:null}, ...fixture.buildings.map(b => ({id:b.id,points:b.footprint,height:b.height}))];
  for (const object of rows) {
    const row = document.createElement("tr");
    for (const value of [object.id, object.points.map(([x,z]) => `(${x}, ${z})`).join(" · "), object.height === null ? "—" : String(object.height)]) {
      const cell = document.createElement("td");cell.textContent = value;row.append(cell);
    }
    $("geometry-rows").append(row);
  }
}

try {
  validateDemo(fixture);
  // Populate the source table before loading WebGL so it survives a missing GPU or vendor file.
  showSourceData();
  $("geometry-hash").textContent = await geometryHash(fixture);
  const THREE = await import("three");
  const {OrbitControls} = await import("./vendor/OrbitControls.js");
  const host = $("scene"), renderer = new THREE.WebGLRenderer({antialias:true,alpha:false});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.setClearColor(0xf1f4f5);
  host.append(renderer.domElement);
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-50,50,50,-50,0.1,600);
  const controls = new OrbitControls(camera,renderer.domElement);
  const objects = [], resources = [], edges = new Map();
  let observer, mode = "iso", renders = 0, selected = null, disposed = false, queued = false;
  cleanup = () => {if(disposed)return;disposed=true;observer?.disconnect();controls.dispose();resources.forEach(r=>r.dispose());renderer.dispose();};
  controls.enableDamping = false;
  controls.minZoom = .5;controls.maxZoom = 4;
  controls.maxPolarAngle = Math.PI / 2 - .02;
  controls.listenToKeyEvents(host);
  scene.add(new THREE.HemisphereLight(0xffffff,0x84908b,2));
  const sun = new THREE.DirectionalLight(0xffffff,2);sun.position.set(30,60,40);scene.add(sun);
  function meshFor(points,height,color,id) {
    const shape = new THREE.Shape(points.map(([x,z]) => new THREE.Vector2(x,-z)));
    const geometry = height ? new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false,steps:1}) : new THREE.ShapeGeometry(shape);
    geometry.rotateX(-Math.PI/2);
    const material = new THREE.MeshLambertMaterial({color,side:THREE.DoubleSide});
    const mesh = new THREE.Mesh(geometry,material);mesh.userData.id = id;
    if (!height) mesh.position.y = -.08;
    scene.add(mesh);objects.push(mesh);resources.push(geometry,material);
    const edgeGeometry = new THREE.EdgesGeometry(geometry), lineMaterial = new THREE.LineBasicMaterial({color:height?0x23694e:0x849394});
    const line = new THREE.LineSegments(edgeGeometry,lineMaterial);line.position.copy(mesh.position);scene.add(line);
    edges.set(mesh,line);resources.push(edgeGeometry,lineMaterial);
    return mesh;
  }
  const site = meshFor(fixture.site.boundary,0,0xdce3e2,fixture.site.id);
  for (const building of fixture.buildings) meshFor(building.footprint,building.height,0x58ac86,building.id);
  const bounds = new THREE.Box3();objects.forEach(o=>bounds.expandByObject(o));
  const sphere = bounds.getBoundingSphere(new THREE.Sphere());
  let viewSphere = sphere.clone();
  function render() {if(disposed)return;renderer.render(scene,camera);renders++;}
  function schedule() {if(!queued&&!disposed){queued=true;requestAnimationFrame(()=>{queued=false;render();});}}
  function resize() {
    const width=host.clientWidth,height=host.clientHeight;if(!width||!height)return;
    const aspect=width/height,half=viewSphere.radius*1.16/Math.min(aspect,1);
    camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;
    camera.updateProjectionMatrix();renderer.setSize(width,height,false);schedule();
  }
  function frame(nextSphere, value=mode) {
    viewSphere=nextSphere.clone();mode=value;controls.target.copy(viewSphere.center);camera.zoom=1;
    camera.position.copy(viewSphere.center).add(value==="top"?new THREE.Vector3(0,120,.01):new THREE.Vector3(85,70,85));
    camera.up.set(0,1,0);camera.lookAt(viewSphere.center);camera.updateProjectionMatrix();controls.update();
    $("iso").setAttribute("aria-pressed",String(value==="iso"));$("top").setAttribute("aria-pressed",String(value==="top"));
    resize();
  }
  function highlight(id) {
    selected=id;select(id);$("focus").disabled=!id;
    objects.forEach(o=>o.material.color.set(o.userData.id===id?0xe1b34b:o===site?0xdce3e2:0x58ac86));
    schedule();
  }
  function setVisible(id, visible) {
    const object=objects.find(o=>o.userData.id===id);if(!object)return;
    object.visible=visible;edges.get(object).visible=visible;
    document.querySelectorAll("[data-visibility]").forEach(input=>{if(input.dataset.visibility===id)input.checked=visible;});
    if(!visible&&selected===id)highlight(null);
    $("viewer-status").textContent=objects.some(o=>o.visible)?"合成模型 · 同源載入":"物件已全部隱藏 · 可勾選顯示或重設";
    schedule();
  }
  function setPan(on) {
    $("pan").setAttribute("aria-pressed",String(on));
    controls.mouseButtons.LEFT=on?THREE.MOUSE.PAN:THREE.MOUSE.ROTATE;
    controls.touches.ONE=on?THREE.TOUCH.PAN:THREE.TOUCH.ROTATE;
  }
  $("iso").onclick=()=>frame(viewSphere,"iso");$("top").onclick=()=>frame(viewSphere,"top");
  $("focus").onclick=()=>{const object=objects.find(o=>o.userData.id===selected);if(object)frame(new THREE.Box3().setFromObject(object).getBoundingSphere(new THREE.Sphere()));};
  $("overview").onclick=()=>frame(sphere);
  $("reset").onclick=()=>{objects.forEach(o=>setVisible(o.userData.id,true));setPan(false);highlight(null);frame(sphere,"iso");};
  for(const [id,factor] of [["zoom-in",1.2],["zoom-out",1/1.2]]) $(id).onclick=()=>{camera.zoom=THREE.MathUtils.clamp(camera.zoom*factor,.5,4);camera.updateProjectionMatrix();schedule();};
  $("pan").onclick=()=>setPan($("pan").getAttribute("aria-pressed")!=="true");
  document.querySelectorAll("[data-visibility]").forEach(input=>{input.onchange=()=>setVisible(input.dataset.visibility,input.checked);});
  document.querySelectorAll("[data-object]").forEach(b=>{b.onclick=()=>{setVisible(b.dataset.object,true);highlight(b.dataset.object);};});
  const raycaster=new THREE.Raycaster();
  function hit(event) {
    const rect=renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),camera);
    return raycaster.intersectObjects(objects.filter(o=>o.visible))[0]?.object;
  }
  let start, wasMultiPointer=false;
  const pointers=new Set();
  renderer.domElement.addEventListener("pointerdown",e=>{pointers.add(e.pointerId);if(pointers.size===1){start={x:e.clientX,y:e.clientY,id:e.pointerId};wasMultiPointer=false;}else{wasMultiPointer=true;}});
  renderer.domElement.addEventListener("pointermove",e=>{
    if(e.pointerType==="touch")return;
    const hovered=hit(e);objects.forEach(o=>o.material.emissive.setHex(o===hovered?0x17221a:0));schedule();
  });
  renderer.domElement.addEventListener("pointerleave",()=>{objects.forEach(o=>o.material.emissive.setHex(0));schedule();});
  renderer.domElement.addEventListener("pointerup",e=>{if(!wasMultiPointer&&start?.id===e.pointerId&&Math.hypot(e.clientX-start.x,e.clientY-start.y)<5)highlight(hit(e)?.userData.id||null);pointers.delete(e.pointerId);if(!pointers.size)start=null;});
  renderer.domElement.addEventListener("pointercancel",e=>{pointers.delete(e.pointerId);start=null;});
  resume=()=>{if(!disposed){pointers.clear();start=null;wasMultiPointer=false;resize();}};
  controls.addEventListener("change",schedule);
  observer=new ResizeObserver(resize);observer.observe(host);frame(sphere,"iso");
  renderer.domElement.addEventListener("webglcontextlost",e=>{e.preventDefault();cleanup();fallback("3D 顯示已中斷；合成資料與座標表保留，重新載入後可重試。");});
  $("viewer-status").textContent="合成模型 · 同源載入";
  // Read-only lab diagnostics. Never exposed by the production four-step UI.
  window.spatialDiagnostics=()=>({mode,selected,renders,zoom:camera.zoom,position:camera.position.toArray(),target:controls.target.toArray(),frameRadius:viewSphere.radius,visible:objects.filter(o=>o.visible).map(o=>o.userData.id),visibleEdges:objects.filter(o=>edges.get(o).visible).map(o=>o.userData.id),pan:$("pan").getAttribute("aria-pressed")==="true",drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,pixelRatio:renderer.getPixelRatio(),geometries:renderer.info.memory.geometries});
  window.spatialPixelCheck=()=>{
    render();const gl=renderer.getContext(),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,pixels=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    let different=0;for(let i=0;i<pixels.length;i+=4)if(Math.abs(pixels[i]-pixels[0])+Math.abs(pixels[i+1]-pixels[1])+Math.abs(pixels[i+2]-pixels[2])>30)different++;
    return {different,total:w*h};
  };
} catch(e) {
  cleanup();fallback("3D 尚不可用；請確認本機資源與 WebGL 支援。合成物件資料與座標表仍可檢視。");
}

$("core-check").onclick=async()=>{
  $("core-check").disabled=true;$("core-status").textContent="Core 載入中";
  try {
    const message=await new Promise((resolve,reject)=>{runtime=window.createCoreRuntime({onReady:resolve,onError:()=>reject(Error("runtime"))});});
    const response=await fetch(new URL("./core-fixture.json",import.meta.url)),engine=await response.json();
    const result=await runtime.recompute(engine);
    if(!result.input_hash?.startsWith("sha256:")||!result.result)throw Error("result");
    $("core-status").textContent="Core 檢查通過 · "+message.runtime_source+" · "+result.result.core_version;
  }catch(e){$("core-status").textContent="Core 暫不可用；3D 檢視不受影響。";}
  finally{runtime?.terminate();runtime=null;$("core-check").disabled=false;}
};
// A persisted page is only suspended: disposing its scene would break browser Back.
window.addEventListener("pagehide",event=>{if(!event.persisted){cleanup();runtime?.terminate();}});
window.addEventListener("pageshow",event=>{if(event.persisted)resume();});
