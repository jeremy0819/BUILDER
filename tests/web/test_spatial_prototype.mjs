import assert from "node:assert/strict";
import {readFileSync,readdirSync,statSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {resolve} from "node:path";
import {fixture,validateDemo,geometryHash,canonical} from "../../tools/spatial-prototype/fixture.mjs";
let count=0;
function check(name,fn){fn();count++;console.log("PASS",name);}
const clone=()=>structuredClone(fixture);
check("explicit synthetic fixture accepted",()=>assert.equal(validateDemo(clone()).geometry_source,"synthetic"));
for(const field of ["case_id","input_hash","core_version","scenario_id"]){check("reject real binding "+field,()=>{const f=clone();f[field]="value";assert.throws(()=>validateDemo(f));});}
for(const [name,mutate] of [
  ["non-synthetic",f=>f.geometry_source="manual"],
  ["missing footprint",f=>delete f.buildings[0].footprint],
  ["missing height",f=>delete f.buildings[0].height],
  ["no site",f=>delete f.site],
  ["non-finite",f=>f.buildings[0].height=Infinity],
  ["unknown units",f=>f.unit="ft"],
  ["oversized polygon",f=>f.site.boundary=Array(33).fill([1,1])]
])check(name,()=>{const f=clone();mutate(f);assert.throws(()=>validateDemo(f));});
const hash=await geometryHash(fixture),mutated=clone();mutated.buildings[0].height++;
const changedHash=await geometryHash(mutated);
check("geometry change invalidates geometry hash",()=>assert.notEqual(hash,changedHash));
const reordered=Object.fromEntries(Object.entries(fixture).reverse());
const reorderedHash=await geometryHash(reordered);
check("property order does not affect hash",()=>assert.equal(hash,reorderedHash));
check("input and geometry hashes distinct",()=>assert.equal(fixture.input_hash,null));
check("canonical finite guard",()=>assert.throws(()=>canonical({x:NaN})));
const root=fileURLToPath(new URL("../../",import.meta.url)),lab=resolve(root,"tools/spatial-prototype");
const source=readFileSync(resolve(lab,"lab.mjs"),"utf8");
check("no storage or workflow mutation",()=>assert.ok(!/localStorage|sessionStorage|indexedDB|CaseBus|CaseStore|\.activity|\.allocate\(/.test(source)));
check("no continuous animation loop",()=>assert.ok(!/setAnimationLoop|setInterval/.test(source)));
check("no remote scene assets",()=>assert.ok(!/https?:\/\/|TextureLoader|GLTFLoader/.test(source)));
check("prototype source below 64 KiB",()=>assert.ok(readdirSync(lab).reduce((n,f)=>n+statSync(resolve(lab,f)).size,0)<65536));
const prod=readdirSync(resolve(root,"apps/web")).filter(f=>/\.(js|html)$/.test(f)).map(f=>readFileSync(resolve(root,"apps/web",f),"utf8")).join("\n");
// The requested in-workspace display uses a fixed, synthetic-only child document.
check("parent pages never import Three runtime",()=>assert.ok(!/three\.module|spatial-vendor|import\(["']three/.test(prod)));
const stage=readFileSync(resolve(root,"apps/web/spatial-stage.js"),"utf8");
check("embedded scene has a fixed URL without project bindings",()=>{
  assert.match(stage,/const frameURL="spatial-prototype.html\?embed=1"/);
  assert.match(stage,/<iframe src="\$\{frameURL\}"/);
  assert.ok(!/postMessage|contentWindow|\.src\s*=|setItem\(|CaseBus\.(upsert|replace|writeStore)/.test(stage));
  assert.match(stage,/合成場景 · 非本案量體/);
});
check("WebGL fallback provided",()=>assert.ok(source.includes("webglcontextlost")&&source.includes("fallback(")));
check("workspace summary preserves snapshot values and only links to available case tools",()=>{
  const fields=new Map(),host={querySelector(selector){if(!fields.has(selector))fields.set(selector,{});return fields.get(selector);}};
  const fill=new Function(stage.slice(stage.indexOf("  function fill("),stage.indexOf("  function mount("))+";return fill;")();
  const rec={snap:{code_name:'<img src=x>',site:{site_area_sqm:1500},input_hash:'sha256:fixture',core_version:'0.6.0'},engine:{}};
  fill(host,rec);
  assert.equal(host.querySelector('[data-stage="name"]').textContent,rec.snap.code_name);
  assert.equal(host.querySelector('[data-stage="hash"]').textContent,rec.snap.input_hash);
  assert.equal(host.querySelector('[data-stage="resume"]').href,'dashboard.html#site-massing-host');
  delete rec.engine;fill(host,rec);
  assert.equal(host.querySelector('[data-stage="resume"]').href,'dashboard.html');
  fill(host,null);
  assert.equal(host.querySelector('[data-stage="resume"]').href,'index.html#entry');
  assert.equal(host.querySelector('[data-stage="area"]').textContent,'—');
});

// Exercise source inspection independently of Three/WebGL, including dependency failure.
const nodes=new Map();
function node(){return {textContent:"",children:[],attributes:{},disabled:false,hidden:false,append(child){this.children.push(child);},setAttribute(name,value){this.attributes[name]=value;}};}
const get=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);};
const objectButtons=[fixture.site,...fixture.buildings].map(object=>({...node(),dataset:{object:object.id}}));
const cameraButtons=[node(),node()],visibilityInputs=[node(),node()];
const doc={createElement:node,querySelectorAll(selector){return selector==="[data-object]"?objectButtons:[...cameraButtons,...visibilityInputs];}};
const dataFunctions=source.slice(source.indexOf("function select("),source.indexOf("\ntry {"));
const inspector=new Function("fixture","document","$",dataFunctions+"\nreturn {select,fallback,showSourceData};")(fixture,doc,get);
inspector.showSourceData();
check("raw geometry table retains every fixture vertex",()=>{
  const rows=get("geometry-rows").children;
  assert.equal(rows.length,2);
  assert.deepEqual(rows.map(r=>r.children[0].textContent),[fixture.site.id,fixture.buildings[0].id]);
  for(const [i,points] of [fixture.site.boundary,fixture.buildings[0].footprint].entries())for(const [x,z] of points)assert.ok(rows[i].children[1].textContent.includes(`(${x}, ${z})`));
  assert.equal(rows[0].children[2].textContent,"—");
  assert.equal(rows[1].children[2].textContent,String(fixture.buildings[0].height));
});
check("displayed provenance comes from fixture",()=>{
  assert.equal(get("source-version").textContent,fixture.geometry_source_version);
  assert.equal(get("generated-at").textContent,fixture.generated_at);
  assert.equal(get("coordinate-system").textContent,fixture.coordinate_system);
});
inspector.fallback("GPU unavailable");
check("fallback disables camera and visibility but preserves data selection",()=>{
  assert.equal(get("scene").hidden,true);
  assert.equal(get("fallback").textContent,"GPU unavailable");
  assert.ok([...cameraButtons,...visibilityInputs].every(b=>b.disabled));
  objectButtons[1].onclick();
  assert.equal(get("object-id").textContent,fixture.buildings[0].id);
  assert.equal(get("height").textContent,fixture.buildings[0].height+" m");
  assert.equal(objectButtons[1].attributes["aria-pressed"],"true");
  objectButtons[0].onclick();
  assert.equal(get("height").textContent,"—");
  assert.equal(get("geometry-rows").children.length,2);
});
check("back-forward cache preserves scene and resumes layout",()=>{
  const events=new Map();let disposed=0,terminated=0,resumed=0;
  const lifecycle=source.slice(source.indexOf('window.addEventListener("pagehide"'));
  new Function("window","cleanup","runtime","resume",lifecycle)({addEventListener(name,fn){events.set(name,fn);}},()=>disposed++,{terminate(){terminated++;}},()=>resumed++);
  events.get("pagehide")({persisted:true});
  assert.equal(disposed,0);assert.equal(terminated,0);
  events.get("pageshow")({persisted:true});assert.equal(resumed,1);
  events.get("pagehide")({persisted:false});assert.equal(disposed,1);assert.equal(terminated,1);
  events.get("pageshow")({persisted:false});assert.equal(resumed,1);
});
console.log(`SPATIAL HEADLESS: ${count} passed`);
