import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
let count = 0;
const check = (name, fn) => { fn(); count++; };
const source = name => readFileSync(new URL("../../apps/web/" + name, import.meta.url), "utf8");
const root = {};
for (const name of ["security.js","case-bus.js","strategy-workspace.js","site-massing.js"]) new Function("self",source(name))(root);
const S = root.UROSSecurity, W = root.StrategyWorkspace;
check("text escaping", () => assert.equal(S.esc('<img a="x">'), "&lt;img a=&quot;x&quot;&gt;"));
for (const key of ["__proto__", "prototype", "constructor"]) check("reject object key " + key, () => assert.throws(() => S.parseJSON('{"'+key+'":{}}')));
for (const input of ["[1e999]", "[".repeat(70)+"0"+"]".repeat(70), '"'+ "a".repeat(20) + '"']) check("bounded JSON", () => assert.throws(() => S.parseJSON(input, input.length === 22 ? 10 : undefined)));
check("UTF8 byte limit", () => assert.throws(() => S.parseJSON('"中文"', 6)));
check("valid JSON", () => assert.deepEqual(S.parseJSON('{"a":[1,null,true]}'), {a:[1,null,true]}));
for (const cell of ["=1+1","+cmd","-1","@SUM(A1)","  =1","\ttext","\ntext"]) check("CSV formula defense", () => assert.ok(S.csvCell(cell).startsWith('"\'')));
check("CSV quotes", () => assert.equal(S.csvCell('a"b'), '"a""b"'));
for (const url of ["https://example.invalid/x","javascript:alert(1)","data:image/svg+xml;base64,AAAA"]) check("block active/remote image", () => assert.equal(S.imageData(url),""));
check("raster data allowed", () => assert.equal(S.imageData("data:image/png;base64,AAAA"),"data:image/png;base64,AAAA"));
check("anchored profile", () => assert.equal(W.buildProfiles([{stakeholder_id:"W-A"}],{"W-A":{willingness_type:"anchored"}})[0].willingness_type,"anchored"));
check("unknown not invented", () => assert.deepEqual(W.buildProfiles([{stakeholder_id:"W-A"}],{}),[{household_id:"W-A",classification_source:"suggested"}]));
check("blocker needs fact", () => assert.throws(() => W.buildProfiles([{stakeholder_id:"W-A"}],{"W-A":{signability:"blocked"}})));
check("guard rejects stale response", () => {const g=W.runGuard(), t=g.invalidate(); assert.ok(g.current(t));g.invalidate();assert.ok(!g.current(t));});
check("fingerprint includes full engine", () => assert.notEqual(W.sourceKey({pid:"x",engine:{a:1}}),W.sourceKey({pid:"x",engine:{a:2}})));
const engine = root.CaseBus.buildEngine(root.CaseBus.defaults()); engine.params.面積表計入容積=999;
const generated = root.SiteMassing.generate(engine,{levels:12,plate:300});
check("massing input template", () => {assert.equal(generated.floors.length,13);assert.equal(generated.floors[1].樓板,300);});
check("area-table override absent from temporary generation", () => {assert.ok(!("面積表計入容積" in generated.params));assert.equal(engine.params.面積表計入容積,999);});
for (const values of [{levels:61,plate:300},{levels:2.5,plate:300},{levels:12,plate:NaN},{levels:12,plate:-1}]) check("generation bounds", () => assert.throws(() => root.SiteMassing.generate(engine,values)));
for (const name of ["strategy-workspace.js","site-massing.js"]) {
  check(name+" no result persistence", () => assert.ok(!/CaseStore\.|CaseBus\.(replace|upsert)|fetch\s*\(/.test(source(name))));
  check(name+" output not draggable", () => assert.ok(!/dragstart|dragover|draggable\s*=|contenteditable/.test(source(name))));
}
function runtime(options={}) {
  let worker; class Worker {constructor(){worker=this;} postMessage(m){this.message=m;} terminate(){this.stopped=true;} emit(m){this.onmessage({data:m});}}
  const context={window:{},Worker,setTimeout,clearTimeout,Map,Promise,Error};vm.runInNewContext(source("core-runtime.js"),context);
  const rt=context.window.createCoreRuntime(options);return {rt,get w(){return worker;}};
}
{
  const {rt,w}=runtime(); await assert.rejects(rt.recompute({}));count++;
  w.emit({type:"ready"});const p=rt.analyze(engine,{},{},[]);assert.equal(w.message.type,"analyze");assert.equal(w.message.engine,engine);count++;
  w.emit({type:"result",id:w.message.id,result:{test:1}});assert.equal((await p).result.test,1);count++;rt.terminate();
}
for (const method of ["decide","allocate"]) {
  const {rt,w}=runtime();w.emit({type:"ready"});const extra={a:1},p=rt[method](engine,extra,{});
  assert.equal(w.message.type,method);assert.equal(w.message.engine,engine);
  assert.equal(w.message[method==="decide"?"workflow":"product"],extra);
  w.emit({type:"result",id:w.message.id,test:true});assert.ok((await p).test);rt.terminate();count++;
}
for (const type of ["fatal","error","messageerror","terminate"]) {
  const {rt,w}=runtime();w.emit({type:"ready"});const p=rt.recompute({});const rejected=assert.rejects(p);
  if(type==="fatal")w.emit({type:"fatal",msg:"failure"});else if(type==="terminate")rt.terminate();else w["on"+type]({});
  await rejected;assert.ok(!rt.ready&&rt.failed&&w.stopped);count++;
}
{
  const {rt,w}=runtime({requestTimeoutMs:10});w.emit({type:"ready"});await assert.rejects(rt.recompute({}));assert.ok(rt.failed);count++;
}
{
  const {rt}=runtime({initTimeoutMs:10});await new Promise(r=>setTimeout(r,25));assert.ok(rt.failed);count++;
}
{
  const {rt,w}=runtime();w.emit({type:"ready"});w.postMessage=()=>{throw Error("clone failure");};await assert.rejects(rt.recompute({}));assert.ok(rt.ready);rt.terminate();count++;
}
check("report CSP excludes inline scripts", () => {const html=source("report.html");assert.ok(html.includes("script-src 'self';"));assert.ok(!/<script(?![^>]*src=)[^>]*>\s*\S/.test(html));});
console.log("STRATEGY / SECURITY / SITE MASSING: "+count+" passed, 0 failed");

