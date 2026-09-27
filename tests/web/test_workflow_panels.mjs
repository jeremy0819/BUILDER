// Shared panels: exercise actual event handlers and async replies without a browser dependency.
// This small DOM double tests persistence/lifecycle behavior; browser QA covers layout and accessibility.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';

const root=join(dirname(fileURLToPath(import.meta.url)), '../..');
const source=readFileSync(join(root,'apps/web/workflow-panels.js'),'utf8');
const logic=readFileSync(join(root,'apps/web/workflow-logic.js'),'utf8');
const caseBusExports={};
new Function('self',readFileSync(join(root,'apps/web/case-bus.js'),'utf8'))(caseBusExports);
const fixture=JSON.parse(readFileSync(join(root,'schemas/examples/v2/v2_1_案例D_權變示範.json'),'utf8'));
let pass=0,fail=0;
const ok=(value,label)=>{if(value)pass++;else{fail++;console.error('FAIL',label);}};
const copy=value=>JSON.parse(JSON.stringify(value));
const flush=async()=>{await Promise.resolve();await Promise.resolve();};
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}

class Element {
  constructor(tag='div'){this.tagName=tag;this.children=[];this.attrs={};this.dataset={};this._text='';this.hidden=false;this._value='';this.classList={add:(c)=>this.attrs.class=((this.attrs.class||'')+' '+c).trim(),toggle:()=>{}};}
  setAttribute(key,value){this.attrs[key]=String(value);if(key==='id')this.id=String(value);if(key==='hidden')this.hidden=true;if(key.startsWith('data-'))this.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(value);if(key==='value')this._value=String(value);}
  getAttribute(key){return this.attrs[key]??null;}
  appendChild(child){child.parent=this;this.children.push(child);return child;}
  replaceChildren(){this.children=[];this._text='';this._html='';}
  get value(){if(this.tagName==='select'&&!this._value){const options=this.querySelectorAll('option');return (options.find(o=>o.getAttribute('selected')!==null)||options[0])?.value||'';}return this._value;}
  set value(value){this._value=value;}
  get placeholder(){return this.attrs.placeholder||'';}
  get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
  set textContent(text){this.children=[];this._text=String(text);}
  set innerHTML(html){
    this.replaceChildren();this._html=html;const stack=[this];
    for(const token of html.match(/<[^>]+>|[^<]+/g)||[]){
      if(token.startsWith('</')){const name=token.match(/^<\/(\w+)/)?.[1];while(stack.length>1){if(stack.pop().tagName===name)break;}continue;}
      if(token.startsWith('<')){const name=token.match(/^<(\w+)/)?.[1];if(!name)continue;const el=new Element(name);for(const m of token.slice(name.length+1,-1).matchAll(/([\w-]+)(?:="([^"]*)"|='([^']*)'|=([^\s>]+))?/g))el.setAttribute(m[1],m[2]??m[3]??m[4]??'');stack.at(-1).appendChild(el);if(!['input','br','hr','img','meta','link'].includes(name))stack.push(el);}
      else stack.at(-1)._text+=token;
    }
  }
  get innerHTML(){return this._html||'';}
  matches(selector){
    const attrs=[...selector.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)];
    if(attrs.some(([,key,val])=>this.getAttribute(key)===null||(val!==undefined&&this.getAttribute(key)!==val)))return false;
    const plain=selector.replace(/\[[^\]]+\]/g,'');const tag=plain.match(/^\w+/)?.[0];if(tag&&tag!==this.tagName)return false;
    const id=plain.match(/#([\w-]+)/)?.[1];if(id&&id!==this.id)return false;
    return [...plain.matchAll(/\.([\w-]+)/g)].every(([,c])=>(this.attrs.class||'').split(/\s+/).includes(c));
  }
  querySelectorAll(selector){
    const all=[];const visit=e=>{for(const c of e.children){all.push(c);visit(c);}};visit(this);
    return all.filter(el=>selector.split(',').some(part=>{const pieces=part.trim().split(/\s+/);if(!el.matches(pieces.pop()))return false;let at=el.parent;while(pieces.length){const next=pieces.pop();while(at&&!at.matches(next))at=at.parent;if(!at)return false;at=at.parent;}return true;}));
  }
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  closest(selector){for(let at=this;at;at=at.parent)if(at.matches(selector))return at;return null;}
}

function harness(views=['task'],hash=''){
  const listeners=new Map(),lists=[],runs=[],runtimes=[];let active='A',store,writeError=null,writes=0;
  const window={addEventListener:(name,fn)=>{if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);},removeEventListener:(name,fn)=>listeners.get(name)?.delete(fn)};
  const emit=(type,key)=>{for(const fn of [...(listeners.get(type)||[])])fn({type,key});};
  const CaseBus={KEY:'workflow',ACTIVE_KEY:'active',EVENT:'case-changed',decisionBinds:caseBusExports.CaseBus.decisionBinds,activePid:()=>active,readStore:()=>copy(store),writeStore:value=>{if(writeError)throw Error(writeError);store=copy(value);writes++;emit('case-changed');}};
  const CaseStore={listScenarios:pid=>{const job={pid,...deferred()};lists.push(job);return job.promise;}};
  window.CaseBus=CaseBus;window.CaseStore=CaseStore;
  window.createCoreRuntime=callbacks=>{const rt={ready:true,callbacks,terminated:false,terminate(){this.terminated=true;},attribute:(...args)=>{const job={args,...deferred()};runs.push(job);return job.promise;}};runtimes.push(rt);return rt;};
  const context=vm.createContext({window,CaseStore,console,crypto:{randomUUID},location:{hash},history:{replaceState(){}},document:{createElement:tag=>new Element(tag)}});
  vm.runInContext(logic,context);const WL=vm.runInContext('WORKLOGIC',context);
  const record=pid=>({wf:{...copy(WL.importV21ToWorkflow(fixture)),project:{...copy(WL.importV21ToWorkflow(fixture).project),project_id:pid,code_name:pid}},snap:copy(WL.displaySnapshot(fixture))});
  store={order:['A','B'],projects:{A:record('A'),B:record('B')}};
  vm.runInContext(source,context);const host=new Element('section'),panel=window.WorkflowPanels.mount(host,views);
  return {host,panel,window,lists,runs,runtimes,listeners,emit,get store(){return copy(store);},set store(value){store=copy(value);},get writes(){return writes;},set active(value){active=value;},set writeError(value){writeError=value;},$(s){return host.querySelector(s);},click(s){const el=host.querySelector(s);if(!el)throw Error('Missing control '+s);return el.onclick?.({target:el});}};
}

const h=harness();
for(const [view,file] of Object.entries({bench:'os-simulator',board:'os-simulator',task:'os-simulator',dec:'report',time:'report',attr:'report',mass:'dashboard',fin:'evaluator'}))ok(h.window.WorkflowPanels.route(view)===file+'.html#workflow-'+view,'legacy route retains '+view+' in its owning step');
ok(h.window.WorkflowPanels.route('unknown')==='dashboard.html','unknown legacy route falls back to the first step');
h.$('#ttitle').value='First task';h.click('#taddbtn');
ok(h.store.projects.A.wf.tasks.length===1&&h.store.projects.B.wf.tasks.length===0,'task writes affect only the active case');
ok(h.$('.workflow-status').textContent.includes('已儲存'),'successful mutation has visible status');
const withUnrelated=h.store;withUnrelated.projects.B.wf.project.code_name='Concurrent B edit';h.store=withUnrelated;
h.$('#ttitle').value='Retry draft';h.writeError='QuotaExceededError';
let thrown=false;try{h.click('#taddbtn');}catch{thrown=true;}
ok(!thrown&&h.$('.workflow-status').textContent.includes('未儲存：QuotaExceededError'),'save failure remains visible after a successful rerender');
ok(h.store.projects.A.wf.tasks.length===1&&h.$('#ttitle').value==='Retry draft','failed write preserves the saved record and unsaved draft');
h.writeError=null;h.click('#taddbtn');
ok(h.store.projects.A.wf.tasks.length===2&&h.store.projects.B.wf.project.code_name==='Concurrent B edit','retry reads the current store and preserves other cases');
h.$('#ttitle').value='Stale draft';h.emit('storage','irrelevant');
ok(h.$('.workflow-refresh').hidden,'unrelated storage changes do not invalidate the editor');
h.emit('storage','workflow');const beforeConflict=h.writes;h.click('#taddbtn');
ok(h.writes===beforeConflict&&h.$('#ttitle').value==='Stale draft','external update blocks stale writes while preserving text');
ok(!h.$('.workflow-refresh').hidden&&h.$('.workflow-status').textContent.includes('未儲存'),'stale write explains recovery');
h.click('.workflow-refresh');h.$('#ttitle').value='Fresh task';h.click('#taddbtn');
ok(h.store.projects.A.wf.tasks.length===3,'explicit refresh allows editing again');
h.$('#ttitle').value='Wrong case';h.active='B';const beforeSwitch=h.writes;h.click('#taddbtn');
ok(h.writes===beforeSwitch,'active-case change blocks a stale form even before a storage event');
h.emit('storage','active');
ok(h.$('.workflow-context').textContent.startsWith('A')&&h.$('#ttitle').value==='Wrong case'&&h.$('.workflow-status').textContent.includes('作用中案件已切換'),'active-case notification preserves the old draft and explains the switch');
h.click('.workflow-refresh');
ok(h.$('.workflow-context').textContent.startsWith('Concurrent B edit'),'explicit refresh renders the newly active case');
h.$('#ttitle').value='<img src=x onerror=alert(1)>';h.click('#taddbtn');
ok(h.store.projects.B.wf.tasks.length===1&&!h.$('img'),'task text is escaped after save and render');

// Render actual workbench UI using CaseBus's existing input_hash × core_version binding rule.
const bench=harness(['bench']),benchStore=bench.store,benchSnapshot=benchStore.projects.A.snap;
const validDecision={input_hash:benchSnapshot.input_hash,core_version:benchSnapshot.core_version,
  verdict:'STOP',completion_probability:0.42,decision_urgency:0.61,decision_engine_version:'test-engine'};
for(const [label,decision,snapshot] of [
  ['input hash differs',{...validDecision,input_hash:'sha256:'+'e'.repeat(64)},benchSnapshot],
  ['Core version differs',{...validDecision,core_version:'another-core'},benchSnapshot],
  ['decision Core version unknown',{...validDecision,core_version:'unknown'},benchSnapshot],
  ['snapshot Core version missing',validDecision,{...benchSnapshot,core_version:''}]
]){
  const store=bench.store;store.projects.A.decision=decision;store.projects.A.snap=snapshot;bench.store=store;bench.panel.show('bench');
  const text=bench.$('.workflow-pane').textContent;
  ok(!text.includes('風險 · Decision Engine')&&!text.includes('STOP')&&!text.includes('42%'),'workbench hides stale decision risk when '+label);
}
const paired=bench.store;paired.projects.A.decision=validDecision;paired.projects.A.snap=benchSnapshot;bench.store=paired;bench.panel.show('bench');
ok(bench.$('.workflow-pane').textContent.includes('風險 · Decision Engine')&&bench.$('.workflow-pane').textContent.includes('STOP')&&bench.$('.workflow-pane').textContent.includes('42%'),'workbench retains the verbatim risk for a valid decision/snapshot pair');
ok(bench.writes===0,'risk binding checks do not mutate the saved decision or snapshot');
bench.panel.destroy();

const scenarios=pid=>['1','2','3'].map((id,i)=>({scenario_id:pid+id,name:pid+' scenario '+id,authoritative:i===0,engine:{params:{custom:pid+id},floors:[{floor:id}]},input_hash:'sha256:'+id.repeat(64)}));
const a=harness(['task','attr'],'#workflow-attr');
a.panel.show('task');a.lists[0].resolve(scenarios('OLD'));await flush();
ok(a.$('#ttitle')&&!a.$('#atBase')&&a.runtimes.length===0,'late scenario list cannot overwrite another panel or start Core');
a.panel.show('attr');const oldList=a.lists.at(-1);a.active='B';a.emit('storage','active');a.click('.workflow-refresh');oldList.resolve(scenarios('A'));await flush();
ok(!a.$('#atBase')&&a.$('.workflow-pane').textContent.includes('讀取方案'),'late previous-case scenarios do not populate the current case');
a.lists.at(-1).resolve(scenarios('B'));await flush();a.runtimes[0].callbacks.onReady();
ok(a.$('#atBase').value==='B1'&&a.$('#atCmp').value==='B2','fresh scenario list selects current-case baseline and comparison');
a.click('#atRun');
ok(JSON.stringify(a.runs[0].args)===JSON.stringify([scenarios('B')[0].engine,scenarios('B')[1].engine,'return_rate','auto']),'attribution receives both complete engine inputs');
a.$('#atCmp').value='B3';a.$('#atCmp').onchange({target:a.$('#atCmp')});
a.runs[0].resolve({error:'STALE_REPLY'});await flush();
ok(!a.$('.workflow-pane').textContent.includes('STALE_REPLY')&&a.$('.workflow-pane').textContent.includes('方案已變更'),'changing selection ignores an in-flight reply and visibly requests recomputation');
a.click('#atRun');const oldRun=a.runs.at(-1);a.panel.show('task');oldRun.reject(Error('STALE_ERROR'));await flush();
ok(a.$('#ttitle')&&!a.$('.workflow-pane').textContent.includes('STALE_ERROR'),'late attribution failure cannot overwrite another panel');
a.panel.show('attr');a.lists.at(-1).resolve(scenarios('B'));await flush();a.click('#atRun');
const currentRun=a.runs.at(-1);currentRun.resolve({error:'CURRENT_CORE_ERROR'});await flush();
ok(a.$('.workflow-pane').textContent.includes('CURRENT_CORE_ERROR'),'current attribution failure is visible');
a.panel.show('attr');a.lists.at(-1).resolve(scenarios('B'));await flush();
ok(!a.$('.workflow-pane').textContent.includes('CURRENT_CORE_ERROR'),'reopening attribution clears the previous comparison failure');
a.click('#atRun');const previousCaseRun=a.runs.at(-1);
a.active='A';a.emit('storage','active');a.click('.workflow-refresh');a.lists.at(-1).resolve(scenarios('A'));await flush();
previousCaseRun.resolve({error:'PREVIOUS_CASE_REPLY'});await flush();
ok(a.$('#atBase').value==='A1'&&!a.$('.workflow-pane').textContent.includes('PREVIOUS_CASE_REPLY'),'in-flight attribution from another case cannot leak into the new case');
a.click('#atRun');const previousStoreRun=a.runs.at(-1);a.emit('storage','workflow');
previousStoreRun.resolve({error:'BEFORE_STORE_UPDATE'});await flush();
ok(!a.$('.workflow-pane').textContent.includes('BEFORE_STORE_UPDATE')&&!a.$('.workflow-refresh').hidden,'an external store update invalidates pending attribution and exposes refresh');
ok(a.writes===0,'viewing and computing attribution never persists workflow changes');
a.panel.show('attr');const pending=a.lists.at(-1);a.panel.destroy();pending.resolve(scenarios('B'));await flush();
ok(a.host.children.length===0&&a.runtimes[0].terminated,'destroy disposes Core and ignores pending replies');
ok([...a.listeners.values()].every(set=>set.size===0),'destroy removes case, storage and navigation listeners');
h.panel.destroy();
console.log(`\nWORKFLOW PANELS headless: ${pass} passed, ${fail} failed`);
if(fail)process.exit(1);
