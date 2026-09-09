/* Strategy workspace: record observations, call Core, present traceable results. */
(function (root) {
  "use strict";
  var TYPES = [["", "未分型"], ["strategic", "策略型"], ["fearful", "恐懼型"], ["anchored", "錨定型"], ["opposed", "反對型"], ["unknown", "無法判斷"]];
  var BLOCKS = [["", "選擇原因"], ["inherited_unregistered", "繼承未辦"], ["joint_ownership", "共有"], ["mortgaged", "抵押"], ["illegal_structure", "增建"]];
  var SIGNALS = [
    ["questioned_capital_adequacy", "質疑資金能力"], ["repeated_same_question", "反覆詢問同一問題"],
    ["fears_nondelivery", "擔心無法交屋"], ["more_doubtful_after_sweetener", "加碼後更加懷疑"],
    ["raised_at_critical_moment", "關鍵時點提出條件"], ["demands_specific_terms", "要求具體條件"],
    ["comparing_competitors", "比較其他實施者"], ["softens_with_terms", "條件調整後態度轉緩"],
    ["refuses_to_discuss_terms", "拒絕討論條件"], ["emotional_attachment", "對原居所具有情感依附"],
    ["no_urgency_long_horizon", "不急於更新"], ["status_quo_favorable", "現狀對其有利"],
    ["questions_unit_selection_fairness", "質疑選配公正性"], ["anchored_on_interior_ping", "重視室內實坪"],
    ["anchored_on_original_floor", "重視原樓層"], ["demands_traceable_allocation", "要求可追溯的分回依據"]
  ];
  var ACTIONS = { institutional_guarantee: "制度性擔保", time_limited_offer: "有期限的條件協商", address_the_anchor: "回應具體錨點", statutory_process: "檢視法定程序", clarify_and_record: "先接觸釐清" };
  var ADMIN = { assist_inheritance_registration: "協助繼承登記", co_owner_agreement: "共有人協議", mortgage_clearance: "抵押處理", illegal_structure_rights_assessment: "增建權益認定" };
  var FORBIDDEN = { increase_allocation: "加碼或提高分配", verbal_guarantee_only: "只做口頭保證", authority_endorsement_as_substitute: "以權威背書取代擔保", reveal_urgency: "顯露急迫", continue_sweetening: "持續加碼說服", generic_compensation: "以一般補償取代對具體錨點的回應" };
  var COUNTERS = { do_not_sweeten: "不以加碼回應", surface_silent_supporters: "了解尚未公開表態者的意見", publish_hard_information: "提供可查證的第三方資訊", address_doubts_publicly_for_middle: "公開逐項回應疑問" };
  var INPUTS = [["我方收入", "我方預期收入", "1"], ["我方投入", "我方未來投入", "1"], ["mgmt_fee", "實施者管理收入", "1"], ["advance", "實施者墊付", "1"], ["profit_impl", "實施者其他利潤", "1"], ["operating", "實施者營運支出", "1"], ["V0_scenario", "更新前價值情境", "1"], ["p_haircut", "存活率調整係數（0–1）", "0.05"]];
  function lookup(list, key) { var found = list.find(function (x) { return x[0] === key; }); return found ? found[1] : String(key || "—"); }
  function runGuard() {
    var version = 0;
    return { invalidate: function () { return ++version; }, current: function (token) { return token === version; } };
  }
  function sourceKey(rec) {
    return JSON.stringify([rec.pid, rec.engine, rec.wf && rec.wf.project && rec.wf.project.stage,
      rec.wf && rec.wf.stakeholders, rec.snap && rec.snap.input_hash, rec.snap && rec.snap.core_version,
      rec.snap && rec.snap.agreed, rec.snap && rec.snap.total, rec.snap && rec.snap.threshold]);
  }
  function buildProfiles(owners, saved) {
    return owners.map(function (owner) {
      var id = owner.stakeholder_id, v = saved[id] || {}, p = { household_id: id, classification_source: v.willingness_type ? "recorded" : "suggested" };
      if (v.willingness_type) p.willingness_type = v.willingness_type;
      if (v.signability) p.signability = v.signability;
      if (v.signability === "blocked") {
        if (!v.blocking_reason) throw new Error("產權待清理的戶別必須記錄原因：" + id);
        p.blocking_reason = v.blocking_reason;
      }
      if (v.is_key_household) p.is_key_household = true;
      if (v.signals_observed && v.signals_observed.length) p.signals_observed = v.signals_observed.slice();
      if (v.influence_targets && v.influence_targets.length) p.influence_targets = v.influence_targets.slice();
      return p;
    });
  }
  root.StrategyWorkspace = { buildProfiles: buildProfiles, sourceKey: sourceKey, runGuard: runGuard };
  if (typeof document === "undefined") return;

  var $ = function (id) { return document.getElementById(id); };
  var record, owners = [], profiles = {}, assumptions = {}, runtime, analysis = null, queue = "persuasion", guard = runGuard(), busy = false, draftError = false;
  var fmt = function (v) { return v == null ? "—" : typeof v === "number" ? v.toLocaleString("zh-TW", { maximumFractionDigits: 2 }) : String(v); };
  function el(tag, text, className) { var node = document.createElement(tag); if (text != null) node.textContent = String(text); if (className) node.className = className; return node; }
  function status(text, state) { $("analysis-status").textContent = text; $("analysis-status").dataset.state = state || "idle"; }
  function buttons() {
    $("analysis-run").disabled = !record || !record.engine || !runtime || !runtime.ready || busy || draftError;
    $("export-strategy").disabled = !analysis; $("export-decision").disabled = !analysis;
  }
  function readDraft(key) {
    var raw = localStorage.getItem(key); if (!raw) return {};
    var value = root.UROSSecurity.parseJSON(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("本機草稿格式無效");
    return value;
  }
  function saveDrafts() {
    try {
      localStorage.setItem("uros.profiles." + record.pid, JSON.stringify(profiles));
      localStorage.setItem("uros.analysis.inputs." + record.pid, JSON.stringify(assumptions));
      $("profile-save").textContent = "已存本機"; draftError = false;
    } catch (e) { draftError = true; $("profile-save").textContent = "儲存失敗"; status("草稿未儲存，請先釋放瀏覽器儲存空間或檢查權限。", "error"); }
  }
  function invalidate(message) {
    guard.invalidate(); busy = false; analysis = null;
    $("action-list").replaceChildren(el("p", "尚無本次分析結果", "analysis-empty-text"));
    $("action-evidence").replaceChildren(); $("strategy-summary").replaceChildren(); $("decision-table").replaceChildren();
    if (record) root.DecisionView.mount($("decision-visual"), Object.assign({}, record, { decision: null }));
    status(message || "觀察或假設已變更，請重新產生策略分析。", "stale"); buttons();
  }
  function field(label, options, value, change) {
    var wrap = el("label", label), select = el("select");
    options.forEach(function (pair) { var option = el("option", pair[1]); option.value = pair[0]; select.appendChild(option); });
    select.value = value || ""; select.addEventListener("change", function () { change(select.value); }); wrap.appendChild(select); return wrap;
  }
  function renderProfiles() {
    var list = $("profiles"), term = $("owner-search").value.trim().toLowerCase(), filter = $("owner-filter").value;
    list.replaceChildren();
    owners.forEach(function (owner) {
      var id = owner.stakeholder_id, value = profiles[id] || {};
      if (term && !id.toLowerCase().includes(term)) return;
      if (filter === "unclassified" && value.willingness_type) return;
      if (filter === "blocked" && value.signability !== "blocked") return;
      if (filter === "key" && !value.is_key_household) return;
      var row = el("details", null, "profile-row"), summary = el("summary"), label = el("span");
      summary.append(el("b", id), label); row.appendChild(summary);
      function summaryText() { label.textContent = lookup(TYPES, value.willingness_type || "") + (value.signability === "blocked" ? " · 產權待清理" : ""); }
      function update(key, next) {
        value[key] = next; profiles[id] = value; summaryText(); saveDrafts();
        invalidate(); if (draftError) status("草稿儲存失敗，請檢查本機儲存空間。", "error");
      }
      summaryText();
      var fields = el("div", null, "profile-fields");
      fields.appendChild(field("意願型別", TYPES, value.willingness_type, function (v) { update("willingness_type", v); }));
      fields.appendChild(field("可簽性", [["", "沿用產權事實"], ["signable", "可簽"], ["blocked", "產權待清理"]], value.signability, function (v) { update("signability", v); reason.hidden = v !== "blocked"; }));
      var reason = field("產權原因", BLOCKS, value.blocking_reason, function (v) { update("blocking_reason", v); }); reason.hidden = value.signability !== "blocked"; fields.appendChild(reason);
      var keyWrap = el("label", null, "key-field"), keyInput = el("input"); keyInput.type = "checkbox"; keyInput.checked = !!value.is_key_household;
      keyInput.addEventListener("change", function () { update("is_key_household", keyInput.checked); }); keyWrap.append(keyInput, el("span", "關鍵戶")); fields.appendChild(keyWrap);
      var signals = el("details", null, "profile-signals"); signals.appendChild(el("summary", "觀察訊號"));
      SIGNALS.forEach(function (pair) {
        var wrap = el("label"), checkbox = el("input"); checkbox.type = "checkbox"; checkbox.checked = (value.signals_observed || []).includes(pair[0]);
        checkbox.addEventListener("change", function () { var set = new Set(value.signals_observed || []); if (checkbox.checked) set.add(pair[0]); else set.delete(pair[0]); update("signals_observed", Array.from(set)); });
        wrap.append(checkbox, el("span", pair[1])); signals.appendChild(wrap);
      });
      fields.appendChild(signals); row.appendChild(fields); list.appendChild(row);
    });
    if (!list.children.length) list.appendChild(el("p", owners.length ? "沒有符合條件的戶別" : "尚無地主清冊。請先在案件工作區補入利害關係人。", "analysis-empty-text"));
  }
  function renderInputs() {
    var form = $("analysis-assumptions"); form.replaceChildren();
    INPUTS.forEach(function (def) {
      var label = el("label", def[1]), input = el("input"); input.type = "number"; input.step = def[2]; input.min = "0"; input.name = def[0]; input.placeholder = "未提供";
      if (def[0] === "p_haircut") input.max = "1";
      input.value = assumptions[def[0]] == null ? "" : assumptions[def[0]];
      input.addEventListener("input", function () {
        if (input.value === "") delete assumptions[def[0]]; else assumptions[def[0]] = Number(input.value);
        saveDrafts(); invalidate(); if (draftError) status("草稿儲存失敗，請檢查本機儲存空間。", "error");
      }); label.appendChild(input); form.appendChild(label);
    });
  }
  function loadCase() {
    guard.invalidate(); busy = false; analysis = null; draftError = false;
    try {
      record = root.CaseBus.activeRecord();
      if (record && (!record.wf || !record.wf.project || !record.snap)) throw new Error("案件缺少必要的 Workflow 或快照資料");
      $("analysis-empty").hidden = !!record; $("analysis-content").hidden = !record;
      if (!record) {
        $("analysis-context").textContent = "尚未選擇案件";
        var link = el("a", "開啟案件工作區"); link.href = "workspace.html";
        $("analysis-empty").replaceChildren(el("p", "匯入案件或從首頁建立合成示範後即可分析。"), link); status("尚無案件資料"); buttons(); return;
      }
      owners = (record.wf.stakeholders || []).filter(function (s) { return s.role === "owner" && typeof s.stakeholder_id === "string"; });
      profiles = readDraft("uros.profiles." + record.pid); assumptions = readDraft("uros.analysis.inputs." + record.pid);
      $("analysis-context").textContent = record.snap.code_name + " · " + record.wf.project.stage + " · " + owners.length + " 位地主";
      $("profile-save").textContent = "本機草稿"; renderProfiles(); renderInputs(); invalidate("記錄觀察與假設後，即可產生本次分析。");
      var dec = record.decision;
      if (dec && dec.input_hash === record.snap.input_hash && dec.core_version === record.snap.core_version && dec.core_version !== "unknown") root.DecisionView.mount($("decision-visual"), record);
      if (!record.engine) status("此案件缺少完整計算輸入，請在案件工作區匯入可重算的 v2.1 檔案。", "error");
      buttons();
      if (record.engine && !runtime) connect();
    } catch (e) { record = null; $("analysis-content").hidden = true; status("無法讀取案件：" + e.message + "。原始本機資料保留。", "error"); buttons(); }
  }
  function connect() {
    if (runtime) runtime.terminate();
    $("runtime-retry").hidden = true; status("計算核心載入中");
    runtime = root.createCoreRuntime({
      onProgress: function (m) { if (!draftError) status(m.msg); },
      onReady: function () { if (!draftError) status("計算核心已就緒，可產生策略分析。", "ready"); buttons(); },
      onError: function (m) { invalidate(); status(m.msg + "。已儲存的觀察仍保留在本機。", "error"); $("runtime-retry").hidden = false; buttons(); }
    }); buttons();
  }
  async function run() {
    if (!record || !runtime || !runtime.ready || busy || draftError) return;
    if (!$("analysis-assumptions").reportValidity()) return;
    var prof;
    try { prof = buildProfiles(owners, profiles); } catch (e) { status(e.message, "error"); return; }
    var snapshot = root.CaseBus.activeRecord(), key = sourceKey(snapshot), token = guard.invalidate();
    busy = true; analysis = null; buttons(); status("計算財務、三方期望值與逐戶策略中", "computing");
    var workflow = { stage: snapshot.wf.project.stage, stakeholders: snapshot.wf.stakeholders || [],
      consent: { agreed: snapshot.snap.agreed, total: snapshot.snap.total, threshold: snapshot.snap.threshold } };
    function current() { var now = root.CaseBus.activeRecord(); return guard.current(token) && now && sourceKey(now) === key; }
    try {
      var response = await runtime.analyze(snapshot.engine, workflow, Object.assign({}, assumptions), prof);
      if (!current()) { if (guard.current(token)) invalidate("案件資料已更新，請重新分析。"); return; }
      if (!response.result || !response.decision || !response.strategy || response.input_hash !== response.decision.input_hash || response.input_hash !== response.strategy.input_hash || response.result.core_version !== response.decision.core_version) throw new Error("計算回應的溯源資料不一致");
      analysis = response; busy = false;
      var model = Object.assign({}, snapshot, { view: response.result, snap: Object.assign({}, snapshot.snap, { input_hash: response.input_hash, core_version: response.result.core_version }), decision: response.decision });
      root.DecisionView.mount($("decision-visual"), model); renderSummary(); renderQueue(); renderDecision();
      status("分析完成 · 本次試算，未寫回案件快照 · core " + response.result.core_version + " · input " + response.input_hash.replace(/^sha256:/, "").slice(0,12), "ready"); buttons();
    } catch (e) {
      if (!current()) { if (guard.current(token)) invalidate("案件資料已更新，請重新分析。"); return; }
      busy = false; analysis = null; status("分析失敗：" + e.message, "error"); buttons();
    }
  }
  function renderSummary() {
    var s = analysis.strategy, target = $("strategy-summary"); target.replaceChildren();
    [["地主溝通", s.workload_split.persuasion_count], ["產權清理", s.workload_split.administrative_count], ["反向擴散風險", { low:"低", medium:"中", high:"高" }[s.cascade_risk] || "—"]].forEach(function (pair, i) {
      var block = el("div"), value = el("b", pair[1]); if (i === 2 && ["low","medium","high"].includes(s.cascade_risk)) value.className = "risk-" + s.cascade_risk;
      block.append(el("small", pair[0]), value); target.appendChild(block);
    });
  }
  function selectAction(item, button) {
    $("action-list").querySelectorAll("button").forEach(function (node) { node.setAttribute("aria-pressed", String(node === button)); });
    var panel = $("action-evidence"); panel.replaceChildren(el("h3", item.household_id + " · " + (ACTIONS[item.recommended_action] || ADMIN[item.action] || "待釐清")));
    panel.appendChild(el("p", item.reason || lookup(BLOCKS, item.blocking_reason)));
    if (item.classification_source) panel.appendChild(el("p", "分類來源：" + ({recorded:"實際接觸紀錄",suggested:"觀察訊號推測",simulated:"合成劇本"}[item.classification_source] || item.classification_source)));
    if (item.signals_used && item.signals_used.length) { panel.appendChild(el("h4", "依據訊號")); panel.appendChild(el("p", item.signals_used.map(function (x) { return lookup(SIGNALS, x); }).join("、"))); }
    if (item.forbidden_actions && item.forbidden_actions.length) {
      panel.appendChild(el("h4", "避免採取")); var ul = el("ul", null, "forbidden"); item.forbidden_actions.forEach(function (v) { ul.appendChild(el("li", FORBIDDEN[v] || v)); }); panel.appendChild(ul);
    }
    var counters = analysis.strategy.cascade_countermeasures || [];
    if (counters.length) { panel.appendChild(el("h4", "群體風險回應")); panel.appendChild(el("p", counters.map(function (x) { return COUNTERS[x] || x; }).join("、"))); }
  }
  function renderQueue() {
    var list = $("action-list"); list.replaceChildren(); $("action-evidence").replaceChildren();
    if (!analysis) return;
    var rows = analysis.strategy[queue === "persuasion" ? "persuasion_queue" : "administrative_queue"] || [];
    rows.forEach(function (item) {
      var button = el("button"); button.type = "button"; button.setAttribute("aria-pressed", "false");
      button.append(el("span", item.rank == null ? "待辦" : "#" + item.rank), el("b", item.household_id), el("div", ACTIONS[item.recommended_action] || ADMIN[item.action] || "待釐清"));
      button.addEventListener("click", function () { selectAction(item, button); }); list.appendChild(button);
    });
    if (rows.length) selectAction(rows[0], list.firstChild); else list.appendChild(el("p", "本次分析沒有此類待辦", "analysis-empty-text"));
  }
  function renderDecision() {
    var d = analysis.decision, target = $("decision-table"), table = el("table"), head = el("tr");
    ["利害關係人", "名目", "期望值 EV", "資料"].forEach(function (text) { head.appendChild(el("th", text)); }); table.appendChild(head);
    ["地主", "實施者", "我方"].forEach(function (key) { var value = d.ev[key], tr = el("tr"); [key, fmt(value.nominal), fmt(value.ev), value.status === "ok" ? "完整" : "不足"].forEach(function (x) { tr.appendChild(el("td", x)); }); table.appendChild(tr); });
    target.replaceChildren(table, el("p", "缺少欄位：" + (d.insufficient_fields.join("、") || "無")), el("p", "模型假設：" + JSON.stringify(d.assumptions)), el("p", analysis.strategy.provenance_note), el("p", "Decision " + d.decision_engine_version + " · Strategy " + analysis.strategy.strategy_engine_version));
  }
  function download(kind) {
    if (!analysis) return;
    var url = URL.createObjectURL(new Blob([JSON.stringify(analysis[kind], null, 2)], { type: "application/json" }));
    var link = el("a"); link.href = url; link.download = "builder-" + kind + ".json"; link.click(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function start() {
    $("analysis-run").addEventListener("click", run); $("runtime-retry").addEventListener("click", connect);
    $("owner-search").addEventListener("input", renderProfiles); $("owner-filter").addEventListener("change", renderProfiles);
    $("analysis-assumptions").addEventListener("submit", function (event) { event.preventDefault(); });
    $("export-strategy").addEventListener("click", function () { download("strategy"); }); $("export-decision").addEventListener("click", function () { download("decision"); });
    var tabs = Array.from(document.querySelectorAll("[data-queue]"));
    tabs.forEach(function (tab, index) {
      tab.addEventListener("click", function () { queue = tab.dataset.queue; tabs.forEach(function (node) { node.setAttribute("aria-selected", String(node === tab)); node.tabIndex = node === tab ? 0 : -1; }); renderQueue(); });
      tab.addEventListener("keydown", function (event) { if (["ArrowLeft","ArrowRight","Home","End"].includes(event.key)) { event.preventDefault(); var next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length-1 : (index + (event.key === "ArrowRight" ? 1 : tabs.length-1)) % tabs.length; tabs[next].focus(); tabs[next].click(); } });
    });
    window.addEventListener("storage", function (event) { if (!event.key || event.key === "uros.workflow.v1" || event.key === "uros.active_case" || (record && ["uros.profiles." + record.pid, "uros.analysis.inputs." + record.pid].includes(event.key))) loadCase(); });
    window.addEventListener("uros:case-changed", loadCase);
    window.addEventListener("pagehide", function () { guard.invalidate(); if (runtime) runtime.terminate(); });
    loadCase();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})(typeof self !== "undefined" ? self : this);
