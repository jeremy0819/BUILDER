import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const root=fileURLToPath(new URL('../../',import.meta.url)),web=resolve(root,'apps/web'),artifacts=resolve(root,'tools/browser/artifacts');
const fixture={};new Function('self',readFileSync(resolve(web,'demo-cases.js'),'utf8'))(fixture);
const rec=structuredClone(fixture.DEMO_CASES[0]);rec.pid=rec.wf.project.project_id;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css; charset=utf-8','.wasm':'application/wasm'};
const server=createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const base=pathname.startsWith('/runtime/')?artifacts:web,file=resolve(base,'.'+pathname);
  if(!file.startsWith(base+sep)||!existsSync(file)){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
let browser,passed=0;const check=(value,label)=>{assert.ok(value,label);passed++;console.log('PASS',label);};
try{
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_PATH}:{})});
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
  await context.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({status:403,body:'blocked'}));
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/evaluator.html');
  await page.evaluate(record=>CaseBus.replace(record.pid,record),rec);await page.reload();
  await page.waitForFunction(()=>{const b=document.querySelector('[data-sc="save"]');return b&&!b.disabled;},{},{timeout:150000});
  await page.locator('[data-sc="name"]').fill('合成基準');await page.locator('[data-sc="save"]').click();
  await page.waitForFunction(async()=>{const pid=CaseBus.activePid();return (await CaseStore.listScenarios(pid)).length===1;});
  check(await page.evaluate(async()=>{const list=await CaseStore.listScenarios(CaseBus.activePid());return list[0].authoritative&&list[0].engine&&/^sha256:[0-9a-f]{64}$/.test(list[0].input_hash);}),
    'first saved scenario has complete input and Core hash');
  const unitPrice=page.locator('input[type="number"][data-param="住宅單價"]');
  await unitPrice.fill(String(Number(await unitPrice.inputValue())+1));
  await page.waitForFunction(()=>{const b=document.querySelector('[data-sc="save"]');return b&&!b.disabled;},{},{timeout:120000});
  await page.locator('[data-sc="name"]').fill('合成對照');await page.locator('[data-sc="save"]').click();
  await page.waitForFunction(async()=>{const pid=CaseBus.activePid();return (await CaseStore.listScenarios(pid)).length===2;});
  check(await page.evaluate(async()=>{const list=await CaseStore.listScenarios(CaseBus.activePid());return list[0].input_hash!==list[1].input_hash&&list.filter(s=>s.authoritative).length===1;}),
    'variant input changes hash while only one scenario stays authoritative');
  const beforeCompare=await page.evaluate(()=>CaseBus.activeRecord().snap.input_hash);
  await page.locator('[data-sc="compare"]').click();await page.locator('.sc-table-wrap table').waitFor({timeout:120000});
  check(await page.locator('.sc-table-wrap tbody tr').count()===7,'comparison replays seven available Core metrics');
  check((await page.locator('.sc-table-wrap').innerText()).includes('相較作準')&&
    JSON.stringify(await page.locator('.sc-badge').allInnerTexts())===JSON.stringify(['作準']),'comparison shows deltas and only the authoritative badge');
  check(/相較作準：[+-]/.test(await page.locator('.sc-table-wrap').innerText()),'changed input yields a nonzero Core result delta');
  check(await page.evaluate(()=>CaseBus.activeRecord().snap.input_hash)===beforeCompare,'read-only comparison leaves the working case unchanged');
  await page.setViewportSize({width:390,height:844});
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'scenario table scrolls within the mobile viewport');
  page.once('dialog',dialog=>dialog.accept());
  await Promise.all([page.waitForEvent('framenavigated',{timeout:30000}),page.locator('[data-sc-adopt]').click()]);
  await page.waitForFunction(async()=>{const pid=CaseBus.activePid(),list=await CaseStore.listScenarios(pid),current=CaseBus.activeRecord();return list.length===2&&list.filter(s=>s.authoritative).length===1&&list.find(s=>s.authoritative).input_hash===current.snap.input_hash;},{},{timeout:30000});
  check(await page.evaluate(async()=>{const pid=CaseBus.activePid(),list=await CaseStore.listScenarios(pid),current=CaseBus.activeRecord(),acts=await CaseStore.listActivity(pid);return list.find(s=>s.authoritative).name==='合成對照'&&
    current.snap.input_hash===list.find(s=>s.authoritative).input_hash&&acts.some(e=>e.kind==='scenario'&&e.field==='authoritative'&&e.target.id===list.find(s=>s.authoritative).scenario_id);}),
    'adoption binds case snapshot, authoritative scenario and Activity');
  check(errors.length===0,'scenario journey has no unhandled page errors');
  console.log('SCENARIO BROWSER: '+passed+' passed');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
