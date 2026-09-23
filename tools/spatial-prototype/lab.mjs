import {fixture, geometryHash, validateDemo} from "./fixture.mjs";

const $ = id => document.getElementById(id);
let runtime, cleanup = () => {};
function fallback(message) {
  $("fallback").hidden = false;
  $("fallback").textContent = message;
  $("viewer-status").textContent = "3D 不可用";
  document.querySelectorAll(".toolbar button").forEach(b => {b.disabled = true;});
  $("scene").hidden = true;
}
function select(id) {
  $("selection").textContent = id === "demo-building" ? "合成量體 A" : id === "demo-site" ? "合成基地" : "尚未選取";
  $("height").textContent = id === "demo-building" ? fixture.buildings[0].height + " m" : "—";
  document.querySelectorAll("[data-object]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.object === id)));
}

try {
  validateDemo(fixture);
  $("geometry-hash").textContent = await geometryHash(fixture);
  const THREE = await import("three");
  const {OrbitControls} = await import("/vendor/OrbitControls.js");
  const host = $("scene"), renderer = new THREE.WebGLRenderer({antialias:true,alpha:false});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.setClearColor(0xf1f4f5);
  host.append(renderer.domElement);
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-50,50,50,-50,0.1,600);
  const controls = new OrbitControls(camera,renderer.domElement);
  controls.enableDamping = false;
  controls.minZoom = .5; controls.maxZoom = 4;
  controls.maxPolarAngle = Math.PI / 2 - .02;
  controls.listenToKeyEvents(host);
  scene.add(new THREE.HemisphereLight(0xffffff,0x84908b,2));
  const sun = new THREE.DirectionalLight(0xffffff,2);sun.position.set(30,60,40);scene.add(sun);
  const objects = [], resources = [];
  function meshFor(points,height,color,id) {
    const shape = new THREE.Shape(points.map(([x,z]) => new THREE.Vector2(x,-z)));
    const geometry = height ? new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false,steps:1}) : new THREE.ShapeGeometry(shape);
    geometry.rotateX(-Math.PI/2);
    const material = new THREE.MeshLambertMaterial({color,side:THREE.DoubleSide});
    const mesh = new THREE.Mesh(geometry,material);mesh.userData.id = id;
    if (!height) mesh.position.y = -.08;
    scene.add(mesh);objects.push(mesh);resources.push(geometry,material);
    const edges = new THREE.EdgesGeometry(geometry), lineMaterial = new THREE.LineBasicMaterial({color:height?0x23694e:0x849394});
    const line = new THREE.LineSegments(edges,lineMaterial);line.position.copy(mesh.position);scene.add(line);resources.push(edges,lineMaterial);
    return mesh;
  }
  const site = meshFor(fixture.site.boundary,0,0xdce3e2,fixture.site.id);
  const building = fixture.buildings[0];meshFor(building.footprint,building.height,0x58ac86,building.id);
  const bounds = new THREE.Box3();objects.forEach(o=>bounds.expandByObject(o));
  const sphere = bounds.getBoundingSphere(new THREE.Sphere()), target = sphere.center.clone();
  let mode = "iso", renders = 0, selected = null, disposed = false, queued = false;
  function render() {if(disposed)return;renderer.render(scene,camera);renders++;}
  function schedule() {if(!queued&&!disposed){queued=true;requestAnimationFrame(()=>{queued=false;render();});}}
  function resize() {
    const width=host.clientWidth,height=host.clientHeight;if(!width||!height)return;
    const aspect=width/height,half=sphere.radius*1.16/Math.min(aspect,1);
    camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;
    camera.updateProjectionMatrix();renderer.setSize(width,height,false);schedule();
  }
  function setView(value) {
    mode=value;controls.target.copy(target);camera.zoom=1;
    camera.position.copy(target).add(value==="top"?new THREE.Vector3(0,120,.01):new THREE.Vector3(85,70,85));
    camera.up.set(0,1,0);camera.lookAt(target);camera.updateProjectionMatrix();controls.update();
    $("iso").setAttribute("aria-pressed",String(value==="iso"));$("top").setAttribute("aria-pressed",String(value==="top"));
    schedule();
  }
  function highlight(id) {
    selected=id;select(id);
    objects.forEach(o=>o.material.color.set(o.userData.id===id?0xe1b34b:o===site?0xdce3e2:0x58ac86));
    schedule();
  }
  $("iso").onclick=()=>setView("iso");$("top").onclick=()=>setView("top");
  $("reset").onclick=()=>{setView("iso");highlight(null);};
  for(const [id,factor] of [["zoom-in",1.2],["zoom-out",1/1.2]]) $(id).onclick=()=>{camera.zoom=THREE.MathUtils.clamp(camera.zoom*factor,.5,4);camera.updateProjectionMatrix();schedule();};
  $("pan").onclick=()=>{const on=$("pan").getAttribute("aria-pressed")!=="true";$("pan").setAttribute("aria-pressed",String(on));controls.mouseButtons.LEFT=on?THREE.MOUSE.PAN:THREE.MOUSE.ROTATE;};
  const raycaster=new THREE.Raycaster();
  function hit(event) {
    const rect=renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),camera);
    return raycaster.intersectObjects(objects)[0]?.object;
  }
  let start;
  renderer.domElement.addEventListener("pointerdown",e=>{start={x:e.clientX,y:e.clientY,id:e.pointerId};});
  renderer.domElement.addEventListener("pointermove",e=>{
    const hovered=hit(e);objects.forEach(o=>o.material.emissive.setHex(o===hovered?0x17221a:0));schedule();
  });
  renderer.domElement.addEventListener("pointerleave",()=>{objects.forEach(o=>o.material.emissive.setHex(0));schedule();});
  renderer.domElement.addEventListener("pointerup",e=>{if(start?.id===e.pointerId&&Math.hypot(e.clientX-start.x,e.clientY-start.y)<5)highlight(hit(e)?.userData.id||null);start=null;});
  document.querySelectorAll("[data-object]").forEach(b=>{b.onclick=()=>highlight(b.dataset.object);});
  controls.addEventListener("change",schedule);
  const observer=new ResizeObserver(resize);observer.observe(host);setView("iso");resize();
  renderer.domElement.addEventListener("webglcontextlost",e=>{e.preventDefault();cleanup();fallback("3D 顯示已中斷；合成資料保留，重新載入後可重試。");});
  $("viewer-status").textContent="合成模型 · 本機載入";
  cleanup=()=>{if(disposed)return;disposed=true;observer.disconnect();controls.dispose();resources.forEach(r=>r.dispose());renderer.dispose();};
  // Read-only lab diagnostics. Never exposed by the production four-step UI.
  window.spatialDiagnostics=()=>({mode,selected,renders,zoom:camera.zoom,position:camera.position.toArray(),target:controls.target.toArray(),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,pixelRatio:renderer.getPixelRatio(),geometries:renderer.info.memory.geometries});
  window.spatialPixelCheck=()=>{
    render();const gl=renderer.getContext(),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,pixels=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    let different=0;for(let i=0;i<pixels.length;i+=4)if(Math.abs(pixels[i]-pixels[0])+Math.abs(pixels[i+1]-pixels[1])+Math.abs(pixels[i+2]-pixels[2])>30)different++;
    return {different,total:w*h};
  };
} catch(e) {
  cleanup();fallback("3D 尚不可用；請確認本機資源與 WebGL 支援。合成物件資料仍可檢視。");
  document.querySelectorAll("[data-object]").forEach(b=>{b.onclick=()=>select(b.dataset.object);});
}

$("core-check").onclick=async()=>{
  $("core-check").disabled=true;$("core-status").textContent="Core 載入中";
  try {
    const message=await new Promise((resolve,reject)=>{runtime=window.createCoreRuntime({onReady:resolve,onError:()=>reject(Error("runtime"))});});
    const response=await fetch("/prototype/core-fixture.json"),engine=await response.json();
    const result=await runtime.recompute(engine);
    if(!result.input_hash?.startsWith("sha256:")||!result.result)throw Error("result");
    $("core-status").textContent="Core 檢查通過 · "+message.runtime_source+" · "+result.core_version;
  }catch(e){$("core-status").textContent="Core 暫不可用；3D 檢視不受影響。";}
  finally{runtime?.terminate();runtime=null;$("core-check").disabled=false;}
};
window.addEventListener("pagehide",()=>{cleanup();runtime?.terminate();});
