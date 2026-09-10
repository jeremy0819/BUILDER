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
    var ct = o.case_type || (eng.case_type === "危老" ? "danger_building" : "urban_renewal");
    var name = (eng.params && eng.params.案件名稱) || "我的案件";
    var pid = rec.pid || (rec.wf && rec.wf.project && rec.wf.project.project_id) || projectId(ih);
    next.pid = pid;
    next.engine = eng;
    next.view = next.view || {};
    VIEW_KEYS.forEach(function (k) { next.view[k] = (k in R) ? R[k] : null; });
    next.view.warnings = (R.warnings || []).map(function (w) {
      return typeof w === "string" ? w : (w.message || w.msg || w.code || "");
    });
    next.snap = next.snap || {};
    next.snap.code_name = name;
    next.snap.case_type = ct;
    next.snap.input_hash = ih;
    next.snap.core_version = R.core_version || "";
    next.snap.computed_at = R.computed_at || "";
    next.snap.shared_cost_ratio = R.shared_cost_ratio != null ? R.shared_cost_ratio : null;
    next.snap.return_rate = R.return_rate != null ? R.return_rate : null;
    next.snap.warnings_n = (R.warnings || []).length;
    next.snap.total = eng.params.戶數;
    next.snap.threshold = eng.case_type === "危老" ? 1 : 0.8;
    next.snap.site = { site_area_sqm: eng.params.基地面積, plaza_area_sqm: eng.params.人行廣場,
                       far: eng.params.容積率, bonus_ratio: eng.params.獎勵率,
                       tdr_transfer_sqm: eng.params.容積移轉 };
    next.snap.public_ratio = eng.params.公設比;
    next.wf = next.wf || { schema_version: "wf-1.1" };
    next.wf.project = next.wf.project || {};
    next.wf.project.project_id = pid;
    next.wf.project.code_name = name;
    next.wf.project.case_type = ct;
    next.wf.project.mode = eng.mode;
    next.wf.project.snapshots = next.wf.project.snapshots || [];
    var sn = next.wf.project.snapshots[0] || {};
    sn.input_hash = ih; sn.core_version = R.core_version || ""; sn.computed_at = R.computed_at || "";
    next.wf.project.snapshots[0] = sn;
    /* 輸入變了，舊 decision 就不再對應這份快照。 */
    /* 依 N1 二元組規則，留著它只會在下游顯示「不相符」；此處直接卸下，理由記在 detached_decision。 */
    if (next.decision && (next.decision.input_hash !== ih ||
                          next.decision.core_version !== (R.core_version || ""))) {
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
      decision: (function () {
        /* 綁不上就一律視為「沒有這個值」——寧可顯示「—」，也不顯示一個
           不屬於這份快照的判定。理由與 M7.4「明確拒答優於虛假歸因」同一條。 */
        var 綁 = decisionBinds(rec);
        var 取D = function (k) { return 綁.bound ? 取(d, k) : null; };
        return {
          title: "決策", href: "report.html",
          bound: 綁.bound, bind_reason: 綁.reason, bind_note: BIND_NOTE[綁.reason] || 綁.reason,
          items: [
            { label: "判定", value: 取D("verdict"), unit: "text", source: "decision" },
            { label: "完工機率", value: 取D("completion_probability"), unit: "ratio", source: "decision" },
            { label: "破局引爆點", value: 取D("breakpoint_stakeholder"), unit: "text", source: "decision" },
            { label: "決策急迫度", value: 取D("decision_urgency"), unit: "ratio", source: "decision" }
          ]
        };
      })()
    };
  }

  /* ── N1 二元組綁定：decision 對不上目前快照就不得顯示 ────────────────
     這裡曾經有個洞：stepValues() 直接讀 rec.decision.verdict，**完全沒檢查**
     那份 decision 綁不綁得上目前的快照。於是導覽列會顯示一個
     「照 N1 規則根本不該綁定」的判定——例如示範案的 STOP 是 core 0.4.0 算的，
     而現行 Core 是 0.6.0，二元組規則明文說跨版本一律不相符。
     N1 把誤綁擋在 matchDecision()，卻在顯示層又開了同一個洞。此處補上。
     規則與 core/redcf/decision.py 的 snapshot_matches() 一致（三條從嚴）。 */
  var UNKNOWN_CORE = "unknown";
  function decisionBinds(rec) {
    var d = (rec && rec.decision) || null;
    var sn = (rec && rec.snap) || {};
    if (!d || !d.input_hash) return { bound: false, reason: "no_decision" };
    if (d.input_hash !== (sn.input_hash || "")) return { bound: false, reason: "hash_mismatch" };
    var dc = d.core_version || UNKNOWN_CORE;
    if (dc === UNKNOWN_CORE) return { bound: false, reason: "core_version_unknown" };
    if (!sn.core_version) return { bound: false, reason: "snapshot_core_version_missing" };
    if (dc !== sn.core_version) return { bound: false, reason: "core_version_mismatch" };
    return { bound: true, reason: "ok" };
  }
  var BIND_NOTE = {
    no_decision: "尚未產生判定",
    hash_mismatch: "輸入已變更，需重算",
    core_version_unknown: "判定未記錄 Core 版本，需重算",
    core_version_mismatch: "判定由其他 Core 版本算出，需重算",
    snapshot_core_version_missing: "快照未記錄 Core 版本"
  };

  var STEP_ORDER = ["site", "product", "people", "decision"];

  /* 溯源戳記：四步顯示的數字是同一份輸入算出來的嗎？（連動的可稽核證明）

     另附**陳舊**判斷。這與 N1 的「綁定」是兩件不同的事，很容易混為一談：
       · 綁定（decisionBinds）＝ decision 與**快照**是不是同一對（同輸入、同 Core）。
         0.4.0 的判定配 0.4.0 的快照，是一致的歷史配對，**綁得上**。
       · 陳舊（stale）＝ 這份快照是不是由**現行** Core 算的。
         0.4.0 的快照在 Core 0.6.0 的今天就是舊的——數字沒錯，但公式已經換過。
     示範案就是「綁得上但陳舊」：畫面同時出現 core 0.6.0 徽章與 0.4.0 的 STOP，
     不標出來會讓人以為那是現在這版算的。 */
  function runningCore() {
    try { return (self.UROS_VERSION && self.UROS_VERSION.core) || ""; } catch (e) { return ""; }
  }
  function provenance(rec, 現行) {
    var sn = (rec && rec.snap) || {};
    var cur = 現行 || runningCore();
    var snapCore = sn.core_version || "";
    return { input_hash: sn.input_hash || "", core_version: snapCore,
             computed_at: sn.computed_at || "",
             running_core: cur,
             stale: !!(cur && snapCore && snapCore !== cur),
             stale_note: (cur && snapCore && snapCore !== cur)
               ? "數字來自 Core " + snapCore + " 快照（現行 " + cur + "）" : "" };
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
      owner_return_ratio: v.owner_return_ratio };
    var 綁 = decisionBinds(rec);
    if (綁.bound) {
      對照.verdict = d.verdict;
      對照.completion_probability = d.completion_probability;
      對照.decision_urgency = d.decision_urgency;
    }
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

  /* ── ③ 人心沙盤橋接：把作用中案件的「事實」帶進沙盤 ──────────────────
     背景：沙盤的消費端（os-simulator 的 BRIDGE_OWNERS）早就存在，但**只有
     workspace.html 會寫** `uros.bridge.case`。走四步動線進 ③ 從來不設橋接，
     於是永遠落回「經典局」——導覽列說 56 戶、盤面說 48 戶，同一畫面兩個答案。

     ⚠️ 誠實邊界（本函式最重要的一段）：
     案件通常只有**彙總**同意數（snap.agreed=22/56），沒有**逐戶**同意事實
     （示範案的 stakeholders 全無 consent: 標籤）。把 22 戶「分配」給 56 個具名戶別
     ＝**發明哪幾戶同意了**，那是捏造事實，不是呈現事實。
     故：逐戶 consent 只在該戶真的有 consent 標籤時才給；沒有就是 "pending"，
     並以 consent_known=false 明白告訴沙盤「彙總已知、逐戶未知」，由沙盤決定怎麼講。 */
  function buildSandboxBridge(rec) {
    if (!rec || !rec.wf || !rec.wf.project) return null;
    var wf = rec.wf, snap = rec.snap || {};
    var allocById = {};
    (snap.allocations || []).forEach(function (a) { allocById[a.owner_id] = a; });
    var owners = (wf.stakeholders || [])
      .filter(function (x) { return x.role === "owner"; })
      .map(function (x) {
        var tag = (x.tags || []).filter(function (t) { return t.indexOf("consent:") === 0; })[0];
        var a = allocById[x.stakeholder_id] || null;
        return { owner_id: x.stakeholder_id,
                 consent: tag ? tag.slice(8) : "pending",
                 pre_value: a ? a.pre_value : (x.pre_value != null ? x.pre_value : null),
                 value_share: a ? a.value_share : null, alloc: a };
      });
    var 有逐戶同意 = owners.some(function (o) { return o.consent && o.consent !== "pending"; });
    return {
      source: "case-bus", project_id: wf.project.project_id,
      code_name: snap.code_name, case_type: snap.case_type,
      owners_n: snap.stakeholders_n, agreed: snap.agreed, total: snap.total,
      stage: wf.project.stage, ts: new Date().toISOString(),
      /* 逐戶同意未知時仍傳 owners（身分與價值是事實），但明示同意面不可信 */
      consent_known: 有逐戶同意,
      owners: (owners.length && owners.length <= 80) ? owners : null
    };
  }

  var BRIDGE_KEY = "uros.bridge.case";
  var BRIDGE_OPTOUT = "uros.bridge.optout";   // 使用者明示「改用經典局」時記住這個選擇

  /* 讓 ③ 預設跟著作用中案件走（四步連動的一部分），但尊重使用者的退出選擇。 */
  function syncSandboxBridge() {
    try {
      if (localStorage.getItem(BRIDGE_OPTOUT) === "1") return null;
      var rec = activeRecord();
      var b = buildSandboxBridge(rec);
      if (!b) return null;
      var 舊 = null;
      try { 舊 = JSON.parse(localStorage.getItem(BRIDGE_KEY) || "null"); } catch (e) {}
      /* 使用者從 workspace 手動帶入的橋接優先，不覆蓋 */
      if (舊 && 舊.source === "workspace" && 舊.project_id === b.project_id) return 舊;
      localStorage.setItem(BRIDGE_KEY, JSON.stringify(b));
      return b;
    } catch (e) { return null; }
  }

  /* ── 儲存層（瀏覽器）────────────────────────────────────────────── */

  function readStore() {
    var text = localStorage.getItem(KEY);
    if (!text) return { order: [], projects: {} };
    var store = self.UROSSecurity.parseJSON(text);
    if (!store || !Array.isArray(store.order) || !store.projects || typeof store.projects !== "object" || Array.isArray(store.projects)) throw new Error("案件儲存格式無效；原始資料保留");
    return store;
  }
  function writeStore(s) {
    var text = JSON.stringify(s);
    self.UROSSecurity.parseJSON(text);
    localStorage.setItem(KEY, text);
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
    var store = readStore(), pid = localStorage.getItem(ACTIVE);
    if (!pid || !Object.prototype.hasOwnProperty.call(store.projects, pid)) pid = store.order[0];
    if (!pid) return null;
    var r = store.projects[pid]; if (!r) return null;
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
  /* 更新既有案件：Project Entity 的 pid 建立後固定；input_hash 只識別計算快照。
     若讓 pid 跟著輸入變動，Activity／里程碑等以 pid 關聯的資料會成為孤兒。 */
  function replace(oldPid, rec) {
    var s = readStore();
    var pid = oldPid || rec.pid || projectId(rec.snap && rec.snap.input_hash);
    var stored = JSON.parse(JSON.stringify(rec));
    stored.pid = pid;
    if (stored.wf && stored.wf.project) stored.wf.project.project_id = pid;
    s.projects[pid] = stored;
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
    decisionBinds: decisionBinds, BIND_NOTE: BIND_NOTE,
    buildSandboxBridge: buildSandboxBridge, syncSandboxBridge: syncSandboxBridge,
    BRIDGE_KEY: BRIDGE_KEY, BRIDGE_OPTOUT_KEY: BRIDGE_OPTOUT,
    applyResult: applyResult, stepValues: stepValues, provenance: provenance,
    projectId: projectId, assertNoDerivedOutput: assertNoDerivedOutput,
    readStore: readStore, writeStore: writeStore, activePid: activePid, setActive: setActive,
    activeRecord: activeRecord, upsert: upsert, replace: replace, onChange: onChange,
    KEY: KEY, ACTIVE_KEY: ACTIVE, EVENT: EVT
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  self.CaseBus = api;
})();
