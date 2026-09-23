/* Ephemeral input drafts. Only an explicit accept writes a verified Core response. */
(function (root) {
  "use strict";
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function key(rec) { return JSON.stringify([rec.pid || (rec.wf && rec.wf.project && rec.wf.project.project_id), rec.engine, rec.snap && rec.snap.input_hash, rec.snap && rec.snap.core_version]); }
  function create(rec, getRuntime, changed) {
    var base = clone(rec), engine = clone(rec.engine), response = null, revision = 0;
    var disposed = false, timer, runtime, phase = "idle", message = "尚未重算", dirty = false;
    function state() { return {engine:clone(engine), response:response && clone(response), phase:phase, message:message, dirty:dirty}; }
    function publish() { if (!disposed && changed) changed(state()); }
    function invalidate(next, valid) {
      clearTimeout(timer); revision++; response = null; dirty = true;
      if (valid !== false) engine = clone(next);
      phase = valid === false ? "invalid" : "pending";
      message = valid === false ? "請修正標示的輸入；尚未更新計算。" : "輸入已變更，等待 Core 重算。";
      publish();
    }
    function schedule(delay) { clearTimeout(timer); timer = setTimeout(run, delay == null ? 450 : delay); }
    async function run() {
      clearTimeout(timer);
      if (disposed || phase === "invalid") return null;
      var rt = runtime || (runtime = getRuntime()), token = ++revision;
      response = null;
      if (!rt || rt.failed) {
        phase = "error"; message = "計算核心無法啟動；草案仍保留，請重試連線。"; publish(); return null;
      }
      if (!rt.ready) {
        phase = "loading"; message = "計算核心啟動中；樓層草案可繼續編輯。"; publish(); schedule(400); return null;
      }
      phase = "running"; message = "Core 重算中，結果尚未寫入案件。"; publish();
      try {
        var answer = await rt.recompute(clone(engine));
        if (disposed || token !== revision) return null;
        if (!answer || !answer.result || !/^sha256:[0-9a-f]{64}$/.test(answer.input_hash || "") || !answer.result.core_version) throw new Error("Core 回應缺少溯源資訊");
        response = clone(answer); phase = "ready";
        message = "草案已重算 · core " + answer.result.core_version + " · input " + answer.input_hash.slice(7,19);
        publish(); return clone(answer);
      } catch (error) {
        if (!disposed && token === revision) {
          phase = "error"; message = "無法完成重算，請檢查輸入或重試連線。草案仍保留。";
          if (root.UROSDiagnostics) root.UROSDiagnostics.record("core-request-rejected");
          publish();
        }
        return null;
      }
    }
    function accept() {
      if (disposed || phase !== "ready" || !response) throw new Error("草案尚未完成 Core 重算，不能採用。");
      var current = root.CaseBus.activeRecord();
      if (!current || key(current) !== key(base)) throw new Error("案件已在其他頁面變更，請重新載入後再規劃；草案未覆蓋原案。");
      var next = root.CaseBus.applyResult(current, {engine:clone(engine), result:response.result, input_hash:response.input_hash});
      root.CaseBus.replace(current.pid, next);
      base = clone(next); dirty = false; message = "已採用至案件，四步數值已同步。"; publish();
      return next;
    }
    function leave(event) { if (dirty) { event.preventDefault(); event.returnValue = ""; } }
    if (root.addEventListener) root.addEventListener("beforeunload", leave);
    return {
      state:state, update:function (next, valid) { invalidate(next, valid); }, run:run, schedule:schedule, accept:accept,
      cancelScheduled:function () { clearTimeout(timer); },
      retry:function () { runtime=null; return run(); },
      reset:function () { invalidate(base.engine); dirty = false; publish(); schedule(0); },
      dispose:function () { disposed = true; revision++; clearTimeout(timer); if (root.removeEventListener) root.removeEventListener("beforeunload", leave); }
    };
  }
  function saveError(error) {
    var message=String(error && error.message || "");
    return /^(草案尚未|案件已在)/.test(message) ? message : "案件未儲存。請先匯出備份，再檢查瀏覽器儲存空間；草案仍保留。";
  }
  root.PlanningSession = {create:create,saveError:saveError};
})(typeof self !== "undefined" ? self : this);
