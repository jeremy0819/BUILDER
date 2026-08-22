/* case-bus.js — 四步共用的「同一份案件」匯流排（Site→Product→People→Decision）
   ================================================================================
   問題：四個步驟各自從 localStorage 撈資料、各自決定顯示什麼，於是同一個案件在
   ① 基地看到一組數字、② 產品看到另一組。使用者的抱怨是對的——「四大步驟的數值沒有連動」。

   本模組是**唯一**的讀寫口：
     · 輸入（engine）只有一份，存在 active case 的 record.engine
     · 輸出（result）只有一份，由 Core 算出後寫回 record.view / record.snap
     · 四步一律透過 stepValues(record) 取數，取不到就是 null，**不得由 UI 補算**

   紅線（本檔零計算）：
     · 不得出現任何**輸出**公式——投報率、共負比、坪效、容積餘量、EV、verdict
       全部只能從 Core result／Decision Engine 逐欄搬運。assertNoDerivedOutput() 守之。
     · buildEngine() 產生的是**輸入**（樓層表、單價等）。以建蔽率×基地面積推一個
       預設樓板，是「幫使用者填一個看得懂的預設輸入」，不是「替 Core 算一個答案」——
       兩者的分界：前者使用者可以直接改掉，後者使用者只能接受。
       故所有推得的預設值都必須是可覆寫欄位（見 ADVANCED），且標示為假設。
     · 舊版 dashboard 的 ncEngine() 曾把 `面積表計入容積` 設成
       (基地-廣)×容積率×(1+獎勵)+移轉 ——那是把 Core 的允建容積公式抄進 UI，
       且會讓「容積餘量」永遠等於 0（看起來剛剛好，其實是自己算給自己看）。
       本模組**不設**該欄位：計入容積一律由逐層表的「計容積」加總，由 Core 決定餘量。
   ================================================================================ */
(function () {
  "use strict";

  var KEY = "uros.workflow.v1";
  var ACTIVE = "uros.active_case";
  var EVT = "uros:case-changed";

  /* ── 純函式層（可 headless 測試，不碰 DOM／localStorage）────────────────── */

  var 數 = function (v, d) { var n = parseFloat(v); return isFinite(n) ? n : (d || 0); };
  var 整 = function (v, d) { var n = Math.round(數(v, d)); return n; };

  /* 入口只問使用者真的知道的事；其餘給預設、可展開修改。 */
  var BASIC = [
    { k: "基地面積", label: "基地有多大", unit: "㎡", def: 1000, step: 1, ask: "土地登記謄本上的面積" },
    { k: "容積率", label: "法定容積率", unit: "%", def: 300, step: 10, pct: true, ask: "都市計畫分區的容積率，如住三＝300%" },
    { k: "住宅單價", label: "附近新房子賣多少", unit: "萬/坪", def: 70, step: 1, ask: "實價登錄的鄰近新案成交單價" },
    { k: "戶數", label: "現在有幾戶地主", unit: "戶", def: 30, step: 1, ask: "權利變換的分配戶數" }
  ];
  var ADVANCED = [
    { k: "獎勵率", label: "容積獎勵", unit: "%", def: 30, step: 5, pct: true, ask: "都更／危老獎勵，未定案先給概估" },
    { k: "建蔽率", label: "建蔽率", unit: "%", def: 55, step: 5, pct: true, ask: "決定每層樓板多大（預設樓板＝可建面積×建蔽率）" },
    { k: "地上樓層", label: "打算蓋幾層", unit: "層", def: 7, step: 1, ask: "樓層越多量體越大，Core 會告訴你容積夠不夠" },
    { k: "標準樓板", label: "標準層樓板", unit: "㎡", def: null, step: 1, ask: "留空＝由建蔽率推預設；填了就以你填的為準" },
    { k: "營造單價", label: "營造單價", unit: "萬/坪", def: 20, step: 0.5, ask: "含稅發包單價" },
    { k: "公設比", label: "公設比", unit: "%", def: 33, step: 1, pct: true, ask: "影響銷售坪數" },
    { k: "人行廣場", label: "退縮／人行廣場", unit: "㎡", def: 0, step: 1, ask: "會從基地面積扣掉再算容積" },
    { k: "容積移轉", label: "容積移轉", unit: "㎡", def: 0, step: 10, ask: "有買容積才填" },
    { k: "地價", label: "土地單價", unit: "萬/坪", def: 0, step: 5, ask: "填了才會算更新前價值；不知道就留 0" },
    { k: "土地成本", label: "土地取得成本", unit: "萬", def: 0, step: 1000, ask: "買地才填；權變由地主出地，填 0" }
  ];
  var FIELDS = BASIC.concat(ADVANCED);

  function defaults() {
    var o = {};
    FIELDS.forEach(function (f) { if (f.def !== null) o[f.k] = f.def; });
    o.案件名稱 = "我的案件";
    o.case_type = "urban_renewal";
    o.mode = "全案管理";
    return o;
  }

  /* 由簡易欄位組出 Core 的 engine 輸入。**只組輸入，不算輸出。** */
  function buildEngine(f) {
    f = f || {};
    var g = function (k) { var d = FIELDS.find(function (x) { return x.k === k; });
                           var v = f[k]; if (v === "" || v == null) v = d ? d.def : 0;
                           var n = 數(v, 0); return d && d.pct ? n / 100 : n; };

    var 基地 = g("基地面積"), 廣 = g("人行廣場");
    var 可建 = Math.max(0, 基地 - 廣);
    var 建蔽 = g("建蔽率");
    /* 預設樓板＝可建面積×建蔽率。這是**預設輸入**，使用者可在「標準層樓板」直接覆寫。 */
    var 樓板 = 數(f.標準樓板, 0) > 0 ? 數(f.標準樓板, 0) : 可建 * 建蔽;
    var 層 = Math.max(1, 整(f.地上樓層 != null && f.地上樓層 !== "" ? f.地上樓層 : 8));
    var 戶 = Math.max(1, 整(f.戶數 != null && f.戶數 !== "" ? f.戶數 : 30));

    var floors = [];
    /* B1F：地下室外緣通常大於建築線範圍；防空避難／停車空間不計容積（§117），故計容積 0。 */
    floors.push({ 啟用: true, 樓層: "B1F", 樓板: Math.round(樓板 * 1.4 * 100) / 100,
                  計容積: 0, 梯廳: 0, 安全梯: 0, 陽台: 0 });
    for (var i = 1; i <= 層; i++) {
      floors.push({
        啟用: true, 樓層: i + "F",
        樓板: Math.round(樓板 * 100) / 100,
        計容積: Math.round(樓板 * 100) / 100,      // 地上層全部計容積；由 Core 加總
        /* 梯廳／陽台預設剛好落在免計基準上（5%／10%）＝預設量體不產生 §162 超出。
           真實圖說一定會有超出，那要由使用者填真實數字，不是這裡先假設一個。 */
        梯廳: Math.round(樓板 * 0.05 * 100) / 100,
        安全梯: Math.round(樓板 * 0.08 * 100) / 100,
        陽台: Math.round(樓板 * 0.10 * 100) / 100
      });
    }

    return {
      params: {
        案件名稱: f.案件名稱 || "我的案件",
        基地面積: 基地, 人行廣場: 廣, 容積率: g("容積率"), 獎勵率: g("獎勵率"),
        容積移轉: g("容積移轉"), 公設比: g("公設比"),
        梯廳免計基準: 5, 陽台免計基準: 10,
        /* 刻意不設 `面積表計入容積`：有圖說面積表才填，沒有就讓 Core 由逐層計容積加總。 */
        住宅單價: g("住宅單價"), 店舖坪數: 0, 店舖單價: 0,
        車位數: Math.round(戶 * 0.8), 車位單價: 230,
        營造單價: g("營造單價"), 戶數: 戶, 權變戶數: 戶,
        土融土地成本: g("土地成本"), 地價: g("地價"),
        既有建物面積: 0, 建物單價: 0, 屋齡: 40
      },
      floors: floors,
      case_type: (f.case_type === "danger_building") ? "危老" : "都更",
      mode: f.mode || "全案管理",
      owners: []
    };
  }

  /* Core 輸出 → 案件紀錄。整個 OS 只有這一個地方決定紀錄長什麼樣。 */
  var VIEW_KEYS = ["baseline_far", "allow_floor_area", "used_floor_area", "remaining_floor_area",
    "saleable_area", "efficiency_ratio", "total_sales", "shared_cost", "shared_cost_ratio",
    "owner_return_value", "owner_return_ratio", "return_rate", "pre_renewal_value", "value_multiple"];

  function projectId(input_hash) {
    return "prj-" + String(input_hash || "").replace(/^sha256:/, "").slice(0, 8);
  }

  function buildRecord(o) {
    var eng = o.engine, R = o.result || {}, ih = o.input_hash || "";
    var ct = o.case_type || (eng.case_type === "危老" ? "danger_building" : "urban_renewal");
    var pid = projectId(ih);
    var name = (eng.params && eng.params.案件名稱) || "我的案件";
    var view = {};
    VIEW_KEYS.forEach(function (k) { view[k] = (k in R) ? R[k] : null; });
    view.warnings = (R.warnings || []).map(function (w) {
      return typeof w === "string" ? w : (w.message || w.msg || w.code || "");
    });
    return {
      pid: pid,
      wf: { schema_version: "wf-1.1",
            project: { project_id: pid, code_name: name, case_type: ct, mode: eng.mode,
                       stage: "S1", active_snapshot: "snap-01",
                       snapshots: [{ id: "snap-01", label: "建案版", schema_version: "2.1",
                                     input_hash: ih, core_version: R.core_version || "",
                                     computed_at: R.computed_at || "" }] },
            stakeholders: [], consent_events: [], tasks: [], decisions: [] },
      snap: { code_name: name, case_type: ct, stakeholders_n: 0,
              input_hash: ih, core_version: R.core_version || "", computed_at: R.computed_at || "",
              shared_cost_ratio: R.shared_cost_ratio != null ? R.shared_cost_ratio : null,
              return_rate: R.return_rate != null ? R.return_rate : null,
              warnings_n: (R.warnings || []).length,
              agreed: 0, total: eng.params.戶數,
              threshold: eng.case_type === "危老" ? 1 : 0.8,
              allocations: [],
              site: { site_area_sqm: eng.params.基地面積, plaza_area_sqm: eng.params.人行廣場,
                      far: eng.params.容積率, bonus_ratio: eng.params.獎勵率,
                      tdr_transfer_sqm: eng.params.容積移轉 },
              public_ratio: eng.params.公設比 },
      engine: eng, decision: null, roster: [], view: view, cashflow: null,
      demo: false, dirty: true
    };
  }

  /* 既有紀錄套上新的 Core 結果（改參數後重算走這條，保留同意事件等既有事實）。 */
  function applyResult(rec, o) {
    var R = o.result || {}, ih = o.input_hash || "", eng = o.engine || rec.engine;
    var next = JSON.parse(JSON.stringify(rec));
    next.engine = eng;
    VIEW_KEYS.forEach(function (k) { next.view[k] = (k in R) ? R[k] : null; });
    next.view.warnings = (R.warnings || []).map(function (w) {
      return typeof w === "string" ? w : (w.message || w.msg || w.code || "");
    });
    next.snap.input_hash = ih;
    next.snap.core_version = R.core_version || "";
    next.snap.computed_at = R.computed_at || "";
    next.snap.shared_cost_ratio = R.shared_cost_ratio != null ? R.shared_cost_ratio : null;
    next.snap.return_rate = R.return_rate != null ? R.return_rate : null;
    next.snap.warnings_n = (R.warnings || []).length;
    next.snap.total = eng.params.戶數;
    next.snap.site = { site_area_sqm: eng.params.基地面積, plaza_area_sqm: eng.params.人行廣場,
                       far: eng.params.容積率, bonus_ratio: eng.params.獎勵率,
                       tdr_transfer_sqm: eng.params.容積移轉 };
    next.snap.public_ratio = eng.params.公設比;
    var sn = next.wf.project.snapshots[0] || {};
    sn.input_hash = ih; sn.core_version = R.core_version || ""; sn.computed_at = R.computed_at || "";
    next.wf.project.snapshots[0] = sn;
    /* 輸入變了，舊 decision 就不再對應這份快照。 */
    /* 依 N1 二元組規則，留著它只會在下游顯示「不相符」；此處直接卸下，理由記在 detached_decision。 */
    if (next.decision && next.decision.input_hash !== ih) {
      next.detached_decision = next.decision;
      next.decision = null;
    }
    return next;
  }

  /* ── 四步讀模型：連動的核心 ────────────────────────────────────────────
     每一步回一個 {label, value, unit, source} 陣列。source 只有三種：
       "core"     — 來自 Core result（權威）
       "input"    — 來自使用者輸入的 engine 參數（事實，非計算）
       "decision" — 來自 Decision Engine（權威）
     取不到一律 value:null，由呈現層顯示「—」。**沒有第四種 source。** */
  function 取(o, k) { return (o && o[k] != null) ? o[k] : null; }

  function stepValues(rec) {
    var v = (rec && rec.view) || {}, sn = (rec && rec.snap) || {},
        d = (rec && rec.decision) || null, P = ((rec && rec.engine) || {}).params || {};
    return {
      site: {
        title: "基地", href: "dashboard.html",
        items: [
          { label: "基地面積", value: 取(P, "基地面積"), unit: "㎡", source: "input" },
          { label: "法定容積率", value: 取(P, "容積率"), unit: "ratio", source: "input" },
          { label: "允建容積", value: 取(v, "allow_floor_area"), unit: "㎡", source: "core" },
          { label: "容積餘量", value: 取(v, "remaining_floor_area"), unit: "㎡", source: "core" }
        ]
      },
      product: {
        title: "產品", href: "evaluator.html",
        items: [
          { label: "銷售坪數", value: 取(v, "saleable_area"), unit: "坪", source: "core" },
          { label: "坪效", value: 取(v, "efficiency_ratio"), unit: "x", source: "core" },
          { label: "共同負擔比", value: 取(v, "shared_cost_ratio"), unit: "ratio", source: "core" },
          { label: "全案投報率", value: 取(v, "return_rate"), unit: "ratio", source: "core" }
        ]
      },
      people: {
        title: "人心", href: "os-simulator.html",
        items: [
          { label: "權變戶數", value: 取(sn, "total"), unit: "戶", source: "input" },
          { label: "已同意", value: 取(sn, "agreed"), unit: "戶", source: "input" },
          { label: "同意門檻", value: 取(sn, "threshold"), unit: "ratio", source: "input" },
          { label: "地主分回比", value: 取(v, "owner_return_ratio"), unit: "ratio", source: "core" }
        ]
      },
      decision: {
        title: "決策", href: "report.html",
        items: [
          { label: "判定", value: 取(d, "verdict"), unit: "text", source: "decision" },
          { label: "完工機率", value: 取(d, "completion_probability"), unit: "ratio", source: "decision" },
          { label: "破局引爆點", value: 取(d, "breakpoint_stakeholder"), unit: "text", source: "decision" },
          { label: "決策急迫度", value: 取(d, "decision_urgency"), unit: "ratio", source: "decision" }
        ]
      }
    };
  }

  var STEP_ORDER = ["site", "product", "people", "decision"];

  /* 溯源戳記：四步顯示的數字是同一份輸入算出來的嗎？（連動的可稽核證明） */
  function provenance(rec) {
    var sn = (rec && rec.snap) || {};
    return { input_hash: sn.input_hash || "", core_version: sn.core_version || "",
             computed_at: sn.computed_at || "" };
  }

  /* ── 守衛：本模組不得出現任何輸出公式 ──────────────────────────────── */
  var DERIVED_OUTPUTS = ["allow_floor_area", "remaining_floor_area", "saleable_area",
    "efficiency_ratio", "shared_cost_ratio", "return_rate", "owner_return_ratio",
    "total_sales", "value_multiple", "completion_probability", "decision_urgency", "verdict"];

  function assertNoDerivedOutput(rec, before) {
    /* stepValues 讀到的每個 core／decision 值，都必須逐字等於紀錄裡的原值。 */
    var sv = stepValues(rec), v = (rec && rec.view) || {}, d = (rec && rec.decision) || {};
    var 對照 = { allow_floor_area: v.allow_floor_area, remaining_floor_area: v.remaining_floor_area,
      saleable_area: v.saleable_area, efficiency_ratio: v.efficiency_ratio,
      shared_cost_ratio: v.shared_cost_ratio, return_rate: v.return_rate,
      owner_return_ratio: v.owner_return_ratio, verdict: d.verdict,
      completion_probability: d.completion_probability, decision_urgency: d.decision_urgency };
    var 映射 = { "允建容積": "allow_floor_area", "容積餘量": "remaining_floor_area",
      "銷售坪數": "saleable_area", "坪效": "efficiency_ratio", "共同負擔比": "shared_cost_ratio",
      "全案投報率": "return_rate", "地主分回比": "owner_return_ratio", "判定": "verdict",
      "完工機率": "completion_probability", "決策急迫度": "decision_urgency" };
    STEP_ORDER.forEach(function (s) {
      sv[s].items.forEach(function (it) {
        var k = 映射[it.label];
        if (!k) return;
        var 原 = 對照[k] != null ? 對照[k] : null;
        if (it.value !== 原) throw new Error("stepValues 竄改了 " + it.label + "（必須逐欄 verbatim）");
      });
    });
    return true;
  }

  /* ── 儲存層（瀏覽器）────────────────────────────────────────────── */

  function readStore() {
    try { return JSON.parse(localStorage.getItem(KEY)) || { order: [], projects: {} }; }
    catch (e) { return { order: [], projects: {} }; }
  }
  function writeStore(s) {
    localStorage.setItem(KEY, JSON.stringify(s));
    try { window.dispatchEvent(new CustomEvent(EVT, { detail: { pid: activePid() } })); } catch (e) {}
  }
  function activePid() {
    try {
      var pid = localStorage.getItem(ACTIVE);
      var s = readStore();
      if (pid && s.projects[pid]) return pid;
      return (s.order || [])[0] || null;
    } catch (e) { return null; }
  }
  function setActive(pid) {
    try { localStorage.setItem(ACTIVE, pid); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent(EVT, { detail: { pid: pid } })); } catch (e) {}
  }
  function activeRecord() {
    var pid = activePid(); if (!pid) return null;
    var r = readStore().projects[pid]; if (!r) return null;
    r.pid = pid; return r;
  }
  function upsert(rec) {
    var s = readStore();
    var pid = rec.pid || projectId(rec.snap && rec.snap.input_hash);
    s.projects[pid] = rec;
    s.order = s.order || [];
    if (s.order.indexOf(pid) < 0) s.order.unshift(pid);
    writeStore(s);
    setActive(pid);
    return pid;
  }
  /* 換 pid：輸入一改，input_hash 就變，案件識別跟著換——舊 pid 的紀錄要移除，
     否則每動一次滑桿就多一個案件。保留使用者自己建立的其他案件。 */
  function replace(oldPid, rec) {
    var s = readStore();
    var pid = rec.pid || projectId(rec.snap && rec.snap.input_hash);
    if (oldPid && oldPid !== pid && s.projects[oldPid]) {
      delete s.projects[oldPid];
      s.order = (s.order || []).filter(function (x) { return x !== oldPid; });
    }
    s.projects[pid] = rec;
    s.order = s.order || [];
    if (s.order.indexOf(pid) < 0) s.order.unshift(pid);
    writeStore(s);
    setActive(pid);
    return pid;
  }
  /* 訂閱：同分頁（CustomEvent）＋跨分頁（storage）都會觸發，四步因此真的連動。 */
  function onChange(cb) {
    var h = function () { try { cb(activeRecord()); } catch (e) {} };
    try {
      window.addEventListener(EVT, h);
      window.addEventListener("storage", function (e) { if (!e.key || e.key === KEY || e.key === ACTIVE) h(); });
    } catch (e) {}
    return h;
  }

  var api = {
    BASIC: BASIC, ADVANCED: ADVANCED, FIELDS: FIELDS, STEP_ORDER: STEP_ORDER,
    VIEW_KEYS: VIEW_KEYS, DERIVED_OUTPUTS: DERIVED_OUTPUTS,
    defaults: defaults, buildEngine: buildEngine, buildRecord: buildRecord,
    applyResult: applyResult, stepValues: stepValues, provenance: provenance,
    projectId: projectId, assertNoDerivedOutput: assertNoDerivedOutput,
    readStore: readStore, writeStore: writeStore, activePid: activePid, setActive: setActive,
    activeRecord: activeRecord, upsert: upsert, replace: replace, onChange: onChange,
    KEY: KEY, ACTIVE_KEY: ACTIVE, EVENT: EVT
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  self.CaseBus = api;
})();
