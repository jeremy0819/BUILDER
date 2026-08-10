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
    // M7.4：把 Core 的結構化拒答（reason_code／paths）保成可解析的信封，
    // 而非讓它變成一段 traceback 字串——UI 必須能逐條點名不支援的路徑。
    pyodide.runPython(
      "def _redcf_attribute_safe(before, after, target, method):\n" +
      "    try:\n" +
      "        return {'attribution': _redcf.attribute(before, after, target=target, method=method)}\n" +
      "    except _redcf.AttributionUnsupported as e:\n" +
      "        return {'unsupported': {'reason_code': e.reason_code,\n" +
      "                               'paths': list(e.paths), 'message': str(e)}}\n"
    );
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
  } else if (m.type === "today") {
    // M7.2 Watchtower：「今天要做什麼」——同一份 core/redcf.build_today（逾期/風險窗判準只有一套）
    if (!ready) { post("result", { id: m.id, error: "core-not-ready" }); return; }
    try {
      pyodide.globals.set("_ms_json", JSON.stringify(m.milestones || []));
      pyodide.globals.set("_today_str", m.today || "");
      const out = pyodide.runPython(
        "json.dumps(_redcf.build_today(json.loads(_ms_json), " +
        "today=(_today_str or None)))"
      );
      post("result", { id: m.id, today: JSON.parse(out) });
    } catch (err) {
      post("result", { id: m.id, error: String((err && err.message) || err) });
    }
  } else if (m.type === "timeline") {
    // M7.1→UI 案件歷程：過去（Activity＋History）＋今天＋未來。排序與分段由
    // core/redcf.build_timeline 決定——同一案在任何頁面的歷程順序只有一套。
    if (!ready) { post("result", { id: m.id, error: "core-not-ready" }); return; }
    try {
      pyodide.globals.set("_tl_act", JSON.stringify(m.activity || []));
      pyodide.globals.set("_tl_hist", JSON.stringify(m.history || []));
      pyodide.globals.set("_tl_ms", JSON.stringify(m.milestones || []));
      pyodide.globals.set("_tl_today", m.today || "");
      const out = pyodide.runPython(
        "json.dumps(_redcf.build_timeline(json.loads(_tl_act), json.loads(_tl_hist), " +
        "json.loads(_tl_ms), today=(_tl_today or None)))"
      );
      post("result", { id: m.id, timeline: JSON.parse(out) });
    } catch (err) {
      post("result", { id: m.id, error: String((err && err.message) || err) });
    }
  } else if (m.type === "attribute") {
    // M7.4 歸因：同一份 core/redcf.attribute。Worker **只搬運**——
    // delta／貢獻／殘差／方法選擇／進位／守恆旗標全部由 Core 決定，此處零計算。
    if (!ready) { post("result", { id: m.id, error: "core-not-ready" }); return; }
    try {
      pyodide.globals.set("_at_before", JSON.stringify(m.before || {}));
      pyodide.globals.set("_at_after", JSON.stringify(m.after || {}));
      pyodide.globals.set("_at_target", m.target || "return_rate");
      pyodide.globals.set("_at_method", m.method || "auto");
      const out = pyodide.runPython(
        "json.dumps(_redcf_attribute_safe(json.loads(_at_before), json.loads(_at_after), " +
        "_at_target, _at_method))"
      );
      post("result", Object.assign({ id: m.id }, JSON.parse(out)));
    } catch (err) {
      post("result", { id: m.id, error: String((err && err.message) || err) });
    }
  } else if (m.type === "strategize") {
    // M6 THE STRATEGIST：同一份 core/redcf.strategize（建議層）；Worker 只搬運與呼叫，不含邏輯。
    if (!ready) { post("result", { id: m.id, error: "core-not-ready" }); return; }
    try {
      pyodide.globals.set("_dec_json", JSON.stringify(m.decision || {}));
      pyodide.globals.set("_wf_json", JSON.stringify(m.workflow || {}));
      pyodide.globals.set("_prof_json", JSON.stringify(m.profiles || []));
      const out = pyodide.runPython(
        "json.dumps({'strategy': _redcf.strategize(json.loads(_dec_json), " +
        "json.loads(_wf_json), json.loads(_prof_json))})"
      );
      post("result", Object.assign({ id: m.id }, JSON.parse(out)));
    } catch (err) {
      post("result", { id: m.id, error: String((err && err.message) || err) });
    }
  }
};

init();   // 載入即自動初始化
