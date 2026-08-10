/* core-runtime.js — 主執行緒包裝 core-runtime.worker（M5.5 B 軌）。
   window.createCoreRuntime({onProgress,onReady,onError}) → { ready, recompute(engine), terminate() }。
   recompute 回傳 Promise<{result, input_hash}>；失敗回報明確錯誤（呼叫端顯示退路，不得靜默）。 */
(function () {
  "use strict";
  function createCoreRuntime(opts) {
    opts = opts || {};
    var w, ready = false, seq = 0, pending = {}, dead = false;
    try {
      w = new Worker("core-runtime.worker.js");
    } catch (e) {
      dead = true;
      setTimeout(function () { opts.onError && opts.onError({ msg: "無法建立計算核心 Worker：" + e.message }); }, 0);
    }
    if (w) {
      w.onmessage = function (e) {
        var m = e.data || {};
        if (m.type === "progress") opts.onProgress && opts.onProgress(m);
        else if (m.type === "ready") { ready = true; opts.onReady && opts.onReady(m); }
        else if (m.type === "fatal") { dead = true; opts.onError && opts.onError(m); }
        else if (m.type === "result") {
          var p = pending[m.id]; if (!p) return; delete pending[m.id];
          m.error ? p.reject(new Error(m.error)) : p.resolve(m);
        }
      };
      w.onerror = function (ev) { dead = true; opts.onError && opts.onError({ msg: (ev && ev.message) || "Worker 載入失敗（可能無法連線 Pyodide CDN）" }); };
    }
    return {
      get ready() { return ready; },
      get failed() { return dead; },
      recompute: function (engine) {
        return new Promise(function (resolve, reject) {
          if (dead || !w) return reject(new Error("core-runtime 不可用"));
          var id = ++seq; pending[id] = { resolve: resolve, reject: reject };
          w.postMessage({ type: "recompute", id: id, engine: engine });
        });
      },
      // M7.2：today(milestones[, todayISO]) → Promise<{today}>；逾期/風險窗判準由 Core 決定，UI 只呈現。
      today: function (milestones, todayISO) {
        return new Promise(function (resolve, reject) {
          if (dead || !w) return reject(new Error("core-runtime 不可用"));
          var id = ++seq; pending[id] = { resolve: resolve, reject: reject };
          w.postMessage({ type: "today", id: id, milestones: milestones, today: todayISO || "" });
        });
      },
      // M7.1→UI：timeline(activity, history, milestones[, todayISO]) → Promise<{timeline}>。
      // 「過去半邊」的合併與排序規則在 Core（build_timeline），本層只搬運。
      timeline: function (activity, history, milestones, todayISO) {
        return new Promise(function (resolve, reject) {
          if (dead || !w) return reject(new Error("core-runtime 不可用"));
          var id = ++seq; pending[id] = { resolve: resolve, reject: reject };
          w.postMessage({ type: "timeline", id: id, activity: activity || [],
                          history: history || [], milestones: milestones || [],
                          today: todayISO || "" });
        });
      },
      // M7.4：attribute(before, after[, target, method]) → Promise<{attribution}｜{unsupported}>。
      // before/after 為**完整 engine**；本層不得傳 diff、不得預先算任何 delta 或貢獻。
      // 不支援的比較回 {unsupported:{reason_code,paths,message}}——呼叫端須逐條點名，
      // **不得畫成一根「其他」長條**，也不得退回 JS 自算。
      attribute: function (before, after, target, method) {
        return new Promise(function (resolve, reject) {
          if (dead || !w) return reject(new Error("core-runtime 不可用"));
          var id = ++seq; pending[id] = { resolve: resolve, reject: reject };
          w.postMessage({ type: "attribute", id: id, before: before, after: after,
                          target: target || "return_rate", method: method || "auto" });
        });
      },
      // M6：strategize(decision, workflow, profiles) → Promise<{strategy}>；同一份 Core，UI 零推論。
      strategize: function (decision, workflow, profiles) {
        return new Promise(function (resolve, reject) {
          if (dead || !w) return reject(new Error("core-runtime 不可用"));
          var id = ++seq; pending[id] = { resolve: resolve, reject: reject };
          w.postMessage({ type: "strategize", id: id, decision: decision, workflow: workflow, profiles: profiles });
        });
      },
      terminate: function () { if (w) w.terminate(); dead = true; }
    };
  }
  // 呼叫端自行 debounce：debounce(fn, 250) 包住 recompute 觸發
  function debounce(fn, ms) {
    var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms || 250); };
  }
  window.createCoreRuntime = createCoreRuntime;
  window.coreDebounce = debounce;
})();
