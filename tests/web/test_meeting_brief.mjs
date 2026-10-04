import assert from 'node:assert/strict';
globalThis.self=globalThis;
await import('../../apps/web/pm-workflow.js');
await import('../../apps/web/project-pulse.js');
await import('../../apps/web/meeting-brief.js');
const Brief=globalThis.MeetingBrief;

const rec={snap:{code_name:'合成案件',core_version:'0.6.0',input_hash:'sha256:test'},view:{return_rate:0.181,shared_cost_ratio:0.42},
  wf:{project:{stage:'S3',stage_history:[{stage:'S3',ts:'2026-10-01T08:00:00Z'}]},
    tasks:[{title:'確認文件',status:'blocked',owner_role:'代書',due:'2026-10-08'},{title:'重算財務',status:'doing',owner_role:'規劃',due:'2026-10-06'},{title:'已辦',status:'done'}],
    consent_events:[{event_id:'e1',stakeholder_id:'A01',kind:'contacted',ts:'2026-10-02T08:00:00Z'}]}};
const activity=[{key:1,kind:'edit',field:'營造單價',before:20,after:21,ts:'2026-10-03T08:00:00Z'}];
const m=Brief.model(rec,activity,'2026-10-02T09:00:00Z','是否採 A 方案\n是否重估成本',
  {agreed:1,total:3,source:'recorded-events'},{stale:true});
assert.equal(m.name,'合成案件');
assert.equal(m.stage,'S3');
assert.equal(m.consent,'1 / 3 戶');
assert.equal(m.returnRate,'18.1%');
assert.equal(m.changeCount,1);
assert.equal(m.changes[0].source,'Activity');
assert.equal(m.blocked.length,1);
assert.equal(m.actions.length,2);
assert.equal(m.actions[0].title,'重算財務');
assert.deepEqual(m.topics,['是否採 A 方案','是否重估成本']);
assert.match(m.coreNote,/需重算/);
assert.equal(Brief.model(rec,null,null,'',{source:'snapshot'},{}).activityAvailable,false);
assert.equal(Brief.model(null,[],null,'',null,null),null);
console.log('Meeting Brief recorded-source, baseline, agenda, and action checks passed');
