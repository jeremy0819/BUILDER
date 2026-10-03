import assert from 'node:assert/strict';
import Compare from '../../apps/web/scenario-compare.js';

const rate=Compare.metrics.find(m=>m.key==='return_rate');
const area=Compare.metrics.find(m=>m.key==='saleable_area');
assert.equal(Compare.difference(0.184,0.2,rate),'+1.60 百分點');
assert.equal(Compare.difference(0.2,0.184,rate),'-1.60 百分點');
assert.equal(Compare.difference(3820,3915,area),'+95 坪');
assert.equal(Compare.difference(null,3915,area),'—');
assert.equal(Compare.display(null,rate),'—');
assert.ok(Compare.metrics.every(m=>m.key!=='irr'));
const rec={pid:'prj-test',engine:{params:{住宅單價:60}},snap:{input_hash:'sha256:test',core_version:'0.6.0'}};
assert.equal(Compare.sameCase(rec,structuredClone(rec)),true);
assert.equal(Compare.sameCase(rec,{...rec,engine:{params:{住宅單價:61}}}),false);
assert.equal(Compare.sameCase(rec,{...rec,snap:{...rec.snap,input_hash:'sha256:other'}}),false);
console.log('Scenario comparison display and stale-case checks passed');
