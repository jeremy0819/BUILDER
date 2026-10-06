/* M9 candidate evidence: classified records, never a Core or legal input. */
(function(root){
  "use strict";
  var VERSION="evidence-fact-0.1", MAX_FACTS=200;
  var TYPES=["observed","inferred","assumed","calibrated"];
  var KEYS=["schema_version","fact_id","case_id","subject","field","value","unit","evidence_type","source","observed_at","valid_from","valid_until","confidence","recorded_at","model_version","parameter_version","supporting_fact_ids","evidence_snapshot_hash","verification_status"];
  function object(v){return v!==null&&typeof v==="object"&&!Array.isArray(v);}
  function exact(v,keys){return object(v)&&Object.keys(v).length===keys.length&&keys.every(function(k){return Object.prototype.hasOwnProperty.call(v,k);});}
  function str(v,max){return typeof v==="string"&&v.trim().length>0&&v.length<=max;}
  function nullable(v,max){return v===null||typeof v==="string"&&v.length<=max;}
  function day(v){return typeof v==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+"T00:00:00Z"))&&new Date(v+"T00:00:00Z").toISOString().slice(0,10)===v;}
  function stamp(v){return typeof v==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString()===v;}
  function validId(v){return typeof v==="string"&&/^[A-Za-z0-9-]{1,80}$/.test(v);}
  function hash(v){return typeof v==="string"&&/^sha256:[0-9a-f]{64}$/.test(v);}
  function validate(f,caseId){
    if(!exact(f,KEYS)||f.schema_version!==VERSION||!validId(f.fact_id)||!str(f.case_id,160)||f.case_id!==caseId)throw Error("證據格式或案件不符");
    if(!exact(f.subject,["kind","id"])||!["case","stakeholder"].includes(f.subject.kind)||!str(f.subject.id,160)||f.subject.kind==="case"&&f.subject.id!==caseId)throw Error("證據對象無效");
    if(!str(f.field,80)||!((typeof f.value==="string"&&str(f.value,500))||(typeof f.value==="number"&&Number.isFinite(f.value))||typeof f.value==="boolean")||!nullable(f.unit,40))throw Error("證據欄位或值無效");
    if(!TYPES.includes(f.evidence_type)||!exact(f.source,["label","version"])||!str(f.source.label,160)||!nullable(f.source.version,80))throw Error("證據類型或來源無效");
    if(!(f.observed_at===null||day(f.observed_at))||!(f.valid_from===null||day(f.valid_from))||!(f.valid_until===null||day(f.valid_until))||f.valid_from&&f.valid_until&&f.valid_from>f.valid_until||!stamp(f.recorded_at))throw Error("證據日期無效");
    if(!["unknown","low","medium","high"].includes(f.confidence)||!nullable(f.model_version,100)||!nullable(f.parameter_version,100)||!Array.isArray(f.supporting_fact_ids)||f.supporting_fact_ids.length>16||new Set(f.supporting_fact_ids).size!==f.supporting_fact_ids.length||!f.supporting_fact_ids.every(validId)||!(f.evidence_snapshot_hash===null||hash(f.evidence_snapshot_hash))||f.verification_status!=="unverified")throw Error("證據溯源無效");
    if(f.evidence_type==="observed"&&!day(f.observed_at))throw Error("觀察紀錄需要觀察日期");
    if(["observed","assumed"].includes(f.evidence_type)&&(f.model_version!==null||f.parameter_version!==null||f.supporting_fact_ids.length||f.evidence_snapshot_hash!==null)||f.evidence_type==="assumed"&&f.observed_at!==null)throw Error("人工紀錄不得冒充模型輸出");
    if(f.evidence_type==="inferred"&&(!str(f.model_version,100)||!f.supporting_fact_ids.length||f.parameter_version!==null||f.evidence_snapshot_hash!==null))throw Error("推論缺少模型或依據");
    if(f.evidence_type==="calibrated"&&(!str(f.model_version,100)||!str(f.parameter_version,100)||!f.supporting_fact_ids.length||!hash(f.evidence_snapshot_hash)))throw Error("校準紀錄缺少模型、參數或證據快照");
    return JSON.parse(JSON.stringify(f));
  }
  function list(rec){
    var pid=rec&&(rec.pid||rec.wf&&rec.wf.project&&rec.wf.project.project_id), raw=rec&&rec.evidence_facts;
    if(!str(pid,160))throw Error("沒有作用中案件");
    if(!Object.prototype.hasOwnProperty.call(rec,"evidence_facts"))return [];
    if(!Array.isArray(raw)||raw.length>MAX_FACTS)throw Error("證據紀錄格式或數量無效");
    var seen=new Set();
    return raw.map(function(item){
      var f=validate(item,pid);
      if(seen.has(f.fact_id)||f.supporting_fact_ids.some(function(id){return !seen.has(id);}))throw Error("證據 ID 重複或依據鏈無效");
      seen.add(f.fact_id);return f;
    });
  }
  function append(rec,fact){
    var rows=list(rec),pid=rec.pid||rec.wf.project.project_id,next=validate(fact,pid),seen=new Set(rows.map(function(f){return f.fact_id;}));
    if(rows.length>=MAX_FACTS)throw Error("證據紀錄已達本機上限，請先匯出備份");
    if(seen.has(next.fact_id)||next.supporting_fact_ids.some(function(id){return !seen.has(id);}))throw Error("證據 ID 重複或依據鏈無效");
    var copy=JSON.parse(JSON.stringify(rec));copy.evidence_facts=rows.concat([next]);return copy;
  }
  function caseFact(rec,input,id,recordedAt){
    var pid=rec&&(rec.pid||rec.wf&&rec.wf.project&&rec.wf.project.project_id);
    return validate({schema_version:VERSION,fact_id:id,case_id:pid,subject:{kind:"case",id:pid},field:input.field,value:input.value,unit:null,
      evidence_type:input.evidence_type,source:{label:input.source,version:null},observed_at:input.evidence_type==="observed"?input.observed_at:null,
      valid_from:null,valid_until:null,confidence:input.confidence||"unknown",recorded_at:recordedAt,
      model_version:null,parameter_version:null,supporting_fact_ids:[],evidence_snapshot_hash:null,verification_status:"unverified"},pid);
  }
  root.EvidenceLedger={VERSION:VERSION,MAX_FACTS:MAX_FACTS,validate:validate,list:list,append:append,caseFact:caseFact};
  if(typeof module!=="undefined"&&module.exports)module.exports=root.EvidenceLedger;
})(typeof self!=="undefined"?self:this);
