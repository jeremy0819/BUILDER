import assert from 'node:assert/strict';
import DataStatus from '../../apps/web/data-status.js';

const rec={engine:{params:{基地面積:860,容積率:3.2,獎勵率:0,營造單價:22}},
  snap:{total:3,input_hash:'sha256:abc',core_version:'0.6.0',computed_at:'2026-10-02T12:00:00Z'},
  site_intake:{land:{reference:'測試用基地文件',checked_on:'2026-09-20'}},
  wf:{stakeholders:[
    {stakeholder_id:'A01',role:'owner',ownership_complexity:'clean'},
    {stakeholder_id:'A02',role:'owner'},
    {stakeholder_id:'C01',role:'consultant'}],
    consent_events:[{stakeholder_id:'A01',ts:'2026-09-21T10:00:00Z',kind:'contacted'}]}};
const rows=DataStatus.model(rec,{stale:false});
const row=label=>rows.find(item=>item.label===label);
assert.equal(row('基地面積').value,'860');
assert.equal(row('容積獎勵率').value,'0');
assert.equal(row('基地面積').checked,'未記錄');
assert.match(row('基地面積').status,/待查核/);
assert.equal(row('基地查核紀錄').checked,'2026-09-20');
assert.match(row('基地查核紀錄').note,/不自動驗證/);
assert.equal(row('地主清冊').value,'2 / 3');
assert.equal(row('接觸事件涵蓋').value,'1 / 2');
assert.equal(row('產權欄位涵蓋').value,'1 / 2');
assert.match(row('產權欄位涵蓋').source,/未核驗/);
assert.equal(row('Core 計算快照').checked,'2026-10-02');
assert.match(DataStatus.model(rec,{stale:true}).find(r=>r.label==='Core 計算快照').status,/需重算/);
const missing=DataStatus.model({wf:{},snap:{total:0}},null);
assert.equal(missing.find(r=>r.label==='基地面積').status,'未填');
assert.equal(missing.find(r=>r.label==='Core 計算快照').status,'缺少完整溯源');
console.log('Data Status source, coverage, and unknown-date checks passed');
