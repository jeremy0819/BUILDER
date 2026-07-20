/* core-runtime.worker.js — M5.5 B 軌：瀏覽器內執行「同一份」RE-DCF Core（Pyodide, Web Worker）。
   在背景執行緒把 core-bundle.js 還原成 /builder 目錄樹後 import core.redcf——計算主線純 stdlib，
   零 pandas / 零 micropip / 零第二真源。每個結果帶 input_hash，溯源不變。
   紅線：唯一計算來源＝core/redcf；本檔只搬運與呼叫，不含任何財務公式。 */
"use strict";
const PYODIDE_VER = "0.26.4";
const CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VER}/full/`;
let pyodide = null, ready = false;

const post = (type, extra) => self.postMessage(Object.assign({ type }, extra || {}));

async function init() {
  try {
    post("progress", { pct: 5, msg: "載入 Python 執行環境…" });
    importScripts(CDN + "pyodide.js");          // 跨源 importScripts（Worker 合法）
    importScripts("core-bundle.js");            // 同源；設定 self.CORE_FILES / CORE_BUNDLE_VERSION
    pyodide = await loadPyodide({ indexURL: CDN });
    post("progress", { pct: 70, msg: "還原 RE-DCF Core 原始碼…" });
    const files = self.CORE_FILES || {};
    for (const rel in files) {
      const full = "/builder/" + rel;
      const dir = full.slice(0, full.lastIndexOf("/"));
      pyodide.FS.mkdirTree(dir);
      pyodide.FS.writeFile(full, files[rel], { encoding: "utf8" });
    }
    post("progress", { pct: 90, msg: "初始化計算核心…" });
    pyodide.runPython("import sys\nif '/builder' not in sys.path: sys.path.insert(0, '/builder')\nimport json\nimport core.redcf as _redcf");
    ready = true;
    post("ready", {
      core_version: pyodide.runPython("_redcf.CORE_VERSION"),
      bundle: self.CORE_BUNDLE_VERSION, pyodide: PYODIDE_VER
    });
  } catch (err) {
    post("fatal", { msg: String((err && err.message) || err) });   // 不得靜默失敗
  }
}

self.onmessage = (e) => {
  const m = e.data || {};
  if (m.type === "recompute") {
    if (!ready) { post("result", { id: m.id, error: "core-not-ready" }); return; }
    try {
      pyodide.globals.set("_engine_json", JSON.stringify(m.engine));
      const out = pyodide.runPython(
        "json.dumps({'result': _redcf.recompute(json.loads(_engine_json)), " +
        "'input_hash': _redcf.input_hash(json.loads(_engine_json))})"
      );
      post("result", Object.assign({ id: m.id }, JSON.parse(out)));
    } catch (err) {
      post("result", { id: m.id, error: String((err && err.message) || err) });
    }
  }
};

init();   // 載入即自動初始化
