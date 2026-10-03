/* Project Pulse is a projection of recorded local facts, never a second case record. */
(function(root){
  "use strict";
  var CONSENT={contacted:"已聯繫",visited:"已拜訪",briefed:"已說明",verbal_ok:"口頭同意",signed:"已簽署",selected_unit:"已登錄選配",withdrawn:"已撤回",declined:"已表達反對"};
  var STATUS={todo:"待辦",doing:"進行中",done:"已完成",blocked:"卡住"};
  function validTime(ts){var n=Date.parse(ts||"");return Number.isFinite(n)?n:null;}
  function short(value){
    if(value===null||value===undefined||value==="")return "未填";
    if(typeof value==="object")return "已更新";
    var s=String(value);return s.length>48?s.slice(0,48)+"…":s;
  }
  function activityText(ev,titles){
    var field=ev.field||"輸入";
    if(ev.kind==="scenario"){
      if(field==="create")return "建立方案："+short(ev.after);
      if(field==="authoritative")return "設為目前工作方案："+short(ev.target&&ev.target.id);
      if(field==="delete")return "刪除方案："+short(ev.before);
    }
    if(ev.field&&ev.field.indexOf("task:")===0){
      var id=ev.field.split(":")[1],name=titles[id]||(id==="seed"?"S1–S11 里程碑範本":"任務 "+id);
      if(ev.field.endsWith(":created"))return "新增任務："+(ev.after&&ev.after.title||name);
      var type=ev.field.split(":").pop();
      var label={status:"狀態",owner_role:"負責人",due:"期限"}[type]||"資料";
      var before=type==="status"?(STATUS[ev.before]||short(ev.before)):short(ev.before);
      var after=type==="status"?(STATUS[ev.after]||short(ev.after)):short(ev.after);
      return name+" · "+label+"："+before+" → "+after;
    }
    if(ev.kind==="create")return "建立案件輸入";
    var target=ev.target&&ev.target.type==="stakeholder"?(ev.target.id||"地主")+" · ":"";
    if(ev.before===undefined&&ev.after===undefined)return target+field+"已更新";
    return target+field+"："+short(ev.before)+" → "+short(ev.after);
  }
  function model(rec,activity,reviewedAt){
    var wf=rec&&rec.wf||{},project=wf.project||{},rows=[];
    var tasks=Array.isArray(wf.tasks)?wf.tasks:[],titles=Object.create(null);
    tasks.forEach(function(t){if(t&&t.task_id)titles[t.task_id]=t.title||"未命名任務";});
    (Array.isArray(activity)?activity:[]).forEach(function(ev){
      var time=validTime(ev&&ev.ts);if(time===null)return;
      rows.push({time:time,ts:ev.ts,text:activityText(ev,titles),source:"Activity",id:"a:"+ev.key});
    });
    (Array.isArray(wf.consent_events)?wf.consent_events:[]).forEach(function(ev){
      var time=validTime(ev&&ev.ts);if(time===null)return;
      rows.push({time:time,ts:ev.ts,text:(ev.stakeholder_id||"地主")+" · "+(CONSENT[ev.kind]||"接觸紀錄"),source:"同意事件",id:"c:"+ev.event_id});
    });
    (Array.isArray(project.stage_history)?project.stage_history:[]).forEach(function(ev,i){
      var time=validTime(ev&&ev.ts);if(time===null)return;
      rows.push({time:time,ts:ev.ts,text:"案件階段更新為 "+(ev.stage||"未設定"),source:"階段紀錄",id:"s:"+i});
    });
    (Array.isArray(wf.decisions)?wf.decisions:[]).forEach(function(ev){
      var time=validTime(ev&&ev.ts);if(time===null)return;
      rows.push({time:time,ts:ev.ts,text:"記錄決策："+(ev.title||"未命名"),source:"決策紀錄",id:"d:"+ev.decision_id});
    });
    rows.sort(function(a,b){return b.time-a.time||b.id.localeCompare(a.id);});
    var baseline=validTime(reviewedAt), since=baseline===null?rows:rows.filter(function(row){return row.time>baseline;});
    var blocked=tasks.filter(function(t){return t&&t.status==="blocked";});
    var open=tasks.filter(function(t){return t&&(t.status==="todo"||t.status==="doing");});
    return {reviewedAt:baseline===null?null:reviewedAt,changes:since,changeCount:baseline===null?null:since.length,
      recent:rows.slice(0,6),blocked:blocked,blockedCount:blocked.length,openCount:open.length,
      activityAvailable:Array.isArray(activity)};
  }
  root.ProjectPulse={model:model,status:STATUS};
  if(typeof module!=="undefined"&&module.exports)module.exports=root.ProjectPulse;
})(typeof self!=="undefined"?self:this);
