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
