import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
const root = fileURLToPath(new URL("../../",import.meta.url)), web=resolve(root,"apps/web"), artifacts=resolve(root,"tools/browser/artifacts");
mkdirSync(artifacts,{recursive:true});
const data={};new Function("self",readFileSync(resolve(web,"demo-cases.js"),"utf8"))(data);
const rec=structuredClone(data.DEMO_CASES[0]);rec.pid=rec.wf.project.project_id;
const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json"};
const server=createServer((req,res)=>{
  const path=resolve(web,"."+decodeURIComponent(new URL(req.url,"http://localhost").pathname));
  if(!path.startsWith(web+sep)||!existsSync(path)){res.writeHead(404);res.end();return;}
  res.writeHead(200,{"Content-Type":types[extname(path)]||"application/octet-stream","X-Content-Type-Options":"nosniff"});
  res.end(readFileSync(path));
});
await new Promise(r=>server.listen(0,"127.0.0.1",r));
const origin="http://127.0.0.1:"+server.address().port;
let browser, passed=0;
const check=(condition,name)=>{assert.ok(condition,name);passed++;console.log("PASS",name);};
try {
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const external=[];context.on('request',req=>{if(!req.url().startsWith(origin))external.push({url:req.url(),method:req.method(),body:req.postData()});});
  await context.addInitScript(({rec})=>{
    if(!localStorage.getItem("uros.workflow.v1")) {
      localStorage.setItem("uros.workflow.v1",JSON.stringify({order:[rec.pid],projects:{[rec.pid]:rec}}));
      localStorage.setItem("uros.active_case",rec.pid);
    }
    localStorage.setItem("uros.theme","light");
  },{rec});
  const page=await context.newPage(), errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto(origin+"/report.html");
  await page.waitForFunction(()=>!document.getElementById("analysis-run").disabled || !document.getElementById("runtime-retry").hidden,{},{timeout:150000});
  check(await page.locator("#runtime-retry").isHidden(),"real Pyodide initialized with jsonschema");
  const first=page.locator(".profile-row").first();await first.locator("summary").first().click();
  await first.locator("select").first().selectOption("anchored");
  check(await page.locator("#profile-save").innerText()==="已存本機","observation saved before analysis");
  const originalStore=await page.evaluate(()=>localStorage.getItem("uros.workflow.v1"));
  await page.locator("#analysis-run").click();
  await page.waitForFunction(()=>document.querySelector("#analysis-status").textContent.startsWith("分析完成"),{},{timeout:120000});
  check(await page.locator("#action-list button").count()>0,"real Core returned actionable strategy");
  check(await page.locator("#export-strategy").isEnabled(),"traceable export enabled");
  const downloadPromise=page.waitForEvent('download');await page.locator('#export-strategy').click();
  const download=await downloadPromise, output=resolve(artifacts,'strategy-test.json');await download.saveAs(output);
  const exported=JSON.parse(readFileSync(output,'utf8'));
  const native=spawnSync(process.env.PYTHON||'python',['-c',"import json,sys; import core.redcf as r; a=json.load(sys.stdin); print(r.input_hash(a))"],{cwd:root,input:JSON.stringify(rec.engine),encoding:'utf8',env:{...process.env,PYTHONIOENCODING:'utf-8'}});
  check(native.status===0 && native.stdout.trim()===exported.input_hash,'browser and native Python input_hash match');
  const allocationCase=JSON.parse(readFileSync(resolve(root,'schemas/examples/v2/v2_1_案例D_權變示範.json'),'utf8'));
  const payload={engine:allocationCase.engine,workflow:{stage:'S2',consent:{agreed:1,total:2,threshold:0.8},stakeholders:[{stakeholder_id:'W01',role:'owner',land_share:0.5}]},
    profiles:[{household_id:'W01',classification_source:'recorded',willingness_type:'anchored'}],
    product:{每坪均價:74,公設比:0.34,車位數:2,坪型組合:[{id:'A',area_坪:25,count:10}]}};
  const pipeline=await page.evaluate(async p=>{
    let rt;await new Promise((resolve,reject)=>{rt=createCoreRuntime({onReady:resolve,onError:m=>reject(Error(m.msg))});});
    try {
      const d=await rt.decide(p.engine,p.workflow,{}),a=await rt.allocate(p.engine,p.product,{});
      const s=await rt.strategize(d.decision,{...p.workflow,input_hash:d.input_hash},p.profiles);
      let rejected=false;try {await rt.allocate(p.engine,{...p.product,坪型組合:[{id:12,area_坪:1,count:1}]},{});} catch(e){rejected=/schema/.test(e.message);}
      return {decision:d.decision,strategy:s.strategy,allocation:a.household_outcome,allocationHash:a.input_hash,rejected};
    } finally {rt.terminate();}
  },payload);
  const reference=spawnSync(process.env.PYTHON||'python',['-c',"import json,sys; import core.redcf as r; a=json.load(sys.stdin); out=r.recompute(a['engine']); h=r.input_hash(a['engine']); wf=dict(a['workflow'],input_hash=h); d=r.decide(out,wf,{}); print(json.dumps({'decision':d,'strategy':r.strategize(d,wf,a['profiles']),'allocation':r.calc_選配映射(out['owner_allocations'],a['product'],h)}))"],{cwd:root,input:JSON.stringify(payload),encoding:'utf8',env:{...process.env,PYTHONIOENCODING:'utf-8'}});
  check(reference.status===0,'native pipeline reference completed');const ref=JSON.parse(reference.stdout);
  for(const key of ['decision','strategy','allocation']){assert.deepEqual(pipeline[key],ref[key]);check(true,'real standalone '+key+' equals native Core');}
  check(pipeline.allocation.length===48&&pipeline.allocation.every(h=>h.input_hash===pipeline.allocationHash),'48 household outcomes retain input provenance');
  check(pipeline.rejected,'allocation schema rejects malformed unit IDs in real Pyodide');
  check(await page.evaluate(()=>localStorage.getItem("uros.workflow.v1"))===originalStore,"strategy analysis never writes case store");
  await page.locator('[data-node="site"]').click();check(await page.locator('[data-node="site"]').getAttribute("aria-pressed")==="true","decision evidence interaction");
  await page.screenshot({path:resolve(artifacts,"strategy-desktop.png"),fullPage:true});
  await first.locator("select").first().selectOption("fearful");
  check(await page.locator("#export-strategy").isDisabled(),"input changes invalidate strategy");
  // Both events occur synchronously, before any Worker response can arrive.
  await page.evaluate(()=>{document.querySelector('#analysis-run').click();const select=document.querySelector('.profile-row select');select.value='unknown';select.dispatchEvent(new Event('change'));});
  await page.waitForTimeout(1000);
  check(await page.locator("#export-strategy").isDisabled(),"in-flight response cannot revive invalidated result");
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:resolve(artifacts,"strategy-mobile.png"),fullPage:true});
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"strategy mobile no horizontal overflow");
  await page.screenshot({path:resolve(artifacts,"strategy-mobile.png"),fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(origin+"/dashboard.html");await page.locator("#site-massing-host").waitFor();
  await page.locator('.sm-generate [name="levels"]').fill("10");await page.locator('.sm-generate [name="plate"]').fill("320");await page.locator(".sm-generate button").click();
  check(await page.locator(".sm-drawing rect").count()===11,"site generates ten floors plus basement");
  await page.waitForFunction(()=>document.querySelector("#drv-stat")?.textContent.includes("core"),{},{timeout:150000});
  await page.locator('[data-sm="run"]').click();
  await page.waitForFunction(()=>document.querySelector(".sm-status").textContent.startsWith("草案已重算"),{},{timeout:120000});
  check(await page.locator(".sm-results tbody tr").count()===4,"massing presents Core capacity comparison");
  const before=await page.locator(".sm-results tbody tr").nth(1).locator("td").last().innerText();
  const plate=page.locator(".sm-floor-editor input").nth(1);await plate.fill("100");
  check(await page.locator(".sm-results tr").count()===0,"floor edit immediately clears prior Core results");
  await page.locator('[data-sm="run"]').click();await page.waitForFunction(()=>document.querySelector(".sm-status").textContent.startsWith("草案已重算"),{},{timeout:120000});
  check((await page.locator(".sm-results tbody tr").nth(1).locator("td").last().innerText())!==before,"floor edit actually changes Core counted area");
  await page.locator("#site-massing-host").screenshot({path:resolve(artifacts,"massing-desktop.png")});
  await page.setViewportSize({width:390,height:844});
  await page.locator("#site-massing-host").screenshot({path:resolve(artifacts,"massing-mobile.png")});
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"site mobile no horizontal overflow");
  // Stored injection stays text in every major surface.
  await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem("uros.workflow.v1")),p=s.order[0];s.projects[p].snap.code_name='<img src=x onerror="window.__injected=1">';localStorage.setItem("uros.workflow.v1",JSON.stringify(s));});
  for(const file of ["dashboard.html","evaluator.html","workspace.html","report.html"]){
    await page.goto(origin+"/"+file);await page.waitForTimeout(350);
    check(await page.evaluate(()=>!window.__injected&&!document.querySelector('img[onerror]')),"stored XSS inert: "+file);
  }
  await page.goto(origin+'/workspace.html');await page.locator('[data-case-action="open"]').first().click();
  await page.locator('[data-t="task"]').click();await page.locator('#ttitle').fill('<img src=x onerror="window.__injected=1">');await page.locator('#taddbtn').click();
  check(await page.evaluate(()=>!window.__injected&&!document.querySelector('img[onerror]')),'task text remains inert after save and rerender');
  await page.locator('[data-t="dec"]').click();await page.locator('#dttl').fill('<svg onload="window.__injected=1">');await page.locator('#daddbtn').click();
  check(await page.evaluate(()=>!window.__injected&&!document.querySelector('svg[onload]')),'decision log remains inert after save and rerender');
  const unexpected=external.filter(r=>!r.url.startsWith('https://cdn.jsdelivr.net/pyodide/v0.26.4/full/')||r.method!=='GET'||r.body);
  check(unexpected.length===0,'external requests only pinned runtime downloads, no case payload: '+JSON.stringify(unexpected));
  check(errors.length===0,"no unhandled browser errors: "+errors.join(";"));
  const offline=await browser.newContext({viewport:{width:390,height:844}});
  await offline.addInitScript(({rec})=>{localStorage.setItem("uros.workflow.v1",JSON.stringify({order:[rec.pid],projects:{[rec.pid]:rec}}));localStorage.setItem("uros.active_case",rec.pid);},{rec});
  await offline.route("**/core-runtime.worker.js",route=>route.abort());
  const off=await offline.newPage();await off.goto(origin+"/report.html");
  await off.locator("#runtime-retry").waitFor({state:"visible"});
  const row=off.locator(".profile-row").first();await row.locator("summary").first().click();await row.locator("select").first().selectOption("anchored");
  check(await off.locator("#profile-save").innerText()==="已存本機","unavailable Core does not lose observations");
  check(await off.locator("#analysis-run").isDisabled(),"unavailable Core cannot fabricate results");
  const blocked=await browser.newContext();
  await blocked.addInitScript(({rec})=>{localStorage.setItem('uros.workflow.v1',JSON.stringify({order:[rec.pid],projects:{[rec.pid]:rec}}));localStorage.setItem('uros.active_case',rec.pid);},{rec});
  await blocked.route('**/*jsonschema*.whl',route=>route.abort());
  const missing=await blocked.newPage();await missing.goto(origin+'/report.html');
  await missing.locator('#runtime-retry').waitFor({state:'visible',timeout:90000});
  check(await missing.locator('#analysis-run').isDisabled(),'missing jsonschema prevents runtime readiness');
  console.log("BROWSER: "+passed+" passed; screenshots: "+artifacts);
} finally {if(browser)await browser.close();await new Promise(r=>server.close(r));}
