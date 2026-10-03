import assert from 'node:assert/strict';
import Pulse from '../../apps/web/project-pulse.js';

const rec={wf:{project:{stage_history:[{stage:'S3',ts:'2026-10-01T09:00:00Z'}]},
  consent_events:[{event_id:'c1',stakeholder_id:'B03',kind:'declined',ts:'2026-10-02T09:00:00Z'}],
  decisions:[{decision_id:'d1',title:'保留方案 A',ts:'2026-10-02T10:00:00Z'}],
  tasks:[{task_id:'1',title:'產權確認',status:'blocked',owner_role:'代書',due:'2026-10-08'},
    {task_id:'2',title:'重新確認成本',status:'doing'}, {task_id:'3',title:'已完成',status:'done'}]}};
const activity=[{key:1,kind:'edit',field:'營造單價',before:20,after:20.8,ts:'2026-10-02T11:00:00Z'},
  {key:2,kind:'edit',field:'task:2:status',intent:'重新確認成本',before:'todo',after:'doing',ts:'2026-10-02T12:00:00Z'}];
const pulse=Pulse.model(rec,activity,'2026-10-02T09:30:00Z');
assert.equal(pulse.changeCount,3);
assert.equal(pulse.blockedCount,1);
assert.equal(pulse.openCount,1);
assert.match(pulse.changes[0].text,/待辦 → 進行中/);
assert.ok(pulse.changes.every(row=>row.time>Date.parse('2026-10-02T09:30:00Z')));
const first=Pulse.model(rec,activity,null);
assert.equal(first.changeCount,null);
assert.equal(first.recent.length,5);
assert.equal(Pulse.model({wf:{}},null,'2026-10-02T09:00:00Z').activityAvailable,false);
assert.equal(Pulse.model({wf:{}},[],null).blockedCount,0);
const created=Pulse.model({wf:{tasks:[]} },[{key:3,kind:'edit',field:'task:3:created',after:{title:'新任務',status:'todo'},ts:'2026-10-02T13:00:00Z'}],null);
assert.equal(created.recent[0].text,'新增任務：新任務');
console.log('Project Pulse recorded-fact and baseline checks passed');
