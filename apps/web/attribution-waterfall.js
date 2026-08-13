/* M8.2 Attribution Waterfall — Core presentation verbatim; arithmetic is geometry only. */
(function (root, factory) {
  "use strict";
  var api = factory();
  root.AttributionWaterfall = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function readPath(source, path) {
    return String(path || "").split(".").reduce(function (value, key) {
      return value == null ? undefined : value[key];
    }, source);
  }

  function presentationNumber(value, precision) {
    if (typeof value !== "number" || !Number.isFinite(value)) return "—";
    var text = String(value);
    if (text.indexOf("e") !== -1 || precision == null) return text;
    var parts = text.split(".");
    var decimals = parts[1] || "";
    if (decimals.length < precision) text += (decimals ? "" : ".") + "0".repeat(precision - decimals.length);
    return text;
  }

  function signedPresentation(value, precision) {
    var shown = presentationNumber(value, precision);
    return shown === "—" ? shown : (value > 0 ? "+" : "") + shown;
  }

  function rawNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? String(value) : "—";
  }

  function stateFor(report, contract) {
    var actual = readPath(report, contract.uncertainty.source_field);
    return contract.uncertainty.states.find(function (state) { return state.when === actual; }) || {
      level: "illustrative", label: "狀態未提供"
    };
  }

  function effectFor(impact, role, higherIsBetter) {
    if (role === "reconciliation") return "顯示對帳";
    if (impact === 0) return "零影響";
    return ((impact > 0) === higherIsBetter) ? "改善" : "不利";
  }

  function buildModel(report, contract) {
    if (!report || !report.presentation || !contract) return null;
    var p = report.presentation;
    var precision = p.precision;
    var higherIsBetter = readPath(report, contract.direction_field);
    var rawById = Object.create(null);
    (report.contributions || []).forEach(function (item) { rawById[item.feature_id] = item; });
    var rows = [];
    var cursor = p.before;

    rows.push({
      id: "before", role: "endpoint", label: "基準", start: cursor, end: cursor,
      impact: null, display: presentationNumber(p.before, precision), field: "presentation.before"
    });
    (p.contributions || []).forEach(function (item, index) {
      var raw = rawById[item.feature_id] || {};
      var start = cursor;
      cursor = cursor + item.impact; // Geometry-only cumulative position; never displayed or persisted.
      rows.push({
        id: "feature-" + index, role: "contribution", label: raw.label || item.feature_id,
        start: start, end: cursor, impact: item.impact,
        display: signedPresentation(item.impact, precision), field: item.feature_id,
        beforeValue: raw.before_value, afterValue: raw.after_value,
        effect: effectFor(item.impact, "contribution", higherIsBetter)
      });
    });
    var residualStart = cursor;
    cursor = cursor + p.residual; // Geometry only.
    rows.push({
      id: "residual", role: "residual", label: "交互作用（殘差）",
      start: residualStart, end: cursor, impact: p.residual,
      display: signedPresentation(p.residual, precision), field: "presentation.residual",
      effect: effectFor(p.residual, "residual", higherIsBetter)
    });
    if (p.rounding_reconciliation !== 0) {
      var reconciliationStart = cursor;
      cursor = cursor + p.rounding_reconciliation; // Geometry only; remains distinct from residual.
      rows.push({
        id: "reconciliation", role: "reconciliation", label: "顯示進位對帳",
        start: reconciliationStart, end: cursor, impact: p.rounding_reconciliation,
        display: signedPresentation(p.rounding_reconciliation, precision),
        field: "presentation.rounding_reconciliation", effect: "顯示對帳"
      });
    }
    rows.push({
      id: "after", role: "endpoint", label: "對照", start: p.after, end: p.after,
      impact: null, display: presentationNumber(p.after, precision), field: "presentation.after"
    });

    var points = [];
    rows.forEach(function (row) { points.push(row.start, row.end); });
    var minimum = Math.min.apply(Math, points);
    var maximum = Math.max.apply(Math, points);
    var span = maximum - minimum || 1;
    rows.forEach(function (row) {
      row.left = ((Math.min(row.start, row.end) - minimum) / span) * 100;
      row.width = (Math.abs(row.end - row.start) / span) * 100;
      row.anchor = ((row.end - minimum) / span) * 100;
    });

    return {
      rows: rows,
      features: rows.filter(function (row) { return row.role !== "endpoint"; }),
      precision: precision,
      unit: contract.unit_label,
      endpointUnit: contract.endpoint_unit_label,
      direction: higherIsBetter,
      uncertainty: stateFor(report, contract),
      before: presentationNumber(p.before, precision),
      after: presentationNumber(p.after, precision),
      delta: signedPresentation(p.delta, precision)
    };
  }

  function rowClass(row, model) {
    if (row.role === "endpoint") return "endpoint";
    if (row.role === "reconciliation") return "reconciliation";
    var effect = row.impact === 0 ? "zero" : (((row.impact > 0) === model.direction) ? "favorable" : "adverse");
    return row.role === "residual" ? "residual wf-" + effect : effect;
  }

  function markHTML(row, model) {
    var label = row.label + "，" + row.display + (row.role === "endpoint" ? model.endpointUnit : " " + model.unit);
    var geometry = row.role === "endpoint"
      ? "--wf-left:" + row.anchor.toFixed(4) + "%;--wf-width:0%"
      : "--wf-left:" + row.left.toFixed(4) + "%;--wf-width:" + row.width.toFixed(4) + "%";
    return '<div class="wf-row wf-' + rowClass(row, model) + '">' +
      '<span class="wf-label">' + esc(row.label) + (row.effect ? '<small>' + esc(row.effect) + '</small>' : '') + '</span>' +
      '<div class="wf-track">' +
        '<button type="button" class="wf-mark" data-wf-id="' + esc(row.id) + '" style="' + geometry + '"' +
        ' aria-label="' + esc(label) + '" aria-pressed="false"><span aria-hidden="true"></span></button></div>' +
      '<strong class="wf-value">' + esc(row.display) + '<small>' + (row.role === "endpoint" ? esc(model.endpointUnit) : esc(model.unit)) + '</small></strong>' +
    '</div>';
  }

  function fieldHTML(row, model) {
    var change = row.role === "contribution"
      ? rawNumber(row.beforeValue) + " → " + rawNumber(row.afterValue)
      : "—";
    return '<button type="button" class="wf-field" data-wf-id="' + esc(row.id) + '" aria-pressed="false">' +
      '<span><b>' + esc(row.label) + '</b><small>' + esc(change) + '</small></span>' +
      '<strong>' + esc(row.display) + ' <small>' + esc(model.unit) + '</small></strong>' +
    '</button>';
  }

  function evidenceHTML(row, report, model) {
    var beforeAfter = row.role === "contribution"
      ? '<div><dt>輸入原值</dt><dd>' + esc(rawNumber(row.beforeValue)) + ' → ' + esc(rawNumber(row.afterValue)) + '</dd></div>'
      : '<div><dt>輸入原值</dt><dd>—</dd></div>';
    var impact = row.role === "endpoint" ? row.display + model.endpointUnit : row.display + " " + model.unit;
    return '<div class="wf-ev-title"><span>選取證據</span><b>' + esc(row.label) + '</b></div>' +
      '<dl class="wf-ev-list">' +
        '<div><dt>Core 欄位</dt><dd><code>' + esc(row.field) + '</code></dd></div>' + beforeAfter +
        '<div><dt>呈現值</dt><dd>' + esc(impact) + '</dd></div>' +
        '<div><dt>Core 版本</dt><dd><code>' + esc(report.core_version) + '</code></dd></div>' +
        '<div><dt>基準雜湊</dt><dd><code>' + esc(report.before.input_hash) + '</code></dd></div>' +
        '<div><dt>對照雜湊</dt><dd><code>' + esc(report.after.input_hash) + '</code></dd></div>' +
        '<div><dt>方法／重算</dt><dd>' + esc(report.method.resolved) + '／' + esc(report.method.runs) + ' 次</dd></div>' +
        '<div><dt>法源</dt><dd>—（attribution-0.1 未提供法源欄位）</dd></div>' +
      '</dl>';
  }

  function render(report, contract) {
    var model = buildModel(report, contract);
    if (!model) return '<div class="at-err">圖表契約或 Core presentation 不完整，無法呈現。</div>';
    if (!report.presentation.contributions.length) {
      return '<div class="wf-empty"><b>沒有可歸因變更</b><span>' + esc(contract.empty_reason) + '</span></div>';
    }
    var guard = contract.must_not_read_as.map(function (item) { return '<li>' + esc(item) + '</li>'; }).join("");
    return '<section class="wf-shell" data-wf-chart="' + esc(contract.chart_id) + '">' +
      '<div class="wf-head"><div><span class="wf-kicker">VIEWFINDER · ' + esc(contract.source) + '</span>' +
        '<h5 id="wf-title">' + esc(contract.title) + '</h5></div>' +
        '<span class="wf-cert wf-' + esc(model.uncertainty.level) + '">' + esc(model.uncertainty.label) +
        '<small>' + (model.uncertainty.level === "calibrated" ? "已校準" : "方向性判斷") + '</small></span></div>' +
      '<div class="wf-layout"><div>' +
        '<figure class="wf-figure" aria-labelledby="wf-title"><div class="wf-axis" aria-hidden="true"><span>相對位置</span>' +
          '<span>Core presentation</span><span>幾何映射</span></div>' +
          '<div class="wf-plot">' + model.rows.map(function (row) { return markHTML(row, model); }).join("") + '</div>' +
          '<figcaption>各列依 Core 回傳順序呈現；位置與寬度只做版面映射。</figcaption></figure>' +
        '<div class="wf-fields" aria-label="歸因欄位">' + model.features.map(function (row) { return fieldHTML(row, model); }).join("") + '</div>' +
      '</div><aside class="wf-evidence" aria-live="polite"></aside></div>' +
      '<div class="wf-guard"><b>不可解讀為</b><ul>' + guard + '</ul></div>' +
    '</section>';
  }

  function bind(rootNode, report, contract) {
    if (!rootNode) return;
    var model = buildModel(report, contract);
    if (!model || !report.presentation.contributions.length) return;
    var evidence = rootNode.querySelector(".wf-evidence");
    var byId = Object.create(null);
    model.rows.forEach(function (row) { byId[row.id] = row; });

    function select(id) {
      var row = byId[id];
      if (!row) return;
      rootNode.querySelectorAll("[data-wf-id]").forEach(function (element) {
        var active = element.getAttribute("data-wf-id") === id;
        element.classList.toggle("is-active", active);
        element.setAttribute("aria-pressed", active ? "true" : "false");
      });
      if (evidence) evidence.innerHTML = evidenceHTML(row, report, model);
    }

    rootNode.querySelectorAll("[data-wf-id]").forEach(function (element) {
      element.addEventListener("click", function () { select(element.getAttribute("data-wf-id")); });
      element.addEventListener("focus", function () { select(element.getAttribute("data-wf-id")); });
      element.addEventListener("pointerenter", function () { select(element.getAttribute("data-wf-id")); });
    });
    select(model.features[0].id);
  }

  return {
    buildModel: buildModel,
    render: render,
    bind: bind,
    presentationNumber: presentationNumber
  };
});
