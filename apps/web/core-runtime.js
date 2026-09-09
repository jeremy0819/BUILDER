/* Core Worker transport. All outstanding calls settle on timeout, failure or termination. */
(function () {
  "use strict";
  function createCoreRuntime(opts) {
    opts = opts || {};
    var w, ready = false, dead = false, seq = 0, pending = new Map(), initTimer;
    function fail(message, notify) {
      if (dead) return;
      dead = true; ready = false; clearTimeout(initTimer);
      pending.forEach(function (p) { clearTimeout(p.timer); p.reject(new Error(message)); });
      pending.clear();
      if (w) w.terminate();
      if (notify && opts.onError) opts.onError({ msg: message });
    }
    function request(message) {
      return new Promise(function (resolve, reject) {
        if (dead || !w) return reject(new Error("計算核心不可用，請重新連線"));
        if (!ready) return reject(new Error("計算核心尚未就緒"));
        if (pending.size >= 32) return reject(new Error("計算佇列已滿，請稍後再試"));
        var id = ++seq;
        var timer = setTimeout(function () { fail("計算逾時，請重新連線後再試", true); }, opts.requestTimeoutMs || 120000);
        pending.set(id, { resolve: resolve, reject: reject, timer: timer });
        try { w.postMessage(Object.assign({ id: id }, message)); }
        catch (e) { clearTimeout(timer); pending.delete(id); reject(e); }
      });
    }
    try {
      w = new Worker("core-runtime.worker.js");
      initTimer = setTimeout(function () { fail("計算核心載入逾時，請檢查連線", true); }, opts.initTimeoutMs || 60000);
      w.onmessage = function (e) {
        if (dead) return;
        var m = e.data || {};
        if (m.type === "progress") { if (opts.onProgress) opts.onProgress(m); }
        else if (m.type === "ready") { clearTimeout(initTimer); ready = true; if (opts.onReady) opts.onReady(m); }
        else if (m.type === "fatal") fail(m.msg || "計算核心初始化失敗", true);
        else if (m.type === "result") {
          var p = pending.get(m.id); if (!p) return;
          clearTimeout(p.timer); pending.delete(m.id);
          if (m.error) p.reject(new Error(String(m.error))); else p.resolve(m);
        }
      };
      w.onerror = function () { fail("計算核心中斷，請重新連線", true); };
      w.onmessageerror = function () { fail("計算核心回應無法解析", true); };
    } catch (e) {
      setTimeout(function () { fail("無法建立計算核心 Worker：" + e.message, true); }, 0);
    }
    return {
      get ready() { return ready && !dead; },
      get failed() { return dead; },
      recompute: function (engine) { return request({ type: "recompute", engine: engine }); },
      today: function (milestones, todayISO) { return request({ type: "today", milestones: milestones, today: todayISO || "" }); },
      timeline: function (activity, history, milestones, todayISO) {
        return request({ type: "timeline", activity: activity || [], history: history || [], milestones: milestones || [], today: todayISO || "" });
      },
      attribute: function (before, after, target, method) {
        return request({ type: "attribute", before: before, after: after, target: target || "return_rate", method: method || "auto" });
      },
      strategize: function (decision, workflow, profiles) {
        return request({ type: "strategize", decision: decision, workflow: workflow, profiles: profiles });
      },
      analyze: function (engine, workflow, inputs, profiles) {
        return request({ type: "analyze", engine: engine, workflow: workflow, inputs: inputs, profiles: profiles });
      },
      terminate: function () { fail("計算已取消", false); }
    };
  }
  function debounce(fn, ms) {
    var timer; return function () { var args = arguments, ctx = this; clearTimeout(timer); timer = setTimeout(function () { fn.apply(ctx, args); }, ms || 250); };
  }
  window.createCoreRuntime = createCoreRuntime;
  window.coreDebounce = debounce;
})();
