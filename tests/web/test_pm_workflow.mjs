import assert from 'node:assert/strict';
import PMWorkflow from '../../apps/web/pm-workflow.js';

assert.equal(PMWorkflow.model(null),null);
const rec={engine:{params:{}},snap:{code_name:'測試案件',core_version:'0.6.0',input_hash:'sha256:test',computed_at:'2026-09-30T00:00:00Z'},wf:{project:{stage:'S3'}},view:{return_rate:0.18,shared_cost_ratio:0.42,warnings:[]}};
const facts={agreed:3,total:5,source:'recorded-events'};
const current=PMWorkflow.model(rec,facts,{stale:false},'people');
assert.equal(current.resume,'os-simulator.html');
assert.equal(current.next.href,'os-simulator.html');
assert.deepEqual(current.metrics,{return_rate:0.18,shared_cost_ratio:0.42,agreed:3,total:5});
assert.equal(current.issues.length,0);
assert.equal(PMWorkflow.percent(null),'—');

const stale=PMWorkflow.model(rec,{agreed:3,total:5,source:'snapshot'},{stale:true},'decision');
assert.equal(stale.next.href,'dashboard.html#site-massing-host');
assert.ok(stale.issues.some(issue=>issue.href==='os-simulator.html#workflow-board'));

const snapshotOnly=PMWorkflow.model({...rec,engine:null,view:{},snap:{code_name:'待補案件'}},{agreed:null,total:null,source:'snapshot'},{stale:false},'unknown');
assert.equal(snapshotOnly.metrics.return_rate,null);
assert.equal(snapshotOnly.resume,'dashboard.html');
assert.equal(snapshotOnly.next.href,'workspace.html#cases');
console.log('PM workflow factual next-action checks passed');
