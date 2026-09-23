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
check("production does not load spatial prototype",()=>assert.ok(!/spatial-prototype|three\.module|spatial-vendor/.test(prod)));
check("WebGL fallback provided",()=>assert.ok(source.includes("webglcontextlost")&&source.includes("fallback(")));
console.log(`SPATIAL HEADLESS: ${count} passed`);
