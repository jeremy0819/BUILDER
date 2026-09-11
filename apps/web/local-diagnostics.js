/* Bounded local diagnostics. No messages, stack traces, identifiers, inputs or network. */
(function (root) {
  "use strict";
  var KEY="uros.diagnostics.v1", CODES=["uncaught-error","unhandled-rejection","core-unavailable","core-request-rejected"];
  function read(){
    try { var doc=JSON.parse(localStorage.getItem(KEY)||"null"); return doc&&doc.version===1&&Array.isArray(doc.events)?doc.events.filter(function(e){return CODES.includes(e.code)&&typeof e.at==="string";}).slice(-50).map(function(e){return {code:e.code,at:e.at};}):[]; }
    catch(e){return [];}
  }
  function record(code){
    if(!CODES.includes(code))return;
    try { var events=read();events.push({code:code,at:new Date().toISOString()});localStorage.setItem(KEY,JSON.stringify({version:1,events:events.slice(-50)})); } catch(e){}
  }
  root.addEventListener("error",function(){record("uncaught-error");});
  root.addEventListener("unhandledrejection",function(){record("unhandled-rejection");});
  root.UROSDiagnostics={record:record,read:read};
})(typeof self!=="undefined"?self:this);
