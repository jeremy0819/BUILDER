import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {resolve,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import EvidenceLedger from '../../apps/web/evidence-ledger.js';

const root=fileURLToPath(new URL('../../',import.meta.url)),web=resolve(root,'apps/web'),artifacts=resolve(root,'tools/browser/artifacts');
const py=spawnSync(process.env.PYTHON||'python',['-c',`import copy,json,pathlib
from core.redcf.recompute import input_hash,recompute
e=json.loads(pathlib.Path('schemas/examples/v2/v2_案例A_都更全案管理.json').read_text(encoding='utf-8'))['engine']
out=[]
for price in (60,65,70):
 x=copy.deepcopy(e);x['params']['住宅單價']=price;x['params']['案件名稱']='Synthetic history'
 out.append({'engine':x,'result':recompute(x),'input_hash':input_hash(x)})
print(json.dumps(out))`],{cwd:root,encoding:'utf8'});
assert.equal(py.status,0,py.stderr);const inputs=JSON.parse(py.stdout);
const fact=EvidenceLedger.caseFact({pid:'synthetic-history'},{field:'Private synthetic note',value:'Not a financial measurement',source:'Synthetic evidence source',evidence_type:'assumed'},'f-dashboard-synthetic','2026-10-07T00:00:00.000Z');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css; charset=utf-8','.wasm':'application/wasm'};
const server=createServer((req,res)=>{
 const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname),base=path.startsWith('/runtime/')?artifacts:web,file=resolve(base,'.'+path);
 if(!file.startsWith(base+sep)||!existsSync(file)){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;let browser,passed=0;
const check=(value,label)=>{assert.ok(value,label);passed++;console.log('PASS',label);};
const settled=page=>page.waitForFunction(()=>!document.querySelector('#executive-query button').disabled&&document.querySelector('#executive-content').hidden===false,null,{timeout:150000});
try{
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_PATH}:{})});
 const context=await browser.newContext({viewport:{width:1440,height:900},timezoneId:'America/Los_Angeles'}),page=await context.newPage(),errors=[],external=[];
 page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE ERROR',e.message);});
 await context.route('https://**',r=>{external.push(r.request().url());return r.fulfill({status:403,body:'blocked'});});
 await page.goto(origin+'/executive-dashboard.html');
 await page.waitForFunction(()=>document.querySelector('#executive-status').textContent!=='讀取已存案件…');
 check(await page.locator('#executive-empty').isVisible(),'empty local browser has no fabricated case');
 await page.evaluate(async ({rows,fact})=>{
  const rec=CaseBus.buildRecord(rows[2]);rec.pid='synthetic-history';rec.wf.project.project_id=rec.pid;
  rec.snap.computed_at='2026-10-01T10:00:00+08:00';rec.wf.project.snapshots=[{id:'baseline',computed_at:'2026-06-01T10:00:00+08:00',input_hash:rows[0].input_hash,core_version:'0.5.0'},{id:'missing',computed_at:'2026-08-01T10:00:00+08:00',input_hash:'sha256:unavailable',core_version:'0.5.0'}];
  rec.evidence_facts=[fact];
  CaseBus.replace(rec.pid,rec);
  const other=structuredClone(rec);other.pid='other-history';other.snap.code_name='Other synthetic case';other.wf.project.project_id=other.pid;other.wf.project.snapshots=[];CaseBus.replace(other.pid,other);CaseBus.setActive(rec.pid);
  const dates=['2026-06-01T10:00:00+08:00','2026-07-01T10:00:00+08:00','2026-09-29T10:00:00+08:00'];
  const scenarios=rows.map((r,i)=>({scenario_id:'s'+i,name:i===1?'<img src=x onerror="window.dashboardXSS=1">':'合成方案 '+i,engine:r.engine,input_hash:r.input_hash,created_at:dates[i],authoritative:i===2}));
  await CaseStore.meta('scenario:'+rec.pid,{scenarios});
  await CaseStore.append(rec.pid,{kind:'scenario',field:'authoritative',target:{type:'scenario',id:'s1'},after:true,ts:'2026-07-18T10:00:00+08:00'});
  await CaseStore.append(rec.pid,{kind:'scenario',field:'authoritative',target:{type:'scenario',id:'s2'},after:true,ts:'2026-09-29T10:00:00+08:00'});
  await CaseStore.append(rec.pid,{kind:'input',field:'住宅單價',before:65,after:70,intent:'<img src=x onerror="window.dashboardXSS=1">',ts:'2026-09-29T11:00:00+08:00'});
 },{rows:inputs,fact});
 await page.reload();await settled(page);
 check(await page.locator('#executive-kpis button').count()===6,'six compact KPIs');
 check((await page.locator('#executive-status').innerText()).includes('5 筆歷史'),'snapshot and adoption history, including missing input');
 check((await page.locator('#executive-basis').innerText()).includes('現行 Core 0.6.0'),'history is explicitly current-Core replay');
 check((await page.locator('#executive-basis').innerText()).includes('同源'),'Dashboard exposes the actual ready runtime source');
 check(await page.locator('[data-point]').count()===4,'four real values, missing point not fabricated');
 check((await page.locator('.trend-line').getAttribute('d')).split('M').length===3,'missing snapshot breaks the line');
 check((await page.locator('#executive-costs tbody tr').count())===7,'seven Core cost components');
 check(!(await page.locator('body').innerText()).includes('Private synthetic note'),'private candidate evidence is not presented as a Dashboard financial measurement');
 await page.locator('[data-cost]').first().click();check((await page.locator('#executive-evidence-body').innerText()).includes('A工程費用'),'cost component opens its Core source');await page.locator('#executive-close').click();await page.locator('#executive-clear-day').click();
 check(await page.locator('[data-kpi="funding_gap"] strong').innerText()==='—','cost disbursement is not mislabeled funding gap');
 check(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight),'default desktop fits in one screen');
 await page.setViewportSize({width:1280,height:800});await page.waitForTimeout(150);check(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight),'laptop desktop fits in one screen');await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(150);
 const original=await page.evaluate(async()=>({ls:localStorage.getItem(CaseBus.KEY),active:CaseBus.activePid(),backup:await CaseStore.exportAll()}));delete original.backup.exported_at;
 const coords=await page.locator('[data-point]').evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.point,x:Number(n.getAttribute('cx'))})));
 check(coords[1].x-coords[0].x<coords[3].x-coords[1].x,'time spacing reflects actual elapsed dates');
 await page.locator('[data-point]').nth(2).click();
 check(await page.locator('#executive-evidence').isVisible()&&(await page.locator('#executive-events-title').innerText()).includes('2026-09-29'),'point opens provenance and same-day events');
 check((await page.locator('#executive-evidence-body').innerText()).includes('sha256:'),'evidence retains source fingerprint');
 await page.locator('#executive-close').click();await page.locator('#executive-clear-day').click();
 await page.locator('#executive-missing summary').click();await page.locator('[data-missing]').click();
 check((await page.locator('#executive-evidence-body').innerText()).includes('缺少完整輸入'),'missing historical inputs have an inspectable source');
 await page.locator('#executive-close').click();await page.locator('#executive-missing summary').click();
 await page.locator('[data-series="scenarios"]').click();await settled(page);
 check(await page.locator('[data-point]').count()===3&&(await page.locator('#executive-basis').innerText()).includes('未必採用'),'proposal creation is a separate historical series');
 await page.locator('[data-point]').nth(1).focus();await page.keyboard.press('Enter');
 check(await page.locator('#executive-evidence').isVisible(),'keyboard activates chart evidence');
 check(await page.locator('#executive-evidence-body img').count()===0&&await page.evaluate(()=>!window.dashboardXSS),'stored names and Activity cannot execute HTML');
 await page.locator('#executive-close').click();
 // Anchor the query date, not the machine date, so the calendar-month assertion stays reproducible.
 await page.locator('#executive-end').fill('2026-10-05');await page.locator('#executive-end').dispatchEvent('change');await settled(page);
 await page.locator('#executive-period').selectOption('3m');await settled(page);
 check(await page.locator('#executive-start').inputValue()==='2026-07-05','three-month query is calendar-based');
 await page.locator('#executive-period').selectOption('all');await settled(page);
 check(await page.locator('[data-point]').count()===3,'all clears the previous period start');
 await page.locator('#executive-metric').selectOption('agreed');await settled(page);
 check(await page.locator('[data-point]').count()===0&&(await page.locator('#executive-chart').innerText()).includes('未保存'),'live consent count is never projected backward');
 await page.locator('#executive-case').selectOption('other-history');await settled(page);
 check(await page.evaluate(()=>CaseBus.activePid())===original.active,'query case selection never changes the Workspace case');
 const after=await page.evaluate(async()=>({ls:localStorage.getItem(CaseBus.KEY),active:CaseBus.activePid(),backup:await CaseStore.exportAll()}));delete after.backup.exported_at;
 check(JSON.stringify(after)===JSON.stringify(original),'queries leave all case, Activity, scenario and active-case data unchanged');
 await page.locator('#executive-case').selectOption('synthetic-history');await settled(page);
 await page.locator('[data-series="adopted"]').click();await settled(page);await page.locator('#executive-metric').selectOption('return_rate');await settled(page);
 mkdirSync(artifacts,{recursive:true});await page.screenshot({path:resolve(artifacts,'executive-desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);
 await page.screenshot({path:resolve(artifacts,'executive-mobile.png'),fullPage:true});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))console.log('OVERFLOW',await page.evaluate(()=>Array.from(document.querySelectorAll('body *')).filter(n=>n.getBoundingClientRect().right>innerWidth+1).map(n=>[n.tagName,n.id,n.className,n.getBoundingClientRect().right]).slice(0,20)));
 check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile has no horizontal page overflow');
 check(await page.locator('.trend-point').count()===4,'mobile chart remains visible');
 check(await page.locator('.executive-chart svg').evaluate(n=>Number(n.viewBox.baseVal.width)<=400),'mobile uses actual chart width, not shrunken desktop labels');
 await page.screenshot({path:resolve(artifacts,'executive-mobile.png'),fullPage:true});
 await page.locator('[data-kpi="owner_return_value"]').click();check((await page.locator('#executive-evidence-body').innerText()).includes('地主分回'),'KPI drills into the correct financial definition');await page.locator('#executive-close').click();
 await page.locator('#executive-case').selectOption('other-history');await settled(page);await page.locator('[data-kpi="agreed"]').click();
 await page.locator('#executive-evidence-body a').click();
 await page.waitForFunction(()=>typeof CaseBus!=='undefined'&&CaseBus.activePid()==='other-history');
 check(await page.evaluate(()=>CaseBus.activePid())==='other-history','explicit source handoff switches to the queried case');
 check(errors.length===0,'healthy Dashboard has no unhandled page error');
 check(external.length===0,'Dashboard sends no external request with same-origin Core');
 const offline=await browser.newContext({viewport:{width:1440,height:900}});
 await offline.addInitScript(()=>{window.Worker=class{constructor(){throw Error('Worker blocked');}};});
 const down=await offline.newPage();await down.goto(origin+'/executive-dashboard.html');await down.evaluate(row=>{const rec=CaseBus.buildRecord(row);rec.snap.computed_at='2026-10-01';CaseBus.replace(rec.pid,rec);},inputs[2]);await down.reload();await settled(down);
 check((await down.locator('#executive-basis').innerText()).includes('僅顯示已存快照'),'blocked Core still permits clearly labeled stored-snapshot lookup');
 check(await down.locator('[data-kpi="total_sales"] strong').innerText()!=='—','stored Core sales remain readable offline');
 check(await down.locator('[data-point]').count()===0,'offline snapshot does not fabricate a trend or period comparison');
 await down.locator('#executive-query button').click();await settled(down);check((await down.locator('#executive-status').innerText()).includes('重試'),'retry does not leave the query stuck');
 console.log('DASHBOARD BROWSER: '+passed+' passed');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
