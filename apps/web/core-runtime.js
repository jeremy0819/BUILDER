/* Core Worker transport. All outstanding calls settle on timeout, failure or termination. */
(function () {
  "use strict";
  function createCoreRuntime(opts) {
    opts = opts || {};
    var w, ready = false, dead = false, seq = 0, pending = new Map(), initTimer;
    function fail(message, notify) {
      if (dead) return;
      dead = true; ready = false; clearTimeout(initTimer);
      if (notify && window.UROSDiagnostics) window.UROSDiagnostics.record("core-unavailable");
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
        else if (m.type === "ready") {
          clearTimeout(initTimer); ready = true;
          /* runtime_source 原本只有瀏覽器測試在讀，畫面上看不到。
             它存在的理由是「部署後能確認真的走本地」——本機副本若漏了檔案，
             worker 會安靜回退 CDN，沒有這個標示就會以為部署成功。故蓋到畫面上。 */
          window.UROS_RUNTIME_SOURCE = m.runtime_source || "";
          stampRuntimeSource(m.runtime_source);
          if (opts.onReady) opts.onReady(m);
        }
        else if (m.type === "fatal") fail(m.msg || "計算核心初始化失敗", true);
        else if (m.type === "result") {
          var p = pending.get(m.id); if (!p) return;
          clearTimeout(p.timer); pending.delete(m.id);
          if (m.error) { if (window.UROSDiagnostics) window.UROSDiagnostics.record("core-request-rejected"); p.reject(new Error(String(m.error))); } else p.resolve(m);
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
      decide: function (engine, workflow, inputs) {
        return request({ type: "decide", engine: engine, workflow: workflow, inputs: inputs });
      },
      allocate: function (engine, product, beforeMap) {
        return request({ type: "allocate", engine: engine, product: product, beforeMap: beforeMap });
      },
      terminate: function () { fail("計算已取消", false); }
    };
  }
  /* 錯誤訊息人話化。原本只有 index.html 有一份私有拷貝，於是 ① 與 ④ 仍把
     worker 的原始例外整串丟給使用者看——「Failed to execute 'importScripts' on
     'WorkerGlobalScope'…」對開發商毫無意義，只會讓人以為系統壞了。
     放在這裡是因為它解讀的正是本模組拋出的錯誤。技術原文由呼叫端收進 title。 */
  var 對照 = [
    [/importScripts|jsdelivr|Failed to fetch|NetworkError|載入逾時/i,
     "連不上計算核心——常見原因是網路或公司防火牆擋住了外部資源"],
    [/逾時|timeout/i, "計算核心回應逾時"],
    [/佇列已滿/, "計算排隊中，請稍候再試"],
    [/尚未就緒/, "計算核心還在啟動"],
    [/Worker|初始化失敗|不可用/i, "計算核心無法啟動"]
  ];
  function plainError(msg) {
    var m = String(msg || "");
    for (var i = 0; i < 對照.length; i++) if (對照[i][0].test(m)) return 對照[i][1];
    return m.length > 60 ? m.slice(0, 60) + "…" : m;
  }

  var SOURCE_LABEL = { "same-origin": "本機", "cdn-fallback": "CDN 備援" };
  function stampRuntimeSource(src) {
    if (!src) return;
    try {
      var els = document.querySelectorAll("[data-uros-runtime]");
      for (var i = 0; i < els.length; i++) {
        els[i].textContent = SOURCE_LABEL[src] || src;
        els[i].title = "計算核心來源：" + src
          + (src === "cdn-fallback" ? "（本機未部署 runtime，已回退外部 CDN）" : "（同源，未依賴外部 CDN）");
      }
    } catch (e) {}
  }

  function debounce(fn, ms) {
    var timer; return function () { var args = arguments, ctx = this; clearTimeout(timer); timer = setTimeout(function () { fn.apply(ctx, args); }, ms || 250); };
  }
  window.createCoreRuntime = createCoreRuntime;
  window.coreDebounce = debounce;
  window.corePlainError = plainError;
  window.coreStampRuntimeSource = stampRuntimeSource;
})();
