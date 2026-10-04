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
const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".mjs":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json",".wasm":"application/wasm"};
const server=createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,"http://localhost").pathname);
  let base=pathname.startsWith('/runtime/')?artifacts:web, relative="."+pathname;
  // Mirror the preview/public entry so embedded viewers are exercised too.
  if(pathname==='/spatial-prototype.html'){
    base=resolve(root,'tools/spatial-prototype');relative='index.html';
  }else if(pathname.startsWith('/spatial-prototype/vendor/')){
    base=resolve(artifacts,'spatial-vendor');relative=pathname.slice('/spatial-prototype/vendor/'.length);
  }else if(pathname.startsWith('/spatial-prototype/')){
    base=resolve(root,'tools/spatial-prototype');relative=pathname.slice('/spatial-prototype/'.length);
  }
  const path=resolve(base,relative);
  if(!path.startsWith(base+sep)||!existsSync(path)){res.writeHead(404);res.end();return;}
  res.writeHead(200,{"Content-Type":types[extname(path)]||"application/octet-stream","X-Content-Type-Options":"nosniff"});
  res.end(readFileSync(path));
});
await new Promise(r=>server.listen(0,"127.0.0.1",r));
const origin="http://127.0.0.1:"+server.address().port;
let browser, passed=0;
const check=(condition,name)=>{assert.ok(condition,name);passed++;console.log("PASS",name);};
try {
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_PATH}:{})});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({status:403,body:'blocked by enterprise policy'}));
  const external=[];context.on('request',req=>{if(!req.url().startsWith(origin))external.push({url:req.url(),method:req.method(),body:req.postData()});});
  await context.addInitScript(({rec})=>{
    if(!localStorage.getItem("uros.workflow.v1")) {
      localStorage.setItem("uros.workflow.v1",JSON.stringify({order:[rec.pid],projects:{[rec.pid]:rec}}));
      localStorage.setItem("uros.active_case",rec.pid);
    }
    localStorage.setItem("uros.theme","light");
  },{rec});
  const page=await context.newPage(), errors=[];page.on("pageerror",e=>errors.push(e.message));
  const home=await context.newPage();await home.goto(origin+'/index.html');
  check(await home.locator('#pm-resume').isVisible()&&await home.locator('#entry').isHidden(),'returning user starts at saved case and next action');
  check(await home.locator('#hero-overview').isVisible()&&await home.locator('#backup-status').isVisible(),'case overview and backup status stay visible with spatial tool collapsed');
  await home.goto(origin+'/overview.html');
  check(await home.locator('#overview-case').isVisible()&&await home.locator('#overview-name').innerText()===rec.snap.code_name,'daily overview reads the active case');
  await home.getByRole('link',{name:'＋ 建立新案件'}).click();
  check(await home.locator('#entry').isVisible()&&await home.locator('#pm-resume').isHidden(),'new case opens a fresh quick evaluation');
  await home.waitForFunction(()=>{const b=document.getElementById('btn-go');return !b.disabled&&b.textContent.includes('快速評估');},{},{timeout:120000});
  const beforeQuick=await home.evaluate(()=>localStorage.getItem('uros.workflow.v1'));
  await home.locator('#btn-go').click();
  check(await home.locator('#btn-go').innerText()==='儲存為案件 →'&&await home.evaluate(()=>localStorage.getItem('uros.workflow.v1'))===beforeQuick,'quick evaluation stays a preview until explicitly saved');
  await home.close();
  await page.goto(origin+"/report.html");
  await page.waitForFunction(()=>!document.getElementById("analysis-run").disabled || !document.getElementById("runtime-retry").hidden,{},{timeout:150000});
  check(await page.locator("#runtime-retry").isHidden(),"real Pyodide initialized with jsonschema");
  check(await page.locator('#readiness-list .missing').count()===0&&await page.locator('#analysis-run').isEnabled(),'Decision explains readiness before analysis');
  check(await page.locator('#calibration-notice summary').innerText()==='存活率未校準 · 判定僅供方向性比較','calibration warning visible with CDN blocked');
  check(await page.locator('#backup-status').innerText()==='尚無有效備份紀錄','first-use backup warning visible');
  check(await page.locator('#household-observations').getAttribute('open')===null,'Decision household observations start collapsed');
  await page.locator('#household-observations > summary').click();
  const first=page.locator(".profile-row").first();await first.locator("summary").first().click();
  const second=page.locator('.profile-row').nth(1);await second.locator('summary').first().click();
  check(await first.getAttribute('open')===null,'Decision opens only one household editor');
  await first.locator('summary').first().click();
  await first.locator("select").first().selectOption("anchored");
  check(await page.locator("#profile-save").innerText()==="已存本機","observation saved before analysis");
  const originalStore=await page.evaluate(()=>localStorage.getItem("uros.workflow.v1"));
  await page.locator("#analysis-run").click();
  await page.waitForFunction(()=>document.querySelector("#analysis-status").textContent.startsWith("分析完成"),{},{timeout:120000});
  check(await page.locator("#action-list button").count()>0,"real Core returned actionable strategy");
  check(await page.locator('#decision-brief').isVisible()&&await page.locator('#brief-actions li').count()<=3,'Decision leads with verdict and at most three traced actions');
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
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:resolve(artifacts,"strategy-desktop.png"),fullPage:true});
  await first.locator("select").first().selectOption("fearful");
  check(await page.locator("#export-strategy").isDisabled(),"input changes invalidate strategy");
  // Both events occur synchronously, before any Worker response can arrive.
  await page.evaluate(()=>{document.querySelector('#analysis-run').click();const select=document.querySelector('.profile-row select');select.value='unknown';select.dispatchEvent(new Event('change'));});
  await page.waitForTimeout(1000);
  check(await page.locator("#export-strategy").isDisabled(),"in-flight response cannot revive invalidated result");
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:resolve(artifacts,"strategy-mobile.png"),fullPage:true});
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"strategy mobile no horizontal overflow");
  await page.screenshot({path:resolve(artifacts,"strategy-mobile.png"),fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  await page.evaluate(()=>{const r=CaseBus.activeRecord(),canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;const c=canvas.getContext('2d');c.fillStyle='#eeeeee';c.fillRect(0,0,320,180);c.strokeStyle='#b934aa';c.strokeRect(30,30,200,120);r.assets={...(r.assets||{}),cadastral:canvas.toDataURL('image/png')};CaseBus.replace(r.pid,r);});
  await page.goto(origin+"/dashboard.html");await page.locator("#site-massing-host").waitFor();
  const studioAccent=await page.evaluate(()=>getComputedStyle(document.body).getPropertyValue('--uros-accent').trim());
  check(await page.locator('.sm-layer-heading h2').allTextContents().then(v=>v.join('|')==='基地輸入與參考草圖|樓層與標準樓板|Core 容積結果'),'Site presents base, massing and Core result in order');
  check(await page.locator('#site-spatial-demo').getAttribute('open')===null&&await page.locator('.sm-diagram').getAttribute('open')===null,'synthetic 3D and floor area diagram begin collapsed');
  check(await page.locator('#site-workflow-records').getAttribute('open')===null,'case record panel begins collapsed in Site');
  check((await page.locator('.si-caption').innerText()).includes('不參與量體或 Core 計算'),'reference sketch clearly has no planning binding');
  check(await page.locator('.si-canvas image').count()===1,'local cadastral attachment is reused as a tracing background');
  check(await page.evaluate(()=>!!CaseBus.activeRecord().assets.cadastral),'demo collection upgrades preserve user attachments');
  await page.locator('.si-background input').uncheck();
  check(await page.locator('.si-canvas image').count()===0,'background visibility does not alter parcel coordinates');
  await page.locator('.si-background input').check();
  await page.locator('[data-si="add"]').click();
  const sketch=page.locator('.si-canvas');
  for(const position of [{x:65,y:40},{x:260,y:40},{x:260,y:160},{x:65,y:160}])await sketch.click({position});
  check(await page.evaluate(()=>CaseBus.activeRecord().site_intake.parcels[0].points.length)===4,'manual parcel vertices persist in the active case');
  const sketchEngine=await page.evaluate(()=>JSON.stringify(CaseBus.activeRecord().engine));
  await page.locator('[data-si="undo"]').click();
  check(await page.evaluate(()=>CaseBus.activeRecord().site_intake.parcels[0].points.length)===3,'parcel undo restores the previous vertices');
  check(await page.evaluate(()=>JSON.stringify(CaseBus.activeRecord().engine))===sketchEngine,'sketch cannot invent measured area or modify Core inputs');
  await page.locator('.si-fields details').first().locator('summary').click();
  await page.locator('[data-land="zoning"]').fill('synthetic zone');await page.locator('[data-land="zoning"]').press('Tab');
  await page.locator('[data-land="coverage_percent"]').fill('40');await page.locator('[data-land="coverage_percent"]').press('Tab');
  await page.locator('[data-si="coverage"]').click();
  check(await page.locator('.sm-generate [name="plate"]').inputValue()!=='','coverage creates an editable floor input');
  await page.locator('.si-fields details').first().locator('summary').click();
  await page.locator('.site-intake').evaluate(el=>el.scrollIntoView({block:'center'}));
  await page.locator('.site-intake').screenshot({path:resolve(artifacts,'site-intake-desktop.png')});
  await page.locator('.sm-generate [name="levels"]').fill("10");await page.locator('.sm-generate [name="plate"]').fill("320");
  check(await page.locator(".sm-drawing [data-mv-row]").count()===11,"site generates ten floors plus basement");
  await page.waitForFunction(()=>document.querySelector(".sm-status")?.textContent.includes("草案已重算"),{},{timeout:150000});
  await page.locator('[data-sm="run"]').click();
  await page.waitForFunction(()=>document.querySelector(".sm-status").textContent.startsWith("草案已重算"),{},{timeout:120000});
  check(await page.locator(".sm-results tbody tr").count()===4,"massing presents Core capacity comparison");
  const before=await page.locator(".sm-results tbody tr").nth(1).locator("td").last().innerText();
  check(await page.locator('.sm-floor-detail').getAttribute('open')===null,'floor details are progressively disclosed');
  await page.locator('.sm-floor-detail > summary').click();
  const plate=page.locator(".sm-floor-editor input").nth(1);await plate.fill("100");
  check((await page.locator(".sm-results tbody td:last-child").allTextContents()).every(v=>v==='—'),"floor edit immediately clears prior Core results");
  await page.locator('[data-sm="run"]').click();await page.waitForFunction(()=>document.querySelector(".sm-status").textContent.startsWith("草案已重算"),{},{timeout:120000});
  check((await page.locator(".sm-results tbody tr").nth(1).locator("td").last().innerText())!==before,"floor edit actually changes Core counted area");
  await page.locator('.sm-floor-detail > summary').click();
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:resolve(artifacts,"massing-desktop.png"),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:resolve(artifacts,"massing-mobile.png"),fullPage:true});
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"site mobile no horizontal overflow");
  check(await page.locator('[data-uros-runtime]').isVisible() && (await page.locator('[data-uros-runtime]').innerText())==='本機','Site runtime source visible on mobile');
  check(await page.locator('#site-records').getAttribute('open')===null,'land records initially collapsed');
  check(await page.locator('#cw-drive').count()===0,'financial controls no longer compete with Site massing');
  await page.locator('.sm-diagram > summary').click();
  const priorEngine=await page.evaluate(()=>JSON.stringify(CaseBus.activeRecord().engine));
  const figure=await page.locator('.sm-drawing').innerHTML();
  const faceBox=await page.locator('.sm-drawing [data-mv-row]').first().boundingBox();
  await page.mouse.move(faceBox.x+5,faceBox.y+5);await page.mouse.down();await page.mouse.move(faceBox.x+75,faceBox.y+20);await page.mouse.up();
  check(await page.evaluate(()=>JSON.stringify(CaseBus.activeRecord().engine))===priorEngine,'dragging massing never edits case inputs');
  check(await page.locator('.sm-drawing').innerHTML()===figure,'diagram has no output resizing path');
  await page.locator('[data-sm="apply"]').click();await page.waitForURL('**/evaluator.html');
  await page.waitForFunction(()=>document.querySelector('.pp-status')?.textContent.startsWith('草案已重算'),{},{timeout:150000});
  const adoptedSite=await page.evaluate(()=>CaseBus.activeRecord());
  check(adoptedSite.pid===rec.pid && adoptedSite.engine.floors.length===11,'adopt massing retains project identity and passes floors to Product');
  check(adoptedSite.snap.core_version==='0.6.0' && /^sha256:/.test(adoptedSite.snap.input_hash),'adopted Site retains verified Core provenance');
  check(adoptedSite.decision===null,'changed input detaches prior snapshot decision');
  check(adoptedSite.site_intake.parcels[0].points.length===3&&adoptedSite.site_intake.land.zoning==='synthetic zone','adopting Site preserves parcel facts across steps');
  check(adoptedSite.cashflow.input_hash===adoptedSite.snap.input_hash&&adoptedSite.cashflow.core_version===adoptedSite.snap.core_version,'adopted cost disbursement binds to the exact Site result');
  check(await page.locator('.product-planning').isVisible(),'Product default view contains real Core controls');
  check(await page.evaluate(()=>getComputedStyle(document.body).getPropertyValue('--uros-accent').trim())===studioAccent,'Site and Product use the same studio theme');
  const initialFinancial=await page.locator('.pp-results tbody tr').last().locator('td').last().innerText();
  await page.locator('.pp-inputs input[type=number]').first().fill('90');
  check((await page.locator('.pp-results tbody td:last-child').allTextContents()).every(x=>x==='—'),'Product edits immediately invalidate old results');
  check(await page.locator('.pp-cashflow table').count()===0,'Product edit also clears the old cost disbursement view');
  await page.waitForFunction(()=>document.querySelector('.pp-status')?.textContent.startsWith('草案已重算'),{},{timeout:120000});
  check((await page.locator('.pp-results tbody tr').last().locator('td').last().innerText())!==initialFinancial,'Product input uses real Core finance recomputation');
  check(await page.evaluate(()=>JSON.stringify(CaseBus.activeRecord().engine))===JSON.stringify(adoptedSite.engine),'unadopted Product preview never mutates the case');
  await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:resolve(artifacts,'product-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:resolve(artifacts,'product-mobile.png'),fullPage:true});
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Product mobile no horizontal overflow');
  await page.locator('[data-pp="apply"]').click();await page.waitForURL('**/os-simulator.html');
  check(await page.evaluate(()=>CaseBus.activeRecord().engine.params.住宅單價)===90,'adopted Product is carried into People');
  check(await page.evaluate(()=>CaseBus.activePid())===rec.pid,'Site to Product to People remains the same case');
  check(await page.evaluate(()=>CaseBus.activeRecord().cashflow.input_hash===CaseBus.activeRecord().snap.input_hash),'Product cost disbursement stays bound after adoption');
  // Stored injection stays text in every major surface.
  await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem("uros.workflow.v1")),p=s.order[0];s.projects[p].snap.code_name='<img src=x onerror="window.__injected=1">';localStorage.setItem("uros.workflow.v1",JSON.stringify(s));});
  for(const file of ["index.html","overview.html","dashboard.html","evaluator.html","workspace.html","report.html"]){
    await page.goto(origin+"/"+file);await page.waitForTimeout(350);
    check(await page.evaluate(()=>!window.__injected&&!document.querySelector('img[onerror]')),"stored XSS inert: "+file);
  }
  await page.goto(origin+'/workspace.html?view=task');await page.waitForURL('**/os-simulator.html#workflow-task');
  await page.locator('#ttitle').fill('<img src=x onerror="window.__injected=1">');await page.locator('#taddbtn').click();
  check(await page.evaluate(()=>!window.__injected&&!document.querySelector('img[onerror]')),'task text remains inert after save and rerender');
  await page.goto(origin+'/workspace.html?view=dec');await page.waitForURL('**/report.html#workflow-dec');
  await page.locator('#dttl').fill('<svg onload="window.__injected=1">');await page.locator('#daddbtn').click();
  check(await page.evaluate(()=>!window.__injected&&!document.querySelector('svg[onload]')),'decision log remains inert after save and rerender');
  check(external.length===0,'same-origin runtime: zero external requests or case payloads');
  check(errors.length===0,"no unhandled browser errors: "+errors.join(";"));
  const offline=await browser.newContext({viewport:{width:390,height:844}});
  await offline.addInitScript(({rec})=>{localStorage.setItem("uros.workflow.v1",JSON.stringify({order:[rec.pid],projects:{[rec.pid]:rec}}));localStorage.setItem("uros.active_case",rec.pid);},{rec});
  await offline.route("**/core-runtime.worker.js",route=>route.abort());
  const off=await offline.newPage();await off.goto(origin+"/report.html");
  await off.locator("#runtime-retry").waitFor({state:"visible"});
  await off.locator('#household-observations > summary').click();
  const row=off.locator(".profile-row").first();await row.locator("summary").first().click();await row.locator("select").first().selectOption("anchored");
  check(await off.locator("#profile-save").innerText()==="已存本機","unavailable Core does not lose observations");
  check(await off.locator("#analysis-run").isDisabled(),"unavailable Core cannot fabricate results");
  await off.goto(origin+'/dashboard.html');
  await off.waitForFunction(()=>document.querySelector('.sm-status')?.dataset.phase==='error');
  check(await off.locator('[data-sm="apply"]').isDisabled(),'unavailable Core cannot adopt a massing draft');
  check((await off.locator('.sm-results tbody td:last-child').allTextContents()).every(x=>x==='—'),'unavailable Core keeps unknown results blank');
  check(!/importScripts|WorkerGlobalScope/.test(await off.locator('.sm-status').innerText()),'Site Core failure uses human-readable text');
  const blocked=await browser.newContext();
  await blocked.addInitScript(({rec})=>{localStorage.setItem('uros.workflow.v1',JSON.stringify({order:[rec.pid],projects:{[rec.pid]:rec}}));localStorage.setItem('uros.active_case',rec.pid);},{rec});
  await blocked.route('**/*jsonschema*.whl',route=>route.abort());
  const missing=await blocked.newPage();await missing.goto(origin+'/report.html');
  await missing.locator('#runtime-retry').waitFor({state:'visible',timeout:90000});
  check(await missing.locator('#analysis-run').isDisabled(),'missing jsonschema prevents runtime readiness');
  check(await missing.evaluate(()=>UROSDiagnostics.read().some(e=>e.code==='core-unavailable')),'Core failure recorded locally without message or inputs');

  const recovery=await browser.newContext();
  await recovery.addInitScript(()=>{Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true});});
  const savePage=await recovery.newPage();await savePage.goto(origin+'/index.html');
  await savePage.locator('#backup-status').waitFor();
  await savePage.evaluate(async rec=>{
    CaseBus.upsert(rec);
    localStorage.setItem('uros.profiles.'+rec.pid,JSON.stringify([{household_id:'O1',willingness_type:'unknown'}]));
    await CaseStore.putCase(rec);
    await CaseStore.append(rec.pid,{kind:'note',field:'intent',after:'synthetic note'});
    await CaseStore.meta('session:'+rec.pid+':S1',{session_id:'S1',first_event:'1',last_event:'1'});
    await CaseStore.meta('scenario:'+rec.pid,{scenarios:[{scenario_id:'S1',engine:rec.engine,authoritative:true}]});
  },rec);
  const backupPromise=savePage.waitForEvent('download');await savePage.locator('#backup-save').click();
  const backupDownload=await backupPromise,backupPath=resolve(artifacts,'backup-test.json');await backupDownload.saveAs(backupPath);
  const backupDoc=JSON.parse(readFileSync(backupPath,'utf8'));
  check(backupDoc.local_storage['uros.profiles.'+rec.pid]&&backupDoc.idb.activity.length===1&&backupDoc.idb.meta.some(x=>x.k.startsWith('scenario:')),'backup includes both stores, drafts, activity, sessions and scenarios');
  check(await savePage.evaluate(()=>CaseStore.meta('uros.last_backup_at'))===null,'download initiation does not mark backup complete');
  await savePage.locator('#backup-confirm').click();
  await savePage.waitForFunction(()=>document.querySelector('#backup-status').textContent.includes('0 天前'));
  check(!!await savePage.evaluate(()=>CaseStore.meta('uros.last_backup_at')),'confirmed download persists last_backup_at');
  check(await savePage.evaluate(async doc=>{const before=localStorage.getItem('uros.workflow.v1');try{await BrowserBackup.restore(doc);return false;}catch{return before===localStorage.getItem('uros.workflow.v1');}},backupDoc),'restore refuses populated browser without changing data');

  const fresh=await browser.newContext(),restorePage=await fresh.newPage();await restorePage.goto(origin+'/index.html');
  await restorePage.waitForFunction(()=>document.querySelector('#backup-status')?.textContent==='尚無有效備份紀錄');
  restorePage.on('dialog',dialog=>dialog.accept());
  await restorePage.locator('#browser-backup details summary').first().click();
  const invalidBackup={format:'uros-browser-backup',version:1,
    local_storage:{'uros.workflow.v1':JSON.stringify({order:[],projects:'broken'})},
    idb:{format:'uros-backup',version:1,cases:[],activity:[],meta:[]}};
  const beforeInvalid=await restorePage.evaluate(async()=>({workflow:localStorage.getItem('uros.workflow.v1'),idb:await CaseStore.exportAll()}));
  await restorePage.locator('#backup-restore').setInputFiles({name:'invalid-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(invalidBackup))});
  await restorePage.waitForFunction(()=>document.querySelector('#backup-status').textContent==='還原未完成：案件索引無效');
  const afterInvalid=await restorePage.evaluate(async()=>({workflow:localStorage.getItem('uros.workflow.v1'),idb:await CaseStore.exportAll()}));
  assert.equal(afterInvalid.workflow,beforeInvalid.workflow);
  for(const name of ['cases','activity','meta']) assert.deepEqual(afterInvalid.idb[name],beforeInvalid.idb[name]);
  check(true,'malformed workflow backup rejected through file input without changing either store');
  const restoredNavigation=restorePage.waitForEvent('framenavigated',frame=>frame===restorePage.mainFrame());
  await restorePage.locator('#backup-restore').setInputFiles(backupPath);
  await restoredNavigation;await restorePage.waitForLoadState('domcontentloaded');
  await restorePage.waitForFunction(()=>window.CaseBus?.activeRecord()?.pid!=null);
  const restored=await restorePage.evaluate(async()=>({idb:await CaseStore.exportAll(),store:localStorage.getItem('uros.workflow.v1'),profiles:localStorage.getItem('uros.profiles.'+CaseBus.activePid())}));
  assert.deepEqual(restored.idb.cases,backupDoc.idb.cases);assert.deepEqual(restored.idb.activity,backupDoc.idb.activity);assert.deepEqual(restored.idb.meta,backupDoc.idb.meta);
  check(restored.store===backupDoc.local_storage['uros.workflow.v1']&&restored.profiles===backupDoc.local_storage['uros.profiles.'+rec.pid],'real file restore preserves exact cases, event IDs, meta references and local drafts');
  await savePage.evaluate(async()=>CaseStore.meta('uros.last_backup_at','2000-01-01T00:00:00Z'));
  await savePage.reload();await savePage.waitForFunction(()=>document.querySelector('#browser-backup')?.classList.contains('backup-due'));
  check(await savePage.locator('#backup-status').innerText()!=='尚無有效備份紀錄','overdue reminder survives reload');
  await savePage.setViewportSize({width:390,height:844});await savePage.screenshot({path:resolve(artifacts,'onboarding-backup-mobile.png'),fullPage:true});
  check(await savePage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'onboarding backup mobile no overflow');

  await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('uros.workflow.v1')),pid=localStorage.getItem('uros.active_case');s.projects[pid].snap.code_name='<img src=x onerror="window.__injected=1">';localStorage.setItem('uros.workflow.v1',JSON.stringify(s));localStorage.removeItem('uros.bridge.case');});
  await page.goto(origin+'/os-simulator.html');
  check(await page.locator('#workflow-tools').isVisible()&&await page.locator('#integration-play').isHidden(),'People defaults to factual case records');
  check(await page.locator('.household-list').getAttribute('open')===null,'People household list starts collapsed');
  await page.locator('.household-list > summary').click();
  const contact=page.locator('.household-row').first(),contactId=await contact.getAttribute('data-owner');
  await contact.locator('summary').click();await contact.locator('select').selectOption('visited');await contact.locator('button').click();
  check(await page.locator('.household-list').getAttribute('open')!==null&&await page.locator('.household-row[open]').getAttribute('data-owner')===contactId,'contact save preserves the open household');
  check(await page.evaluate(sid=>CaseBus.activeRecord().wf.consent_events.some(e=>e.stakeholder_id===sid&&e.kind==='visited'),contactId),'contact editor records the selected real event');
  await page.locator('.household-search').fill('no-matching-household');
  check(await page.locator('.household-empty').isVisible(),'People empty search gives visible feedback');
  await page.locator('.household-search').fill(contactId);
  check(await page.locator('.household-row:visible').count()===1,'People search narrows the resident list');
  await page.locator('.household-list > summary').click();
  check(await page.locator('.household-search').isHidden(),'People collapses the entire household editor');
  await page.locator('[data-mode="play"]').click();await page.locator('#btn-start').waitFor();
  await page.screenshot({path:resolve(artifacts,'people-title-mobile.png'),fullPage:true});
  check(await page.locator('#integration-play > .wrap').isHidden(),'unstarted sandbox does not expose an unrelated background board');
  check(await page.evaluate(()=>!window.__injected&&!document.querySelector('img[onerror]')),'People briefing safely displays stored hostile case name');
  await page.locator('#btn-start').click();
  await page.locator('#ovl-chapter').waitFor({state:'hidden'});
  await page.screenshot({path:resolve(artifacts,'people-entry-mobile.png'),fullPage:true});
  check((await page.locator('#bridge-banner').textContent()).includes('<img')&&await page.evaluate(()=>!window.__injected&&!document.querySelector('img[onerror]')),'People planning bridge safely displays stored hostile case name');
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'People planning mobile no overflow');
  check(await page.locator('#m-ap').innerText()==='8'&&await page.locator('#m-ap-max').innerText()==='/8','People interface displays eight weekly actions');
  const doorIds=await page.evaluate(()=>Object.values(S.units).filter(u=>u.consent!=='agreed').slice(0,2).map(u=>u.id));
  await page.evaluate(id=>openCodec(id),doorIds[0]);
  await page.waitForTimeout(1800);const say1=await page.locator('#cd-say').innerText();
  check((await page.locator('#cd-freq').innerText()).includes('非訪談紀錄'),'dialogue is explicitly a simulated conversation');
  await page.locator('#cd-close').click();await page.evaluate(id=>openCodec(id),doorIds[1]);
  await page.waitForTimeout(1800);
  check((await page.locator('#cd-say').innerText())!==say1,'different simulated households have different dialogue');
  await page.locator('#cd-close').click();
  await page.evaluate(()=>{const s=CaseBus.readStore(),pid=CaseBus.activePid();s.projects[pid].wf.stakeholders=Array.from({length:81},(_,i)=>({stakeholder_id:'O'+i,role:'owner'}));s.projects[pid].snap.total=81;s.projects[pid].snap.agreed=0;CaseBus.writeStore(s);localStorage.removeItem('uros.bridge.case');});
  await page.reload();
  check(await page.locator('#integration-play').isVisible()&&new URL(page.url()).searchParams.get('tool')==='simulation','sandbox deep link remains separate from case records after reload');
  await page.locator('#btn-start').click();await page.locator('#ovl-chapter').waitFor({state:'hidden'});
  check(await page.locator('#ovl-title').isHidden(),'short mobile page has a stable, clickable start button after reload');
  check(await page.locator('#owners-cap-notice').isVisible()&&(await page.locator('#owners-cap-notice').innerText()).includes('81 戶超過沙盤上限 80'),'owner limit remains visible after entering the sandbox');
  await page.goto(origin+'/workspace.html?view=task');
  await page.waitForURL('**/os-simulator.html#workflow-task');
  check(await page.locator('#ttitle').isVisible(),'step deep-link opens active case task panel');

  const rollback=await browser.newContext(),rollbackPage=await rollback.newPage();await rollbackPage.goto(origin+'/index.html');
  await rollbackPage.waitForFunction(()=>document.querySelector('#backup-status')?.textContent==='尚無有效備份紀錄');
  const rolledBack=await rollbackPage.evaluate(async doc=>{
    const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){if(key.startsWith('uros.profiles.'))throw new DOMException('test quota','QuotaExceededError');return original.call(this,key,value);};
    let rejected=false;try{await BrowserBackup.restore(doc);}catch{rejected=true;}finally{Storage.prototype.setItem=original;}
    const all=await CaseStore.exportAll();return rejected&&all.cases.length===0&&all.activity.length===0&&!localStorage.getItem('uros.workflow.v1');
  },backupDoc);
  check(rolledBack,'localStorage quota failure rolls back IndexedDB and partial local writes');
  const fallback=await browser.newContext();await fallback.route('**/runtime/**',route=>route.fulfill({status:404,body:''}));
  const fallbackPage=await fallback.newPage();await fallbackPage.goto(origin+'/report.html');
  const fallbackSource=await fallbackPage.evaluate(()=>new Promise((resolve,reject)=>{let rt=createCoreRuntime({onReady:m=>{rt.terminate();resolve(m.runtime_source);},onError:m=>reject(Error(m.msg))});}));
  check(fallbackSource==='cdn-fallback','missing local distribution uses pinned CDN fallback');
  // ── 手機規範（UI_UX_PLAN-2026-09 §6）──
  // 這些是 CSS media query 的行為，headless 測不到，只能在真瀏覽器量。
  // 起因：實測 ① 有 148 處 <12px 文字、19 個 <44px 觸控目標、導覽列固定吃 68px。
  const phone=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,
    userAgent:"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"});
  const phonePage=await phone.newPage();
  for(const route of ["index.html","dashboard.html","evaluator.html","os-simulator.html","report.html"]){
    await phonePage.goto(origin+"/"+route,{waitUntil:"domcontentloaded"});
    await phonePage.waitForTimeout(900);
    const m=await phonePage.evaluate(()=>{
      // 觸控目標只計真正的控制項；句中的行內文字連結由 WCAG 2.5.8 明文豁免
      let small=0;
      document.querySelectorAll("button,input:not([type=range]):not([type=checkbox]):not([type=radio]),select")
        .forEach(e=>{const r=e.getBoundingClientRect();if(r.height>0&&r.height<44)small++;});
      return {small, overflow:document.documentElement.scrollWidth-window.innerWidth};
    });
    check(m.small===0, route+": every control meets the 44px touch target");
    check(m.overflow<=0, route+": no horizontal overflow at 390px");
  }
  // 導覽列捲動收合：68px 在 844px 高的螢幕上佔 8%
  await phonePage.evaluate(rec=>CaseBus.upsert({...rec,demo:false}),adoptedSite);
  await phonePage.goto(origin+"/dashboard.html",{waitUntil:"domcontentloaded"});
  await phonePage.waitForTimeout(900);
  const navOpen=await phonePage.evaluate(()=>document.getElementById("uros-stepnav").offsetHeight);
  await phonePage.evaluate(()=>window.scrollTo(0,300));
  await phonePage.waitForTimeout(350);
  const navShut=await phonePage.evaluate(()=>document.getElementById("uros-stepnav").offsetHeight);
  check(navShut<navOpen && navShut<=44 && await phonePage.locator('#uros-stepnav').evaluate(e=>e.classList.contains('sn-collapsed')), "step rail collapses to one compact row ("+navOpen+"px -> "+navShut+"px)");
  check(await phonePage.evaluate(()=>{
    const el=document.querySelector("#uros-stepnav .sn-live");
    return el ? parseFloat(getComputedStyle(el).fontSize)>=12 : false;
  }), "step figures stay readable at >=12px on phones");
  await phonePage.evaluate(rec=>CaseBus.replace(rec.pid,rec),rec);
  await phonePage.reload();await phonePage.evaluate(()=>scrollTo(0,300));await phonePage.waitForTimeout(350);
  check(await phonePage.locator('.sn-cap.sn-stale').isVisible(),'stale-snapshot warning remains visible even with compact navigation');
  await phone.close();

  // Complete a separate four-step journey and play the sandbox through settlement.
  await page.setViewportSize({width:1440,height:1000});
  await page.evaluate(rec=>CaseBus.replace(rec.pid,rec),adoptedSite);
  await page.goto(origin+'/dashboard.html');
  await page.locator('#uros-stepnav a[href="evaluator.html"]').click();
  await page.locator('#uros-stepnav a[href="os-simulator.html"]').click();
  await page.locator('[data-mode="play"]').click();await page.locator('#btn-start').click();
  await page.locator('#ovl-chapter').waitFor({state:'hidden'});
  const factualBefore=await page.evaluate(()=>localStorage.getItem('uros.workflow.v1'));
  let turns=0;
  while(!(await page.evaluate(()=>S.over))&&turns++<300){
    await page.locator('#ovl-chapter').waitFor({state:'hidden'});
    const next=await page.evaluate(()=>{if(!S.ap)return null;const rows=Object.values(S.units).filter(u=>u.consent!=='agreed').sort((a,b)=>Number(b.boss)-Number(a.boss)||b.stance-a.stance);return rows[0]?SIMCORE.code(rows[0].id):null;});
    if(!next){await page.locator('#btn-week').click();continue;}
    await page.locator('.cell[role="button"]').filter({has:page.locator('span').filter({hasText:new RegExp('^'+next+'$')})}).click();
    await page.locator('#cd-listen').click();
    if(await page.locator('#ovl-codec').isVisible())await page.locator('#cd-close').click();
  }
  check(await page.evaluate(()=>S.over),'full sandbox journey reaches settlement through visible controls');
  check(await page.evaluate(()=>localStorage.getItem('uros.workflow.v1'))===factualBefore,'complete sandbox play preserves factual consent records');
  await page.waitForTimeout(450);
  await page.screenshot({path:resolve(artifacts,'people-settlement-desktop.png'),fullPage:true});
  await page.locator('#uros-stepnav a[href="report.html"]').click();
  await page.waitForFunction(()=>!document.getElementById('analysis-run').disabled,{},{timeout:150000});
  await page.locator('#analysis-run').click();
  await page.waitForFunction(()=>document.getElementById('analysis-status').textContent.startsWith('分析完成'),{},{timeout:120000});
  check(await page.locator('#export-strategy').isEnabled(),'four-step journey ends with a current Core strategy');
  check(await page.locator('#household-observations').getAttribute('open')===null,'return to Decision keeps household details collapsed');
  await page.waitForTimeout(450);await page.screenshot({path:resolve(artifacts,'decision-finished-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:resolve(artifacts,'decision-finished-mobile.png'),fullPage:true});
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'finished Decision fits a narrow viewport');
  check(await page.locator('.decision-hub').evaluate(hub=>{const a=hub.getBoundingClientRect(),b=hub.firstElementChild.getBoundingClientRect();return b.left>=a.left&&b.right<=a.right&&b.top>=a.top&&b.bottom<=a.bottom;}),'Decision center text fits inside its circle');

  console.log("BROWSER: "+passed+" passed; screenshots: "+artifacts);
} catch(error) {
  const page=browser?.contexts()[0]?.pages()[0];
  if(page){
    await page.screenshot({path:resolve(artifacts,'browser-failure.png'),fullPage:true}).catch(()=>{});
    console.error('Failure layout',await page.evaluate(()=>({url:location.pathname,scrollY,viewport:[innerWidth,innerHeight],start:document.querySelector('#btn-start')?.getBoundingClientRect().toJSON(),title:document.querySelector('#ovl-title')?.getBoundingClientRect().toJSON()})).catch(()=>null));
  }
  throw error;
} finally {if(browser)await browser.close();await new Promise(r=>server.close(r));}
